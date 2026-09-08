import { NextRequest, NextResponse } from "next/server";
import {
  absoluteUrl,
  DEFAULT_HEADERS,
  extractShowHash,
  fetchHtml,
  parseHtml,
  type SearchResult,
} from "@/lib/animeheaven";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Episode = {
  index: number;
  label: string;
  number: number | null;
  href: string;
  gateHref: string;
  fullUrl: string;
  hash: string | null;
};

function extractEpisodeNumber(text: string): number | null {
  // Try to pull the first number from common patterns like "Episode 12", "12", "EP 12", etc.
  const match = text.match(/(\d+)/);
  if (!match) return null;
  const n = parseInt(match[1], 10);
  return Number.isFinite(n) ? n : null;
}

/**
 * Convenience: episodes route can also accept a show hash directly. This is
 * useful when the UI has selected a result from /api/search and only stored
 * the `id` (the hash) — we can rebuild the canonical show URL on the server.
 */
function resolveShowUrl(input: string): string | null {
  if (absoluteUrl(input)) return absoluteUrl(input);
  // If it looks like just a hash, try to build a show URL.
  if (/^[a-zA-Z0-9]+$/.test(input)) {
    return `https://animeheaven.me/anime.php?${input}`;
  }
  return null;
}

/**
 * Extract the per-episode hash from an animeheaven <a> element. The gate
 * URL is built client-side via the inline `gateh('HASH')` JavaScript
 * handler, so the `href` is just `gate.php` and the hash is hidden in the
 * `onmouseover` / `onclick` / `id` attributes.
 *
 * Returns the hash string or null when it can't be found.
 */
function extractEpisodeHash($a: ReturnType<ReturnType<typeof parseHtml>>): string | null {
  // 1. Try onmouseover="gateh('HASH')" or onclick="gatea('HASH')"
  const onmouseover = $a.attr("onmouseover") ?? "";
  const onclick = $a.attr("onclick") ?? "";
  for (const attr of [onmouseover, onclick]) {
    const m = attr.match(/(?:gateh|gatea)\s*\(\s*['"]([a-zA-Z0-9]+)['"]/);
    if (m) return m[1];
  }
  // 2. Try the element id (sometimes the hash is the id directly)
  const id = $a.attr("id") ?? "";
  if (/^[a-zA-Z0-9]{16,}$/.test(id)) return id;
  // 3. Try a real href like "gate.php?HASH"
  const href = $a.attr("href") ?? "";
  if (href && href !== "gate.php" && !href.endsWith("/gate.php")) {
    try {
      const u = new URL(href, "https://animeheaven.me/");
      for (const v of u.searchParams.values()) {
        if (/^[a-zA-Z0-9]{8,}$/.test(v)) return v;
      }
    } catch {
      /* ignore */
    }
  }
  return null;
}

function buildGateUrl(hash: string, baseUrl: URL): string {
  // The upstream script writes a query-string hash onto the page (e.g.
  // `gate.php?HASH`) when the user clicks the link. The hash is also the
  // element id on the show page. Construct the canonical gate URL.
  return `${baseUrl.origin}/gate.php?${hash}`;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const target = searchParams.get("url");
  const id = searchParams.get("id");

  if (!target && !id) {
    return NextResponse.json(
      { error: "Missing required 'url' or 'id' query parameter." },
      { status: 400 }
    );
  }

  const source = target
    ? resolveShowUrl(target)
    : resolveShowUrl(`https://animeheaven.me/anime.php?${id}`);

  if (!source) {
    return NextResponse.json(
      { error: "Invalid URL or id provided." },
      { status: 400 }
    );
  }

  let baseUrl: URL;
  try {
    baseUrl = new URL(source);
  } catch {
    return NextResponse.json(
      { error: "Invalid URL provided." },
      { status: 400 }
    );
  }

  if (!/^https?:$/.test(baseUrl.protocol)) {
    return NextResponse.json(
      { error: "Only http(s) URLs are supported." },
      { status: 400 }
    );
  }

  try {
    const html = await fetchHtml(baseUrl.toString(), {
      timeoutMs: 15_000,
      headers: { ...DEFAULT_HEADERS, Referer: "https://animeheaven.me/" },
    });
    const $ = parseHtml(html);

    // The show title lives in a few possible places — the page <title>,
    // an <meta property="og:title"> tag, or sometimes an <h1>. We deliberately
    // avoid `div.linetitle2.c2` because on the current animeheaven layout
    // that element wraps the entire episode list, not the title.
    let showTitle = "";
    const ogTitle = $('meta[property="og:title"]').attr("content");
    if (ogTitle) showTitle = ogTitle.trim();
    if (!showTitle) {
      const pageTitle = $("title").first().text().trim();
      showTitle = pageTitle
        .replace(/\s*\|\s*AnimeHeaven.*$/i, "")
        .replace(/\s*-\s*AnimeHeaven.*$/i, "")
        .replace(/\s+Anime\s*$/i, "")
        .trim();
    }
    if (!showTitle) {
      const h1 = $("h1").first().text().trim();
      if (h1) showTitle = h1;
    }
    if (!showTitle) showTitle = "Unknown Show";

    const episodes: Episode[] = [];
    const seen = new Set<string>();

    // -----------------------------------------------------------------
    // Strategy 1: find every <a> on the page that has a `gateh(...)` /
    // `gatea(...)` handler or wraps a `div.trackep` container. These are
    // the individual episode entries on the show page.
    // -----------------------------------------------------------------
    const $anchors = $("a").filter((_i, el) => {
      const $a = $(el);
      const hasGateHandler =
        /gate[ah]\s*\(/.test($a.attr("onmouseover") ?? "") ||
        /gate[ah]\s*\(/.test($a.attr("onclick") ?? "") ||
        $a.find("div[class*='trackep']").length > 0;
      return hasGateHandler;
    });

    $anchors.each((_i, el) => {
      const $a = $(el);

      // The hash is the actual gate key for this episode.
      const hash = extractEpisodeHash($a);
      if (!hash) return;

      const fullUrl = buildGateUrl(hash, baseUrl);
      if (seen.has(fullUrl)) return;
      seen.add(fullUrl);

      // The episode number lives in the FIRST <div class="watch2"> inside.
      // animeheaven splits the title and the number into two child divs:
      //   <div class="watch1">Episode</div>
      //   <div class="watch2">1177</div>
      //   <div class="watch1">1 d ago</div>
      // so the number is the text of the inner-most watch2 div.
      const $innerWatch2 = $a
        .find("div[class*='trackep'] div[class*='watch2']")
        .last();
      let numberText = $innerWatch2.text().trim();

      // Some pages use a single div for the whole "Episode 1177" string.
      if (!numberText) {
        const $anyWatch2 = $a.find("div[class*='watch2']").last();
        numberText = $anyWatch2.text().trim();
      }

      // Build the label.
      const num = extractEpisodeNumber(numberText);
      const label = numberText
        ? `Episode ${num ?? episodes.length + 1}`
        : `Episode ${episodes.length + 1}`;

      episodes.push({
        index: episodes.length + 1,
        label,
        number: num,
        href: hash,
        gateHref: fullUrl,
        fullUrl,
        hash,
      });
    });

    // -----------------------------------------------------------------
    // Strategy 2: fallback — if the page uses a different markup, scan
    // for any anchor that points at gate.php with a real ?hash= payload.
    // -----------------------------------------------------------------
    if (episodes.length === 0) {
      $("a[href*='gate.php?']").each((_i, el) => {
        const $a = $(el);
        const rawHref = $a.attr("href") ?? "";
        if (!rawHref) return;
        const fullUrl = absoluteUrl(rawHref, baseUrl.toString());
        if (!fullUrl) return;
        if (seen.has(fullUrl)) return;
        seen.add(fullUrl);

        const text = $a.text().replace(/\s+/g, " ").trim();
        const num = extractEpisodeNumber(text);
        episodes.push({
          index: episodes.length + 1,
          label: text || `Episode ${episodes.length + 1}`,
          number: num,
          href: rawHref,
          gateHref: fullUrl,
          fullUrl,
          hash: null,
        });
      });
    }

    // Also surface the show id so the UI can keep state across navigation.
    const showId =
      extractShowHash(target) ?? extractShowHash(source) ?? id ?? null;

    return NextResponse.json({
      ok: true,
      source: baseUrl.toString(),
      id: showId,
      title: showTitle,
      count: episodes.length,
      episodes,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown scraping error";
    return NextResponse.json(
      { error: `Failed to scrape episodes: ${message}` },
      { status: 502 }
    );
  }
}

// Re-export the SearchResult type for client convenience (typed in the lib).
export type { SearchResult };
