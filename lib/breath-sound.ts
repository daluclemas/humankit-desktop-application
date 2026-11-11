// A soft "pad" sound that rises as you breathe in and falls as you breathe out.
// Made with the browser's built-in audio. No sound files are needed.

export interface BreathSound {
  start(): void;
  update(fill: number, level: number): void;
  chime(): void;
  stop(): void;
}

export function createBreathSound(): BreathSound {
  let ctx: AudioContext | null = null;
  let master: GainNode | null = null;
  let filter: BiquadFilterNode | null = null;
  let oscs: { osc: OscillatorNode; base: number }[] = [];
  let lastUpdate = 0;

  return {
    start() {
      try {
        const AC =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext })
            .webkitAudioContext;
        ctx = new AC();
        master = ctx.createGain();
        master.gain.value = 0;
        filter = ctx.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.value = 600;
        filter.Q.value = 0.6;
        filter.connect(master);
        master.connect(ctx.destination);
        const voices: [number, OscillatorType, number][] = [
          [130.81, "sine", -4],
          [196.0, "sine", 3],
          [261.63, "triangle", -2],
          [329.63, "sine", 5],
        ];
        oscs = voices.map(([base, type, detune]) => {
          const osc = ctx!.createOscillator();
          osc.type = type;
          osc.frequency.value = base;
          osc.detune.value = detune;
          const g = ctx!.createGain();
          g.gain.value = type === "triangle" ? 0.18 : 0.3;
          osc.connect(g);
          g.connect(filter!);
          osc.start();
          return { osc, base };
        });
      } catch {
        ctx = null;
      }
    },
    update(fill, level) {
      if (!ctx || !master || !filter) return;
      const now = ctx.currentTime;
      if (now - lastUpdate < 0.08) return;
      lastUpdate = now;
      for (const { osc, base } of oscs)
        osc.frequency.setTargetAtTime(base * (1 + 0.26 * fill), now, 0.2);
      filter.frequency.setTargetAtTime(450 + 900 * fill, now, 0.2);
      master.gain.setTargetAtTime(
        0.05 * (0.35 + 0.65 * fill) * level,
        now,
        0.25,
      );
    },
    chime() {
      if (!ctx) return;
      const now = ctx.currentTime;
      for (const [f, d] of [
        [660, 0],
        [990, 0.18],
      ] as const) {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = "sine";
        o.frequency.value = f;
        g.gain.setValueAtTime(0, now + d);
        g.gain.linearRampToValueAtTime(0.09, now + d + 0.03);
        g.gain.exponentialRampToValueAtTime(0.0001, now + d + 2.2);
        o.connect(g);
        g.connect(ctx.destination);
        o.start(now + d);
        o.stop(now + d + 2.3);
      }
    },
    stop() {
      if (!ctx || !master) return;
      const c = ctx;
      master.gain.setTargetAtTime(0, c.currentTime, 0.15);
      setTimeout(() => {
        try {
          oscs.forEach(({ osc }) => osc.stop());
          void c.close();
        } catch {
          // already closed
        }
      }, 3000);
      ctx = null;
      master = null;
      filter = null;
      oscs = [];
    },
  };
}
