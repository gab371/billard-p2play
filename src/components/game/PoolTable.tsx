import { useCallback, useEffect, useRef, useState } from "react";
import type { GameState, ShotRequest, ShotFrame, Vec2 } from "../../core/types";
import { CUSHION, CUSHIONS, POCKET_RADIUS, POCKETS, TABLE_HEIGHT, TABLE_WIDTH, BALL_RADIUS } from "../../core/constants";
import { predictShot, type AimPrediction } from "../../core/aiming";
import { drawBall, tableToCanvas, type ViewTransform } from "./ballRenderer";
import { usePoolAnimation } from "../../hooks/usePoolAnimation";
import { useCueInput, loadControlMode, saveControlMode, type ControlMode } from "../../hooks/useCueInput";

interface PoolTableProps {
  state: GameState;
  isMyTurn: boolean;
  amSpectator: boolean;
  isHost: boolean;
  engineRef: React.MutableRefObject<any>;
  lastFrame: ShotFrame | null;
  onFire: (shot: ShotRequest) => void;
  onPlaceCueBall: (pos: Vec2) => void;
  onConfirmPlacement: () => void;
  onRequestBallInHand: () => void;
}

const MARGIN = 28; // px around the felt for the wooden rail

export function PoolTable({ state, isMyTurn, amSpectator, isHost, engineRef, lastFrame, onFire, onPlaceCueBall, onConfirmPlacement, onRequestBallInHand }: PoolTableProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const viewRef = useRef<ViewTransform>({ scale: 1, ox: 0, oy: 0 });
  const [size, setSize] = useState({ w: 800, h: 400 });
  const [controlMode, setControlMode] = useState<ControlMode>(() => loadControlMode());

  // Responsive sizing: keep the felt aspect ratio (2:1).
  useEffect(() => {
    const parent = canvasRef.current?.parentElement;
    if (!parent) return;
    const ro = new ResizeObserver((entries) => {
      const r = entries[0].contentRect;
      const w = Math.max(320, r.width);
      const h = w / (TABLE_WIDTH / TABLE_HEIGHT);
      setSize({ w, h });
    });
    ro.observe(parent);
    return () => ro.disconnect();
  }, []);

  // Recompute the view transform whenever the canvas size changes.
  useEffect(() => {
    const scale = (size.w - MARGIN * 2) / TABLE_WIDTH;
    viewRef.current = { scale, ox: MARGIN, oy: MARGIN };
    const canvas = canvasRef.current;
    if (canvas) {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = size.w * dpr;
      canvas.height = size.h * dpr;
      canvas.style.width = `${size.w}px`;
      canvas.style.height = `${size.h}px`;
      const ctx = canvas.getContext("2d");
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
  }, [size]);

  const getAuthoritativeBalls = useCallback(() => engineRef.current?.state?.balls ?? state.balls ?? [], [engineRef, state.balls]);

  const getStaticBalls = useCallback(() => state.balls ?? [], [state.balls]);

  const getCueBallPos = useCallback((): Vec2 | null => {
    const cue = state.balls.find((b) => b.id === 0 && !b.pocketed);
    return cue ? cue.pos : null;
  }, [state.balls]);

  const toTable = useCallback((clientX: number, clientY: number): Vec2 | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const v = viewRef.current;
    return { x: (clientX - rect.left - v.ox) / v.scale, y: (clientY - rect.top - v.oy) / v.scale };
  }, []);

  const handleFire = useCallback((angle: number, power: number) => {
    onFire({ angle, power, spin: 0 });
  }, [onFire]);

  const cue = useCueInput({
    enabled: isMyTurn && !amSpectator && state.phase !== "RESOLVING" && state.phase !== "GAME_OVER",
    ballInHand: isMyTurn && state.ballInHand,
    controlMode,
    getCueBallPos,
    toTable,
    onFire: handleFire,
    onPlaceCueBall,
    onConfirmPlacement,
  });

  const canShoot = isMyTurn && !amSpectator && state.phase !== "RESOLVING" && state.phase !== "GAME_OVER";

  // The renderer the animation loop calls every frame.
  const drawRef = useRef<((balls: any[]) => void) | null>(null);
  drawRef.current = (balls: any[]) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const v = viewRef.current;
    const W = size.w, H = size.h;

    // Wooden rail
    ctx.fillStyle = "#3b2412";
    ctx.fillRect(0, 0, W, H);

    // Felt
    const fx = v.ox, fy = v.oy, fw = TABLE_WIDTH * v.scale, fh = TABLE_HEIGHT * v.scale;
    const grad = ctx.createLinearGradient(fx, fy, fx, fy + fh);
    grad.addColorStop(0, "#0e4a36");
    grad.addColorStop(1, "#0a2c22");
    ctx.fillStyle = grad;
    ctx.fillRect(fx, fy, fw, fh);

    // Cushions (drawn as inner border segments matching CUSHIONS gaps)
    ctx.strokeStyle = "#1b4d3a";
    ctx.lineWidth = CUSHION * v.scale;
    ctx.lineCap = "round";
    CUSHIONS.forEach((seg) => {
      const a = tableToCanvas(seg.a, v), b = tableToCanvas(seg.b, v);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    });

    // Pockets
    POCKETS.forEach((p) => {
      const c = tableToCanvas(p, v);
      ctx.beginPath();
      ctx.arc(c.x, c.y, POCKET_RADIUS * v.scale, 0, Math.PI * 2);
      ctx.fillStyle = "#000";
      ctx.fill();
      ctx.strokeStyle = "#c9a14a";
      ctx.lineWidth = 2;
      ctx.stroke();
    });

    // Balls
    for (const b of balls) drawBall(ctx, b, v);

    // Aim + cue stick (only when the player may shoot and balls are at rest)
    if (canShoot) {
      const cueBall = balls.find((b: any) => b.id === 0 && !b.pocketed);
      if (cueBall) {
        if (!state.ballInHand) drawAiming(ctx, cueBall, balls, cue.aimAngle, v);
        drawCueStick(ctx, cueBall, cue.aimAngle, cue.power, cue.charging, v);
        if (state.ballInHand) drawBallInHandHint(ctx, cueBall, v);
      }
    }
  };

  usePoolAnimation({ isHost, getAuthoritativeBalls, getStaticBalls, lastFrame, drawRef });

  const chooseMode = (m: ControlMode) => { setControlMode(m); saveControlMode(m); };

  return (
    <div className="w-full flex flex-col items-center">
      <canvas id="pool-canvas" ref={canvasRef} className="pool-canvas rounded-2xl shadow-2xl" />
      <div className="mt-3 flex flex-wrap items-center justify-center gap-3 text-xs text-zinc-400">
        {amSpectator ? (
          <span>👁️ Mode spectateur — vous regardez la partie.</span>
        ) : isMyTurn ? (
          <>
            <span>
              {state.ballInHand
                ? "Bille en main : glissez la blanche puis relâchez pour placer."
                : controlMode === "standard"
                ? "Clic droit : viser · Clic gauche : tirer en arrière pour charger · Relâcher : tirer."
                : "Survol : viser · Clic gauche : tirer en arrière pour charger · Relâcher : tirer."}
            </span>
            {!state.ballInHand && (
              <button onClick={onRequestBallInHand}
                className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 font-bold transition-all">
                🤚 Replacer la bille
              </button>
            )}
            <div className="flex items-center gap-1 ml-1">
              <span className="text-[10px] uppercase tracking-widest text-zinc-500">Contrôle</span>
              <button onClick={() => chooseMode("standard")}
                className={`px-2 py-1 rounded-lg font-bold border transition-all ${controlMode === "standard" ? "bg-amber-600 border-amber-400 text-zinc-900" : "bg-zinc-900 border-zinc-800 text-zinc-300 hover:border-zinc-600"}`}>Standard</button>
              <button onClick={() => chooseMode("hover")}
                className={`px-2 py-1 rounded-lg font-bold border transition-all ${controlMode === "hover" ? "bg-amber-600 border-amber-400 text-zinc-900" : "bg-zinc-900 border-zinc-800 text-zinc-300 hover:border-zinc-600"}`}>Survol</button>
            </div>
          </>
        ) : (
          <span>En attente de votre tour…</span>
        )}
      </div>
    </div>
  );
}

function drawAiming(ctx: CanvasRenderingContext2D, cueBall: any, balls: any[], angle: number, v: ViewTransform) {
  const pred: AimPrediction = predictShot(cueBall, balls, angle);
  ctx.lineWidth = 2;
  pred.segments.forEach((s) => {
    const a = tableToCanvas(s.from, v), b = tableToCanvas(s.to, v);
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
    if (s.kind === "main") { ctx.strokeStyle = "rgba(255,255,255,0.85)"; ctx.setLineDash([8, 6]); }
    else if (s.kind === "target") { ctx.strokeStyle = "rgba(250,204,21,0.9)"; ctx.setLineDash([]); }
    else { ctx.strokeStyle = "rgba(255,255,255,0.5)"; ctx.setLineDash([4, 4]); }
    ctx.stroke();
  });
  ctx.setLineDash([]);
  if (pred.ghostBall) {
    const g = tableToCanvas(pred.ghostBall, v);
    ctx.beginPath(); ctx.arc(g.x, g.y, BALL_RADIUS * v.scale, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(255,255,255,0.7)"; ctx.lineWidth = 1.5; ctx.stroke();
  }
}

function drawCueStick(ctx: CanvasRenderingContext2D, cueBall: any, angle: number, power: number, charging: boolean, v: ViewTransform) {
  const c = tableToCanvas(cueBall.pos, v);
  const r = BALL_RADIUS * v.scale;
  const pull = (charging ? power : 0) * 0.45 * v.scale + 0.06 * v.scale; // pull-back in px
  const gap = r + 6 + pull;
  const len = 320;
  const back = { x: c.x - Math.cos(angle) * gap, y: c.y - Math.sin(angle) * gap };
  const tip = { x: c.x - Math.cos(angle) * (gap + len), y: c.y - Math.sin(angle) * (gap + len) };
  ctx.save();
  ctx.lineCap = "round";
  ctx.strokeStyle = "#c9a14a";
  ctx.lineWidth = 6;
  ctx.beginPath(); ctx.moveTo(back.x, back.y); ctx.lineTo(tip.x, tip.y); ctx.stroke();
  ctx.strokeStyle = "#7a5a1f";
  ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(back.x, back.y); ctx.lineTo(tip.x, tip.y); ctx.stroke();
  // Tip
  ctx.beginPath(); ctx.arc(back.x, back.y, 3, 0, Math.PI * 2); ctx.fillStyle = "#1e3a5f"; ctx.fill();
  ctx.restore();
}

function drawBallInHandHint(ctx: CanvasRenderingContext2D, cueBall: any, v: ViewTransform) {
  const c = tableToCanvas(cueBall.pos, v);
  ctx.beginPath(); ctx.arc(c.x, c.y, BALL_RADIUS * v.scale + 4, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(250,204,21,0.8)"; ctx.lineWidth = 2; ctx.setLineDash([4, 4]); ctx.stroke();
  ctx.setLineDash([]);
}

export default PoolTable;
