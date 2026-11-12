// "use client";
// import { useState } from "react";
// import Link from "next/link";
// import { ArrowLeft, Trash2 } from "lucide-react";
// import { deleteAllMyData } from "@/lib/consent";

// export default function Page() {
//   const [deleted, setDeleted] = useState(false);

//   return (
//     <div className="mx-auto max-w-3xl">
//       <Link
//         href="/dashboard"
//         className="my-7 flex items-center gap-2 text-sm font-medium text-[#718096]"
//       >
//         <ArrowLeft size={15} /> Back to dashboard
//       </Link>
//       <h1 className="text-3xl font-bold tracking-[-.03em]">Privacy and data</h1>
//       <p className="mt-2 text-[#718096]">
//         Plain answers about your camera and your data.
//       </p>

//       <div className="mt-8 space-y-5">
//         <Card title="Camera">
//           <li>
//             The camera turns on only after you agree and start a practice.
//           </li>
//           <li>While it is on, the app shows &ldquo;Camera is on&rdquo;.</li>
//           <li>It turns off when you end the practice or leave the page.</li>
//           <li>HumanKit never uses the camera in secret.</li>
//         </Card>
//         <Card title="Microphone">
//           <li>
//             The microphone turns on only while you answer a question in
//             SpeakEasy, and the app shows &ldquo;Microphone is on&rdquo;.
//           </li>
//           <li>It turns off as soon as you press Finish answer.</li>
//         </Card>
//         <Card title="What is saved">
//           <li>
//             HumanKit does not record, save or upload camera video or pictures.
//           </li>
//           <li>
//             Voice recordings are not kept. They are used once to make text and
//             then thrown away.
//           </li>
//           <li>
//             After a practice, a short summary is saved in this app on your
//             device: tool name, date, length, topic, and your scores. The full
//             text of your answers is not saved.
//           </li>
//           <li>
//             Nothing is sent to a HumanKit server. HumanKit has no account and no
//             database.
//           </li>
//         </Card>
//         <Card title="AI service (Groq)">
//           <li>
//             SpeakEasy uses Groq, an outside AI service, to write your questions,
//             turn your voice into text, and review your answers.
//           </li>
//           <li>
//             Groq receives the topic you type, a recording of each answer, and
//             the text of your answers with your numbers (such as pace and pulse).
//           </li>
//           <li>
//             Read Groq&apos;s own privacy information to see how they handle it.
//           </li>
//         </Card>
//         <Card title="Presage">
//           <li>
//             Breathing, pulse and talking measurements come from the Presage
//             SmartSpectra tool inside this app.
//           </li>
//           <li>
//             It needs an internet connection to check the app&apos;s API key
//             while it measures.
//           </li>
//           <li>HumanKit turns off the SDK&apos;s optional usage telemetry.</li>
//         </Card>
//         <Card title="What HumanKit is not">
//           <li>It does not diagnose, treat or give medical advice.</li>
//           <li>
//             Breathing and pulse can rise for many reasons. SpeakEasy shows them
//             as hints about your body, not as a diagnosis or proof of how you
//             feel.
//           </li>
//         </Card>

//         <div className="rounded-2xl border border-[#e7e8f0] bg-white p-6">
//           <h2 className="font-semibold">Delete my data</h2>
//           <p className="mt-2 text-sm text-[#718096]">
//             This removes all saved sessions and your camera agreement from this
//             device. You will be asked again next time.
//           </p>
//           <button
//             onClick={() => {
//               deleteAllMyData();
//               setDeleted(true);
//             }}
//             className="mt-4 flex items-center gap-2 rounded-xl border border-[#efcaca] px-4 py-2.5 text-sm font-semibold text-[#c86b6b]"
//           >
//             <Trash2 size={15} /> Delete everything
//           </button>
//           {deleted && (
//             <p className="mt-3 text-sm text-[#287d70]">
//               Done. Your saved data has been deleted.
//             </p>
//           )}
//         </div>
//       </div>
//     </div>
//   );
// }

// function Card({
//   title,
//   children,
// }: {
//   title: string;
//   children: React.ReactNode;
// }) {
//   return (
//     <section className="rounded-2xl border border-[#e7e8f0] bg-white p-6">
//       <h2 className="font-semibold">{title}</h2>
//       <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-[#39415a]">
//         {children}
//       </ul>
//     </section>
//   );
// }

"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Trash2 } from "lucide-react";
import { deleteAllMyData } from "@/lib/consent";

export default function Page() {
  const [deleted, setDeleted] = useState(false);

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href="/dashboard"
        className="my-7 flex items-center gap-2 text-sm font-medium text-[#718096]"
      >
        <ArrowLeft size={15} /> Back to dashboard
      </Link>
      <h1 className="text-3xl font-bold tracking-[-.03em]">Privacy and data</h1>
      <p className="mt-2 text-[#718096]">
        What HumanKit uses, what it saves, and what is sent to outside services.
      </p>

      <div className="mt-8 space-y-5">
        <Card title="Camera and Presage SmartSpectra">
          <li>
            The camera starts only after you agree and begin a session. The app
            shows the camera preview while it is active.
          </li>
          <li>
            HumanKit passes the camera stream to Presage SmartSpectra to
            calculate signals such as breathing, pulse, talking and blinking.
          </li>
          <li>
            HumanKit does not create or save a video recording. This does not
            mean that no camera data is transmitted by the SDK. Review
            Presage&apos;s current privacy and SDK documentation for details
            about its processing and network traffic.
          </li>
          <li>
            HumanKit disables the SDK&apos;s optional usage telemetry. This is
            not a statement that all SDK network communication is disabled.
          </li>
          <li>
            The camera stops when the session ends or the app leaves the page.
          </li>
        </Card>
        <Card title="Microphone and SpeakEasy">
          <li>
            SpeakEasy asks for microphone access when you start an answer and
            records until you finish the answer.
          </li>
          <li>
            The recording is sent to Groq for transcription. HumanKit does not
            add the audio recording to its local session history.
          </li>
          <li>
            The microphone is stopped after recording ends. If you close the app
            unexpectedly, the operating system may still control when the device
            releases the microphone.
          </li>
        </Card>
        <Card title="What HumanKit saves on this device">
          <li>
            Session summaries are stored in this app&apos;s local storage. They
            can include the tool name, date, duration, topic, scores and
            measurement summaries.
          </li>
          <li>
            The full text of your answers is not included in the saved session
            history.
          </li>
          <li>
            HumanKit does not currently use a HumanKit account or its own
            application database.
          </li>
        </Card>
        <Card title="AI service (Groq)">
          <li>
            SpeakEasy uses Groq to generate practice questions, transcribe
            recordings and review answers.
          </li>
          <li>
            Groq receives the topic you enter, the answer audio for
            transcription, and answer text with selected measurements for
            feedback.
          </li>
          <li>
            HumanKit does not control Groq&apos;s retention or handling of
            submitted information. Check Groq&apos;s current privacy and data
            usage terms before using the AI features with sensitive information.
          </li>
        </Card>
        <Card title="Internet connection and SDK telemetry">
          <li>
            Presage SmartSpectra needs an internet connection to validate the
            app&apos;s API key and provide its SDK service.
          </li>
          <li>
            The SDK&apos;s optional usage telemetry is disabled in HumanKit.
            This does not turn off the network requests required by the SDK.
          </li>
        </Card>
        <Card title="What HumanKit is not">
          <li>It does not diagnose, treat or give medical advice.</li>
          <li>
            Breathing, pulse and blinking measurements are estimates. They can
            change for many reasons and are not proof of stress, confidence,
            health or how a person feels.
          </li>
        </Card>

        <div className="rounded-2xl border border-[#e7e8f0] bg-white p-6">
          <h2 className="font-semibold">Delete my data</h2>
          <p className="mt-2 text-sm text-[#718096]">
            This removes locally saved sessions and your saved camera agreement
            from this device. It does not delete recordings, text or other
            information already sent to Groq or processed by Presage. You may
            need to contact those services about information they hold.
          </p>
          <button
            onClick={() => {
              deleteAllMyData();
              setDeleted(true);
            }}
            className="mt-4 flex items-center gap-2 rounded-xl border border-[#efcaca] px-4 py-2.5 text-sm font-semibold text-[#c86b6b]"
          >
            <Trash2 size={15} /> Delete local data
          </button>
          {deleted && (
            <p className="mt-3 text-sm text-[#287d70]" role="status">
              Local session data and the saved camera agreement were cleared.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-[#e7e8f0] bg-white p-6">
      <h2 className="font-semibold">{title}</h2>
      <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-[#39415a]">
        {children}
      </ul>
    </section>
  );
}
