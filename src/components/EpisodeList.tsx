"use client";

import { useCallback, useMemo, useState } from "react";
import {
  ArrowDown,
  CheckCircle2,
  Clipboard,
  ClipboardCheck,
  Copy,
  Download,
  ExternalLink,
  Filter,
  Hash,
  Loader2,
  Play,
  Square,
  SquareCheck,
  X,
  XCircle,
} from "lucide-react";

export type Episode = {
  index: number;
  label: string;
  number: number | null;
  href: string;
  gateHref: string;
  fullUrl: string;
};

export type EpisodeStatus = "queued" | "resolving" | "downloading" | "done" | "error";

export type EpisodeRun = {
  id: string;
  status: EpisodeStatus;
  mp4Url: string | null;
  message: string | null;
};

type Props = {
  showTitle: string;
  showUrl: string;
  episodes: Episode[];
  selected: Set<string>;
  runs: Map<string, EpisodeRun>;
  onToggleSelect: (key: string) => void;
  onSelectAll: (keys: string[]) => void;
  onClearSelection: () => void;
  onDownloadOne: (ep: Episode) => void;
  onDownloadMany: (eps: Episode[]) => void;
  onCopy: (text: string, key: string) => void;
  copiedKey: string | null;
};

function classNames(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function buildDownloadUrl(mp4Url: string, filename: string) {
  const params = new URLSearchParams({ url: mp4Url, filename });
  return `/api/download?${params.toString()}`;
}

function safeFilenameFromLabel(label: string) {
  const base = (label || "episode")
    .replace(/[\\/:*?"<>|]+/g, "_")
    .replace(/\s+/g, " ")
    .trim();
  return base.toLowerCase().endsWith(".mp4") ? base : `${base}.mp4`;
}

function parseRange(input: string, max: number): number[] {
  const out = new Set<number>();
  const parts = input.split(",").map((p) => p.trim()).filter(Boolean);
  for (const part of parts) {
    const range = part.split("-").map((p) => p.trim());
    if (range.length === 1) {
      const n = parseInt(range[0], 10);
      if (Number.isFinite(n) && n >= 1 && n <= max) out.add(n);
    } else if (range.length === 2) {
      const a = parseInt(range[0], 10);
      const b = parseInt(range[1], 10);
      if (Number.isFinite(a) && Number.isFinite(b)) {
        const [lo, hi] = a < b ? [a, b] : [b, a];
        for (let i = Math.max(1, lo); i <= Math.min(max, hi); i++) out.add(i);
      }
    }
  }
  return Array.from(out).sort((a, b) => a - b);
}

export function EpisodeList({
  showTitle,
  showUrl,
  episodes,
  selected,
  runs,
  onToggleSelect,
  onSelectAll,
  onClearSelection,
  onDownloadOne,
  onDownloadMany,
  onCopy,
  copiedKey,
}: Props) {
  const [filter, setFilter] = useState("");
  const [rangeInput, setRangeInput] = useState("");
  const [showRange, setShowRange] = useState(false);

  const filtered = useMemo(() => {
    if (!filter.trim()) return episodes;
    const q = filter.toLowerCase();
    return episodes.filter(
      (e) =>
        e.label.toLowerCase().includes(q) ||
        String(e.number ?? "").includes(q)
    );
  }, [episodes, filter]);

  const visibleKeys = useMemo(() => filtered.map((e) => e.fullUrl), [filtered]);
  const allVisibleSelected =
    visibleKeys.length > 0 && visibleKeys.every((k) => selected.has(k));

  const selectAllVisible = useCallback(() => {
    onSelectAll(visibleKeys);
  }, [onSelectAll, visibleKeys]);

  const applyRange = useCallback(() => {
    if (!rangeInput.trim()) return;
    const nums = parseRange(rangeInput, episodes.length);
    const byNum = new Map<number, Episode>();
    for (const e of episodes) {
      if (e.number != null) byNum.set(e.number, e);
    }
    const byIndex = new Map<number, Episode>();
    for (const e of episodes) byIndex.set(e.index, e);
    const keys: string[] = [];
    for (const n of nums) {
      const ep = byNum.get(n) ?? byIndex.get(n);
      if (ep) keys.push(ep.fullUrl);
    }
    onSelectAll(keys);
    setRangeInput("");
    setShowRange(false);
  }, [rangeInput, episodes, onSelectAll]);

  const selectedEpisodes = useMemo(
    () => episodes.filter((e) => selected.has(e.fullUrl)),
    [episodes, selected]
  );

  return (
    <div className="mt-8 rounded-3xl border rule bg-[color:var(--surface)] animate-fade-in-up">
      {/* Header / toolbar */}
      <div
        className="flex flex-col gap-3 border-b p-5 sm:flex-row sm:items-center sm:justify-between"
        style={{ borderColor: "var(--rule)" }}
      >
        <div className="min-w-0">
          <p className="eyebrow">Library</p>
          <h3 className="mt-1 truncate font-display text-2xl sm:text-3xl">
            {showTitle}
          </h3>
          <p className="mt-1 truncate text-xs text-[color:var(--ink-soft)]">
            {episodes.length} episode{episodes.length === 1 ? "" : "s"} ·{" "}
            {selected.size} selected
            {filter && ` · ${filtered.length} shown`}
            {runs.size > 0 && ` · ${runs.size} in queue`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Filter className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[color:var(--ink-soft)]" />
            <input
              type="text"
              placeholder="Filter…"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="input-mini w-32 sm:w-40"
            />
            {filter && (
              <button
                type="button"
                onClick={() => setFilter("")}
                className="absolute right-2 top-1/2 grid h-5 w-5 -translate-y-1/2 place-items-center rounded-full text-[color:var(--ink-soft)] hover:text-[color:var(--ink)]"
                aria-label="Clear filter"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={selectAllVisible}
            disabled={visibleKeys.length === 0}
            className="btn-pill btn-outline py-2 text-xs"
          >
            <SquareCheck className="h-3.5 w-3.5" />{" "}
            {allVisibleSelected ? "Deselect" : "Select all"}
          </button>

          <button
            type="button"
            onClick={onClearSelection}
            disabled={selected.size === 0}
            className="btn-pill btn-outline py-2 text-xs"
          >
            <Square className="h-3.5 w-3.5" /> Clear
          </button>

          <button
            type="button"
            onClick={() => setShowRange((v) => !v)}
            className="btn-pill btn-outline py-2 text-xs"
            title="Select a range like 1-12 or 1-5,8,12"
          >
            <Hash className="h-3.5 w-3.5" /> Range
          </button>

          <button
            type="button"
            onClick={() => onDownloadMany(selectedEpisodes)}
            disabled={selected.size === 0}
            className="btn-pill btn-accent py-2 text-xs"
          >
            <Download className="h-3.5 w-3.5" /> Download selected
            {selected.size > 0 && (
              <span className="rounded-full bg-white/20 px-1.5 py-0.5 text-[10px]">
                {selected.size}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => onDownloadMany(episodes)}
            className="btn-pill btn-primary py-2 text-xs"
          >
            <Download className="h-3.5 w-3.5" /> Download all
          </button>
        </div>
      </div>

      {/* Range picker (collapsible) */}
      {showRange && (
        <div
          className="flex flex-col gap-2 border-b bg-[color:var(--paper-2)] p-4 sm:flex-row sm:items-center"
          style={{ borderColor: "var(--rule)" }}
        >
          <span className="eyebrow">Select range</span>
          <input
            type="text"
            placeholder="e.g. 1-12, 24, 50-60"
            value={rangeInput}
            onChange={(e) => setRangeInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") applyRange();
            }}
            className="input-mini flex-1"
          />
          <button
            type="button"
            onClick={applyRange}
            className="btn-pill btn-primary py-2 text-xs"
          >
            Apply
          </button>
          <button
            type="button"
            onClick={() => {
              setRangeInput("");
              setShowRange(false);
            }}
            className="btn-pill btn-ghost py-2 text-xs"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Episode cards — each episode is its own distinct card */}
      {filtered.length === 0 ? (
        <div className="px-5 py-12 text-center text-sm text-[color:var(--ink-soft)]">
          {filter
            ? "No episodes match your filter."
            : "No episodes in this show."}
        </div>
      ) : (
        <div
          className="episode-scroll p-3 sm:p-4"
          style={{ maxHeight: "70vh" }}
        >
          <ol
            className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3"
            style={{ gridAutoRows: "min-content" }}
          >
            {filtered.map((ep, i) => {
              const isSelected = selected.has(ep.fullUrl);
              const run = runs.get(ep.fullUrl);
              const episodeNumber = ep.number ?? ep.index;
              return (
                <li
                  key={ep.fullUrl}
                  className={classNames(
                    "group flex h-full flex-col gap-3 rounded-2xl border-2 p-3 transition sm:gap-3 sm:p-4",
                    isSelected
                      ? "shadow-md"
                      : "shadow-sm hover:-translate-y-0.5 hover:shadow-md"
                  )}
                  style={{
                    background: isSelected
                      ? "var(--paper-2)"
                      : "var(--paper)",
                    borderColor: isSelected
                      ? "var(--ink)"
                      : "var(--rule)",
                  }}
                >
                  {/* Left: checkbox + episode number badge */}
                  <div className="flex flex-shrink-0 items-center gap-3">
                    <label
                      className="grid h-6 w-6 cursor-pointer place-items-center"
                      title="Select"
                    >
                      <input
                        type="checkbox"
                        className="peer sr-only"
                        checked={isSelected}
                        onChange={() => onToggleSelect(ep.fullUrl)}
                      />
                      <span
                        className={classNames(
                          "grid h-5 w-5 place-items-center rounded-md border transition",
                          isSelected
                            ? "border-[color:var(--ink)] bg-[color:var(--ink)]"
                            : "border bg-[color:var(--surface)]"
                        )}
                        style={{
                          borderColor: isSelected
                            ? "var(--ink)"
                            : "var(--rule)",
                        }}
                      >
                        {isSelected && (
                          <CheckCircle2 className="h-3.5 w-3.5 text-[color:var(--paper)]" />
                        )}
                      </span>
                    </label>

                    <span
                      className={classNames(
                        "grid h-10 w-10 place-items-center rounded-full text-sm font-semibold",
                        isSelected
                          ? "bg-[color:var(--ink)] text-[color:var(--paper)]"
                          : "border bg-[color:var(--surface)] text-[color:var(--ink-soft)]"
                      )}
                      style={{
                        borderColor: isSelected
                          ? "transparent"
                          : "var(--rule)",
                      }}
                    >
                      {episodeNumber}
                    </span>
                  </div>

                  {/* Middle: episode title + meta + status */}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p
                        className={classNames(
                          "font-display text-base font-medium sm:text-lg",
                          run?.status === "done" &&
                            "text-[color:var(--success)]",
                          run?.status === "error" &&
                            "text-[color:var(--error)]"
                        )}
                      >
                        {ep.label}
                      </p>
                      {run && (
                        <RunStatusPill
                          status={run.status}
                          message={run.message}
                        />
                      )}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-(--ink-soft)">
                      <span className="inline-flex items-center gap-1">
                        <span className="font-mono uppercase tracking-wider text-(--ink-faint)">
                          EP
                        </span>
                        <span className="font-semibold text-(--ink)">
                          {episodeNumber}
                        </span>
                      </span>
                      <span className="hidden sm:inline">·</span>
                      <span
                        className="max-w-full truncate font-mono"
                        title={ep.gateHref}
                      >
                        {ep.gateHref}
                      </span>
                    </div>
                  </div>

                  {/* Right: actions */}
                  <div className="flex shrink-0 flex-wrap items-center gap-1.5 sm:flex-nowrap">
                    {run?.mp4Url && (
                      <a
                        href={buildDownloadUrl(
                          run.mp4Url,
                          safeFilenameFromLabel(ep.label)
                        )}
                        download={safeFilenameFromLabel(ep.label)}
                        className="btn-pill btn-accent py-1.5 text-xs"
                        title="Download again"
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                        <span>Save</span>
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => onDownloadOne(ep)}
                      className="btn-pill btn-primary py-1.5 text-xs"
                      title="Resolve and download"
                    >
                      <Play className="h-3.5 w-3.5" />
                      <span>
                        {run?.status === "resolving"
                          ? "Resolving…"
                          : "Download"}
                      </span>
                    </button>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      )}

      {/* Footer summary */}
      <div
        className="flex items-center justify-between border-t px-5 py-3 text-[11px] text-(--ink-soft)"
        style={{
          borderColor: "var(--rule)",
          background: "var(--paper-2)",
        }}
      >
        <span>
          Showing {filtered.length} of {episodes.length} episode
          {episodes.length === 1 ? "" : "s"}
        </span>
        <span className="hidden items-center gap-2 sm:flex">
          Tip: use the <strong className="font-semibold text-(--ink)">Range</strong> button
          for quick bulk selection.
        </span>
      </div>
    </div>
  );
}

function RunStatusPill({
  status,
  message,
}: {
  status: EpisodeStatus;
  message: string | null;
}) {
  if (status === "resolving" || status === "queued") {
    return (
      <span
        className="inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium"
        style={{
          background: "var(--info-soft)",
          borderColor: "var(--rule)",
          color: "var(--ink-soft)",
        }}
        title={message ?? ""}
      >
        <Loader2 className="h-3 w-3 animate-spin" /> Resolving
      </span>
    );
  }
  if (status === "downloading") {
    return (
      <span
        className="inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium"
        style={{
          background: "var(--info-soft)",
          borderColor: "var(--rule)",
          color: "var(--ink)",
        }}
        title={message ?? ""}
      >
        <Loader2 className="h-3 w-3 animate-spin" /> Downloading
      </span>
    );
  }
  if (status === "done") {
    return (
      <span
        className="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
        style={{
          background: "var(--success-soft)",
          color: "var(--success)",
        }}
      >
        <CheckCircle2 className="h-3 w-3" /> Done
      </span>
    );
  }
  if (status === "error") {
    return (
      <span
        className="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
        style={{
          background: "var(--error-soft)",
          color: "var(--error)",
        }}
        title={message ?? ""}
      >
        <XCircle className="h-3 w-3" /> {message ?? "Failed"}
      </span>
    );
  }
  return null;
}
