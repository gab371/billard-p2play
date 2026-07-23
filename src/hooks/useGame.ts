import { useEffect, useRef, useState, useCallback } from "react";
import { usePeer } from "./usePeer";
import { PoolGameEngine } from "../core/gameEngine";
import { sanitizeGameState, shotPayload } from "../network/protocol";
import type { NetworkMessage } from "../network/protocol";
import type { GameState, ShotRequest, TeamId, Ball } from "../core/types";
import { DT, FPS, STREAM_HZ } from "../core/constants";

interface UseGameOptions {
  externalPeerManager?: any;
  playerName?: string;
  playerAvatar?: string;
  isEmbedded?: boolean;
}

export function useGame(options?: UseGameOptions) {
  const p2p = usePeer(options);
  const {
    isHost, myPeerId, peerManager, playSfx, hostGame, joinGame,
    sendAction, sendChat, gameState, status, error, chatMessages, disconnect,
  } = p2p;

  const gameEngineRef = useRef<PoolGameEngine | null>(null);
  const loopRef = useRef<number | null>(null);
  const streamAccumRef = useRef<number>(0);
  const pendingShotRef = useRef<ShotRequest | null>(null);
  const victoryPlayedRef = useRef<boolean>(false);
  const [localPlayerName, setLocalPlayerName] = useState<string>(options?.playerName || "");
  const [localPlayerAvatar, setLocalPlayerAvatar] = useState<string>(options?.playerAvatar || "🎱");

  const broadcastSanitizedStates = useCallback((engineState: GameState, overridePeerId?: string) => {
    const activePeerId = overridePeerId || myPeerId;
    if (!activePeerId) return;
    const hostSanitized = sanitizeGameState(engineState, activePeerId);
    p2p.peerManager.onStateReceived?.(JSON.parse(JSON.stringify(hostSanitized)));
    engineState.players.forEach((p) => {
      if (p.id === activePeerId) return;
      let conn = peerManager.connections.get(p.id);
      if (!conn) {
        for (const [peerId, connection] of peerManager.connections.entries()) {
          if (peerId.endsWith(p.id) || p.id.endsWith(peerId)) { conn = connection; break; }
        }
      }
      if (conn?.open) conn.send({ type: "STATE_UPDATE", state: sanitizeGameState(engineState, p.id) });
    });
  }, [myPeerId, peerManager, p2p.peerManager]);

  const stopLoop = useCallback(() => {
    if (loopRef.current !== null) {
      clearInterval(loopRef.current);
      loopRef.current = null;
    }
  }, []);

  const runShotLoop = useCallback(() => {
    stopLoop();
    streamAccumRef.current = 0;
    const streamEvery = Math.max(1, Math.round(FPS / STREAM_HZ));
    let tickCount = 0;
    loopRef.current = window.setInterval(() => {
      const engine = gameEngineRef.current;
      if (!engine) { stopLoop(); return; }
      const events = engine.tick(DT);
      for (const e of events) {
        if (e.type === "clack") playSfx("clack", e.intensity);
        else if (e.type === "cushion") playSfx("cushion", e.intensity);
        else if (e.type === "pocket") playSfx("pocket");
      }
      tickCount++;
      if (tickCount % streamEvery === 0) {
        const frame = { balls: engine.state.balls.map((b) => ({ ...b, vel: { ...b.vel } })), moving: true };
        peerManager.broadcastShotFrame(frame, engine.state.shotId);
      }
      if (!engine.isShooting()) {
        stopLoop();
        engine.finishShot();
        // Broadcast one final at-rest frame so clients snap to exact positions.
        peerManager.broadcastShotFrame({ balls: engine.state.balls.map((b) => ({ ...b, vel: { ...b.vel } })), moving: false }, engine.state.shotId);
        broadcastSanitizedStates(engine.state);
        if (engine.state.phase === "GAME_OVER" && !victoryPlayedRef.current) {
          victoryPlayedRef.current = true;
          playSfx("victory");
        } else if (engine.state.phase !== "GAME_OVER") {
          victoryPlayedRef.current = false;
        }
        if (engine.state.foulMessage) playSfx("foul");
      }
    }, 1000 / FPS);
  }, [stopLoop, playSfx, peerManager, broadcastSanitizedStates]);

  // Host setup + embedded bypass (stay in CONFIG, NO auto-start: pool has a
  // pre-game team-assignment lobby).
  useEffect(() => {
    if (!isHost) { gameEngineRef.current = null; return; }
    if (!gameEngineRef.current) gameEngineRef.current = new PoolGameEngine();
    const engine = gameEngineRef.current;

    if (options?.isEmbedded && options?.externalPeerManager && engine.state.phase === "LOBBY") {
      setTimeout(() => {
        engine.state.players = [];
        engine.addPlayer(myPeerId!, options.playerName || "Hôte", options.playerAvatar || "🎱", true);
        if ((peerManager as any).lobbyPlayers) {
          (peerManager as any).lobbyPlayers.forEach((p: any) => {
            if (p.peerId && p.peerId !== myPeerId) {
              engine.addPlayer(p.peerId, p.username || `Joueur ${p.peerId.slice(0, 4)}`, p.avatar || "👤", false);
            }
          });
        }
        engine.state.phase = "CONFIG";
        broadcastSanitizedStates(engine.state);
      }, 0);
    }

    peerManager.hostActionHandler = (_sender: string, msg: NetworkMessage) => {
      if (msg.type !== "ACTION") return;
      const { actionName, playerId, payload } = msg;
      switch (actionName) {
        case "JOIN_GAME": engine.addPlayer(playerId, payload.name, payload.avatar, playerId === myPeerId); break;
        case "TOGGLE_READY": engine.setPlayerReady(playerId, payload.ready); break;
        case "START_GAME": if (playerId === myPeerId) engine.startGame(); break;
        case "ASSIGN_TEAM": engine.assignTeam(payload.targetPlayerId, payload.team); break;
        case "SET_AIM": engine.setAim(playerId, payload.angle, payload.power); break;
        case "PLACE_CUE_BALL": engine.placeCueBall(playerId, payload.pos); break;
        case "CONFIRM_PLACEMENT": engine.confirmPlacement(playerId); break;
        case "REQUEST_BALL_IN_HAND": engine.requestBallInHand(playerId); break;
        case "FIRE_SHOT": {
          const s: ShotRequest = { angle: payload.angle, power: payload.power, spin: payload.spin ?? 0 };
          engine.setAim(playerId, s.angle, s.power);
          const pre = engine.fireShot(playerId, s);
          if (pre.length === 0 && engine.state.phase === "RESOLVING") {
            pendingShotRef.current = s;
            playSfx("cue", s.power);
            runShotLoop();
          }
          break;
        }
      }
      broadcastSanitizedStates(engine.state);
    };

    peerManager.onPeerStatusChange = (peerId: string, peerStatus: "CONNECTED" | "DISCONNECTED") => {
      if (peerStatus === "DISCONNECTED") { engine.removePlayer(peerId); broadcastSanitizedStates(engine.state); }
    };

    return () => { stopLoop(); peerManager.hostActionHandler = null; peerManager.onPeerStatusChange = null; };
  }, [isHost, myPeerId, peerManager, playSfx, broadcastSanitizedStates, runShotLoop, stopLoop, options?.isEmbedded, options?.externalPeerManager, options?.playerName, options?.playerAvatar]);

  // Client triggers
  const hostRoom = useCallback(async (name: string, avatar: string) => {
    setLocalPlayerName(name); setLocalPlayerAvatar(avatar);
    const roomId = await hostGame();
    const engine = new PoolGameEngine();
    gameEngineRef.current = engine;
    engine.addPlayer(roomId, name, avatar, true);
    broadcastSanitizedStates(engine.state, roomId);
  }, [hostGame, broadcastSanitizedStates]);

  const joinRoom = useCallback(async (name: string, avatar: string, roomId: string) => {
    setLocalPlayerName(name); setLocalPlayerAvatar(avatar);
    const id = await joinGame(roomId);
    setTimeout(() => {
      peerManager.sendToHost("ACTION", { actionName: "JOIN_GAME", playerId: id, payload: { name, avatar } });
    }, 1000);
  }, [joinGame, peerManager]);

  const toggleReady = useCallback((ready: boolean) => sendAction("TOGGLE_READY", { ready }), [sendAction]);
  const startGame = useCallback(() => sendAction("START_GAME", {}), [sendAction]);
  const assignTeam = useCallback((playerId: string, team: TeamId | null) => sendAction("ASSIGN_TEAM", { team, targetPlayerId: playerId }), [sendAction]);
  const setAim = useCallback((angle: number, power: number) => sendAction("SET_AIM", { angle, power }), [sendAction]);
  const placeCueBall = useCallback((pos: { x: number; y: number }) => sendAction("PLACE_CUE_BALL", { pos }), [sendAction]);
  const confirmPlacement = useCallback(() => sendAction("CONFIRM_PLACEMENT", {}), [sendAction]);
  const requestBallInHand = useCallback(() => sendAction("REQUEST_BALL_IN_HAND", {}), [sendAction]);
  const fireShot = useCallback((shot: ShotRequest) => sendAction("FIRE_SHOT", shotPayload(shot)), [sendAction]);
  const sendChatMessage = useCallback((text: string) => sendChat(localPlayerName || "Joueur", text), [sendChat, localPlayerName]);

  const me = gameState?.players.find((p) => p.id === myPeerId);
  const amSpectator = !!gameState && (me?.team ?? null) === null;
  const isMyTurn = !!gameState && gameState.activeShooterId === myPeerId && !amSpectator;

  return {
    isHost, myPeerId, hostPeerId: p2p.hostPeerId, connectedPeers: p2p.connectedPeers,
    chatMessages, gameState, lastFrame: p2p.lastFrame, status, error,
    amSpectator, isMyTurn, engineRef: gameEngineRef,
    hostRoom, joinRoom, toggleReady, startGame, assignTeam, setAim, placeCueBall, confirmPlacement, requestBallInHand, fireShot,
    sendChatMessage, disconnect, localPlayerName, localPlayerAvatar,
  };
}

export type UseGameReturn = ReturnType<typeof useGame>;
export type { Ball };
