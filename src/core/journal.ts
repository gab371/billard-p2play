// Human-readable game journal helpers. Pure — no React / network.

import type { GameLog, GameState, TeamId } from "./types";
import type { PhysicsEvent } from "./physics";
import { firstContact } from "./rules";
import type { VariantId } from "./variants";
import { getVariant } from "./variants";

let logSeq = 0;
const MAX_LOGS = 100;

export function makeLog(message: string, type: GameLog["type"]): GameLog {
  return {
    id: `log_${Date.now()}_${logSeq++}`,
    timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
    message,
    type,
  };
}

export function pushLog(state: GameState, message: string, type: GameLog["type"]): void {
  state.logs.push(makeLog(message, type));
  if (state.logs.length > MAX_LOGS) {
    state.logs.splice(0, state.logs.length - MAX_LOGS);
  }
}

export function ballLabel(id: number, variantId?: VariantId): string {
  if (id === 0) return "la blanche";
  const v = variantId ? getVariant(variantId) : null;
  if (v?.id === "EN_BLACKBALL") {
    if (id === 8) return "la noire";
    if (id >= 1 && id <= 7) return `la rouge ${id}`;
    if (id >= 9 && id <= 15) return `la jaune ${id}`;
  }
  if (v?.id === "FR_CAROM") {
    if (id === 0) return "la blanche";
    if (id === 1) return "la jaune";
    if (id === 2) return "la rouge";
  }
  if (id === 8) return "la 8 noire";
  if (id >= 1 && id <= 7) return `la pleine ${id}`;
  if (id >= 9 && id <= 15) return `la rayée ${id}`;
  return `la bille ${id}`;
}

export function teamLabel(team: TeamId, variantId?: VariantId): string {
  if (variantId === "EN_BLACKBALL") {
    return team === "SOLIDS" ? "Team Rouge" : "Team Jaune";
  }
  if (variantId === "FR_CAROM") {
    return team === "SOLIDS" ? "Team Blanc" : "Team Jaune";
  }
  return team === "SOLIDS" ? "Team 1" : "Team 2";
}

export function shooterName(state: GameState): string {
  const p = state.players.find((pl) => pl.id === state.activeShooterId);
  return p?.name ?? "Joueur";
}

/** Append shot-resolution lines (pockets, contact, miss, foul, turn). */
export function logShotResolution(
  state: GameState,
  events: PhysicsEvent[],
  newlyPocketed: number[],
  opts: {
    foul: boolean;
    foulReason: string | null;
    continueShooting: boolean;
    groupAssigned: boolean;
    nextShooterName?: string | null;
    nextTeam?: TeamId | null;
  },
): void {
  const who = shooterName(state);
  const team = state.activeTeam;
  const vid = state.config?.variantId;
  const teamBit = team ? ` (${teamLabel(team, vid)})` : "";

  const contact = firstContact(events);
  if (contact === null) {
    pushLog(state, `${who}${teamBit} ne touche aucune bille.`, "foul");
  } else {
    pushLog(state, `${who}${teamBit} touche ${ballLabel(contact, vid)}.`, "shot");
  }

  const objects = newlyPocketed.filter((id) => id !== 0);
  const scratched = newlyPocketed.includes(0);

  for (const id of objects) {
    pushLog(state, `${who}${teamBit} empoche ${ballLabel(id, vid)}.`, id === 8 ? "phase" : "pocket");
  }
  if (scratched) {
    pushLog(state, `${who}${teamBit} empoche la blanche (scratch).`, "foul");
  }

  if (objects.length === 0 && !scratched && contact !== null) {
    pushLog(state, `${who}${teamBit} n'empoche rien.`, "info");
  }

  if (opts.groupAssigned && team) {
    const g = state.teamGroups[team];
    const label =
      g === "SOLIDS" ? "pleines (1-7)"
      : g === "STRIPES" ? "rayées (9-15)"
      : g === "RED" ? "rouges"
      : g === "YELLOW" ? "jaunes"
      : String(g);
    pushLog(state, `${teamLabel(team, vid)} reçoit les ${label}.`, "success");
  }

  if (opts.foul && opts.foulReason) {
    const skipNoContact = contact === null && opts.foulReason === "Aucune bille touchée.";
    const skipScratch = scratched && /blanche|scratch/i.test(opts.foulReason);
    if (!skipNoContact && !skipScratch) {
      pushLog(state, `Faute — ${opts.foulReason}`, "foul");
    }
  }

  if (opts.continueShooting) {
    pushLog(state, `${who}${teamBit} rejoue.`, "success");
  } else if (opts.nextShooterName) {
    const nt = opts.nextTeam ? ` (${teamLabel(opts.nextTeam, vid)})` : "";
    pushLog(
      state,
      `Tour de ${opts.nextShooterName}${nt}${opts.foul ? " — bille en main" : ""}.`,
      "phase",
    );
  }
}
