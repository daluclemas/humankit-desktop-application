export type SignalStatus =
  | "not-connected"
  | "waiting"
  | "available"
  | "unavailable";

export interface SignalSnapshot {
  status: SignalStatus;
  value?: number;
  timestamp: number;
}

// The places where future measurements arrive. The screens only know about
// these names, never about Presage itself.
export interface SignalHandlers {
  onTalkingDetected?: (talking: boolean, timestampUs: number) => void;
  onBlinkDetected?: (blinking: boolean, timestampUs: number) => void;
  onBreathingRateReceived?: (
    breathsPerMinute: number,
    timestampUs: number,
  ) => void;
  onPulseRateReceived?: (beatsPerMinute: number, timestampUs: number) => void;
  // The live chest-movement wave. Each value rises and falls as you breathe.
  onBreathTrace?: (value: number, timestampUs: number) => void;
  onStream?: (stream: MediaStream | null) => void;
  onHint?: (message: string) => void;
  onValidation?: (code: number, hint: string) => void;
  onError?: (message: string) => void;
}

export interface SignalProvider {
  start(): Promise<void>;
  stop(): Promise<void>;
  destroy(): void;
}
