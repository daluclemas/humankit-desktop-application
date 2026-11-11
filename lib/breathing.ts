// The "brain" of the guide. It decides when to breathe in, hold and out.
// It knows nothing about the screen, so it is easy to test and change.

export type PhaseName = "ready" | "inhale" | "hold-in" | "exhale" | "hold-out";

// Seconds for each part of ONE breath.
export interface Cycle {
  inhale: number;
  holdIn: number;
  exhale: number;
  holdOut: number;
}

// What the screen needs to draw one picture.
export interface Frame {
  phase: PhaseName;
  fullness: number; // 0 = lungs empty, 1 = lungs full (smooth)
  progress: number; // 0 to 1 through the current phase
  secondsLeft: number; // seconds left in the current phase
  velocity: number; // how fast fullness is changing (+ in, - out)
  cycleIndex: number; // how many full breaths are done
  cycleProgress: number; // 0 to 1 through the whole breath
  marks: number[]; // where each part of the breath starts on the ring
  guideRate: number; // breaths per minute the guide is asking for now
}

export interface Pattern {
  id: string;
  name: string;
  blurb: string;
  shape: string;
  cycle: (index: number, startRate: number) => Cycle;
}

const total = (c: Cycle) => c.inhale + c.holdIn + c.exhale + c.holdOut;
const clamp = (n: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, n));
// Slow at the start and end, so the motion feels like a real breath.
const ease = (p: number) => 0.5 - 0.5 * Math.cos(Math.PI * clamp(p, 0, 1));

export const PATTERNS: Pattern[] = [
  {
    id: "adaptive",
    name: "Find your pace",
    blurb:
      "Starts at your own breathing speed, then slowly guides you down to a calm 6 breaths a minute.",
    shape: "Adapts to you",
    cycle: (i, start) => {
      const rate = Math.max(6, start - i * 0.4);
      const T = 60 / rate;
      return { inhale: T * 0.4, holdIn: 0, exhale: T * 0.6, holdOut: 0 };
    },
  },
  {
    id: "calm",
    name: "Calm 4-6",
    blurb: "In for 4 seconds, out for 6. A steady, gentle rhythm.",
    shape: "4 in · 6 out",
    cycle: () => ({ inhale: 4, holdIn: 0, exhale: 6, holdOut: 0 }),
  },
  {
    id: "box",
    name: "Box 4-4-4-4",
    blurb: "In, hold, out, hold. Four seconds each. Good for focus.",
    shape: "4 · 4 · 4 · 4",
    cycle: () => ({ inhale: 4, holdIn: 4, exhale: 4, holdOut: 4 }),
  },
  {
    id: "relax",
    name: "Relax 4-7-8",
    blurb: "In for 4, hold for 7, out for 8. A slow wind-down.",
    shape: "4 · 7 · 8",
    cycle: () => ({ inhale: 4, holdIn: 7, exhale: 8, holdOut: 0 }),
  },
];

// Dots on the ring where each part of a breath starts (after the first).
function marksOf(c: Cycle): number[] {
  const T = total(c);
  const raw = [c.inhale, c.inhale + c.holdIn, c.inhale + c.holdIn + c.exhale];
  return raw
    .map((x) => x / T)
    .filter((x, i, a) => x > 0 && x < 1 && a.indexOf(x) === i);
}

export class Pacer {
  paused = false;
  finished = false; // true once the time is up and the last breath is done
  elapsed = 0; // seconds of real breathing so far (lead-in not counted)
  private idx = 0;
  private t = 0;
  private cycle: Cycle;
  private leadLeft: number;
  private lastLevel = 0;
  private vel = 0;
  private startRate = 12;
  private lastFrame: Frame;

  constructor(
    private pattern: Pattern,
    private leadIn = 0,
    private getStartRate: () => number | null = () => null,
    private endAfter = Infinity, // seconds of breathing before we wrap up
  ) {
    this.leadLeft = leadIn;
    this.cycle = pattern.cycle(0, this.startRate);
    this.lastFrame = {
      phase: leadIn > 0 ? "ready" : "inhale",
      fullness: 0,
      progress: 0,
      secondsLeft: 0,
      velocity: 0,
      cycleIndex: 0,
      cycleProgress: 0,
      marks: marksOf(this.cycle),
      guideRate: 60 / total(this.cycle),
    };
  }

  peek(): Frame {
    return this.lastFrame;
  }

  advance(dt: number): Frame {
    if (this.paused || this.finished) return this.lastFrame;
    // Short "get comfortable" moment before the first breath.
    if (this.leadLeft > 0) {
      this.leadLeft -= dt;
      if (this.leadLeft > 0) {
        const spent = this.leadIn - this.leadLeft;
        this.lastFrame = {
          phase: "ready",
          fullness: 0.12 + 0.05 * Math.sin(spent * 1.3),
          progress: spent / this.leadIn,
          secondsLeft: this.leadLeft,
          velocity: 0,
          cycleIndex: 0,
          cycleProgress: spent / this.leadIn,
          marks: [],
          guideRate: 60 / total(this.cycle),
        };
        return this.lastFrame;
      }
      // Lead-in is over. Start from the person's own pace if we know it.
      this.startRate = clamp(this.getStartRate() ?? 12, 8, 20);
      this.cycle = this.pattern.cycle(0, this.startRate);
      this.t = 0;
      this.lastLevel = 0.12;
    }

    this.elapsed += dt;
    this.t += dt;
    let guard = 0;
    while (this.t >= total(this.cycle) && guard++ < 5) {
      this.t -= total(this.cycle);
      this.idx++;
      this.cycle = this.pattern.cycle(this.idx, this.startRate);
      // Time is up: stop at the end of a full breath, not in the middle.
      if (this.elapsed >= this.endAfter) {
        this.finished = true;
        this.lastFrame = {
          phase: "hold-out",
          fullness: 0,
          progress: 1,
          secondsLeft: 0,
          velocity: 0,
          cycleIndex: this.idx,
          cycleProgress: 1,
          marks: [],
          guideRate: 60 / total(this.cycle),
        };
        return this.lastFrame;
      }
    }

    const c = this.cycle;
    let t = this.t;
    let phase: PhaseName;
    let fullness: number;
    let length: number;
    if (t < c.inhale) {
      phase = "inhale";
      length = c.inhale;
      fullness = ease(t / c.inhale);
    } else if ((t -= c.inhale) < c.holdIn) {
      phase = "hold-in";
      length = c.holdIn;
      fullness = 1;
    } else if ((t -= c.holdIn) < c.exhale) {
      phase = "exhale";
      length = c.exhale;
      fullness = 1 - ease(t / c.exhale);
    } else {
      t -= c.exhale;
      phase = "hold-out";
      length = c.holdOut;
      fullness = 0;
    }

    const v = (fullness - this.lastLevel) / Math.max(dt, 0.001);
    this.vel += (v - this.vel) * 0.2;
    this.lastLevel = fullness;

    this.lastFrame = {
      phase,
      fullness,
      progress: length > 0 ? clamp(t / length, 0, 1) : 1,
      secondsLeft: Math.max(0, length - t),
      velocity: this.vel,
      cycleIndex: this.idx,
      cycleProgress: this.t / total(c),
      marks: marksOf(c),
      guideRate: 60 / total(c),
    };
    return this.lastFrame;
  }
}
