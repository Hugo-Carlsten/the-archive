"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signInWithPopup, GoogleAuthProvider } from "firebase/auth";
import { auth } from "@/lib/firebase";

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGoogleSignIn() {
    setLoading(true);
    setError(null);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      router.push("/feed");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Något gick fel.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-cream flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm flex flex-col items-center">
        {/* Decorative */}
        <div className="w-px h-12 bg-taupe/40 mb-8" />

        <h2 className="font-serif text-4xl text-charcoal tracking-tight mb-2">
          Välkommen tillbaka
        </h2>

        <div className="w-16 h-px bg-taupe/40 my-5" />

        <p className="text-sm text-charcoal/50 tracking-wide mb-10 text-center">
          Logga in på ditt konto för att fortsätta
        </p>

        {error && (
          <p className="text-sm text-red-600/70 mb-6 text-center">{error}</p>
        )}

        <button
          onClick={handleGoogleSignIn}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 px-6 py-3.5 border border-charcoal/20 text-charcoal text-sm tracking-[0.1em] uppercase hover:border-taupe hover:text-taupe transition-colors duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {/* Google icon */}
          <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              fill="#EA4335"
            />
          </svg>
          {loading ? "Loggar in..." : "Fortsätt med Google"}
        </button>

        <div className="mt-10 flex flex-col items-center gap-3">
          <p className="text-xs text-charcoal/40 tracking-wide">
            Har du inget konto?
          </p>
          <Link
            href="/onboarding"
            className="text-xs tracking-[0.15em] text-taupe uppercase hover:text-taupe-dark transition-colors"
          >
            Kom igång →
          </Link>
        </div>

        <div className="w-px h-12 bg-taupe/40 mt-10" />
      </div>
    </div>
  );
}
