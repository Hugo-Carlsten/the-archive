import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-[calc(100vh-4rem)] bg-cream flex flex-col">
      {/* Hero */}
      <section className="flex-1 flex flex-col items-center justify-center px-6 text-center py-24">
        <div className="w-px h-16 bg-taupe/40 mb-10" />

        <p className="text-xs tracking-[0.3em] text-taupe uppercase mb-6">
          Est. 2025
        </p>

        <img src="/logo.jpg" alt="The Archive" style={{ height: "80px", width: "auto" }} className="mb-6" />

        <div className="w-24 h-px bg-taupe/40 my-6" />

        <p className="text-lg sm:text-xl text-charcoal/60 tracking-wide font-light max-w-sm">
          Din personliga AI-stylist
        </p>

        <div className="flex flex-col sm:flex-row gap-4 mt-14">
          <Link
            href="/onboarding"
            className="px-10 py-3.5 bg-charcoal text-cream text-sm tracking-[0.15em] uppercase hover:bg-taupe transition-colors duration-300"
          >
            Kom igång
          </Link>
          <Link
            href="/login"
            className="px-10 py-3.5 border border-charcoal/30 text-charcoal text-sm tracking-[0.15em] uppercase hover:border-taupe hover:text-taupe transition-colors duration-300"
          >
            Logga in
          </Link>
        </div>

        <div className="w-px h-16 bg-taupe/40 mt-14" />
      </section>

      {/* Feature strip */}
      <section className="border-t border-charcoal/10 py-12 px-6">
        <div className="max-w-4xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-10 text-center">
          {[
            {
              title: "Bygg din garderob",
              desc: "Katalogisera dina plagg och skapa en digital kopia av din stil.",
            },
            {
              title: "AI-genererade outfits",
              desc: "Få personliga outfitförslag baserade på din stil och tillfälle.",
            },
            {
              title: "Spara & inspireras",
              desc: "Samla inspiration och bygg ditt personliga stilarkiv.",
            },
          ].map(({ title, desc }) => (
            <div key={title} className="flex flex-col items-center gap-3">
              <div className="w-8 h-px bg-taupe mb-1" />
              <h3 className="font-serif text-lg text-charcoal tracking-wide">
                {title}
              </h3>
              <p className="text-sm text-charcoal/50 leading-relaxed max-w-[200px]">
                {desc}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
