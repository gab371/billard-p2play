// Pure 2D geometry helpers shared by physics and aiming. No side effects.

import type { Vec2 } from "./types";

export interface Segment {
  a: Vec2;
  b: Vec2;
}

export const vec = (x: number, y: number): Vec2 => ({ x, y });
export const add = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x + b.x, y: a.y + b.y });
export const sub = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x - b.x, y: a.y - b.y });
export const scale = (a: Vec2, s: number): Vec2 => ({ x: a.x * s, y: a.y * s });
export const dot = (a: Vec2, b: Vec2): number => a.x * b.x + a.y * b.y;
export const len = (a: Vec2): number => Math.hypot(a.x, a.y);
export const lenSq = (a: Vec2): number => a.x * a.x + a.y * a.y;
export const dist = (a: Vec2, b: Vec2): number => Math.hypot(a.x - b.x, a.y - b.y);
export const distSq = (a: Vec2, b: Vec2): number => {
  const dx = a.x - b.x, dy = a.y - b.y;
  return dx * dx + dy * dy;
};

export const normalize = (a: Vec2): Vec2 => {
  const l = len(a);
  if (l < 1e-9) return { x: 1, y: 0 };
  return { x: a.x / l, y: a.y / l };
};

/** Right-hand perpendicular (rotate +90°). */
export const perp = (a: Vec2): Vec2 => ({ x: -a.y, y: a.x });

export const angleOf = (a: Vec2): number => Math.atan2(a.y, a.x);
export const fromAngle = (rad: number, mag = 1): Vec2 => ({
  x: Math.cos(rad) * mag,
  y: Math.sin(rad) * mag,
});

/**
 * Ray vs circle intersection. Returns the nearest positive t along the ray
 * (origin + dir*t) that touches the circle of given center/radius, or null.
 * `dir` must be normalized.
 */
export function rayCircle(origin: Vec2, dir: Vec2, center: Vec2, radius: number): number | null {
  const oc = sub(origin, center);
  const b = dot(oc, dir);
  const c = dot(oc, oc) - radius * radius;
  const disc = b * b - c;
  if (disc < 0) return null;
  const sq = Math.sqrt(disc);
  const t1 = -b - sq;
  const t2 = -b + sq;
  if (t1 > 1e-6) return t1;
  if (t2 > 1e-6) return t2;
  return null;
}

/**
 * Ray vs segment intersection. Returns t along the ray (origin + dir*t) where it
 * crosses the segment, or null. `dir` must be normalized.
 */
export function raySegment(origin: Vec2, dir: Vec2, seg: Segment): number | null {
  const v1 = sub(origin, seg.a);
  const v2 = sub(seg.b, seg.a);
  const v3 = { x: -dir.y, y: dir.x };

  const dotV3v2 = dot(v3, v2);
  if (Math.abs(dotV3v2) < 1e-9) return null;

  const t1 = (v2.x * v1.y - v2.y * v1.x) / dotV3v2;
  const t2 = dot(v1, v3) / dotV3v2;

  if (t1 >= 0 && t2 >= 0 && t2 <= 1) return t1;
  return null;
}

/** Reflect a velocity vector about a normal (normal pointing away from surface). */
export function reflect(v: Vec2, n: Vec2): Vec2 {
  const d = dot(v, n);
  return { x: v.x - 2 * d * n.x, y: v.y - 2 * d * n.y };
}

/** Clamp a point inside the playable rectangle (with margin = ball radius). */
export function clampToRect(p: Vec2, minX: number, minY: number, maxX: number, maxY: number): Vec2 {
  return {
    x: Math.max(minX, Math.min(maxX, p.x)),
    y: Math.max(minY, Math.min(maxY, p.y)),
  };
}
