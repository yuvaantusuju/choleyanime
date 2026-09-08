"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
  RefreshCcw,
  Search,
  Square,
  SquareCheck,
  Trash2,
  XCircle,
  Play,
  Hash,
  ListChecks,
  Filter,
} from "lucide-react";
import { useTheme, type ThemeMode } from "./useTheme";

type Episode = {
  id: string;
  key: string;
  number: string;
  title: string;
  showUrl: string;
};

type EpisodesResponse = {
  ok: boolean;
  source: string;
  title: string;
  count: number;
  episodes: Episode[];
};

type SearchResult = {
  id: string;
  title: string;
  url: string;
  image: string | null;
  description: string;
  episodeCount: number | null;
};

type SearchResponse = {
  count: number;
  results: SearchResult[];
};

type ResolveResponse = {
  ok: boolean;
  source: string;
  mp4Url: string;
  label: string;
  candidates: { href: string; label: string }[];
};

type DownloadStatus = "queued" | "resolving" | "downloading" | "done" | "error";

type DownloadEntry = {
  id: string;
  episodeLabel: string;
  mp4Url: string | null;
  status: DownloadStatus;
  message: string | null;
  startedAt: number;
};

type Toast = {
  id: string;
  text: string;
  tone: "info" | "success" | "error";
};

const DEFAULT_PLACEHOLDER = "https://animeheaven.me/anime.php?id=example";

function classNames(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function buildDownloadUrl(mp4Url: string, anime: string, episode: string) {
  const params = new URLSearchParams({ url: mp4Url, anime, episode });
  return `/api/download?${params.toString()}`;
}

function sanitizeFilename(input: string) {
  return (input || "episode")
    .replace(/[\\/:*?"<>|]+/g, "_")
    .replace(/\s+/g, " ")
    .trim();
}

function safeFilenameFromLabel(label: string) {
  const base = sanitizeFilename(label) || "episode";
  return base.toLowerCase().endsWith(".mp4") ? base : `${base}.mp4`;
}

export default function Downloader() {
  const [url, setUrl] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [loadingEpisodes, setLoadingEpisodes] = useState(false);
  const [episodesError, setEpisodesError] = useState<string | null>(null);
  const [showTitle, setShowTitle] = useState<string>("");
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState("");

  const [downloads, setDownloads] = useState<DownloadEntry[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const { mode } = useTheme();

  const selectedCount = selected.size;

  const filteredEpisodes = useMemo(() => {
    if (!filter.trim()) return episodes;
    const q = filter.toLowerCase();
    return episodes.filter(
      (e) =>
        e.number.toLowerCase().includes(q) ||
        e.title.toLowerCase().includes(q)
    );
  }, [episodes, filter]);

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

  const handleSearch = useCallback(async () => {
    const trimmed = searchQuery.trim();
    if (!trimmed) return;

    setSearching(true);
    setSearchResults([]);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}`, {
        cache: "no-store",
      });
      const data: SearchResponse | { error: string } = await res.json();
      if (!res.ok || "error" in data) {
        throw new Error("error" in data ? data.error : `HTTP ${res.status}`);
      }
      setSearchResults(data.results);
      if (data.results.length === 0) pushToast("No matching anime found", "info");
    } catch (err) {
      pushToast(
        err instanceof Error ? err.message : "Search failed. Please try again.",
        "error",
      );
    } finally {
      setSearching(false);
    }
  }, [pushToast, searchQuery]);

  const handleFetch = useCallback(async (requestedUrl = url) => {
    const trimmed = requestedUrl.trim();
    if (!trimmed) {
      setEpisodesError("Please paste an anime show URL first.");
      return;
    }
    setLoadingEpisodes(true);
    setEpisodesError(null);
    setEpisodes([]);
    setSelected(new Set());
    setShowTitle("");
    try {
      const res = await fetch(
        `/api/episodes?url=${encodeURIComponent(trimmed)}`,
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
      setShowTitle(data.title);
      setEpisodes(data.episodes);
      pushToast(`Loaded ${data.count} episodes for “${data.title}”`, "success");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unknown error while loading episodes.";
      setEpisodesError(message);
    } finally {
      setLoadingEpisodes(false);
    }
  }, [pushToast, url]);

  const selectSearchResult = useCallback(
    (result: SearchResult) => {
      setSearchQuery(result.title);
      setSearchResults([]);
      setUrl(result.url);
      void handleFetch(result.url);
    },
    [handleFetch]
  );

  const toggleSelect = useCallback((key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelected(new Set(filteredEpisodes.map((e) => e.key)));
  }, [filteredEpisodes]);

  const deselectAll = useCallback(() => {
    setSelected(new Set());
  }, []);

  const updateDownload = useCallback(
    (id: string, patch: Partial<DownloadEntry>) => {
      setDownloads((prev) =>
        prev.map((d) => (d.id === id ? { ...d, ...patch } : d))
      );
    },
    []
  );

  const removeDownload = useCallback((id: string) => {
    setDownloads((prev) => prev.filter((d) => d.id !== id));
  }, []);

  const clearFinished = useCallback(() => {
    setDownloads((prev) =>
      prev.filter(
        (d) =>
          d.status === "downloading" ||
          d.status === "resolving" ||
          d.status === "queued"
      )
    );
  }, []);

  const resolveEpisode = useCallback(
    async (
      episode: Episode
    ): Promise<{ mp4Url: string; label: string } | null> => {
      try {
        const res = await fetch(
          `/api/resolve-link?key=${encodeURIComponent(episode.key)}`,
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
        pushToast(`Could not resolve ${episode.number}: ${message}`, "error");
        return null;
      }
    },
    [pushToast]
  );

  const startDownloadForEpisode = useCallback(
    async (episode: Episode) => {
      const id = `${episode.key}-${Date.now()}`;
      const entry: DownloadEntry = {
        id,
        episodeLabel: episode.number,
        mp4Url: null,
        status: "resolving",
        message: "Locating direct .mp4 link…",
        startedAt: Date.now(),
      };
      setDownloads((prev) => [entry, ...prev]);
      const resolved = await resolveEpisode(episode);
      if (!resolved) {
        updateDownload(id, {
          status: "error",
          message: "Unable to locate a direct .mp4 link.",
        });
        return;
      }
      updateDownload(id, {
        mp4Url: resolved.mp4Url,
        status: "downloading",
        message: "Streamed via proxy. Save the file from your browser.",
      });
      const filename = safeFilenameFromLabel(episode.number);
      const href = buildDownloadUrl(
        resolved.mp4Url,
        showTitle || "Anime",
        episode.number,
      );
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
        updateDownload(id, { status: "done", message: "Download triggered." });
      }, 1500);
    },
    [resolveEpisode, showTitle, updateDownload]
  );

  const startDownloadForMany = useCallback(
    async (eps: Episode[]) => {
      if (eps.length === 0) return;
      pushToast(`Processing ${eps.length} episode(s)…`, "info");
      for (const ep of eps) {
        await startDownloadForEpisode(ep);
      }
    },
    [pushToast, startDownloadForEpisode]
  );

  const downloadSelected = useCallback(() => {
    const eps = episodes.filter((e) => selected.has(e.key));
    void startDownloadForMany(eps);
  }, [episodes, selected, startDownloadForMany]);

  const downloadAll = useCallback(() => {
    void startDownloadForMany(episodes);
  }, [episodes, startDownloadForMany]);

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

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        void handleFetch();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleFetch]);

  const summary = useMemo(() => {
    const total = downloads.length;
    const done = downloads.filter((d) => d.status === "done").length;
    const errored = downloads.filter((d) => d.status === "error").length;
    const active = downloads.filter(
      (d) =>
        d.status === "downloading" ||
        d.status === "resolving" ||
        d.status === "queued"
    ).length;
    return { total, done, errored, active };
  }, [downloads]);

  return (
    <section
      id="downloader"
      className="border-t rule paper-2"
    >
      <Toasts toasts={toasts} />

      <div className="mx-auto max-w-6xl px-6 py-16 sm:py-20">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="eyebrow">Search + Downloader</p>
            <h2 className="font-display mt-3 text-4xl leading-[1.05] sm:text-5xl">
              Find your <em>next series</em>
            </h2>
            <p className="mt-3 max-w-xl text-sm text-(--ink-soft) sm:text-base">
              Search by title or paste a direct series URL. We&apos;ll surface a
              complete episode list, then resolve the{" "}
              <span className="font-semibold text-(--ink)">real .mp4</span>{" "}
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

        {/* Search and URL input */}
        <div className="mt-8 rounded-3xl border rule bg-(--surface) p-4 sm:p-5">
          <label htmlFor="anime-search" className="eyebrow block">
            Search by title
          </label>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-(--ink-soft)" />
              <input
                id="anime-search"
                type="search"
                autoComplete="off"
                placeholder="Search AnimeHeaven titles"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void handleSearch();
                }}
                className="input-field"
              />
            </div>
            <button
              type="button"
              onClick={() => void handleSearch()}
              disabled={searching || !searchQuery.trim()}
              className="btn-pill btn-outline justify-center"
            >
              {searching ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
              {searching ? "Searching" : "Search"}
            </button>
          </div>

          {searchResults.length > 0 && (
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {searchResults.map((result) => (
                <li key={result.id}>
                  <button
                    type="button"
                    onClick={() => selectSearchResult(result)}
                    className="flex w-full items-center justify-between gap-3 rounded-2xl border rule bg-(--paper-2) p-3 text-left transition hover:border-(--ink)"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-display text-lg">
                        {result.title}
                      </span>
                      <span className="block truncate text-[11px] text-(--ink-soft)">
                        {result.url}
                      </span>
                    </span>
                    <ArrowRight className="h-4 w-4 shrink-0 text-(--ink-soft)" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="my-5 flex items-center gap-3 text-[11px] uppercase tracking-wider text-(--ink-soft)">
            <span className="h-px flex-1 bg-(--rule)" />
            or paste a URL
            <span className="h-px flex-1 bg-(--rule)" />
          </div>

          <label htmlFor="anime-url" className="eyebrow block">
            Anime show URL
          </label>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-(--ink-soft)" />
              <input
                id="anime-url"
                type="url"
                inputMode="url"
                spellCheck={false}
                autoComplete="off"
                placeholder={DEFAULT_PLACEHOLDER}
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void handleFetch();
                }}
                className="input-field"
              />
            </div>
            <button
              type="button"
              onClick={() => void handleFetch()}
              disabled={loadingEpisodes}
              className="btn-pill btn-primary justify-center"
            >
              {loadingEpisodes ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading
                </>
              ) : (
                <>
                  <RefreshCcw className="h-4 w-4" /> Fetch episodes
                </>
              )}
            </button>
          </div>
          <p className="mt-3 text-[11px] text-(--ink-soft)">
            Press{" "}
            <kbd
              className="rounded border px-1.5 py-0.5 text-[10px]"
              style={{
                background: "var(--kbd-bg)",
                borderColor: "var(--kbd-border)",
              }}
            >
              ⌘
            </kbd>{" "}
            /{" "}
            <kbd
              className="rounded border px-1.5 py-0.5 text-[10px]"
              style={{
                background: "var(--kbd-bg)",
                borderColor: "var(--kbd-border)",
              }}
            >
              Ctrl
            </kbd>{" "}
            +{" "}
            <kbd
              className="rounded border px-1.5 py-0.5 text-[10px]"
              style={{
                background: "var(--kbd-bg)",
                borderColor: "var(--kbd-border)",
              }}
            >
              Enter
            </kbd>{" "}
            to fetch.
          </p>

          {episodesError && (
            <div
              className="mt-4 flex items-start gap-2 rounded-2xl border p-3 text-sm"
              style={{
                borderColor: "color-mix(in oklab, var(--error) 40%, transparent)",
                background: "var(--error-soft)",
                color: "var(--error)",
              }}
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{episodesError}</span>
            </div>
          )}
        </div>

        {/* Episodes */}
        {episodes.length > 0 && (
          <div className="mt-8 rounded-3xl border rule bg-(--surface) p-4 sm:p-5 animate-fade-in-up">
            <div className="flex flex-col gap-3 border-b rule pb-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="eyebrow">Library</p>
                <h3 className="font-display mt-1 text-2xl sm:text-3xl">
                  {showTitle || "Episodes"}
                </h3>
                <p className="mt-1 text-xs text-(--ink-soft)">
                  {episodes.length} episode
                  {episodes.length === 1 ? "" : "s"} · {selectedCount} selected
                  {filter && ` · ${filteredEpisodes.length} shown`}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Filter className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-(--ink-soft)" />
                  <input
                    type="text"
                    placeholder="Filter episodes…"
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    className="input-mini w-44"
                  />
                </div>
                <button
                  type="button"
                  onClick={selectAll}
                  className="btn-pill btn-outline py-2 text-xs"
                  disabled={filteredEpisodes.length === 0}
                >
                  <SquareCheck className="h-3.5 w-3.5" /> Select all
                </button>
                <button
                  type="button"
                  onClick={deselectAll}
                  className="btn-pill btn-outline py-2 text-xs"
                  disabled={selectedCount === 0}
                >
                  <Square className="h-3.5 w-3.5" /> Clear
                </button>
                <button
                  type="button"
                  onClick={downloadSelected}
                  disabled={selectedCount === 0}
                  className="btn-pill btn-accent py-2 text-xs"
                >
                  <Download className="h-3.5 w-3.5" /> Download selected
                </button>
                <button
                  type="button"
                  onClick={downloadAll}
                  className="btn-pill btn-primary py-2 text-xs"
                >
                  <Download className="h-3.5 w-3.5" /> Download all
                </button>
              </div>
            </div>

            <div className="episode-scroll mt-4 max-h-[55vh] overflow-y-auto pr-1">
              {filteredEpisodes.length === 0 ? (
                <p className="rounded-2xl border rule bg-(--paper-2) p-6 text-center text-sm text-(--ink-soft)">
                  No episodes match your filter.
                </p>
              ) : (
                <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {filteredEpisodes.map((ep) => {
                    const isSelected = selected.has(ep.key);
                    return (
                      <li
                        key={ep.key}
                        className={classNames(
                          "group flex flex-col gap-3 rounded-2xl border p-4 transition",
                          isSelected
                            ? "border-(--ink) bg-(--paper-2)"
                            : "border rule bg-(--surface) hover:border-(--ink)"
                        )}
                      >
                        <label className="flex cursor-pointer items-start gap-3">
                          <input
                            type="checkbox"
                            className="mt-1 h-4 w-4 rounded border rule accent-(--ink)"
                            checked={isSelected}
                            onChange={() => toggleSelect(ep.key)}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="grid h-7 w-7 place-items-center rounded-full bg-(--ink) text-(--paper)">
                                <Hash className="h-3 w-3" />
                              </span>
                              <p className="truncate font-display text-lg">
                                {ep.number}
                              </p>
                            </div>
                            <p className="mt-1 truncate text-[11px] text-(--ink-soft)">
                              {ep.showUrl}
                            </p>
                          </div>
                        </label>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => void startDownloadForEpisode(ep)}
                            className="btn-pill btn-primary flex-1 justify-center py-1.5 text-xs"
                          >
                            <Play className="h-3.5 w-3.5" /> Download
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              void copyToClipboard(ep.showUrl, `gate-${ep.key}`)
                            }
                            className="btn-pill btn-outline py-1.5 text-xs"
                            title="Copy gate page URL"
                          >
                            {copiedKey === `gate-${ep.key}` ? (
                              <ClipboardCheck className="h-3.5 w-3.5 text-(--success)" />
                            ) : (
                              <Clipboard className="h-3.5 w-3.5" />
                            )}
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        )}

        {/* Queue */}
        {downloads.length > 0 && (
          <div
            id="queue"
            className="mt-8 rounded-3xl border rule bg-(--surface) p-4 sm:p-5 animate-fade-in-up"
          >
            <div className="flex flex-col gap-2 border-b rule pb-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="eyebrow">Download queue</p>
                <h3 className="font-display mt-1 text-2xl sm:text-3xl">
                  In <em>progress</em>
                </h3>
                <p className="mt-1 text-xs text-(--ink-soft)">
                  {summary.active} active · {summary.done} completed ·{" "}
                  {summary.errored} failed · {summary.total} total
                </p>
              </div>
              <button
                type="button"
                onClick={clearFinished}
                className="btn-pill btn-outline self-start py-2 text-xs sm:self-auto"
              >
                <Trash2 className="h-3.5 w-3.5" /> Clear finished
              </button>
            </div>

            <ul className="episode-scroll mt-4 max-h-[35vh] divide-y overflow-y-auto" style={{ borderColor: "var(--rule)" }}>
              {downloads.map((d) => (
                <DownloadRow
                  key={d.id}
                  entry={d}
                  onCopy={copyToClipboard}
                  copiedKey={copiedKey}
                  onRemove={removeDownload}
                />
              ))}
            </ul>
          </div>
        )}

        {/* Empty state */}
        {episodes.length === 0 && !loadingEpisodes && !episodesError && (
          <div className="mt-8 rounded-3xl border border-dashed rule bg-(--surface) p-10 text-center">
            <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-(--paper-2)">
              <Film className="h-5 w-5 text-(--ink-soft)" />
            </span>
            <h3 className="font-display mt-4 text-2xl">
              No episodes loaded <em>yet</em>
            </h3>
            <p className="mx-auto mt-2 max-w-md text-sm text-(--ink-soft)">
              Paste an animeheaven.me show URL above and press{" "}
              <span className="font-semibold text-(--ink)">
                Fetch episodes
              </span>{" "}
              to populate your library.
            </p>
          </div>
        )}

        {/* Privacy footer note */}
        <div className="mt-8 flex flex-col items-start gap-3 rounded-2xl border rule bg-(--surface) p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-(--paper-2)">
              <Link2 className="h-4 w-4 text-(--ink-soft)" />
            </span>
            <div>
              <p className="font-display text-lg">Privacy first</p>
              <p className="text-xs text-(--ink-soft)">
                The proxy adds the upstream{" "}
                <code className="rounded bg-(--paper-2) px-1">
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

function DownloadRow({
  entry,
  onCopy,
  copiedKey,
  onRemove,
}: {
  entry: DownloadEntry;
  onCopy: (text: string, key: string) => void;
  copiedKey: string | null;
  onRemove: (id: string) => void;
}) {
  const icon = (() => {
    switch (entry.status) {
      case "resolving":
      case "queued":
        return <Loader2 className="h-4 w-4 animate-spin text-(--accent)" />;
      case "downloading":
        return <Loader2 className="h-4 w-4 animate-spin text-(--ink)" />;
      case "done":
        return <CheckCircle2 className="h-4 w-4 text-(--success)" />;
      case "error":
        return <XCircle className="h-4 w-4 text-(--error)" />;
    }
  })();

  const tone = (() => {
    switch (entry.status) {
      case "done":
        return "bg-(--success-soft)";
      case "error":
        return "bg-(--error-soft)";
      default:
        return "";
    }
  })();

  return (
    <li
      className={classNames(
        "flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between",
        tone
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        {icon}
        <div className="min-w-0">
          <p className="truncate font-display text-lg">{entry.episodeLabel}</p>
          <p className="truncate text-[11px] text-(--ink-soft)">
            {entry.message ?? "—"}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {entry.mp4Url && (
          <>
            <button
              type="button"
              onClick={() => onCopy(entry.mp4Url!, `mp4-${entry.id}`)}
              className="btn-pill btn-outline py-1.5 text-xs"
              title="Copy direct .mp4 URL"
            >
              {copiedKey === `mp4-${entry.id}` ? (
                <>
                  <ClipboardCheck className="h-3.5 w-3.5 text-(--success)" />
                  Copied
                </>
              ) : (
                <>
                  <Clipboard className="h-3.5 w-3.5" /> Copy URL
                </>
              )}
            </button>
            <a
              href={buildDownloadUrl(
                entry.mp4Url,
                "Anime",
                entry.episodeLabel,
              )}
              download={safeFilenameFromLabel(entry.episodeLabel)}
              className="btn-pill btn-accent py-1.5 text-xs"
            >
              <Download className="h-3.5 w-3.5" /> Save again
            </a>
          </>
        )}
        <button
          type="button"
          onClick={() => onRemove(entry.id)}
          className="grid h-8 w-8 place-items-center rounded-full border rule bg-(--surface) text-(--ink-soft) transition hover:border-(--error) hover:text-(--error)"
          title="Remove from queue"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </li>
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
              "bg-(--success-soft) text-(--success)",
            t.tone === "error" && "bg-(--error-soft) text-(--error)",
            t.tone === "info" &&
              "border rule bg-(--surface) text-(--ink)"
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
