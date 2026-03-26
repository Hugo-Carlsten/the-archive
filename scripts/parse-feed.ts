import fs from "fs";
import path from "path";

// --- Läs CSV ---
const csvPath = path.join(process.cwd(), "datafeed_2824554.csv");
const raw = fs.readFileSync(csvPath, "utf-8");
const lines = raw.split("\n");
const headers = lines[0].split(",").map(h => h.trim().replace(/"/g, ""));

function parseRow(line: string): Record<string, string> {
  const values: string[] = [];
  let cur = "", inQ = false;
  for (const ch of line) {
    if (ch === '"') { inQ = !inQ; continue; }
    if (ch === "," && !inQ) { values.push(cur.trim()); cur = ""; }
    else cur += ch;
  }
  values.push(cur.trim());
  return Object.fromEntries(headers.map((h, i) => [h, values[i] ?? ""]));
}

// --- Kategorimappning ---
function mapCategory(merchantCat: string): string | null {
  const c = merchantCat.toLowerCase();
  if (c.includes("skor") || c.includes("sneaker") || c.includes("boots") || c.includes("loafer") || c.includes("sandal")) return "shoes";
  if (c.includes("jacka") || c.includes("kappa") || c.includes("coat") || c.includes("jacket") || c.includes("ytterkläder")) return "outerwear";
  if (c.includes("byxor") || c.includes("jeans") || c.includes("shorts") || c.includes("chino") || c.includes("slack")) return "bottom";
  if (c.includes("tröja") || c.includes("skjorta") || c.includes("t-shirt") || c.includes("hoodie") || c.includes("topp") || c.includes("stickad") || c.includes("sweatshirt") || c.includes("pikétröja") || c.includes("polotröja")) return "top";
  return null;
}

// --- Stilmappning ---
function mapStyle(name: string, cat: string, brand: string): string[] {
  const n = name.toLowerCase();
  const b = brand.toLowerCase();

  // STREETWEAR-märken
  if (["tommy jeans", "tommy hilfiger", "calvin klein", "new balance", "nike", "adidas", "rockandblue"].some(x => b.includes(x)))
    return ["Streetwear", "Minimalistisk"];

  // KLASSISK/FORMELL - kostymer, kavajer, skjortor, västar
  if (n.includes("kostym") || n.includes("kavaj") || n.includes("blazer") || n.includes("väst") || n.includes("waistcoat") || n.includes("skjorta") || n.includes("shirt"))
    return ["Klassisk", "Minimalistisk"];

  // SKANDINAVISK/MINIMALISTISK - enkla basplagg, linne, neutral
  if (n.includes("linen") || n.includes("lin ") || n.includes("basic") || n.includes("slim") || n.includes("crew") || n.includes("crewneck"))
    return ["Minimalistisk", "Skandinavisk"];

  // VINTAGE - retro, workwear, overshirts
  if (n.includes("overshirt") || n.includes("flanell") || n.includes("worker") || n.includes("cargo") || n.includes("vintage") || n.includes("retro"))
    return ["Vintage", "Streetwear"];

  // STREETWEAR - hoodies, sweatshirts, vida byxor, puffer
  if (n.includes("hoodie") || n.includes("sweat") || n.includes("puffer") || n.includes("parka") || n.includes("wide") || n.includes("baggy") || n.includes("track"))
    return ["Streetwear"];

  // SPORTIG - träning, tech, löpning
  if (n.includes("sport") || n.includes("tech") || n.includes("performance") || n.includes("training") || n.includes("running"))
    return ["Sportig"];

  // JACKOR - baserat på typ
  if (cat === "outerwear") {
    if (n.includes("trench") || n.includes("wool") || n.includes("ull")) return ["Klassisk", "Minimalistisk"];
    if (n.includes("denim") || n.includes("jeans")) return ["Vintage", "Streetwear"];
    if (n.includes("bomber")) return ["Streetwear", "Minimalistisk"];
    return ["Minimalistisk", "Skandinavisk"];
  }

  // SKOR - baserat på typ
  if (cat === "shoes") {
    if (n.includes("sneaker") || n.includes("basket") || n.includes("runner")) return ["Streetwear", "Minimalistisk"];
    if (n.includes("boot") || n.includes("käng")) return ["Vintage", "Klassisk"];
    if (n.includes("loafer") || n.includes("oxford") || n.includes("derby")) return ["Klassisk", "Minimalistisk"];
    return ["Minimalistisk"];
  }

  // DEFAULT
  return ["Minimalistisk", "Skandinavisk"];
}

// --- Filtrera och deduplicera ---
const SKIP_CATS = ["underkläder", "strumpor", "kalsonger", "boxer", "badkläder", "pyjamas", "solglasögon", "handväskor", "parfym"];

const seen = new Set<string>();
const products: object[] = [];

for (let i = 1; i < lines.length; i++) {
  if (!lines[i].trim()) continue;
  const row = parseRow(lines[i]);

  const name = row["product_name"] || "";
  const price = parseFloat(row["search_price"]) || 0;
  const oldPrice = parseFloat(row["product_price_old"]?.split(" ")[0]) || 0;
  const imageUrl = row["merchant_image_url"] || "";
  const link = row["aw_deep_link"] || "";
  const colour = row["colour"] || "";
  const merchantCat = (row["merchant_category"] || "").toLowerCase();
  const inStock = row["in_stock"] === "1" || row["in_stock"] === "yes";
  const parentId = row["parent_product_id"] || row["aw_product_id"] || "";
  const brandRaw = row["brand_name"] || "NLY Man";

  // Hoppa över om ej i lager
  if (!inStock) continue;

  // Hoppa över underkläder etc
  if (SKIP_CATS.some(s => merchantCat.includes(s))) continue;
  if (SKIP_CATS.some(s => name.toLowerCase().includes(s))) continue;

  // Kategorimappning sker FÖRE seen-check så att storlekvarianter med
  // generisk kategori inte blockerar varianter med specifik kategori
  const category = mapCategory(merchantCat);
  if (!category) continue;

  // En produkt per parent_id (undvik storleksdubbletter)
  if (seen.has(parentId)) continue;
  seen.add(parentId);

  const brand = brandRaw
    .split(" ")
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");

  const isOnSale = oldPrice > price;

  products.push({
    brand,
    name,
    price,
    ...(isOnSale && { originalPrice: oldPrice }),
    imageUrl,
    category,
    style: mapStyle(name, category, brandRaw),
    colors: colour ? [colour.toLowerCase()] : [""],
    gender: "herr",
    condition: "new",
    isSecondHand: false,
    link,
  });

  if (products.length >= 120) break;
}

// --- Skriv ut mock-products.ts ---
const output = `export const mockProducts = ${JSON.stringify(products, null, 2)};\n`;
fs.writeFileSync(path.join(process.cwd(), "lib", "mock-products.ts"), output);
console.log(`✅ Klar! ${products.length} produkter skrivna till lib/mock-products.ts`);
