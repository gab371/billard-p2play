// Core domain types for P2Play Billards. Pure data — no React, no network.

export interface Vec2 {
  x: number;
  y: number;
}

export type BallGroup = 'SOLIDS' | 'STRIPES' | 'CUE' | 'EIGHT';

export interface Ball {
  id: number;          // 0 = cue ball, 1-7 solids, 8 = eight, 9-15 stripes
  group: BallGroup;
  pos: Vec2;           // position in table units (meters)
  vel: Vec2;           // velocity in table units / second
  angle: number;       // accumulated roll angle (radians) for texture rotation
  pocketed: boolean;
  pocketIndex: number | null; // which pocket the ball fell into (-1 = none yet)
}

export type TeamId = 'SOLIDS' | 'STRIPES';

export interface Player {
  id: string;          // peerId
  name: string;
  avatar: string;
  isHost: boolean;
  isReady: boolean;
  team: TeamId | null; // null => spectator
  /** Index within the team's shooter rotation. */
  rotationIndex: number;
}

export type GamePhase =
  | 'LOBBY'
  | 'CONFIG'      // host is assigning teams (embedded pre-game config)
  | 'BREAKING'    // cue ball must break the rack
  | 'SHOOTING'    // a player is aiming / a shot is in progress
  | 'RESOLVING'   // balls still moving, host simulating
  | 'BALL_IN_HAND'// next shooter has ball-in-hand (after a foul)
  | 'GAME_OVER';

export interface GameLog {
  id: string;
  timestamp: string;
  message: string;
  type:
    | 'info'
    | 'system'
    | 'warning'
    | 'phase'
    | 'shot'
    | 'pocket'
    | 'foul'
    | 'success'
    | 'failure'
    | 'victory';
}

/** A snapshot of every ball, broadcast at high frequency during a shot. */
export interface ShotFrame {
  balls: Ball[];
  moving: boolean;
}

export interface ShotRequest {
  angle: number;   // radians, direction the cue ball is sent
  power: number;   // 0..1, normalized strike force
  spin: number;    // -1..1, side/top spin (reserved, currently unused)
}

export interface AimState {
  shooterId: string | null;
  angle: number;
  power: number;
}

export interface GameState {
  phase: GamePhase;
  players: Player[];
  balls: Ball[];
  activeTeam: TeamId | null;
  activeShooterId: string | null;
  /** Which group each team must clear. Assigned after the break or first legal pot. */
  teamGroups: Record<TeamId, BallGroup | null>;
  /** Remaining balls per group still on the table (excludes 8 and cue). */
  remaining: Record<BallGroup, number>;
  ballInHand: boolean;     // next shooter may place the cue ball anywhere
  foulMessage: string | null;
  logs: GameLog[];
  winnerTeam: TeamId | null;
  aim: AimState;
  /** Monotonic counter incremented each time a shot is fired (used as a replay id). */
  shotId: number;
  /** Host-locked spectators: a locked player cannot be assigned to a team. */
  spectatorLocks: { [peerId: string]: boolean };
}
