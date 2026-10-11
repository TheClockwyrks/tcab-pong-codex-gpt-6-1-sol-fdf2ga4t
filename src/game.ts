import type { Game, UpdateApi } from "@clockwyrks/simple-2d";
import type { DeepReadonly } from "ts-essentials";
import * as C from "./constants";
import { render } from "./render";

export type Screen =
  "title" | "howto" | "countdown" | "playing" | "paused" | "matchover";

export type Mode = "solo" | "versus";

export type Side = "left" | "right";

export interface PaddleState {
  readonly cy: number;
  readonly vy: number;
  readonly driven: boolean;
  readonly drivenVy: number;
}

export interface AiState {
  readonly tracking: boolean;
  readonly movement: boolean;
}

export interface TrailSample {
  readonly x: number;
  readonly y: number;
  readonly t: number;
}

export interface BallState {
  readonly x: number;
  readonly y: number;
  readonly vx: number;
  readonly vy: number;
  readonly spin: number;
  readonly held: boolean;
  readonly holdTimer: number;
  readonly serveSign: 1 | -1;
  readonly trail: readonly TrailSample[];
}

export interface ObstacleState {
  readonly index: number;
  readonly cx: number;
  readonly cy: number;
  readonly theta: number;
}

export interface CaromState {
  readonly menuContacts?: Readonly<Record<number, number>>;
  readonly screen: Screen;
  readonly mode: Mode;
  readonly menuIndex: number;
  readonly titleIndex: number;
  readonly resumeScreen: "countdown" | "playing";

  readonly score: { readonly p1: number; readonly p2: number };
  readonly winner: Side | null;

  readonly paddles: { readonly left: PaddleState; readonly right: PaddleState };
  readonly ai: AiState;

  readonly receiver: Side;
  readonly ball: BallState | null;
  readonly obstacles: readonly ObstacleState[];
  readonly obstacleClock: number;
  readonly obstacleClockRunning: boolean;

  readonly simTime: number;
  readonly muted: boolean;
}

export const BACKGROUND = "#0b141c";
type State = DeepReadonly<CaromState>;
export interface MenuRect {
  x: number;
  y: number;
  w: number;
  h: number;
}
export function items(s: State): readonly string[] {
  return s.screen === "title"
    ? C.TITLE_ITEMS
    : s.screen === "paused"
      ? C.PAUSE_ITEMS
      : s.screen === "matchover"
        ? C.MATCHOVER_ITEMS
        : s.screen === "howto"
          ? ["BACK TO MENU"]
          : [];
}
export function menuItemRect(s: State, i: number): MenuRect | null {
  return Number.isInteger(i) && i >= 0 && i < items(s).length
    ? { x: 440, y: s.screen === "howto" ? 578 : 350 + i * 70, w: 400, h: 56 }
    : null;
}
const clamp = (v: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, v));
const sign = (): 1 | -1 => (Math.random() < 0.5 ? -1 : 1);
export function homeBall(): BallState {
  return {
    x: C.FIELD_CX,
    y: C.FIELD_CY,
    vx: 0,
    vy: 0,
    spin: 0,
    held: true,
    holdTimer: C.HOLD_TIME,
    serveSign: sign(),
    trail: [],
  };
}
export function obstacle(index: number, t: number): ObstacleState {
  const base = C.OBSTACLE_CENTERS[index];
  if (!base || !Number.isInteger(index))
    throw new RangeError("Unknown obstacle");
  return {
    index,
    cx: base.x,
    cy:
      base.y +
      (index === 0 ? 1 : -1) *
        C.OBSTACLE_SWAY_AMP *
        Math.sin((2 * Math.PI * t) / C.OBSTACLE_SWAY_PERIOD),
    theta: C.OBSTACLE_SPIN_RATE * t,
  };
}
export function initial(muted = false): CaromState {
  const paddle = (): PaddleState => ({
    cy: C.FIELD_CY,
    vy: 0,
    driven: false,
    drivenVy: 0,
  });
  return {
    screen: "title",
    mode: "solo",
    menuIndex: 0,
    titleIndex: 0,
    resumeScreen: "playing",
    score: { p1: 0, p2: 0 },
    winner: null,
    paddles: { left: paddle(), right: paddle() },
    ai: { tracking: true, movement: true },
    receiver: "left",
    ball: homeBall(),
    obstacles: C.OBSTACLE_CENTERS.map((_, i) => obstacle(i, 0)),
    obstacleClock: 0,
    obstacleClockRunning: true,
    simTime: 0,
    muted,
  };
}
function ballPose(s: State, patch: Partial<BallState>): CaromState {
  if (!s.ball) throw new Error("No ball on the field");
  return { ...s, ball: { ...s.ball, ...patch } };
}
function paddlePose(
  s: State,
  side: Side,
  patch: Partial<PaddleState>,
): CaromState {
  return {
    ...s,
    paddles: { ...s.paddles, [side]: { ...s.paddles[side], ...patch } },
  };
}
export const debug = {
  version: C.CAROM_DEBUG_VERSION,
  clearWorld: (s: State): CaromState => ({ ...s, ball: null, obstacles: [] }),
  spawnBall: (s: State): CaromState => ({ ...s, ball: homeBall() }),
  spawnObstacle: (s: State, index: number): CaromState => ({
    ...s,
    obstacles: [
      ...s.obstacles.filter((o) => o.index !== index),
      obstacle(index, s.obstacleClock),
    ].sort((a, b) => a.index - b.index),
  }),
  reset: (s: State) => initial(s.muted),
  reconcile: (s: State): CaromState => ({
    ...s,
    obstacles: s.obstacles.map((o) => obstacle(o.index, s.obstacleClock)),
  }),
  setScreen: (s: State, screen: Screen): CaromState => ({ ...s, screen }),
  setMode: (s: State, mode: Mode): CaromState => ({ ...s, mode }),
  setMenuIndex: (s: State, menuIndex: number): CaromState => ({
    ...s,
    menuIndex,
  }),
  setTitleIndex: (s: State, titleIndex: number): CaromState => ({
    ...s,
    titleIndex,
  }),
  setResumeScreen: (
    s: State,
    resumeScreen: "countdown" | "playing",
  ): CaromState => ({ ...s, resumeScreen }),
  setScore: (s: State, p1: number, p2: number): CaromState => ({
    ...s,
    score: { p1, p2 },
  }),
  setWinner: (s: State, winner: Side | null): CaromState => ({ ...s, winner }),
  setReceiver: (s: State, receiver: Side): CaromState => ({ ...s, receiver }),
  setPaddleCy: (s: State, side: Side, cy: number) =>
    paddlePose(s, side, { cy }),
  setPaddleVy: (s: State, side: Side, drivenVy: number) =>
    paddlePose(s, side, { drivenVy }),
  setPaddleDriven: (s: State, side: Side, driven: boolean) =>
    paddlePose(s, side, { driven }),
  setBallPosition: (s: State, x: number, y: number) => ballPose(s, { x, y }),
  setBallVelocity: (s: State, vx: number, vy: number) =>
    ballPose(s, { vx, vy }),
  setBallSpin: (s: State, spin: number) => ballPose(s, { spin }),
  setBallHeld: (s: State, held: boolean) => ballPose(s, { held }),
  setBallHoldTimer: (s: State, holdTimer: number) => ballPose(s, { holdTimer }),
  setBallServeSign: (s: State, serveSign: 1 | -1) => ballPose(s, { serveSign }),
  drawBallServeSign: (s: State) => ballPose(s, { serveSign: sign() }),
  setAiTracking: (s: State, tracking: boolean): CaromState => ({
    ...s,
    ai: { ...s.ai, tracking },
  }),
  setAiMovement: (s: State, movement: boolean): CaromState => ({
    ...s,
    ai: { ...s.ai, movement },
  }),
  setMuted: (s: State, muted: boolean): CaromState => ({ ...s, muted }),
  setObstacleClock: (s: State, obstacleClock: number): CaromState => ({
    ...s,
    obstacleClock,
    obstacles: s.obstacles.map((o) => obstacle(o.index, obstacleClock)),
  }),
  setObstacleClockRunning: (
    s: State,
    obstacleClockRunning: boolean,
  ): CaromState => ({ ...s, obstacleClockRunning }),
  menuItemRect,
  snapshot: (s: State) => ({
    ...s,
    version: C.CAROM_DEBUG_VERSION,
    score: { ...s.score },
    paddles: { left: { ...s.paddles.left }, right: { ...s.paddles.right } },
    ai: { ...s.ai },
    obstacles: s.obstacles.map((o) => ({ ...o })),
    ball: s.ball
      ? {
          ...s.ball,
          speed: Math.hypot(s.ball.vx, s.ball.vy),
          trail: s.ball.trail.map((p) => ({ ...p })),
        }
      : null,
  }),
};
export type CaromDebugApi = typeof debug;
function start(s: State, mode: Mode): CaromState {
  return {
    ...s,
    mode,
    screen: "countdown",
    resumeScreen: "playing",
    menuIndex: 0,
    score: { p1: 0, p2: 0 },
    winner: null,
    receiver: "left",
    ball: homeBall(),
    paddles: {
      left: { ...s.paddles.left, cy: C.FIELD_CY, vy: 0 },
      right: { ...s.paddles.right, cy: C.FIELD_CY, vy: 0 },
    },
    obstacleClock: 0,
    obstacleClockRunning: true,
    obstacles: s.obstacles.map((o) => obstacle(o.index, 0)),
  };
}
function title(s: State): CaromState {
  return {
    ...initial(s.muted),
    titleIndex: s.titleIndex,
    menuIndex: s.titleIndex,
    simTime: s.simTime,
  };
}
function confirm(s: State): CaromState {
  if (s.screen === "title") {
    const next = { ...s, titleIndex: s.menuIndex };
    return s.menuIndex === 2
      ? { ...next, screen: "howto", menuIndex: 0 }
      : start(next, s.menuIndex === 0 ? "solo" : "versus");
  }
  if (s.screen === "howto") return title(s);
  if (s.screen === "paused")
    return s.menuIndex === 0
      ? { ...s, screen: s.resumeScreen }
      : s.menuIndex === 1
        ? start(s, s.mode)
        : title(s);
  return s.menuIndex === 0 ? start(s, s.mode) : title(s);
}
function move(p: PaddleState, velocity: number, dt: number): PaddleState {
  const raw = p.cy + velocity * dt,
    cy = clamp(raw, C.PADDLE_MIN_CY, C.PADDLE_MAX_CY);
  return { ...p, cy, vy: raw !== cy && dt > 0 ? (cy - p.cy) / dt : velocity };
}
/** Pure simulation; audio events are collected once per outer frame. */
export function flight(
  s: State,
  dt: number,
  cues: Set<string>,
): BallState | null {
  if (!s.ball || s.ball.held) return s.ball;
  let b = { ...s.ball };
  const n = Math.max(
      1,
      Math.ceil((Math.hypot(b.vx, b.vy) * dt) / C.MAX_SUBSTEP),
    ),
    h = dt / n;
  for (let step = 0; step < n; step++) {
    const speed = Math.hypot(b.vx, b.vy),
      a = speed > 0 ? (b.spin / speed) * h : 0;
    const vx = b.vx * Math.cos(a) - b.vy * Math.sin(a),
      vy = b.vx * Math.sin(a) + b.vy * Math.cos(a);
    b = {
      ...b,
      vx,
      vy,
      spin: b.spin * Math.pow(0.5, h / C.SPIN_HALFLIFE),
      x: b.x + vx * h,
      y: b.y + vy * h,
    };
    if (b.y - C.BALL_R < 0 && b.vy < 0) {
      b.y = C.BALL_R;
      b.vy = -b.vy;
      cues.add(C.CUES.wallBounce);
    } else if (b.y + C.BALL_R > C.FIELD_H && b.vy > 0) {
      b.y = C.FIELD_H - C.BALL_R;
      b.vy = -b.vy;
      cues.add(C.CUES.wallBounce);
    }
    for (const side of ["left", "right"] as const) {
      const p = s.paddles[side],
        x0 = side === "left" ? C.P1_X0 : C.P2_X0,
        x1 = side === "left" ? C.P1_X1 : C.P2_X1;
      const y0 = p.cy - C.PADDLE_HALF,
        y1 = p.cy + C.PADDLE_HALF;
      const depths = [
        b.x - (x0 - C.BALL_R),
        x1 + C.BALL_R - b.x,
        b.y - (y0 - C.BALL_R),
        y1 + C.BALL_R - b.y,
      ];
      if (depths.some((d) => d <= 0)) continue;
      const face = depths.indexOf(Math.min(...depths));
      if (face < 2) {
        const theta =
          clamp((b.y - p.cy) / C.PADDLE_HALF, -1, 1) * C.MAX_BOUNCE_ANGLE;
        const speed = Math.min(
          Math.hypot(b.vx, b.vy) * C.SPEED_MULT,
          C.SPEED_CAP,
        );
        b.vx = (side === "left" ? 1 : -1) * speed * Math.cos(theta);
        b.vy = speed * Math.sin(theta);
        b.spin = clamp(
          b.spin + p.vy * C.SPIN_FROM_PADDLE,
          -C.SPIN_CLAMP,
          C.SPIN_CLAMP,
        );
        b.x = side === "left" ? C.P1_X1 + C.BALL_R : C.P2_X0 - C.BALL_R;
        cues.add(C.CUES.paddleHit);
      } else {
        b.y = face === 2 ? y0 - C.BALL_R : y1 + C.BALL_R;
        if ((face === 2 && b.vy > 0) || (face === 3 && b.vy < 0)) {
          b.vy = -b.vy;
          cues.add(C.CUES.wallBounce);
        }
      }
    }
    for (const o of s.obstacles) {
      const c = Math.cos(o.theta),
        sn = Math.sin(o.theta),
        dx = b.x - o.cx,
        dy = b.y - o.cy;
      const lx = dx * c + dy * sn,
        ly = -dx * sn + dy * c;
      const qx = clamp(lx, -C.OBSTACLE_HW, C.OBSTACLE_HW),
        qy = clamp(ly, -C.OBSTACLE_HH, C.OBSTACLE_HH);
      const dist = Math.hypot(lx - qx, ly - qy);
      if (dist >= C.BALL_R) continue;
      let nx: number, ny: number, push: number;
      if (dist > 0) {
        nx = (lx - qx) / dist;
        ny = (ly - qy) / dist;
        push = C.BALL_R - dist;
      } else {
        const px = C.OBSTACLE_HW - Math.abs(lx),
          py = C.OBSTACLE_HH - Math.abs(ly);
        nx = px <= py ? (lx < 0 ? -1 : 1) : 0;
        ny = px > py ? (ly < 0 ? -1 : 1) : 0;
        push = C.BALL_R + Math.min(px, py);
      }
      const wx = nx * c - ny * sn,
        wy = nx * sn + ny * c,
        dot = b.vx * wx + b.vy * wy;
      if (dot < 0) {
        b.vx -= 2 * dot * wx;
        b.vy -= 2 * dot * wy;
        cues.add(C.CUES.obstacleBounce);
      }
      b.x += wx * push;
      b.y += wy * push;
    }
  }
  return b;
}
function update(state: State, api: UpdateApi, dt: number): CaromState {
  const edges = Object.fromEntries(
    C.ACTIONS.map((a) => [a, api.input.pressed(a)]),
  );
  api.audio.setMuted(edges.mute ? !state.muted : state.muted);
  let s: CaromState = {
    ...state,
    simTime: state.simTime + dt,
    muted: api.audio.muted(),
  };
  const screen = state.screen;
  if ((screen === "playing" || screen === "countdown") && edges.pause)
    s = { ...s, screen: "paused", resumeScreen: screen, menuIndex: 0 };
  else if (screen === "paused" && (edges.pause || edges.back))
    s = { ...s, screen: s.resumeScreen };
  else if ((screen === "howto" || screen === "matchover") && edges.back)
    s = title(s);
  else if (items(s).length) {
    const up = edges["p1-up"] || edges["p2-up"],
      down = edges["p1-down"] || edges["p2-down"];
    if (up || down)
      s = {
        ...s,
        menuIndex:
          (s.menuIndex + (up ? -1 : 1) + items(s).length) % items(s).length,
      };
    const keyboardConfirm = !up && !down && edges.confirm;
    if (keyboardConfirm) s = confirm(s);
    else {
      const contacts: Record<number, number> = { ...s.menuContacts };
      for (const sample of api.input.pointerSamples()) {
        const hit = items(s).findIndex((_, i) => {
          const r = menuItemRect(s, i)!;
          return (
            sample.x >= r.x &&
            sample.x <= r.x + r.w &&
            sample.y >= r.y &&
            sample.y <= r.y + r.h
          );
        });
        if (hit >= 0) s = { ...s, menuIndex: hit };
        if (sample.type === "down") contacts[sample.id] = hit;
        if (sample.type === "up") {
          const origin = contacts[sample.id];
          delete contacts[sample.id];
          if (hit >= 0 && origin === hit) {
            s = confirm(s);
            break;
          }
        }
      }
      s = { ...s, menuContacts: contacts };
    }
  }
  if (s.screen !== "countdown" && s.screen !== "playing") return s;
  const held = (a: string) => (api.input.value(a) > 0 ? 1 : 0);
  const axis = (side: Side) =>
    side === "left" && s.mode === "solo"
      ? Number(held("p1-down") || held("p2-down")) -
        Number(held("p1-up") || held("p2-up"))
      : held(side === "left" ? "p1-down" : "p2-down") -
        held(side === "left" ? "p1-up" : "p2-up");
  const paddles = { ...s.paddles };
  for (const side of ["left", "right"] as const) {
    const p = s.paddles[side];
    let velocity = axis(side) * C.PADDLE_SPEED;
    if (side === "right" && s.mode === "solo") {
      const tracking =
        s.ai.tracking && s.screen === "playing" && s.ball && s.ball.vx > 0;
      const target =
          tracking && s.ball ? s.ball.y - s.ball.vy * C.AI_REACT : C.AI_HOME_Y,
        diff = target - p.cy;
      velocity =
        !s.ai.movement ||
        Math.abs(diff) <= (tracking ? C.AI_DEADZONE : C.AI_HOME_DEADZONE) ||
        dt <= 0
          ? 0
          : Math.sign(diff) * Math.min(C.AI_SPEED, Math.abs(diff) / dt);
    }
    paddles[side] = move(p, p.driven ? p.drivenVy : velocity, dt);
  }
  s = { ...s, paddles };
  const cues = new Set<string>();
  if (s.screen === "countdown" && s.ball) {
    const timer = Math.max(0, s.ball.holdTimer - dt);
    s = { ...s, ball: { ...s.ball, holdTimer: timer } };
    if (timer <= 0)
      s = {
        ...s,
        screen: "playing",
        ball: {
          ...s.ball!,
          held: false,
          vx:
            (s.receiver === "left" ? -1 : 1) *
            C.SERVE_SPEED *
            Math.cos(C.SERVE_ANGLE),
          vy: s.ball!.serveSign * C.SERVE_SPEED * Math.sin(C.SERVE_ANGLE),
          trail: [],
        },
      };
  } else if (s.screen === "playing") s = { ...s, ball: flight(s, dt, cues) };
  if (s.ball)
    s = {
      ...s,
      ball: {
        ...s.ball,
        trail: [
          ...s.ball.trail.filter((p) => p.t >= s.simTime - C.TRAIL_TIME),
          { x: s.ball.x, y: s.ball.y, t: s.simTime },
        ],
      },
    };
  const clock = s.obstacleClock + (s.obstacleClockRunning ? dt : 0);
  s = {
    ...s,
    obstacleClock: clock,
    obstacles: s.obstacles.map((o) => obstacle(o.index, clock)),
  };
  if (
    s.ball &&
    !s.ball.held &&
    (s.ball.x - C.BALL_R > C.FIELD_W || s.ball.x + C.BALL_R < 0)
  ) {
    const left = s.ball.x > C.FIELD_W,
      score = { p1: s.score.p1 + Number(left), p2: s.score.p2 + Number(!left) };
    const won =
      Math.max(score.p1, score.p2) >= C.WIN_SCORE &&
      Math.abs(score.p1 - score.p2) >= C.WIN_LEAD;
    s = won
      ? {
          ...s,
          score,
          winner: left ? "left" : "right",
          screen: "matchover",
          menuIndex: 0,
        }
      : {
          ...s,
          score,
          receiver: left ? "right" : "left",
          ball: homeBall(),
          screen: "countdown",
        };
    cues.add(C.CUES.score);
  }
  cues.forEach((cue) => api.audio.play(cue));
  return s;
}
export const game: Game<CaromState, CaromDebugApi> = {
  initialize(api) {
    C.ACTIONS.forEach((a) =>
      api.input.register(a, { keys: [...C.BINDINGS[a]] }),
    );
    Object.values(C.CUES).forEach((cue, i) =>
      api.audio.define(cue, {
        freq: [420, 240, 680, 160][i],
        freqTo: [180, 120, 340, 560][i],
        durationMs: 80 + i * 25,
        gain: 0.16,
      }),
    );
    api.diagnostics.register("screen", (s) => s.screen);
    api.diagnostics.register("mode", (s) => s.mode);
    api.diagnostics.register("score", (s) => `${s.score.p1} : ${s.score.p2}`);
    api.diagnostics.register("ball position", (s) =>
      s.ball ? `${s.ball.x.toFixed(1)}, ${s.ball.y.toFixed(1)}` : "absent",
    );
    api.diagnostics.register("ball velocity", (s) =>
      s.ball ? `${s.ball.vx.toFixed(1)}, ${s.ball.vy.toFixed(1)}` : "absent",
    );
    api.diagnostics.register("ball speed", (s) =>
      s.ball ? Math.hypot(s.ball.vx, s.ball.vy) : 0,
    );
    api.diagnostics.register("spin", (s) => s.ball?.spin ?? 0);
    for (const side of ["left", "right"] as const) {
      api.diagnostics.register(`${side} center`, (s) => s.paddles[side].cy);
      api.diagnostics.register(`${side} velocity`, (s) => s.paddles[side].vy);
    }
    return [initial(), debug];
  },
  update,
  render,
};
