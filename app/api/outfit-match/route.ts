import { NextRequest, NextResponse } from "next/server";

interface GarmentInput {
  name: string;
  style: string[];
  colors: string[];
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "GEMINI_API_KEY saknas" }, { status: 500 });
  }

  const { items }: { items: GarmentInput[] } = await req.json();
  console.log("[outfit-match] Received", items?.length, "items:", items?.map(i => i.name));

  if (!items || items.length < 2) {
    return NextResponse.json({ error: "Minst två plagg krävs" }, { status: 400 });
  }

  const prompt = `Du är en professionell stylist. Bedöm hur väl dessa plagg passar ihop som en outfit och returnera ENDAST JSON utan markdown:
{
  "score": (heltal 1-100),
  "label": (exakt ett av: "Perfekt match" / "Bra kombination" / "Godkänd" / "Svår kombination"),
  "tip": (en kort styling-kommentar på svenska, max 15 ord)
}

Plaggen i outfiten:
${items.map((item, i) => `${i + 1}. ${item.name} — stil: ${item.style.join(", ")} — färger: ${item.colors.join(", ")}`).join("\n")}`;

  const geminiRes = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 256,
          responseMimeType: "application/json",
        },
      }),
    }
  );

  if (!geminiRes.ok) {
    const err = await geminiRes.text();
    console.error("[outfit-match] Gemini error:", geminiRes.status, err);
    return NextResponse.json({ error: "Gemini-fel" }, { status: 500 });
  }

  const data = await geminiRes.json();
  const raw = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

  try {
    const cleaned = raw.replace(/```json\s*/gi, "").replace(/```/g, "").trim();
    const match = cleaned.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(match ? match[0] : cleaned);
    const result = {
      score: Number(parsed.score) || 50,
      label: parsed.label ?? "Godkänd",
      tip: parsed.tip ?? "",
    };
    console.log("[outfit-match] Returning:", result);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[outfit-match] Parse failed:", err, "raw:", raw);
    return NextResponse.json({ error: "Kunde inte tolka svar" }, { status: 422 });
  }
}
