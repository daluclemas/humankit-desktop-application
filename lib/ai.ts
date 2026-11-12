// import type { AnswerResult, Report, Review } from "@/types/coach";

// // The key is read from the .env.local file (see the setup steps).
// export const GROQ_API_KEY = process.env.NEXT_PUBLIC_GROQ_API_KEY ?? "";
// const BASE = "https://api.groq.com/openai/v1";
// // Model can be changed from .env.local without touching code.
// const CHAT_MODEL =
//   process.env.NEXT_PUBLIC_GROQ_CHAT_MODEL ?? "openai/gpt-oss-120b";
// const SPEECH_MODEL = "whisper-large-v3-turbo";

// export class AiError extends Error {
//   constructor(
//     public kind: "key" | "rejected" | "limit" | "network" | "other",
//     message: string,
//   ) {
//     super(message);
//   }
// }

// export function friendlyAiError(err: unknown): string {
//   if (err instanceof AiError) {
//     if (err.kind === "key")
//       return "Your Groq API key is missing. Add it to the .env.local file and restart the app.";
//     if (err.kind === "rejected")
//       return "Groq did not accept the API key. Please check it and try again.";
//     if (err.kind === "limit")
//       return "The free AI limit was reached. Please wait a minute and try again.";
//     if (err.kind === "network")
//       return "We could not reach the AI service. Please check your internet and try again.";
//   }
//   return "The AI service had a problem. Please try again.";
// }

// async function call(path: string, init: RequestInit): Promise<unknown> {
//   if (!GROQ_API_KEY) throw new AiError("key", "missing key");
//   let res: Response;
//   try {
//     res = await fetch(`${BASE}${path}`, {
//       ...init,
//       headers: {
//         ...(init.headers ?? {}),
//         Authorization: `Bearer ${GROQ_API_KEY}`,
//       },
//     });
//   } catch (err) {
//     console.warn("[ai] network problem", err);
//     throw new AiError("network", "network");
//   }
//   if (!res.ok) {
//     const body = await res.text().catch(() => "");
//     console.warn("[ai]", res.status, body);
//     if (res.status === 401 || res.status === 403)
//       throw new AiError("rejected", "rejected");
//     if (res.status === 429) throw new AiError("limit", "limit");
//     throw new AiError("other", `status ${res.status}`);
//   }
//   return res.json();
// }

// async function chatJson<T>(system: string, user: string): Promise<T> {
//   const data = (await call("/chat/completions", {
//     method: "POST",
//     headers: { "Content-Type": "application/json" },
//     body: JSON.stringify({
//       model: CHAT_MODEL,
//       temperature: 0.4,
//       response_format: { type: "json_object" },
//       messages: [
//         { role: "system", content: system },
//         { role: "user", content: user },
//       ],
//     }),
//   })) as { choices?: { message?: { content?: string } }[] };
//   const text = data.choices?.[0]?.message?.content ?? "";
//   try {
//     return JSON.parse(text) as T;
//   } catch {
//     throw new AiError("other", "bad json");
//   }
// }

// const STYLE =
//   "Use short, simple, friendly English. Be specific and honest. Never diagnose or give medical advice, and never state as fact that the person is nervous.";

// export async function generateQuestions(
//   topic: string,
//   count: number,
// ): Promise<string[]> {
//   const out = await chatJson<{ questions?: string[] }>(
//     `You are an interview and presentation coach. ${STYLE} Reply as JSON: {"questions": [string]}.`,
//     `The person is practicing for: "${topic}". Write exactly ${count} realistic questions they could be asked, from easier to harder. One sentence each.`,
//   );
//   const list = (out.questions ?? [])
//     .filter((q) => typeof q === "string" && q.trim())
//     .slice(0, count);
//   if (list.length === 0) throw new AiError("other", "no questions");
//   return list;
// }

// export async function transcribe(audio: Blob): Promise<string> {
//   const form = new FormData();
//   form.append("file", audio, "answer.webm");
//   form.append("model", SPEECH_MODEL);
//   form.append("language", "en");
//   form.append("temperature", "0");
//   const data = (await call("/audio/transcriptions", {
//     method: "POST",
//     body: form,
//   })) as { text?: string };
//   return (data.text ?? "").trim();
// }

// export interface AnswerFacts {
//   topic: string;
//   question: string;
//   transcript: string;
//   seconds: number;
//   wpm: number | null;
//   fillers: number;
//   longestPauseSeconds: number;
//   flags: string[];
// }

// export async function reviewAnswer(f: AnswerFacts): Promise<Review> {
//   const out = await chatJson<Partial<Review>>(
//     `You are a supportive interview coach. ${STYLE} Judge the CONTENT of the answer: is it relevant, clear, specific, and well organised? Body signals are only hints. Reply as JSON: {"rating": integer 1-5, "summary": string (max 2 sentences), "strengths": [2 or 3 strings], "improvements": [2 or 3 strings]}.`,
//     JSON.stringify(f),
//   );
//   return {
//     rating: Math.min(5, Math.max(1, Math.round(Number(out.rating) || 3))),
//     summary: out.summary ?? "",
//     strengths: out.strengths ?? [],
//     improvements: out.improvements ?? [],
//   };
// }

// export async function summarizeSession(
//   topic: string,
//   answers: AnswerResult[],
// ): Promise<Report> {
//   const facts = answers.map((a) => ({
//     question: a.question,
//     rating: a.review.rating,
//     feedback: a.review.summary,
//     bodyLevel: a.level,
//     notes: a.flags,
//   }));
//   const out = await chatJson<Partial<Report>>(
//     `You are a supportive interview coach. ${STYLE} Reply as JSON: {"overall": string (2-3 sentences), "doThis": [3 or 4 short tips on what to do], "avoidThis": [3 or 4 short tips on what to avoid], "composureNote": string (1-2 sentences about how steady they looked, based only on the notes; say these are hints, not facts)}.`,
//     JSON.stringify({ practicingFor: topic, answers: facts }),
//   );
//   return {
//     overall: out.overall ?? "",
//     doThis: out.doThis ?? [],
//     avoidThis: out.avoidThis ?? [],
//     composureNote: out.composureNote ?? "",
//   };
// }

import type { AnswerResult, Report, Review } from "@/types/coach";

// The key is read from the .env.local file (see the setup steps).
export const GROQ_API_KEY = process.env.NEXT_PUBLIC_GROQ_API_KEY ?? "";
const BASE = "https://api.groq.com/openai/v1";
// Model can be changed from .env.local without touching code.
const CHAT_MODEL =
  process.env.NEXT_PUBLIC_GROQ_CHAT_MODEL ?? "openai/gpt-oss-120b";
const SPEECH_MODEL = "whisper-large-v3-turbo";

export class AiError extends Error {
  constructor(
    public kind: "key" | "rejected" | "limit" | "network" | "other",
    message: string,
  ) {
    super(message);
  }
}

export function friendlyAiError(err: unknown): string {
  if (err instanceof AiError) {
    if (err.kind === "key")
      return "Your Groq API key is missing. Add it to the .env.local file and restart the app.";
    if (err.kind === "rejected")
      return "Groq did not accept the API key. Please check it and try again.";
    if (err.kind === "limit")
      return "The free AI limit was reached. Please wait a minute and try again.";
    if (err.kind === "network")
      return "We could not reach the AI service. Please check your internet and try again.";
  }
  return "The AI service had a problem. Please try again.";
}

async function call(path: string, init: RequestInit): Promise<unknown> {
  if (!GROQ_API_KEY) throw new AiError("key", "missing key");
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      ...init,
      headers: {
        ...(init.headers ?? {}),
        Authorization: `Bearer ${GROQ_API_KEY}`,
      },
    });
  } catch (err) {
    console.warn("[ai] network problem", err);
    throw new AiError("network", "network");
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.warn("[ai]", res.status, body);
    if (res.status === 401 || res.status === 403)
      throw new AiError("rejected", "rejected");
    if (res.status === 429) throw new AiError("limit", "limit");
    throw new AiError("other", `status ${res.status}`);
  }
  return res.json();
}

async function chatJson<T>(system: string, user: string): Promise<T> {
  const data = (await call("/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: CHAT_MODEL,
      temperature: 0.4,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  })) as { choices?: { message?: { content?: string } }[] };
  const text = data.choices?.[0]?.message?.content ?? "";
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new AiError("other", "bad json");
  }
}

const STYLE =
  "Use short, simple, friendly English. Be specific and honest. Never diagnose or give medical advice, and never state as fact that the person is nervous.";

export async function generateQuestions(
  topic: string,
  count: number,
): Promise<string[]> {
  const out = await chatJson<{ questions?: string[] }>(
    `You are an interview and presentation coach. ${STYLE} Reply as JSON: {"questions": [string]}.`,
    `The person is practicing for: "${topic}". Write exactly ${count} realistic questions they could be asked, from easier to harder. One sentence each.`,
  );
  const list = (out.questions ?? [])
    .filter((q) => typeof q === "string" && q.trim())
    .slice(0, count);
  if (list.length === 0) throw new AiError("other", "no questions");
  return list;
}

export async function transcribe(audio: Blob): Promise<string> {
  const form = new FormData();
  form.append("file", audio, "answer.webm");
  form.append("model", SPEECH_MODEL);
  form.append("language", "en");
  form.append("temperature", "0");
  const data = (await call("/audio/transcriptions", {
    method: "POST",
    body: form,
  })) as { text?: string };
  return (data.text ?? "").trim();
}

export interface AnswerFacts {
  topic: string;
  question: string;
  transcript: string;
  seconds: number;
  wpm: number | null;
  fillers: number;
  longestPauseSeconds: number;
  flags: string[];
}

export async function reviewAnswer(f: AnswerFacts): Promise<Review> {
  const out = await chatJson<Partial<Review>>(
    `You are a supportive interview coach. ${STYLE} Judge the CONTENT of the answer: is it relevant, clear, specific, and well organised? Body measurements must not be used to judge confidence, nervousness, or answer quality. Reply as JSON: {"rating": integer 1-5, "summary": string (max 2 sentences), "strengths": [2 or 3 strings], "improvements": [2 or 3 strings]}.`,
    JSON.stringify(f),
  );
  return {
    rating: Math.min(5, Math.max(1, Math.round(Number(out.rating) || 3))),
    summary: out.summary ?? "",
    strengths: out.strengths ?? [],
    improvements: out.improvements ?? [],
  };
}

export async function summarizeSession(
  topic: string,
  answers: AnswerResult[],
): Promise<Report> {
  const facts = answers.map((a) => ({
    question: a.question,
    rating: a.review.rating,
    feedback: a.review.summary,
    notes: a.flags,
  }));
  const out = await chatJson<Partial<Report>>(
    `You are a supportive interview coach. ${STYLE} Use only the supplied answer feedback and factual observations. Do not infer how the person felt, looked, or how confident they were. Do not describe breathing or pulse changes as stress or nervousness. Reply as JSON: {"overall": string (2-3 sentences), "doThis": [3 or 4 short tips on what to do], "avoidThis": [3 or 4 short tips on what to avoid], "composureNote": string (1-2 sentences that only describe the supplied measurable observations; if there are none, say there were not enough observations)}.`,
    JSON.stringify({ practicingFor: topic, answers: facts }),
  );
  return {
    overall: out.overall ?? "",
    doThis: out.doThis ?? [],
    avoidThis: out.avoidThis ?? [],
    composureNote: out.composureNote ?? "",
  };
}
