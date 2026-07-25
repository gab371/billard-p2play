// Physical constants for the pool table. All distances are in "table meters".
// The canvas renderer scales these to pixels (see PoolTable.tsx).

import type { Vec2 } from "./types";
import type { Segment } from "./geometry";

export const TABLE_WIDTH = 2.24;
export const TABLE_HEIGHT = 1.12;
export const CUSHION = 0.05;

export const BALL_RADIUS = 0.028;
export const POCKET_RADIUS = 0.062; // slightly generous capture to avoid corner escapes

export const RAIL_REST = 0.86;
export const BALL_REST = 0.96;

export const ROLL_FRICTION = 0.55;
export const STOP_THRESHOLD = 0.012;

export const MAX_SHOT_SPEED = 6.0;
export const MIN_SHOT_SPEED = 0.4;

/** Head string / kitchen boundary (cue ball must stay at x ≤ this on break). */
export const HEAD_STRING = TABLE_WIDTH * 0.25;

export const POCKETS: Vec2[] = [
  { x: 0, y: 0 },
  { x: TABLE_WIDTH / 2, y: -0.008 },
  { x: TABLE_WIDTH, y: 0 },
  { x: 0, y: TABLE_HEIGHT },
  { x: TABLE_WIDTH / 2, y: TABLE_HEIGHT + 0.008 },
  { x: TABLE_WIDTH, y: TABLE_HEIGHT },
];

// Cushion segments leave openings at pockets. Ends sit just outside pocket mouths
// so balls near corners fall in before bouncing off a rail tip.
const CORNER_GAP = 0.07;
const SIDE_GAP = 0.065;

export const CUSHIONS: Segment[] = [
  // Top rail
  { a: { x: CORNER_GAP, y: 0 }, b: { x: TABLE_WIDTH / 2 - SIDE_GAP, y: 0 } },
  { a: { x: TABLE_WIDTH / 2 + SIDE_GAP, y: 0 }, b: { x: TABLE_WIDTH - CORNER_GAP, y: 0 } },
  // Bottom rail
  { a: { x: CORNER_GAP, y: TABLE_HEIGHT }, b: { x: TABLE_WIDTH / 2 - SIDE_GAP, y: TABLE_HEIGHT } },
  { a: { x: TABLE_WIDTH / 2 + SIDE_GAP, y: TABLE_HEIGHT }, b: { x: TABLE_WIDTH - CORNER_GAP, y: TABLE_HEIGHT } },
  // Left / right rails
  { a: { x: 0, y: CORNER_GAP }, b: { x: 0, y: TABLE_HEIGHT - CORNER_GAP } },
  { a: { x: TABLE_WIDTH, y: CORNER_GAP }, b: { x: TABLE_WIDTH, y: TABLE_HEIGHT - CORNER_GAP } },
];

/**
 * Closed playable rectangle for aim preview only. Same level as the green
 * cushions, but with no pocket gaps — so the dotted trajectory stops at the
 * rail line even when aimed into a hole (instead of leaking through the wood).
 */
export const AIM_RAILS: Segment[] = [
  { a: { x: 0, y: 0 }, b: { x: TABLE_WIDTH, y: 0 } },
  { a: { x: 0, y: TABLE_HEIGHT }, b: { x: TABLE_WIDTH, y: TABLE_HEIGHT } },
  { a: { x: 0, y: 0 }, b: { x: 0, y: TABLE_HEIGHT } },
  { a: { x: TABLE_WIDTH, y: 0 }, b: { x: TABLE_WIDTH, y: TABLE_HEIGHT } },
];

export const FPS = 60;
export const DT = 1 / FPS;
export const STREAM_HZ = 30;

/** Mild lateral bias at strike from side English (most effect is post-hit). */
export const SIDE_SPIN_SPEED = 0.12;
/**
 * Post-collision follow (top) / draw (back) impulse scale.
 * Applied along the contact normal after the elastic hit so topspin continues
 * forward into the object ball and backspin comes back toward the shooter.
 */
export const FOLLOW_DRAW_FACTOR = 0.38;
/** Cue leave-angle from side English (fraction of impact speed). */
export const SIDE_CUE_FACTOR = 0.22;
/** Object-ball “throw” from side English (fraction of impact speed). */
export const SIDE_OBJ_THROW = 0.10;
