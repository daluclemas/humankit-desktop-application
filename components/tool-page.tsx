"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Camera,
  Pause,
  Play,
  Square,
  CircleHelp,
  Activity,
  ShieldCheck,
} from "lucide-react";
import { useRouter } from "next/navigation";

type State = "idle" | "active" | "paused" | "completed";
const config = {
  speakeasy: {
    title: "SpeakEasy",
    subtitle: "Practice presenting with calm, clear delivery.",
    accent: "#6958d9",
    soft: "#eeebff",
    metric: "Speaking activity",
    secondary: "Silence time",
  },
  screenbreak: {
    title: "ScreenBreak",
    subtitle: "Build awareness around your blinking and screen habits.",
    accent: "#2fae9e",
    soft: "#ddf5f0",
    metric: "Blink count",
    secondary: "Blinks per minute",
  },
  breathebuddy: {
    title: "BreatheBuddy",
    subtitle: "A guided breathing routine for a calmer moment.",
    accent: "#e49a43",
    soft: "#fff0dc",
    metric: "Breathing rate",
    secondary: "Pattern: 4 in / 6 out",
  },
} as const;
export default function ToolPage({ kind }: { kind: keyof typeof config }) {
  const c = config[kind];
  const [state, setState] = useState<State>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [phase, setPhase] = useState<"Inhale" | "Exhale">("Inhale");
  const started = useRef<number | null>(null);
  const router = useRouter();
  useEffect(() => {
    if (state !== "active") return;
    const id = setInterval(() => {
      if (started.current)
        setElapsed(Math.floor((Date.now() - started.current) / 1000));
    }, 250);
    return () => clearInterval(id);
  }, [state]);
  useEffect(() => {
    if (kind !== "breathebuddy" || state !== "active") return;
    const id = setInterval(
      () => setPhase((p) => (p === "Inhale" ? "Exhale" : "Inhale")),
      4000,
    );
    return () => clearInterval(id);
  }, [kind, state]);
  const start = () => {
    started.current = Date.now() - elapsed * 1000;
    setState("active");
  };
  const end = () => {
    setState("completed");
    if (typeof window !== "undefined") {
      const old = JSON.parse(localStorage.getItem("humankit-sessions") || "[]");
      localStorage.setItem(
        "humankit-sessions",
        JSON.stringify([
          {
            id: Date.now(),
            tool: c.title,
            date: new Date().toISOString(),
            duration: elapsed,
            measurement: "Not available",
            ...{},
          },
          ...old,
        ]),
      );
    }
  };
  const fmt = (n: number) =>
    `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`;
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
            style={{ background: c.soft, color: c.accent }}
          >
            <Activity size={13} /> Guided session
          </div>
          <h1 className="text-3xl font-bold tracking-[-.03em]">{c.title}</h1>
          <p className="mt-2 text-[#718096]">{c.subtitle}</p>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-[#e7e8f0] bg-white px-4 py-2.5">
          <span
            className={`h-2 w-2 rounded-full ${state === "active" ? "bg-[#35b89f]" : "bg-[#c7cad4]"}`}
          />
          <span className="text-sm text-[#718096]">
            {state === "active" ? "Session active" : "Ready to begin"}
          </span>
        </div>
      </div>
      <div className="mt-8 grid gap-5 lg:grid-cols-[1.5fr_1fr]">
        <section className="rounded-2xl border border-[#e7e8f0] bg-white p-5 shadow-[0_8px_30px_rgba(31,36,64,.04)]">
          <div className="relative flex min-h-77.5 items-center justify-center overflow-hidden rounded-xl bg-[#20283d]">
            <div
              className="absolute inset-0 opacity-20"
              style={{
                background:
                  "radial-gradient(circle at 50% 30%, #8f82e8, transparent 36%)",
              }}
            />
            <div className="relative text-center text-white">
              <div
                className={`mx-auto mb-4 grid h-20 w-20 place-items-center rounded-full border border-white/20 bg-white/10 ${kind === "breathebuddy" && state === "active" ? "scale-125" : ""} transition-transform duration-1000`}
                style={{
                  boxShadow:
                    kind === "breathebuddy" && state === "active"
                      ? `0 0 0 18px ${c.accent}33`
                      : undefined,
                }}
              >
                {kind === "breathebuddy" ? (
                  <span className="text-xs font-semibold">{phase}</span>
                ) : (
                  <Camera size={27} strokeWidth={1.5} />
                )}
              </div>
              <p className="text-sm font-medium">
                {kind === "breathebuddy"
                  ? "Follow the rhythm"
                  : "Camera preview"}
              </p>
              <p className="mt-1 text-xs text-white/50">
                {kind === "breathebuddy"
                  ? "A gentle 4 / 6 breathing pattern"
                  : "Camera access will be connected here"}
              </p>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-wider text-[#8992a6]">
                Session timer
              </p>
              <p className="mt-1 font-mono text-2xl font-semibold">
                {fmt(elapsed)}
              </p>
            </div>
            <div className="flex gap-2">
              {state === "idle" || state === "completed" ? (
                <button
                  onClick={start}
                  className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white"
                  style={{ background: c.accent }}
                >
                  <Play size={15} fill="currentColor" /> Start
                </button>
              ) : (
                <>
                  <button
                    onClick={() =>
                      setState(state === "active" ? "paused" : "active")
                    }
                    className="flex items-center gap-2 rounded-xl bg-[#f3f3f7] px-4 py-2.5 text-sm font-semibold"
                  >
                    {state === "active" ? (
                      <>
                        <Pause size={15} /> Pause
                      </>
                    ) : (
                      <>
                        <Play size={15} fill="currentColor" /> Resume
                      </>
                    )}
                  </button>
                  <button
                    onClick={end}
                    className="grid h-10 w-10 place-items-center rounded-xl border border-[#efcaca] text-[#c86b6b]"
                    aria-label="End session"
                  >
                    <Square size={15} fill="currentColor" />
                  </button>
                </>
              )}
            </div>
          </div>
        </section>
        <aside className="space-y-5">
          <div className="rounded-2xl border border-[#e7e8f0] bg-white p-6">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Live measurements</h2>
              <CircleHelp size={16} className="text-[#a3aaba]" />
            </div>
            <div className="mt-6 space-y-5">
              <Metric label={c.metric} />
              <Metric label={c.secondary} />
            </div>
            <div className="mt-6 flex items-start gap-2 rounded-xl bg-[#fafafd] p-3 text-xs leading-5 text-[#8992a6]">
              <ShieldCheck
                size={15}
                className="mt-0.5 shrink-0 text-[#6958d9]"
              />
              Presage integration is not connected yet.
            </div>
          </div>
          <div className="rounded-2xl border border-[#e7e8f0] bg-white p-6">
            <h2 className="font-semibold">Activity timeline</h2>
            <div className="mt-5 flex h-12 items-end gap-1">
              {Array.from({ length: 24 }, (_, i) => (
                <span
                  key={i}
                  className="flex-1 rounded-t bg-[#eeebff]"
                  style={{ height: `${20 + (i % 5) * 12}%` }}
                />
              ))}
            </div>
            <p className="mt-3 text-xs text-[#8992a6]">
              Measurements will appear once a signal provider is connected.
            </p>
          </div>
        </aside>
      </div>
      {state === "completed" && (
        <div className="mt-5 rounded-2xl border border-[#cceee7] bg-[#f0fbf8] p-4 text-sm text-[#287d70]">
          Session saved locally. Nice work showing up for yourself.
        </div>
      )}
    </div>
  );
}
function Metric({ label }: { label: string }) {
  return (
    <div className="flex items-end justify-between border-b border-[#f0f0f5] pb-4">
      <span className="text-sm text-[#718096]">{label}</span>
      <span className="text-xl font-semibold text-[#a7adbb]">—</span>
    </div>
  );
}
