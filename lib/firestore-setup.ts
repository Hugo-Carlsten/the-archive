import { Timestamp } from "firebase/firestore";

// ─── users/{uid} ─────────────────────────────────────────────────────────────
export interface UserProfile {
  name: string;
  email: string;
  shoppingMode: "second_hand" | "new" | "mixed";
  sizes: {
    top?: string;     // XS | S | M | L | XL
    bottom?: string;  // 32 | 34 | 36 | 38 | 40
    shoes?: string;   // 36–46
  };
  styleCategories: string[];
  colorPreferences: string[];
  colorDislikes: string[];
  createdAt: Timestamp;
}

// ─── wardrobes/{uid}/items/{itemId} ──────────────────────────────────────────
export interface WardrobeItem {
  imageUrl: string;
  analyzedStyle: string[];
  colors: string[];
  category: "top" | "bottom" | "outerwear" | "shoes" | "accessory" | "dress";
  uploadedAt: Timestamp;
}

// ─── products/{id} ───────────────────────────────────────────────────────────
export interface Product {
  brand: string;
  name: string;
  price: number;
  originalPrice?: number;
  imageUrl: string;
  category: "top" | "bottom" | "outerwear" | "shoes" | "accessory" | "dress";
  style: string[];
  colors: string[];
  gender: "dam" | "herr" | "unisex";
  condition?: "new" | "like new" | "good" | "fair";
  isSecondHand: boolean;
  link: string;
}
