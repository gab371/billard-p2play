import { useCallback, useEffect, useRef, useState } from "react";
import type { GameState, ShotRequest, ShotFrame, Vec2 } from "../../core/types";
import { TABLE_HEIGHT, TABLE_WIDTH } from "../../core/constants";
import { clampCuePlacement, placementModeForPhase } from "../../core/rules";
import { drawBall, type ViewTransform } from "./ballRenderer";
import { drawTable, TABLE_RAIL_PX } from "./tableRenderer";
import { drawAiming, drawBallInHandHint, drawCueStick, powerMeterClass } from "./cueRenderer";
import { usePoolAnimation } from "../../hooks/usePoolAnimation";
import { useCueInput, loadControlMode, saveControlMode, type ControlMode } from "../../hooks/useCueInput";
import { ShotSidebar, EnglishPickerModal, type EnglishOffset } from "./ShotSidebar";

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
  onAim?: (angle: number, power: number) => void;
}

/** Thin wood border around the felt (unchanged look). */
const RAIL = TABLE_RAIL_PX;
/** Empty transparent pad outside the wood so the cue can overflow visibly. */
const CUE_PAD = 40;
const INSET = RAIL + CUE_PAD;
const PLACE_THROTTLE_MS = 40;

export function PoolTable({
  state, isMyTurn, amSpectator, isHost, engineRef, lastFrame,
  onFire, onPlaceCueBall, onConfirmPlacement, onAim,
}: PoolTableProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const viewRef = useRef<ViewTransform>({ scale: 1, ox: 0, oy: 0 });
  const [size, setSize] = useState({ w: 800, h: 464 });
  const [controlMode, setControlMode] = useState<ControlMode>(() => loadControlMode());
  const [english, setEnglish] = useState<EnglishOffset>({ side: 0, top: 0 });
  const [englishOpen, setEnglishOpen] = useState(false);
  const [barrePower, setBarrePower] = useState(0);
  const englishRef = useRef(english);
  englishRef.current = english;
  const timeRef = useRef(0);
  /** Optimistic cue position while placing — avoids network/state lag desync. */
  const localCuePosRef = useRef<Vec2 | null>(null);
  const [, bumpPreview] = useState(0);
  const lastPlaceSent = useRef(0);

  const placing = isMyTurn && state.ballInHand;

  useEffect(() => {
    if (!placing) localCuePosRef.current = null;
  }, [placing]);

  useEffect(() => {
    if (!(isMyTurn && !amSpectator && state.phase !== "RESOLVING" && state.phase !== "GAME_OVER") || placing) {
      setEnglishOpen(false);
    }
  }, [isMyTurn, amSpectator, state.phase, placing]);

  useEffect(() => {
    const parent = canvasRef.current?.parentElement;
    if (!parent) return;
    const ro = new ResizeObserver((entries) => {
      const r = entries[0].contentRect;
      // Felt + wood sized as before (only RAIL inset). Cue pad is extra outside.
      const layoutW = Math.max(320, r.width);
      const feltW = Math.max(1, layoutW - RAIL * 2);
      const scale = feltW / TABLE_WIDTH;
      const feltH = TABLE_HEIGHT * scale;
      setSize({
        w: feltW + INSET * 2,
        h: feltH + INSET * 2,
      });
    });
    ro.observe(parent);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const scale = (size.w - INSET * 2) / TABLE_WIDTH;
    viewRef.current = { scale, ox: INSET, oy: INSET };
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = size.w * dpr;
    canvas.height = size.h * dpr;
    canvas.style.width = `${size.w}px`;
    canvas.style.height = `${size.h}px`;
    const ctx = canvas.getContext("2d");
    if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }, [size]);

  const resolveBalls = useCallback(() => {
    const base = (isHost ? engineRef.current?.state?.balls : null) ?? state.balls ?? [];
    if (!localCuePosRef.current) return base;
    return base.map((b: any) =>
      b.id === 0 ? { ...b, pos: { ...localCuePosRef.current! }, pocketed: false } : b,
    );
  }, [isHost, engineRef, state.balls]);

  const getAuthoritativeBalls = useCallback(() => resolveBalls(), [resolveBalls]);
  const getStaticBalls = useCallback(() => resolveBalls(), [resolveBalls]);

  const getCueBallPos = useCallback((): Vec2 | null => {
    if (localCuePosRef.current) return localCuePosRef.current;
    const balls = (isHost ? engineRef.current?.state?.balls : null) ?? state.balls ?? [];
    const cue = balls.find((b: any) => b.id === 0 && !b.pocketed);
    return cue ? cue.pos : null;
  }, [isHost, engineRef, state.balls]);

  const toTable = useCallback((clientX: number, clientY: number): Vec2 | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const v = viewRef.current;
    return { x: (clientX - rect.left - v.ox) / v.scale, y: (clientY - rect.top - v.oy) / v.scale };
  }, []);

  const handlePlace = useCallback((pos: Vec2) => {
    const balls = (isHost ? engineRef.current?.state?.balls : null) ?? state.balls ?? [];
    const mode = placementModeForPhase(state.phase);
    const next = clampCuePlacement(pos, mode, balls);
    if (!next) return; // stuck against a ball / invalid — keep last legal preview
    localCuePosRef.current = next;
    bumpPreview((n) => n + 1);
    const now = performance.now();
    if (now - lastPlaceSent.current >= PLACE_THROTTLE_MS) {
      lastPlaceSent.current = now;
      onPlaceCueBall(next);
    }
  }, [isHost, engineRef, state.balls, state.phase, onPlaceCueBall]);

  const handleConfirm = useCallback(() => {
    const balls = (isHost ? engineRef.current?.state?.balls : null) ?? state.balls ?? [];
    const mode = placementModeForPhase(state.phase);
    const raw = localCuePosRef.current;
    const pos = raw ? clampCuePlacement(raw, mode, balls) : null;
    if (pos) {
      localCuePosRef.current = pos;
      onPlaceCueBall(pos);
    }
    onConfirmPlacement();
  }, [isHost, engineRef, state.balls, state.phase, onPlaceCueBall, onConfirmPlacement]);

  const handleFire = useCallback((angle: number, power: number) => {
    const e = englishRef.current;
    onFire({ angle, power, spinSide: e.side, spinTop: e.top });
    setBarrePower(0);
  }, [onFire]);

  const canShoot = isMyTurn && !amSpectator && state.phase !== "RESOLVING" && state.phase !== "GAME_OVER";
  const ballsInMotion = state.phase === "RESOLVING";
  const sidebarEnabled = canShoot && !placing;

  const cue = useCueInput({
    enabled: canShoot,
    inputPaused: englishOpen,
    ballInHand: placing,
    controlMode,
    getCueBallPos,
    toTable,
    onFire: handleFire,
    onPlaceCueBall: handlePlace,
    onConfirmPlacement: handleConfirm,
    onAimChange: onAim,
  });

  const handleBarreRelease = useCallback((p: number) => {
    handleFire(cue.aimAngleRef.current, p);
  }, [handleFire, cue.aimAngleRef]);

  const drawRef = useRef<((balls: any[]) => void) | null>(null);
  drawRef.current = (balls: any[]) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const v = viewRef.current;
    timeRef.current = performance.now();
    drawTable(ctx, v, size.w, size.h, timeRef.current);

    // Ensure optimistic cue pos is drawn even if animation snapshot is one frame behind.
    const drawn = localCuePosRef.current
      ? balls.map((b: any) =>
          b.id === 0 ? { ...b, pos: { ...localCuePosRef.current! }, pocketed: false } : b,
        )
      : balls;

    for (const b of drawn) drawBall(ctx, b, v);

    const cueBall = drawn.find((b: any) => b.id === 0 && !b.pocketed);
    if (!cueBall) return;

    if (canShoot) {
      if (!placing) drawAiming(ctx, cueBall, drawn, cue.aimAngle, v);
      const stickPower = controlMode === "barre" ? barrePower : cue.power;
      const stickCharging = controlMode === "barre" ? barrePower > 0 : cue.charging;
      drawCueStick(ctx, cueBall, cue.aimAngle, stickPower, stickCharging, v);
      if (placing) drawBallInHandHint(ctx, cueBall, v);
    } else if (
      state.aim.shooterId &&
      state.phase !== "RESOLVING" &&
      state.phase !== "GAME_OVER" &&
      !state.ballInHand
    ) {
      drawAiming(ctx, cueBall, drawn, state.aim.angle, v, true);
      drawCueStick(ctx, cueBall, state.aim.angle, state.aim.power, state.aim.power > 0, v, true);
    }
  };

  usePoolAnimation({
    isHost,
    ballsInMotion,
    getAuthoritativeBalls,
    getStaticBalls,
    lastFrame,
    drawRef,
  });

  const chooseMode = (m: ControlMode) => { setControlMode(m); saveControlMode(m); setBarrePower(0); };

  return (
    <div className="w-full flex flex-col items-center gap-3">
      <div className="w-full flex gap-2 items-stretch justify-center relative">
        <ShotSidebar
          enabled={sidebarEnabled}
          showPowerSlider={controlMode === "barre"}
          english={english}
          onOpenEnglish={() => setEnglishOpen(true)}
          power={barrePower}
          onPowerChange={setBarrePower}
          onFire={handleBarreRelease}
        />
        <div className="flex-1 min-w-0 relative z-0 overflow-visible">
          <canvas
            id="pool-canvas"
            ref={canvasRef}
            className="pool-canvas relative z-0"
            style={{
              borderRadius: 10,
              background: "transparent",
              display: "block",
              marginLeft: -CUE_PAD,
              marginRight: -CUE_PAD,
              width: size.w,
              height: size.h,
            }}
          />
          <EnglishPickerModal
            open={englishOpen}
            english={english}
            onEnglishChange={setEnglish}
            onClose={() => setEnglishOpen(false)}
          />
          {canShoot && controlMode !== "barre" && cue.charging && (
            <div className="absolute left-3 bottom-3 z-10 w-40 pointer-events-none">
              <div className="text-[10px] uppercase tracking-widest text-amber-200/80 mb-1 font-bold">Puissance</div>
              <div className="h-2 rounded-full bg-zinc-950/70 border border-zinc-700 overflow-hidden">
                <div
                  className={`h-full bg-gradient-to-r ${powerMeterClass(cue.power)} transition-[width] duration-75`}
                  style={{ width: `${Math.round(cue.power * 100)}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="mt-1 flex flex-wrap items-center justify-center gap-3 text-xs text-zinc-400">
        {amSpectator ? (
          <span>Mode spectateur — lecture seule.</span>
        ) : isMyTurn ? (
          <>
            <span>
              {placing
                ? "Bille en main : bougez la souris pour placer (sans clic) · Clic gauche : valider."
                : controlMode === "standard"
                ? "Clic droit : viser · Clic gauche : charger · Relâcher : tirer. Effet : petite bille à gauche."
                : controlMode === "barre"
                ? "Clic droit : viser · Effet (bille) + force à gauche · Tirer pour valider."
                : "Survol : viser · Clic gauche : charger · Relâcher : tirer. Effet : bille à gauche."}
            </span>
            <div className="flex items-center gap-1 ml-1 flex-wrap justify-center">
              <span className="text-[10px] uppercase tracking-widest text-zinc-500">Contrôle</span>
              {([
                ["standard", "Standard"],
                ["hover", "Survol"],
                ["barre", "Barre"],
              ] as const).map(([id, label]) => (
                <button key={id} type="button" onClick={() => chooseMode(id)}
                  className={`px-2 py-1 rounded-lg font-bold border transition-all ${
                    controlMode === id ? "bg-amber-600 border-amber-400 text-zinc-900" : "bg-zinc-900 border-zinc-800 text-zinc-300 hover:border-zinc-600"
                  }`}>{label}</button>
              ))}
            </div>
          </>
        ) : (
          <span>En attente de votre tour…</span>
        )}
      </div>
    </div>
  );
}

export default PoolTable;
