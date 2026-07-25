// Call-shot canvas helpers (ball / pocket pick before shoot).

import type { Ball, PendingCall, Vec2 } from "../../core/types";
import type { CallShotMode } from "../../core/variants";
import type { TableLayout } from "../../core/tableLayout";
import { BALL_RADIUS, POCKET_RADIUS } from "../../core/constants";
import { dist } from "../../core/geometry";

const BALL_HIT_RADIUS = BALL_RADIUS * 2.2;
const POCKET_HIT_RADIUS = POCKET_RADIUS * 2.4;

export function pickCallAt(
  tablePos: Vec2,
  balls: Ball[],
  layout: TableLayout,
  callShot: CallShotMode,
  currentCall: PendingCall | null,
): { ballId: number | null; pocketIndex: number | null } | null {
  let nearestBall: { ballId: number; distance: number } | null = null;
  for (const ball of balls) {
    if (ball.pocketed || ball.id === 0) continue;
    const distance = dist(tablePos, ball.pos);
    if (distance > BALL_HIT_RADIUS) continue;
    if (!nearestBall || distance < nearestBall.distance) {
      nearestBall = { ballId: ball.id, distance };
    }
  }
  if (nearestBall) {
    return {
      ballId: nearestBall.ballId,
      pocketIndex: callShot === "BALL" ? null : currentCall?.pocketIndex ?? null,
    };
  }

  if (callShot === "BALL_AND_POCKET" && layout.hasPockets) {
    let nearestPocketIndex = -1;
    let nearestPocketDistance = Infinity;
    for (let pocketIndex = 0; pocketIndex < layout.pockets.length; pocketIndex++) {
      const distance = dist(tablePos, layout.pockets[pocketIndex]);
      if (distance > POCKET_HIT_RADIUS || distance >= nearestPocketDistance) continue;
      nearestPocketDistance = distance;
      nearestPocketIndex = pocketIndex;
    }
    if (nearestPocketIndex >= 0) {
      return {
        ballId: currentCall?.ballId ?? null,
        pocketIndex: nearestPocketIndex,
      };
    }
  }

  return null;
}

export function callHintText(
  callShot: CallShotMode,
  pendingCall: PendingCall | null,
): string | null {
  if (callShot === "NONE") return null;
  if (!pendingCall?.ballId) return "Cliquez une bille pour l'annoncer.";
  if (callShot === "BALL_AND_POCKET" && pendingCall.pocketIndex == null) {
    return "Cliquez une poche pour l'annoncer.";
  }
  const pocketLabel =
    pendingCall.pocketIndex != null ? ` → poche ${pendingCall.pocketIndex + 1}` : "";
  return `Annonce : #${pendingCall.ballId}${pocketLabel}`;
}
