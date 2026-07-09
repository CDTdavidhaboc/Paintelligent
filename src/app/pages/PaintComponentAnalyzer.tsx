import { useMemo, useRef, useState, useEffect } from "react";
import type { ChangeEvent, DragEvent } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Label } from "../components/ui/label";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Info,
  Droplet,
  Upload,
  X,
  ImageIcon,
  BookOpen,
} from "lucide-react";
import Papa from "papaparse";
import { GoogleGenAI } from "@google/genai";

type InventoryItem = Record<string, string>;

type PaintComponent = {
  no: string | number | null;
  brand: string;
  product: string;
  category: string;
  standardSize: string;
  volumeL?: number | string | null;
  weightKg?: number | string | null;
  estPricePHP: number;
  availability: string;
  percentage: number;
  amountMl: number;
  priceValue: number;
  stockLevel: number;
  stockUsed: number;
  remainingStock: number;
  stockStatus: "adequate" | "low" | "critical" | "out_of_stock" | string;
};

type ColorAnalysis = {
  hex: string;
  dominantColor: string;
  rgb: { r: number; g: number; b: number };
  consistency: {
    type: string;
    viscosity: string;
    description: string;
  };
  paintComponents: PaintComponent[];
  applicationGuide: string | {
    steps?: string[];
    tools?: string;
    dryingTime?: string;
  } | null;
  stockWarnings: string[];
  totalPrice: number;
};

const ai = new GoogleGenAI({
  apiKey: import.meta.env.VITE_GEMINI_API_KEY,
}); 

const toNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(String(value ?? "").replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : fallback;
};

const extractJson = (text: string) => {
  const cleaned = text
    .replace(/```json/g, "")
    .replace(/```/g, "")
    .trim();

  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");

  if (firstBrace === -1 || lastBrace === -1) {
    throw new Error("Gemini did not return valid JSON.");
  }

  return cleaned.slice(firstBrace, lastBrace + 1);
};


type VisionAnalysis = {
  colorHex: string;
  dominantColor: string;
  colorFamily: string;
  rgb: { r: number; g: number; b: number };
  finish: string;
  paintType: string;
  confidence: number;
  notes?: string;
};

const normalizeText = (value: unknown) => String(value ?? "").toLowerCase().trim();

const isActiveProduct = (item: any) => normalizeText(item.availability).includes("active");

const isAutomotiveProduct = (item: any) => {
  const haystack = `${item.product ?? ""} ${item.category ?? ""} ${item.brand ?? ""}`.toLowerCase();
  return [
    "automotive",
    "auto paint",
    "car paint",
    "vehicle",
    "motorcycle",
    "clear coat",
    "base coat",
    "2k",
    "1k",
  ].some((keyword) => haystack.includes(keyword));
};

const isPaintFormulationProduct = (item: any) => {
  const haystack = `${item.product ?? ""} ${item.category ?? ""}`.toLowerCase();
  return [
    "paint",
    "colorant",
    "tint",
    "tinter",
    "base",
    "latex",
    "enamel",
    "acrylic",
    "coating",
    "primer",
    "white",
    "red",
    "blue",
    "green",
    "yellow",
    "black",
    "magenta",
    "violet",
    "orange",
    "brown",
    "gray",
    "grey",
  ].some((keyword) => haystack.includes(keyword));
};

const colorKeywords: Record<string, string[]> = {
  red: ["red", "crimson", "scarlet", "ruby", "maroon"],
  pink: ["pink", "rose", "salmon", "fuchsia", "magenta"],
  magenta: ["magenta", "fuchsia", "pink", "rose", "violet", "purple"],
  purple: ["purple", "violet", "lavender", "magenta"],
  blue: ["blue", "sky", "navy", "azure", "cobalt"],
  green: ["green", "forest", "emerald", "lime", "olive"],
  yellow: ["yellow", "gold", "golden", "amber", "lemon"],
  orange: ["orange", "burnt", "coral", "peach"],
  brown: ["brown", "tan", "beige", "chocolate"],
  black: ["black"],
  white: ["white"],
  gray: ["gray", "grey", "silver", "neutral"],
};

const filterInventoryForFormulation = (inventory: any[], vision: VisionAnalysis) => {
  const family = normalizeText(vision.colorFamily || vision.dominantColor);
  const keywords = colorKeywords[family] || family.split(/\s+/).filter(Boolean);

  const activePaintProducts = inventory.filter(
    (item) => isActiveProduct(item) && !isAutomotiveProduct(item) && isPaintFormulationProduct(item),
  );

  const colorMatched = activePaintProducts.filter((item) => {
    const haystack = `${item.product ?? ""} ${item.category ?? ""} ${item.brand ?? ""}`.toLowerCase();
    return keywords.some((keyword) => haystack.includes(keyword));
  });

  const essentialMixingProducts = activePaintProducts.filter((item) => {
    const haystack = `${item.product ?? ""} ${item.category ?? ""}`.toLowerCase();
    return ["white", "black", "base", "neutral", "tint", "colorant", "primer"].some((keyword) =>
      haystack.includes(keyword),
    );
  });

  const merged = [...colorMatched, ...essentialMixingProducts, ...activePaintProducts];
  const unique = new Map<string, any>();

  merged.forEach((item) => {
    const key = `${item.no ?? ""}-${item.brand ?? ""}-${item.product ?? ""}`;
    if (!unique.has(key)) unique.set(key, item);
  });

  return Array.from(unique.values()).slice(0, 80);
};

const findInventoryMatch = (component: any, inventory: any[]) => {
  const product = normalizeText(component.product || component.Product || component.name);
  const brand = normalizeText(component.brand || component.Brand);

  return inventory.find((item) => {
    const itemProduct = normalizeText(item.product);
    const itemBrand = normalizeText(item.brand);
    return itemProduct === product && (!brand || itemBrand === brand);
  });
};

export default function PaintComponentAnalyzer() {
  const [colorAnalysis, setColorAnalysis] = useState<ColorAnalysis | null>(null);
  const [batchSizeLiters, setBatchSizeLiters] = useState(0.1);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState("");
  const [uploadedFileSize, setUploadedFileSize] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [processingStep, setProcessingStep] = useState(0);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);
  const [showAnalysisComplete, setShowAnalysisComplete] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, 80);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!isAnalyzing) {
      setProcessingStep(0);
      return;
    }

    const interval = window.setInterval(() => {
      setProcessingStep((current) => (current >= 4 ? 4 : current + 1));
    }, 1200);

    return () => window.clearInterval(interval);
  }, [isAnalyzing]);

  const loadInventory = async () => {
    const response = await fetch("/GPC_Products.csv");

    if (!response.ok) {
      throw new Error("Unable to load /public/GPC_Products.csv. Make sure the file is inside public/.");
    }

    const csvText = await response.text();

    const result = Papa.parse<InventoryItem>(csvText, {
      header: true,
      skipEmptyLines: true,
    });

    if (result.errors.length > 0) {
      console.warn("CSV parse warnings:", result.errors);
    }

    return result.data
      .filter((item) => item.Product || item.Brand || item.Category)
      .map((item) => ({
        no: item["No."],
        brand: item.Brand,
        product: item.Product,
        category: item.Category,
        standardSize: item["Standard Size"],
        stockLevel: toNumber(item.Stocks),
        volumeL: toNumber(item["Volume (L)"], 0),
        weightKg: toNumber(item["Weight (kg)"], 0),
        estPricePHP: toNumber(item["Est. Price (PHP)"]),
        availability: item.Availability || "Active",
      }));
  };

  const analyzeWithGemini = async (imageBase64: string | null) => {
    if (!imageBase64) {
      setAnalyzeError("Please upload a paint color image first.");
      return;
    }

    if (!import.meta.env.VITE_GEMINI_API_KEY) {
      setAnalyzeError("Missing VITE_GEMINI_API_KEY in your .env file.");
      return;
    }

    setIsAnalyzing(true);
    setAnalyzeError("");
    setColorAnalysis(null);

    try {
      const inventory = await loadInventory();
      console.log("Inventory loaded:", inventory);
      console.log("Total products:", inventory.length);

      /* ==========================================================
         STEP 1: GEMINI VISION AGENT
         Purpose: analyze ONLY the uploaded paint color.
         It does not choose products yet.
      ========================================================== */
      const visionPrompt = `
You are Paintelligent Vision Agent, a professional paint color analyzer for Garcia Paint Center.

Analyze ONLY the paint color in the uploaded image.

Ignore:
- shadows
- lighting changes
- glare
- camera exposure
- white balance
- background
- labels
- borders
- reflections

Estimate the average visible paint pigment occupying the largest area.

Return ONLY valid JSON. Do not include markdown.

Required JSON format:
{
  "colorHex": "#FF00CC",
  "dominantColor": "Vibrant Magenta",
  "colorFamily": "magenta",
  "rgb": { "r": 255, "g": 0, "b": 204 },
  "finish": "gloss/semi-gloss/matte/unknown",
  "paintType": "wall paint/latex/enamel/acrylic/unknown",
  "confidence": 0,
  "notes": "short explanation"
}
`;

      const visionResult = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [
          {
            role: "user",
            parts: [
              { text: visionPrompt },
              {
                inlineData: {
                  mimeType: imageBase64.startsWith("data:image/jpeg") ? "image/jpeg" : "image/png",
                  data: imageBase64.replace(/^data:image\/\w+;base64,/, ""),
                },
              },
            ],
          },
        ],
        config: {
          responseMimeType: "application/json",
        },
      });

      const visionText = visionResult.text ?? "";
      const visionRaw = JSON.parse(extractJson(visionText));

      const vision: VisionAnalysis = {
        colorHex: visionRaw.colorHex || visionRaw.hex || "#808080",
        dominantColor: visionRaw.dominantColor || "Unknown",
        colorFamily: normalizeText(visionRaw.colorFamily || visionRaw.dominantColor || "unknown"),
        rgb: visionRaw.rgb || { r: 128, g: 128, b: 128 },
        finish: visionRaw.finish || "unknown",
        paintType: visionRaw.paintType || "unknown",
        confidence: toNumber(visionRaw.confidence, 0),
        notes: visionRaw.notes || "",
      };

      console.log("Vision analysis:", vision);

      /* ==========================================================
         STEP 2: INVENTORY FILTER
         Purpose: reduce the product list before formulation.
         Gemini still creates the mixture, but only from usable stock.
      ========================================================== */
      const filteredInventory = filterInventoryForFormulation(inventory, vision);
      console.log("Filtered formulation inventory:", filteredInventory);
      console.log("Filtered products:", filteredInventory.length);

      if (filteredInventory.length === 0) {
        throw new Error("No active paint/colorant products were found in the inventory for formulation.");
      }

      /* ==========================================================
         STEP 3: GEMINI FORMULATION AGENT
         Purpose: create paint mixture based on target color + inventory.
         This keeps your original logic: AI recommends the mixture
         using allotted inventory products only.
      ========================================================== */
      const formulationPrompt = `
You are Paintelligent Formulation Agent, an expert paint mixture recommender for Garcia Paint Center.

The uploaded paint color was already analyzed by the Vision Agent.

Target color data:
${JSON.stringify(vision)}

Use ONLY this filtered inventory JSON:
${JSON.stringify(filteredInventory)}

Target batch size: ${batchSizeLiters} liters (${batchSizeLiters * 1000} ml)

Important rules:
1. Use ONLY products from the filtered inventory JSON.
2. Never invent products, brands, sizes, or prices.
3. Ignore products whose availability is not Active.
4. Do not suggest automotive color mixes, automotive paints, or automotive coatings.
5. Prefer actual paint, tint, colorant, base, latex, acrylic, enamel, or coating products.
6. The mixture must match the target HEX/RGB as closely as possible.
7. For vivid colors, use stronger colorant/tint percentage if available.
8. Use white/base paint to adjust brightness if needed.
9. Use black/deep tint only if needed to reduce brightness or deepen the tone.
10. Percentages must total exactly 100 or very close to 100.
11. amountMl values must total exactly ${batchSizeLiters * 1000} ml or very close.
12. priceValue must be estimated from the product price and used amount.
13. totalPrice must equal the sum of all priceValue fields.
14. stockUsed must represent estimated stock used for this batch.
15. remainingStock must be stockLevel - stockUsed.
16. stockStatus must be adequate, low, critical, or out_of_stock.
17. Return ONLY valid JSON. Do not include markdown.

Required JSON format:
{
  "colorHex": "${vision.colorHex}",
  "dominantColor": "${vision.dominantColor}",
  "rgb": ${JSON.stringify(vision.rgb)},
  "consistency": {
    "type": "Standard wall paint",
    "viscosity": "Medium",
    "description": "Short explanation"
  },
  "components": [
    {
      "no": 1,
      "brand": "",
      "product": "",
      "category": "",
      "standardSize": "",
      "volumeL": 0,
      "weightKg": 0,
      "estPricePHP": 0,
      "availability": "Active",
      "percentage": 0,
      "amountMl": 0,
      "priceValue": 0,
      "stockLevel": 0,
      "stockUsed": 0,
      "remainingStock": 0,
      "stockStatus": "adequate"
    }
  ],
  "applicationGuide": "",
  "stockWarnings": [],
  "totalPrice": 0
}
`;

      const formulationResult = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [
          {
            role: "user",
            parts: [{ text: formulationPrompt }],
          },
        ],
        config: {
          responseMimeType: "application/json",
        },
      });

      const formulationText = formulationResult.text ?? "";
      const geminiData = JSON.parse(extractJson(formulationText));

      const normalizedComponents = (geminiData.components || geminiData.paintComponents || [])
        .map((c: any) => {
          const matched = findInventoryMatch(c, filteredInventory);
          const source = matched || c;

          const stockLevel = toNumber(source.stockLevel ?? c.stockLevel ?? c.stock ?? c.Stocks);
          const stockUsed = toNumber(c.stockUsed);
          const remainingStock = toNumber(c.remainingStock, Math.max(stockLevel - stockUsed, 0));
          const stockStatus =
            c.stockStatus ||
            (remainingStock <= 0
              ? "out_of_stock"
              : remainingStock <= 5
                ? "low"
                : "adequate");

          return {
            no: source.no ?? c.no ?? c["No."] ?? null,
            brand: source.brand || c.brand || c.Brand || "—",
            product: source.product || c.product || c.Product || c.name || "—",
            category: source.category || c.category || c.Category || "—",
            standardSize: source.standardSize || c.standardSize || c["Standard Size"] || "—",
            volumeL: source.volumeL ?? c.volumeL ?? c["Volume (L)"] ?? null,
            weightKg: source.weightKg ?? c.weightKg ?? c["Weight (kg)"] ?? null,
            estPricePHP: toNumber(source.estPricePHP ?? c.estPricePHP ?? c["Est. Price (PHP)"]),
            availability: source.availability || c.availability || c.Availability || "Active",
            percentage: toNumber(c.percentage),
            amountMl: toNumber(c.amountMl ?? c.amount),
            priceValue: toNumber(c.priceValue),
            stockLevel,
            stockUsed,
            remainingStock,
            stockStatus,
          };
        })
        .filter((c: PaintComponent) => c.product !== "—" && isActiveProduct(c) && !isAutomotiveProduct(c));

      if (normalizedComponents.length === 0) {
        throw new Error("Gemini did not return usable inventory products. Try a clearer image or check your CSV product categories.");
      }

      const normalized: ColorAnalysis = {
        hex: geminiData.colorHex || geminiData.hex || vision.colorHex || "#808080",
        dominantColor: geminiData.dominantColor || vision.dominantColor || "Unknown",
        rgb: geminiData.rgb || vision.rgb || { r: 128, g: 128, b: 128 },
        consistency: geminiData.consistency || {
          type: "—",
          viscosity: "—",
          description: vision.notes || "—",
        },
        paintComponents: normalizedComponents,
        applicationGuide: geminiData.applicationGuide || null,
        stockWarnings: [
          ...(vision.confidence > 0 && vision.confidence < 75
            ? [`Color detection confidence is ${vision.confidence}%. Use a clearer, well-lit paint sample for better matching.`]
            : []),
          ...(geminiData.stockWarnings || []),
        ],
        totalPrice: toNumber(geminiData.totalPrice),
      };

      setColorAnalysis(normalized);
      setLastFetched(new Date());
      setShowAnalysisComplete(true);

setTimeout(() => {
  setShowAnalysisComplete(false);
}, 1800);
    } catch (err: any) {
      console.error(err);

      const message = String(err?.message || "");

      if (message.includes("429") || message.includes("RESOURCE_EXHAUSTED") || message.includes("quota")) {
        setAnalyzeError("Gemini quota/rate limit reached. Wait about 1 minute, then try again. If it still fails, your daily free quota may be used up.");
      } else {
        setAnalyzeError(err instanceof Error ? err.message : "Gemini analysis failed.");
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (!bytes) return "0 KB";
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const processImageFile = (file: File) => {
    if (!file.type.startsWith("image/")) {
      setAnalyzeError("Please upload a valid image file only.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      const base64 = ev.target?.result as string;
      setUploadedImage(base64);
      setUploadedFileName(file.name);
      setUploadedFileSize(formatFileSize(file.size));
      setColorAnalysis(null);
      setAnalyzeError("");
    };
    reader.readAsDataURL(file);
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processImageFile(file);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    processImageFile(file);
  };

  const handleRemoveImage = () => {
    setUploadedImage(null);
    setUploadedFileName("");
    setUploadedFileSize("");
    setColorAnalysis(null);
    setAnalyzeError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Scale components by batch size
    const scaledComponents = useMemo(() => {
      if (!colorAnalysis) return [];
      const scaleFactor = batchSizeLiters / 0.1;
      return colorAnalysis.paintComponents.map((c) => {
        const baseAmount =
          typeof c.amountMl === "number"
            ? c.amountMl
            : parseFloat(c.amountMl) || 0;
        const scaledAmount = (baseAmount * scaleFactor).toFixed(
          1,
        );
        const scaledPrice = c.priceValue * scaleFactor;
        return {
          ...c,
          scaledAmountMl: scaledAmount,
          scaledPrice,
        };
      });
    }, [colorAnalysis, batchSizeLiters]);

    const totalPrice = useMemo(
      () =>
        colorAnalysis?.totalPrice != null
          ? colorAnalysis.totalPrice * (batchSizeLiters / 0.1)
          : scaledComponents.reduce(
              (sum, c) => sum + (c.scaledPrice || 0),
              0,
            ),
      [scaledComponents, colorAnalysis, batchSizeLiters],
    );

    return (
  <div
    className={`
      min-h-screen bg-white p-7 pt-3 space-y-6
      transition-all duration-700 ease-out transform
      ${
        isVisible
          ? "opacity-100 translate-y-0 scale-100"
          : "opacity-0 translate-y-6 scale-[0.98]"
      }
    `}
  >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            {lastFetched && (
              <p className="text-xs text-gray-500 mt-1">
                Analyzed via Gemini AI · {lastFetched.toLocaleTimeString()}
              </p>
            )}
          </div>
        </div>

        {/* Image Upload */}
        <section>
          <Card className="overflow-hidden border border-green-100 shadow-sm">
            <CardHeader className="relative overflow-hidden bg-gradient-to-r from-green-50 via-white to-green-50">
              <div className="absolute inset-0 opacity-30 [background-image:linear-gradient(#1a4d2e18_1px,transparent_1px),linear-gradient(90deg,#1a4d2e18_1px,transparent_1px)] [background-size:22px_22px]" />
              <div className="relative flex items-start justify-between gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2 text-gray-900">
                    <span className="relative flex size-3">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#1a4d2e] opacity-75" />
                      <span className="relative inline-flex size-3 rounded-full bg-[#1a4d2e]" />
                    </span>
                    AI Vision Scanner
                  </CardTitle>
                  <CardDescription>
                    Upload a paint sample. Gemini first detects the color, then formulates a mixture using filtered inventory products only.
                  </CardDescription>
                </div>
                <Badge className="bg-[#1a4d2e] text-white shadow-sm">
                  {uploadedImage ? "IMAGE READY" : "AWAITING SAMPLE"}
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="space-y-4 pt-6">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />

              {!uploadedImage ? (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                  className={`
                    group relative min-h-[300px] cursor-pointer overflow-hidden rounded-2xl border-2 border-dashed p-6
                    transition-all duration-300
                    ${isDragging
                      ? "border-[#1a4d2e] bg-green-50 shadow-xl shadow-green-900/10 scale-[1.01]"
                      : "border-green-800/60 bg-white hover:border-[#1a4d2e] hover:bg-green-50/60 hover:shadow-xl hover:shadow-green-900/10"
                    }
                  `}
                >
                  <div className="absolute inset-0 opacity-40 [background-image:radial-gradient(circle_at_1px_1px,#1a4d2e_1px,transparent_0)] [background-size:24px_24px]" />
                  <div className="absolute left-0 top-0 h-1 w-full bg-gradient-to-r from-transparent via-[#1a4d2e] to-transparent opacity-60" />
                  <div className="absolute bottom-4 left-4 h-10 w-10 border-b-2 border-l-2 border-[#1a4d2e]/60" />
                  <div className="absolute bottom-4 right-4 h-10 w-10 border-b-2 border-r-2 border-[#1a4d2e]/60" />
                  <div className="absolute left-4 top-4 h-10 w-10 border-l-2 border-t-2 border-[#1a4d2e]/60" />
                  <div className="absolute right-4 top-4 h-10 w-10 border-r-2 border-t-2 border-[#1a4d2e]/60" />

                  <div className="relative flex min-h-[252px] flex-col items-center justify-center text-center">
                    <div className="relative mb-5">
                      <div className="absolute inset-0 animate-ping rounded-full bg-[#1a4d2e]/20" />
                      <div className="relative flex size-24 items-center justify-center rounded-full border border-[#1a4d2e]/20 bg-white shadow-lg shadow-green-900/10 transition-transform duration-300 group-hover:scale-105">
                        <Upload className="size-11 text-[#1a4d2e]" />
                      </div>
                    </div>

                    <p className="text-lg font-bold text-gray-900">
                      Drop paint sample here
                    </p>
                    <p className="mt-1 text-sm text-gray-500">
                      or click to browse from your device
                    </p>

                    <div className="mt-5 flex flex-wrap justify-center gap-2">
                      {['JPG', 'PNG', 'JPEG', 'WEBP'].map((format) => (
                        <Badge key={format} variant="secondary" className="bg-green-50 text-[#1a4d2e] border border-green-100">
                          {format}
                        </Badge>
                      ))}
                    </div>

                    <div className="mt-6 rounded-full border border-green-100 bg-white/80 px-4 py-2 text-xs font-medium text-gray-500 shadow-sm">
                      Vision AI → Inventory Filter → Paint Mixture Formula
                    </div>
                  </div>
                </div>
              ) : ( 
                <div className="grid gap-5 lg:grid-cols-[1.3fr_0.7fr]">
                 <div className="relative inline-block overflow-hidden rounded-2xl border border-green-100 shadow-xl shadow-green-900/10">
                    <div className="absolute left-4 top-4 z-10 rounded-full border border-green-300/40 bg-black/40 px-3 py-1 text-xs font-semibold text-green-100 backdrop-blur">
                      AI CAMERA FEED
                    </div>
                    <div className="absolute right-4 top-4 z-10 rounded-full border border-green-300/40 bg-[#1a4d2e]/80 px-3 py-1 text-xs font-semibold text-white backdrop-blur">
                      SAMPLE LOCKED
                    </div>

                    <img
                      src={uploadedImage}
                      alt="Uploaded color"
                      className="max-h-[420px] w-full object-contain opacity-95"
                    />

                    <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(transparent_0%,rgba(26,77,46,0.08)_50%,transparent_100%)]" />
                    <div className="pointer-events-none absolute inset-0 [background-image:linear-gradient(#ffffff10_1px,transparent_1px),linear-gradient(90deg,#ffffff10_1px,transparent_1px)] [background-size:34px_34px]" />
                    <div className="absolute left-5 top-5 h-12 w-12 border-l-2 border-t-2 border-green-300" />
                    <div className="absolute right-5 top-5 h-12 w-12 border-r-2 border-t-2 border-green-300" />
                    <div className="absolute bottom-5 left-5 h-12 w-12 border-b-2 border-l-2 border-green-300" />
                    <div className="absolute bottom-5 right-5 h-12 w-12 border-b-2 border-r-2 border-green-300" />

                    <div className="absolute left-0 top-0 h-[3px] w-full animate-[scan_2.4s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-green-300 to-transparent shadow-[0_0_18px_rgba(134,239,172,0.9)]" />

                    {isAnalyzing && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/70 p-6 text-center backdrop-blur-sm">
                        <div className="relative flex size-20 items-center justify-center rounded-full border border-green-300/40 bg-[#1a4d2e]/40">
                          <Loader2 className="size-10 animate-spin text-white" />
                        </div>
                        <div>
                          <p className="text-lg font-bold text-white">Gemini AI is processing the sample</p>
                          <p className="mt-1 text-sm text-green-100">
                            {[
                              "Initializing Vision Agent...",
                              "Detecting dominant paint pigment...",
                              "Filtering active inventory products...",
                              "Generating paint mixture formula...",
                              "Calculating price and stock impact...",
                            ][processingStep]}
                          </p>
                        </div>
                        <div className="h-2 w-full max-w-md overflow-hidden rounded-full bg-white/20">
                          <div
                            className="h-full rounded-full bg-green-300 transition-all duration-500"
                            style={{ width: `${(processingStep + 1) * 20}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {showAnalysisComplete && !isAnalyzing && (
  <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-in fade-in duration-500">

    <div className="flex w-[420px] flex-col items-center rounded-2xl border border-green-300/30 bg-[#0f1720]/95 px-10 py-10 shadow-2xl">

      <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-green-500 shadow-[0_0_40px_rgba(34,197,94,0.5)]">
        <CheckCircle2 className="h-14 w-14 text-white" />
      </div>

      <h2 className="text-3xl font-bold text-white">
        Analysis Complete
      </h2>

      <p className="mt-3 text-center text-sm leading-relaxed text-green-100">
        Gemini AI successfully analyzed the uploaded paint sample.
      </p>

      <p className="text-center text-sm text-green-100">
        Paint mixture has been generated using your available inventory.
      </p>

      <div className="mt-8 w-full rounded-xl border border-green-400/20 bg-[#1a4d2e]/20 p-4">

        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm text-green-200">
            Vision Analysis
          </span>

          <CheckCircle2 className="h-5 w-5 text-green-400" />
        </div>

        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm text-green-200">
            Inventory Matching
          </span>

          <CheckCircle2 className="h-5 w-5 text-green-400" />
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm text-green-200">
            Paint Formula Generated
          </span>

          <CheckCircle2 className="h-5 w-5 text-green-400" />
        </div>

      </div>

      <div className="mt-6 flex items-center gap-2 rounded-full border border-green-400/30 bg-green-500/10 px-5 py-2">
        <div className="h-2.5 w-2.5 rounded-full bg-green-400 animate-pulse" />
        <span className="text-xs font-semibold tracking-[0.25em] text-green-200">
          READY TO REVIEW RESULTS
        </span>
      </div>

    </div>
  </div>
)}
                  </div>

                  <div className="space-y-4">
                    <div className="rounded-2xl border border-green-100 bg-gradient-to-br from-green-50 via-white to-white p-5 shadow-sm">
                      <div className="flex items-center gap-3">
                        <div className="flex size-12 items-center justify-center rounded-xl bg-[#1a4d2e] text-white shadow-md">
                          <ImageIcon className="size-6" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-gray-900">Paint Sample Uploaded</p>
                          <p className="text-xs text-gray-500">Ready for AI formulation</p>
                        </div>
                      </div>

                      <div className="mt-5 space-y-3 text-sm">
                        <div className="flex items-center justify-between rounded-lg bg-white px-3 py-2 shadow-sm">
                          <span className="text-gray-500">File</span>
                          <span className="max-w-[160px] truncate font-semibold text-gray-800">{uploadedFileName || "paint-sample"}</span>
                        </div>
                        <div className="flex items-center justify-between rounded-lg bg-white px-3 py-2 shadow-sm">
                          <span className="text-gray-500">Size</span>
                          <span className="font-semibold text-gray-800">{uploadedFileSize || "—"}</span>
                        </div>
                        <div className="flex items-center justify-between rounded-lg bg-white px-3 py-2 shadow-sm">
                          <span className="text-gray-500">Status</span>
                          <Badge className="bg-[#1a4d2e] text-white">AI READY</Badge>
                        </div>
                        <div className="flex items-center justify-between rounded-lg bg-white px-3 py-2 shadow-sm">
                          <span className="text-gray-500">Batch</span>
                          <span className="font-semibold text-[#1a4d2e]">{(batchSizeLiters * 1000).toFixed(0)} ml</span>
                        </div>
                      </div>
                    </div>

                    {analyzeError && (
                      <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3">
                        <AlertTriangle className="mt-0.5 size-5 flex-shrink-0 text-red-600" />
                        <p className="text-sm text-red-700">{analyzeError}</p>
                      </div>
                    )}

                    <Button
                      onClick={() => analyzeWithGemini(uploadedImage)}
                      disabled={isAnalyzing}
                      className="h-12 w-full rounded-xl bg-[#1a4d2e] text-white shadow-lg shadow-green-900/15 transition-all duration-200 hover:bg-[#1a4d2e] hover:shadow-xl hover:-translate-y-0.5 disabled:opacity-50"
                    >
                      {isAnalyzing ? (
                        <>
                          <Loader2 className="mr-2 size-4 animate-spin" />
                          Analyzing Paint Formula...
                        </>
                      ) : (
                        <>
                          <ImageIcon className="mr-2 size-4" />
                          Analyze Paint Sample
                        </>
                      )}
                    </Button>

                    <div className="grid grid-cols-2 gap-3">
                      <Button
                        onClick={() => fileInputRef.current?.click()}
                        variant="outline"
                        disabled={isAnalyzing}
                        className="h-11 rounded-xl border-gray-300 bg-white shadow-sm transition-all duration-200 hover:bg-gray-50 hover:shadow-md"
                      >
                        <Upload className="mr-2 size-4" />
                        Replace
                      </Button>
                      <Button
                        onClick={handleRemoveImage}
                        disabled={isAnalyzing}
                        className="h-11 rounded-xl bg-red-500 text-white shadow-sm transition-all duration-200 hover:bg-red-600 hover:shadow-md"
                      >
                        <X className="mr-2 size-4" />
                        Remove
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        <style>{`
          @keyframes scan {
            0% { transform: translateY(0); opacity: 0; }
            12% { opacity: 1; }
            50% { opacity: 1; }
            100% { transform: translateY(360px); opacity: 0; }
          }
        `}</style>

        {/* Results from Gemini AI */}
        {colorAnalysis && (
          <>
            {/* Color Overview */}
            <Card className="border-l-4 border-[#1a4d2e]">
              <CardContent className="pt-5">
                <div className="flex items-center gap-4">
                  <div
                    className="size-16 rounded-xl border-2 border-white shadow-lg flex-shrink-0"
                    style={{ backgroundColor: colorAnalysis.hex }}
                  />
                  <div>
                    <p className="text-2xl font-bold text-gray-900">
                      {colorAnalysis.hex.toUpperCase()}
                    </p>
                    <p className="text-sm text-gray-500">
                      Dominant:{" "}
                      <span className="font-medium text-gray-700">
                        {colorAnalysis.dominantColor}
                      </span>
                      &nbsp;·&nbsp;RGB({colorAnalysis.rgb.r},{" "}
                      {colorAnalysis.rgb.g}, {colorAnalysis.rgb.b}
                      )
                    </p>
                  </div>
                  <div className="ml-auto flex items-center gap-2 text-green-700 bg-green-50 px-4 py-2 rounded-lg border border-green-200">
                    <CheckCircle2 className="size-5" />
                    <span className="text-sm font-semibold">
                      AI Analysis Complete
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Paint Mixing Formula + Prices */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Droplet className="size-5 text-[#1a4d2e]" />
                  Suggested Paint Mixture & Pricing
                </CardTitle>
                <CardDescription>
                  AI-recommended components for{" "}
                  {colorAnalysis.hex.toUpperCase()} from Garcia
                  Paint Center stock
                </CardDescription>
              </CardHeader>
              <CardContent>
                {/* Batch Size */}
                <div className="mb-6 p-4 bg-green-50 rounded-lg border-2 border-[#1a4d2e]">
                  <Label className="text-sm font-semibold text-gray-700 mb-2 block">
                    Target Batch Size (Liters)
                  </Label>
                  <div className="flex items-center gap-4 flex-wrap">
                    <input
                      type="number"
                      min="0.01"
                      step="0.1"
                      value={batchSizeLiters}
                      onChange={(e) =>
                        setBatchSizeLiters(
                          parseFloat(e.target.value) || 0.1,
                        )
                      }
                      className="w-36 px-4 py-2 border-2 border-[#1a4d2e] rounded-lg font-medium focus:outline-none focus:ring-2 focus:ring-[#1a4d2e]"
                    />
                    <span className="text-sm text-gray-600">
                      = {(batchSizeLiters * 1000).toFixed(0)} ml
                    </span>
                    <div className="ml-auto flex gap-2">
                      {[
                        { label: "100ml", val: 0.1 },
                        { label: "500ml", val: 0.5 },
                        { label: "1L", val: 1 },
                        { label: "5L", val: 5 },
                      ].map(({ label, val }) => (
                        <Button
                          key={val}
                          onClick={() => setBatchSizeLiters(val)}
                          className={`text-xs ${batchSizeLiters === val ? "bg-[#2d6b45]" : "bg-[#1a4d2e] hover:bg-[#2d6b45]"}`}
                        >
                          {label}
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>No.</TableHead>
                      <TableHead>Brand</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Size</TableHead>
                      <TableHead>%</TableHead>
                      <TableHead>
                        Amount ({batchSizeLiters}L)
                      </TableHead>
                      <TableHead>Est. Price/unit</TableHead>
                      <TableHead>Stock</TableHead>
                      <TableHead className="text-right">
                        Subtotal (₱)
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {scaledComponents.map((c, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-xs text-gray-500">
                          {c.no ?? "—"}
                        </TableCell>
                        <TableCell className="font-medium text-sm">
                          {c.brand}
                        </TableCell>
                        <TableCell className="font-semibold text-sm max-w-[200px]">
                          {c.product}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="secondary"
                            className="text-xs whitespace-nowrap"
                          >
                            {c.category}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-gray-600">
                          {c.standardSize}
                        </TableCell>
                        <TableCell>
                          <Badge className="bg-[#1a4d2e]">
                            {c.percentage}%
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-sm font-semibold text-[#1a4d2e]">
                          {c.scaledAmountMl} ml
                        </TableCell>
                        <TableCell className="text-sm text-gray-600">
                          ₱
                          {c.estPricePHP?.toLocaleString() ?? "—"}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <span className="text-xs text-gray-500">
                              {c.stockLevel} units
                            </span>
                            <Badge
                              variant="secondary"
                              className={
                                c.stockStatus === "adequate"
                                  ? "bg-green-100 text-green-800 text-xs"
                                  : c.stockStatus === "low"
                                    ? "bg-yellow-100 text-yellow-800 text-xs"
                                    : c.stockStatus === "critical"
                                      ? "bg-orange-100 text-orange-800 text-xs"
                                      : "bg-red-100 text-red-800 text-xs"
                              }
                            >
                              {c.stockStatus === "adequate"
                                ? "✓ Adequate"
                                : c.stockStatus === "low"
                                  ? "⚠ Low"
                                  : c.stockStatus === "critical"
                                    ? "⚠ Critical"
                                    : "✕ Out"}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-semibold text-gray-800">
                          ₱{c.scaledPrice.toFixed(2)}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="border-t-2 border-[#1a4d2e] bg-green-50">
                      <TableCell
                        colSpan={9}
                        className="font-bold text-right text-base"
                      >
                        Total Price — {batchSizeLiters}L /{" "}
                        {(batchSizeLiters * 1000).toFixed(0)}ml
                        batch:
                      </TableCell>
                      <TableCell className="text-right font-bold text-xl text-[#1a4d2e]">
                        ₱{totalPrice.toFixed(2)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Consistency */}
            {colorAnalysis.consistency &&
              colorAnalysis.consistency.type !== "—" && (
                <Card className="border-l-4 border-[#1a4d2e]">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Info className="size-5 text-[#1a4d2e]" />
                      Recommended Consistency
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
                      <div className="p-4 bg-gray-50 rounded-lg">
                        <Label className="text-sm text-gray-500">
                          Consistency Type
                        </Label>
                        <p className="text-xl font-bold text-[#1a4d2e] mt-1">
                          {colorAnalysis.consistency.type}
                        </p>
                      </div>
                      <div className="p-4 bg-gray-50 rounded-lg">
                        <Label className="text-sm text-gray-500">
                          Viscosity Level
                        </Label>
                        <p className="text-xl font-bold text-[#1a4d2e] mt-1">
                          {colorAnalysis.consistency.viscosity}
                        </p>
                      </div>
                    </div>
                    {colorAnalysis.consistency.description &&
                      colorAnalysis.consistency.description !==
                        "—" && (
                        <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                          <p className="text-sm text-gray-700">
                            <span className="font-semibold">
                              Note:
                            </span>{" "}
                            {
                              colorAnalysis.consistency
                                .description
                            }
                          </p>
                        </div>
                      )}
                  </CardContent>
                </Card>
              )}

            {/* Application Guide */}
            {colorAnalysis.applicationGuide && (
              <Card className="border-l-4 border-blue-500">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BookOpen className="size-5 text-blue-600" />
                    Application Guide
                  </CardTitle>
                  <CardDescription>
                    AI-generated painting instructions from Gemini AI
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {typeof colorAnalysis.applicationGuide ===
                  "string" ? (
                    <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap leading-relaxed">
                      {colorAnalysis.applicationGuide}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {colorAnalysis.applicationGuide.steps && (
                        <ol className="space-y-3">
                          {colorAnalysis.applicationGuide.steps.map(
                            (step, i) => (
                              <li key={i} className="flex gap-3">
                                <span className="flex-shrink-0 size-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center">
                                  {i + 1}
                                </span>
                                <span className="text-sm text-gray-700">
                                  {step}
                                </span>
                              </li>
                            ),
                          )}
                        </ol>
                      )}
                      {colorAnalysis.applicationGuide.tools && (
                        <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                          <p className="text-xs font-semibold text-gray-600 mb-1">
                            Recommended Tools:
                          </p>
                          <p className="text-sm text-gray-700">
                            {colorAnalysis.applicationGuide.tools}
                          </p>
                        </div>
                      )}
                      {colorAnalysis.applicationGuide
                        .dryingTime && (
                        <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                          <p className="text-xs font-semibold text-amber-700 mb-1">
                            Drying Time:
                          </p>
                          <p className="text-sm text-amber-800">
                            {
                              colorAnalysis.applicationGuide
                                .dryingTime
                            }
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Stock Warnings */}
            {colorAnalysis.stockWarnings.length > 0 && (
              <Card className="border-l-4 border-red-500">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="size-5 text-red-500" />
                    Warning/s 
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {colorAnalysis.stockWarnings.map(
                      (warning, i) => (
                        <div
                          key={i}
                          className="flex gap-3 items-start p-3 bg-red-50 rounded-lg border border-red-100"
                        >
                          <AlertTriangle className="size-5 text-red-600 flex-shrink-0 mt-0.5" />
                          <p className="text-sm text-red-800 font-medium">
                            {warning}
                          </p>
                        </div>
                      ),
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    );
  }