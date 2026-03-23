import Link from "next/link";

export default function WishlistPage() {
  return (
    <div className="min-h-[calc(100vh-4rem)] bg-cream flex flex-col items-center justify-center px-6 text-center">
      <div className="w-px h-12 bg-taupe/40 mb-10" />

      {/* Empty heart */}
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

      <h1 className="font-serif text-3xl text-charcoal tracking-tight mb-4">
        Din wishlist är tom än så länge
      </h1>

      <div className="w-16 h-px bg-taupe/40 my-5" />

      <p className="text-sm text-charcoal/50 tracking-wide leading-relaxed max-w-xs mb-10">
        Bläddra i feeden och tryck på hjärtikonen för att spara plagg du gillar.
      </p>

      <Link
        href="/feed"
        className="px-10 py-3.5 border border-charcoal/30 text-charcoal text-sm tracking-[0.15em] uppercase hover:border-taupe hover:text-taupe transition-colors duration-300"
      >
        Utforska Feed
      </Link>

      <div className="w-px h-12 bg-taupe/40 mt-10" />
    </div>
  );
}
