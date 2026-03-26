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

  const { uid } = await req.json();

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
      ? "enbart second hand (visa BARA isSecondHand: true)"
      : profile.shoppingMode === "new"
      ? "enbart nytt (visa BARA isSecondHand: false)"
      : "blandat nytt och second hand";

  const genderLabel =
    profile.gender === "dam"
      ? "dam (prioritera dam- och unisex-plagg)"
      : profile.gender === "herr"
      ? "herr (prioritera herr- och unisex-plagg)"
      : "båda könen";

  const priceRangeLabel: Record<string, string> = {
    budget: "budget — under 500 kr (produkter över 500 kr rankas lägst)",
    mellansegment: "mellansegment — 500–1500 kr (produkter utanför detta spannet rankas lägre)",
    premium: "premium — 1500–4000 kr (produkter utanför detta spannet rankas lägre)",
    lyx: "lyx — 4000+ kr (alla prisklasser ok)",
    spelar_ingen_roll: "spelar ingen roll",
  };

  // Wardrobe summary per category
  const wardrobeCounts: Record<string, number> = {};
  for (const item of wardrobeItems) {
    wardrobeCounts[item.category] = (wardrobeCounts[item.category] ?? 0) + 1;
  }
  const wardrobeColors = Array.from(new Set(wardrobeItems.flatMap((w) => w.colors)));
  const wardrobeStyles = Array.from(new Set(wardrobeItems.flatMap((w) => w.analyzedStyle)));
  const wardrobeSummary = wardrobeItems.length > 0
    ? `Användaren har: ${Object.entries(wardrobeCounts).map(([cat, n]) => `${n} ${cat}`).join(", ")}. ` +
      `Färger i garderoben: ${wardrobeColors.join(", ") || "okänt"}. ` +
      `Stilar i garderoben: ${wardrobeStyles.join(", ") || "okänt"}.`
    : "Ingen garderob uppladdad.";

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

  const neutralColors = ["svart", "vit", "grå", "beige", "vitt", "grått", "black", "white", "grey", "gray"];

  const prompt = `Du är en personlig AI-stylist. Din uppgift är att ranka ALLA produkter nedan från mest till minst relevant för denna specifika användare.

═══ ANVÄNDARENS STILPROFIL ═══
- Stilkategorier: ${(profile.styleCategories ?? []).join(", ") || "ej angivet"}
- Favoritfärger: ${(profile.colorPreferences ?? []).join(", ") || "ej angivet"}
- Färger att undvika: ${(profile.colorDislikes ?? []).join(", ") || "inga"}
- Neutrala färger (alltid ok): ${neutralColors.join(", ")}
- Prisklass: ${priceRangeLabel[profile.priceRange] ?? "spelar ingen roll"}
- Shoppingläge: ${shoppingLabel}
- Stilbeskrivning: "${profile.styleDescription ?? ""}"
- Kön: ${genderLabel}

═══ GARDEROB (${wardrobeItems.length} plagg) ═══
${wardrobeSummary}

═══ RANKNINGSREGLER (i prioritetsordning) ═══
1. STIL-MATCHNING (högst prioritet)
   → Produkter vars style-array innehåller något från [${(profile.styleCategories ?? []).join(", ")}] rankas HÖGST
   → Produkter med helt olik stil rankas lägre

2. GARDEROBET LUCKOR — fyll vad som saknas
   → Räkna plagg per kategori ovan. Kategorier med FÅ eller INGA plagg ska prioriteras.
   → Exempel: om 0 skor i garderoben → ranka skor högt oavsett annat

3. PRISNIVÅ
   → Produkter inom användarens prisklass rankas upp
   → Produkter utanför prisklass rankas ned (lägg dem sist)

4. FÄRGKOMPATIBILITET
   → Produkter i favoritfärger: ranka upp
   → Produkter i missgynnade färger: ranka ned
   → Neutrala färger (svart, vit, grå, beige): alltid kompatibla, ranka normalt

5. VARIATION — blanda i resultatlistan
   → Samma märke max 2 gånger i rad
   → Varva kategorier (top, bottom, shoes, outerwear) så de blandas
   → Om shoppingläge är "blandat": varva nytt och second hand

6. UNDVIK DUBBLETTER MED GARDEROBEN
   → Om användaren redan har plagg med samma kategori + färg + stil → ranka ned

═══ PRODUKTLISTA (${condensedProducts.length} produkter) ═══
${JSON.stringify(condensedProducts)}

═══ KRITISKA KRAV ═══
- Du MÅSTE returnera ALLA ${condensedProducts.length} produkt-ID:n — inget får utelämnas
- Varje ID får förekomma exakt EN gång
- Produkter som passar dåligt placeras SIST — men måste vara med
- Returnera ENDAST giltig JSON, inga förklaringar eller kommentarer

Returnera EXAKT detta format med alla ${condensedProducts.length} ID:n:
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
