"use client";

import { Link2, ListChecks, Download } from "lucide-react";

const STEPS = [
  {
    n: "01",
    icon: Link2,
    title: "Enter the anime name",
    body: "Copy any animeheaven.me show page and drop it into the field. We'll fetch and parse it for you.",
  },
  {
    n: "02",
    icon: ListChecks,
    title: "Choose episodes",
    body: "Pick a single episode, a hand-selected batch, or grab the whole available list with one click.",
  },
  {
    n: "03",
    icon: Download,
    title: "Download the .mp4",
    body: "We resolve the direct video stream and stream it back as a file — your browser saves it offline.",
  },
];

export function HowItWorks() {
  return (
    <section id="how" className="border-t rule">
      <div className="mx-auto max-w-6xl px-6 py-16 sm:py-20">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="eyebrow">Simple by Choley</p>
            <h2 className="font-display mt-3 text-4xl leading-[1.05] sm:text-5xl">
              From link to library <br />
              <em>in three tiny steps.</em>
            </h2>
          </div>
          <p className="max-w-sm text-sm text-(--ink-soft) sm:text-right">
            No confusing settings, pop-ups or trackers. Just a focused workflow
            that gets you back to watching.
          </p>
        </div>

        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {STEPS.map((s) => {
            const Icon = s.icon;
            return (
              <article
                key={s.n}
                className="group relative rounded-2xl border rule bg-(--surface) p-6 transition hover:-translate-y-1 hover:border-(--ink)"
              >
                <div className="flex items-center justify-between">
                  <span className="font-display text-5xl italic text-(--accent)">
                    {s.n}
                  </span>
                  <span className="grid h-9 w-9 place-items-center rounded-full border rule text-(--ink-soft) transition group-hover:border-(--ink) group-hover:text-(--ink)">
                    <Icon className="h-4 w-4" />
                  </span>
                </div>
                <h3 className="font-display mt-5 text-2xl">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-(--ink-soft)">
                  {s.body}
                </p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
