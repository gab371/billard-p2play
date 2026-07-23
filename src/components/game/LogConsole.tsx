import type { GameLog } from "../../core/types";

const COLOR: Record<GameLog["type"], string> = {
  info: "text-zinc-400",
  system: "text-zinc-500",
  warning: "text-amber-400",
  phase: "text-violet-400 font-bold",
  shot: "text-sky-400",
  pocket: "text-emerald-400",
  foul: "text-rose-400 font-bold",
  success: "text-emerald-400",
  failure: "text-rose-400",
  victory: "text-amber-300 font-bold",
};

interface LogConsoleProps {
  logs: GameLog[];
}

export function LogConsole({ logs }: LogConsoleProps) {
  return (
    <div className="bg-zinc-900/60 backdrop-blur-md border border-zinc-800 rounded-3xl p-5 shadow-xl flex flex-col h-full min-h-[200px]">
      <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-3">Journal</h3>
      <div className="flex-1 overflow-y-auto space-y-1.5 pr-1.5 scrollbar-thin">
        {logs.length === 0 && <div className="text-zinc-600 text-center py-8 text-xs">Aucun événement.</div>}
        {logs.map((log) => (
          <div key={log.id} className={`text-xs leading-relaxed ${COLOR[log.type]}`}>
            <span className="text-zinc-600 font-mono mr-1.5">{log.timestamp}</span>
            {log.message}
          </div>
        ))}
      </div>
    </div>
  );
}

export default LogConsole;
