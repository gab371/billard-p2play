import type { GameState, ShotFrame, ShotRequest } from "../core/types";

export type MessageType =
  | "JOIN"
  | "STATE_UPDATE"
  | "SHOT_FRAME"
  | "ACTION"
  | "CHAT"
  | "AUDIO_EVENT";

export interface NetworkMessage {
  type: MessageType;
  [key: string]: any;
}

export interface ChatMessage extends NetworkMessage {
  type: "CHAT";
  sender: string;
  text: string;
  time: string;
}

export interface StateUpdateMessage extends NetworkMessage {
  type: "STATE_UPDATE";
  state: GameState;
}

export interface ShotFrameMessage extends NetworkMessage {
  type: "SHOT_FRAME";
  frame: ShotFrame;
  shotId: number;
}

export type ClientActionType =
  | "JOIN_GAME"
  | "TOGGLE_READY"
  | "START_GAME"
  | "ASSIGN_TEAM"
  | "LOCK_SPECTATOR"
  | "CHANGE_CONFIG"
  | "SET_CALL"
  | "SET_PUSH_OUT"
  | "SET_AIM"
  | "PLACE_CUE_BALL"
  | "CONFIRM_PLACEMENT"
  | "REQUEST_BALL_IN_HAND"
  | "FIRE_SHOT";

export interface ActionMessage extends NetworkMessage {
  type: "ACTION";
  actionName: ClientActionType;
  playerId: string;
  payload: any;
}

/**
 * Pool is a full-information game (no hidden hands), so the state needs no
 * per-player masking. We keep the sanitizer as a passthrough for symmetry with
 * the other P2Play games and as a future extension point.
 */
export function sanitizeGameState(state: GameState, _targetPlayerId: string): GameState {
  if (typeof structuredClone === "function") {
    return structuredClone(state);
  }
  return JSON.parse(JSON.stringify(state));
}

/** Helper to build a FIRE_SHOT payload. */
export function shotPayload(shot: ShotRequest): {
  angle: number; power: number; spinSide: number; spinTop: number;
} {
  return {
    angle: shot.angle,
    power: shot.power,
    spinSide: shot.spinSide,
    spinTop: shot.spinTop,
  };
}
