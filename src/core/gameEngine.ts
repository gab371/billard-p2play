// PoolGameEngine — authoritative state machine for all billiard variants.
// Physics → physics.ts; rule decisions → rules/*.

import type { GameConfig, GameState, ShotRequest, TeamId } from "./types";
import { MAX_SHOT_SPEED, MIN_SHOT_SPEED, SIDE_SPIN_SPEED } from "./constants";
import { buildRack, resetCueBall, respotBall } from "./rack";
import { isMoving, step, type PhysicsEvent } from "./physics";
import {
  evaluateShot,
  recomputeRemaining,
  clampCuePlacement,
  placementModeForState,
} from "./rules";
import { logShotResolution, pushLog, shooterName, teamLabel } from "./journal";
import {
  DEFAULT_VARIANT_ID,
  getVariant,
  isReadyToShoot,
  activeCueBallId,
  type VariantId,
} from "./variants";
import { getTableLayout } from "./tableLayout";
import { applyVariantStartFlags, setupTwoTeamStart } from "./startGameSetup";
import { applyOutcomeFlags, resolveTurnHandoff } from "./turnResolve";
import { remapRecordKey } from "p2play-core/presence";

function initialState(): GameState {
  return {
    phase: "LOBBY",
    players: [],
    balls: [],
    activeTeam: null,
    activeShooterId: null,
    teamGroups: { SOLIDS: null, STRIPES: null },
    remaining: { SOLIDS: 7, STRIPES: 7, RED: 7, YELLOW: 7, EIGHT: 1, CUE: 1, OBJECT: 0 },
    ballInHand: false,
    foulMessage: null,
    logs: [],
    winnerTeam: null,
    winnerPlayerId: null,
    aim: { shooterId: null, angle: 0, power: 0 },
    shotId: 0,
    spectatorLocks: {},
    config: { variantId: DEFAULT_VARIANT_ID, caromMode: "LIBRE" },
    pendingCall: null,
    scores: {},
    teamScores: { SOLIDS: 0, STRIPES: 0 },
    shooterOrder: [],
    shooterIndex: 0,
    consecutiveFouls: { SOLIDS: 0, STRIPES: 0 },
    freeShotsRemaining: 0,
    freeBall: false,
    ballInHandKitchen: false,
    pushOutAvailable: false,
    pushOutDeclared: false,
  };
}

export class PoolGameEngine {
  public state: GameState;
  private teamShooterIndex: Record<TeamId, number> = { SOLIDS: 0, STRIPES: 0 };
  private preShotPocketed: Set<number> = new Set();
  private shotEvents: PhysicsEvent[] = [];
  private preShotWasBreak = false;

  constructor() {
    this.state = initialState();
  }

  setConfig(partial: Partial<GameConfig>): boolean {
    if (this.state.phase !== "LOBBY" && this.state.phase !== "CONFIG") return false;
    if (partial.variantId && !getVariant(partial.variantId)) return false;
    this.state.config = { ...this.state.config, ...partial };
    if (partial.variantId === "FR_CAROM" && !this.state.config.caromMode) {
      this.state.config.caromMode = "LIBRE";
    }
    return true;
  }

  addPlayer(id: string, name: string, avatar: string, isHost: boolean): void {
    if (this.state.players.some((p) => p.id === id)) return;
    this.state.players.push({
      id, name, avatar, isHost, isReady: false, team: null, rotationIndex: 0,
    });
  }

  markDisconnected(id: string): void {
    const p = this.state.players.find(pl => pl.id === id);
    if (p) p.disconnected = true;
  }

  isDisconnected(id: string): boolean {
    return !!this.state.players.find(pl => pl.id === id)?.disconnected;
  }

  remapPlayerId(
    oldId: string,
    newId: string,
    profile?: { username?: string; avatar?: string },
  ): boolean {
    const p = this.state.players.find(pl => pl.id === oldId);
    if (!p) return false;
    p.id = newId;
    p.disconnected = false;
    // Name stays as first seat — reconnect must not rename via client profile.
    if (profile?.avatar) p.avatar = profile.avatar;
    if (this.state.activeShooterId === oldId) this.state.activeShooterId = newId;
    if (this.state.pendingCall?.shooterId === oldId) {
      this.state.pendingCall = { ...this.state.pendingCall, shooterId: newId };
    }
    remapRecordKey(this.state.spectatorLocks, oldId, newId);
    return true;
  }

  removePlayer(id: string): void {
    this.state.players = this.state.players.filter((p) => p.id !== id);
    if (this.state.activeShooterId === id) this.state.activeShooterId = null;
  }

  setPlayerReady(id: string, ready: boolean): void {
    const p = this.state.players.find((pl) => pl.id === id);
    if (p) p.isReady = ready;
  }

  assignTeam(playerId: string, team: TeamId | null): void {
    const p = this.state.players.find((pl) => pl.id === playerId);
    if (!p) return;
    if (team !== null && this.isLocked(playerId)) return;
    p.team = team;
  }

  setSpectatorLock(peerId: string, locked: boolean): void {
    if (locked) this.assignTeam(peerId, null);
    this.state.spectatorLocks[peerId] = locked;
  }

  isLocked(peerId: string): boolean {
    return !!this.state.spectatorLocks[peerId];
  }

  setCall(shooterId: string, ballId: number | null, pocketIndex: number | null): void {
    if (this.state.activeShooterId !== shooterId) return;
    if (this.state.phase !== "BREAKING" && this.state.phase !== "SHOOTING" && this.state.phase !== "BALL_IN_HAND") {
      return;
    }
    this.state.pendingCall = { ballId, pocketIndex, shooterId };
  }

  setPushOut(shooterId: string, declared: boolean): void {
    if (this.state.activeShooterId !== shooterId) return;
    if (!this.state.pushOutAvailable) return;
    this.state.pushOutDeclared = declared;
  }

  startGame(): void {
    const v = getVariant(this.state.config.variantId);
    const { ok } = setupTwoTeamStart(this.state);
    if (!ok) return;
    this.teamShooterIndex = { SOLIDS: 0, STRIPES: 0 };

    this.state.balls = buildRack(v.rackKind, {
      colored: v.id === "EN_BLACKBALL",
      tableProfile: v.tableProfile,
    });
    applyVariantStartFlags(this.state, v);
    recomputeRemaining(this.state);
  }

  setAim(shooterId: string, angle: number, power: number): void {
    if (this.state.activeShooterId !== shooterId) return;
    this.state.aim = { shooterId, angle, power };
  }

  placeCueBall(shooterId: string, pos: { x: number; y: number }): void {
    if (!this.state.ballInHand || this.state.activeShooterId !== shooterId) return;
    const cueId = activeCueBallId(this.state.config.variantId, this.state.activeTeam);
    const cue = this.state.balls.find((b) => b.id === cueId);
    if (!cue) return;
    const v = getVariant(this.state.config.variantId);
    const mode = placementModeForState(this.state);
    const next = clampCuePlacement(pos, mode, this.state.balls, v.tableProfile);
    if (!next) return;
    cue.pos = next;
    cue.pocketed = false;
    cue.pocketIndex = null;
  }

  confirmPlacement(shooterId: string): void {
    if (!this.state.ballInHand || this.state.activeShooterId !== shooterId) return;
    this.state.ballInHand = false;
  }

  requestBallInHand(shooterId: string): void {
    if (this.state.activeShooterId !== shooterId) return;
    if (this.state.phase !== "SHOOTING" && this.state.phase !== "BREAKING" && this.state.phase !== "BALL_IN_HAND") return;
    this.state.ballInHand = true;
  }

  fireShot(shooterId: string, shot: ShotRequest): PhysicsEvent[] {
    if (this.state.activeShooterId !== shooterId) return [];
    if (this.state.phase !== "BREAKING" && this.state.phase !== "SHOOTING" && this.state.phase !== "BALL_IN_HAND") {
      return [];
    }
    if (!isReadyToShoot(this.state)) {
      pushLog(this.state, "Annoncez la bille (et la poche) avant de tirer.", "warning");
      return [];
    }

    const cueId = activeCueBallId(this.state.config.variantId, this.state.activeTeam);
    const cue = this.state.balls.find((b) => b.id === cueId);
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
    const teamBit = team ? ` (${teamLabel(team, this.state.config.variantId)})` : "";
    const pct = Math.round(power * 100);
    const call = this.state.pendingCall;
    if (call?.ballId != null) {
      const pocketBit = call.pocketIndex != null ? ` → poche ${call.pocketIndex + 1}` : "";
      pushLog(this.state, `${who} annonce #${call.ballId}${pocketBit}.`, "info");
    }
    if (this.state.pushOutDeclared) {
      pushLog(this.state, `${who}${teamBit} annonce un push-out.`, "info");
    }
    if (this.preShotWasBreak) {
      pushLog(this.state, `${who}${teamBit} casse (${pct}%).`, "shot");
    } else {
      pushLog(this.state, `${who}${teamBit} tire (${pct}%).`, "shot");
    }
    this.state.pushOutAvailable = false;
    return [];
  }

  tick(dt: number): PhysicsEvent[] {
    if (this.state.phase !== "RESOLVING") return [];
    const v = getVariant(this.state.config.variantId);
    const layout = getTableLayout(v.tableProfile);
    const events = step(this.state.balls, dt, layout);
    this.shotEvents.push(...events);
    return events;
  }

  finishShot(): void {
    const newlyPocketed = this.state.balls
      .filter((b) => b.pocketed && !this.preShotPocketed.has(b.id))
      .map((b) => b.id);

    const v = getVariant(this.state.config.variantId);

    if (this.state.balls.find((b) => b.id === 0)?.pocketed) {
      resetCueBall(this.state.balls, undefined, v.tableProfile);
    }

    recomputeRemaining(this.state);
    const outcome = evaluateShot(this.state, this.shotEvents, newlyPocketed, this.preShotWasBreak);

    for (const id of outcome.respotIds) {
      respotBall(this.state.balls, id, v.tableProfile);
    }
    recomputeRemaining(this.state);

    const team = this.state.activeTeam;
    const threeFoulLoss = applyOutcomeFlags(this.state, outcome, team);
    if (threeFoulLoss) {
      outcome.loss = threeFoulLoss;
    }

    if (outcome.win || outcome.winPlayerId) {
      logShotResolution(this.state, this.shotEvents, newlyPocketed, {
        foul: outcome.foul,
        foulReason: outcome.foulReason,
        continueShooting: false,
        groupAssigned: outcome.groupAssigned,
      });
      if (outcome.win) this.state.winnerTeam = outcome.win;
      if (outcome.winPlayerId) this.state.winnerPlayerId = outcome.winPlayerId;
      this.state.phase = "GAME_OVER";
      pushLog(
        this.state,
        `Victoire de ${teamLabel(outcome.win ?? "SOLIDS", this.state.config.variantId)} !`,
        "victory",
      );
      this.state.pendingCall = null;
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
        `${teamLabel(outcome.loss, this.state.config.variantId)} perd. Victoire de ${teamLabel(other, this.state.config.variantId)}.`,
        "failure",
      );
      this.state.pendingCall = null;
      return;
    }

    this.state.foulMessage = outcome.foul ? outcome.foulReason : null;

    const handoff = resolveTurnHandoff(this.state, outcome, v, this.teamShooterIndex);

    logShotResolution(this.state, this.shotEvents, newlyPocketed, {
      foul: outcome.foul,
      foulReason: outcome.foulReason,
      continueShooting: handoff.keptTurn && outcome.continueShooting,
      groupAssigned: outcome.groupAssigned,
      nextShooterName: handoff.keptTurn && outcome.continueShooting ? null : handoff.nextShooterName,
      nextTeam: handoff.keptTurn && outcome.continueShooting ? null : handoff.nextTeam,
    });

    this.state.pendingCall = null;
  }

  isShooting(): boolean {
    return this.state.phase === "RESOLVING" && isMoving(this.state.balls);
  }

  getVariantId(): VariantId {
    return this.state.config.variantId;
  }
}
