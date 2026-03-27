import { NextRequest, NextResponse } from "next/server";
import { collection, doc, getDoc, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Product } from "@/lib/firestore-setup";

interface RankedProduct extends Product {
  id: string;
}

interface WardrobeItem {
  category: string;
  colors: string[];
  analyzedStyle: string[];
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "GEMINI_API_KEY saknas" }, { status: 500 });
  }

  const { uid, sessionCategories, sessionDescription } = await req.json();

  // ── Fetch all products (always needed) ───────────────────────────────────
  const productsSnap = await getDocs(collection(db, "products"));
  const products: RankedProduct[] = productsSnap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as Product),
  }));

  console.log(`[get-recommendations] Products fetched: ${products.length}`);

  if (products.length === 0) {
    console.warn("[get-recommendations] ⚠️  No products found in Firestore — run /api/seed first");
    return NextResponse.json({ products: [] });
  }

  // ── No uid → return unranked products ─────────────────────────────────────
  if (!uid) {
    console.log("[get-recommendations] No uid — returning unranked products");
    return NextResponse.json({ products, hasProfile: false });
  }

  // ── Fetch user style profile ──────────────────────────────────────────────
  const userSnap = await getDoc(doc(db, "users", uid));
  const profile = userSnap.exists() ? userSnap.data() : null;

  if (!profile) {
    console.warn(`[get-recommendations] ⚠️  No profile found for uid: ${uid}`);
    return NextResponse.json({ products, hasProfile: false });
  }

  console.log("[get-recommendations] Profile loaded:", JSON.stringify({
    uid,
    shoppingMode: profile.shoppingMode,
    styleCategories: profile.styleCategories,
    colorPreferences: profile.colorPreferences,
    colorDislikes: profile.colorDislikes,
    priceRange: profile.priceRange,
    styleDescription: profile.styleDescription,
    wardrobeCount: profile.wardrobeCount,
  }, null, 2));

  // ── Warn if key fields are empty ──────────────────────────────────────────
  if (!profile.styleCategories?.length)
    console.warn("[get-recommendations] ⚠️  styleCategories is empty");
  if (!profile.colorPreferences?.length)
    console.warn("[get-recommendations] ⚠️  colorPreferences is empty");
  if (!profile.shoppingMode)
    console.warn("[get-recommendations] ⚠️  shoppingMode is missing");

  // ── Fetch wardrobe items ──────────────────────────────────────────────────
  const wardrobeSnap = await getDocs(collection(db, "wardrobes", uid, "items"));
  const wardrobeItems: WardrobeItem[] = wardrobeSnap.docs.map((d) => {
    const data = d.data();
    return {
      category: data.category ?? "",
      colors: data.colors ?? [],
      analyzedStyle: data.analyzedStyle ?? [],
    };
  });

  // ── Build prompt data ─────────────────────────────────────────────────────
  const shoppingLabel =
    profile.shoppingMode === "second_hand"
      ? "Enbart second hand — ranka BARA produkter med isSecondHand: true högst, lägg alla isSecondHand: false sist"
      : profile.shoppingMode === "new"
      ? "Enbart nytt — ranka BARA produkter med isSecondHand: false högst, lägg alla isSecondHand: true sist"
      : "Blandat — eftersträva ungefär 50/50-fördelning av nytt och second hand i resultatlistan";

  const genderLabel =
    profile.gender === "dam"
      ? "dam (prioritera dam- och unisex-plagg)"
      : profile.gender === "herr"
      ? "herr (prioritera herr- och unisex-plagg)"
      : "båda könen";

  const priceRangeLabel: Record<string, string> = {
    budget: "Budget — under 500 kr. Produkter över 500 kr rankas alltid sist oavsett andra faktorer.",
    mellansegment: "Mellansegment — 500–1500 kr. Produkter utanför detta intervall rankas ned.",
    premium: "Premium — 1500–4000 kr. Produkter utanför detta intervall rankas ned.",
    lyx: "Lyx — 4000+ kr. Alla prisklasser är ok.",
    spelar_ingen_roll: "Spelar ingen roll — ignorera pris i rankingen.",
  };

  // Wardrobe counts per category
  const wardrobeCounts: Record<string, number> = {};
  for (const item of wardrobeItems) {
    wardrobeCounts[item.category] = (wardrobeCounts[item.category] ?? 0) + 1;
  }

  // Gap score: 0 items → 3, 1-2 → 2, 3-4 → 1, 5+ → 0
  const allCategories = ["top", "bottom", "shoes", "outerwear"];
  const gapScores = Object.fromEntries(
    allCategories.map((cat) => {
      const n = wardrobeCounts[cat] ?? 0;
      const score = n === 0 ? 3 : n <= 2 ? 2 : n <= 4 ? 1 : 0;
      return [cat, { count: n, gap: score }];
    })
  );
  const underrepresented = allCategories
    .filter((cat) => gapScores[cat].gap >= 2)
    .map((cat) => `${cat} (${gapScores[cat].count} st, gap-score ${gapScores[cat].gap})`)
    .join(", ") || "ingen tydlig lucka";

  const wardrobeColors = Array.from(new Set(wardrobeItems.flatMap((w) => w.colors)));
  const wardrobeStyles = Array.from(new Set(wardrobeItems.flatMap((w) => w.analyzedStyle)));

  const condensedProducts = products.map((p) => ({
    id: p.id,
    brand: p.brand,
    name: p.name,
    price: p.price,
    category: p.category,
    style: p.style,
    colors: p.colors ?? [],
    isSecondHand: p.isSecondHand,
  }));

  // ── Session intent (highest priority override) ────────────────────────────
  const hasSessionIntent = (sessionCategories?.length > 0) || !!sessionDescription;
  const sessionIntentBlock = hasSessionIntent
    ? `
═══ AKTUELL SÖKINTENTION (ABSOLUT HÖGSTA PRIORITET — väger tyngre än ALLT annat) ═══
${sessionCategories?.length > 0 ? `Användaren letar SPECIFIKT efter dessa kategorier just nu: ${sessionCategories.join(", ")} — produkter i dessa kategorier ska rankas HÖGST oavsett allt annat.` : ""}
${sessionDescription ? `Användarens exakta sökbeskrivning just nu: "${sessionDescription}" — analysera nyckelord (plaggtyp, färg, tillfälle) och matcha produkter som passar denna beskrivning HÖGST i listan.` : ""}
Dessa signaler är färskare och viktigare än användarens sparade stilprofil.
`
    : "";

  const sizeContext = [
    profile.sizes?.top ? `Topp: ${profile.sizes.top}` : null,
    profile.pantSizeStandard ? `Byxor (standard): ${profile.pantSizeStandard}` : null,
    profile.pantSizeJeans ? `Byxor (jeans W/L): ${profile.pantSizeJeans}` : null,
    profile.sizes?.shoes ? `Skor: ${profile.sizes.shoes}` : null,
  ].filter(Boolean).join(", ") || "ej angivet";

  const prompt = `Du är en personlig AI-stylist. Ranka ALLA produkter nedan från mest till minst relevant för denna användare.
${sessionIntentBlock}
═══ ANVÄNDARKONTEXT ═══
Stilbeskrivning (viktigaste signalen): "${profile.styleDescription ?? ""}"
Stilkategorier: ${(profile.styleCategories ?? []).join(", ") || "ej angivet"}
Favoritfärger: ${(profile.colorPreferences ?? []).join(", ") || "ej angivet"}
Missgynnade färger: ${(profile.colorDislikes ?? []).join(", ") || "inga"}
Neutrala färger — straffas aldrig: svart, vit, grå, beige, navy
Prisklass: ${priceRangeLabel[profile.priceRange] ?? "Spelar ingen roll."}
Shoppingläge: ${shoppingLabel}
Kön: ${genderLabel}
Storlekar: ${sizeContext}

═══ GARDEROBSANALYS ═══
Toppar: ${wardrobeCounts["top"] ?? 0} st
Byxor: ${wardrobeCounts["bottom"] ?? 0} st
Skor: ${wardrobeCounts["shoes"] ?? 0} st
Jackor/ytterkläder: ${wardrobeCounts["outerwear"] ?? 0} st
Saknade/underrepresenterade kategorier: ${underrepresented}
Befintliga färger i garderoben: ${wardrobeColors.join(", ") || "okänt"}
Befintliga stilar i garderoben: ${wardrobeStyles.join(", ") || "okänt"}

═══ RANKNINGSINSTRUKTIONER (exakt prioritetsordning) ═══

1. STILBESKRIVNING — absolut högst prioritet
   Analysera vad användaren skrivit ovan. Om de nämner specifika plaggtyper ("jacka", "skjorta"), färger ("vita", "svarta") eller tillfällen ("jobb", "vardags") — lyft produkter som matchar detta HÖGST i listan. Väger tyngre än allt annat.

2. STIL-MATCHNING
   Produkter vars style-array innehåller något från [${(profile.styleCategories ?? []).join(", ")}] ska rankas högt. Produkter som inte matchar någon av användarens stilar rankas alltid lägre.

3. GARDEROBSBALANS — mjuk prioritering
   Underrepresenterade kategorier: ${underrepresented}
   Ge en lätt bonus till produkter i dessa kategorier, men låt stil och stilbeskrivning väga tyngre. En sko i fel stil ska inte hamna överst bara för att det saknas skor.

4. PRISNIVÅ
   ${priceRangeLabel[profile.priceRange] ?? "Ignorera pris."}

5. FÄRGKOMPATIBILITET
   Ranka upp: produkter i [${(profile.colorPreferences ?? []).join(", ") || "inga angivna"}]
   Ranka ned: produkter i [${(profile.colorDislikes ?? []).join(", ") || "inga angivna"}]
   Neutrala (svart, vit, grå, beige, navy) — alltid ok

6. SHOPPINGLÄGE
   ${shoppingLabel}

7. VARIATION — eftersträva i den färdiga listan
   - Samma märke max 2 gånger i rad
   - Varva kategorier: top → bottom → shoes → outerwear → top → bottom ...
   - Undvik att samma kategori upprepas mer än 2 gånger i rad

8. GARDEROBEN DUBBLETTER — lägst prioritet
   Om användaren redan har plagg med samma kategori + färg + stil som en produkt → ranka den lägst

═══ PRODUKTLISTA (${condensedProducts.length} produkter) ═══
${JSON.stringify(condensedProducts)}

═══ KRAV ═══
Ranka ALLA ${condensedProducts.length} produkter. Inget ID får utelämnas. Varje ID exakt en gång. Svara ENDAST med giltig JSON:
{"ranked": ["id1", "id2", ...]}`;

  console.log("[get-recommendations] Ranking", products.length, "products for uid:", uid,
    "| wardrobe:", wardrobeItems.length, "items | priceRange:", profile.priceRange);

  const geminiRes = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 2048,
          responseMimeType: "application/json",
        },
      }),
    }
  );

  if (!geminiRes.ok) {
    const err = await geminiRes.text();
    console.error("[get-recommendations] Gemini error:", geminiRes.status, err);
    return NextResponse.json({ products, hasProfile: true, ranked: false });
  }

  const data = await geminiRes.json();
  const raw = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  console.log("[get-recommendations] Gemini raw:", raw);

  try {
    const cleaned = raw.replace(/```json\s*/gi, "").replace(/```/g, "").trim();
    const match = cleaned.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(match ? match[0] : cleaned);
    const rankedIds: string[] = parsed.ranked ?? [];

    const productMap = new Map(products.map((p) => [p.id, p]));
    const ordered: RankedProduct[] = [];
    for (const id of rankedIds) {
      const p = productMap.get(id);
      if (p) { ordered.push(p); productMap.delete(id); }
    }
    productMap.forEach((p) => ordered.push(p));

    console.log("[get-recommendations] Returning", ordered.length, "ranked products");
    return NextResponse.json({ products: ordered, hasProfile: true, ranked: true });
  } catch (err) {
    console.error("[get-recommendations] Parse failed:", err, "raw:", raw);
    return NextResponse.json({ products, hasProfile: true, ranked: false });
  }
}
