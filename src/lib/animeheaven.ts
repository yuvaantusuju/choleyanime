import * as cheerio from "cheerio";

const BASE_URL = "https://animeheaven.me";

export const ANIMEHEAVEN_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "Referer": "https://animeheaven.me/",
};

export function absoluteUrl(href: string | undefined | null, base = BASE_URL): string | null {
  if (!href) return null;
  try {
    return new URL(href, base).toString();
  } catch {
    return null;
  }
}

export interface FetchHtmlOptions {
  /** Optional extra cookies (e.g. `key=<hash>` for gate.php) */
  cookies?: Record<string, string>;
  /** Override the Referer header for a specific URL */
  referer?: string;
}

export async function fetchHtml(url: string, opts: FetchHtmlOptions = {}): Promise<string> {
  const headers: Record<string, string> = { ...ANIMEHEAVEN_HEADERS };
  if (opts.referer) headers.Referer = opts.referer;
  if (opts.cookies) {
    const cookieHeader = Object.entries(opts.cookies)
      .map(([k, v]) => `${k}=${v}`)
      .join("; ");
    headers.Cookie = cookieHeader;
  }

  const res = await fetch(url, {
    headers,
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`);
  }
  return res.text();
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
