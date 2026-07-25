// 9-ball / 10-ball — rotation, push-out, three-foul, call (10).

import type { GameState } from "../types";
import type { PhysicsEvent } from "../physics";
import { emptyOutcome, firstContact, lowestObjectBall, type ShotOutcome } from "./types";
import { failedRailAfterContact, isValidPoolBreak } from "./shotHelpers";

function applyUsFoul(out: ShotOutcome, reason: string): void {
  out.foul = true;
  out.foulReason = reason;
  out.continueShooting = false;
  out.ballInHand = true;
  out.ballInHandKitchen = false;
}

export function evaluateRotationBall(
  state: GameState,
  events: PhysicsEvent[],
  newlyPocketedIds: number[],
  keyBallId: number,
  opts: { requireCall?: boolean; isBreak?: boolean } = {},
): ShotOutcome {
  const out = emptyOutcome();
  const cue = state.balls.find((b) => b.id === 0)!;
  const cueScratched = cue.pocketed;
  const contact = firstContact(events);
  const pushOut = state.pushOutDeclared;
  const onTableBefore = state.balls
    .filter((b) => b.id !== 0 && (!b.pocketed || newlyPocketedIds.includes(b.id)))
    .map((b) => b.id)
    .sort((a, b) => a - b);
  const mustHit = onTableBefore[0] ?? lowestObjectBall(state);

  if (opts.isBreak && !isValidPoolBreak(events, newlyPocketedIds) && !newlyPocketedIds.includes(0)) {
    // Soft: still allow play but if nothing hit it's already foul below.
  }

  if (pushOut) {
    // Push-out: no lowest-ball / cushion requirement; turn always ends.
    if (cueScratched) applyUsFoul(out, "Bille blanche empochée (scratch).");
    out.continueShooting = false;
    out.enablePushOut = false;
    return out;
  }

  if (contact === null) {
    applyUsFoul(out, "Aucune bille touchée.");
  } else if (mustHit !== null && contact !== mustHit) {
    applyUsFoul(out, `La bille ${mustHit} devait être touchée en premier.`);
  }

  if (cueScratched) {
    applyUsFoul(out, out.foulReason ?? "Bille blanche empochée (scratch).");
  }

  if (!out.foul && failedRailAfterContact(events, newlyPocketedIds)) {
    applyUsFoul(out, "Aucune bille n'a touché de bande.");
  }

  if (opts.requireCall) {
    const call = state.pendingCall;
    if (!call?.ballId || call.pocketIndex == null) {
      applyUsFoul(out, out.foulReason ?? "Annonce bille + poche requise.");
    } else if (newlyPocketedIds.includes(call.ballId)) {
      const ball = state.balls.find((b) => b.id === call.ballId);
      if (ball && ball.pocketIndex !== call.pocketIndex) {
        applyUsFoul(out, "Mauvaise poche annoncée.");
      }
    }
  }

  const keyPotted = newlyPocketedIds.includes(keyBallId);
  if (keyPotted) {
    const callOk =
      !opts.requireCall ||
      (state.pendingCall?.ballId === keyBallId &&
        state.pendingCall.pocketIndex != null &&
        state.balls.find((b) => b.id === keyBallId)?.pocketIndex === state.pendingCall.pocketIndex);

    if (!out.foul && !cueScratched && callOk) {
      out.win = state.activeTeam;
      out.continueShooting = false;
    } else {
      out.respotIds = [keyBallId];
      applyUsFoul(out, out.foulReason ?? `Bille ${keyBallId} empochée illégalement.`);
    }
  }

  if (!out.win) {
    if (opts.requireCall && state.pendingCall?.ballId != null) {
      out.continueShooting =
        newlyPocketedIds.includes(state.pendingCall.ballId) && !out.foul;
    } else {
      const objects = newlyPocketedIds.filter((id) => id !== 0);
      out.continueShooting = objects.length > 0 && !out.foul;
    }
  }

  if (opts.isBreak && !out.foul) out.enablePushOut = true;

  return out;
}

export function evaluateNineBall(
  state: GameState,
  events: PhysicsEvent[],
  newlyPocketedIds: number[],
  isBreak = false,
): ShotOutcome {
  return evaluateRotationBall(state, events, newlyPocketedIds, 9, { isBreak });
}

export function evaluateTenBall(
  state: GameState,
  events: PhysicsEvent[],
  newlyPocketedIds: number[],
  isBreak = false,
): ShotOutcome {
  return evaluateRotationBall(state, events, newlyPocketedIds, 10, {
    requireCall: true,
    isBreak,
  });
}
