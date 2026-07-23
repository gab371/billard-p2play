// Aiming prediction (mobile pool style). Pure functions: given the cue
// ball, the other balls, the cushions and an aim angle, returns the trajectory
// to render — main path, ghost-ball contact, target direction, cue deflection,
// and cushion bounces.

import type { Ball, Vec2 } from "./types";
import { BALL_RADIUS, CUSHIONS } from "./constants";
import { add, dist, dot, fromAngle, len, rayCircle, raySegment, scale, sub } from "./geometry";

export interface AimSegment {
  from: Vec2;
  to: Vec2;
  /** "main" = cue ball path, "target" = object ball direction, "deflect" = cue ball after. */
  kind: "main" | "target" | "deflect";
}

export interface AimPrediction {
  segments: AimSegment[];
  ghostBall: Vec2 | null;     // where the cue ball stops at contact
  contactBallId: number | null;
  targetDir: Vec2 | null;     // predicted direction of the struck ball
  cueDeflect: Vec2 | null;    // predicted direction of the cue ball after contact
}

const MAX_BOUNCES = 2;
const MAX_RAY = 5.0; // meters — generous cap so a clear table draws a long line

/**
 * Predict the cue ball path for a given aim angle (radians). The cue ball is
 * modeled as a ray starting at its center; ball hits use a ray-circle test with
 * radius = 2 * BALL_RADIUS (center-to-center contact distance).
 */
export function predictShot(cueBall: Ball, balls: Ball[], aimAngle: number): AimPrediction {
  const segments: AimSegment[] = [];
  let origin: Vec2 = { ...cueBall.pos };
  let dir: Vec2 = fromAngle(aimAngle, 1);

  let ghostBall: Vec2 | null = null;
  let contactBallId: number | null = null;
  let targetDir: Vec2 | null = null;
  let cueDeflect: Vec2 | null = null;

  for (let bounce = 0; bounce <= MAX_BOUNCES; bounce++) {
    // Nearest object-ball hit.
    let bestBallT = Infinity;
    let bestBall: Ball | null = null;
    for (const b of balls) {
      if (b.id === cueBall.id || b.pocketed) continue;
      const t = rayCircle(origin, dir, b.pos, 2 * BALL_RADIUS);
      if (t !== null && t < bestBallT) {
        bestBallT = t;
        bestBall = b;
      }
    }

    // Nearest cushion hit.
    let bestCushionT = Infinity;
    let bestCushionNormal: Vec2 | null = null;
    for (const seg of CUSHIONS) {
      const t = raySegment(origin, dir, seg);
      if (t !== null && t < bestCushionT) {
        bestCushionT = t;
        const d = sub(seg.b, seg.a);
        let n = { x: -d.y, y: d.x };
        const nl = len(n);
        n = { x: n.x / nl, y: n.y / nl };
        // Orient normal against the ray direction (toward the table).
        if (dot(n, dir) > 0) n = { x: -n.x, y: -n.y };
        bestCushionNormal = n;
      }
    }

    const hitBall = bestBall && bestBallT <= bestCushionT;
    const t = hitBall ? bestBallT : bestCushionT;
    if (!isFinite(t) || t > MAX_RAY) {
      // No hit: draw the full capped line.
      segments.push({ from: origin, to: add(origin, scale(dir, MAX_RAY)), kind: "main" });
      break;
    }

    const endPoint = add(origin, scale(dir, t));

    if (hitBall && bestBall) {
      segments.push({ from: origin, to: endPoint, kind: "main" });
      ghostBall = endPoint;
      contactBallId = bestBall.id;

      // Target ball direction: from ghost ball center to object ball center.
      const tDir = sub(bestBall.pos, endPoint);
      const tLen = len(tDir);
      if (tLen > 1e-6) {
        targetDir = scale(tDir, 1 / tLen);
        // Cue ball deflection: component of dir perpendicular to target direction.
        // The cue ball leaves along the tangent (perpendicular to the impact normal).
        const normal = scale(tDir, 1 / tLen); // impact normal (cue -> object)
        const dotN = dot(dir, normal);
        cueDeflect = sub(dir, scale(normal, dotN));
        const dLen = len(cueDeflect);
        cueDeflect = dLen > 1e-6 ? scale(cueDeflect, 1 / dLen) : null;

        const drawLen = 0.4;
        segments.push({
          from: bestBall.pos,
          to: add(bestBall.pos, scale(targetDir, drawLen)),
          kind: "target",
        });
        if (cueDeflect) {
          segments.push({
            from: endPoint,
            to: add(endPoint, scale(cueDeflect, drawLen * 0.6)),
            kind: "deflect",
          });
        }
      }
      break;
    } else {
      // Cushion bounce: draw main line to cushion, then reflect and continue.
      segments.push({ from: origin, to: endPoint, kind: "main" });
      if (!bestCushionNormal) break;
      // Reflect direction about the cushion normal (normal points toward table).
      const d = dot(dir, bestCushionNormal);
      dir = sub(dir, scale(bestCushionNormal, 2 * d));
      // Nudge origin off the cushion to avoid re-hitting the same segment.
      origin = add(endPoint, scale(bestCushionNormal, 0.001));
    }
  }

  return { segments, ghostBall, contactBallId, targetDir, cueDeflect };
}

/** Distance from the cue ball to the first predicted contact (meters). */
export function aimDistance(pred: AimPrediction): number {
  const main = pred.segments.find((s) => s.kind === "main");
  if (!main) return 0;
  return dist(main.from, main.to);
}
