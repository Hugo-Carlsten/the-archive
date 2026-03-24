"use client";

import { useState, useEffect } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { collection, doc, getDocs, setDoc, Timestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import type { Product } from "@/lib/firestore-setup";

// ─── Types ────────────────────────────────────────────────────────────────────

interface FeedProduct extends Product {
  id: string;
}

type SlotKey = "top" | "bottom" | "shoes" | "outerwear";

interface OutfitSlots {
  top: FeedProduct | null;
  bottom: FeedProduct | null;
  shoes: FeedProduct | null;
  outerwear: FeedProduct | null;
}

interface MatchResult {
  score: number;
  label: string;
  tip: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SLOTS: { key: SlotKey; emoji: string; label: string }[] = [
  { key: "top", emoji: "👕", label: "Topp" },
  { key: "bottom", emoji: "👖", label: "Byxor / Kjol" },
  { key: "shoes", emoji: "👟", label: "Skor" },
  { key: "outerwear", emoji: "🧥", label: "Jacka" },
];

const FILTERS = ["Alla", "Toppar", "Byxor", "Skor", "Jackor"];
const FILTER_CATEGORY: Record<string, string> = {
  Toppar: "top",
  Byxor: "bottom",
  Skor: "shoes",
  Jackor: "outerwear",
};

function slotForProduct(p: FeedProduct): SlotKey | null {
  if (p.category === "top" || p.category === "dress") return "top";
  if (p.category === "bottom") return "bottom";
  if (p.category === "shoes") return "shoes";
  if (p.category === "outerwear") return "outerwear";
  return null;
}

function scoreTextColor(score: number) {
  if (score >= 80) return "text-green-600";
  if (score >= 60) return "text-yellow-600";
  return "text-red-500";
}

function scoreBadgeClass(score: number) {
  if (score >= 80) return "bg-green-50 text-green-700 border border-green-200";
  if (score >= 60) return "bg-yellow-50 text-yellow-700 border border-yellow-200";
  return "bg-red-50 text-red-600 border border-red-200";
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SlotCard({
  slot,
  product,
  onRemove,
}: {
  slot: { key: SlotKey; emoji: string; label: string };
  product: FeedProduct | null;
  onRemove: () => void;
}) {
  if (product) {
    return (
      <div className="relative aspect-[3/4] overflow-hidden border border-charcoal bg-charcoal/5">
        <img
          src={product.imageUrl || "https://placehold.co/400x500/F5F0E8/2C2C2C?text=The+Archive"}
          alt={product.name}
          className="w-full h-full object-cover"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).src =
              "https://placehold.co/400x500/F5F0E8/2C2C2C?text=The+Archive";
          }}
        />
        <button
          onClick={onRemove}
          aria-label="Ta bort"
          className="absolute top-2 right-2 w-6 h-6 bg-charcoal text-cream text-sm flex items-center justify-center hover:bg-taupe transition-colors"
        >
          ×
        </button>
        <div className="absolute bottom-0 left-0 right-0 bg-charcoal/80 px-2 py-1.5">
          <p className="text-[10px] tracking-wide text-cream/90 truncate">{product.name}</p>
          <p className="text-[10px] text-taupe/80">{product.price} kr</p>
        </div>
      </div>
    );
  }

  return (
    <div className="aspect-[3/4] border border-dashed border-taupe/50 flex flex-col items-center justify-center gap-2 text-charcoal/25 bg-cream">
      <span className="text-3xl">{slot.emoji}</span>
      <span className="text-[10px] tracking-[0.15em] uppercase">{slot.label}</span>
    </div>
  );
}

function ProductCard({
  product,
  onAdd,
  isInOutfit,
}: {
  product: FeedProduct;
  onAdd: () => void;
  isInOutfit: boolean;
}) {
  return (
    <button
      onClick={onAdd}
      className={`group flex flex-col text-left border transition-colors duration-150 ${
        isInOutfit
          ? "border-taupe bg-taupe/10"
          : "border-charcoal/10 hover:border-charcoal/40"
      }`}
    >
      <div className="relative aspect-[3/4] overflow-hidden bg-charcoal/5">
        <img
          src={product.imageUrl || "https://placehold.co/400x500/F5F0E8/2C2C2C?text=The+Archive"}
          alt={product.name}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).src =
              "https://placehold.co/400x500/F5F0E8/2C2C2C?text=The+Archive";
          }}
        />
        {isInOutfit && (
          <div className="absolute inset-0 bg-taupe/20 flex items-center justify-center">
            <span className="bg-taupe text-cream text-[10px] tracking-widest uppercase px-2 py-0.5">
              Vald
            </span>
          </div>
        )}
      </div>
      <div className="p-2 flex flex-col gap-0.5">
        <p className="text-[10px] tracking-[0.15em] text-taupe uppercase">{product.brand}</p>
        <p className="text-xs text-charcoal leading-snug line-clamp-2">{product.name}</p>
        <p className="text-xs font-medium text-charcoal mt-0.5">{product.price} kr</p>
      </div>
    </button>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function OutfitBuilderPage() {
  const [user, setUser] = useState<User | null | "loading">("loading");
  const [products, setProducts] = useState<FeedProduct[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [slots, setSlots] = useState<OutfitSlots>({
    top: null,
    bottom: null,
    shoes: null,
    outerwear: null,
  });
  const [activeFilter, setActiveFilter] = useState("Alla");
  const [match, setMatch] = useState<MatchResult | null>(null);
  const [loadingMatch, setLoadingMatch] = useState(false);
  const [matchError, setMatchError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Auth
  useEffect(() => {
    return onAuthStateChanged(auth, (u) => setUser(u));
  }, []);

  // Load products from Firestore
  useEffect(() => {
    async function load() {
      const snap = await getDocs(collection(db, "products"));
      setProducts(
        snap.docs.map((d) => ({ id: d.id, ...(d.data() as Product) }))
      );
      setLoadingProducts(false);
    }
    load();
  }, []);

  // Fetch match score when 2+ slots filled
  const filledSlots = SLOTS.filter((s) => slots[s.key] !== null);
  const filledCount = filledSlots.length;

  useEffect(() => {
    if (filledCount < 2) {
      setMatch(null);
      setMatchError(null);
      return;
    }

    const items = filledSlots.map((s) => {
      const p = slots[s.key]!;
      return {
        name: p.name,
        style: Array.isArray(p.style) ? p.style : [],
        colors: Array.isArray(p.colors) ? p.colors : [],
      };
    });

    console.log("[outfit-match] Fetching score for", items.length, "items:", items.map(i => i.name));

    let cancelled = false;

    async function fetchMatch() {
      setLoadingMatch(true);
      setMatchError(null);
      try {
        const res = await fetch("/api/outfit-match", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items }),
        });
        const data = await res.json();
        console.log("[outfit-match] Response:", res.status, data);
        if (!cancelled) {
          if (res.ok) {
            setMatch(data);
          } else {
            setMatchError(data.error ?? "Okänt fel");
          }
        }
      } catch (err) {
        console.error("[outfit-match] Fetch failed:", err);
        if (!cancelled) setMatchError("Kunde inte nå API:et");
      } finally {
        if (!cancelled) setLoadingMatch(false);
      }
    }

    fetchMatch();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slots]);

  // AI suggestion: when exactly 3 slots filled, suggest for the empty one
  const emptySlot =
    filledCount === 3
      ? SLOTS.find((s) => slots[s.key] === null) ?? null
      : null;

  const suggestion = emptySlot
    ? products.find((p) => {
        const sk = slotForProduct(p);
        return (
          sk === emptySlot.key &&
          !Object.values(slots).some((s) => s?.id === p.id)
        );
      }) ?? null
    : null;

  function addProduct(product: FeedProduct) {
    const slot = slotForProduct(product);
    if (!slot) return;
    setSlots((prev) => ({ ...prev, [slot]: product }));
    setSaved(false);
  }

  function removeSlot(key: SlotKey) {
    setSlots((prev) => ({ ...prev, [key]: null }));
    setSaved(false);
  }

  function clearOutfit() {
    setSlots({ top: null, bottom: null, shoes: null, outerwear: null });
    setMatch(null);
    setSaved(false);
  }

  async function saveOutfit() {
    if (!user || user === "loading" || !match) return;
    setSaving(true);
    try {
      const uid = (user as User).uid;
      const outfitId = `outfit_${Date.now()}`;
      await setDoc(doc(db, "users", uid, "outfits", outfitId), {
        items: Object.fromEntries(
          SLOTS.filter((s) => slots[s.key]).map((s) => [s.key, {
            id: slots[s.key]!.id,
            name: slots[s.key]!.name,
            brand: slots[s.key]!.brand,
            imageUrl: slots[s.key]!.imageUrl,
            price: slots[s.key]!.price,
          }])
        ),
        score: match.score,
        label: match.label,
        savedAt: Timestamp.now(),
      });
      setSaved(true);
    } catch (err) {
      console.error("[saveOutfit]", err);
    } finally {
      setSaving(false);
    }
  }

  // Filtered products for picker
  const filteredProducts = products.filter((p) => {
    if (activeFilter === "Alla") return true;
    const cat = FILTER_CATEGORY[activeFilter];
    if (cat === "top") return p.category === "top" || p.category === "dress";
    return p.category === cat;
  });

  const selectedIds = new Set(
    Object.values(slots)
      .filter(Boolean)
      .map((p) => p!.id)
  );

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-cream px-6 py-12">
      <div className="max-w-6xl mx-auto">

        {/* Header */}
        <div className="flex flex-col items-center text-center mb-10">
          <div className="w-px h-10 bg-taupe/40 mb-6" />
          <h1 className="font-serif text-4xl text-charcoal tracking-tight mb-2">
            Outfit-byggaren
          </h1>
          <p className="text-sm text-charcoal/50 tracking-wide">
            Sätt ihop din outfit och få ett AI-matchningsbetyg
          </p>
          <div className="w-16 h-px bg-taupe/40 mt-6" />
        </div>

        {/* Two-column layout */}
        <div className="flex flex-col lg:flex-row gap-8 items-start">

          {/* ── Left: Canvas ─────────────────────────────────────────────── */}
          <div className="w-full lg:w-80 lg:flex-shrink-0 flex flex-col gap-6">

            {/* Slot grid */}
            <div className="grid grid-cols-2 gap-3">
              {SLOTS.map((slot) => (
                <SlotCard
                  key={slot.key}
                  slot={slot}
                  product={slots[slot.key]}
                  onRemove={() => removeSlot(slot.key)}
                />
              ))}
            </div>

            {/* Clear button */}
            {filledCount > 0 && (
              <button
                onClick={clearOutfit}
                className="w-full py-2.5 text-xs tracking-[0.15em] uppercase border border-charcoal/20 text-charcoal/50 hover:border-charcoal/50 hover:text-charcoal transition-colors"
              >
                Rensa outfit
              </button>
            )}

            {/* AI suggestion */}
            {suggestion && emptySlot && (
              <div className="border border-taupe/40 bg-taupe/5 p-4 flex flex-col gap-3">
                <p className="text-[10px] tracking-[0.2em] text-taupe uppercase">
                  AI-förslag — {emptySlot.label}
                </p>
                <div className="flex items-center gap-3">
                  <img
                    src={suggestion.imageUrl || "https://placehold.co/400x500/F5F0E8/2C2C2C?text=The+Archive"}
                    alt={suggestion.name}
                    className="w-12 h-16 object-cover flex-shrink-0"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src =
                        "https://placehold.co/400x500/F5F0E8/2C2C2C?text=The+Archive";
                    }}
                  />
                  <div className="flex flex-col gap-1 min-w-0">
                    <p className="text-xs text-charcoal leading-snug truncate">{suggestion.name}</p>
                    <p className="text-xs text-charcoal/50">{suggestion.price} kr</p>
                  </div>
                </div>
                <button
                  onClick={() => addProduct(suggestion)}
                  className="w-full py-2 bg-charcoal text-cream text-xs tracking-[0.15em] uppercase hover:bg-taupe transition-colors"
                >
                  Lägg till
                </button>
              </div>
            )}

            {/* Match score */}
            {filledCount >= 2 && (
              <div className="border border-charcoal/10 p-5 flex flex-col gap-4">
                <p className="text-[10px] tracking-[0.2em] text-charcoal/40 uppercase">
                  Matchningsbetyg
                </p>

                {loadingMatch ? (
                  <div className="flex items-center gap-3">
                    <svg className="animate-spin w-5 h-5 text-taupe" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                    </svg>
                    <span className="text-xs text-charcoal/40">Analyserar outfit...</span>
                  </div>
                ) : matchError ? (
                  <p className="text-xs text-red-500">{matchError}</p>
                ) : match ? (
                  <>
                    <div className="flex items-end gap-3">
                      <span className={`font-serif text-5xl leading-none ${scoreTextColor(match.score)}`}>
                        {match.score}
                      </span>
                      <span className="text-charcoal/30 text-sm mb-1">/100</span>
                      <span className={`ml-auto text-xs px-2.5 py-1 ${scoreBadgeClass(match.score)}`}>
                        {match.label}
                      </span>
                    </div>
                    {match.tip && (
                      <p className="text-xs italic text-charcoal/60 leading-relaxed">
                        &ldquo;{match.tip}&rdquo;
                      </p>
                    )}

                    {/* Save button */}
                    {user && user !== "loading" ? (
                      <button
                        onClick={saveOutfit}
                        disabled={saving || saved}
                        className={`w-full py-2.5 text-xs tracking-[0.15em] uppercase transition-colors ${
                          saved
                            ? "bg-green-600/10 text-green-700 border border-green-200"
                            : "bg-charcoal text-cream hover:bg-taupe disabled:opacity-40"
                        }`}
                      >
                        {saving ? "Sparar..." : saved ? "Outfit sparad ✓" : "Spara outfit"}
                      </button>
                    ) : (
                      <p className="text-[10px] text-charcoal/40 text-center">
                        Logga in för att spara outfits
                      </p>
                    )}
                  </>
                ) : null}
              </div>
            )}
          </div>

          {/* ── Right: Product picker ─────────────────────────────────────── */}
          <div className="flex-1 min-w-0 flex flex-col gap-5">

            {/* Filter bar */}
            <div className="flex flex-wrap gap-2">
              {FILTERS.map((label) => (
                <button
                  key={label}
                  onClick={() => setActiveFilter(label)}
                  className={`px-4 py-1.5 text-xs tracking-[0.12em] uppercase border transition-colors duration-150 ${
                    activeFilter === label
                      ? "border-charcoal bg-charcoal text-cream"
                      : "border-charcoal/20 text-charcoal/60 hover:border-charcoal/50 hover:text-charcoal"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Product grid */}
            {loadingProducts ? (
              <div className="flex items-center justify-center py-20">
                <svg className="animate-spin w-6 h-6 text-taupe" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                </svg>
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="flex flex-col items-center py-20 gap-3">
                <div className="w-px h-10 bg-taupe/30" />
                <p className="text-sm text-charcoal/40 tracking-wide">Inga produkter hittades</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {filteredProducts.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    onAdd={() => addProduct(product)}
                    isInOutfit={selectedIds.has(product.id)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
