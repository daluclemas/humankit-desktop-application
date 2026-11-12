// "use client";
// import Link from "next/link";
// import { Camera, ShieldCheck } from "lucide-react";

// // Shown once, before the camera, microphone or AI service are first used.
// export default function CameraConsent({
//   onAgree,
//   onCancel,
// }: {
//   onAgree: () => void;
//   onCancel: () => void;
// }) {
//   return (
//     <div
//       className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/40 p-4"
//       role="dialog"
//       aria-modal="true"
//       aria-labelledby="consent-title"
//     >
//       <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
//         <div className="grid h-11 w-11 place-items-center rounded-xl bg-[#eeebff] text-[#6958d9]">
//           <Camera size={20} />
//         </div>
//         <h2
//           id="consent-title"
//           className="mt-4 text-xl font-bold tracking-[-.02em]"
//         >
//           Before we start
//         </h2>
//         <p className="mt-2 text-sm leading-6 text-[#718096]">
//           SpeakEasy uses your camera, your microphone and an AI service to run a
//           practice interview.
//         </p>
//         <ul className="mt-4 space-y-2 text-sm leading-6 text-[#39415a]">
//           <li>
//             <b>Camera:</b> on during practice, with a &ldquo;Camera is on&rdquo;
//             label. It is used to measure breathing, pulse and talking. HumanKit
//             does not record, save or upload your video.
//           </li>
//           <li>
//             <b>Microphone:</b> on only while you answer a question, with a
//             &ldquo;Microphone is on&rdquo; label.
//           </li>
//           <li>
//             <b>AI service (Groq):</b> receives the topic you type, a recording
//             of each answer (to turn it into text), and the text plus your
//             numbers (to write questions and feedback).
//           </li>
//           <li>
//             <b>Saved on this device:</b> only a short summary of each practice.
//           </li>
//           <li>
//             Presage&apos;s measuring tool needs internet to check this
//             app&apos;s key.
//           </li>
//         </ul>
//         <p className="mt-4 text-xs text-[#8992a6]">
//           Delete everything any time on the{" "}
//           <Link
//             href="/privacy"
//             className="font-semibold text-[#6958d9] underline"
//           >
//             Privacy page
//           </Link>
//           . HumanKit gives no medical advice.
//         </p>
//         <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
//           <button
//             onClick={onCancel}
//             className="rounded-xl bg-[#f3f3f7] px-4 py-2.5 text-sm font-semibold"
//           >
//             Not now
//           </button>
//           <button
//             onClick={onAgree}
//             className="flex items-center justify-center gap-2 rounded-xl bg-[#6958d9] px-4 py-2.5 text-sm font-semibold text-white"
//           >
//             <ShieldCheck size={15} /> I agree
//           </button>
//         </div>
//       </div>
//     </div>
//   );
// }

"use client";
import Link from "next/link";
import { Camera, ShieldCheck } from "lucide-react";

// Shown before the camera, microphone or AI service are first used.
export default function CameraConsent({
  onAgree,
  onCancel,
}: {
  onAgree: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="consent-title"
    >
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <div className="grid h-11 w-11 place-items-center rounded-xl bg-[#eeebff] text-[#6958d9]">
          <Camera size={20} />
        </div>
        <h2
          id="consent-title"
          className="mt-4 text-xl font-bold tracking-[-.02em]"
        >
          Before we start
        </h2>
        <p className="mt-2 text-sm leading-6 text-[#718096]">
          HumanKit uses your camera, and SpeakEasy also uses your microphone and
          an outside AI service.
        </p>
        <ul className="mt-4 space-y-2 text-sm leading-6 text-[#39415a]">
          <li>
            <b>Camera:</b> the camera stream is passed to Presage SmartSpectra
            to calculate breathing, pulse, talking or blinking signals. HumanKit
            does not create or save a video recording. Presage&apos;s own data
            processing is governed by its documentation and privacy terms.
          </li>
          <li>
            <b>Microphone:</b> SpeakEasy records while you answer. The recording
            is sent to Groq to turn your answer into text. HumanKit does not
            save the audio recording as part of your session history.
          </li>
          <li>
            <b>AI service (Groq):</b> receives the topic you type, your answer
            recording for transcription, and the answer text and selected
            measurements for feedback.
          </li>
          <li>
            <b>Saved on this device:</b> HumanKit saves a short session summary
            in this app&apos;s local storage.
          </li>
          <li>
            Presage SmartSpectra and Groq need an internet connection. Their
            handling of information is also subject to their own terms.
          </li>
        </ul>
        <p className="mt-4 text-xs text-[#8992a6]">
          You can delete locally saved sessions and your saved camera agreement
          on the{" "}
          <Link
            href="/privacy"
            className="font-semibold text-[#6958d9] underline"
          >
            Privacy page
          </Link>
          . Deleting local data does not delete information already sent to
          outside services. HumanKit gives no medical advice.
        </p>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            onClick={onCancel}
            className="rounded-xl bg-[#f3f3f7] px-4 py-2.5 text-sm font-semibold"
          >
            Not now
          </button>
          <button
            onClick={onAgree}
            className="flex items-center justify-center gap-2 rounded-xl bg-[#6958d9] px-4 py-2.5 text-sm font-semibold text-white"
          >
            <ShieldCheck size={15} /> I agree
          </button>
        </div>
      </div>
    </div>
  );
}
