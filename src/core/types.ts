// Core domain types for P2Play Billards. Pure data — no React, no network.

import type { VariantId } from "./variants";

export interface Vec2 {
  x: number;
  y: number;
}

export type BallGroup = "SOLIDS" | "STRIPES" | "CUE" | "EIGHT" | "RED" | "YELLOW" | "OBJECT";

export interface Ball {
  id: number;
  group: BallGroup;
  pos: Vec2;
  vel: Vec2;
  angle: number;
  pocketed: boolean;
  pocketIndex: number | null;
  spinTop: number;
  spinSide: number;
}

export type TeamId = "SOLIDS" | "STRIPES";

export interface Player {
  id: string;
  name: string;
  avatar: string;
  isHost: boolean;
  isReady: boolean;
  team: TeamId | null;
  rotationIndex: number;
  disconnected?: boolean;
}

export type GamePhase =
  | "LOBBY"
  | "CONFIG"
  | "BREAKING"
  | "SHOOTING"
  | "RESOLVING"
  | "BALL_IN_HAND"
  | "GAME_OVER";

export interface GameLog {
  id: string;
  timestamp: string;
  message: string;
  type:
    | "info"
    | "system"
    | "warning"
    | "phase"
    | "shot"
    | "pocket"
    | "foul"
    | "success"
    | "failure"
    | "victory";
}

export interface ShotFrame {
  balls: Ball[];
  moving: boolean;
}

export interface ShotRequest {
  angle: number;
  power: number;
  spinSide: number;
  spinTop: number;
}

export interface AimState {
  shooterId: string | null;
  angle: number;
  power: number;
}

export interface GameConfig {
  variantId: VariantId;
  /** French carom only — defaults to LIBRE. */
  caromMode?: import("./variants").CaromMode;
}

export interface PendingCall {
  ballId: number | null;
  pocketIndex: number | null;
  shooterId: string;
}

export interface GameState {
  phase: GamePhase;
  players: Player[];
  balls: Ball[];
  activeTeam: TeamId | null;
  activeShooterId: string | null;
  teamGroups: Record<TeamId, BallGroup | null>;
  remaining: Record<string, number>;
  ballInHand: boolean;
  foulMessage: string | null;
  logs: GameLog[];
  winnerTeam: TeamId | null;
  /** FFA winner (9-ball, 10-ball, carom, 14/1). */
  winnerPlayerId: string | null;
  aim: AimState;
  shotId: number;
  spectatorLocks: { [peerId: string]: boolean };
  config: GameConfig;
  pendingCall: PendingCall | null;
  scores: Record<string, number>;
  teamScores: Record<TeamId, number>;
  shooterOrder: string[];
  shooterIndex: number;
  /** Consecutive fouls per team (9/10/14.1 three-foul rule). */
  consecutiveFouls: Record<TeamId, number>;
  /** Blackball free shots remaining for the active team. */
  freeShotsRemaining: number;
  /** Blackball: free ball (any object legal as first contact). */
  freeBall: boolean;
  /** Cue must stay in kitchen/baulk when placing. */
  ballInHandKitchen: boolean;
  /** Next shot may be declared a push-out (9-ball, post-break). */
  pushOutAvailable: boolean;
  /** Current shot is a declared push-out. */
  pushOutDeclared: boolean;
}
