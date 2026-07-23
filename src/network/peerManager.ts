import Peer from "peerjs";
import type { DataConnection } from "peerjs";
import type { GameState, ShotFrame } from "../core/types";
import type { NetworkMessage, ChatMessage, MessageType } from "./protocol";

export class PeerManager {
  public peer: Peer | null = null;
  public connections: Map<string, DataConnection> = new Map();
  public isHost: boolean = false;
  public myPeerId: string | null = null;
  public hostPeerId: string | null = null;
  /** Lobby players exposed by the Hub's external peer manager. */
  public lobbyPlayers?: any[];

  // Callbacks
  public onStateReceived: ((state: GameState) => void) | null = null;
  public onShotFrame: ((frame: ShotFrame, shotId: number) => void) | null = null;
  public onChatReceived: ((msg: ChatMessage) => void) | null = null;
  public onAudioReceived: ((sfx: string, intensity?: number) => void) | null = null;
  public onPeerStatusChange: ((peerId: string, status: "CONNECTED" | "DISCONNECTED") => void) | null = null;
  public hostActionHandler: ((peerId: string, actionMsg: NetworkMessage) => void) | null = null;

  constructor() {}

  public generateRoomId(): string {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "";
    for (let i = 0; i < 5; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
    return code;
  }

  private namespaceId(id: string): string {
    const hostClean = window.location.host.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
    return `pool_${hostClean}_${id}`;
  }

  public initHost(customRoomId: string | null = null): Promise<string> {
    return new Promise((resolve, reject) => {
      const roomId = customRoomId || this.generateRoomId();
      this.isHost = true;
      this.hostPeerId = roomId;
      const namespacedRoomId = this.namespaceId(roomId);
      this.peer = new Peer(namespacedRoomId, { debug: 1 });
      this.peer.on("open", () => {
        this.myPeerId = roomId;
        this.hostPeerId = roomId;
        resolve(roomId);
      });
      this.peer.on("connection", (conn) => this.handleHostIncomingConnection(conn));
      this.peer.on("error", (err) => reject(err));
    });
  }

  public initClient(hostRoomId: string): Promise<string> {
    return new Promise((resolve, reject) => {
      this.isHost = false;
      this.hostPeerId = hostRoomId;
      this.peer = new Peer({ debug: 1 });
      this.peer.on("open", (id) => {
        this.myPeerId = id;
        if (!this.peer) return reject(new Error("Peer not initialized"));
        const conn = this.peer.connect(this.namespaceId(hostRoomId), { reliable: true });
        conn.on("open", () => {
          this.connections.set(hostRoomId, conn);
          this.setupClientConnectionListeners(conn);
          resolve(id);
        });
        conn.on("error", (err) => reject(err));
      });
      this.peer.on("error", (err) => reject(err));
    });
  }

  private handleHostIncomingConnection(conn: DataConnection): void {
    conn.on("open", () => {
      this.connections.set(conn.peer, conn);
      this.onPeerStatusChange?.(conn.peer, "CONNECTED");
    });
    conn.on("data", (data: any) => {
      const msg = data as NetworkMessage;
      if (!msg?.type) return;
      if (msg.type === "CHAT") {
        this.broadcast(msg);
        this.onChatReceived?.(msg as ChatMessage);
      } else if (msg.type === "AUDIO_EVENT") {
        this.broadcast(msg);
        this.onAudioReceived?.(msg.sfx, msg.intensity);
      } else {
        this.hostActionHandler?.(conn.peer, msg);
      }
    });
    conn.on("close", () => {
      this.connections.delete(conn.peer);
      this.onPeerStatusChange?.(conn.peer, "DISCONNECTED");
    });
  }

  private setupClientConnectionListeners(conn: DataConnection): void {
    conn.on("data", (data: any) => {
      const msg = data as NetworkMessage;
      if (!msg?.type) return;
      switch (msg.type) {
        case "STATE_UPDATE":
          this.onStateReceived?.(msg.state);
          break;
        case "SHOT_FRAME":
          this.onShotFrame?.(msg.frame, msg.shotId);
          break;
        case "CHAT":
          this.onChatReceived?.(msg as ChatMessage);
          break;
        case "AUDIO_EVENT":
          this.onAudioReceived?.(msg.sfx, msg.intensity);
          break;
      }
    });
  }

  public sendToHost(type: string, payload: any): void {
    if (this.isHost) {
      this.hostActionHandler?.(this.myPeerId!, { type, ...payload });
    } else if (this.hostPeerId) {
      const conn = this.connections.get(this.hostPeerId);
      if (conn?.open) conn.send({ type, ...payload });
    }
  }

  public broadcast(message: NetworkMessage): void {
    this.connections.forEach((conn) => {
      if (conn.open) conn.send(message);
    });
  }

  public broadcastShotFrame(frame: ShotFrame, shotId: number): void {
    this.broadcast({ type: "SHOT_FRAME", frame, shotId });
  }

  public sendAudio(sfx: string, intensity?: number): void {
    const msg = { type: "AUDIO_EVENT" as MessageType, sfx, intensity };
    if (this.isHost) {
      this.broadcast(msg);
      this.onAudioReceived?.(sfx, intensity);
    } else if (this.hostPeerId) {
      const conn = this.connections.get(this.hostPeerId);
      if (conn?.open) conn.send(msg);
    }
  }

  public sendChat(senderName: string, text: string): void {
    const chatMsg: ChatMessage = {
      type: "CHAT",
      sender: senderName,
      text,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };
    if (this.isHost) {
      this.broadcast(chatMsg);
      this.onChatReceived?.(chatMsg);
    } else if (this.hostPeerId) {
      const conn = this.connections.get(this.hostPeerId);
      if (conn?.open) conn.send(chatMsg);
    }
  }

  public disconnect(): void {
    this.connections.forEach((conn) => conn.close());
    this.connections.clear();
    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
    }
    this.myPeerId = null;
    this.hostPeerId = null;
    this.isHost = false;
  }
}
