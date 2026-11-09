export type Sample = { t: number; v: number }; // t = milliseconds since practice began
export type TalkEvent = { t: number; talking: boolean };
export type Win = { start: number; end: number; label: string };
export type Level = "steady" | "mostly" | "raised";

export interface Review {
  rating: number;
  summary: string;
  strengths: string[];
  improvements: string[];
}

export interface AnswerResult {
  question: string;
  transcript: string;
  startMs: number;
  endMs: number;
  talkingMs: number;
  silenceMs: number;
  longestSilenceMs: number;
  words: number;
  wpm: number | null;
  fillers: number;
  breathAvg: number | null;
  pulseAvg: number | null;
  flags: string[];
  level: Level;
  review: Review;
}

export interface Report {
  overall: string;
  doThis: string[];
  avoidThis: string[];
  composureNote: string;
}
