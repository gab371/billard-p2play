import { useEffect, useState } from "react";

export const P2PLAY_BOARD_EXPAND_EVENT = "p2play:board-expand";

function notifyBoardExpand(expanded: boolean) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(P2PLAY_BOARD_EXPAND_EVENT, { detail: { expanded } }),
  );
}

/** Pseudo-fullscreen for the play area (not the browser Fullscreen API). */
export function useBoardExpand(resetWhenTrue: boolean) {
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (resetWhenTrue) setExpanded(false);
  }, [resetWhenTrue]);

  useEffect(() => {
    notifyBoardExpand(expanded);
    return () => {
      if (expanded) notifyBoardExpand(false);
    };
  }, [expanded]);

  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setExpanded(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [expanded]);

  return {
    expanded,
    setExpanded,
    toggle: () => setExpanded((v) => !v),
  };
}
