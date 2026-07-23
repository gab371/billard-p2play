// Physical constants for the pool table. All distances are in "table meters".
// The canvas renderer scales these to pixels (see PoolTable.tsx).

export const TABLE_WIDTH = 2.24;   // playing surface width (m)
export const TABLE_HEIGHT = 1.12;  // playing surface height (m)
export const CUSHION = 0.05;       // cushion thickness drawn around the felt

export const BALL_RADIUS = 0.028;  // 28mm
export const POCKET_RADIUS = 0.055; // pocket capture radius

export const RAIL_REST = 0.86;     // restitution: ball vs cushion
export const BALL_REST = 0.96;     // restitution: ball vs ball

export const ROLL_FRICTION = 0.55; // linear deceleration coefficient (1/s)
export const STOP_THRESHOLD = 0.012;// velocity under which a ball snaps to rest

export const MAX_SHOT_SPEED = 6.0; // m/s, velocity imparted at full power
export const MIN_SHOT_SPEED = 0.4;  // m/s, velocity imparted at near-zero power

// Pocket centers (6 pockets). Coordinates in table space where the playing
// surface spans [0, TABLE_WIDTH] x [0, TABLE_HEIGHT].
import type { Vec2 } from "./types";

export const POCKETS: Vec2[] = [
  { x: 0, y: 0 },                                  // top-left
  { x: TABLE_WIDTH / 2, y: -0.01 },                // top-middle (slightly out)
  { x: TABLE_WIDTH, y: 0 },                        // top-right
  { x: 0, y: TABLE_HEIGHT },                       // bottom-left
  { x: TABLE_WIDTH / 2, y: TABLE_HEIGHT + 0.01 },  // bottom-middle
  { x: TABLE_WIDTH, y: TABLE_HEIGHT },             // bottom-right
];

// Cushion segments as line segments [a, b] the ball bounces off. We model the
// four rails; corner/middle pockets are openings (the ball falls in before
// reaching the exact corner thanks to POCKET_RADIUS capture).
import type { Segment } from "./geometry";

export const CUSHIONS: Segment[] = [
  // Top rail (two segments around the middle pocket)
  { a: { x: 0.04, y: 0 }, b: { x: TABLE_WIDTH / 2 - 0.05, y: 0 } },
  { a: { x: TABLE_WIDTH / 2 + 0.05, y: 0 }, b: { x: TABLE_WIDTH - 0.04, y: 0 } },
  // Bottom rail
  { a: { x: 0.04, y: TABLE_HEIGHT }, b: { x: TABLE_WIDTH / 2 - 0.05, y: TABLE_HEIGHT } },
  { a: { x: TABLE_WIDTH / 2 + 0.05, y: TABLE_HEIGHT }, b: { x: TABLE_WIDTH - 0.04, y: TABLE_HEIGHT } },
  // Left rail
  { a: { x: 0, y: 0.04 }, b: { x: 0, y: TABLE_HEIGHT - 0.04 } },
  // Right rail
  { a: { x: TABLE_WIDTH, y: 0.04 }, b: { x: TABLE_WIDTH, y: TABLE_HEIGHT - 0.04 } },
];

export const FPS = 60;
export const DT = 1 / FPS;
export const STREAM_HZ = 30;       // host broadcast rate during a shot
