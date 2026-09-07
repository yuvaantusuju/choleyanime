"use client";

import { Sparkles } from "lucide-react";
import { ThemeToggle } from "./ThemeToggle";

export function NavBar() {
  return (
    <header
      className="sticky top-0 z-30 border-b rule backdrop-blur"
      style={{
        background:
          "color-mix(in oklab, var(--paper) 80%, transparent)",
      }}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <a href="#top" className="flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-full bg-[color:var(--ink)] text-[color:var(--paper)]">
            <span className="font-display text-lg italic">C</span>
          </div>
          <div className="leading-tight">
            <p className="font-display text-lg">
              Choley<span className="italic text-[color:var(--accent)]">Anime</span>
            </p>
            <p className="text-[10px] uppercase tracking-[0.22em] text-[color:var(--ink-soft)]">
              by Choley
            </p>
          </div>
        </a>

        <nav className="hidden items-center gap-7 text-sm font-medium text-[color:var(--ink-soft)] sm:flex">
          <a href="#downloader" className="hover:text-[color:var(--ink)]">
            Downloader
          </a>
          <a href="#how" className="hover:text-[color:var(--ink)]">
            How it works
          </a>
          <a href="#queue" className="hover:text-[color:var(--ink)]">
            Queue
          </a>
        </nav>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <a
            href="#downloader"
            className="btn-pill btn-outline hidden sm:inline-flex"
          >
            <Sparkles className="h-3.5 w-3.5" /> Start
          </a>
        </div>
      </div>
    </header>
  );
}
