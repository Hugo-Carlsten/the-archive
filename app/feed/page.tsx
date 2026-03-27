"use client";

import {
  useState, useEffect, useRef,
  forwardRef, useImperativeHandle, Fragment,
} from "react";
import Link from "next/link";
import { onAuthStateChanged, User } from "firebase/auth";
import {
  doc, setDoc, deleteDoc, getDocs, collection, Timestamp,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import type { Product } from "@/lib/firestore-setup";
import { useSubscription } from "@/hooks/useSubscription";

// ─── Types ────────────────────────────────────────────────────────────────────

interface FeedProduct extends Product { id: string; }
interface SessionIntent { categories: string[]; description: string; }

// ─── Constants ────────────────────────────────────────────────────────────────

const INTENT_CATEGORIES = ["Toppar", "Byxor", "Jackor", "Skor", "Klänningar"];
const CATEGORY_TO_API: Record<string, string> = {
  Toppar: "top", Byxor: "bottom", Jackor: "outerwear", Skor: "shoes", Klänningar: "dress",
};
const FILTERS = ["Allt", "Nytt", "Second hand", "Ytterkläder", "Toppar", "Byxor", "Klänningar", "Skor"];
const FILTER_CAT: Record<string, string> = {
  Ytterkläder: "outerwear", Toppar: "top", Byxor: "bottom", Klänningar: "dress", Skor: "shoes",
};
const SK_MODE   = "feed_mode";
const SK_INTENT = "feed_intent_shown";
const SK_SEEN   = "feed_seen_ids";
const SWIPE_THRESHOLD = 100;

// ─── ModeSelector ─────────────────────────────────────────────────────────────

function ModeSelector({ onSelect }: { onSelect: (m: "swipe" | "browse") => void }) {
  return (
    <div className="min-h-[calc(100vh-4rem)] bg-cream flex flex-col items-center justify-center px-6 py-20">
      <div className="w-px h-10 bg-border mb-8" />
      <h1 className="font-serif text-3xl sm:text-4xl text-charcoal tracking-wide text-center mb-3">
        Hur vill du utforska idag?
      </h1>
      <p className="text-[10px] tracking-[0.3em] text-charcoal/40 uppercase text-center mb-10">
        Välj ditt läge
      </p>
      <div className="w-12 h-px bg-border mb-12" />

      <div className="grid grid-cols-2 gap-4 w-full max-w-lg">
        <button
          onClick={() => onSelect("swipe")}
          className="flex flex-col items-center justify-center gap-5 p-8 sm:p-10 bg-midnight text-cream border border-midnight hover:bg-charcoal transition-colors duration-300"
        >
          <svg className="w-10 h-10 opacity-70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
          </svg>
          <div className="text-center">
            <p className="font-serif text-lg tracking-wide mb-1.5">Let&apos;s Swipe!</p>
            <p className="text-[9px] tracking-[0.2em] uppercase text-cream/50">Utforska ett plagg i taget</p>
          </div>
        </button>

        <button
          onClick={() => onSelect("browse")}
          className="flex flex-col items-center justify-center gap-5 p-8 sm:p-10 bg-cream text-charcoal border border-border hover:border-charcoal/40 transition-colors duration-300"
        >
          <svg className="w-10 h-10 text-charcoal/50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
            <rect x="3" y="3" width="7" height="7" rx="0.5" />
            <rect x="14" y="3" width="7" height="7" rx="0.5" />
            <rect x="3" y="14" width="7" height="7" rx="0.5" />
            <rect x="14" y="14" width="7" height="7" rx="0.5" />
          </svg>
          <div className="text-center">
            <p className="font-serif text-lg tracking-wide mb-1.5">Browse The Archive</p>
            <p className="text-[9px] tracking-[0.2em] uppercase text-charcoal/40">Bläddra genom hela kollektionen</p>
          </div>
        </button>
      </div>

      <div className="w-px h-10 bg-border mt-12" />
    </div>
  );
}

// ─── IntentModal ──────────────────────────────────────────────────────────────

function IntentModal({ onConfirm, onSkip }: {
  onConfirm: (intent: SessionIntent) => void;
  onSkip: () => void;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [description, setDescription] = useState("");

  function toggle(label: string) {
    setSelected((p) => p.includes(label) ? p.filter((c) => c !== label) : [...p, label]);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-charcoal/20 backdrop-blur-[2px]" onClick={onSkip} />
      <div className="relative bg-cream border border-border w-full max-w-md px-8 py-10 animate-fade-in-up" style={{ animationDuration: "0.4s" }}>
        <div className="flex justify-center mb-8"><div className="w-px h-8 bg-border" /></div>
        <h2 className="font-serif text-2xl text-charcoal tracking-wide text-center mb-2">
          Vad letar du efter idag?
        </h2>
        <p className="text-[10px] tracking-[0.2em] text-charcoal/40 uppercase text-center mb-8">
          Vi anpassar dina rekommendationer
        </p>
        <div className="w-12 h-px bg-border mx-auto mb-8" />
        <div className="flex flex-wrap gap-2 justify-center mb-8">
          {INTENT_CATEGORIES.map((label) => (
            <button
              key={label}
              onClick={() => toggle(label)}
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
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value.slice(0, 200))}
          placeholder="T.ex. letar efter vita skjortor, något till jobbet..."
          rows={3}
          className="w-full bg-cream border border-border px-4 py-3 text-xs text-charcoal placeholder-charcoal/30 tracking-wide resize-none outline-none focus:border-charcoal/40 transition-colors duration-200 mb-1"
        />
        <p className="text-[9px] text-charcoal/30 text-right mb-6 tracking-wide">{description.length}/200</p>
        <button
          onClick={() => onConfirm({ categories: selected.map((l) => CATEGORY_TO_API[l]), description: description.trim() })}
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
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill={filled ? "#2C2C2C" : "none"} stroke="#2C2C2C" strokeWidth="1.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
    </svg>
  );
}

// ─── LockedCard (browse mode — blurred beyond daily limit) ───────────────────

function LockedCard({ imageUrl }: { imageUrl?: string }) {
  return (
    <div className="relative aspect-[3/4] overflow-hidden border border-border">
      <div style={{ filter: "blur(8px)", transform: "scale(1.05)" }} className="absolute inset-0">
        <img
          src={imageUrl || "https://placehold.co/400x500/F5F0E8/2C2C2C?text=The+Archive"}
          alt=""
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
          onError={(e) => { (e.currentTarget as HTMLImageElement).src = "https://placehold.co/400x500/F5F0E8/2C2C2C?text=The+Archive"; }}
        />
      </div>
      <div className="absolute inset-0 bg-charcoal/50 flex flex-col items-center justify-center gap-2 px-3">
        <svg className="w-5 h-5 text-cream/80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M7 11V7a5 5 0 0110 0v4" />
        </svg>
        <p className="text-cream text-[10px] tracking-[0.12em] uppercase text-center leading-snug">
          Uppgradera för fler plagg
        </p>
      </div>
    </div>
  );
}

// ─── BrowseUpgradeBanner ──────────────────────────────────────────────────────

function BrowseUpgradeBanner({ isPlusUser }: { isPlusUser: boolean }) {
  return (
    <div className="my-10 border border-charcoal/10 bg-cream px-8 py-10 flex flex-col items-center text-center gap-4">
      <div className="w-px h-6 bg-taupe/30" />
      <h3 className="font-serif text-2xl text-charcoal tracking-wide">Vill du se fler plagg?</h3>
      <p className="text-sm text-charcoal/50 tracking-wide max-w-xs leading-relaxed">
        {isPlusUser
          ? "Uppgradera till Premium för obegränsad feed"
          : "Uppgradera till Plus för 65 plagg/dag eller Premium för obegränsat"}
      </p>
      <Link
        href="/uppgradera"
        className="mt-2 px-10 py-3 bg-charcoal text-cream text-xs tracking-[0.2em] uppercase hover:bg-taupe transition-colors duration-300"
      >
        Se medlemskap
      </Link>
    </div>
  );
}

// ─── ProductCard (browse mode) ────────────────────────────────────────────────

function ProductCard({ product, wishlisted, onToggleWishlist }: {
  product: FeedProduct; wishlisted: boolean; onToggleWishlist: () => void;
}) {
  const hasDiscount = product.originalPrice != null && product.originalPrice > product.price;
  const discountPct = hasDiscount
    ? Math.round(((product.originalPrice! - product.price) / product.originalPrice!) * 100) : 0;

  return (
    <article className="group flex flex-col">
      <a href={product.link} target="_blank" rel="noopener noreferrer"
        className="block relative overflow-hidden border border-border aspect-[3/4]">
        <img
          src={product.imageUrl || "https://placehold.co/400x500/F5F0E8/2C2C2C?text=The+Archive"}
          alt={product.name}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
          className="transition-transform duration-700 ease-out group-hover:scale-[1.04]"
          onError={(e) => { (e.currentTarget as HTMLImageElement).src = "https://placehold.co/400x500/F5F0E8/2C2C2C?text=The+Archive"; }}
        />
        {product.isSecondHand && (
          <span className="absolute top-3 left-3 px-2 py-0.5 bg-taupe text-cream text-[9px] tracking-[0.2em] uppercase">Second hand</span>
        )}
        {hasDiscount && (
          <span className="absolute top-3 left-3 px-2 py-0.5 bg-midnight text-cream text-[9px] tracking-[0.2em] uppercase">-{discountPct}%</span>
        )}
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggleWishlist(); }}
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
          <span className={`text-sm tracking-wide ${hasDiscount ? "text-midnight font-medium" : "text-charcoal"}`}>{product.price} kr</span>
          {hasDiscount && <span className="text-xs text-charcoal/30 line-through">{product.originalPrice} kr</span>}
        </div>
      </div>
    </article>
  );
}

// ─── SwipeCard ────────────────────────────────────────────────────────────────

interface SwipeCardHandle { flyAway: (dir: "right" | "left") => void; }

const SwipeCard = forwardRef<SwipeCardHandle, {
  product: FeedProduct;
  onLike: () => void;
  onSkip: () => void;
}>(function SwipeCard({ product, onLike, onSkip }, ref) {
  const cardRef    = useRef<HTMLDivElement>(null);
  const dragState  = useRef({ startX: 0, currentX: 0, isDragging: false });
  const decided    = useRef(false);

  const hasDiscount = product.originalPrice != null && product.originalPrice > product.price;
  const discountPct = hasDiscount
    ? Math.round(((product.originalPrice! - product.price) / product.originalPrice!) * 100) : 0;

  function applyTransform(x: number) {
    const el = cardRef.current;
    if (!el) return;
    const rot = (x / 400) * 15;
    el.style.transform = `translateX(${x}px) rotate(${rot}deg)`;
    const likeEl = el.querySelector<HTMLElement>('[data-ov="like"]');
    const skipEl = el.querySelector<HTMLElement>('[data-ov="skip"]');
    if (likeEl) likeEl.style.opacity = String(Math.max(0, Math.min(x / SWIPE_THRESHOLD, 1)));
    if (skipEl) skipEl.style.opacity = String(Math.max(0, Math.min(-x / SWIPE_THRESHOLD, 1)));
  }

  function startDrag(clientX: number) {
    if (decided.current) return;
    dragState.current = { startX: clientX, currentX: 0, isDragging: true };
    if (cardRef.current) cardRef.current.style.transition = "none";
  }

  function moveDrag(clientX: number) {
    if (!dragState.current.isDragging) return;
    dragState.current.currentX = clientX - dragState.current.startX;
    applyTransform(dragState.current.currentX);
  }

  function endDrag() {
    if (!dragState.current.isDragging) return;
    dragState.current.isDragging = false;
    const x = dragState.current.currentX;
    if (Math.abs(x) >= SWIPE_THRESHOLD) {
      flyAway(x > 0 ? "right" : "left");
    } else {
      const el = cardRef.current;
      if (!el) return;
      el.style.transition = "transform 0.35s cubic-bezier(0.34,1.56,0.64,1)";
      applyTransform(0);
      setTimeout(() => { if (el) el.style.transition = ""; }, 400);
    }
  }

  function flyAway(dir: "right" | "left") {
    if (decided.current) return;
    decided.current = true;
    const el = cardRef.current;
    if (!el) return;
    const x   = dir === "right" ? window.innerWidth + 300 : -(window.innerWidth + 300);
    const rot = dir === "right" ? 30 : -30;
    el.style.transition = "transform 0.38s cubic-bezier(0.25,0.46,0.45,0.94)";
    el.style.transform  = `translateX(${x}px) rotate(${rot}deg)`;
    const likeEl = el.querySelector<HTMLElement>('[data-ov="like"]');
    const skipEl = el.querySelector<HTMLElement>('[data-ov="skip"]');
    if (dir === "right" && likeEl) likeEl.style.opacity = "1";
    if (dir === "left"  && skipEl) skipEl.style.opacity = "1";
    setTimeout(() => { if (dir === "right") onLike(); else onSkip(); }, 360);
  }

  useImperativeHandle(ref, () => ({ flyAway }));

  return (
    <div
      ref={cardRef}
      className="absolute inset-0 bg-cream border border-border cursor-grab active:cursor-grabbing select-none"
      style={{ zIndex: 2, touchAction: "none" }}
      onMouseDown={(e) => { e.preventDefault(); startDrag(e.clientX); }}
      onMouseMove={(e) => moveDrag(e.clientX)}
      onMouseUp={endDrag}
      onMouseLeave={endDrag}
      onTouchStart={(e) => startDrag(e.touches[0].clientX)}
      onTouchMove={(e) => { e.preventDefault(); moveDrag(e.touches[0].clientX); }}
      onTouchEnd={endDrag}
    >
      {/* Image */}
      <div className="relative overflow-hidden" style={{ height: "68%" }}>
        <img
          src={product.imageUrl || "https://placehold.co/400x600/F5F0E8/2C2C2C?text=The+Archive"}
          alt={product.name}
          style={{ width: "100%", height: "100%", objectFit: "cover", pointerEvents: "none" }}
          onError={(e) => { (e.currentTarget as HTMLImageElement).src = "https://placehold.co/400x600/F5F0E8/2C2C2C?text=The+Archive"; }}
        />

        {/* SPARA overlay */}
        <div data-ov="like" className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ opacity: 0, background: "rgba(34,197,94,0.35)" }}>
          <span className="font-serif text-4xl tracking-[0.2em] text-white" style={{ textShadow: "0 2px 8px rgba(0,0,0,0.3)" }}>SPARA</span>
        </div>
        {/* SKIPPA overlay */}
        <div data-ov="skip" className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ opacity: 0, background: "rgba(239,68,68,0.35)" }}>
          <span className="font-serif text-4xl tracking-[0.2em] text-white" style={{ textShadow: "0 2px 8px rgba(0,0,0,0.3)" }}>SKIPPA</span>
        </div>

        {product.isSecondHand && (
          <span className="absolute top-3 left-3 px-2 py-0.5 bg-taupe text-cream text-[9px] tracking-[0.2em] uppercase">Second hand</span>
        )}
        {hasDiscount && (
          <span className="absolute top-3 right-3 px-2 py-0.5 bg-midnight text-cream text-[9px] tracking-[0.2em] uppercase">-{discountPct}%</span>
        )}
      </div>

      {/* Info */}
      <div className="p-5 flex flex-col gap-1.5" style={{ height: "32%" }}>
        <span className="text-[9px] tracking-[0.3em] text-taupe uppercase">{product.brand}</span>
        <h2 className="font-serif text-base sm:text-lg text-charcoal leading-snug line-clamp-2">{product.name}</h2>
        <div className="flex items-baseline gap-2 mt-auto">
          <span className={`text-base tracking-wide ${hasDiscount ? "text-midnight font-medium" : "text-charcoal"}`}>{product.price} kr</span>
          {hasDiscount && <span className="text-sm text-charcoal/30 line-through">{product.originalPrice} kr</span>}
        </div>
      </div>
    </div>
  );
});

// ─── SwipeMode ────────────────────────────────────────────────────────────────

function SwipeMode({ products, onLike, activeFilter, setActiveFilter }: {
  products: FeedProduct[];
  onLike: (product: FeedProduct) => void;
  activeFilter: string;
  setActiveFilter: (f: string) => void;
}) {
  const cardHandle = useRef<SwipeCardHandle>(null);

  const [seenIds, setSeenIds] = useState<Set<string>>(() => {
    try {
      const s = sessionStorage.getItem(SK_SEEN);
      return s ? new Set(JSON.parse(s)) : new Set<string>();
    } catch { return new Set<string>(); }
  });

  function addSeen(id: string) {
    setSeenIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      try { sessionStorage.setItem(SK_SEEN, JSON.stringify(Array.from(next))); } catch {}
      return next;
    });
  }

  const filtered = products.filter((p) => {
    if (activeFilter === "Allt") return true;
    if (activeFilter === "Nytt") return !p.isSecondHand;
    if (activeFilter === "Second hand") return p.isSecondHand;
    return p.category === FILTER_CAT[activeFilter];
  });

  const queue   = filtered.filter((p) => !seenIds.has(p.id));
  const current = queue[0] ?? null;
  const next    = queue[1] ?? null;

  function handleLike() {
    if (!current) return;
    onLike(current);
    addSeen(current.id);
  }

  function handleSkip() {
    if (!current) return;
    addSeen(current.id);
  }

  function handleReset() {
    sessionStorage.removeItem(SK_SEEN);
    setSeenIds(new Set());
  }

  return (
    <div>
      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-10 justify-center">
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

      {current ? (
        <div className="flex flex-col items-center">
          {/* Card stack */}
          <div className="relative w-full max-w-sm mx-auto" style={{ height: "clamp(440px, 68vh, 640px)" }}>
            {/* Ghost of next card */}
            {next && (
              <div
                className="absolute inset-0 bg-cream border border-border overflow-hidden"
                style={{ transform: "scale(0.94) translateY(14px)", transformOrigin: "bottom center", zIndex: 1 }}
              >
                <img
                  src={next.imageUrl || "https://placehold.co/400x600/F5F0E8/2C2C2C?text=The+Archive"}
                  alt=""
                  style={{ width: "100%", height: "68%", objectFit: "cover" }}
                />
              </div>
            )}

            <SwipeCard
              key={current.id}
              ref={cardHandle}
              product={current}
              onLike={handleLike}
              onSkip={handleSkip}
            />
          </div>

          {/* Counter */}
          <p className="text-[9px] tracking-[0.2em] text-charcoal/30 uppercase mt-6 mb-8">
            {queue.length} plagg kvar
          </p>

          {/* Action buttons */}
          <div className="flex items-center gap-6">
            <button
              onClick={() => cardHandle.current?.flyAway("left")}
              className="w-16 h-16 rounded-full border-2 border-red-400 flex items-center justify-center text-red-400 hover:bg-red-50 transition-colors duration-200"
              aria-label="Skippa"
            >
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <a
              href={current.link}
              target="_blank"
              rel="noopener noreferrer"
              className="w-12 h-12 rounded-full border border-border flex items-center justify-center text-charcoal/40 hover:text-charcoal hover:border-charcoal/40 transition-colors duration-200"
              aria-label="Öppna produkt"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
              </svg>
            </a>

            <button
              onClick={() => cardHandle.current?.flyAway("right")}
              className="w-16 h-16 rounded-full border-2 border-green-500 flex items-center justify-center text-green-500 hover:bg-green-50 transition-colors duration-200"
              aria-label="Spara till wishlist"
            >
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                <path d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
              </svg>
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center py-24 gap-6">
          <div className="w-px h-10 bg-border" />
          <p className="font-serif text-2xl text-charcoal tracking-wide">Du har sett alla plagg</p>
          <p className="text-[10px] tracking-[0.2em] text-charcoal/40 uppercase">för den här sessionen</p>
          <button
            onClick={handleReset}
            className="mt-4 px-10 py-3.5 border border-charcoal/20 text-charcoal text-xs tracking-[0.2em] uppercase hover:border-midnight hover:text-midnight transition-colors duration-300"
          >
            Börja om
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function FeedPage() {
  const { tier, dailyLimit, swipesLeft, maxWishlist, incrementSwipeCount, isLoading: subLoading, isOnTrial, trialDaysLeft } = useSubscription();
  const [sessionCount, setSessionCount] = useState(0); // local session counter
  const [limitReached, setLimitReached] = useState(false);
  const [wishlistToast, setWishlistToast] = useState(false);
  const [welcomeToast, setWelcomeToast] = useState<string | null>(null);

  const [user,        setUser]        = useState<User | null | "loading">("loading");
  const [products,    setProducts]    = useState<FeedProduct[]>([]);
  const [loading,     setLoading]     = useState(false);
  const [hasProfile,  setHasProfile]  = useState(true);
  const [isRanked,    setIsRanked]    = useState(false);
  const [wishlist,    setWishlist]    = useState<Set<string>>(new Set());
  const [activeFilter, setActiveFilter] = useState("Allt");

  const [feedMode,     setFeedMode]    = useState<"swipe" | "browse" | null>(null);
  const [modalState,   setModalState]  = useState<"pending" | "visible" | "done">("pending");
  const [sessionIntent, setSessionIntent] = useState<SessionIntent | null>(null);

  // ── Auth ─────────────────────────────────────────────────────────────────

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    return unsub;
  }, []);

  // ── Onboarding welcome toast ──────────────────────────────────────────────

  useEffect(() => {
    const msg = sessionStorage.getItem("onboardingWelcome");
    if (msg) {
      sessionStorage.removeItem("onboardingWelcome");
      setWelcomeToast(msg);
      setTimeout(() => setWelcomeToast(null), 4000);
    }
  }, []);

  // ── Resolve feed mode (once auth is ready) ────────────────────────────────

  useEffect(() => {
    if (user === "loading") return;
    const stored = sessionStorage.getItem(SK_MODE) as "swipe" | "browse" | null;
    setFeedMode(stored);
  }, [user]);

  // ── Resolve intent modal (once mode is known) ────────────────────────────

  useEffect(() => {
    if (user === "loading" || feedMode === null) return;
    const shown = sessionStorage.getItem(SK_INTENT);
    setModalState(shown ? "done" : "visible");
  }, [user, feedMode]);

  // ── Load products (once modal resolved) ──────────────────────────────────

  useEffect(() => {
    if (user === "loading" || modalState !== "done") return;

    async function load() {
      setLoading(true);
      try {
        const uid = user && typeof user !== "string" ? (user as User).uid : null;
        const body: Record<string, unknown> = { uid: uid ?? "" };
        if (sessionIntent?.categories.length) body.sessionCategories = sessionIntent.categories;
        if (sessionIntent?.description) body.sessionDescription = sessionIntent.description;

        const res  = await fetch("/api/get-recommendations", {
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

  // ── Wishlist load ─────────────────────────────────────────────────────────

  useEffect(() => {
    if (!user || user === "loading") return;
    const uid = (user as User).uid;
    getDocs(collection(db, "users", uid, "wishlist")).then((snap) => {
      setWishlist(new Set(snap.docs.map((d) => d.id)));
    });
  }, [user]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  function handleModeSelect(mode: "swipe" | "browse") {
    sessionStorage.setItem(SK_MODE, mode);
    setFeedMode(mode);
  }

  function handleModalConfirm(intent: SessionIntent) {
    sessionStorage.setItem(SK_INTENT, "1");
    setSessionIntent(intent);
    setModalState("done");
  }

  function handleModalSkip() {
    sessionStorage.setItem(SK_INTENT, "1");
    setModalState("done");
  }

  function switchMode() {
    const next: "swipe" | "browse" = feedMode === "swipe" ? "browse" : "swipe";
    sessionStorage.setItem(SK_MODE, next);
    setFeedMode(next);
  }

  async function toggleWishlist(product: FeedProduct) {
    if (!user || user === "loading") return;
    const uid = (user as User).uid;
    const ref = doc(db, "users", uid, "wishlist", product.id);

    // Wishlist limit for free users
    if (!wishlist.has(product.id) && maxWishlist !== null && wishlist.size >= maxWishlist) {
      setWishlistToast(true);
      setTimeout(() => setWishlistToast(false), 3500);
      return;
    }

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

  async function handleSwipeLike(product: FeedProduct) {
    await incrementSwipeCount();
    const newCount = sessionCount + 1;
    setSessionCount(newCount);
    if (dailyLimit !== null && (swipesLeft !== null && swipesLeft <= 1)) {
      setLimitReached(true);
    }
    if (!wishlist.has(product.id)) {
      await toggleWishlist(product);
    }
  }


  // ── Browse filtered list ──────────────────────────────────────────────────

  const browseFiltered = products.filter((p) => {
    if (activeFilter === "Allt") return true;
    if (activeFilter === "Nytt") return !p.isSecondHand;
    if (activeFilter === "Second hand") return p.isSecondHand;
    return p.category === FILTER_CAT[activeFilter];
  });

  // How many browse cards are visible (unblurred) per tier
  const browseLimit = tier === "premium" ? Infinity : tier === "plus" ? 65 : 15;

  // ─── Render ───────────────────────────────────────────────────────────────

  // 1. Mode selector
  if (feedMode === null) {
    return <ModeSelector onSelect={handleModeSelect} />;
  }

  // Compute warning state (5 or fewer left)
  const swipesLeftNum = swipesLeft ?? Infinity;
  const showWarningBanner = !subLoading && dailyLimit !== null && swipesLeftNum <= 10 && swipesLeftNum > 0 && !limitReached;
  const showCountdown = !subLoading && dailyLimit !== null && swipesLeftNum <= 5 && swipesLeftNum > 0 && !limitReached;

  return (
    <>
      {modalState === "visible" && (
        <IntentModal onConfirm={handleModalConfirm} onSkip={handleModalSkip} />
      )}

      {/* Wishlist-full toast */}
      <div className={`fixed bottom-8 left-1/2 -translate-x-1/2 z-50 transition-all duration-300 ${
        wishlistToast ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"
      }`}>
        <div className="bg-charcoal text-cream text-xs tracking-[0.12em] px-6 py-3 flex items-center gap-3 shadow-lg">
          <span>Wishlist full ({maxWishlist}/{maxWishlist}) —</span>
          <Link href="/uppgradera" className="text-taupe hover:underline underline-offset-2">
            Uppgradera till Plus
          </Link>
        </div>
      </div>

      {/* Welcome toast */}
      <div className={`fixed top-20 left-1/2 -translate-x-1/2 z-[200] transition-all duration-500 ${
        welcomeToast ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2 pointer-events-none"
      }`}>
        <div className="bg-[#1C2B2D] text-cream text-xs tracking-[0.12em] px-6 py-3 shadow-lg whitespace-nowrap">
          {welcomeToast}
        </div>
      </div>

      <div className="min-h-screen bg-cream px-6 py-12">
        <div className="max-w-6xl mx-auto">

          {/* Header */}
          {/* Trial welcome banner */}
          {isOnTrial && trialDaysLeft !== null && (
            <div className="mb-6 text-center px-5 py-3 border border-taupe/30 text-xs tracking-wide" style={{ background: "#FAF5EE" }}>
              <span style={{ color: "#B5956A" }}>
                {trialDaysLeft > 1
                  ? `Du har ${trialDaysLeft} dagars gratis Plus-provperiod kvar`
                  : "Din Plus-provperiod tar slut imorgon"} —{" "}
              </span>
              <Link href="/uppgradera" className="underline underline-offset-2" style={{ color: "#7A6040" }}>
                Uppgradera för att behålla Plus
              </Link>
            </div>
          )}

          <div className="flex flex-col items-center text-center mb-14">
            <div className="w-px h-12 bg-border mb-8" />
            <h1 className="font-serif text-5xl sm:text-6xl text-charcoal tracking-[0.04em] mb-3">
              {isRanked ? "Din personliga feed" : "Feed"}
            </h1>
            <p className="text-[10px] tracking-[0.3em] text-charcoal/40 uppercase">
              {loading ? "Laddar..." : `${feedMode === "browse" ? browseFiltered.length : products.length} plagg`}
              {isRanked && !loading && <span className="ml-3 text-taupe">· Anpassad för din stil</span>}
            </p>
            <div className="w-12 h-px bg-border mt-8" />
          </div>

          {/* Warning banner — 10 swipes left */}
          {showWarningBanner && (
            <div className="mb-6 flex items-center justify-between px-5 py-3 text-xs tracking-wide" style={{ background: "#F5EFE6", borderLeft: "3px solid #B5956A" }}>
              <span style={{ color: "#7A6040" }}>
                Du har {swipesLeftNum} plagg kvar idag — uppgradera för {dailyLimit === 75 ? "obegränsat" : "75 plagg"}/dag
              </span>
              <Link href="/uppgradera" className="ml-4 flex-shrink-0 text-[10px] tracking-[0.15em] uppercase hover:underline" style={{ color: "#B5956A" }}>
                Uppgradera →
              </Link>
            </div>
          )}

          {/* Countdown badge — 5 or fewer left */}
          {showCountdown && (
            <div className="mb-4 flex justify-center">
              <span className="text-[10px] tracking-[0.2em] uppercase px-3 py-1" style={{ background: "#B5956A", color: "#F5F0E8" }}>
                {swipesLeftNum} plagg kvar idag
              </span>
            </div>
          )}

          {/* Daily limit overlay */}
          {limitReached && (
            <div className="relative mb-8">
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center px-6 py-16 text-center" style={{ backdropFilter: "blur(6px)", background: "rgba(245,240,232,0.88)" }}>
                <div className="w-px h-10 bg-taupe/40 mb-6" />
                <h2 className="font-serif text-2xl sm:text-3xl text-charcoal tracking-tight mb-3">
                  Du har utforskat ditt dagliga urval
                </h2>
                <p className="text-sm text-charcoal/55 tracking-wide mb-8 max-w-xs">
                  Uppgradera för att fortsätta utforska idag
                </p>
                <div className="grid grid-cols-3 gap-3 w-full max-w-lg mb-8">
                  {[
                    { label: "Free", detail: "15/dag", bg: "#9E9E9E" },
                    { label: "Plus", detail: "75/dag", bg: "#B5956A", highlight: true },
                    { label: "Premium", detail: "Obegränsat", bg: "#1C2B2D" },
                  ].map(({ label, detail, bg, highlight }) => (
                    <div key={label} className={`border p-4 flex flex-col items-center gap-1 ${highlight ? "border-taupe" : "border-charcoal/10"}`}>
                      <span className="text-[8px] tracking-[0.2em] uppercase px-1.5 py-0.5" style={{ background: bg, color: "#F5F0E8" }}>{label}</span>
                      <span className="text-sm font-medium text-charcoal mt-1">{detail}</span>
                    </div>
                  ))}
                </div>
                <Link
                  href="/uppgradera"
                  className="px-10 py-3.5 text-xs tracking-[0.2em] uppercase mb-5 transition-colors"
                  style={{ background: "#1C2B2D", color: "#F5F0E8" }}
                >
                  Se alla planer
                </Link>
                <button
                  onClick={() => setLimitReached(false)}
                  className="text-[10px] tracking-[0.15em] uppercase text-charcoal/35 hover:text-charcoal transition-colors"
                >
                  Kom tillbaka imorgon
                </button>
                <div className="w-px h-8 bg-taupe/30 mt-6" />
              </div>
              {/* Blurred placeholder behind overlay */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-5 opacity-40 pointer-events-none select-none" style={{ filter: "blur(4px)" }}>
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className="aspect-[3/4] bg-charcoal/10" />
                ))}
              </div>
            </div>
          )}

          {/* Mode switch + no-profile banner row */}
          <div className="flex items-center justify-between mb-10">
            {!loading && !hasProfile ? (
              <div className="flex-1 border border-border px-6 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mr-4">
                <div>
                  <p className="text-sm text-charcoal tracking-wide mb-0.5">Skapa din stilprofil för personliga förslag</p>
                  <p className="text-xs text-charcoal/40 tracking-wide">Berätta om din stil så anpassar vi feeden efter dig</p>
                </div>
                <Link href="/onboarding" className="flex-shrink-0 px-6 py-2.5 bg-midnight text-cream text-xs tracking-[0.2em] uppercase hover:bg-charcoal transition-colors duration-300">
                  Kom igång
                </Link>
              </div>
            ) : <div className="flex-1" />}

            <button
              onClick={switchMode}
              className="flex-shrink-0 flex items-center gap-2 px-4 py-2 border border-border text-[9px] tracking-[0.2em] text-charcoal/50 uppercase hover:border-charcoal/40 hover:text-charcoal transition-colors duration-200"
            >
              {feedMode === "swipe" ? (
                <>
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <rect x="3" y="3" width="7" height="7" rx="0.5" /><rect x="14" y="3" width="7" height="7" rx="0.5" />
                    <rect x="3" y="14" width="7" height="7" rx="0.5" /><rect x="14" y="14" width="7" height="7" rx="0.5" />
                  </svg>
                  Browse
                </>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                  </svg>
                  Swipe
                </>
              )}
            </button>
          </div>

          {/* Content */}
          {loading ? (
            <Spinner />
          ) : feedMode === "swipe" ? (
            <SwipeMode
              products={products}
              onLike={handleSwipeLike}
              activeFilter={activeFilter}
              setActiveFilter={setActiveFilter}
            />
          ) : (
            <>
              {/* Browse filters */}
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

              {browseFiltered.length === 0 ? (
                <div className="flex flex-col items-center py-24 gap-3">
                  <div className="w-px h-10 bg-taupe/30" />
                  <p className="text-sm text-charcoal/40 tracking-wide">Inga plagg hittades</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-5">
                  {browseFiltered.map((product, index) => {
                    const limit = browseLimit;
                    const isBlurred = limit !== Infinity && index >= limit;
                    return (
                      <Fragment key={product.id || index}>
                        <div className="relative">
                          {isBlurred ? (
                            <div className="relative">
                              <div style={{ filter: "blur(8px)", pointerEvents: "none" }}>
                                <ProductCard
                                  product={product}
                                  wishlisted={wishlist.has(product.id)}
                                  onToggleWishlist={() => toggleWishlist(product)}
                                />
                              </div>
                              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/30 rounded">
                                <span className="text-white text-2xl mb-2">🔒</span>
                                <p className="text-white text-xs text-center px-2 font-medium tracking-wider">UPPGRADERA FÖR FLER PLAGG</p>
                              </div>
                            </div>
                          ) : (
                            <ProductCard
                              product={product}
                              wishlisted={wishlist.has(product.id)}
                              onToggleWishlist={() => toggleWishlist(product)}
                            />
                          )}
                        </div>
                        {index === limit - 1 && limit !== Infinity && browseFiltered.length > limit && (
                          <div className="col-span-full text-center py-12 border border-[#E8E2D9] rounded mt-4">
                            <p style={{ fontFamily: "Georgia, serif" }} className="text-xl mb-2">Vill du se fler plagg?</p>
                            <p className="text-sm text-gray-500 mb-4">
                              {tier === "free" ? "Uppgradera till Plus för 65 plagg/dag" : "Uppgradera till Premium för obegränsad feed"}
                            </p>
                            <a href="/uppgradera" className="text-[#B5956A] text-sm tracking-widest uppercase">SE MEDLEMSKAP →</a>
                          </div>
                        )}
                      </Fragment>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
