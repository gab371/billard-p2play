import { PoolGameEngine } from "./core/gameEngine";
import type { GamePhase } from "./core/types";

/**
 * Test hooks for P2Play Billards E2E / smoke tests.
 * Exposed on `window.__testHooks__` only in non-production builds.
 */
declare global {
  interface Window {
    __testHooks__?: PoolTestHooks;
  }
}

export interface PoolTestHooks {
  createEngine(): unknown;
  setPhase(phase: GamePhase): void;
  act(method: string, args: unknown[]): unknown;
  getState(): unknown;
  getEngine(): PoolGameEngine | null;
  /** Debug-only: re-enable ball-in-hand for the active shooter. */
  requestBallInHand(): void;
}

let engineGetter: (() => PoolGameEngine | null) | null = null;
let testEngine: PoolGameEngine | null = null;

export function registerEngineGetter(getter: () => PoolGameEngine | null): void {
  engineGetter = getter;
}

function liveEngine(): PoolGameEngine | null {
  return testEngine ?? engineGetter?.() ?? null;
}

export function installTestHooks(): void {
  if (typeof window === "undefined") return;
  if (import.meta.env.PROD) return;
  if (window.__testHooks__) return;

  window.__testHooks__ = {
    createEngine: () => {
      testEngine = new PoolGameEngine();
      return testEngine.state;
    },
    setPhase: (phase) => {
      const engine = liveEngine();
      if (engine) engine.state.phase = phase;
    },
    act: (method, args) => {
      const engine = liveEngine() as unknown as Record<string, (...a: unknown[]) => unknown> | null;
      if (!engine || typeof engine[method] !== "function") return null;
      return engine[method](...args);
    },
    getState: () => liveEngine()?.state ?? null,
    getEngine: () => liveEngine(),
    requestBallInHand: () => {
      const engine = liveEngine();
      if (!engine?.state.activeShooterId) return;
      engine.requestBallInHand(engine.state.activeShooterId);
    },
  };
}
