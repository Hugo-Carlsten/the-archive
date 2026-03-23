"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { doc, setDoc, Timestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, User } from "firebase/auth";
import { auth, db, storage } from "@/lib/firebase";
import type { GarmentAnalysis } from "@/app/api/analyze-garment/route";

// ─── Types ────────────────────────────────────────────────────────────────────

type ShoppingMode = "second_hand" | "new" | "mixed";
type Gender = "dam" | "herr" | "båda";

interface Sizes {
  top: string;
  bottom: string;
  shoes: string;
}

interface UploadedFile {
  id: string;
  file: File;
  preview: string;
  analysis: GarmentAnalysis | null;
  analyzing: boolean;
  error: boolean;
  editing: boolean;
}

interface FormData {
  shoppingMode: ShoppingMode | null;
  gender: Gender | null;
  sizes: Sizes;
  styleCategories: string[];
  colorPreferences: string[];
  colorDislikes: string[];
  wardrobeFiles: UploadedFile[];
  styleDescription: string;
  priceRange: string;
}

// ─── Data ─────────────────────────────────────────────────────────────────────

const SHOPPING_MODES = [
  {
    id: "second_hand" as ShoppingMode,
    emoji: "♻️",
    label: "Second Hand",
    desc: "Hållbart mode från Sellpy, Tradera och vintage-butiker",
  },
  {
    id: "new" as ShoppingMode,
    emoji: "✨",
    label: "Nya kläder",
    desc: "Säsongens nyheter från dina favoritvarumärken",
  },
  {
    id: "mixed" as ShoppingMode,
    emoji: "⚖️",
    label: "Blandning",
    desc: "Det bästa av båda — hållbart och nytt hand i hand",
  },
];

const TOP_SIZES = ["XS", "S", "M", "L", "XL"];
const BOTTOM_SIZES = ["32", "34", "36", "38", "40"];
const SHOE_SIZES = ["36", "37", "38", "39", "40", "41", "42", "43", "44", "45", "46"];

const STYLE_OPTIONS = [
  { id: "minimalistisk", emoji: "🪨", label: "Minimalistisk" },
  { id: "vintage", emoji: "🎞️", label: "Vintage" },
  { id: "streetwear", emoji: "🧢", label: "Streetwear" },
  { id: "skandinavisk", emoji: "🌿", label: "Skandinavisk" },
  { id: "klassisk", emoji: "🎩", label: "Klassisk" },
  { id: "bohemisk", emoji: "🌸", label: "Bohemisk" },
  { id: "sportig", emoji: "🏃", label: "Sportig" },
  { id: "romantisk", emoji: "🌹", label: "Romantisk" },
];

const COLORS = [
  { id: "svart", label: "Svart", hex: "#1a1a1a" },
  { id: "vit", label: "Vit", hex: "#f5f5f5" },
  { id: "beige", label: "Beige", hex: "#d4b896" },
  { id: "brun", label: "Brun", hex: "#7d5c45" },
  { id: "grå", label: "Grå", hex: "#9e9e9e" },
  { id: "marinblå", label: "Marinblå", hex: "#1a2f4a" },
  { id: "grön", label: "Grön", hex: "#4a7c59" },
  { id: "röd", label: "Röd", hex: "#c0392b" },
  { id: "rosa", label: "Rosa", hex: "#e8a0b4" },
  { id: "gul", label: "Gul", hex: "#d4b84a" },
];

// Approximate color mapping for displaying Gemini-returned color names
const COLOR_HEX_MAP: Record<string, string> = {
  svart: "#1a1a1a", vit: "#f5f5f5", vitt: "#f5f5f5", beige: "#d4b896",
  brun: "#7d5c45", grå: "#9e9e9e", blå: "#3b6cb7", marinblå: "#1a2f4a",
  grön: "#4a7c59", röd: "#c0392b", rosa: "#e8a0b4", gul: "#d4b84a",
  orange: "#e07b39", lila: "#7b5ea7", turkos: "#3a9e9e", kräm: "#f5f0e8",
  silver: "#c0c0c0", guld: "#c9a84c", offwhite: "#f0ece4", camel: "#c19a6b",
};

const GENDER_OPTIONS = [
  { id: "dam" as Gender, emoji: "👩", label: "Dam", desc: "Plagg för kvinnor" },
  { id: "herr" as Gender, emoji: "👨", label: "Herr", desc: "Plagg för män" },
  { id: "båda" as Gender, emoji: "✨", label: "Båda", desc: "Alla plagg oavsett kön" },
];

const TOTAL_STEPS = 8;

const PRICE_RANGES = [
  { id: "budget", label: "Budget", desc: "under 200 kr" },
  { id: "mellansegment", label: "Mellansegment", desc: "200–500 kr" },
  { id: "premium", label: "Premium", desc: "500–1 000 kr" },
  { id: "lyx", label: "Lyx", desc: "1 000 kr+" },
  { id: "spelar_ingen_roll", label: "Spelar ingen roll", desc: "alla prisklasser" },
];

const EDIT_COLORS = [
  { id: "svart", label: "Svart", hex: "#1a1a1a" },
  { id: "vit", label: "Vit", hex: "#f5f5f5" },
  { id: "grå", label: "Grå", hex: "#9e9e9e" },
  { id: "beige", label: "Beige", hex: "#d4b896" },
  { id: "brun", label: "Brun", hex: "#7d5c45" },
  { id: "blå", label: "Blå", hex: "#3b6cb7" },
  { id: "marinblå", label: "Marinblå", hex: "#1a2f4a" },
  { id: "grön", label: "Grön", hex: "#4a7c59" },
  { id: "röd", label: "Röd", hex: "#c0392b" },
  { id: "rosa", label: "Rosa", hex: "#e8a0b4" },
  { id: "gul", label: "Gul", hex: "#d4b84a" },
  { id: "orange", label: "Orange", hex: "#e07b39" },
];

const EDIT_CATEGORIES = ["topp", "byxor", "kjol", "klänning", "jacka", "skor", "accessoar"];
const EDIT_STYLES = ["Minimalistisk", "Vintage", "Streetwear", "Skandinavisk", "Klassisk", "Bohemisk", "Sportig", "Romantisk"];

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Strip data URL prefix: "data:image/jpeg;base64,"
      resolve(result.split(",")[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ProgressBar({ step }: { step: number }) {
  return (
    <div className="w-full max-w-lg mx-auto mb-10 px-6">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs tracking-[0.2em] text-taupe uppercase">
          Steg {step} av {TOTAL_STEPS}
        </span>
        <span className="text-xs text-charcoal/40">
          {Math.round((step / TOTAL_STEPS) * 100)}%
        </span>
      </div>
      <div className="h-px bg-charcoal/10 w-full">
        <div
          className="h-px bg-taupe transition-all duration-500"
          style={{ width: `${(step / TOTAL_STEPS) * 100}%` }}
        />
      </div>
    </div>
  );
}

function SizeSelector({
  label, options, value, onChange,
}: {
  label: string; options: string[]; value: string; onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs tracking-[0.2em] text-charcoal/50 uppercase">{label}</span>
      <div className="flex flex-wrap gap-2">
        {options.map((size) => (
          <button
            key={size}
            type="button"
            onClick={() => onChange(size === value ? "" : size)}
            className={`px-4 py-2 text-sm border transition-colors duration-150 ${
              value === size
                ? "border-[#2C2C2C] bg-[#2C2C2C] text-white"
                : "border-charcoal/20 bg-cream text-charcoal hover:border-charcoal/50"
            }`}
          >
            {size}
          </button>
        ))}
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <svg className="animate-spin w-5 h-5 text-taupe" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}

function GarmentCard({
  item, onRemove, onUpdateAnalysis, onToggleEditing,
}: {
  item: UploadedFile;
  index: number;
  onRemove: () => void;
  onUpdateAnalysis: (updated: GarmentAnalysis) => void;
  onToggleEditing: () => void;
}) {
  const [editCategory, setEditCategory] = useState(item.analysis?.category ?? "topp");
  const [editColors, setEditColors] = useState<string[]>(item.analysis?.colors ?? []);
  const [editStyles, setEditStyles] = useState<string[]>(item.analysis?.style ?? []);

  const colors = item.analysis?.colors ?? [];
  const styles = item.analysis?.style ?? [];
  const category = item.analysis?.category ?? "";
  const description = item.analysis?.description ?? "";

  function toggleEditColor(id: string) {
    setEditColors((prev) => prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]);
  }
  function toggleEditStyle(s: string) {
    setEditStyles((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]);
  }
  function saveEdit() {
    onUpdateAnalysis({
      category: editCategory,
      colors: editColors,
      style: editStyles,
      description: item.analysis?.description ?? "",
    });
    onToggleEditing();
  }

  return (
    <div className="flex flex-col border border-charcoal/10 overflow-hidden bg-cream">
      {/* Image */}
      <div className="relative aspect-square bg-charcoal/5 group">
        <img src={item.preview} alt="" className="w-full h-full object-cover" />
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          className="absolute top-1.5 right-1.5 w-6 h-6 bg-charcoal/80 text-white text-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
        >
          ×
        </button>
      </div>

      {/* ── Analyzing ── */}
      {item.analyzing && (
        <div className="p-3 flex items-center gap-2 border-t border-charcoal/10">
          <Spinner />
          <span className="text-xs text-charcoal/50 tracking-wider">Analyserar...</span>
        </div>
      )}

      {/* ── Edit mode ── */}
      {item.editing && item.analysis && !item.analyzing && (
        <div className="p-3 flex flex-col gap-3 border-t border-charcoal/10">
          {/* Category */}
          <div>
            <p className="text-[9px] tracking-widest text-charcoal/40 uppercase mb-1">Kategori</p>
            <select
              value={editCategory}
              onChange={(e) => setEditCategory(e.target.value)}
              className="w-full text-xs border border-charcoal/20 bg-cream text-charcoal px-2 py-1.5 focus:outline-none focus:border-charcoal/50 capitalize"
            >
              {EDIT_CATEGORIES.map((c) => (
                <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
              ))}
            </select>
          </div>

          {/* Colors */}
          <div>
            <p className="text-[9px] tracking-widest text-charcoal/40 uppercase mb-1.5">Färger</p>
            <div className="flex flex-wrap gap-1.5">
              {EDIT_COLORS.map((c) => {
                const on = editColors.includes(c.id);
                return (
                  <button key={c.id} type="button" onClick={() => toggleEditColor(c.id)} title={c.label}
                    className={`w-6 h-6 rounded-full border-2 transition-all ${on ? "border-charcoal scale-110" : "border-transparent hover:border-charcoal/30"}`}
                    style={{ backgroundColor: c.hex }}
                  />
                );
              })}
            </div>
          </div>

          {/* Styles */}
          <div>
            <p className="text-[9px] tracking-widest text-charcoal/40 uppercase mb-1.5">Stilar</p>
            <div className="flex flex-wrap gap-1">
              {EDIT_STYLES.map((s) => {
                const on = editStyles.includes(s);
                return (
                  <button key={s} type="button" onClick={() => toggleEditStyle(s)}
                    className={`px-2 py-0.5 text-[9px] tracking-wide border transition-colors ${on ? "bg-charcoal text-white border-charcoal" : "border-charcoal/20 text-charcoal/60 hover:border-charcoal/50"}`}
                  >
                    {s}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={saveEdit}
              className="flex-1 py-1.5 bg-charcoal text-white text-[10px] tracking-widest uppercase hover:bg-taupe transition-colors">
              Spara
            </button>
            <button type="button" onClick={onToggleEditing}
              className="px-3 py-1.5 border border-charcoal/20 text-charcoal/50 text-[10px] tracking-widest uppercase hover:border-charcoal/50 transition-colors">
              Avbryt
            </button>
          </div>
        </div>
      )}

      {/* ── Analysis result (view mode) ── */}
      {item.analysis && !item.analyzing && !item.editing && (
        <div className="p-3 flex flex-col gap-2 border-t border-charcoal/10">
          <div className="flex items-start justify-between gap-1">
            {category && (
              <span className="px-2 py-0.5 bg-charcoal text-white text-[9px] tracking-widest uppercase">
                {category}
              </span>
            )}
            <button type="button" onClick={() => { setEditCategory(category || "topp"); setEditColors(colors); setEditStyles(styles); onToggleEditing(); }}
              className="text-[9px] text-charcoal/40 hover:text-taupe tracking-wider uppercase transition-colors flex-shrink-0">
              Redigera
            </button>
          </div>

          {description && (
            <p className="text-xs text-charcoal/60 italic leading-snug">{description}</p>
          )}

          {colors.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {colors.slice(0, 5).map((c) => {
                const hex = COLOR_HEX_MAP[c.toLowerCase()] ?? "#ccc";
                return (
                  <div key={c} className="flex flex-col items-center gap-0.5">
                    <span className="w-4 h-4 rounded-full border border-charcoal/15" style={{ backgroundColor: hex }} />
                    <span className="text-[8px] text-charcoal/40 capitalize">{c}</span>
                  </div>
                );
              })}
            </div>
          )}

          {styles.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {styles.slice(0, 3).map((s) => (
                <span key={s} className="px-1.5 py-0.5 bg-taupe/10 text-taupe text-[9px] tracking-wide border border-taupe/20">
                  {s}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Error ── */}
      {item.error && !item.analyzing && (
        <div className="p-3 border-t border-charcoal/10">
          <span className="text-xs text-charcoal/35 italic">Analys misslyckades</span>
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Tracks file IDs already queued for analysis — prevents double-calls in StrictMode
  const analyzingRef = useRef<Set<string>>(new Set());

  const [form, setForm] = useState<FormData>({
    shoppingMode: null,
    gender: null,
    sizes: { top: "", bottom: "", shoes: "" },
    styleCategories: [],
    colorPreferences: [],
    colorDislikes: [],
    wardrobeFiles: [],
    styleDescription: "",
    priceRange: "",
  });

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, setUser);
    return unsub;
  }, []);

  // ── Toggle helpers ─────────────────────────────────────────────────────────

  function toggleSet(key: "styleCategories" | "colorPreferences" | "colorDislikes", id: string) {
    setForm((prev) => {
      const current = prev[key];
      return {
        ...prev,
        [key]: current.includes(id) ? current.filter((x) => x !== id) : [...current, id],
      };
    });
  }

  // ── Garment analysis (id-based, deduped via ref) ──────────────────────────

  async function analyzeFileById(id: string, file: File) {
    setForm((prev) => ({
      ...prev,
      wardrobeFiles: prev.wardrobeFiles.map((f) =>
        f.id === id ? { ...f, analyzing: true, error: false } : f
      ),
    }));

    try {
      const base64 = await fileToBase64(file);
      const res = await fetch("/api/analyze-garment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ base64, mimeType: file.type }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const analysis: GarmentAnalysis = await res.json();
      if ("error" in analysis) throw new Error(String((analysis as { error: string }).error));

      setForm((prev) => ({
        ...prev,
        wardrobeFiles: prev.wardrobeFiles.map((f) =>
          f.id === id ? { ...f, analysis, analyzing: false } : f
        ),
      }));
    } catch {
      setForm((prev) => ({
        ...prev,
        wardrobeFiles: prev.wardrobeFiles.map((f) =>
          f.id === id ? { ...f, analyzing: false, error: true } : f
        ),
      }));
    }
  }

  function addFiles(files: FileList | File[]) {
    const incoming = Array.from(files).filter((f) => f.type.startsWith("image/"));
    const slots = Math.max(0, 20 - form.wardrobeFiles.length);
    const toAdd = incoming.slice(0, slots);
    if (toAdd.length === 0) return;

    const newEntries: UploadedFile[] = toAdd.map((file) => ({
      id: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
      file,
      preview: URL.createObjectURL(file),
      analysis: null,
      analyzing: false,
      error: false,
      editing: false,
    }));

    // Update state in one pure call — no side-effects inside the updater
    setForm((prev) => ({
      ...prev,
      wardrobeFiles: [...prev.wardrobeFiles, ...newEntries],
    }));

    // Schedule analysis outside setForm — deduplicated via ref so StrictMode
    // double-invocation never triggers a second API call for the same file
    newEntries.forEach((entry) => {
      if (!analyzingRef.current.has(entry.id)) {
        analyzingRef.current.add(entry.id);
        analyzeFileById(entry.id, entry.file);
      }
    });
  }

  function removeFile(index: number) {
    setForm((prev) => {
      const next = [...prev.wardrobeFiles];
      URL.revokeObjectURL(next[index].preview);
      next.splice(index, 1);
      return { ...prev, wardrobeFiles: next };
    });
  }

  function updateAnalysis(index: number, updated: GarmentAnalysis) {
    setForm((prev) => {
      const next = [...prev.wardrobeFiles];
      next[index] = { ...next[index], analysis: updated };
      return { ...prev, wardrobeFiles: next };
    });
  }

  function toggleEditing(index: number) {
    setForm((prev) => {
      const next = [...prev.wardrobeFiles];
      next[index] = { ...next[index], editing: !next[index].editing };
      return { ...prev, wardrobeFiles: next };
    });
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    addFiles(e.dataTransfer.files);
  }, []);

  // ── Save to Firestore ──────────────────────────────────────────────────────

  async function handleFinish() {
    setSaving(true);
    try {
      let currentUser = user;

      if (!currentUser) {
        const provider = new GoogleAuthProvider();
        const result = await signInWithPopup(auth, provider);
        currentUser = result.user;
      }

      // Upload images and save wardrobe items with analysis
      const wardrobeItems: Array<{ imageUrl: string; analysis: GarmentAnalysis | null }> = [];

      for (const { file, analysis } of form.wardrobeFiles) {
        const storageRef = ref(storage, `wardrobes/${currentUser.uid}/${Date.now()}_${file.name}`);
        await uploadBytes(storageRef, file);
        const imageUrl = await getDownloadURL(storageRef);
        wardrobeItems.push({ imageUrl, analysis });
      }

      for (const { imageUrl, analysis } of wardrobeItems) {
        const itemId = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
        await setDoc(doc(db, "wardrobes", currentUser.uid, "items", itemId), {
          imageUrl,
          analyzedStyle: analysis?.style ?? [],
          colors: analysis?.colors ?? [],
          category: analysis?.category ?? "topp",
          description: analysis?.description ?? "",
          uploadedAt: Timestamp.now(),
        });
      }

      // Save full style profile to users/{uid}
      const profileData = {
        name: currentUser.displayName ?? "",
        email: currentUser.email ?? "",
        shoppingMode: form.shoppingMode,
        gender: form.gender,
        sizes: form.sizes,
        styleCategories: form.styleCategories,
        colorPreferences: form.colorPreferences,
        colorDislikes: form.colorDislikes,
        styleDescription: form.styleDescription,
        priceRange: form.priceRange,
        wardrobeCount: wardrobeItems.length,
        onboardingCompletedAt: Timestamp.now(),
        createdAt: Timestamp.now(),
      };
      console.log("[handleFinish] Saving profile to Firestore:", JSON.stringify({
        uid: currentUser.uid,
        shoppingMode: profileData.shoppingMode,
        gender: profileData.gender,
        styleCategories: profileData.styleCategories,
        colorPreferences: profileData.colorPreferences,
        colorDislikes: profileData.colorDislikes,
        priceRange: profileData.priceRange,
        styleDescription: profileData.styleDescription,
        wardrobeCount: profileData.wardrobeCount,
      }, null, 2));
      await setDoc(doc(db, "users", currentUser.uid), profileData);

      router.push("/feed");
    } catch (err) {
      console.error(err);
      setSaving(false);
    }
  }

  // ── Validation ─────────────────────────────────────────────────────────────

  const canProceed = [
    form.shoppingMode !== null,      // 1: shopping mode
    form.gender !== null,            // 2: gender
    true,                            // 3: sizes (optional)
    form.styleCategories.length > 0, // 4: style
    form.colorPreferences.length > 0, // 5: colors
    true,                            // 6: wardrobe (optional)
    true,                            // 7: style description (optional)
    form.priceRange !== "",          // 8: price range
  ][step - 1];

  const anyAnalyzing = form.wardrobeFiles.some((f) => f.analyzing);

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-cream flex flex-col">
      <div className="flex-1 flex flex-col items-center py-12 px-4">
        <ProgressBar step={step} />

        {/* ── Step 1: Shopping mode ── */}
        {step === 1 && (
          <div className="w-full max-w-lg flex flex-col items-center text-center">
            <div className="w-px h-8 bg-taupe/40 mb-8" />
            <h1 className="font-serif text-4xl text-charcoal tracking-tight mb-3">
              Hur shoppar du helst?
            </h1>
            <p className="text-sm text-charcoal/50 mb-10">
              Vi anpassar dina rekommendationer efter ditt val
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full mb-10">
              {SHOPPING_MODES.map((mode) => {
                const selected = form.shoppingMode === mode.id;
                return (
                  <button
                    key={mode.id}
                    type="button"
                    onClick={() => setForm((p) => ({ ...p, shoppingMode: mode.id }))}
                    className={`relative flex flex-col items-center gap-3 p-6 border transition-colors duration-150 text-center ${
                      selected
                        ? "border-[#2C2C2C] bg-[#2C2C2C]"
                        : "border-charcoal/20 bg-cream hover:border-charcoal/50"
                    }`}
                  >
                    {selected && (
                      <span className="absolute top-3 right-3">
                        <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                      </span>
                    )}
                    <span className="text-3xl">{mode.emoji}</span>
                    <span className={`font-serif text-lg tracking-wide ${selected ? "text-white" : "text-charcoal"}`}>
                      {mode.label}
                    </span>
                    <span className={`text-xs text-center leading-relaxed ${selected ? "text-white/70" : "text-charcoal/50"}`}>
                      {mode.desc}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Step 2: Gender ── */}
        {step === 2 && (
          <div className="w-full max-w-lg flex flex-col items-center text-center">
            <div className="w-px h-8 bg-taupe/40 mb-8" />
            <h1 className="font-serif text-4xl text-charcoal tracking-tight mb-3">
              Vem handlar du för?
            </h1>
            <p className="text-sm text-charcoal/50 mb-10">
              Vi anpassar produkterna efter ditt val
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full mb-10">
              {GENDER_OPTIONS.map((option) => {
                const selected = form.gender === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setForm((p) => ({ ...p, gender: option.id }))}
                    className={`relative flex flex-col items-center gap-3 p-6 border transition-colors duration-150 text-center ${
                      selected
                        ? "border-[#2C2C2C] bg-[#2C2C2C]"
                        : "border-charcoal/20 bg-cream hover:border-charcoal/50"
                    }`}
                  >
                    {selected && (
                      <span className="absolute top-3 right-3">
                        <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                      </span>
                    )}
                    <span className="text-3xl">{option.emoji}</span>
                    <span className={`font-serif text-lg tracking-wide ${selected ? "text-white" : "text-charcoal"}`}>
                      {option.label}
                    </span>
                    <span className={`text-xs text-center leading-relaxed ${selected ? "text-white/70" : "text-charcoal/50"}`}>
                      {option.desc}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Step 3: Sizes ── */}
        {step === 3 && (
          <div className="w-full max-w-lg flex flex-col items-center text-center">
            <div className="w-px h-8 bg-taupe/40 mb-8" />
            <h1 className="font-serif text-4xl text-charcoal tracking-tight mb-3">
              Dina storlekar
            </h1>
            <p className="text-sm text-charcoal/50 mb-10">
              Valfritt — vi använder detta för att filtrera rätt storlekar
            </p>
            <div className="w-full flex flex-col gap-8 text-left mb-10">
              <SizeSelector
                label="Topp / Tröja"
                options={TOP_SIZES}
                value={form.sizes.top}
                onChange={(v) => setForm((p) => ({ ...p, sizes: { ...p.sizes, top: v } }))}
              />
              <SizeSelector
                label="Byxor / Kjol"
                options={BOTTOM_SIZES}
                value={form.sizes.bottom}
                onChange={(v) => setForm((p) => ({ ...p, sizes: { ...p.sizes, bottom: v } }))}
              />
              <SizeSelector
                label="Skor"
                options={SHOE_SIZES}
                value={form.sizes.shoes}
                onChange={(v) => setForm((p) => ({ ...p, sizes: { ...p.sizes, shoes: v } }))}
              />
            </div>
          </div>
        )}

        {/* ── Step 4: Style ── */}
        {step === 4 && (
          <div className="w-full max-w-lg flex flex-col items-center text-center">
            <div className="w-px h-8 bg-taupe/40 mb-8" />
            <h1 className="font-serif text-4xl text-charcoal tracking-tight mb-3">
              Din stil
            </h1>
            <p className="text-sm text-charcoal/50 mb-10">
              Välj en eller flera stilar som passar dig
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full mb-10">
              {STYLE_OPTIONS.map((style) => {
                const selected = form.styleCategories.includes(style.id);
                return (
                  <button
                    key={style.id}
                    type="button"
                    onClick={() => toggleSet("styleCategories", style.id)}
                    className={`flex flex-col items-center gap-2 py-5 px-3 border transition-colors duration-150 ${
                      selected
                        ? "border-[#2C2C2C] bg-[#2C2C2C]"
                        : "border-charcoal/20 bg-cream hover:border-charcoal/50"
                    }`}
                  >
                    <span className="text-2xl">{style.emoji}</span>
                    <span className={`text-xs tracking-wide ${selected ? "text-white" : "text-charcoal"}`}>
                      {style.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Step 5: Colors ── */}
        {step === 5 && (
          <div className="w-full max-w-lg flex flex-col items-center text-center">
            <div className="w-px h-8 bg-taupe/40 mb-8" />
            <h1 className="font-serif text-4xl text-charcoal tracking-tight mb-3">
              Dina färger
            </h1>
            <p className="text-sm text-charcoal/50 mb-10">
              Välj vilka färger du gillar och inte gillar
            </p>
            <div className="w-full text-left mb-8">
              <p className="text-xs tracking-[0.2em] text-charcoal/50 uppercase mb-4">
                Favoritfärger
              </p>
              <div className="flex flex-wrap gap-4 mb-10">
                {COLORS.map((color) => {
                  const liked = form.colorPreferences.includes(color.id);
                  const lightColor = ["vit", "beige", "gul", "rosa", "grå"].includes(color.id);
                  return (
                    <button
                      key={color.id}
                      type="button"
                      onClick={() => toggleSet("colorPreferences", color.id)}
                      title={color.label}
                      className="flex flex-col items-center gap-1.5"
                    >
                      <span
                        className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-150 ${
                          liked
                            ? "ring-[3px] ring-[#2C2C2C] ring-offset-2"
                            : "ring-0 hover:ring-2 hover:ring-charcoal/30 hover:ring-offset-1"
                        }`}
                        style={{ backgroundColor: color.hex }}
                      >
                        {liked && (
                          <svg className={`w-5 h-5 ${lightColor ? "text-[#2C2C2C]" : "text-white"}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                          </svg>
                        )}
                      </span>
                      <span className="text-[10px] text-charcoal/50 tracking-wide">
                        {color.label}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="w-full h-px bg-charcoal/10 mb-8" />

              <p className="text-xs tracking-[0.2em] text-charcoal/50 uppercase mb-4">
                Färger jag vill undvika
              </p>
              <div className="flex flex-wrap gap-4">
                {COLORS.map((color) => {
                  const disliked = form.colorDislikes.includes(color.id);
                  const lightColor = ["vit", "beige", "gul", "rosa", "grå"].includes(color.id);
                  return (
                    <button
                      key={color.id}
                      type="button"
                      onClick={() => toggleSet("colorDislikes", color.id)}
                      title={color.label}
                      className="flex flex-col items-center gap-1.5"
                    >
                      <span
                        className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-150 ${
                          disliked
                            ? "border-charcoal opacity-50 scale-105"
                            : "border-transparent hover:border-charcoal/30"
                        }`}
                        style={{ backgroundColor: color.hex }}
                      >
                        {disliked && (
                          <svg className={`w-4 h-4 ${lightColor ? "text-charcoal" : "text-white"}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        )}
                      </span>
                      <span className="text-[10px] text-charcoal/50 tracking-wide">
                        {color.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ── Step 6: Wardrobe upload + analysis ── */}
        {step === 6 && (
          <div className="w-full max-w-lg flex flex-col items-center text-center">
            <div className="w-px h-8 bg-taupe/40 mb-8" />
            <h1 className="font-serif text-4xl text-charcoal tracking-tight mb-3">
              Din garderob
            </h1>
            <p className="text-sm text-charcoal/50 mb-1">
              Ladda upp bilder på kläder du redan äger
            </p>
            <p className="text-xs text-taupe mb-8">
              Ju fler plagg du laddar upp, desto bättre blir förslagen
            </p>

            {/* Drop zone */}
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`w-full border-2 border-dashed transition-all duration-200 cursor-pointer py-10 flex flex-col items-center gap-3 mb-6 ${
                dragOver
                  ? "border-taupe bg-taupe/5"
                  : "border-charcoal/20 hover:border-taupe/50 hover:bg-taupe/5"
              }`}
            >
              <svg className="w-9 h-9 text-taupe/40" fill="none" stroke="currentColor" strokeWidth="1" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
              </svg>
              <p className="text-sm text-charcoal/60 tracking-wide">
                {dragOver ? "Släpp bilderna här" : "Dra & släpp, eller klicka för att välja"}
              </p>
              <p className="text-xs text-charcoal/30">PNG · JPG · upp till 20 bilder</p>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => e.target.files && addFiles(e.target.files)}
            />

            {/* Garment grid with analysis */}
            {form.wardrobeFiles.length > 0 && (
              <div className="w-full">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs text-charcoal/40 tracking-widest uppercase">
                    {form.wardrobeFiles.length} plagg
                  </p>
                  {anyAnalyzing && (
                    <div className="flex items-center gap-1.5">
                      <Spinner />
                      <span className="text-xs text-charcoal/50">Analyserar med AI...</span>
                    </div>
                  )}
                  {!anyAnalyzing && form.wardrobeFiles.some((f) => f.analysis) && (
                    <span className="text-xs text-taupe">✓ Analys klar</span>
                  )}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {form.wardrobeFiles.map((item, i) => (
                    <GarmentCard
                      key={item.id}
                      item={item}
                      index={i}
                      onRemove={() => removeFile(i)}
                      onUpdateAnalysis={(updated) => updateAnalysis(i, updated)}
                      onToggleEditing={() => toggleEditing(i)}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Step 7: Style description ── */}
        {step === 7 && (
          <div className="w-full max-w-lg flex flex-col items-center text-center">
            <div className="w-px h-8 bg-taupe/40 mb-8" />
            <h1 className="font-serif text-4xl text-charcoal tracking-tight mb-3">
              Berätta om din stil
            </h1>
            <p className="text-sm text-charcoal/50 mb-10">
              Valfritt — ju mer du berättar, desto bättre blir förslagen
            </p>
            <textarea
              value={form.styleDescription}
              onChange={(e) => setForm((p) => ({ ...p, styleDescription: e.target.value }))}
              placeholder="Beskriv din stil med egna ord, vad letar du efter just nu?"
              rows={5}
              className="w-full border border-charcoal/20 bg-cream text-sm text-charcoal px-4 py-3 placeholder:text-charcoal/30 focus:outline-none focus:border-charcoal/50 resize-none leading-relaxed mb-4"
            />
            <p className="text-xs text-charcoal/30 self-start">
              T.ex. &quot;Jag gillar oversized kläder i neutrala färger, letar efter något till jobbet men ändå casual&quot;
            </p>
          </div>
        )}

        {/* ── Step 8: Price range ── */}
        {step === 8 && (
          <div className="w-full max-w-lg flex flex-col items-center text-center">
            <div className="w-px h-8 bg-taupe/40 mb-8" />
            <h1 className="font-serif text-4xl text-charcoal tracking-tight mb-3">
              Din prisklass
            </h1>
            <p className="text-sm text-charcoal/50 mb-10">
              Vad är din budget per plagg?
            </p>
            <div className="flex flex-col gap-3 w-full mb-10">
              {PRICE_RANGES.map((p) => {
                const selected = form.priceRange === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setForm((prev) => ({ ...prev, priceRange: p.id }))}
                    className={`relative flex items-center justify-between px-6 py-4 border transition-colors duration-150 ${
                      selected
                        ? "border-[#2C2C2C] bg-[#2C2C2C]"
                        : "border-charcoal/20 bg-cream hover:border-charcoal/50"
                    }`}
                  >
                    {selected && (
                      <span className="absolute right-4">
                        <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                      </span>
                    )}
                    <span className={`font-serif text-lg tracking-wide ${selected ? "text-white" : "text-charcoal"}`}>
                      {p.label}
                    </span>
                    <span className={`text-xs mr-8 ${selected ? "text-white/60" : "text-charcoal/40"}`}>
                      {p.desc}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Navigation ── */}
        <div className="w-full max-w-lg flex items-center justify-between mt-auto pt-10">
          {step > 1 ? (
            <button
              type="button"
              onClick={() => setStep((s) => s - 1)}
              className="text-xs tracking-[0.2em] text-charcoal/50 uppercase hover:text-taupe transition-colors"
            >
              ← Tillbaka
            </button>
          ) : (
            <span />
          )}

          {step < TOTAL_STEPS ? (
            <button
              type="button"
              onClick={() => setStep((s) => s + 1)}
              disabled={!canProceed}
              className={`px-10 py-3.5 text-sm tracking-[0.15em] uppercase transition-colors duration-150 ${
                canProceed
                  ? "bg-charcoal text-cream hover:bg-taupe"
                  : "bg-charcoal/20 text-charcoal/30 cursor-not-allowed"
              }`}
            >
              Nästa
            </button>
          ) : (
            <button
              type="button"
              onClick={handleFinish}
              disabled={saving || anyAnalyzing}
              className="px-10 py-3.5 bg-charcoal text-cream text-sm tracking-[0.15em] uppercase hover:bg-taupe transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {saving ? "Sparar..." : anyAnalyzing ? "Väntar på analys..." : "Klar — visa min feed"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
