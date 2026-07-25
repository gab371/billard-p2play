// Shared shot outcome + helpers used by all rule modules.

import type { Ball, GamePhase, GameState, TeamId, Vec2 } from "../types";
import type { PhysicsEvent } from "../physics";
import { BALL_RADIUS } from "../constants";
import { getTableLayout } from "../tableLayout";
import type { TableProfile } from "../variants";
import { dist } from "../geometry";

export interface ShotOutcome {
  foul: boolean;
  foulReason: string | null;
  continueShooting: boolean;
  groupAssigned: boolean;
  win: TeamId | null;
  loss: TeamId | null;
  winPlayerId: string | null;
  respotIds: number[];
  scoreDelta: number;
  /** Cue ball in hand for opponent / incoming shooter. */
  ballInHand: boolean;
  /** Kitchen / baulk (D) placement vs anywhere on table. */
  ballInHandKitchen: boolean;
  /** Blackball: grant N free shots to incoming team. */
  grantFreeShots: number;
  /** Blackball: first free shot is a free ball. */
  grantFreeBall: boolean;
  /** After 9-ball break: next shooter may declare push-out. */
  enablePushOut: boolean;
}

export function emptyOutcome(): ShotOutcome {
  return {
    foul: false,
    foulReason: null,
    continueShooting: false,
    groupAssigned: false,
    win: null,
    loss: null,
    winPlayerId: null,
    respotIds: [],
    scoreDelta: 0,
    ballInHand: false,
    ballInHandKitchen: false,
    grantFreeShots: 0,
    grantFreeBall: false,
    enablePushOut: false,
  };
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

/** Lowest non-pocketed object ball id (for 9/10-ball). */
export function lowestObjectBall(state: GameState): number | null {
  const objs = state.balls
    .filter((b) => !b.pocketed && b.id !== 0)
    .map((b) => b.id)
    .sort((a, b) => a - b);
  return objs[0] ?? null;
}

export function recomputeRemaining(state: GameState): void {
  const count = (group: string) =>
    state.balls.filter((b) => b.group === group && !b.pocketed).length;
  state.remaining = {
    SOLIDS: count("SOLIDS"),
    STRIPES: count("STRIPES"),
    RED: count("RED"),
    YELLOW: count("YELLOW"),
    EIGHT: count("EIGHT"),
    CUE: count("CUE"),
    OBJECT: count("OBJECT"),
  };
}

export type PlacementMode = "kitchen" | "table";

export function placementModeForPhase(phase: GamePhase): PlacementMode {
  return phase === "BREAKING" ? "kitchen" : "table";
}

/** Prefer kitchen when breaking or blackball baulk ball-in-hand. */
export function placementModeForState(state: GameState): PlacementMode {
  if (state.phase === "BREAKING") return "kitchen";
  if (state.ballInHandKitchen) return "kitchen";
  return "table";
}

export function overlapsAnyBall(pos: Vec2, balls: Ball[], ignoreId = 0): boolean {
  const min = BALL_RADIUS * 2 - 0.0005;
  return balls.some((b) => !b.pocketed && b.id !== ignoreId && dist(pos, b.pos) < min);
}

function clampToBounds(pos: Vec2, mode: PlacementMode, profile: TableProfile): Vec2 {
  const layout = getTableLayout(profile);
  const r = BALL_RADIUS;
  const clamped: Vec2 = {
    x: Math.max(r, Math.min(layout.width - r, pos.x)),
    y: Math.max(r, Math.min(layout.height - r, pos.y)),
  };
  if (mode === "kitchen") {
    clamped.x = Math.max(r, Math.min(layout.headString, clamped.x));
  }
  return clamped;
}

export function clampCuePlacement(
  pos: Vec2,
  mode: PlacementMode = "table",
  balls: Ball[] = [],
  tableProfile: TableProfile = "POOL",
): Vec2 | null {
  let p = clampToBounds(pos, mode, tableProfile);
  if (!balls.length) return p;

  const minDist = BALL_RADIUS * 2;
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
    p = clampToBounds(p, mode, tableProfile);
    if (!pushed) break;
  }

  if (overlapsAnyBall(p, balls)) return null;
  return p;
}
