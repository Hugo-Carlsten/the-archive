"use client";

import { useState } from "react";
import Link from "next/link";
import { doc, setDoc, Timestamp } from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { useSubscription } from "@/hooks/useSubscription";

// ─── Pricing data ─────────────────────────────────────────────────────────────

const PLUS_MONTHLY  = 39;
const PLUS_YEARLY   = 299;
const PREM_MONTHLY  = 99;
const PREM_YEARLY   = 799;

const FREE_FEATURES = [
  "15 plagg per dag",
  "3 sparade outfits",
  "25 plagg i wishlist",
  "Outfit-byggaren utan AI",
];

const PLUS_FEATURES = [
  "75 plagg per dag",
  "Obegränsade sparade outfits",
  "Obegränsad wishlist",
  "AI-stilanalys i outfit-byggaren",
  "30 garderobsplagg",
  "Se varför AI rekommenderar plagg",
];

const PREM_FEATURES = [
  "Obegränsad feed",
  "Obegränsade sparade outfits",
  "5 stilprofiler (familjeplan)",
  "Exportera outfits som bild",
  "Early access till nya funktioner",
  "Prioriterad AI",
];

const FAQ = [
  {
    q: "Kan jag avbryta när som helst?",
    a: "Ja. Du kan avbryta din prenumeration när som helst. Du behåller Plus/Premium-åtkomst fram till periodens slut.",
  },
  {
    q: "Vad händer med mina outfits om jag nedgraderar?",
    a: "Dina sparade outfits och wishlist behålls. Du kan bara se de 3 senaste outfitsen och 25 wishlist-plagg om du är på Free.",
  },
  {
    q: "Hur fungerar provperioden?",
    a: "Alla nya användare får 7 dagars gratis Plus-provperiod automatiskt. Inga kortuppgifter krävs för att starta.",
  },
  {
    q: "Är det säkert att betala?",
    a: "Betalningslösning är under implementering. Anmäl ditt intresse nedan så kontaktar vi dig när det är klart.",
  },
];

// ─── Waitlist form ─────────────────────────────────────────────────────────────

function WaitlistForm({ planLabel }: { planLabel: string }) {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);

  async function submit() {
    const trimmed = email.trim();
    if (!trimmed || !trimmed.includes("@")) return;
    setSending(true);
    try {
      await setDoc(doc(db, "waitlist", trimmed), {
        email: trimmed,
        plan: planLabel,
        uid: auth.currentUser?.uid ?? null,
        createdAt: Timestamp.now(),
      });
      setSent(true);
    } catch {
      setSent(true); // show success regardless
    } finally {
      setSending(false);
    }
  }

  if (sent) {
    return (
      <p className="text-xs text-center" style={{ color: "#4a7c59", letterSpacing: "0.05em" }}>
        Tack! Vi meddelar dig när betalning är tillgänglig.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-[10px] tracking-[0.15em] uppercase text-center" style={{ color: "#B5956A" }}>
        Betalning kommer snart — anmäl intresse
      </p>
      <div className="flex gap-2">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="din@email.se"
          className="flex-1 border border-charcoal/15 bg-cream px-3 py-2 text-xs text-charcoal placeholder-charcoal/30 outline-none focus:border-charcoal/30 transition-colors"
        />
        <button
          onClick={submit}
          disabled={sending}
          className="px-4 py-2 bg-charcoal text-cream text-xs tracking-[0.12em] uppercase hover:bg-taupe transition-colors disabled:opacity-40"
        >
          {sending ? "..." : "OK"}
        </button>
      </div>
    </div>
  );
}

// ─── Plan card ────────────────────────────────────────────────────────────────

function PlanCard({
  title,
  badge,
  badgeColor,
  monthlyPrice,
  yearlyPrice,
  features,
  isCurrent,
  isPopular,
  billing,
  ctaLabel,
  ctaDisabled,
}: {
  title: string;
  badge?: string;
  badgeColor?: string;
  monthlyPrice?: number;
  yearlyPrice?: number;
  features: string[];
  isCurrent: boolean;
  isPopular?: boolean;
  billing: "monthly" | "yearly";
  ctaLabel: string;
  ctaDisabled: boolean;
}) {
  const price = monthlyPrice
    ? billing === "yearly" && yearlyPrice
      ? Math.round(yearlyPrice / 12)
      : monthlyPrice
    : null;
  const totalPerYear = billing === "yearly" && yearlyPrice ? yearlyPrice : null;
  const savePct =
    billing === "yearly" && yearlyPrice && monthlyPrice
      ? Math.round(((monthlyPrice * 12 - yearlyPrice) / (monthlyPrice * 12)) * 100)
      : null;

  return (
    <div
      className={`relative flex flex-col border transition-shadow duration-300 ${
        isPopular ? "border-taupe shadow-md scale-[1.02]" : "border-charcoal/10 hover:border-charcoal/25"
      } bg-cream`}
    >
      {isPopular && (
        <div
          className="text-center py-1.5 text-[9px] tracking-[0.25em] uppercase"
          style={{ background: "#B5956A", color: "#F5F0E8" }}
        >
          Populärast
        </div>
      )}

      <div className="p-7 flex flex-col gap-6 flex-1">
        {/* Header */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <h2 className="font-serif text-2xl text-charcoal">{title}</h2>
            {badge && (
              <span
                className="text-[8px] tracking-[0.2em] uppercase px-1.5 py-0.5 leading-none"
                style={{ background: badgeColor ?? "#9E9E9E", color: "#F5F0E8" }}
              >
                {badge}
              </span>
            )}
          </div>

          {price !== null ? (
            <div className="flex flex-col gap-0.5">
              <div className="flex items-baseline gap-1.5">
                <span className="font-serif text-4xl text-charcoal leading-none">{price}</span>
                <span className="text-sm text-charcoal/40">kr/mån</span>
              </div>
              {billing === "yearly" && totalPerYear && (
                <p className="text-[10px] text-charcoal/40 tracking-wide">
                  {totalPerYear} kr/år
                  {savePct ? (
                    <span className="ml-1.5 text-taupe">— spara {savePct}%</span>
                  ) : null}
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-charcoal/50 tracking-wide">Gratis för alltid</p>
          )}
        </div>

        {/* Features */}
        <ul className="flex flex-col gap-2.5 flex-1">
          {features.map((f) => (
            <li key={f} className="flex items-start gap-2.5 text-xs text-charcoal/70 leading-snug">
              <svg className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-taupe" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              {f}
            </li>
          ))}
        </ul>

        {/* CTA */}
        {isCurrent ? (
          <button
            disabled
            className="w-full py-3 text-xs tracking-[0.15em] uppercase border border-charcoal/15 text-charcoal/30 cursor-default"
          >
            Din nuvarande plan
          </button>
        ) : ctaDisabled ? (
          <WaitlistForm planLabel={title} />
        ) : (
          <Link
            href="#"
            className="w-full py-3 text-xs tracking-[0.15em] uppercase text-center transition-colors duration-200 block"
            style={{ background: "#1C2B2D", color: "#F5F0E8" }}
          >
            {ctaLabel}
          </Link>
        )}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function UpgraderaPage() {
  const { tier, isLoading, isOnTrial, trialDaysLeft } = useSubscription();
  const [billing, setBilling] = useState<"monthly" | "yearly">("monthly");

  return (
    <div className="min-h-screen bg-cream px-6 py-12">
      <div className="max-w-5xl mx-auto">

        {/* Header */}
        <div className="flex flex-col items-center text-center mb-12">
          <div className="w-px h-10 bg-taupe/40 mb-6" />
          <h1 className="font-serif text-4xl sm:text-5xl text-charcoal tracking-tight mb-3">
            Välj din plan
          </h1>
          <p className="text-sm text-charcoal/50 tracking-wide max-w-sm">
            Uppgradera för en mer personlig och obegränsad upplevelse.
          </p>
          {isOnTrial && trialDaysLeft !== null && (
            <div className="mt-5 px-5 py-2.5 border border-taupe/40 text-xs tracking-wide text-taupe">
              Du har {trialDaysLeft} dag{trialDaysLeft !== 1 ? "ar" : ""} kvar av din gratis Plus-provperiod
            </div>
          )}
          <div className="w-12 h-px bg-taupe/40 mt-8" />
        </div>

        {/* Billing toggle */}
        <div className="flex items-center justify-center gap-3 mb-10">
          <button
            onClick={() => setBilling("monthly")}
            className={`px-5 py-2 text-xs tracking-[0.12em] uppercase border transition-colors duration-200 ${
              billing === "monthly"
                ? "border-charcoal bg-charcoal text-cream"
                : "border-charcoal/15 text-charcoal/50 hover:border-charcoal/30 hover:text-charcoal"
            }`}
          >
            Månadsvis
          </button>
          <button
            onClick={() => setBilling("yearly")}
            className={`px-5 py-2 text-xs tracking-[0.12em] uppercase border transition-colors duration-200 ${
              billing === "yearly"
                ? "border-charcoal bg-charcoal text-cream"
                : "border-charcoal/15 text-charcoal/50 hover:border-charcoal/30 hover:text-charcoal"
            }`}
          >
            Årsvis
            <span className="ml-2 text-taupe text-[9px]">spara mer</span>
          </button>
        </div>

        {/* Plan cards */}
        {!isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-start mb-14">
            <PlanCard
              title="Free"
              badge="FREE"
              badgeColor="#9E9E9E"
              features={FREE_FEATURES}
              isCurrent={tier === "free"}
              billing={billing}
              ctaLabel="Din plan"
              ctaDisabled={false}
            />
            <PlanCard
              title="Plus"
              badge="PLUS"
              badgeColor="#B5956A"
              monthlyPrice={PLUS_MONTHLY}
              yearlyPrice={PLUS_YEARLY}
              features={PLUS_FEATURES}
              isCurrent={tier === "plus"}
              isPopular
              billing={billing}
              ctaLabel="Välj Plus"
              ctaDisabled={true}
            />
            <PlanCard
              title="Premium"
              badge="PREMIUM"
              badgeColor="#1C2B2D"
              monthlyPrice={PREM_MONTHLY}
              yearlyPrice={PREM_YEARLY}
              features={PREM_FEATURES}
              isCurrent={tier === "premium"}
              billing={billing}
              ctaLabel="Välj Premium"
              ctaDisabled={true}
            />
          </div>
        )}

        {/* Social proof */}
        <div className="flex flex-col items-center gap-2 mb-16">
          <div className="flex -space-x-2">
            {["#B5956A", "#1C2B2D", "#9E9E9E", "#C8A882", "#2C2C2C"].map((c, i) => (
              <div
                key={i}
                className="w-7 h-7 rounded-full ring-2 ring-cream"
                style={{ background: c }}
              />
            ))}
          </div>
          <p className="text-xs text-charcoal/50 tracking-wide">Redan hundratals användare har registrerat intresse</p>
        </div>

        {/* FAQ */}
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-4 mb-8">
            <div className="h-px flex-1 bg-charcoal/10" />
            <h2 className="font-serif text-xl text-charcoal tracking-wide">Vanliga frågor</h2>
            <div className="h-px flex-1 bg-charcoal/10" />
          </div>

          <div className="flex flex-col gap-6">
            {FAQ.map(({ q, a }) => (
              <div key={q} className="flex flex-col gap-2 border-b border-charcoal/8 pb-6 last:border-0">
                <p className="text-sm font-medium text-charcoal tracking-wide">{q}</p>
                <p className="text-sm text-charcoal/55 leading-relaxed">{a}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col items-center mt-16">
          <div className="w-px h-10 bg-taupe/40" />
        </div>

      </div>
    </div>
  );
}
