import type { Sample, TalkEvent, Win } from "@/types/coach";

const W = 600;
const H = 150;
const PAD = 8;

// A simple line chart. Shaded blocks mark when you were answering.
export function LineChart({
  title,
  unit,
  color,
  samples,
  duration,
  baseline,
  windows,
}: {
  title: string;
  unit: string;
  color: string;
  samples: Sample[];
  duration: number;
  baseline?: number | null;
  windows: Win[];
}) {
  const span = Math.max(duration, 1);
  const x = (t: number) => PAD + (t / span) * (W - 2 * PAD);
  const values = samples.map((s) => s.v);
  const all = baseline != null ? [...values, baseline] : values;
  const lo = all.length ? Math.min(...all) - 2 : 0;
  const hi = all.length ? Math.max(...all) + 2 : 1;
  const y = (v: number) =>
    H - PAD - ((v - lo) / (hi - lo || 1)) * (H - 2 * PAD);
  const last = samples.at(-1);

  return (
    <div className="rounded-2xl border border-[#e7e8f0] bg-white p-5">
      <div className="flex items-baseline justify-between">
        <h3 className="text-sm font-semibold">{title}</h3>
        <span className="text-sm font-semibold" style={{ color }}>
          {last ? `${last.v.toFixed(0)} ${unit}` : "—"}
        </span>
      </div>
      {samples.length < 2 ? (
        <p className="mt-4 flex h-[110px] items-center justify-center rounded-lg bg-[#fafafd] text-xs text-[#8992a6]">
          Waiting for a reliable measurement.
        </p>
      ) : (
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="mt-3 h-[110px] w-full"
          role="img"
          aria-label={title}
        >
          {windows.map((w, i) => (
            <rect
              key={i}
              x={x(w.start)}
              y={0}
              width={Math.max(2, x(w.end) - x(w.start))}
              height={H}
              fill="#6958d9"
              opacity={0.1}
            />
          ))}
          {baseline != null && (
            <line
              x1={PAD}
              x2={W - PAD}
              y1={y(baseline)}
              y2={y(baseline)}
              stroke="#9aa2b3"
              strokeDasharray="5 5"
            />
          )}
          <polyline
            fill="none"
            stroke={color}
            strokeWidth={2.5}
            strokeLinejoin="round"
            strokeLinecap="round"
            points={samples.map((s) => `${x(s.t)},${y(s.v)}`).join(" ")}
          />
        </svg>
      )}
      <p className="mt-2 text-[11px] text-[#8992a6]">
        {baseline != null ? "Dashed line = your resting level. " : ""}Shaded =
        answering.
      </p>
    </div>
  );
}

// Shows when talking was detected across the whole practice.
export function TalkTimeline({
  log,
  duration,
  windows,
}: {
  log: TalkEvent[];
  duration: number;
  windows: Win[];
}) {
  const span = Math.max(duration, 1);
  return (
    <div className="rounded-2xl border border-[#e7e8f0] bg-white p-5">
      <h3 className="text-sm font-semibold">Talking and silence</h3>
      <div className="relative mt-4 h-10 overflow-hidden rounded-lg bg-[#f5f5f8]">
        {log.map((e, i) => {
          const end = log[i + 1]?.t ?? duration;
          return (
            <div
              key={i}
              className="absolute top-0 h-full"
              style={{
                left: `${(e.t / span) * 100}%`,
                width: `${(Math.max(0, end - e.t) / span) * 100}%`,
                background: e.talking ? "#6958d9" : "#eeebff",
              }}
            />
          );
        })}
        {windows.map((w, i) => (
          <div
            key={i}
            className="absolute top-0 h-full border-x-2 border-[#20283d]/30"
            style={{
              left: `${(w.start / span) * 100}%`,
              width: `${((w.end - w.start) / span) * 100}%`,
            }}
            title={w.label}
          />
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-4 text-[11px] text-[#8992a6]">
        <span className="flex items-center gap-1.5">
          <i className="h-2 w-2 rounded-full bg-[#6958d9]" /> Talking
        </span>
        <span className="flex items-center gap-1.5">
          <i className="h-2 w-2 rounded-full bg-[#eeebff]" /> Silence
        </span>
        <span>Outlined = answering</span>
      </div>
    </div>
  );
}
