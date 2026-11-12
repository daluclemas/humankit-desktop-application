"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  AudioLines,
  Eye,
  Wind,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

const tools = [
  {
    name: "SpeakEasy",
    desc: "Practice presentations and interviews with confidence.",
    icon: AudioLines,
    color: "#e9e5ff",
    href: "/speakeasy",
  },
  {
    name: "ScreenBreak",
    desc: "Build awareness around blinking and healthy screen habits.",
    icon: Eye,
    color: "#ddf5f0",
    href: "/screenbreak",
  },
  {
    name: "BreatheBuddy",
    desc: "Find your calm with a simple guided breathing routine.",
    icon: Wind,
    color: "#fff0dc",
    href: "/breathebuddy",
  },
];
function Shell({
  children,
  active = "Dashboard",
}: {
  children: React.ReactNode;
  active?: string;
}) {
  return (
    <div className="min-h-screen bg-[#f8f8fc] text-[#182033] md:flex">
      <aside className="hidden w-[248px] shrink-0 border-r border-[#e7e8f0] bg-white px-5 py-7 md:flex md:flex-col">
        <Link href="/" className="mb-10 flex items-center gap-3 px-3">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#6958d9] text-white">
            <Sparkles size={18} />
          </span>
          <span className="text-lg font-bold tracking-tight">
            Human<span className="text-[#6958d9]">Kit</span>
          </span>
        </Link>
        <nav className="space-y-1">
          {[
            ["Dashboard", "/dashboard"],
            ["SpeakEasy", "/speakeasy"],
            ["ScreenBreak", "/screenbreak"],
            ["BreatheBuddy", "/breathebuddy"],
            ["History", "/history"],
            ["Privacy", "/privacy"],
          ].map(([label, href]) => (
            <Link
              key={label}
              href={href}
              className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium ${active === label ? "bg-[#eeebff] text-[#5948c7]" : "text-[#718096] hover:bg-[#f7f7fb]"}`}
            >
              {label}
            </Link>
          ))}
        </nav>
        <Link
          href="/privacy"
          className="mt-auto block rounded-2xl bg-[#f5f3ff] p-4 hover:bg-[#eeebff]"
        >
          <p className="text-xs font-semibold text-[#5948c7]">
            Your privacy matters
          </p>
          <p className="mt-2 text-xs leading-5 text-[#718096]">
            Your session history stays on this device.
          </p>
          <span className="mt-4 flex items-center justify-between text-xs font-semibold text-[#5948c7]">
            <ShieldCheck className="text-[#6958d9]" size={19} />
            Read how your data is used
          </span>
        </Link>
      </aside>
      <main className="min-w-0 flex-1">
        <header className="flex h-[76px] items-center justify-between border-b border-[#e7e8f0] bg-white/80 px-6 backdrop-blur md:px-10">
          <div className="md:hidden">
            <Link href="/" className="font-bold">
              Human<span className="text-[#6958d9]">Kit</span>
            </Link>
          </div>
          <div className="hidden md:block" />
          <div className="flex items-center gap-4">
            <Link
              href="/privacy"
              className="hidden text-xs text-[#718096] underline-offset-2 hover:underline sm:block"
            >
              All data stays on this device
            </Link>
            <div className="grid h-9 w-9 place-items-center rounded-full bg-[#e9e5ff] text-xs font-bold text-[#5948c7]">
              HK
            </div>
          </div>
        </header>
        <div className="px-6 py-9 md:px-10 lg:px-14">{children}</div>
      </main>
    </div>
  );
}
function ToolCard({ tool }: { tool: (typeof tools)[number] }) {
  const Icon = tool.icon;
  return (
    <div className="rounded-2xl border border-[#e7e8f0] bg-white p-5 shadow-[0_8px_30px_rgba(31,36,64,.04)]">
      <div className="mb-5 flex items-start justify-between">
        <span
          style={{ background: tool.color }}
          className="grid h-11 w-11 place-items-center rounded-xl"
        >
          <Icon size={20} className="text-[#39415a]" />
        </span>
        <span className="rounded-full bg-[#f5f5f8] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-[#8992a6]">
          Ready
        </span>
      </div>
      <h3 className="font-semibold">{tool.name}</h3>
      <p className="mt-2 min-h-10 text-sm leading-5 text-[#718096]">
        {tool.desc}
      </p>
      <Link
        href={tool.href}
        className="mt-5 flex items-center gap-2 text-sm font-semibold text-[#6958d9]"
      >
        Open tool <ArrowRight size={15} />
      </Link>
    </div>
  );
}
interface Session {
  id: number;
  tool: string;
  date: string;
  duration: number;
  measurement?: string;
}

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const TOOL_HREF: Record<string, string> = {
  SpeakEasy: "/speakeasy",
  ScreenBreak: "/screenbreak",
  BreatheBuddy: "/breathebuddy",
};

function greeting(d: Date) {
  const h = d.getHours();
  return h < 12
    ? "Good morning."
    : h < 17
      ? "Good afternoon."
      : "Good evening.";
}

// Monday = 0 ... Sunday = 6
const dayIndex = (d: Date) => (d.getDay() + 6) % 7;

function startOfWeek(d: Date) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() - dayIndex(x));
  return x;
}

function Dashboard() {
  // Read on the screen (not the server), so the date and history are real.
  const [now, setNow] = useState<Date | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  useEffect(() => {
    // localStorage.removeItem("humankit-camera-consent"); // remove old key if present
    // localStorage.removeItem("humankit-sessions"); // remove old sessions if present
    // localStorage.removeItem("humankit-consent-v2"); // remove old key if present

    setNow(new Date());
    try {
      const list = JSON.parse(
        localStorage.getItem("humankit-sessions") || "[]",
      );
      if (Array.isArray(list)) setSessions(list);
    } catch {
      setSessions([]);
    }
  }, []);

  const weekStart = now ? startOfWeek(now) : null;
  const minutes = DAY_NAMES.map(() => 0);
  if (weekStart) {
    for (const s of sessions) {
      const d = new Date(s.date);
      if (d >= weekStart && d.getTime() < weekStart.getTime() + 7 * 86400000) {
        minutes[dayIndex(d)] += (s.duration || 0) / 60;
      }
    }
  }
  const top = Math.max(...minutes, 1);
  const weekTotal = minutes.reduce((a, b) => a + b, 0);
  const today = now ? dayIndex(now) : -1;
  const recent = sessions.slice(0, 4);

  return (
    <Shell>
      <div className="mx-auto max-w-6xl">
        <div className="mb-9 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="mb-2 h-5 text-sm font-medium text-[#6958d9]">
              {now?.toLocaleDateString(undefined, {
                weekday: "long",
                month: "long",
                day: "numeric",
              })}
            </p>
            <h1 className="text-3xl font-bold tracking-[-.03em] md:text-4xl">
              {now ? greeting(now) : "Welcome."}
            </h1>
            <p className="mt-2 text-[#718096]">
              What would you like to focus on today?
            </p>
          </div>
          <Link
            href="/history"
            className="flex w-fit items-center gap-2 rounded-xl border border-[#e7e8f0] bg-white px-4 py-2.5 text-sm font-semibold shadow-sm"
          >
            View history <ArrowRight size={15} />
          </Link>
        </div>
        <div className="grid gap-5 md:grid-cols-3">
          {tools.map((t) => (
            <ToolCard key={t.name} tool={t} />
          ))}
        </div>
        <div className="mt-8 grid gap-5 lg:grid-cols-[1.4fr_1fr]">
          <section className="rounded-2xl border border-[#e7e8f0] bg-white p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-semibold">Activity overview</h2>
                <p className="mt-1 text-sm text-[#718096]">
                  {weekTotal > 0
                    ? `${Math.round(weekTotal)} minutes of practice this week`
                    : "Minutes of practice each day"}
                </p>
              </div>
              <span className="rounded-lg bg-[#f5f5f8] px-3 py-1.5 text-xs text-[#718096]">
                This week
              </span>
            </div>
            <div className="mt-8 flex h-32 items-end justify-between gap-3 px-2">
              {DAY_NAMES.map((d, i) => {
                const pct =
                  minutes[i] > 0 ? Math.max(8, (minutes[i] / top) * 100) : 4;
                return (
                  <div
                    key={d}
                    className="flex h-full flex-1 flex-col items-center justify-end gap-2"
                    title={`${d}: ${Math.round(minutes[i])} min`}
                  >
                    {minutes[i] > 0 && (
                      <span className="text-[10px] font-medium text-[#5948c7]">
                        {minutes[i] < 1 ? "<1" : Math.round(minutes[i])}m
                      </span>
                    )}
                    <div
                      className={`w-full max-w-9 rounded-t-lg ${i === today ? "bg-[#6958d9]" : "bg-[#d9d3fb]"}`}
                      style={{
                        height: `${pct}%`,
                        opacity: minutes[i] > 0 ? 1 : 0.45,
                      }}
                    />
                    <span
                      className={`text-[10px] ${i === today ? "font-semibold text-[#5948c7]" : "text-[#9aa2b3]"}`}
                    >
                      {d}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
          <section className="rounded-2xl border border-[#e7e8f0] bg-white p-6">
            <h2 className="font-semibold">Recent sessions</h2>
            <p className="mt-1 text-sm text-[#718096]">
              Your latest practice, saved on this device.
            </p>
            {recent.length === 0 ? (
              <div className="mt-8 rounded-xl bg-[#fafafd] p-5 text-center">
                <div className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-[#eeebff] text-[#6958d9]">
                  <Sparkles size={17} />
                </div>
                <p className="mt-3 text-sm font-medium">No sessions yet</p>
                <p className="mt-1 text-xs text-[#8992a6]">
                  Start a tool to begin building your history.
                </p>
              </div>
            ) : (
              <div className="mt-5 divide-y divide-[#f0f0f5]">
                {recent.map((s) => (
                  <Link
                    key={s.id}
                    href={TOOL_HREF[s.tool] ?? "/history"}
                    className="block py-3"
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-sm font-semibold">{s.tool}</span>
                      <span className="text-xs text-[#8992a6]">
                        {new Date(s.date).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                        })}{" "}
                        · {Math.max(1, Math.round((s.duration || 0) / 60))} min
                      </span>
                    </div>
                    {s.measurement && s.measurement !== "Not available" && (
                      <p className="mt-1 truncate text-xs text-[#718096]">
                        {s.measurement}
                      </p>
                    )}
                  </Link>
                ))}
                <Link
                  href="/history"
                  className="flex items-center gap-1 pt-3 text-xs font-semibold text-[#6958d9]"
                >
                  See all <ArrowRight size={13} />
                </Link>
              </div>
            )}
          </section>
        </div>
      </div>
    </Shell>
  );
}
export default function Page() {
  return <Dashboard />;
}
