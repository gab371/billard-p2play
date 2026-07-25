// Cue stick + power meter + aiming overlays for the pool canvas.

import type { Ball } from "../../core/types";
import { BALL_RADIUS } from "../../core/constants";
import { predictShot, type AimPrediction } from "../../core/aiming";
import type { TableLayout } from "../../core/tableLayout";
import { POOL_LAYOUT } from "../../core/tableLayout";
import { tableToCanvas, type ViewTransform } from "./ballRenderer";

export function drawAiming(
  ctx: CanvasRenderingContext2D,
  cueBall: Ball,
  balls: Ball[],
  angle: number,
  view: ViewTransform,
  dimmed = false,
  layout: TableLayout = POOL_LAYOUT,
) {
  const prediction: AimPrediction = predictShot(cueBall, balls, angle, layout);
  const alphaMul = dimmed ? 0.35 : 1;
  ctx.lineWidth = 2;
  prediction.segments.forEach((segment) => {
    const from = tableToCanvas(segment.from, view);
    const to = tableToCanvas(segment.to, view);
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    if (segment.kind === "main") {
      ctx.strokeStyle = `rgba(255,255,255,${0.85 * alphaMul})`;
      ctx.setLineDash([8, 6]);
    } else if (segment.kind === "target") {
      ctx.strokeStyle = `rgba(250,204,21,${0.9 * alphaMul})`;
      ctx.setLineDash([]);
    } else {
      ctx.strokeStyle = `rgba(255,255,255,${0.5 * alphaMul})`;
      ctx.setLineDash([4, 4]);
    }
    ctx.stroke();
  });
  ctx.setLineDash([]);
  if (prediction.ghostBall) {
    const ghost = tableToCanvas(prediction.ghostBall, view);
    ctx.beginPath();
    ctx.arc(ghost.x, ghost.y, BALL_RADIUS * view.scale, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(255,255,255,${0.7 * alphaMul})`;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
}

export function drawCueStick(
  ctx: CanvasRenderingContext2D,
  cueBall: Ball,
  angle: number,
  power: number,
  charging: boolean,
  view: ViewTransform,
  dimmed = false,
) {
  const cueCenter = tableToCanvas(cueBall.pos, view);
  const ballRadiusPx = BALL_RADIUS * view.scale;
  const pull = (charging ? power : 0) * 0.45 * view.scale + 0.06 * view.scale;
  const gap = ballRadiusPx + 6 + pull;
  const stickLength = 340;
  const tip = {
    x: cueCenter.x - Math.cos(angle) * gap,
    y: cueCenter.y - Math.sin(angle) * gap,
  };
  const butt = {
    x: cueCenter.x - Math.cos(angle) * (gap + stickLength),
    y: cueCenter.y - Math.sin(angle) * (gap + stickLength),
  };
  const ferrule = {
    x: tip.x - Math.cos(angle) * 14,
    y: tip.y - Math.sin(angle) * 14,
  };

  ctx.save();
  ctx.globalAlpha = dimmed ? 0.4 : 1;
  ctx.lineCap = "round";

  const shaft = ctx.createLinearGradient(butt.x, butt.y, tip.x, tip.y);
  shaft.addColorStop(0, "#6b4423");
  shaft.addColorStop(0.7, "#c4a574");
  shaft.addColorStop(1, "#e8d5b0");
  ctx.strokeStyle = shaft;
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(butt.x, butt.y);
  ctx.lineTo(ferrule.x, ferrule.y);
  ctx.stroke();

  ctx.strokeStyle = "#e8e4d9";
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(ferrule.x, ferrule.y);
  ctx.lineTo(tip.x, tip.y);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(tip.x, tip.y, 3.5, 0, Math.PI * 2);
  ctx.fillStyle = "#1e3a5f";
  ctx.fill();
  ctx.restore();
}

export function drawBallInHandHint(ctx: CanvasRenderingContext2D, cueBall: Ball, view: ViewTransform) {
  const cueCenter = tableToCanvas(cueBall.pos, view);
  ctx.beginPath();
  ctx.arc(cueCenter.x, cueCenter.y, BALL_RADIUS * view.scale + 5, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(250,204,21,0.85)";
  ctx.lineWidth = 2;
  ctx.setLineDash([4, 4]);
  ctx.stroke();
  ctx.setLineDash([]);
}

/** HTML overlay power meter (0..1). Rendered beside the canvas via React. */
export function powerMeterClass(power: number): string {
  if (power < 0.4) return "from-amber-400 to-amber-500";
  if (power < 0.75) return "from-orange-400 to-orange-500";
  return "from-rose-400 to-rose-500";
}
