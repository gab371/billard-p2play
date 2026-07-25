// 8-ball rule resolution. Pure decision function: given the game state, the shot
// that was fired, the physics events of the shot and the ids of balls pocketed
// during the shot, returns the outcome. The engine applies the outcome to state.

import type { Ball, GamePhase, GameState, TeamId, Vec2 } from "./types";
import type { PhysicsEvent } from "./physics";
import { BALL_RADIUS, HEAD_STRING, TABLE_HEIGHT, TABLE_WIDTH } from "./constants";
import { dist } from "./geometry";

export interface ShotOutcome {
  foul: boolean;
  foulReason: string | null;
  continueShooting: boolean;
  groupAssigned: boolean;
  win: TeamId | null;
  loss: TeamId | null;
}

/** First object ball the cue ball touched this shot, or null. */
export function firstContact(events: PhysicsEvent[]): number | null {
  for (const e of events) {
    if (e.type !== "clack") continue;
    if (e.ballId === 0 && e.otherId !== undefined) return e.otherId;
    if (e.otherId === 0 && e.ballId !== undefined) return e.ballId;
  }
  return null;
}

/**
 * @param isBreak — true when the shot was fired from BREAKING (engine must pass
 * this because phase is already RESOLVING when finishShot runs).
 */
export function evaluateShot(
  state: GameState,
  events: PhysicsEvent[],
  newlyPocketedIds: number[],
  isBreak = false,
): ShotOutcome {
  const team = state.activeTeam;
  const cue = state.balls.find((b) => b.id === 0)!;
  const cueScratched = cue.pocketed;
  const contact = firstContact(events);
  const eightPocketed = newlyPocketedIds.includes(8);
  const myGroup = team ? state.teamGroups[team] : null;

  let foul = false;
  let foulReason: string | null = null;

  if (contact === null) {
    foul = true;
    foulReason = "Aucune bille touchée.";
  } else {
    const contactBall = state.balls.find((b) => b.id === contact);
    if (contactBall && myGroup && contactBall.group !== myGroup && contactBall.group !== "EIGHT") {
      if (!isBreak) {
        foul = true;
        foulReason = "Bille adverse touchée en premier.";
      }
    }
    if (contactBall && contactBall.group === "EIGHT" && myGroup && state.remaining[myGroup] > 0) {
      foul = true;
      foulReason = "La 8 touchée en premier.";
    }
  }
  if (cueScratched) {
    foul = true;
    foulReason = foulReason ?? "Bille blanche empochée (scratch).";
  }

  // Group assignment: first legal object pot AFTER the break (not on the break itself).
  let groupAssigned = false;
  const legalObjectPotted = newlyPocketedIds.filter((id) => id !== 0 && id !== 8);
  if (team && !myGroup && !foul && legalObjectPotted.length > 0 && !isBreak) {
    const first = state.balls.find((b) => b.id === legalObjectPotted[0])!;
    state.teamGroups[team] = first.group;
    const otherTeam: TeamId = team === "SOLIDS" ? "STRIPES" : "SOLIDS";
    state.teamGroups[otherTeam] = first.group === "SOLIDS" ? "STRIPES" : "SOLIDS";
    groupAssigned = true;
  }

  let win: TeamId | null = null;
  let loss: TeamId | null = null;
  if (eightPocketed) {
    const cleared = myGroup ? state.remaining[myGroup] === 0 : false;
    if (cleared && !foul && !cueScratched) {
      win = team;
    } else {
      loss = team;
    }
  }

  let continueShooting = false;
  if (!win && !loss) {
    const pottedOwn = legalObjectPotted.some((id) => {
      const b = state.balls.find((bb) => bb.id === id)!;
      return myGroup ? b.group === myGroup : true;
    });
    if (isBreak) {
      continueShooting = legalObjectPotted.length > 0 && !foul;
    } else {
      continueShooting = pottedOwn && !foul;
    }
  }

  return { foul, foulReason, continueShooting, groupAssigned, win, loss };
}

export function recomputeRemaining(state: GameState): void {
  const count = (group: string) => state.balls.filter((b) => b.group === group && !b.pocketed).length;
  state.remaining = {
    SOLIDS: count("SOLIDS"),
    STRIPES: count("STRIPES"),
    EIGHT: count("EIGHT"),
    CUE: count("CUE"),
  };
}

export type PlacementMode = "kitchen" | "table";

export function placementModeForPhase(phase: GamePhase): PlacementMode {
  return phase === "BREAKING" ? "kitchen" : "table";
}

/** True if cue center would overlap any non-pocketed object ball. */
export function overlapsAnyBall(pos: Vec2, balls: Ball[], ignoreId = 0): boolean {
  const min = BALL_RADIUS * 2 - 0.0005;
  return balls.some((b) => !b.pocketed && b.id !== ignoreId && dist(pos, b.pos) < min);
}

function clampToPlacementBounds(pos: Vec2, mode: PlacementMode): Vec2 {
  const r = BALL_RADIUS;
  const clamped: Vec2 = {
    x: Math.max(r, Math.min(TABLE_WIDTH - r, pos.x)),
    y: Math.max(r, Math.min(TABLE_HEIGHT - r, pos.y)),
  };
  if (mode === "kitchen") {
    clamped.x = Math.max(r, Math.min(HEAD_STRING, clamped.x));
  }
  return clamped;
}

/**
 * Clamp cue-ball placement. Kitchen = behind head string (break only).
 * Resolves soft collisions by pushing off overlapping object balls.
 * Returns null only if no valid spot can be found (caller keeps previous pos).
 */
export function clampCuePlacement(
  pos: Vec2,
  mode: PlacementMode = "table",
  balls: Ball[] = [],
): Vec2 | null {
  let p = clampToPlacementBounds(pos, mode);
  if (!balls.length) return p;

  const minDist = BALL_RADIUS * 2;
  // A few iterations so the cue slides around clusters instead of tunneling in.
  for (let iter = 0; iter < 4; iter++) {
    let pushed = false;
    for (const b of balls) {
      if (b.pocketed || b.id === 0) continue;
      const d = dist(p, b.pos);
      if (d >= minDist - 0.0005) continue;
      pushed = true;
      if (d < 1e-8) {
        p = { x: b.pos.x + minDist, y: b.pos.y };
      } else {
        const n = { x: (p.x - b.pos.x) / d, y: (p.y - b.pos.y) / d };
        p = { x: b.pos.x + n.x * minDist, y: b.pos.y + n.y * minDist };
      }
    }
    p = clampToPlacementBounds(p, mode);
    if (!pushed) break;
  }

  if (overlapsAnyBall(p, balls)) return null;
  return p;
}
