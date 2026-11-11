"use client";
import { useEffect, useRef, type MutableRefObject } from "react";
import type { Frame, Pacer } from "@/lib/breathing";

type RGB = [number, number, number];
const TAU = Math.PI * 2;
const INDIGO: RGB = [84, 72, 214];
const ROSE: RGB = [255, 112, 150];
const AMBER: RGB = [255, 178, 84];

const mixN = (a: number, b: number, t: number) => a + (b - a) * t;
const mixC = (a: RGB, b: RGB, t: number): RGB => [
  mixN(a[0], b[0], t),
  mixN(a[1], b[1], t),
  mixN(a[2], b[2], t),
];
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
// Empty lungs = deep indigo. Half = rose. Full = warm amber light.
function palette(f: number): RGB {
  const t = clamp01(f);
  return t < 0.5 ? mixC(INDIGO, ROSE, t * 2) : mixC(ROSE, AMBER, (t - 0.5) * 2);
}
const rgba = (c: RGB, a: number) =>
  `rgba(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])},${a})`;

interface Mote {
  a: number; // angle around the orb
  d: number; // distance from the orb, as a fraction of the stage size
  spin: number;
  seed: number;
  size: number;
}
const newMote = (anywhere: boolean): Mote => ({
  a: Math.random() * TAU,
  d: anywhere ? 0.12 + Math.random() * 0.5 : 0.5 + Math.random() * 0.12,
  spin: (Math.random() - 0.5) * 0.22,
  seed: Math.random(),
  size: 0.6 + Math.random() * 1.6,
});

const LAYERS = [
  { s: 1.0, k: [2, 3, 5], w: [0.35, -0.27, 0.5] },
  { s: 0.93, k: [3, 4, 6], w: [-0.31, 0.42, -0.36] },
  { s: 0.86, k: [2, 5, 7], w: [0.44, -0.2, 0.33] },
  { s: 0.78, k: [3, 5, 8], w: [-0.26, 0.38, -0.47] },
  { s: 0.68, k: [4, 6, 9], w: [0.3, -0.45, 0.25] },
];

export default function BreathOrb({
  pacerRef,
  userFillRef,
  onFrame,
  onPhase,
  reducedMotion = false,
}: {
  pacerRef: MutableRefObject<Pacer>;
  // 0..1 chest position measured by the camera, or null when unknown.
  userFillRef?: MutableRefObject<number | null>;
  onFrame?: (f: Frame) => void;
  onPhase?: (f: Frame) => void;
  reducedMotion?: boolean;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const cbs = useRef({ onFrame, onPhase });
  useEffect(() => {
    cbs.current = { onFrame, onPhase };
  });

  useEffect(() => {
    const cvs = canvas.current;
    const box = wrap.current;
    const ctx = cvs?.getContext("2d");
    if (!cvs || !box || !ctx) return;

    let w = 0;
    let h = 0;
    let dpr = 1;
    const resize = () => {
      const r = box.getBoundingClientRect();
      dpr = Math.min(2, window.devicePixelRatio || 1);
      w = r.width;
      h = r.height;
      cvs.width = Math.max(1, Math.round(w * dpr));
      cvs.height = Math.max(1, Math.round(h * dpr));
    };
    const ro = new ResizeObserver(resize);
    ro.observe(box);
    resize();

    const motes = Array.from({ length: reducedMotion ? 40 : 190 }, () =>
      newMote(true),
    );
    const stars = Array.from({ length: 70 }, () => ({
      x: Math.random(),
      y: Math.random(),
      r: Math.random() * 1.1 + 0.3,
      p: Math.random() * TAU,
    }));
    const ripples: { age: number }[] = [];
    let ghost = 0; // smoothed position of the person's own chest

    let last = performance.now();
    let time = 0;
    let raf = 0;
    let lastPhase = "";
    let lastSec = -1;

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      time += dt;

      const fr = pacerRef.current.advance(dt);
      cbs.current.onFrame?.(fr);
      const sec = Math.ceil(fr.secondsLeft);
      if (fr.phase !== lastPhase || sec !== lastSec) {
        if (fr.phase === "exhale" && lastPhase !== "exhale" && lastPhase !== "")
          ripples.push({ age: 0 });
        lastPhase = fr.phase;
        lastSec = sec;
        cbs.current.onPhase?.(fr);
      }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.globalCompositeOperation = "source-over";
      ctx.clearRect(0, 0, w, h);

      const S = Math.min(w, h);
      const cx = w / 2;
      const cy = h / 2;
      const f = fr.fullness;
      const vel = Math.abs(fr.velocity);
      const Rmin = S * 0.17;
      const Rmax = S * 0.3;
      const R = mixN(Rmin, Rmax, f);
      const col = palette(f);

      // twinkling stars
      for (const s of stars) {
        const a = 0.12 + 0.28 * (0.5 + 0.5 * Math.sin(time * 0.8 + s.p));
        ctx.fillStyle = `rgba(255,255,255,${a})`;
        ctx.beginPath();
        ctx.arc(s.x * w, s.y * h, s.r, 0, TAU);
        ctx.fill();
      }

      ctx.globalCompositeOperation = "lighter";

      // big soft light around the orb
      let g = ctx.createRadialGradient(cx, cy, R * 0.3, cx, cy, R * 3);
      g.addColorStop(0, rgba(col, 0.32 + 0.22 * f));
      g.addColorStop(0.45, rgba(col, 0.1 + 0.08 * f));
      g.addColorStop(1, rgba(col, 0));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);

      // light motes: they flow INTO the orb as you breathe in, OUT as you breathe out
      const Rn = R / S;
      for (const m of motes) {
        m.a += m.spin * dt;
        m.d += (-fr.velocity * 0.42 * (0.55 + m.seed * 0.9) + 0.004) * dt;
        const dmax = 0.62;
        if (m.d < Rn + 0.015) {
          m.d = 0.5 + Math.random() * 0.12;
          m.a = Math.random() * TAU;
        } else if (m.d > dmax) {
          m.d = Rn + 0.02;
          m.a = Math.random() * TAU;
        }
        const near = clamp01(1 - (m.d - Rn) / (dmax - Rn));
        const alpha =
          Math.pow(near, 1.3) *
          (0.25 + 0.6 * m.seed) *
          (reducedMotion ? 0.6 : 1);
        const x = cx + Math.cos(m.a) * m.d * S;
        const y = cy + Math.sin(m.a) * m.d * S;
        ctx.fillStyle = rgba(palette(f + (m.seed - 0.5) * 0.3), alpha);
        ctx.beginPath();
        ctx.arc(x, y, m.size * (0.8 + 0.5 * near), 0, TAU);
        ctx.fill();
      }

      // the orb: five soft, wobbling layers of glass
      const amp =
        (0.026 + 0.05 * Math.min(1, vel * 2.4)) * (reducedMotion ? 0.35 : 1);
      let outer: Path2D | null = null;
      LAYERS.forEach((L, i) => {
        const lc = palette(f + (i - 2) * 0.07);
        const path = new Path2D();
        const M = 120;
        for (let j = 0; j <= M; j++) {
          const th = (j / M) * TAU;
          let n = 0;
          for (let q = 0; q < 3; q++)
            n +=
              Math.sin(th * L.k[q] + time * L.w[q] + i * 1.7 + q) / (q + 1.4);
          const r = R * L.s * (1 + amp * n);
          const x = cx + Math.cos(th) * r;
          const y = cy + Math.sin(th) * r;
          if (j === 0) path.moveTo(x, y);
          else path.lineTo(x, y);
        }
        path.closePath();
        const gr = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * L.s * 1.12);
        gr.addColorStop(0, rgba(lc, 0.1));
        gr.addColorStop(0.7, rgba(lc, 0.26));
        gr.addColorStop(1, rgba(lc, 0.62));
        ctx.fillStyle = gr;
        ctx.fill(path);
        if (i === 0) outer = path;
      });

      // bright core
      g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 0.75);
      g.addColorStop(0, `rgba(255,255,255,${0.5 + 0.3 * f})`);
      g.addColorStop(1, rgba(col, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx, cy, R * 0.75, 0, TAU);
      ctx.fill();

      // glassy rim
      if (outer) {
        ctx.lineWidth = 1.4;
        ctx.strokeStyle = "rgba(255,255,255,0.22)";
        ctx.stroke(outer);
      }

      // ripple that leaves the orb at the start of each breath out
      for (let i = ripples.length - 1; i >= 0; i--) {
        const rp = ripples[i];
        rp.age += dt;
        const k = rp.age / 2.8;
        if (k >= 1) {
          ripples.splice(i, 1);
          continue;
        }
        ctx.lineWidth = 2 * (1 - k) + 0.5;
        ctx.strokeStyle = rgba(col, 0.4 * Math.pow(1 - k, 2));
        ctx.beginPath();
        ctx.arc(cx, cy, Rmax * (1.02 + k * 1.1), 0, TAU);
        ctx.stroke();
      }

      // the cycle ring: fills as one whole breath goes round
      const RR = Rmax * 1.42;
      ctx.lineWidth = 2;
      ctx.strokeStyle = "rgba(255,255,255,0.09)";
      ctx.beginPath();
      ctx.arc(cx, cy, RR, 0, TAU);
      ctx.stroke();
      const a0 = -Math.PI / 2;
      const a1 = a0 + TAU * fr.cycleProgress;
      ctx.lineCap = "round";
      ctx.lineWidth = 3;
      ctx.strokeStyle = rgba(col, 0.85);
      ctx.beginPath();
      ctx.arc(cx, cy, RR, a0, Math.max(a0 + 0.001, a1));
      ctx.stroke();
      for (const mk of fr.marks) {
        const ma = a0 + TAU * mk;
        ctx.fillStyle = "rgba(255,255,255,0.35)";
        ctx.beginPath();
        ctx.arc(cx + Math.cos(ma) * RR, cy + Math.sin(ma) * RR, 2.2, 0, TAU);
        ctx.fill();
      }
      const hx = cx + Math.cos(a1) * RR;
      const hy = cy + Math.sin(a1) * RR;
      g = ctx.createRadialGradient(hx, hy, 0, hx, hy, 16);
      g.addColorStop(0, "rgba(255,255,255,0.95)");
      g.addColorStop(0.3, rgba(col, 0.6));
      g.addColorStop(1, rgba(col, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(hx, hy, 16, 0, TAU);
      ctx.fill();

      // YOUR chest, as measured by the camera: a thin ghost ring that
      // follows your real breathing. Match the orb to breathe in sync.
      const uf = userFillRef?.current;
      if (uf != null) {
        ghost += (uf - ghost) * Math.min(1, dt * 6);
        const gr = mixN(Rmin, Rmax, clamp01(ghost));
        ctx.lineWidth = 2;
        ctx.setLineDash([3, 7]);
        ctx.strokeStyle = "rgba(190,240,255,0.7)";
        ctx.beginPath();
        ctx.arc(cx, cy, gr * 1.08, 0, TAU);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [pacerRef, userFillRef, reducedMotion]);

  return (
    <div ref={wrap} className="h-full w-full">
      <canvas ref={canvas} className="block h-full w-full" />
    </div>
  );
}
