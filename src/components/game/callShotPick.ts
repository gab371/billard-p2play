// Call-shot canvas helpers (ball / pocket pick before shoot).

import type { Ball, PendingCall, Vec2 } from "../../core/types";
import type { CallShotMode } from "../../core/variants";
import type { TableLayout } from "../../core/tableLayout";
import { BALL_RADIUS, POCKET_RADIUS } from "../../core/constants";
import { dist } from "../../core/geometry";

export function pickCallAt(
  pos: Vec2,
  balls: Ball[],
  layout: TableLayout,
  callShot: CallShotMode,
  current: PendingCall | null,
): { ballId: number | null; pocketIndex: number | null } | null {
  let best: { id: number; d: number } | null = null;
  for (const b of balls.filter((x) => !x.pocketed && x.id !== 0)) {
    const d = dist(pos, b.pos);
    if (d <= BALL_RADIUS * 2.2 && (!best || d < best.d)) best = { id: b.id, d };
  }
  if (best) {
    return {
      ballId: best.id,
      pocketIndex: callShot === "BALL" ? null : current?.pocketIndex ?? null,
    };
  }
  if (callShot === "BALL_AND_POCKET" && layout.hasPockets) {
    let bestP: { i: number; d: number } | null = null;
    layout.pockets.forEach((p, i) => {
      const d = dist(pos, p);
      if (d <= POCKET_RADIUS * 2.4 && (!bestP || d < bestP.d)) bestP = { i, d };
    });
    if (bestP) return { ballId: current?.ballId ?? null, pocketIndex: bestP.i };
  }
  return null;
}

export function callHintText(
  callShot: CallShotMode,
  pending: PendingCall | null,
): string | null {
  if (callShot === "NONE") return null;
  if (!pending?.ballId) return "Cliquez une bille pour l'annoncer.";
  if (callShot === "BALL_AND_POCKET" && pending.pocketIndex == null) {
    return "Cliquez une poche pour l'annoncer.";
  }
  const pocket =
    pending.pocketIndex != null ? ` → poche ${pending.pocketIndex + 1}` : "";
  return `Annonce : #${pending.ballId}${pocket}`;
}
