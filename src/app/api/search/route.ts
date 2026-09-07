import { NextRequest } from "next/server";
import {
  absoluteUrl,
  fetchHtml,
  parseHtml,
  type SearchResult,
} from "@/lib/animeheaven";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Search animeheaven.me.
 *
 * Strategy:
 *   1. Try the lightweight `fastsearch.php?xhr=1` endpoint first (it powers
 *      the site's own search-as-you-type and is much faster / smaller).
 *   2. Fall back to the full `search.php?s=...` page if the fast endpoint
 *      returns nothing.
 *
 * Each `fastitem` looks like:
 *   <a class='ac' href='/anime.php?HASH'>
 *     <div class='fastitem bc1 ac'>
 *       <div class='fastimg'><img class='coverimg' src='/image.php?...'></div>
 *       <div class='fastname'>Title</div>
 *     </div>
 *   </a>
 */
export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get("q")?.trim();

  if (!query) {
    return Response.json(
      { error: "Missing search query parameter `q`." },
      { status: 400 },
    );
  }

  const encoded = encodeURIComponent(query);
  const fastUrl = `https://animeheaven.me/fastsearch.php?xhr=1&s=${encoded}`;
  const fullUrl = `https://animeheaven.me/search.php?s=${encoded}`;

  const results: SearchResult[] = [];
  let source = fastUrl;
  let note: string | null = null;

  // --- 1. Try the fast XHR endpoint first ---
  try {
    const html = await fetchHtml(fastUrl, { timeoutMs: 10_000 });
    if (html && html.trim().length > 0) {
      const $ = parseHtml(html);
      $("a[href*='anime.php']").each((_, el) => {
        const $el = $(el);
        const href = $el.attr("href") ?? "";
        const url = absoluteUrl(href);
        if (!url) return;

        const title =
          $el.find(".fastname").first().text().trim() ||
          $el.text().trim() ||
          "";
        const image = absoluteUrl($el.find("img.coverimg").attr("src"));

        if (!title) return;
        results.push({
          id: href,
          title,
          url,
          image,
          description: `Anime from animeheaven.me — search match for "${query}"`,
          episodeCount: null,
        });
      });
    }
  } catch (err) {
    note = `fastsearch failed: ${err instanceof Error ? err.message : "unknown"}`;
  }

  // --- 2. Fallback to the full search page ---
  if (results.length === 0) {
    source = fullUrl;
    try {
      const html = await fetchHtml(fullUrl, { timeoutMs: 15_000 });
      const $ = parseHtml(html);
      $(".similarimg").each((_, el) => {
        const $el = $(el);
        const $a = $el.find("a[href*='anime.php']").first();
        if (!$a.length) return;

        const href = $a.attr("href") ?? "";
        const url = absoluteUrl(href);
        if (!url) return;

        const title =
          $el.find(".similarname").first().text().trim() ||
          $a.text().trim() ||
          $a.attr("title")?.trim() ||
          "";

        const image = absoluteUrl($el.find("img.coverimg").attr("src"));

        if (!title) return;
        results.push({
          id: href,
          title,
          url,
          image,
          description: `Anime from animeheaven.me — search match for "${query}"`,
          episodeCount: null,
        });
      });
    } catch (err) {
      return Response.json(
        {
          error: "Search failed on both fastsearch and full search endpoints.",
          details: err instanceof Error ? err.message : "Unknown error",
          hint: note,
        },
        { status: 502 },
      );
    }
  }

  // De-duplicate by URL
  const dedup = new Map<string, SearchResult>();
  for (const r of results) {
    if (!dedup.has(r.url)) dedup.set(r.url, r);
  }

  return Response.json({
    query,
    source,
    count: dedup.size,
    note,
    results: Array.from(dedup.values()),
  });
}
