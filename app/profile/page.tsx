"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useRouter } from "next/navigation";

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  async function handleSignOut() {
    await signOut(auth);
    router.push("/");
  }

  if (loading) {
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
        <h1 className="font-serif text-3xl text-charcoal tracking-tight mb-4">
          Inte inloggad
        </h1>
        <div className="w-16 h-px bg-taupe/40 my-5" />
        <p className="text-sm text-charcoal/50 mb-8">
          Logga in för att se din profil.
        </p>
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

  const initials = user.displayName
    ? user.displayName.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : user.email?.[0]?.toUpperCase() ?? "?";

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-cream px-6 py-16">
      <div className="max-w-md mx-auto flex flex-col items-center text-center">
        <div className="w-px h-10 bg-taupe/40 mb-10" />

        {/* Avatar */}
        {user.photoURL ? (
          <img
            src={user.photoURL}
            alt={user.displayName ?? "Profil"}
            className="w-20 h-20 rounded-full object-cover mb-6 ring-2 ring-taupe/20"
          />
        ) : (
          <div className="w-20 h-20 rounded-full bg-taupe/20 flex items-center justify-center mb-6">
            <span className="font-serif text-2xl text-taupe">{initials}</span>
          </div>
        )}

        <h1 className="font-serif text-3xl text-charcoal tracking-tight mb-1">
          {user.displayName ?? "Okänt namn"}
        </h1>
        <p className="text-sm text-charcoal/50 tracking-wide mb-8">
          {user.email}
        </p>

        <div className="w-16 h-px bg-taupe/40 mb-8" />

        {/* Info rows */}
        <div className="w-full border border-charcoal/10 divide-y divide-charcoal/10 mb-10">
          <div className="flex justify-between px-5 py-3.5">
            <span className="text-xs tracking-widest text-charcoal/40 uppercase">Namn</span>
            <span className="text-sm text-charcoal">{user.displayName ?? "—"}</span>
          </div>
          <div className="flex justify-between px-5 py-3.5">
            <span className="text-xs tracking-widest text-charcoal/40 uppercase">E-post</span>
            <span className="text-sm text-charcoal">{user.email}</span>
          </div>
          <div className="flex justify-between px-5 py-3.5">
            <span className="text-xs tracking-widest text-charcoal/40 uppercase">Inloggad via</span>
            <span className="text-sm text-charcoal capitalize">
              {user.providerData[0]?.providerId.replace(".com", "") ?? "—"}
            </span>
          </div>
        </div>

        <button
          onClick={handleSignOut}
          className="px-10 py-3.5 border border-charcoal/20 text-charcoal text-sm tracking-[0.15em] uppercase hover:border-taupe hover:text-taupe transition-colors duration-300"
        >
          Logga ut
        </button>

        <div className="w-px h-10 bg-taupe/40 mt-10" />
      </div>
    </div>
  );
}
