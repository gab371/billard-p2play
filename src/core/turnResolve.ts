// Apply ShotOutcome side-effects: fouls streak, free shots, push-out, turn handoff.

import type { GameState, TeamId } from "./types";
import type { ShotOutcome } from "./rules";
import type { VariantDefinition } from "./variants";
import { advanceTeamShooter } from "./startGameSetup";
import { pushLog, shooterName, teamLabel } from "./journal";

const THREE_FOUL_VARIANTS = new Set(["US_NINE", "US_TEN", "US_STRAIGHT_14_1"]);

export function applyOutcomeFlags(state: GameState, outcome: ShotOutcome, foulingTeam: TeamId | null): TeamId | null {
  // Three-foul loss (9/10) or −15 (14.1)
  if (outcome.foul && foulingTeam && THREE_FOUL_VARIANTS.has(state.config.variantId)) {
    state.consecutiveFouls[foulingTeam] = (state.consecutiveFouls[foulingTeam] ?? 0) + 1;
    if (state.consecutiveFouls[foulingTeam] >= 3) {
      if (state.config.variantId === "US_STRAIGHT_14_1") {
        state.teamScores[foulingTeam] = (state.teamScores[foulingTeam] ?? 0) - 15;
        state.consecutiveFouls[foulingTeam] = 0;
        pushLog(state, "3 fautes consécutives : −15 points.", "foul");
      } else {
        return foulingTeam; // loss
      }
    }
  } else if (!outcome.foul && foulingTeam) {
    state.consecutiveFouls[foulingTeam] = 0;
  }

  if (outcome.grantFreeShots > 0) {
    // Applied when turn is handed to the other team.
  }
  if (outcome.enablePushOut) state.pushOutAvailable = true;
  else if (!outcome.enablePushOut && state.pushOutDeclared) {
    /* cleared after shot */
  }
  state.pushOutDeclared = false;

  return null;
}

export function resolveTurnHandoff(
  state: GameState,
  outcome: ShotOutcome,
  v: VariantDefinition,
  teamShooterIndex: Record<TeamId, number>,
): { nextShooterName: string | null; nextTeam: TeamId | null; keptTurn: boolean } {
  const team = state.activeTeam;
  const who = shooterName(state);

  // Successful continue (pot) — clear free-shot package, keep shooter.
  if (outcome.continueShooting) {
    state.phase = "SHOOTING";
    state.ballInHand = false;
    state.ballInHandKitchen = false;
    state.freeShotsRemaining = 0;
    state.freeBall = false;
    if (outcome.enablePushOut) state.pushOutAvailable = true;
    return { nextShooterName: null, nextTeam: null, keptTurn: true };
  }

  // Blackball: free-shot package — a clean miss consumes one; keep table if any remain.
  if (!outcome.foul && state.freeShotsRemaining > 0 && team) {
    state.freeShotsRemaining -= 1;
    state.freeBall = false;
    if (state.freeShotsRemaining > 0) {
      state.phase = "SHOOTING";
      state.ballInHand = false;
      pushLog(state, `Free shot restant : ${state.freeShotsRemaining}.`, "info");
      return { nextShooterName: who, nextTeam: team, keptTurn: true };
    }
  }

  // Hand to other team (or practice same team).
  state.freeShotsRemaining = 0;
  state.freeBall = false;

  if (!team) {
    return { nextShooterName: null, nextTeam: null, keptTurn: false };
  }

  const other: TeamId = team === "SOLIDS" ? "STRIPES" : "SOLIDS";
  const nextMembers = state.players.filter((p) => p.team === other);
  const bih = outcome.ballInHand || (outcome.foul && v.hasPockets);
  const kitchen = outcome.ballInHandKitchen;

  if (nextMembers.length === 0) {
    // Practice
    state.phase = bih ? "BALL_IN_HAND" : "SHOOTING";
    state.ballInHand = bih;
    state.ballInHandKitchen = kitchen;
    if (outcome.grantFreeShots > 0) {
      state.freeShotsRemaining = outcome.grantFreeShots;
      state.freeBall = outcome.grantFreeBall;
    }
    if (outcome.enablePushOut) state.pushOutAvailable = true;
    return {
      nextShooterName: outcome.foul ? who : null,
      nextTeam: outcome.foul ? team : null,
      keptTurn: false,
    };
  }

  teamShooterIndex[other] = teamShooterIndex[other] + 1;
  advanceTeamShooter(state, teamShooterIndex, other);
  state.activeTeam = other;
  state.phase = bih ? "BALL_IN_HAND" : "SHOOTING";
  state.ballInHand = bih;
  state.ballInHandKitchen = kitchen;
  if (outcome.grantFreeShots > 0) {
    state.freeShotsRemaining = outcome.grantFreeShots;
    state.freeBall = outcome.grantFreeBall;
    pushLog(
      state,
      `${teamLabel(other, state.config.variantId)} : ${outcome.grantFreeShots} free shots${outcome.grantFreeBall ? " (free ball)" : ""}.`,
      "phase",
    );
  }
  if (outcome.enablePushOut) state.pushOutAvailable = true;

  return {
    nextShooterName: shooterName(state),
    nextTeam: other,
    keptTurn: false,
  };
}
