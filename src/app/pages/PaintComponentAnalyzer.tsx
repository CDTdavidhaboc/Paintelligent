import { useMemo, useRef, useState, useEffect } from "react";
import { createPortal } from "react-dom";
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
  FileSpreadsheet,
  Database,
  Lock,
  File,
  Save,
  RefreshCw,
  Cloud,
  CloudOff,
  Paintbrush,
} from "lucide-react";
import Papa from "papaparse";
import { GoogleGenAI } from "@google/genai";
import * as XLSX from "xlsx";
import { useAuth } from "../context/AuthContext";
import { 
  savePaintAnalyzerData, 
  getPaintAnalyzerData, 
  clearPaintAnalyzerData 
} from "../lib/supabase";

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

const AUTOMOTIVE_CATEGORIES = [
  "automotive enamel", "epoxy enamel", "epoxy primer", "urethane",
  "catalyst", "body filler", "clearcoat", "top coat", "primer surfacer",
  "spray filler", "anti-corrosion", "wash primer", "automotive",
  "auto paint", "car paint", "vehicle", "motorcycle", "base coat",
  "2k", "1k", "hardener", "activator",
];

const RESIDENTIAL_CATEGORIES = [
  "acrylic", "latex", "enamel", "varnish", "putty", "primer",
  "sealer", "thinner", "wood stain", "roof paint", "waterproofing",
  "concrete sealer", "elastomeric", "skimcoat", "permaplast", "flat",
  "floor coating", "liquid tile", "tinting color", "wall paint",
  "ceiling paint", "exterior paint", "interior paint", "gloss",
  "semi-gloss", "matte",
];

const HARDWARE_CATEGORIES = [
  "hardware", "tap customs", "accessories", "tools", "brushes",
  "rollers", "tape", "sanding", "putty knife", "masking tape",
  "sandpaper", "spray paint", "combo", "single",
];

const isAutomotiveProduct = (item: any) => {
  const haystack = `${item.product ?? ""} ${item.category ?? ""} ${item.brand ?? ""}`.toLowerCase();
  return AUTOMOTIVE_CATEGORIES.some(category => haystack.includes(category));
};

const isResidentialProduct = (item: any) => {
  const haystack = `${item.product ?? ""} ${item.category ?? ""} ${item.brand ?? ""}`.toLowerCase();
  return RESIDENTIAL_CATEGORIES.some(category => haystack.includes(category));
};

const isHardwareProduct = (item: any) => {
  const haystack = `${item.product ?? ""} ${item.category ?? ""} ${item.brand ?? ""}`.toLowerCase();
  const hardwareBrands = ["omega", "hi tech", "hippo", "hotime", "oasis", "yester", "dgm"];
  return HARDWARE_CATEGORIES.some(category => haystack.includes(category)) ||
         hardwareBrands.some(brand => haystack.includes(brand));
};

const isPaintFormulationProduct = (item: any) => {
  if (!isResidentialProduct(item) || isAutomotiveProduct(item) || isHardwareProduct(item)) {
    return false;
  }
  
  const haystack = `${item.product ?? ""} ${item.category ?? ""}`.toLowerCase();
  const paintKeywords = [
    "paint", "colorant", "tint", "tinter", "base", "latex", "enamel",
    "acrylic", "coating", "primer", "white", "red", "blue", "green",
    "yellow", "black", "magenta", "violet", "orange", "brown", "gray",
    "grey", "wood stain", "varnish", "putty", "sealer", "roof paint",
    "waterproofing", "elastomeric", "flat", "gloss", "semi-gloss"
  ];
  return paintKeywords.some(keyword => haystack.includes(keyword));
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

const parseStockValue = (value: any): number => {
  if (!value && value !== 0) return 0;
  const str = String(value).trim();
  
  if (str === "--" || str === "" || str === "-") return 0;
  
  const match = str.match(/^([\d.]+)/);
  if (match) {
    return parseFloat(match[1]);
  }
  
  const anyMatch = str.match(/(\d+\.?\d*)/);
  if (anyMatch) {
    return parseFloat(anyMatch[1]);
  }
  
  return 0;
};

const filterInventoryForFormulation = (inventory: any[], vision: VisionAnalysis) => {
  const family = normalizeText(vision.colorFamily || vision.dominantColor);
  const keywords = colorKeywords[family] || family.split(/\s+/).filter(Boolean);

  const activePaintProducts = inventory.filter(
    (item) => 
      isActiveProduct(item) && 
      !isAutomotiveProduct(item) && 
      !isHardwareProduct(item) &&
      isResidentialProduct(item) &&
      isPaintFormulationProduct(item)
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

const loadInventory = (uploadedData: any[] | null) => {
  if (!uploadedData || uploadedData.length === 0) {
    throw new Error("Please upload a CSV or Excel inventory file first.");
  }

  return uploadedData
    .filter((item) => item.Product || item.Brand || item.Category || item.product || item.brand || item.category)
    .map((item) => {
      const parsePrice = (value: any): number => {
        if (!value && value !== 0) return 0;
        const str = String(value).trim();
        if (str === "--" || str === "" || str === "-") return 0;
        
        if (str.includes(" - ")) {
          const parts = str.split(" - ");
          const min = parseFloat(parts[0]) || 0;
          const max = parseFloat(parts[1]) || 0;
          return (min + max) / 2;
        }
        
        const num = parseFloat(str);
        return isNaN(num) ? 0 : num;
      };

      const parseVolume = (value: any): number => {
        if (!value && value !== 0) return 0;
        const str = String(value).trim();
        if (str === "--" || str === "" || str === "-") return 0;
        
        const match = str.match(/^([\d.]+)/);
        if (match) {
          return parseFloat(match[1]);
        }
        return 0;
      };

      return {
        no: item["No."] || item["No"] || item["no"] || null,
        brand: item.Brand || item.brand || "",
        product: item.Product || item.product || "",
        category: item.Category || item.category || "",
        standardSize: item["Standard Size"] || item["standardSize"] || "",
        stockLevel: parseStockValue(item.Stocks || item.stocks || item["Stocks"]),
        volumeL: parseVolume(item["Volume (L)"] || item["volumeL"] || item["Volume"]),
        weightKg: parseVolume(item["Weight (kg)"] || item["weightKg"] || item["Weight"]),
        estPricePHP: parsePrice(item["Est. Price (PHP)"] || item["estPricePHP"] || item["Price"]),
        availability: item.Availability || item.availability || "Active",
      };
    });
};

const showNotification = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
  const colors = {
    success: 'bg-green-800 border-green-400/30',
    error: 'bg-red-600 border-red-400/30',
    info: 'bg-blue-600 border-blue-400/30'
  };

  const icons = {
    success: 'M5 13l4 4L19 7',
    error: 'M6 18L18 6M6 6l12 12',
    info: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
  };

  const existing = document.querySelectorAll('.custom-notification');
  existing.forEach(el => el.remove());

  const notification = document.createElement("div");
  notification.className = `
    custom-notification
    fixed bottom-6 right-6 z-50 
    ${colors[type]} text-white 
    px-6 py-4 rounded-lg shadow-2xl 
    animate-slide-up
    max-w-md
    border
    transition-all duration-300
  `;
  notification.innerHTML = `
    <div class="flex items-center gap-3">
      <svg class="size-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${icons[type]}"/>
      </svg>
      <span class="font-medium">${message}</span>
    </div>
  `;
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.style.opacity = '0';
    notification.style.transform = 'translateY(20px)';
    setTimeout(() => notification.remove(), 300);
  }, 3000);
};

export default function PaintComponentAnalyzer() {
  const { userEmail } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState<"idle" | "syncing" | "success" | "error">("idle");
  const [syncMessage, setSyncMessage] = useState("");

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
  const csvInputRef = useRef<HTMLInputElement | null>(null);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);
  const [showAnalysisComplete, setShowAnalysisComplete] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  
  const [uploadedData, setUploadedData] = useState<any[] | null>(null);
  const [uploadedDataName, setUploadedDataName] = useState("");
  const [uploadError, setUploadError] = useState("");
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [isDataSaved, setIsDataSaved] = useState(false);

  const [showRemoveDialog, setShowRemoveDialog] = useState(false);

  useEffect(() => {
    if (showRemoveDialog) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [showRemoveDialog]);

  useEffect(() => {
    const loadData = async () => {
      if (!userEmail) {
        setIsLoading(false);
        return;
      }

      try {
        const data = await getPaintAnalyzerData(userEmail);
        
        if (data) {
          if (data.inventory_data) {
            setUploadedData(data.inventory_data);
            setUploadedDataName(data.inventory_data_name || "");
            setIsDataSaved(true);
          }
          
          if (data.color_analysis) {
            setColorAnalysis(data.color_analysis);
          }
          
          if (data.uploaded_image) {
            setUploadedImage(data.uploaded_image);
            setUploadedFileName(data.uploaded_file_name || "");
            setUploadedFileSize(data.uploaded_file_size || "");
          }
          
          if (data.batch_size) {
            setBatchSizeLiters(data.batch_size);
          }
          
          if (data.last_fetched) {
            setLastFetched(new Date(data.last_fetched));
          }
          
          setSyncStatus("success");

        } else {
          setSyncStatus("idle");
          setSyncMessage("No saved data found");
        }
      } catch (error) {
        console.error("Error loading user data:", error);
        setSyncStatus("error");
        setSyncMessage("❌ Failed to load data from cloud");
        showNotification("❌ Failed to load data from cloud", "error");
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [userEmail]);

  useEffect(() => {
    const saveToCloud = async () => {
      if (!userEmail) return;
      
      setSyncStatus("syncing");
      setSyncMessage("🔄 Syncing to cloud...");

      try {
        const success = await savePaintAnalyzerData(userEmail, {
          inventory_data: uploadedData,
          inventory_data_name: uploadedDataName,
          color_analysis: colorAnalysis,
          uploaded_image: uploadedImage,
          uploaded_file_name: uploadedFileName,
          uploaded_file_size: uploadedFileSize,
          batch_size: batchSizeLiters,
          last_fetched: lastFetched ? lastFetched.toISOString() : null,
        });
        
        if (success) {
          setSyncStatus("success");
          setSyncMessage("✅ Data synced to cloud");
        } else {
          setSyncStatus("error");
          setSyncMessage("❌ Sync failed");
          showNotification("❌ Sync failed", "error");
        }
      } catch (error) {
        console.error("Error saving user data:", error);
        setSyncStatus("error");
        setSyncMessage("❌ Sync failed");
        showNotification("❌ Sync failed", "error");
      }
    };

    const timeoutId = setTimeout(() => {
      if (userEmail && (uploadedData || colorAnalysis || uploadedImage)) {
        saveToCloud();
      }
    }, 2000);

    return () => clearTimeout(timeoutId);
  }, [userEmail, uploadedData, uploadedDataName, colorAnalysis, uploadedImage, uploadedFileName, uploadedFileSize, batchSizeLiters, lastFetched]);

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 80);
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

  const clearSupabaseData = async () => {
    if (!userEmail) return;
    
    try {
      setSyncStatus("syncing");
      setSyncMessage("🔄 Clearing data from cloud...");
      
      const success = await clearPaintAnalyzerData(userEmail);
      
      if (success) {
        setSyncStatus("success");
        setSyncMessage("✅ Data cleared from cloud");
        showNotification("✅ Data cleared from cloud", "success");
        console.log("✅ Data cleared from Supabase");
      } else {
        setSyncStatus("error");
        setSyncMessage("❌ Failed to clear data");
        showNotification("❌ Failed to clear data", "error");
      }
    } catch (error) {
      console.error("Error clearing user data:", error);
      setSyncStatus("error");
      setSyncMessage("❌ Failed to clear data");
      showNotification("❌ Failed to clear data", "error");
    }
  };

  const handleSaveData = () => {
    if (!uploadedData || uploadedData.length === 0) {
      setUploadError("No data to save. Please upload a file first.");
      showNotification("No data to save. Please upload a file first.", "error");
      return;
    }

    try {
      setIsDataSaved(true);
      setUploadError("");
      showNotification("✅ Inventory data saved successfully! Paint analyzer is now enabled.", "success");
    } catch (err) {
      console.error("Error saving data:", err);
      setUploadError("Failed to save data.");
      showNotification("Failed to save data.", "error");
    }
  };

  const handleClearSavedData = () => {
    setIsDataSaved(false);
    setUploadedData(null);
    setUploadedDataName("");
    setColorAnalysis(null);
    setAnalyzeError("");
    if (csvInputRef.current) csvInputRef.current.value = "";
    
    clearSupabaseData();
  };

  const processFile = (file: File) => {
    setUploadError("");
    setUploadedData(null);
    setUploadedDataName("");
    setIsDataSaved(false);

    const fileExtension = file.name.split('.').pop()?.toLowerCase();
    const isValidFile = fileExtension === 'csv' || fileExtension === 'xlsx' || fileExtension === 'xls';
    
    if (!isValidFile) {
      setUploadError("Please upload a valid CSV or Excel (.xlsx, .xls) file.");
      showNotification("Please upload a valid CSV or Excel (.xlsx, .xls) file.", "error");
      return;
    }

    const reader = new FileReader();

    if (fileExtension === 'csv') {
      reader.onload = (ev) => {
        try {
          const csvText = ev.target?.result as string;
          const result = Papa.parse<InventoryItem>(csvText, {
            header: true,
            skipEmptyLines: true,
            trimHeaders: true,
          });

          const data = result.data.filter((item) => 
            item.Product || item.product || item.Brand || item.brand || item.Category || item.category
          );

          if (data.length === 0) {
            setUploadError("CSV file appears empty or invalid.");
            showNotification("CSV file appears empty or invalid.", "error");
            return;
          }

          setUploadedData(data);
          setUploadedDataName(file.name);
          setColorAnalysis(null);
          setAnalyzeError("");
          showNotification(`📂 File "${file.name}" loaded successfully! ${data.length} rows found.`, "success");
        } catch (err: any) {
          setUploadError(`Failed to process CSV: ${err.message}`);
          showNotification(`Failed to process CSV: ${err.message}`, "error");
        }
      };
      reader.onerror = () => {
        setUploadError("Failed to read CSV file.");
        showNotification("Failed to read CSV file.", "error");
      };
      reader.readAsText(file);
      return;
    }

    reader.onload = (ev) => {
      try {
        const data = ev.target?.result;
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet);

        if (jsonData.length === 0) {
          setUploadError("Excel file appears empty.");
          showNotification("Excel file appears empty.", "error");
          return;
        }

        const hasRequiredHeaders = jsonData.some((item: any) => 
          item.Product || item.product || item.Brand || item.brand || item.Category || item.category
        );

        if (!hasRequiredHeaders) {
          setUploadError("Excel file doesn't have required headers.");
          showNotification("Excel file doesn't have required headers.", "error");
          return;
        }

        setUploadedData(jsonData);
        setUploadedDataName(file.name);
        setColorAnalysis(null);
        setAnalyzeError("");
        showNotification(`📂 File "${file.name}" loaded successfully! ${jsonData.length} rows found.`, "success");
      } catch (err: any) {
        setUploadError(`Failed to process Excel file: ${err.message}`);
        showNotification(`Failed to process Excel file: ${err.message}`, "error");
      }
    };
    reader.onerror = () => {
      setUploadError("Failed to read Excel file.");
      showNotification("Failed to read Excel file.", "error");
    };
    reader.readAsArrayBuffer(file);
  };

  const handleFileUploadChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processFile(file);
  };

  const handleFileDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingFile(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    processFile(file);
  };

  const handleRemoveData = () => {
    setUploadedData(null);
    setUploadedDataName("");
    setUploadError("");
    setIsDataSaved(false);
    if (csvInputRef.current) csvInputRef.current.value = "";
    
    clearSupabaseData();
  };

  const analyzeWithGemini = async (imageBase64: string | null) => {
    if (!imageBase64) {
      setAnalyzeError("Please upload a paint color image first.");
      showNotification("Please upload a paint color image first.", "error");
      return;
    }

    if (!import.meta.env.VITE_GEMINI_API_KEY) {
      setAnalyzeError("Missing VITE_GEMINI_API_KEY in your .env file.");
      showNotification("Missing VITE_GEMINI_API_KEY in your .env file.", "error");
      return;
    }

    if (!isDataSaved || !uploadedData || uploadedData.length === 0) {
      setAnalyzeError("Please save the inventory data first to enable paint analysis.");
      showNotification("Please save the inventory data first to enable paint analysis.", "error");
      return;
    }

    setIsAnalyzing(true);
    setAnalyzeError("");
    setColorAnalysis(null);

    try {
      const inventory = loadInventory(uploadedData);

      if (inventory.length === 0) {
        throw new Error("No products found in the inventory.");
      }

      const visionPrompt = `
You are Paintelligent Vision Agent, a professional residential paint color analyzer.

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

      const filteredInventory = filterInventoryForFormulation(inventory, vision);

      if (filteredInventory.length === 0) {
        throw new Error("No residential paint products found for formulation.");
      }

      const formulationPrompt = `
You are Paintelligent Formulation Agent, an expert residential paint mixture recommender.

Target color data:
${JSON.stringify(vision)}

Use ONLY this filtered inventory JSON (residential products only):
${JSON.stringify(filteredInventory)}

Target batch size: ${batchSizeLiters} liters (${batchSizeLiters * 1000} ml)

Important rules:
1. Use ONLY products from the filtered inventory JSON.
2. Never invent products, brands, sizes, or prices.
3. Only suggest residential paints (wall paints, latex, acrylic, enamel, varnish, wood stain, etc.).
4. DO NOT suggest automotive paints, clear coats, base coats, urethane, epoxy primer, body filler, catalyst, hardener, or any automotive products.
5. DO NOT suggest hardware/accessory items.
6. The mixture must match the target HEX/RGB as closely as possible.
7. Percentages must total exactly 100 or very close to 100.
8. amountMl values must total exactly ${batchSizeLiters * 1000} ml or very close.
9. Calculate amountMl = (percentage / 100) * ${batchSizeLiters * 1000} for each component.
10. Return ONLY valid JSON. Do not include markdown.

Required JSON format:
{
  "colorHex": "${vision.colorHex}",
  "dominantColor": "${vision.dominantColor}",
  "rgb": ${JSON.stringify(vision.rgb)},
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

      const targetMl = batchSizeLiters * 1000;
      const components = geminiData.components || geminiData.paintComponents || [];
      
      const totalAiAmount = components.reduce((sum: number, c: any) => sum + (c.amountMl || 0), 0);
      
      if (totalAiAmount > 0 && Math.abs(totalAiAmount - targetMl) > 0.1) {
        const scaleFactor = targetMl / totalAiAmount;
        
        geminiData.components = components.map((c: any) => ({
          ...c,
          amountMl: (c.amountMl || 0) * scaleFactor,
          priceValue: (c.priceValue || 0) * scaleFactor,
        }));
        
        geminiData.totalPrice = (geminiData.totalPrice || 0) * scaleFactor;
        
        console.log(`✅ Normalized amounts: ${totalAiAmount}ml → ${targetMl}ml (scale: ${scaleFactor.toFixed(3)})`);
      } else {
        geminiData.components = components;
        console.log(`✅ Amounts already match target: ${targetMl}ml`);
      }

      const normalizedComponents = (geminiData.components || geminiData.paintComponents || [])
        .map((c: any) => {
          const matched = findInventoryMatch(c, filteredInventory);
          const source = matched || c;

          const stockLevel = parseStockValue(source.stockLevel ?? c.stockLevel ?? c.stock ?? c.Stocks);
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
        .filter((c: PaintComponent) => 
          c.product !== "—" && 
          isActiveProduct(c) && 
          !isAutomotiveProduct(c) && 
          !isHardwareProduct(c) &&
          isResidentialProduct(c)
        );

      if (normalizedComponents.length === 0) {
        throw new Error("Gemini did not return usable residential paint products.");
      }

      const normalized: ColorAnalysis = {
        hex: geminiData.colorHex || geminiData.hex || vision.colorHex || "#808080",
        dominantColor: geminiData.dominantColor || vision.dominantColor || "Unknown",
        rgb: geminiData.rgb || vision.rgb || { r: 128, g: 128, b: 128 },
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
      showNotification("✅ Analysis complete! Paint formula generated successfully.", "success");

      setTimeout(() => setShowAnalysisComplete(false), 1800);
    } catch (err: any) {
      console.error(err);
      const message = String(err?.message || "");

      if (message.includes("429") || message.includes("RESOURCE_EXHAUSTED") || message.includes("quota")) {
        setAnalyzeError("Gemini quota/rate limit reached. Wait about 1 minute, then try again.");
        showNotification("Gemini quota/rate limit reached. Wait about 1 minute, then try again.", "error");
      } else {
        setAnalyzeError(err instanceof Error ? err.message : "Gemini analysis failed.");
        showNotification(err instanceof Error ? err.message : "Gemini analysis failed.", "error");
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
      showNotification("Please upload a valid image file only.", "error");
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
      showNotification(`📸 Image "${file.name}" uploaded successfully!`, "success");
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
    setShowRemoveDialog(false);
    showNotification("🗑️ Image removed", "info");
  };

  const scaledComponents = useMemo(() => {
    if (!colorAnalysis) return [];
    
    const targetMl = batchSizeLiters * 1000;
    const components = colorAnalysis.paintComponents;
    const totalOriginalAmount = components.reduce((sum, c) => sum + (c.amountMl || 0), 0);
    
    if (totalOriginalAmount === 0) {
      return components.map((c) => ({
        ...c,
        scaledAmountMl: "0.0",
        scaledPrice: 0
      }));
    }
    
    const scaleFactor = targetMl / totalOriginalAmount;
    const totalPercentage = components.reduce((sum, c) => sum + (c.percentage || 0), 0);
    
    return components.map((c) => {
      const amountMl = (c.amountMl || 0) * scaleFactor;
      
      let priceValue = 0;
      
      if (c.volumeL && c.volumeL > 0 && c.estPricePHP > 0) {
        const pricePerLiter = c.estPricePHP / c.volumeL;
        priceValue = pricePerLiter * (amountMl / 1000);
      } else if (c.priceValue > 0) {
        priceValue = c.priceValue * scaleFactor;
      } else if (totalPercentage > 0 && c.percentage > 0 && colorAnalysis.totalPrice > 0) {
        priceValue = (colorAnalysis.totalPrice * (c.percentage / totalPercentage)) * scaleFactor;
      } else if (c.estPricePHP > 0) {
        priceValue = c.estPricePHP * scaleFactor;
      }
      
      return {
        ...c,
        scaledAmountMl: amountMl.toFixed(1),
        scaledPrice: priceValue
      };
    });
  }, [colorAnalysis, batchSizeLiters]);

  const totalPrice = useMemo(
    () => {
      return scaledComponents.reduce((sum, c) => sum + (c.scaledPrice || 0), 0);
    },
    [scaledComponents],
  );

  const isDataLoaded = uploadedData !== null && uploadedData.length > 0;
  const isAnalyzerEnabled = isDataSaved && isDataLoaded;

  const handleRemoveWithConfirmation = () => {
    if (uploadedImage) {
      setShowRemoveDialog(true);
    }
  };

  const confirmRemoveImage = () => {
    handleRemoveImage();
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f3f7f4] p-6">
        <div className="rounded-2xl border border-emerald-100 bg-white px-10 py-8 text-center shadow-[0_18px_50px_rgba(20,83,45,0.08)]">
          <Loader2 className="mx-auto size-12 animate-spin text-[#1a4d2e]" />
          <p className="mt-4 text-sm font-medium text-slate-600">Loading your data...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div
        className={`
          paint-analyzer-page min-h-screen space-y-5 bg-[#f3f7f4] px-4 py-5 sm:px-6 lg:px-8 lg:py-7 
          transition-all duration-700 ease-out
          ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5"}
        `}
      >
        <style>{`
          @keyframes scan {
            0% { transform: translateY(0); opacity: 0; }
            12% { opacity: 1; }
            50% { opacity: 1; }
            100% { transform: translateY(360px); opacity: 0; }
          }
          
          @keyframes slideUp {
            from {
              opacity: 0;
              transform: translateY(20px) scale(0.95);
            }
            to {
              opacity: 1;
              transform: translateY(0) scale(1);
            }
          }
          
          @keyframes fadeIn {
            from {
              opacity: 0;
              transform: scale(0.95);
            }
            to {
              opacity: 1;
              transform: scale(1);
            }
          }
          
          .animate-slide-up {
            animation: slideUp 0.3s ease-out forwards;
          }

          .animate-fade-in {
            animation: fadeIn 0.2s ease-out forwards;
          }

          .paint-analyzer-page [data-slot="card"] {
            border-radius: 1rem;
          }

          .paint-analyzer-page select {
            border-color: rgb(167 243 208);
            background: rgb(255 255 255);
            color: rgb(20 83 45);
            outline: none;
          }

          .paint-analyzer-page select:focus {
            box-shadow: 0 0 0 3px rgb(209 250 229);
            border-color: rgb(5 150 105);
          }

          .paint-analyzer-page [data-slot="table-head"] {
            color: rgb(22 101 52);
            font-weight: 700;
          }

          .paint-analyzer-page [data-slot="table-row"]:hover {
            background: rgb(240 253 244 / 0.7);
          }
        `}</style>

        <header className="overflow-hidden rounded-2xl bg-[#174d32] px-5 py-5 text-white shadow-[0_18px_45px_rgba(23,77,50,0.18)] sm:px-7 sm:py-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-white/12 ring-1 ring-white/15">
                <Paintbrush className="size-5 text-emerald-100" />
              </div>
              <div>
                <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Paint Component Analyzer</h1>
                <p className="mt-1 text-sm text-emerald-100">Upload a paint sample and get a residential formula from your inventory.</p>
              </div>
            </div>
            {userEmail && (
              <div className="flex w-fit items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs">
                {syncStatus === "syncing" && (
                  <>
                    <Loader2 className="size-3 animate-spin text-emerald-100" />
                    <span className="text-emerald-50">Syncing...</span>
                  </>
                )}
                {syncStatus === "success" && (
                  <>
                    <Cloud className="size-3 text-emerald-100" />
                    <span className="text-emerald-50">Cloud synced</span>
                  </>
                )}
                {syncStatus === "error" && (
                  <>
                    <CloudOff className="size-3 text-red-200" />
                    <span className="text-red-100">Sync error</span>
                  </>
                )}
                {syncStatus === "idle" && userEmail && (
                  <>
                    <Cloud className="size-3 text-emerald-100/70" />
                    <span className="text-emerald-100/80">Not synced</span>
                  </>
                )}
              </div>
            )}
          </div>
        </header>

        <section>
          <Card className="overflow-hidden rounded-2xl border border-emerald-100 bg-white shadow-[0_12px_32px_rgba(20,83,45,0.06)]">
            <CardHeader className="border-b border-emerald-100 bg-[#174d32] h-10 flex items-center px-4">
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-1.5">
                  <Database className="size-3.5 text-white" />
                  <CardTitle className="text-md font-medium text-white leading-none">Inventory Source</CardTitle>
                </div>
                <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700 text-[10px] font-medium px-2 py-0">
                  {isDataSaved ? "SAVED" : isDataLoaded ? "LOADED" : "EMPTY"}
                </Badge>
              </div>
            </CardHeader>

            <CardContent>
              <input
                ref={csvInputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleFileUploadChange}
                className="hidden"
              />

              {!isDataLoaded ? (
                <div>
                  <div
                    onClick={() => csvInputRef.current?.click()}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDraggingFile(true);
                    }}
                    onDragLeave={() => setIsDraggingFile(false)}
                    onDrop={handleFileDrop}
                    className={`
                      relative min-h-[80px] cursor-pointer overflow-hidden rounded-xl border-2 border-dashed p-4
                      transition-all duration-300
                      ${isDraggingFile
                        ? "border-green-600 bg-green-50 shadow-md"
                        : "border-green-300/60 bg-white hover:border-green-600 hover:bg-green-50/60"
                      }
                    `}
                  >
                    <div className="flex items-center justify-center gap-4">
                      <FileSpreadsheet className="size-6 text-green-900" />
                      <div>
                        <p className="text-sm font-medium text-gray-700">Drop CSV or Excel file</p>
                        <p className="text-xs text-gray-400">or click to browse</p>
                      </div>
                      <div className="flex gap-1">
                        {['CSV', 'XLSX'].map((format) => (
                          <Badge key={format} variant="secondary" className="text-xs bg-green-50 text-green-700 border border-green-200">
                            {format}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                  
                  <div className="mt-3 p-3 bg-green-50 rounded-lg border border-green-200">
                    <p className="text-xs font-medium text-green-800">Required Headers:</p>
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      <Badge variant="outline" className="text-xs bg-white border-green-300 text-green-700 ">Product</Badge>
                      <Badge variant="outline" className="text-xs bg-white border-green-300 text-green-700 ">Brand</Badge>
                      <Badge variant="outline" className="text-xs bg-white border-green-300 text-green-700 ">Category</Badge>
                      <Badge variant="outline" className="text-xs bg-white border-green-300 text-green-700 ">Stocks</Badge>
                      <Badge variant="outline" className="text-xs bg-white border-green-300 text-green-700 ">Est. Price (PHP)</Badge>
                      <Badge variant="outline" className="text-xs bg-white border-green-300 text-green-700 ">Unit Purchase Price</Badge>
                    </div>
                    <p className="text-[11px] text-green-600 mt-1.5">Headers are case-sensitive (match exactly)</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className={`flex items-center justify-between p-2 rounded-lg border transition-all duration-300 ${
                    isDataSaved 
                      ? "bg-gray-50 border-gray-200 opacity-70" 
                      : "bg-green-50 border-green-200"
                  }`}>
                    <div className="flex items-center gap-3">
                      <div className={`flex size-8 items-center justify-center rounded-lg text-white ${
                        isDataSaved ? "bg-gray-400" : "bg-[#174d32]"
                      }`}>
                        {uploadedDataName.endsWith('.csv') ? (
                          <File className="size-4" />
                        ) : (
                          <FileSpreadsheet className="size-4" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900 truncate max-w-[150px]">{uploadedDataName}</p>
                        <p className="text-xs text-gray-500">{uploadedData.length} rows</p>
                      </div>
                    </div>
                    {!isDataSaved && (
                      <Button
                        onClick={handleSaveData}
                        className="bg-[#174d32] hover:bg-green-700 text-white text-xs h-7 px-2"
                      >
                        <Save className="size-3 mr-1" />
                        Save & Enable
                      </Button>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {!isDataSaved ? (
                      <>
                        <Button
                          onClick={() => csvInputRef.current?.click()}
                          variant="outline"
                          className="border-green-300 text-green-600 hover:bg-green-50 text-xs h-7 px-2"
                        >
                          <RefreshCw className="size-3 mr-1" />
                          Replace
                        </Button>
                        <Button
                          onClick={handleRemoveData}
                          variant="outline"
                          className="border-green-300 text-green-600 hover:bg-red-50 text-xs h-7 px-2"
                        >
                          <X className="size-3 mr-1" />
                          Remove
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          onClick={() => csvInputRef.current?.click()}
                          variant="outline"
                          className="border-green-300 text-green-600 hover:bg-green-50 text-xs h-7 px-2"
                        >
                          <RefreshCw className="size-3 mr-1" />
                          Replace
                        </Button>
                        <Button
                          onClick={handleClearSavedData}
                          variant="outline"
                          className="border-green-300 text-green-600 hover:bg-green-50 text-xs h-7 px-2"
                        >
                          <X className="size-3 mr-1" />
                          Clear
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              )}

              {uploadError && (
                <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-2 mt-2">
                  <AlertTriangle className="size-4 flex-shrink-0 text-red-600" />
                  <p className="text-xs text-red-700">{uploadError}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        <section>
          <Card className={`overflow-hidden rounded-2xl border shadow-[0_12px_32px_rgba(20,83,45,0.06)] ${isAnalyzerEnabled ? 'border-emerald-100 bg-white' : 'border-gray-200 bg-white/60'}`}>
            <CardHeader className={`border-b ${isAnalyzerEnabled ? 'border-emerald-100 bg-gradient-to-r from-emerald-50/80 via-white to-white' : 'border-gray-200 bg-gray-50'} p-5`}>
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-3 flex-1">
                  <ImageIcon className="size-5 text-emerald-600 flex-shrink-0" />
                  <div className="flex flex-col">
                    <CardTitle className="text-base font-semibold text-gray-900 leading-tight">
                      AI Vision Scanner — Residential Paints Only
                    </CardTitle>
                    <p className="text-sm text-gray-500 leading-tight mt-0.5">
                      {isAnalyzerEnabled 
                        ? "Upload a residential paint sample. Gemini will detect the color and formulate a mixture using your inventory."
                        : isDataLoaded 
                          ? "Please click 'Save & Enable' to activate the paint analyzer."
                          : "Please upload a CSV or Excel inventory file first to enable paint analysis."}
                    </p>
                  </div>
                </div>
                <Badge className={`${isAnalyzerEnabled ? "bg-emerald-700 text-white" : "bg-gray-500 text-white"} text-xs font-medium px-3 py-1 flex-shrink-0`}>
                  {isAnalyzerEnabled 
                    ? (uploadedImage ? "IMAGE READY" : "AWAITING SAMPLE")
                    : "LOCKED"}
                </Badge>
              </div>
            </CardHeader>

            <CardContent>
              {!isAnalyzerEnabled ? (
                <div className="relative min-h-[300px] rounded-2xl border-2 border-dashed border-gray-300 bg-gray-50/60 p-6">
                  <div className="flex min-h-[252px] flex-col items-center justify-center text-center">
                    <div className="relative mb-5">
                      <div className="flex size-24 items-center justify-center rounded-full border border-gray-300 bg-gray-100 shadow-lg">
                        {isDataLoaded ? (
                          <Save className="size-11 text-yellow-500" />
                        ) : (
                          <Lock className="size-11 text-gray-400" />
                        )}
                      </div>
                    </div>
                    <p className="text-lg font-bold text-gray-500">
                      {isDataLoaded ? "Save Data to Enable" : "Upload File First"}
                    </p>
                    <p className="mt-1 text-sm text-gray-400 max-w-md">
                      {isDataLoaded 
                        ? "Click the 'Save & Enable' button above to activate the paint analyzer."
                        : "Please upload a CSV or Excel inventory file above to unlock the paint analyzer."}
                    </p>
                    <div className="mt-6 rounded-full border border-gray-200 bg-gray-100/80 px-4 py-2 text-xs font-medium text-gray-500 shadow-sm">
                      {isDataLoaded ? "Save Required → Vision AI → Residential Paint Formula" : "File Required → Vision AI → Residential Paint Formula"}
                    </div>
                  </div>
                </div>
              ) : (
                <>
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
                          ? "border-green-600 bg-green-50 shadow-xl shadow-green-900/10 scale-[1.01]"
                          : "border-green-300/60 bg-white hover:border-green-600 hover:bg-green-50/60 hover:shadow-xl hover:shadow-green-900/10"
                        }
                      `}
                    >
                      <div className="flex min-h-[252px] flex-col items-center justify-center text-center">
                        <div className="relative mb-5">
                          <div className="relative flex size-24 items-center justify-center rounded-full border border-green-200 bg-white shadow-lg shadow-green-900/10 transition-transform duration-300 group-hover:scale-105">
                            <Upload className="size-11 text-green-600" />
                          </div>
                        </div>

                        <p className="text-lg font-bold text-gray-900">
                          Drop residential paint sample here
                        </p>
                        <p className="mt-1 text-sm text-gray-500">
                          or click to browse from your device
                        </p>

                        <div className="mt-5 flex flex-wrap justify-center gap-2">
                          {['JPG', 'PNG', 'JPEG', 'WEBP'].map((format) => (
                            <Badge key={format} variant="secondary" className="bg-green-50 text-green-700 border border-green-200">
                              {format}
                            </Badge>
                          ))}
                        </div>

                        <div className="mt-6 rounded-full border border-green-100 bg-white/80 px-4 py-2 text-xs font-medium text-gray-500 shadow-sm">
                          Vision AI → Residential Filter → Paint Mixture Formula
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="grid gap-5 lg:grid-cols-[1.3fr_0.7fr]">
                      <div className="relative inline-block overflow-hidden rounded-2xl border border-green-100 shadow-xl shadow-green-900/10">
                        <img
                          src={uploadedImage}
                          alt="Uploaded color"
                          className="max-h-[420px] w-full object-contain opacity-95"
                        />

                        <div className="absolute left-5 top-5 h-12 w-12 border-l-2 border-t-2 border-green-700" />
                        <div className="absolute right-5 top-5 h-12 w-12 border-r-2 border-t-2 border-green-700" />
                        <div className="absolute bottom-5 left-5 h-12 w-12 border-b-2 border-l-2 border-green-700" />
                        <div className="absolute bottom-5 right-5 h-12 w-12 border-b-2 border-r-2 border-green-700" />

                        <div className="absolute left-0 top-0 h-[3px] w-full animate-[scan_2.4s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-green-300 to-transparent shadow-[0_0_18px_rgba(134,239,172,0.9)]" />

                        {isAnalyzing && (
                          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/70 p-6 text-center backdrop-blur-sm">
                            <div className="relative flex size-20 items-center justify-center rounded-full border border-green-300/40 bg-green-800/40">
                              <Loader2 className="size-10 animate-spin text-white" />
                            </div>
                            <div>
                              <p className="text-lg font-bold text-white">Gemini AI is processing the sample</p>
                              <p className="mt-1 text-sm text-green-100">
                                {[
                                  "Initializing Vision Agent...",
                                  "Detecting dominant paint pigment...",
                                  "Filtering residential inventory products...",
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
                          <div className="absolute inset-0 z-40 flex items-center justify-center rounded-2xl bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
                            <div className="flex flex-col items-center text-center">
                              <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-green-500">
                                <CheckCircle2 className="h-10 w-10 text-white" />
                              </div>
                              <h2 className="text-2xl font-bold text-white">
                                Analysis Complete
                              </h2>
                              <p className="mt-2 max-w-xs text-sm text-green-100">
                                Residential paint formula successfully generated.
                              </p>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="space-y-4">
                        <div className="rounded-2xl border border-emerald-100 bg-gradient-to-br from-green-50 via-white to-white p-5 shadow-sm">
                          <div className="flex items-center gap-3">
                            <div className="flex size-12 items-center justify-center rounded-xl bg-[#174d32] text-white shadow-md">
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
                              <Badge className="bg-[#174d32] text-white">AI READY</Badge>
                            </div>
                            <div className="flex items-center justify-between rounded-lg bg-white px-3 py-2 shadow-sm">
                              <span className="text-gray-500">Batch</span>
                              <span className="font-semibold text-[#174d32]">{(batchSizeLiters * 1000).toFixed(0)} ml</span>
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
                          disabled={isAnalyzing || !isAnalyzerEnabled || !!colorAnalysis}
                          className="h-12 w-full rounded-lg bg-[#174d32] text-white shadow-lg shadow-green-900/15 transition-all duration-200 hover:bg-[#123e28] hover:shadow-xl hover:-translate-y-0.5 disabled:opacity-50"
                        >
                          {isAnalyzing ? (
                            <>
                              <Loader2 className="mr-2 size-4 animate-spin" />
                              Analyzing Paint Formula...
                            </>
                          ) : colorAnalysis ? (
                            <>
                              <CheckCircle2 className="mr-2 size-4" />
                              Analysis Complete
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
                            disabled={isAnalyzing || !isAnalyzerEnabled}
                            className="h-11 rounded-lg border-2 border-green-950 bg-white text-green-950 shadow-sm transition-all duration-200 hover:bg-green-300 hover:border-green-300 hover:text-green-950 hover:shadow-md disabled:opacity-50 disabled:hover:bg-white disabled:hover:text-green-950 disabled:hover:border-green-950"
                          >
                            <Upload className="mr-2 size-4" />
                            Replace
                          </Button>
                          <Button
                            onClick={handleRemoveWithConfirmation}
                            disabled={isAnalyzing || !isAnalyzerEnabled}
                            className="h-11 rounded-lg bg-white border-2 border-orange-500 text-orange-600 shadow-sm transition-all duration-200 hover:bg-orange-300 hover:border-orange-300 hover:text-orange-600 hover:shadow-md disabled:opacity-50 disabled:hover:bg-white disabled:hover:text-orange-600 disabled:hover:border-orange-500"
                          >
                            <X className="mr-2 size-4 text-orange-600" />
                            Remove
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </section>

        {colorAnalysis && (
          <>
            <Card className="border-l-4 border-[#174d32] overflow-hidden rounded-2xl border border-emerald-100 bg-white shadow-[0_12px_32px_rgba(20,83,45,0.06)]">
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
                      {colorAnalysis.rgb.g}, {colorAnalysis.rgb.b})
                    </p>
                  </div>
                  <div className="ml-auto flex items-center gap-2 text-green-700 bg-green-50 px-4 py-2 rounded-lg border border-green-200">
                    <CheckCircle2 className="size-5" />
                    <span className="text-sm font-semibold">
                      Residential AI Analysis Complete
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="overflow-hidden rounded-2xl border border-emerald-100 bg-white shadow-[0_12px_32px_rgba(20,83,45,0.06)]">
              <CardHeader className="border-b border-emerald-100 bg-gradient-to-r from-white to-emerald-50/70">
                <CardTitle className="flex items-center gap-2">
                  <Droplet className="size-5 text-[#174d32]" />
                  Suggested Residential Paint Mixture & Pricing
                </CardTitle>
                <CardDescription>
                  AI-recommended residential paint components for{" "}
                  {colorAnalysis.hex.toUpperCase()} from your inventory
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="mb-6 p-4 bg-green-50 rounded-xl border-2 border-[#174d32]">
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
                      className="w-36 px-4 py-2 border-2 border-[#174d32] rounded-lg font-medium focus:outline-none focus:ring-2 focus:ring-[#174d32]"
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
                          className={`text-xs ${batchSizeLiters === val ? "bg-[#2d6b45]" : "bg-[#174d32] hover:bg-[#2d6b45]"}`}
                        >
                          {label}
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>No.</TableHead>
                        <TableHead>Brand</TableHead>
                        <TableHead>Product</TableHead>
                        <TableHead>Category</TableHead>
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
                          <TableCell>
                            <Badge className="bg-[#174d32]">
                              {c.percentage}%
                            </Badge>
                          </TableCell>
                          <TableCell className="font-mono text-sm font-semibold text-[#174d32]">
                            {c.scaledAmountMl} ml
                          </TableCell>
                          <TableCell className="text-sm text-gray-600">
                            ₱{c.estPricePHP?.toLocaleString() ?? "—"}
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
                      <TableRow className="border-t-2 border-[#174d32] bg-green-50">
                        <TableCell
                          colSpan={8}
                          className="font-bold text-right text-base"
                        >
                          Total Price — {batchSizeLiters}L /{" "}
                          {(batchSizeLiters * 1000).toFixed(0)}ml batch:
                        </TableCell>
                        <TableCell className="text-right font-bold text-xl text-[#174d32]">
                          ₱{totalPrice.toFixed(2)}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            {colorAnalysis.applicationGuide && (
              <Card className="border-l-4 border-blue-500 overflow-hidden rounded-2xl border border-blue-100 bg-white shadow-[0_12px_32px_rgba(20,83,45,0.06)]">
                <CardHeader className="border-b border-blue-100 bg-gradient-to-r from-white to-blue-50/70">
                  <CardTitle className="flex items-center gap-2">
                    <BookOpen className="size-5 text-blue-600" />
                    Application Guide
                  </CardTitle>
                  <CardDescription>
                    AI-generated residential painting instructions from Gemini AI
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

            {colorAnalysis.stockWarnings.length > 0 && (
              <Card className="border-l-4 border-orange-500 overflow-hidden rounded-2xl border border-orange-100 bg-white shadow-[0_12px_32px_rgba(20,83,45,0.06)]">
                <CardHeader className="border-b border-orange-100 bg-gradient-to-r from-white to-orange-50/70">
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="size-5 text-orange-500" />
                    Stock Warnings
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {colorAnalysis.stockWarnings.map(
                      (warning, i) => (
                        <div
                          key={i}
                          className="flex gap-3 items-start p-3 bg-orange-50 rounded-lg border border-orange-100"
                        >
                          <AlertTriangle className="size-5 text-orange-600 flex-shrink-0 mt-0.5" />
                          <p className="text-sm text-orange-800 font-medium">
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

      {showRemoveDialog && createPortal(
        <div 
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowRemoveDialog(false);
            }
          }}
        >
          <div className="w-full max-w-md animate-fade-in rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-start gap-4">
              <div className="flex size-12 flex-shrink-0 items-center justify-center rounded-full bg-orange-100">
                <AlertTriangle className="size-6 text-orange-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900">Remove Uploaded Image?</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Are you sure you want to remove this uploaded paint sample? This will also clear the analysis results.
                </p>
              </div>
            </div>
            <div className="mt-6 flex gap-3 justify-end">
              <Button
                onClick={() => setShowRemoveDialog(false)}
                variant="outline"
                className="border-gray-300 text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </Button>
              <Button
                onClick={confirmRemoveImage}
                className="bg-orange-500 hover:bg-orange-600 text-white"
              >
                Yes, Remove
              </Button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}