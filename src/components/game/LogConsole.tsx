import type { GameLog } from "../../core/types";
import { JournalPanel } from "p2play-core/chat";

interface LogConsoleProps {
  logs: GameLog[];
}

export function LogConsole({ logs }: LogConsoleProps) {
  return (
    <JournalPanel
      entries={logs}
      title="Journal"
      emptyLabel="Aucun événement."
      className="bg-zinc-950/45 backdrop-blur-md border border-zinc-700/60 rounded-3xl p-5 shadow-xl flex flex-col h-full min-h-[200px] text-xs font-mono text-zinc-100"
      maxHeight="240px"
      scrollbarAccent="emerald"
    />
  );
}

export default LogConsole;
