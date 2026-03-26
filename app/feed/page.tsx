"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { onAuthStateChanged, User } from "firebase/auth";
import { doc, setDoc, deleteDoc, getDocs, collection, Timestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import type { Product } from "@/lib/firestore-setup";

interface FeedProduct extends Product {
  id: string;
}

interface SessionIntent {
  categories: string[];
  description: string;
}

// ─── Intent Modal ─────────────────────────────────────────────────────────────

const INTENT_CATEGORIES = ["Toppar", "Byxor", "Jackor", "Skor", "Klänningar"];

const CATEGORY_TO_API: Record<string, string> = {
  Toppar: "top",
  Byxor: "bottom",
  Jackor: "outerwear",
  Skor: "shoes",
  Klänningar: "dress",
};

function IntentModal({
  onConfirm,
  onSkip,
}: {
  onConfirm: (intent: SessionIntent) => void;
  onSkip: () => void;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [description, setDescription] = useState("");

  function toggleCategory(label: string) {
    setSelected((prev) =>
      prev.includes(label) ? prev.filter((c) => c !== label) : [...prev, label]
    );
  }

  function handleConfirm() {
    onConfirm({
      categories: selected.map((l) => CATEGORY_TO_API[l]),
      description: description.trim(),
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-charcoal/20 backdrop-blur-[2px]"
        onClick={onSkip}
      />

      {/* Modal */}
      <div
        className="relative bg-cream border border-border w-full max-w-md px-8 py-10 animate-fade-in-up"
        style={{ animationDuration: "0.4s" }}
      >
        {/* Decorative top line */}
        <div className="flex justify-center mb-8">
          <div className="w-px h-8 bg-border" />
        </div>

        <h2 className="font-serif text-2xl text-charcoal tracking-wide text-center mb-2">
          Vad letar du efter idag?
        </h2>
        <p className="text-[10px] tracking-[0.2em] text-charcoal/40 uppercase text-center mb-8">
          Vi anpassar dina rekommendationer
        </p>

        <div className="w-12 h-px bg-border mx-auto mb-8" />

        {/* Category buttons */}
        <div className="flex flex-wrap gap-2 justify-center mb-8">
          {INTENT_CATEGORIES.map((label) => (
            <button
              key={label}
              onClick={() => toggleCategory(label)}
              className={`px-5 py-2 text-[9px] tracking-[0.2em] uppercase border transition-colors duration-200 ${
                selected.includes(label)
                  ? "bg-midnight border-midnight text-cream"
                  : "bg-cream border-border text-charcoal/60 hover:border-charcoal/40 hover:text-charcoal"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Freetext */}
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value.slice(0, 200))}
          placeholder="T.ex. letar efter vita skjortor, något till jobbet..."
          rows={3}
          className="w-full bg-cream border border-border px-4 py-3 text-xs text-charcoal placeholder-charcoal/30 tracking-wide resize-none outline-none focus:border-charcoal/40 transition-colors duration-200 mb-6"
        />
        <p className="text-[9px] text-charcoal/30 text-right -mt-4 mb-6 tracking-wide">
          {description.length}/200
        </p>

        {/* Actions */}
        <button
          onClick={handleConfirm}
          className="w-full py-3.5 bg-midnight text-cream text-xs tracking-[0.25em] uppercase hover:bg-charcoal transition-colors duration-300 mb-3"
        >
          Visa rekommendationer
        </button>
        <button
          onClick={onSkip}
          className="w-full py-2.5 text-[10px] tracking-[0.2em] text-charcoal/40 uppercase hover:text-charcoal transition-colors duration-200"
        >
          Hoppa över
        </button>
      </div>
    </div>
  );
}

// ─── Spinner ──────────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <div className="flex flex-col items-center gap-4 py-24">
      <svg className="animate-spin w-6 h-6 text-taupe" viewBox="0 0 24 24" fill="none">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
      </svg>
      <p className="text-xs tracking-[0.2em] text-charcoal/40 uppercase">Hämtar din feed...</p>
    </div>
  );
}

// ─── HeartIcon ────────────────────────────────────────────────────────────────

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      className="w-4 h-4 transition-colors duration-200"
      viewBox="0 0 24 24"
      fill={filled ? "#2C2C2C" : "none"}
      stroke="#2C2C2C"
      strokeWidth="1.5"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z"
      />
    </svg>
  );
}

// ─── ProductCard ──────────────────────────────────────────────────────────────

function ProductCard({
  product,
  wishlisted,
  onToggleWishlist,
}: {
  product: FeedProduct;
  wishlisted: boolean;
  onToggleWishlist: () => void;
}) {
  const hasDiscount = product.originalPrice != null && product.originalPrice > product.price;
  const discountPct = hasDiscount
    ? Math.round(((product.originalPrice! - product.price) / product.originalPrice!) * 100)
    : 0;

  return (
    <article className="group flex flex-col">
      <a
        href={product.link}
        target="_blank"
        rel="noopener noreferrer"
        className="block relative overflow-hidden border border-border aspect-[3/4]"
      >
        <img
          src={product.imageUrl || "https://placehold.co/400x500/F5F0E8/2C2C2C?text=The+Archive"}
          alt={product.name}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
          className="transition-transform duration-700 ease-out group-hover:scale-[1.04]"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).src =
              "https://placehold.co/400x500/F5F0E8/2C2C2C?text=The+Archive";
          }}
        />

        {product.isSecondHand && (
          <span className="absolute top-3 left-3 px-2 py-0.5 bg-taupe text-cream text-[9px] tracking-[0.2em] uppercase">
            Second hand
          </span>
        )}

        {hasDiscount && (
          <span className="absolute top-3 left-3 px-2 py-0.5 bg-midnight text-cream text-[9px] tracking-[0.2em] uppercase">
            -{discountPct}%
          </span>
        )}

        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onToggleWishlist();
          }}
          aria-label={wishlisted ? "Ta bort från wishlist" : "Lägg till i wishlist"}
          className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center bg-cream/95 hover:bg-cream transition-colors duration-200"
        >
          <HeartIcon filled={wishlisted} />
        </button>
      </a>

      <div className="pt-4 flex flex-col gap-1.5 flex-1">
        <span className="text-[9px] tracking-[0.3em] text-taupe uppercase">{product.brand}</span>
        <h2 className="text-xs text-charcoal/70 leading-snug tracking-wide">{product.name}</h2>
        <div className="flex items-baseline gap-2 mt-auto pt-2">
          <span className={`text-sm tracking-wide ${hasDiscount ? "text-midnight font-medium" : "text-charcoal"}`}>
            {product.price} kr
          </span>
          {hasDiscount && (
            <span className="text-xs text-charcoal/30 line-through">{product.originalPrice} kr</span>
          )}
        </div>
      </div>
    </article>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

const FILTERS = ["Allt", "Nytt", "Second hand", "Ytterkläder", "Toppar", "Byxor", "Klänningar", "Skor"];

const FILTER_CATEGORY_MAP: Record<string, string> = {
  "Ytterkläder": "outerwear",
  "Toppar": "top",
  "Byxor": "bottom",
  "Klänningar": "dress",
  "Skor": "shoes",
};

const SESSION_KEY = "feed_intent_shown";

export default function FeedPage() {
  const [user, setUser] = useState<User | null | "loading">("loading");
  const [products, setProducts] = useState<FeedProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasProfile, setHasProfile] = useState(true);
  const [isRanked, setIsRanked] = useState(false);
  const [wishlist, setWishlist] = useState<Set<string>>(new Set());
  const [activeFilter, setActiveFilter] = useState("Allt");

  // "pending" = haven't checked sessionStorage yet
  // "visible" = modal is open
  // "done"    = modal dismissed, safe to load
  const [modalState, setModalState] = useState<"pending" | "visible" | "done">("pending");
  const [sessionIntent, setSessionIntent] = useState<SessionIntent | null>(null);

  // ── Auth ────────────────────────────────────────────────────────────────────

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    return unsub;
  }, []);

  // ── Decide whether to show modal ─────────────────────────────────────────────

  useEffect(() => {
    if (user === "loading") return;
    const alreadyShown = sessionStorage.getItem(SESSION_KEY);
    if (alreadyShown) {
      setModalState("done");
    } else {
      setModalState("visible");
    }
  }, [user]);

  // ── Load products (fires once modal is resolved) ──────────────────────────

  useEffect(() => {
    if (user === "loading" || modalState !== "done") return;

    async function load() {
      setLoading(true);
      try {
        const uid = user && typeof user !== "string" ? (user as User).uid : null;
        const body: Record<string, unknown> = { uid: uid ?? "" };
        if (sessionIntent?.categories.length) body.sessionCategories = sessionIntent.categories;
        if (sessionIntent?.description) body.sessionDescription = sessionIntent.description;

        const res = await fetch("/api/get-recommendations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        setProducts(data.products ?? []);
        setHasProfile(data.hasProfile !== false);
        setIsRanked(data.ranked === true);
      } catch {
        setProducts([]);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [user, modalState]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Load existing wishlist from Firestore ────────────────────────────────

  useEffect(() => {
    if (!user || user === "loading") return;
    const uid = (user as User).uid;
    getDocs(collection(db, "users", uid, "wishlist")).then((snap) => {
      setWishlist(new Set(snap.docs.map((d) => d.id)));
    });
  }, [user]);

  // ── Modal handlers ────────────────────────────────────────────────────────

  function handleModalConfirm(intent: SessionIntent) {
    sessionStorage.setItem(SESSION_KEY, "1");
    setSessionIntent(intent);
    setModalState("done");
  }

  function handleModalSkip() {
    sessionStorage.setItem(SESSION_KEY, "1");
    setModalState("done");
  }

  // ── Toggle wishlist ───────────────────────────────────────────────────────

  async function toggleWishlist(product: FeedProduct) {
    if (!user || user === "loading") return;
    const uid = (user as User).uid;
    const ref = doc(db, "users", uid, "wishlist", product.id);

    setWishlist((prev) => {
      const next = new Set(prev);
      if (next.has(product.id)) { next.delete(product.id); } else { next.add(product.id); }
      return next;
    });

    if (wishlist.has(product.id)) {
      await deleteDoc(ref);
    } else {
      await setDoc(ref, { ...product, savedAt: Timestamp.now() });
    }
  }

  // ── Filter ────────────────────────────────────────────────────────────────

  const filtered = products.filter((p) => {
    if (activeFilter === "Allt") return true;
    if (activeFilter === "Nytt") return !p.isSecondHand;
    if (activeFilter === "Second hand") return p.isSecondHand;
    return p.category === FILTER_CATEGORY_MAP[activeFilter];
  });

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      {modalState === "visible" && (
        <IntentModal onConfirm={handleModalConfirm} onSkip={handleModalSkip} />
      )}

      <div className="min-h-screen bg-cream px-6 py-12">
        <div className="max-w-6xl mx-auto">

          {/* Header */}
          <div className="flex flex-col items-center text-center mb-14">
            <div className="w-px h-12 bg-border mb-8" />
            <h1 className="font-serif text-5xl sm:text-6xl text-charcoal tracking-[0.04em] mb-3">
              {isRanked ? "Din personliga feed" : "Feed"}
            </h1>
            <p className="text-[10px] tracking-[0.3em] text-charcoal/40 uppercase">
              {loading ? "Laddar..." : `${filtered.length} plagg`}
              {isRanked && !loading && (
                <span className="ml-3 text-taupe">· Anpassad för din stil</span>
              )}
            </p>
            <div className="w-12 h-px bg-border mt-8" />
          </div>

          {/* No profile banner */}
          {!loading && !hasProfile && (
            <div className="mb-12 border border-border px-8 py-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <p className="text-sm text-charcoal tracking-wide mb-1">
                  Skapa din stilprofil för personliga förslag
                </p>
                <p className="text-xs text-charcoal/40 tracking-wide">
                  Berätta om din stil så anpassar vi feeden efter dig
                </p>
              </div>
              <Link
                href="/onboarding"
                className="flex-shrink-0 px-8 py-3 bg-midnight text-cream text-xs tracking-[0.2em] uppercase hover:bg-charcoal transition-colors duration-300"
              >
                Kom igång
              </Link>
            </div>
          )}

          {/* Active intent badge */}
          {sessionIntent && (sessionIntent.categories.length > 0 || sessionIntent.description) && (
            <div className="flex items-center justify-center gap-3 mb-10">
              <div className="h-px flex-1 bg-border" />
              <p className="text-[9px] tracking-[0.2em] text-taupe uppercase whitespace-nowrap">
                Filtrerat för din sökning
              </p>
              <div className="h-px flex-1 bg-border" />
            </div>
          )}

          {/* Filters */}
          <div className="flex flex-wrap gap-2 mb-12 justify-center">
            {FILTERS.map((label) => (
              <button
                key={label}
                onClick={() => setActiveFilter(label)}
                className={`px-5 py-2 text-[9px] tracking-[0.2em] uppercase border transition-colors duration-300 ${
                  activeFilter === label
                    ? "border-midnight bg-midnight text-cream"
                    : "border-border text-charcoal/50 hover:border-charcoal/40 hover:text-charcoal"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Content */}
          {loading ? (
            <Spinner />
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center py-24 gap-3">
              <div className="w-px h-10 bg-taupe/30" />
              <p className="text-sm text-charcoal/40 tracking-wide">Inga plagg hittades</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-5">
              {filtered.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  wishlisted={wishlist.has(product.id)}
                  onToggleWishlist={() => toggleWishlist(product)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
