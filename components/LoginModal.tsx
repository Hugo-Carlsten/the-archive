"use client";

import { useEffect, useRef, useState } from "react";
import { signInWithPopup, GoogleAuthProvider } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  /** Called after successful login instead of the default redirect logic */
  onSuccess?: () => void;
}

const GoogleIcon = () => (
  <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
  </svg>
);

export default function LoginModal({ isOpen, onClose, onSuccess }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  // ESC closes modal
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  // Lock body scroll
  useEffect(() => {
    if (isOpen) document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  async function handleGoogleSignIn() {
    setLoading(true);
    setError(null);
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);

      if (onSuccess) {
        onSuccess();
        return;
      }

      // Default: profile exists → /feed, new user → /onboarding
      const snap = await getDoc(doc(db, "users", result.user.uid));
      if (snap.exists() && snap.data().onboardingCompletedAt) {
        router.push("/feed");
      } else {
        router.push("/onboarding");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Något gick fel.");
    } finally {
      setLoading(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[300] flex items-center justify-center px-6"
      style={{ background: "rgba(28, 43, 45, 0.65)" }}
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
    >
      <div className="bg-cream w-full max-w-sm flex flex-col items-center px-8 py-10 shadow-xl animate-fade-in-scale">
        {/* Logo */}
        <img src="/logo.png" alt="The Archive" style={{ height: "48px", width: "auto" }} className="mb-5" />

        <h2 className="font-serif text-3xl text-charcoal tracking-tight mb-1 text-center">
          Skapa ditt konto
        </h2>

        <div className="w-12 h-px bg-taupe/40 my-4" />

        <p className="text-xs text-charcoal/50 tracking-wide mb-8 text-center leading-relaxed max-w-[240px]">
          Spara din stilprofil och få personliga rekommendationer
        </p>

        {error && (
          <p className="text-xs text-red-600/70 mb-4 text-center">{error}</p>
        )}

        <button
          onClick={handleGoogleSignIn}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 px-6 py-3.5 bg-white border border-charcoal/15 text-charcoal text-sm tracking-[0.04em] hover:border-charcoal/35 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
        >
          <GoogleIcon />
          {loading ? "Loggar in..." : "Fortsätt med Google"}
        </button>

        <p className="text-[10px] text-charcoal/30 tracking-wide mt-5 text-center">
          Genom att fortsätta godkänner du våra användarvillkor
        </p>

        <button
          onClick={onClose}
          className="mt-6 text-[10px] tracking-[0.18em] text-charcoal/30 uppercase hover:text-charcoal/55 transition-colors"
        >
          Avbryt
        </button>
      </div>
    </div>
  );
}
