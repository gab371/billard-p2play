// Initial rack (triangle) and cue ball placement. Pure construction helpers.

import type { Ball, Vec2 } from "./types";
import { BALL_RADIUS, TABLE_HEIGHT, TABLE_WIDTH } from "./constants";

const SPACING = BALL_RADIUS * 2 + 0.0005;

function makeBall(id: number, pos: Vec2): Ball {
  const group = id === 0 ? "CUE" : id === 8 ? "EIGHT" : id <= 7 ? "SOLIDS" : "STRIPES";
  return {
    id,
    group,
    pos,
    vel: { x: 0, y: 0 },
    angle: 0,
    pocketed: false,
    pocketIndex: null,
    spinTop: 0,
    spinSide: 0,
  };
}

/** Standard 15-ball triangle at the foot spot, cue ball at the head spot. */
export function buildRack(): Ball[] {
  const balls: Ball[] = [];

  // Cue ball at the head spot (left quarter).
  balls.push(makeBall(0, { x: TABLE_WIDTH * 0.25, y: TABLE_HEIGHT / 2 }));

  // Foot spot (right quarter) — apex of the triangle pointing toward the cue.
  const apex: Vec2 = { x: TABLE_WIDTH * 0.7, y: TABLE_HEIGHT / 2 };

  // A valid-ish rack: 8 in the middle of the third row, corners alternating.
  // Order chosen so the 8 sits center and solids/stripes are mixed.
  const order = [1, 9, 2, 10, 8, 3, 11, 4, 12, 5, 13, 6, 14, 7, 15];
  let idx = 0;
  const rowOffset = SPACING * Math.sqrt(3) / 2; // horizontal between rows
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col <= row; col++) {
      const x = apex.x + row * rowOffset;
      const y = apex.y + (col - row / 2) * SPACING;
      balls.push(makeBall(order[idx++], { x, y }));
    }
  }

  return balls;
}

/** Reset the cue ball to the head spot (used after a scratch / for ball-in-hand). */
export function resetCueBall(balls: Ball[], pos?: Vec2): void {
  const cue = balls.find((b) => b.id === 0);
  if (!cue) return;
  cue.pocketed = false;
  cue.pocketIndex = null;
  cue.vel = { x: 0, y: 0 };
  cue.spinTop = 0;
  cue.spinSide = 0;
  cue.pos = pos ?? { x: TABLE_WIDTH * 0.25, y: TABLE_HEIGHT / 2 };
}
