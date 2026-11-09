import type { Level, TalkEvent } from "@/types/coach";

export const mean = (v: number[]) =>
  v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;

export function median(v: number[]) {
  if (!v.length) return null;
  const s = [...v].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export const countWords = (text: string) =>
  text.trim() ? text.trim().split(/\s+/).length : 0;

const FILLERS =
  /\b(um+|uh+|erm|er|ah|you know|basically|actually|kind of|sort of)\b/gi;
export const countFillers = (text: string) =>
  (text.match(FILLERS) ?? []).length;

// How long talking and silence lasted between two moments.
export function talkStats(log: TalkEvent[], start: number, end: number) {
  let state: boolean | null = null;
  let i = 0;
  while (i < log.length && log[i].t <= start) {
    state = log[i].talking;
    i++;
  }
  let talkingMs = 0;
  let silenceMs = 0;
  let longestSilenceMs = 0;
  let run = 0;
  let cursor = start;
  const add = (until: number) => {
    const d = Math.max(0, until - cursor);
    if (state === true) {
      talkingMs += d;
      run = 0;
    } else if (state === false) {
      silenceMs += d;
      run += d;
      longestSilenceMs = Math.max(longestSilenceMs, run);
    }
    cursor = until;
  };
  for (; i < log.length && log[i].t < end; i++) {
    add(log[i].t);
    state = log[i].talking;
  }
  add(end);
  return { talkingMs, silenceMs, longestSilenceMs };
}

interface Input {
  words: number;
  fillers: number;
  talkingMs: number;
  longestSilenceMs: number;
  breathAvg: number | null;
  pulseAvg: number | null;
  baseBreath: number | null;
  basePulse: number | null;
}

// Simple, open rules. These are hints about your body and pace, not a diagnosis.
export function assess(x: Input): {
  wpm: number | null;
  flags: string[];
  level: Level;
} {
  const flags: string[] = [];
  let body = 0;

  if (
    x.breathAvg !== null &&
    x.baseBreath !== null &&
    x.breathAvg >= x.baseBreath + 3
  ) {
    flags.push(
      `Breathing was faster than at rest (${x.breathAvg.toFixed(0)} vs ${x.baseBreath.toFixed(0)} per minute).`,
    );
    body++;
  }
  if (
    x.pulseAvg !== null &&
    x.basePulse !== null &&
    x.pulseAvg >= x.basePulse + 8
  ) {
    flags.push(
      `Pulse was higher than at rest (${x.pulseAvg.toFixed(0)} vs ${x.basePulse.toFixed(0)} beats per minute).`,
    );
    body++;
  }

  const wpm =
    x.talkingMs >= 3000 ? Math.round(x.words / (x.talkingMs / 60000)) : null;
  if (wpm !== null && wpm > 170) {
    flags.push(`You spoke quickly (about ${wpm} words a minute).`);
    body++;
  } else if (wpm !== null && wpm < 90) {
    flags.push(`You spoke slowly (about ${wpm} words a minute).`);
  }

  if (x.longestSilenceMs > 6000) {
    flags.push(
      `There was a long pause of ${Math.round(x.longestSilenceMs / 1000)} seconds.`,
    );
  }
  if (x.words >= 20 && (x.fillers / x.words) * 100 > 6) {
    flags.push(`Many filler words (${x.fillers}), such as "um" or "you know".`);
  }

  const level: Level = body === 0 ? "steady" : body === 1 ? "mostly" : "raised";
  return { wpm, flags, level };
}
