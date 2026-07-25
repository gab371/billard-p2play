import { describe, expect, it } from "vitest";
import { buildRack } from "./rack";
import { evaluateShot } from "./rules";
import { getVariant, isCallComplete, isReadyToShoot, activeCueBallId, VARIANTS } from "./variants";
import { getTableLayout } from "./tableLayout";
import { step } from "./physics";
import type { GameState } from "./types";
import type { PhysicsEvent } from "./physics";

function state(over: Partial<GameState> = {}): GameState {
  return {
    phase: "SHOOTING",
    players: [
      { id: "p1", name: "A", avatar: "🎱", isHost: true, isReady: true, team: "SOLIDS", rotationIndex: 0 },
      { id: "p2", name: "B", avatar: "🎯", isHost: false, isReady: true, team: "STRIPES", rotationIndex: 0 },
    ],
    balls: buildRack(),
    activeTeam: "SOLIDS",
    activeShooterId: "p1",
    teamGroups: { SOLIDS: null, STRIPES: null },
    remaining: { SOLIDS: 7, STRIPES: 7, RED: 7, YELLOW: 7, EIGHT: 1, CUE: 1, OBJECT: 0 },
    ballInHand: false,
    foulMessage: null,
    logs: [],
    winnerTeam: null,
    winnerPlayerId: null,
    aim: { shooterId: null, angle: 0, power: 0 },
    shotId: 1,
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

describe("variants catalog", () => {
  it("makes every variant team-vs-team", () => {
    for (const v of Object.values(VARIANTS)) {
      expect(v.teamMode).toBe("TWO_TEAMS");
    }
  });

  it("requires ball+pocket for 10-ball", () => {
    expect(getVariant("US_TEN").callShot).toBe("BALL_AND_POCKET");
    expect(isCallComplete("BALL_AND_POCKET", { ballId: 3, pocketIndex: null })).toBe(false);
  });

  it("requires US 8 call only when on the 8", () => {
    const open = state({
      teamGroups: { SOLIDS: "SOLIDS", STRIPES: "STRIPES" },
      remaining: { SOLIDS: 3, STRIPES: 7, RED: 0, YELLOW: 0, EIGHT: 1, CUE: 1, OBJECT: 0 },
    });
    expect(isReadyToShoot(open)).toBe(true);
    const onEight = state({
      teamGroups: { SOLIDS: "SOLIDS", STRIPES: "STRIPES" },
      remaining: { SOLIDS: 0, STRIPES: 7, RED: 0, YELLOW: 0, EIGHT: 1, CUE: 1, OBJECT: 0 },
      pendingCall: null,
    });
    expect(isReadyToShoot(onEight)).toBe(false);
  });

  it("uses yellow cue for Team 2 in carom", () => {
    expect(activeCueBallId("FR_CAROM", "SOLIDS")).toBe(0);
    expect(activeCueBallId("FR_CAROM", "STRIPES")).toBe(1);
  });
});

describe("racks", () => {
  it("builds EN colored triangle with RED/YELLOW and blackball pattern", () => {
    const balls = buildRack("TRIANGLE_15", { colored: true });
    expect(balls.filter((b) => b.group === "RED")).toHaveLength(7);
    expect(balls.filter((b) => b.group === "YELLOW")).toHaveLength(7);
    // Apex = order[0], black = center of row 3 = 5th object (index 4 in order) → id 8
    const objects = balls.filter((b) => b.id !== 0);
    // placeTriangle order: row0 col0, row1..., black is 5th object ball
    expect(objects[4].id).toBe(8);
    expect(objects[4].group).toBe("EIGHT");
    const apex = objects[0].group;
    expect(apex === "RED" || apex === "YELLOW").toBe(true);
    // Back corners: last row first & last — must be opposite colors
    const backLeft = objects[10].group;
    const backRight = objects[14].group;
    expect(backLeft).not.toBe(backRight);
    expect(backLeft === "RED" || backLeft === "YELLOW").toBe(true);
    expect(backRight === "RED" || backRight === "YELLOW").toBe(true);
  });

  it("builds US 8-ball with 8 center and opposite corner groups", () => {
    for (let i = 0; i < 20; i++) {
      const balls = buildRack("TRIANGLE_15");
      const objects = balls.filter((b) => b.id !== 0);
      expect(objects).toHaveLength(15);
      expect(objects[4].id).toBe(8);
      expect(objects[0].id).not.toBe(8);
      const left = objects[10].group;
      const right = objects[14].group;
      expect([left, right].sort().join(",")).toBe("SOLIDS,STRIPES");
      expect(new Set(objects.map((b) => b.id)).size).toBe(15);
    }
  });

  it("builds french 3-ball with two cues + red", () => {
    const balls = buildRack("THREE_BALL", { tableProfile: "CAROM" });
    expect(balls).toHaveLength(3);
    expect(balls.filter((b) => b.group === "CUE")).toHaveLength(2);
  });
});

describe("open table after break", () => {
  it("does not assign group on break pot (EN)", () => {
    const s = state({
      config: { variantId: "EN_BLACKBALL" },
      balls: buildRack("TRIANGLE_15", { colored: true }),
    });
    const events: PhysicsEvent[] = [{ type: "clack", intensity: 1, ballId: 1, otherId: 0 }];
    const out = evaluateShot(s, events, [1], true);
    expect(out.continueShooting).toBe(true);
    expect(out.groupAssigned).toBe(false);
  });
});

describe("US 9 team win", () => {
  it("awards win to active team when potting 9 legally", () => {
    const balls = buildRack("DIAMOND_9");
    const s = state({ config: { variantId: "US_NINE" }, balls });
    const events: PhysicsEvent[] = [{ type: "clack", intensity: 1, ballId: 1, otherId: 0 }];
    const out = evaluateShot(s, events, [9], true);
    expect(out.win).toBe("SOLIDS");
    expect(out.foul).toBe(false);
  });
});

describe("FR carom teams", () => {
  it("scores for the active team when cue hits both others", () => {
    const balls = buildRack("THREE_BALL", { tableProfile: "CAROM" });
    const s = state({
      config: { variantId: "FR_CAROM", caromMode: "LIBRE" },
      balls,
      teamScores: { SOLIDS: 0, STRIPES: 0 },
    });
    const events: PhysicsEvent[] = [
      { type: "clack", intensity: 1, ballId: 1, otherId: 0 },
      { type: "clack", intensity: 1, ballId: 2, otherId: 0 },
    ];
    const out = evaluateShot(s, events, [], false);
    expect(out.scoreDelta).toBe(1);
    expect(s.teamScores.SOLIDS).toBe(1);
    expect(out.continueShooting).toBe(true);
  });

  it("requires a cushion before the second ball in ONE_CUSHION", () => {
    const balls = buildRack("THREE_BALL", { tableProfile: "CAROM" });
    const s = state({
      config: { variantId: "FR_CAROM", caromMode: "ONE_CUSHION" },
      balls,
    });
    const noRail: PhysicsEvent[] = [
      { type: "clack", intensity: 1, ballId: 1, otherId: 0 },
      { type: "clack", intensity: 1, ballId: 2, otherId: 0 },
    ];
    expect(evaluateShot(s, noRail, [], false).foul).toBe(true);

    const withRail: PhysicsEvent[] = [
      { type: "clack", intensity: 1, ballId: 1, otherId: 0 },
      { type: "cushion", intensity: 0.5, ballId: 0 },
      { type: "clack", intensity: 1, ballId: 2, otherId: 0 },
    ];
    const ok = evaluateShot(s, withRail, [], false);
    expect(ok.foul).toBe(false);
    expect(ok.scoreDelta).toBe(1);
  });

  it("respots only the jumped ball on off-table foul", () => {
    const balls = buildRack("THREE_BALL", { tableProfile: "CAROM" });
    const kept = { ...balls[1].pos };
    balls[2].pos = { x: -1, y: -1 };
    const s = state({
      config: { variantId: "FR_CAROM", caromMode: "LIBRE" },
      balls,
    });
    const out = evaluateShot(s, [], [], false);
    expect(out.foul).toBe(true);
    expect(s.balls[1].pos).toEqual(kept);
    expect(s.balls[2].pos.x).toBeGreaterThan(0);
  });

  it("never pockets on carom layout", () => {
    const balls = buildRack("THREE_BALL", { tableProfile: "CAROM" });
    const layout = getTableLayout("CAROM");
    balls[0].vel = { x: 8, y: 0 };
    balls[0].pos = { x: layout.width - 0.05, y: layout.height / 2 };
    step(balls, 0.05, layout);
    expect(balls.every((b) => !b.pocketed)).toBe(true);
  });
});
