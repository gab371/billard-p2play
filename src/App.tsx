import { useState } from "react";
import type { PeerManagerLike } from "p2play-core";
import { useGame } from "./hooks/useGame";
import { Lobby } from "./components/game/Lobby";
import { PoolTable } from "./components/game/PoolTable";
import { Scoreboard } from "./components/game/Scoreboard";
import { LogConsole } from "./components/game/LogConsole";
import { SoundToggle } from "./components/ui/SoundToggle";
import { Send, FileText, X } from "lucide-react";

interface AppProps {
  isEmbedded?: boolean;
  externalPeerManager?: PeerManagerLike;
  playerName?: string;
  playerAvatar?: string;
  isHost?: boolean;
  lateJoin?: boolean;
  gameConfig?: any;
  hubPhase?: string;
  onExit?: () => void;
}

export default function App({ isEmbedded = false, externalPeerManager, playerName, playerAvatar, isHost, lateJoin, gameConfig, hubPhase, onExit }: AppProps) {
  const game = useGame({ externalPeerManager, isEmbedded, playerName, playerAvatar, isHost, lateJoin, gameConfig, hubPhase });
  const [chatInput, setChatInput] = useState("");
  const [showRules, setShowRules] = useState(false);

  const {
    myPeerId, hostPeerId, isHost: gameIsHost, chatMessages, gameState, status, error,
    amSpectator, isMyTurn, engineRef, lastFrame,
    hostRoom, joinRoom, toggleReady, startGame, assignTeam, placeCueBall, confirmPlacement, fireShot, setAim,
    sendChatMessage, disconnect,
  } = game;

  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    sendChatMessage(chatInput.trim());
    setChatInput("");
  };

  const showLobby = !gameState || gameState.phase === "LOBBY" || gameState.phase === "CONFIG";

  return (
    <div className="min-h-screen py-6 px-4 sm:px-6 lg:px-8 flex flex-col justify-between">
      <header className="max-w-7xl mx-auto w-full flex items-center justify-between mb-6 pb-4 border-b border-zinc-900">
        <div className="flex items-center gap-2">
          <span className="text-2xl leading-none" aria-hidden>🎱</span>
          <span className="text-xl font-black bg-gradient-to-r from-amber-400 to-yellow-500 bg-clip-text text-transparent tracking-tight">
            P2PLAY BILLARDS
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => setShowRules(true)} className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-zinc-100 rounded-full border border-zinc-800 font-bold transition-all" title="Règles">
            <FileText className="w-3.5 h-3.5" /><span>Règles</span>
          </button>
          <SoundToggle className="bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-zinc-100 border-zinc-800" />
          {gameState && gameState.phase !== "LOBBY" && gameState.phase !== "CONFIG" && (
            <>
              <span className="text-xs text-zinc-400 font-mono bg-zinc-900 px-3 py-1.5 rounded-full border border-zinc-800">
                Salon : <span className="text-amber-400 font-bold">{hostPeerId}</span>
              </span>
              <button type="button" onClick={isEmbedded && onExit && gameIsHost ? onExit : disconnect} className="text-xs px-2.5 py-1.5 bg-rose-950/20 hover:bg-rose-900/20 text-rose-400 border border-rose-900/30 rounded-xl transition-all font-bold" title={isEmbedded ? (gameIsHost ? "Retour au Hub" : "Quitter le Hub (la partie continue)") : "Quitter"}>
                {isEmbedded ? (gameIsHost ? "← Hub" : "Quitter") : "Quitter"}
              </button>
            </>
          )}
        </div>
      </header>

      <main className="flex-1 w-full max-w-7xl mx-auto">
        {showLobby ? (
          <Lobby
            myPeerId={myPeerId}
            hostPeerId={hostPeerId}
            isHost={gameIsHost}
            players={gameState?.players || []}
            spectatorLocks={gameState?.spectatorLocks || {}}
            status={status}
            error={error}
            isEmbedded={isEmbedded}
            hostRoom={hostRoom}
            joinRoom={joinRoom}
            toggleReady={toggleReady}
            startGame={startGame}
            assignTeam={assignTeam}
            onLockSpectator={game.lockSpectator}
            disconnect={disconnect}
            onExit={onExit}
          />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-4 lg:grid-rows-[auto_1fr] gap-4 items-start">
            <div className="lg:col-span-3">
              <Scoreboard state={gameState!} myPeerId={myPeerId} />
            </div>
            <aside className="relative z-20 lg:row-span-2 space-y-4 order-3 lg:order-none">
              <div className="h-[220px]"><LogConsole logs={gameState!.logs} /></div>
              <div className="bg-zinc-950/45 backdrop-blur-md border border-zinc-700/60 rounded-3xl p-4 shadow-xl flex flex-col h-[220px]">
                <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-2">Tchat</h3>
                <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 scrollbar-thin">
                  {chatMessages.map((msg, i) => (
                    <div key={i} className="text-xs"><span className="font-bold text-zinc-300">{msg.sender} : </span><span className="text-zinc-400">{msg.text}</span></div>
                  ))}
                  {chatMessages.length === 0 && <div className="text-zinc-600 text-center py-6 text-xs">Aucun message.</div>}
                </div>
                <form onSubmit={handleSendChat} className="flex gap-2 mt-2">
                  <input value={chatInput} onChange={(e) => setChatInput(e.target.value)} placeholder="Message…" className="flex-1 px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-850 focus:border-amber-500 text-xs text-zinc-200 outline-none" />
                  <button type="submit" className="w-8 h-8 flex items-center justify-center bg-amber-600 hover:bg-amber-500 text-zinc-900 rounded-xl"><Send className="w-3.5 h-3.5" /></button>
                </form>
              </div>
            </aside>
            <div className="lg:col-span-3 space-y-4 order-2 lg:order-none relative z-0 overflow-visible">
              <PoolTable
                state={gameState!}
                isMyTurn={isMyTurn}
                amSpectator={amSpectator}
                isHost={gameIsHost}
                engineRef={engineRef}
                lastFrame={lastFrame}
                onFire={fireShot}
                onPlaceCueBall={placeCueBall}
                onConfirmPlacement={confirmPlacement}
                onAim={setAim}
              />
              {gameState!.phase === "GAME_OVER" && (
                <div className="p-5 rounded-2xl bg-zinc-900/70 border border-amber-500/40 text-center">
                  <div className="text-2xl font-black text-amber-400">
                    Équipe {gameState!.winnerTeam === "SOLIDS" ? "Team 1" : "Team 2"}
                    {gameState!.teamGroups[gameState!.winnerTeam!] === "SOLIDS"
                      ? " (Pleines)"
                      : gameState!.teamGroups[gameState!.winnerTeam!] === "STRIPES"
                      ? " (Rayées)"
                      : ""}{" "}
                    gagne !
                  </div>
                  {gameIsHost ? (
                    <button type="button" onClick={isEmbedded && onExit ? onExit : disconnect} className="mt-3 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-zinc-900 font-bold rounded-xl">Revenir au salon</button>
                  ) : (
                    <p className="mt-3 text-xs text-zinc-400">En attente de l'hôte pour relancer une partie…</p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      <footer className="max-w-7xl mx-auto w-full text-center text-[10px] text-zinc-600 py-4 px-4 border-t border-zinc-900 mt-6">
        P2Play Billards - Réseau Privé Peer-to-Peer - Version v0.1.0
      </footer>

      {showRules && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/90 backdrop-blur-md">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 w-full max-w-2xl text-zinc-100 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button type="button" onClick={() => setShowRules(false)} className="absolute top-4 right-4 text-zinc-400 hover:text-zinc-200"><X className="w-5 h-5" /></button>
            <h2 className="text-2xl font-black text-amber-400 mb-4 border-b border-zinc-800 pb-2">Règles : P2Play Billards</h2>
            <div className="space-y-3 text-sm text-zinc-300 leading-relaxed">
              <p><strong className="text-amber-400">Équipes.</strong> Deux équipes s'affrontent : <b>Team 1</b> et <b>Team 2</b>. Après la cassure, chaque équipe reçoit les <b>Pleines</b> (1-7) ou les <b>Rayées</b> (9-15). Plusieurs joueurs par équipe, rotation des tireurs.</p>
              <p><strong className="text-amber-400">But.</strong> Empocher toutes les billes de son groupe, puis la 8 noire pour gagner.</p>
              <p><strong className="text-amber-400">Cassure.</strong> Placez la blanche derrière la ligne de tête (kitchen), puis cassez le triangle. Le groupe est déterminé à la première bille légalement empochée <b>après</b> la cassure.</p>
              <p><strong className="text-amber-400">Tour.</strong> Empochez légalement une bille de votre groupe → votre équipe rejoue. Sinon, le tour passe.</p>
              <p><strong className="text-amber-400">Fautes.</strong> Blanche empochée, aucune bille touchée, ou bille adverse touchée en premier → bille en main pour l'adversaire.</p>
              <p><strong className="text-amber-400">Victoire/Défaite.</strong> Empocher la 8 après son groupe = victoire. Empocher la 8 trop tôt ou avec une faute = défaite.</p>
              <p><strong className="text-amber-400">Contrôles.</strong> Mode Standard : clic droit pour viser, clic gauche pour charger/tirer. Mode Survol : le pointeur vise, clic gauche charge. Mode Barre : clic droit pour viser, réglez la force sur la barre (haut = fort), puis bouton Tirer. Effet : cliquez la petite bille blanche à gauche pour ouvrir le sélecteur (où frapper la blanche). Bille en main : déplacez le curseur pour placer (sans bouton).</p>
              <p><strong className="text-amber-400">Spectateurs.</strong> Joueurs sans équipe : vue lecture-seule (visée partagée).</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
