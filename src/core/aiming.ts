// Aiming prediction (mobile pool style). Pure functions: given the cue
// ball, the other balls, the cushions and an aim angle, returns the trajectory
// to render — main path, ghost-ball contact, target direction, cue deflection,
// and cushion bounces.

import type { Ball, Vec2 } from "./types";
import { BALL_RADIUS, POCKET_RADIUS } from "./constants";
import type { TableLayout } from "./tableLayout";
import { POOL_LAYOUT } from "./tableLayout";
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
export function predictShot(
  cueBall: Ball,
  balls: Ball[],
  aimAngle: number,
  layout: TableLayout = POOL_LAYOUT,
): AimPrediction {
  const segments: AimSegment[] = [];
  let origin: Vec2 = { ...cueBall.pos };
  let dir: Vec2 = fromAngle(aimAngle, 1);
  const rails = layout.aimRails;
  const pockets = layout.hasPockets ? layout.pockets : [];

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

    // Nearest rail hit (closed rectangle — covers pocket mouths so the line
    // stops at the green-border level instead of leaking through holes).
    let bestCushionT = Infinity;
    let bestCushionNormal: Vec2 | null = null;
    let hitPocketMouth = false;
    for (const seg of rails) {
      const t = raySegment(origin, dir, seg);
      if (t !== null && t < bestCushionT) {
        bestCushionT = t;
        const hit = add(origin, scale(dir, t));
        hitPocketMouth = pockets.some((p) => dist(hit, p) < POCKET_RADIUS * 1.25);
        const d = sub(seg.b, seg.a);
        let n = { x: -d.y, y: d.x };
        const nl = len(n);
        n = { x: n.x / nl, y: n.y / nl };
        if (dot(n, dir) > 0) n = { x: -n.x, y: -n.y };
        bestCushionNormal = n;
      }
    }

    const hitBall = bestBall && bestBallT <= bestCushionT;
    const t = hitBall ? bestBallT : bestCushionT;
    if (!isFinite(t) || t > MAX_RAY) {
      segments.push({ from: origin, to: add(origin, scale(dir, MAX_RAY)), kind: "main" });
      break;
    }

    const endPoint = add(origin, scale(dir, t));

    if (hitBall && bestBall) {
      segments.push({ from: origin, to: endPoint, kind: "main" });
      ghostBall = endPoint;
      contactBallId = bestBall.id;

      const tDir = sub(bestBall.pos, endPoint);
      const tLen = len(tDir);
      if (tLen > 1e-6) {
        targetDir = scale(tDir, 1 / tLen);
        const normal = scale(tDir, 1 / tLen);
        const dotN = dot(dir, normal);
        cueDeflect = sub(dir, scale(normal, dotN));
        const dLen = len(cueDeflect);
        cueDeflect = dLen > 1e-6 ? scale(cueDeflect, 1 / dLen) : null;

        const drawLen = 0.4 / 3; // object + deflect preview (short, mobile-pool style)
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
      // Rail hit: always draw to the edge. Don't bounce through a pocket mouth.
      segments.push({ from: origin, to: endPoint, kind: "main" });
      if (hitPocketMouth || !bestCushionNormal) break;
      const d = dot(dir, bestCushionNormal);
      dir = sub(dir, scale(bestCushionNormal, 2 * d));
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
