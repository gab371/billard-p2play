// Blackball (EN) + US 8-ball — open table, valid break, fouls, called 8 (US).

import type { BallGroup, GameState, TeamId } from "../types";
import type { PhysicsEvent } from "../physics";
import { emptyOutcome, firstContact, type ShotOutcome } from "./types";
import { failedRailAfterContact, isValidPoolBreak } from "./shotHelpers";
import { getVariant } from "../variants";

const KEY = 8;

function oppositeGroup(g: BallGroup): BallGroup {
  if (g === "SOLIDS") return "STRIPES";
  if (g === "STRIPES") return "SOLIDS";
  if (g === "RED") return "YELLOW";
  return "RED";
}

function applyFoulPenalty(out: ShotOutcome, state: GameState, reason: string): void {
  out.foul = true;
  out.foulReason = reason;
  out.continueShooting = false;
  out.ballInHand = true;
  const v = getVariant(state.config.variantId);
  if (v.id === "EN_BLACKBALL") {
    out.grantFreeShots = 2;
    out.grantFreeBall = true;
    out.ballInHandKitchen = true;
  } else {
    out.ballInHandKitchen = false;
  }
}

export function evaluateEightBall(
  state: GameState,
  events: PhysicsEvent[],
  newlyPocketedIds: number[],
  isBreak: boolean,
): ShotOutcome {
  const out = emptyOutcome();
  const team = state.activeTeam;
  const v = getVariant(state.config.variantId);
  const isEn = v.id === "EN_BLACKBALL";
  const cue = state.balls.find((b) => b.id === 0)!;
  const cueScratched = cue.pocketed;
  const contact = firstContact(events);
  const eightPocketed = newlyPocketedIds.includes(KEY);
  const myGroup = team ? state.teamGroups[team] : null;
  const freeBall = state.freeBall;
  const legalObjectPotted = newlyPocketedIds.filter((id) => id !== 0 && id !== KEY);

  // --- Break validity ---
  if (isBreak && !isValidPoolBreak(events, newlyPocketedIds)) {
    applyFoulPenalty(out, state, "Casse invalide (ni bille empochée, ni 4 billes à la bande).");
    if (eightPocketed) out.respotIds = [KEY];
    return out;
  }

  // --- First contact ---
  if (contact === null) {
    applyFoulPenalty(out, state, "Aucune bille touchée.");
  } else {
    const contactBall = state.balls.find((b) => b.id === contact);
    if (contactBall && !isBreak && !freeBall) {
      if (myGroup && contactBall.group !== myGroup && contactBall.group !== "EIGHT") {
        applyFoulPenalty(out, state, "Bille adverse touchée en premier.");
      }
      if (contactBall.group === "EIGHT" && myGroup && (state.remaining[myGroup] ?? 0) > 0) {
        applyFoulPenalty(out, state, "La noire touchée en premier.");
      }
      // Open table: may not hit 8 first.
      if (!myGroup && contactBall.group === "EIGHT") {
        applyFoulPenalty(out, state, "La noire touchée en premier (table ouverte).");
      }
    }
  }

  if (cueScratched) {
    applyFoulPenalty(out, state, out.foulReason ?? "Bille blanche empochée (scratch).");
  }

  if (!out.foul && !isBreak && failedRailAfterContact(events, newlyPocketedIds)) {
    applyFoulPenalty(out, state, "Aucune bille n'a touché de bande.");
  }

  // --- US call-shot: pocketed ball must match announcement ---
  if (!isEn && !out.foul && state.pendingCall?.ballId != null) {
    const called = state.pendingCall.ballId;
    const potOk = newlyPocketedIds.includes(called);
    if (potOk && state.pendingCall.pocketIndex != null) {
      const ball = state.balls.find((b) => b.id === called);
      if (ball && ball.pocketIndex !== state.pendingCall.pocketIndex) {
        if (called === KEY) {
          out.loss = team;
          out.foul = true;
          out.foulReason = "8 empochée dans la mauvaise poche.";
          return out;
        }
        applyFoulPenalty(out, state, "Mauvaise poche annoncée.");
      }
    }
  }

  // --- Group assignment (after break only, open table) ---
  if (team && !myGroup && !out.foul && legalObjectPotted.length > 0 && !isBreak) {
    let assignId = legalObjectPotted[0];
    if (!isEn && state.pendingCall?.ballId != null && legalObjectPotted.includes(state.pendingCall.ballId)) {
      assignId = state.pendingCall.ballId;
    }
    const first = state.balls.find((b) => b.id === assignId)!;
    if (first.group !== "EIGHT" && first.group !== "CUE") {
      state.teamGroups[team] = first.group;
      const otherTeam: TeamId = team === "SOLIDS" ? "STRIPES" : "SOLIDS";
      state.teamGroups[otherTeam] = oppositeGroup(first.group);
      out.groupAssigned = true;
    }
  }

  const groupNow = team ? state.teamGroups[team] : null;

  // --- 8 on break: re-spot, no loss, breaker keeps turn if otherwise legal ---
  if (isBreak && eightPocketed) {
    out.respotIds = [KEY];
    if (!out.foul) {
      out.continueShooting = legalObjectPotted.length > 0 || newlyPocketedIds.includes(KEY);
    }
    return out;
  }

  // --- Eight pocketed ---
  if (eightPocketed) {
    const cleared = groupNow ? (state.remaining[groupNow] ?? 0) === 0 : false;
    const callOk =
      isEn ||
      (state.pendingCall?.ballId === KEY &&
        state.pendingCall.pocketIndex != null &&
        state.balls.find((b) => b.id === KEY)?.pocketIndex === state.pendingCall.pocketIndex);

    if (cleared && !out.foul && !cueScratched && callOk) {
      out.win = team;
    } else {
      out.loss = team;
      out.foulReason = out.foulReason ?? "Noire empochée illégalement.";
    }
    return out;
  }

  // --- Continue turn ---
  if (!out.win && !out.loss) {
    if (isBreak) {
      out.continueShooting = legalObjectPotted.length > 0 && !out.foul;
    } else if (!isEn && state.pendingCall?.ballId != null) {
      out.continueShooting =
        newlyPocketedIds.includes(state.pendingCall.ballId) && !out.foul;
    } else {
      const pottedOwn = legalObjectPotted.some((id) => {
        const b = state.balls.find((bb) => bb.id === id)!;
        return groupNow ? b.group === groupNow : true;
      });
      out.continueShooting = pottedOwn && !out.foul;
    }
  }

  return out;
}
