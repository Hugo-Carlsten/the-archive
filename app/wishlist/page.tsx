"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { onAuthStateChanged, User } from "firebase/auth";
import { doc, deleteDoc, getDocs, collection } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import type { Product } from "@/lib/firestore-setup";

interface WishlistProduct extends Product {
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
      <p className="text-xs tracking-[0.2em] text-charcoal/40 uppercase">Laddar wishlist...</p>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-32 text-center px-6">
      <div className="w-px h-12 bg-taupe/40 mb-10" />
      <div className="mb-8">
        <svg
          className="w-12 h-12 text-taupe/40 mx-auto"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z"
          />
        </svg>
      </div>
      <h2 className="font-serif text-3xl text-charcoal tracking-tight mb-4">Din wishlist är tom</h2>
      <div className="w-16 h-px bg-taupe/40 my-5" />
      <p className="text-sm text-charcoal/50 tracking-wide leading-relaxed max-w-xs mb-10">
        Bläddra i feeden och tryck på hjärtikonen för att spara plagg du gillar.
      </p>
      <Link
        href="/feed"
        className="px-10 py-3.5 border border-charcoal/30 text-charcoal text-sm tracking-[0.15em] uppercase hover:border-taupe hover:text-taupe transition-colors duration-300"
      >
        Utforska feeden
      </Link>
      <div className="w-px h-12 bg-taupe/40 mt-10" />
    </div>
  );
}

function WishlistCard({
  product,
  onRemove,
}: {
  product: WishlistProduct;
  onRemove: () => void;
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
        className="block relative overflow-hidden bg-charcoal/5 aspect-[3/4]"
      >
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

        {hasDiscount && (
          <span className="absolute top-2.5 right-10 px-2 py-0.5 bg-green-700 text-white text-[10px] tracking-widest uppercase">
            -{discountPct}%
          </span>
        )}

        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onRemove();
          }}
          aria-label="Ta bort från wishlist"
          className="absolute top-2.5 right-2.5 w-8 h-8 flex items-center justify-center bg-cream/90 hover:bg-cream transition-colors"
        >
          <svg
            className="w-4 h-4"
            viewBox="0 0 24 24"
            fill="#2C2C2C"
            stroke="#2C2C2C"
            strokeWidth="1.5"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z"
            />
          </svg>
        </button>
      </a>

      <div className="pt-3 flex flex-col gap-1 flex-1">
        <span className="text-[10px] tracking-[0.2em] text-taupe uppercase">{product.brand}</span>
        <h3 className="text-sm text-charcoal leading-snug">{product.name}</h3>
        <div className="flex items-baseline gap-2 mt-auto pt-2">
          <span className={`text-sm font-medium ${hasDiscount ? "text-green-700" : "text-charcoal"}`}>
            {product.price} kr
          </span>
          {hasDiscount && (
            <span className="text-xs text-charcoal/40 line-through">{product.originalPrice} kr</span>
          )}
        </div>
      </div>
    </article>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function WishlistPage() {
  const [user, setUser] = useState<User | null | "loading">("loading");
  const [items, setItems] = useState<WishlistProduct[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    return unsub;
  }, []);

  useEffect(() => {
    if (user === "loading") return;

    if (!user) {
      setLoading(false);
      return;
    }

    const uid = (user as User).uid;
    getDocs(collection(db, "users", uid, "wishlist")).then((snap) => {
      const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() } as WishlistProduct));
      setItems(docs);
      setLoading(false);
    });
  }, [user]);

  async function removeFromWishlist(productId: string) {
    if (!user || user === "loading") return;
    const uid = (user as User).uid;

    setItems((prev) => prev.filter((p) => p.id !== productId));
    await deleteDoc(doc(db, "users", uid, "wishlist", productId));
  }

  // ── Stats ─────────────────────────────────────────────────────────────────

  const totalValue = items.reduce((sum, p) => sum + p.price, 0);
  const secondHandCount = items.filter((p) => p.isSecondHand).length;
  const discountedItems = items.filter(
    (p) => p.originalPrice != null && p.originalPrice > p.price
  );

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-cream px-6 py-12">
      <div className="max-w-6xl mx-auto">

        {/* Header */}
        <div className="flex flex-col items-center text-center mb-10">
          <div className="w-px h-10 bg-taupe/40 mb-6" />
          <h1 className="font-serif text-4xl text-charcoal tracking-tight mb-2">Wishlist</h1>
          {!loading && items.length > 0 && (
            <p className="text-sm text-charcoal/50 tracking-wide">{items.length} sparade plagg</p>
          )}
          <div className="w-16 h-px bg-taupe/40 mt-6" />
        </div>

        {loading ? (
          <Spinner />
        ) : items.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            {/* Stats bar */}
            <div className="grid grid-cols-3 gap-px bg-charcoal/10 border border-charcoal/10 mb-10">
              {[
                { label: "Sparade plagg", value: items.length.toString() },
                {
                  label: "Totalt värde",
                  value: totalValue.toLocaleString("sv-SE") + " kr",
                },
                { label: "Second hand", value: secondHandCount.toString() },
              ].map(({ label, value }) => (
                <div key={label} className="bg-cream px-4 py-5 text-center">
                  <p className="font-serif text-2xl text-charcoal mb-1">{value}</p>
                  <p className="text-[10px] tracking-[0.15em] text-charcoal/40 uppercase">{label}</p>
                </div>
              ))}
            </div>

            {/* Price drops section */}
            {discountedItems.length > 0 && (
              <section className="mb-12">
                <div className="flex items-center gap-4 mb-6">
                  <div className="h-px flex-1 bg-charcoal/10" />
                  <h2 className="font-serif text-xl text-charcoal tracking-wide">Prissänkningar</h2>
                  <div className="h-px flex-1 bg-charcoal/10" />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-5">
                  {discountedItems.map((product) => (
                    <WishlistCard
                      key={product.id}
                      product={product}
                      onRemove={() => removeFromWishlist(product.id)}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* All items */}
            <section>
              {discountedItems.length > 0 && (
                <div className="flex items-center gap-4 mb-6">
                  <div className="h-px flex-1 bg-charcoal/10" />
                  <h2 className="font-serif text-xl text-charcoal tracking-wide">Alla sparade</h2>
                  <div className="h-px flex-1 bg-charcoal/10" />
                </div>
              )}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-5">
                {items.map((product) => (
                  <WishlistCard
                    key={product.id}
                    product={product}
                    onRemove={() => removeFromWishlist(product.id)}
                  />
                ))}
              </div>
            </section>

            {/* Bottom link */}
            <div className="flex flex-col items-center mt-16">
              <div className="w-px h-10 bg-taupe/40 mb-6" />
              <Link
                href="/feed"
                className="px-10 py-3.5 border border-charcoal/30 text-charcoal text-sm tracking-[0.15em] uppercase hover:border-taupe hover:text-taupe transition-colors duration-300"
              >
                Utforska fler plagg
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
