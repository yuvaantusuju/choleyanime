import { NextRequest } from "next/server";
import {
  absoluteUrl,
  ANIMEHEAVEN_HEADERS,
  fetchHtml,
  parseHtml,
  type Episode,
} from "@/lib/animeheaven";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// Vercel-specific: per-route segment config. On Pro this lets us go beyond
// the 10s default. Free plan still caps at 10s.
export const maxDuration = 60;
export const preferredRegion = ["iad1", "hnd1", "fra1"];

/**
 * Extracts the episode list from an animeheaven.me show page.
 *
 * Two ways to call it:
 *   1. `?url=https://animeheaven.me/anime.php?HASH`  (full URL)
 *   2. `?id=HASH`  (shorter form — server builds the URL)
 *
 * Multiple parsing strategies are tried in order of specificity because
 * the site has shipped several layouts over time and we want to remain
 * robust against future tweaks.
 *
 *  1. `a[id][href*='gate.php']` — current layout (each `<a>` has a hash
 *     `id` that doubles as the `key` cookie for gate.php).
 *  2. `a[onclick*='gatea(']` — same as above but matched by the
 *     JavaScript handler instead of href.
 *  3. `.trackep, .trackep0` containers — last-resort scan of any element
 *     that looks like an episode row.
 *
 * The route also retries the upstream fetch with a fallback strategy if
 * the first attempt fails — this helps when Vercel's egress IPs are
 * being rate-limited but a second attempt with a slightly different
 * request shape works.
 */
export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("url")?.trim();
  const id = req.nextUrl.searchParams.get("id")?.trim();

  if (!raw && !id) {
    return Response.json(
      { error: "Missing `url` or `id` query parameter." },
      { status: 400 },
    );
  }

  // If the client only sent `id`, normalize it. The id may arrive in any
  // of these forms:
  //   - "wn1fk"                       (just the hash)
  //   - "/anime.php?wn1fk"            (from the search route's raw href)
  //   - "anime.php?wn1fk"             (relative)
  //   - "https://animeheaven.me/anime.php?wn1fk"  (already absolute)
  // We need a clean `https://animeheaven.me/anime.php?HASH` in all cases.
  let showUrl: string;
  if (raw) {
    showUrl = absoluteUrl(raw) ?? raw;
  } else {
    const cleaned = (id ?? "")
      .replace(/^https?:\/\/[^/]+/i, "")  // strip scheme + host
      .replace(/^\/+/, "")                 // strip leading slashes
      .replace(/^anime\.php\?/, "")        // strip leading "anime.php?"
      .trim();
    showUrl = `https://animeheaven.me/anime.php?${encodeURIComponent(cleaned)}`;
  }

  // --- Fetch with retry ---
  const { html, fetchAttempt, fetchError } = await fetchWithRetry(showUrl);

  if (!html) {
    return Response.json(
      {
        error: "Failed to fetch the show page from animeheaven.me.",
        details: fetchError ?? "Unknown upstream error",
        showUrl,
        hint:
          "The upstream may be rate-limiting, down, or blocking Vercel's egress IPs. " +
          "Try again in a few minutes, or deploy to a different region.",
        attempts: fetchAttempt,
      },
      { status: 502 },
    );
  }

  // Sanity check: the response should contain episode markers
  if (!/[gatea|trackep|gate\.php]/i.test(html)) {
    return Response.json(
      {
        error: "Upstream returned a page with no episode markers.",
        details:
          "The HTML fetched from animeheaven.me does not contain the expected episode anchors. " +
          "The site may be serving a CAPTCHA, maintenance page, or different layout.",
        showUrl,
        upstreamSize: html.length,
        upstreamSnippet: html.slice(0, 500),
        attempts: fetchAttempt,
        hint:
          "Open the showUrl in a browser to see what the site is currently serving.",
      },
      { status: 502 },
    );
  }

  const $ = parseHtml(html);

  // --- Show title ---
  const showTitle =
    $(".infotitle").first().text().trim() ||
    $(".linetitle.c").first().text().trim() ||
    $("h1").first().text().trim() ||
    $("title").first().text().trim() ||
    "Unknown Show";

  // --- Episode count from the info bar ---
  let totalEpisodes: number | null = null;
  const epInfoText = $(".infoyear").first().text();
  const m = epInfoText.match(/Episodes:\s*(\d+)/i);
  if (m) totalEpisodes = parseInt(m[1], 10);

  // --- Parse episode rows ---
  const { episodes, parser } = extractEpisodes($, showUrl);

  // De-duplicate by key
  const seen = new Set<string>();
  const unique = episodes.filter((e) => {
    if (seen.has(e.key)) return false;
    seen.add(e.key);
    return true;
  });

  // Diagnostic payload
  const body = JSON.stringify({
    showTitle,
    showUrl,
    totalEpisodes,
    count: unique.length,
    parser,
    upstreamSize: html.length,
    attempts: fetchAttempt,
    episodes: unique,
  });

  return new Response(body, {
    status: 200,
    headers: {
      "content-type": "application/json",
      "cache-control": "public, max-age=300, s-maxage=300",
      "x-anime-scraper": "episodes",
      "x-anime-scraper-show": showTitle.slice(0, 100),
      "x-anime-scraper-count": String(unique.length),
      "x-anime-scraper-parser": parser,
      "x-anime-scraper-attempts": String(fetchAttempt),
    },
  });
}

async function fetchWithRetry(
  url: string,
): Promise<{ html: string | null; fetchAttempt: number; fetchError: string | null }> {
  // Attempt 1: full browser-like headers
  try {
    const html = await fetchHtml(url, { timeoutMs: 25_000 });
    if (html && html.length > 1000) {
      return { html, fetchAttempt: 1, fetchError: null };
    }
  } catch (err) {
    // fall through to attempt 2
    const firstError = err instanceof Error ? err.message : "Unknown error";
    // Attempt 2: minimal headers, longer timeout
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": ANIMEHEAVEN_HEADERS["User-Agent"],
          Accept: ANIMEHEAVEN_HEADERS.Accept,
        },
        cache: "no-store",
        signal: AbortSignal.timeout(30_000),
      });
      if (!res.ok) {
        return { html: null, fetchAttempt: 2, fetchError: `${firstError}; retry got ${res.status}` };
      }
      const html = await res.text();
      if (html && html.length > 1000) {
        return { html, fetchAttempt: 2, fetchError: null };
      }
      return { html: null, fetchAttempt: 2, fetchError: `${firstError}; retry returned empty body` };
    } catch (err2) {
      return {
        html: null,
        fetchAttempt: 2,
        fetchError: `${firstError}; retry: ${err2 instanceof Error ? err2.message : "unknown"}`,
      };
    }
  }
  return { html: null, fetchAttempt: 1, fetchError: "Empty response from upstream" };
}

function detectParserUsed($: ReturnType<typeof parseHtml>): string {
  if ($("a[id][href*='gate.php']").length > 0) return "a[id][href*='gate.php']";
  if ($("a[onclick*='gatea(']").length > 0) return "a[onclick*='gatea(']";
  if ($(".trackep, .trackep0").length > 0) return ".trackep, .trackep0";
  return "none";
}

function extractEpisodes(
  $: ReturnType<typeof parseHtml>,
  showUrl: string,
): { episodes: Episode[]; parser: string } {
  const episodes: Episode[] = [];
  const seen = new Set<string>();

  const push = (key: string | null | undefined, number: string | null) => {
    if (!key) return;
    if (seen.has(key)) return;
    seen.add(key);
    const cleaned = (number ?? "").replace(/\s+/g, " ").trim();
    episodes.push({
      id: key,
      key,
      number: cleaned || `Episode ${episodes.length + 1}`,
      title: cleaned || `Episode ${episodes.length + 1}`,
      showUrl,
    });
  };

  // Strategy 1: anchor with id and gate.php href
  $("a[id][href*='gate.php']").each((_, el) => {
    const $el = $(el);
    const key = $el.attr("id")?.trim() || null;
    const number = $el.find(".watch2").first().text().trim() || null;
    push(key, number);
  });

  if (episodes.length > 0) {
    return { episodes, parser: "a[id][href*='gate.php']" };
  }

  // Strategy 2: anchor with onclick="gatea(...)"
  $("a[onclick*='gatea(']").each((_, el) => {
    const $el = $(el);
    const onclick = $el.attr("onclick") ?? "";
    const m = onclick.match(/gatea\(\s*["']([a-f0-9]+)["']\s*\)/i);
    const key = m?.[1] ?? $el.attr("id")?.trim() ?? null;
    const number =
      $el.find(".watch2").first().text().trim() ||
      $el.find(".watch1").first().text().trim() ||
      null;
    push(key, number);
  });

  if (episodes.length > 0) {
    return { episodes, parser: "a[onclick*='gatea(']" };
  }

  // Strategy 3: scan .trackep / .trackep0 containers directly
  $(".trackep, .trackep0").each((_, el) => {
    const $el = $(el);
    const $parent = $el.parent("a[id]").first();
    let key = $parent.attr("id")?.trim() || null;
    if (!key) {
      const onclick = $parent.attr("onclick") ?? "";
      const m2 = onclick.match(/gatea\(\s*["']([a-f0-9]+)["']\s*\)/i);
      key = m2?.[1] ?? null;
    }
    const number = $el.find(".watch2").first().text().trim() || null;
    push(key, number);
  });

  return { episodes, parser: ".trackep, .trackep0" };
}
