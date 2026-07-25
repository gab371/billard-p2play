// Human-readable game journal helpers. Pure — no React / network.

import type { GameLog, GameState, TeamId } from "./types";
import type { PhysicsEvent } from "./physics";
import { firstContact } from "./rules";

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

export function ballLabel(id: number): string {
  if (id === 0) return "la blanche";
  if (id === 8) return "la 8 noire";
  if (id >= 1 && id <= 7) return `la pleine ${id}`;
  if (id >= 9 && id <= 15) return `la rayée ${id}`;
  return `la bille ${id}`;
}

export function teamLabel(team: TeamId): string {
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
  const teamBit = team ? ` (${teamLabel(team)})` : "";

  const contact = firstContact(events);
  if (contact === null) {
    pushLog(state, `${who}${teamBit} ne touche aucune bille.`, "foul");
  } else {
    pushLog(state, `${who}${teamBit} touche ${ballLabel(contact)}.`, "shot");
  }

  const objects = newlyPocketed.filter((id) => id !== 0);
  const scratched = newlyPocketed.includes(0);

  for (const id of objects) {
    pushLog(state, `${who}${teamBit} empoche ${ballLabel(id)}.`, id === 8 ? "phase" : "pocket");
  }
  if (scratched) {
    pushLog(state, `${who}${teamBit} empoche la blanche (scratch).`, "foul");
  }

  if (objects.length === 0 && !scratched && contact !== null) {
    pushLog(state, `${who}${teamBit} n'empoche rien.`, "info");
  }

  if (opts.groupAssigned && team) {
    const g = state.teamGroups[team];
    pushLog(
      state,
      `${teamLabel(team)} reçoit les ${g === "SOLIDS" ? "pleines (1-7)" : "rayées (9-15)"}.`,
      "success",
    );
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
  } else if (opts.nextShooterName && opts.nextTeam) {
    pushLog(
      state,
      `Tour de ${opts.nextShooterName} (${teamLabel(opts.nextTeam)})${opts.foul ? " — bille en main" : ""}.`,
      "phase",
    );
  }
}
