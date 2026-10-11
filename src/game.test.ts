import { describe, it, expect } from "vitest";
import { createCanvas } from "@napi-rs/canvas";
import { createEngine, ConstantClock } from "@clockwyrks/simple-2d";
import { game, debug, initial, flight, obstacle, BACKGROUND } from "./game";
import * as C from "./constants";
async function setup(step = 10) {
  const canvas = createCanvas(C.FIELD_W, C.FIELD_H);
  const engine = createEngine({
    canvas: canvas as unknown as HTMLCanvasElement,
    width: C.FIELD_W,
    height: C.FIELD_H,
    background: BACKGROUND,
    game,
    clock: new ConstantClock(step),
    surface: {
      cssWidth: () => C.FIELD_W,
      cssHeight: () => C.FIELD_H,
      dpr: () => 1,
      events: () => new EventTarget(),
    },
  });
  await engine.initialize();
  return engine;
}
describe("Carom", () => {
  it("initializes the complete title and resets poses", async () => {
    const e = await setup();
    expect(e.state).toEqual(initialMatching(e.state.ball!.serveSign));
    e.apply((s) => debug.clearWorld(s));
    expect(e.debug.snapshot(e.state).ball).toBeNull();
    expect(() => e.apply((s) => debug.setBallSpin(s, 2))).toThrow();
    e.apply((s) => debug.reset(s));
    expect(e.state.obstacles).toHaveLength(2);
    e.destroy();
  });
  it("serves only when the hold expires and freezes under pause", async () => {
    const e = await setup();
    e.apply((s) => debug.setScreen(s, "countdown"));
    await e.advance(99);
    expect(e.state.ball!.held).toBe(true);
    await e.advance(1);
    expect(e.state.screen).toBe("playing");
    expect(Math.hypot(e.state.ball!.vx, e.state.ball!.vy)).toBeCloseTo(
      C.SERVE_SPEED,
    );
    e.apply((s) => debug.setScreen(s, "paused"));
    const b = e.state.ball,
      clock = e.state.obstacleClock;
    await e.advance(50);
    expect(e.state.ball).toEqual(b);
    expect(e.state.obstacleClock).toBe(clock);
    expect(e.state.simTime).toBeCloseTo(1.5);
    e.destroy();
  });
  it("integrates driven paddles and clamps actual velocity", async () => {
    const e = await setup();
    e.apply((s) => debug.setScreen(s, "playing"));
    e.apply((s) => debug.clearWorld(s));
    e.apply((s) => debug.setPaddleVy(s, "left", C.PADDLE_SPEED));
    e.apply((s) => debug.setPaddleDriven(s, "left", true));
    await e.advance(100);
    expect(e.state.paddles.left.cy).toBe(C.PADDLE_MAX_CY);
    expect(e.state.paddles.left.vy).toBe(0);
    expect(e.state.paddles.left.drivenVy).toBe(C.PADDLE_SPEED);
    e.destroy();
  });
  it("scores with a two-point lead and parks after ordinary points", async () => {
    const e = await setup();
    e.apply((s) => debug.setScreen(s, "playing"));
    e.apply((s) => debug.setScore(s, 10, 10));
    e.apply((s) => debug.setBallHeld(s, false));
    e.apply((s) => debug.setBallPosition(s, C.FIELD_W + C.BALL_R + 1, 360));
    await e.advance(1);
    expect(e.state.score.p1).toBe(11);
    expect(e.state.screen).toBe("countdown");
    e.apply((s) => debug.setScreen(s, "playing"));
    e.apply((s) => debug.setBallHeld(s, false));
    e.apply((s) => debug.setBallPosition(s, C.FIELD_W + C.BALL_R + 1, 360));
    await e.advance(1);
    expect(e.state.winner).toBe("left");
    e.destroy();
  });
  it("adds paddle spin and speed, preserves speed at walls", () => {
    let s = debug.clearWorld(initial());
    s = debug.spawnBall(s);
    s = debug.setBallHeld(s, false);
    s = debug.setBallPosition(s, C.P1_X1 + C.BALL_R + 1, C.FIELD_CY);
    s = debug.setBallVelocity(s, -520, 0);
    s = {
      ...s,
      paddles: { ...s.paddles, left: { ...s.paddles.left, vy: 100 } },
    };
    const cues = new Set<string>();
    const b = flight(s, 0.01, cues)!;
    expect(b.vx).toBeGreaterThan(0);
    expect(b.spin).toBeGreaterThan(0);
    expect(Math.hypot(b.vx, b.vy)).toBeCloseTo(520 * C.SPEED_MULT);
    expect(cues.has(C.CUES.paddleHit)).toBe(true);
    s = debug.setBallPosition(s, 640, C.BALL_R);
    s = debug.setBallVelocity(s, 0, -520);
    const wall = flight(s, 0.01, new Set())!;
    expect(wall.vy).toBe(520);
  });
  it("reflects tilted obstacles without changing speed or spin", () => {
    let s = debug.clearWorld(initial());
    s = debug.setObstacleClock(s, 0.5);
    s = debug.spawnObstacle(s, 0);
    s = debug.spawnBall(s);
    const o = obstacle(0, 0.5),
      c = Math.cos(o.theta),
      sn = Math.sin(o.theta);
    s = debug.setBallPosition(
      s,
      o.cx + (C.OBSTACLE_HW + C.BALL_R) * c,
      o.cy + (C.OBSTACLE_HW + C.BALL_R) * sn,
    );
    s = debug.setBallVelocity(s, -520 * c, -520 * sn);
    s = debug.setBallHeld(s, false);
    const cues = new Set<string>(),
      b = flight(s, 0.005, cues)!;
    expect(cues.has(C.CUES.obstacleBounce)).toBe(true);
    expect(Math.hypot(b.vx, b.vy)).toBeCloseTo(520);
    expect(b.vx * c + b.vy * sn).toBeGreaterThan(0);
  });
  it("keeps flight consistent across frame lengths", () => {
    const run = (dt: number) => {
      let s = debug.clearWorld(initial());
      s = debug.spawnBall(s);
      s = debug.setBallHeld(s, false);
      s = debug.setBallVelocity(s, 520, 100);
      s = debug.setBallSpin(s, 400);
      for (let t = 0; t < 0.4 - 1e-8; t += dt)
        s = { ...s, ball: flight(s, dt, new Set()) };
      return s.ball!;
    };
    const a = run(0.002),
      b = run(0.016);
    expect(Math.hypot(a.vx, a.vy)).toBeCloseTo(Math.hypot(b.vx, b.vy));
    expect(Math.abs(a.vy - b.vy)).toBeLessThan(10);
  });
});
function initialMatching(serveSign: 1 | -1) {
  return { ...initial(), ball: { ...initial().ball!, serveSign } };
}

describe("input and debug contract", () => {
  it("handles keyboard priority, remembered menus and Escape once", async () => {
    const target = new EventTarget();
    const canvas = createCanvas(C.FIELD_W, C.FIELD_H);
    const e = createEngine({
      canvas: canvas as unknown as HTMLCanvasElement,
      width: C.FIELD_W,
      height: C.FIELD_H,
      game,
      clock: new ConstantClock(10),
      surface: {
        cssWidth: () => C.FIELD_W,
        cssHeight: () => C.FIELD_H,
        dpr: () => 1,
        events: () => target,
      },
    });
    await e.initialize();
    const key = (type: string, code: string) =>
      target.dispatchEvent(
        Object.assign(new Event(type), { code, repeat: false }),
      );
    key("keydown", "KeyS");
    key("keydown", "Enter");
    await e.advance(1);
    expect(e.state.menuIndex).toBe(1);
    expect(e.state.screen).toBe("title");
    key("keyup", "KeyS");
    key("keyup", "Enter");
    await e.advance(1);
    key("keydown", "Enter");
    await e.advance(1);
    key("keyup", "Enter");
    expect(e.state.mode).toBe("versus");
    expect(e.state.titleIndex).toBe(1);
    key("keydown", "Escape");
    await e.advance(1);
    expect(e.state.screen).toBe("paused");
    key("keyup", "Escape");
    await e.advance(1);
    key("keydown", "Escape");
    await e.advance(1);
    expect(e.state.screen).toBe("countdown");
    key("keyup", "Escape");
    key("keydown", "KeyM");
    await e.advance(1);
    expect(e.state.muted).toBe(true);
    e.destroy();
  });
  it("confirms a mouse click across frames and rejects mismatched regions", async () => {
    const target = new EventTarget(),
      canvas = createCanvas(C.FIELD_W, C.FIELD_H);
    const e = createEngine({
      canvas: canvas as unknown as HTMLCanvasElement,
      width: C.FIELD_W,
      height: C.FIELD_H,
      game,
      clock: new ConstantClock(10),
      surface: {
        cssWidth: () => C.FIELD_W,
        cssHeight: () => C.FIELD_H,
        dpr: () => 1,
        events: () => target,
      },
    });
    await e.initialize();
    const pointer = (type: string, y: number) =>
      target.dispatchEvent(
        Object.assign(new Event(type), {
          clientX: 640,
          clientY: y,
          pointerId: 1,
          pointerType: "mouse",
          isPrimary: true,
          button: 0,
          buttons: type === "pointerup" ? 0 : 1,
        }),
      );
    pointer("pointerdown", 370);
    await e.advance(1);
    pointer("pointerup", 450);
    await e.advance(1);
    expect(e.state.screen).toBe("title");
    pointer("pointerdown", 510);
    await e.advance(1);
    pointer("pointerup", 510);
    await e.advance(1);
    expect(e.state.screen).toBe("howto");
    expect(e.state.titleIndex).toBe(2);
    e.destroy();
  });
  it("poses each independent field without mutating earlier state", () => {
    const s = initial(),
      before = JSON.stringify(s);
    let next = debug.setPaddleDriven(s, "left", true);
    next = debug.setPaddleVy(next, "left", 123);
    next = debug.setPaddleCy(next, "right", 200);
    next = debug.setBallPosition(next, 300, 400);
    next = debug.setBallVelocity(next, 3, 4);
    next = debug.setBallSpin(next, 80);
    next = debug.setBallHoldTimer(next, 0.2);
    next = debug.setBallServeSign(next, -1);
    next = debug.setAiTracking(next, false);
    next = debug.setAiMovement(next, false);
    next = debug.setObstacleClock(next, 2);
    next = debug.setObstacleClockRunning(next, false);
    next = debug.setReceiver(next, "right");
    next = debug.setWinner(next, "right");
    next = debug.setResumeScreen(next, "countdown");
    next = debug.setTitleIndex(next, 2);
    next = debug.setMuted(next, true);
    const snapshot = debug.snapshot(next);
    expect(snapshot.ball!.speed).toBe(5);
    expect(snapshot.paddles.left.drivenVy).toBe(123);
    expect(snapshot.paddles.left.vy).toBe(0);
    expect(snapshot.obstacles[0]).toEqual(obstacle(0, 2));
    expect(debug.reconcile(next)).toEqual(next);
    expect(JSON.stringify(s)).toBe(before);
    expect(debug.reset(next).muted).toBe(true);
    expect(debug.menuItemRect(debug.setScreen(next, "playing"), 0)).toBeNull();
    expect(debug.menuItemRect(next, 50)).toBeNull();
    expect(() => debug.spawnObstacle(next, 4)).toThrow();
  });
});

describe("AI and world lifecycle", () => {
  it("gates tracking and movement separately and yields to a driven paddle", async () => {
    const e = await setup();
    e.apply((s) => debug.clearWorld(s));
    e.apply((s) => debug.spawnBall(s));
    e.apply((s) => debug.setScreen(s, "playing"));
    e.apply((s) => debug.setBallHeld(s, false));
    e.apply((s) => debug.setBallPosition(s, 900, 600));
    e.apply((s) => debug.setBallVelocity(s, 100, 0));
    await e.advance(1);
    expect(e.state.paddles.right.cy).toBeGreaterThan(C.FIELD_CY);
    e.apply((s) => debug.setAiMovement(s, false));
    const cy = e.state.paddles.right.cy;
    await e.advance(1);
    expect(e.state.paddles.right.cy).toBe(cy);
    expect(e.state.paddles.right.vy).toBe(0);
    e.apply((s) => debug.setAiMovement(s, true));
    e.apply((s) => debug.setAiTracking(s, false));
    e.apply((s) => debug.setPaddleCy(s, "right", 600));
    await e.advance(1);
    expect(e.state.paddles.right.cy).toBeLessThan(600);
    e.apply((s) => debug.setPaddleDriven(s, "right", true));
    e.apply((s) => debug.setPaddleVy(s, "right", 50));
    const drivenCy = e.state.paddles.right.cy;
    await e.advance(1);
    expect(e.state.paddles.right.cy).toBeCloseTo(drivenCy + 0.5);
    e.destroy();
  });
  it("does not advance an empty world or a frozen obstacle clock", async () => {
    const e = await setup();
    e.apply((s) => debug.clearWorld(s));
    e.apply((s) => debug.setScreen(s, "playing"));
    e.apply((s) => debug.setObstacleClock(s, 2));
    e.apply((s) => debug.spawnObstacle(s, 1));
    e.apply((s) => debug.setObstacleClockRunning(s, false));
    const o = e.state.obstacles[0];
    await e.advance(40);
    expect(e.state.obstacles).toEqual([o]);
    expect(e.state.ball).toBeNull();
    expect(e.state.score).toEqual({ p1: 0, p2: 0 });
    expect(e.diagnostics().every((d) => !d.error)).toBe(true);
    e.destroy();
  });
  it("renders every menu without advancing its world", async () => {
    const e = await setup();
    for (const screen of ["howto", "matchover", "paused", "title"] as const) {
      e.apply((s) => debug.setScreen(s, screen));
      const ball = e.state.ball,
        clock = e.state.obstacleClock;
      await e.advance(1);
      expect(e.state.ball).toEqual(ball);
      expect(e.state.obstacleClock).toBe(clock);
      expect(e.debug.menuItemRect(e.state, 0)).not.toBeNull();
    }
    e.destroy();
  });
});
