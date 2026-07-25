import { X } from "lucide-react";
import type { GameConfig } from "../../core/types";
import { rulesForConfig } from "../../core/rulesHelp";

interface RulesModalProps {
  open: boolean;
  config?: GameConfig;
  onClose: () => void;
}

export function RulesModal({ open, config, onClose }: RulesModalProps) {
  if (!open) return null;
  const { heading, sections } = rulesForConfig(config);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/90 backdrop-blur-md">
      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 w-full max-w-2xl text-zinc-100 shadow-2xl relative max-h-[90vh] overflow-y-auto">
        <button type="button" onClick={onClose} className="absolute top-4 right-4 text-zinc-400 hover:text-zinc-200">
          <X className="w-5 h-5" />
        </button>
        <h2 className="text-2xl font-black text-amber-400 mb-1 border-b border-zinc-800 pb-2 pr-8">
          Règles : {heading}
        </h2>
        <p className="text-[11px] text-zinc-500 mb-4">Selon la variante active du salon.</p>
        <div className="space-y-3 text-sm text-zinc-300 leading-relaxed">
          {sections.map((s) => (
            <p key={s.title}>
              <strong className="text-amber-400">{s.title}.</strong>{" "}
              {s.body.split("**").map((part, i) =>
                i % 2 === 1 ? <b key={i}>{part}</b> : <span key={i}>{part}</span>,
              )}
            </p>
          ))}
          <p>
            <strong className="text-amber-400">Contrôles.</strong> Standard : clic droit viser, clic gauche charger.
            Survol : pointeur = visee. Barre : force sur le slider. Effet via la petite bille à gauche.
          </p>
        </div>
      </div>
    </div>
  );
}
