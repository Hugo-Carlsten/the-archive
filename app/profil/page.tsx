"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import { doc, getDoc, getDocs, collection, Timestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { useRouter } from "next/navigation";

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

interface WardrobeItem {
  id: string;
  imageUrl: string;
  analyzedStyle: string[];
  colors: string[];
  category: string;
  uploadedAt?: Timestamp;
}

interface OutfitItem {
  id: string;
  name: string;
  brand: string;
  imageUrl: string;
  price: number;
}

interface SavedOutfit {
  id: string;
  items: Record<string, OutfitItem>;
  score: number;
  label: string;
  savedAt?: Timestamp;
}

interface WishlistItem {
  id: string;
  isSecondHand: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SHOPPING_MODE_LABEL: Record<string, string> = {
  second_hand: "Second Hand",
  new: "Nytt",
  mixed: "Blandat",
};

const GENDER_LABEL: Record<string, string> = {
  dam: "Dam",
  herr: "Herr",
  båda: "Båda",
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

const CATEGORY_LABEL: Record<string, string> = {
  top: "Topp", bottom: "Byxor", outerwear: "Jacka",
  shoes: "Skor", accessory: "Accessoar", dress: "Klänning",
};

function scoreBadgeClass(score: number) {
  if (score >= 80) return "bg-green-50 text-green-700 border border-green-200";
  if (score >= 60) return "bg-yellow-50 text-yellow-700 border border-yellow-200";
  return "bg-red-50 text-red-600 border border-red-200";
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Toast({ message, visible }: { message: string; visible: boolean }) {
  return (
    <div
      className={`fixed bottom-8 left-1/2 -translate-x-1/2 z-50 transition-all duration-300 ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"
      }`}
    >
      <div className="bg-charcoal text-cream text-xs tracking-[0.15em] uppercase px-6 py-3 shadow-lg">
        {message}
      </div>
    </div>
  );
}

function SectionDivider({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-4 my-12">
      <div className="h-px flex-1 bg-charcoal/10" />
      <h2 className="font-serif text-xl text-charcoal tracking-wide">{title}</h2>
      <div className="h-px flex-1 bg-charcoal/10" />
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function ProfilPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null | "loading">("loading");
  const [styleProfile, setStyleProfile] = useState<StyleProfile | null>(null);
  const [wardrobe, setWardrobe] = useState<WardrobeItem[]>([]);
  const [outfits, setOutfits] = useState<SavedOutfit[]>([]);
  const [wishlist, setWishlist] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState({ message: "", visible: false });

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (!u) setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (user === "loading" || !user) return;
    const uid = (user as User).uid;

    async function loadData() {
      try {
        const [profileSnap, wardrobeSnap, outfitsSnap, wishlistSnap] = await Promise.all([
          getDoc(doc(db, "users", uid)),
          getDocs(collection(db, "wardrobes", uid, "items")),
          getDocs(collection(db, "users", uid, "outfits")),
          getDocs(collection(db, "users", uid, "wishlist")),
        ]);

        if (profileSnap.exists()) {
          setStyleProfile(profileSnap.data() as StyleProfile);
        }
        setWardrobe(wardrobeSnap.docs.map((d) => ({ id: d.id, ...d.data() } as WardrobeItem)));
        setOutfits(outfitsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as SavedOutfit)));
        setWishlist(wishlistSnap.docs.map((d) => ({ id: d.id, ...d.data() } as WishlistItem)));
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [user]);

  function showToast(message: string) {
    setToast({ message, visible: true });
    setTimeout(() => setToast((t) => ({ ...t, visible: false })), 2500);
  }

  async function handleSignOut() {
    await signOut(auth);
    router.push("/");
  }

  if (user === "loading" || loading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] bg-cream flex items-center justify-center">
        <div className="w-px h-12 bg-taupe/40 animate-pulse" />
      </div>
    );
  }

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
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  // Sustainability — counted from wishlist second-hand items
  const secondHandCount = wishlist.filter((w) => w.isSecondHand).length;
  const co2Saved = secondHandCount * 5;        // kg per plagg
  const waterSaved = secondHandCount * 2000;   // liter per plagg
  const kmEquivalent = Math.round((co2Saved * 1000) / 130); // ~130g CO₂/km

  return (
    <div className="min-h-screen bg-cream px-6 py-12">
      <Toast message={toast.message} visible={toast.visible} />

      <div className="max-w-3xl mx-auto">

        {/* ── Rubrik ─────────────────────────────────────────────────────── */}
        <div className="flex flex-col items-center text-center mb-10">
          <div className="w-px h-10 bg-taupe/40 mb-6" />
          <p className="text-[10px] tracking-[0.3em] text-taupe/60 uppercase mb-4">The Archive</p>
          <h1 className="font-serif text-4xl text-charcoal tracking-tight">Min Profil</h1>
          <div className="w-16 h-px bg-taupe/40 mt-6" />
        </div>

        {/* ── Användarinfo ───────────────────────────────────────────────── */}
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

          {/* Namn + e-post + datum */}
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

        {/* ── Stilprofil ─────────────────────────────────────────────────── */}
        <SectionDivider title="Stilprofil" />

        {!styleProfile ? (
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

            {/* Shoppingläge + kön + prisklass */}
            <div className="flex flex-wrap gap-2 items-center">
              {styleProfile.shoppingMode && (
                <span className="px-3 py-1.5 border border-taupe text-taupe text-xs tracking-[0.15em] uppercase">
                  {SHOPPING_MODE_LABEL[styleProfile.shoppingMode] ?? styleProfile.shoppingMode}
                </span>
              )}
              {styleProfile.gender && (
                <span className="px-3 py-1.5 border border-charcoal/20 text-charcoal text-xs tracking-[0.12em] uppercase">
                  {GENDER_LABEL[styleProfile.gender] ?? styleProfile.gender}
                </span>
              )}
              {styleProfile.priceRange && (
                <span className="px-3 py-1.5 border border-charcoal/10 text-charcoal/50 text-xs tracking-[0.12em] uppercase">
                  {PRICE_RANGE_LABEL[styleProfile.priceRange] ?? styleProfile.priceRange}
                </span>
              )}
            </div>

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
              href="/onboarding"
              className="inline-flex self-start px-6 py-2.5 border border-charcoal/20 text-charcoal text-xs tracking-[0.15em] uppercase hover:border-taupe hover:text-taupe transition-colors duration-300"
            >
              Uppdatera stilprofil
            </Link>
          </div>
        )}

        {/* ── Garderob ───────────────────────────────────────────────────── */}
        <SectionDivider title="Min garderob" />

        {wardrobe.length === 0 ? (
          <div className="flex flex-col items-center py-12 gap-4 text-center">
            <p className="text-sm text-charcoal/40 tracking-wide">
              Inga plagg uppladdade ännu.
            </p>
            <Link
              href="/onboarding"
              className="px-8 py-3 border border-charcoal/20 text-charcoal text-xs tracking-[0.15em] uppercase hover:border-taupe hover:text-taupe transition-colors duration-300"
            >
              Lägg till plagg
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {wardrobe.map((item) => (
                <div key={item.id} className="group flex flex-col">
                  <div className="relative aspect-[3/4] overflow-hidden bg-charcoal/5">
                    <img
                      src={item.imageUrl || "https://placehold.co/400x500/F5F0E8/2C2C2C?text=The+Archive"}
                      alt={CATEGORY_LABEL[item.category] ?? item.category}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).src =
                          "https://placehold.co/400x500/F5F0E8/2C2C2C?text=The+Archive";
                      }}
                    />
                    <div className="absolute bottom-0 left-0 right-0 bg-charcoal/80 px-2 py-1.5">
                      <span className="text-[9px] tracking-wide text-cream/90 uppercase">
                        {CATEGORY_LABEL[item.category] ?? item.category}
                      </span>
                    </div>
                  </div>

                  {item.analyzedStyle && item.analyzedStyle.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {item.analyzedStyle.slice(0, 2).map((s) => (
                        <span
                          key={s}
                          className="text-[9px] px-1.5 py-0.5 bg-taupe/10 text-taupe/80 tracking-wide"
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <Link
              href="/onboarding"
              className="inline-flex self-start px-6 py-2.5 border border-charcoal/20 text-charcoal text-xs tracking-[0.15em] uppercase hover:border-taupe hover:text-taupe transition-colors duration-300"
            >
              Lägg till fler plagg
            </Link>
          </div>
        )}

        {/* ── Hållbarhetsstatistik ────────────────────────────────────────── */}
        <SectionDivider title="Hållbarhetsstatistik" />

        {secondHandCount === 0 ? (
          <div className="flex flex-col items-center py-12 text-center">
            <p className="text-sm text-charcoal/40 tracking-wide max-w-xs">
              Spara second hand-plagg i din wishlist för att se ditt miljöavtryck.
            </p>
            <div className="w-px h-8 bg-taupe/30 mt-8" />
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            <div className="grid grid-cols-3 gap-px bg-charcoal/10 border border-charcoal/10">
              {[
                { label: "Second hand-köp", value: String(secondHandCount) },
                { label: "CO₂-besparing", value: `${co2Saved} kg` },
                { label: "Vattenbesparing", value: `${waterSaved.toLocaleString("sv-SE")} L` },
              ].map(({ label, value }) => (
                <div key={label} className="bg-cream px-4 py-6 text-center">
                  <p className="font-serif text-3xl text-charcoal mb-1">{value}</p>
                  <p className="text-[10px] tracking-[0.12em] text-charcoal/40 uppercase leading-snug">
                    {label}
                  </p>
                </div>
              ))}
            </div>

            {kmEquivalent > 0 && (
              <div className="border border-taupe/30 bg-taupe/5 px-6 py-5 text-center">
                <p className="text-[10px] tracking-[0.2em] text-taupe/70 uppercase mb-2">
                  Det motsvarar
                </p>
                <p className="font-serif text-2xl text-charcoal leading-snug">
                  att inte köra bil i {kmEquivalent.toLocaleString("sv-SE")} km
                </p>
                <p className="text-[10px] text-charcoal/40 mt-2 tracking-wide">
                  Baserat på genomsnittliga utsläpp ~130 g CO₂ per km
                </p>
              </div>
            )}
          </div>
        )}

        {/* ── Sparade outfits ────────────────────────────────────────────── */}
        <SectionDivider title="Sparade outfits" />

        {outfits.length === 0 ? (
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {outfits.map((outfit) => {
              const outfitItems = Object.values(outfit.items ?? {});
              const itemNames = outfitItems.map((i) => i.name).filter(Boolean);

              return (
                <div
                  key={outfit.id}
                  className="border border-charcoal/10 flex gap-4 p-4 hover:border-charcoal/30 transition-colors"
                >
                  {/* Miniatyrbilder */}
                  <div className="flex gap-1 flex-shrink-0">
                    {outfitItems.slice(0, 3).map((item, i) => (
                      <div key={i} className="w-14 h-20 bg-charcoal/5 overflow-hidden flex-shrink-0">
                        <img
                          src={item.imageUrl || "https://placehold.co/400x500/F5F0E8/2C2C2C?text=?"}
                          alt={item.name}
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
                      {itemNames.slice(0, 3).map((name, i) => (
                        <p key={i} className="text-xs text-charcoal/70 leading-snug truncate">
                          {name}
                        </p>
                      ))}
                    </div>

                    {outfit.score > 0 && (
                      <span className={`text-[10px] px-2 py-0.5 tracking-wide self-start ${scoreBadgeClass(outfit.score)}`}>
                        {outfit.score}/100 — {outfit.label}
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
