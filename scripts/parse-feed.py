import csv, json, os

csv_path = os.path.join(os.getcwd(), "datafeed_2824554.csv")
out_path = os.path.join(os.getcwd(), "lib", "mock-products.ts")

SKIP_NAMES = ["strumpor","kalsonger","boxer","badkläder","pyjamas","parfym","flerpack","underkläder"]
SKIP_CATS  = ["underkläder","strumpor","solglasögon","handväskor","parfym"]

def cat(c):
    c = c.lower()
    if "skor" in c or "sneaker" in c or "boots" in c: return "shoes"
    if "ytterkläder" in c or "kappor och jackor" in c: return "outerwear"
    if "byxor" in c or "jeans" in c or "shorts" in c: return "bottom"
    if "skjortor och toppar" in c or "tröjor" in c or "stickade" in c: return "top"
    return None

def style(name, c):
    n = name.lower()
    if "slim" in n or "skinny" in n: return ["Minimalistisk","Klassisk"]
    if "cargo" in n or "oversized" in n or "loose" in n or "baggy" in n: return ["Streetwear","Casual"]
    if "linen" in n or " lin" in n: return ["Minimalistisk","Skandinavisk"]
    if c == "outerwear": return ["Casual","Klassisk"]
    if c == "shoes": return ["Streetwear","Casual"]
    return ["Casual"]

seen = set()
out = []

debug_count = 0
with open(csv_path, encoding="utf-8-sig") as f:
    for row in csv.DictReader(f):
        debug_count += 1
        if debug_count == 1:
            import sys
            print(f"LOOP RUNS. stock={repr(row.get('in_stock'))} cat={repr(row.get('merchant_category','')[:40])}", file=sys.stderr)
        name  = (row.get("product_name") or "").strip()
        mc    = (row.get("merchant_category") or "").strip()
        stock = (row.get("in_stock") or "0").strip()
        pid   = ((row.get("parent_product_id") or "") or (row.get("aw_product_id") or "")).strip()
        brand = (row.get("brand_name") or "NLY Man").strip()
        img   = (row.get("merchant_image_url") or "").strip()
        link  = (row.get("aw_deep_link") or "").strip()
        col   = (row.get("colour") or "").strip()
        price_s = (row.get("search_price") or "0").strip().replace(",",".")
        old_s   = (row.get("product_price_old") or "0").strip().split()[0].replace(",",".")

        if stock not in ("1","yes","true"): continue
        if any(s in mc.lower() for s in SKIP_CATS): continue
        if any(s in name.lower() for s in SKIP_NAMES): continue
        c = cat(mc)
        if not c: continue
        if pid in seen: continue
        seen.add(pid)
        try:
            p = float(price_s) if price_s else 0
            op = float(old_s) if old_s else 0
        except ValueError:
            continue
        if p <= 0: continue
        b = " ".join(w.capitalize() for w in brand.split())
        prod = {"brand":b,"name":name,"price":p,"imageUrl":img,"category":c,
                "style":style(name,c),"colors":[col.lower()] if col else [""],
                "gender":"herr","condition":"new","isSecondHand":False,"link":link}
        if op > p: prod["originalPrice"] = op
        out.append(prod)
        if len(out) >= 120: break

ts = 'import { Product } from "./firestore-setup";\n\nexport const mockProducts: Omit<Product, "id">[] = ' + json.dumps(out, indent=2, ensure_ascii=False) + ";\n"
open(out_path, "w", encoding="utf-8").write(ts)
print(f"Klar! {len(out)} produkter → lib/mock-products.ts")
