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

  const prompt = `Du är en stylist. Svara ENDAST med ett JSON-objekt, inga andra ord, ingen förklaring, inga kodblock, ingen markdown.

Du MÅSTE inkludera alla tre fält: score, label och tip.

Exakt detta format:
{"score":85,"label":"Bra kombination","tip":"Neutrala färger skapar en harmonisk och tidlös look"}

Regler:
- score: heltal mellan 1 och 100
- label: exakt ett av: "Perfekt match", "Bra kombination", "Godkänd", "Svår kombination"
- tip: alltid en kort styling-kommentar på svenska, max 15 ord — får aldrig utelämnas

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
          temperature: 0.2,
          maxOutputTokens: 512,
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

  let parsed: { score?: unknown; label?: unknown; tip?: unknown; comment?: unknown; kommentar?: unknown } = {};

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
    tip: String(parsed.tip ?? parsed.comment ?? parsed.kommentar ?? ""),
  };
  console.log("[outfit-match] Result:", result);
  return NextResponse.json(result);
}
