"use client";

import { Code2, Heart, Mail } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t rule">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-8 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-[color:var(--ink-soft)]">
          © {new Date().getFullYear()} CholeyAnime · A Choley project.
          Educational scraping demo — please respect upstream terms of service.
        </p>
        <div className="flex items-center gap-2 text-xs text-[color:var(--ink-soft)]">
          <span className="tag">Made with</span>
          <Heart className="h-3.5 w-3.5 text-[color:var(--accent)]" />
          <span className="tag">Next.js</span>
          <a
            href="https://github.com"
            className="grid h-7 w-7 place-items-center rounded-full border rule text-[color:var(--ink-soft)] transition hover:border-[color:var(--ink)] hover:text-[color:var(--ink)]"
            aria-label="Source"
          >
            <Code2 className="h-3.5 w-3.5" />
          </a>
          <a
            href="mailto:hi@choleyanime.dev"
            className="grid h-7 w-7 place-items-center rounded-full border rule text-[color:var(--ink-soft)] transition hover:border-[color:var(--ink)] hover:text-[color:var(--ink)]"
            aria-label="Email"
          >
            <Mail className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>
    </footer>
  );
}
