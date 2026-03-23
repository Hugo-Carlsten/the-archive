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

// ─── Sub-components ───────────────────────────────────────────────────────────

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

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      className="w-4 h-4 transition-colors duration-200"
      viewBox="0 0 24 24"
      fill={filled ? "#2C2C2C" : "none"}
      stroke={filled ? "#2C2C2C" : "#2C2C2C"}
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

function ProductCard({
  product,
  wishlisted,
  onToggleWishlist,
}: {
  product: FeedProduct;
  wishlisted: boolean;
  onToggleWishlist: () => void;
}) {
  return (
    <article className="group flex flex-col">
      <div className="relative overflow-hidden bg-charcoal/5 aspect-[3/4]">
        <img
          src={product.imageUrl || "https://placehold.co/400x500/F5F0E8/2C2C2C?text=The+Archive"}
          alt={product.name}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
          className="transition-transform duration-500 group-hover:scale-105"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).src =
              "https://placehold.co/400x500/F5F0E8/2C2C2C?text=The+Archive";
          }}
        />

        {product.isSecondHand && (
          <span className="absolute top-2.5 left-2.5 px-2 py-0.5 bg-taupe text-cream text-[10px] tracking-widest uppercase">
            Second hand
          </span>
        )}

        <button
          onClick={onToggleWishlist}
          aria-label={wishlisted ? "Ta bort från wishlist" : "Lägg till i wishlist"}
          className="absolute top-2.5 right-2.5 w-8 h-8 flex items-center justify-center bg-cream/90 hover:bg-cream transition-colors"
        >
          <HeartIcon filled={wishlisted} />
        </button>
      </div>

      <div className="pt-3 flex flex-col gap-1 flex-1">
        <span className="text-[10px] tracking-[0.2em] text-taupe uppercase">{product.brand}</span>
        <h2 className="text-sm text-charcoal leading-snug">{product.name}</h2>
        <div className="flex items-baseline gap-2 mt-auto pt-2">
          <span className="text-sm font-medium text-charcoal">{product.price} kr</span>
          {product.originalPrice && (
            <span className="text-xs text-charcoal/40 line-through">{product.originalPrice} kr</span>
          )}
        </div>
      </div>
    </article>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

const FILTERS = ["Allt", "Nytt", "Second hand", "Ytterkläder", "Toppar", "Byxor", "Klänningar", "Skor"];

const CATEGORY_MAP: Record<string, string> = {
  "Ytterkläder": "outerwear",
  "Toppar": "top",
  "Byxor": "bottom",
  "Klänningar": "dress",
  "Skor": "shoes",
};

export default function FeedPage() {
  const [user, setUser] = useState<User | null | "loading">("loading");
  const [products, setProducts] = useState<FeedProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasProfile, setHasProfile] = useState(true);
  const [isRanked, setIsRanked] = useState(false);
  const [wishlist, setWishlist] = useState<Set<string>>(new Set());
  const [activeFilter, setActiveFilter] = useState("Allt");

  // ── Auth ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    return unsub;
  }, []);

  // ── Load products + recommendations ───────────────────────────────────────

  useEffect(() => {
    if (user === "loading") return;

    async function load() {
      setLoading(true);
      try {
        const uid = user && typeof user !== "string" ? (user as User).uid : null;
        console.log("[feed] Calling /api/get-recommendations with uid:", uid ?? "(none)");
        const res = await fetch("/api/get-recommendations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ uid: uid ?? "" }),
        });
        const data = await res.json();
        console.log("[feed] Response:", { hasProfile: data.hasProfile, ranked: data.ranked, productCount: data.products?.length });
        if (data.products?.length > 0) {
          console.log("[feed] First product imageUrl:", data.products[0].imageUrl);
        }
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
  }, [user]);

  // ── Load existing wishlist from Firestore ────────────────────────────────

  useEffect(() => {
    if (!user || user === "loading") return;
    const uid = (user as User).uid;

    getDocs(collection(db, "users", uid, "wishlist")).then((snap) => {
      setWishlist(new Set(snap.docs.map((d) => d.id)));
    });
  }, [user]);

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
      await setDoc(ref, {
        ...product,
        savedAt: Timestamp.now(),
      });
    }
  }

  // ── Filter ────────────────────────────────────────────────────────────────

  const filtered = products.filter((p) => {
    if (activeFilter === "Allt") return true;
    if (activeFilter === "Nytt") return !p.isSecondHand;
    if (activeFilter === "Second hand") return p.isSecondHand;
    return p.category === CATEGORY_MAP[activeFilter];
  });

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-cream px-6 py-12">
      <div className="max-w-6xl mx-auto">

        {/* Header */}
        <div className="flex flex-col items-center text-center mb-10">
          <div className="w-px h-10 bg-taupe/40 mb-6" />
          <h1 className="font-serif text-4xl text-charcoal tracking-tight mb-2">
            {isRanked ? "Din personliga feed" : "Feed"}
          </h1>
          <p className="text-sm text-charcoal/50 tracking-wide">
            {loading ? "Laddar..." : `${filtered.length} plagg`}
            {isRanked && !loading && (
              <span className="ml-2 text-taupe">· Anpassad för din stil</span>
            )}
          </p>
          <div className="w-16 h-px bg-taupe/40 mt-6" />
        </div>

        {/* No profile banner */}
        {!loading && !hasProfile && (
          <div className="mb-10 border border-taupe/30 bg-taupe/5 px-6 py-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <p className="text-sm text-charcoal font-medium mb-1">
                Skapa din stilprofil för personliga förslag
              </p>
              <p className="text-xs text-charcoal/50">
                Berätta om din stil så anpassar vi feeden efter dig
              </p>
            </div>
            <Link
              href="/onboarding"
              className="flex-shrink-0 px-6 py-2.5 bg-charcoal text-cream text-xs tracking-[0.15em] uppercase hover:bg-taupe transition-colors duration-200"
            >
              Kom igång →
            </Link>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap gap-2 mb-10 justify-center">
          {FILTERS.map((label) => (
            <button
              key={label}
              onClick={() => setActiveFilter(label)}
              className={`px-4 py-1.5 text-xs tracking-[0.12em] uppercase border transition-colors duration-200 ${
                activeFilter === label
                  ? "border-charcoal bg-charcoal text-cream"
                  : "border-charcoal/20 text-charcoal/60 hover:border-charcoal/50 hover:text-charcoal"
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
  );
}
