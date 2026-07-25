// PoolGameEngine — authoritative state machine for 8-ball pool with teams.
// Holds the GameState, builds the rack, fires shots, and resolves outcomes.
// Physics is delegated to `physics.ts`, rule decisions to `rules.ts`.

import type {
  GameState, ShotRequest, TeamId,
} from "./types";
import { MAX_SHOT_SPEED, MIN_SHOT_SPEED, SIDE_SPIN_SPEED } from "./constants";
import { buildRack, resetCueBall } from "./rack";
import { isMoving, step, type PhysicsEvent } from "./physics";
import { evaluateShot, recomputeRemaining, clampCuePlacement, placementModeForPhase } from "./rules";
import { logShotResolution, pushLog, shooterName, teamLabel } from "./journal";

export class PoolGameEngine {
  public state: GameState;
  private teamShooterIndex: Record<TeamId, number> = { SOLIDS: 0, STRIPES: 0 };
  private preShotPocketed: Set<number> = new Set();
  private shotEvents: PhysicsEvent[] = [];
  /** Captured in fireShot because phase becomes RESOLVING before finishShot. */
  private preShotWasBreak = false;

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
      this.state.logs = [];
      pushLog(this.state, "Aucun joueur assigné à une équipe.", "warning");
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
    this.state.logs = [];
    recomputeRemaining(this.state);
    if (solids.length === 0 || stripes.length === 0) {
      pushLog(this.state, "Mode entraînement : une seule équipe présente.", "info");
    }
    pushLog(
      this.state,
      `Cassure ! ${shooterName(this.state)} (${teamLabel(firstTeam)}) commence.`,
      "phase",
    );
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
    const mode = placementModeForPhase(this.state.phase);
    const next = clampCuePlacement(pos, mode, this.state.balls);
    if (!next) return; // overlap — keep previous position
    cue.pos = next;
    cue.pocketed = false;
    cue.pocketIndex = null;
  }

  /** Confirm placement: ends ball-in-hand so the player can aim & shoot. */
  confirmPlacement(shooterId: string): void {
    if (!this.state.ballInHand || this.state.activeShooterId !== shooterId) return;
    this.state.ballInHand = false;
  }

  /**
   * Test / debug only — not exposed in the player UI (Idée 9).
   * Re-enable ball-in-hand for the active shooter.
   */
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

    this.preShotWasBreak = this.state.phase === "BREAKING";
    this.preShotPocketed = new Set(this.state.balls.filter((b) => b.pocketed).map((b) => b.id));
    this.shotEvents = [];

    const power = Math.max(0, Math.min(1, shot.power));
    const speed = MIN_SHOT_SPEED + (MAX_SHOT_SPEED - MIN_SHOT_SPEED) * power;
    const side = Math.max(-1, Math.min(1, shot.spinSide ?? 0));
    const top = Math.max(-1, Math.min(1, shot.spinTop ?? 0));
    const fx = Math.cos(shot.angle);
    const fy = Math.sin(shot.angle);
    // Mild side kick at strike; follow/draw applies after the first object hit.
    const px = -fy;
    const py = fx;
    const sideKick = side * SIDE_SPIN_SPEED * (0.35 + 0.65 * power);
    cue.vel = {
      x: fx * speed + px * sideKick,
      y: fy * speed + py * sideKick,
    };
    cue.spinTop = top;
    cue.spinSide = side;

    this.state.ballInHand = false;
    this.state.phase = "RESOLVING";
    this.state.shotId += 1;

    const who = shooterName(this.state);
    const team = this.state.activeTeam;
    const teamBit = team ? ` (${teamLabel(team)})` : "";
    const pct = Math.round(power * 100);
    if (this.preShotWasBreak) {
      pushLog(this.state, `${who}${teamBit} casse (${pct}%).`, "shot");
    } else {
      pushLog(this.state, `${who}${teamBit} tire (${pct}%).`, "shot");
    }
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
    const outcome = evaluateShot(this.state, this.shotEvents, newlyPocketed, this.preShotWasBreak);
    const team = this.state.activeTeam!;
    const who = shooterName(this.state);

    if (outcome.win) {
      logShotResolution(this.state, this.shotEvents, newlyPocketed, {
        foul: outcome.foul,
        foulReason: outcome.foulReason,
        continueShooting: false,
        groupAssigned: outcome.groupAssigned,
      });
      this.state.winnerTeam = outcome.win;
      this.state.phase = "GAME_OVER";
      pushLog(this.state, `🏆 ${teamLabel(outcome.win)} remporte la partie !`, "victory");
      return;
    }
    if (outcome.loss) {
      logShotResolution(this.state, this.shotEvents, newlyPocketed, {
        foul: outcome.foul,
        foulReason: outcome.foulReason,
        continueShooting: false,
        groupAssigned: outcome.groupAssigned,
      });
      const other: TeamId = outcome.loss === "SOLIDS" ? "STRIPES" : "SOLIDS";
      this.state.winnerTeam = other;
      this.state.phase = "GAME_OVER";
      pushLog(
        this.state,
        `💀 ${teamLabel(outcome.loss)} a empoché la 8 prématurément. Victoire de ${teamLabel(other)}.`,
        "failure",
      );
      return;
    }

    if (outcome.foul) {
      this.state.foulMessage = outcome.foulReason;
    } else {
      this.state.foulMessage = null;
    }

    let nextShooterName: string | null = null;
    let nextTeam: TeamId | null = null;

    if (outcome.continueShooting) {
      this.state.phase = "SHOOTING";
      this.state.ballInHand = false;
    } else {
      const other: TeamId = team === "SOLIDS" ? "STRIPES" : "SOLIDS";
      const nextMembers = this.state.players.filter((p) => p.team === other);
      if (nextMembers.length === 0) {
        // Practice: no opponent — same shooter keeps the table.
        this.state.phase = outcome.foul ? "BALL_IN_HAND" : "SHOOTING";
        this.state.ballInHand = outcome.foul;
        if (outcome.foul) {
          nextShooterName = who;
          nextTeam = team;
        }
      } else {
        this.teamShooterIndex[other] = (this.teamShooterIndex[other] + 1);
        this.advanceShooter(other);
        this.state.activeTeam = other;
        this.state.phase = outcome.foul ? "BALL_IN_HAND" : "SHOOTING";
        this.state.ballInHand = outcome.foul;
        nextShooterName = shooterName(this.state);
        nextTeam = other;
      }
    }

    logShotResolution(this.state, this.shotEvents, newlyPocketed, {
      foul: outcome.foul,
      foulReason: outcome.foulReason,
      continueShooting: outcome.continueShooting,
      groupAssigned: outcome.groupAssigned,
      nextShooterName: outcome.continueShooting ? null : nextShooterName,
      nextTeam: outcome.continueShooting ? null : nextTeam,
    });
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
