// Rule dispatcher — picks the evaluator for the active variant.

import type { GameState } from "../types";
import type { PhysicsEvent } from "../physics";
import { getVariant } from "../variants";
import { evaluateEightBall } from "./eightBall";
import { evaluateNineBall, evaluateTenBall } from "./nineBall";
import { evaluateFrenchCarom } from "./frenchCarom";
import { evaluateStraightPool } from "./straightPool";
import type { ShotOutcome } from "./types";

export type { ShotOutcome } from "./types";
export {
  firstContact,
  recomputeRemaining,
  clampCuePlacement,
  placementModeForPhase,
  placementModeForState,
  overlapsAnyBall,
  lowestObjectBall,
} from "./types";
export type { PlacementMode } from "./types";

export function evaluateShot(
  state: GameState,
  events: PhysicsEvent[],
  newlyPocketedIds: number[],
  isBreak = false,
): ShotOutcome {
  const v = getVariant(state.config.variantId);
  switch (v.id) {
    case "EN_BLACKBALL":
    case "US_EIGHT":
      return evaluateEightBall(state, events, newlyPocketedIds, isBreak);
    case "US_NINE":
      return evaluateNineBall(state, events, newlyPocketedIds, isBreak);
    case "US_TEN":
      return evaluateTenBall(state, events, newlyPocketedIds, isBreak);
    case "US_STRAIGHT_14_1":
      return evaluateStraightPool(state, events, newlyPocketedIds, isBreak);
    case "FR_CAROM":
      return evaluateFrenchCarom(state, events, newlyPocketedIds);
    default:
      return evaluateEightBall(state, events, newlyPocketedIds, isBreak);
  }
}
