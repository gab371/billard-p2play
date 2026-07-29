import { Maximize2, Minimize2 } from "lucide-react";

interface ExpandToggleProps {
  expanded: boolean;
  onToggle: () => void;
  className?: string;
}

export function ExpandToggle({ expanded, onToggle, className = "" }: ExpandToggleProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      title={expanded ? "Réduire la zone de jeu (Échap)" : "Agrandir la zone de jeu"}
      aria-pressed={expanded}
      className={
        className ||
        "absolute top-3 right-3 z-50 w-9 h-9 flex items-center justify-center rounded-xl border border-white/20 bg-zinc-950/85 text-white backdrop-blur-md hover:border-amber-400/60 transition-all"
      }
    >
      {expanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
    </button>
  );
}
