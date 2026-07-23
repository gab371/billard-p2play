import type { GameState, Player, TeamId } from "../../core/types";

const TEAM_LABEL: Record<TeamId, string> = { SOLIDS: "Pleines", STRIPES: "Rayées" };
const TEAM_EMOJI: Record<TeamId, string> = { SOLIDS: "🟠", STRIPES: "🟡" };

function BallPip({ n, group }: { n: number; group: "SOLIDS" | "STRIPES" }) {
  return (
    <span
      title={`Bille ${n}`}
      className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[9px] font-bold border border-zinc-700 ${
        group === "SOLIDS" ? "bg-amber-400 text-zinc-900" : "bg-white text-zinc-900"
      }`}
    >
      {n}
    </span>
  );
}

function TeamCard({
  team, players, state, myPeerId,
}: { team: TeamId; players: Player[]; state: GameState; myPeerId: string | null }) {
  const group = state.teamGroups[team];
  const remaining = group ? state.remaining[group] : "—";
  const isActive = state.activeTeam === team && state.phase !== "GAME_OVER";
  const ballNums = group === "SOLIDS" ? [1, 2, 3, 4, 5, 6, 7] : group === "STRIPES" ? [9, 10, 11, 12, 13, 14, 15] : [];

  return (
    <div className={`p-4 rounded-2xl border transition-all ${isActive ? "bg-zinc-800/60 border-amber-500/50 ring-2 ring-amber-500/40" : "bg-zinc-900/40 border-zinc-800"}`}>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-bold text-zinc-200 flex items-center gap-1.5">
          <span>{TEAM_EMOJI[team]}</span>
          {TEAM_LABEL[team]}
          {isActive && <span className="text-[10px] text-amber-400 ml-1">● à jouer</span>}
        </h3>
        <span className="text-xs text-zinc-400 font-mono">
          {group === "SOLIDS" ? "1-7" : group === "STRIPES" ? "9-15" : "?"} · restantes: <b className="text-zinc-200">{remaining}</b>
        </span>
      </div>
      <div className="flex flex-wrap gap-1 mb-3">
        {ballNums.length === 0 ? (
          <span className="text-[10px] text-zinc-600">Groupe non assigné</span>
        ) : ballNums.map((n) => {
          const pocketed = !state.balls.some((b) => b.id === n && !b.pocketed);
          return (
            <span key={n} className={pocketed ? "opacity-25" : ""}>
              <BallPip n={n} group={group as "SOLIDS" | "STRIPES"} />
            </span>
          );
        })}
      </div>
      <div className="space-y-1">
        {players.length === 0 && <div className="text-[10px] text-zinc-600">Aucun joueur</div>}
        {players.map((p) => {
          const isShooter = state.activeShooterId === p.id && isActive;
          return (
            <div key={p.id} className={`flex items-center gap-2 text-xs ${p.id === myPeerId ? "text-amber-300" : "text-zinc-300"}`}>
              <span className="text-base">{p.avatar}</span>
              <span className="truncate">{p.name}</span>
              {p.isHost && <span className="text-[9px] text-zinc-500">★</span>}
              {isShooter && <span className="text-[9px] text-amber-400 font-bold">🎯 tire</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface ScoreboardProps {
  state: GameState;
  myPeerId: string | null;
}

export function Scoreboard({ state, myPeerId }: ScoreboardProps) {
  const solids = state.players.filter((p) => p.team === "SOLIDS");
  const stripes = state.players.filter((p) => p.team === "STRIPES");
  const spectators = state.players.filter((p) => p.team === null);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <TeamCard team="SOLIDS" players={solids} state={state} myPeerId={myPeerId} />
        <TeamCard team="STRIPES" players={stripes} state={state} myPeerId={myPeerId} />
      </div>
      {spectators.length > 0 && (
        <div className="p-3 rounded-2xl border border-zinc-800 bg-zinc-900/30">
          <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-2">👁️ Spectateurs</h3>
          <div className="flex flex-wrap gap-2">
            {spectators.map((p) => (
              <span key={p.id} className="flex items-center gap-1.5 text-xs text-zinc-400">
                <span className="text-base">{p.avatar}</span> {p.name}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default Scoreboard;
