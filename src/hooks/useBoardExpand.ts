import { useEffect, useState } from "react";

/** Pseudo-fullscreen for the play area (not the browser Fullscreen API). */
export function useBoardExpand(resetWhenTrue: boolean) {
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (resetWhenTrue) setExpanded(false);
  }, [resetWhenTrue]);

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
