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

  // ── Build prompt ──────────────────────────────────────────────────────────
  const shoppingLabel =
    profile.shoppingMode === "second_hand"
      ? "enbart second hand"
      : profile.shoppingMode === "new"
      ? "nya kläder"
      : "blandat nytt och second hand";

  const genderLabel =
    profile.gender === "dam"
      ? "dam (visa enbart dam- och unisex-plagg)"
      : profile.gender === "herr"
      ? "herr (visa enbart herr- och unisex-plagg)"
      : "båda (visa alla plagg oavsett kön)";

  const priceLabel: Record<string, string> = {
    budget: "under 200 kr",
    mellansegment: "200–500 kr",
    premium: "500–1 000 kr",
    lyx: "1 000 kr+",
    spelar_ingen_roll: "spelar ingen roll",
  };

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

  const condensedWardrobe = wardrobeItems.map((w) => ({
    category: w.category,
    colors: w.colors,
    style: w.analyzedStyle,
  }));

  const prompt = `Du är en personlig AI-stylist. Analysera användarens stilprofil och ranka produkterna.

ANVÄNDARENS STILPROFIL:
- Stilkategorier: ${(profile.styleCategories ?? []).join(", ") || "ej angivet"}
- Favoritfärger: ${(profile.colorPreferences ?? []).join(", ") || "ej angivet"}
- Färger att undvika: ${(profile.colorDislikes ?? []).join(", ") || "inga"}
- Prisklass: ${priceLabel[profile.priceRange] ?? "spelar ingen roll"}
- Shoppingläge: ${shoppingLabel}
- Stilbeskrivning med egna ord: "${profile.styleDescription ?? ""}"
- Handlar för: ${genderLabel}

ANVÄNDARENS GARDEROB (${condensedWardrobe.length} plagg):
${condensedWardrobe.length > 0 ? JSON.stringify(condensedWardrobe) : "Ingen garderob uppladdad"}

RANKINGPRINCIPER:
1. Matcha stil och färger från garderoben och stilprofilen
2. Om användaren har många plagg av samma typ (t.ex. toppar), rekommendera fler i andra färger och mönster
3. Prioritera plagg som kompletterar garderoben — om användaren har många toppar men få byxor, prioritera byxor
4. Matcha prisklass mot användarens preferens
5. Ta hänsyn till stilbeskrivningen extra mycket
6. Undvik rekommendera färger som användaren inte vill se

PRODUKTLISTA:
${JSON.stringify(condensedProducts)}

Returnera ENDAST JSON: {"ranked": ["id1", "id2", ...]} med alla produkt-id:n i rangordning.`;

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
          temperature: 0.2,
          maxOutputTokens: 512,
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
