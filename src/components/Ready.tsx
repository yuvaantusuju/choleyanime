"use client";

import { ArrowRight, Trophy } from "lucide-react";

const SHOWS = [
  { name: "SOLO", count: "01" },
  { name: "TOWER", count: "17" },
  { name: "BLADE", count: "42" },
  { name: "NARUTO", count: "220" },
  { name: "BLEACH", count: "366" },
  { name: "ONE PIECE", count: "1171" },
];

export function Ready() {
  return (
    <section className="border-t rule">
      <div className="mx-auto max-w-6xl px-6 py-16 sm:py-20">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="eyebrow">Ready when you are</p>
            <h2 className="font-display mt-3 text-4xl leading-[1.05] sm:text-5xl">
              Your next great watch <br />
              <em>doesn’t need Wi-Fi.</em>
            </h2>
          </div>
          <a href="#downloader" className="btn-pill btn-primary self-start sm:self-auto">
            Start downloading <ArrowRight className="h-3.5 w-3.5" />
          </a>
        </div>

        <ul className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {SHOWS.map((s) => (
            <li
              key={s.name}
              className="group flex flex-col gap-2 rounded-2xl border rule bg-(--surface) p-4 transition hover:border-(--ink)"
            >
              <span className="grid h-9 w-9 place-items-center rounded-full bg-(--paper-2) text-(--ink-soft) transition group-hover:bg-(--ink) group-hover:text-(--paper)">
                <Trophy className="h-4 w-4" />
              </span>
              <p className="font-display mt-1 text-lg">{s.name}</p>
              <p className="text-[11px] uppercase tracking-[0.2em] text-(--ink-soft)">
                <span className="font-display text-xl not-italic">{s.count}</span>{" "}
                episodes
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
