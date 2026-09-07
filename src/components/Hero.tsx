"use client";

import { ArrowDown, ShieldCheck, Download, Eye } from "lucide-react";

export function Hero() {
  return (
    <section className="relative overflow-hidden" id="top">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            "linear-gradient(var(--grid-color) 1px, transparent 1px), linear-gradient(90deg, var(--grid-color) 1px, transparent 1px)",
          backgroundSize: "80px 80px",
          maskImage:
            "radial-gradient(ellipse at top, black 35%, transparent 75%)",
        }}
      />

      <div className="relative mx-auto grid max-w-6xl gap-10 px-6 pt-14 pb-10 sm:pt-20 sm:pb-14 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
        <div>
          <p className="eyebrow">Anime downloader</p>

          <h1 className="font-display mt-4 text-5xl leading-[0.95] sm:text-7xl lg:text-[5.5rem]">
            Watch later. <br />
            <em>Keep forever.</em>
          </h1>

          <p className="mt-6 max-w-xl text-base text-[color:var(--ink-soft)] sm:text-lg">
            Turn any <span className="font-semibold text-[color:var(--ink)]">animeheaven.me</span>{" "}
            show link into a clean episode list, resolve the direct{" "}
            <code className="rounded bg-[color:var(--paper-2)] px-1.5 py-0.5 text-sm">
              .mp4
            </code>{" "}
            stream, and download it offline — without the clutter.
          </p>

          <div className="mt-7 flex flex-wrap items-center gap-3">
            <a href="#downloader" className="btn-pill btn-primary">
              Open the downloader <ArrowDown className="h-3.5 w-3.5" />
            </a>
            <a href="#how" className="btn-pill btn-outline">
              See how it works
            </a>
          </div>

          <div className="mt-7 flex flex-wrap items-center gap-2">
            <span className="tag">
              <ShieldCheck className="h-3.5 w-3.5" /> No login
            </span>
            <span className="tag">
              <Download className="h-3.5 w-3.5" /> Real .mp4 streams
            </span>
            <span className="tag">
              <Eye className="h-3.5 w-3.5" /> Private session
            </span>
          </div>
        </div>

        <aside className="relative">
          <div className="rounded-3xl border rule bg-[color:var(--paper-2)] p-6 sm:p-7">
            <p className="eyebrow">Live stats</p>
            <p className="font-display mt-3 text-3xl">
              From link <em>to library</em>
            </p>

            <dl className="mt-6 grid grid-cols-3 gap-4 text-center">
              {[
                { k: "EP", v: "01", l: "Paste URL" },
                { k: "EP", v: "02", l: "Pick episodes" },
                { k: "EP", v: "03", l: "Download .mp4" },
              ].map((s) => (
                <div
                  key={s.v}
                  className="rounded-2xl border rule bg-[color:var(--surface)] py-4"
                >
                  <p className="text-[10px] uppercase tracking-[0.22em] text-[color:var(--ink-soft)]">
                    {s.k}
                  </p>
                  <p className="font-display mt-1 text-3xl italic">
                    {s.v}
                  </p>
                  <p className="mt-1 text-[11px] text-[color:var(--ink-soft)]">
                    {s.l}
                  </p>
                </div>
              ))}
            </dl>

            <div className="mt-5 flex items-center gap-2 text-xs text-[color:var(--ink-soft)]">
              <span className="dot text-[color:var(--success)]" />
              All processing happens on the server — your browser only sees
              the final file.
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}
