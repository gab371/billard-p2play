import { useState } from "react";
import type { PeerManagerLike } from "p2play-core";
import { RoomCodeBadge } from "p2play-core";
import { TextChatPanel } from "p2play-core/chat";
import { useGame } from "./hooks/useGame";
import { Lobby } from "./components/game/Lobby";
import { PoolTable } from "./components/game/PoolTable";
import { Scoreboard } from "./components/game/Scoreboard";
import { LogConsole } from "./components/game/LogConsole";
import { SoundToggle } from "p2play-core/ui";
import { soundManager } from "./core/soundFX";
import { RulesModal } from "./components/game/RulesModal";

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
  const [showRules, setShowRules] = useState(false);

  const {
    myPeerId, hostPeerId, isHost: gameIsHost, chatMessages, gameState, status, error,
    amSpectator, isMyTurn, engineRef, lastFrame,
    hostRoom, joinRoom, toggleReady, startGame, assignTeam, placeCueBall, confirmPlacement, fireShot, setAim, setCall, setPushOut,
    sendChatMessage, disconnect,
  } = game;

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
            <span>Règles</span>
          </button>
          <SoundToggle soundManager={soundManager} className="bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-zinc-100 border-zinc-800" />
          {gameState && gameState.phase !== "LOBBY" && gameState.phase !== "CONFIG" && (
            <>
              {hostPeerId && <RoomCodeBadge code={hostPeerId} accentClassName="text-amber-400" />}
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
            variantId={gameState?.config?.variantId}
            caromMode={gameState?.config?.caromMode}
            status={status}
            error={error}
            isEmbedded={isEmbedded}
            hostRoom={hostRoom}
            joinRoom={joinRoom}
            toggleReady={toggleReady}
            startGame={startGame}
            assignTeam={assignTeam}
            onLockSpectator={game.lockSpectator}
            onChangeConfig={game.changeConfig}
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
              <TextChatPanel
                messages={chatMessages}
                onSend={sendChatMessage}
                title="Tchat"
                placeholder="Message…"
                emptyLabel="Aucun message."
                className="bg-zinc-950/45 backdrop-blur-md border border-zinc-700/60 rounded-3xl p-4 shadow-xl flex flex-col h-[220px] text-xs text-zinc-100 font-sans"
                scrollbarAccent="emerald"
              />
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
                onSetCall={setCall}
                onSetPushOut={setPushOut}
              />
              {gameState!.phase === "GAME_OVER" && (
                <div className="p-5 rounded-2xl bg-zinc-900/70 border border-amber-500/40 text-center">
                  <div className="text-2xl font-black text-amber-400">
                    {`Équipe ${gameState!.winnerTeam === "SOLIDS" ? "Team 1" : "Team 2"} gagne !`}
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

      <footer className="max-w-7xl mx-auto w-full text-center text-[10px] text-zinc-600 py-6 px-4 border-t border-zinc-900 flex justify-between items-center mt-8">
        <div>
          P2Play Billards - Réseau Privé Peer-to-Peer - Version v0.3.0
        </div>
        <a
          href="https://github.com/gab371/billard-p2play"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 hover:text-amber-500 transition-colors"
        >
          <svg
            className="w-3.5 h-3.5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
            <path d="M9 18c-4.51 2-5-2-7-2" />
          </svg>
          <span>Dépôt GitHub</span>
        </a>
      </footer>

      <RulesModal open={showRules} config={gameState?.config} onClose={() => setShowRules(false)} />
    </div>
  );
}
