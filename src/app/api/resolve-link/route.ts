import { NextRequest, NextResponse } from "next/server";
import {
  absoluteUrl,
  DEFAULT_HEADERS,
  fetchHtml,
  parseHtml,
} from "@/lib/animeheaven";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

  try {
    const html = await fetchHtml(baseUrl.toString(), {
      timeoutMs: 15_000,
      headers: { ...DEFAULT_HEADERS, Referer: "https://animeheaven.me/" },
    });
    const $ = parseHtml(html);

    // The direct mp4 link lives inside <a> wrapping div.boxitem.bc2.c1.mar0
    // The container linetitle2.c above gives us the page heading context.
    const $candidates = $("a:has(div.boxitem.bc2.c1.mar0)");
    const candidates: { href: string; label: string }[] = [];

    $candidates.each((_i, el) => {
      const $a = $(el);
      const href = $a.attr("href") ?? "";
      if (!href) return;
      const label = $a.find("div.boxitem.bc2.c1.mar0").text().trim();
      const abs = absoluteUrl(href, baseUrl.toString());
      if (!abs) return;
      candidates.push({
        href: abs,
        label,
      });
    });

    // Fallback: any anchor whose href ends in .mp4
    if (candidates.length === 0) {
      $("a[href$='.mp4']").each((_i, el) => {
        const $a = $(el);
        const href = $a.attr("href") ?? "";
        if (!href) return;
        const abs = absoluteUrl(href, baseUrl.toString());
        if (!abs) return;
        candidates.push({
          href: abs,
          label: $a.text().trim(),
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

    // Prefer the candidate explicitly labelled as the mp4 download.
    const best =
      candidates.find((c) => /mp4/i.test(c.label)) ?? candidates[0];

    return NextResponse.json({
      ok: true,
      source: baseUrl.toString(),
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
