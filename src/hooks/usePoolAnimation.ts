import { useEffect, useRef } from "react";
import type { Ball, ShotFrame } from "../core/types";

interface UsePoolAnimationOptions {
  isHost: boolean;
  /** True while balls are mid-shot (RESOLVING). When false, clients snap to state.balls. */
  ballsInMotion: boolean;
  getAuthoritativeBalls: () => Ball[];
  getStaticBalls: () => Ball[];
  lastFrame: ShotFrame | null;
  drawRef: React.MutableRefObject<((balls: Ball[]) => void) | null>;
}

function syncBallList(cur: Ball[], source: Ball[]): Ball[] {
  if (cur.length !== source.length) {
    return source.map((b) => ({
      ...b,
      pos: { x: b.pos.x, y: b.pos.y },
      vel: { x: b.vel ? b.vel.x : 0, y: b.vel ? b.vel.y : 0 },
    }));
  }
  for (let i = 0; i < source.length; i++) {
    const s = source[i];
    const c = cur[i];
    c.id = s.id;
    c.group = s.group;
    c.pocketed = s.pocketed;
    c.pocketIndex = s.pocketIndex;
    c.angle = s.angle;
    c.spinSide = s.spinSide;
    c.spinTop = s.spinTop;
    if (c.pos) {
      c.pos.x = s.pos.x;
      c.pos.y = s.pos.y;
    } else {
      c.pos = { x: s.pos.x, y: s.pos.y };
    }
    if (c.vel) {
      c.vel.x = s.vel ? s.vel.x : 0;
      c.vel.y = s.vel ? s.vel.y : 0;
    } else {
      c.vel = { x: s.vel ? s.vel.x : 0, y: s.vel ? s.vel.y : 0 };
    }
  }
  return cur;
}

/**
 * Host: live engine balls.
 * Client mid-shot: lerp toward streamed SHOT_FRAME.
 * Client at rest (incl. ball-in-hand placement): snap to STATE_UPDATE balls —
 * never keep a stale lastFrame as the target (that caused cue-placement desync).
 */
export function usePoolAnimation({
  isHost, ballsInMotion, getAuthoritativeBalls, getStaticBalls, lastFrame, drawRef,
}: UsePoolAnimationOptions) {
  const displayRef = useRef<Ball[]>([]);
  const targetRef = useRef<Ball[] | null>(null);
  const lastTimeRef = useRef<number>(performance.now());

  useEffect(() => {
    if (isHost) return;
    if (ballsInMotion && lastFrame?.moving) {
      targetRef.current = lastFrame.balls;
    } else {
      targetRef.current = null;
    }
  }, [isHost, ballsInMotion, lastFrame]);

  useEffect(() => {
    let raf = 0;
    lastTimeRef.current = performance.now();

    const loop = () => {
      const now = performance.now();
      const dt = Math.min(0.05, Math.max(0.001, (now - lastTimeRef.current) / 1000));
      lastTimeRef.current = now;

      if (isHost) {
        displayRef.current = syncBallList(displayRef.current, getAuthoritativeBalls());
      } else if (ballsInMotion && targetRef.current) {
        const target = targetRef.current;
        const cur = displayRef.current;

        if (cur.length !== target.length) {
          displayRef.current = target.map((b) => ({
            ...b,
            pos: { x: b.pos.x, y: b.pos.y },
            vel: { x: b.vel ? b.vel.x : 0, y: b.vel ? b.vel.y : 0 },
          }));
        } else {
          for (let i = 0; i < target.length; i++) {
            const t = target[i];
            const c = cur[i];

            c.pocketed = t.pocketed;
            c.id = t.id;
            c.group = t.group;
            c.angle = t.angle;

            const tVel = t.vel || { x: 0, y: 0 };
            const dist = Math.hypot(t.pos.x - c.pos.x, t.pos.y - c.pos.y);

            // Snap immediately if ball is pocketed or has large position mismatch
            if (t.pocketed || dist > 0.2) {
              c.pos.x = t.pos.x;
              c.pos.y = t.pos.y;
              if (!c.vel) c.vel = { ...tVel };
              else { c.vel.x = tVel.x; c.vel.y = tVel.y; }
            } else {
              // Dead-reckoning: integrate velocity over dt and smoothly correct position error
              c.pos.x += tVel.x * dt + (t.pos.x - c.pos.x) * 0.25;
              c.pos.y += tVel.y * dt + (t.pos.y - c.pos.y) * 0.25;
              if (!c.vel) c.vel = { ...tVel };
              else { c.vel.x = tVel.x; c.vel.y = tVel.y; }
            }
          }
        }
      } else {
        // At rest / placing: authoritative state, no leftover shot-frame lerp.
        displayRef.current = syncBallList(displayRef.current, getStaticBalls());
      }
      drawRef.current?.(displayRef.current);
      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [isHost, ballsInMotion, getAuthoritativeBalls, getStaticBalls, drawRef]);

  return displayRef;
}
