import { NextRequest } from "next/server";
import {
  absoluteUrl,
  fetchHtml,
  parseHtml,
  type SearchResult,
} from "@/lib/animeheaven";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get("q")?.trim();

  if (!query) {
    return Response.json(
      { error: "Missing search query parameter `q`." },
      { status: 400 },
    );
  }

  const target = `https://animeheaven.me/search.php?s=${encodeURIComponent(query)}`;

  try {
    const html = await fetchHtml(target);
    const $ = parseHtml(html);
    const results: SearchResult[] = [];

    // animeheaven search result page structure:
    //   <div class="boldtext">
    //     <div class="linetitle c">{query}</div>
    //     <div class="info3 bc1">
    //       <div class="similarimg">
    //         <div class="p1">
    //           <a href="anime.php?HASH"><img class="coverimg" ... /></a>
    //           <div class="similarname c"><a href="anime.php?HASH" class="c">Title</a></div>
    //         </div>
    //       </div>
    //       ... (more similarimg items)
    //     </div>
    //   </div>
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

    // De-duplicate by URL (in case of duplicates)
    const dedup = new Map<string, SearchResult>();
    for (const r of results) {
      if (!dedup.has(r.url)) dedup.set(r.url, r);
    }

    return Response.json({
      query,
      source: target,
      count: dedup.size,
      results: Array.from(dedup.values()),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json(
      {
        error: "Failed to perform search.",
        details: message,
        hint:
          "The upstream site may be blocking the request, or the request timed out.",
      },
      { status: 502 },
    );
  }
}
