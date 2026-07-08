import { useMemo, useRef, useState } from "react";
import type { ChangeEvent } from "react";
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

export default function PaintComponentAnalyzer() {
  const [colorAnalysis, setColorAnalysis] = useState<ColorAnalysis | null>(null);
  const [batchSizeLiters, setBatchSizeLiters] = useState(0.1);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);

  const loadInventory = async () => {
    const response = await fetch("/public/GPC_Products.csv");

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

      const prompt = `
You are Paintelligent AI, a paint component analyzer for Garcia Paint Center.

Analyze the uploaded paint image and recommend a paint mixture using ONLY the inventory below.

Inventory JSON:
${JSON.stringify(inventory)}

Target batch size: ${batchSizeLiters} liters (${batchSizeLiters * 1000} ml)

Rules:
1. Use ONLY products from the inventory JSON.
2. Never invent products.
3. Ignore products whose availability is not Active.
4. Prefer paint/colorant/base/coating products over fillers, tools, or accessories.
5. Percentages must total about 100.
6. amountMl values must total about ${batchSizeLiters * 1000} ml.
7. priceValue is the estimated subtotal for the used amount of that component.
8. totalPrice is the sum of all priceValue fields.
9. Return ONLY valid JSON. Do not include markdown.
10. Be consistent.
11. You can suggest anything for applicationGuide, but it must be relevant to the paint mixture.
12. Do not suggest any automotive color mixes, automotive paints, or automotive coatings.
13. You can suggest any paint product, if you think it is necessary, be critical but fast.
14. AI Analysis result must reflect to the color uploaded.

Required JSON format:
{
  "colorHex": "#808080",
  "dominantColor": "Neutral Gray",
  "rgb": { "r": 128, "g": 128, "b": 128 },
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

      const result = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [
          {
            role: "user",
            parts: [
              { text: prompt },
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

      const responseText = result.text ?? "";
      const geminiData = JSON.parse(extractJson(responseText));

      const normalized: ColorAnalysis = {
        hex: geminiData.colorHex || geminiData.hex || "#808080",
        dominantColor: geminiData.dominantColor || "Unknown",
        rgb: geminiData.rgb || { r: 128, g: 128, b: 128 },
        consistency: geminiData.consistency || {
          type: "—",
          viscosity: "—",
          description: "—",
        },
        paintComponents: (geminiData.components || geminiData.paintComponents || []).map((c: any) => {
          const stockLevel = toNumber(c.stockLevel ?? c.stock ?? c.Stocks);
          const remainingStock = toNumber(c.remainingStock, stockLevel);
          const stockStatus =
            c.stockStatus ||
            (remainingStock <= 0
              ? "out_of_stock"
              : remainingStock <= 5
                ? "low"
                : "adequate");

          return {
            no: c.no ?? c["No."] ?? null,
            brand: c.brand || c.Brand || "—",
            product: c.product || c.Product || c.name || "—",
            category: c.category || c.Category || "—",
            standardSize: c.standardSize || c["Standard Size"] || "—",
            volumeL: c.volumeL ?? c["Volume (L)"] ?? null,
            weightKg: c.weightKg ?? c["Weight (kg)"] ?? null,
            estPricePHP: toNumber(c.estPricePHP ?? c["Est. Price (PHP)"]),
            availability: c.availability || c.Availability || "Active",
            percentage: toNumber(c.percentage),
            amountMl: toNumber(c.amountMl ?? c.amount),
            priceValue: toNumber(c.priceValue),
            stockLevel,
            stockUsed: toNumber(c.stockUsed),
            remainingStock,
            stockStatus,
          };
        }),
        applicationGuide: geminiData.applicationGuide || null,
        stockWarnings: geminiData.stockWarnings || [],
        totalPrice: toNumber(geminiData.totalPrice),
      };

      setColorAnalysis(normalized);
      setLastFetched(new Date());
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

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const base64 = ev.target?.result as string;
        setUploadedImage(base64);
        setColorAnalysis(null);
        setAnalyzeError("");
      };
      reader.readAsDataURL(file);
    };

    const handleRemoveImage = () => {
      setUploadedImage(null);
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
      <div className="p-6 space-y-6 bg-white min-h-screen">
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
          <Card>
            <CardHeader>
              <CardTitle>Image Upload</CardTitle>
              <CardDescription>
                Upload a paint color image — it will be sent to
                Gemini AI for analysis.
              </CardDescription>
            </CardHeader>
            <CardContent>
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
                  className="w-full h-56 border-2 border-dashed border-green-800 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-[#1a4d2e] hover:bg-green-50 transition-colors"
                >
                  <Upload className="size-14 text-gray-400 mb-3" />
                  <p className="text-base font-medium text-gray-700">
                    Click to upload color image
                  </p>
                  <p className="text-sm text-gray-400 mt-1">
                    JPG, PNG or any image format
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="relative rounded-lg overflow-hidden border shadow-md">
                    <img
                      src={uploadedImage}
                      alt="Uploaded color"
                      className="w-full h-64 object-cover"
                    />
                    {isAnalyzing && (
                      <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-3">
                        <Loader2 className="size-10 text-white animate-spin" />
                        <p className="text-white font-semibold text-lg">
                          Gemini AI is analyzing the paint color...
                        </p>
                        <p className="text-green-200 text-sm">
                          Please wait while Gemini processes the image
                        </p>
                      </div>
                    )}
                  </div>

                  {analyzeError && (
                    <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                      <AlertTriangle className="size-5 text-red-600 flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-red-700">
                        {analyzeError}
                      </p>
                    </div>
                  )}

                  <div className="flex gap-3">
                   <div className="flex items-center gap-3">
  {/* Analyze */}
  <Button
    onClick={() => analyzeWithGemini(uploadedImage)}
    disabled={isAnalyzing}
    className="
      h-11 px-5
      rounded-lg
     bg-[#1a4d2e]
      text-white
      shadow-sm
      hover:bg-[#1a4d2e]
      hover:shadow-lg
      hover:-translate-y-0.5
      active:translate-y-0
      transition-all duration-200
      disabled:opacity-50
    "
  >
    {isAnalyzing ? (
      <>
        <Loader2 className="mr-2 size-4 animate-spin" />
        Analyzing...
      </>
    ) : (
      <>
        <ImageIcon className="mr-2 size-4" />
        Analyze
      </>
    )}
  </Button>

  {/* Change Image */}
  <Button
    onClick={() => fileInputRef.current?.click()}
    variant="outline"
    disabled={isAnalyzing}
    className="
      h-11 px-5
      rounded-lg
      border-gray-300
      bg-white
      shadow-sm
      hover:bg-gray-50
      hover:border-gray-400
      hover:shadow-md
      hover:-translate-y-0.5
      transition-all duration-200
    "
  >
    <Upload className="mr-2 size-4" />
    Change Image
  </Button>

  {/* Remove */}
  <Button
    onClick={handleRemoveImage}
    disabled={isAnalyzing}
    className="
      h-11 px-5
      rounded-lg
      bg-red-500
      text-white
      shadow-sm
      hover:bg-red-600
      hover:shadow-lg
      hover:-translate-y-0.5
      transition-all duration-200
    "
  >
    <X className="mr-2 size-4" />
    Remove
  </Button>
</div>
                  {/* <Button
    onClick={confirmPaintMix}
    disabled={!colorAnalysis || isAnalyzing || isConfirming}
    className="bg-yellow-600 hover:bg-yellow-800"
>
    {isConfirming
        ? "Updating Inventory..."
        : "Confirm Paint Mixture"}
</Button> */}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </section>

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
                    Stock Warnings
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