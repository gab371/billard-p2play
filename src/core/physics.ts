// Authoritative billiard physics. Operates on a Ball[] array (mutated in place)
// and returns sound events. Pure with respect to the outside world: no React,
// no network, no DOM.
//
// Idée 9+: pockets resolved before cushions; dynamic substeps; soft containment.
// Cue English: mild side at strike; follow/draw + throw applied on first object hit.

import type { Ball, Vec2 } from "./types";
import {
  BALL_RADIUS,
  BALL_REST,
  FOLLOW_DRAW_FACTOR,
  POCKET_RADIUS,
  RAIL_REST,
  ROLL_FRICTION,
  SIDE_CUE_FACTOR,
  SIDE_OBJ_THROW,
  STOP_THRESHOLD,
} from "./constants";
import { POOL_LAYOUT, type TableLayout } from "./tableLayout";
import { add, dist, dot, len, normalize, reflect, scale, sub } from "./geometry";

export interface PhysicsEvent {
  type: "clack" | "cushion" | "pocket";
  intensity: number;
  ballId?: number;
  otherId?: number;
  pocketIndex?: number;
}

function tableCenter(layout: TableLayout): Vec2 {
  return { x: layout.width / 2, y: layout.height / 2 };
}

function closestOnSegment(p: Vec2, a: Vec2, b: Vec2): Vec2 {
  const ab = sub(b, a);
  const t = Math.max(0, Math.min(1, dot(sub(p, a), ab) / dot(ab, ab)));
  return add(a, scale(ab, t));
}

function cushionNormal(seg: { a: Vec2; b: Vec2 }, layout: TableLayout): Vec2 {
  const d = sub(seg.b, seg.a);
  let n = normalize({ x: -d.y, y: d.x });
  const mid = { x: (seg.a.x + seg.b.x) / 2, y: (seg.a.y + seg.b.y) / 2 };
  if (dot(sub(tableCenter(layout), mid), n) < 0) n = scale(n, -1);
  return n;
}

function nearPocket(pos: Vec2, layout: TableLayout): boolean {
  if (!layout.hasPockets) return false;
  return layout.pockets.some((p) => dist(pos, p) < POCKET_RADIUS * 1.35);
}

function resolveBallBall(b1: Ball, b2: Ball, events: PhysicsEvent[]): void {
  const delta = sub(b2.pos, b1.pos);
  const d = len(delta);
  const minDist = 2 * BALL_RADIUS;
  if (d === 0 || d >= minDist) return;

  const n = scale(delta, 1 / d);
  const overlap = minDist - d;
  b1.pos = sub(b1.pos, scale(n, overlap / 2));
  b2.pos = add(b2.pos, scale(n, overlap / 2));

  const rv = sub(b2.vel, b1.vel);
  const vn = dot(rv, n);
  if (vn > 0) return;

  const j = -(1 + BALL_REST) * vn / 2;
  b1.vel = sub(b1.vel, scale(n, j));
  b2.vel = add(b2.vel, scale(n, j));

  // Follow / draw / side throw: only when the cue still carries English.
  applyCueEnglishAfterHit(b1, b2, n, Math.abs(vn));

  events.push({
    type: "clack",
    intensity: Math.min(1, Math.abs(vn) / 3),
    ballId: b2.id,
    otherId: b1.id,
  });
}

/**
 * After the elastic impulse:
 * - topspin → cue follows into the object ball
 * - backspin → cue draws back
 * - side English → cue leave angle (right tip → kick to the right along aim)
 *   and a slight object-ball throw the same way
 * English is consumed on the first object-ball contact.
 */
function applyCueEnglishAfterHit(b1: Ball, b2: Ball, n: Vec2, impactSpeed: number): void {
  const cueIs1 = b1.id === 0;
  const cueIs2 = b2.id === 0;
  if (cueIs1 === cueIs2) return;
  const cue = cueIs1 ? b1 : b2;
  const obj = cueIs1 ? b2 : b1;
  const top = cue.spinTop ?? 0;
  const side = cue.spinSide ?? 0;
  if (top === 0 && side === 0) return;

  // Unit vector from cue toward the object ball (line of centers at contact).
  const intoObj = cueIs1 ? n : scale(n, -1);
  const strength = impactSpeed * (0.45 + 0.55 * Math.min(1, impactSpeed / 3));

  if (top !== 0) {
    cue.vel = add(cue.vel, scale(intoObj, top * FOLLOW_DRAW_FACTOR * strength));
  }
  if (side !== 0) {
    // Table Y grows downward (canvas). Right when looking along intoObj: (-y, x).
    const right = { x: -intoObj.y, y: intoObj.x };
    cue.vel = add(cue.vel, scale(right, side * SIDE_CUE_FACTOR * strength));
    obj.vel = add(obj.vel, scale(right, side * SIDE_OBJ_THROW * strength));
  }

  cue.spinTop = 0;
  cue.spinSide = 0;
}

function resolveCushion(b: Ball, events: PhysicsEvent[], layout: TableLayout): void {
  if (nearPocket(b.pos, layout)) return;
  for (const seg of layout.cushions) {
    const closest = closestOnSegment(b.pos, seg.a, seg.b);
    const delta = sub(b.pos, closest);
    const d = len(delta);
    if (d >= BALL_RADIUS) continue;

    const n = cushionNormal(seg, layout);
    if (dot(b.vel, n) >= 0) continue;

    b.pos = add(closest, scale(n, BALL_RADIUS));
    b.vel = scale(reflect(b.vel, scale(n, -1)), RAIL_REST);
    const speed = len(b.vel);
    if (speed > 0.05) {
      events.push({ type: "cushion", intensity: Math.min(1, speed / 3), ballId: b.id });
    }
  }
}

function resolvePockets(b: Ball, events: PhysicsEvent[], layout: TableLayout): boolean {
  if (!layout.hasPockets) return false;
  for (let i = 0; i < layout.pockets.length; i++) {
    if (dist(b.pos, layout.pockets[i]) < POCKET_RADIUS) {
      b.pocketed = true;
      b.pocketIndex = i;
      b.vel = { x: 0, y: 0 };
      events.push({ type: "pocket", intensity: 1, ballId: b.id, pocketIndex: i });
      return true;
    }
  }
  return false;
}

/** Keep balls from escaping through cushion gaps (unless near a pocket). */
function containBall(b: Ball, events: PhysicsEvent[], layout: TableLayout): void {
  if (nearPocket(b.pos, layout)) return;
  const r = BALL_RADIUS;
  let hit = false;
  if (b.pos.x < r) { b.pos.x = r; if (b.vel.x < 0) { b.vel.x *= -RAIL_REST; hit = true; } }
  if (b.pos.x > layout.width - r) { b.pos.x = layout.width - r; if (b.vel.x > 0) { b.vel.x *= -RAIL_REST; hit = true; } }
  if (b.pos.y < r) { b.pos.y = r; if (b.vel.y < 0) { b.vel.y *= -RAIL_REST; hit = true; } }
  if (b.pos.y > layout.height - r) { b.pos.y = layout.height - r; if (b.vel.y > 0) { b.vel.y *= -RAIL_REST; hit = true; } }
  if (hit) {
    const speed = len(b.vel);
    if (speed > 0.05) events.push({ type: "cushion", intensity: Math.min(1, speed / 3), ballId: b.id });
  }
}

function applyFriction(b: Ball, dt: number): void {
  const speed = len(b.vel);
  if (speed === 0) return;
  const newSpeed = Math.max(0, speed - ROLL_FRICTION * dt);
  if (newSpeed < STOP_THRESHOLD) {
    b.vel = { x: 0, y: 0 };
  } else {
    b.vel = scale(normalize(b.vel), newSpeed);
  }
}

function rollTexture(b: Ball, dt: number): void {
  const speed = len(b.vel);
  if (speed > 0) b.angle += (speed * dt) / BALL_RADIUS;
}

function chooseSubsteps(balls: Ball[], dt: number): number {
  let maxSpeed = 0;
  for (const b of balls) {
    if (b.pocketed) continue;
    maxSpeed = Math.max(maxSpeed, len(b.vel));
  }
  const maxTravel = maxSpeed * dt;
  const stepSize = BALL_RADIUS * 0.4;
  return Math.min(16, Math.max(4, Math.ceil(maxTravel / stepSize) || 4));
}

/** Advance the simulation by `dt` seconds. Mutates balls, returns sound events. */
export function step(balls: Ball[], dt: number, layout: TableLayout = POOL_LAYOUT): PhysicsEvent[] {
  const events: PhysicsEvent[] = [];
  const subSteps = chooseSubsteps(balls, dt);
  const h = dt / subSteps;

  for (let s = 0; s < subSteps; s++) {
    for (const b of balls) {
      if (b.pocketed) continue;
      b.pos = add(b.pos, scale(b.vel, h));
    }

    for (let i = 0; i < balls.length; i++) {
      if (balls[i].pocketed) continue;
      for (let j = i + 1; j < balls.length; j++) {
        if (balls[j].pocketed) continue;
        resolveBallBall(balls[i], balls[j], events);
      }
    }

    for (const b of balls) {
      if (b.pocketed) continue;
      if (resolvePockets(b, events, layout)) continue;
      resolveCushion(b, events, layout);
      containBall(b, events, layout);
    }
  }

  for (const b of balls) {
    if (b.pocketed) continue;
    applyFriction(b, dt);
    rollTexture(b, dt);
  }

  return events;
}

export function isMoving(balls: Ball[]): boolean {
  return balls.some((b) => !b.pocketed && len(b.vel) > STOP_THRESHOLD);
}
