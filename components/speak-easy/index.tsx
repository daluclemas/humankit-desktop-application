"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Camera,
  Loader2,
  Mic,
  Sparkles,
  Square,
  Play,
  ArrowRight,
  RotateCcw,
} from "lucide-react";
import {
  createPresageProvider,
  describeValidation,
  friendlyError,
} from "@/lib/presage";
import {
  GROQ_API_KEY,
  friendlyAiError,
  generateQuestions,
  reviewAnswer,
  summarizeSession,
  transcribe,
} from "@/lib/ai";
import {
  assess,
  countFillers,
  countWords,
  mean,
  median,
  talkStats,
} from "@/lib/composure";
import { giveCameraConsent, hasCameraConsent } from "@/lib/consent";
import CameraConsent from "@/components/CameraConsent";
import { LineChart, TalkTimeline } from "./Charts";
import type {
  AnswerResult,
  Level,
  Report,
  Sample,
  TalkEvent,
  Win,
} from "@/types/coach";
import type { SignalProvider } from "@/types/signals";

type Phase =
  | "setup"
  | "generating"
  | "position"
  | "baseline"
  | "ready"
  | "answering"
  | "processing"
  | "feedback"
  | "summarizing"
  | "done";

// const BASELINE_MS = 25000;
const BREATHING_WINDOW_MS = 30000;
const PULSE_WINDOW_MS = 12000;
const BASELINE_MS = 40000;
const ACCENT = "#6958d9";
const LEVELS: Record<Level, { label: string; color: string; bg: string }> = {
  steady: { label: "Steady", color: "#287d70", bg: "#e6f6f2" },
  mostly: { label: "Mostly steady", color: "#a06a14", bg: "#fdf3df" },
  raised: { label: "Signals were raised", color: "#b4532f", bg: "#fdece6" },
};

const clock = (ms: number) => {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

export default function SpeakEasyCoach() {
  const [phase, setPhase] = useState<Phase>("setup");
  const [topic, setTopic] = useState("");
  const [count, setCount] = useState(3);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [validation, setValidation] = useState<{
    code: number | null;
    hint: string;
  }>({ code: null, hint: "" });
  const [counts, setCounts] = useState({ breath: 0, pulse: 0 });
  const [askConsent, setAskConsent] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [micOn, setMicOn] = useState(false);
  const [questions, setQuestions] = useState<string[]>([]);
  const [qIndex, setQIndex] = useState(0);
  const [answers, setAnswers] = useState<AnswerResult[]>([]);
  const [baseline, setBaseline] = useState<{
    breath: number | null;
    pulse: number | null;
  }>({ breath: null, pulse: null });
  const [baselineLeft, setBaselineLeft] = useState(BASELINE_MS);
  const [talkingNow, setTalkingNow] = useState<boolean | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [answerElapsed, setAnswerElapsed] = useState(0);
  const [charts, setCharts] = useState<{
    breath: Sample[];
    pulse: Sample[];
    talk: TalkEvent[];
    windows: Win[];
  }>({ breath: [], pulse: [], talk: [], windows: [] });
  const [report, setReport] = useState<Report | null>(null);
  const [totalMs, setTotalMs] = useState(0);

  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const provider = useRef<SignalProvider | null>(null);
  const t0 = useRef(0);
  const breath = useRef<Sample[]>([]);
  const pulse = useRef<Sample[]>([]);
  const talkLog = useRef<TalkEvent[]>([]);
  const windows = useRef<Win[]>([]);
  const answerStart = useRef(0);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const mic = useRef<MediaStream | null>(null);

  const now = () => Date.now() - t0.current;

  // Presage tells us here what it sees.
  const getProvider = useCallback(() => {
    if (!provider.current) {
      provider.current = createPresageProvider({
        onTalkingDetected: (talking) => {
          const last = talkLog.current.at(-1);
          if (!last || last.talking !== talking)
            talkLog.current.push({ t: now(), talking });
          setTalkingNow(talking);
        },
        onBreathingRateReceived: (v) => breath.current.push({ t: now(), v }),
        onPulseRateReceived: (v) => pulse.current.push({ t: now(), v }),
        onStream: (s) => {
          // Remember the stream. The <video> may not be on the page yet.
          stream.current = s;
          setCameraOn(!!s);
          if (video.current) {
            video.current.srcObject = s;
            if (s) video.current.play().catch(() => {});
          }
        },
        onValidation: (code, h) => setValidation({ code, hint: h }),
        onError: setNotice,
      });
    }
    return provider.current;
  }, []);

  // The <video> only appears after the "generating" step, so connect the
  // saved stream to it as soon as it shows up.
  useEffect(() => {
    const el = video.current;
    if (!el || !stream.current) return;
    if (el.srcObject !== stream.current) el.srcObject = stream.current;
    el.play().catch(() => {});
  }, [phase, cameraOn]);

  // Once a second: refresh the charts and timers.
  const running =
    phase === "position" ||
    phase === "baseline" ||
    phase === "ready" ||
    phase === "answering" ||
    phase === "processing" ||
    phase === "feedback";
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      setElapsed(now());
      setCounts({ breath: breath.current.length, pulse: pulse.current.length });
      setCharts({
        breath: [...breath.current],
        pulse: [...pulse.current],
        talk: [...talkLog.current],
        windows: [...windows.current],
      });
      if (answerStart.current) setAnswerElapsed(now() - answerStart.current);
    }, 1000);
    return () => clearInterval(id);
  }, [running]);

  // Resting level: the first 25 seconds.
  useEffect(() => {
    if (phase !== "baseline") return;
    const id = setInterval(() => {
      const left = BASELINE_MS - now();
      setBaselineLeft(Math.max(0, left));
      if (left <= 0) finishBaseline();
    }, 250);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // Close camera and microphone if the person leaves this page.
  useEffect(() => {
    return () => {
      provider.current?.destroy();
      mic.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  // function finishBaseline() {
  //   const inRange = (list: Sample[]) =>
  //     list.filter((s) => s.t >= 5000 && s.t <= BASELINE_MS).map((s) => s.v);
  //   const b = inRange(breath.current);
  //   const p = inRange(pulse.current);
  //   setBaseline({
  //     breath: b.length >= 2 ? median(b) : null,
  //     pulse: p.length >= 2 ? median(p) : null,
  //   });
  //   setPhase("ready");
  // }

  function finishBaseline() {
    const breathingSamples = breath.current
      .filter(
        (sample) => sample.t >= BREATHING_WINDOW_MS && sample.t <= BASELINE_MS,
      )
      .map((sample) => sample.v);

    const pulseSamples = pulse.current
      .filter(
        (sample) => sample.t >= PULSE_WINDOW_MS && sample.t <= BASELINE_MS,
      )
      .map((sample) => sample.v);

    setBaseline({
      breath: breathingSamples.length >= 2 ? median(breathingSamples) : null,

      pulse: pulseSamples.length >= 2 ? median(pulseSamples) : null,
    });

    setPhase("ready");
  }

  function resetAll() {
    breath.current = [];
    pulse.current = [];
    talkLog.current = [];
    windows.current = [];
    answerStart.current = 0;
    setCharts({ breath: [], pulse: [], talk: [], windows: [] });
    setAnswers([]);
    setQIndex(0);
    setReport(null);
    setTalkingNow(null);
    setElapsed(0);
    setAnswerElapsed(0);
    setNotice("");
    setValidation({ code: null, hint: "" });
    setCounts({ breath: 0, pulse: 0 });
    setError("");
  }

  async function createQuestions() {
    setError("");
    if (topic.trim().length < 5) {
      setError("Please tell us what you are practicing for, in a few words.");
      return;
    }
    if (!hasCameraConsent()) {
      setAskConsent(true);
      return;
    }
    setPhase("generating");
    try {
      const list = await generateQuestions(topic.trim(), count);
      setQuestions(list);
    } catch (err) {
      setError(friendlyAiError(err));
      setPhase("setup");
      return;
    }
    resetAll();
    t0.current = Date.now();
    try {
      await getProvider().start();
    } catch (err) {
      console.warn(err);
      setError(friendlyError(err));
      provider.current?.destroy();
      provider.current = null;
      setPhase("setup");
      return;
    }
    setPhase("position");
  }

  // Starts the 25-second resting measurement, after the person is in position.
  function beginBaseline() {
    breath.current = [];
    pulse.current = [];
    talkLog.current = [];
    windows.current = [];
    t0.current = Date.now();
    setElapsed(0);
    setBaselineLeft(BASELINE_MS);
    setPhase("baseline");
  }

  async function startAnswer() {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mic.current = stream;
      chunks.current = [];
      const rec = new MediaRecorder(stream);
      rec.ondataavailable = (e) =>
        e.data.size > 0 && chunks.current.push(e.data);
      rec.start();
      recorder.current = rec;
      setMicOn(true);
    } catch (err) {
      console.warn(err);
      setError("Please allow microphone access so we can hear your answer.");
      return;
    }
    answerStart.current = now();
    setAnswerElapsed(0);
    setPhase("answering");
  }

  function stopRecording(): Promise<Blob> {
    return new Promise((resolve) => {
      const rec = recorder.current;
      const done = () => {
        mic.current?.getTracks().forEach((t) => t.stop());
        mic.current = null;
        setMicOn(false);
        resolve(
          new Blob(chunks.current, { type: rec?.mimeType || "audio/webm" }),
        );
      };
      if (!rec || rec.state === "inactive") return done();
      rec.onstop = done;
      rec.stop();
    });
  }

  async function finishAnswer() {
    const start = answerStart.current;
    const end = now();
    answerStart.current = 0;
    setPhase("processing");
    try {
      const audio = await stopRecording();
      const transcript = await transcribe(audio);
      const words = countWords(transcript);
      if (words < 3) {
        setError(
          "We couldn't hear your answer. Please try this question again.",
        );
        setPhase("ready");
        return;
      }
      const talk = talkStats(talkLog.current, start, end);
      const inWindow = (list: Sample[]) =>
        list.filter((s) => s.t >= start && s.t <= end).map((s) => s.v);
      const breathAvg = mean(inWindow(breath.current));
      const pulseAvg = mean(inWindow(pulse.current));
      const fillers = countFillers(transcript);
      const verdict = assess({
        words,
        fillers,
        ...talk,
        breathAvg,
        pulseAvg,
        baseBreath: baseline.breath,
        basePulse: baseline.pulse,
      });
      const review = await reviewAnswer({
        topic,
        question: questions[qIndex],
        transcript,
        seconds: Math.round((end - start) / 1000),
        wpm: verdict.wpm,
        fillers,
        longestPauseSeconds: Math.round(talk.longestSilenceMs / 1000),
        flags: verdict.flags,
      });
      windows.current.push({ start, end, label: `Q${qIndex + 1}` });
      setCharts({
        breath: [...breath.current],
        pulse: [...pulse.current],
        talk: [...talkLog.current],
        windows: [...windows.current],
      });
      setAnswers((a) => [
        ...a,
        {
          question: questions[qIndex],
          transcript,
          startMs: start,
          endMs: end,
          ...talk,
          words,
          wpm: verdict.wpm,
          fillers,
          breathAvg,
          pulseAvg,
          flags: verdict.flags,
          level: verdict.level,
          review,
        },
      ]);
      setPhase("feedback");
    } catch (err) {
      console.warn(err);
      setError(friendlyAiError(err));
      setPhase("ready");
    }
  }

  async function finishPractice(all: AnswerResult[]) {
    setPhase("summarizing");
    const total = now();
    setTotalMs(total);
    setCharts({
      breath: [...breath.current],
      pulse: [...pulse.current],
      talk: [...talkLog.current],
      windows: [...windows.current],
    });
    try {
      await provider.current?.stop();
    } catch (err) {
      console.warn(err);
    }
    provider.current?.destroy();
    provider.current = null;
    let rep: Report;
    try {
      rep = await summarizeSession(topic, all);
    } catch (err) {
      console.warn(err);
      setNotice(friendlyAiError(err));
      rep = { overall: "", doThis: [], avoidThis: [], composureNote: "" };
    }
    setReport(rep);
    save(all, total);
    setPhase("done");
  }

  function save(all: AnswerResult[], total: number) {
    if (all.length === 0) return;
    const avg = all.reduce((s, a) => s + a.review.rating, 0) / all.length;
    const worst = all.some((a) => a.level === "raised")
      ? "raised"
      : all.some((a) => a.level === "mostly")
        ? "mostly"
        : "steady";
    try {
      const old = JSON.parse(localStorage.getItem("humankit-sessions") || "[]");
      const entry = {
        id: Date.now(),
        tool: "SpeakEasy",
        date: new Date().toISOString(),
        duration: Math.floor(total / 1000),
        measurement: `${all.length} answers · average ${avg.toFixed(1)}/5 · ${LEVELS[worst].label}`,
        topic,
      };
      localStorage.setItem(
        "humankit-sessions",
        JSON.stringify([entry, ...old]),
      );
    } catch (err) {
      console.warn(err);
    }
  }

  function nextStep() {
    setError("");
    if (qIndex + 1 < questions.length) {
      setQIndex(qIndex + 1);
      setPhase("ready");
    } else {
      finishPractice(answers);
    }
  }

  async function endEarly() {
    mic.current?.getTracks().forEach((t) => t.stop());
    if (answers.length > 0) return finishPractice(answers);
    try {
      await provider.current?.stop();
    } catch (err) {
      console.warn(err);
    }
    provider.current?.destroy();
    provider.current = null;
    resetAll();
    setPhase("setup");
  }

  function again() {
    resetAll();
    setQuestions([]);
    setPhase("setup");
  }

  const duration = Math.max(phase === "done" ? totalMs : elapsed, BASELINE_MS);
  const inSession =
    phase !== "setup" &&
    phase !== "generating" &&
    phase !== "done" &&
    phase !== "summarizing";
  const showCharts = phase !== "setup" && phase !== "generating";

  return (
    <div className="mx-auto max-w-6xl">
      {askConsent && (
        <CameraConsent
          onCancel={() => setAskConsent(false)}
          onAgree={() => {
            giveCameraConsent();
            setAskConsent(false);
            createQuestions();
          }}
        />
      )}

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
            style={{ background: "#eeebff", color: ACCENT }}
          >
            <Mic size={13} /> Interview coach
          </div>
          <h1 className="text-3xl font-bold tracking-[-.03em]">SpeakEasy</h1>
          <p className="mt-2 text-[#718096]">
            Practice real questions. See how steady you were. Get honest
            feedback.
          </p>
        </div>
        <div className="flex gap-2">
          <Pill
            on={cameraOn}
            on_label="Camera is on"
            off_label="Camera is off"
          />
          <Pill
            on={micOn}
            on_label="Microphone is on"
            off_label="Microphone is off"
          />
        </div>
      </div>

      {error && (
        <div className="mt-6 rounded-xl border border-[#efcaca] bg-[#fdf3f3] p-4 text-sm text-[#a94b4b]">
          {error}
        </div>
      )}
      {notice && inSession && (
        <div className="mt-6 rounded-xl border border-[#f0e2bf] bg-[#fdf8ea] p-4 text-sm text-[#8a6a1c]">
          {notice}
        </div>
      )}

      {(phase === "setup" || phase === "generating") && (
        <section className="mt-8 max-w-2xl rounded-2xl border border-[#e7e8f0] bg-white p-6 shadow-[0_8px_30px_rgba(31,36,64,.04)]">
          <h2 className="text-lg font-semibold">
            What are you practicing for?
          </h2>
          <p className="mt-1 text-sm text-[#718096]">
            The AI will ask you questions about it.
          </p>
          <textarea
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            rows={3}
            placeholder="Example: A junior frontend developer interview at a fintech company"
            className="mt-4 w-full rounded-xl border border-[#e7e8f0] p-3 text-sm outline-none focus:border-[#6958d9]"
          />
          <div className="mt-4 flex items-center gap-3 text-sm">
            <label htmlFor="count" className="text-[#718096]">
              Number of questions
            </label>
            <select
              id="count"
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
              className="rounded-lg border border-[#e7e8f0] px-3 py-2"
            >
              {[3, 4, 5].map((n) => (
                <option key={n}>{n}</option>
              ))}
            </select>
          </div>
          <ul className="mt-5 list-disc space-y-1 pl-5 text-xs leading-5 text-[#8992a6]">
            <li>
              Sit so your face and chest are in the picture, with good light in
              front of you.
            </li>
            {/* <li>
              First you sit quietly for 25 seconds so we can see your resting
              level.
            </li> */}
            <li>
              First, sit quietly for 40 seconds. Breathing needs a full
              30-second measurement window, and we use extra time to collect
              valid readings.
            </li>
            <li>Then you answer out loud, like a real interview.</li>
          </ul>
          {!GROQ_API_KEY && (
            <p className="mt-4 text-xs text-[#a94b4b]">
              Your Groq API key is missing. Add it to the .env.local file and
              restart the app.
            </p>
          )}
          <button
            onClick={createQuestions}
            disabled={phase === "generating"}
            className="mt-6 flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
            style={{ background: ACCENT }}
          >
            {phase === "generating" ? (
              <>
                <Loader2 size={15} className="animate-spin" /> Getting ready…
              </>
            ) : (
              <>
                <Sparkles size={15} /> Create my questions
              </>
            )}
          </button>
        </section>
      )}

      {showCharts && (
        <div className="mt-8 grid gap-5 lg:grid-cols-[1.1fr_1fr]">
          <div className="space-y-5">
            {phase !== "done" && (
              <section className="rounded-2xl border border-[#e7e8f0] bg-white p-5 shadow-[0_8px_30px_rgba(31,36,64,.04)]">
                <div className="relative flex aspect-video items-center justify-center overflow-hidden rounded-xl bg-[#20283d]">
                  <video
                    ref={video}
                    muted
                    playsInline
                    className={`absolute inset-0 h-full w-full -scale-x-100 object-cover ${cameraOn ? "" : "hidden"}`}
                  />
                  {phase === "position" && cameraOn && (
                    <svg
                      className="pointer-events-none absolute inset-0 h-full w-full"
                      viewBox="0 0 160 90"
                      preserveAspectRatio="none"
                      aria-hidden="true"
                    >
                      <ellipse
                        cx="80"
                        cy="30"
                        rx="15"
                        ry="20"
                        fill="none"
                        stroke="white"
                        strokeWidth="1"
                        strokeDasharray="3 3"
                        opacity="0.8"
                      />
                      <rect
                        x="30"
                        y="54"
                        width="100"
                        height="40"
                        rx="12"
                        fill="none"
                        stroke="white"
                        strokeWidth="1"
                        strokeDasharray="3 3"
                        opacity="0.8"
                      />
                    </svg>
                  )}
                  {!cameraOn && <Camera size={28} className="text-white/60" />}
                  {inSession && (
                    <span className="absolute left-3 top-3 rounded-full bg-black/50 px-3 py-1 text-xs font-medium text-white">
                      {talkingNow === null
                        ? "Waiting for a reliable measurement."
                        : talkingNow
                          ? "Talking detected"
                          : "Silence"}
                    </span>
                  )}
                </div>
                {inSession && validation.code !== null && (
                  <div className="mt-3 text-xs">
                    <p
                      className={`font-semibold ${validation.code === 0 ? "text-[#287d70]" : "text-[#b4532f]"}`}
                    >
                      {describeValidation(validation.code)}
                    </p>
                    {validation.code !== 0 && validation.hint && (
                      <p className="mt-1 text-[#8992a6]">
                        Presage says: {validation.hint}
                      </p>
                    )}
                    <p className="mt-1 text-[11px] text-[#a3aaba]">
                      Readings received: breathing {counts.breath} · pulse{" "}
                      {counts.pulse}
                    </p>
                  </div>
                )}
              </section>
            )}

            {phase === "position" && (
              <Card>
                <h2 className="text-lg font-semibold">Get into position</h2>
                <p className="mt-2 text-sm leading-6 text-[#718096]">
                  Sit back so your head and shoulders fit inside the dashed
                  shapes, with your upper chest showing. Put the light in front
                  of you, not behind you, and hold still.
                </p>
                <div className="mt-5 flex items-center gap-4">
                  <button
                    onClick={beginBaseline}
                    disabled={validation.code !== 0}
                    className="rounded-xl px-5 py-3 text-sm font-semibold text-white disabled:opacity-40"
                    style={{ background: ACCENT }}
                  >
                    I&apos;m in position
                  </button>
                  <button
                    onClick={beginBaseline}
                    className="text-xs font-semibold text-[#8992a6] underline"
                  >
                    Continue anyway
                  </button>
                </div>
                <p className="mt-3 text-xs text-[#8992a6]">
                  The button turns on when Presage says the picture is good.
                </p>
              </Card>
            )}

            {phase === "baseline" && (
              <Card>
                <h2 className="text-lg font-semibold">
                  Sit still and breathe normally
                </h2>
                <p className="mt-2 text-sm text-[#718096]">
                  This shows us your resting breathing and pulse. Later answers
                  are compared with it.
                </p>
                <p className="mt-4 font-mono text-3xl font-semibold">
                  {Math.ceil(baselineLeft / 1000)}s
                </p>
                <button
                  onClick={finishBaseline}
                  className="mt-4 text-xs font-semibold text-[#8992a6] underline"
                >
                  Skip this step
                </button>
              </Card>
            )}

            {(phase === "ready" ||
              phase === "answering" ||
              phase === "processing") && (
              <Card>
                <p
                  className="text-xs font-semibold uppercase tracking-wider"
                  style={{ color: ACCENT }}
                >
                  Question {qIndex + 1} of {questions.length}
                </p>
                <h2 className="mt-2 text-xl font-semibold leading-snug">
                  {questions[qIndex]}
                </h2>
                {phase === "ready" && (
                  <button
                    onClick={startAnswer}
                    className="mt-5 flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-white"
                    style={{ background: ACCENT }}
                  >
                    <Play size={15} fill="currentColor" /> Start answering
                  </button>
                )}
                {phase === "answering" && (
                  <div className="mt-5 flex items-center gap-4">
                    <button
                      onClick={finishAnswer}
                      className="flex items-center gap-2 rounded-xl bg-[#20283d] px-5 py-3 text-sm font-semibold text-white"
                    >
                      <Square size={14} fill="currentColor" /> Finish answer
                    </button>
                    <span className="font-mono text-lg font-semibold">
                      {clock(answerElapsed)}
                    </span>
                    <span className="text-xs text-[#8992a6]">
                      Speak as you would in the real interview.
                    </span>
                  </div>
                )}
                {phase === "processing" && (
                  <p className="mt-5 flex items-center gap-2 text-sm text-[#718096]">
                    <Loader2 size={15} className="animate-spin" /> Turning your
                    voice into text and reviewing your answer…
                  </p>
                )}
              </Card>
            )}

            {phase === "feedback" && answers.length > 0 && (
              <Feedback
                a={answers[answers.length - 1]}
                last={qIndex + 1 >= questions.length}
                onNext={nextStep}
              />
            )}
            {phase === "summarizing" && (
              <Card>
                <p className="flex items-center gap-2 text-sm text-[#718096]">
                  <Loader2 size={15} className="animate-spin" /> Putting your
                  results together…
                </p>
              </Card>
            )}
            {phase === "done" && report && (
              <Results
                topic={topic}
                answers={answers}
                report={report}
                onAgain={again}
              />
            )}

            {inSession && phase !== "processing" && (
              <button
                onClick={endEarly}
                className="text-xs font-semibold text-[#8992a6] underline"
              >
                {answers.length > 0
                  ? "End practice and see results"
                  : "Cancel practice"}
              </button>
            )}
          </div>

          <aside className="space-y-5">
            <LineChart
              title="Breathing rate"
              unit="breaths/min"
              color="#2f9e8f"
              samples={charts.breath}
              duration={duration}
              baseline={baseline.breath}
              windows={charts.windows}
            />
            <LineChart
              title="Pulse rate"
              unit="beats/min"
              color="#d9604f"
              samples={charts.pulse}
              duration={duration}
              baseline={baseline.pulse}
              windows={charts.windows}
            />
            <TalkTimeline
              log={charts.talk}
              duration={duration}
              windows={charts.windows}
            />
            <p className="px-1 text-[11px] leading-5 text-[#8992a6]">
              Breathing and pulse can rise for many reasons, such as excitement,
              movement or coffee. They are hints about your body, not a
              diagnosis. Pulse can take about 20 seconds to appear.
            </p>
          </aside>
        </div>
      )}
    </div>
  );
}

function Pill({
  on,
  on_label,
  off_label,
}: {
  on: boolean;
  on_label: string;
  off_label: string;
}) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-[#e7e8f0] bg-white px-3 py-2.5">
      <span
        className={`h-2 w-2 rounded-full ${on ? "bg-[#e05252]" : "bg-[#c7cad4]"}`}
      />
      <span className="text-sm text-[#718096]">
        {on ? on_label : off_label}
      </span>
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-[#e7e8f0] bg-white p-6 shadow-[0_8px_30px_rgba(31,36,64,.04)]">
      {children}
    </section>
  );
}

function List({ items, color }: { items: string[]; color: string }) {
  return (
    <ul className="mt-2 space-y-1.5 text-sm leading-6 text-[#39415a]">
      {items.map((t, i) => (
        <li key={i} className="flex gap-2">
          <span style={{ color }}>●</span>
          <span>{t}</span>
        </li>
      ))}
    </ul>
  );
}

function Composure({ a }: { a: AnswerResult }) {
  // If Presage gave no breathing or pulse readings, we must not say "steady".
  const measured = a.breathAvg !== null || a.pulseAvg !== null;
  const l = measured
    ? LEVELS[a.level]
    : { label: "Pace and pauses only", color: "#4a5568", bg: "#f3f4f8" };
  return (
    <div className="rounded-xl p-4" style={{ background: l.bg }}>
      <p className="text-sm font-semibold" style={{ color: l.color }}>
        Body and pace: {l.label}
      </p>
      {a.flags.length > 0 && <List items={a.flags} color={l.color} />}
      {a.flags.length === 0 && (
        <p className="mt-2 text-sm text-[#39415a]">
          {measured
            ? "Your breathing, pulse and pace looked steady for this answer."
            : "Breathing and pulse could not be measured for this answer, so only your pace and pauses were checked. Nothing stood out."}
        </p>
      )}
      {!measured && a.flags.length > 0 && (
        <p className="mt-2 text-xs text-[#718096]">
          Breathing and pulse could not be measured for this answer.
        </p>
      )}
      <p className="mt-3 text-[11px] text-[#718096]">
        Breathing{" "}
        {a.breathAvg !== null ? a.breathAvg.toFixed(0) : "not measured"} · Pulse{" "}
        {a.pulseAvg !== null ? a.pulseAvg.toFixed(0) : "not measured"} · Talking{" "}
        {clock(a.talkingMs)} · Silence {clock(a.silenceMs)}
      </p>
    </div>
  );
}

function Feedback({
  a,
  last,
  onNext,
}: {
  a: AnswerResult;
  last: boolean;
  onNext: () => void;
}) {
  return (
    <Card>
      <div className="flex items-start justify-between gap-4">
        <h2 className="text-lg font-semibold">How that answer went</h2>
        <span
          className="rounded-full px-3 py-1 text-sm font-bold"
          style={{ background: "#eeebff", color: ACCENT }}
        >
          {a.review.rating}/5
        </span>
      </div>
      <p className="mt-2 text-sm leading-6 text-[#39415a]">
        {a.review.summary}
      </p>
      <h3 className="mt-4 text-sm font-semibold text-[#287d70]">What worked</h3>
      <List items={a.review.strengths} color="#287d70" />
      <h3 className="mt-4 text-sm font-semibold text-[#b4532f]">
        What to improve
      </h3>
      <List items={a.review.improvements} color="#b4532f" />
      <div className="mt-5">
        <Composure a={a} />
      </div>
      <details className="mt-4 text-sm">
        <summary className="cursor-pointer text-xs font-semibold text-[#8992a6]">
          What we heard
        </summary>
        <p className="mt-2 leading-6 text-[#718096]">{a.transcript}</p>
      </details>
      <button
        onClick={onNext}
        className="mt-5 flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-white"
        style={{ background: ACCENT }}
      >
        {last ? "See my results" : "Next question"} <ArrowRight size={15} />
      </button>
    </Card>
  );
}

function Results({
  topic,
  answers,
  report,
  onAgain,
}: {
  topic: string;
  answers: AnswerResult[];
  report: Report;
  onAgain: () => void;
}) {
  const avg =
    answers.reduce((s, a) => s + a.review.rating, 0) /
    Math.max(1, answers.length);
  return (
    <div className="space-y-5">
      <Card>
        <p
          className="text-xs font-semibold uppercase tracking-wider"
          style={{ color: ACCENT }}
        >
          Your results
        </p>
        <h2 className="mt-1 text-xl font-semibold">{topic}</h2>
        <p className="mt-1 text-sm text-[#718096]">
          {answers.length} answers · average {avg.toFixed(1)}/5
        </p>
        {report.overall && (
          <p className="mt-4 text-sm leading-6 text-[#39415a]">
            {report.overall}
          </p>
        )}
        {report.composureNote && (
          <p className="mt-3 rounded-xl bg-[#fafafd] p-3 text-sm leading-6 text-[#39415a]">
            {report.composureNote}
          </p>
        )}
        {report.doThis.length > 0 && (
          <>
            <h3 className="mt-5 text-sm font-semibold text-[#287d70]">
              Do this
            </h3>
            <List items={report.doThis} color="#287d70" />
          </>
        )}
        {report.avoidThis.length > 0 && (
          <>
            <h3 className="mt-5 text-sm font-semibold text-[#b4532f]">
              Avoid this
            </h3>
            <List items={report.avoidThis} color="#b4532f" />
          </>
        )}
      </Card>
      {answers.map((a, i) => (
        <Card key={i}>
          <div className="flex items-start justify-between gap-4">
            <h3 className="text-sm font-semibold">
              Q{i + 1}. {a.question}
            </h3>
            <span
              className="rounded-full bg-[#eeebff] px-3 py-1 text-sm font-bold"
              style={{ color: ACCENT }}
            >
              {a.review.rating}/5
            </span>
          </div>
          <p className="mt-2 text-sm leading-6 text-[#39415a]">
            {a.review.summary}
          </p>
          <div className="mt-4">
            <Composure a={a} />
          </div>
        </Card>
      ))}
      <div className="flex gap-3">
        <button
          onClick={onAgain}
          className="flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-white"
          style={{ background: ACCENT }}
        >
          <RotateCcw size={15} /> Practice again
        </button>
        <Link
          href="/history"
          className="rounded-xl border border-[#e7e8f0] bg-white px-5 py-3 text-sm font-semibold"
        >
          View history
        </Link>
      </div>
    </div>
  );
}
