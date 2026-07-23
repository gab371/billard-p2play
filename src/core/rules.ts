// 8-ball rule resolution. Pure decision function: given the game state, the shot
// that was fired, the physics events of the shot and the ids of balls pocketed
// during the shot, returns the outcome. The engine applies the outcome to state.

import type { GameState, TeamId } from "./types";
import type { PhysicsEvent } from "./physics";
import { TABLE_HEIGHT, TABLE_WIDTH } from "./constants";

export interface ShotOutcome {
  foul: boolean;
  foulReason: string | null;
  continueShooting: boolean; // same team keeps the table
  groupAssigned: boolean;     // team groups were assigned this shot
  win: TeamId | null;         // team that won the game
  loss: TeamId | null;        // team that lost (illegal 8-ball)
}

/** First object ball the cue ball touched this shot, or null. */
export function firstContact(events: PhysicsEvent[]): number | null {
  for (const e of events) {
    if (e.type !== "clack") continue;
    if (e.ballId === 0 && e.otherId !== undefined) return e.otherId;
    if (e.otherId === 0 && e.ballId !== undefined) return e.ballId;
  }
  return null;
}

export function evaluateShot(
  state: GameState,
  events: PhysicsEvent[],
  newlyPocketedIds: number[],
): ShotOutcome {
  const team = state.activeTeam;
  const cue = state.balls.find((b) => b.id === 0)!;
  const cueScratched = cue.pocketed;
  const contact = firstContact(events);
  const eightPocketed = newlyPocketedIds.includes(8);
  const isBreak = state.phase === "BREAKING";
  const myGroup = team ? state.teamGroups[team] : null;

  // --- Determine fouls -----------------------------------------------------
  let foul = false;
  let foulReason: string | null = null;

  if (contact === null) {
    foul = true;
    foulReason = "Aucune bille touchée.";
  } else {
    const contactBall = state.balls.find((b) => b.id === contact);
    if (contactBall && myGroup && contactBall.group !== myGroup && contactBall.group !== "EIGHT") {
      // Hitting opponent's group first is a foul (only once groups assigned).
      if (!isBreak) {
        foul = true;
        foulReason = "Bille adverse touchée en premier.";
      }
    }
    if (contactBall && contactBall.group === "EIGHT" && myGroup && state.remaining[myGroup] > 0) {
      foul = true;
      foulReason = "La 8 touchée en premier.";
    }
  }
  if (cueScratched) {
    foul = true;
    foulReason = foulReason ?? "Bille blanche empochée (scratch).";
  }

  // --- Group assignment (first legal object-ball pot after the break) -------
  let groupAssigned = false;
  const legalObjectPotted = newlyPocketedIds.filter((id) => id !== 0 && id !== 8);
  if (team && !myGroup && !foul && legalObjectPotted.length > 0 && !isBreak) {
    const first = state.balls.find((b) => b.id === legalObjectPotted[0])!;
    state.teamGroups[team] = first.group;
    const otherTeam: TeamId = team === "SOLIDS" ? "STRIPES" : "SOLIDS";
    state.teamGroups[otherTeam] = first.group === "SOLIDS" ? "STRIPES" : "SOLIDS";
    groupAssigned = true;
  }

  // --- Win / loss via the 8-ball -------------------------------------------
  let win: TeamId | null = null;
  let loss: TeamId | null = null;
  if (eightPocketed) {
    const cleared = myGroup ? state.remaining[myGroup] === 0 : false;
    if (cleared && !foul && !cueScratched) {
      win = team;
    } else {
      // Pocketing the 8 illegally or too early loses the game.
      loss = team;
    }
  }

  // --- Continue shooting? ---------------------------------------------------
  let continueShooting = false;
  if (!win && !loss) {
    const pottedOwn = legalObjectPotted.some((id) => {
      const b = state.balls.find((bb) => bb.id === id)!;
      return myGroup ? b.group === myGroup : true;
    });
    // On the break, any pot continues the turn (groups not yet assigned).
    if (isBreak) {
      continueShooting = legalObjectPotted.length > 0 && !foul;
    } else {
      continueShooting = pottedOwn && !foul;
    }
  }

  return { foul, foulReason, continueShooting, groupAssigned, win, loss };
}

/** Recompute the remaining-ball counters from the live balls array. */
export function recomputeRemaining(state: GameState): void {
  const count = (group: string) => state.balls.filter((b) => b.group === group && !b.pocketed).length;
  state.remaining = {
    SOLIDS: count("SOLIDS"),
    STRIPES: count("STRIPES"),
    EIGHT: count("EIGHT"),
    CUE: count("CUE"),
  };
}

/** Keep a point inside the playable surface (with ball-radius margin). */
export function clampCuePlacement(pos: { x: number; y: number }): { x: number; y: number } {
  const r = 0.028;
  return {
    x: Math.max(r, Math.min(TABLE_WIDTH - r, pos.x)),
    y: Math.max(r, Math.min(TABLE_HEIGHT - r, pos.y)),
  };
}
