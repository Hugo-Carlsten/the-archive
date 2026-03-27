"use client";

import { useState, useEffect, useCallback } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { doc, getDoc, setDoc, updateDoc, Timestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

// ─── Types ────────────────────────────────────────────────────────────────────

export type Tier = "free" | "plus" | "premium";

export interface SubInfo {
  tier: Tier;
  isLoading: boolean;
  // Feed
  dailyLimit: number | null;   // null = unlimited
  swipesUsed: number;
  swipesLeft: number | null;   // null = unlimited
  // Saving
  maxSavedOutfits: number | null;
  maxWishlist: number | null;
  // Profile
  canUpdateProfile: boolean;
  nextProfileUpdate: Date | null;
  // AI
  hasAITips: boolean;
  // Wardrobe
  maxWardrobeItems: number | null;
  // Trial
  isOnTrial: boolean;
  trialExpiresAt: Date | null;
  trialDaysLeft: number | null;
  // Premium extras
  canExportOutfit: boolean;
  earlyAccess: boolean;
  // Action
  incrementSwipeCount: () => Promise<void>;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const todayStr = () => new Date().toISOString().split("T")[0];
const TRIAL_DAYS = 7;

function computeTier(
  storedTier: string,
  expiry: Timestamp | null,
): Tier {
  const now = new Date();
  if (storedTier === "premium") {
    if (!expiry || expiry.toDate() > now) return "premium";
  }
  if (storedTier === "plus" || storedTier === "premium") {
    if (!expiry || expiry.toDate() > now) return "plus";
  }
  return "free";
}

function computeLimits(
  tier: Tier,
  swipesUsed: number,
  profileUpdatedAt: Timestamp | null,
  expiry: Timestamp | null,
  storedTier: string,
): Omit<SubInfo, "isLoading" | "incrementSwipeCount"> {
  const now = new Date();

  // Trial detection: plus tier with an expiry in the future that was set during signup
  const isOnTrial =
    storedTier === "plus" &&
    expiry !== null &&
    expiry.toDate() > now &&
    tier === "plus";
  const trialExpiresAt = isOnTrial ? expiry!.toDate() : null;
  const trialDaysLeft = trialExpiresAt
    ? Math.max(0, Math.ceil((trialExpiresAt.getTime() - now.getTime()) / 86_400_000))
    : null;

  // Profile update cooldown (free only)
  let canUpdateProfile = true;
  let nextProfileUpdate: Date | null = null;
  if (tier === "free" && profileUpdatedAt) {
    const next = new Date(profileUpdatedAt.toDate().getTime() + 7 * 86_400_000);
    if (now < next) {
      canUpdateProfile = false;
      nextProfileUpdate = next;
    }
  }

  const base = { isOnTrial, trialExpiresAt, trialDaysLeft, canUpdateProfile, nextProfileUpdate };

  if (tier === "premium") {
    return {
      tier,
      swipesUsed,
      dailyLimit: null, swipesLeft: null,
      maxSavedOutfits: null, maxWishlist: null,
      hasAITips: true, maxWardrobeItems: null,
      canExportOutfit: true, earlyAccess: true,
      ...base,
    };
  }
  if (tier === "plus") {
    const left = Math.max(0, 75 - swipesUsed);
    return {
      tier,
      swipesUsed,
      dailyLimit: 75, swipesLeft: left,
      maxSavedOutfits: null, maxWishlist: null,
      hasAITips: true, maxWardrobeItems: 30,
      canExportOutfit: false, earlyAccess: false,
      ...base,
    };
  }
  // free
  const left = Math.max(0, 15 - swipesUsed);
  return {
    tier: "free",
    swipesUsed,
    dailyLimit: 15, swipesLeft: left,
    maxSavedOutfits: 3, maxWishlist: 25,
    hasAITips: false, maxWardrobeItems: 5,
    canExportOutfit: false, earlyAccess: false,
    ...base,
  };
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useSubscription(): SubInfo {
  const [user, setUser] = useState<User | null | "loading">("loading");
  const [info, setInfo] = useState<Omit<SubInfo, "incrementSwipeCount">>({
    tier: "free",
    isLoading: true,
    dailyLimit: 15, swipesUsed: 0, swipesLeft: 15,
    maxSavedOutfits: 3, maxWishlist: 25,
    canUpdateProfile: true, nextProfileUpdate: null,
    hasAITips: false, maxWardrobeItems: 5,
    isOnTrial: false, trialExpiresAt: null, trialDaysLeft: null,
    canExportOutfit: false, earlyAccess: false,
  });

  // Track stored tier for incrementSwipeCount closure
  const [uid, setUid] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    return unsub;
  }, []);

  useEffect(() => {
    if (user === "loading") return;
    if (!user) {
      setUid(null);
      setInfo((prev) => ({ ...prev, isLoading: false }));
      return;
    }

    const u = user as User;
    setUid(u.uid);

    async function load() {
      const ref = doc(db, "users", u.uid);
      const snap = await getDoc(ref);

      const today = todayStr();
      let storedTier = "plus"; // default to trial
      let expiry: Timestamp | null = null;
      let swipesUsed = 0;
      let profileUpdatedAt: Timestamp | null = null;

      if (!snap.exists() || snap.data().subscription == null) {
        // First login — set up 7-day Plus trial
        const trialExpiry = Timestamp.fromDate(
          new Date(Date.now() + TRIAL_DAYS * 86_400_000)
        );
        const update: Record<string, unknown> = {
          subscription: "plus",
          subscriptionExpiry: trialExpiry,
          dailySwipeCount: 0,
          dailySwipeDate: today,
          profileUpdatedAt: null,
        };
        await setDoc(ref, update, { merge: true });
        storedTier = "plus";
        expiry = trialExpiry;
      } else {
        const d = snap.data();
        storedTier = d.subscription ?? "free";
        expiry = d.subscriptionExpiry ?? null;
        profileUpdatedAt = d.profileUpdatedAt ?? null;

        // Reset daily count if date has changed
        if (d.dailySwipeDate !== today) {
          await updateDoc(ref, { dailySwipeCount: 0, dailySwipeDate: today });
          swipesUsed = 0;
        } else {
          swipesUsed = d.dailySwipeCount ?? 0;
        }
      }

      const tier = computeTier(storedTier, expiry);
      const limits = computeLimits(tier, swipesUsed, profileUpdatedAt, expiry, storedTier);
      setInfo({ ...limits, isLoading: false });
    }

    load().catch(console.error);
  }, [user]);

  const incrementSwipeCount = useCallback(async () => {
    if (!uid) return;
    const ref = doc(db, "users", uid);
    const today = todayStr();
    const snap = await getDoc(ref);
    const d = snap.exists() ? snap.data() : {};
    const current = d.dailySwipeDate === today ? (d.dailySwipeCount ?? 0) : 0;
    const next = current + 1;
    await updateDoc(ref, { dailySwipeCount: next, dailySwipeDate: today });
    setInfo((prev) => {
      const newUsed = next;
      const newLeft =
        prev.dailyLimit !== null ? Math.max(0, prev.dailyLimit - newUsed) : null;
      return { ...prev, swipesUsed: newUsed, swipesLeft: newLeft };
    });
  }, [uid]);

  return { ...info, incrementSwipeCount };
}
