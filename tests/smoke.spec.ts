import { test, expect } from "@playwright/test";

test("lobby renders on load", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: /Cr[eé]er une Table/i })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/P2PLAY BILLARDS/i).first()).toBeVisible();
});

test("test hooks are exposed in dev", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: /Cr[eé]er une Table/i })).toBeVisible({ timeout: 30_000 });
  const hasHooks = await page.evaluate(() => !!window.__testHooks__);
  expect(hasHooks).toBe(true);
});

test("engine smoke: break kitchen + foul on empty miss", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: /Cr[eé]er une Table/i })).toBeVisible({ timeout: 30_000 });

  const result = await page.evaluate(() => {
    const hooks = window.__testHooks__!;
    hooks.createEngine();
    hooks.act("addPlayer", ["host", "Host", "🎱", true]);
    hooks.act("assignTeam", ["host", "SOLIDS"]);
    hooks.act("startGame", []);
    const before = JSON.parse(JSON.stringify(hooks.getState())) as {
      phase: string; ballInHand: boolean;
    };

    // Attempt to place past the head string — kitchen must clamp.
    hooks.act("placeCueBall", ["host", { x: 2.0, y: 0.56 }]);
    const afterPlace = JSON.parse(JSON.stringify(hooks.getState())) as {
      balls: { id: number; pos: { x: number } }[];
    };
    const cueX = afterPlace.balls.find((b) => b.id === 0)!.pos.x;

    // Clear object balls so a shot cannot accidentally contact the rack after a cushion bounce.
    const live = hooks.getState() as { balls: { id: number; pocketed: boolean }[] };
    live.balls.forEach((b) => { if (b.id !== 0) b.pocketed = true; });

    hooks.act("confirmPlacement", ["host"]);
    hooks.act("fireShot", ["host", { angle: Math.PI, power: 0.25, spinSide: 0, spinTop: 0 }]);
    for (let i = 0; i < 600; i++) {
      hooks.act("tick", [1 / 60]);
      const eng = hooks.getEngine();
      if (eng && !eng.isShooting()) break;
    }
    hooks.act("finishShot", []);
    const after = JSON.parse(JSON.stringify(hooks.getState())) as {
      foulMessage: string | null; phase: string; ballInHand: boolean;
    };
    return { before, cueX, after };
  });

  expect(result.before.phase).toBe("BREAKING");
  expect(result.before.ballInHand).toBe(true);
  expect(result.cueX).toBeLessThanOrEqual(0.56); // HEAD_STRING ≈ 0.56
  // Break with no pot and <4 cushions → invalid break (rulebook); empty miss mid-game → "Aucune bille".
  expect(result.after.foulMessage).toMatch(/Casse invalide|Aucune bille/i);
  expect(result.after.ballInHand).toBe(true);
});
