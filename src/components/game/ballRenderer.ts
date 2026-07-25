// Pure canvas drawing helpers for pool balls (shaded spheres + roll texture).

import type { Ball } from "../../core/types";
import { BALL_RADIUS } from "../../core/constants";

const COLORS: Record<number, string> = {
  1: "#f5c518", 2: "#1d4ed8", 3: "#dc2626", 4: "#7c3aed",
  5: "#ea580c", 6: "#15803d", 7: "#7f1d1d", 8: "#0a0a0a",
  9: "#f5c518", 10: "#1d4ed8", 11: "#dc2626", 12: "#7c3aed",
  13: "#ea580c", 14: "#15803d", 15: "#7f1d1d",
};

export interface ViewTransform {
  scale: number;
  ox: number;
  oy: number;
}

export function tableToCanvas(p: { x: number; y: number }, v: ViewTransform): { x: number; y: number } {
  return { x: v.ox + p.x * v.scale, y: v.oy + p.y * v.scale };
}

function drawShadow(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  ctx.beginPath();
  ctx.ellipse(cx + r * 0.12, cy + r * 0.45, r * 0.95, r * 0.45, 0, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.fill();
}

function sphereBase(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, color: string) {
  const g = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.4, r * 0.1, cx, cy, r);
  g.addColorStop(0, shade(color, 1.35));
  g.addColorStop(0.55, color);
  g.addColorStop(1, shade(color, 0.45));
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = g;
  ctx.fill();
}

function shade(hex: string, factor: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, Math.round(((n >> 16) & 255) * factor));
  const g = Math.min(255, Math.round(((n >> 8) & 255) * factor));
  const b = Math.min(255, Math.round((n & 255) * factor));
  return `rgb(${r},${g},${b})`;
}

function drawNumberCap(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, num: number, angle: number) {
  // Number sits on a white cap that drifts with roll (projected onto the sphere).
  const orbit = Math.sin(angle) * 0.55;
  const visible = Math.cos(angle);
  if (visible < -0.15) return; // on the back of the ball
  const mx = cx + Math.cos(angle * 0.35) * r * 0.15;
  const my = cy + orbit * r * 0.55;
  const capR = r * (0.38 + 0.08 * Math.max(0, visible));
  ctx.beginPath();
  ctx.arc(mx, my, capR, 0, Math.PI * 2);
  ctx.fillStyle = "#f8f8f8";
  ctx.fill();
  ctx.fillStyle = "#0a0a0a";
  ctx.font = `bold ${Math.round(r * 0.5)}px Outfit, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(num), mx, my + r * 0.03);
}

function drawSolid(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, color: string, num: number, angle: number) {
  sphereBase(ctx, cx, cy, r, color);
  drawNumberCap(ctx, cx, cy, r, num, angle);
  // Specular
  ctx.beginPath();
  ctx.arc(cx - r * 0.32, cy - r * 0.35, r * 0.22, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.fill();
}

function drawStripe(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, color: string, num: number, angle: number) {
  sphereBase(ctx, cx, cy, r, "#f0f0ee");
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
  ctx.translate(cx, cy);
  ctx.rotate(angle);
  ctx.fillStyle = color;
  ctx.fillRect(-r, -r * 0.42, r * 2, r * 0.84);
  ctx.restore();
  // Re-apply soft rim shading over the stripe
  const rim = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.35, r * 0.2, cx, cy, r);
  rim.addColorStop(0, "rgba(255,255,255,0)");
  rim.addColorStop(0.7, "rgba(0,0,0,0)");
  rim.addColorStop(1, "rgba(0,0,0,0.28)");
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = rim;
  ctx.fill();
  drawNumberCap(ctx, cx, cy, r, num, angle);
  ctx.beginPath();
  ctx.arc(cx - r * 0.32, cy - r * 0.35, r * 0.2, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,0.32)";
  ctx.fill();
}

export function drawBall(ctx: CanvasRenderingContext2D, ball: Ball, v: ViewTransform): void {
  if (ball.pocketed) return;
  const c = tableToCanvas(ball.pos, v);
  const r = BALL_RADIUS * v.scale;
  drawShadow(ctx, c.x, c.y, r);

  if (ball.id === 0) {
    sphereBase(ctx, c.x, c.y, r, "#f8f8f5");
    const mx = c.x + Math.cos(ball.angle) * r * 0.4;
    const my = c.y + Math.sin(ball.angle) * r * 0.4;
    ctx.beginPath();
    ctx.arc(mx, my, r * 0.16, 0, Math.PI * 2);
    ctx.fillStyle = "#dc2626";
    ctx.fill();
    ctx.beginPath();
    ctx.arc(c.x - r * 0.32, c.y - r * 0.35, r * 0.22, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,0.45)";
    ctx.fill();
    return;
  }

  const color = COLORS[ball.id] ?? "#888";
  if (ball.id >= 9 && ball.id <= 15) drawStripe(ctx, c.x, c.y, r, color, ball.id, ball.angle);
  else drawSolid(ctx, c.x, c.y, r, color, ball.id, ball.angle);

  ctx.beginPath();
  ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(0,0,0,0.28)";
  ctx.lineWidth = 1;
  ctx.stroke();
}
