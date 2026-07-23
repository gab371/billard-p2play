import { useEffect, useRef } from "react";
import type { Ball, ShotFrame } from "../core/types";

interface UsePoolAnimationOptions {
  isHost: boolean;
  getAuthoritativeBalls: () => Ball[];
  /** Static fallback balls (e.g. the last broadcast game state) used by clients
   *  before any streamed frame arrives, and after a shot resolves. */
  getStaticBalls: () => Ball[];
  lastFrame: ShotFrame | null;
  /** Ref to the canvas renderer's draw function; called every frame with the
   *  balls to draw (host: live authoritative balls; client: interpolated). */
  drawRef: React.MutableRefObject<((balls: Ball[]) => void) | null>;
}

const SMOOTH = 0.35; // lerp factor toward the target each frame (client)

/**
 * Owns the single requestAnimationFrame loop for the pool table.
 * - Host: forwards the authoritative engine balls directly.
 * - Client: lerps the displayed positions toward the latest streamed frame for
 *   smooth motion despite the 30 Hz broadcast rate.
 */
export function usePoolAnimation({ isHost, getAuthoritativeBalls, getStaticBalls, lastFrame, drawRef }: UsePoolAnimationOptions) {
  const displayRef = useRef<Ball[]>([]);
  const targetRef = useRef<Ball[] | null>(null);

  // Keep the client target snapshot in a ref whenever a new frame arrives.
  useEffect(() => {
    if (!isHost && lastFrame) targetRef.current = lastFrame.balls;
  }, [isHost, lastFrame]);

  useEffect(() => {
    let raf = 0;
    const loop = () => {
      if (isHost) {
        const live = getAuthoritativeBalls();
        displayRef.current = live.map((b) => ({ ...b }));
      } else {
        // Prefer the latest streamed frame; fall back to the static state so the
        // table renders before the first shot and after a shot resolves.
        const target = targetRef.current ?? getStaticBalls();
        const cur = displayRef.current;
        if (target && target.length) {
          if (cur.length !== target.length) {
            displayRef.current = target.map((b) => ({ ...b }));
          } else {
            for (let i = 0; i < target.length; i++) {
              const t = target[i];
              const c = cur[i];
              c.pos = { x: c.pos.x + (t.pos.x - c.pos.x) * SMOOTH, y: c.pos.y + (t.pos.y - c.pos.y) * SMOOTH };
              c.angle = t.angle;
              c.pocketed = t.pocketed;
              c.id = t.id; c.group = t.group;
            }
          }
        }
      }
      drawRef.current?.(displayRef.current);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [isHost, getAuthoritativeBalls, getStaticBalls, drawRef]);

  return displayRef;
}
