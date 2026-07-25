// Turn / roster helpers for PoolGameEngine (keeps gameEngine under file limit).

import type { GameState, TeamId } from "./types";
import type { VariantDefinition } from "./variants";
import { pushLog, shooterName } from "./journal";

export function setupTwoTeamStart(state: GameState): { ok: boolean; firstTeam: TeamId | null } {
  const playing = state.players.filter((p) => p.team !== null);
  const solids = playing.filter((p) => p.team === "SOLIDS");
  const stripes = playing.filter((p) => p.team === "STRIPES");
  if (solids.length === 0 && stripes.length === 0) {
    state.logs = [];
    pushLog(state, "Aucun joueur assigné à une équipe.", "warning");
    return { ok: false, firstTeam: null };
  }
  const firstTeam: TeamId = solids.length > 0 ? "SOLIDS" : "STRIPES";
  const firstMembers = firstTeam === "SOLIDS" ? solids : stripes;
  state.activeTeam = firstTeam;
  state.activeShooterId = firstMembers[0].id;
  state.shooterOrder = [];
  state.shooterIndex = 0;
  state.teamScores = { SOLIDS: 0, STRIPES: 0 };
  state.scores = {};
  state.consecutiveFouls = { SOLIDS: 0, STRIPES: 0 };
  state.freeShotsRemaining = 0;
  state.freeBall = false;
  state.ballInHandKitchen = false;
  state.pushOutAvailable = false;
  state.pushOutDeclared = false;
  if (solids.length === 0 || stripes.length === 0) {
    pushLog(state, "Mode entraînement : une seule équipe présente.", "info");
  }
  return { ok: true, firstTeam };
}

export function applyVariantStartFlags(state: GameState, v: VariantDefinition): void {
  state.teamGroups = { SOLIDS: null, STRIPES: null };
  state.winnerTeam = null;
  state.winnerPlayerId = null;
  state.foulMessage = null;
  state.pendingCall = null;
  state.ballInHand = v.id !== "FR_CAROM";
  state.ballInHandKitchen = v.id !== "FR_CAROM";
  state.freeShotsRemaining = 0;
  state.freeBall = false;
  state.pushOutAvailable = false;
  state.pushOutDeclared = false;
  state.consecutiveFouls = { SOLIDS: 0, STRIPES: 0 };
  state.phase = v.id === "FR_CAROM" ? "SHOOTING" : "BREAKING";
  state.logs = [];
  pushLog(state, `${v.name} — ${shooterName(state)} commence.`, "phase");
}

export function advanceTeamShooter(
  state: GameState,
  teamShooterIndex: Record<TeamId, number>,
  team: TeamId,
): void {
  const members = state.players.filter((p) => p.team === team);
  if (members.length === 0) return;
  state.activeShooterId = members[teamShooterIndex[team] % members.length].id;
}
