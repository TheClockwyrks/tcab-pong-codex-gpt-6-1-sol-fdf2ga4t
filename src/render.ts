import type { RenderApi } from "@clockwyrks/simple-2d";
import type { DeepReadonly } from "ts-essentials";
import type { CaromState } from "./game";
import { items, menuItemRect } from "./game";
import * as C from "./constants";
const cyan = "#68e7e3",
  coral = "#ff857e",
  gold = "#f3ce79",
  white = "#e9f0ef";
export function render(
  s: DeepReadonly<CaromState>,
  { ctx: c }: RenderApi,
): void {
  const text = (
    copy: string,
    x: number,
    y: number,
    size: number,
    color = white,
    align: CanvasTextAlign = "center",
  ) => {
    c.fillStyle = color;
    c.font = `${size >= 60 ? 800 : 500} ${size}px system-ui, sans-serif`;
    c.textAlign = align;
    c.fillText(copy, x, y);
  };
  const bar = (x: number, y: number, w: number, h: number, color: string) => {
    c.fillStyle = color;
    c.shadowColor = color;
    c.shadowBlur = 15;
    c.beginPath();
    c.roundRect(x, y, w, h, Math.min(w / 2, 7));
    c.fill();
    c.shadowBlur = 0;
  };
  c.save();
  c.strokeStyle = "#172833";
  c.lineWidth = 1;
  for (let x = 0; x < C.FIELD_W; x += 80) {
    c.beginPath();
    c.moveTo(x, 0);
    c.lineTo(x, C.FIELD_H);
    c.stroke();
  }
  for (let y = 0; y < C.FIELD_H; y += 80) {
    c.beginPath();
    c.moveTo(0, y);
    c.lineTo(C.FIELD_W, y);
    c.stroke();
  }
  c.strokeStyle = "#30414b";
  c.setLineDash([7, 16]);
  c.beginPath();
  c.moveTo(C.NET_X, 110);
  c.lineTo(C.NET_X, C.FIELD_H - 45);
  c.stroke();
  c.setLineDash([]);
  c.strokeStyle = "#34424a";
  c.beginPath();
  c.moveTo(28, 18);
  c.lineTo(C.FIELD_W - 28, 18);
  c.moveTo(28, C.FIELD_H - 18);
  c.lineTo(C.FIELD_W - 28, C.FIELD_H - 18);
  c.stroke();
  bar(C.P1_X0, s.paddles.left.cy - C.PADDLE_HALF, C.PADDLE_W, C.PADDLE_H, cyan);
  bar(
    C.P2_X0,
    s.paddles.right.cy - C.PADDLE_HALF,
    C.PADDLE_W,
    C.PADDLE_H,
    coral,
  );
  for (const o of s.obstacles) {
    c.save();
    c.translate(o.cx, o.cy);
    c.rotate(o.theta);
    bar(-C.OBSTACLE_HW, -C.OBSTACLE_HH, C.OBSTACLE_W, C.OBSTACLE_H, gold);
    c.restore();
  }
  if (s.ball) {
    const b = s.ball;
    c.lineCap = "round";
    c.lineWidth = C.BALL_R * 1.4;
    for (let i = 1; i < b.trail.length; i++) {
      const p = b.trail[i - 1],
        q = b.trail[i];
      c.strokeStyle = `rgba(233,240,239,${0.05 + (0.3 * i) / b.trail.length})`;
      c.beginPath();
      c.moveTo(p.x, p.y);
      c.lineTo(q.x, q.y);
      c.stroke();
    }
    c.fillStyle = white;
    c.shadowColor = white;
    c.shadowBlur = 20;
    c.beginPath();
    c.arc(b.x, b.y, C.BALL_R, 0, Math.PI * 2);
    c.fill();
    c.shadowBlur = 0;
  }
  text(
    "CAROM / " + (s.mode === "solo" ? "SOLO DUEL" : "LOCAL VERSUS"),
    32,
    52,
    13,
    "#8ba1ac",
    "left",
  );
  text(String(s.score.p1), C.FIELD_CX - 100, 91, 64, cyan);
  text(String(s.score.p2), C.FIELD_CX + 100, 91, 64, coral);
  text("FIRST TO 11 · WIN BY 2", C.FIELD_CX, 126, 11, "#8ba1ac");
  text(
    s.muted ? "M / SOUND OFF" : "M / SOUND ON",
    C.FIELD_W - 32,
    52,
    12,
    "#8ba1ac",
    "right",
  );
  if (s.screen === "playing" || s.screen === "countdown") {
    text("W / S", 104, C.FIELD_H - 38, 12, cyan);
    text(
      s.mode === "solo" ? "AI" : "↑ / ↓",
      C.FIELD_W - 104,
      C.FIELD_H - 38,
      12,
      coral,
    );
    text("P / PAUSE", C.FIELD_CX, C.FIELD_H - 38, 12, "#8ba1ac");
    if (s.screen === "countdown") {
      text("READY", C.FIELD_CX, 292, 26);
      text(
        s.receiver === "left" ? "← SERVING LEFT" : "SERVING RIGHT →",
        C.FIELD_CX,
        440,
        12,
        "#8ba1ac",
      );
    }
  } else {
    c.fillStyle = "rgba(11,20,28,0.91)";
    c.fillRect(0, 0, C.FIELD_W, C.FIELD_H);
    text("THE ANGLE IS EVERYTHING", C.FIELD_CX, 142, 13, gold);
    if (s.screen === "title") {
      text(C.TITLE_TEXT, C.FIELD_CX, 262, 112);
      text("A paddle duel with a twist.", C.FIELD_CX, 307, 19, "#8ba1ac");
    }
    if (s.screen === "paused") {
      text("PAUSED", C.FIELD_CX, 263, 72);
      text("Take a breath. Find your angle.", C.FIELD_CX, 305, 18, "#8ba1ac");
    }
    if (s.screen === "matchover") {
      text(
        s.winner === "left"
          ? "PLAYER ONE WINS"
          : s.mode === "solo"
            ? "AI WINS"
            : "PLAYER TWO WINS",
        C.FIELD_CX,
        248,
        48,
        s.winner === "left" ? cyan : coral,
      );
      text(`${s.score.p1} : ${s.score.p2}`, C.FIELD_CX, 312, 38);
    }
    if (s.screen === "howto") {
      text("FIND YOUR ANGLE", C.FIELD_CX, 224, 54);
      const lines = [
        "MOVE   W / S on the left · ↑ / ↓ on the right",
        "SOLO   Either key pair controls your paddle",
        "SPIN   Strike while moving to curve the ball’s flight",
        "BANK   Use the rotating gold bars to redirect your shot",
        "WIN   First to 11, with a two-point lead",
        "P / ESC   Pause the duel     ·     M   Toggle sound",
      ];
      lines.forEach((line, i) =>
        text(line, C.FIELD_CX, 295 + i * 42, 18, i === 2 ? cyan : "#adbdc5"),
      );
    }
    items(s).forEach((item, i) => {
      const r = menuItemRect(s, i)!;
      const selected = s.menuIndex === i;
      c.fillStyle = selected ? "#20383f" : "#111f29";
      c.beginPath();
      c.roundRect(r.x, r.y, r.w, r.h, 8);
      c.fill();
      c.strokeStyle = selected ? cyan : "#2a3943";
      c.lineWidth = 1;
      c.stroke();
      text(item, C.FIELD_CX, r.y + 36, 18, selected ? cyan : white);
      if (selected) text("→", r.x + 28, r.y + 35, 20, cyan);
    });
    text(
      "W / S OR ↑ / ↓ TO SELECT     ·     ENTER TO PLAY",
      C.FIELD_CX,
      660,
      12,
      "#8ba1ac",
    );
  }
  c.restore();
}
