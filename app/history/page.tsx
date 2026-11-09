"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Trash2, History as HistoryIcon } from "lucide-react";
export default function Page() {
  const [items, setItems] = useState<any[]>([]);
  useEffect(
    () =>
      setItems(JSON.parse(localStorage.getItem("humankit-sessions") || "[]")),
    [],
  );
  const remove = (id: number) => {
    const next = items.filter((x) => x.id !== id);
    setItems(next);
    localStorage.setItem("humankit-sessions", JSON.stringify(next));
  };
  return (
    <div className="mx-auto max-w-5xl">
      <Link
        href="/dashboard"
        className="my-7 flex items-center gap-2 text-sm font-medium text-[#718096]"
      >
        <ArrowLeft size={15} /> Back to dashboard
      </Link>
      <h1 className="text-3xl font-bold tracking-[-.03em]">Session history</h1>
      <p className="mt-2 text-[#718096]">
        A private record of the time you&apos;ve invested in yourself.
      </p>
      <div className="mt-8 overflow-hidden rounded-2xl border border-[#e7e8f0] bg-white">
        {items.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-[#eeebff] text-[#6958d9]">
              <HistoryIcon size={20} />
            </div>
            <h2 className="mt-4 font-semibold">No sessions yet</h2>
            <p className="mt-2 text-sm text-[#718096]">
              Complete a session and it will appear here.
            </p>
          </div>
        ) : (
          <div>
            {items.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between border-b border-[#f0f0f5] px-6 py-5 last:border-0"
              >
                <div>
                  <p className="font-semibold">{item.tool}</p>
                  <p className="mt-1 text-xs text-[#8992a6]">
                    {new Date(item.date).toLocaleString()} ·{" "}
                    {Math.floor(item.duration / 60)}m {item.duration % 60}s
                  </p>
                </div>
                <div className="flex items-center gap-5">
                  <span className="text-sm text-[#8992a6]">
                    {item.measurement && item.measurement !== "Not available"
                      ? item.measurement
                      : "Measurements unavailable"}
                  </span>
                  <button
                    onClick={() => remove(item.id)}
                    className="text-[#a3aaba] hover:text-[#c86b6b]"
                    aria-label={`Delete ${item.tool} session`}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
