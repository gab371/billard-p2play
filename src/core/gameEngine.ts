// PoolGameEngine — authoritative state machine for 8-ball pool with teams.
// Holds the GameState, builds the rack, fires shots, and resolves outcomes.
// Physics is delegated to `physics.ts`, rule decisions to `rules.ts`.

import type {
  GameState, ShotRequest, TeamId, GameLog,
} from "./types";
import { MAX_SHOT_SPEED, MIN_SHOT_SPEED } from "./constants";
import { buildRack, resetCueBall } from "./rack";
import { isMoving, step, type PhysicsEvent } from "./physics";
import { evaluateShot, recomputeRemaining, clampCuePlacement } from "./rules";

let logSeq = 0;
function makeLog(message: string, type: GameLog["type"]): GameLog {
  return {
    id: `log_${Date.now()}_${logSeq++}`,
    timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    message,
    type,
  };
}

export class PoolGameEngine {
  public state: GameState;
  private teamShooterIndex: Record<TeamId, number> = { SOLIDS: 0, STRIPES: 0 };
  private preShotPocketed: Set<number> = new Set();
  private shotEvents: PhysicsEvent[] = [];

  constructor() {
    this.state = {
      phase: "LOBBY",
      players: [],
      balls: [],
      activeTeam: null,
      activeShooterId: null,
      teamGroups: { SOLIDS: null, STRIPES: null },
      remaining: { SOLIDS: 7, STRIPES: 7, EIGHT: 1, CUE: 1 },
      ballInHand: false,
      foulMessage: null,
      logs: [],
      winnerTeam: null,
      aim: { shooterId: null, angle: 0, power: 0 },
      shotId: 0,
      spectatorLocks: {},
    };
  }

  // --- Lobby / config ------------------------------------------------------
  addPlayer(id: string, name: string, avatar: string, isHost: boolean): void {
    if (this.state.players.some((p) => p.id === id)) return;
    this.state.players.push({
      id, name, avatar, isHost, isReady: false, team: null, rotationIndex: 0,
    });
  }

  removePlayer(id: string): void {
    this.state.players = this.state.players.filter((p) => p.id !== id);
    if (this.state.activeShooterId === id) this.state.activeShooterId = null;
  }

  setPlayerReady(id: string, ready: boolean): void {
    const p = this.state.players.find((pl) => pl.id === id);
    if (p) p.isReady = ready;
  }

  /** Host assigns a player to a team (or null = spectator). Refuses to assign a
   * team to a host-locked spectator. */
  assignTeam(playerId: string, team: TeamId | null): void {
    const p = this.state.players.find((pl) => pl.id === playerId);
    if (!p) return;
    if (team !== null && this.isLocked(playerId)) return; // locked spectators stay spectators
    p.team = team;
  }

  setSpectatorLock(peerId: string, locked: boolean): void {
    // Lock only applies to spectators (cannot "lock in player mode").
    if (locked) this.assignTeam(peerId, null);
    this.state.spectatorLocks[peerId] = locked;
  }

  isLocked(peerId: string): boolean {
    return !!this.state.spectatorLocks[peerId];
  }

  // --- Game lifecycle ------------------------------------------------------
  startGame(): void {
    const solids = this.state.players.filter((p) => p.team === "SOLIDS");
    const stripes = this.state.players.filter((p) => p.team === "STRIPES");
    if (solids.length === 0 && stripes.length === 0) {
      this.state.logs.push(makeLog("Aucun joueur assigné à une équipe.", "warning"));
      return;
    }
    // Pick the first team that has players (the other may be empty → practice mode).
    const firstTeam: TeamId = solids.length > 0 ? "SOLIDS" : "STRIPES";
    const firstMembers = firstTeam === "SOLIDS" ? solids : stripes;
    this.state.balls = buildRack();
    this.state.teamGroups = { SOLIDS: null, STRIPES: null };
    this.state.winnerTeam = null;
    this.state.foulMessage = null;
    this.state.activeTeam = firstTeam;
    this.teamShooterIndex = { SOLIDS: 0, STRIPES: 0 };
    this.state.activeShooterId = firstMembers[0].id;
    this.state.ballInHand = true; // break: place cue ball in the kitchen
    this.state.phase = "BREAKING";
    recomputeRemaining(this.state);
    if (solids.length === 0 || stripes.length === 0) {
      this.state.logs.push(makeLog("Mode entraînement : une seule équipe présente.", "info"));
    }
    this.state.logs.push(makeLog("Cassure ! Que la partie commence.", "phase"));
  }

  // --- Aiming / ball-in-hand ----------------------------------------------
  setAim(shooterId: string, angle: number, power: number): void {
    if (this.state.activeShooterId !== shooterId) return;
    this.state.aim = { shooterId, angle, power };
  }

  /** Drag the cue ball during ball-in-hand (does NOT consume ball-in-hand). */
  placeCueBall(shooterId: string, pos: { x: number; y: number }): void {
    if (!this.state.ballInHand || this.state.activeShooterId !== shooterId) return;
    const cue = this.state.balls.find((b) => b.id === 0);
    if (!cue) return;
    cue.pos = clampCuePlacement(pos);
    cue.pocketed = false;
    cue.pocketIndex = null;
  }

  /** Confirm placement: ends ball-in-hand so the player can aim & shoot. */
  confirmPlacement(shooterId: string): void {
    if (!this.state.ballInHand || this.state.activeShooterId !== shooterId) return;
    this.state.ballInHand = false;
  }

  /** Re-enable ball-in-hand for the active shooter (so they can reposition). */
  requestBallInHand(shooterId: string): void {
    if (this.state.activeShooterId !== shooterId) return;
    if (this.state.phase !== "SHOOTING" && this.state.phase !== "BREAKING" && this.state.phase !== "BALL_IN_HAND") return;
    this.state.ballInHand = true;
  }

  // --- Shooting -----------------------------------------------------------
  fireShot(shooterId: string, shot: ShotRequest): PhysicsEvent[] {
    if (this.state.activeShooterId !== shooterId) return [];
    if (this.state.phase !== "BREAKING" && this.state.phase !== "SHOOTING" && this.state.phase !== "BALL_IN_HAND") {
      return [];
    }
    const cue = this.state.balls.find((b) => b.id === 0);
    if (!cue || cue.pocketed) return [];

    // Snapshot pre-shot pocketed set to compute newly potted balls.
    this.preShotPocketed = new Set(this.state.balls.filter((b) => b.pocketed).map((b) => b.id));
    this.shotEvents = [];

    const speed = MIN_SHOT_SPEED + (MAX_SHOT_SPEED - MIN_SHOT_SPEED) * Math.max(0, Math.min(1, shot.power));
    cue.vel = { x: Math.cos(shot.angle) * speed, y: Math.sin(shot.angle) * speed };

    this.state.ballInHand = false;
    this.state.phase = "RESOLVING";
    this.state.shotId += 1;
    return [];
  }

  /** Advance physics one tick during a shot. Returns sound events. */
  tick(dt: number): PhysicsEvent[] {
    if (this.state.phase !== "RESOLVING") return [];
    const events = step(this.state.balls, dt);
    this.shotEvents.push(...events);
    return events;
  }

  /** Called when all balls have stopped. Resolves the outcome + turn. */
  finishShot(): void {
    const newlyPocketed = this.state.balls
      .filter((b) => b.pocketed && !this.preShotPocketed.has(b.id))
      .map((b) => b.id);

    // Restore the cue ball if it was scratched (it stays in play).
    if (this.state.balls.find((b) => b.id === 0)?.pocketed) {
      resetCueBall(this.state.balls);
    }

    recomputeRemaining(this.state);
    const outcome = evaluateShot(this.state, this.shotEvents, newlyPocketed);
    const team = this.state.activeTeam!;

    if (outcome.win) {
      this.state.winnerTeam = outcome.win;
      this.state.phase = "GAME_OVER";
      this.state.logs.push(makeLog(`🏆 Équipe ${outcome.win === "SOLIDS" ? "Pleines" : "Rayées"} remporte la partie !`, "victory"));
      return;
    }
    if (outcome.loss) {
      const other: TeamId = outcome.loss === "SOLIDS" ? "STRIPES" : "SOLIDS";
      this.state.winnerTeam = other;
      this.state.phase = "GAME_OVER";
      this.state.logs.push(makeLog(`💀 Équipe ${outcome.loss === "SOLIDS" ? "Pleines" : "Rayées"} empoché la 8 prématurément. Victoire adverse.`, "failure"));
      return;
    }

    if (outcome.groupAssigned) {
      const g = this.state.teamGroups[team];
      this.state.logs.push(makeLog(`Équipe ${team === "SOLIDS" ? "Pleines" : "Rayées"} : ${g === "SOLIDS" ? "Pleines (1-7)" : "Rayées (9-15)"}.`, "info"));
    }

    if (outcome.foul) {
      this.state.foulMessage = outcome.foulReason;
      this.state.logs.push(makeLog(`Faute — ${outcome.foulReason}`, "foul"));
    } else {
      this.state.foulMessage = null;
    }

    if (outcome.continueShooting) {
      // Same shooter keeps the table.
      this.state.phase = "SHOOTING";
      this.state.ballInHand = false;
    } else {
      // Pass the turn to the other team, next shooter in their rotation.
      const nextTeam: TeamId = team === "SOLIDS" ? "STRIPES" : "SOLIDS";
      const nextMembers = this.state.players.filter((p) => p.team === nextTeam);
      if (nextMembers.length === 0) {
        // Practice mode: the other team is empty, keep the current shooter.
        this.state.phase = outcome.foul ? "BALL_IN_HAND" : "SHOOTING";
        this.state.ballInHand = outcome.foul;
      } else {
        this.teamShooterIndex[nextTeam] = (this.teamShooterIndex[nextTeam] + 1);
        this.advanceShooter(nextTeam);
        this.state.activeTeam = nextTeam;
        this.state.phase = outcome.foul ? "BALL_IN_HAND" : "SHOOTING";
        this.state.ballInHand = outcome.foul;
      }
    }
  }

  private advanceShooter(team: TeamId): void {
    const members = this.state.players.filter((p) => p.team === team);
    if (members.length === 0) return;
    const idx = this.teamShooterIndex[team] % members.length;
    this.state.activeShooterId = members[idx].id;
  }

  isShooting(): boolean {
    return this.state.phase === "RESOLVING" && isMoving(this.state.balls);
  }
}
