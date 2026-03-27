"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import { doc, getDoc, getDocs, collection, query, orderBy, limit, Timestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import { useSubscription, type Tier } from "@/hooks/useSubscription";

// ─── Types ────────────────────────────────────────────────────────────────────

interface StyleProfile {
  shoppingMode?: "second_hand" | "new" | "mixed";
  styleCategories?: string[];
  colorPreferences?: string[];
  priceRange?: string;
  gender?: string;
  styleDescription?: string;
  createdAt?: Timestamp;
}

interface WishlistItem {
  id: string;
  isSecondHand?: boolean;
}

interface SavedOutfit {
  id: string;
  items?: Record<string, { name?: string; imageUrl?: string; price?: number }>;
  score?: number;
  label?: string;
  savedAt?: Timestamp;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SHOPPING_MODE_LABEL: Record<string, string> = {
  second_hand: "Second Hand",
  new: "Nytt",
  mixed: "Blandat",
};

const PRICE_RANGE_LABEL: Record<string, string> = {
  budget: "Budget — under 200 kr",
  mellansegment: "Mellansegment — 200–500 kr",
  premium: "Premium — 500–1 000 kr",
  lyx: "Lyx — 1 000 kr+",
  spelar_ingen_roll: "Spelar ingen roll",
};

const COLOR_HEX_MAP: Record<string, string> = {
  svart: "#1a1a1a", vit: "#f5f5f5", vitt: "#f5f5f5", beige: "#d4b896",
  brun: "#7d5c45", grå: "#9e9e9e", blå: "#3b6cb7", marinblå: "#1a2f4a",
  grön: "#4a7c59", röd: "#c0392b", rosa: "#e8a0b4", gul: "#d4b84a",
  orange: "#e07b39", lila: "#7b5ea7", turkos: "#3a9e9e", kräm: "#f5f0e8",
  silver: "#c0c0c0", guld: "#c9a84c", offwhite: "#f0ece4", camel: "#c19a6b",
};

function scoreBadgeClass(score: number) {
  if (score >= 80) return "bg-green-50 text-green-700 border border-green-200";
  if (score >= 60) return "bg-yellow-50 text-yellow-700 border border-yellow-200";
  return "bg-red-50 text-red-600 border border-red-200";
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionDivider({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-4 my-12">
      <div className="h-px flex-1 bg-charcoal/10" />
      <h2 className="font-serif text-xl text-charcoal tracking-wide">{title}</h2>
      <div className="h-px flex-1 bg-charcoal/10" />
    </div>
  );
}

function StatCard({ value, label }: { value: string; label: string }) {
  return (
    <div className="bg-cream border border-charcoal/10 px-4 py-6 text-center flex flex-col items-center gap-1">
      <span className="font-serif text-4xl text-charcoal leading-none">{value}</span>
      <span className="text-[10px] tracking-[0.15em] text-charcoal/40 uppercase mt-1">{label}</span>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

function MembershipSection({ tier, isOnTrial, trialDaysLeft, nextProfileUpdate }: {
  tier: Tier;
  isOnTrial: boolean;
  trialDaysLeft: number | null;
  nextProfileUpdate: Date | null;
}) {
  const tierLabel = tier === "premium" ? "Premium" : tier === "plus" ? "Plus" : "Free";
  const badgeBg   = tier === "premium" ? "#1C2B2D" : tier === "plus" ? "#B5956A" : "#9E9E9E";

  const summary: Record<Tier, string> = {
    free:    "15 plagg/dag · 3 outfits · 25 i wishlist · Outfit-byggaren utan AI",
    plus:    "75 plagg/dag · Obegränsade outfits · AI-stilanalys · 30 garderobsplagg",
    premium: "Obegränsad feed · 5 stilprofiler · Exportera outfits · Early access",
  };

  return (
    <div className="border border-charcoal/10 p-6 flex flex-col sm:flex-row items-start sm:items-center gap-5 mb-10">
      <div className="flex flex-col gap-2 flex-1 min-w-0">
        <div className="flex items-center gap-2.5">
          <span
            className="text-[9px] tracking-[0.2em] uppercase px-2 py-0.5 leading-none"
            style={{ background: badgeBg, color: "#F5F0E8" }}
          >
            {tierLabel}
          </span>
          <span className="text-sm text-charcoal font-medium tracking-wide">Mitt medlemskap</span>
        </div>
        <p className="text-xs text-charcoal/50 tracking-wide leading-relaxed">
          {summary[tier]}
        </p>
        {isOnTrial && trialDaysLeft !== null && (
          <p className="text-[10px] tracking-wide" style={{ color: "#B5956A" }}>
            Gratis provperiod — {trialDaysLeft} dag{trialDaysLeft !== 1 ? "ar" : ""} kvar
          </p>
        )}
        {nextProfileUpdate && (
          <p className="text-[10px] text-charcoal/40 tracking-wide">
            Kan uppdatera stilprofil igen:{" "}
            {nextProfileUpdate.toLocaleDateString("sv-SE", { day: "numeric", month: "long" })}
          </p>
        )}
      </div>
      {tier !== "premium" ? (
        <Link
          href="/uppgradera"
          className="flex-shrink-0 px-6 py-2.5 text-xs tracking-[0.15em] uppercase transition-colors duration-200 whitespace-nowrap"
          style={{ background: "#1C2B2D", color: "#F5F0E8" }}
        >
          Uppgradera
        </Link>
      ) : (
        <button
          className="flex-shrink-0 px-6 py-2.5 border border-charcoal/20 text-charcoal text-xs tracking-[0.15em] uppercase hover:border-taupe hover:text-taupe transition-colors duration-200 whitespace-nowrap"
        >
          Hantera prenumeration
        </button>
      )}
    </div>
  );
}

export default function ProfilPage() {
  const router = useRouter();
  const { tier, isOnTrial, trialDaysLeft, canUpdateProfile, nextProfileUpdate } = useSubscription();
  const [user, setUser] = useState<User | null | "loading">("loading");

  // Data
  const [styleProfile, setStyleProfile] = useState<StyleProfile | null>(null);
  const [wardrobeCount, setWardrobeCount] = useState(0);
  const [outfitCount, setOutfitCount] = useState(0);
  const [wishlist, setWishlist] = useState<WishlistItem[]>([]);
  const [latestOutfits, setLatestOutfits] = useState<SavedOutfit[]>([]);

  const [loading, setLoading] = useState(true);
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  // ── Auth ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (!u) setLoading(false);
    });
  }, []);

  // ── Load Firestore data ───────────────────────────────────────────────────

  useEffect(() => {
    if (user === "loading" || !user) return;
    const uid = (user as User).uid;

    async function load() {
      try {
        // Profile is stored directly on users/{uid} by onboarding
        const profileSnap = await getDoc(doc(db, "users", uid));
        if (profileSnap.exists()) {
          setStyleProfile(profileSnap.data() as StyleProfile);
        }

        // Wardrobe count
        const wardrobeSnap = await getDocs(collection(db, "wardrobes", uid, "items"));
        setWardrobeCount(wardrobeSnap.size);

        // Outfits — fetch all for count, keep latest 3 for display
        const outfitsSnap = await getDocs(
          query(collection(db, "users", uid, "outfits"), orderBy("savedAt", "desc"), limit(3))
        );
        // Total count via a separate query (or just use the limited snap for display)
        const allOutfitsSnap = await getDocs(collection(db, "users", uid, "outfits"));
        setOutfitCount(allOutfitsSnap.size);
        setLatestOutfits(outfitsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as SavedOutfit)));

        // Wishlist
        const wishlistSnap = await getDocs(collection(db, "users", uid, "wishlist"));
        setWishlist(wishlistSnap.docs.map((d) => ({ id: d.id, ...d.data() } as WishlistItem)));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [user]);

  // ── Toast ─────────────────────────────────────────────────────────────────

  function showToast(msg: string) {
    setToastMessage(msg);
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 2500);
  }

  // ── Sign out ──────────────────────────────────────────────────────────────

  async function handleSignOut() {
    await signOut(auth);
    router.push("/");
  }

  // ── Loading ───────────────────────────────────────────────────────────────

  if (user === "loading" || loading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] bg-cream flex items-center justify-center">
        <div className="w-px h-12 bg-taupe/40 animate-pulse" />
      </div>
    );
  }

  // ── Not logged in ─────────────────────────────────────────────────────────

  if (!user) {
    return (
      <div className="min-h-[calc(100vh-4rem)] bg-cream flex flex-col items-center justify-center px-6 text-center">
        <div className="w-px h-12 bg-taupe/40 mb-10" />
        <h1 className="font-serif text-3xl text-charcoal tracking-tight mb-4">Inte inloggad</h1>
        <div className="w-16 h-px bg-taupe/40 my-5" />
        <p className="text-sm text-charcoal/50 mb-8">Logga in för att se din profil.</p>
        <Link
          href="/login"
          className="px-10 py-3.5 bg-charcoal text-cream text-sm tracking-[0.15em] uppercase hover:bg-taupe transition-colors duration-300"
        >
          Logga in
        </Link>
        <div className="w-px h-12 bg-taupe/40 mt-10" />
      </div>
    );
  }

  const u = user as User;
  const initials = u.displayName
    ? u.displayName.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : u.email?.[0]?.toUpperCase() ?? "?";

  const memberSince = styleProfile?.createdAt
    ? styleProfile.createdAt.toDate().toLocaleDateString("sv-SE", {
        year: "numeric", month: "long", day: "numeric",
      })
    : null;

  // Sustainability
  const secondHandCount = wishlist.filter((w) => w.isSecondHand).length;
  const co2Saved = secondHandCount * 5;
  const kmEquivalent = Math.round((co2Saved * 1000) / 130);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-cream px-6 py-12">

      {/* Toast */}
      <div
        className={`fixed bottom-8 left-1/2 -translate-x-1/2 z-50 transition-all duration-300 ${
          toastVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"
        }`}
      >
        <div className="bg-charcoal text-cream text-xs tracking-[0.15em] uppercase px-6 py-3 shadow-lg">
          {toastMessage}
        </div>
      </div>

      <div className="max-w-3xl mx-auto">

        {/* ── 1. RUBRIK ──────────────────────────────────────────────────── */}
        <div className="flex flex-col items-center text-center mb-10">
          <div className="w-px h-10 bg-taupe/40 mb-6" />
          <p className="text-[10px] tracking-[0.3em] text-taupe/60 uppercase mb-4">The Archive</p>
          <h1 className="font-serif text-4xl text-charcoal tracking-tight">Min Profil</h1>
          <div className="w-16 h-px bg-taupe/40 mt-6" />
        </div>

        {/* ── MEDLEMSKAP ─────────────────────────────────────────────────── */}
        <MembershipSection
          tier={tier}
          isOnTrial={isOnTrial}
          trialDaysLeft={trialDaysLeft}
          nextProfileUpdate={nextProfileUpdate}
        />

        {/* ── 1. ANVÄNDARINFO ────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-8 mb-2">

          {/* Avatar */}
          <div className="flex-shrink-0">
            {u.photoURL ? (
              <img
                src={u.photoURL}
                alt={u.displayName ?? "Profil"}
                className="w-24 h-24 rounded-full object-cover ring-2 ring-taupe/20"
              />
            ) : (
              <div className="w-24 h-24 rounded-full bg-taupe/20 flex items-center justify-center">
                <span className="font-serif text-3xl text-taupe">{initials}</span>
              </div>
            )}
          </div>

          {/* Namn / e-post / datum */}
          <div className="flex flex-col gap-1 sm:pt-2 text-center sm:text-left flex-1">
            <h2 className="font-serif text-3xl text-charcoal tracking-tight">
              {u.displayName ?? "Okänt namn"}
            </h2>
            <p className="text-sm text-charcoal/50 tracking-wide">{u.email}</p>
            {memberSince && (
              <p className="text-xs text-charcoal/40 tracking-wide mt-1">
                Medlem sedan {memberSince}
              </p>
            )}
          </div>

          {/* Knappar */}
          <div className="flex flex-col gap-2 sm:pt-2 items-center sm:items-end">
            <button
              onClick={() => showToast("Profilredigering kommer snart")}
              className="px-6 py-2.5 border border-charcoal/20 text-charcoal text-xs tracking-[0.15em] uppercase hover:border-taupe hover:text-taupe transition-colors duration-300 whitespace-nowrap"
            >
              Redigera profil
            </button>
            <button
              onClick={handleSignOut}
              className="px-6 py-2 text-charcoal/40 text-xs tracking-[0.12em] uppercase hover:text-charcoal transition-colors duration-300"
            >
              Logga ut
            </button>
          </div>
        </div>

        {/* ── 2. STATISTIK ───────────────────────────────────────────────── */}
        <SectionDivider title="Statistik" />

        <div className="grid grid-cols-3 gap-3">
          <StatCard value={String(wardrobeCount)} label="Plagg i garderoben" />
          <StatCard value={String(outfitCount)} label="Sparade outfits" />
          <StatCard value={String(wishlist.length)} label="Wishlist-plagg" />
        </div>

        {/* ── 3. STILPROFIL ──────────────────────────────────────────────── */}
        <SectionDivider title="Stilprofil" />

        {!styleProfile || (!styleProfile.styleCategories && !styleProfile.colorPreferences) ? (
          <div className="flex flex-col items-center py-12 gap-4 text-center">
            <p className="text-sm text-charcoal/40 tracking-wide">
              Du har inte skapat en stilprofil ännu.
            </p>
            <Link
              href="/onboarding"
              className="px-8 py-3 bg-charcoal text-cream text-xs tracking-[0.15em] uppercase hover:bg-taupe transition-colors duration-300"
            >
              Skapa stilprofil
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-6">

            {/* Shoppingläge-tagg */}
            {styleProfile.shoppingMode && (
              <div className="flex flex-wrap gap-2">
                <span className="px-3 py-1.5 border border-taupe text-taupe text-xs tracking-[0.15em] uppercase">
                  {SHOPPING_MODE_LABEL[styleProfile.shoppingMode] ?? styleProfile.shoppingMode}
                </span>
                {styleProfile.priceRange && (
                  <span className="px-3 py-1.5 border border-charcoal/10 text-charcoal/50 text-xs tracking-[0.12em] uppercase">
                    {PRICE_RANGE_LABEL[styleProfile.priceRange] ?? styleProfile.priceRange}
                  </span>
                )}
              </div>
            )}

            {/* Stilkategorier */}
            {styleProfile.styleCategories && styleProfile.styleCategories.length > 0 && (
              <div className="flex flex-col gap-2">
                <p className="text-[10px] tracking-[0.2em] text-charcoal/40 uppercase">Stilar</p>
                <div className="flex flex-wrap gap-2">
                  {styleProfile.styleCategories.map((cat) => (
                    <span
                      key={cat}
                      className="px-3 py-1.5 bg-charcoal/5 text-charcoal text-xs tracking-wide capitalize cursor-default hover:bg-charcoal/10 transition-colors"
                    >
                      {cat}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Favoritfärger */}
            {styleProfile.colorPreferences && styleProfile.colorPreferences.length > 0 && (
              <div className="flex flex-col gap-2">
                <p className="text-[10px] tracking-[0.2em] text-charcoal/40 uppercase">Favoritfärger</p>
                <div className="flex flex-wrap gap-3 items-center">
                  {styleProfile.colorPreferences.map((color) => {
                    const hex = COLOR_HEX_MAP[color.toLowerCase()] ?? "#B5956A";
                    return (
                      <div key={color} className="flex items-center gap-1.5">
                        <div
                          className="w-6 h-6 rounded-full ring-1 ring-charcoal/10 flex-shrink-0"
                          style={{ backgroundColor: hex }}
                          title={color}
                        />
                        <span className="text-[10px] text-charcoal/50 capitalize">{color}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Prisklass (egen rad om inte ovan) */}
            {!styleProfile.shoppingMode && styleProfile.priceRange && (
              <div className="flex flex-col gap-1">
                <p className="text-[10px] tracking-[0.2em] text-charcoal/40 uppercase">Prisklass</p>
                <p className="text-sm text-charcoal">
                  {PRICE_RANGE_LABEL[styleProfile.priceRange] ?? styleProfile.priceRange}
                </p>
              </div>
            )}

            {/* Stilbeskrivning */}
            {styleProfile.styleDescription && (
              <div className="flex flex-col gap-2">
                <p className="text-[10px] tracking-[0.2em] text-charcoal/40 uppercase">Stilbeskrivning</p>
                <p className="text-sm italic text-charcoal/60 leading-relaxed border-l-2 border-taupe/30 pl-4">
                  &ldquo;{styleProfile.styleDescription}&rdquo;
                </p>
              </div>
            )}

            <Link
              href={canUpdateProfile ? "/onboarding" : "#"}
              onClick={!canUpdateProfile ? (e) => e.preventDefault() : undefined}
              className={`inline-flex self-start px-6 py-2.5 border text-xs tracking-[0.15em] uppercase transition-colors duration-300 ${
                canUpdateProfile
                  ? "border-charcoal/20 text-charcoal hover:border-taupe hover:text-taupe"
                  : "border-charcoal/10 text-charcoal/25 cursor-not-allowed"
              }`}
              title={!canUpdateProfile && nextProfileUpdate
                ? `Du kan uppdatera igen ${nextProfileUpdate.toLocaleDateString("sv-SE", { day: "numeric", month: "long" })}`
                : undefined}
            >
              Uppdatera stilprofil
            </Link>
          </div>
        )}

        {/* ── 4. HÅLLBARHETSMÄTARE ───────────────────────────────────────── */}
        <SectionDivider title="Hållbarhetsstatistik" />

        {secondHandCount === 0 ? (
          <div className="flex flex-col items-center py-12 text-center gap-3">
            <p className="text-sm text-charcoal/40 tracking-wide max-w-xs">
              Spara second hand-plagg i din wishlist för att se ditt miljöavtryck.
            </p>
            <Link
              href="/feed"
              className="mt-2 text-xs tracking-[0.15em] text-taupe uppercase hover:text-taupe-dark transition-colors"
            >
              Utforska feeden →
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-5">

            {/* Huvudsiffra */}
            <div className="border border-charcoal/10 px-6 py-8 text-center">
              <p className="text-[10px] tracking-[0.25em] text-taupe/70 uppercase mb-3">
                Din CO₂-besparing
              </p>
              <p className="font-serif text-6xl text-charcoal leading-none mb-2">
                {co2Saved} <span className="text-3xl text-charcoal/50">kg</span>
              </p>
              <p className="text-sm text-charcoal/50 tracking-wide mt-1">
                Du har sparat {co2Saved} kg CO₂
              </p>
            </div>

            {/* Jämförelse */}
            {kmEquivalent > 0 && (
              <div className="border border-taupe/30 bg-taupe/5 px-6 py-5 text-center">
                <p className="text-[10px] tracking-[0.2em] text-taupe/70 uppercase mb-2">
                  Det motsvarar
                </p>
                <p className="font-serif text-2xl text-charcoal leading-snug">
                  att inte köra bil i {kmEquivalent.toLocaleString("sv-SE")} km
                </p>
                <p className="text-[10px] text-charcoal/40 mt-2 tracking-wide">
                  Baserat på ~130 g CO₂ per km för en genomsnittlig personbil
                </p>
              </div>
            )}

            {/* Dela-knapp */}
            <button
              onClick={() => {
                const text = `Jag har sparat ${co2Saved} kg CO₂ genom att shoppa second hand på The Archive! Det motsvarar att inte köra bil i ${kmEquivalent} km. ♻️`;
                if (navigator.share) {
                  navigator.share({ text });
                } else {
                  navigator.clipboard.writeText(text).then(() =>
                    showToast("Kopierat till urklipp!")
                  );
                }
              }}
              className="self-center px-8 py-3 border border-charcoal/20 text-charcoal text-xs tracking-[0.15em] uppercase hover:border-taupe hover:text-taupe transition-colors duration-300"
            >
              Dela mitt miljöavtryck
            </button>
          </div>
        )}

        {/* ── 5. SPARADE OUTFITS ─────────────────────────────────────────── */}
        <SectionDivider title="Sparade outfits" />

        {latestOutfits.length === 0 ? (
          <div className="flex flex-col items-center py-12 gap-4 text-center">
            <p className="text-sm text-charcoal/40 tracking-wide">
              Inga sparade outfits ännu.
            </p>
            <Link
              href="/outfit-byggaren"
              className="px-8 py-3 border border-charcoal/20 text-charcoal text-xs tracking-[0.15em] uppercase hover:border-taupe hover:text-taupe transition-colors duration-300"
            >
              Öppna outfit-byggaren
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {latestOutfits.map((outfit) => {
              const items = Object.values(outfit.items ?? {});
              const names = items.map((i) => i.name).filter(Boolean);

              return (
                <div
                  key={outfit.id}
                  className="border border-charcoal/10 flex gap-4 p-4 hover:border-charcoal/30 transition-colors"
                >
                  {/* Miniatyrbilder */}
                  <div className="flex gap-1 flex-shrink-0">
                    {items.slice(0, 3).map((item, i) => (
                      <div key={i} className="w-14 h-20 bg-charcoal/5 overflow-hidden">
                        <img
                          src={item.imageUrl || "https://placehold.co/400x500/F5F0E8/2C2C2C?text=?"}
                          alt={item.name ?? "Plagg"}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).src =
                              "https://placehold.co/400x500/F5F0E8/2C2C2C?text=?";
                          }}
                        />
                      </div>
                    ))}
                  </div>

                  {/* Info */}
                  <div className="flex flex-col gap-2 flex-1 min-w-0 justify-between">
                    <div className="flex flex-col gap-0.5">
                      {names.slice(0, 3).map((name, i) => (
                        <p key={i} className="text-xs text-charcoal/70 leading-snug truncate">
                          {name}
                        </p>
                      ))}
                    </div>

                    {outfit.score != null && outfit.score > 0 && (
                      <span className={`text-[10px] px-2 py-0.5 tracking-wide self-start ${scoreBadgeClass(outfit.score)}`}>
                        {outfit.score}/100
                        {outfit.label ? ` — ${outfit.label}` : ""}
                      </span>
                    )}

                    <Link
                      href="/outfit-byggaren"
                      className="text-[10px] tracking-[0.12em] text-charcoal/40 uppercase hover:text-taupe transition-colors self-start"
                    >
                      Öppna i outfit-byggaren →
                    </Link>
                  </div>
                </div>
              );
            })}

            {outfitCount > 3 && (
              <p className="text-center text-xs text-charcoal/40 tracking-wide">
                Visar de senaste 3 av {outfitCount} outfits
              </p>
            )}
          </div>
        )}

        {/* ── Sidfot ─────────────────────────────────────────────────────── */}
        <div className="flex flex-col items-center mt-16">
          <div className="w-px h-10 bg-taupe/40" />
        </div>

      </div>
    </div>
  );
}
