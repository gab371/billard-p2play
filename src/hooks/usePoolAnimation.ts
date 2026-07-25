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

const SMOOTH = 0.35;

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
    const loop = () => {
      if (isHost) {
        displayRef.current = getAuthoritativeBalls().map((b) => ({ ...b }));
      } else if (ballsInMotion && targetRef.current) {
        const target = targetRef.current;
        const cur = displayRef.current;
        if (cur.length !== target.length) {
          displayRef.current = target.map((b) => ({ ...b }));
        } else {
          for (let i = 0; i < target.length; i++) {
            const t = target[i];
            const c = cur[i];
            c.pos = {
              x: c.pos.x + (t.pos.x - c.pos.x) * SMOOTH,
              y: c.pos.y + (t.pos.y - c.pos.y) * SMOOTH,
            };
            c.angle = t.angle;
            c.pocketed = t.pocketed;
            c.id = t.id;
            c.group = t.group;
          }
        }
      } else {
        // At rest / placing: authoritative state, no leftover shot-frame lerp.
        displayRef.current = getStaticBalls().map((b) => ({ ...b }));
      }
      drawRef.current?.(displayRef.current);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [isHost, ballsInMotion, getAuthoritativeBalls, getStaticBalls, drawRef]);

  return displayRef;
}
