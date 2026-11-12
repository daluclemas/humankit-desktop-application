"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Pause,
  Play,
  Square,
  Volume2,
  VolumeX,
  Wind,
} from "lucide-react";
import BreathOrb from "./BreathOrb";
import { PATTERNS, Pacer, type Frame, type PhaseName } from "@/lib/breathing";
import { createBreathSound, type BreathSound } from "@/lib/breath-sound";
import {
  createPresageProvider,
  describeValidation,
  friendlyError,
} from "@/lib/presage";
import type { SignalProvider } from "@/types/signals";
import { giveCameraConsent, hasCameraConsent } from "@/lib/consent";
import CameraConsent from "@/components/CameraConsent";

const ACCENT = "#e49a43";
const SOFT = "#fff0dc";
// const LEAD_IN = 8; // seconds to get comfortable before the first breath
const CAMERA_WARMUP_SECONDS = 40;
const NO_CAMERA_LEAD_IN_SECONDS = 8;
const SYNC_WINDOW = 1.5; // breaths a minute: how close counts as "in sync"

type Phase = "setup" | "running" | "summary";
type Point = { t: number; v: number };

interface Snap {
  elapsed: number;
  left: number;
  guideRate: number | null;
  mRate: number | null;
  inSync: boolean;
  cycles: number;
  readings: number;
  traceOk: boolean;
  syncSec: number;
  measured: Point[];
  guide: Point[];
}
const EMPTY: Snap = {
  elapsed: 0,
  left: 0,
  guideRate: null,
  mRate: null,
  inSync: false,
  cycles: 0,
  readings: 0,
  traceOk: false,
  syncSec: 0,
  measured: [],
  guide: [],
};

const DURATIONS = [
  { s: 60, label: "1 min (test)" },
  { s: 180, label: "3 min" },
  { s: 300, label: "5 min" },
  { s: 600, label: "10 min" },
];

const WORDS: Record<PhaseName, string> = {
  ready: "Get comfortable",
  inhale: "Breathe in",
  "hold-in": "Hold",
  exhale: "Breathe out",
  "hold-out": "Rest",
};

const fmt = (s: number) => {
  const n = Math.max(0, Math.ceil(s));
  return `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`;
};
const median = (a: number[]) => {
  if (a.length === 0) return null;
  const s = [...a].sort((x, y) => x - y);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

export default function BreatheBuddySession() {
  const [phase, setPhase] = useState<Phase>("setup");
  const [patternId, setPatternId] = useState("adaptive");
  const [durationSec, setDurationSec] = useState(300);
  const [useCamera, setUseCamera] = useState(true);
  const [soundOn, setSoundOn] = useState(true);
  const [paused, setPaused] = useState(false);
  const [notice, setNotice] = useState("");
  const [consentOpen, setConsentOpen] = useState(false);
  const [validation, setValidation] = useState<number | null>(null);
  const [snap, setSnap] = useState<Snap>(EMPTY);
  const [final, setFinal] = useState<Snap | null>(null);
  const [label, setLabel] = useState<{ phase: PhaseName; sec: number } | null>(
    null,
  );
  const [reduced, setReduced] = useState(false);

  const pacer = useRef<Pacer>(null as unknown as Pacer);
  if (!pacer.current) pacer.current = new Pacer(PATTERNS[1]);
  const userFill = useRef<number | null>(null);
  const provider = useRef<SignalProvider | null>(null);
  const sound = useRef<BreathSound | null>(null);
  const video = useRef<HTMLVideoElement | null>(null);
  const stream = useRef<MediaStream | null>(null);

  const measured = useRef<Point[]>([]);
  const guideSeries = useRef<Point[]>([]);
  const lastGuideIdx = useRef(-1);
  const syncSec = useRef(0);
  const trace = useRef<Point[]>([]);
  const lastTraceAt = useRef(0);
  const finishing = useRef(false);
  const pausedRef = useRef(false);
  const soundOnRef = useRef(true);

  useEffect(() => {
    setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);
  useEffect(() => {
    soundOnRef.current = soundOn;
  }, [soundOn]);

  // Presage tells us here what it sees. BreatheBuddy only asks for breathing.
  const getProvider = useCallback(() => {
    if (!provider.current) {
      provider.current = createPresageProvider(
        {
          onBreathingRateReceived: (v) => {
            if (v > 3 && v < 40)
              measured.current.push({ t: pacer.current.elapsed, v });
          },
          // The live chest wave. We squash it to 0..1 so the orb can show it.
          onBreathTrace: (v) => {
            const n = performance.now();
            lastTraceAt.current = n;
            trace.current.push({ t: n, v });
            while (trace.current.length && n - trace.current[0].t > 10000)
              trace.current.shift();
            let lo = Infinity;
            let hi = -Infinity;
            for (const p of trace.current) {
              if (p.v < lo) lo = p.v;
              if (p.v > hi) hi = p.v;
            }
            if (hi - lo > 1e-6) userFill.current = (v - lo) / (hi - lo);
          },
          onStream: (s) => {
            stream.current = s;
            if (video.current) {
              video.current.srcObject = s;
              if (s) video.current.play().catch(() => {});
            }
          },
          onValidation: (code) => setValidation(code),
          onError: setNotice,
        },
        { breathingOnly: true },
      );
    }
    return provider.current;
  }, []);

  useEffect(() => {
    const el = video.current;
    if (!el || !stream.current) return;
    if (el.srcObject !== stream.current) el.srcObject = stream.current;
    el.play().catch(() => {});
  }, [phase]);

  const measure = useCallback((): Snap => {
    const p = pacer.current;
    const f = p.peek();
    const el = p.elapsed;
    const recent = measured.current
      .filter((m) => el - m.t <= 30)
      .map((m) => m.v);
    const mRate = recent.length >= 3 ? median(recent) : null;
    const live = f.phase !== "ready";
    if (live && f.cycleIndex !== lastGuideIdx.current) {
      lastGuideIdx.current = f.cycleIndex;
      guideSeries.current.push({ t: el, v: f.guideRate });
    }
    const traceOk = performance.now() - lastTraceAt.current < 2500;
    if (!traceOk) userFill.current = null;
    return {
      elapsed: el,
      left: Math.max(0, durationSec - el),
      guideRate: live ? f.guideRate : null,
      mRate,
      inSync:
        live && mRate !== null && Math.abs(mRate - f.guideRate) <= SYNC_WINDOW,
      cycles: f.cycleIndex,
      readings: measured.current.length,
      traceOk,
      syncSec: syncSec.current,
      measured: [...measured.current],
      guide: [...guideSeries.current],
    };
  }, [durationSec]);

  useEffect(() => {
    if (phase !== "running") return;
    const id = setInterval(() => {
      const s = measure();
      if (!pausedRef.current && s.inSync) syncSec.current += 1;
      setSnap({ ...s, syncSec: syncSec.current });
      if (pacer.current.finished) finish(true);
    }, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, measure]);

  useEffect(() => {
    return () => {
      provider.current?.destroy();
      sound.current?.stop();
    };
  }, []);

  // The orb calls these. Keep them light: they run every picture.
  const onFrame = useCallback((f: Frame) => {
    sound.current?.update(
      f.fullness,
      pausedRef.current || !soundOnRef.current ? 0 : 1,
    );
  }, []);
  const onPhase = useCallback((f: Frame) => {
    setLabel({ phase: f.phase, sec: Math.ceil(f.secondsLeft) });
  }, []);

  // async function begin() {
  //   setNotice("");
  //   if (useCamera && !hasCameraConsent()) {
  //     setConsentOpen(true);
  //     return;
  //   }
  //   const pattern =
  //     PATTERNS.find(
  //       (p: ConstructorParameters<typeof Pacer>[0]) => p.id === patternId,
  //     ) ?? PATTERNS[1];
  //   measured.current = [];
  //   guideSeries.current = [];
  //   lastGuideIdx.current = -1;
  //   syncSec.current = 0;
  //   trace.current = [];
  //   userFill.current = null;
  //   finishing.current = false;
  //   pausedRef.current = false;
  //   pacer.current = new Pacer(
  //     pattern,
  //     LEAD_IN,
  //     () => {
  //       const v = median(measured.current.slice(-8).map((m) => m.v));
  //       return measured.current.length >= 3 ? v : null;
  //     },
  //     durationSec,
  //   );
  //   sound.current?.stop();
  //   sound.current = createBreathSound();
  //   sound.current.start();
  //   setSnap({ ...EMPTY, left: durationSec });
  //   setPaused(false);
  //   setFinal(null);
  //   setLabel(null);
  //   setValidation(null);
  //   setPhase("running");
  //   if (useCamera) {
  //     try {
  //       await getProvider().start();
  //     } catch (err) {
  //       console.warn(err);
  //       setNotice(
  //         `${friendlyError(err)} The guide still works without the camera.`,
  //       );
  //     }
  //   }
  // }

  async function begin() {
    setNotice("");

    if (useCamera && !hasCameraConsent()) {
      setConsentOpen(true);
      return;
    }

    const pattern =
      PATTERNS.find(
        (p: ConstructorParameters<typeof Pacer>[0]) => p.id === patternId,
      ) ?? PATTERNS[1];

    measured.current = [];
    guideSeries.current = [];
    lastGuideIdx.current = -1;
    syncSec.current = 0;
    trace.current = [];
    userFill.current = null;
    lastTraceAt.current = 0;
    finishing.current = false;
    pausedRef.current = false;

    let cameraStarted = false;

    // Start the camera and SDK BEFORE starting the guide's warm-up.
    if (useCamera) {
      try {
        await getProvider().start();
        cameraStarted = true;
      } catch (err) {
        console.warn(err);

        setNotice(
          `${friendlyError(err)} The guide will still work without camera measurements.`,
        );
      }
    }

    const leadIn = cameraStarted
      ? CAMERA_WARMUP_SECONDS
      : NO_CAMERA_LEAD_IN_SECONDS;

    pacer.current = new Pacer(
      pattern,
      leadIn,
      () => {
        const values = measured.current
          .slice(-8)
          .map((measurement) => measurement.v);

        return values.length >= 2 ? median(values) : null;
      },
      durationSec,
    );

    sound.current?.stop();
    sound.current = createBreathSound();
    sound.current.start();

    setSnap({ ...EMPTY, left: durationSec });
    setPaused(false);
    setFinal(null);
    setLabel(null);
    setValidation(null);

    setPhase("running");
  }

  function finish(completed: boolean) {
    if (finishing.current) return;
    finishing.current = true;
    const s = measure();
    if (completed) sound.current?.chime();
    sound.current?.stop();
    sound.current = null;
    provider.current?.stop().catch(() => {});
    userFill.current = null;
    save(s);
    pacer.current = new Pacer(PATTERNS[1]);
    setLabel(null);
    setFinal(s);
    setPhase("summary");
  }

  function save(s: Snap) {
    if (s.elapsed < 10) return;
    const pattern =
      PATTERNS.find(
        (p: ConstructorParameters<typeof Pacer>[0]) => p.id === patternId,
      ) ?? PATTERNS[1];
    const mins = Math.max(1, Math.round(s.elapsed / 60));
    const pace = pacePair(s);
    try {
      const old = JSON.parse(localStorage.getItem("humankit-sessions") || "[]");
      const entry = {
        id: Date.now(),
        tool: "BreatheBuddy",
        date: new Date().toISOString(),
        duration: Math.floor(s.elapsed),
        measurement: `${pattern.name} · ${s.cycles} breaths guided${
          pace
            ? ` · your pace about ${pace.start.toFixed(0)} → ${pace.end.toFixed(0)}/min`
            : ""
        }`,
        topic: `${mins} min`,
      };
      localStorage.setItem(
        "humankit-sessions",
        JSON.stringify([entry, ...old]),
      );
    } catch (err) {
      console.warn(err);
    }
  }

  function togglePause() {
    const next = !pausedRef.current;
    pausedRef.current = next;
    pacer.current.paused = next;
    setPaused(next);
  }

  function again() {
    setPhase("setup");
    setNotice("");
  }

  const caption = phase === "summary" ? "Well done" : null;
  const showWord = label && !caption;

  return (
    <div className="mx-auto max-w-6xl">
      <Link
        href="/dashboard"
        className="my-7 flex items-center gap-2 text-sm font-medium text-[#718096]"
      >
        <ArrowLeft size={15} /> Back to dashboard
      </Link>

      <div className="mb-6">
        <div
          className="mb-3 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold"
          style={{ background: SOFT, color: ACCENT }}
        >
          <Wind size={13} /> Guided breathing
        </div>
        <h1 className="text-3xl font-bold tracking-[-.03em]">BreatheBuddy</h1>
        <p className="mt-2 text-[#718096]">
          Follow the light. Breathe in as it grows, out as it fades.
        </p>
      </div>

      {notice && (
        <p className="mb-5 rounded-xl bg-[#fff6e5] p-3 text-sm text-[#8a5a12]">
          {notice}
        </p>
      )}

      <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
        {/* ---------- THE ORB ---------- */}
        <section
          className="relative h-115 overflow-hidden rounded-3xl sm:h-145"
          style={{
            background:
              "radial-gradient(ellipse at 50% 42%, #1c1a4a 0%, #0c0e26 55%, #070816 100%)",
          }}
        >
          <div className="absolute inset-0">
            <BreathOrb
              pacerRef={pacer}
              userFillRef={userFill}
              onFrame={onFrame}
              onPhase={onPhase}
              reducedMotion={reduced}
            />
          </div>

          {/* words in the middle */}
          <div className="pointer-events-none absolute inset-0 grid place-items-center text-center text-white">
            <div
              style={{
                textShadow:
                  "0 0 22px rgba(24,12,70,.95), 0 0 8px rgba(24,12,70,.9), 0 1px 2px rgba(24,12,70,.8)",
              }}
            >
              <p className="text-lg font-semibold tracking-wide sm:text-xl">
                {caption ?? (showWord ? WORDS[label.phase] : "")}
              </p>
              {/* {showWord &&
                label.phase !== "ready" &&
                label.sec > 0 &&
                !paused && (
                  <p className="mt-1 text-5xl font-extralight tabular-nums">
                    {label.sec}
                  </p>
                )} */}

              {showWord && label.sec > 0 && !paused && (
                <p className="mt-1 text-5xl font-extralight tabular-nums">
                  {label.sec}
                </p>
              )}
              {paused && <p className="mt-2 text-sm text-white/70">Paused</p>}
            </div>
          </div>

          {phase === "running" && snap.inSync && (
            <div
              className="absolute left-4 top-4 rounded-full px-3 py-1 text-xs font-semibold"
              style={{ background: "rgba(255,178,84,.18)", color: "#ffd9a0" }}
            >
              In sync with you
            </div>
          )}
          {phase === "running" && (
            <button
              onClick={() => setSoundOn((v) => !v)}
              className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full bg-white/10 text-white/80"
              aria-label={soundOn ? "Turn sound off" : "Turn sound on"}
            >
              {soundOn ? <Volume2 size={16} /> : <VolumeX size={16} />}
            </button>
          )}
          {phase === "running" && snap.traceOk && (
            <p className="absolute bottom-4 left-0 right-0 text-center text-[11px] text-white/50">
              The dotted ring is your own chest. Match it to the light.
            </p>
          )}
        </section>

        {/* ---------- THE SIDE ---------- */}
        <aside className="space-y-5">
          {phase === "setup" && (
            <div className="rounded-2xl border border-[#e7e8f0] bg-white p-6">
              <h2 className="font-semibold">Choose a rhythm</h2>
              <div className="mt-3 space-y-2">
                {PATTERNS.map((p: ConstructorParameters<typeof Pacer>[0]) => (
                  <button
                    key={p.id}
                    onClick={() => setPatternId(p.id)}
                    className="w-full rounded-xl border p-3 text-left"
                    style={
                      patternId === p.id
                        ? { background: SOFT, borderColor: ACCENT }
                        : { borderColor: "#e7e8f0" }
                    }
                  >
                    <span className="flex items-baseline justify-between">
                      <span className="text-sm font-semibold">{p.name}</span>
                      <span className="text-xs text-[#8992a6]">{p.shape}</span>
                    </span>
                    <span className="mt-1 block text-xs leading-5 text-[#718096]">
                      {p.blurb}
                    </span>
                  </button>
                ))}
              </div>

              <p className="mt-5 text-sm font-semibold">How long?</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {DURATIONS.map((d) => (
                  <button
                    key={d.s}
                    onClick={() => setDurationSec(d.s)}
                    className="rounded-xl border px-3 py-1.5 text-sm font-medium"
                    style={
                      durationSec === d.s
                        ? {
                            background: SOFT,
                            borderColor: ACCENT,
                            color: "#a4661b",
                          }
                        : { borderColor: "#e7e8f0", color: "#718096" }
                    }
                  >
                    {d.label}
                  </button>
                ))}
              </div>

              <label className="mt-5 flex items-start gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={useCamera}
                  onChange={(e) => setUseCamera(e.target.checked)}
                  className="mt-1"
                />
                <span>
                  <span className="font-medium">
                    Use my camera to see my breathing
                  </span>
                  <span className="block text-xs leading-5 text-[#8992a6]">
                    Sit back so your face and shoulders are in view. Not a
                    medical measurement. You can turn this off and still use the
                    guide.
                  </span>
                </span>
              </label>
              <label className="mt-3 flex items-center gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={soundOn}
                  onChange={(e) => setSoundOn(e.target.checked)}
                />
                <span className="font-medium">Soft sound</span>
              </label>

              <button
                onClick={begin}
                className="mt-6 flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-white"
                style={{ background: ACCENT }}
              >
                <Play size={15} fill="currentColor" /> Begin
              </button>
            </div>
          )}

          {phase === "running" && (
            <>
              <div className="grid grid-cols-3 gap-3">
                <Stat label="Time left" value={fmt(snap.left)} />
                <Stat
                  label="Guide / min"
                  value={
                    snap.guideRate === null ? "—" : snap.guideRate.toFixed(1)
                  }
                />
                <Stat
                  label="You / min"
                  value={snap.mRate === null ? "—" : snap.mRate.toFixed(0)}
                />
              </div>

              <PaceChart
                measured={snap.measured}
                guide={snap.guide}
                duration={Math.max(snap.elapsed, 60)}
              />

              {useCamera && (
                <div className="rounded-2xl border border-[#e7e8f0] bg-white p-4">
                  <div className="flex gap-3">
                    <video
                      ref={video}
                      muted
                      playsInline
                      className="h-20 w-28 shrink-0 -scale-x-100 rounded-lg bg-[#20283d] object-cover"
                    />
                    <div className="text-xs leading-5 text-[#718096]">
                      <p>
                        {validation === null
                          ? "Starting the camera..."
                          : describeValidation(validation)}
                      </p>
                      <p className="mt-1 text-[#8992a6]">
                        {/* {snap.readings === 0
                          ? "No breathing readings yet. This can take about 20 seconds."
                          : `Breathing readings: ${snap.readings}`} */}
                        {snap.readings === 0
                          ? "Breathing measurements need a full 30-second camera window. Please keep your face and chest visible and stay still."
                          : `Breathing readings: ${snap.readings}`}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={togglePause}
                  className="flex items-center gap-2 rounded-xl bg-[#f3f3f7] px-4 py-2.5 text-sm font-semibold"
                >
                  {paused ? (
                    <>
                      <Play size={14} fill="currentColor" /> Resume
                    </>
                  ) : (
                    <>
                      <Pause size={14} /> Pause
                    </>
                  )}
                </button>
                <button
                  onClick={() => finish(false)}
                  className="flex items-center gap-2 rounded-xl border border-[#efcaca] px-4 py-2.5 text-sm font-semibold text-[#c86b6b]"
                >
                  <Square size={13} fill="currentColor" /> End
                </button>
              </div>
            </>
          )}

          {phase === "summary" && final && (
            <Summary s={final} onAgain={again} />
          )}
        </aside>
      </div>

      {consentOpen && (
        <CameraConsent
          onAgree={() => {
            giveCameraConsent();
            setConsentOpen(false);
            begin();
          }}
          onCancel={() => setConsentOpen(false)}
        />
      )}
    </div>
  );
}

// Your pace at the start and end of the session, if the camera saw it.
function pacePair(s: Snap): { start: number; end: number } | null {
  if (s.elapsed < 90) return null;
  const a = median(s.measured.filter((m) => m.t <= 45).map((m) => m.v));
  const b = median(
    s.measured.filter((m) => m.t >= s.elapsed - 45).map((m) => m.v),
  );
  const na = s.measured.filter((m) => m.t <= 45).length;
  const nb = s.measured.filter((m) => m.t >= s.elapsed - 45).length;
  return a !== null && b !== null && na >= 3 && nb >= 3
    ? { start: a, end: b }
    : null;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[#e7e8f0] bg-white p-4">
      <p className="text-[11px] uppercase tracking-wider text-[#8992a6]">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

// Two lines: the pace we ask for (dashed) and the pace the camera sees.
function PaceChart({
  measured,
  guide,
  duration,
}: {
  measured: Point[];
  guide: Point[];
  duration: number;
}) {
  const W = 600;
  const H = 150;
  const PAD = 8;
  const all = [...measured, ...guide].map((p) => p.v);
  const lo = Math.min(4, ...all) - 1;
  const hi = Math.max(20, ...all) + 1;
  const x = (t: number) => PAD + (t / duration) * (W - 2 * PAD);
  const y = (v: number) => H - PAD - ((v - lo) / (hi - lo)) * (H - 2 * PAD);
  const line = (pts: Point[]) =>
    pts.map((p) => `${x(p.t)},${y(p.v)}`).join(" ");
  return (
    <div className="rounded-2xl border border-[#e7e8f0] bg-white p-5">
      <h3 className="text-sm font-semibold">Breaths per minute</h3>
      {guide.length < 2 ? (
        <p className="mt-4 flex h-27.5 items-center justify-center rounded-lg bg-[#fafafd] text-xs text-[#8992a6]">
          The chart starts after the first breaths.
        </p>
      ) : (
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="mt-3 h-27.5 w-full"
          role="img"
          aria-label="Breaths per minute"
        >
          <polyline
            fill="none"
            stroke="#9aa2b3"
            strokeWidth={2}
            strokeDasharray="6 5"
            points={line(guide)}
          />
          {measured.length > 1 && (
            <polyline
              fill="none"
              stroke={ACCENT}
              strokeWidth={2.5}
              strokeLinejoin="round"
              strokeLinecap="round"
              points={line(measured)}
            />
          )}
        </svg>
      )}
      <p className="mt-2 text-[11px] text-[#8992a6]">
        Dashed = the guide. Solid = your breathing, from the camera.
      </p>
    </div>
  );
}

function Summary({ s, onAgain }: { s: Snap; onAgain: () => void }) {
  const pace = pacePair(s);
  const g0 = s.guide[0]?.v;
  const g1 = s.guide.at(-1)?.v;
  const syncPct = s.elapsed > 0 ? Math.round((s.syncSec / s.elapsed) * 100) : 0;
  const lines: string[] = [];
  if (g0 && g1)
    lines.push(
      `The guide went from ${g0.toFixed(0)} to ${g1.toFixed(0)} breaths a minute.`,
    );
  if (pace)
    lines.push(
      `Your own pace was about ${pace.start.toFixed(0)} at the start and ${pace.end.toFixed(0)} at the end.`,
    );
  else if (s.readings > 0)
    lines.push(
      "The camera saw some of your breathing, but not enough to compare the start and end.",
    );
  else
    lines.push(
      "The camera did not pick up your breathing this time. The guide worked without it.",
    );
  if (s.syncSec >= 10)
    lines.push(
      `You were in sync with the light for about ${syncPct}% of the time.`,
    );
  return (
    <div className="rounded-2xl border border-[#e7e8f0] bg-white p-6">
      <h2 className="text-lg font-bold">Nice work</h2>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <Stat label="Time" value={fmt(s.elapsed)} />
        <Stat label="Breaths guided" value={String(s.cycles)} />
      </div>
      <ul className="mt-5 list-disc space-y-1 pl-5 text-sm leading-6 text-[#3d4660]">
        {lines.map((l) => (
          <li key={l}>{l}</li>
        ))}
      </ul>
      <p className="mt-4 text-xs text-[#8992a6]">
        Breathing numbers are estimates from the camera, not a medical
        measurement. Saved on this computer only.
      </p>
      <div className="mt-5 flex gap-3">
        <button
          onClick={onAgain}
          className="rounded-xl px-5 py-3 text-sm font-semibold text-white"
          style={{ background: ACCENT }}
        >
          Breathe again
        </button>
        <Link
          href="/history"
          className="rounded-xl bg-[#f3f3f7] px-5 py-3 text-sm font-semibold text-[#3d4660]"
        >
          See history
        </Link>
      </div>
    </div>
  );
}
