import type { GameState, GamePhase, Player, TeamId, BallGroup } from "../../core/types";
import { getVariant } from "../../core/variants";
import { lowestObjectBall } from "../../core/rules";

const PHASE_LABEL: Partial<Record<GamePhase, string>> = {
  BREAKING: "Cassure",
  SHOOTING: "Tir",
  BALL_IN_HAND: "Bille en main",
  RESOLVING: "Résolution…",
  GAME_OVER: "Fin de partie",
};

const GROUP_LABEL: Partial<Record<BallGroup, string>> = {
  SOLIDS: "Pleines",
  STRIPES: "Rayées",
  RED: "Rouges",
  YELLOW: "Jaunes",
};

function teamTitle(team: TeamId, variantId: string): string {
  const variant = getVariant(variantId);
  if (variant.id === "EN_BLACKBALL") return team === "SOLIDS" ? "Team Rouge" : "Team Jaune";
  if (variant.id === "FR_CAROM") return team === "SOLIDS" ? "Team Blanc" : "Team Jaune";
  return team === "SOLIDS" ? "Team 1" : "Team 2";
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
  const variant = getVariant(state.config?.variantId);
  const group = state.teamGroups[team] as BallGroup | null;
  const assigned = group === "SOLIDS" || group === "STRIPES" || group === "RED" || group === "YELLOW";
  const remaining = assigned ? state.remaining[group] : null;
  const isActive = state.activeTeam === team && state.phase !== "GAME_OVER";
  const scoring = variant.id === "FR_CAROM" || variant.id === "US_STRAIGHT_14_1";
  const teamScore = state.teamScores?.[team] ?? 0;
  const nextObjectBall = lowestObjectBall(state);
  const ballNums =
    group === "SOLIDS" || group === "RED" ? [1, 2, 3, 4, 5, 6, 7]
    : group === "STRIPES" || group === "YELLOW" ? [9, 10, 11, 12, 13, 14, 15]
    : [];

  return (
    <div className={`rounded-2xl border transition-all ${compact ? "p-3" : "p-4"} ${
      isActive ? "bg-zinc-800/60 border-amber-500/50 ring-2 ring-amber-500/40" : "bg-zinc-900/40 border-zinc-800"
    }`}>
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <h3 className="text-sm font-bold text-zinc-200 flex items-center gap-1.5 min-w-0 flex-wrap">
          <span className="truncate">{teamTitle(team, variant.id)}</span>
          {assigned && group && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md border border-zinc-600 text-zinc-300">
              {GROUP_LABEL[group]}
            </span>
          )}
          {isActive && <span className="text-[10px] text-amber-400 shrink-0">à jouer</span>}
        </h3>
        {scoring && (
          <span className="text-sm font-mono text-amber-300 shrink-0">
            {teamScore}<span className="text-zinc-500 text-xs">/{variant.winTarget}</span>
          </span>
        )}
        {assigned && remaining != null && !scoring && (
          <span className="text-xs text-zinc-400 font-mono shrink-0">
            reste <b className="text-zinc-200">{remaining}</b>
          </span>
        )}
      </div>
      {(variant.id === "US_NINE" || variant.id === "US_TEN") && isActive && nextObjectBall != null && (
        <div className="mb-1.5 text-[10px] text-zinc-400">Prochaine bille : <b className="text-zinc-200">#{nextObjectBall}</b></div>
      )}
      {assigned && (
        <div className="flex flex-wrap gap-1 mb-2">
          {ballNums.map((ballNumber) => {
            const pocketed = !state.balls.some((ball) => ball.id === ballNumber && !ball.pocketed);
            return (
              <span key={ballNumber} className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[9px] font-bold border border-zinc-700 ${pocketed ? "opacity-25" : ""} ${
                group === "RED" ? "bg-red-500 text-white" : group === "YELLOW" ? "bg-yellow-400 text-zinc-900" : group === "SOLIDS" ? "bg-amber-400 text-zinc-900" : "bg-white text-zinc-900"
              }`}>{ballNumber}</span>
            );
          })}
        </div>
      )}
      {!assigned && variant.groups && (
        <div className="mb-2 text-[10px] text-zinc-600">Groupe à déterminer</div>
      )}
      <div className={`flex flex-wrap gap-x-3 gap-y-1 ${compact ? "" : "flex-col space-y-1"}`}>
        {players.length === 0 && <div className="text-[10px] text-zinc-600">Aucun joueur</div>}
        {players.map((player) => {
          const isShooter = state.activeShooterId === player.id && isActive;
          return (
            <div key={player.id} className={`flex items-center gap-1.5 text-xs ${player.id === myPeerId ? "text-amber-300" : "text-zinc-300"}`}>
              <span className="text-base leading-none">{player.avatar}</span>
              <span className="truncate max-w-[7rem]">{player.name}</span>
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
  const variant = getVariant(state.config?.variantId);
  const fouls = state.activeTeam ? state.consecutiveFouls?.[state.activeTeam] ?? 0 : 0;
  const showFouls = (variant.id === "US_NINE" || variant.id === "US_TEN" || variant.id === "US_STRAIGHT_14_1") && fouls > 0;
  return (
    <div className={`h-full px-3 py-3 rounded-2xl border text-xs font-bold tracking-wide flex flex-col items-center justify-center text-center min-w-[7.5rem] ${
      state.foulMessage
        ? "border-rose-500/40 bg-rose-950/30 text-rose-300"
        : "border-zinc-800 bg-zinc-900/50 text-zinc-300"
    }`}>
      <span className="uppercase text-[10px] text-zinc-500 mb-1">{variant.shortName}</span>
      {variant.id === "FR_CAROM" && (
        <span className="text-[10px] font-normal text-zinc-400 mb-1">
          {state.config.caromMode === "ONE_CUSHION" ? "1 bande"
            : state.config.caromMode === "THREE_CUSHION" ? "3 bandes"
            : "Partie libre"}
        </span>
      )}
      <span>{phaseLabel}</span>
      {state.freeShotsRemaining > 0 && (
        <span className="mt-1 font-normal text-[10px] text-sky-300">
          Free ×{state.freeShotsRemaining}{state.freeBall ? " + FB" : ""}
        </span>
      )}
      {showFouls && (
        <span className="mt-1 font-normal text-[10px] text-amber-400/90">Fautes : {fouls}/3</span>
      )}
      {state.pushOutAvailable && (
        <span className="mt-1 font-normal text-[10px] text-zinc-400">
          {state.pushOutDeclared ? "Push-out déclaré" : "Push-out dispo"}
        </span>
      )}
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

/** Always Team 1 | phase | Team 2 — every variant is team-vs-team. */
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
