import type { GameState, GamePhase, Player, TeamId, BallGroup } from "../../core/types";

/** Fixed seat labels — independent of solids/stripes assignment. */
const TEAM_NAME: Record<TeamId, string> = { SOLIDS: "Team 1", STRIPES: "Team 2" };

const GROUP_LABEL: Record<"SOLIDS" | "STRIPES", string> = {
  SOLIDS: "Pleines",
  STRIPES: "Rayées",
};

const PHASE_LABEL: Partial<Record<GamePhase, string>> = {
  BREAKING: "Cassure",
  SHOOTING: "Tir",
  BALL_IN_HAND: "Bille en main",
  RESOLVING: "Résolution…",
  GAME_OVER: "Fin de partie",
};

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

function GroupBadge({ group }: { group: "SOLIDS" | "STRIPES" }) {
  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-md border ${
        group === "SOLIDS"
          ? "bg-amber-500/15 border-amber-500/40 text-amber-300"
          : "bg-zinc-100/10 border-zinc-500/40 text-zinc-200"
      }`}
      title={group === "SOLIDS" ? "Pleines 1-7" : "Rayées 9-15"}
    >
      <span
        className={`inline-block w-2.5 h-2.5 rounded-full ${
          group === "SOLIDS" ? "bg-amber-400" : "bg-white border border-zinc-500"
        }`}
      />
      {GROUP_LABEL[group]}
    </span>
  );
}

function TeamCard({
  team, players, state, myPeerId, compact,
}: {
  team: TeamId;
  players: Player[];
  state: GameState;
  myPeerId: string | null;
  compact?: boolean;
}) {
  const group = state.teamGroups[team] as BallGroup | null;
  const assigned = group === "SOLIDS" || group === "STRIPES";
  const remaining = assigned ? state.remaining[group] : null;
  const isActive = state.activeTeam === team && state.phase !== "GAME_OVER";
  const ballNums = group === "SOLIDS" ? [1, 2, 3, 4, 5, 6, 7] : group === "STRIPES" ? [9, 10, 11, 12, 13, 14, 15] : [];

  return (
    <div className={`rounded-2xl border transition-all ${compact ? "p-3" : "p-4"} ${
      isActive ? "bg-zinc-800/60 border-amber-500/50 ring-2 ring-amber-500/40" : "bg-zinc-900/40 border-zinc-800"
    }`}>
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <h3 className="text-sm font-bold text-zinc-200 flex items-center gap-1.5 min-w-0 flex-wrap">
          <span className="truncate">{TEAM_NAME[team]}</span>
          {assigned && <GroupBadge group={group} />}
          {isActive && <span className="text-[10px] text-amber-400 shrink-0">à jouer</span>}
        </h3>
        {assigned && (
          <span className="text-xs text-zinc-400 font-mono shrink-0">
            {group === "SOLIDS" ? "1-7" : "9-15"} · <b className="text-zinc-200">{remaining}</b>
          </span>
        )}
      </div>
      {assigned ? (
        <div className="flex flex-wrap gap-1 mb-2">
          {ballNums.map((n) => {
            const pocketed = !state.balls.some((b) => b.id === n && !b.pocketed);
            return (
              <span key={n} className={pocketed ? "opacity-25" : ""}>
                <BallPip n={n} group={group} />
              </span>
            );
          })}
        </div>
      ) : (
        <div className="mb-2 text-[10px] text-zinc-600">Groupe à déterminer</div>
      )}
      <div className={`flex flex-wrap gap-x-3 gap-y-1 ${compact ? "" : "flex-col space-y-1"}`}>
        {players.length === 0 && <div className="text-[10px] text-zinc-600">Aucun joueur</div>}
        {players.map((p) => {
          const isShooter = state.activeShooterId === p.id && isActive;
          return (
            <div key={p.id} className={`flex items-center gap-1.5 text-xs ${p.id === myPeerId ? "text-amber-300" : "text-zinc-300"}`}>
              <span className="text-base leading-none">{p.avatar}</span>
              <span className="truncate max-w-[7rem]">{p.name}</span>
              {p.isHost && <span className="text-[9px] text-zinc-500">hôte</span>}
              {isShooter && <span className="text-[9px] text-amber-400 font-bold">tire</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PhaseCard({ state }: { state: GameState }) {
  const phaseLabel = PHASE_LABEL[state.phase] ?? state.phase;
  return (
    <div className={`h-full px-3 py-3 rounded-2xl border text-xs font-bold tracking-wide flex flex-col items-center justify-center text-center min-w-[7.5rem] ${
      state.foulMessage
        ? "border-rose-500/40 bg-rose-950/30 text-rose-300"
        : "border-zinc-800 bg-zinc-900/50 text-zinc-300"
    }`}>
      <span className="uppercase text-[10px] text-zinc-500 mb-1">Phase</span>
      <span>{phaseLabel}</span>
      {state.foulMessage && (
        <span className="mt-1.5 font-normal text-[10px] leading-snug text-rose-300/90">{state.foulMessage}</span>
      )}
    </div>
  );
}

interface ScoreboardProps {
  state: GameState;
  myPeerId: string | null;
}

/** Top bar: Team 1 | phase | Team 2 (+ spectators strip if any). */
export function Scoreboard({ state, myPeerId }: ScoreboardProps) {
  const solids = state.players.filter((p) => p.team === "SOLIDS");
  const stripes = state.players.filter((p) => p.team === "STRIPES");
  const spectators = state.players.filter((p) => p.team === null);

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] gap-3 items-stretch">
        <TeamCard team="SOLIDS" players={solids} state={state} myPeerId={myPeerId} compact />
        <PhaseCard state={state} />
        <TeamCard team="STRIPES" players={stripes} state={state} myPeerId={myPeerId} compact />
      </div>
      {spectators.length > 0 && (
        <div className="px-3 py-2 rounded-xl border border-zinc-800 bg-zinc-900/30 flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Spectateurs</span>
          {spectators.map((p) => (
            <span key={p.id} className="flex items-center gap-1.5 text-xs text-zinc-400">
              <span className="text-base leading-none">{p.avatar}</span> {p.name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export default Scoreboard;
