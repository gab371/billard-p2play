// Declarative billiard variants (pre-game config, like decks.ts in other games).
// All variants are team-vs-team with shooter rotation inside each team.

export type VariantId =
  | "EN_BLACKBALL"
  | "US_EIGHT"
  | "US_NINE"
  | "US_TEN"
  | "US_STRAIGHT_14_1"
  | "FR_CAROM";

export type VariantFamily = "EN" | "US" | "FR";
export type RackKind = "TRIANGLE_15" | "DIAMOND_9" | "DIAMOND_10" | "THREE_BALL";
/** Always two teams in P2Play (practice OK with one side empty). */
export type TeamMode = "TWO_TEAMS";
export type CallShotMode = "NONE" | "BALL" | "BALL_AND_POCKET";
export type TableProfile = "POOL" | "CAROM";
/** French carom sub-mode (rulebook §1). Balkline = future. */
export type CaromMode = "LIBRE" | "ONE_CUSHION" | "THREE_CUSHION";

export const CAROM_MODES: { id: CaromMode; label: string; hint: string }[] = [
  { id: "LIBRE", label: "Partie libre", hint: "Carambole sans contrainte de bande." },
  { id: "ONE_CUSHION", label: "1 bande", hint: "La cue doit toucher ≥1 bande avant la 2ᵉ bille." },
  { id: "THREE_CUSHION", label: "3 bandes", hint: "La cue doit toucher ≥3 bandes avant la 2ᵉ bille." },
];

export interface VariantDefinition {
  id: VariantId;
  family: VariantFamily;
  name: string;
  shortName: string;
  description: string;
  hasPockets: boolean;
  rackKind: RackKind;
  teamMode: TeamMode;
  callShot: CallShotMode;
  /** Open table after break — groups only on first legal pot *after* break. */
  openTableAfterBreak: boolean;
  groups?: Array<"SOLIDS" | "STRIPES" | "RED" | "YELLOW">;
  winTarget: number;
  tableProfile: TableProfile;
  keyBallId?: number;
}

export const VARIANTS: Record<VariantId, VariantDefinition> = {
  EN_BLACKBALL: {
    id: "EN_BLACKBALL",
    family: "EN",
    name: "Blackball (anglais)",
    shortName: "Blackball",
    description: "Rouges / jaunes puis noire. Table ouverte après la casse. Équipes.",
    hasPockets: true,
    rackKind: "TRIANGLE_15",
    teamMode: "TWO_TEAMS",
    callShot: "NONE",
    openTableAfterBreak: true,
    groups: ["RED", "YELLOW"],
    winTarget: 0,
    tableProfile: "POOL",
    keyBallId: 8,
  },
  US_EIGHT: {
    id: "US_EIGHT",
    family: "US",
    name: "Jeu de la 8",
    shortName: "8-ball",
    description: "Pleines / rayées puis la 8 annoncée (bille + poche). Table ouverte après la casse. Équipes.",
    hasPockets: true,
    rackKind: "TRIANGLE_15",
    teamMode: "TWO_TEAMS",
    callShot: "BALL_AND_POCKET",
    openTableAfterBreak: true,
    groups: ["SOLIDS", "STRIPES"],
    winTarget: 0,
    tableProfile: "POOL",
    keyBallId: 8,
  },
  US_NINE: {
    id: "US_NINE",
    family: "US",
    name: "Jeu de la 9",
    shortName: "9-ball",
    description: "Toucher la plus basse en premier. Victoire = 9 légale. Équipes.",
    hasPockets: true,
    rackKind: "DIAMOND_9",
    teamMode: "TWO_TEAMS",
    callShot: "NONE",
    openTableAfterBreak: false,
    winTarget: 0,
    tableProfile: "POOL",
    keyBallId: 9,
  },
  US_TEN: {
    id: "US_TEN",
    family: "US",
    name: "Jeu de la 10",
    shortName: "10-ball",
    description: "Comme la 9, avec annonce bille + poche. Équipes.",
    hasPockets: true,
    rackKind: "DIAMOND_10",
    teamMode: "TWO_TEAMS",
    callShot: "BALL_AND_POCKET",
    openTableAfterBreak: false,
    winTarget: 0,
    tableProfile: "POOL",
    keyBallId: 10,
  },
  US_STRAIGHT_14_1: {
    id: "US_STRAIGHT_14_1",
    family: "US",
    name: "Jeu du 14/1",
    shortName: "14/1",
    description: "Annoncer bille + poche. Score d'équipe jusqu'à l'objectif.",
    hasPockets: true,
    rackKind: "TRIANGLE_15",
    teamMode: "TWO_TEAMS",
    callShot: "BALL_AND_POCKET",
    openTableAfterBreak: false,
    winTarget: 50,
    tableProfile: "POOL",
  },
  FR_CAROM: {
    id: "FR_CAROM",
    family: "FR",
    name: "Billard français",
    shortName: "Carambole",
    description: "3 billes, sans trous. Carambole (libre / 1 bande / 3 bandes). Blanc = Team 1, jaune = Team 2.",
    hasPockets: false,
    rackKind: "THREE_BALL",
    teamMode: "TWO_TEAMS",
    callShot: "NONE",
    openTableAfterBreak: false,
    winTarget: 15,
    tableProfile: "CAROM",
  },
};

export const DEFAULT_VARIANT_ID: VariantId = "US_EIGHT";

export function getVariant(id: VariantId | string | undefined): VariantDefinition {
  if (id && id in VARIANTS) return VARIANTS[id as VariantId];
  return VARIANTS[DEFAULT_VARIANT_ID];
}

export function isCallComplete(
  callShot: CallShotMode,
  call: { ballId: number | null; pocketIndex: number | null } | null,
): boolean {
  if (callShot === "NONE") return true;
  if (!call || call.ballId === null) return false;
  if (callShot === "BALL_AND_POCKET" && call.pocketIndex === null) return false;
  return true;
}

/**
 * US 8: call only when on the 8 (group cleared). 10 / 14.1: every shot.
 * Break without call for 8-ball; 10 / 14.1 still require announcement.
 */
export function needsCallBeforeShot(state: {
  config: { variantId: string };
  phase: string;
  activeTeam: string | null;
  teamGroups: Record<string, string | null>;
  remaining: Record<string, number>;
}): boolean {
  const v = getVariant(state.config.variantId);
  if (v.callShot === "NONE") return false;
  if (v.id === "US_EIGHT") {
    if (state.phase === "BREAKING") return false;
    const team = state.activeTeam;
    const g = team ? state.teamGroups[team] : null;
    return !!g && (state.remaining[g] ?? 0) === 0;
  }
  return true;
}

export function isReadyToShoot(state: {
  config: { variantId: string };
  phase: string;
  activeTeam: string | null;
  teamGroups: Record<string, string | null>;
  remaining: Record<string, number>;
  pendingCall: { ballId: number | null; pocketIndex: number | null } | null;
}): boolean {
  if (!needsCallBeforeShot(state)) return true;
  return isCallComplete(getVariant(state.config.variantId).callShot, state.pendingCall);
}

/** Cue ball id for the active team (carom: white=0 Team1, yellow=1 Team2). */
export function activeCueBallId(variantId: VariantId, activeTeam: string | null): number {
  if (variantId !== "FR_CAROM") return 0;
  return activeTeam === "STRIPES" ? 1 : 0;
}

export const VARIANT_FAMILIES: { family: VariantFamily; label: string; ids: VariantId[] }[] = [
  { family: "EN", label: "Anglais", ids: ["EN_BLACKBALL"] },
  { family: "US", label: "Américain", ids: ["US_EIGHT", "US_NINE", "US_TEN", "US_STRAIGHT_14_1"] },
  { family: "FR", label: "Français", ids: ["FR_CAROM"] },
];
