"use client";

import { useCallback, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Clipboard,
  ClipboardCheck,
  Download,
  Film,
  Link2,
  Loader2,
  Trash2,
  XCircle,
  ListChecks,
} from "lucide-react";
import { useTheme, type ThemeMode } from "./useTheme";
import { SearchPanel } from "./SearchPanel";
import {
  EpisodeList,
  type Episode,
  type EpisodeRun,
  type EpisodeStatus,
} from "./EpisodeList";

type SearchResult = {
  id: string;
  title: string;
  url: string;
  image: string | null;
  description: string;
  episodeCount: number | null;
};

type EpisodesResponse = {
  ok: boolean;
  source: string;
  id: string | null;
  title: string;
  count: number;
  episodes: Episode[];
};

type ResolveResponse = {
  ok: boolean;
  source: string;
  mp4Url: string;
  label: string;
  candidates: { href: string; label: string }[];
};

type Toast = {
  id: string;
  text: string;
  tone: "info" | "success" | "error";
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

export default function Downloader() {
  const [loadingEpisodes, setLoadingEpisodes] = useState(false);
  const [episodesError, setEpisodesError] = useState<string | null>(null);
  const [activeShow, setActiveShow] = useState<SearchResult | null>(null);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [runs, setRuns] = useState<Map<string, EpisodeRun>>(new Map());
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const { mode } = useTheme();

  const selectedCount = selected.size;

  const pushToast = useCallback(
    (text: string, tone: Toast["tone"] = "info") => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setToasts((prev) => [...prev, { id, text, tone }]);
      window.setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 3500);
    },
    []
  );

  const updateRun = useCallback(
    (epKey: string, patch: Partial<EpisodeRun>) => {
      setRuns((prev) => {
        const next = new Map(prev);
        const existing = next.get(epKey) ?? {
          id: epKey,
          status: "queued" as EpisodeStatus,
          mp4Url: null,
          message: null,
        };
        next.set(epKey, { ...existing, ...patch });
        return next;
      });
    },
    []
  );

  const clearFinishedRuns = useCallback(() => {
    setRuns((prev) => {
      const next = new Map<string, EpisodeRun>();
      for (const [k, v] of prev) {
        if (v.status === "downloading" || v.status === "resolving" || v.status === "queued") {
          next.set(k, v);
        }
      }
      return next;
    });
  }, []);

  const loadEpisodes = useCallback(
    async (showUrl: string, show: SearchResult | null = null) => {
      setLoadingEpisodes(true);
      setEpisodesError(null);
      setEpisodes([]);
      setSelected(new Set());
      setRuns(new Map());
      try {
        const res = await fetch(
          `/api/episodes?url=${encodeURIComponent(showUrl)}`,
          { cache: "no-store" }
        );
        const data: EpisodesResponse | { error: string } = await res.json();
        if (!res.ok || "error" in data) {
          const message =
            "error" in data
              ? data.error
              : `Request failed with status ${res.status}`;
          setEpisodesError(message);
          return;
        }
        if (data.count === 0) {
          setEpisodesError(
            "No episodes found. The page layout may have changed or the URL is incorrect."
          );
          return;
        }
        setEpisodes(data.episodes);
        setActiveShow(
          show ?? {
            id: data.id ?? "",
            title: data.title,
            url: data.source,
            image: null,
            description: "",
            episodeCount: data.count,
          }
        );
        pushToast(
          `Loaded ${data.count} episodes for “${data.title}”`,
          "success"
        );
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Unknown error while loading episodes.";
        setEpisodesError(message);
      } finally {
        setLoadingEpisodes(false);
      }
    },
    [pushToast]
  );

  const handleSearchSelect = useCallback(
    (r: SearchResult) => {
      void loadEpisodes(r.url, r);
    },
    [loadEpisodes]
  );

  const toggleSelect = useCallback((key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const selectAll = useCallback((keys: string[]) => {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const k of keys) next.add(k);
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelected(new Set());
  }, []);

  const resolveEpisode = useCallback(
    async (
      episode: Episode
    ): Promise<{ mp4Url: string; label: string } | null> => {
      try {
        const res = await fetch(
          `/api/resolve-link?url=${encodeURIComponent(episode.fullUrl)}`,
          { cache: "no-store" }
        );
        const data: ResolveResponse | { error: string } = await res.json();
        if (!res.ok || "error" in data) {
          throw new Error("error" in data ? data.error : `HTTP ${res.status}`);
        }
        return { mp4Url: data.mp4Url, label: data.label };
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to resolve stream link.";
        pushToast(`Could not resolve ${episode.label}: ${message}`, "error");
        return null;
      }
    },
    [pushToast]
  );

  const startDownloadForEpisode = useCallback(
    async (episode: Episode) => {
      const key = episode.fullUrl;
      updateRun(key, {
        id: key,
        status: "resolving",
        mp4Url: null,
        message: "Locating direct .mp4 link…",
      });
      const resolved = await resolveEpisode(episode);
      if (!resolved) {
        updateRun(key, {
          status: "error",
          message: "Unable to locate a direct .mp4 link.",
        });
        return;
      }
      updateRun(key, {
        status: "downloading",
        mp4Url: resolved.mp4Url,
        message: "Streamed via proxy. Save the file from your browser.",
      });
      const filename = safeFilenameFromLabel(episode.label);
      const href = buildDownloadUrl(resolved.mp4Url, filename);
      const a = document.createElement("a");
      a.href = href;
      a.rel = "noopener noreferrer";
      a.download = filename;
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();
      window.setTimeout(() => {
        if (a.parentNode) a.parentNode.removeChild(a);
      }, 1000);
      window.setTimeout(() => {
        updateRun(key, { status: "done", message: "Download triggered." });
      }, 1500);
    },
    [resolveEpisode, updateRun]
  );

  const startDownloadForMany = useCallback(
    async (eps: Episode[]) => {
      if (eps.length === 0) return;
      pushToast(`Processing ${eps.length} episode(s)…`, "info");
      for (const ep of eps) {
        // eslint-disable-next-line no-await-in-loop
        await startDownloadForEpisode(ep);
      }
    },
    [pushToast, startDownloadForEpisode]
  );

  const copyToClipboard = useCallback(
    async (text: string, key: string) => {
      try {
        await navigator.clipboard.writeText(text);
        setCopiedKey(key);
        pushToast("Copied to clipboard", "success");
        window.setTimeout(() => setCopiedKey(null), 1500);
      } catch {
        pushToast("Clipboard access denied", "error");
      }
    },
    [pushToast]
  );

  const queueSummary = useMemo(() => {
    const values = Array.from(runs.values());
    return {
      total: values.length,
      done: values.filter((v) => v.status === "done").length,
      errored: values.filter((v) => v.status === "error").length,
      active: values.filter(
        (v) =>
          v.status === "downloading" ||
          v.status === "resolving" ||
          v.status === "queued"
      ).length,
    };
  }, [runs]);

  return (
    <section id="downloader" className="border-t rule paper-2">
      <Toasts toasts={toasts} />

      <div className="mx-auto max-w-6xl px-6 py-16 sm:py-20">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="eyebrow">Search + Downloader</p>
            <h2 className="font-display mt-3 text-4xl leading-[1.05] sm:text-5xl">
              Find your <em>next series</em>
            </h2>
            <p className="mt-3 max-w-xl text-sm text-[color:var(--ink-soft)] sm:text-base">
              Search by anime title to load a full episode list, then resolve
              the{" "}
              <span className="font-semibold text-[color:var(--ink)]">real .mp4</span>{" "}
              streams in one click.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
            <span className="tag">
              <ListChecks className="h-3.5 w-3.5" /> Real episode export
            </span>
            <ThemeBadge mode={mode} />
          </div>
        </div>

        {/* Search panel */}
        <div className="mt-8">
          <SearchPanel onSelect={handleSearchSelect} />
        </div>

        {/* Active show card */}
        {activeShow && (
          <div className="mt-6 flex items-center gap-3 rounded-2xl border rule bg-[color:var(--surface)] p-3 sm:p-4">
            <div className="h-16 w-12 flex-shrink-0 overflow-hidden rounded-md bg-[color:var(--paper-2)]">
              {activeShow.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={activeShow.image}
                  alt={activeShow.title}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="grid h-full w-full place-items-center">
                  <Film className="h-4 w-4 text-[color:var(--ink-faint)]" />
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="eyebrow">Active show</p>
              <p className="truncate font-display text-lg">{activeShow.title}</p>
              <p className="truncate text-[11px] text-[color:var(--ink-soft)]">
                {activeShow.url}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setActiveShow(null);
                setEpisodes([]);
                setSelected(new Set());
                setRuns(new Map());
                setEpisodesError(null);
              }}
              className="btn-pill btn-ghost py-1.5 text-xs"
            >
              Change
            </button>
          </div>
        )}

        {/* Error from the episodes scrape */}
        {episodesError && (
          <div
            className="mt-6 flex items-start gap-2 rounded-2xl border p-3 text-sm"
            style={{
              borderColor:
                "color-mix(in oklab, var(--error) 40%, transparent)",
              background: "var(--error-soft)",
              color: "var(--error)",
            }}
          >
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <span>{episodesError}</span>
          </div>
        )}

        {/* Loading state */}
        {loadingEpisodes && (
          <div className="mt-8 flex items-center justify-center gap-3 rounded-3xl border rule bg-[color:var(--surface)] p-12 text-sm text-[color:var(--ink-soft)]">
            <Loader2 className="h-4 w-4 animate-spin" />
            Scraping episode list…
          </div>
        )}

        {/* Episode list */}
        {episodes.length > 0 && (
          <EpisodeList
            showTitle={activeShow?.title ?? "Episodes"}
            showUrl={activeShow?.url ?? ""}
            episodes={episodes}
            selected={selected}
            runs={runs}
            onToggleSelect={toggleSelect}
            onSelectAll={selectAll}
            onClearSelection={clearSelection}
            onDownloadOne={startDownloadForEpisode}
            onDownloadMany={startDownloadForMany}
            onCopy={copyToClipboard}
            copiedKey={copiedKey}
          />
        )}

        {/* Queue summary card */}
        {runs.size > 0 && (
          <div
            id="queue"
            className="mt-6 rounded-3xl border rule bg-[color:var(--surface)] p-5 animate-fade-in-up"
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="eyebrow">Download queue</p>
                <h3 className="font-display mt-1 text-2xl sm:text-3xl">
                  In <em>progress</em>
                </h3>
                <p className="mt-1 text-xs text-[color:var(--ink-soft)]">
                  {queueSummary.active} active · {queueSummary.done} completed
                  · {queueSummary.errored} failed · {queueSummary.total} total
                </p>
              </div>
              <button
                type="button"
                onClick={clearFinishedRuns}
                className="btn-pill btn-outline self-start py-2 text-xs sm:self-auto"
              >
                <Trash2 className="h-3.5 w-3.5" /> Clear finished
              </button>
            </div>
          </div>
        )}

        {/* Empty state */}
        {episodes.length === 0 && !activeShow && !loadingEpisodes && (
          <div className="mt-8 rounded-3xl border border-dashed rule bg-[color:var(--surface)] p-10 text-center">
            <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-[color:var(--paper-2)]">
              <Film className="h-5 w-5 text-(--ink-soft)11" />
            </span>
            <h3 className="font-display mt-4 text-2xl">
              No episodes loaded <em>yet</em>
            </h3>
            <p className="mx-auto mt-2 max-w-md text-sm text-(--ink-soft)">
              Search by anime title above — pick a result and we&apos;ll fetch its
              full episode list for you.
            </p>
          </div>
        )}

        {/* Privacy footer note */}
        <div className="mt-8 flex flex-col items-start gap-3 rounded-2xl border rule bg-[color:var(--surface)] p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-[color:var(--paper-2)]">
              <Link2 className="h-4 w-4 text-[color:var(--ink-soft)]" />
            </span>
            <div>
              <p className="font-display text-lg">Privacy first</p>
              <p className="text-xs text-[color:var(--ink-soft)]">
                The proxy adds the upstream{" "}
                <code className="rounded bg-[color:var(--paper-2)] px-1">
                  Referer
                </code>{" "}
                so the CDN serves the file. Your browser talks only to us.
              </p>
            </div>
          </div>
          <a href="#how" className="btn-pill btn-outline">
            Read the steps <ArrowRight className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>
    </section>
  );
}

function Toasts({ toasts }: { toasts: Toast[] }) {
  return (
    <div className="pointer-events-none fixed right-4 top-4 z-50 flex w-full max-w-xs flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={classNames(
            "pointer-events-auto rounded-2xl border px-3 py-2 text-xs shadow-md backdrop-blur",
            t.tone === "success" &&
              "bg-[color:var(--success-soft)] text-[color:var(--success)]",
            t.tone === "error" &&
              "bg-[color:var(--error-soft)] text-[color:var(--error)]",
            t.tone === "info" &&
              "border rule bg-[color:var(--surface)] text-[color:var(--ink)]"
          )}
        >
          {t.text}
        </div>
      ))}
    </div>
  );
}

function ThemeBadge({ mode }: { mode: ThemeMode }) {
  return (
    <span className="tag" title="Active theme">
      {mode === "dark" ? "Dark theme" : "Light theme"}
    </span>
  );
}
