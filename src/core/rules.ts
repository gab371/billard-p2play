// Re-export rule API (keeps existing import paths working).
export {
  evaluateShot,
  firstContact,
  recomputeRemaining,
  clampCuePlacement,
  placementModeForPhase,
  placementModeForState,
  overlapsAnyBall,
  lowestObjectBall,
} from "./rules/index";
export type { ShotOutcome, PlacementMode } from "./rules/index";
