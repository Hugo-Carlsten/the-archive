import { NextResponse } from "next/server";
import { collection, doc, setDoc, getDocs, deleteDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { mockProducts } from "@/lib/mock-products";

export async function POST() {
  try {
    const productsRef = collection(db, "products");

    // Delete all existing products first
    const existing = await getDocs(productsRef);
    await Promise.all(existing.docs.map((d) => deleteDoc(doc(productsRef, d.id))));
    console.log(`[seed] Deleted ${existing.docs.length} existing products`);

    // Write all mock products
    await Promise.all(
      mockProducts.map((product, index) => {
        const id = `product_${String(index + 1).padStart(3, "0")}`;
        return setDoc(doc(productsRef, id), product);
      })
    );

    console.log(`[seed] Seeded ${mockProducts.length} products`);
    return NextResponse.json({ status: "seeded", count: mockProducts.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ status: "error", message }, { status: 500 });
  }
}
