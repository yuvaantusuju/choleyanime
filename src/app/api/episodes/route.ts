import { NextRequest } from "next/server";
import {
  absoluteUrl,
  fetchHtml,
  parseHtml,
  type Episode,
} from "@/lib/animeheaven";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("url")?.trim();

  if (!raw) {
    return Response.json(
      { error: "Missing anime show URL parameter `url`." },
      { status: 400 },
    );
  }

  const showUrl = absoluteUrl(raw) ?? raw;

  try {
    const html = await fetchHtml(showUrl);
    const $ = parseHtml(html);

    // Show title — try several selectors (the site uses different ones on
    // different layouts). Most reliable is the `.infotitle` element.
    const showTitle =
      $(".infotitle").first().text().trim() ||
      $(".linetitle.c").first().text().trim() ||
      $("title").first().text().trim() ||
      "Unknown Show";

    // Episode count from the info bar, e.g. "Episodes: 220"
    let totalEpisodes: number | null = null;
    const epInfo = $(".infoyear").first().text();
    const m = epInfo.match(/Episodes:\s*(\d+)/i);
    if (m) totalEpisodes = parseInt(m[1], 10);

    // Episode structure on the show page:
    //   <a id="<hash>" href='gate.php' onclick='gatea("<hash>")'>
    //     <div class="trackep0 watch bc2">
    //       <div class="trackep watchb bc">
    //         <div class="watch1 bc c">Episode</div>
    //         <div class="watch2 bc ">220</div>
    //         <div class="watch1 bc c">1176 d ago</div>
    //       </div>
    //     </div>
    //   </a>
    const episodes: Episode[] = [];
    $("a[id][href*='gate.php']").each((_, el) => {
      const $el = $(el);
      const key = $el.attr("id")?.trim();
      if (!key) return;

      const number =
        $el.find(".watch2").first().text().trim() ||
        $el.find(".watch1").first().text().trim() ||
        $el.text().trim() ||
        "";

      const cleaned = number.replace(/\s+/g, " ").trim();

      episodes.push({
        id: key,
        key,
        number: cleaned || `Episode ${episodes.length + 1}`,
        title: cleaned || `Episode ${episodes.length + 1}`,
        showUrl,
      });
    });

    // De-duplicate by key
    const seen = new Set<string>();
    const unique = episodes.filter((e) => {
      if (seen.has(e.key)) return false;
      seen.add(e.key);
      return true;
    });

    return Response.json({
      showTitle,
      showUrl,
      totalEpisodes,
      count: unique.length,
      episodes: unique,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json(
      {
        error: "Failed to extract episodes for the supplied show URL.",
        details: message,
      },
      { status: 502 },
    );
  }
}
