"use client";

import Link from "next/link";
import { useSubscription } from "@/hooks/useSubscription";

const NAV_LINKS = [
  { href: "/feed",            label: "Feed" },
  { href: "/outfit-byggaren", label: "Outfit-byggaren" },
  { href: "/wishlist",        label: "Wishlist" },
  { href: "/profil",          label: "Profil" },
];

const MOBILE_LINKS = [
  { href: "/feed",            label: "Feed" },
  { href: "/outfit-byggaren", label: "Outfits" },
  { href: "/wishlist",        label: "Wishlist" },
  { href: "/profil",          label: "Profil" },
];

function TierBadge({ tier }: { tier: "free" | "plus" | "premium" }) {
  if (tier === "premium") {
    return (
      <span className="text-[8px] tracking-[0.18em] uppercase px-1.5 py-0.5 leading-none"
        style={{ background: "#1C2B2D", color: "#F5F0E8" }}>
        Premium
      </span>
    );
  }
  if (tier === "plus") {
    return (
      <span className="text-[8px] tracking-[0.18em] uppercase px-1.5 py-0.5 leading-none"
        style={{ background: "#B5956A", color: "#F5F0E8" }}>
        Plus
      </span>
    );
  }
  return null; // free — show upgrade link instead
}

export default function NavBar() {
  const { tier, isLoading } = useSubscription();

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-cream/95 backdrop-blur-sm border-b border-border">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3 hover:opacity-75 transition-opacity duration-300">
          <img src="/logo.png" alt="" style={{ height: "60px", width: "auto", verticalAlign: "middle" }} />
          <span className="font-serif text-lg tracking-[0.25em] text-charcoal">THE ARCHIVE</span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-10">
          {NAV_LINKS.map(({ href, label }) => (
            <Link key={href} href={href} className="nav-link">
              {label}
            </Link>
          ))}
          {!isLoading && tier === "free" && (
            <Link
              href="/uppgradera"
              className="flex items-center gap-1.5 text-[10px] tracking-[0.2em] uppercase text-taupe hover:text-charcoal transition-colors duration-200"
            >
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z" />
              </svg>
              Uppgradera
            </Link>
          )}
          {!isLoading && tier !== "free" && <TierBadge tier={tier} />}
        </nav>

        {/* Mobile nav */}
        <nav className="flex md:hidden items-center gap-6">
          {MOBILE_LINKS.map(({ href, label }) => (
            <Link key={href} href={href} className="nav-link">
              {label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
