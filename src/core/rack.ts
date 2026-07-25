// Initial rack placements per variant. Pure construction helpers.

import type { Ball, BallGroup, Vec2 } from "./types";
import type { RackKind } from "./variants";
import { getTableLayout } from "./tableLayout";
import { BALL_RADIUS } from "./constants";
import type { TableProfile } from "./variants";

const SPACING = BALL_RADIUS * 2 + 0.0005;

function makeBall(id: number, pos: Vec2, group: BallGroup): Ball {
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

function usGroup(id: number): BallGroup {
  if (id === 0) return "CUE";
  if (id === 8) return "EIGHT";
  return id <= 7 ? "SOLIDS" : "STRIPES";
}

function enGroup(id: number): BallGroup {
  if (id === 0) return "CUE";
  if (id === 8) return "EIGHT";
  // 1-7 → RED, 9-15 → YELLOW (same seats as solids/stripes).
  return id <= 7 ? "RED" : "YELLOW";
}

function placeTriangle(order: number[], groupOf: (id: number) => BallGroup, w: number, h: number): Ball[] {
  const balls: Ball[] = [];
  balls.push(makeBall(0, { x: w * 0.25, y: h / 2 }, "CUE"));
  const apex: Vec2 = { x: w * 0.7, y: h / 2 };
  let idx = 0;
  const rowOffset = (SPACING * Math.sqrt(3)) / 2;
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col <= row; col++) {
      const id = order[idx++];
      const x = apex.x + row * rowOffset;
      const y = apex.y + (col - row / 2) * SPACING;
      balls.push(makeBall(id, { x, y }, groupOf(id)));
    }
  }
  return balls;
}

function placeDiamond(ids: number[], w: number, h: number): Ball[] {
  const balls: Ball[] = [];
  balls.push(makeBall(0, { x: w * 0.25, y: h / 2 }, "CUE"));
  const apex: Vec2 = { x: w * 0.7, y: h / 2 };
  // Diamond rows: 1 / 2 / 3 / 2 / 1 — center of row 3 is key ball.
  const rows: number[][] = [];
  const n = ids.length;
  if (n === 9) {
    rows.push([ids[0]]);
    rows.push([ids[1], ids[2]]);
    rows.push([ids[3], ids[4], ids[5]]);
    rows.push([ids[6], ids[7]]);
    rows.push([ids[8]]);
  } else {
    // 10-ball: 1 / 2 / 3 / 3 / 1 style — use compact diamond-ish
    rows.push([ids[0]]);
    rows.push([ids[1], ids[2]]);
    rows.push([ids[3], ids[4], ids[5]]);
    rows.push([ids[6], ids[7], ids[8]]);
    rows.push([ids[9]]);
  }
  const rowOffset = (SPACING * Math.sqrt(3)) / 2;
  rows.forEach((row, r) => {
    row.forEach((id, c) => {
      const x = apex.x + r * rowOffset;
      const y = apex.y + (c - (row.length - 1) / 2) * SPACING;
      balls.push(makeBall(id, { x, y }, "OBJECT"));
    });
  });
  return balls;
}

function placeThreeBall(w: number, h: number): Ball[] {
  // 0 = white cue (Team 1), 1 = yellow cue (Team 2), 2 = red object
  return [
    makeBall(0, caromHomePos(0, w, h), "CUE"),
    makeBall(1, caromHomePos(1, w, h), "CUE"),
    makeBall(2, caromHomePos(2, w, h), "OBJECT"),
  ];
}

/** Classic carom starting spots (white / yellow / red). */
export function caromHomePos(id: number, w: number, h: number): Vec2 {
  if (id === 0) return { x: w * 0.25, y: h * 0.35 };
  if (id === 1) return { x: w * 0.25, y: h * 0.65 };
  return { x: w * 0.75, y: h / 2 };
}

function shuffleIds(ids: number[]): number[] {
  const shuffled = [...ids];
  for (let index = shuffled.length - 1; index > 0; index--) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

/**
 * US 8-ball rack (WPA-style):
 * - 8 in the center of the triangle (row 3, middle)
 * - apex = any object ball except 8
 * - back corners = opposite groups (one solid, one stripe)
 * - remaining seats filled at random
 */
function usEightBallOrder(): number[] {
  const solids = shuffleIds([1, 2, 3, 4, 5, 6, 7]);
  const stripes = shuffleIds([9, 10, 11, 12, 13, 14, 15]);
  const order = new Array<number>(15);
  order[4] = 8;

  if (Math.random() < 0.5) {
    order[10] = solids.pop()!;
    order[14] = stripes.pop()!;
  } else {
    order[10] = stripes.pop()!;
    order[14] = solids.pop()!;
  }

  const rest = shuffleIds([...solids, ...stripes]);
  const freeSlots = [0, 1, 2, 3, 5, 6, 7, 8, 9, 11, 12, 13];
  freeSlots.forEach((slot, restIndex) => {
    order[slot] = rest[restIndex];
  });
  return order;
}

export function buildRack(
  rackKind: RackKind = "TRIANGLE_15",
  opts: { colored?: boolean; tableProfile?: TableProfile } = {},
): Ball[] {
  const layout = getTableLayout(opts.tableProfile ?? "POOL");
  const { width: w, height: h } = layout;
  const colored = opts.colored ?? false;

  if (rackKind === "THREE_BALL") return placeThreeBall(w, h);

  if (rackKind === "DIAMOND_9") {
    // 1 at apex, 9 center, others mixed.
    const order = [1, 2, 3, 4, 9, 5, 6, 7, 8];
    return placeDiamond(order, w, h);
  }

  if (rackKind === "DIAMOND_10") {
    const order = [1, 2, 3, 4, 10, 5, 6, 7, 8, 9];
    return placeDiamond(order, w, h);
  }

  // TRIANGLE_15
  if (colored) {
    // Official blackball racks (WPA / EPBF): black in center of row 3;
    // opposite colors on the two back corners. Two mirrors (yellow or red apex).
    const yellowApex = [9, 1, 10, 11, 8, 2, 3, 12, 4, 13, 14, 5, 6, 15, 7];
    const redApex = [1, 9, 2, 3, 8, 10, 11, 4, 12, 5, 6, 13, 14, 7, 15];
    const order = Math.random() < 0.5 ? yellowApex : redApex;
    return placeTriangle(order, enGroup, w, h);
  }
  return placeTriangle(usEightBallOrder(), usGroup, w, h);
}

/** Reset the cue ball to the head spot (scratch / ball-in-hand). */
export function resetCueBall(balls: Ball[], pos?: Vec2, tableProfile: TableProfile = "POOL"): void {
  const cue = balls.find((b) => b.id === 0);
  if (!cue) return;
  const layout = getTableLayout(tableProfile);
  cue.pocketed = false;
  cue.pocketIndex = null;
  cue.vel = { x: 0, y: 0 };
  cue.spinTop = 0;
  cue.spinSide = 0;
  cue.pos = pos ?? { x: layout.width * 0.25, y: layout.height / 2 };
}

/** Re-spot an object ball near the foot spot (illegal 9 / 14.1). */
export function respotBall(balls: Ball[], id: number, tableProfile: TableProfile = "POOL"): void {
  const ball = balls.find((b) => b.id === id);
  if (!ball) return;
  const layout = getTableLayout(tableProfile);
  ball.pocketed = false;
  ball.pocketIndex = null;
  ball.vel = { x: 0, y: 0 };
  ball.pos = { x: layout.width * 0.7, y: layout.height / 2 };
}
