"use client";

export function About() {
  return (
    <section id="about" className="border-t rule paper-2">
      <div className="mx-auto max-w-6xl px-6 py-16 sm:py-20">
        <div className="grid items-start gap-10 lg:grid-cols-[1fr_1.2fr]">
          <div>
            <p className="eyebrow">Our story</p>
            <h2 className="font-display mt-3 text-4xl leading-[1.05] sm:text-5xl">
              Built by readers, <br />
              <em>for readers.</em>
            </h2>
          </div>
          <div className="space-y-5 text-base leading-relaxed text-[color:var(--ink-soft)]">
            <p>
              CholeyAnime grew out of the same frustration that gave us
              CholeyManhwa: too many broken downloaders, too many popups, and
              too many sites that pretend a "play" button is the same as a
              "save" button.
            </p>
            <p>
              We scrape the page server-side, resolve the direct video stream
              for you, and hand the file back as a real download — no
              extensions to install, no accounts to create, no surprises.
            </p>
            <p>
              The interface is intentionally calm: a serif headline, a few
              well-placed buttons, and one job done well. Paste a link, save
              your episodes, watch whenever.
            </p>
            <div className="flex flex-wrap items-center gap-2 pt-2">
              <span className="tag">Editorial by design</span>
              <span className="tag">Open on the web</span>
              <span className="tag">No data stored</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
