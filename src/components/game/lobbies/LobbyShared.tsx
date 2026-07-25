import { useState } from "react";
import type { Player, TeamId } from "../../../core/types";

export const POOL_AVATARS = ["🎱", "🟠", "🟡", "🎯", "🤠", "👑", "🎩", "🎱"];

export interface LobbyProps {
  myPeerId: string | null;
  hostPeerId: string | null;
  isHost: boolean;
  players: Player[];
  spectatorLocks?: { [peerId: string]: boolean };
  status: string;
  error: string | null;
  isEmbedded?: boolean;
  hostRoom: (name: string, avatar: string) => void;
  joinRoom: (name: string, avatar: string, roomId: string) => void;
  toggleReady: (ready: boolean) => void;
  startGame: () => void;
  assignTeam: (playerId: string, team: TeamId | null) => void;
  onLockSpectator?: (peerId: string, locked: boolean) => void;
  disconnect: () => void;
  onExit?: () => void;
}

// --- Shared form pieces -----------------------------------------------------

export function AvatarGrid({ value, onChange, disabled }: {
  value: string; onChange: (a: string) => void; disabled?: boolean;
}) {
  return (
    <div className="grid grid-cols-8 gap-2 bg-zinc-950 p-2.5 rounded-2xl border border-zinc-800/60">
      {POOL_AVATARS.map((av) => (
        <button key={av} type="button" onClick={() => onChange(av)} disabled={disabled}
          className={`text-2xl p-1.5 rounded-xl transition-all flex items-center justify-center aspect-square ${
            value === av ? "bg-amber-500/20 border border-amber-500 scale-110" : "hover:bg-zinc-850"
          }`}>{av}</button>
      ))}
    </div>
  );
}

export function NameInput({ value, onChange, disabled }: {
  value: string; onChange: (s: string) => void; disabled?: boolean;
}) {
  return (
    <input type="text" placeholder="Entrez votre nom..." value={value} maxLength={14} disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      className="w-full px-4 py-3 rounded-2xl bg-zinc-950 border border-zinc-800 focus:border-amber-500 text-zinc-100 outline-none transition-all disabled:opacity-50" />
  );
}

export function CopyButton({ code }: { code: string | null }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    if (!code) return;
    const done = () => { setCopied(true); setTimeout(() => setCopied(false), 2000); };
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(code).then(done).catch(() => fallback(code, done));
    } else fallback(code, done);
  };
  const fallback = (text: string, done: () => void) => {
    const ta = document.createElement("textarea");
    ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.focus(); ta.select();
    try { document.execCommand("copy"); done(); } catch { /* ignore */ }
    document.body.removeChild(ta);
  };
  return (
    <button onClick={copy} title="Copier le code"
      className="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-xs font-bold transition-all flex items-center gap-1 border border-zinc-700">
      {copied ? "Copié !" : "Copier"}
    </button>
  );
}

function TeamButtons({ player, isHost, myPeerId, assignTeam, locked, onLockSpectator }: {
  player: Player; isHost: boolean; myPeerId: string | null;
  assignTeam: (id: string, t: TeamId | null) => void;
  locked: boolean; onLockSpectator?: (id: string, locked: boolean) => void;
}) {
  const isMe = player.id === myPeerId;
  const isSpectator = player.team === null;

  // Host may only force spectator on others (never promote spectator → team).
  // Guests may change themselves unless locked as spectator.
  const canSelfAssign = isMe && !player.isHost && (isSpectator ? !locked : true);
  const hostCanForceSpectator = isHost && !player.isHost;
  const hostCanEditTeam = isHost && !player.isHost && !isSpectator; // already playing: host may rebalance teams

  if (!canSelfAssign && !hostCanForceSpectator && !hostCanEditTeam && !(isHost && player.isHost)) {
    return (
      <span className="text-xs text-zinc-400">
        {player.team === "SOLIDS" ? "🟠 Pleines" : player.team === "STRIPES" ? "🟡 Rayées" : `👁️ Spectateur${locked ? " 🔒" : ""}`}
      </span>
    );
  }

  // Host editing self: full team controls (host is always a player).
  const showTeamBtns = (isHost && player.isHost) || canSelfAssign || hostCanEditTeam;
  const showSpectatorBtn = canSelfAssign || hostCanForceSpectator || (isHost && player.isHost);

  const btn = (t: TeamId | null, label: string, enabled: boolean) => (
    <button type="button" disabled={!enabled} onClick={() => assignTeam(player.id, t)}
      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all disabled:opacity-30 disabled:cursor-not-allowed ${
        player.team === t ? "bg-amber-600 border-amber-400 text-zinc-900" : "bg-zinc-900 border-zinc-800 text-zinc-300 hover:border-zinc-600"}`}>{label}</button>
  );

  return (
    <div className="flex gap-1.5 items-center">
      {showTeamBtns && btn("SOLIDS", "Pleines", !(locked && isSpectator))}
      {showTeamBtns && btn("STRIPES", "Rayées", !(locked && isSpectator))}
      {showSpectatorBtn && btn(null, "Spectateur", true)}
      {isHost && !player.isHost && (
        <button type="button" title={locked ? "Déverrouiller" : "Forcer & verrouiller en spectateur"} onClick={() => onLockSpectator?.(player.id, !locked)}
          className={`px-1.5 py-1 rounded-lg text-[11px] border transition-all ${locked ? "bg-rose-500/20 text-rose-300 border-rose-500/40" : "bg-zinc-900 text-zinc-500 border-zinc-800 hover:text-zinc-300"}`}>
          {locked ? "🔒" : "🔓"}
        </button>
      )}
    </div>
  );
}

// --- Shared connected (in-room) view ---------------------------------------

export interface RoomConnectedViewProps {
  hostPeerId: string | null;
  isHost: boolean;
  players: Player[];
  myPeerId: string | null;
  isEmbedded?: boolean;
  spectatorLocks?: { [peerId: string]: boolean };
  assignTeam: (id: string, t: TeamId | null) => void;
  onLockSpectator?: (id: string, locked: boolean) => void;
  startGame: () => void;
  toggleReady: (ready: boolean) => void;
  disconnect: () => void;
  onExit?: () => void;
}

export function RoomConnectedView({ hostPeerId, isHost, players, myPeerId, isEmbedded, spectatorLocks = {}, assignTeam, onLockSpectator, startGame, toggleReady, disconnect, onExit }: RoomConnectedViewProps) {
  const [localReady, setLocalReady] = useState(false);
  const solids = players.filter((p) => p.team === "SOLIDS").length;
  const stripes = players.filter((p) => p.team === "STRIPES").length;
  const canStart = solids > 0 || stripes > 0;
  const practice = solids === 0 || stripes === 0;

  const handleReady = () => {
    const next = !localReady;
    setLocalReady(next);
    toggleReady(next);
  };

  return (
    <div className="w-full max-w-2xl mx-auto p-6 bg-zinc-900/60 backdrop-blur-xl border border-zinc-800 rounded-3xl shadow-2xl relative overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-amber-400 to-yellow-500 bg-clip-text text-transparent">
            🎱 Salon : {hostPeerId}
          </h1>
          <CopyButton code={hostPeerId} />
        </div>
        <span className="px-3 py-1 bg-zinc-800 border border-zinc-700 rounded-full text-xs text-zinc-400 font-mono">
          {isHost ? "HÔTE" : "INVITÉ"}
        </span>
      </div>
      <p className="text-zinc-400 text-sm mb-6">Partagez ce code avec vos amis pour les inviter à jouer.</p>

      <div className="space-y-4 mb-6">
        <h2 className="text-lg font-bold text-zinc-200">Joueurs connectés ({players.length})</h2>
        <div className="space-y-2">
          {players.map((p) => (
            <div key={p.id} className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-2xl bg-zinc-800/40 border border-zinc-800">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{p.avatar}</span>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-zinc-100">{p.name}</span>
                  {p.id === myPeerId && <span className="text-xs text-amber-400">(Vous)</span>}
                  {p.isHost && <span className="text-[10px] px-2 py-0.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-full">Hôte</span>}
                  {!p.isHost && p.isReady && <span className="text-[10px] px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full">Prêt</span>}
                </div>
              </div>
              <TeamButtons player={p} isHost={isHost} myPeerId={myPeerId} assignTeam={assignTeam} locked={!!spectatorLocks[p.id]} onLockSpectator={onLockSpectator} />
            </div>
          ))}
        </div>
        {practice && canStart && (
          <p className="text-xs text-amber-400/80">⚠️ Mode entraînement : une seule équipe est composée. Ajoutez un joueur à l'autre équipe pour une vraie partie.</p>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-zinc-800/60">
        {!isHost && (
          <button onClick={handleReady}
            className={`flex-1 py-3.5 px-6 rounded-2xl font-bold transition-all ${localReady ? "bg-amber-600 hover:bg-amber-500 text-zinc-950" : "bg-zinc-800 hover:bg-zinc-700 text-zinc-300"}`}>
            {localReady ? "Pas Prêt" : "Je suis Prêt !"}
          </button>
        )}
        {isHost && (
          <button onClick={startGame} disabled={!canStart}
            className="flex-1 py-3.5 px-6 rounded-2xl bg-gradient-to-r from-amber-400 to-yellow-500 hover:from-amber-300 hover:to-yellow-400 text-zinc-950 font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-amber-500/20">
            Lancer la partie ({players.length})
          </button>
        )}
        <button onClick={isEmbedded && onExit ? onExit : disconnect}
          className="py-3.5 px-6 rounded-2xl bg-zinc-800/40 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 border border-zinc-850 font-medium transition-all">
          Quitter
        </button>
      </div>
    </div>
  );
}
