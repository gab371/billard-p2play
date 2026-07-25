import { useCallback, useEffect, useRef } from "react";

export interface EnglishOffset {
  /** -1..1 left/right */
  side: number;
  /** -1..1 back/top (screen: up = top spin) */
  top: number;
}

interface ShotSidebarProps {
  enabled: boolean;
  /** Show the vertical power bar (Barre control mode). */
  showPowerSlider: boolean;
  english: EnglishOffset;
  onOpenEnglish: () => void;
  power: number;
  onPowerChange: (p: number) => void;
  /** Fire with current power (Tirer button). */
  onFire: (p: number) => void;
}

interface EnglishPickerModalProps {
  open: boolean;
  english: EnglishOffset;
  onEnglishChange: (e: EnglishOffset) => void;
  onClose: () => void;
}

const MIN_FIRE = 0.05;
/** Fixed rail width so the table never reflows. */
export const SHOT_SIDEBAR_W = 56;

function englishFromClient(clientX: number, clientY: number, el: HTMLElement): EnglishOffset {
  const rect = el.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const r = Math.min(rect.width, rect.height) / 2 - 6;
  let dx = (clientX - cx) / r;
  let dy = (clientY - cy) / r;
  const len = Math.hypot(dx, dy);
  if (len > 1) { dx /= len; dy /= len; }
  // Screen up = top spin (negative dy).
  return { side: dx, top: -dy };
}

function stopCueSteal(e: React.SyntheticEvent) {
  e.stopPropagation();
}

/**
 * Large centered cue-ball tip picker (8 Ball Pool style).
 */
export function EnglishPickerModal({
  open, english, onEnglishChange, onClose,
}: EnglishPickerModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="absolute inset-0 z-30 flex items-center justify-center bg-zinc-950/55 backdrop-blur-[2px]"
      onPointerDown={(e) => {
        stopCueSteal(e);
        if (e.target === e.currentTarget) onClose();
      }}
      onPointerUp={stopCueSteal}
      onPointerMove={stopCueSteal}
    >
      <div
        className="flex flex-col items-center gap-3 p-5 rounded-2xl border border-zinc-700 bg-zinc-900/95 shadow-2xl"
        onPointerDown={stopCueSteal}
        onPointerUp={stopCueSteal}
      >
        <div className="text-[11px] uppercase tracking-widest text-amber-200/90 font-bold">Effet</div>
        <p className="text-[11px] text-zinc-400 text-center max-w-[200px] leading-snug">
          Cliquez sur la bille pour choisir où frapper
        </p>
        <button
          type="button"
          aria-label="Position de l'effet"
          className="relative w-40 h-40 rounded-full bg-gradient-to-br from-zinc-50 to-zinc-300 border-2 border-zinc-500 shadow-inner cursor-crosshair touch-none"
          onPointerDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            e.currentTarget.setPointerCapture(e.pointerId);
            onEnglishChange(englishFromClient(e.clientX, e.clientY, e.currentTarget));
          }}
          onPointerMove={(e) => {
            if (e.buttons === 0) return;
            e.stopPropagation();
            onEnglishChange(englishFromClient(e.clientX, e.clientY, e.currentTarget));
          }}
          onPointerUp={(e) => e.stopPropagation()}
        >
          <span
            className="absolute w-4 h-4 -ml-2 -mt-2 rounded-full bg-sky-600 border-2 border-white shadow pointer-events-none"
            style={{
              left: `${50 + english.side * 42}%`,
              top: `${50 - english.top * 42}%`,
            }}
          />
          <span className="absolute inset-[18%] rounded-full border border-black/10 pointer-events-none" />
          <span className="absolute left-1/2 top-1/2 w-1 h-1 -ml-0.5 -mt-0.5 rounded-full bg-zinc-500/50 pointer-events-none" />
        </button>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="px-3 py-1.5 text-xs font-bold rounded-lg border border-zinc-700 text-zinc-300 hover:border-zinc-500"
            onClick={() => onEnglishChange({ side: 0, top: 0 })}
          >
            Centrer
          </button>
          <button
            type="button"
            className="px-3 py-1.5 text-xs font-bold rounded-lg border border-amber-500/60 bg-amber-600 text-zinc-900 hover:bg-amber-500"
            onClick={onClose}
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Narrow left rail: mini English preview + optional power bar + Tirer.
 * Always mounted at fixed width so the table layout stays stable.
 */
export function ShotSidebar({
  enabled, showPowerSlider, english, onOpenEnglish, power, onPowerChange, onFire,
}: ShotSidebarProps) {
  const barRef = useRef<HTMLDivElement | null>(null);
  const dragging = useRef(false);

  /** Top of bar = full power, bottom = 0 — fill height matches pointer. */
  const powerFromClientY = useCallback((clientY: number) => {
    const el = barRef.current;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    return Math.max(0, Math.min(1, 1 - (clientY - rect.top) / rect.height));
  }, []);

  return (
    <aside
      className={`relative z-20 flex flex-col items-center gap-3 py-2 px-1 rounded-xl border bg-zinc-950/45 backdrop-blur-md border-zinc-700/60 shrink-0 shadow-lg ${
        enabled ? "" : "opacity-45"
      }`}
      style={{ width: SHOT_SIDEBAR_W }}
      onPointerDown={stopCueSteal}
      onPointerUp={stopCueSteal}
      onPointerMove={stopCueSteal}
      onClick={stopCueSteal}
    >
      <div className="w-full text-center">
        <div className="text-[8px] uppercase tracking-widest text-zinc-500 font-bold mb-1.5">Effet</div>
        <button
          type="button"
          disabled={!enabled}
          aria-label="Ouvrir le sélecteur d'effet"
          title="Effet"
          className="relative mx-auto block w-9 h-9 rounded-full bg-gradient-to-br from-zinc-100 to-zinc-300 border border-zinc-500 shadow-inner disabled:cursor-default hover:ring-2 hover:ring-sky-500/50 transition"
          onPointerDown={(e) => {
            e.stopPropagation();
            e.preventDefault();
          }}
          onClick={(e) => {
            e.stopPropagation();
            if (enabled) onOpenEnglish();
          }}
        >
          <span
            className="absolute w-2 h-2 -ml-1 -mt-1 rounded-full bg-sky-600 border border-white shadow pointer-events-none"
            style={{
              left: `${50 + english.side * 38}%`,
              top: `${50 - english.top * 38}%`,
            }}
          />
        </button>
      </div>

      {showPowerSlider && (
        <div className={`w-full flex flex-col items-center gap-1.5 flex-1 min-h-[140px] ${enabled ? "" : "pointer-events-none"}`}>
          <div className="text-[8px] uppercase tracking-widest text-zinc-500 font-bold">Force</div>
          <div
            ref={barRef}
            className="relative w-6 flex-1 min-h-[100px] rounded-full bg-zinc-950 border border-zinc-700 overflow-hidden touch-none cursor-ns-resize select-none"
            onPointerDown={(e) => {
              e.stopPropagation();
              e.preventDefault();
              dragging.current = true;
              e.currentTarget.setPointerCapture(e.pointerId);
              onPowerChange(powerFromClientY(e.clientY));
            }}
            onPointerMove={(e) => {
              e.stopPropagation();
              if (!dragging.current) return;
              onPowerChange(powerFromClientY(e.clientY));
            }}
            onPointerUp={(e) => {
              e.stopPropagation();
              if (!dragging.current) return;
              dragging.current = false;
              onPowerChange(powerFromClientY(e.clientY));
            }}
            onPointerCancel={(e) => {
              e.stopPropagation();
              dragging.current = false;
            }}
          >
            <div
              className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-rose-500 via-amber-400 to-amber-200/80 transition-[height] duration-75"
              style={{ height: `${Math.round(power * 100)}%` }}
            />
            {/* Thumb at current power level (follows mouse). */}
            <div
              className="absolute inset-x-0 h-1 bg-white/90 shadow pointer-events-none"
              style={{ bottom: `calc(${Math.round(power * 100)}% - 2px)` }}
            />
            <div className="absolute inset-0 flex flex-col justify-between py-1.5 pointer-events-none">
              <span className="text-[8px] text-zinc-500 text-center">100</span>
              <span className="text-[8px] text-zinc-300 text-center font-mono">{Math.round(power * 100)}</span>
              <span className="text-[8px] text-zinc-500 text-center">0</span>
            </div>
          </div>
          <button
            type="button"
            disabled={!enabled || power < MIN_FIRE}
            className="mt-0.5 w-full px-1 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wide border transition-all disabled:opacity-35 disabled:cursor-not-allowed bg-amber-600 border-amber-400 text-zinc-900 hover:bg-amber-500 enabled:hover:scale-[1.02]"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              if (power >= MIN_FIRE) onFire(power);
            }}
          >
            Tirer
          </button>
        </div>
      )}
    </aside>
  );
}

export default ShotSidebar;
