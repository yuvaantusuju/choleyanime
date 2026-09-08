"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Clipboard,
  ClipboardCheck,
  Download,
  Film,
  Loader2,
  RefreshCcw,
  Search,
  Sparkles,
  Square,
  SquareCheck,
  Trash2,
  XCircle,
} from "lucide-react";

type Episode = {
  index: number;
  label: string;
  number: number | null;
  href: string;
  gateHref: string;
  fullUrl: string;
};

type EpisodesResponse = {
  ok: boolean;
  source: string;
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

const DEFAULT_PLACEHOLDER =
  "https://animeheaven.me/anime.php?some-show-id";

function classNames(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function buildDownloadUrl(mp4Url: string, filename: string) {
  const params = new URLSearchParams({ url: mp4Url, filename });
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

export default function AnimeDownloader() {
  const [url, setUrl] = useState("");
  const [loadingEpisodes, setLoadingEpisodes] = useState(false);
  const [episodesError, setEpisodesError] = useState<string | null>(null);
  const [showTitle, setShowTitle] = useState<string>("");
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const [downloads, setDownloads] = useState<DownloadEntry[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

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

  const handleFetch = useCallback(async () => {
    const trimmed = url.trim();
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
          "No episodes were found. The page structure may have changed or the URL is incorrect."
        );
        return;
      }

      setShowTitle(data.title);
      setEpisodes(data.episodes);
      pushToast(`Loaded ${data.count} episodes for "${data.title}"`, "success");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unknown error while loading episodes.";
      setEpisodesError(message);
    } finally {
      setLoadingEpisodes(false);
    }
  }, [url, pushToast]);

  const toggleSelect = useCallback((key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelected(new Set(episodes.map((e) => e.fullUrl)));
  }, [episodes]);

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
    setDownloads((prev) => prev.filter((d) => d.status === "downloading" || d.status === "resolving"));
  }, []);

  const resolveEpisode = useCallback(
    async (episode: Episode): Promise<{ mp4Url: string; label: string } | null> => {
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
      const id = `${episode.fullUrl}-${Date.now()}`;
      const entry: DownloadEntry = {
        id,
        episodeLabel: episode.label,
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

      // Trigger the actual download via a hidden anchor click.
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

      // Optimistically mark done shortly after firing the request.
      window.setTimeout(() => {
        updateDownload(id, { status: "done", message: "Download triggered." });
      }, 1500);
    },
    [resolveEpisode, updateDownload]
  );

  const startDownloadForMany = useCallback(
    async (eps: Episode[]) => {
      if (eps.length === 0) return;
      pushToast(`Processing ${eps.length} episode(s)…`, "info");
      for (const ep of eps) {
        // Sequential to keep upstream pressure low and to make statuses meaningful.
        // eslint-disable-next-line no-await-in-loop
        await startDownloadForEpisode(ep);
      }
    },
    [pushToast, startDownloadForEpisode]
  );

  const downloadSelected = useCallback(() => {
    const eps = episodes.filter((e) => selected.has(e.fullUrl));
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

  // Keyboard nicety: ⌘/Ctrl + Enter to fetch.
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
      (d) => d.status === "downloading" || d.status === "resolving" || d.status === "queued"
    ).length;
    return { total, done, errored, active };
  }, [downloads]);

  return (
    <div className="min-h-screen w-full bg-linear-to-b from-slate-950 via-slate-950 to-slate-900 text-slate-100">
      <Toasts toasts={toasts} />

      <header className="border-b border-white/5 bg-slate-950/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-6 py-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-xl bg-linear-to-br from-indigo-500 via-fuchsia-500 to-rose-500 shadow-lg shadow-fuchsia-900/30">
              <Film className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-semibold tracking-tight sm:text-xl">
                Anime Downloader
              </h1>
              <p className="text-xs text-slate-400 sm:text-sm">
                scans episode lists, resolve direct{" "}
                <code className="rounded bg-white/5 px-1 py-0.5">.mp4</code>{" "}
                   download them through a hotlink-friendly proxy.
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-6xl flex-col gap-8 px-6 py-8">
        <section className="rounded-2xl border border-white/10 bg-slate-900/60 p-5 shadow-xl shadow-slate-950/40">
          <label
            htmlFor="anime-url"
            className="text-xs font-semibold uppercase tracking-wider text-slate-400"
          >
            Anime show URL
          </label>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
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
                className="w-full rounded-xl border border-white/10 bg-slate-950/60 py-3 pl-9 pr-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
              />
            </div>
            <button
              type="button"
              onClick={() => void handleFetch()}
              disabled={loadingEpisodes}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-500 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-900/40 transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loadingEpisodes ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading…
                </>
              ) : (
                <>
                  <RefreshCcw className="h-4 w-4" />
                  Fetch episodes
                </>
              )}
            </button>
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Tip: press <kbd className="rounded bg-white/10 px-1.5 py-0.5 text-[10px]">⌘</kbd>
            <span className="px-1">/</span>
            <kbd className="rounded bg-white/10 px-1.5 py-0.5 text-[10px]">Ctrl</kbd>
            <span className="px-1">+</span>
            <kbd className="rounded bg-white/10 px-1.5 py-0.5 text-[10px]">Enter</kbd>
            to fetch.
          </p>

          {episodesError && (
            <div className="mt-4 flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{episodesError}</span>
            </div>
          )}
        </section>

        {episodes.length > 0 && (
          <section className="rounded-2xl border border-white/10 bg-slate-900/60 shadow-xl shadow-slate-950/40">
            <div className="flex flex-col gap-3 border-b border-white/5 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-base font-semibold text-white">
                  {showTitle || "Episodes"}
                </h2>
                <p className="text-xs text-slate-400">
                  {episodes.length} episode{episodes.length === 1 ? "" : "s"} ·{" "}
                  {selectedCount} selected
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={selectAll}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-slate-200 transition hover:bg-white/10"
                >
                  <SquareCheck className="h-3.5 w-3.5" /> Select all
                </button>
                <button
                  type="button"
                  onClick={deselectAll}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-slate-200 transition hover:bg-white/10"
                >
                  <Square className="h-3.5 w-3.5" /> Deselect all
                </button>
                <button
                  type="button"
                  onClick={downloadSelected}
                  disabled={selectedCount === 0}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-2 text-xs font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Download className="h-3.5 w-3.5" /> Download selected
                </button>
                <button
                  type="button"
                  onClick={downloadAll}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-fuchsia-500 px-3 py-2 text-xs font-semibold text-white transition hover:bg-fuchsia-400"
                >
                  <Download className="h-3.5 w-3.5" /> Download all
                </button>
              </div>
            </div>

            <div className="episode-scroll max-h-[60vh] overflow-y-auto p-5">
              <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {episodes.map((ep) => {
                  const isSelected = selected.has(ep.fullUrl);
                  return (
                    <li
                      key={ep.fullUrl}
                      className={classNames(
                        "group relative flex flex-col gap-2 rounded-xl border p-3 transition",
                        isSelected
                          ? "border-indigo-400/60 bg-indigo-500/10 shadow-inner shadow-indigo-900/40"
                          : "border-white/10 bg-slate-950/40 hover:border-white/20"
                      )}
                    >
                      <label className="flex cursor-pointer items-start gap-3">
                        <input
                          type="checkbox"
                          className="mt-0.5 h-4 w-4 rounded border-white/20 bg-slate-900 text-indigo-500 focus:ring-indigo-500"
                          checked={isSelected}
                          onChange={() => toggleSelect(ep.fullUrl)}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-white">
                            {ep.label}
                          </p>
                          <p className="truncate text-[11px] text-slate-500">
                            {ep.gateHref}
                          </p>
                        </div>
                      </label>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => void startDownloadForEpisode(ep)}
                          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-indigo-500 px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-indigo-400"
                        >
                          <Download className="h-3.5 w-3.5" /> Download
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            void copyToClipboard(ep.fullUrl, `gate-${ep.fullUrl}`)
                          }
                          className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs text-slate-200 transition hover:bg-white/10"
                          title="Copy gate page URL"
                        >
                          {copiedKey === `gate-${ep.fullUrl}` ? (
                            <ClipboardCheck className="h-3.5 w-3.5 text-emerald-400" />
                          ) : (
                            <Clipboard className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          </section>
        )}

        {downloads.length > 0 && (
          <section className="rounded-2xl border border-white/10 bg-slate-900/60 shadow-xl shadow-slate-950/40">
            <div className="flex flex-col gap-2 border-b border-white/5 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-base font-semibold text-white">
                  Download queue
                </h2>
                <p className="text-xs text-slate-400">
                  {summary.active} active · {summary.done} completed ·{" "}
                  {summary.errored} failed · {summary.total} total
                </p>
              </div>
              <button
                type="button"
                onClick={clearFinished}
                className="inline-flex items-center gap-1.5 self-start rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-slate-200 transition hover:bg-white/10 sm:self-auto"
              >
                <Trash2 className="h-3.5 w-3.5" /> Clear finished
              </button>
            </div>

            <ul className="episode-scroll max-h-[40vh] divide-y divide-white/5 overflow-y-auto">
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
          </section>
        )}

        {episodes.length === 0 && !loadingEpisodes && !episodesError && (
          <section className="rounded-2xl border border-dashed border-white/10 bg-slate-900/40 p-10 text-center">
            <Film className="mx-auto mb-3 h-8 w-8 text-slate-500" />
            <h3 className="text-sm font-semibold text-slate-200">
              No episodes loaded yet
            </h3>
            <p className="mx-auto mt-1 max-w-md text-xs text-slate-500">
              Paste an animeheaven.me show URL above and press{" "}
              <span className="font-semibold text-slate-300">Fetch episodes</span>{" "}
              to populate this dashboard.
            </p>
          </section>
        )}

        <section className="rounded-2xl border border-white/10 bg-slate-900/40 p-5 text-xs text-slate-400">
          <h3 className="mb-2 text-sm font-semibold text-slate-200">
            How it works
          </h3>
          <ol className="list-decimal space-y-1 pl-5">
            <li>
              <code className="rounded bg-white/5 px-1">/api/episodes</code>{" "}
              loads the show page and scrapes every{" "}
              <code className="rounded bg-white/5 px-1">
                div.trackep.watchb.bc
              </code>{" "}
              item, reading the gate page link from its wrapping{" "}
              <code className="rounded bg-white/5 px-1">a[href*=gate.php]</code>.
            </li>
            <li>
              <code className="rounded bg-white/5 px-1">/api/resolve-link</code>{" "}
              opens the gate page and locates the direct{" "}
              <code className="rounded bg-white/5 px-1">.mp4</code> URL inside{" "}
              <code className="rounded bg-white/5 px-1">
                a:has(div.boxitem.bc2.c1.mar0)
              </code>
              .
            </li>
            <li>
              <code className="rounded bg-white/5 px-1">/api/download</code>{" "}
              streams that <code className="rounded bg-white/5 px-1">.mp4</code>{" "}
              with a UA and{" "}
              <code className="rounded bg-white/5 px-1">Referer</code>{" "}
              header, then forwards the response with{" "}
              <code className="rounded bg-white/5 px-1">
                Content-Disposition: attachment
              </code>
              .
            </li>
          </ol>
        </section>
      </main>

      <footer className="border-t border-white/5 py-6 text-center text-[11px] text-slate-500">
        Built for educational scraping demos · Respect the target site&apos;s
        terms of service
      </footer>
    </div>
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
        return <Loader2 className="h-4 w-4 animate-spin text-indigo-300" />;
      case "downloading":
        return <Loader2 className="h-4 w-4 animate-spin text-amber-300" />;
      case "done":
        return <CheckCircle2 className="h-4 w-4 text-emerald-400" />;
      case "error":
        return <XCircle className="h-4 w-4 text-rose-400" />;
    }
  })();

  const tone = (() => {
    switch (entry.status) {
      case "done":
        return "border-emerald-500/30 bg-emerald-500/5";
      case "error":
        return "border-rose-500/30 bg-rose-500/5";
      default:
        return "border-white/10 bg-slate-950/40";
    }
  })();

  return (
    <li
      className={classNames(
        "flex flex-col gap-2 border-l-2 p-4 sm:flex-row sm:items-center sm:justify-between",
        tone
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        {icon}
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-white">
            {entry.episodeLabel}
          </p>
          <p className="truncate text-[11px] text-slate-400">
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
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs text-slate-200 transition hover:bg-white/10"
              title="Copy direct .mp4 URL"
            >
              {copiedKey === `mp4-${entry.id}` ? (
                <>
                  <ClipboardCheck className="h-3.5 w-3.5 text-emerald-400" />
                  Copied
                </>
              ) : (
                <>
                  <Clipboard className="h-3.5 w-3.5" />
                  Copy URL
                </>
              )}
            </button>
            <a
              href={buildDownloadUrl(
                entry.mp4Url,
                safeFilenameFromLabel(entry.episodeLabel)
              )}
              download={safeFilenameFromLabel(entry.episodeLabel)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-500 px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-indigo-400"
            >
              <Download className="h-3.5 w-3.5" /> Save again
            </a>
          </>
        )}
        <button
          type="button"
          onClick={() => onRemove(entry.id)}
          className="inline-flex items-center justify-center rounded-lg border border-white/10 bg-white/5 p-1.5 text-slate-300 transition hover:bg-rose-500/20 hover:text-rose-200"
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
            "pointer-events-auto rounded-xl border px-3 py-2 text-xs shadow-lg backdrop-blur",
            t.tone === "success" &&
              "border-emerald-500/40 bg-emerald-500/15 text-emerald-100",
            t.tone === "error" &&
              "border-rose-500/40 bg-rose-500/15 text-rose-100",
            t.tone === "info" &&
              "border-indigo-500/40 bg-indigo-500/15 text-indigo-100"
          )}
        >
          {t.text}
        </div>
      ))}
    </div>
  );
}
