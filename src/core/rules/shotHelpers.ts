// Shared shot analysis helpers (break validity, cushion requirements).

import type { PhysicsEvent } from "../physics";
import { firstContact } from "./types";

/** Distinct object balls that registered a cushion hit this shot. */
export function objectBallsToCushion(events: PhysicsEvent[]): number {
  const ids = new Set<number>();
  for (const e of events) {
    if (e.type === "cushion" && e.ballId !== undefined && e.ballId !== 0) ids.add(e.ballId);
  }
  return ids.size;
}

/**
 * Valid pool break: pocket at least one object ball OR drive ≥4 object balls
 * to a cushion (Blackball / US 8 / common rotation break standard).
 */
export function isValidPoolBreak(
  events: PhysicsEvent[],
  newlyPocketedIds: number[],
): boolean {
  const objectsPotted = newlyPocketedIds.filter((id) => id !== 0 && id !== 8);
  // US: any numbered ball incl. 8 counts as pot on break for validity.
  const anyObjectPot = newlyPocketedIds.some((id) => id !== 0);
  if (anyObjectPot || objectsPotted.length > 0) return true;
  return objectBallsToCushion(events) >= 4;
}

/**
 * After cue contacts an object, if nothing is pocketed at least one ball must
 * reach a cushion (standard foul).
 */
export function failedRailAfterContact(
  events: PhysicsEvent[],
  newlyPocketedIds: number[],
): boolean {
  if (newlyPocketedIds.length > 0) return false;
  if (firstContact(events) === null) return false;
  return !events.some((e) => e.type === "cushion");
}
