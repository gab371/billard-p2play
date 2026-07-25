import { describe, expect, it } from "vitest";
import { clampCuePlacement, evaluateShot, firstContact, overlapsAnyBall } from "./rules";
import { HEAD_STRING, TABLE_HEIGHT, TABLE_WIDTH, BALL_RADIUS } from "./constants";
import { dist, normalize, reflect } from "./geometry";
import { step, isMoving } from "./physics";
import { buildRack } from "./rack";
import type { Ball, GameState } from "./types";
import type { PhysicsEvent } from "./physics";

function baseState(over: Partial<GameState> = {}): GameState {
  return {
    phase: "SHOOTING",
    players: [],
    balls: buildRack(),
    activeTeam: "SOLIDS",
    activeShooterId: "p1",
    teamGroups: { SOLIDS: "SOLIDS", STRIPES: "STRIPES" },
    remaining: { SOLIDS: 7, STRIPES: 7, RED: 0, YELLOW: 0, EIGHT: 1, CUE: 1, OBJECT: 0 },
    ballInHand: false,
    foulMessage: null,
    logs: [],
    winnerTeam: null,
    winnerPlayerId: null,
    aim: { shooterId: null, angle: 0, power: 0 },
    shotId: 2,
    spectatorLocks: {},
    config: { variantId: "US_EIGHT" },
    pendingCall: null,
    scores: {},
    teamScores: { SOLIDS: 0, STRIPES: 0 },
    consecutiveFouls: { SOLIDS: 0, STRIPES: 0 },
    freeShotsRemaining: 0,
    freeBall: false,
    ballInHandKitchen: false,
    pushOutAvailable: false,
    pushOutDeclared: false,
    ...over,
  };
}

describe("geometry", () => {
  it("normalizes and reflects", () => {
    const n = normalize({ x: 3, y: 4 });
    expect(n.x).toBeCloseTo(0.6);
    expect(n.y).toBeCloseTo(0.8);
    const r = reflect({ x: 1, y: -1 }, { x: 0, y: 1 });
    expect(r.y).toBeCloseTo(1);
  });
});

describe("clampCuePlacement", () => {
  it("keeps cue behind head string in kitchen mode", () => {
    const pos = clampCuePlacement({ x: TABLE_WIDTH * 0.9, y: TABLE_HEIGHT / 2 }, "kitchen", []);
    expect(pos).not.toBeNull();
    expect(pos!.x).toBeLessThanOrEqual(HEAD_STRING);
  });

  it("does not leave cue overlapping object balls", () => {
    const balls = buildRack();
    const object = balls.find((b) => b.id === 1)!;
    const next = clampCuePlacement({ ...object.pos }, "table", balls);
    if (next) {
      expect(overlapsAnyBall(next, balls)).toBe(false);
    } else {
      // Packed rack may be unresolvable from dead-center — still illegal as-is.
      expect(overlapsAnyBall(object.pos, balls, 0)).toBe(true);
    }
  });

  it("allows free table placement after foul (non-kitchen)", () => {
    const pos = clampCuePlacement({ x: TABLE_WIDTH * 0.6, y: TABLE_HEIGHT / 2 }, "table", []);
    expect(pos!.x).toBeCloseTo(TABLE_WIDTH * 0.6);
  });
});

describe("evaluateShot", () => {
  it("fouls when cue touches nothing", () => {
    const state = baseState();
    const out = evaluateShot(state, [], [], false);
    expect(out.foul).toBe(true);
    expect(out.foulReason).toMatch(/Aucune bille/i);
  });

  it("does not assign groups on the break (open table)", () => {
    const state = baseState({
      teamGroups: { SOLIDS: null, STRIPES: null },
      shotId: 1,
    });
    const events: PhysicsEvent[] = [{ type: "clack", intensity: 1, ballId: 1, otherId: 0 }];
    const out = evaluateShot(state, events, [1], true);
    expect(out.groupAssigned).toBe(false);
    expect(state.teamGroups.SOLIDS).toBeNull();
    expect(out.continueShooting).toBe(true);
  });

  it("assigns groups on first legal pot after break", () => {
    const state = baseState({
      teamGroups: { SOLIDS: null, STRIPES: null },
      shotId: 2,
    });
    const events: PhysicsEvent[] = [{ type: "clack", intensity: 1, ballId: 3, otherId: 0 }];
    const out = evaluateShot(state, events, [3], false);
    expect(out.groupAssigned).toBe(true);
    expect(state.teamGroups.SOLIDS).toBe("SOLIDS");
    expect(state.teamGroups.STRIPES).toBe("STRIPES");
  });

  it("grants blackball free shots + kitchen on foul", () => {
    const state = baseState({ config: { variantId: "EN_BLACKBALL" } });
    const out = evaluateShot(state, [], [], false);
    expect(out.foul).toBe(true);
    expect(out.grantFreeShots).toBe(2);
    expect(out.grantFreeBall).toBe(true);
    expect(out.ballInHandKitchen).toBe(true);
  });

  it("rejects invalid break with neither pot nor 4 cushions", () => {
    const state = baseState({ teamGroups: { SOLIDS: null, STRIPES: null } });
    const events: PhysicsEvent[] = [
      { type: "clack", intensity: 1, ballId: 1, otherId: 0 },
      { type: "cushion", intensity: 0.2, ballId: 1 },
    ];
    const out = evaluateShot(state, events, [], true);
    expect(out.foul).toBe(true);
    expect(out.foulReason).toMatch(/Casse invalide/i);
  });

  it("firstContact finds the cue collision partner", () => {
    const events: PhysicsEvent[] = [
      { type: "cushion", intensity: 0.2, ballId: 0 },
      { type: "clack", intensity: 1, ballId: 5, otherId: 0 },
    ];
    expect(firstContact(events)).toBe(5);
  });
});

describe("physics", () => {
  it("stops a slow ball under the threshold", () => {
    const balls: Ball[] = [{
      id: 0, group: "CUE",
      pos: { x: 1, y: 0.5 },
      vel: { x: 0.005, y: 0 },
      angle: 0, pocketed: false, pocketIndex: null,
      spinTop: 0, spinSide: 0,
    }];
    step(balls, 1 / 60);
    expect(isMoving(balls)).toBe(false);
  });

  it("keeps a fast ball inside the table bounds", () => {
    const balls: Ball[] = [{
      id: 0, group: "CUE",
      pos: { x: BALL_RADIUS + 0.01, y: TABLE_HEIGHT / 2 },
      vel: { x: -8, y: 0 },
      angle: 0, pocketed: false, pocketIndex: null,
      spinTop: 0, spinSide: 0,
    }];
    for (let i = 0; i < 30; i++) step(balls, 1 / 60);
    expect(balls[0].pos.x).toBeGreaterThanOrEqual(BALL_RADIUS - 0.001);
    expect(balls[0].pos.x).toBeLessThanOrEqual(TABLE_WIDTH - BALL_RADIUS + 0.001);
    expect(dist(balls[0].pos, { x: -1, y: 0 })).toBeGreaterThan(0);
  });

  it("topspin makes the cue follow after a head-on hit", () => {
    const y = TABLE_HEIGHT / 2;
    const cue: Ball = {
      id: 0, group: "CUE",
      pos: { x: 1, y },
      vel: { x: 3, y: 0 },
      angle: 0, pocketed: false, pocketIndex: null,
      spinTop: 1, spinSide: 0,
    };
    const obj: Ball = {
      id: 1, group: "SOLIDS",
      pos: { x: 1 + 2 * BALL_RADIUS - 0.002, y },
      vel: { x: 0, y: 0 },
      angle: 0, pocketed: false, pocketIndex: null,
      spinTop: 0, spinSide: 0,
    };
    step([cue, obj], 1 / 60);
    expect(cue.vel.x).toBeGreaterThan(0.18);
    expect(cue.spinTop).toBe(0);
  });

  it("backspin makes the cue draw after a head-on hit", () => {
    const y = TABLE_HEIGHT / 2;
    const cue: Ball = {
      id: 0, group: "CUE",
      pos: { x: 1, y },
      vel: { x: 3, y: 0 },
      angle: 0, pocketed: false, pocketIndex: null,
      spinTop: -1, spinSide: 0,
    };
    const obj: Ball = {
      id: 1, group: "SOLIDS",
      pos: { x: 1 + 2 * BALL_RADIUS - 0.002, y },
      vel: { x: 0, y: 0 },
      angle: 0, pocketed: false, pocketIndex: null,
      spinTop: 0, spinSide: 0,
    };
    step([cue, obj], 1 / 60);
    expect(cue.vel.x).toBeLessThan(-0.05);
    expect(cue.spinTop).toBe(0);
  });

  it("right english kicks the cue to the right after a head-on hit", () => {
    const y = TABLE_HEIGHT / 2;
    const cue: Ball = {
      id: 0, group: "CUE",
      pos: { x: 1, y },
      vel: { x: 3, y: 0 },
      angle: 0, pocketed: false, pocketIndex: null,
      spinTop: 0, spinSide: 1,
    };
    const obj: Ball = {
      id: 1, group: "SOLIDS",
      pos: { x: 1 + 2 * BALL_RADIUS - 0.002, y },
      vel: { x: 0, y: 0 },
      angle: 0, pocketed: false, pocketIndex: null,
      spinTop: 0, spinSide: 0,
    };
    step([cue, obj], 1 / 60);
    // Aim +x → right is +y (table Y grows downward).
    expect(cue.vel.y).toBeGreaterThan(0.05);
    expect(obj.vel.y).toBeGreaterThan(0);
    expect(cue.spinSide).toBe(0);
  });
});
