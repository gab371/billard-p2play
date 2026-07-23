// Pure canvas drawing helpers for pool balls, including the rolling texture.

import type { Ball } from "../../core/types";
import { BALL_RADIUS } from "../../core/constants";

const COLORS: Record<number, string> = {
  1: "#f5c518", 2: "#1d4ed8", 3: "#dc2626", 4: "#7c3aed",
  5: "#ea580c", 6: "#15803d", 7: "#7f1d1d", 8: "#0a0a0a",
  9: "#f5c518", 10: "#1d4ed8", 11: "#dc2626", 12: "#7c3aed",
  13: "#ea580c", 14: "#15803d", 15: "#7f1d1d",
};

export interface ViewTransform {
  scale: number;   // pixels per meter
  ox: number;       // canvas origin x for table (0,0)
  oy: number;       // canvas origin y for table (0,0)
}

export function tableToCanvas(p: { x: number; y: number }, v: ViewTransform): { x: number; y: number } {
  return { x: v.ox + p.x * v.scale, y: v.oy + p.y * v.scale };
}

function drawSolid(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, color: string, num: number, angle: number) {
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  // Highlight
  ctx.beginPath();
  ctx.arc(cx - r * 0.3, cy - r * 0.3, r * 0.35, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,0.25)";
  ctx.fill();
  // Number marker orbits to simulate rolling.
  const mx = cx + Math.cos(angle) * r * 0.45;
  const my = cy + Math.sin(angle) * r * 0.45;
  ctx.beginPath();
  ctx.arc(mx, my, r * 0.42, 0, Math.PI * 2);
  ctx.fillStyle = "#fff";
  ctx.fill();
  ctx.fillStyle = "#0a0a0a";
  ctx.font = `bold ${Math.round(r * 0.55)}px Outfit, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(num), mx, my + r * 0.04);
}

function drawStripe(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, color: string, num: number, angle: number) {
  // White ball...
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = "#f4f4f4";
  ctx.fill();
  // ...with a colored band (rotated by roll angle to simulate rolling).
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(0, 0, r, r * 0.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  // Highlight
  ctx.beginPath();
  ctx.arc(cx - r * 0.3, cy - r * 0.3, r * 0.35, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,0.25)";
  ctx.fill();
  // Number marker orbits.
  const mx = cx + Math.cos(angle) * r * 0.45;
  const my = cy + Math.sin(angle) * r * 0.45;
  ctx.beginPath();
  ctx.arc(mx, my, r * 0.42, 0, Math.PI * 2);
  ctx.fillStyle = "#fff";
  ctx.fill();
  ctx.fillStyle = "#0a0a0a";
  ctx.font = `bold ${Math.round(r * 0.55)}px Outfit, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(num), mx, my + r * 0.04);
}

export function drawBall(ctx: CanvasRenderingContext2D, ball: Ball, v: ViewTransform): void {
  if (ball.pocketed) return;
  const c = tableToCanvas(ball.pos, v);
  const r = BALL_RADIUS * v.scale;
  if (ball.id === 0) {
    // Cue ball — plain white with a small red dot.
    ctx.beginPath();
    ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
    ctx.fillStyle = "#f8f8f5";
    ctx.fill();
    ctx.beginPath();
    ctx.arc(c.x + Math.cos(ball.angle) * r * 0.45, c.y + Math.sin(ball.angle) * r * 0.45, r * 0.18, 0, Math.PI * 2);
    ctx.fillStyle = "#dc2626";
    ctx.fill();
    ctx.beginPath();
    ctx.arc(c.x - r * 0.3, c.y - r * 0.3, r * 0.35, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.fill();
    return;
  }
  const color = COLORS[ball.id] ?? "#888";
  if (ball.id >= 9 && ball.id <= 15) drawStripe(ctx, c.x, c.y, r, color, ball.id, ball.angle);
  else drawSolid(ctx, c.x, c.y, r, color, ball.id, ball.angle);
  ctx.beginPath();
  ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(0,0,0,0.35)";
  ctx.lineWidth = 1;
  ctx.stroke();
}
