import type { GameState } from "../../core/types";
import { getVariant, isCallComplete, needsCallBeforeShot } from "../../core/variants";
import { callHintText } from "./callShotPick";

interface TableShotHintsProps {
  state: GameState;
  isMyTurn: boolean;
  onSetPushOut?: (declared: boolean) => void;
}

/** Call-shot banner + push-out / free-shot status above the canvas. */
export function TableShotHints({ state, isMyTurn, onSetPushOut }: TableShotHintsProps) {
  const variant = getVariant(state.config?.variantId);
  const callNeeded = needsCallBeforeShot(state);
  const callReady = isCallComplete(variant.callShot, state.pendingCall);
  const callHint = callNeeded ? callHintText(variant.callShot, state.pendingCall) : null;
  const showPush =
    isMyTurn &&
    state.pushOutAvailable &&
    (state.phase === "SHOOTING" || state.phase === "BREAKING" || state.phase === "BALL_IN_HAND");

  return (
    <div className="w-full flex flex-col gap-2">
      {callHint && isMyTurn && (
        <div
          className={`w-full text-center text-xs font-bold px-3 py-2 rounded-xl border ${
            callReady
              ? "border-emerald-500/40 bg-emerald-950/30 text-emerald-300"
              : "border-amber-500/40 bg-amber-950/30 text-amber-300"
          }`}
        >
          {callHint}
        </div>
      )}
      {state.freeShotsRemaining > 0 && (
        <div className="w-full text-center text-xs font-bold px-3 py-1.5 rounded-xl border border-sky-500/30 bg-sky-950/25 text-sky-300">
          Free shot{state.freeShotsRemaining > 1 ? "s" : ""} : {state.freeShotsRemaining}
          {state.freeBall ? " · free ball (toute bille)" : ""}
        </div>
      )}
      {showPush && (
        <div className="w-full flex flex-wrap items-center justify-center gap-2 text-xs">
          <span className="text-zinc-400">Après casse — push-out :</span>
          <button
            type="button"
            onClick={() => onSetPushOut?.(true)}
            className={`px-2.5 py-1 rounded-lg font-bold border ${
              state.pushOutDeclared
                ? "bg-amber-600 border-amber-400 text-zinc-900"
                : "bg-zinc-900 border-zinc-700 text-zinc-300"
            }`}
          >
            Déclarer
          </button>
          <button
            type="button"
            onClick={() => onSetPushOut?.(false)}
            className={`px-2.5 py-1 rounded-lg font-bold border ${
              !state.pushOutDeclared
                ? "bg-zinc-700 border-zinc-500 text-zinc-100"
                : "bg-zinc-900 border-zinc-700 text-zinc-300"
            }`}
          >
            Jouer normal
          </button>
        </div>
      )}
    </div>
  );
}
