"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Camera,
  Mic,
  Pause,
  Play,
  Square,
  ShieldCheck,
} from "lucide-react";
import { createPresageProvider, friendlyError } from "@/lib/presage";
import { giveCameraConsent, hasCameraConsent } from "@/lib/consent";
import CameraConsent from "@/components/CameraConsent";
import type { SignalProvider } from "@/types/signals";

type State = "idle" | "starting" | "active" | "paused" | "completed";
type Segment = { talking: boolean; ms: number };

const ACCENT = "#6958d9";
const SOFT = "#eeebff";

const fmt = (ms: number) => {
  const s = Math.floor(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};

export default function SpeakEasySession() {
  const [state, setState] = useState<State>("idle");
  const [message, setMessage] = useState("");
  const [hint, setHint] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [speaking, setSpeaking] = useState(0);
  const [silence, setSilence] = useState(0);
  const [talkingNow, setTalkingNow] = useState<boolean | null>(null);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [cameraOn, setCameraOn] = useState(false);
  const [askConsent, setAskConsent] = useState(false);

  const video = useRef<HTMLVideoElement>(null);
  const provider = useRef<SignalProvider | null>(null);
  const talking = useRef<boolean | null>(null); // latest reading from Presage
  const lastTick = useRef(0);
  const totals = useRef({ elapsed: 0, speaking: 0, silence: 0 });
  const segs = useRef<Segment[]>([]);

  // Presage tells us here whether talking is detected.
  const getProvider = useCallback(() => {
    if (!provider.current) {
      provider.current = createPresageProvider({
        onTalkingDetected: (isTalking) => {
          talking.current = isTalking;
          setTalkingNow(isTalking);
        },
        onStream: (stream) => {
          setCameraOn(!!stream);
          if (video.current) {
            video.current.srcObject = stream;
            if (stream) video.current.play().catch(() => {});
          }
        },
        onHint: setHint,
        onError: setMessage,
      });
    }
    return provider.current;
  }, []);

  // Every quarter of a second: add the time to "speaking" or "silence".
  useEffect(() => {
    if (state !== "active") return;
    lastTick.current = Date.now();
    const id = setInterval(() => {
      const now = Date.now();
      const dt = now - lastTick.current;
      lastTick.current = now;
      const t = totals.current;
      t.elapsed += dt;
      if (talking.current !== null) {
        if (talking.current) t.speaking += dt;
        else t.silence += dt;
        const last = segs.current[segs.current.length - 1];
        if (last && last.talking === talking.current) last.ms += dt;
        else segs.current.push({ talking: talking.current, ms: dt });
      }
      setElapsed(t.elapsed);
      setSpeaking(t.speaking);
      setSilence(t.silence);
      setSegments([...segs.current]);
    }, 250);
    return () => clearInterval(id);
  }, [state]);

  // Close the camera if the person leaves this page.
  useEffect(() => {
    return () => {
      provider.current?.destroy();
      provider.current = null;
    };
  }, []);

  async function begin() {
    // First time only: ask before the camera is ever turned on.
    if ((state === "idle" || state === "completed") && !hasCameraConsent()) {
      setAskConsent(true);
      return;
    }
    setMessage("");
    setHint("");
    if (state === "idle" || state === "completed") {
      totals.current = { elapsed: 0, speaking: 0, silence: 0 };
      segs.current = [];
      setElapsed(0);
      setSpeaking(0);
      setSilence(0);
      setSegments([]);
    }
    talking.current = null;
    setTalkingNow(null);
    const previous = state;
    setState("starting");
    try {
      await getProvider().start();
      setState("active");
    } catch (err) {
      console.error(err);
      setMessage(friendlyError(err));
      provider.current?.destroy();
      provider.current = null;
      setState(previous === "paused" ? "paused" : "idle");
    }
  }

  async function pause() {
    setState("paused");
    try {
      await provider.current?.stop();
    } catch (err) {
      console.error(err);
    }
  }

  async function end() {
    setState("completed");
    try {
      await provider.current?.stop();
    } catch (err) {
      console.error(err);
    }
    provider.current?.destroy();
    provider.current = null;
    save();
  }

  function save() {
    const t = totals.current;
    try {
      const old = JSON.parse(localStorage.getItem("humankit-sessions") || "[]");
      const entry = {
        id: Date.now(),
        tool: "SpeakEasy",
        date: new Date().toISOString(),
        duration: Math.floor(t.elapsed / 1000),
        measurement: `Talking detected ${fmt(t.speaking)} · Silence ${fmt(t.silence)}`,
      };
      localStorage.setItem(
        "humankit-sessions",
        JSON.stringify([entry, ...old]),
      );
    } catch (err) {
      console.error(err);
    }
  }

  const measured = speaking + silence;
  const pct = (v: number) =>
    measured > 0 ? Math.round((v / measured) * 100) : 0;
  const busy = state === "starting";
  const running = state === "active";

  return (
    <div className="mx-auto max-w-6xl">
      {askConsent && (
        <CameraConsent
          onCancel={() => setAskConsent(false)}
          onAgree={() => {
            giveCameraConsent();
            setAskConsent(false);
            begin();
          }}
        />
      )}
      <Link
        href="/dashboard"
        className="mb-7 flex items-center gap-2 text-sm font-medium text-[#718096]"
      >
        <ArrowLeft size={15} /> Back to dashboard
      </Link>

      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <div
            className="mb-3 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold"
            style={{ background: SOFT, color: ACCENT }}
          >
            <Mic size={13} /> Speaking practice
          </div>
          <h1 className="text-3xl font-bold tracking-[-.03em]">SpeakEasy</h1>
          <p className="mt-2 text-[#718096]">
            Practice presenting and see when talking is detected.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-[#e7e8f0] bg-white px-4 py-2.5">
          <span
            className={`h-2 w-2 rounded-full ${cameraOn ? "bg-[#e05252]" : "bg-[#c7cad4]"}`}
          />
          <span className="text-sm text-[#718096]">
            {cameraOn ? "Camera is on" : "Camera is off"}
          </span>
        </div>
      </div>

      {message && (
        <div className="mt-6 rounded-xl border border-[#efcaca] bg-[#fdf3f3] p-4 text-sm text-[#a94b4b]">
          {message}
        </div>
      )}

      <div className="mt-8 grid gap-5 lg:grid-cols-[1.5fr_1fr]">
        <section className="rounded-2xl border border-[#e7e8f0] bg-white p-5 shadow-[0_8px_30px_rgba(31,36,64,.04)]">
          <div className="relative flex min-h-[310px] items-center justify-center overflow-hidden rounded-xl bg-[#20283d]">
            <video
              ref={video}
              muted
              playsInline
              className={`absolute inset-0 h-full w-full -scale-x-100 object-cover ${cameraOn ? "" : "hidden"}`}
            />
            {!cameraOn && (
              <div className="relative text-center text-white">
                <div className="mx-auto mb-4 grid h-20 w-20 place-items-center rounded-full border border-white/20 bg-white/10">
                  <Camera size={27} strokeWidth={1.5} />
                </div>
                <p className="text-sm font-medium">
                  {busy ? "Starting the camera…" : "Camera preview"}
                </p>
                <p className="mt-1 text-xs text-white/50">
                  Your camera turns on only when you press Start.
                </p>
              </div>
            )}
            {running && (
              <span className="absolute left-3 top-3 rounded-full bg-black/50 px-3 py-1 text-xs font-medium text-white">
                {talkingNow === null
                  ? "Waiting for a reliable measurement."
                  : talkingNow
                    ? "Talking detected"
                    : "Silence"}
              </span>
            )}
          </div>

          {hint && running && (
            <p className="mt-3 text-xs text-[#8992a6]">Tip: {hint}</p>
          )}

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
                  onClick={begin}
                  disabled={busy}
                  className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                  style={{ background: ACCENT }}
                >
                  <Play size={15} fill="currentColor" /> Start
                </button>
              ) : (
                <>
                  {state === "paused" ? (
                    <button
                      onClick={begin}
                      className="flex items-center gap-2 rounded-xl bg-[#f3f3f7] px-4 py-2.5 text-sm font-semibold"
                    >
                      <Play size={15} fill="currentColor" /> Resume
                    </button>
                  ) : (
                    <button
                      onClick={pause}
                      disabled={busy}
                      className="flex items-center gap-2 rounded-xl bg-[#f3f3f7] px-4 py-2.5 text-sm font-semibold disabled:opacity-60"
                    >
                      <Pause size={15} /> Pause
                    </button>
                  )}
                  <button
                    onClick={end}
                    disabled={busy}
                    className="grid h-10 w-10 place-items-center rounded-xl border border-[#efcaca] text-[#c86b6b] disabled:opacity-60"
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
            <h2 className="font-semibold">Live measurements</h2>
            <div className="mt-6 space-y-5">
              <Row
                label="Talking detected"
                value={
                  measured > 0 || running
                    ? `${fmt(speaking)} (${pct(speaking)}%)`
                    : "—"
                }
              />
              <Row
                label="Silence"
                value={
                  measured > 0 || running
                    ? `${fmt(silence)} (${pct(silence)}%)`
                    : "—"
                }
              />
            </div>
            <div className="mt-6 flex items-start gap-2 rounded-xl bg-[#fafafd] p-3 text-xs leading-5 text-[#8992a6]">
              <ShieldCheck
                size={15}
                className="mt-0.5 shrink-0"
                style={{ color: ACCENT }}
              />
              This shows detected talking only. It does not judge how good your
              speech is.{" "}
              <Link href="/privacy" className="font-semibold underline">
                Privacy and data
              </Link>
            </div>
          </div>

          <div className="rounded-2xl border border-[#e7e8f0] bg-white p-6">
            <h2 className="font-semibold">Activity timeline</h2>
            <div className="mt-5 flex h-12 w-full overflow-hidden rounded-lg bg-[#f5f5f8]">
              {segments.map((s, i) => (
                <div
                  key={i}
                  title={s.talking ? "Talking" : "Silence"}
                  style={{
                    flexGrow: s.ms,
                    background: s.talking ? ACCENT : SOFT,
                  }}
                />
              ))}
            </div>
            <div className="mt-3 flex gap-4 text-xs text-[#8992a6]">
              <span className="flex items-center gap-1.5">
                <i
                  className="h-2 w-2 rounded-full"
                  style={{ background: ACCENT }}
                />{" "}
                Talking
              </span>
              <span className="flex items-center gap-1.5">
                <i
                  className="h-2 w-2 rounded-full"
                  style={{ background: SOFT }}
                />{" "}
                Silence
              </span>
            </div>
            {segments.length === 0 && (
              <p className="mt-3 text-xs text-[#8992a6]">
                Your timeline will appear once a measurement arrives.
              </p>
            )}
          </div>
        </aside>
      </div>

      {state === "completed" && (
        <div className="mt-5 rounded-2xl border border-[#cceee7] bg-[#f0fbf8] p-5 text-sm text-[#287d70]">
          <p className="font-semibold">
            Session summary (saved on this device)
          </p>
          <ul className="mt-2 space-y-1">
            <li>Total session: {fmt(elapsed)}</li>
            <li>
              Talking detected: {fmt(speaking)} ({pct(speaking)}%)
            </li>
            <li>
              Silence: {fmt(silence)} ({pct(silence)}%)
            </li>
          </ul>
          {elapsed - measured > 1500 && (
            <p className="mt-2 text-xs">
              The remaining {fmt(elapsed - measured)} was spent waiting for a
              reliable measurement.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-end justify-between border-b border-[#f0f0f5] pb-4">
      <span className="text-sm text-[#718096]">{label}</span>
      <span className="text-xl font-semibold">{value}</span>
    </div>
  );
}
