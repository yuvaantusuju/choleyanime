"use client";

import {
  Zap,
  ShieldCheck,
  Layers3,
  Gauge,
  Sparkles,
  KeyRound,
} from "lucide-react";

const FEATURES = [
  {
    icon: Zap,
    title: "Fast Scans",
    body: "The show page server-side and returns a clean episode list in under a second.",
  },
  {
    icon: ShieldCheck,
    title: "Referer-aware proxy",
    body: "Our download route streams the .mp4 with the right headers.",
  },
  {
    icon: Layers3,
    title: "Bulk actions",
    body: "Select all, deselect all, or fire the whole queue — perfect for catching up on a finished series.",
  },
  {
    icon: Gauge,
    title: "Download, not buffered",
    body: "Bytes pass straight from upstream to your browser — no temp files, no double storage.",
  },
  {
    icon: Sparkles,
    title: "Clean filenames",
    body: "Episode labels are normalized so files land in your downloads folder ready to play.",
  },
  {
    icon: KeyRound,
    title: "No accounts",
    body: "No login, no signups. Open the page, paste a link, save the file — that is it.",
  },
];

export function Features() {
  return (
    <section id="features" className="border-t rule paper-2">
      <div className="mx-auto max-w-6xl px-6 py-16 sm:py-20">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="eyebrow">Why CholeyAnime</p>
            <h2 className="font-display mt-3 text-4xl leading-[1.05] sm:text-5xl">
              Built for <em>watchers.</em>
            </h2>
          </div>
          <p className="max-w-md text-sm text-(--ink-soft) sm:text-right">
            Everything you need to archive your favourite series — fast,
            premium and beautifully simple.
          </p>
        </div>

        <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => {
            const Icon = f.icon;
            return (
              <li
                key={f.title}
                className="rounded-2xl border rule bg-(--surface) p-6"
              >
                <span className="grid h-10 w-10 place-items-center rounded-full bg-(--ink) text-(--paper)">
                  <Icon className="h-4 w-4" />
                </span>
                <h3 className="font-display mt-4 text-xl">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-(--ink-soft)">
                  {f.body}
                </p>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
