"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { onAuthStateChanged, User } from "firebase/auth";
import { collection, doc, getDocs, setDoc, Timestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import type { Product } from "@/lib/firestore-setup";
import { useSubscription } from "@/hooks/useSubscription";

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
  critique: string;
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

const COLOR_MAP: Record<string, string> = {
  svart: "#2C2C2C",
  vitt: "#F5F0E8",
  vit: "#F5F0E8",
  beige: "#C8A882",
  sand: "#C8A882",
  grå: "#9E9E9E",
  gray: "#9E9E9E",
  navy: "#1C2B4A",
  marinblå: "#1C2B4A",
  mörkblå: "#1C2B4A",
  brun: "#6B4226",
  grön: "#4A5240",
  olivgrön: "#4A5240",
  olive: "#4A5240",
  khaki: "#8B7D5A",
  "off-white": "#F0EBE0",
  cremevit: "#F0EBE0",
};

function colorDotBg(colorName: string): string {
  const key = colorName.toLowerCase().trim();
  for (const [k, v] of Object.entries(COLOR_MAP)) {
    if (key.includes(k)) return v;
  }
  return "#B5956A";
}

function ColorDots({ colors }: { colors: string[] }) {
  const visible = colors.filter(Boolean);
  if (visible.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-x-2 gap-y-0.5">
      {visible.map((c) => (
        <div key={c} className="flex items-center gap-1">
          <span
            className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0"
            style={{
              backgroundColor: colorDotBg(c),
              border: colorDotBg(c) === "#F5F0E8" || colorDotBg(c) === "#F0EBE0"
                ? "1px solid #D0C9BE"
                : undefined,
            }}
          />
          <span style={{ fontSize: 10, color: "#9E9090", textTransform: "capitalize" }}>{c}</span>
        </div>
      ))}
    </div>
  );
}

function StyleTag({ tag, highlight }: { tag: string; highlight: boolean }) {
  return (
    <span
      className={`inline-block px-1.5 py-0.5 text-[9px] tracking-[0.12em] uppercase border leading-none ${
        highlight
          ? "bg-taupe/15 border-taupe text-taupe"
          : "bg-cream border-border text-charcoal/40"
      }`}
    >
      {tag}
    </span>
  );
}

function SlotCard({
  slot,
  product,
  onRemove,
  sharedStyles,
}: {
  slot: { key: SlotKey; emoji: string; label: string };
  product: FeedProduct | null;
  onRemove: () => void;
  sharedStyles: Set<string>;
}) {
  if (product) {
    const tags = Array.isArray(product.style) ? product.style : [];
    return (
      <div className="flex flex-col border border-charcoal bg-charcoal/5">
        <div className="relative aspect-[3/4] overflow-hidden">
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
        <div className="flex flex-col gap-1 px-1.5 py-1.5 bg-cream">
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {tags.map((tag) => (
                <StyleTag key={tag} tag={tag} highlight={sharedStyles.has(tag)} />
              ))}
            </div>
          )}
          <ColorDots colors={Array.isArray(product.colors) ? product.colors : []} />
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
  outfitStyles,
}: {
  product: FeedProduct;
  onAdd: () => void;
  isInOutfit: boolean;
  outfitStyles: Set<string>;
}) {
  const tags = Array.isArray(product.style) ? product.style : [];
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
      <div className="p-2 flex flex-col gap-1">
        <p className="text-[10px] tracking-[0.15em] text-taupe uppercase">{product.brand}</p>
        <p className="text-xs text-charcoal leading-snug line-clamp-2">{product.name}</p>
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-0.5">
            {tags.map((tag) => (
              <StyleTag key={tag} tag={tag} highlight={outfitStyles.has(tag)} />
            ))}
          </div>
        )}
        <ColorDots colors={Array.isArray(product.colors) ? product.colors : []} />
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
  const { hasAITips, maxSavedOutfits } = useSubscription();
  const [activeFilter, setActiveFilter] = useState("Alla");
  const [matchResult, setMatchResult] = useState<MatchResult | null>(null);
  const [outfitLimitModal, setOutfitLimitModal] = useState(false);
  const [loadingMatch, setLoadingMatch] = useState(false);
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

  // Stable key that changes only when the selected product IDs change
  const slotKey = SLOTS.map((s) => slots[s.key]?.id ?? "").join("|");
  const filledSlots = SLOTS.filter((s) => slots[s.key] !== null);
  const filledCount = filledSlots.length;

  useEffect(() => {
    const currentFilled = SLOTS.filter((s) => slots[s.key] !== null);

    if (currentFilled.length < 2) {
      setMatchResult(null);
      return;
    }

    const selectedItems = currentFilled.map((s) => {
      const p = slots[s.key]!;
      return {
        name: p.name,
        brand: p.brand ?? "",
        category: s.key,
        style: Array.isArray(p.style) ? p.style : [],
        colors: Array.isArray(p.colors) ? p.colors : [],
      };
    });

    console.log("[outfit-match] Anropar outfit-match med:", selectedItems.map((i) => i.name));

    let cancelled = false;

    async function fetchMatch() {
      setLoadingMatch(true);
      try {
        const res = await fetch("/api/outfit-match", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items: selectedItems }),
        });
        const data = await res.json();
        console.log("Outfit match response:", data);
        if (!cancelled) {
          setMatchResult({
            score: Number(data.score) || 0,
            label: String(data.label ?? ""),
            critique: String(data.critique ?? ""),
            tip: String(data.tip ?? ""),
          });
        }
      } catch (err) {
        console.error("[outfit-match] Fel:", err);
        if (!cancelled) setMatchResult(null);
      } finally {
        if (!cancelled) setLoadingMatch(false);
      }
    }

    fetchMatch();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slotKey]);

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
    setMatchResult(null);
    setSaved(false);
  }

  async function saveOutfit() {
    if (!user || user === "loading" || !matchResult?.score) return;
    // Check outfit limit for free users
    if (maxSavedOutfits !== null) {
      const uid = (user as User).uid;
      const snap = await getDocs(collection(db, "users", uid, "outfits"));
      if (snap.size >= maxSavedOutfits) {
        setOutfitLimitModal(true);
        return;
      }
    }
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
        score: matchResult.score,
        label: matchResult.label,
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

  // Styles appearing in 2+ filled slots → highlighted as shared
  const styleCount: Record<string, number> = {};
  SLOTS.forEach((s) => {
    const p = slots[s.key];
    if (p && Array.isArray(p.style)) {
      p.style.forEach((tag) => { styleCount[tag] = (styleCount[tag] ?? 0) + 1; });
    }
  });
  const sharedStyles = new Set(
    Object.entries(styleCount).filter(([, n]) => n >= 2).map(([tag]) => tag)
  );

  // All styles in any filled slot → highlight matches in picker
  const outfitStyles = new Set(
    SLOTS.flatMap((s) => (slots[s.key] && Array.isArray(slots[s.key]!.style)) ? slots[s.key]!.style : [])
  );

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <>
    {/* Outfit limit modal */}
    {outfitLimitModal && (
      <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
        <div className="absolute inset-0 bg-charcoal/30 backdrop-blur-[2px]" onClick={() => setOutfitLimitModal(false)} />
        <div className="relative bg-cream border border-border w-full max-w-sm px-8 py-10 flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <h2 className="font-serif text-xl text-charcoal tracking-wide">Du har sparat {maxSavedOutfits} outfits</h2>
            <p className="text-sm text-charcoal/55 leading-relaxed">
              Free-planen tillåter max {maxSavedOutfits} sparade outfits. Uppgradera till Plus för obegränsade outfits.
            </p>
          </div>
          <Link
            href="/uppgradera"
            className="w-full py-3 text-xs tracking-[0.15em] uppercase text-center"
            style={{ background: "#1C2B2D", color: "#F5F0E8" }}
          >
            Uppgradera till Plus
          </Link>
          <button
            onClick={() => setOutfitLimitModal(false)}
            className="w-full py-2 text-xs tracking-[0.12em] uppercase text-charcoal/40 hover:text-charcoal transition-colors"
          >
            Stäng
          </button>
        </div>
      </div>
    )}
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
                  sharedStyles={sharedStyles}
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
                ) : matchResult && matchResult.score > 0 ? (
                  <>
                    {/* Score + label */}
                    <div className="flex items-end gap-3">
                      <span className={`font-serif text-5xl leading-none ${scoreTextColor(matchResult.score)}`}>
                        {matchResult.score}
                      </span>
                      <span className="text-charcoal/30 text-sm mb-1">/100</span>
                      {matchResult.label ? (
                        <span className={`ml-auto text-xs px-2.5 py-1 ${scoreBadgeClass(matchResult.score)}`}>
                          {matchResult.label}
                        </span>
                      ) : null}
                    </div>

                    {/* Analys + Tips — Plus/Premium only */}
                    {hasAITips ? (
                      <>
                        {matchResult.critique ? (
                          <div className="flex flex-col gap-1">
                            <span style={{ fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", color: "#B5956A" }}>
                              Analys
                            </span>
                            <p
                              style={{
                                fontSize: 13,
                                fontStyle: "italic",
                                lineHeight: 1.55,
                                color:
                                  matchResult.score >= 80
                                    ? "#4a7c59"
                                    : matchResult.score < 60
                                    ? "#b94040"
                                    : "#666666",
                              }}
                            >
                              {matchResult.critique}
                            </p>
                          </div>
                        ) : null}
                        {matchResult.tip ? (
                          <div className="flex flex-col gap-1">
                            <span style={{ fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", color: "#B5956A" }}>
                              Tips
                            </span>
                            <p style={{ fontSize: 13, lineHeight: 1.55, color: "#B5956A" }}>
                              {matchResult.tip}
                            </p>
                          </div>
                        ) : null}
                      </>
                    ) : (
                      <div className="flex flex-col gap-2 border border-charcoal/8 p-3 bg-charcoal/3">
                        <div className="flex items-center gap-2">
                          <svg className="w-3.5 h-3.5 text-charcoal/30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M7 11V7a5 5 0 0110 0v4" />
                          </svg>
                          <span style={{ fontSize: 10, letterSpacing: "0.15em", textTransform: "uppercase", color: "#9E9090" }}>
                            AI-analys och stilråd
                          </span>
                        </div>
                        <p className="text-xs text-charcoal/40 leading-snug">
                          Ingår i Plus och Premium
                        </p>
                        <Link
                          href="/uppgradera"
                          className="self-start text-[10px] tracking-[0.12em] uppercase transition-colors duration-200"
                          style={{ color: "#B5956A" }}
                        >
                          Uppgradera →
                        </Link>
                      </div>
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
                    outfitStyles={outfitStyles}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
    </>
  );
}
