import { useEffect, useRef, useState, useCallback } from "react";
import { usePeer } from "./usePeer";
import { PoolGameEngine } from "../core/gameEngine";
import { sanitizeGameState, shotPayload } from "../network/protocol";
import type { NetworkMessage } from "../network/protocol";
import type { GameState, ShotRequest, TeamId, Ball } from "../core/types";
import { DT, FPS, STREAM_HZ } from "../core/constants";
import { registerEngineGetter } from "../testHooks";

interface UseGameOptions {
  externalPeerManager?: import("p2play-core").PeerManagerLike;
  playerName?: string;
  playerAvatar?: string;
  isEmbedded?: boolean;
  isHost?: boolean;
  lateJoin?: boolean;
  gameConfig?: any;
  hubPhase?: string;
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

  useEffect(() => {
    registerEngineGetter(() => gameEngineRef.current);
  }, []);

  const broadcastSanitizedStates = useCallback((engineState: GameState, overridePeerId?: string) => {
    const activePeerId = overridePeerId || myPeerId;
    if (!activePeerId) return;
    const sent = new Set<string>([activePeerId]);
    const resolveConn = (id: string) => {
      let conn = peerManager.connections.get(id);
      if (!conn) {
        for (const [peerId, connection] of peerManager.connections.entries()) {
          if (peerId.endsWith(id) || id.endsWith(peerId)) { conn = connection; break; }
        }
      }
      return conn;
    };
    const hostSanitized = sanitizeGameState(engineState, activePeerId);
    p2p.peerManager.onStateReceived?.(JSON.parse(JSON.stringify(hostSanitized)));
    engineState.players.forEach((p) => {
      if (p.id === activePeerId) return;
      const conn = resolveConn(p.id);
      if (conn?.open) {
        conn.send({ type: "STATE_UPDATE", state: sanitizeGameState(engineState, p.id) });
        sent.add(p.id);
      }
    });
    // Hub late-join: push state to any open peer not yet in the engine.
    peerManager.connections.forEach((conn, peerId) => {
      if (!conn.open || sent.has(peerId)) return;
      const alreadyKnown = engineState.players.some(
        (p) => p.id === peerId || peerId.endsWith(p.id) || p.id.endsWith(peerId),
      );
      if (alreadyKnown) return;
      conn.send({ type: "STATE_UPDATE", state: sanitizeGameState(engineState, peerId) });
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
        peerManager.broadcast({ type: "SHOT_FRAME", frame, shotId: engine.state.shotId });
      }
      if (!engine.isShooting()) {
        stopLoop();
        engine.finishShot();
        // Broadcast one final at-rest frame so clients snap to exact positions.
        peerManager.broadcast({
          type: "SHOT_FRAME",
          frame: { balls: engine.state.balls.map((b) => ({ ...b, vel: { ...b.vel } })), moving: false },
          shotId: engine.state.shotId,
        });
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

    peerManager.hostActionHandler = (_sender, rawMsg) => {
      const msg = rawMsg as NetworkMessage;
      if (msg.type !== "ACTION") return;
      const { actionName, playerId, payload } = msg;
      switch (actionName) {
        case "JOIN_GAME": engine.addPlayer(playerId, payload.name, payload.avatar, playerId === myPeerId); break;
        case "TOGGLE_READY": engine.setPlayerReady(playerId, payload.ready); break;
        case "START_GAME": if (playerId === myPeerId) engine.startGame(); break;
        case "ASSIGN_TEAM": {
          const targetId = payload.targetPlayerId as string;
          const team = payload.team as TeamId | null;
          const target = engine.state.players.find((p) => p.id === targetId);
          const isSelf = targetId === playerId;
          const requesterIsHost = playerId === myPeerId;
          // Self: any change (engine blocks locked → team).
          // Host on others: spectator only, or rebalance if already on a team — never promote spectator → team.
          if (isSelf) {
            engine.assignTeam(targetId, team);
          } else if (requesterIsHost) {
            if (team === null || (target && target.team !== null)) {
              engine.assignTeam(targetId, team);
            }
          }
          break;
        }
        case "LOCK_SPECTATOR":
          // Host-only. Lock = force spectator + prevent self-assign to a team.
          if (playerId === myPeerId) {
            const targetId = payload.peerId as string;
            const locked = !!payload.locked;
            if (locked) engine.assignTeam(targetId, null);
            engine.setSpectatorLock(targetId, locked);
          }
          break;
        case "SET_AIM": engine.setAim(playerId, payload.angle, payload.power); break;
        case "PLACE_CUE_BALL": engine.placeCueBall(playerId, payload.pos); break;
        case "CONFIRM_PLACEMENT": engine.confirmPlacement(playerId); break;
        case "REQUEST_BALL_IN_HAND": engine.requestBallInHand(playerId); break;
        case "FIRE_SHOT": {
          const s: ShotRequest = {
            angle: payload.angle,
            power: payload.power,
            spinSide: payload.spinSide ?? payload.spin ?? 0,
            spinTop: payload.spinTop ?? 0,
          };
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
      else if (peerStatus === "CONNECTED") broadcastSanitizedStates(engine.state);
    };

    return () => { stopLoop(); peerManager.hostActionHandler = null; peerManager.onPeerStatusChange = null; };
  }, [isHost, myPeerId, peerManager, playSfx, broadcastSanitizedStates, runShotLoop, stopLoop, options?.isEmbedded, options?.externalPeerManager, options?.playerName, options?.playerAvatar]);

  // Embedded guests must announce themselves to the host engine.
  useEffect(() => {
    if (!options?.isEmbedded || isHost || !myPeerId) return;
    const name = options.playerName || localPlayerName || "Joueur";
    const avatar = options.playerAvatar || localPlayerAvatar || "👤";
    const sendJoin = () => {
      peerManager.sendToHost("ACTION", {
        actionName: "JOIN_GAME",
        playerId: myPeerId,
        payload: { name, avatar },
      });
    };
    const t1 = window.setTimeout(sendJoin, 250);
    const t2 = window.setTimeout(sendJoin, 1000);
    const t3 = window.setTimeout(sendJoin, 2500);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
    };
  }, [
    options?.isEmbedded,
    options?.playerName,
    options?.playerAvatar,
    isHost,
    myPeerId,
    localPlayerName,
    localPlayerAvatar,
    peerManager,
  ]);

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
  const lockSpectator = useCallback((peerId: string, locked: boolean) => sendAction("LOCK_SPECTATOR", { peerId, locked }), [sendAction]);
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
    hostRoom, joinRoom, toggleReady, startGame, assignTeam, lockSpectator, setAim, placeCueBall, confirmPlacement, requestBallInHand, fireShot,
    sendChatMessage, disconnect, localPlayerName, localPlayerAvatar,
  };
}

export type UseGameReturn = ReturnType<typeof useGame>;
export type { Ball };
