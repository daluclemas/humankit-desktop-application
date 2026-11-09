"use client";
import Link from "next/link";
import { Camera, ShieldCheck } from "lucide-react";

// Shown once, before the camera turns on for the first time.
export default function CameraConsent({
  onAgree,
  onCancel,
}: {
  onAgree: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4"
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
          Allow camera use?
        </h2>
        <p className="mt-2 text-sm leading-6 text-[#718096]">
          HumanKit uses your camera to measure signals like talking while a
          session is running.
        </p>
        <ul className="mt-4 space-y-2 text-sm leading-6 text-[#39415a]">
          <li>
            The camera turns on only when you press Start or Resume, and a
            &ldquo;Camera is on&rdquo; label is shown.
          </li>
          <li>It turns off when you press Pause or End, or leave the page.</li>
          <li>HumanKit does not record, save or upload your video.</li>
          <li>
            Only a short summary (time, talking and silence) is saved, on this
            device.
          </li>
          <li>
            Presage&apos;s measuring tool needs an internet connection to check
            this app&apos;s key.
          </li>
        </ul>
        <p className="mt-4 text-xs text-[#8992a6]">
          You can delete everything any time on the{" "}
          <Link
            href="/privacy"
            className="font-semibold text-[#6958d9] underline"
          >
            Privacy page
          </Link>
          . HumanKit gives no medical advice.
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
            <ShieldCheck size={15} /> I agree, turn on camera
          </button>
        </div>
      </div>
    </div>
  );
}
