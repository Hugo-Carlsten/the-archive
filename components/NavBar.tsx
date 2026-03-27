"use client";

import Link from "next/link";
import { useState, useRef, useEffect } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, setDoc, Timestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { useSubscription, type Tier } from "@/hooks/useSubscription";
import LoginModal from "@/components/LoginModal";

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

const TIER_OPTIONS: { id: Tier; label: string; color: string }[] = [
  { id: "free",    label: "Free",    color: "#9E9E9E" },
  { id: "plus",    label: "Plus",    color: "#B5956A" },
  { id: "premium", label: "Premium", color: "#1C2B2D" },
];

function PlanDropdown({ tier }: { tier: Tier }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, []);

  async function switchPlan(newTier: Tier) {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    setOpen(false);
    const expiry = newTier === "plus"
      ? Timestamp.fromDate(new Date(Date.now() + 7 * 86_400_000))
      : null;
    await setDoc(doc(db, "users", uid), { subscription: newTier, subscriptionExpiry: expiry }, { merge: true });
    window.location.reload();
  }

  const current = TIER_OPTIONS.find((o) => o.id === tier)!;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="text-[8px] tracking-[0.18em] uppercase px-1.5 py-0.5 leading-none cursor-pointer select-none"
        style={{ background: current.color, color: "#F5F0E8" }}
      >
        {tier}
      </button>
      {open && (
        <div className="absolute top-full right-0 mt-2 bg-cream border border-charcoal/10 shadow-sm z-[100] min-w-[140px]">
          {TIER_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              onClick={() => switchPlan(opt.id)}
              className="w-full flex items-center justify-between gap-3 px-4 py-2.5 text-xs tracking-wide text-left hover:bg-charcoal/5 transition-colors"
            >
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: opt.color }} />
                {opt.label}
              </span>
              {opt.id === tier && (
                <svg className="w-3 h-3 text-charcoal/50 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function NavBar() {
  const { tier, isLoading: subLoading } = useSubscription();
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);
  const [loginOpen, setLoginOpen] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setLoggedIn(!!u));
    return unsub;
  }, []);

  const isLoading = loggedIn === null || subLoading;

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-50 bg-cream/95 backdrop-blur-sm border-b border-border">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 hover:opacity-75 transition-opacity duration-300">
            <img src="/logo.png" alt="" style={{ height: "60px", width: "auto", verticalAlign: "middle" }} />
            <span className="font-serif text-lg tracking-[0.25em] text-charcoal">THE ARCHIVE</span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-10">
            {!isLoading && loggedIn && (
              <>
                {NAV_LINKS.map(({ href, label }) => (
                  <Link key={href} href={href} className="nav-link">{label}</Link>
                ))}
                <PlanDropdown tier={tier} />
              </>
            )}
            {!isLoading && !loggedIn && (
              <button
                onClick={() => setLoginOpen(true)}
                className="px-5 py-2 border border-charcoal/20 bg-cream text-charcoal text-[10px] tracking-[0.2em] uppercase hover:border-charcoal/50 transition-colors duration-200"
              >
                Logga in
              </button>
            )}
          </nav>

          {/* Mobile nav */}
          <nav className="flex md:hidden items-center gap-5">
            {!isLoading && loggedIn && (
              <>
                {MOBILE_LINKS.map(({ href, label }) => (
                  <Link key={href} href={href} className="nav-link">{label}</Link>
                ))}
                <PlanDropdown tier={tier} />
              </>
            )}
            {!isLoading && !loggedIn && (
              <button
                onClick={() => setLoginOpen(true)}
                className="px-4 py-1.5 border border-charcoal/20 bg-cream text-charcoal text-[10px] tracking-[0.2em] uppercase hover:border-charcoal/50 transition-colors duration-200"
              >
                Logga in
              </button>
            )}
          </nav>
        </div>
      </header>

      <LoginModal isOpen={loginOpen} onClose={() => setLoginOpen(false)} />
    </>
  );
}
