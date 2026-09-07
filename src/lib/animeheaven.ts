import * as cheerio from "cheerio";

const BASE_URL = "https://animeheaven.me";

/**
 * Browser-like headers to avoid basic upstream bot blocks.
 * Tested against the live site on 2026+.
 */
export const ANIMEHEAVEN_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  Referer: "https://animeheaven.me/",
};

export const DEFAULT_FETCH_TIMEOUT_MS = 20_000;

export function absoluteUrl(
  href: string | undefined | null,
  base = BASE_URL,
): string | null {
  if (!href) return null;
  try {
    return new URL(href, base).toString();
  } catch {
    return null;
  }
}

/**
 * Extract the per-show hash from any of the URL forms used by the site:
 *   "wn1fk"                          → "wn1fk"
 *   "/anime.php?wn1fk"               → "wn1fk"
 *   "anime.php?wn1fk"                → "wn1fk"
 *   "https://animeheaven.me/anime.php?wn1fk"  → "wn1fk"
 *   "https://animeheaven.me/anime.php?wn1fk&foo=bar" → "wn1fk"
 */
export function extractShowHash(input: string | undefined | null): string | null {
  if (!input) return null;
  // Strip scheme + host
  let s = input.replace(/^https?:\/\/[^/]+/i, "");
  // Strip leading slashes
  s = s.replace(/^\/+/, "");
  // Strip leading "anime.php?" or "anime.php"
  s = s.replace(/^anime\.php\??/i, "");
  // Now `s` should be the hash, possibly with extra query params
  // Take the first `key=value` pair or just the leading string
  const m = s.match(/^([^&?#]+)/);
  const candidate = m?.[1] ?? s;
  // Sanity: hashes are typically short alphanumeric
  if (!/^[A-Za-z0-9]+$/.test(candidate)) return null;
  return candidate;
}

export interface FetchHtmlOptions {
  /** Optional extra cookies (e.g. `key=<hash>` for gate.php) */
  cookies?: Record<string, string>;
  /** Override the Referer header for a specific URL */
  referer?: string;
  /** Per-request timeout in ms. Defaults to DEFAULT_FETCH_TIMEOUT_MS. */
  timeoutMs?: number;
  /** Optional signal to abort from the caller. */
  signal?: AbortSignal;
}

export async function fetchHtml(
  url: string,
  opts: FetchHtmlOptions = {},
): Promise<string> {
  const headers: Record<string, string> = { ...ANIMEHEAVEN_HEADERS };
  if (opts.referer) headers.Referer = opts.referer;
  if (opts.cookies) {
    const cookieHeader = Object.entries(opts.cookies)
      .map(([k, v]) => `${k}=${v}`)
      .join("; ");
    headers.Cookie = cookieHeader;
  }

  const controller = new AbortController();
  const timeoutMs = opts.timeoutMs ?? DEFAULT_FETCH_TIMEOUT_MS;
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  // Chain any caller-provided signal
  if (opts.signal) {
    if (opts.signal.aborted) controller.abort();
    else opts.signal.addEventListener("abort", () => controller.abort());
  }

  try {
    const res = await fetch(url, {
      headers,
      cache: "no-store",
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(
        `Upstream returned ${res.status} ${res.statusText} for ${url}`,
      );
    }
    return await res.text();
  } catch (err) {
    if ((err as { name?: string })?.name === "AbortError") {
      throw new Error(
        `Request to ${url} timed out after ${timeoutMs}ms.`,
      );
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export function parseHtml(html: string) {
  return cheerio.load(html);
}

export interface SearchResult {
  id: string;
  title: string;
  url: string;
  image: string | null;
  description: string;
  episodeCount: number | null;
}

export interface Episode {
  /** The hash id that is also the cookie `key` value for gate.php */
  key: string;
  number: string;
  title: string;
  /** Stable identifier — equal to the `key` */
  id: string;
  showUrl: string;
}

export interface ResolvedLink {
  mp4Url: string;
  /** All candidate mirrors in order of preference */
  mirrors: string[];
}
