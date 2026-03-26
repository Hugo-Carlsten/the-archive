import { NextResponse } from "next/server";

interface GarmentInput {
  name: string;
  style: string[];
  colors: string[];
}

export async function POST(request: Request) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "GEMINI_API_KEY saknas" }, { status: 500 });
  }

  const body = await request.json();
  console.log("[outfit-match] Body received:", JSON.stringify(body));

  // Accept both { items: [...] } and a direct array
  const items: GarmentInput[] = Array.isArray(body) ? body : (body.items || []);

  if (!items || items.length < 2) {
    console.log("[outfit-match] Not enough items:", items?.length);
    return NextResponse.json({ error: "Minst två plagg krävs" }, { status: 400 });
  }

  console.log("[outfit-match] Items:", items.map((i) => i.name));

  const itemList = items
    .map((item, i) => `${i + 1}. ${item.name} (stil: ${(item.style ?? []).join(", ") || "okänd"}, färger: ${(item.colors ?? []).join(", ") || "okänd"})`)
    .join("\n");

  const prompt = `Du är en expert-stylist. Svara ENDAST med ett JSON-objekt, inga andra ord, ingen förklaring, inga kodblock, ingen markdown.

Du MÅSTE inkludera alla tre fält: score, label och tip.

Exakt detta format:
{"score":85,"label":"Bra kombination","critique":"Sammanhängande streetwear-look med bra proportioner. Den röda detaljen lyfter hela outfiten.","tip":"Lägg till ett bälte för att definiera midjan ytterligare"}

BETYGSSKALA:
- score: heltal mellan 1 och 100
- label: exakt ett av: "Perfekt match", "Bra kombination", "Godkänd", "Svår kombination"
- critique: 1–2 meningar på svenska, max 30 ord — förklara VARFÖR outfiten fick sitt betyg, nämn specifika plagg och konkreta brister eller styrkor — får aldrig utelämnas
- tip: konkret handlingsorienterat förslag på svenska, max 20 ord — vad användaren KAN göra för att förbättra — får aldrig utelämnas

═══ BEDÖMNINGSREGLER ═══

FÄRGBEDÖMNING:
- Neutrala färger (svart, vit, beige, grå, navy) kombineras alltid bra → stabilt betyg, ingen straff
- Monokromatisk outfit (samma färg i olika nyanser) → högt betyg, +10 poäng
- En utstickande accentfärg i annars neutral outfit → BONUSPOÄNG, kan ge maxbetyg
  (t.ex. röda skor till helsvart outfit, gul detalj till all-beige = stiligt och modigt)
- Flera färgkrockar (t.ex. orange + lila + grön) → sänk betyget med 15–25 poäng
- Komplementfärger (motsatta på färghjulet) → kan fungera OM resten är neutralt, annars -10

STILKOHERENS:
- Alla plagg delar samma stil-tagg → högst möjliga betyg, ingen straff
- Minimalistisk + Klassisk → fungerar bra, ingen straff
- Streetwear + Casual → fungerar bra, ingen straff
- Streetwear + Vintage → kan fungera, -5 poäng
- Sportig blandad med Klassisk eller Minimalistisk → DÅLIGT, -20 poäng
- Klassisk stil + oversized plagg → sänk betyget hårt, -20 poäng

PROPORTIONER (viktigt för helhetsintrycket):
- Fitted/slim topp + wide/baggy byxor (herr) → BRA, +5 poäng
- Allt lite oversized i Streetwear/Casual (herr) → BRA, +5 poäng
- Oversized topp + slim byxor (herr) → DÅLIGT, -15 poäng
- Slim topp + wide/voluminöst nertill (dam) → BRA, +5 poäng
- Klassisk stil oavsett kön: fitted/slim silhuett → BRA; oversized → -15 poäng
- Matchande sportig silhuett (t.ex. tracksuit) → +10 poäng

TRENDER — ge bonuspoäng och nämn trenden i tipset:
- Tonal dressing (allt i samma färgfamilj) → +10, nämn i tipset
- Clean minimalism (få plagg, enkla snitt, neutrala färger) → +10, nämn i tipset
- Streetwear layering (hoodie + jacka + vida byxor) → +10, nämn i tipset
- Smart casual (jeans + skjorta eller kavaj) → +8, nämn i tipset
- Athleisure (sportig men sammanhängande) → +8, nämn i tipset

TIPSET SKA:
- Vara konkret och handlingsorienterat: "Byt skorna mot något mörkare för bättre balans"
- Nämna specifika plagg ur outfiten
- Om outfiten nästan är perfekt: föreslå en accessoar eller liten detalj
- Om outfiten följer en tydlig trend: bekräfta det, t.ex. "Clean minimalism — tidlöst och välbalanserat"
- Aldrig vara mer än 20 ord

Bedöm denna outfit:
${itemList}`;

  const geminiRes = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 1024,
        },
      }),
    }
  );

  if (!geminiRes.ok) {
    const err = await geminiRes.text();
    console.error("[outfit-match] Gemini HTTP error:", geminiRes.status, err);
    return NextResponse.json({ error: "Gemini-fel" }, { status: 500 });
  }

  const data = await geminiRes.json();
  console.log("[outfit-match] Full Gemini response parts:", JSON.stringify(data.candidates?.[0]?.content?.parts));

  // gemini-2.5-flash is a thinking model — parts[0] may be thought, parts[1] the answer.
  // Search all parts and take the last non-empty text.
  const parts: { text?: string; thought?: boolean }[] = data.candidates?.[0]?.content?.parts ?? [];
  const raw = [...parts]
    .reverse()
    .find((p) => p.text && p.text.trim() && !p.thought)?.text
    ?? [...parts].reverse().find((p) => p.text && p.text.trim())?.text
    ?? "";

  console.log("[outfit-match] Raw text:", raw);

  if (!raw) {
    console.error("[outfit-match] Empty raw, finishReason:", data.candidates?.[0]?.finishReason);
    // Return a fallback instead of 422 so the frontend can still show something
    return NextResponse.json({ score: 50, label: "Godkänd", tip: "" });
  }

  // Normalize: strip markdown fences, replace curly/smart quotes with straight quotes
  const normalized = raw
    .replace(/```json\s*/gi, "")
    .replace(/```/g, "")
    .replace(/[\u201C\u201D\u201E\u201F\u2033\u2036]/g, '"')
    .replace(/[\u2018\u2019\u201A\u201B\u2032\u2035]/g, "'")
    .trim();

  console.log("[outfit-match] Normalized:", normalized);

  let parsed: { score?: unknown; label?: unknown; critique?: unknown; tip?: unknown; comment?: unknown; kommentar?: unknown } = {};

  try {
    let result = JSON.parse(normalized);
    // Handle double-encoded JSON (string inside string)
    if (typeof result === "string") {
      result = JSON.parse(result);
    }
    parsed = result;
  } catch {
    // Fallback: extract first {...} block and try again
    const jsonMatch = normalized.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        parsed = JSON.parse(jsonMatch[0]);
      } catch (err2) {
        console.error("[outfit-match] All parse attempts failed:", err2, "normalized:", normalized);
        return NextResponse.json({ score: 50, label: "Godkänd", tip: "" });
      }
    } else {
      console.error("[outfit-match] No JSON object found in response:", normalized);
      return NextResponse.json({ score: 50, label: "Godkänd", tip: "" });
    }
  }

  const result = {
    score: Math.min(100, Math.max(1, Number(parsed.score) || 50)),
    label: String(parsed.label ?? "Godkänd"),
    critique: String(parsed.critique ?? parsed.comment ?? parsed.kommentar ?? ""),
    tip: String(parsed.tip ?? ""),
  };
  console.log("[outfit-match] Result:", result);
  return NextResponse.json(result);
}
