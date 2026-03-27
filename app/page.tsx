"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";

export default function Home() {
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setLoggedIn(!!u));
    return unsub;
  }, []);

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-cream flex flex-col">
      {/* Hero */}
      <section className="flex-1 flex flex-col items-center justify-center px-6 text-center py-32">
        <p className="animate-fade-in-up text-[10px] tracking-[0.4em] text-taupe uppercase mb-10">
          Est. 2025
        </p>

        <div className="animate-fade-in-up-delay w-px h-20 bg-border mb-12" />

        <h1 className="animate-fade-in-up-delay font-serif text-[clamp(4rem,14vw,10rem)] tracking-[0.06em] text-charcoal leading-none mb-10">
          The Archive
        </h1>

        <div className="animate-fade-in-up-delay-2 w-20 h-px bg-taupe/50 mb-10" />

        <p className="animate-fade-in-up-delay-2 text-sm tracking-[0.2em] text-charcoal/40 uppercase font-light max-w-xs leading-loose mb-16">
          Din personliga AI-stylist
        </p>

        <div className="animate-fade-in-up-delay-3 h-14 flex items-center justify-center">
          {loggedIn === null ? (
            <span className="h-12 w-40 bg-charcoal/5 animate-pulse" />
          ) : loggedIn ? (
            <Link
              href="/feed"
              className="px-12 py-4 bg-midnight text-cream text-xs tracking-[0.25em] uppercase hover:bg-charcoal transition-colors duration-500"
            >
              Gå till min feed →
            </Link>
          ) : (
            <Link
              href="/onboarding"
              className="px-12 py-4 bg-midnight text-cream text-xs tracking-[0.25em] uppercase hover:bg-charcoal transition-colors duration-500"
            >
              Kom igång
            </Link>
          )}
        </div>

        <div className="animate-fade-in-up-delay-3 w-px h-20 bg-border mt-10" />
      </section>

      {/* Feature strip */}
      <section className="border-t border-border py-20 px-6">
        <div className="max-w-4xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-16 text-center">
          {[
            {
              label: "01",
              title: "Bygg din garderob",
              desc: "Katalogisera dina plagg och skapa en digital kopia av din stil.",
            },
            {
              label: "02",
              title: "AI-genererade outfits",
              desc: "Få personliga outfitförslag baserade på din stil och tillfälle.",
            },
            {
              label: "03",
              title: "Spara & inspireras",
              desc: "Samla inspiration och bygg ditt personliga stilarkiv.",
            },
          ].map(({ label, title, desc }) => (
            <div key={title} className="flex flex-col items-center gap-4">
              <p className="text-[10px] tracking-[0.3em] text-taupe uppercase">{label}</p>
              <div className="w-px h-8 bg-border" />
              <h3 className="font-serif text-xl text-charcoal tracking-wide">{title}</h3>
              <p className="text-xs text-charcoal/40 leading-loose tracking-wide max-w-[180px]">
                {desc}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
