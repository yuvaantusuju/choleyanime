"use client";

import { useCallback, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  Film,
  Loader2,
  Search as SearchIcon,
  Sparkles,
  X,
} from "lucide-react";

type SearchResult = {
  id: string;
  title: string;
  url: string;
  image: string | null;
  description: string;
  episodeCount: number | null;
};

type SearchResponse = {
  query: string;
  source: string;
  count: number;
  note: string | null;
  results: SearchResult[];
};

type Props = {
  onSelect: (result: SearchResult) => void;
};

export function SearchPanel({ onSelect }: Props) {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<SearchResponse | null>(null);
  const [recent, setRecent] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];

    try {
      const raw = localStorage.getItem("choleyanime-recent");
      if (!raw) return [];

      const parsed = JSON.parse(raw) as unknown;
      return Array.isArray(parsed)
        ? parsed.filter((x): x is string => typeof x === "string")
        : [];
    } catch {
      return [];
    }
  });
  const inputRef = useRef<HTMLInputElement | null>(null);

  const persistRecent = useCallback((q: string) => {
    setRecent((prev) => {
      const next = [q, ...prev.filter((x) => x.toLowerCase() !== q.toLowerCase())].slice(0, 6);
      try {
        localStorage.setItem("choleyanime-recent", JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const runSearch = useCallback(
    async (q: string) => {
      const trimmed = q.trim();
      if (!trimmed) return;
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/search?q=${encodeURIComponent(trimmed)}`,
          { cache: "no-store" },
        );
        const data: SearchResponse | { error: string } = await res.json();
        if (!res.ok || "error" in data) {
          const message =
            "error" in data
              ? data.error
              : `Request failed with status ${res.status}`;
          setError(message);
          setResponse(null);
          return;
        }
        setResponse(data);
        persistRecent(trimmed);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Unknown error while searching.";
        setError(message);
      } finally {
        setLoading(false);
      }
    },
    [persistRecent],
  );

  const handleSubmit = useCallback(
    (e?: React.FormEvent) => {
      e?.preventDefault();
      void runSearch(query);
    },
    [query, runSearch],
  );

  const handleSelect = useCallback(
    (r: SearchResult) => {
      onSelect(r);
    },
    [onSelect],
  );

  return (
    <div className="rounded-3xl border rule bg-(--surface) p-4 sm:p-6">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <label htmlFor="anime-name" className="eyebrow">
            Anime title
          </label>
          <span className="tag hidden sm:inline-flex">
            <Sparkles className="h-3.5 w-3.5" /> Powered by CholeyGang.
          </span>
        </div>
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-(--ink-soft)" />
          <input
            id="anime-name"
            ref={inputRef}
            type="search"
            inputMode="search"
            spellCheck={false}
            autoComplete="off"
            placeholder='Enter a title'
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="input-field"
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                inputRef.current?.focus();
              }}
              className="absolute right-3 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full text-(--ink-soft) hover:bg-(--paper-2) hover:text-(--ink)"
              aria-label="Clear"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="btn-pill btn-primary"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Searching
              </>
            ) : (
              <>
                <SearchIcon className="h-4 w-4" /> Search
              </>
            )}
          </button>
          {recent.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] uppercase tracking-[0.22em] text-(--ink-soft)">
                Recent:
              </span>
              {recent.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => {
                    setQuery(q);
                    void runSearch(q);
                  }}
                  className="rounded-full border rule bg-(--paper-2) px-2.5 py-1 text-[11px] text-(--ink-soft) transition hover:border-(--ink) hover:text-(--ink)"
                >
                  {q}
                </button>
              ))}
            </div>
          )}
        </div>
      </form>

      {error && (
        <div
          className="mt-4 flex items-start gap-2 rounded-2xl border p-3 text-sm"
          style={{
            borderColor:
              "color-mix(in oklab, var(--error) 40%, transparent)",
            background: "var(--error-soft)",
            color: "var(--error)",
          }}
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Initial / empty state */}
      {!response && !loading && !error && (
        <div className="mt-6 rounded-2xl border border-dashed rule bg-(--paper) p-6 text-center">
          <span className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-(--paper-2)">
            <Film className="h-4 w-4 text-(--ink-soft)" />
          </span>
          <p className="font-display mt-3 text-xl">
            Type a title to <em>begin</em>
          </p>
          <p className="mt-1 text-xs text-(--ink-soft)">
            Try the name in English or romaji — the search will return matching
            shows with cover art and direct links.
          </p>
        </div>
      )}

      {/* Results */}
      {response && (
        <div className="mt-6 animate-fade-in-up">
          <div className="flex items-center justify-between">
            <p className="eyebrow">
              {response.count} result{response.count === 1 ? "" : "s"}
            </p>
            {response.note && (
              <p
                className="text-[10px] text-(--ink-faint)"
                title={response.note}
              >
                {response.note}
              </p>
            )}
          </div>

          {response.count === 0 ? (
            <p className="mt-4 rounded-2xl border rule bg-(--paper-2) p-6 text-center text-sm text-[color:var(--ink-soft)]">
              No shows matched “{response.query}”. Try a different spelling.
            </p>
          ) : (
            <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {response.results.map((r) => (
                <li key={r.url}>
                  <button
                    type="button"
                    onClick={() => handleSelect(r)}
                    className="group flex w-full flex-col gap-2 overflow-hidden rounded-2xl border rule bg-[color:var(--paper)] text-left transition hover:-translate-y-0.5 hover:border-[color:var(--ink)]"
                  >
                    <div className="relative aspect-[3/4] w-full overflow-hidden bg-[color:var(--paper-2)]">
                      {r.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={r.image}
                          alt={r.title}
                          loading="lazy"
                          className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                          onError={(e) => {
                            // Hide the broken image and reveal the fallback
                            (e.target as HTMLImageElement).style.display = "none";
                          }}
                        />
                      ) : (
                        <div className="grid h-full w-full place-items-center">
                          <Film className="h-8 w-8 text-[color:var(--ink-faint)]" />
                        </div>
                      )}
                    </div>
                    <div className="flex flex-1 flex-col gap-1 p-3">
                      <p className="font-display line-clamp-2 text-sm leading-snug">
                        {r.title}
                      </p>
                      <p className="mt-auto inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.18em] text-[color:var(--accent)]">
                        Open episodes
                        <ArrowRight className="h-3 w-3" />
                      </p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
