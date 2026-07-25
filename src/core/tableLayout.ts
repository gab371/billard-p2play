// Table geometry profiles (POOL with pockets vs CAROM without).

import type { Vec2 } from "./types";
import type { Segment } from "./geometry";
import type { TableProfile } from "./variants";

export interface TableLayout {
  width: number;
  height: number;
  headString: number;
  hasPockets: boolean;
  pockets: Vec2[];
  cushions: Segment[];
  aimRails: Segment[];
}

const POOL_W = 2.24;
const POOL_H = 1.12;
const CORNER_GAP = 0.07;
const SIDE_GAP = 0.065;

function poolCushions(w: number, h: number): Segment[] {
  return [
    { a: { x: CORNER_GAP, y: 0 }, b: { x: w / 2 - SIDE_GAP, y: 0 } },
    { a: { x: w / 2 + SIDE_GAP, y: 0 }, b: { x: w - CORNER_GAP, y: 0 } },
    { a: { x: CORNER_GAP, y: h }, b: { x: w / 2 - SIDE_GAP, y: h } },
    { a: { x: w / 2 + SIDE_GAP, y: h }, b: { x: w - CORNER_GAP, y: h } },
    { a: { x: 0, y: CORNER_GAP }, b: { x: 0, y: h - CORNER_GAP } },
    { a: { x: w, y: CORNER_GAP }, b: { x: w, y: h - CORNER_GAP } },
  ];
}

function closedRails(w: number, h: number): Segment[] {
  return [
    { a: { x: 0, y: 0 }, b: { x: w, y: 0 } },
    { a: { x: 0, y: h }, b: { x: w, y: h } },
    { a: { x: 0, y: 0 }, b: { x: 0, y: h } },
    { a: { x: w, y: 0 }, b: { x: w, y: h } },
  ];
}

export const POOL_LAYOUT: TableLayout = {
  width: POOL_W,
  height: POOL_H,
  headString: POOL_W * 0.25,
  hasPockets: true,
  pockets: [
    { x: 0, y: 0 },
    { x: POOL_W / 2, y: -0.008 },
    { x: POOL_W, y: 0 },
    { x: 0, y: POOL_H },
    { x: POOL_W / 2, y: POOL_H + 0.008 },
    { x: POOL_W, y: POOL_H },
  ],
  cushions: poolCushions(POOL_W, POOL_H),
  aimRails: closedRails(POOL_W, POOL_H),
};

/** French carom table — longer, no pockets, continuous cushions. */
const CAROM_W = 2.84;
const CAROM_H = 1.42;

export const CAROM_LAYOUT: TableLayout = {
  width: CAROM_W,
  height: CAROM_H,
  headString: CAROM_W * 0.25,
  hasPockets: false,
  pockets: [],
  cushions: closedRails(CAROM_W, CAROM_H),
  aimRails: closedRails(CAROM_W, CAROM_H),
};

export function getTableLayout(profile: TableProfile): TableLayout {
  return profile === "CAROM" ? CAROM_LAYOUT : POOL_LAYOUT;
}
