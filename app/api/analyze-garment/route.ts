import { NextRequest, NextResponse } from "next/server";

export interface GarmentAnalysis {
  category: string;
  colors: string[];
  style: string[];
  description: string;
}

const PROMPT = `Analysera detta klädesplagg och returnera ENDAST ett JSON-objekt utan markdown, kodblock eller förklaringar.
Returnera exakt detta format:
{
  "category": "ett av: topp/byxor/kjol/klänning/jacka/skor/accessoar",
  "colors": ["färgnamn på svenska", "..."],
  "style": ["ett eller flera av: Minimalistisk/Vintage/Streetwear/Skandinavisk/Klassisk/Bohemisk/Sportig/Romantisk"],
  "description": "kort beskrivning på svenska, max 10 ord"
}`;

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "GEMINI_API_KEY saknas" }, { status: 500 });
  }

  const body = await req.json();
  console.log("[analyze-garment] Request body keys:", Object.keys(body), "mimeType:", body.mimeType, "base64 length:", body.base64?.length);

  const { base64, mimeType } = body;
  if (!base64 || !mimeType) {
    return NextResponse.json({ error: "base64 och mimeType krävs" }, { status: 400 });
  }

  const geminiRes = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { inlineData: { mimeType, data: base64 } },
              { text: PROMPT },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 512,
          responseMimeType: "application/json",
        },
      }),
    }
  );

  if (!geminiRes.ok) {
    const err = await geminiRes.text();
    console.error("[analyze-garment] Gemini HTTP error:", geminiRes.status, err);
    return NextResponse.json({ error: err }, { status: geminiRes.status });
  }

  const data = await geminiRes.json();
  console.log("[analyze-garment] Gemini full response:", JSON.stringify(data, null, 2));

  const raw = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  console.log("[analyze-garment] Raw text:", raw);

  if (!raw) {
    const finishReason = data.candidates?.[0]?.finishReason;
    console.error("[analyze-garment] Empty raw, finishReason:", finishReason);
    return NextResponse.json({ error: "Tomt svar från Gemini", finishReason }, { status: 422 });
  }

  try {
    // Strip markdown fences if present despite responseMimeType
    let cleaned = raw.replace(/```json\s*/gi, "").replace(/```/g, "").trim();

    // If there's still non-JSON text, extract first {...} block
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) cleaned = match[0];

    const analysis: GarmentAnalysis = JSON.parse(cleaned);

    // Ensure arrays exist
    analysis.colors = analysis.colors ?? [];
    analysis.style = analysis.style ?? [];
    analysis.category = analysis.category ?? "";
    analysis.description = analysis.description ?? "";

    console.log("[analyze-garment] Parsed analysis:", analysis);
    return NextResponse.json(analysis);
  } catch (err) {
    console.error("[analyze-garment] JSON parse failed. Raw was:", raw, "Error:", err);
    return NextResponse.json({ error: "Kunde inte tolka Gemini-svar", raw }, { status: 422 });
  }
}
