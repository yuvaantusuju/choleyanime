import { NextRequest, NextResponse } from "next/server";
import {
  absoluteUrl,
  DEFAULT_HEADERS,
  fetchHtml,
  parseHtml,
} from "@/lib/animeheaven";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Extract the per-episode hash from a gate page URL or a bare hash.
 *
 * The gate page is normally `gate.php?HASH` (no `=` sign), so the URL
 * parser exposes the hash as a key with an empty value. We read it from
 * the raw query string and return just the hash, or accept a bare hash
 * string directly.
 */
function extractGateHash(input: string): string | null {
  if (!input) return null;
  // Already a bare hash (only [a-z0-9])
  if (/^[a-f0-9]{16,}$/i.test(input)) return input;

  try {
    const u = new URL(input, "https://animeheaven.me/");
    if (!u.pathname.toLowerCase().includes("gate.php")) {
      // Maybe the URL points directly at the mp4 already.
      return null;
    }
    const search = u.search.replace(/^\?/, "");
    if (search) {
      const first = search.split("&")[0] ?? "";
      const eq = first.indexOf("=");
      if (eq === -1) {
        if (first) return first;
      } else {
        const value = first.slice(eq + 1);
        if (value) return value;
      }
    }
    for (const value of u.searchParams.values()) {
      if (value) return value;
    }
  } catch {
    /* ignore */
  }
  return null;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const target = searchParams.get("url");

  if (!target) {
    return NextResponse.json(
      { error: "Missing required 'url' query parameter." },
      { status: 400 }
    );
  }

  let baseUrl: URL;
  try {
    baseUrl = new URL(target);
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

  // animeheaven's gate page requires a `key=HASH` cookie to be set in order
  // to recognise which episode to serve. The cookie is normally set by the
  // `gateh(...)` / `gatea(...)` JavaScript handlers on the show page when
  // the user hovers/clicks a link. We replicate that on the server side so
  // the gate page returns 200 instead of a 404 placeholder.
  const gateHash = extractGateHash(target);
  const cookieHeader = gateHash ? `key=${gateHash}` : undefined;

  try {
    const html = await fetchHtml(baseUrl.toString(), {
      timeoutMs: 15_000,
      headers: {
        ...DEFAULT_HEADERS,
        Referer: "https://animeheaven.me/",
        ...(cookieHeader ? { Cookie: cookieHeader } : {}),
      },
    });
    const $ = parseHtml(html);

    // 404 placeholder? abort early with a useful error.
    if (/Page not found/i.test($("title").first().text())) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Gate page returned 404. The episode hash may be stale — try reloading the show.",
        },
        { status: 404 }
      );
    }

    // The direct mp4 link lives in:
    //   <source src="https://cw.animeheaven.me/video.mp4?HASH&TOKEN" ...>
    // We collect every <source> element (there are typically 2-3 CDN
    // fallbacks) and prefer the one without an `&error` suffix.
    const candidates: { href: string; label: string }[] = [];

    $("source[src*='video.mp4']").each((_i, el) => {
      const $s = $(el);
      const src = $s.attr("src") ?? "";
      if (!src) return;
      const abs = absoluteUrl(src, baseUrl.toString());
      if (!abs) return;
      candidates.push({
        href: abs,
        label: $s.attr("type") ?? "video/mp4",
      });
    });

    // Fallback: any anchor whose href ends in .mp4 (the "Download Episode N"
    // button at the bottom of the gate page).
    if (candidates.length === 0) {
      $("a[href$='.mp4'], a[href*='video.mp4']").each((_i, el) => {
        const $a = $(el);
        const href = $a.attr("href") ?? "";
        if (!href) return;
        const abs = absoluteUrl(href, baseUrl.toString());
        if (!abs) return;
        candidates.push({
          href: abs,
          label: $a.text().trim() || "mp4",
        });
      });
    }

    // Fallback: the old `a:has(div.boxitem.bc2.c1.mar0)` selector.
    if (candidates.length === 0) {
      $("a:has(div.boxitem.bc2.c1.mar0)").each((_i, el) => {
        const $a = $(el);
        const href = $a.attr("href") ?? "";
        if (!href) return;
        const abs = absoluteUrl(href, baseUrl.toString());
        if (!abs) return;
        candidates.push({
          href: abs,
          label: $a.find("div.boxitem.bc2.c1.mar0").text().trim() || "mp4",
        });
      });
    }

    if (candidates.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Could not find a direct .mp4 link on the gate page. " +
            "The page layout may have changed or the episode is unavailable.",
        },
        { status: 404 }
      );
    }

    // Prefer candidates without `&error` / `&error2` query params — those
    // are the failover sources.
    const best =
      candidates.find(
        (c) => !c.href.includes("&error") && !c.href.includes("error2"),
      ) ?? candidates[0];

    return NextResponse.json({
      ok: true,
      source: baseUrl.toString(),
      hash: gateHash,
      mp4Url: best.href,
      label: best.label,
      candidates,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown resolution error";
    return NextResponse.json(
      { error: `Failed to resolve stream link: ${message}` },
      { status: 502 }
    );
  }
}
