import { useEffect, useRef, useState, useCallback } from "react";
import { PeerManager } from "../network/peerManager";
import type { GameState, ShotFrame } from "../core/types";
import type { ChatMessage } from "../network/protocol";
import { soundManager } from "../core/soundFX";

interface UsePeerOptions {
  externalPeerManager?: any;
}

export function usePeer(options?: UsePeerOptions) {
  const peerManagerRef = useRef<PeerManager | null>(null);
  const ext = options?.externalPeerManager;
  const [myPeerId, setMyPeerId] = useState<string | null>(ext?.myPeerId || null);
  const [hostPeerId, setHostPeerId] = useState<string | null>(ext?.hostPeerId || ext?.roomId || null);
  const [isHost, setIsHost] = useState<boolean>(ext?.isHost || false);
  const [connectedPeers, setConnectedPeers] = useState<string[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [lastFrame, setLastFrame] = useState<ShotFrame | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<"IDLE" | "CONNECTING" | "CONNECTED" | "DISCONNECTED">(
    ext ? "CONNECTED" : "IDLE",
  );

  if (!peerManagerRef.current) {
    peerManagerRef.current = options?.externalPeerManager || new PeerManager();
  }
  const peerManager = peerManagerRef.current as PeerManager;

  useEffect(() => {
    peerManager.onStateReceived = (state: GameState) => setGameState(state);
    peerManager.onShotFrame = (frame: ShotFrame) => setLastFrame(frame);
    peerManager.onChatReceived = (msg: ChatMessage) => {
      setChatMessages((prev) => [...prev, msg]);
      soundManager.playPing();
    };
    peerManager.onAudioReceived = (sfx: string, intensity?: number) => {
      switch (sfx) {
        case "cue": soundManager.playCue(intensity ?? 1); break;
        case "clack": soundManager.playClack(intensity ?? 0.5); break;
        case "cushion": soundManager.playCushion(intensity ?? 0.5); break;
        case "pocket": soundManager.playPocket(); break;
        case "foul": soundManager.playFoul(); break;
        case "victory": soundManager.playVictory(); break;
        case "defeat": soundManager.playDefeat(); break;
        case "click": soundManager.playClick(); break;
        case "ping": soundManager.playPing(); break;
      }
    };
    peerManager.onPeerStatusChange = (peerId: string, peerStatus: "CONNECTED" | "DISCONNECTED") => {
      if (peerStatus === "CONNECTED") setConnectedPeers((prev) => [...new Set([...prev, peerId])]);
      else setConnectedPeers((prev) => prev.filter((id) => id !== peerId));
    };
    return () => {
      peerManager.onStateReceived = null;
      peerManager.onShotFrame = null;
      peerManager.onChatReceived = null;
      peerManager.onAudioReceived = null;
      peerManager.onPeerStatusChange = null;
    };
  }, [peerManager]);

  const hostGame = useCallback(async (customRoomId?: string): Promise<string> => {
    setStatus("CONNECTING");
    try {
      const id = await peerManager.initHost(customRoomId || null);
      setMyPeerId(id); setHostPeerId(id); setIsHost(true);
      setStatus("CONNECTED"); setError(null);
      return id;
    } catch (err: any) {
      setError(err?.message || "Impossible de créer le salon.");
      setStatus("DISCONNECTED");
      throw err;
    }
  }, [peerManager]);

  const joinGame = useCallback(async (roomId: string): Promise<string> => {
    setStatus("CONNECTING");
    try {
      const id = await peerManager.initClient(roomId);
      setMyPeerId(id); setHostPeerId(roomId); setIsHost(false);
      setStatus("CONNECTED"); setError(null);
      return id;
    } catch (err: any) {
      setError(err?.message || "Impossible de rejoindre le salon.");
      setStatus("DISCONNECTED");
      throw err;
    }
  }, [peerManager]);

  const sendAction = useCallback((actionName: string, payload: any) => {
    peerManager.sendToHost("ACTION", { actionName, playerId: myPeerId, payload });
  }, [peerManager, myPeerId]);

  const sendChat = useCallback((senderName: string, text: string) => {
    peerManager.sendChat(senderName, text);
  }, [peerManager]);

  const playSfx = useCallback((sfx: string, intensity?: number) => {
    peerManager.sendAudio(sfx, intensity);
  }, [peerManager]);

  const disconnect = useCallback(() => {
    peerManager.disconnect();
    setMyPeerId(null); setHostPeerId(null); setIsHost(false);
    setConnectedPeers([]); setChatMessages([]); setGameState(null); setLastFrame(null);
    setStatus("IDLE");
  }, [peerManager]);

  return {
    myPeerId, hostPeerId, isHost, connectedPeers, chatMessages,
    gameState, lastFrame, status, error,
    hostGame, joinGame, sendAction, sendChat, playSfx, disconnect,
    peerManager: peerManager as PeerManager,
  };
}
