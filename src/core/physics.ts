// Authoritative billiard physics. Operates on a Ball[] array (mutated in place)
// and returns sound events. Pure with respect to the outside world: no React,
// no network, no DOM.

import type { Ball, Vec2 } from "./types";
import {
  BALL_RADIUS,
  BALL_REST,
  CUSHIONS,
  POCKETS,
  POCKET_RADIUS,
  RAIL_REST,
  ROLL_FRICTION,
  STOP_THRESHOLD,
  TABLE_HEIGHT,
  TABLE_WIDTH,
} from "./constants";
import { add, dist, dot, len, normalize, reflect, scale, sub } from "./geometry";

export interface PhysicsEvent {
  type: "clack" | "cushion" | "pocket";
  intensity: number; // 0..1, drives the sound volume/pitch
  ballId?: number;   // primary ball (object hit / ball pocketed)
  otherId?: number;  // the other ball in a ball-ball collision
  pocketIndex?: number;
}

const TABLE_CENTER: Vec2 = { x: TABLE_WIDTH / 2, y: TABLE_HEIGHT / 2 };

/** Closest point on segment [a,b] to point p. */
function closestOnSegment(p: Vec2, a: Vec2, b: Vec2): Vec2 {
  const ab = sub(b, a);
  const t = Math.max(0, Math.min(1, dot(sub(p, a), ab) / dot(ab, ab)));
  return add(a, scale(ab, t));
}

/** Outward normal of a cushion segment, pointing toward the table center. */
function cushionNormal(seg: { a: Vec2; b: Vec2 }): Vec2 {
  const d = sub(seg.b, seg.a);
  let n = normalize({ x: -d.y, y: d.x });
  const mid = { x: (seg.a.x + seg.b.x) / 2, y: (seg.a.y + seg.b.y) / 2 };
  if (dot(sub(TABLE_CENTER, mid), n) < 0) n = scale(n, -1);
  return n;
}

function resolveBallBall(b1: Ball, b2: Ball, events: PhysicsEvent[]): void {
  const delta = sub(b2.pos, b1.pos);
  const d = len(delta);
  const minDist = 2 * BALL_RADIUS;
  if (d === 0 || d >= minDist) return;

  const n = scale(delta, 1 / d);
  // Separate overlapping balls.
  const overlap = minDist - d;
  b1.pos = sub(b1.pos, scale(n, overlap / 2));
  b2.pos = add(b2.pos, scale(n, overlap / 2));

  // Relative velocity along the normal.
  const rv = sub(b2.vel, b1.vel);
  const vn = dot(rv, n);
  if (vn > 0) return; // moving apart

  const j = -(1 + BALL_REST) * vn / 2;
  b1.vel = sub(b1.vel, scale(n, j));
  b2.vel = add(b2.vel, scale(n, j));

  events.push({
    type: "clack",
    intensity: Math.min(1, Math.abs(vn) / 3),
    ballId: b2.id,
    otherId: b1.id,
  });
}

function resolveCushion(b: Ball, events: PhysicsEvent[]): void {
  for (const seg of CUSHIONS) {
    const closest = closestOnSegment(b.pos, seg.a, seg.b);
    const delta = sub(b.pos, closest);
    const d = len(delta);
    if (d >= BALL_RADIUS) continue;

    const n = cushionNormal(seg);
    // Only reflect if moving toward the cushion.
    if (dot(b.vel, n) >= 0) continue;

    // Push the ball back inside.
    b.pos = add(closest, scale(n, BALL_RADIUS));
    b.vel = scale(reflect(b.vel, scale(n, -1)), RAIL_REST);
    const speed = len(b.vel);
    if (speed > 0.05) {
      events.push({ type: "cushion", intensity: Math.min(1, speed / 3), ballId: b.id });
    }
  }
}

function resolvePockets(b: Ball, events: PhysicsEvent[]): boolean {
  for (let i = 0; i < POCKETS.length; i++) {
    if (dist(b.pos, POCKETS[i]) < POCKET_RADIUS) {
      b.pocketed = true;
      b.pocketIndex = i;
      b.vel = { x: 0, y: 0 };
      events.push({ type: "pocket", intensity: 1, ballId: b.id, pocketIndex: i });
      return true;
    }
  }
  return false;
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
  if (speed > 0) {
    // Rolling without slipping: angular distance = linear distance / radius.
    b.angle += (speed * dt) / BALL_RADIUS;
  }
}

/** Advance the simulation by `dt` seconds. Mutates balls, returns sound events. */
export function step(balls: Ball[], dt: number): PhysicsEvent[] {
  const events: PhysicsEvent[] = [];
  const subSteps = 4;
  const h = dt / subSteps;

  for (let s = 0; s < subSteps; s++) {
    // Integrate motion for non-pocketed balls.
    for (const b of balls) {
      if (b.pocketed) continue;
      b.pos = add(b.pos, scale(b.vel, h));
    }

    // Ball-ball collisions.
    for (let i = 0; i < balls.length; i++) {
      if (balls[i].pocketed) continue;
      for (let j = i + 1; j < balls.length; j++) {
        if (balls[j].pocketed) continue;
        resolveBallBall(balls[i], balls[j], events);
      }
    }

    // Cushions + pockets.
    for (const b of balls) {
      if (b.pocketed) continue;
      resolveCushion(b, events);
      resolvePockets(b, events);
    }
  }

  // Friction + rolling texture (once per frame).
  for (const b of balls) {
    if (b.pocketed) continue;
    applyFriction(b, dt);
    rollTexture(b, dt);
  }

  return events;
}

/** True while any non-pocketed ball is still moving. */
export function isMoving(balls: Ball[]): boolean {
  return balls.some((b) => !b.pocketed && len(b.vel) > STOP_THRESHOLD);
}
