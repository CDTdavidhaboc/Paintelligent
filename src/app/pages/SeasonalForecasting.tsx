import { useMemo, useState, useEffect, useRef } from "react";
import type { ChangeEvent, DragEvent } from "react";
import {
  salesForecastAI,
} from "../gemini-service/SalesForecasting";

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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Button } from "../components/ui/button";
import { Label } from "../components/ui/label";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceArea,
} from "recharts";

import {
  TrendingUp,
  TrendingDown,
  AlertCircle,
  CheckCircle,
  CheckCircle2,
  Target,
  Lightbulb,
  Loader2,
  Sparkles,
  Database,
  RefreshCw,
  FileSpreadsheet,
  Upload,
  X,
  File,
  Save,
  Cloud,
  CloudOff,
  AlertTriangle,
} from "lucide-react";

import Papa from "papaparse";
import * as XLSX from "xlsx";
import { useAuth } from "../context/AuthContext";
import { 
  saveSalesForecastData, 
  getSalesForecastData, 
  clearSalesForecastData 
} from "../lib/supabase";

interface SalesRecord {
  id: string;
  month: string;
  year: number;
  season: string;
  sales: number;
  category?: string;
  unitsSold?: number;
}

// Constants
const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

const SEASON_FOR_MONTH = (m: number) =>
  m >= 10 || m <= 4 ? "Dry" : "Rainy";

// Required headers for sales data
const REQUIRED_HEADERS = ['Date', 'Category', 'Total Sales (PHP)', 'Units Sold', 'Season'];

export default function SeasonalForecasting() {
  const { userEmail } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState<"idle" | "syncing" | "success" | "error">("idle");
  const [syncMessage, setSyncMessage] = useState("");

  // File upload states
  const [uploadedData, setUploadedData] = useState<any[] | null>(null);
  const [uploadedDataName, setUploadedDataName] = useState("");
  const [uploadError, setUploadError] = useState("");
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [isDataSaved, setIsDataSaved] = useState(false);
  const csvInputRef = useRef<HTMLInputElement | null>(null);

  // Sales Data
  const [salesData, setSalesData] = useState<SalesRecord[]>([]);
  const [originalData, setOriginalData] = useState<SalesRecord[]>([]);
  const [debugInfo, setDebugInfo] = useState<string>("");

  // ----------------------------
  // AI States
  // ----------------------------
  const [forecastData, setForecastData] = useState<any>(null);
  const [forecastStatus, setForecastStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [lastGenerated, setLastGenerated] = useState<string | null>(null);

  // ----------------------------
  // UI States
  // ----------------------------
  const [viewMode, setViewMode] = useState("monthly");
  const [selectedMonth, setSelectedMonth] = useState("");
  const [timeFilter, setTimeFilter] = useState("all");
  const [chartKey, setChartKey] = useState(0);
  const [isVisible, setIsVisible] = useState(false);

  // Cache keys
  const CACHE_KEY = 'sales_forecast_data';
  const CACHE_TIMESTAMP_KEY = 'sales_forecast_timestamp';
  const CACHE_DATA_COUNT_KEY = 'sales_forecast_data_count';

  // ============================================================
  // SUPABASE: Load saved data on mount
  // ============================================================
  useEffect(() => {
    const loadData = async () => {
      if (!userEmail) {
        setIsLoading(false);
        return;
      }

      try {
        const data = await getSalesForecastData(userEmail);
        
        if (data) {
          // Restore sales data (NOW using sales_data, not inventory_data)
          if (data.sales_data) {
            setUploadedData(data.sales_data);
            setUploadedDataName(data.sales_data_name || "");
            setIsDataSaved(true);
            // Process the uploaded data
            processUploadedData(data.sales_data);
          }
          
          // Restore forecast data
          if (data.forecast_data) {
            setForecastData(data.forecast_data);
            setForecastStatus("success");
          }
          
          // Restore last generated
          if (data.last_fetched) {
            setLastGenerated(new Date(data.last_fetched).toLocaleString());
          }
          
          setSyncStatus("success");
          setSyncMessage("✅ Data loaded from cloud");
        } else {
          setSyncStatus("idle");
          setSyncMessage("No saved data found");
        }
      } catch (error) {
        console.error("Error loading user data:", error);
        setSyncStatus("error");
        setSyncMessage("❌ Failed to load data from cloud");
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [userEmail]);

  // ============================================================
  // SUPABASE: Save to cloud when data changes (debounced)
  // ============================================================
  useEffect(() => {
    const saveToCloud = async () => {
      if (!userEmail) return;
      
      setSyncStatus("syncing");
      setSyncMessage("🔄 Syncing to cloud...");

      try {
        const success = await saveSalesForecastData(userEmail, {
          sales_data: uploadedData,
          sales_data_name: uploadedDataName,
          forecast_data: forecastData,
          last_fetched: lastGenerated ? new Date(lastGenerated).toISOString() : null,
        });
        
        if (success) {
          setSyncStatus("success");
          setSyncMessage("✅ Data synced to cloud");
        } else {
          setSyncStatus("error");
          setSyncMessage("❌ Sync failed");
        }
      } catch (error) {
        console.error("Error saving user data:", error);
        setSyncStatus("error");
        setSyncMessage("❌ Sync failed");
      }
    };

    // Debounce saves to avoid too many writes
    const timeoutId = setTimeout(() => {
      if (userEmail && (uploadedData || forecastData)) {
        saveToCloud();
      }
    }, 2000);

    return () => clearTimeout(timeoutId);
  }, [userEmail, uploadedData, uploadedDataName, forecastData, lastGenerated]);

  // ============================================================
  // ANIMATION & EFFECTS
  // ============================================================

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 80);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    setChartKey((k) => k + 1);
  }, [viewMode, timeFilter, selectedMonth, salesData, forecastData]);

  useEffect(() => {
    if (salesData.length && !selectedMonth) {
      setSelectedMonth(`${salesData[0].month.substring(0, 3)} ${salesData[0].year}`);
    }
  }, [salesData]);

  // ============================================================
  // VALIDATE HEADERS
  // ============================================================
  const validateHeaders = (headers: string[]): { valid: boolean; missing: string[] } => {
    const normalizedHeaders = headers.map(h => h.trim());
    const missing = REQUIRED_HEADERS.filter(req => 
      !normalizedHeaders.some(h => h === req)
    );
    return {
      valid: missing.length === 0,
      missing
    };
  };

  // ============================================================
  // DATA PROCESSING
  // ============================================================

  const aggregateSalesData = (data: SalesRecord[]) => {
    const grouped = data.reduce((acc, item) => {
      const key = `${item.month}-${item.year}`;
      if (acc[key]) {
        acc[key].sales += item.sales;
        if (item.unitsSold) {
          acc[key].unitsSold = (acc[key].unitsSold || 0) + item.unitsSold;
        }
        if (!acc[key].category && item.category) {
          acc[key].category = item.category;
        }
      } else {
        acc[key] = { ...item };
      }
      return acc;
    }, {} as Record<string, SalesRecord>);
    
    return Object.values(grouped).sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      return MONTH_NAMES.indexOf(a.month.substring(0, 3)) - MONTH_NAMES.indexOf(b.month.substring(0, 3));
    });
  };

  const processUploadedData = (data: any[]) => {
    try {
      console.log("Processing uploaded data, first row:", data[0]);
      
      // Get headers from the first row
      const headers = Object.keys(data[0] || {});
      console.log("Found headers:", headers);
      
      // Validate headers
      const validation = validateHeaders(headers);
      if (!validation.valid) {
        setUploadError(`Missing required headers: ${validation.missing.join(', ')}. Required: ${REQUIRED_HEADERS.join(', ')}`);
        return;
      }
      
      const formattedData: SalesRecord[] = data.map((row: any, index: number) => {
        // Parse date
        let date = null;
        let month = "";
        let year = new Date().getFullYear();
        
        if (row.Date) {
          date = new Date(row.Date);
          if (!isNaN(date.getTime())) {
            month = date.toLocaleString("en-US", { month: "long" });
            year = date.getFullYear();
          }
        } else {
          // Fallback: use current date if Date is missing
          const now = new Date();
          month = now.toLocaleString("en-US", { month: "long" });
          year = now.getFullYear();
        }
        
        const category = row.Category || row["Category"] || "";
        const sales = Number(row["Total Sales (PHP)"] || row["Total Sales"] || row["sales"] || 0);
        const unitsSold = Number(row["Units Sold"] || row["unitsSold"] || 0);
        const season = row.Season || row["Season"] || SEASON_FOR_MONTH(new Date(`${month} 1, ${year}`).getMonth());
        
        return {
          id: String(index + 1),
          month: month,
          year: year,
          season: season,
          sales: sales,
          category: category,
          unitsSold: unitsSold,
        };
      });
      
      console.log("Formatted data:", formattedData.slice(0, 5));
      
      setOriginalData(formattedData);
      
      const uniqueCategories = [...new Set(formattedData.map(r => r.category).filter(Boolean))];
      console.log("Unique categories found:", uniqueCategories);
      setDebugInfo(`Categories found: ${uniqueCategories.join(', ') || 'None'}`);
      
      const aggregated = aggregateSalesData(formattedData);
      console.log("Aggregated data:", aggregated.slice(0, 5));
      
      setSalesData(aggregated);

      // Clear old forecast when new data is loaded
      setForecastData(null);
      setForecastStatus("idle");
      setLastGenerated(null);
      
      // Clear cache
      localStorage.removeItem(CACHE_KEY);
      localStorage.removeItem(CACHE_TIMESTAMP_KEY);
      localStorage.removeItem(CACHE_DATA_COUNT_KEY);
      
      setUploadError(""); // Clear any previous errors
      
    } catch (error) {
      console.error("Error processing uploaded data:", error);
      setUploadError("Failed to process data. Please check the file format.");
    }
  };

  const handleSaveData = () => {
    if (!uploadedData || uploadedData.length === 0) {
      setUploadError("No data to save. Please upload a file first.");
      return;
    }

    try {
      setIsDataSaved(true);
      setUploadError("");
      
      const successMsg = document.createElement("div");
      successMsg.className = "fixed top-4 right-4 z-50 bg-green-600 text-white px-6 py-4 rounded-lg shadow-lg animate-slide-in";
      successMsg.innerHTML = "✅ Data saved successfully! Forecasting is now enabled.";
      document.body.appendChild(successMsg);
      setTimeout(() => successMsg.remove(), 3000);
    } catch (err) {
      console.error("Error saving data:", err);
      setUploadError("Failed to save data.");
    }
  };

  const handleClearSavedData = () => {
    // Clear local state
    setIsDataSaved(false);
    setUploadedData(null);
    setUploadedDataName("");
    setSalesData([]);
    setOriginalData([]);
    setForecastData(null);
    setForecastStatus("idle");
    setLastGenerated(null);
    if (csvInputRef.current) csvInputRef.current.value = "";
    
    // Clear cache
    localStorage.removeItem(CACHE_KEY);
    localStorage.removeItem(CACHE_TIMESTAMP_KEY);
    localStorage.removeItem(CACHE_DATA_COUNT_KEY);
    
    // Clear from Supabase
    clearSupabaseData();
  };

  const clearSupabaseData = async () => {
    if (!userEmail) return;
    
    try {
      setSyncStatus("syncing");
      setSyncMessage("🔄 Clearing data from cloud...");
      
      const success = await clearSalesForecastData(userEmail);
      
      if (success) {
        setSyncStatus("success");
        setSyncMessage("✅ Data cleared from cloud");
        console.log("✅ Data cleared from Supabase");
      } else {
        setSyncStatus("error");
        setSyncMessage("❌ Failed to clear data");
      }
    } catch (error) {
      console.error("Error clearing user data:", error);
      setSyncStatus("error");
      setSyncMessage("❌ Failed to clear data");
    }
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
      return;
    }

    const reader = new FileReader();

    if (fileExtension === 'csv') {
      reader.onload = (ev) => {
        try {
          const csvText = ev.target?.result as string;
          const result = Papa.parse<any>(csvText, {
            header: true,
            skipEmptyLines: true,
            trimHeaders: true,
          });

          const data = result.data.filter((item) => 
            Object.keys(item).some(key => item[key] !== undefined && item[key] !== "")
          );

          if (data.length === 0) {
            setUploadError("CSV file appears empty or invalid.");
            return;
          }

          // Validate headers
          const headers = Object.keys(data[0] || {});
          const validation = validateHeaders(headers);
          if (!validation.valid) {
            setUploadError(`Missing required headers: ${validation.missing.join(', ')}. Required: ${REQUIRED_HEADERS.join(', ')}`);
            return;
          }

          setUploadedData(data);
          setUploadedDataName(file.name);
          processUploadedData(data);
          setUploadError("");
        } catch (err: any) {
          setUploadError(`Failed to process CSV: ${err.message}`);
        }
      };
      reader.onerror = () => setUploadError("Failed to read CSV file.");
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
          return;
        }

        // Validate headers
        const headers = Object.keys(jsonData[0] || {});
        const validation = validateHeaders(headers);
        if (!validation.valid) {
          setUploadError(`Missing required headers: ${validation.missing.join(', ')}. Required: ${REQUIRED_HEADERS.join(', ')}`);
          return;
        }

        setUploadedData(jsonData);
        setUploadedDataName(file.name);
        processUploadedData(jsonData);
        setUploadError("");
      } catch (err: any) {
        setUploadError(`Failed to process Excel file: ${err.message}`);
      }
    };
    reader.onerror = () => setUploadError("Failed to read Excel file.");
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
    // Clear local state
    setUploadedData(null);
    setUploadedDataName("");
    setUploadError("");
    setIsDataSaved(false);
    setSalesData([]);
    setOriginalData([]);
    setForecastData(null);
    setForecastStatus("idle");
    setLastGenerated(null);
    if (csvInputRef.current) csvInputRef.current.value = "";
    
    // Clear cache
    localStorage.removeItem(CACHE_KEY);
    localStorage.removeItem(CACHE_TIMESTAMP_KEY);
    localStorage.removeItem(CACHE_DATA_COUNT_KEY);
    
    // Clear from Supabase
    clearSupabaseData();
  };

  // ============================================================
  // CACHE FUNCTIONS
  // ============================================================
  const saveToCache = (data: any) => {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(data));
      localStorage.setItem(CACHE_TIMESTAMP_KEY, String(Date.now()));
      localStorage.setItem(CACHE_DATA_COUNT_KEY, String(salesData.length));
      const date = new Date();
      setLastGenerated(date.toLocaleString());
      console.log("Data cached successfully");
    } catch (error) {
      console.error("Error saving to cache:", error);
    }
  };

  const clearCache = () => {
    localStorage.removeItem(CACHE_KEY);
    localStorage.removeItem(CACHE_TIMESTAMP_KEY);
    localStorage.removeItem(CACHE_DATA_COUNT_KEY);
    setForecastData(null);
    setForecastStatus("idle");
    setLastGenerated(null);
    console.log("Cache cleared");
  };

  // ============================================================
  // CALCULATE FORECAST
  // ============================================================
  const calculateForecast = () => {
    if (!salesData.length) return [];

    const sorted = [...salesData].sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      return MONTH_NAMES.indexOf(a.month.substring(0, 3)) - MONTH_NAMES.indexOf(b.month.substring(0, 3));
    });

    const lastThree = sorted.slice(-3);
    const avgLastThree = lastThree.reduce((sum, r) => sum + r.sales, 0) / lastThree.length;
    const totalAvg = salesData.reduce((sum, r) => sum + r.sales, 0) / salesData.length;
    const growthRate = avgLastThree / (totalAvg || 1);
    const lastMonth = sorted[sorted.length - 1];
    const lastMonthIndex = MONTH_NAMES.indexOf(lastMonth.month.substring(0, 3));
    
    const forecast = [];
    for (let i = 1; i <= 6; i++) {
      const nextIndex = (lastMonthIndex + i) % 12;
      const nextYear = lastMonthIndex + i >= 12 ? lastMonth.year + 1 : lastMonth.year;
      const monthName = MONTH_NAMES[nextIndex];
      const season = SEASON_FOR_MONTH(nextIndex + 1);
      
      const basePrediction = avgLastThree * Math.pow(growthRate, i * 0.15);
      const variation = 1 + (Math.random() * 0.1 - 0.05);
      const predictedSales = Math.round(basePrediction * variation);
      
      forecast.push({
        month: `${monthName} ${nextYear}`,
        sales: Math.max(predictedSales, 100),
        season: season,
        upperBound: Math.round(predictedSales * 1.15),
        lowerBound: Math.round(predictedSales * 0.85)
      });
    }
    
    return forecast;
  };

  // ============================================================
  // GEMINI FORECAST
  // ============================================================
  const generateForecast = async () => {
    if (!salesData.length) {
      setUploadError("No sales data available. Please upload data first.");
      return;
    }

    setForecastStatus("loading");

    try {
      const totalSales = salesData.reduce((sum, r) => sum + r.sales, 0);
      const avgSales = totalSales / salesData.length;
      const sorted = [...salesData].sort((a, b) => {
        if (a.year !== b.year) return a.year - b.year;
        return MONTH_NAMES.indexOf(a.month.substring(0, 3)) - MONTH_NAMES.indexOf(b.month.substring(0, 3));
      });
      const lastMonth = sorted[sorted.length - 1];
      
      const dryData = salesData.filter(r => r.season === "Dry");
      const rainyData = salesData.filter(r => r.season === "Rainy");
      const dryTotal = dryData.reduce((sum, r) => sum + r.sales, 0);
      const rainyTotal = rainyData.reduce((sum, r) => sum + r.sales, 0);
      const dryAvg = dryData.length ? dryTotal / dryData.length : 0;
      const rainyAvg = rainyData.length ? rainyTotal / rainyData.length : 0;
      
      const calculatedForecast = calculateForecast();

      const allCategories = [...new Set(originalData.map(r => r.category).filter(Boolean))];
      console.log("All categories from original data:", allCategories);
      
      const categorySales = allCategories.map(cat => {
        const items = originalData.filter(r => r.category === cat);
        const total = items.reduce((sum, r) => sum + r.sales, 0);
        const units = items.reduce((sum, r) => sum + (r.unitsSold || 0), 0);
        const months = items.length;
        return { category: cat, total, units, months };
      }).sort((a, b) => b.total - a.total);

      const categoryDetails = categorySales.map(cat => {
        const catData = originalData.filter(r => r.category === cat.category);
        const monthlyAvg = cat.total / cat.months;
        const dryCat = catData.filter(r => r.season === "Dry");
        const rainyCat = catData.filter(r => r.season === "Rainy");
        const dryTotal = dryCat.reduce((sum, r) => sum + r.sales, 0);
        const rainyTotal = rainyCat.reduce((sum, r) => sum + r.sales, 0);
        const dryAvg = dryCat.length ? dryTotal / dryCat.length : 0;
        const rainyAvg = rainyCat.length ? rainyTotal / rainyCat.length : 0;
        return {
          ...cat,
          monthlyAvg,
          dryTotal,
          rainyTotal,
          dryAvg,
          rainyAvg,
          bestSeason: dryAvg > rainyAvg ? 'Dry' : 'Rainy'
        };
      });

      const prompt = `
Analyze the sales data and provide a comprehensive business analysis.

SALES DATA:
- Total Sales: ₱${totalSales.toLocaleString()}
- Average Monthly Sales: ₱${Math.round(avgSales).toLocaleString()}
- Records: ${salesData.length}
- Categories: ${allCategories.length > 0 ? allCategories.join(', ') : 'None'}

SEASONAL BREAKDOWN:
Dry Season: ₱${dryTotal.toLocaleString()} (${dryData.length} months, Avg: ₱${Math.round(dryAvg).toLocaleString()})
Rainy Season: ₱${rainyTotal.toLocaleString()} (${rainyData.length} months, Avg: ₱${Math.round(rainyAvg).toLocaleString()})

CATEGORY DETAILS:
${categoryDetails.map(c => `${c.category}: ₱${c.total.toLocaleString()} (${c.units} units, ${c.months} months, Best: ${c.bestSeason})`).join('\n')}

Return ONLY valid JSON with this structure:
{
  "seasonalTrends": {
    "dry": {
      "totalSales": ${dryTotal},
      "averageMonthlySales": ${Math.round(dryAvg)},
      "trend": "${dryAvg > rainyAvg ? 'increasing' : 'decreasing'}"
    },
    "rainy": {
      "totalSales": ${rainyTotal},
      "averageMonthlySales": ${Math.round(rainyAvg)},
      "trend": "${rainyAvg > dryAvg ? 'increasing' : 'decreasing'}"
    }
  },
  "highDemand": {
    "dry": [
      ${categoryDetails.filter(c => c.dryAvg > c.rainyAvg).slice(0, 4).map((c, i) => `{
        "name": "${c.category}",
        "units": ${Math.round(c.dryTotal / (c.months || 1)) || 50},
        "revenue": ${Math.round(c.dryTotal * 0.3) || 10000}
      }`).join(',')}
    ],
    "rainy": [
      ${categoryDetails.filter(c => c.rainyAvg > c.dryAvg).slice(0, 4).map((c, i) => `{
        "name": "${c.category}",
        "units": ${Math.round(c.rainyTotal / (c.months || 1)) || 40},
        "revenue": ${Math.round(c.rainyTotal * 0.25) || 8000}
      }`).join(',')}
    ]
  },
  "bestSellingProducts": [
    ${categoryDetails.slice(0, 3).map((c, i) => `{
      "name": "${c.category}",
      "unitsSold": ${Math.round(c.total / 500) || 100},
      "growth": "+${Math.round((c.dryAvg / (c.rainyAvg || 1) - 1) * 100) || 5}%"
    }`).join(',')}
  ],
  "slowMovingProducts": [
    ${categoryDetails.slice(-2).map((c, i) => `{
      "name": "${c.category}",
      "unitsSold": ${Math.round(c.total / 800) || 20},
      "recommendation": "${c.total > totalSales / allCategories.length ? 'Review pricing and promotions' : 'Consider bundling or discounts'}"
    }`).join(',')}
  ],
  "stockRecommendations": [
    ${categoryDetails.map((c, i) => `{
      "category": "${c.category}",
      "items": [
        {
          "name": "${c.category}",
          "currentStock": ${Math.round(c.total / 600) || 30},
          "recommendedStock": ${Math.round(c.total / 400) || 50},
          "action": "${c.total > totalSales / allCategories.length ? 'Increase' : 'Maintain'}"
        }
      ]
    }`).join(',')}
  ],
  "marketingStrategies": [
    {
      "season": "Dry Season",
      "targetCategories": [${categoryDetails.filter(c => c.dryAvg > c.rainyAvg).slice(0, 3).map(c => `"${c.category}"`).join(', ')}],
      "strategies": [
        "Launch outdoor promotions for ${categoryDetails.filter(c => c.dryAvg > c.rainyAvg).slice(0, 2).map(c => c.category).join(' and ')}",
        "Create seasonal bundles featuring ${categoryDetails.filter(c => c.dryAvg > c.rainyAvg).slice(0, 3).map(c => c.category).join(', ')}",
        "Run dry season discounts on ${categoryDetails.filter(c => c.dryAvg > c.rainyAvg).slice(0, 1).map(c => c.category).join(', ')} products",
        "Implement targeted social media campaigns for ${categoryDetails.filter(c => c.dryAvg > c.rainyAvg).slice(0, 2).map(c => c.category).join(' & ')}",
        "Offer bundle deals: Buy 2 get 1 free on selected ${categoryDetails.filter(c => c.dryAvg > c.rainyAvg).slice(0, 1).map(c => c.category).join(', ')} items"
      ]
    },
    {
      "season": "Rainy Season",
      "targetCategories": [${categoryDetails.filter(c => c.rainyAvg > c.dryAvg).slice(0, 3).map(c => `"${c.category}"`).join(', ')}],
      "strategies": [
        "Focus on indoor solutions for ${categoryDetails.filter(c => c.rainyAvg > c.dryAvg).slice(0, 2).map(c => c.category).join(' and ')}",
        "Launch weather-proof campaigns targeting ${categoryDetails.filter(c => c.rainyAvg > c.dryAvg).slice(0, 1).map(c => c.category).join(', ')}",
        "Create rainy season bundles for ${categoryDetails.filter(c => c.rainyAvg > c.dryAvg).slice(0, 3).map(c => c.category).join(', ')}",
        "Offer free delivery promotions for ${categoryDetails.filter(c => c.rainyAvg > c.dryAvg).slice(0, 2).map(c => c.category).join(' & ')}",
        "Implement loyalty programs for repeat buyers of ${categoryDetails.filter(c => c.rainyAvg > c.dryAvg).slice(0, 1).map(c => c.category).join(', ')}"
      ]
    }
  ],
  "forecast": ${JSON.stringify(calculatedForecast)}
}`;

      const response = await salesForecastAI.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
      });

      const cleaned = response.text
        .replace(/```json/g, "")
        .replace(/```/g, "")
        .trim();

      const result = JSON.parse(cleaned);

      console.log("AI Response:", result);

      saveToCache(result);
      setForecastData(result);
      setForecastStatus("success");

    } catch (error) {
      console.error("AI Generation Error:", error);
      setForecastStatus("error");
    }
  };

  useEffect(() => {
    if (forecastStatus === "success" && forecastData) {
      setTimeout(() => {
        const resultsElement = document.getElementById('ai-results');
        if (resultsElement) {
          resultsElement.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
          });
        }
      }, 300);
    }
  }, [forecastStatus, forecastData]);

  // ============================================================
  // COMPUTED VALUES
  // ============================================================

  // Historical Chart
  const historicalChartData = useMemo(
    () =>
      salesData.map((row, index) => ({
        id: `hist-${index}`,
        month: `${row.month.substring(0, 3)} ${row.year}`,
        sales: row.sales,
        season: row.season,
        isForecast: false,
        upperBound: null,
        lowerBound: null,
      })),
    [salesData]
  );

  // Forecast Chart
  const forecastChartData = useMemo(() => {
    if (!forecastData?.forecast) return [];
    return forecastData.forecast.map((item: any, index: number) => ({
      id: `forecast-${index}`,
      month: item.month,
      sales: item.sales,
      season: item.season ?? "Dry",
      isForecast: true,
      upperBound: item.upperBound ?? null,
      lowerBound: item.lowerBound ?? null,
    }));
  }, [forecastData]);

  const allMonthlyData = useMemo(
    () => [...historicalChartData, ...forecastChartData],
    [historicalChartData, forecastChartData]
  );

  // Filter
  const filteredMonthlyData = useMemo(() => {
    let data = allMonthlyData;
    if (timeFilter !== "all") {
      const historical = data.filter(
        (d) => !d.isForecast && d.month.includes(timeFilter)
      );
      const forecast = data.filter((d) => d.isForecast);
      data = timeFilter === String(new Date().getFullYear())
        ? [...historical, ...forecast]
        : historical;
    }
    return data.map((item, index) => ({
      ...item,
      id: `${chartKey}-${index}`,
    }));
  }, [allMonthlyData, timeFilter, chartKey]);

  // Weekly Chart
  const weeklyChartData = useMemo(() => {
    const row = salesData.find(
      (r) => `${r.month.substring(0, 3)} ${r.year}` === selectedMonth
    );
    if (!row) return [];
    const base = row.sales / 4;
    return ["Week 1", "Week 2", "Week 3", "Week 4"].map((week, index) => ({
      id: `week-${index}`,
      week,
      sales: Math.round(base + (Math.random() * base * 0.1 - base * 0.05)),
      season: row.season,
    }));
  }, [salesData, selectedMonth]);

  // Seasonal Areas
  const seasonalAreas = useMemo(() => {
    const areas: any[] = [];
    let areaIndex = 0;
    for (let i = 0; i < filteredMonthlyData.length; i++) {
      const current = filteredMonthlyData[i];
      const previous = filteredMonthlyData[i - 1];
      if (i === 0 || previous?.season !== current.season) {
        let end = i;
        while (
          end < filteredMonthlyData.length - 1 &&
          filteredMonthlyData[end + 1].season === current.season
        ) {
          end++;
        }
        areas.push({
          key: `area-${chartKey}-${areaIndex++}`,
          x1: current.month,
          x2: filteredMonthlyData[end].month,
          fill: current.season === "Dry" ? "#86efac" : "#d1fae5",
          stroke: current.season === "Dry" ? "#22c55e" : "#6ee7b7",
        });
      }
    }
    return areas;
  }, [filteredMonthlyData, chartKey]);

  // ── Computed summary stats ──
  const totalSales = useMemo(
    () => salesData.reduce((sum, row) => sum + row.sales, 0),
    [salesData]
  );

  const drySales = useMemo(
    () =>
      salesData
        .filter((row) => row.season === "Dry")
        .reduce((sum, row) => sum + row.sales, 0),
    [salesData]
  );

  const rainySales = useMemo(
    () =>
      salesData
        .filter((row) => row.season === "Rainy")
        .reduce((sum, row) => sum + row.sales, 0),
    [salesData]
  );

  const availableMonths = useMemo(
    () => salesData.map((row) => `${row.month.substring(0, 3)} ${row.year}`),
    [salesData]
  );

  // ── AI Results ──
  const seasonalTrends = forecastData?.seasonalTrends ?? null;
  const highDemand = forecastData?.highDemand ?? null;
  const bestSelling = forecastData?.bestSellingProducts ?? [];
  const slowMoving = forecastData?.slowMovingProducts ?? [];
  const stockRecs = forecastData?.stockRecommendations ?? [];
  const marketing = forecastData?.marketingStrategies ?? [];

  // ── Available Years ──
  const availableYears = useMemo(
    () => [...new Set(salesData.map((row) => row.year))].sort(),
    [salesData]
  );

  const uniqueCategories = useMemo(
    () => [...new Set(originalData.map(r => r.category).filter(Boolean))],
    [originalData]
  );

  const isDataLoaded = uploadedData !== null && uploadedData.length > 0;
  const isAnalyzerEnabled = isDataSaved && isDataLoaded;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="size-12 animate-spin text-[#1a4d2e] mx-auto" />
          <p className="mt-4 text-gray-600">Loading your data...</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`
        min-h-screen bg-white p-6 pb-10 space-y-6 
        transition-all duration-700 ease-out
        ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5"}
      `}
    >
      {/* Header with Sync Status */}
      <div className="flex items-center justify-between">
        <div>
          {lastGenerated && (
            <p className="text-xs text-gray-500 mt-1">
              Generated via Gemini AI · {lastGenerated}
            </p>
          )}
        </div>
        {userEmail && (
          <div className="flex items-center gap-2 text-xs">
            {syncStatus === "syncing" && (
              <>
                <Loader2 className="size-3 animate-spin text-yellow-500" />
                <span className="text-yellow-600">Syncing...</span>
              </>
            )}
            {syncStatus === "success" && (
              <>
                <Cloud className="size-3 text-green-500" />
                <span className="text-green-600">Cloud Synced</span>
              </>
            )}
            {syncStatus === "error" && (
              <>
                <CloudOff className="size-3 text-red-500" />
                <span className="text-red-600">Sync Error</span>
              </>
            )}
            {syncStatus === "idle" && userEmail && (
              <>
                <Cloud className="size-3 text-gray-400" />
                <span className="text-gray-400">Not Synced</span>
              </>
            )}
          </div>
        )}
      </div>

      {/* ============================================================
          DATA UPLOAD SECTION
          ============================================================ */}
      <section>
        <Card className="overflow-hidden border border-blue-100 shadow-sm">
          <CardHeader className="py-3 px-4 bg-gradient-to-r from-blue-50 via-white to-blue-50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Database className="size-4 text-blue-600" />
                <CardTitle className="text-sm font-semibold text-gray-900">Sales Data</CardTitle>
              </div>
              <Badge className={isDataLoaded ? "bg-green-600 text-white shadow-sm text-xs" : "bg-red-600 text-white shadow-sm text-xs"}>
                {isDataSaved ? "✅ SAVED" : isDataLoaded ? "📂 LOADED" : "✗ NO DATA"}
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="pt-3 pb-3">
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
                      ? "border-blue-600 bg-blue-50 shadow-md"
                      : "border-blue-300/60 bg-white hover:border-blue-600 hover:bg-blue-50/60"
                    }
                  `}
                >
                  <div className="flex items-center justify-center gap-4">
                    <FileSpreadsheet className="size-6 text-blue-500" />
                    <div>
                      <p className="text-sm font-medium text-gray-700">Drop CSV or Excel file</p>
                      <p className="text-xs text-gray-400">or click to browse</p>
                    </div>
                    <div className="flex gap-1">
                      {['CSV', 'XLSX'].map((format) => (
                        <Badge key={format} variant="secondary" className="text-xs bg-blue-50 text-blue-700 border border-blue-200">
                          {format}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
                
                {/* HEADER REMINDER - Required headers for sales data */}
                <div className="mt-3 p-3 bg-amber-50 rounded-lg border border-amber-200">
                  <p className="text-xs font-medium text-amber-800">📋 Required Headers (exact match):</p>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    <Badge variant="outline" className="text-xs bg-white border-amber-300 text-amber-700 font-mono">Date</Badge>
                    <Badge variant="outline" className="text-xs bg-white border-amber-300 text-amber-700 font-mono">Category</Badge>
                    <Badge variant="outline" className="text-xs bg-white border-amber-300 text-amber-700 font-mono">Total Sales (PHP)</Badge>
                    <Badge variant="outline" className="text-xs bg-white border-amber-300 text-amber-700 font-mono">Units Sold</Badge>
                    <Badge variant="outline" className="text-xs bg-white border-amber-300 text-amber-700 font-mono">Season</Badge>
                  </div>
                  <p className="text-[11px] text-amber-600 mt-1.5">⚠️ Headers are case-sensitive and must match exactly</p>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {/* File Info */}
                <div className={`flex items-center justify-between p-2 rounded-lg border transition-all duration-300 ${
                  isDataSaved 
                    ? "bg-gray-50 border-gray-200 opacity-70" 
                    : "bg-blue-50 border-blue-200"
                }`}>
                  <div className="flex items-center gap-3">
                    <div className={`flex size-8 items-center justify-center rounded-lg text-white ${
                      isDataSaved ? "bg-gray-400" : "bg-blue-600"
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
                  {/* Save button - only visible when not saved */}
                  {!isDataSaved && (
                    <Button
                      onClick={handleSaveData}
                      className="bg-green-600 hover:bg-green-700 text-white text-xs h-7 px-2"
                    >
                      <Save className="size-3 mr-1" />
                      Save & Enable
                    </Button>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-2">
                  {!isDataSaved ? (
                    <>
                      <Button
                        onClick={() => csvInputRef.current?.click()}
                        variant="outline"
                        className="border-blue-300 text-blue-600 hover:bg-blue-50 text-xs h-7 px-2"
                      >
                        <RefreshCw className="size-3 mr-1" />
                        Replace
                      </Button>
                      <Button
                        onClick={handleRemoveData}
                        variant="outline"
                        className="border-red-300 text-red-600 hover:bg-red-50 text-xs h-7 px-2"
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
                        className="border-blue-300 text-blue-600 hover:bg-blue-50 text-xs h-7 px-2"
                      >
                        <RefreshCw className="size-3 mr-1" />
                        Replace
                      </Button>
                      <Button
                        onClick={handleClearSavedData}
                        variant="outline"
                        className="border-red-300 text-red-600 hover:bg-red-50 text-xs h-7 px-2"
                      >
                        <X className="size-3 mr-1" />
                        Clear
                      </Button>
                      <div className="ml-auto flex items-center gap-1 text-xs text-green-600">
                        <div className="size-2 bg-green-500 rounded-full animate-pulse" />
                        <span>Active</span>
                      </div>
                    </>
                  )}
                </div>

                {/* Debug Info */}
                {debugInfo && (
                  <div className="text-xs text-gray-500 bg-gray-50 p-2 rounded border border-gray-200">
                    <strong>Data Info:</strong> {salesData.length} records • 
                    <strong> Categories:</strong> {uniqueCategories.length > 0 ? uniqueCategories.join(', ') : 'None found'} • 
                    <strong> Years:</strong> {availableYears.join(', ')}
                  </div>
                )}
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

      {/* ============================================================
          SUMMARY CARDS (Only shown when data is loaded)
          ============================================================ */}
      {salesData.length > 0 && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <Card className="shadow-md border-0 bg-gradient-to-r from-green-700 to-green-600 text-white">
              <CardContent className="py-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm opacity-80">Total Sales</p>
                    <h2 className="text-3xl font-bold mt-1">
                      ₱{totalSales.toLocaleString()}
                    </h2>
                    <p className="text-xs mt-2 opacity-70">
                      {salesData.length} records
                    </p>
                  </div>
                  <TrendingUp className="w-10 h-10 opacity-70" />
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-md border-l-4 border-green-500">
              <CardContent className="py-6">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-sm text-gray-500">Dry Season</p>
                    <h2 className="text-2xl font-bold text-green-700">
                      ₱{drySales.toLocaleString()}
                    </h2>
                    <p className="text-xs text-gray-500 mt-1">
                      {salesData.filter((r) => r.season === "Dry").length} Months
                    </p>
                  </div>
                  <TrendingUp className="w-9 h-9 text-green-500" />
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-md border-l-4 border-blue-500">
              <CardContent className="py-6">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-sm text-gray-500">Rainy Season</p>
                    <h2 className="text-2xl font-bold text-blue-700">
                      ₱{rainySales.toLocaleString()}
                    </h2>
                    <p className="text-xs text-gray-500 mt-1">
                      {salesData.filter((r) => r.season === "Rainy").length} Months
                    </p>
                  </div>
                  <TrendingDown className="w-9 h-9 text-blue-500" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* ============================================================
              SALES TREND CHART
              ============================================================ */}
          <Card className="shadow-lg border-0">
            <CardHeader className="border-b bg-gray-50">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div>
                  <CardTitle className="text-xl font-bold">
                    {viewMode === "monthly"
                      ? "Sales Trend Analysis"
                      : `Weekly Sales Analysis • ${selectedMonth}`}
                  </CardTitle>
                  <CardDescription>
                    Compare historical sales with AI-generated forecasts.
                  </CardDescription>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                  {viewMode === "monthly" && (
                    <select
                      value={timeFilter}
                      onChange={(e) => setTimeFilter(e.target.value)}
                      className="border rounded-lg px-3 py-2 text-sm"
                    >
                      <option value="all">All Years</option>
                      {availableYears.map((year) => (
                        <option key={year} value={String(year)}>
                          {year}
                        </option>
                      ))}
                    </select>
                  )}
                  <div className="flex bg-gray-100 rounded-lg p-1">
                    <button
                      onClick={() => setViewMode("monthly")}
                      className={`px-4 py-2 rounded-md text-sm transition ${
                        viewMode === "monthly"
                          ? "bg-green-700 text-white"
                          : "text-gray-600"
                      }`}
                    >
                      Monthly
                    </button>
                    <button
                      onClick={() => setViewMode("weekly")}
                      className={`px-4 py-2 rounded-md text-sm transition ${
                        viewMode === "weekly"
                          ? "bg-green-700 text-white"
                          : "text-gray-600"
                      }`}
                    >
                      Weekly
                    </button>
                  </div>
                  {viewMode === "weekly" && (
                    <select
                      value={selectedMonth}
                      onChange={(e) => setSelectedMonth(e.target.value)}
                      className="border rounded-lg px-3 py-2 text-sm"
                    >
                      {availableMonths.map((month) => (
                        <option key={month}>{month}</option>
                      ))}
                    </select>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <ResponsiveContainer width="100%" height={420}>
                <LineChart
                  data={viewMode === "monthly" ? filteredMonthlyData : weeklyChartData}
                  margin={{ top: 20, right: 30, left: 10, bottom: 30 }}
                >
                  <defs>
                    <linearGradient id="historicalGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#166534" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#166534" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="forecastGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#22c55e" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#22c55e" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="4 4" stroke="#E5E7EB" />
                  {viewMode === "monthly" &&
                    seasonalAreas.map((area) => (
                      <ReferenceArea
                        key={area.key}
                        x1={area.x1}
                        x2={area.x2}
                        fill={area.fill}
                        fillOpacity={0.15}
                        strokeOpacity={0}
                      />
                    ))}
                  <XAxis
                    dataKey={viewMode === "monthly" ? "month" : "week"}
                    tick={{ fontSize: 12 }}
                    angle={viewMode === "monthly" ? -35 : 0}
                    textAnchor={viewMode === "monthly" ? "end" : "middle"}
                    height={70}
                  />
                  <YAxis
                    tick={{ fontSize: 12 }}
                    tickFormatter={(value) => `₱${(value / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    cursor={{ stroke: "#166534", strokeDasharray: "5 5" }}
                    contentStyle={{
                      borderRadius: 12,
                      border: "none",
                      boxShadow: "0 10px 30px rgba(0,0,0,.15)",
                    }}
                    formatter={(value: number) => [
                      `₱${Number(value).toLocaleString()}`,
                      "Sales",
                    ]}
                    labelFormatter={(label) => {
                      const point = allMonthlyData.find((d) => d.month === label);
                      return point
                        ? `${label} • ${point.season} ${
                            point.isForecast ? "(Forecast)" : "(Historical)"
                          }`
                        : label;
                    }}
                  />
                  {viewMode === "monthly" ? (
                    <>
                      <Line
                        type="monotone"
                        dataKey={(d) => (!d.isForecast ? d.sales : null)}
                        stroke="#166534"
                        strokeWidth={4}
                        dot={{ r: 4, fill: "#166534" }}
                        activeDot={{ r: 7 }}
                        connectNulls={false}
                        name="Historical Sales"
                      />
                      <Line
                        type="monotone"
                        dataKey={(d) => (d.isForecast ? d.sales : null)}
                        stroke="#22C55E"
                        strokeWidth={4}
                        strokeDasharray="8 6"
                        dot={{ r: 4, fill: "#22C55E" }}
                        activeDot={{ r: 7 }}
                        connectNulls
                        name="Forecast"
                      />
                      <Line
                        dataKey="upperBound"
                        stroke="#86EFAC"
                        strokeWidth={2}
                        strokeDasharray="3 3"
                        dot={false}
                        name="Upper Bound"
                      />
                      <Line
                        dataKey="lowerBound"
                        stroke="#86EFAC"
                        strokeWidth={2}
                        strokeDasharray="3 3"
                        dot={false}
                        name="Lower Bound"
                      />
                    </>
                  ) : (
                    <Line
                      type="monotone"
                      dataKey="sales"
                      stroke="#166534"
                      strokeWidth={4}
                      dot={{ r: 5, fill: "#166534" }}
                      activeDot={{ r: 8 }}
                      name="Weekly Sales"
                    />
                  )}
                </LineChart>
              </ResponsiveContainer>
              <div className="mt-6 flex flex-wrap items-center justify-center gap-6 rounded-lg bg-gray-50 p-4 text-sm">
                <div className="flex items-center gap-2">
                  <span className="h-1.5 w-8 rounded bg-green-900"></span>
                  Historical Sales
                </div>
                {forecastData && (
                  <div className="flex items-center gap-2">
                    <span className="h-1.5 w-8 border-t-2 border-dashed border-green-500"></span>
                    Forecast
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded bg-green-200"></span>
                  Dry Season
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded bg-emerald-100"></span>
                  Rainy Season
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* ============================================================
          GENERATE REPORT BUTTON
          ============================================================ */}
      {salesData.length > 0 && forecastStatus !== "success" && isDataSaved && (
        <div className="flex justify-center">
          <button
            onClick={generateForecast}
            disabled={forecastStatus === "loading"}
            className="flex items-center gap-3 rounded-lg bg-[#1a4d2e] px-8 py-4 text-white hover:bg-[#2d6b45] disabled:opacity-60 transition-all shadow-lg hover:shadow-xl"
          >
            {forecastStatus === "loading" ? (
              <>
                <Loader2 className="size-5 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="size-5" />
                Generate AI Forecast Report
              </>
            )}
          </button>
        </div>
      )}

      {/* ============================================================
          LOCKED STATE (when data loaded but not saved)
          ============================================================ */}
      {isDataLoaded && !isDataSaved && salesData.length > 0 && (
        <Card className="border-2 border-yellow-200 bg-yellow-50">
          <CardContent className="py-8">
            <div className="flex flex-col items-center text-center">
              <Save className="size-12 text-yellow-500 mb-4" />
              <h3 className="text-xl font-semibold text-yellow-700">
                Save Data to Enable Forecasting
              </h3>
              <p className="text-yellow-600 mt-2 max-w-md">
                Click the <strong>"Save & Enable"</strong> button above to unlock AI forecasting.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ============================================================
          EMPTY STATE
          ============================================================ */}
      {!salesData.length && !uploadedData && (
        <Card className="border border-dashed border-gray-300 shadow-sm">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <TrendingUp className="size-14 text-gray-300 mb-4" />
            <h2 className="text-2xl font-bold text-gray-700">No Sales Records Found</h2>
            <p className="mt-2 max-w-md text-gray-500 text-sm">
              Please upload a CSV or Excel file with your sales data to generate forecasts and insights.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              <Badge className="bg-[#1a4d2e] text-white">Sales Forecast</Badge>
              <Badge className="bg-green-600 text-white">Inventory Insights</Badge>
              <Badge className="bg-blue-600 text-white">AI Analytics</Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ============================================================
          LOADING STATE
          ============================================================ */}
      {forecastStatus === "loading" && (
        <Card className="shadow-lg border-0 bg-gradient-to-r from-green-50 to-emerald-50">
          <CardContent className="py-12">
            <div className="flex flex-col items-center justify-center text-center">
              <Loader2 className="size-12 text-green-700 animate-spin mb-4" />
              <h3 className="text-xl font-semibold text-gray-800">
                AI is Analyzing Your Data...
              </h3>
              <p className="text-gray-600 mt-2">
                Generating seasonal insights, product performance, and strategic recommendations.
              </p>
              <div className="mt-6 w-64 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-600 rounded-full animate-pulse"
                  style={{ width: '60%' }}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ============================================================
          ERROR STATE
          ============================================================ */}
      {forecastStatus === "error" && (
        <Card className="border-2 border-red-200 bg-red-50">
          <CardContent className="py-8">
            <div className="flex flex-col items-center text-center">
              <AlertCircle className="size-12 text-red-500 mb-4" />
              <h3 className="text-xl font-semibold text-red-700">
                Failed to Generate Forecast
              </h3>
              <p className="text-red-600 mt-2">
                There was an error processing your request. Please try again.
              </p>
              <button
                onClick={generateForecast}
                className="mt-4 px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Try Again
              </button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ============================================================
          AI RESULTS CONTAINER
          ============================================================ */}
      {forecastData && forecastStatus === "success" && (
        <div id="ai-results" className="space-y-6">
          {/* ── Seasonal Analysis ── */}
          {seasonalTrends && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="shadow-md border-l-4 border-blue-500">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-blue-700">
                    <TrendingDown className="w-5 h-5" />
                    Rainy Season Analysis
                  </CardTitle>
                  <CardDescription>Based on {salesData.filter(r => r.season === "Rainy").length} months</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between">
                    <span>Total Sales</span>
                    <span className="font-bold">
                      ₱{seasonalTrends.rainy?.totalSales?.toLocaleString() || 0}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Average Monthly Sales</span>
                    <span className="font-bold">
                      ₱{seasonalTrends.rainy?.averageMonthlySales?.toLocaleString() || 0}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Sales Trend</span>
                    <Badge className="bg-blue-100 text-blue-700">
                      {seasonalTrends.rainy?.trend || "N/A"}
                    </Badge>
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-md border-l-4 border-green-600">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-green-700">
                    <TrendingUp className="w-5 h-5" />
                    Dry Season Analysis
                  </CardTitle>
                  <CardDescription>Based on {salesData.filter(r => r.season === "Dry").length} months</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between">
                    <span>Total Sales</span>
                    <span className="font-bold">
                      ₱{seasonalTrends.dry?.totalSales?.toLocaleString() || 0}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Average Monthly Sales</span>
                    <span className="font-bold">
                      ₱{seasonalTrends.dry?.averageMonthlySales?.toLocaleString() || 0}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Sales Trend</span>
                    <Badge className="bg-green-100 text-green-700">
                      {seasonalTrends.dry?.trend || "N/A"}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* ── High Demand Products ── */}
          {highDemand && (
            <Card className="shadow-lg border-0">
              <CardHeader className="border-b bg-gray-50">
                <CardTitle className="flex items-center gap-2 text-xl">
                  <Target className="w-5 h-5 text-green-700" />
                  High Demand Products
                </CardTitle>
                <CardDescription>
                  Top-performing categories for each season
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <Tabs defaultValue="dry" className="w-full">
                  <TabsList className="grid w-full max-w-sm grid-cols-2 mb-6">
                    <TabsTrigger value="dry">🌞 Dry Season</TabsTrigger>
                    <TabsTrigger value="rainy">🌧 Rainy Season</TabsTrigger>
                  </TabsList>
                  {["dry", "rainy"].map((season) => (
                    <TabsContent key={season} value={season}>
                      <Card className="shadow-sm border">
                        <CardHeader>
                          <div className="flex justify-between items-center">
                            <div>
                              <CardTitle className="text-lg">
                                {season === "dry" ? "Dry Season" : "Rainy Season"}
                              </CardTitle>
                              <CardDescription>
                                {season === "dry" ? "November – May" : "June – October"}
                              </CardDescription>
                            </div>
                            <Badge
                              className={
                                season === "dry"
                                  ? "bg-green-700 text-white"
                                  : "bg-blue-600 text-white"
                              }
                            >
                              {(highDemand[season] || []).length} Categories
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="w-20">Rank</TableHead>
                                <TableHead>Category</TableHead>
                                <TableHead>Units</TableHead>
                                <TableHead>Revenue</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {(highDemand[season] || []).map((product: any, index: number) => (
                                <TableRow key={index} className="hover:bg-gray-50 transition-colors">
                                  <TableCell>
                                    <Badge
                                      className={
                                        season === "dry"
                                          ? "bg-green-700"
                                          : "bg-blue-600"
                                      }
                                    >
                                      #{index + 1}
                                    </Badge>
                                  </TableCell>
                                  <TableCell>
                                    <p className="font-semibold">{product.name}</p>
                                  </TableCell>
                                  <TableCell className="font-medium">
                                    {product.units?.toLocaleString() || 0}
                                  </TableCell>
                                  <TableCell className="font-bold">
                                    ₱{product.revenue?.toLocaleString() || 0}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </CardContent>
                      </Card>
                    </TabsContent>
                  ))}
                </Tabs>
              </CardContent>
            </Card>
          )}

          {/* ── Business Analytics ── */}
          {stockRecs.length > 0 && (
            <Card className="shadow-lg border-0 overflow-hidden">
              <div className="bg-gradient-to-r from-green-700 to-green-600 px-6 py-4">
                <div className="flex items-center gap-3">
                  <Lightbulb className="w-5 h-5 text-white" />
                  <div>
                    <h3 className="text-lg font-bold text-white">AI Business Analytics</h3>
                    <p className="text-green-100 text-sm">Inventory recommendations from seasonal analysis</p>
                  </div>
                </div>
              </div>

              <CardContent className="pt-4 px-6 pb-6">
                {(() => {
                  // Group categories by action
                  const groupedByAction = stockRecs.reduce((acc: any, category: any) => {
                    const action = category.items?.[0]?.action || 'Maintain';
                    if (!acc[action]) acc[action] = [];
                    acc[action].push(category);
                    return acc;
                  }, {});

                  // Define action order and colors
                  const actionOrder = ['Increase', 'Maintain'];
                  const actionColors: Record<string, string> = {
                    'Increase': 'border-red-500 bg-red-50/30',
                    'Maintain': 'border-green-500 bg-green-50/30'
                  };
                  const actionDotColors: Record<string, string> = {
                    'Increase': 'bg-red-500',
                    'Maintain': 'bg-green-500'
                  };
                  const actionBadgeColors: Record<string, string> = {
                    'Increase': 'bg-red-100 text-red-700',
                    'Maintain': 'bg-green-100 text-green-700'
                  };

                  return (
                    <div className="space-y-6">
                      {actionOrder.filter(action => groupedByAction[action]).map((action) => (
                        <div key={action} className={`border-l-4 ${actionColors[action]} rounded-r-lg p-4`}>
                          {/* Action Header with Legend */}
                          <div className="flex items-center gap-3 mb-4 pb-3 border-b border-gray-200">
                            <span className={`w-3 h-3 rounded-full ${actionDotColors[action]}`}></span>
                            <h4 className="text-sm font-semibold text-gray-700">{action} Stock</h4>
                            <Badge className={`${actionBadgeColors[action]} text-xs`}>
                              {groupedByAction[action].length} categories
                            </Badge>
                          </div>

                          {/* Combined Table for all categories in this action group */}
                          <div className="overflow-x-auto">
                            <Table>
                              <TableHeader>
                                <TableRow className="bg-gray-50/50">
                                  <TableHead className="text-xs font-semibold text-gray-700">Category</TableHead>
                                  <TableHead className="text-xs font-semibold text-gray-700">Product</TableHead>
                                  <TableHead className="text-xs font-semibold text-gray-700 text-center">Current</TableHead>
                                  <TableHead className="text-xs font-semibold text-gray-700 text-center">Recommended</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {groupedByAction[action].map((category: any, idx: number) => (
                                  category.items?.map((item: any, i: number) => (
                                    <TableRow key={`${idx}-${i}`} className="hover:bg-gray-50/50 transition-colors">
                                      <TableCell>
                                        <p className="font-medium text-gray-800 text-sm">
                                          {i === 0 ? category.category : ''}
                                        </p>
                                      </TableCell>
                                      <TableCell>
                                        <p className="font-medium text-gray-800 text-sm">{item.name}</p>
                                      </TableCell>
                                      <TableCell className="text-center text-sm">
                                        {item.currentStock}
                                      </TableCell>
                                      <TableCell className="text-center text-sm font-bold text-green-700">
                                        {item.recommendedStock}
                                      </TableCell>
                                    </TableRow>
                                  ))
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        </div>
                      ))}

                      {/* Legend */}
                      <div className="mt-2 pt-3 border-t border-gray-200">
                        <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500">
                          <span className="flex items-center gap-1.5">
                            <span className="w-3 h-3 rounded-full bg-red-500"></span>
                            Increase Stock
                          </span>
                          <span className="flex items-center gap-1.5">
                            <span className="w-3 h-3 rounded-full bg-green-500"></span>
                            Maintain Stock
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          )}

          {/* ── Product Performance Analysis ── */}
          {(bestSelling.length > 0 || slowMoving.length > 0) && (
            <section className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-green-100 to-green-200 flex items-center justify-center shadow-sm">
                  <Target className="size-5 text-[#1a4d2e]" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900 tracking-tight">Product Performance</h2>
                  <p className="text-sm text-gray-500">Best and slowest moving products analysis</p>
                </div>
              </div>
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {/* Best Selling */}
                {bestSelling.length > 0 && (
                  <Card className="shadow-lg border-0 hover:shadow-xl transition-all duration-300">
                    <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50 border-b border-green-100 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-green-600 flex items-center justify-center">
                          <TrendingUp className="size-4 text-white" />
                        </div>
                        <div>
                          <CardTitle className="text-sm font-semibold text-green-800">
                            Best-Selling Products
                          </CardTitle>
                          <CardDescription className="text-xs text-green-600">
                            Top performers by units sold
                          </CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3 pt-4">
                      {bestSelling.map((product: any, index: number) => (
                        <div key={index} className="border rounded-lg p-3 hover:shadow-md transition">
                          <div className="flex justify-between items-center">
                            <div>
                              <h4 className="font-semibold text-gray-800 text-sm">{product.name}</h4>
                              <p className="text-xs text-gray-500">
                                {product.unitsSold?.toLocaleString() || 0} units
                              </p>
                            </div>
                            <Badge className="bg-green-100 text-green-700 text-xs">{product.growth || "N/A"}</Badge>
                          </div>
                          <div className="w-full h-1.5 rounded-full bg-gray-200 overflow-hidden mt-2">
                            <div
                              className="h-full bg-green-600 rounded-full"
                              style={{
                                width: `${Math.min(
                                  ((product.unitsSold || 0) /
                                    Math.max(...bestSelling.map((p: any) => p.unitsSold || 1))) *
                                    100,
                                  100
                                )}%`,
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}

                {/* Slow Moving */}
                {slowMoving.length > 0 && (
                  <Card className="shadow-lg border-0 hover:shadow-xl transition-all duration-300">
                    <CardHeader className="bg-gradient-to-r from-orange-50 to-amber-50 border-b border-orange-100 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-orange-500 flex items-center justify-center">
                          <TrendingDown className="size-4 text-white" />
                        </div>
                        <div>
                          <CardTitle className="text-sm font-semibold text-orange-800">
                            Slow-Moving Products
                          </CardTitle>
                          <CardDescription className="text-xs text-orange-600">
                            Products requiring attention
                          </CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3 pt-4">
                      {slowMoving.map((product: any, index: number) => (
                        <div key={index} className="border rounded-lg p-3 hover:shadow-md transition">
                          <div className="flex flex-col gap-2">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <h4 className="font-semibold text-gray-800 text-sm break-words">
                                  {product.name}
                                </h4>
                                <p className="text-xs text-gray-500 mt-0.5">
                                  {product.unitsSold?.toLocaleString() || 0} units sold
                                </p>
                              </div>
                              <AlertCircle className="size-4 text-orange-500 flex-shrink-0 mt-0.5" />
                            </div>
                            <div className="w-full">
                              <Badge 
                                variant="secondary" 
                                className="bg-orange-100 text-orange-700 text-xs font-medium px-3 py-1.5 h-auto whitespace-normal break-words"
                              >
                                {(() => {
                                  const rec = product.recommendation || "Review needed";
                                  if (rec.toLowerCase().includes('bundl')) return 'Bundle or discount';
                                  if (rec.toLowerCase().includes('price')) return 'Review pricing';
                                  if (rec.toLowerCase().includes('promot')) return 'Run promotions';
                                  if (rec.toLowerCase().includes('delist')) return 'Consider delisting';
                                  return rec.length > 30 ? rec.substring(0, 30) + '...' : rec;
                                })()}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}
              </div>
            </section>
          )}

          {/* ── Marketing Strategy Recommendations ── */}
          {marketing.length > 0 && (
            <section className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-yellow-100 to-amber-200 flex items-center justify-center shadow-sm">
                  <Lightbulb className="size-5 text-yellow-700" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900 tracking-tight">Marketing Strategies</h2>
                  <p className="text-sm text-gray-500">AI-generated promotional strategies for each season</p>
                </div>
              </div>
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {marketing.map((strategy: any, index: number) => {
                  const drySeason = (strategy.season || "").toLowerCase().includes("dry");
                  return (
                    <Card key={index} className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden">
                      <div className={`${drySeason ? "bg-gradient-to-r from-green-600 to-emerald-600" : "bg-gradient-to-r from-blue-600 to-cyan-600"} px-4 py-3`}>
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center backdrop-blur-sm">
                            <Lightbulb className={`size-4 text-white`} />
                          </div>
                          <div>
                            <h3 className="text-sm font-semibold text-white">
                              {strategy.season}
                            </h3>
                            <p className="text-xs text-white/70">
                              {drySeason ? "November – May" : "June – October"}
                            </p>
                          </div>
                          <Badge className={`ml-auto ${drySeason ? "bg-white/20 text-white" : "bg-white/20 text-white"} border-0`}>
                            {(strategy.strategies || []).length} strategies
                          </Badge>
                        </div>
                      </div>

                      <CardContent className="pt-4 px-4 pb-4">
                        <div className="grid gap-2.5">
                          {(strategy.strategies || []).map((item: string, i: number) => (
                            <div key={i} className="flex gap-3 rounded-xl border border-gray-100 bg-white p-3 hover:shadow-md transition-all hover:border-gray-200">
                              <div className={`flex h-7 w-7 items-center justify-center rounded-full flex-shrink-0 ${drySeason ? "bg-green-100" : "bg-blue-100"}`}>
                                <CheckCircle2 className={`size-4 ${drySeason ? "text-green-600" : "text-blue-600"}`} />
                              </div>
                              <div className="flex-1">
                                <p className="text-sm font-medium text-gray-700">Strategy {i + 1}</p>
                                <p className="text-sm leading-relaxed text-gray-600 break-words mt-0.5">{item}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                        {strategy.targetCategories && strategy.targetCategories.length > 0 && (
                          <div className="mt-3 pt-2 border-t border-gray-100">
                            <p className="text-xs text-gray-500">
                              <span className="font-medium">Target Categories:</span> {strategy.targetCategories.join(', ')}
                            </p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      )}

      {/* ============================================================
          CACHE STATUS BAR
          ============================================================ */}
      {forecastStatus === "success" && lastGenerated && (
        <div className="fixed bottom-0 left-0 right-0 bg-green-50 border-t border-green-200 px-4 py-2 shadow-lg z-50">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs text-green-700">
              <Database className="size-3.5 flex-shrink-0" />
              <span className="text-center sm:text-left">
                Cached • Generated: {lastGenerated}
              </span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={generateForecast}
                className="flex items-center gap-1 px-2.5 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 transition whitespace-nowrap"
              >
                <RefreshCw className="size-3" />
                Regenerate
              </button>
              <button
                onClick={clearCache}
                className="flex items-center gap-1 px-2.5 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600 transition whitespace-nowrap"
              >
                Clear Cache
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes slideIn {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        
        .animate-slide-in {
          animation: slideIn 0.3s ease-out forwards;
        }
      `}</style>
    </div>
  );
}