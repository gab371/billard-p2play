import { useCallback, useEffect, useRef, useState } from "react";
import type { Vec2 } from "../core/types";

const MAX_PULL_METERS = 0.45;
const MIN_POWER = 0.05;
const CONTROL_KEY = "pool:control-mode";
const AIM_THROTTLE_MS = 50;

/** standard / hover: drag-back power. barre: power via sidebar slider. */
export type ControlMode = "standard" | "hover" | "barre";

export function loadControlMode(): ControlMode {
  try {
    const v = localStorage.getItem(CONTROL_KEY);
    if (v === "standard" || v === "hover" || v === "barre") return v;
  } catch { /* ignore */ }
  if (typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches) {
    return "barre";
  }
  return "standard";
}

export function saveControlMode(m: ControlMode): void {
  try { localStorage.setItem(CONTROL_KEY, m); } catch { /* ignore */ }
}

interface UseCueInputOptions {
  enabled: boolean;
  /** When true, ignore aim/charge (e.g. English picker open). */
  inputPaused?: boolean;
  /** When true, allow place/aim but block charge & fire (call-shot incomplete). */
  fireLocked?: boolean;
  ballInHand: boolean;
  controlMode: ControlMode;
  getCueBallPos: () => Vec2 | null;
  toTable: (clientX: number, clientY: number) => Vec2 | null;
  onFire: (angle: number, power: number) => void;
  onPlaceCueBall: (pos: Vec2) => void;
  onConfirmPlacement: () => void;
  onAimChange?: (angle: number, power: number) => void;
}

function isPoolCanvasEvent(e: Event): boolean {
  const t = e.target;
  if (!(t instanceof Element)) return false;
  return t.id === "pool-canvas" || !!t.closest("#pool-canvas");
}

/**
 * Cue controls via Pointer Events.
 *
 * - standard: right-aim, left charge
 * - hover: pointer-aim, left charge
 * - barre: right-aim (like standard), power/fire via sidebar — left never charges
 * Ball-in-hand: cue follows pointer (no button). Left confirms placement.
 * Charge / confirm only when the event target is the pool canvas (sidebar UI safe).
 */
export function useCueInput(opts: UseCueInputOptions) {
  const {
    enabled, inputPaused = false, fireLocked = false, ballInHand, controlMode, getCueBallPos, toTable,
    onFire, onPlaceCueBall, onConfirmPlacement, onAimChange,
  } = opts;
  const [aimAngle, setAimAngle] = useState(0);
  const [power, setPower] = useState(0);
  const [charging, setCharging] = useState(false);
  const lockedAngleRef = useRef(0);
  const chargingRef = useRef(false);
  const aimingRef = useRef(false);
  const enabledRef = useRef(enabled);
  const pausedRef = useRef(inputPaused);
  const fireLockedRef = useRef(fireLocked);
  const ballInHandRef = useRef(ballInHand);
  const modeRef = useRef(controlMode);
  const aimAngleRef = useRef(0);
  const lastAimSent = useRef(0);
  enabledRef.current = enabled;
  pausedRef.current = inputPaused;
  fireLockedRef.current = fireLocked;
  ballInHandRef.current = ballInHand;
  modeRef.current = controlMode;

  const emitAim = useCallback((angle: number, pwr: number) => {
    if (!onAimChange) return;
    const now = performance.now();
    if (now - lastAimSent.current < AIM_THROTTLE_MS) return;
    lastAimSent.current = now;
    onAimChange(angle, pwr);
  }, [onAimChange]);

  const updateAim = useCallback((clientX: number, clientY: number) => {
    const cue = getCueBallPos();
    const m = toTable(clientX, clientY);
    if (!cue || !m) return;
    const a = Math.atan2(m.y - cue.y, m.x - cue.x);
    aimAngleRef.current = a;
    setAimAngle(a);
    emitAim(a, 0);
  }, [getCueBallPos, toTable, emitAim]);

  const startCharge = useCallback(() => {
    lockedAngleRef.current = aimAngleRef.current;
    chargingRef.current = true;
    setCharging(true);
    setPower(0);
  }, []);

  const onPointerMove = useCallback((e: PointerEvent) => {
    if (!enabledRef.current || pausedRef.current) return;
    const mode = modeRef.current;

    if (ballInHandRef.current && !chargingRef.current && e.buttons === 0) {
      const canvas = document.getElementById("pool-canvas");
      if (!canvas) return;
      const r = canvas.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) return;
      const m = toTable(e.clientX, e.clientY);
      if (m) onPlaceCueBall(m);
      return;
    }

    if (chargingRef.current && mode !== "barre") {
      const cue = getCueBallPos();
      const m = toTable(e.clientX, e.clientY);
      if (!cue || !m) return;
      const dir = { x: Math.cos(lockedAngleRef.current), y: Math.sin(lockedAngleRef.current) };
      const rel = { x: m.x - cue.x, y: m.y - cue.y };
      const pull = -(rel.x * dir.x + rel.y * dir.y);
      const p = Math.max(0, Math.min(1, pull / MAX_PULL_METERS));
      setPower(p);
      emitAim(lockedAngleRef.current, p);
      return;
    }

    // Aim: hover follows pointer; standard & barre aim while right button held.
    if (mode === "hover" || aimingRef.current) {
      if (ballInHandRef.current) return;
      const canvas = document.getElementById("pool-canvas");
      if (!canvas) return;
      const r = canvas.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) return;
      updateAim(e.clientX, e.clientY);
    }
  }, [getCueBallPos, toTable, onPlaceCueBall, updateAim, emitAim]);

  const onPointerDown = useCallback((e: PointerEvent) => {
    if (!enabledRef.current || pausedRef.current) return;
    // Never start aim/charge from sidebar / overlays / buttons.
    if (!isPoolCanvasEvent(e)) return;
    const mode = modeRef.current;

    if (e.button === 2) {
      if (!ballInHandRef.current) {
        aimingRef.current = true;
        updateAim(e.clientX, e.clientY);
      }
      return;
    }
    if (e.button !== 0) return;

    if (ballInHandRef.current) {
      onConfirmPlacement();
      ballInHandRef.current = false;
      // Never charge on the same click that confirms placement.
      return;
    }

    if (mode === "barre") return; // power/fire via sidebar
    if (fireLockedRef.current) return; // wait for call-shot announcement
    startCharge();
  }, [onConfirmPlacement, updateAim, startCharge]);

  const onPointerUp = useCallback((e: PointerEvent) => {
    if (e.button === 2) {
      aimingRef.current = false;
      return;
    }
    if (e.button !== 0 && e.pointerType !== "touch") return;
    if (modeRef.current === "barre") return;
    if (!chargingRef.current) return;
    chargingRef.current = false;
    setCharging(false);
    setPower((p) => {
      if (p >= MIN_POWER) onFire(lockedAngleRef.current, p);
      return 0;
    });
  }, [onFire]);

  useEffect(() => {
    if (!enabled || inputPaused || fireLocked) {
      chargingRef.current = false; setCharging(false);
      if (!enabled || inputPaused) aimingRef.current = false;
      setPower(0);
    }
  }, [enabled, inputPaused, fireLocked]);

  useEffect(() => {
    const canvas = document.getElementById("pool-canvas") as HTMLCanvasElement | null;
    if (!canvas) return;
    const block = (ev: Event) => ev.preventDefault();
    canvas.addEventListener("contextmenu", block);
    return () => canvas.removeEventListener("contextmenu", block);
  }, []);

  useEffect(() => {
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
    };
  }, [onPointerMove, onPointerDown, onPointerUp]);

  return { aimAngle, power, charging, aimAngleRef };
}
