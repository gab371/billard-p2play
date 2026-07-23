import { useCallback, useEffect, useRef, useState } from "react";
import type { Vec2 } from "../core/types";

const MAX_PULL_METERS = 0.45; // pull distance that maps to full power
const MIN_POWER = 0.05;
const CONTROL_KEY = "pool:control-mode";
export type ControlMode = "standard" | "hover";

export function loadControlMode(): ControlMode {
  try {
    const v = localStorage.getItem(CONTROL_KEY);
    if (v === "standard" || v === "hover") return v;
  } catch { /* ignore */ }
  return "standard";
}
export function saveControlMode(m: ControlMode): void {
  try { localStorage.setItem(CONTROL_KEY, m); } catch { /* ignore */ }
}

interface UseCueInputOptions {
  enabled: boolean;             // is it this player's turn to shoot
  ballInHand: boolean;          // cue ball may be placed anywhere
  controlMode: ControlMode;
  getCueBallPos: () => Vec2 | null;
  toTable: (clientX: number, clientY: number) => Vec2 | null;
  onFire: (angle: number, power: number) => void;
  onPlaceCueBall: (pos: Vec2) => void;
  onConfirmPlacement: () => void;
}

/**
 * Cue controls — two selectable schemes:
 *
 *  - "standard" (default): RIGHT mouse button (hold + move) aims the cue.
 *    LEFT mouse button (press + drag back) charges the power; release fires.
 *  - "hover": the aim follows the mouse position (no button needed).
 *    LEFT button still charges + fires.
 *
 * Ball-in-hand: LEFT press + drag moves the cue ball; release confirms the
 * placement (so the next LEFT press shoots instead of re-placing).
 */
export function useCueInput(opts: UseCueInputOptions) {
  const { enabled, ballInHand, controlMode, getCueBallPos, toTable, onFire, onPlaceCueBall, onConfirmPlacement } = opts;
  const [aimAngle, setAimAngle] = useState<number>(0);
  const [power, setPower] = useState<number>(0);
  const [charging, setCharging] = useState<boolean>(false);
  const [placing, setPlacing] = useState<boolean>(false);
  const lockedAngleRef = useRef<number>(0);
  const chargingRef = useRef<boolean>(false);
  const placingRef = useRef<boolean>(false);
  const aimingRef = useRef<boolean>(false); // standard: right button held
  const enabledRef = useRef<boolean>(enabled);
  enabledRef.current = enabled;

  const updateAim = useCallback((clientX: number, clientY: number) => {
    const cue = getCueBallPos();
    const m = toTable(clientX, clientY);
    if (!cue || !m) return;
    setAimAngle(Math.atan2(m.y - cue.y, m.x - cue.x));
  }, [getCueBallPos, toTable]);

  const onMouseMove = useCallback((e: MouseEvent) => {
    if (!enabledRef.current) return;
    if (placingRef.current) {
      const m = toTable(e.clientX, e.clientY);
      if (m) onPlaceCueBall(m);
      return;
    }
    if (chargingRef.current) {
      const cue = getCueBallPos();
      const m = toTable(e.clientX, e.clientY);
      if (!cue || !m) return;
      const dir = { x: Math.cos(lockedAngleRef.current), y: Math.sin(lockedAngleRef.current) };
      const rel = { x: m.x - cue.x, y: m.y - cue.y };
      const pull = -(rel.x * dir.x + rel.y * dir.y); // positive when behind the ball
      setPower(Math.max(0, Math.min(1, pull / MAX_PULL_METERS)));
      return;
    }
    // Standard mode only aims while the right button is held; hover mode aims on move.
    if (controlMode === "hover" || aimingRef.current) updateAim(e.clientX, e.clientY);
  }, [controlMode, getCueBallPos, toTable, onPlaceCueBall, updateAim]);

  const onMouseDown = useCallback((e: MouseEvent) => {
    if (!enabledRef.current) return;
    if (e.button === 2) {
      // Right click: aim (standard mode, or also allowed in hover).
      aimingRef.current = true;
      updateAim(e.clientX, e.clientY);
      return;
    }
    if (e.button !== 0) return;
    if (ballInHand) {
      // Begin drag-to-place.
      placingRef.current = true;
      setPlacing(true);
      const m = toTable(e.clientX, e.clientY);
      if (m) onPlaceCueBall(m);
      return;
    }
    // Left click: start charging, lock the current aim.
    const cue = getCueBallPos();
    const m = toTable(e.clientX, e.clientY);
    if (!cue || !m) return;
    lockedAngleRef.current = Math.atan2(m.y - cue.y, m.x - cue.x);
    setAimAngle(lockedAngleRef.current);
    chargingRef.current = true;
    setCharging(true);
    setPower(0);
  }, [ballInHand, getCueBallPos, toTable, onPlaceCueBall, updateAim]);

  const onMouseUp = useCallback((e: MouseEvent) => {
    if (e.button === 2) {
      aimingRef.current = false;
      return;
    }
    if (e.button !== 0) return;
    if (placingRef.current) {
      placingRef.current = false;
      setPlacing(false);
      onConfirmPlacement();
      return;
    }
    if (!chargingRef.current) return;
    chargingRef.current = false;
    setCharging(false);
    setPower((p) => {
      if (p >= MIN_POWER) onFire(lockedAngleRef.current, p);
      return 0;
    });
  }, [onFire, onConfirmPlacement]);

  useEffect(() => {
    if (!enabled) {
      chargingRef.current = false; setCharging(false);
      placingRef.current = false; setPlacing(false);
      aimingRef.current = false;
      setPower(0);
    }
  }, [enabled]);

  useEffect(() => {
    const canvas = document.getElementById("pool-canvas") as HTMLCanvasElement | null;
    if (!canvas) return;
    const block = (e: Event) => e.preventDefault();
    canvas.addEventListener("contextmenu", block);
    return () => canvas.removeEventListener("contextmenu", block);
  }, []);

  useEffect(() => {
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [onMouseMove, onMouseDown, onMouseUp]);

  return { aimAngle, power, charging, placing };
}
