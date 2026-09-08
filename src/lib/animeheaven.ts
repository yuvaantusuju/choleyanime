import * as cheerio from "cheerio";

type CheerioAPI = ReturnType<typeof cheerio.load>;

/**
 * Shared helpers for working with animeheaven.me HTML.
 *
 * Keeping these in one place means the search, episode and resolve-link
 * routes all use the same browser-like fetch headers, the same URL
 * absolutization rules, and the same show-hash extraction logic.
 */

export type SearchResult = {
  id: string;
  title: string;
  url: string;
  image: string | null;
  description: string;
  episodeCount: number | null;
};

export type FetchOptions = {
  timeoutMs?: number;
  headers?: HeadersInit;
};

/**
 * Browser-like request headers. The upstream CDN is somewhat picky about
 * `Referer` (for the .mp4 proxy) and User-Agent, so keep these consistent
 * across routes.
 */
export const DEFAULT_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
    "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif," +
    "image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "Cache-Control": "no-cache",
  Pragma: "no-cache",
};

export const REFERER_HEADERS: Record<string, string> = {
  ...DEFAULT_HEADERS,
  Referer: "https://animeheaven.me/",
};

/**
 * Fetch a URL and return its body as text. Supports an optional timeout
 * implemented via AbortController so we never hang indefinitely.
 */
export async function fetchHtml(
  url: string,
  options: FetchOptions = {},
): Promise<string> {
  const { timeoutMs = 15_000, headers = DEFAULT_HEADERS } = options;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers,
      redirect: "follow",
      cache: "no-store",
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`Upstream responded with ${res.status} ${res.statusText}`);
    }
    return res.text();
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Parse a raw HTML string into a Cheerio instance. Wrapped here so callers
 * don't need to import cheerio directly.
 */
export function parseHtml(html: string): CheerioAPI {
  return cheerio.load(html);
}

/**
 * Resolve a possibly-relative href against a base URL. Returns null when the
 * input is empty or the resulting URL is not a parseable http(s) URL.
 */
export function absoluteUrl(
  href: string | null | undefined,
  base = "https://animeheaven.me/",
): string | null {
  if (!href) return null;
  try {
    const resolved = new URL(href, base);
    if (!/^https?:$/.test(resolved.protocol)) return null;
    return resolved.toString();
  } catch {
    return null;
  }
}

/**
 * Extract the show hash (the `?HASH` query string) from an animeheaven
 * show URL such as `https://animeheaven.me/anime.php?abc123`.
 *
 * Returns the hash string or null when it can't be found.
 */
export function extractShowHash(input: string | null | undefined): string | null {
  if (!input) return null;
  try {
    const u = new URL(input, "https://animeheaven.me/");
    if (!u.pathname.toLowerCase().includes("anime.php")) return null;
    // animeheaven show URLs use the bare form `?HASH` (no `=`), so the URL
    // parser exposes the hash as a key with an empty value. Read it from
    // the raw search string first, then fall back to searchParams values.
    const search = u.search.replace(/^\?/, "");
    if (search) {
      const raw = search.split("&")[0] ?? "";
      const eq = raw.indexOf("=");
      if (eq === -1) {
        // `?HASH` style — raw is the hash itself.
        if (raw) return raw;
      } else {
        const value = raw.slice(eq + 1);
        if (value) return value;
      }
    }
    for (const value of u.searchParams.values()) {
      if (value) return value;
    }
    // Fallback: last non-empty path segment (e.g. /anime/abc123).
    const parts = u.pathname.split("/").filter(Boolean);
    if (parts.length > 0) return parts[parts.length - 1];
    return null;
  } catch {
    return null;
  }
}
