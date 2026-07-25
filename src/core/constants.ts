// Physical constants for the pool table. All distances are in "table meters".
// Default profile = POOL (used by aiming / placement when no variant layout passed).

import type { Vec2 } from "./types";
import type { Segment } from "./geometry";
import { POOL_LAYOUT } from "./tableLayout";

export const TABLE_WIDTH = POOL_LAYOUT.width;
export const TABLE_HEIGHT = POOL_LAYOUT.height;
export const CUSHION = 0.05;

export const BALL_RADIUS = 0.028;
export const POCKET_RADIUS = 0.062;

export const RAIL_REST = 0.86;
export const BALL_REST = 0.96;

export const ROLL_FRICTION = 0.55;
export const STOP_THRESHOLD = 0.012;

export const MAX_SHOT_SPEED = 6.0;
export const MIN_SHOT_SPEED = 0.4;

export const HEAD_STRING = POOL_LAYOUT.headString;

export const POCKETS: Vec2[] = POOL_LAYOUT.pockets;
export const CUSHIONS: Segment[] = POOL_LAYOUT.cushions;
export const AIM_RAILS: Segment[] = POOL_LAYOUT.aimRails;

export const FPS = 60;
export const DT = 1 / FPS;
export const STREAM_HZ = 30;

export const SIDE_SPIN_SPEED = 0.12;
export const FOLLOW_DRAW_FACTOR = 0.38;
export const SIDE_CUE_FACTOR = 0.22;
export const SIDE_OBJ_THROW = 0.10;
