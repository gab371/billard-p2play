// French carom (partie libre / 1 bande / 3 bandes) — team scores & fouls.

import type { GameState } from "../types";
import type { PhysicsEvent } from "../physics";
import { emptyOutcome, type ShotOutcome } from "./types";
import { activeCueBallId, getVariant, type CaromMode } from "../variants";
import { getTableLayout } from "../tableLayout";
import { BALL_RADIUS } from "../constants";
import { caromHomePos } from "../rack";

function cueContactsOrdered(events: PhysicsEvent[], cueId: number): {
  objectsHit: number[];
  cushionsBeforeSecond: number;
} {
  const objectsHit: number[] = [];
  let cushionsBeforeSecond = 0;
  for (const e of events) {
    if (objectsHit.length >= 2) break;
    if (e.type === "cushion" && e.ballId === cueId) {
      cushionsBeforeSecond += 1;
      continue;
    }
    if (e.type !== "clack") continue;
    const other =
      e.ballId === cueId ? e.otherId
      : e.otherId === cueId ? e.ballId
      : undefined;
    if (other === undefined || other === cueId) continue;
    if (!objectsHit.includes(other)) objectsHit.push(other);
  }
  return { objectsHit, cushionsBeforeSecond };
}

function ballsOffTable(state: GameState): number[] {
  const layout = getTableLayout("CAROM");
  const r = BALL_RADIUS;
  return state.balls
    .filter(
      (b) =>
        b.pos.x < -r ||
        b.pos.y < -r ||
        b.pos.x > layout.width + r ||
        b.pos.y > layout.height + r,
    )
    .map((b) => b.id);
}

function respotJumpedBalls(state: GameState, ids: number[]): void {
  const layout = getTableLayout("CAROM");
  for (const id of ids) {
    const cur = state.balls.find((b) => b.id === id);
    if (!cur) continue;
    cur.pos = caromHomePos(id, layout.width, layout.height);
    cur.vel = { x: 0, y: 0 };
    cur.pocketed = false;
  }
}

function cushionRequirement(mode: CaromMode): number {
  if (mode === "ONE_CUSHION") return 1;
  if (mode === "THREE_CUSHION") return 3;
  return 0;
}

function awardPoint(state: GameState, out: ShotOutcome): void {
  out.scoreDelta = 1;
  out.continueShooting = true;
  const team = state.activeTeam;
  if (!team) return;
  state.teamScores[team] = (state.teamScores[team] ?? 0) + 1;
  if (state.activeShooterId) {
    state.scores[state.activeShooterId] = (state.scores[state.activeShooterId] ?? 0) + 1;
  }
  const target = getVariant(state.config.variantId).winTarget;
  if (state.teamScores[team] >= target) {
    out.win = team;
    out.continueShooting = false;
  }
}

export function evaluateFrenchCarom(
  state: GameState,
  events: PhysicsEvent[],
  _newlyPocketedIds: number[],
): ShotOutcome {
  const out = emptyOutcome();
  const cueId = activeCueBallId(state.config.variantId, state.activeTeam);
  const mode: CaromMode = state.config.caromMode ?? "LIBRE";
  const needCushions = cushionRequirement(mode);

  const off = ballsOffTable(state);
  if (off.length > 0) {
    out.foul = true;
    out.foulReason = "Bille sortie de la table.";
    out.continueShooting = false;
    // Rulebook: respot jumped ball(s) on home spot; leave others where they are.
    respotJumpedBalls(state, off);
    return out;
  }

  const { objectsHit, cushionsBeforeSecond } = cueContactsOrdered(events, cueId);
  const others = state.balls.filter((b) => b.id !== cueId).map((b) => b.id);
  const bothHit = others.length >= 2 && others.every((id) => objectsHit.includes(id));

  if (objectsHit.length === 0) {
    out.foul = true;
    out.foulReason = "Aucune bille touchée.";
    out.continueShooting = false;
    return out;
  }

  if (!bothHit) {
    out.foul = true;
    out.foulReason = "Carambole incomplète (les deux billes doivent être touchées).";
    out.continueShooting = false;
    return out;
  }

  if (cushionsBeforeSecond < needCushions) {
    out.foul = true;
    out.foulReason =
      mode === "THREE_CUSHION"
        ? `3 bandes requises (cue : ${cushionsBeforeSecond}).`
        : `1 bande requise avant la 2ᵉ bille (cue : ${cushionsBeforeSecond}).`;
    out.continueShooting = false;
    return out;
  }

  awardPoint(state, out);
  return out;
}
