// Straight pool 14.1 — call shot, team score, foul −1 / three-foul −15, re-rack.

import type { GameState } from "../types";
import type { PhysicsEvent } from "../physics";
import { emptyOutcome, firstContact, type ShotOutcome } from "./types";
import { failedRailAfterContact } from "./shotHelpers";
import { getVariant } from "../variants";
import { buildRack } from "../rack";

export function evaluateStraightPool(
  state: GameState,
  events: PhysicsEvent[],
  newlyPocketedIds: number[],
  isBreak = false,
): ShotOutcome {
  const out = emptyOutcome();
  const cue = state.balls.find((b) => b.id === 0)!;
  const cueScratched = cue.pocketed;
  const contact = firstContact(events);
  const call = state.pendingCall;
  const team = state.activeTeam;

  if (contact === null) {
    out.foul = true;
    out.foulReason = "Aucune bille touchée.";
  }
  if (cueScratched) {
    out.foul = true;
    out.foulReason = out.foulReason ?? "Bille blanche empochée (scratch).";
  }
  if (!out.foul && failedRailAfterContact(events, newlyPocketedIds)) {
    out.foul = true;
    out.foulReason = "Aucune bille n'a touché de bande.";
  }

  const calledId = call?.ballId ?? null;
  const calledPocket = call?.pocketIndex ?? null;
  if (calledId === null || calledPocket === null) {
    out.foul = true;
    out.foulReason = out.foulReason ?? "Annonce incomplète.";
  }

  const calledBall = calledId !== null ? state.balls.find((b) => b.id === calledId) : null;
  const success =
    !out.foul &&
    calledId !== null &&
    newlyPocketedIds.includes(calledId) &&
    calledBall?.pocketIndex === calledPocket;

  if (out.foul && team) {
    const penalty = isBreak ? -2 : -1;
    out.scoreDelta = penalty;
    state.teamScores[team] = (state.teamScores[team] ?? 0) + penalty;
    out.ballInHand = true;
    out.ballInHandKitchen = false;
    out.continueShooting = false;
  } else if (success && team) {
    out.scoreDelta = 1;
    state.teamScores[team] = (state.teamScores[team] ?? 0) + 1;
    if (state.activeShooterId) {
      state.scores[state.activeShooterId] = (state.scores[state.activeShooterId] ?? 0) + 1;
    }
    out.continueShooting = true;
    const target = getVariant(state.config.variantId).winTarget;
    if (state.teamScores[team] >= target) {
      out.win = team;
      out.continueShooting = false;
    }
  } else {
    out.continueShooting = false;
  }

  // Re-rack 14 when a single object ball remains (leave it + cue in place).
  const objectsLeft = state.balls.filter((b) => b.id !== 0 && !b.pocketed);
  if (objectsLeft.length <= 1 && !out.win) {
    const keepId = objectsLeft[0]?.id;
    const keepPos = objectsLeft[0] ? { ...objectsLeft[0].pos } : null;
    const layoutBalls = buildRack("TRIANGLE_15");
    for (const b of layoutBalls) {
      if (b.id === 0) continue;
      const existing = state.balls.find((x) => x.id === b.id);
      if (!existing) continue;
      if (keepId !== undefined && b.id === keepId) {
        if (keepPos) existing.pos = keepPos;
        continue;
      }
      existing.pocketed = false;
      existing.pocketIndex = null;
      existing.pos = { ...b.pos };
      existing.vel = { x: 0, y: 0 };
    }
  }

  return out;
}
