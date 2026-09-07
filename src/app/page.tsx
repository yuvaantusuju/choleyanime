"use client";

import { useCallback, useMemo, useState } from "react";
import {
  Download,
  Film,
  Loader2,
  Pause,
  Play,
  Search,
  X,
  CheckSquare,
  Square,
  ChevronLeft,
  AlertTriangle,
  ImageOff,
  RefreshCcw,
  ListChecks,
} from "lucide-react";

// --- Types ---

type SearchResult = {
  id: string;
  title: string;
  url: string;
  image: string | null;
  description: string;
  episodeCount: number | null;
};

type Episode = {
  id: string;
  key: string;
  number: string;
  title: string;
  showUrl: string;
};

type DownloadStatus = "queued" | "resolving" | "downloading" | "done" | "error" | "cancelled";

type DownloadItem = {
  id: string;
  episode: Episode;
  animeTitle: string;
  status: DownloadStatus;
  progress: number;
  bytes: number;
  totalBytes: number | null;
  message?: string;
  blobUrl?: string;
  startedAt?: number;
  finishedAt?: number;
};

// --- Helpers ---

function sanitizeName(name: string): string {
  return name.replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim();
}

function buildDownloadUrl(mp4Url: string, animeTitle: string, episodeLabel: string) {
  const params = new URLSearchParams({
    url: mp4Url,
    anime: animeTitle,
    episode: episodeLabel,
  });
  return `/api/download?${params.toString()}`;
}

function triggerBrowserDownload(href: string, fallbackName: string) {
  const a = document.createElement("a");
  a.href = href;
  a.download = fallbackName;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function formatBytes(n: number | null | undefined): string {
  if (n == null || !isFinite(n)) return "—";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v >= 100 || i === 0 ? 0 : 1)} ${units[i]}`;
}

function statusBadge(status: DownloadStatus) {
  const map: Record<DownloadStatus, string> = {
    queued: "bg-slate-700/70 text-slate-200",
    resolving: "bg-amber-500/20 text-amber-300 border border-amber-500/30",
    downloading:
      "bg-sky-500/20 text-sky-300 border border-sky-500/30",
    done: "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30",
    error: "bg-rose-500/20 text-rose-300 border border-rose-500/30",
    cancelled: "bg-slate-600/30 text-slate-400 border border-slate-500/30",
  };
  return map[status];
}

// --- Page ---

export default function HomePage() {
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [searchedFor, setSearchedFor] = useState<string>("");

  const [selectedAnime, setSelectedAnime] = useState<SearchResult | null>(null);
  const [episodes, setEpisodes] = useState<Episode[] | null>(null);
  const [episodesLoading, setEpisodesLoading] = useState(false);
  const [episodesError, setEpisodesError] = useState<string | null>(null);
  const [episodesErrorDetails, setEpisodesErrorDetails] = useState<string | null>(null);
  const [episodesErrorHint, setEpisodesErrorHint] = useState<string | null>(null);
  const [selectedEpisodes, setSelectedEpisodes] = useState<Set<string>>(new Set());
  const [episodeFilter, setEpisodeFilter] = useState("");

  const [downloads, setDownloads] = useState<Record<string, DownloadItem>>({});
  const [activeDownload, setActiveDownload] = useState<string | null>(null);

  // --- Search ---

  const runSearch = useCallback(async (term?: string) => {
    const q = (term ?? query).trim();
    if (!q) return;
    setSearching(true);
    setSearchError(null);
    setSearchedFor(q);
    setResults(null);
    setSelectedAnime(null);
    setEpisodes(null);
    setSelectedEpisodes(new Set());
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      const data = (await res.json()) as {
        results?: SearchResult[];
        error?: string;
      };
      if (!res.ok) {
        throw new Error(data?.error || `Request failed (${res.status})`);
      }
      setResults((data.results ?? []) as SearchResult[]);
    } catch (e) {
      setSearchError(e instanceof Error ? e.message : "Search failed.");
    } finally {
      setSearching(false);
    }
  }, [query]);

  // --- Episodes ---

  const openAnime = useCallback(async (anime: SearchResult) => {
    setSelectedAnime(anime);
    setEpisodes(null);
    setEpisodesError(null);
    setEpisodesErrorDetails(null);
    setSelectedEpisodes(new Set());
    setEpisodeFilter("");
    setEpisodesLoading(true);
    try {
      // Use the short `id` form (just the hash) to keep the URL small
      // and avoid any edge case where Vercel's URL parsing is strict.
      const res = await fetch(`/api/episodes?id=${encodeURIComponent(anime.id)}`, {
        cache: "no-store",
      });
      const data = (await res.json()) as {
        episodes?: Episode[];
        error?: string;
        details?: string;
        hint?: string;
      };
      if (!res.ok) {
        throw Object.assign(
          new Error(data?.error || `Request failed (${res.status})`),
          { details: data?.details, hint: data?.hint },
        );
      }
      const eps = (data.episodes ?? []) as Episode[];
      setEpisodes(eps);
    } catch (e) {
      const err = e as Error & { details?: string; hint?: string };
      setEpisodesError(err.message || "Failed to load episodes.");
      setEpisodesErrorDetails(err.details ?? null);
      setEpisodesErrorHint(err.hint ?? null);
    } finally {
      setEpisodesLoading(false);
    }
  }, []);

  // --- Selection ---

  const toggleEpisode = useCallback((key: string) => {
    setSelectedEpisodes((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    if (!episodes) return;
    setSelectedEpisodes(new Set(episodes.map((e) => e.key)));
  }, [episodes]);

  const clearSelection = useCallback(() => {
    setSelectedEpisodes(new Set());
  }, []);

  const filteredEpisodes = useMemo(() => {
    if (!episodes) return [];
    if (!episodeFilter.trim()) return episodes;
    const f = episodeFilter.trim().toLowerCase();
    return episodes.filter(
      (e) =>
        e.number.toLowerCase().includes(f) ||
        e.title.toLowerCase().includes(f),
    );
  }, [episodes, episodeFilter]);

  // --- Downloads ---

  const updateDownload = useCallback(
    (id: string, patch: Partial<DownloadItem>) => {
      setDownloads((prev) => {
        const current = prev[id];
        if (!current) return prev;
        return { ...prev, [id]: { ...current, ...patch } };
      });
    },
    [],
  );

  const startDownload = useCallback(
    async (id: string) => {
      const item = downloads[id];
      if (!item) return;
      if (item.status === "downloading" || item.status === "resolving") return;

      setActiveDownload(id);
      updateDownload(id, {
        status: "resolving",
        progress: 0,
        bytes: 0,
        message: "Locating direct .mp4 link…",
        startedAt: Date.now(),
        finishedAt: undefined,
        blobUrl: undefined,
      });

      try {
        const r = await fetch(
          `/api/resolve-link?key=${encodeURIComponent(item.episode.key)}`,
        );
        const data = (await r.json()) as { mp4Url?: string; error?: string };
        if (!r.ok) throw new Error(data?.error || `Resolve failed (${r.status})`);
        const mp4Url: string | undefined = data.mp4Url;
        if (!mp4Url) throw new Error("No direct .mp4 link returned.");

        updateDownload(id, {
          status: "downloading",
          message: "Streaming to your browser…",
        });

        // We fetch via our proxy so the Referer / UA are set correctly,
        // and so the browser sees a Content-Disposition header for the
        // suggested filename. The actual file is saved via the anchor click.
        const proxyUrl = buildDownloadUrl(
          mp4Url,
          sanitizeName(item.animeTitle),
          sanitizeName(item.episode.number),
        );

        // Trigger the browser save (the server sets Content-Disposition).
        triggerBrowserDownload(
          proxyUrl,
          `${sanitizeName(item.animeTitle)}_${sanitizeName(
            item.episode.number,
          )}.mp4`,
        );

        // We don't have a true progress signal in the browser, so mark done
        // optimistically after a short delay. The server still streamed the
        // file fully — this is just a UI state transition.
        setTimeout(() => {
          setDownloads((prev) => {
            const cur = prev[id];
            if (!cur) return prev;
            return {
              ...prev,
              [id]: {
                ...cur,
                status: "done",
                progress: 100,
                finishedAt: Date.now(),
                message: "Download started in your browser.",
              },
            };
          });
          setActiveDownload((cur) => (cur === id ? null : cur));
        }, 800);
      } catch (e) {
        updateDownload(id, {
          status: "error",
          message: e instanceof Error ? e.message : "Download failed.",
          finishedAt: Date.now(),
        });
        setActiveDownload((cur) => (cur === id ? null : cur));
      }
    },
    [downloads, updateDownload],
  );

  const downloadSelected = useCallback(() => {
    if (!selectedAnime || !episodes) return;
    const eps = episodes.filter((e) => selectedEpisodes.has(e.key));
    if (!eps.length) return;

    // Queue all selected items
    const newOnes: Record<string, DownloadItem> = {};
    for (const ep of eps) {
      const id = `${selectedAnime.id}::${ep.key}`;
      if (downloads[id] && downloads[id].status !== "error") continue;
      newOnes[id] = {
        id,
        episode: ep,
        animeTitle: selectedAnime.title,
        status: "queued",
        progress: 0,
        bytes: 0,
        totalBytes: null,
      };
    }

    if (!Object.keys(newOnes).length) {
      // All already queued or running
      return;
    }

    setDownloads((prev) => ({ ...prev, ...newOnes }));

    // Start the first one; chain the rest
    const ids = Object.keys(newOnes);
    let chain = Promise.resolve();
    ids.forEach((id, idx) => {
      chain = chain.then(
        () =>
          new Promise<void>((resolve) => {
            // Defer to next tick so state commits
            setTimeout(async () => {
              await startDownload(id);
              resolve();
            }, idx === 0 ? 0 : 1200);
          }),
      );
    });
  }, [downloads, episodes, selectedAnime, selectedEpisodes, startDownload]);

  const removeDownload = useCallback((id: string) => {
    setDownloads((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  const clearCompleted = useCallback(() => {
    setDownloads((prev) => {
      const next: Record<string, DownloadItem> = {};
      for (const [k, v] of Object.entries(prev)) {
        if (v.status !== "done" && v.status !== "cancelled" && v.status !== "error") {
          next[k] = v;
        }
      }
      return next;
    });
  }, []);

  const downloadList = useMemo(
    () =>
      Object.values(downloads).sort(
        (a, b) => (a.startedAt ?? 0) - (b.startedAt ?? 0),
      ),
    [downloads],
  );

  // --- Render ---

  return (
    <main className="choley-shell min-h-screen overflow-hidden text-[#1e2521]">
      <Header />

      <div className="relative mx-auto w-full max-w-6xl space-y-10 px-5 pb-10 sm:px-8">
        <div className="soft-grid pointer-events-none absolute inset-x-0 top-0 h-96 opacity-40" />
        {/* Search Section */}
        <section id="search" className="hero-board reveal relative space-y-8 pb-14 pt-14 sm:pb-20 sm:pt-20">
          <div className="hero-index mono" aria-hidden="true">
            <span>CH</span>
            <span>01 / 03</span>
          </div>
          <div className="max-w-3xl">
            <p className="mono mb-5 text-[11px] uppercase tracking-[0.24em] text-[#d7f64a]">Your episodes. Offline. Anywhere.</p>
            <h2 className="hero-title max-w-2xl text-5xl font-extrabold leading-[0.9] tracking-[-0.06em] text-white sm:text-8xl">
              Watch later.<br /><span>Keep forever.</span>
            </h2>
            <p className="mt-6 max-w-xl text-base leading-7 text-[#a9a7b1] sm:text-lg">
              Turn anime series into a personal offline library, without the clutter.
            </p>
          </div>
          <SearchBar
            value={query}
            onChange={setQuery}
            onSubmit={() => runSearch()}
            loading={searching}
            onClear={() => {
              setQuery("");
              setResults(null);
              setSearchError(null);
              setSearchedFor("");
            }}
          />
          <div className="hero-steps flex flex-wrap gap-x-8 gap-y-2 text-xs text-[#a9a7b1]">
            <span><strong className="text-white">01</strong> Search a title</span>
            <span><strong className="text-white">02</strong> Pick episodes</span>
            <span><strong className="text-white">03</strong> Read offline</span>
          </div>

          {searchError && (
            <div className="flex items-start gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-rose-200">
              <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium">Search failed</p>
                <p className="text-rose-300/80 mt-0.5">{searchError}</p>
              </div>
            </div>
          )}

          {searching && <ResultsSkeleton />}

          {!searching && results && results.length === 0 && (
            <EmptyResults query={searchedFor} />
          )}

          {results && results.length > 0 && (
            <div>
              <h2 className="mb-4 flex items-center gap-3 text-sm font-bold uppercase tracking-[0.16em] text-[#737a73]">
                <span className="h-2 w-2 rounded-full bg-[#ef6b43]" />
                Results for &ldquo;{searchedFor}&rdquo;
                <span className="mono rounded-full border border-[#1e2521]/15 px-2 py-0.5 text-[10px] font-medium text-[#737a73]">
                  {results.length}
                </span>
              </h2>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                {results.map((r) => (
                  <ResultCard
                    key={r.id}
                    item={r}
                    onClick={() => openAnime(r)}
                  />
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Episode Dashboard */}
        {selectedAnime && (
          <section className="reveal rounded-xs border border-[#1e2521]/15 bg-[#fbfaf7] p-5 shadow-[0_20px_60px_rgba(30,37,33,.08)] sm:p-7">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    setSelectedAnime(null);
                    setEpisodes(null);
                    setSelectedEpisodes(new Set());
                  }}
                    className="rounded-full border border-[#1e2521]/15 p-2 text-[#737a73] transition hover:border-[#ef6b43] hover:text-[#ef6b43]"
                  aria-label="Back to results"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <div>
                  <h2 className="text-lg font-extrabold tracking-tight text-[#1e2521]">
                    {selectedAnime.title}
                  </h2>
                  <p className="text-xs text-[#737a73]">
                    {episodesLoading
                      ? "Loading episodes…"
                      : episodes
                        ? `${episodes.length} episodes available`
                        : "Episode list"}
                  </p>
                </div>
              </div>

              {episodes && episodes.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="text"
                    value={episodeFilter}
                    onChange={(e) => setEpisodeFilter(e.target.value)}
                    placeholder="Filter…"
                    className="w-32 border-b border-[#1e2521]/20 bg-transparent px-1 py-1.5 text-sm text-[#1e2521] placeholder-[#737a73] focus:border-[#ef6b43] focus:outline-none"
                  />
                  <button
                    onClick={selectAll}
                    className="inline-flex items-center gap-1.5 border border-[#1e2521]/15 px-3 py-1.5 text-xs font-medium text-[#1e2521] transition hover:border-[#ef6b43] hover:text-[#ef6b43]"
                  >
                    <CheckSquare className="h-3.5 w-3.5" />
                    Select All
                  </button>
                  <button
                    onClick={clearSelection}
                    className="inline-flex items-center gap-1.5 border border-[#1e2521]/15 px-3 py-1.5 text-xs font-medium text-[#1e2521] transition hover:border-[#ef6b43] hover:text-[#ef6b43]"
                  >
                    <Square className="h-3.5 w-3.5" />
                    Deselect All
                  </button>
                  <button
                    onClick={downloadSelected}
                    disabled={selectedEpisodes.size === 0}
                    className="inline-flex items-center gap-1.5 bg-[#ef6b43] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#bd4c2e] disabled:cursor-not-allowed disabled:bg-[#d8d5ce] disabled:text-[#737a73]"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Download Selected ({selectedEpisodes.size})
                  </button>
                </div>
              )}
            </div>

            {episodesLoading && (
              <div className="flex items-center justify-center gap-2 py-12 text-slate-400">
                <Loader2 className="h-5 w-5 animate-spin" />
                Fetching episode list…
              </div>
            )}

            {episodesError && (
              <div className="flex flex-col gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-rose-200">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium">Failed to load episodes</p>
                    <p className="text-rose-300/80 mt-0.5">{episodesError}</p>
                  </div>
                </div>
                {(episodesErrorDetails || episodesErrorHint) && (
                  <details className="ml-8 text-xs text-rose-300/70">
                    <summary className="cursor-pointer hover:text-rose-200">
                      Show technical details
                    </summary>
                    <div className="mt-2 space-y-1 rounded bg-rose-950/40 p-2 font-mono">
                      {episodesErrorDetails && (
                        <p>
                          <span className="text-rose-400">details:</span>{" "}
                          {episodesErrorDetails}
                        </p>
                      )}
                      {episodesErrorHint && (
                        <p>
                          <span className="text-rose-400">hint:</span>{" "}
                          {episodesErrorHint}
                        </p>
                      )}
                    </div>
                  </details>
                )}
              </div>
            )}

            {episodes && episodes.length === 0 && !episodesLoading && (
              <div className="py-12 text-center text-slate-400">
                No episodes found for this title.
              </div>
            )}

            {episodes && episodes.length > 0 && (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                {filteredEpisodes.map((ep) => {
                  const checked = selectedEpisodes.has(ep.key);
                  return (
                    <button
                      key={ep.key}
                      onClick={() => toggleEpisode(ep.key)}
                      className={`group flex items-center gap-2 rounded-lg border px-3 py-2.5 text-left text-sm transition ${
                        checked
                          ? "border-[#ef6b43] bg-[#fce1d7] text-[#1e2521]"
                          : "border-[#1e2521]/15 bg-[#f4f1eb] text-[#737a73] hover:border-[#ef6b43] hover:bg-[#fffaf5]"
                      }`}
                    >
                      {checked ? (
                        <CheckSquare className="h-4 w-4 shrink-0 text-[#ef6b43]" />
                      ) : (
                        <Square className="h-4 w-4 shrink-0 text-[#a8aea7] group-hover:text-[#ef6b43]" />
                      )}
                      <span className="truncate font-medium">
                        {ep.number}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* Active Downloads Queue */}
        {downloadList.length > 0 && (
          <section id="library" className="reveal rounded-xs border border-[#1e2521]/15 bg-[#fbfaf7] p-5 shadow-[0_20px_60px_rgba(30,37,33,.08)] sm:p-7">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="flex items-center gap-3 text-sm font-bold uppercase tracking-[0.16em] text-[#737a73]">
                <ListChecks className="h-4 w-4 text-[#ef6b43]" />
                Active Downloads
                <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-medium text-slate-300">
                  {downloadList.length}
                </span>
              </h2>
              <button
                onClick={clearCompleted}
                  className="inline-flex items-center gap-1.5 border border-[#1e2521]/15 px-3 py-1.5 text-xs font-medium text-[#1e2521] transition hover:border-[#ef6b43] hover:text-[#ef6b43]"
              >
                <RefreshCcw className="h-3.5 w-3.5" />
                Clear Finished
              </button>
            </div>

            <div className="space-y-2">
              {downloadList.map((d) => (
                <DownloadRow
                  key={d.id}
                  item={d}
                  isActive={activeDownload === d.id}
                  onStart={() => startDownload(d.id)}
                  onRemove={() => removeDownload(d.id)}
                />
              ))}
            </div>
          </section>
        )}

        <Footer />
      </div>
    </main>
  );
}

// --- Subcomponents ---

function Header() {
  return (
    <header className="site-header relative z-10">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-5 sm:px-8">
        <div className="flex items-center gap-3">
          <div className="brand-mark grid h-9 w-9 place-items-center text-white">
            <Film className="h-4 w-4" />
          </div>
          <div>
            <h1 className="text-lg font-extrabold leading-tight tracking-[-0.04em] text-white">
              CHOLEY
            </h1>
            <p className="mono text-[9px] uppercase tracking-[0.14em] text-[#a9a7b1]">
              Anime downloader
            </p>
          </div>
        </div>
        <nav className="hidden items-center gap-7 text-xs font-semibold text-[#a9a7b1] sm:flex">
          <a href="#search" className="transition hover:text-white">How it works</a>
          <a href="#library" className="transition hover:text-white">My library</a>
          <a href="#search" className="header-cta">Open downloader <span aria-hidden="true">→</span></a>
        </nav>
      </div>
    </header>
  );
}

function SearchBar(props: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  onClear: () => void;
  loading: boolean;
}) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        props.onSubmit();
      }}
      className="search-module flex max-w-3xl gap-2 p-2 pl-4"
    >
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute left-1 top-1/2 h-5 w-5 -translate-y-1/2 text-[#ffd8cf]" />
        <input
          type="text"
          value={props.value}
          onChange={(e) => props.onChange(e.target.value)}
          placeholder='Search anime, e.g. "One Piece"'
          className="w-full bg-transparent py-3 pl-9 pr-10 text-base text-white placeholder-[#ffd8cf]/70 focus:outline-none sm:text-lg"
          autoFocus
        />
        {props.value && (
          <button
            type="button"
            onClick={props.onClear}
            className="absolute right-1 top-1/2 -translate-y-1/2 rounded-full p-1 text-[#ffd8cf] hover:bg-white/10 hover:text-white"
            aria-label="Clear"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      <button
        type="submit"
        disabled={props.loading || !props.value.trim()}
        className="search-submit inline-flex items-center gap-2 px-5 py-3 text-sm font-semibold text-[#1e2521] transition disabled:cursor-not-allowed disabled:bg-white/40 disabled:text-[#6f1b1d]"
      >
        {props.loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Search className="h-4 w-4" />
        )}
        Search
      </button>
    </form>
  );
}

function ResultCard(props: { item: SearchResult; onClick: () => void }) {
  const [imgError, setImgError] = useState(false);
  return (
    <button
      onClick={props.onClick}
      className="group overflow-hidden border border-[#1e2521]/15 bg-[#fbfaf7] text-left transition hover:-translate-y-1 hover:border-[#ef6b43] hover:shadow-[0_18px_35px_rgba(30,37,33,.12)]"
    >
      <div className="relative aspect-3/4 w-full overflow-hidden bg-slate-800">
        {props.item.image && !imgError ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={props.item.image}
            alt={props.item.title}
            onError={() => setImgError(true)}
            className="h-full w-full object-cover transition group-hover:scale-105"
            loading="lazy"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="grid h-full w-full place-items-center text-[#a8aea7]">
            <ImageOff className="h-10 w-10" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#1e2521]/70 via-transparent to-transparent" />
      </div>
      <div className="p-3">
        <h3 className="line-clamp-2 text-sm font-bold text-[#1e2521]">
          {props.item.title}
        </h3>
        <p className="mt-1 line-clamp-2 text-xs leading-5 text-[#737a73]">
          {props.item.description}
        </p>
      </div>
    </button>
  );
}

function ResultsSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className="overflow-hidden border border-[#1e2521]/10 bg-[#fbfaf7]"
        >
          <div className="aspect-[3/4] w-full animate-pulse bg-[#dfddd6]" />
          <div className="space-y-2 p-3">
            <div className="h-3 w-3/4 animate-pulse rounded bg-[#dfddd6]" />
            <div className="h-2 w-full animate-pulse rounded bg-[#e7e4dd]" />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyResults({ query }: { query: string }) {
  return (
    <div className="border border-[#1e2521]/15 bg-[#fbfaf7] p-8 text-center">
      <Search className="mx-auto mb-3 h-8 w-8 text-[#a8aea7]" />
      <p className="text-[#737a73]">
        No anime found for{" "}
        <span className="font-bold text-[#1e2521]">&ldquo;{query}&rdquo;</span>.
      </p>
      <p className="mt-1 text-xs text-[#92978f]">
        Try a different spelling or a shorter query.
      </p>
    </div>
  );
}

function DownloadRow(props: {
  item: DownloadItem;
  isActive: boolean;
  onStart: () => void;
  onRemove: () => void;
}) {
  const { item } = props;
  const canStart =
    item.status === "queued" || item.status === "error" || item.status === "cancelled";

  return (
    <div className="border border-[#1e2521]/15 bg-[#f4f1eb] p-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-[#1e2521]">
            <span className="text-[#737a73]">{item.animeTitle}</span>
            <span className="mx-2 text-[#a8aea7]">·</span>
            <span>{item.episode.number}</span>
          </p>
          <p className="mt-0.5 truncate text-xs text-[#737a73]">
            {item.message ?? "Waiting…"}
          </p>
        </div>

        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${statusBadge(
            item.status,
          )}`}
        >
          {item.status === "resolving" || item.status === "downloading" ? (
            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
          ) : item.status === "done" ? (
            <CheckSquare className="mr-1 h-3 w-3" />
          ) : item.status === "error" ? (
            <AlertTriangle className="mr-1 h-3 w-3" />
          ) : null}
          {item.status}
        </span>

        <div className="flex items-center gap-1">
          {canStart && (
            <button
              onClick={props.onStart}
              className="inline-flex items-center gap-1 border border-[#1e2521]/15 bg-[#fbfaf7] px-2.5 py-1.5 text-xs font-medium text-[#1e2521] transition hover:border-[#ef6b43] hover:text-[#ef6b43]"
              aria-label="Start download"
            >
              <Play className="h-3 w-3" />
              Start
            </button>
          )}
          {!canStart && item.status === "downloading" && (
            <button
              disabled
              className="inline-flex items-center gap-1 border border-[#1e2521]/10 bg-[#e7e4dd] px-2.5 py-1.5 text-xs font-medium text-[#92978f]"
            >
              <Pause className="h-3 w-3" />
              In progress
            </button>
          )}
          <button
            onClick={props.onRemove}
            className="rounded-full p-1.5 text-[#92978f] hover:bg-[#fce1d7] hover:text-[#bd4c2e]"
            aria-label="Remove from queue"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Progress bar */}
      {(item.status === "resolving" ||
        item.status === "downloading" ||
        item.status === "done") && (
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[#d8d5ce]">
          <div
            className={`h-full transition-all duration-300 ${
              item.status === "done"
                ? "bg-emerald-500"
                : "bg-[#ef6b43]"
            }`}
            style={{
              width:
                item.status === "done"
                  ? "100%"
                  : item.status === "downloading"
                    ? "60%"
                    : "15%",
            }}
          />
        </div>
      )}
    </div>
  );
}

function Footer() {
  return (
    <footer className="border-t border-[#1e2521]/15 pt-8 text-center text-xs text-[#737a73]">
      <p>
      </p>
    </footer>
  );
}
