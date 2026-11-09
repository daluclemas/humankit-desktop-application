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
        className="mb-7 flex items-center gap-2 text-sm font-medium text-[#718096]"
      >
        <ArrowLeft size={15} /> Back to dashboard
      </Link>
      <h1 className="text-3xl font-bold tracking-[-.03em]">Privacy and data</h1>
      <p className="mt-2 text-[#718096]">
        Plain answers about your camera and your data.
      </p>

      <div className="mt-8 space-y-5">
        <Card title="Camera">
          <li>
            The camera turns on only after you agree and press Start or Resume.
          </li>
          <li>While it is on, the app shows &ldquo;Camera is on&rdquo;.</li>
          <li>It turns off when you press Pause or End, or leave the page.</li>
          <li>HumanKit never uses the camera in secret.</li>
        </Card>
        <Card title="What is saved">
          <li>
            HumanKit does not record, save or upload camera video or pictures.
          </li>
          <li>
            After a session, a short summary is saved in this app on your
            device: tool name, date, length, and the time with talking detected
            and silence.
          </li>
          <li>
            Nothing is sent to a HumanKit server. HumanKit has no account and no
            database.
          </li>
        </Card>
        <Card title="Presage">
          <li>
            Measurements come from the Presage SmartSpectra tool inside this
            app.
          </li>
          <li>
            It needs an internet connection to check the app&apos;s API key
            while it measures.
          </li>
          <li>HumanKit turns off the SDK&apos;s optional usage telemetry.</li>
        </Card>
        <Card title="What HumanKit is not">
          <li>It does not diagnose, treat or give medical advice.</li>
          <li>
            Talking detection shows detected talking only. It says nothing about
            how good your speech is.
          </li>
        </Card>

        <div className="rounded-2xl border border-[#e7e8f0] bg-white p-6">
          <h2 className="font-semibold">Delete my data</h2>
          <p className="mt-2 text-sm text-[#718096]">
            This removes all saved sessions and your camera agreement from this
            device. You will be asked again next time.
          </p>
          <button
            onClick={() => {
              deleteAllMyData();
              setDeleted(true);
            }}
            className="mt-4 flex items-center gap-2 rounded-xl border border-[#efcaca] px-4 py-2.5 text-sm font-semibold text-[#c86b6b]"
          >
            <Trash2 size={15} /> Delete everything
          </button>
          {deleted && (
            <p className="mt-3 text-sm text-[#287d70]">
              Done. Your saved data has been deleted.
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
