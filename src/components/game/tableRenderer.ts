// Canvas drawing for the pool table frame: wood, felt, diamonds, pockets, light.
// The ViewTransform origin (ox, oy) is the felt top-left. Wood sits in a fixed
// RAIL band around the felt; anything outside that (cue pad) stays empty so the
// cue stick can draw into transparent margin without thickening the wood border.

import { CUSHION, POCKET_RADIUS } from "../../core/constants";
import { POOL_LAYOUT, type TableLayout } from "../../core/tableLayout";
import { tableToCanvas, type ViewTransform } from "./ballRenderer";

/** Visual wood thickness around the felt (px). Keep small — cue pad is separate. */
export const TABLE_RAIL_PX = 32;

let feltPattern: CanvasPattern | null = null;

function ensureFeltPattern(ctx: CanvasRenderingContext2D): CanvasPattern | null {
  if (feltPattern) return feltPattern;
  const tile = document.createElement("canvas");
  tile.width = 64;
  tile.height = 64;
  const t = tile.getContext("2d");
  if (!t) return null;
  t.fillStyle = "#0c4a36";
  t.fillRect(0, 0, 64, 64);
  for (let i = 0; i < 180; i++) {
    const x = Math.random() * 64;
    const y = Math.random() * 64;
    t.fillStyle = Math.random() > 0.5 ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.05)";
    t.fillRect(x, y, 1, 1);
  }
  feltPattern = ctx.createPattern(tile, "repeat");
  return feltPattern;
}

function drawDiamond(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(Math.PI / 4);
  ctx.fillStyle = "#d4c4a0";
  ctx.fillRect(-size / 2, -size / 2, size, size);
  ctx.restore();
}

/** Draw wood rails, felt, cushions, pockets, and aim diamonds. */
export function drawTable(
  ctx: CanvasRenderingContext2D,
  v: ViewTransform,
  canvasW: number,
  canvasH: number,
  timeMs = 0,
  railPx = TABLE_RAIL_PX,
  layout: TableLayout = POOL_LAYOUT,
): void {
  ctx.clearRect(0, 0, canvasW, canvasH);

  const fx = v.ox;
  const fy = v.oy;
  const fw = layout.width * v.scale;
  const fh = layout.height * v.scale;
  const rail = railPx;
  const wx = fx - rail;
  const wy = fy - rail;
  const ww = fw + rail * 2;
  const wh = fh + rail * 2;

  const wood = ctx.createLinearGradient(wx, wy, wx + ww, wy + wh);
  wood.addColorStop(0, "#5c3a1e");
  wood.addColorStop(0.45, "#3b2412");
  wood.addColorStop(1, "#2a160a");
  ctx.fillStyle = wood;
  roundRect(ctx, wx, wy, ww, wh, 10);
  ctx.fill();

  ctx.strokeStyle = "rgba(212,196,160,0.25)";
  ctx.lineWidth = 3;
  roundRect(ctx, wx + rail * 0.35, wy + rail * 0.35, ww - rail * 0.7, wh - rail * 0.7, 6);
  ctx.stroke();

  ctx.fillStyle = "#0a3d2e";
  ctx.fillRect(fx, fy, fw, fh);
  const pat = ensureFeltPattern(ctx);
  if (pat) {
    ctx.save();
    ctx.fillStyle = pat;
    ctx.globalAlpha = 0.85;
    ctx.fillRect(fx, fy, fw, fh);
    ctx.restore();
  }

  const pulse = 0.12 + 0.03 * Math.sin(timeMs / 1800);
  const halo = ctx.createRadialGradient(
    fx + fw * 0.5, fy + fh * 0.45, fw * 0.05,
    fx + fw * 0.5, fy + fh * 0.5, fw * 0.7,
  );
  halo.addColorStop(0, `rgba(20,122,86,${pulse + 0.18})`);
  halo.addColorStop(1, "rgba(10,61,46,0)");
  ctx.fillStyle = halo;
  ctx.fillRect(fx, fy, fw, fh);

  ctx.strokeStyle = "#1a6b4f";
  ctx.lineWidth = CUSHION * v.scale;
  ctx.lineCap = "butt";
  for (const seg of layout.cushions) {
    const a = tableToCanvas(seg.a, v);
    const b = tableToCanvas(seg.b, v);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }

  const d = Math.max(3, rail * 0.22);
  const midX = fx + fw / 2;
  const midY = fy + fh / 2;
  const q1 = fx + fw * 0.25;
  const q3 = fx + fw * 0.75;
  drawDiamond(ctx, q1, fy - rail * 0.45, d);
  drawDiamond(ctx, midX, fy - rail * 0.45, d);
  drawDiamond(ctx, q3, fy - rail * 0.45, d);
  drawDiamond(ctx, q1, fy + fh + rail * 0.45, d);
  drawDiamond(ctx, midX, fy + fh + rail * 0.45, d);
  drawDiamond(ctx, q3, fy + fh + rail * 0.45, d);
  drawDiamond(ctx, fx - rail * 0.45, midY, d);
  drawDiamond(ctx, fx + fw + rail * 0.45, midY, d);

  const headX = fx + layout.headString * v.scale;
  ctx.strokeStyle = "rgba(212,196,160,0.18)";
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 6]);
  ctx.beginPath();
  ctx.moveTo(headX, fy);
  ctx.lineTo(headX, fy + fh);
  ctx.stroke();
  ctx.setLineDash([]);

  if (!layout.hasPockets) return;

  for (const p of layout.pockets) {
    const c = tableToCanvas(p, v);
    const r = POCKET_RADIUS * v.scale;
    ctx.beginPath();
    ctx.arc(c.x, c.y, r + 3, 0, Math.PI * 2);
    ctx.fillStyle = "#1a1008";
    ctx.fill();
    const hole = ctx.createRadialGradient(c.x, c.y, r * 0.15, c.x, c.y, r);
    hole.addColorStop(0, "#111");
    hole.addColorStop(0.7, "#000");
    hole.addColorStop(1, "#050505");
    ctx.beginPath();
    ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
    ctx.fillStyle = hole;
    ctx.fill();
    ctx.strokeStyle = "rgba(201,161,74,0.55)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}
