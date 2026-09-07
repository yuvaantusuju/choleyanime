import { NextRequest } from "next/server";
import { absoluteUrl, fetchHtml, parseHtml } from "@/lib/animeheaven";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * The site uses a `key` cookie to remember the active episode.
 * The `/episodes` API returns a `key` (the hash `id` of the gate anchor),
 * and we must set it as a `key=<key>` cookie before requesting `gate.php`.
 */
export async function GET(req: NextRequest) {
  // Accept either a gate URL (legacy) OR a key hash
  const raw = req.nextUrl.searchParams.get("url")?.trim();
  const keyParam = req.nextUrl.searchParams.get("key")?.trim();

  if (!raw && !keyParam) {
    return Response.json(
      { error: "Missing gate URL parameter `url` or `key`." },
      { status: 400 },
    );
  }

  // Derive a key from a URL if necessary. The legacy `gate.php?...` form is
  // no longer used by the current site, so this is a best-effort fallback.
  let key = keyParam ?? "";
  if (!key && raw) {
    try {
      const u = new URL(raw, "https://animeheaven.me");
      key =
        u.searchParams.get("key") ??
        u.searchParams.get("k") ??
        u.searchParams.get("id") ??
        "";
    } catch {
      // ignore
    }
    if (!key) key = raw; // last resort — treat the whole string as a key
  }

  const gateUrl = "https://animeheaven.me/gate.php";

  try {
    const html = await fetchHtml(gateUrl, {
      cookies: { key },
      referer: "https://animeheaven.me/",
    });
    const $ = parseHtml(html);

    // The gate page exposes a list of <source> elements with the direct .mp4
    // URLs. The first one is the primary mirror (cz.). Fallbacks (ct., ck.)
    // are tried by the site on error.
    const mirrors: string[] = [];
    $("source[src*='.mp4']").each((_, el) => {
      const src = $(el).attr("src");
      const abs = absoluteUrl(src);
      if (abs && !mirrors.includes(abs)) mirrors.push(abs);
    });

    // Last-ditch: any anchor with .mp4 href inside .linetitle2.c
    if (mirrors.length === 0) {
      $(".linetitle2.c a[href*='.mp4']").each((_, el) => {
        const href = $(el).attr("href");
        const abs = absoluteUrl(href);
        if (abs && !mirrors.includes(abs)) mirrors.push(abs);
      });
    }

    if (mirrors.length === 0) {
      return Response.json(
        {
          error:
            "Could not find a direct .mp4 stream on the gate page. The site markup may have changed, or the key may be invalid/expired.",
        },
        { status: 404 },
      );
    }

    return Response.json({
      key,
      gateUrl,
      mirrors,
      mp4Url: mirrors[0],
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json(
      {
        error: "Failed to resolve the gate page to an .mp4 stream.",
        details: message,
      },
      { status: 502 },
    );
  }
}
