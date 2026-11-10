"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Coffee, Eye, Play, Square } from "lucide-react";
import {
  createPresageProvider,
  describeValidation,
  friendlyError,
} from "@/lib/presage";
import type { SignalProvider } from "@/types/signals";
import { giveCameraConsent, hasCameraConsent } from "@/lib/consent";
import CameraConsent from "@/components/CameraConsent";

const ACCENT = "#2fae9e";
const SOFT = "#ddf5f0";
const BREAK_SECONDS = 20;
const LOW_RATE = 8; // blinks per minute that we call "slow"
const LONG_GAP = 15; // seconds without a blink that we call "a long stare"

type Phase = "setup" | "starting" | "running" | "summary";
type Point = { t: number; v: number }; // t = seconds since start

interface Snap {
  elapsed: number;
  total: number;
  rate: number | null;
  gapNow: number;
  longestGap: number;
  breaks: number;
  skipped: number;
  nextIn: number;
  onBreak: boolean;
  breakLeft: number;
  signalOk: boolean;
  series: Point[];
}

const EMPTY: Snap = {
  elapsed: 0,
  total: 0,
  rate: null,
  gapNow: 0,
  longestGap: 0,
  breaks: 0,
  skipped: 0,
  nextIn: 0,
  onBreak: false,
  breakLeft: 0,
  signalOk: false,
  series: [],
};

const fmt = (s: number) => {
  const n = Math.max(0, Math.floor(s));
  return `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`;
};

export default function ScreenBreakSession() {
  const [phase, setPhase] = useState<Phase>("setup");
  const [intervalMin, setIntervalMin] = useState(20);
  const [notice, setNotice] = useState("");
  const [consentOpen, setConsentOpen] = useState(false);
  const [validation, setValidation] = useState<{
    code: number;
    hint: string;
  } | null>(null);
  const [snap, setSnap] = useState<Snap>(EMPTY);
  const [final, setFinal] = useState<Snap | null>(null);

  const provider = useRef<SignalProvider | null>(null);
  const video = useRef<HTMLVideoElement | null>(null);
  const stream = useRef<MediaStream | null>(null);

  const t0 = useRef(0);
  const intervalMs = useRef(20 * 60000);
  const blinkTimes = useRef<number[]>([]);
  const lastBlinking = useRef(false);
  const lastSignalAt = useRef(0);
  const signalSeen = useRef(false);
  const lastBlinkAt = useRef(0);
  const longestGap = useRef(0);
  const series = useRef<Point[]>([]);
  const breaks = useRef(0);
  const skipped = useRef(0);
  const breakEnd = useRef<number | null>(null);
  const nextBreakAt = useRef(0);

  // Presage tells us here what it sees.
  const getProvider = useCallback(() => {
    if (!provider.current) {
      provider.current = createPresageProvider(
        {
          onBlinkDetected: (blinking) => {
            const n = Date.now();
            if (!signalSeen.current) {
              signalSeen.current = true;
              lastBlinkAt.current = n;
            }
            lastSignalAt.current = n;
            // A blink = the moment the eyes go from open to closed.
            if (blinking && !lastBlinking.current) {
              blinkTimes.current.push(n);
              longestGap.current = Math.max(
                longestGap.current,
                (n - lastBlinkAt.current) / 1000,
              );
              lastBlinkAt.current = n;
            }
            lastBlinking.current = blinking;
          },
          onStream: (s) => {
            stream.current = s;
            if (video.current) {
              video.current.srcObject = s;
              if (s) video.current.play().catch(() => {});
            }
          },
          onValidation: (code, hint) => setValidation({ code, hint }),
          onError: setNotice,
        },
        { faceOnly: true },
      );
    }
    return provider.current;
  }, []);

  // The <video> appears after the screen changes, so connect the saved
  // stream to it as soon as it is on the page.
  useEffect(() => {
    const el = video.current;
    if (!el || !stream.current) return;
    if (el.srcObject !== stream.current) el.srcObject = stream.current;
    el.play().catch(() => {});
  }, [phase]);

  // Work out the numbers (also used for the final summary).
  const measure = useCallback((): Snap => {
    const n = Date.now();
    const elapsed = (n - t0.current) / 1000;

    // Break timing
    if (breakEnd.current === null && n >= nextBreakAt.current) {
      breakEnd.current = n + BREAK_SECONDS * 1000;
    } else if (breakEnd.current !== null && n >= breakEnd.current) {
      breakEnd.current = null;
      breaks.current += 1;
      nextBreakAt.current = n + intervalMs.current;
    }

    const signalOk = n - lastSignalAt.current < 4000;
    const win = Math.min(60, elapsed);
    const recent = blinkTimes.current.filter((t) => n - t <= 60000).length;
    const rate = signalSeen.current && win >= 20 ? (recent * 60) / win : null;

    const gapNow = signalOk ? (n - lastBlinkAt.current) / 1000 : 0;
    longestGap.current = Math.max(longestGap.current, gapNow);

    const last = series.current.at(-1);
    if (rate !== null && (!last || elapsed - last.t >= 5)) {
      series.current.push({ t: elapsed, v: rate });
    }

    return {
      elapsed,
      total: blinkTimes.current.length,
      rate,
      gapNow,
      longestGap: longestGap.current,
      breaks: breaks.current,
      skipped: skipped.current,
      nextIn: Math.max(0, (nextBreakAt.current - n) / 1000),
      onBreak: breakEnd.current !== null,
      breakLeft: breakEnd.current ? (breakEnd.current - n) / 1000 : 0,
      signalOk,
      series: [...series.current],
    };
  }, []);

  useEffect(() => {
    if (phase !== "running") return;
    const id = setInterval(() => setSnap(measure()), 1000);
    return () => clearInterval(id);
  }, [phase, measure]);

  // Stop the camera when leaving the page.
  useEffect(() => {
    return () => provider.current?.destroy();
  }, []);

  async function begin() {
    setNotice("");
    if (!hasCameraConsent()) {
      setConsentOpen(true);
      return;
    }
    intervalMs.current = intervalMin * 60000;
    t0.current = Date.now();
    nextBreakAt.current = t0.current + intervalMs.current;
    blinkTimes.current = [];
    lastBlinking.current = false;
    lastSignalAt.current = 0;
    signalSeen.current = false;
    lastBlinkAt.current = t0.current;
    longestGap.current = 0;
    series.current = [];
    breaks.current = 0;
    skipped.current = 0;
    breakEnd.current = null;
    setValidation(null);
    setSnap(EMPTY);
    setPhase("starting");
    try {
      await getProvider().start();
      setPhase("running");
    } catch (err) {
      console.warn(err);
      setNotice(friendlyError(err));
      setPhase("setup");
    }
  }

  async function finish() {
    const s = measure();
    setFinal(s);
    try {
      await provider.current?.stop();
    } catch {
      // already stopped
    }
    save(s);
    setPhase("summary");
  }

  function save(s: Snap) {
    if (s.elapsed < 10) return;
    const avg = (s.total * 60) / s.elapsed;
    try {
      const old = JSON.parse(localStorage.getItem("humankit-sessions") || "[]");
      const entry = {
        id: Date.now(),
        tool: "ScreenBreak",
        date: new Date().toISOString(),
        duration: Math.floor(s.elapsed),
        measurement:
          s.signalOk || s.total > 0
            ? `${s.total} blinks · about ${avg.toFixed(0)}/min · ${s.breaks} breaks`
            : `${s.breaks} breaks (no blink readings)`,
      };
      localStorage.setItem(
        "humankit-sessions",
        JSON.stringify([entry, ...old]),
      );
    } catch (err) {
      console.warn(err);
    }
  }

  function breakNow() {
    nextBreakAt.current = Date.now();
    setSnap(measure());
  }

  function skipBreak() {
    breakEnd.current = null;
    skipped.current += 1;
    nextBreakAt.current = Date.now() + intervalMs.current;
    setSnap(measure());
  }

  // ---- what to tell the person right now ----
  let nudge = "";
  if (phase === "running" && !snap.onBreak && snap.signalOk) {
    if (snap.gapNow >= LONG_GAP)
      nudge = "You have been staring for a while. Blink slowly a few times.";
    else if (snap.rate !== null && snap.rate < LOW_RATE)
      nudge = "Your blinking is slow right now. Try a few full, gentle blinks.";
  }

  return (
    <div className="mx-auto max-w-6xl">
      <Link
        href="/dashboard"
        className="my-7 flex items-center gap-2 text-sm font-medium text-[#718096]"
      >
        <ArrowLeft size={15} /> Back to dashboard
      </Link>

      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <div
            className="mb-3 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold"
            style={{ background: SOFT, color: ACCENT }}
          >
            <Eye size={13} /> Eye comfort
          </div>
          <h1 className="text-3xl font-bold tracking-[-.03em]">ScreenBreak</h1>
          <p className="mt-2 text-[#718096]">
            Counts your blinks while you work and reminds you to rest your eyes.
          </p>
        </div>
      </div>

      {notice && (
        <p className="mt-5 rounded-xl bg-[#fff6e5] p-3 text-sm text-[#8a5a12]">
          {notice}
        </p>
      )}

      {/* ---------- SETUP ---------- */}
      {(phase === "setup" || phase === "starting") && (
        <section className="mt-8 max-w-xl rounded-2xl border border-[#e7e8f0] bg-white p-6">
          <h2 className="font-semibold">How it works</h2>
          <ul className="mt-3 space-y-2 text-sm leading-6 text-[#718096]">
            <li>
              Put the app next to your work. Your camera counts your blinks.
            </li>
            <li>
              We remind you to look far away for 20 seconds. This is the
              &quot;20-20-20&quot; habit.
            </li>
            <li>
              Blink counts are an estimate to help you notice your habits. This
              is not a medical test.
            </li>
          </ul>

          <p className="mt-6 text-sm font-semibold">
            Remind me to take a break every
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {[
              { m: 20, label: "20 minutes" },
              { m: 30, label: "30 minutes" },
              { m: 1, label: "1 minute (test)" },
            ].map((o) => (
              <button
                key={o.m}
                onClick={() => setIntervalMin(o.m)}
                className="rounded-xl border px-4 py-2 text-sm font-medium"
                style={
                  intervalMin === o.m
                    ? { background: SOFT, borderColor: ACCENT, color: ACCENT }
                    : { borderColor: "#e7e8f0", color: "#718096" }
                }
              >
                {o.label}
              </button>
            ))}
          </div>

          <button
            onClick={begin}
            disabled={phase === "starting"}
            className="mt-7 flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
            style={{ background: ACCENT }}
          >
            <Play size={15} fill="currentColor" />
            {phase === "starting" ? "Starting camera..." : "Start"}
          </button>
        </section>
      )}

      {/* ---------- RUNNING ---------- */}
      {phase === "running" && (
        <div className="mt-8 grid gap-5 lg:grid-cols-[1fr_1.4fr]">
          <section className="rounded-2xl border border-[#e7e8f0] bg-white p-5">
            <div className="overflow-hidden rounded-xl bg-[#20283d]">
              <video
                ref={video}
                muted
                playsInline
                className="aspect-video w-full -scale-x-100 object-cover"
              />
            </div>
            <p className="mt-3 text-sm text-[#718096]">
              {validation ? describeValidation(validation.code) : "Starting..."}
            </p>
            <p className="mt-1 text-xs text-[#8992a6]">
              Blink signal:{" "}
              <span
                className="font-semibold"
                style={{ color: snap.signalOk ? ACCENT : "#c86b6b" }}
              >
                {snap.signalOk ? "working" : "waiting for your face"}
              </span>
            </p>
            <div className="mt-5 flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-wider text-[#8992a6]">
                  Session
                </p>
                <p className="font-mono text-2xl font-semibold">
                  {fmt(snap.elapsed)}
                </p>
              </div>
              <button
                onClick={finish}
                className="flex items-center gap-2 rounded-xl border border-[#efcaca] px-4 py-2.5 text-sm font-semibold text-[#c86b6b]"
              >
                <Square size={14} fill="currentColor" /> End session
              </button>
            </div>
          </section>

          <section className="space-y-5">
            {nudge && (
              <p
                className="rounded-xl p-4 text-sm font-medium"
                style={{ background: SOFT, color: "#1f7a6e" }}
                role="status"
              >
                {nudge}
              </p>
            )}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Stat
                label="Blinks / min"
                value={snap.rate === null ? "—" : snap.rate.toFixed(0)}
              />
              <Stat label="Total blinks" value={String(snap.total)} />
              <Stat
                label="Longest no-blink"
                value={`${snap.longestGap.toFixed(0)}s`}
              />
              <Stat label="Next break in" value={fmt(snap.nextIn)} />
            </div>
            <RateChart
              series={snap.series}
              duration={Math.max(snap.elapsed, 60)}
            />
            <div className="flex flex-wrap items-center gap-3 text-sm text-[#718096]">
              <span>Breaks taken: {snap.breaks}</span>
              <button
                onClick={breakNow}
                className="rounded-lg bg-[#f3f3f7] px-3 py-1.5 text-xs font-semibold text-[#3d4660]"
              >
                Take a break now
              </button>
            </div>
          </section>
        </div>
      )}

      {/* ---------- BREAK POPUP ---------- */}
      {phase === "running" && snap.onBreak && (
        <div
          className="fixed inset-0 z-40 grid place-items-center bg-[#20283d]/80 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Eye break"
        >
          <div className="w-full max-w-sm rounded-2xl bg-white p-7 text-center">
            <div
              className="mx-auto grid h-12 w-12 place-items-center rounded-full"
              style={{ background: SOFT, color: ACCENT }}
            >
              <Coffee size={22} />
            </div>
            <h2 className="mt-4 text-xl font-bold">Rest your eyes</h2>
            <p className="mt-2 text-sm leading-6 text-[#718096]">
              Look at something far away, like out of a window. Blink slowly
              while you wait.
            </p>
            <p
              className="mt-5 font-mono text-5xl font-semibold"
              style={{ color: ACCENT }}
            >
              {Math.ceil(snap.breakLeft)}
            </p>
            <button
              onClick={skipBreak}
              className="mt-6 text-xs font-medium text-[#8992a6] underline"
            >
              Skip this break
            </button>
          </div>
        </div>
      )}

      {/* ---------- SUMMARY ---------- */}
      {phase === "summary" && final && (
        <Summary s={final} onAgain={() => setPhase("setup")} />
      )}

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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[#e7e8f0] bg-white p-4">
      <p className="text-[11px] uppercase tracking-wider text-[#8992a6]">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </div>
  );
}

// Line chart of blinks per minute. The dashed line marks "slow blinking".
function RateChart({
  series,
  duration,
}: {
  series: Point[];
  duration: number;
}) {
  const W = 600;
  const H = 150;
  const PAD = 8;
  const hi = Math.max(25, ...series.map((p) => p.v + 2));
  const x = (t: number) => PAD + (t / duration) * (W - 2 * PAD);
  const y = (v: number) => H - PAD - (v / hi) * (H - 2 * PAD);
  return (
    <div className="rounded-2xl border border-[#e7e8f0] bg-white p-5">
      <h3 className="text-sm font-semibold">Blinks per minute</h3>
      {series.length < 2 ? (
        <p className="mt-4 flex h-27.5 items-center justify-center rounded-lg bg-[#fafafd] text-xs text-[#8992a6]">
          Collecting your first minute of blinks...
        </p>
      ) : (
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="mt-3 h-27.5 w-full"
          role="img"
          aria-label="Blinks per minute"
        >
          <line
            x1={PAD}
            x2={W - PAD}
            y1={y(LOW_RATE)}
            y2={y(LOW_RATE)}
            stroke="#9aa2b3"
            strokeDasharray="5 5"
          />
          <polyline
            fill="none"
            stroke={ACCENT}
            strokeWidth={2.5}
            strokeLinejoin="round"
            strokeLinecap="round"
            points={series.map((p) => `${x(p.t)},${y(p.v)}`).join(" ")}
          />
        </svg>
      )}
      <p className="mt-2 text-[11px] text-[#8992a6]">
        Dashed line = {LOW_RATE} blinks a minute. Below it, your blinking is
        slow.
      </p>
    </div>
  );
}

function Summary({ s, onAgain }: { s: Snap; onAgain: () => void }) {
  const hasData = s.total > 0 || s.series.length > 0;
  const avg = s.elapsed > 0 ? (s.total * 60) / s.elapsed : 0;
  const tips: string[] = [];
  if (hasData) {
    if (avg < LOW_RATE)
      tips.push(
        "You blinked slowly for much of this session. Try to blink fully and often when you are focused.",
      );
    else if (avg < 14)
      tips.push(
        "Your blinking was a bit slow. Short pauses to look away can help.",
      );
    else
      tips.push(
        "Your blinking looked healthy for a screen session. Keep it up.",
      );
    if (s.longestGap >= LONG_GAP)
      tips.push(
        `Your longest stare was about ${s.longestGap.toFixed(0)} seconds. Look away from the screen a little more often.`,
      );
  } else {
    tips.push(
      "We could not see your blinks this time. Sit in front of a light and face the camera, then try again.",
    );
  }
  if (s.elapsed >= 20 * 60 && s.breaks === 0)
    tips.push("You did not take any breaks. Try the 20-20-20 habit next time.");

  return (
    <section className="mt-8 max-w-3xl space-y-5">
      <div className="rounded-2xl border border-[#e7e8f0] bg-white p-6">
        <h2 className="text-lg font-bold">Session summary</h2>
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="Time" value={fmt(s.elapsed)} />
          <Stat label="Total blinks" value={String(s.total)} />
          <Stat label="Average / min" value={hasData ? avg.toFixed(0) : "—"} />
          <Stat
            label="Breaks taken"
            value={`${s.breaks}${s.skipped ? ` (+${s.skipped} skipped)` : ""}`}
          />
        </div>
        <ul className="mt-5 list-disc space-y-1 pl-5 text-sm leading-6 text-[#3d4660]">
          {tips.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
        <p className="mt-4 text-xs text-[#8992a6]">
          Blink counts are an estimate from the camera. They are not a medical
          measurement. Saved on this computer only.
        </p>
      </div>
      <RateChart series={s.series} duration={Math.max(s.elapsed, 60)} />
      <div className="flex gap-3">
        <button
          onClick={onAgain}
          className="rounded-xl px-5 py-3 text-sm font-semibold text-white"
          style={{ background: ACCENT }}
        >
          New session
        </button>
        <Link
          href="/history"
          className="rounded-xl bg-[#f3f3f7] px-5 py-3 text-sm font-semibold text-[#3d4660]"
        >
          See history
        </Link>
      </div>
    </section>
  );
}
