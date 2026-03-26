import { NextResponse } from "next/server";

interface GarmentInput {
  name: string;
  brand?: string;
  category?: string;
  style: string[];
  colors: string[];
}

function calculateBaseScore(items: GarmentInput[]): number {
  if (items.length === 0) return 50;

  const allStyles = items.flatMap(item => item.style || []);
  const allColors = items.flatMap(item => item.colors || []);

  // Stilmatchning
  const styleCounts: Record<string, number> = {};
  allStyles.forEach(s => { styleCounts[s] = (styleCounts[s] || 0) + 1; });
  const maxStyleCount = Math.max(...Object.values(styleCounts));
  const styleScore = maxStyleCount / items.length;

  // Neutrala färger
  const neutralColors = ["svart", "vit", "beige", "grå", "navy", "marinblå", "brun", "off-white", "cremevit", "sand", "khaki", "mörkblå", "mörkgrå"];
  const neutralCount = allColors.filter(c =>
    neutralColors.some(n => c.toLowerCase().includes(n))
  ).length;
  const colorScore = neutralCount / Math.max(allColors.length, 1);

  let base = 50;

  if (styleScore >= 1.0) base += 25;
  else if (styleScore >= 0.75) base += 15;
  else if (styleScore >= 0.5) base += 5;
  else base -= 10;

  if (colorScore >= 0.75) base += 15;
  else if (colorScore >= 0.5) base += 8;

  if (items.length >= 3) base += 5;
  if (items.length >= 4) base += 5;

  return Math.min(Math.max(base, 30), 95);
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

  const baseScore = calculateBaseScore(items);
  console.log("[outfit-match] Base score:", baseScore);

  const itemList = items
    .map((item, i) =>
      `${i + 1}. NAMN: '${item.name}' | KATEGORI: ${item.category || "okänd"} | STIL: ${(item.style ?? []).join(", ") || "okänd"} | FÄRG: ${(item.colors ?? []).join(", ") || "okänd"} | MÄRKE: ${item.brand || "okänt"}`
    )
    .join("\n");

  const prompt = `Du är en expert-stylist. Svara ENDAST med ett JSON-objekt, inga andra ord, ingen förklaring, inga kodblock, ingen markdown.

Du MÅSTE inkludera alla fyra fält: score, label, critique och tip.

Exakt detta format:
{"score":85,"label":"Bra kombination","critique":"Sammanhängande casual-look med neutrala färger som fungerar bra ihop.","tip":"Lägg till ett bälte i brun nyans för att knyta ihop outfiten."}

BETYGSSKALA:
- score: heltal mellan 1 och 100
- label: exakt ett av: "Perfekt match", "Bra kombination", "Godkänd", "Svår kombination"
- critique: 1–2 meningar på svenska, MAX 25 ord — nämn alltid plaggens faktiska namn och färger, förklara konkret varför outfiten funkar eller inte — FÅR ALDRIG UTELÄMNAS
- tip: MAX 20 ord på svenska — nämn ett specifikt plagg ur outfiten och vad som ska ändras, aldrig generiska råd — FÅR ALDRIG UTELÄMNAS

VIKTIGT — CRITIQUE OCH TIP MÅSTE:
- Nämna minst ett specifikt plaggets namn eller märke från listan ovan
- Referera till de faktiska färgerna som finns i outfiten
- ALDRIG säga "saknar en tydlig stil-röd tråd" om alla plagg delar minst en stil
- ALDRIG vara generisk som "byt ett plagg mot något som matchar stilen bättre"
- Vid högt betyg (80+): bekräfta vad som fungerar bra och specifikt varför
- Vid lågt betyg (under 60): förklara exakt vilket plagg som inte passar och varför

Exempel på bra critique vid 90+: "Klassisk minimalistisk look — kavaj och kostymbyxor i brun skapar perfekt koherens"
Exempel på bra critique vid 60: "Svart sweatshirt krockar stilmässigt med den formella kavajens klassiska linje"
Exempel på bra tip vid 90+: "Lägg till ett bälte i samma bruna ton för att fullända looken"
Exempel på bra tip vid 60: "Byt ut kavajn mot en mörkare bomber för mer sammanhängande streetwear"

═══ GRUNDPRINCIP ═══

Betyg ska vara LÄTTA att få höga. En okej outfit ska få 70+. Reservera låga betyg (under 50) ENBART för verkliga misstag.

STANDARDNIVÅER — utgå alltid härifrån:
- Alla plagg har samma stil (t.ex. alla Casual) → startar på 75
- Neutrala/matchande färger (svart, vit, beige, grå, navy, brun) → startar på 75
- Båda ovanstående → startar på 85
- Komplett outfit (topp + byxor + skor + jacka) → +5 till +10 bonus

═══ HÖGT BETYG (75–100) ═══

GE högt betyg när:
- Alla plagg har samma stil-tagg → 75–85
- Neutrala färger i kombination → 75–90
- Monokromatisk outfit (samma färgfamilj, olika nyanser) → 80–90
- Sammanhängande stil + neutrala färger → 85–95
- Sammanhängande stil + smart färgkontrast (t.ex. röda skor till svart outfit) → 90–100
- Tonal dressing (allt i samma färgfamilj) → +10
- Clean minimalism (få plagg, enkla snitt, neutrala färger) → +10
- Streetwear layering (hoodie + jacka + vida byxor) → +10
- Smart casual (jeans + skjorta eller kavaj) → +8
- Athleisure (sportig men sammanhängande) → +8

═══ MELLANSEGMENT (50–74) ═══

GE mellansegment när:
- Blandade stilar som delvis fungerar (t.ex. Casual + Streetwear med liten dissonans)
- Några färger som inte riktigt matchar men inte krockar hårt
- Outfit saknar en tydlig kategori (t.ex. enbart toppar, inga byxor eller skor)

═══ LÅGT BETYG (under 50) — ENBART dessa fall ═══

GE lågt betyg ENDAST vid tydliga misstag:
- Tydlig färgkrock: orange + lila + grön simultaneously
- Sportig stil blandad med Klassisk eller Formell stil
- Oversized topp + slim/skinny byxor (fel proportioner för herr)
- Mer än 3 helt olika stilar blandas utan sammanhängande röd tråd

═══ VIKTIGA REGLER ═══

- Casual + Casual = alltid minst 75, oavsett allt annat
- Neutrala färger = ALDRIG lågt betyg
- Var generös — 70 är bättre än 45 för en okej outfit
- Betyg under 50 kräver ett tydligt, specifikt misstag som du MÅSTE nämna i critique
- Nämn trenden i tipset om outfiten följer en (t.ex. "Clean minimalism — tidlöst och välbalanserat")

═══ BETYGSINTERVALL ═══

VIKTIGT: Baserat på stilanalys är minimibetyget för denna outfit ${baseScore}. Du får INTE ge ett lägre betyg än ${baseScore - 5}. Om du ser ytterligare positiva faktorer (färgkontrast, trendmatchning, proportioner) ska du höja betyget över ${baseScore}. Ge ett betyg mellan ${baseScore - 5} och ${Math.min(baseScore + 15, 100)}.

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
          maxOutputTokens: 2048,
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
    return NextResponse.json({ score: baseScore, label: "Godkänd", critique: "Outfiten saknar en tydlig stil-röd tråd.", tip: "Prova att byta ett plagg mot något som matchar stilen bättre." });
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
        return NextResponse.json({ score: baseScore, label: "Godkänd", critique: "Outfiten saknar en tydlig stil-röd tråd.", tip: "Prova att byta ett plagg mot något som matchar stilen bättre." });
      }
    } else {
      console.error("[outfit-match] No JSON object found in response:", normalized);
      return NextResponse.json({ score: baseScore, label: "Godkänd", critique: "Outfiten saknar en tydlig stil-röd tråd.", tip: "Prova att byta ett plagg mot något som matchar stilen bättre." });
    }
  }

  const floor = Math.max(baseScore - 5, 1);
  const ceiling = Math.min(baseScore + 15, 100);
  const result = {
    score: Math.min(ceiling, Math.max(floor, Number(parsed.score) || baseScore)),
    label: String(parsed.label ?? "Godkänd"),
    critique: String(parsed.critique ?? parsed.comment ?? parsed.kommentar ?? ""),
    tip: String(parsed.tip ?? ""),
  };
  console.log("[outfit-match] Result:", result);
  return NextResponse.json(result);
}
