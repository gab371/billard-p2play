import { useState } from "react";
import { Badge, Button } from "p2play-core/ui";
import { CopyRoomLinkButton } from "p2play-core";
import { cn } from "@/lib/utils";
import type { GameConfig, Player, TeamId } from "../../core/types";
import type { VariantId, CaromMode } from "../../core/variants";
import { getVariant, VARIANT_FAMILIES, VARIANTS, CAROM_MODES } from "../../core/variants";

/** Reset shadcn Button chrome so amber selection styles can win (incl. dark:). */
const PICKER_BTN_RESET =
  "h-auto min-h-0 gap-1.5 rounded-xl border-2 border-transparent bg-transparent px-0 py-0 shadow-none " +
  "hover:bg-transparent hover:text-inherit dark:hover:bg-transparent " +
  "focus-visible:border-transparent focus-visible:ring-0";

function VariantPicker({
  variantId,
  caromMode = "LIBRE",
  isHost,
  onChange,
}: {
  variantId: VariantId;
  caromMode?: CaromMode;
  isHost: boolean;
  onChange?: (config: Partial<GameConfig>) => void;
}) {
  const active = getVariant(variantId);
  return (
    <div className="bg-zinc-950/40 border border-zinc-800 rounded-2xl p-4 mb-6 flex flex-col gap-3">
      <div className="text-xs text-amber-500 font-bold uppercase tracking-widest">Variante</div>
      {isHost ? (
        <>
          {VARIANT_FAMILIES.map((fam) => (
            <div key={fam.family}>
              <div className="text-[11px] text-zinc-500 font-bold uppercase mb-1.5">{fam.label}</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {fam.ids.map((optionId) => {
                  const variantDef = VARIANTS[optionId];
                  const selected = variantId === optionId;
                  return (
                    <Button
                      key={optionId}
                      type="button"
                      variant="ghost"
                      onClick={() => onChange?.({ variantId: optionId, ...(optionId === "FR_CAROM" ? { caromMode: caromMode || "LIBRE" } : {}) })}
                      aria-pressed={selected}
                      className={cn(
                        PICKER_BTN_RESET,
                        "w-full text-left justify-start p-3 whitespace-normal",
                        selected
                          ? "border-amber-500 bg-amber-500/15 dark:border-amber-500 dark:bg-amber-500/15"
                          : "border-zinc-800 bg-zinc-900 hover:border-zinc-700 dark:border-zinc-800 dark:bg-zinc-900",
                      )}
                    >
                      <span className="flex flex-col gap-0.5">
                        <span className="text-sm font-bold text-zinc-100">{variantDef.shortName}</span>
                        <span className="text-[11px] text-zinc-400 leading-snug font-normal">{variantDef.description}</span>
                      </span>
                    </Button>
                  );
                })}
              </div>
            </div>
          ))}
          {variantId === "FR_CAROM" && (
            <div>
              <div className="text-[11px] text-zinc-500 font-bold uppercase mb-1.5">Mode carambole</div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {CAROM_MODES.map((m) => {
                  const selected = caromMode === m.id;
                  return (
                    <Button
                      key={m.id}
                      type="button"
                      variant="ghost"
                      onClick={() => onChange?.({ caromMode: m.id })}
                      aria-pressed={selected}
                      className={cn(
                        PICKER_BTN_RESET,
                        "w-full text-left justify-start p-2.5 whitespace-normal",
                        selected
                          ? "border-amber-500 bg-amber-500/15 dark:border-amber-500 dark:bg-amber-500/15"
                          : "border-zinc-800 bg-zinc-900 hover:border-zinc-700 dark:border-zinc-800 dark:bg-zinc-900",
                      )}
                    >
                      <span className="flex flex-col gap-0.5">
                        <span className="text-xs font-bold text-zinc-100">{m.label}</span>
                        <span className="text-[10px] text-zinc-500 leading-snug font-normal">{m.hint}</span>
                      </span>
                    </Button>
                  );
                })}
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="text-zinc-200 font-semibold bg-zinc-900 p-2.5 rounded-xl border border-zinc-800 text-sm">
          Actif : {active.name}
          {variantId === "FR_CAROM" && (
            <span className="text-zinc-400 font-normal">
              {" "}— {CAROM_MODES.find((m) => m.id === caromMode)?.label ?? "Partie libre"}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function CopyButton({ code }: { code: string | null }) {
  if (!code) return null;
  return <CopyRoomLinkButton code={code} className="bg-zinc-800/60 hover:bg-zinc-700 text-zinc-300" />;
}

function TeamButtons({ player, isHost, myPeerId, assignTeam, locked, onLockSpectator }: {
  player: Player; isHost: boolean; myPeerId: string | null;
  assignTeam: (id: string, t: TeamId | null) => void;
  locked: boolean; onLockSpectator?: (id: string, locked: boolean) => void;
}) {
  const isMe = player.id === myPeerId;
  const isSpectator = player.team === null;

  const canSelfAssign = isMe && !player.isHost && (isSpectator ? !locked : true);
  const hostCanForceSpectator = isHost && !player.isHost;
  const hostCanEditTeam = isHost && !player.isHost && !isSpectator;

  if (!canSelfAssign && !hostCanForceSpectator && !hostCanEditTeam && !(isHost && player.isHost)) {
    return (
      <span className="text-xs text-zinc-400">
        {player.team === "SOLIDS" ? "Team 1" : player.team === "STRIPES" ? "Team 2" : `Spectateur${locked ? " 🔒" : ""}`}
      </span>
    );
  }

  const showTeamBtns = (isHost && player.isHost) || canSelfAssign || hostCanEditTeam;
  const showSpectatorBtn = canSelfAssign || hostCanForceSpectator || (isHost && player.isHost);

  const btn = (t: TeamId | null, label: string, enabled: boolean) => {
    const selected = player.team === t;
    return (
      <Button
        type="button"
        size="xs"
        variant="ghost"
        disabled={!enabled}
        onClick={() => assignTeam(player.id, t)}
        aria-pressed={selected}
        className={cn(
          "h-auto min-h-0 rounded-lg border px-2.5 py-1 shadow-none",
          "hover:bg-transparent hover:text-inherit dark:hover:bg-transparent focus-visible:ring-0",
          selected
            ? "border-amber-400 bg-amber-600 text-zinc-900 hover:bg-amber-600 dark:border-amber-400 dark:bg-amber-600 dark:text-zinc-900"
            : "border-zinc-800 bg-zinc-900 text-zinc-300 hover:border-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300",
          !enabled && "opacity-40",
        )}
      >
        {label}
      </Button>
    );
  };

  return (
    <div className="flex gap-1.5 items-center">
      {showTeamBtns && btn("SOLIDS", "Team 1", !(locked && isSpectator))}
      {showTeamBtns && btn("STRIPES", "Team 2", !(locked && isSpectator))}
      {showSpectatorBtn && btn(null, "Spectateur", true)}
      {isHost && !player.isHost && (
        <Button
          type="button"
          size="xs"
          variant="ghost"
          title={locked ? "Déverrouiller" : "Forcer & verrouiller en spectateur"}
          onClick={() => onLockSpectator?.(player.id, !locked)}
          className={cn(
            "h-auto min-h-0 rounded-lg border px-2 py-1 shadow-none hover:bg-transparent dark:hover:bg-transparent focus-visible:ring-0",
            locked
              ? "border-rose-500/40 bg-rose-500/20 text-rose-300 dark:border-rose-500/40 dark:bg-rose-500/20"
              : "border-zinc-800 bg-zinc-900 text-zinc-500 hover:text-zinc-300 dark:border-zinc-800 dark:bg-zinc-900",
          )}
        >
          {locked ? "🔒" : "🔓"}
        </Button>
      )}
    </div>
  );
}

export interface LobbyRoomProps {
  hostPeerId: string | null;
  isHost: boolean;
  players: Player[];
  myPeerId: string | null;
  isEmbedded?: boolean;
  spectatorLocks?: { [peerId: string]: boolean };
  variantId?: VariantId;
  caromMode?: CaromMode;
  assignTeam: (id: string, t: TeamId | null) => void;
  onLockSpectator?: (id: string, locked: boolean) => void;
  onChangeConfig?: (config: Partial<GameConfig>) => void;
  startGame: () => void;
  toggleReady: (ready: boolean) => void;
  disconnect: () => void;
  onExit?: () => void;
}

/** Connected-room lobby: variant picker, teams, ready / start. */
export function LobbyRoom({
  hostPeerId, isHost, players, myPeerId, isEmbedded, spectatorLocks = {},
  variantId = "US_EIGHT", caromMode = "LIBRE", assignTeam, onLockSpectator, onChangeConfig,
  startGame, toggleReady, disconnect, onExit,
}: LobbyRoomProps) {
  const [localReady, setLocalReady] = useState(false);
  const solids = players.filter((p) => p.team === "SOLIDS").length;
  const stripes = players.filter((p) => p.team === "STRIPES").length;
  const canStart = solids > 0 || stripes > 0;
  const practice = (solids === 0 || stripes === 0) && canStart;

  const handleReady = () => {
    const next = !localReady;
    setLocalReady(next);
    toggleReady(next);
  };

  return (
    <div className="w-full max-w-2xl mx-auto p-6 bg-zinc-900/60 backdrop-blur-xl border border-zinc-800 rounded-3xl shadow-2xl relative overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
        <div className="flex items-center gap-2">
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-amber-400 to-yellow-500 bg-clip-text text-transparent">
            Salon : {hostPeerId}
          </h1>
          <CopyButton code={hostPeerId} />
        </div>
        <Badge variant="outline" className="bg-zinc-800 border-zinc-700 text-zinc-400 font-mono">
          {isHost ? "HÔTE" : "INVITÉ"}
        </Badge>
      </div>
      <p className="text-zinc-400 text-sm mb-4">Partagez ce code avec vos amis pour les inviter à jouer.</p>

      <VariantPicker variantId={variantId} caromMode={caromMode} isHost={isHost} onChange={onChangeConfig} />

      <div className="flex flex-col gap-4 mb-6">
        <h2 className="text-lg font-bold text-zinc-200">Joueurs connectés ({players.length})</h2>
        <div className="flex flex-col gap-2">
          {players.map((p) => (
            <div key={p.id} className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-2xl bg-zinc-800/40 border border-zinc-800">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{p.avatar}</span>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-zinc-100">{p.name}</span>
                  {p.id === myPeerId && <span className="text-xs text-amber-400">(Vous)</span>}
                  {p.isHost && (
                    <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20 text-[10px]">Hôte</Badge>
                  )}
                  {!p.isHost && p.isReady && (
                    <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[10px]">Prêt</Badge>
                  )}
                </div>
              </div>
              <TeamButtons player={p} isHost={isHost} myPeerId={myPeerId} assignTeam={assignTeam} locked={!!spectatorLocks[p.id]} onLockSpectator={onLockSpectator} />
            </div>
          ))}
        </div>
        {practice && (
          <p className="text-xs text-amber-400/80">Mode entraînement : une seule équipe est composée.</p>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-zinc-800/60">
        {!isHost && (
          <Button
            type="button"
            onClick={handleReady}
            className={`flex-1 h-auto py-3.5 px-6 rounded-2xl font-bold ${
              localReady ? "bg-amber-600 hover:bg-amber-500 text-zinc-950" : "bg-zinc-800 hover:bg-zinc-700 text-zinc-300"
            }`}
          >
            {localReady ? "Pas Prêt" : "Je suis Prêt !"}
          </Button>
        )}
        {isHost && (
          <Button
            type="button"
            onClick={startGame}
            disabled={!canStart}
            className="flex-1 h-auto py-3.5 px-6 rounded-2xl bg-gradient-to-r from-amber-400 to-yellow-500 hover:from-amber-300 hover:to-yellow-400 text-zinc-950 font-bold disabled:opacity-40 shadow-lg shadow-amber-500/20"
          >
            Lancer la partie ({players.length})
          </Button>
        )}
        <Button
          type="button"
          variant="outline"
          onClick={isEmbedded && onExit ? onExit : disconnect}
          className="h-auto py-3.5 px-6 rounded-2xl bg-zinc-800/40 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 border-zinc-800"
        >
          Quitter
        </Button>
      </div>
    </div>
  );
}
