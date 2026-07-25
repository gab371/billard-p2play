import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { GameState, ShotRequest, ShotFrame, Vec2 } from "../../core/types";
import { BALL_RADIUS, POCKET_RADIUS } from "../../core/constants";
import { clampCuePlacement, placementModeForState } from "../../core/rules";
import { getVariant, needsCallBeforeShot, isReadyToShoot, activeCueBallId } from "../../core/variants";
import { getTableLayout } from "../../core/tableLayout";
import { drawBall, tableToCanvas, type ViewTransform } from "./ballRenderer";
import { drawTable, TABLE_RAIL_PX } from "./tableRenderer";
import { drawAiming, drawBallInHandHint, drawCueStick, powerMeterClass } from "./cueRenderer";
import { usePoolAnimation } from "../../hooks/usePoolAnimation";
import { useCueInput, loadControlMode, saveControlMode, type ControlMode } from "../../hooks/useCueInput";
import { ShotSidebar, EnglishPickerModal, type EnglishOffset } from "./ShotSidebar";
import { pickCallAt } from "./callShotPick";
import { TableShotHints } from "./TableShotHints";

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
  onSetCall?: (ballId: number | null, pocketIndex: number | null) => void;
  onSetPushOut?: (declared: boolean) => void;
}

const RAIL = TABLE_RAIL_PX;
const CUE_PAD = 40;
const INSET = RAIL + CUE_PAD;
const PLACE_THROTTLE_MS = 40;

export function PoolTable({
  state, isMyTurn, amSpectator, isHost, engineRef, lastFrame,
  onFire, onPlaceCueBall, onConfirmPlacement, onAim, onSetCall, onSetPushOut,
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
  const localCuePosRef = useRef<Vec2 | null>(null);
  const [, bumpPreview] = useState(0);
  const lastPlaceSent = useRef(0);

  const variant = useMemo(() => getVariant(state.config?.variantId), [state.config?.variantId]);
  const layout = useMemo(() => getTableLayout(variant.tableProfile), [variant.tableProfile]);
  const ballStyle = variant.id === "EN_BLACKBALL" ? "en" : variant.id === "FR_CAROM" ? "fr" : "us";
  const callNeeded = needsCallBeforeShot(state);
  const callReady = isReadyToShoot(state);

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
      const layoutW = Math.max(320, r.width);
      const feltW = Math.max(1, layoutW - RAIL * 2);
      const scale = feltW / layout.width;
      const feltH = layout.height * scale;
      setSize({ w: feltW + INSET * 2, h: feltH + INSET * 2 });
    });
    ro.observe(parent);
    return () => ro.disconnect();
  }, [layout.width, layout.height]);

  useEffect(() => {
    const scale = (size.w - INSET * 2) / layout.width;
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
  }, [size, layout.width]);

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
    const cueId = activeCueBallId(variant.id, state.activeTeam);
    const cue = balls.find((b: any) => b.id === cueId && !b.pocketed);
    return cue ? cue.pos : null;
  }, [isHost, engineRef, state.balls, state.activeTeam, variant.id]);

  const toTable = useCallback((clientX: number, clientY: number): Vec2 | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const view = viewRef.current;
    return {
      x: (clientX - rect.left - view.ox) / view.scale,
      y: (clientY - rect.top - view.oy) / view.scale,
    };
  }, []);

  const handlePlace = useCallback((pos: Vec2) => {
    const balls = (isHost ? engineRef.current?.state?.balls : null) ?? state.balls ?? [];
    const mode = placementModeForState(state);
    const next = clampCuePlacement(pos, mode, balls, variant.tableProfile);
    if (!next) return;
    localCuePosRef.current = next;
    bumpPreview((n) => n + 1);
    const now = performance.now();
    if (now - lastPlaceSent.current >= PLACE_THROTTLE_MS) {
      lastPlaceSent.current = now;
      onPlaceCueBall(next);
    }
  }, [isHost, engineRef, state.balls, state.phase, onPlaceCueBall, variant.tableProfile]);

  const handleConfirm = useCallback(() => {
    const balls = (isHost ? engineRef.current?.state?.balls : null) ?? state.balls ?? [];
    const mode = placementModeForState(state);
    const raw = localCuePosRef.current;
    const pos = raw ? clampCuePlacement(raw, mode, balls, variant.tableProfile) : null;
    if (pos) {
      localCuePosRef.current = pos;
      onPlaceCueBall(pos);
    }
    onConfirmPlacement();
  }, [isHost, engineRef, state.balls, state.phase, onPlaceCueBall, onConfirmPlacement, variant.tableProfile]);

  const handleFire = useCallback((angle: number, power: number) => {
    if (callNeeded && !callReady) return;
    const english = englishRef.current;
    onFire({ angle, power, spinSide: english.side, spinTop: english.top });
    setBarrePower(0);
  }, [onFire, callNeeded, callReady]);

  const handleCallPick = useCallback((clientX: number, clientY: number) => {
    if (!callNeeded || !isMyTurn || !onSetCall || amSpectator) return false;
    const pos = toTable(clientX, clientY);
    if (!pos) return false;
    const next = pickCallAt(pos, state.balls, layout, variant.callShot, state.pendingCall);
    if (!next) return false;
    onSetCall(next.ballId, next.pocketIndex);
    return true;
  }, [callNeeded, isMyTurn, amSpectator, onSetCall, toTable, state.balls, state.pendingCall, variant.callShot, layout]);

  const handleCallPointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return;
    handleCallPick(e.clientX, e.clientY);
  }, [handleCallPick]);

  const canShoot = isMyTurn && !amSpectator && state.phase !== "RESOLVING" && state.phase !== "GAME_OVER";
  const ballsInMotion = state.phase === "RESOLVING";
  const callBlocksFire = callNeeded && !callReady;
  const sidebarEnabled = canShoot && !placing && !callBlocksFire;

  const cue = useCueInput({
    enabled: canShoot,
    inputPaused: englishOpen,
    fireLocked: callBlocksFire,
    ballInHand: placing,
    controlMode,
    getCueBallPos,
    toTable,
    onFire: handleFire,
    onPlaceCueBall: handlePlace,
    onConfirmPlacement: handleConfirm,
    onAimChange: onAim,
  });

  const handleBarreRelease = useCallback((power: number) => {
    handleFire(cue.aimAngleRef.current, power);
  }, [handleFire, cue.aimAngleRef]);

  const drawRef = useRef<((balls: any[]) => void) | null>(null);
  drawRef.current = (balls: any[]) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const view = viewRef.current;
    timeRef.current = performance.now();
    drawTable(ctx, view, size.w, size.h, timeRef.current, RAIL, layout);

    const drawn = localCuePosRef.current
      ? balls.map((ball: any) =>
          ball.id === 0 ? { ...ball, pos: { ...localCuePosRef.current! }, pocketed: false } : ball,
        )
      : balls;

    for (const ball of drawn) {
      drawBall(ctx, ball, view, ballStyle);
      if (state.pendingCall?.ballId === ball.id && !ball.pocketed) {
        const center = tableToCanvas(ball.pos, view);
        ctx.beginPath();
        ctx.arc(center.x, center.y, BALL_RADIUS * view.scale + 4, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(251, 191, 36, 0.95)";
        ctx.lineWidth = 3;
        ctx.stroke();
      }
    }

    if (state.pendingCall?.pocketIndex != null && layout.pockets[state.pendingCall.pocketIndex]) {
      const pocket = layout.pockets[state.pendingCall.pocketIndex];
      const center = tableToCanvas(pocket, view);
      ctx.beginPath();
      ctx.arc(center.x, center.y, POCKET_RADIUS * view.scale * 1.15, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(251, 191, 36, 0.9)";
      ctx.lineWidth = 3;
      ctx.stroke();
    }

    const cueId = activeCueBallId(variant.id, state.activeTeam);
    const cueBall = drawn.find((ball: any) => ball.id === cueId && !ball.pocketed);
    if (!cueBall) return;

    if (canShoot && placing) {
      drawBallInHandHint(ctx, cueBall, view);
    } else if (canShoot && !callBlocksFire) {
      drawAiming(ctx, cueBall, drawn, cue.aimAngle, view, false, layout);
      const stickPower = controlMode === "barre" ? barrePower : cue.power;
      const stickCharging = controlMode === "barre" ? barrePower > 0 : cue.charging;
      drawCueStick(ctx, cueBall, cue.aimAngle, stickPower, stickCharging, view);
    } else if (canShoot && callBlocksFire) {
      drawAiming(ctx, cueBall, drawn, cue.aimAngle, view, false, layout);
      drawCueStick(ctx, cueBall, cue.aimAngle, 0, false, view);
    } else if (
      state.aim.shooterId &&
      state.phase !== "RESOLVING" &&
      state.phase !== "GAME_OVER" &&
      !state.ballInHand
    ) {
      drawAiming(ctx, cueBall, drawn, state.aim.angle, view, true, layout);
      drawCueStick(ctx, cueBall, state.aim.angle, state.aim.power, state.aim.power > 0, view, true);
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

  const chooseMode = (mode: ControlMode) => {
    setControlMode(mode);
    saveControlMode(mode);
    setBarrePower(0);
  };

  return (
    <div className="w-full flex flex-col items-center gap-3">
      <TableShotHints state={state} isMyTurn={isMyTurn} onSetPushOut={onSetPushOut} />
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
            onPointerDown={handleCallPointerDown}
            onClick={(e) => handleCallPick(e.clientX, e.clientY)}
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
        {amSpectator && <span>Mode spectateur — lecture seule.</span>}
        {!amSpectator && !isMyTurn && <span>En attente de votre tour…</span>}
        {!amSpectator && isMyTurn && (
          <>
            <span>{placing ? "Bille en main : placez puis validez." : "Visez et tirez."}</span>
            <div className="flex items-center gap-1 flex-wrap justify-center">
              {([["standard", "Standard"], ["hover", "Survol"], ["barre", "Barre"]] as const).map(([id, label]) => (
                <button key={id} type="button" onClick={() => chooseMode(id)}
                  className={`px-2 py-1 rounded-lg font-bold border ${
                    controlMode === id ? "bg-amber-600 border-amber-400 text-zinc-900" : "bg-zinc-900 border-zinc-800 text-zinc-300"
                  }`}>{label}</button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default PoolTable;
