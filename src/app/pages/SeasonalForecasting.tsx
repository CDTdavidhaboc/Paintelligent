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
  CheckCircle2,
  Target,
  Lightbulb,
  Loader2,
  Sparkles,
  Database,
  RefreshCw,
  FileSpreadsheet,
  X,
  File,
  Save,
  Cloud,
  CloudOff,
  AlertTriangle,
  CloudRain,
  Paintbrush,
  Sun,
  ShoppingBag,
  Zap,
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
  product?: string;
  brand?: string;
}

interface ProductDetail {
  product: string;
  brand: string;
  totalSales: number;
  totalUnits: number;
  months: number;
  drySales: number;
  rainySales: number;
  dryUnits: number;
  rainyUnits: number;
  dryMonths: number;
  rainyMonths: number;
  avgMonthlySales: number;
  bestSeason: string;
}

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

const SEASON_FOR_MONTH = (monthIndex: number): string => {
  // Philippine seasons: Dry (Nov-May), Rainy (Jun-Oct)
  if (monthIndex >= 10 || monthIndex <= 3) {
    return "Dry";
  } else {
    return "Rainy";
  }
};

const getMonthIndexFromName = (monthName: string): number => {
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                     'July', 'August', 'September', 'October', 'November', 'December'];
  const shortNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                     'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  
  const trimmed = monthName.trim();
  
  const fullIndex = monthNames.findIndex(m => m.toLowerCase() === trimmed.toLowerCase());
  if (fullIndex !== -1) return fullIndex;
  
  const shortIndex = shortNames.findIndex(m => m.toLowerCase() === trimmed.toLowerCase());
  if (shortIndex !== -1) return shortIndex;
  
  return -1;
};

const REQUIRED_HEADERS = ['Date', 'Brand', 'Product', 'Total Sales (PHP)', 'Units Sold', 'Season'];

const showNotification = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
  const colors = {
    success: 'bg-green-900 border-green-400/30',
    error: 'bg-red-600 border-red-400/30',
    info: 'bg-emerald-700 border-emerald-400/30'
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

export default function SeasonalForecasting() {
  const { userEmail } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState<"idle" | "syncing" | "success" | "error">("idle");
  const [syncMessage, setSyncMessage] = useState("");

  const [uploadedData, setUploadedData] = useState<any[] | null>(null);
  const [uploadedDataName, setUploadedDataName] = useState("");
  const [uploadError, setUploadError] = useState("");
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [isDataSaved, setIsDataSaved] = useState(false);
  const csvInputRef = useRef<HTMLInputElement | null>(null);

  const [salesData, setSalesData] = useState<SalesRecord[]>([]);
  const [originalData, setOriginalData] = useState<SalesRecord[]>([]);
  const [productDetails, setProductDetails] = useState<ProductDetail[]>([]);
  const [debugInfo, setDebugInfo] = useState<string>("");

  const [forecastData, setForecastData] = useState<any>(null);
  const [forecastStatus, setForecastStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [lastGenerated, setLastGenerated] = useState<string | null>(null);

  const [viewMode, setViewMode] = useState("monthly");
  const [selectedMonth, setSelectedMonth] = useState("");
  const [timeFilter, setTimeFilter] = useState("all");
  const [chartKey, setChartKey] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [showRemoveDialog, setShowRemoveDialog] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<string>("");
  const [productFilter, setProductFilter] = useState<string>("all");

  const CACHE_KEY = 'sales_forecast_data';
  const CACHE_TIMESTAMP_KEY = 'sales_forecast_timestamp';
  const CACHE_DATA_COUNT_KEY = 'sales_forecast_data_count';

  const computedSeasonalData = useMemo(() => {
    if (!salesData.length) return null;

    const dryData = salesData.filter(r => r.season === "Dry");
    const rainyData = salesData.filter(r => r.season === "Rainy");
    const dryTotal = dryData.reduce((sum, r) => sum + r.sales, 0);
    const rainyTotal = rainyData.reduce((sum, r) => sum + r.sales, 0);
    const dryAvg = dryData.length ? dryTotal / dryData.length : 0;
    const rainyAvg = rainyData.length ? rainyTotal / rainyData.length : 0;

    return {
      dry: {
        totalSales: dryTotal,
        averageMonthlySales: Math.round(dryAvg),
        trend: dryAvg > rainyAvg ? 'increasing' : 'decreasing',
        monthCount: dryData.length
      },
      rainy: {
        totalSales: rainyTotal,
        averageMonthlySales: Math.round(rainyAvg),
        trend: rainyAvg > dryAvg ? 'increasing' : 'decreasing',
        monthCount: rainyData.length
      }
    };
  }, [salesData]);

  // Compute product-level details
  const computedProductDetails = useMemo(() => {
    if (!originalData.length) return [];

    const productMap = new Map<string, ProductDetail>();

    originalData.forEach(record => {
      const key = `${record.brand || ''}-${record.product || ''}`;
      const isDry = record.season === "Dry";
      
      if (!productMap.has(key)) {
        productMap.set(key, {
          product: record.product || 'Unknown',
          brand: record.brand || 'Unknown',
          totalSales: 0,
          totalUnits: 0,
          months: 0,
          drySales: 0,
          rainySales: 0,
          dryUnits: 0,
          rainyUnits: 0,
          dryMonths: 0,
          rainyMonths: 0,
          avgMonthlySales: 0,
          bestSeason: 'Dry'
        });
      }

      const detail = productMap.get(key)!;
      detail.totalSales += record.sales;
      detail.totalUnits += record.unitsSold || 0;
      detail.months += 1;

      if (isDry) {
        detail.drySales += record.sales;
        detail.dryUnits += record.unitsSold || 0;
        detail.dryMonths += 1;
      } else {
        detail.rainySales += record.sales;
        detail.rainyUnits += record.unitsSold || 0;
        detail.rainyMonths += 1;
      }
    });

    // Calculate averages and determine best season
    const products = Array.from(productMap.values()).map(p => {
      const avgMonthly = p.totalSales / p.months;
      const dryAvg = p.dryMonths > 0 ? p.drySales / p.dryMonths : 0;
      const rainyAvg = p.rainyMonths > 0 ? p.rainySales / p.rainyMonths : 0;
      
      return {
        ...p,
        avgMonthlySales: Math.round(avgMonthly),
        bestSeason: dryAvg >= rainyAvg ? 'Dry' : 'Rainy'
      };
    });

    return products.sort((a, b) => b.totalSales - a.totalSales);
  }, [originalData]);

  const computedHighDemand = useMemo(() => {
    if (!productDetails.length) return null;

    const dryProducts = productDetails
      .filter(p => p.drySales > 0)
      .sort((a, b) => b.drySales - a.drySales)
      .slice(0, 5)
      .map(p => ({
        name: p.product,
        brand: p.brand,
        units: Math.round(p.dryUnits / (p.dryMonths || 1)) || 0,
        revenue: Math.round(p.drySales) || 0,
        totalRevenue: Math.round(p.drySales) || 0
      }));

    const rainyProducts = productDetails
      .filter(p => p.rainySales > 0)
      .sort((a, b) => b.rainySales - a.rainySales)
      .slice(0, 5)
      .map(p => ({
        name: p.product,
        brand: p.brand,
        units: Math.round(p.rainyUnits / (p.rainyMonths || 1)) || 0,
        revenue: Math.round(p.rainySales) || 0,
        totalRevenue: Math.round(p.rainySales) || 0
      }));

    return {
      dry: dryProducts,
      rainy: rainyProducts
    };
  }, [productDetails]);

  const uniqueProducts = useMemo(() => {
    return [...new Set(productDetails.map(p => p.product))].sort();
  }, [productDetails]);

  const uniqueBrands = useMemo(() => {
    return [...new Set(productDetails.map(p => p.brand))].sort();
  }, [productDetails]);

  useEffect(() => {
    const loadData = async () => {
      if (!userEmail) {
        setIsLoading(false);
        return;
      }

      try {
        const data = await getSalesForecastData(userEmail);
        
        if (data) {
          if (data.sales_data) {
            setUploadedData(data.sales_data);
            setUploadedDataName(data.sales_data_name || "");
            setIsDataSaved(true);
            processUploadedData(data.sales_data);
          }
          
          if (data.forecast_data) {
            setForecastData(data.forecast_data);
            setForecastStatus("success");
          }
          
          if (data.last_fetched) {
            setLastGenerated(new Date(data.last_fetched).toLocaleString());
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
      if (userEmail && (uploadedData || forecastData)) {
        saveToCloud();
      }
    }, 2000);

    return () => clearTimeout(timeoutId);
  }, [userEmail, uploadedData, uploadedDataName, forecastData, lastGenerated]);

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

  const aggregateSalesData = (data: SalesRecord[]) => {
    const grouped = data.reduce((acc, item) => {
      const key = `${item.month}-${item.year}`;
      if (acc[key]) {
        acc[key].sales += item.sales;
        if (item.unitsSold) {
          acc[key].unitsSold = (acc[key].unitsSold || 0) + item.unitsSold;
        }
      } else {
        acc[key] = { 
          ...item,
          season: item.season
        };
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
      console.log("========== DATA PROCESSING START ==========");
      console.log("Total rows:", data.length);
      console.log("First row raw data:", data[0]);
      console.log("All headers:", Object.keys(data[0] || {}));
      
      const headers = Object.keys(data[0] || {});
      const validation = validateHeaders(headers);
      if (!validation.valid) {
        setUploadError(`Missing required headers: ${validation.missing.join(', ')}. Required: ${REQUIRED_HEADERS.join(', ')}`);
        showNotification(`Missing required headers: ${validation.missing.join(', ')}`, "error");
        return;
      }
      
      const formattedData: SalesRecord[] = data.map((row: any, index: number) => {
        let month = "";
        let year = new Date().getFullYear();
        let monthIndex = -1;
        
        const dateValue = row.Date || row["Date"] || "";
        
        if (dateValue) {
          const dateStr = String(dateValue).trim();
          let parsedDate: Date | null = null;
          
          // Try parsing as DD/MM/YYYY format (your CSV format)
          const parts = dateStr.split(/[\/\-.]/);
          if (parts.length === 3) {
            // Try DD/MM/YYYY (day first - your format)
            let day = parseInt(parts[0]);
            let month = parseInt(parts[1]) - 1;
            let yearVal = parseInt(parts[2]);
            
            // Check if it's valid DD/MM/YYYY
            if (day >= 1 && day <= 31 && month >= 0 && month <= 11 && yearVal > 0) {
              const d = new Date(yearVal, month, day);
              if (!isNaN(d.getTime())) {
                parsedDate = d;
              }
            }
            
            // If DD/MM/YYYY failed, try MM/DD/YYYY
            if (!parsedDate) {
              let month = parseInt(parts[0]) - 1;
              let day = parseInt(parts[1]);
              let yearVal = parseInt(parts[2]);
              if (day >= 1 && day <= 31 && month >= 0 && month <= 11 && yearVal > 0) {
                const d = new Date(yearVal, month, day);
                if (!isNaN(d.getTime())) {
                  parsedDate = d;
                }
              }
            }
          }
          
          // Try parsing with Date constructor as fallback
          if (!parsedDate) {
            const d = new Date(dateStr);
            if (!isNaN(d.getTime())) {
              parsedDate = d;
            }
          }
          
          // Try extracting month and year from string if Date parsing failed
          if (!parsedDate) {
            const monthMatch = dateStr.match(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|January|February|March|April|May|June|July|August|September|October|November|December)/i);
            if (monthMatch) {
              const monthIdx = getMonthIndexFromName(monthMatch[0]);
              if (monthIdx !== -1) {
                monthIndex = monthIdx;
                month = new Date(2000, monthIdx, 1).toLocaleString("en-US", { month: "long" });
                
                const yearMatch = dateStr.match(/\b(20\d{2}|19\d{2})\b/);
                if (yearMatch) {
                  year = parseInt(yearMatch[0]);
                }
              }
            }
          }
          
          if (parsedDate) {
            monthIndex = parsedDate.getMonth();
            month = parsedDate.toLocaleString("en-US", { month: "long" });
            year = parsedDate.getFullYear();
          }
        }
        
        if (monthIndex === -1) {
          const monthValue = row.Month || row["Month"] || "";
          if (monthValue) {
            const monthIdx = getMonthIndexFromName(String(monthValue));
            if (monthIdx !== -1) {
              monthIndex = monthIdx;
              month = new Date(2000, monthIdx, 1).toLocaleString("en-US", { month: "long" });
              
              if (row.Year) {
                year = parseInt(row.Year) || year;
              }
            }
          }
        }
        
        if (monthIndex === -1) {
          const now = new Date();
          monthIndex = now.getMonth();
          month = now.toLocaleString("en-US", { month: "long" });
          year = now.getFullYear();
        }
        
        const brand = row.Brand || row["Brand"] || "";
        const product = row.Product || row["Product"] || "";
        const sales = Number(row["Total Sales (PHP)"] || row["Total Sales"] || row["sales"] || 0);
        const unitsSold = Number(row["Units Sold"] || row["unitsSold"] || 0);
        
        // IMPORTANT: Use the Season from the CSV directly
        const seasonFromCSV = row.Season || row["Season"] || "";
        let season = seasonFromCSV;
        
        // If Season column is missing or empty, fallback to calculation based on month
        if (!season) {
          season = SEASON_FOR_MONTH(monthIndex);
        }
        
        // Debug: Log the first few records to verify
        if (index < 10) {
          console.log(`Record ${index}: Date=${dateValue}, Month=${month}, Year=${year}, Season from CSV=${seasonFromCSV}, Final Season=${season}`);
        }
        
        return {
          id: String(index + 1),
          month: month,
          year: year,
          season: season,
          sales: sales,
          category: product || brand || "Unknown",
          product: product,
          brand: brand,
          unitsSold: unitsSold,
        };
      });
      
      // Log season distribution to verify
      const seasonDist = formattedData.reduce((acc, r) => {
        acc[r.season] = (acc[r.season] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      const monthDist = formattedData.reduce((acc, r) => {
        const key = `${r.month} ${r.year}`;
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      console.log("========== RESULTS ==========");
      console.log("Total records:", formattedData.length);
      console.log("Season distribution from CSV:", seasonDist);
      console.log("Month distribution:", monthDist);
      console.log("Unique months:", Object.keys(monthDist).sort());
      console.log("Unique products:", [...new Set(formattedData.map(r => r.product))].length);
      console.log("==============================");
      
      setOriginalData(formattedData);
      
      // Compute product details
      const productMap = new Map<string, ProductDetail>();
      formattedData.forEach(record => {
        const key = `${record.brand || ''}-${record.product || ''}`;
        const isDry = record.season === "Dry";
        
        if (!productMap.has(key)) {
          productMap.set(key, {
            product: record.product || 'Unknown',
            brand: record.brand || 'Unknown',
            totalSales: 0,
            totalUnits: 0,
            months: 0,
            drySales: 0,
            rainySales: 0,
            dryUnits: 0,
            rainyUnits: 0,
            dryMonths: 0,
            rainyMonths: 0,
            avgMonthlySales: 0,
            bestSeason: 'Dry'
          });
        }

        const detail = productMap.get(key)!;
        detail.totalSales += record.sales;
        detail.totalUnits += record.unitsSold || 0;
        detail.months += 1;

        if (isDry) {
          detail.drySales += record.sales;
          detail.dryUnits += record.unitsSold || 0;
          detail.dryMonths += 1;
        } else {
          detail.rainySales += record.sales;
          detail.rainyUnits += record.unitsSold || 0;
          detail.rainyMonths += 1;
        }
      });

      const products = Array.from(productMap.values()).map(p => {
        const avgMonthly = p.totalSales / p.months;
        const dryAvg = p.dryMonths > 0 ? p.drySales / p.dryMonths : 0;
        const rainyAvg = p.rainyMonths > 0 ? p.rainySales / p.rainyMonths : 0;
        
        return {
          ...p,
          avgMonthlySales: Math.round(avgMonthly),
          bestSeason: dryAvg >= rainyAvg ? 'Dry' : 'Rainy'
        };
      }).sort((a, b) => b.totalSales - a.totalSales);

      setProductDetails(products);
      
      const aggregated = aggregateSalesData(formattedData);
      console.log("Aggregated data:", aggregated);
      console.log("Aggregated season distribution:", 
        aggregated.reduce((acc, r) => {
          acc[r.season] = (acc[r.season] || 0) + 1;
          return acc;
        }, {} as Record<string, number>)
      );
      
      setSalesData(aggregated);

      setForecastData(null);
      setForecastStatus("idle");
      setLastGenerated(null);
      
      localStorage.removeItem(CACHE_KEY);
      localStorage.removeItem(CACHE_TIMESTAMP_KEY);
      localStorage.removeItem(CACHE_DATA_COUNT_KEY);
      
      setUploadError("");
      
      const dryCount = seasonDist["Dry"] || 0;
      const rainyCount = seasonDist["Rainy"] || 0;
      const productCount = products.length;
      
     
      
    } catch (error) {
      console.error("Error processing uploaded data:", error);
      setUploadError("Failed to process data. Please check the file format.");
      showNotification("Failed to process data. Please check the file format.", "error");
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
      showNotification("✅ Data saved successfully! Seasonal analysis is now available.", "success");
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
    setSalesData([]);
    setOriginalData([]);
    setProductDetails([]);
    setForecastData(null);
    setForecastStatus("idle");
    setLastGenerated(null);
    if (csvInputRef.current) csvInputRef.current.value = "";
    
    localStorage.removeItem(CACHE_KEY);
    localStorage.removeItem(CACHE_TIMESTAMP_KEY);
    localStorage.removeItem(CACHE_DATA_COUNT_KEY);
    
    clearSupabaseData();
    showNotification("🗑️ Data cleared successfully", "info");
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
        showNotification("✅ Data cleared from cloud", "success");
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
            showNotification("CSV file appears empty or invalid.", "error");
            return;
          }

          const headers = Object.keys(data[0] || {});
          const validation = validateHeaders(headers);
          if (!validation.valid) {
            setUploadError(`Missing required headers: ${validation.missing.join(', ')}. Required: ${REQUIRED_HEADERS.join(', ')}`);
            showNotification(`Missing required headers: ${validation.missing.join(', ')}`, "error");
            return;
          }

          setUploadedData(data);
          setUploadedDataName(file.name);
          processUploadedData(data);
          setUploadError("");
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

        const headers = Object.keys(jsonData[0] || {});
        const validation = validateHeaders(headers);
        if (!validation.valid) {
          setUploadError(`Missing required headers: ${validation.missing.join(', ')}. Required: ${REQUIRED_HEADERS.join(', ')}`);
          showNotification(`Missing required headers: ${validation.missing.join(', ')}`, "error");
          return;
        }

        setUploadedData(jsonData);
        setUploadedDataName(file.name);
        processUploadedData(jsonData);
        setUploadError("");
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
    setSalesData([]);
    setOriginalData([]);
    setProductDetails([]);
    setForecastData(null);
    setForecastStatus("idle");
    setLastGenerated(null);
    if (csvInputRef.current) csvInputRef.current.value = "";
    
    localStorage.removeItem(CACHE_KEY);
    localStorage.removeItem(CACHE_TIMESTAMP_KEY);
    localStorage.removeItem(CACHE_DATA_COUNT_KEY);
    
    clearSupabaseData();
  };

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
  // AUTOREGRESSIVE (AR) FORECASTING MODEL
  // ============================================================
  
  /**
   * Calculates Autoregressive coefficients using the Yule-Walker method
   * For a simple AR(2) model: y_t = c + φ₁*y_{t-1} + φ₂*y_{t-2} + ε_t
   */
  const calculateARcoefficients = (data: number[]): { phi1: number; phi2: number; c: number } => {
    const n = data.length;
    
    if (n < 4) {
      // Not enough data for AR(2), fall back to simpler model
      return { phi1: 0.5, phi2: 0.3, c: 0 };
    }
    
    // Calculate autocorrelations
    const mean = data.reduce((sum, val) => sum + val, 0) / n;
    const centered = data.map(val => val - mean);
    
    // Calculate autocovariances
    let gamma0 = 0;
    let gamma1 = 0;
    let gamma2 = 0;
    
    for (let i = 0; i < n; i++) {
      gamma0 += centered[i] * centered[i];
      if (i < n - 1) gamma1 += centered[i] * centered[i + 1];
      if (i < n - 2) gamma2 += centered[i] * centered[i + 2];
    }
    
    gamma0 /= n;
    gamma1 /= (n - 1);
    gamma2 /= (n - 2);
    
    // Solve Yule-Walker equations for AR(2)
    // [gamma0  gamma1] [phi1] = [gamma1]
    // [gamma1  gamma0] [phi2]   [gamma2]
    const denom = gamma0 * gamma0 - gamma1 * gamma1;
    
    let phi1 = 0;
    let phi2 = 0;
    
    if (Math.abs(denom) > 1e-10) {
      phi1 = (gamma1 * gamma0 - gamma2 * gamma1) / denom;
      phi2 = (gamma2 * gamma0 - gamma1 * gamma1) / denom;
    }
    
    // Ensure stationarity: |φ₁| < 1 and |φ₂| < 1 and φ₁ + φ₂ < 1
    const maxPhi = 0.9;
    phi1 = Math.max(-maxPhi, Math.min(maxPhi, phi1));
    phi2 = Math.max(-maxPhi, Math.min(maxPhi, phi2));
    
    // Calculate constant term c = μ * (1 - φ₁ - φ₂)
    const c = mean * (1 - phi1 - phi2);
    
    return { phi1, phi2, c };
  };

  /**
   * Generates forecast using AR(2) model with confidence intervals
   * Predicts exactly 3 months ahead
   */
  const calculateARForecast = (historicalData: SalesRecord[]): any[] => {
    if (historicalData.length < 3) {
      // Not enough data for AR model
      console.warn("Not enough data for AR model, using simple average");
      const avg = historicalData.reduce((sum, r) => sum + r.sales, 0) / historicalData.length;
      return Array(3).fill(null).map((_, i) => ({
        month: `Month ${i + 1}`,
        sales: Math.round(avg),
        season: "Dry",
        upperBound: Math.round(avg * 1.15),
        lowerBound: Math.round(avg * 0.85)
      }));
    }

    // Sort data chronologically
    const sorted = [...historicalData].sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      return MONTH_NAMES.indexOf(a.month.substring(0, 3)) - MONTH_NAMES.indexOf(b.month.substring(0, 3));
    });

    // Extract sales values
    const salesValues = sorted.map(r => r.sales);
    const n = salesValues.length;

    // Calculate AR coefficients
    const { phi1, phi2, c } = calculateARcoefficients(salesValues);
    
    console.log(`AR(2) Coefficients: φ₁=${phi1.toFixed(3)}, φ₂=${phi2.toFixed(3)}, c=${c.toFixed(2)}`);

    // Get the last two values for forecasting
    const lastValue = salesValues[n - 1];
    const secondLastValue = salesValues[n - 2];

    // Calculate residual standard error for confidence intervals
    let residuals: number[] = [];
    for (let t = 2; t < n; t++) {
      const predicted = c + phi1 * salesValues[t - 1] + phi2 * salesValues[t - 2];
      residuals.push(salesValues[t] - predicted);
    }
    
    const residualStd = residuals.length > 0 
      ? Math.sqrt(residuals.reduce((sum, r) => sum + r * r, 0) / residuals.length)
      : Math.abs(lastValue - secondLastValue) * 0.1;

    // Generate 3-month forecast
    const forecast = [];
    const lastMonth = sorted[sorted.length - 1];
    const lastMonthIndex = MONTH_NAMES.indexOf(lastMonth.month.substring(0, 3));
    
    let prevPrev = secondLastValue;
    let prev = lastValue;

    for (let i = 1; i <= 3; i++) {
      // AR(2) prediction: y_t = c + φ₁*y_{t-1} + φ₂*y_{t-2}
      const predicted = c + phi1 * prev + phi2 * prevPrev;
      
      // Ensure non-negative
      const finalPrediction = Math.max(predicted, 100);
      
      // Calculate confidence intervals (95% confidence)
      const zScore = 1.96; // 95% confidence
      const marginOfError = zScore * residualStd * Math.sqrt(1 + phi1 * phi1 + phi2 * phi2);
      
      // Determine month and season
      const nextIndex = (lastMonthIndex + i) % 12;
      const nextYear = lastMonthIndex + i >= 12 ? lastMonth.year + 1 : lastMonth.year;
      const monthName = MONTH_NAMES[nextIndex];
      
      // Use actual season from data if available
      const existingRecord = originalData.find(r => 
        r.month.substring(0, 3) === monthName && r.year === nextYear
      );
      const season = existingRecord?.season || SEASON_FOR_MONTH(nextIndex);
      
      forecast.push({
        month: `${monthName} ${nextYear}`,
        sales: Math.round(finalPrediction),
        season: season,
        upperBound: Math.round(finalPrediction + marginOfError),
        lowerBound: Math.round(Math.max(finalPrediction - marginOfError, 0))
      });
      
      // Shift values for next iteration
      prevPrev = prev;
      prev = finalPrediction;
    }
    
    return forecast;
  };

  // Override the calculateForecast function with AR model
  const calculateForecast = (): any[] => {
    if (!salesData.length) return [];
    
    // Use AR model for forecasting
    const forecast = calculateARForecast(salesData);
    
    // Log forecast details
    console.log("=== AR(2) Forecast Results ===");
    forecast.forEach((f, i) => {
      console.log(`Month ${i+1}: ${f.month} → ₱${f.sales.toLocaleString()} (${f.season})`);
    });
    console.log("================================");
    
    return forecast;
  };

  const generateForecast = async () => {
    if (!salesData.length) {
      setUploadError("No sales data available. Please upload data first.");
      showNotification("No sales data available. Please upload data first.", "error");
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
      
      // Use AR model for forecast (3 months)
      const calculatedForecast = calculateForecast();

      // Get top products by sales
      const topProducts = productDetails.slice(0, 5);
      const slowProducts = productDetails.slice(-3);

      const prompt = `
Analyze the sales data and provide a comprehensive business analysis focusing on product performance and marketing strategies.

SALES DATA:
- Total Sales: ₱${totalSales.toLocaleString()}
- Average Monthly Sales: ₱${Math.round(avgSales).toLocaleString()}
- Records: ${salesData.length}
- Total Products: ${productDetails.length}

TOP PRODUCTS:
${topProducts.map(p => `${p.brand} ${p.product}: ₱${p.totalSales.toLocaleString()} (${p.totalUnits} units, Best: ${p.bestSeason})`).join('\n')}

SLOW PRODUCTS:
${slowProducts.map(p => `${p.brand} ${p.product}: ₱${p.totalSales.toLocaleString()} (${p.totalUnits} units, Best: ${p.bestSeason})`).join('\n')}

SEASONAL BREAKDOWN:
Dry Season: ₱${dryTotal.toLocaleString()} (${dryData.length} months, Avg: ₱${Math.round(dryAvg).toLocaleString()})
Rainy Season: ₱${rainyTotal.toLocaleString()} (${rainyData.length} months, Avg: ₱${Math.round(rainyAvg).toLocaleString()})

FORECAST (3 months - AR(2) Model):
${calculatedForecast.map((f, i) => `${f.month}: ₱${f.sales.toLocaleString()} (${f.season})`).join('\n')}

Return ONLY valid JSON with this structure:
{
  "bestSellingProducts": [
    ${topProducts.map(p => `{
      "name": "${p.brand} ${p.product}",
      "unitsSold": ${Math.round(p.totalUnits / (p.months || 1)) || 100},
      "growth": "+${Math.round((p.drySales / (p.rainySales || 1) - 1) * 100) || 5}%"
    }`).join(',')}
  ],
  "slowMovingProducts": [
    ${slowProducts.map(p => `{
      "name": "${p.brand} ${p.product}",
      "unitsSold": ${Math.round(p.totalUnits / (p.months || 1)) || 20},
      "recommendation": "${p.totalSales > totalSales / productDetails.length ? 'Review pricing and promotions' : 'Consider bundling or discounts'}"
    }`).join(',')}
  ],
  "stockRecommendations": [
    ${topProducts.slice(0, 3).map(p => `{
      "category": "${p.brand} ${p.product}",
      "items": [
        {
          "name": "${p.product}",
          "currentStock": ${Math.round(p.totalUnits / (p.months || 1) * 2) || 30},
          "recommendedStock": ${Math.round(p.totalUnits / (p.months || 1) * 3) || 50},
          "action": "${p.totalSales > totalSales / productDetails.length ? 'Increase' : 'Maintain'}"
        }
      ]
    }`).join(',')}
  ],
  "marketingStrategies": [
    {
      "season": "Dry Season",
      "targetProducts": [${topProducts.filter(p => p.bestSeason === 'Dry').slice(0, 3).map(p => `"${p.brand} ${p.product}"`).join(', ')}],
      "strategies": [
        "Launch outdoor promotions for ${topProducts.filter(p => p.bestSeason === 'Dry').slice(0, 2).map(p => p.brand + ' ' + p.product).join(' and ')}",
        "Create seasonal bundles featuring ${topProducts.filter(p => p.bestSeason === 'Dry').slice(0, 3).map(p => p.brand + ' ' + p.product).join(', ')}",
        "Run dry season discounts on ${topProducts.filter(p => p.bestSeason === 'Dry').slice(0, 1).map(p => p.brand + ' ' + p.product).join(', ')}",
        "Implement targeted campaigns for ${topProducts.filter(p => p.bestSeason === 'Dry').slice(0, 2).map(p => p.brand + ' ' + p.product).join(' & ')}",
        "Offer bundle deals: Buy 2 get 1 free on selected ${topProducts.filter(p => p.bestSeason === 'Dry').slice(0, 1).map(p => p.brand + ' ' + p.product).join(', ')}"
      ]
    },
    {
      "season": "Rainy Season",
      "targetProducts": [${topProducts.filter(p => p.bestSeason === 'Rainy').slice(0, 3).map(p => `"${p.brand} ${p.product}"`).join(', ')}],
      "strategies": [
        "Focus on indoor solutions for ${topProducts.filter(p => p.bestSeason === 'Rainy').slice(0, 2).map(p => p.brand + ' ' + p.product).join(' and ')}",
        "Launch weather-proof campaigns targeting ${topProducts.filter(p => p.bestSeason === 'Rainy').slice(0, 1).map(p => p.brand + ' ' + p.product).join(', ')}",
        "Create rainy season bundles for ${topProducts.filter(p => p.bestSeason === 'Rainy').slice(0, 3).map(p => p.brand + ' ' + p.product).join(', ')}",
        "Offer free delivery promotions for ${topProducts.filter(p => p.bestSeason === 'Rainy').slice(0, 2).map(p => p.brand + ' ' + p.product).join(' & ')}",
        "Implement loyalty programs for repeat buyers of ${topProducts.filter(p => p.bestSeason === 'Rainy').slice(0, 1).map(p => p.brand + ' ' + p.product).join(', ')}"
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

      saveToCache(result);
      setForecastData(result);
      setForecastStatus("success");
      showNotification("✅ Forecast generated successfully!", "success");

    } catch (error) {
      console.error("AI Generation Error:", error);
      setForecastStatus("error");
      showNotification("Failed to generate forecast. Please try again.", "error");
    }
  };

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
          fill: current.season === "Dry" ? "#bbf7d0" : "#dbeafe",
          stroke: current.season === "Dry" ? "#16a34a" : "#3b82f6",
        });
      }
    }
    return areas;
  }, [filteredMonthlyData, chartKey]);

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

  const bestSelling = forecastData?.bestSellingProducts ?? [];
  const slowMoving = forecastData?.slowMovingProducts ?? [];
  const stockRecs = forecastData?.stockRecommendations ?? [];
  const marketing = forecastData?.marketingStrategies ?? [];

  const availableYears = useMemo(
    () => [...new Set(salesData.map((row) => row.year))].sort(),
    [salesData]
  );

  const isDataLoaded = uploadedData !== null && uploadedData.length > 0;

  const handleRemoveWithConfirmation = () => {
    if (uploadedData) {
      setShowRemoveDialog(true);
    }
  };

  const confirmRemoveData = () => {
    handleRemoveData();
    setShowRemoveDialog(false);
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f3f7f4] p-6">
        <div className="rounded-2xl border border-emerald-100 bg-white px-10 py-8 text-center shadow-[0_18px_50px_rgba(20,83,45,0.08)]">
          <Loader2 className="mx-auto size-12 animate-spin text-[#1a4d2e]" />
          <p className="mt-4 text-sm font-medium text-slate-600">Loading sales records...</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`
        forecast-page min-h-screen space-y-5 bg-[#f3f7f4] px-4 py-5 sm:px-6 lg:px-8 lg:py-7 
        transition-all duration-700 ease-out
        ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5"}
      `}
    >
      <style>{`
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
        
        .animate-slide-up {
          animation: slideUp 0.3s ease-out forwards;
        }

        .forecast-page [data-slot="card"] {
          border-radius: 1rem;
        }

        .forecast-page select {
          border-color: rgb(167 243 208);
          background: rgb(255 255 255);
          color: rgb(20 83 45);
          outline: none;
        }

        .forecast-page select:focus {
          box-shadow: 0 0 0 3px rgb(209 250 229);
          border-color: rgb(5 150 105);
        }

        .forecast-page [data-slot="table-head"] {
          color: rgb(22 101 52);
          font-weight: 700;
        }

        .forecast-page [data-slot="table-row"]:hover {
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
              <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Product Sales Forecast</h1>
              <p className="mt-1 text-sm text-emerald-100">Analyze product performance across dry and rainy seasons.</p>
              {debugInfo && <p className="mt-2 text-xs text-emerald-200/70">{debugInfo}</p>}
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
                <CardTitle className="text-md font-medium text-white leading-none">Product Sales Data</CardTitle>
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
                  <p className="text-xs font-medium text-green-800">Required Headers (exact match):</p>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    <Badge variant="outline" className="text-xs bg-white border-green-300 text-green-700 font-mono">Date</Badge>
                    <Badge variant="outline" className="text-xs bg-white border-green-300 text-green-700 font-mono">Brand</Badge>
                    <Badge variant="outline" className="text-xs bg-white border-green-300 text-green-700 font-mono">Product</Badge>
                    <Badge variant="outline" className="text-xs bg-white border-green-300 text-green-700 font-mono">Total Sales (PHP)</Badge>
                    <Badge variant="outline" className="text-xs bg-white border-green-300 text-green-700 font-mono">Units Sold</Badge>
                    <Badge variant="outline" className="text-xs bg-white border-green-300 text-green-700 font-mono">Season</Badge>
                  </div>
                  <p className="text-[11px] text-green-600 mt-1.5">Headers are case-sensitive and must match exactly</p>
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
                      <p className="text-xs text-gray-500">{uploadedData.length} rows • {productDetails.length} products</p>
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
                        onClick={handleRemoveWithConfirmation}
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

      {showRemoveDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl animate-in slide-in-from-bottom-4 duration-300">
            <div className="flex items-start gap-4">
              <div className="flex size-12 flex-shrink-0 items-center justify-center rounded-full bg-red-100">
                <AlertTriangle className="size-6 text-red-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900">Remove Uploaded Data?</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Are you sure you want to remove this uploaded sales data? This will also clear all analysis and forecast results.
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
                onClick={confirmRemoveData}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                Yes, Remove
              </Button>
            </div>
          </div>
        </div>
      )}

      {salesData.length > 0 && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <Card className="border-0 bg-[#174d32] text-white shadow-[0_14px_30px_rgba(23,77,50,0.18)]">
              <CardContent className="py-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm opacity-80">Total Sales</p>
                    <h2 className="text-3xl font-bold mt-1">
                      ₱{totalSales.toLocaleString()}
                    </h2>
                    <p className="text-xs mt-2 opacity-70">
                      {salesData.length} records • {productDetails.length} products
                    </p>
                  </div>
                  <TrendingUp className="w-10 h-10 opacity-70" />
                </div>
              </CardContent>
            </Card>

            <Card className="border border-green-200 border-l-4 border-l-green-900 bg-green-50/60 shadow-sm">
              <CardContent className="py-6">
                <div className="flex justify-between items-center">
                  <div>
                    <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-green-700">
                      <Sun className="size-4" />
                      Dry Season
                    </div>
                    <h2 className="text-2xl font-bold text-green-700">
                      ₱{drySales.toLocaleString()}
                    </h2>
                    <p className="text-xs text-gray-500 mt-1">
                      {salesData.filter((r) => r.season === "Dry").length} Months
                    </p>
                  </div>
                  <div className="rounded-xl bg-green-100 p-3">
                    {drySales > rainySales ? (
                      <TrendingUp className="size-7 text-green-700" />
                    ) : (
                      <TrendingDown className="size-7 text-green-700" />
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border border-blue-200 border-l-4 border-l-blue-600 bg-blue-50/60 shadow-sm">
              <CardContent className="py-6">
                <div className="flex justify-between items-center">
                  <div>
                    <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-blue-800">
                      <CloudRain className="size-4" />
                      Rainy Season
                    </div>
                    <h2 className="text-2xl font-bold text-blue-700">
                      ₱{rainySales.toLocaleString()}
                    </h2>
                    <p className="text-xs text-gray-500 mt-1">
                      {salesData.filter((r) => r.season === "Rainy").length} Months
                    </p>
                  </div>
                  <div className="rounded-xl bg-blue-100 p-3">
                    {rainySales > drySales ? (
                      <TrendingUp className="size-7 text-blue-700" />
                    ) : (
                      <TrendingDown className="size-7 text-blue-500" />
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="overflow-hidden border border-emerald-100 bg-white shadow-[0_12px_32px_rgba(20,83,45,0.06)]">
            <CardHeader className="border-b border-emerald-100 bg-gradient-to-r from-white to-emerald-50/70">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div>
                  <CardTitle className="text-xl font-bold">
                    {viewMode === "monthly"
                      ? "Sales Trend Analysis (AR-2 Forecast)"
                      : `Weekly Sales Analysis • ${selectedMonth}`}
                  </CardTitle>
                  <CardDescription>
                   3-month forecast using Autoregressive (AR-2) model with 95% confidence intervals
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
                          ? "bg-green-900 text-white"
                          : "text-gray-600"
                      }`}
                    >
                      Monthly
                    </button>
                    <button
                      onClick={() => setViewMode("weekly")}
                      className={`px-4 py-2 rounded-md text-sm transition ${
                        viewMode === "weekly"
                          ? "bg-green-900 text-white"
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
                            point.isForecast ? "(AR-2 Forecast)" : "(Historical)"
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
                        dot={{ r: 6, fill: "#22C55E" }}
                        activeDot={{ r: 8 }}
                        connectNulls
                        name="AR-2 Forecast"
                      />
                      <Line
                        dataKey="upperBound"
                        stroke="#86EFAC"
                        strokeWidth={2}
                        strokeDasharray="3 3"
                        dot={false}
                        name="Upper Bound (95%)"
                      />
                      <Line
                        dataKey="lowerBound"
                        stroke="#86EFAC"
                        strokeWidth={2}
                        strokeDasharray="3 3"
                        dot={false}
                        name="Lower Bound (95%)"
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
              <div className="mt-6 flex flex-wrap items-center justify-center gap-5 rounded-xl border border-emerald-100 bg-emerald-50/50 p-4 text-sm text-slate-700">
                <div className="flex items-center gap-2">
                  <span className="h-1.5 w-8 rounded bg-green-900"></span>
                  Historical Sales
                </div>
                {forecastData && (
                  <div className="flex items-center gap-2">
                    <span className="h-1.5 w-8 border-t-2 border-dashed border-green-500"></span>
                    AR-2 Forecast (3 months)
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded bg-green-200 ring-1 ring-green-500/40"></span>
                  Dry Season
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded bg-blue-100 ring-1 ring-blue-500/40"></span>
                  Rainy Season
                </div>
              </div>
            </CardContent>
          </Card>

          {computedSeasonalData && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="border border-blue-200 border-l-4 border-l-blue-600 bg-blue-50/50 shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-blue-800">
                    <CloudRain className="w-5 h-5" />
                    Rainy Season Analysis
                  </CardTitle>
                  <CardDescription>Based on {computedSeasonalData.rainy.monthCount} months</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between">
                    <span>Total Sales</span>
                    <span className="font-bold">
                      ₱{computedSeasonalData.rainy.totalSales.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Average Monthly Sales</span>
                    <span className="font-bold">
                      ₱{computedSeasonalData.rainy.averageMonthlySales.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Sales Trend</span>
                    <Badge className="bg-blue-100 text-blue-700">
                      {computedSeasonalData.rainy.trend}
                    </Badge>
                  </div>
                </CardContent>
              </Card>

              <Card className="border border-green-200 border-l-4 border-l-green-900 bg-green-50/50 shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-green-700">
                    <Sun className="w-5 h-5" />
                    Dry Season Analysis
                  </CardTitle>
                  <CardDescription>Based on {computedSeasonalData.dry.monthCount} months</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between">
                    <span>Total Sales</span>
                    <span className="font-bold">
                      ₱{computedSeasonalData.dry.totalSales.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Average Monthly Sales</span>
                    <span className="font-bold">
                      ₱{computedSeasonalData.dry.averageMonthlySales.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Sales Trend</span>
                    <Badge className="bg-green-100 text-green-700">
                      {computedSeasonalData.dry.trend}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {computedHighDemand && (
            <Card className="overflow-hidden border border-emerald-100 bg-white shadow-[0_12px_32px_rgba(20,83,45,0.06)]">
              <CardHeader className="border-b border-emerald-100 bg-gradient-to-r from-white to-emerald-50/70">
                <CardTitle className="flex items-center gap-2 text-xl">
                  <ShoppingBag className="size-5 text-[#174d32]" />
                  Top Products Per Season
                </CardTitle>
                <CardDescription>
                  {productDetails.length} products analyzed across seasons
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="dry" className="w-full">
                  <TabsList className="grid w-full max-w-sm grid-cols-2 mb-6">
                    <TabsTrigger value="dry" className="data-[state=active]:bg-[#174d32] data-[state=active]:text-white">Dry Season</TabsTrigger>
                    <TabsTrigger value="rainy" className="data-[state=active]:bg-blue-700 data-[state=active]:text-white">Rainy Season</TabsTrigger>
                  </TabsList>
                  {["dry", "rainy"].map((season) => {
                    const products = computedHighDemand[season] || [];
                    const isDrySeason = season === "dry";
                    return (
                      <TabsContent key={season} value={season}>
                        <Card className={`border shadow-sm ${isDrySeason ? "border-green-200 bg-green-50/30" : "border-blue-200 bg-blue-50/30"}`}>
                          <CardHeader className={isDrySeason ? "border-b border-green-100" : "border-b border-blue-100"}>
                            <div className="flex justify-between items-center">
                              <div>
                                <CardTitle className={`flex items-center gap-2 text-lg ${isDrySeason ? "text-green-800" : "text-blue-800"}`}>
                                  {isDrySeason ? <Sun className="size-5" /> : <CloudRain className="size-5" />}
                                  {isDrySeason ? "Dry Season" : "Rainy Season"}
                                </CardTitle>
                                <CardDescription>
                                  {isDrySeason ? "November – May" : "June – October"}
                                </CardDescription>
                              </div>
                              <Badge
                                className={
                                  isDrySeason
                                    ? "bg-[#174d32] text-white"
                                    : "bg-blue-700 text-white"
                                }
                              >
                                {products.length} Products
                              </Badge>
                            </div>
                          </CardHeader>
                          <CardContent>
                            {products.length > 0 ? (
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead className="w-20" style={{ color: isDrySeason ? '#174d32' : '#1d4ed8' }}>Rank</TableHead>
                                    <TableHead style={{ color: isDrySeason ? '#174d32' : '#1d4ed8' }}>Brand</TableHead>
                                    <TableHead style={{ color: isDrySeason ? '#174d32' : '#1d4ed8' }}>Product</TableHead>
                                    <TableHead style={{ color: isDrySeason ? '#174d32' : '#1d4ed8' }}>Units</TableHead>
                                    <TableHead style={{ color: isDrySeason ? '#174d32' : '#1d4ed8' }}>Revenue</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {products.map((product: any, index: number) => (
                                    <TableRow key={index} className="hover:bg-gray-50 transition-colors">
                                      <TableCell>
                                        <Badge
                                          className={
                                            isDrySeason
                                              ? "bg-[#174d32]"
                                              : "bg-blue-700"
                                          }
                                        >
                                          #{index + 1}
                                        </Badge>
                                      </TableCell>
                                      <TableCell>
                                        <p className="font-semibold text-sm">{product.brand || '—'}</p>
                                      </TableCell>
                                      <TableCell>
                                        <p className="font-medium text-sm">{product.name}</p>
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
                            ) : (
                              <div className="text-center py-8 text-gray-500">
                                <p>No products found for this season.</p>
                                <p className="text-sm mt-1">Please check your data.</p>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      </TabsContent>
                    );
                  })}
                </Tabs>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {salesData.length > 0 && forecastStatus !== "success" && isDataSaved && (
        <div className="flex justify-center rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm">
          <button
            onClick={generateForecast}
            disabled={forecastStatus === "loading"}
            className="flex items-center gap-3 rounded-xl bg-[#174d32] px-6 py-3.5 text-sm font-semibold text-white shadow-[0_12px_24px_rgba(23,77,50,0.2)] transition-all hover:-translate-y-0.5 hover:bg-[#123e28] disabled:opacity-60"
          >
            {forecastStatus === "loading" ? (
              <>
                <div className="flex items-center gap-1">
                  <div className="size-1.5 rounded-full bg-emerald-300 animate-bounce" style={{ animationDelay: '0s' }} />
                  <div className="size-1.5 rounded-full bg-emerald-300 animate-bounce" style={{ animationDelay: '0.15s' }} />
                  <div className="size-1.5 rounded-full bg-emerald-300 animate-bounce" style={{ animationDelay: '0.3s' }} />
                  <div className="size-1.5 rounded-full bg-emerald-300 animate-bounce" style={{ animationDelay: '0.45s' }} />
                  <div className="size-1.5 rounded-full bg-emerald-300 animate-bounce" style={{ animationDelay: '0.6s' }} />
                </div>
                <span className="animate-text-color">
                  Generating Forecast and Recommendations...
                </span>
              </>
            ) : (
              <>
                <Zap className="size-5" />
                Generate Forecast and Recommendations
              </>
            )}
          </button>
        </div>
      )}

      {isDataLoaded && !isDataSaved && salesData.length > 0 && (
        <Card className="border border-emerald-200 bg-emerald-50/70 shadow-sm">
          <CardContent className="py-8">
            <div className="flex flex-col items-center text-center">
              <Save className="size-12 text-green-500 mb-4" />
              <h3 className="text-xl font-semibold text-green-700">
                Save Data to Enable Forecasting
              </h3>
              <p className="text-green-600 mt-2 max-w-md">
                Click the <strong>"Save & Enable"</strong> button above to unlock AI forecasting with the AR-2 model.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {!salesData.length && !uploadedData && (
        <Card className="border-2 border-dashed border-emerald-200 bg-white shadow-sm">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-4 rounded-2xl bg-emerald-50 p-4">
              <Paintbrush className="size-10 text-emerald-700" />
            </div>
            <h2 className="text-2xl font-bold text-slate-800">No product sales data found</h2>
            <p className="mt-2 max-w-md text-gray-500 text-sm">
              Please upload a CSV or Excel file with your product sales data to generate AR-2 forecasts and insights.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              <Badge className="bg-[#0ea161] text-white">AR-2 Forecast</Badge>
              <Badge className="bg-[#10963f] text-white">Seasonal Insights</Badge>
              <Badge className="bg-[#0c6c28] text-white">AI Analytics</Badge>
            </div>
          </CardContent>
        </Card>
      )}

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

      {forecastData && forecastStatus === "success" && (
        <div id="ai-results" className="space-y-6">
          {stockRecs.length > 0 && (
            <Card className="shadow-lg border-0 overflow-hidden">
              <div className="bg-gradient-to-r from-green-900 to-emerald-600 px-6 py-4">
                <div className="flex items-center gap-3">
                  <Lightbulb className="w-5 h-5 text-white" />
                  <div>
                    <h3 className="text-lg font-bold text-white">Product Stock Recommendations</h3>
                  </div>
                </div>
              </div>

              <CardContent className="px-6 pb-6">
                {(() => {
                  const groupedByAction = stockRecs.reduce((acc: any, category: any) => {
                    const action = category.items?.[0]?.action || 'Maintain';
                    if (!acc[action]) acc[action] = [];
                    acc[action].push(category);
                    return acc;
                  }, {});

                  const actionOrder = ['Increase', 'Maintain'];
                  const actionColors: Record<string, string> = {
                    'Increase': 'border-orange-500 bg-orange-50/30',
                    'Maintain': 'border-green-900 bg-green-50/30'
                  };
                  const actionDotColors: Record<string, string> = {
                    'Increase': 'bg-orange-500',
                    'Maintain': 'bg-[#174d32]'
                  };
                  const actionBadgeColors: Record<string, string> = {
                    'Increase': 'bg-orange-100 text-orange-700',
                    'Maintain': 'bg-green-100 text-green-700'
                  };

                  return (
                    <div className="space-y-6">
                      {actionOrder.filter(action => groupedByAction[action]).map((action) => (
                        <div key={action} className={`border-l-4 ${actionColors[action]} rounded-r-lg p-4`}>
                          <div className="flex items-center gap-3 mb-4 pb-3 border-b border-gray-200">
                            <span className={`w-3 h-3 rounded-full ${actionDotColors[action]}`}></span>
                            <h4 className="text-sm font-semibold text-gray-700">{action} Stock</h4>
                            <Badge className={`${actionBadgeColors[action]} text-xs`}>
                              {groupedByAction[action].length} products
                            </Badge>
                          </div>

                          <div className="overflow-x-auto">
                            <Table>
                              <TableHeader>
                                <TableRow className="bg-gray-50/50">
                                  <TableHead className="text-xs font-semibold text-gray-700">Product</TableHead>
                                  <TableHead className="text-xs font-semibold text-gray-700 text-center">Current</TableHead>
                                  <TableHead className="text-xs font-semibold text-gray-700 text-center">Recommended</TableHead>
                                  <TableHead className="text-xs font-semibold text-gray-700">Action</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {groupedByAction[action].map((category: any, idx: number) => (
                                  category.items?.map((item: any, i: number) => (
                                    <TableRow key={`${idx}-${i}`} className="hover:bg-gray-50/50 transition-colors">
                                      <TableCell>
                                        <p className="font-medium text-gray-800 text-sm">
                                          {category.category || item.name}
                                        </p>
                                      </TableCell>
                                      <TableCell className="text-center text-sm">
                                        {item.currentStock}
                                      </TableCell>
                                      <TableCell className="text-center text-sm font-bold text-green-700">
                                        {item.recommendedStock}
                                      </TableCell>
                                      <TableCell>
                                        <Badge className={action === 'Increase' ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'}>
                                          {action}
                                        </Badge>
                                      </TableCell>
                                    </TableRow>
                                  ))
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        </div>
                      ))}

                      <div className="mt-2 pt-3 border-t border-gray-200">
                        <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500">
                          <span className="flex items-center gap-1.5">
                            <span className="w-3 h-3 rounded-full bg-red-500"></span>
                            Increase Stock
                          </span>
                          <span className="flex items-center gap-1.5">
                            <span className="w-3 h-3 rounded-full bg-[#174d32]"></span>
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

          {(bestSelling.length > 0 || slowMoving.length > 0) && (
            <section className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-white flex items-center justify-center shadow-sm">
                  <Target className="size-5 text-[#1a4d2e]" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Product Performance</h2>
                </div>
              </div>
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {bestSelling.length > 0 && (
                  <Card className="shadow-lg border-0 hover:shadow-xl transition-all duration-300">
                    <CardHeader className="rounded-t-lg bg-gradient-to-r from-green-900 to-emerald-700 border-b border-green-900 !p-2">
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded-lg ml-3 mt-1 bg-green-800 flex items-center justify-center flex-shrink-0">
                          <TrendingUp className="size-3 text-white" />
                        </div>
                        <CardTitle className="text-sm mt-1 font-semibold text-white">
                          Best-Selling Products
                        </CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
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

                {slowMoving.length > 0 && (
                  <Card className="shadow-lg border-0 hover:shadow-xl transition-all duration-300">
                    <CardHeader className="rounded-t-lg bg-gradient-to-r from-orange-700 to-amber-600 border-b border-orange-100 !p-2">
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 ml-3 mt-1 rounded-lg bg-orange-500 flex items-center justify-center flex-shrink-0">
                          <TrendingDown className="size-3 text-white" />
                        </div>
                        <CardTitle className="text-sm mt-1 font-semibold text-white">
                          Slow-Moving Products
                        </CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
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

          {marketing.length > 0 && (
            <section className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-white flex items-center justify-center shadow-sm">
                  <Lightbulb className="size-5 text-green-700" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900 tracking-tight">Marketing Strategies</h2>
                </div>
              </div>
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {marketing.map((strategy: any, index: number) => {
                  const drySeason = (strategy.season || "").toLowerCase().includes("dry");
                  return (
                    <Card key={index} className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden">
                      <div className={`${drySeason ? "bg-gradient-to-r from-green-900 to-emerald-600" : "bg-gradient-to-r from-blue-700 to-sky-600"} px-4 py-3`}>
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

                      <CardContent>
                        <div className="grid gap-2.5">
                          {(strategy.strategies || []).map((item: string, i: number) => (
                            <div key={i} className="flex gap-3 rounded-xl border border-gray-100 bg-white p-3 hover:shadow-md transition-all hover:border-gray-200">
                              <div className={`flex h-7 w-7 items-center justify-center rounded-full flex-shrink-0 ${drySeason ? "bg-green-100" : "bg-blue-100"}`}>
                                <CheckCircle2 className={`size-4 ${drySeason ? "text-green-600" : "text-blue-700"}`} />
                              </div>
                              <div className="flex-1">
                                <p className="text-sm font-medium text-gray-700">Strategy {i + 1}</p>
                                <p className="text-sm leading-relaxed text-gray-600 break-words mt-0.5">{item}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}