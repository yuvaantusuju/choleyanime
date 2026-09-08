"use client";

import { Code2, Heart, Mail } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t rule">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-8 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-(--ink-soft)">
          © {new Date().getFullYear()} CholeyAnime A focused Anime downloader
          for watcher who value speed, quality and privacy..

        </p>
        <div className="flex items-center gap-2 text-xs text-(--ink-soft)">
          <span className="tag">Made By CholeyGang</span>
        </div>
      </div>
    </footer>
  );
}
