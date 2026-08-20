import { useMemo, useState, useEffect, useRef } from "react";
import type { ChangeEvent, DragEvent } from "react";
import { salesForecastAI } from "../gemini-service/SalesForecasting";

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
  Zap,
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
} from "lucide-react";

import Papa from "papaparse";
import * as XLSX from "xlsx";
import { useAuth } from "../context/AuthContext";
import {
  saveSalesForecastData,
  getSalesForecastData,
  clearSalesForecastData,
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
  usedVolume?: number;
  fullVolume?: number;
  subtotal?: number;
}

interface ProductDetail {
  productKey: string;
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
  totalVolumeUsed: number;
  pricePerMl: number;
}

interface SeasonProduct {
  productKey: string;
  name: string;
  brand: string;
  totalUnits: number;
  revenue: number;
  totalRevenue: number;
  volumeUsed: number;
}

const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const SEASON_FOR_MONTH = (monthIndex: number): string => {
  if (monthIndex >= 10 || monthIndex <= 3) {
    return "Dry";
  } else {
    return "Rainy";
  }
};

const getMonthIndexFromName = (monthName: string): number => {
  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  const shortNames = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];

  const trimmed = monthName.trim();

  const fullIndex = monthNames.findIndex(
    (m) => m.toLowerCase() === trimmed.toLowerCase()
  );
  if (fullIndex !== -1) return fullIndex;

  const shortIndex = shortNames.findIndex(
    (m) => m.toLowerCase() === trimmed.toLowerCase()
  );
  if (shortIndex !== -1) return shortIndex;

  return -1;
};

const REQUIRED_HEADERS = [
  "Date",
  "Brand",
  "Product",
  "Total Sales (PHP)",
  "Units Sold",
  "Season",
];

const showNotification = (
  message: string,
  type: "success" | "error" | "info" = "success"
) => {
  const colors = {
    success: "bg-green-900 border-green-400/30",
    error: "bg-red-600 border-red-400/30",
    info: "bg-emerald-700 border-emerald-400/30",
  };

  const icons = {
    success: "M5 13l4 4L19 7",
    error: "M6 18L18 6M6 6l12 12",
    info: "M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
  };

  const existing = document.querySelectorAll(".custom-notification");
  existing.forEach((el) => el.remove());

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
    notification.style.opacity = "0";
    notification.style.transform = "translateY(20px)";
    setTimeout(() => notification.remove(), 300);
  }, 3000);
};

import { createPortal } from 'react-dom';

// MonthDropdown component - with proper stock display per month
const MonthDropdown = ({ 
  months, 
  badgeClass,
  recommendations,
  onMonthSelect,
  currentStock,
  setCurrentStock
}: { 
  months: string[], 
  badgeClass: string,
  recommendations?: { month: string; recommendedStock: number; peakUnits: number; peakSales: number }[],
  onMonthSelect?: (month: string, stock: number) => void,
  currentStock?: number,
  setCurrentStock?: (stock: number) => void
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<string>(
    months.length > 0 && months[0] !== "No data" && months[0] !== "" ? months[0] : "No data"
  );
  
  const validMonths = months.filter(m => m !== "No data" && m !== "");
  const firstMonth = validMonths.length > 0 ? validMonths[0] : "No data";
  
  const getStockForMonth = (monthLabel: string): number | null => {
    if (!recommendations) return null;
    const found = recommendations.find(r => r.month === monthLabel);
    return found ? found.recommendedStock : null;
  };
  
  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (isOpen && !target.closest('.month-dropdown-container')) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);
  
  const handleMonthClick = (month: string) => {
    const stock = getStockForMonth(month);
    if (stock !== null) {
      setSelectedMonth(month);
      if (setCurrentStock) {
        setCurrentStock(stock);
      }
      if (onMonthSelect) {
        onMonthSelect(month, stock);
      }
    }
    setIsOpen(false);
  };
  
  if (validMonths.length === 0) {
    return (
      <div className="month-dropdown-container relative inline-block">
        <span className="text-xs text-gray-400">No data</span>
      </div>
    );
  }
  
  const displayMonth = selectedMonth !== "No data" ? selectedMonth : firstMonth;
  
  return (
    <div className="month-dropdown-container relative inline-block">
      <button
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className={`${badgeClass} text-xs font-medium whitespace-nowrap px-2 py-1 rounded-full flex items-center gap-1 hover:opacity-80 transition cursor-pointer`}
        type="button"
      >
        {displayMonth}
        <svg 
          className={`w-3 h-3 inline-block transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      
      {isOpen && (
        <div 
          className="absolute z-[99999] bg-white rounded-lg shadow-2xl border border-gray-200 py-1 max-h-64 overflow-y-auto"
          style={{
            position: 'fixed',
            top: 'auto',
            left: 'auto',
            minWidth: '220px',
            maxWidth: '280px',
          }}
        >
          <div className="px-3 py-1.5 text-xs font-semibold text-gray-500 border-b border-gray-100 bg-gray-50 sticky top-0">
            Select Peak Month
          </div>
          {validMonths.map((month: string, mi: number) => {
            const stock = getStockForMonth(month);
            const isSelected = selectedMonth === month;
            return (
              <div
                key={mi}
                onClick={() => handleMonthClick(month)}
                className={`px-3 py-2 text-xs cursor-pointer border-b border-gray-50 last:border-0 transition-colors ${
                  isSelected 
                    ? 'bg-green-100 text-green-700 font-medium' 
                    : 'hover:bg-gray-50 text-gray-700'
                }`}
              >
                <div className="flex justify-between items-center">
                  <span>{month}</span>
                  {stock !== null && (
                    <span className={`text-xs font-bold ${isSelected ? 'text-green-600' : 'text-gray-500'}`}>
                      {stock} units
                    </span>
                  )}
                </div>
                {isSelected && (
                  <div className="text-[10px] text-green-600 mt-0.5">✓ Currently selected</div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
export default function SeasonalForecasting() {
  const { userEmail } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState<
    "idle" | "syncing" | "success" | "error"
  >("idle");
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

  const [forecastData, setForecastData] = useState<any>(null);
  const [forecastStatus, setForecastStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [lastGenerated, setLastGenerated] = useState<string | null>(null);

  const [viewMode, setViewMode] = useState("monthly");
  const [selectedMonth, setSelectedMonth] = useState("");
  const [timeFilter, setTimeFilter] = useState("all");
  const [chartKey, setChartKey] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [showRemoveDialog, setShowRemoveDialog] = useState(false);

  // State for product stock selections - this tracks the currently selected stock for each product
  const [productStockStates, setProductStockStates] = useState<Record<string, number>>({});
  // FIXED: Track which month is selected for each product
  const [productSelectedMonths, setProductSelectedMonths] = useState<Record<string, string>>({});

  const CACHE_KEY = "sales_forecast_data";
  const CACHE_TIMESTAMP_KEY = "sales_forecast_timestamp";
  const CACHE_DATA_COUNT_KEY = "sales_forecast_data_count";

  const computedSeasonalData = useMemo(() => {
    if (!salesData.length) return null;

    const dryData = salesData.filter((r) => r.season === "Dry");
    const rainyData = salesData.filter((r) => r.season === "Rainy");
    const dryTotal = dryData.reduce((sum, r) => sum + r.sales, 0);
    const rainyTotal = rainyData.reduce((sum, r) => sum + r.sales, 0);
    const dryAvg = dryData.length ? dryTotal / dryData.length : 0;
    const rainyAvg = rainyData.length ? rainyTotal / rainyData.length : 0;

    return {
      dry: {
        totalSales: dryTotal,
        averageMonthlySales: Math.round(dryAvg),
        trend: dryTotal > rainyTotal ? 'increasing' : 'decreasing',
        monthCount: dryData.length
      },
      rainy: {
        totalSales: rainyTotal,
        averageMonthlySales: Math.round(rainyAvg),
        trend: rainyTotal > dryTotal ? 'increasing' : 'decreasing',
        monthCount: rainyData.length
      }
    };
  }, [salesData]);

  const computedProductDetails = useMemo(() => {
    if (!originalData.length) return [];

    const productMap = new Map<string, ProductDetail>();

    originalData.forEach((record) => {
      const productKey = `${record.brand || ""}-${record.product || ""}`;
      const isDry = record.season === "Dry";

      if (!productMap.has(productKey)) {
        productMap.set(productKey, {
          productKey: productKey,
          product: record.product || "Unknown",
          brand: record.brand || "Unknown",
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
          bestSeason: "Dry",
          totalVolumeUsed: 0,
          pricePerMl: 0,
        });
      }

      const detail = productMap.get(productKey)!;
      
      const salesAmount = record.subtotal || record.sales;
      
      detail.totalSales += salesAmount;
      detail.totalUnits += record.unitsSold || 0;
      detail.months += 1;
      detail.totalVolumeUsed += record.usedVolume || 0;

      if (isDry) {
        detail.drySales += salesAmount;
        detail.dryUnits += record.unitsSold || 0;
        detail.dryMonths += 1;
      } else {
        detail.rainySales += salesAmount;
        detail.rainyUnits += record.unitsSold || 0;
        detail.rainyMonths += 1;
      }
    });

    const products = Array.from(productMap.values()).map((p) => {
      const avgMonthly = p.totalSales / p.months;
      const dryAvg = p.dryMonths > 0 ? p.drySales / p.dryMonths : 0;
      const rainyAvg = p.rainyMonths > 0 ? p.rainySales / p.rainyMonths : 0;
      
      const totalVolume = p.totalVolumeUsed || 1;
      const pricePerMl = p.totalSales / totalVolume;

      return {
        ...p,
        avgMonthlySales: Math.round(avgMonthly),
        bestSeason: dryAvg >= rainyAvg ? "Dry" : "Rainy",
        pricePerMl: pricePerMl,
      };
    });

    return products.sort((a, b) => b.totalSales - a.totalSales);
  }, [originalData]);

  const topProductsBySeason = useMemo(() => {
    if (!computedProductDetails.length) return null;

    const dryTop5 = computedProductDetails
      .filter((p) => p.drySales > 0)
      .sort((a, b) => b.dryUnits - a.dryUnits)
      .slice(0, 5)
      .map((p) => ({
        productKey: p.productKey,
        name: p.product,
        brand: p.brand,
        totalUnits: p.dryUnits,
        revenue: Math.round(p.drySales),
        totalRevenue: Math.round(p.drySales),
        volumeUsed: Math.round(p.totalVolumeUsed / p.months * p.dryMonths / (p.dryMonths || 1)),
      }));

    const rainyTop5 = computedProductDetails
      .filter((p) => p.rainySales > 0)
      .sort((a, b) => b.rainyUnits - a.rainyUnits)
      .slice(0, 5)
      .map((p) => ({
        productKey: p.productKey,
        name: p.product,
        brand: p.brand,
        totalUnits: p.rainyUnits,
        revenue: Math.round(p.rainySales),
        totalRevenue: Math.round(p.rainySales),
        volumeUsed: Math.round(p.totalVolumeUsed / p.months * p.rainyMonths / (p.rainyMonths || 1)),
      }));

    return {
      dry: dryTop5,
      rainy: rainyTop5,
    };
  }, [computedProductDetails]);

// stockRecommendations with month-specific data - FIXED to only show peak months
const stockRecommendations = useMemo(() => {
  if (!computedProductDetails.length || !originalData.length) return [];

  const sortedByUnits = [...computedProductDetails].sort((a, b) => b.totalUnits - a.totalUnits);
  const avgUnits = computedProductDetails.reduce((sum, p) => sum + p.totalUnits, 0) / computedProductDetails.length;

  const increaseStock = sortedByUnits
    .filter(p => p.totalUnits > avgUnits * 1.1)
    .slice(0, 3);

  const maintainStock = sortedByUnits
    .filter(p => p.totalUnits >= avgUnits * 0.8 && p.totalUnits <= avgUnits * 1.1)
    .slice(0, 3);

  const result: any[] = [];

  const getProductMonthDetails = (productName: string, brand: string) => {
    const productRecords = originalData.filter(
      (r) => r.product === productName && r.brand === brand
    );
    
    if (productRecords.length === 0) {
      return [];
    }
    
    const monthlyData: Record<string, { 
      sales: number; 
      units: number; 
      month: string; 
      year: number;
      monthName: string;
      fullLabel: string;
    }> = {};
    
    productRecords.forEach((record) => {
      const monthKey = `${record.month}-${record.year}`;
      const monthShort = record.month.substring(0, 3);
      
      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = {
          sales: 0,
          units: 0,
          month: monthShort,
          year: record.year,
          monthName: record.month,
          fullLabel: `${monthShort} ${record.year}`
        };
      }
      monthlyData[monthKey].sales += record.sales;
      monthlyData[monthKey].units += record.unitsSold || 0;
    });
    
    const monthlyArray = Object.values(monthlyData);
    // Sort by sales to get peak months (highest sales first)
    const sortedMonths = [...monthlyArray].sort((a, b) => b.sales - a.sales);
    
    // FIXED: Only return the top 3 peak months
    const topPeakMonths = sortedMonths.slice(0, 3);
    
    return topPeakMonths.map(month => ({
      label: month.fullLabel,
      month: month.month,
      year: month.year,
      sales: Math.round(month.sales),
      units: Math.round(month.units),
    }));
  };

  const calculateStockForMonth = (peakUnits: number, action: string) => {
    if (action === "Increase") {
      return Math.round(Math.max(peakUnits * 2.5, 30) / 5) * 5;
    } else {
      return Math.round(Math.max(peakUnits * 1.2, 20) / 5) * 5;
    }
  };

  // Process Increase products
  increaseStock.forEach(p => {
    const monthDetails = getProductMonthDetails(p.product, p.brand);
    const volumePerUnit = Math.round(p.totalVolumeUsed / (p.totalUnits || 1)) || 3785;
    const pricePerMl = p.pricePerMl || 0;
    
    const monthRecommendations = monthDetails.map(month => {
      const recommendedStock = calculateStockForMonth(month.units, "Increase");
      return {
        month: month.label,
        peakSales: month.sales,
        peakUnits: month.units,
        recommendedStock: recommendedStock,
      };
    });
    
    if (monthRecommendations.length === 0) {
      const avgMonthlyUnits = p.totalUnits / (p.months || 1);
      monthRecommendations.push({
        month: "No data",
        peakSales: 0,
        peakUnits: 0,
        recommendedStock: Math.round(Math.max(avgMonthlyUnits * 4, 30) / 5) * 5,
      });
    }
    
    result.push({
      category: `${p.brand} ${p.product}`,
      action: "Increase",
      volumePerUnit: volumePerUnit,
      pricePerMl: pricePerMl,
      items: monthRecommendations,
      defaultStock: monthRecommendations[0]?.recommendedStock || 60,
      defaultMonth: monthRecommendations[0]?.month || "No data",
    });
  });

  // Process Maintain products
  maintainStock.forEach(p => {
    const monthDetails = getProductMonthDetails(p.product, p.brand);
    const volumePerUnit = Math.round(p.totalVolumeUsed / (p.totalUnits || 1)) || 3785;
    const pricePerMl = p.pricePerMl || 0;
    
    const monthRecommendations = monthDetails.map(month => {
      const recommendedStock = calculateStockForMonth(month.units, "Maintain");
      return {
        month: month.label,
        peakSales: month.sales,
        peakUnits: month.units,
        recommendedStock: recommendedStock,
      };
    });
    
    if (monthRecommendations.length === 0) {
      const avgMonthlyUnits = p.totalUnits / (p.months || 1);
      monthRecommendations.push({
        month: "No data",
        peakSales: 0,
        peakUnits: 0,
        recommendedStock: Math.round(Math.max(avgMonthlyUnits * 2, 20) / 5) * 5,
      });
    }
    
    result.push({
      category: `${p.brand} ${p.product}`,
      action: "Maintain",
      volumePerUnit: volumePerUnit,
      pricePerMl: pricePerMl,
      items: monthRecommendations,
      defaultStock: monthRecommendations[0]?.recommendedStock || 30,
      defaultMonth: monthRecommendations[0]?.month || "No data",
    });
  });

  return result;
}, [computedProductDetails, originalData]);

  // Initialize stock states when recommendations change
  useEffect(() => {
    if (stockRecommendations.length > 0) {
      const initialStates: Record<string, number> = {};
      const initialMonths: Record<string, string> = {};
      stockRecommendations.forEach((category: any) => {
        const key = category.category;
        initialStates[key] = category.defaultStock || 60;
        initialMonths[key] = category.defaultMonth || "No data";
      });
      setProductStockStates(initialStates);
      setProductSelectedMonths(initialMonths);
    }
  }, [stockRecommendations]);

  // FIXED: Function to update stock for a product
  const updateProductStock = (productKey: string, stock: number, month?: string) => {
    setProductStockStates(prev => ({
      ...prev,
      [productKey]: stock
    }));
    if (month) {
      setProductSelectedMonths(prev => ({
        ...prev,
        [productKey]: month
      }));
    }
  };

  const bestSellingProducts = useMemo(() => {
    if (!computedProductDetails.length) return [];

    const sortedByUnits = [...computedProductDetails].sort((a, b) => b.totalUnits - a.totalUnits);
    return sortedByUnits.slice(0, 5).map(p => {
      const dryAvg = p.dryMonths > 0 ? p.drySales / p.dryMonths : 0;
      const rainyAvg = p.rainyMonths > 0 ? p.rainySales / p.rainyMonths : 0;
      
      return {
        name: `${p.brand} ${p.product}`,
        unitsSold: p.totalUnits,
        dryUnits: p.dryUnits,
        rainyUnits: p.rainyUnits,
        totalRevenue: Math.round(p.totalSales),
        volumeUsed: Math.round(p.totalVolumeUsed),
        pricePerMl: p.pricePerMl,
      };
    });
  }, [computedProductDetails]);

  const slowMovingProducts = useMemo(() => {
    if (!computedProductDetails.length) return [];

    const sortedByUnits = [...computedProductDetails].sort((a, b) => b.totalUnits - a.totalUnits);
    
    const avgUnits = computedProductDetails.reduce((sum, p) => sum + p.totalUnits, 0) / computedProductDetails.length;
    
    const slowProducts = sortedByUnits.filter(p => {
      const hasLowUnits = p.totalUnits < 50;
      const isBelowHalfAverage = p.totalUnits < avgUnits * 0.5;
      return hasLowUnits && isBelowHalfAverage;
    }).slice(0, 5);
    
    if (slowProducts.length === 0) {
      return [];
    }
    
    return slowProducts.map(p => {
      let recommendation = '';
      
      if (p.totalUnits < 20) {
        recommendation = 'Consider bundling or aggressive discounts';
      } else if (p.totalUnits < 35) {
        recommendation = 'Bundle with popular products or run promotions';
      } else {
        recommendation = 'Review pricing and positioning';
      }
      
      return {
        name: `${p.brand} ${p.product}`,
        unitsSold: p.totalUnits,
        dryUnits: p.dryUnits || 0,
        rainyUnits: p.rainyUnits || 0,
        recommendation: recommendation,
        totalRevenue: Math.round(p.totalSales),
        volumeUsed: Math.round(p.totalVolumeUsed),
        pricePerMl: p.pricePerMl,
      };
    });
  }, [computedProductDetails]);

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
          last_fetched: lastGenerated
            ? new Date(lastGenerated).toISOString()
            : null,
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
    const normalizedHeaders = headers.map((h) => h.trim());
    const missing = REQUIRED_HEADERS.filter(
      (req) => !normalizedHeaders.some((h) => h === req)
    );
    return {
      valid: missing.length === 0,
      missing,
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
        if (item.usedVolume) {
          acc[key].usedVolume = (acc[key].usedVolume || 0) + item.usedVolume;
        }
      } else {
        acc[key] = {
          ...item,
          season: item.season,
        };
      }
      return acc;
    }, {} as Record<string, SalesRecord>);

    return Object.values(grouped).sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      return (
        MONTH_NAMES.indexOf(a.month.substring(0, 3)) -
        MONTH_NAMES.indexOf(b.month.substring(0, 3))
      );
    });
  };

  const processUploadedData = (data: any[]) => {
    try {
      console.log("========== DATA PROCESSING START ==========");
      console.log("Total rows:", data.length);

      const headers = Object.keys(data[0] || {});
      const validation = validateHeaders(headers);
      if (!validation.valid) {
        setUploadError(
          `Missing required headers: ${validation.missing.join(
            ", "
          )}. Required: ${REQUIRED_HEADERS.join(", ")}`
        );
        showNotification(
          `Missing required headers: ${validation.missing.join(", ")}`,
          "error"
        );
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

          const parts = dateStr.split(/[\/\-.]/);
          if (parts.length === 3) {
            let day = parseInt(parts[0]);
            let month = parseInt(parts[1]) - 1;
            let yearVal = parseInt(parts[2]);

            if (day >= 1 && day <= 31 && month >= 0 && month <= 11 && yearVal > 0) {
              const d = new Date(yearVal, month, day);
              if (!isNaN(d.getTime())) {
                parsedDate = d;
              }
            }

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

          if (!parsedDate) {
            const d = new Date(dateStr);
            if (!isNaN(d.getTime())) {
              parsedDate = d;
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
              month = new Date(2000, monthIdx, 1).toLocaleString("en-US", {
                month: "long",
              });
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
        const sales = Number(
          row["Total Sales (PHP)"] || row["Total Sales"] || row["sales"] || 0
        );
        const unitsSold = Number(row["Units Sold"] || row["unitsSold"] || 0);

        const usedVolume = Number(row["Used Volume"] || row["Volume Used"] || row["Quantity Used"] || 0);
        const fullVolume = Number(row["Full Volume"] || row["fullVolume"] || 0);
        
        const subtotal = sales;

        const seasonFromCSV = row.Season || row["Season"] || "";
        let season = seasonFromCSV;

        if (!season) {
          season = SEASON_FOR_MONTH(monthIndex);
        }

        return {
          id: String(index + 1),
          month: month,
          year: year,
          season: season,
          sales: subtotal,
          category: product || brand || "Unknown",
          product: product,
          brand: brand,
          unitsSold: unitsSold,
          usedVolume: usedVolume > 0 ? usedVolume : 0,
          fullVolume: fullVolume > 0 ? fullVolume : 0,
          subtotal: subtotal,
        };
      });

      const seasonDist = formattedData.reduce((acc, r) => {
        acc[r.season] = (acc[r.season] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      console.log("Season distribution:", seasonDist);
      console.log("Total records:", formattedData.length);

      setOriginalData(formattedData);

      const productMap = new Map<string, ProductDetail>();
      formattedData.forEach((record) => {
        const productKey = `${record.brand || ""}-${record.product || ""}`;
        const isDry = record.season === "Dry";

        if (!productMap.has(productKey)) {
          productMap.set(productKey, {
            productKey: productKey,
            product: record.product || "Unknown",
            brand: record.brand || "Unknown",
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
            bestSeason: "Dry",
            totalVolumeUsed: 0,
            pricePerMl: 0,
          });
        }

        const detail = productMap.get(productKey)!;
        const salesAmount = record.subtotal || record.sales;
        
        detail.totalSales += salesAmount;
        detail.totalUnits += record.unitsSold || 0;
        detail.months += 1;
        detail.totalVolumeUsed += record.usedVolume || 0;

        if (isDry) {
          detail.drySales += salesAmount;
          detail.dryUnits += record.unitsSold || 0;
          detail.dryMonths += 1;
        } else {
          detail.rainySales += salesAmount;
          detail.rainyUnits += record.unitsSold || 0;
          detail.rainyMonths += 1;
        }
      });

      const products = Array.from(productMap.values())
        .map((p) => {
          const avgMonthly = p.totalSales / p.months;
          const dryAvg = p.dryMonths > 0 ? p.drySales / p.dryMonths : 0;
          const rainyAvg = p.rainyMonths > 0 ? p.rainySales / p.rainyMonths : 0;
          const pricePerMl = p.totalVolumeUsed > 0 ? p.totalSales / p.totalVolumeUsed : 0;

          return {
            ...p,
            avgMonthlySales: Math.round(avgMonthly),
            bestSeason: dryAvg >= rainyAvg ? "Dry" : "Rainy",
            pricePerMl: pricePerMl,
          };
        })
        .sort((a, b) => b.totalSales - a.totalSales);

      setProductDetails(products);

      const aggregated = aggregateSalesData(formattedData);
      setSalesData(aggregated);

      setForecastData(null);
      setForecastStatus("idle");
      setLastGenerated(null);

      localStorage.removeItem(CACHE_KEY);
      localStorage.removeItem(CACHE_TIMESTAMP_KEY);
      localStorage.removeItem(CACHE_DATA_COUNT_KEY);

      setUploadError("");

      console.log("Product details computed:", products.length, "unique products");
      console.log("Top 5 products by total sales:", products.slice(0, 5).map(p => 
        `${p.brand} ${p.product}: ₱${p.totalSales.toLocaleString()}`
      ));

    } catch (error) {
      console.error("Error processing uploaded data:", error);
      setUploadError("Failed to process data. Please check the file format.");
      showNotification("Failed to process data. Please check the file format.", "error");
    }
  };

  const processFile = (file: File) => {
    setUploadError("");
    setUploadedData(null);
    setUploadedDataName("");
    setIsDataSaved(false);

    const fileExtension = file.name.split(".").pop()?.toLowerCase();
    const isValidFile =
      fileExtension === "csv" || fileExtension === "xlsx" || fileExtension === "xls";

    if (!isValidFile) {
      setUploadError("Please upload a valid CSV or Excel (.xlsx, .xls) file.");
      showNotification(
        "Please upload a valid CSV or Excel (.xlsx, .xls) file.",
        "error"
      );
      return;
    }

    const reader = new FileReader();

    if (fileExtension === "csv") {
      reader.onload = (ev) => {
        try {
          const csvText = ev.target?.result as string;
          const result = Papa.parse<any>(csvText, {
            header: true,
            skipEmptyLines: true,
            trimHeaders: true,
          });

          const data = result.data.filter((item) =>
            Object.keys(item).some(
              (key) => item[key] !== undefined && item[key] !== ""
            )
          );

          if (data.length === 0) {
            setUploadError("CSV file appears empty or invalid.");
            showNotification("CSV file appears empty or invalid.", "error");
            return;
          }

          const headers = Object.keys(data[0] || {});
          const validation = validateHeaders(headers);
          if (!validation.valid) {
            setUploadError(
              `Missing required headers: ${validation.missing.join(
                ", "
              )}. Required: ${REQUIRED_HEADERS.join(", ")}`
            );
            showNotification(
              `Missing required headers: ${validation.missing.join(", ")}`,
              "error"
            );
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
        const workbook = XLSX.read(data, { type: "array" });
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
          setUploadError(
            `Missing required headers: ${validation.missing.join(
              ", "
            )}. Required: ${REQUIRED_HEADERS.join(", ")}`
          );
          showNotification(
            `Missing required headers: ${validation.missing.join(", ")}`,
            "error"
          );
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

  const handleSaveData = () => {
    if (!uploadedData || uploadedData.length === 0) {
      setUploadError("No data to save. Please upload a file first.");
      showNotification("No data to save. Please upload a file first.", "error");
      return;
    }

    try {
      setIsDataSaved(true);
      setUploadError("");
      showNotification(
        "✅ Data saved successfully! Seasonal analysis is now available.",
        "success"
      );
    } catch (err) {
      console.error("Error saving data:", err);
      setUploadError("Failed to save data.");
      showNotification("Failed to save data.", "error");
    }
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

  const calculateARcoefficients = (data: number[]): {
    phi1: number;
    phi2: number;
    c: number;
  } => {
    const n = data.length;

    if (n < 4) {
      return { phi1: 0.5, phi2: 0.3, c: 0 };
    }

    const mean = data.reduce((sum, val) => sum + val, 0) / n;
    const centered = data.map((val) => val - mean);

    let gamma0 = 0;
    let gamma1 = 0;
    let gamma2 = 0;

    for (let i = 0; i < n; i++) {
      gamma0 += centered[i] * centered[i];
      if (i < n - 1) gamma1 += centered[i] * centered[i + 1];
      if (i < n - 2) gamma2 += centered[i] * centered[i + 2];
    }

    gamma0 /= n;
    gamma1 /= n - 1;
    gamma2 /= n - 2;

    const denom = gamma0 * gamma0 - gamma1 * gamma1;

    let phi1 = 0;
    let phi2 = 0;

    if (Math.abs(denom) > 1e-10) {
      phi1 = (gamma1 * gamma0 - gamma2 * gamma1) / denom;
      phi2 = (gamma2 * gamma0 - gamma1 * gamma1) / denom;
    }

    const maxPhi = 0.9;
    phi1 = Math.max(-maxPhi, Math.min(maxPhi, phi1));
    phi2 = Math.max(-maxPhi, Math.min(maxPhi, phi2));

    const c = mean * (1 - phi1 - phi2);

    return { phi1, phi2, c };
  };

  const calculateARForecast = (historicalData: SalesRecord[]): any[] => {
    if (historicalData.length < 3) {
      const avg = historicalData.reduce((sum, r) => sum + r.sales, 0) / historicalData.length;
      return Array(3)
        .fill(null)
        .map((_, i) => ({
          month: `Month ${i + 1}`,
          sales: Math.round(avg),
          season: "Dry",
          upperBound: Math.round(avg * 1.15),
          lowerBound: Math.round(avg * 0.85),
        }));
    }

    const sorted = [...historicalData].sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      return (
        MONTH_NAMES.indexOf(a.month.substring(0, 3)) -
        MONTH_NAMES.indexOf(b.month.substring(0, 3))
      );
    });

    const salesValues = sorted.map((r) => r.sales);
    const n = salesValues.length;

    const { phi1, phi2, c } = calculateARcoefficients(salesValues);

    const lastValue = salesValues[n - 1];
    const secondLastValue = salesValues[n - 2];

    let residuals: number[] = [];
    for (let t = 2; t < n; t++) {
      const predicted = c + phi1 * salesValues[t - 1] + phi2 * salesValues[t - 2];
      residuals.push(salesValues[t] - predicted);
    }

    const residualStd =
      residuals.length > 0
        ? Math.sqrt(residuals.reduce((sum, r) => sum + r * r, 0) / residuals.length)
        : Math.abs(lastValue - secondLastValue) * 0.1;

    const forecast = [];
    const lastMonth = sorted[sorted.length - 1];
    const lastMonthIndex = MONTH_NAMES.indexOf(lastMonth.month.substring(0, 3));

    let prevPrev = secondLastValue;
    let prev = lastValue;

    for (let i = 1; i <= 3; i++) {
      const predicted = c + phi1 * prev + phi2 * prevPrev;
      const finalPrediction = Math.max(predicted, 100);

      const zScore = 1.96;
      const marginOfError = zScore * residualStd * Math.sqrt(1 + phi1 * phi1 + phi2 * phi2);

      const nextIndex = (lastMonthIndex + i) % 12;
      const nextYear = lastMonthIndex + i >= 12 ? lastMonth.year + 1 : lastMonth.year;
      const monthName = MONTH_NAMES[nextIndex];

      const existingRecord = originalData.find(
        (r) => r.month.substring(0, 3) === monthName && r.year === nextYear
      );
      const season = existingRecord?.season || SEASON_FOR_MONTH(nextIndex);

      forecast.push({
        month: `${monthName} ${nextYear}`,
        sales: Math.round(finalPrediction),
        season: season,
        upperBound: Math.round(finalPrediction + marginOfError),
        lowerBound: Math.round(Math.max(finalPrediction - marginOfError, 0)),
      });

      prevPrev = prev;
      prev = finalPrediction;
    }

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

      const dryData = salesData.filter((r) => r.season === "Dry");
      const rainyData = salesData.filter((r) => r.season === "Rainy");
      const dryTotal = dryData.reduce((sum, r) => sum + r.sales, 0);
      const rainyTotal = rainyData.reduce((sum, r) => sum + r.sales, 0);
      const dryAvg = dryData.length ? dryTotal / dryData.length : 0;
      const rainyAvg = rainyData.length ? rainyTotal / rainyData.length : 0;

      const calculatedForecast = calculateARForecast(salesData);

      const sortedByUnits = [...computedProductDetails].sort((a, b) => b.totalUnits - a.totalUnits);
      const topProducts = sortedByUnits.slice(0, 5);

      const prompt = `
You are an AI marketing strategist. Based on the sales data below, generate creative marketing strategies for each season.

SALES DATA:
- Total Sales: ₱${totalSales.toLocaleString()}
- Average Monthly Sales: ₱${Math.round(avgSales).toLocaleString()}
- Records: ${salesData.length}
- Total Products: ${computedProductDetails.length}

TOP PRODUCTS (by units sold):
${topProducts.map((p, i) => `${i+1}. ${p.brand} ${p.product}: ${p.totalUnits} units (Best season: ${p.bestSeason})`).join('\n')}

SEASONAL BREAKDOWN:
Dry Season: ₱${dryTotal.toLocaleString()} (${dryData.length} months, Avg: ₱${Math.round(dryAvg).toLocaleString()})
Rainy Season: ₱${rainyTotal.toLocaleString()} (${rainyData.length} months, Avg: ₱${Math.round(rainyAvg).toLocaleString()})

FORECAST (3 months):
${calculatedForecast.map((f, i) => `${f.month}: ₱${f.sales.toLocaleString()} (${f.season})`).join('\n')}

TASK: Generate 5 creative marketing strategies for each season (Dry and Rainy). Use simple words and make sure it is attainable for a small paint center.

Return ONLY valid JSON with this structure:
{
  "marketingStrategies": [
    {
      "season": "Dry Season",
      "targetProducts": ["${topProducts.filter(p => p.bestSeason === 'Dry').slice(0, 3).map(p => p.brand + ' ' + p.product).join('", "')}"],
      "strategies": [
        "Strategy 1 for Dry Season",
        "Strategy 2 for Dry Season",
        "Strategy 3 for Dry Season",
        "Strategy 4 for Dry Season",
        "Strategy 5 for Dry Season"
      ]
    },
    {
      "season": "Rainy Season",
      "targetProducts": ["${topProducts.filter(p => p.bestSeason === 'Rainy').slice(0, 3).map(p => p.brand + ' ' + p.product).join('", "')}"],
      "strategies": [
        "Strategy 1 for Rainy Season",
        "Strategy 2 for Rainy Season",
        "Strategy 3 for Rainy Season",
        "Strategy 4 for Rainy Season",
        "Strategy 5 for Rainy Season"
      ]
    }
  ]
}`;

      const response = await salesForecastAI.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
      });

      const cleaned = response.text
        .replace(/```json/g, "")
        .replace(/```/g, "")
        .trim();

      const aiResult = JSON.parse(cleaned);

      const result = {
        bestSellingProducts: bestSellingProducts,
        slowMovingProducts: slowMovingProducts,
        stockRecommendations: stockRecommendations,
        marketingStrategies: aiResult.marketingStrategies || [],
        forecast: calculatedForecast
      };

      console.log("=== FINAL RESULT ===");
      console.log("Best selling (frontend):", result.bestSellingProducts.map(p => `${p.name}: ${p.unitsSold} units`));
      console.log("Slow moving (frontend):", result.slowMovingProducts.map(p => `${p.name}: ${p.unitsSold} units`));
      console.log("Stock recs (frontend):", result.stockRecommendations.map(r => `${r.category}: ${r.items[0].action}`));
      console.log("Marketing strategies (AI):", result.marketingStrategies.length);

      localStorage.setItem(CACHE_KEY, JSON.stringify(result));
      localStorage.setItem(CACHE_TIMESTAMP_KEY, String(Date.now()));
      localStorage.setItem(CACHE_DATA_COUNT_KEY, String(salesData.length));

      setForecastData(result);
      setForecastStatus("success");
      const date = new Date();
      setLastGenerated(date.toLocaleString());
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

  const availableYears = useMemo(
    () => [...new Set(salesData.map((row) => row.year))].sort(),
    [salesData]
  );

  const isDataLoaded = uploadedData !== null && uploadedData.length > 0;

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f3f7f4]">
        <div className="rounded-2xl border border-emerald-100 bg-white px-10 py-8 text-center shadow-[0_18px_50px_rgba(20,83,45,0.08)]">
          <Loader2 className="mx-auto size-12 animate-spin text-[#1a4d2e]" />
          <p className="mt-4 text-sm font-medium text-slate-600">
            Loading sales records...
          </p>
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

      <header className="overflow-hidden rounded-2xl bg-[#174d32] px-5 py-2 text-white shadow-[0_18px_45px_rgba(23,77,50,0.18)] sm:px-7 sm:py-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-white/12 ring-1 ring-white/15">
              <Paintbrush className="size-5 text-emerald-100" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                Product Sales Forecast
              </h1>
              <p className="mt-1 text-sm text-emerald-100">
                Analyze product performance across dry and rainy seasons.
              </p>
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
                <CardTitle className="text-md font-medium text-white leading-none">
                  Product Sales Data
                </CardTitle>
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
                      <p className="text-sm font-medium text-gray-700">
                        Drop CSV or Excel file
                      </p>
                      <p className="text-xs text-gray-400">or click to browse</p>
                    </div>
                    <div className="flex gap-1">
                      {["CSV", "XLSX"].map((format) => (
                        <Badge key={format} variant="secondary" className="text-xs bg-green-50 text-green-700 border border-green-200">
                          {format}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mt-3 p-3 bg-green-50 rounded-lg border border-green-200">
                  <p className="text-xs font-medium text-green-800">
                    Required Headers (exact match):
                  </p>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    <Badge variant="outline" className="text-xs bg-white border-green-300 text-green-700">
                      Date
                    </Badge>
                    <Badge variant="outline" className="text-xs bg-white border-green-300 text-green-700">
                      Brand
                    </Badge>
                    <Badge variant="outline" className="text-xs bg-white border-green-300 text-green-700">
                      Product
                    </Badge>
                    <Badge variant="outline" className="text-xs bg-white border-green-300 text-green-700">
                      Total Sales (PHP)
                    </Badge>
                    <Badge variant="outline" className="text-xs bg-white border-green-300 text-green-700">
                      Units Sold
                    </Badge>
                    <Badge variant="outline" className="text-xs bg-white border-green-300 text-green-700">
                      Season
                    </Badge>
                  </div>
                  <p className="text-[11px] text-green-600 mt-1.5">
                    Headers are case-sensitive and must match exactly
                  </p>
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
                      {uploadedDataName.endsWith(".csv") ? (
                        <File className="size-4" />
                      ) : (
                        <FileSpreadsheet className="size-4" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900 truncate max-w-[150px]">
                        {uploadedDataName}
                      </p>
                      <p className="text-xs text-gray-500">
                        {uploadedData.length} rows • {computedProductDetails.length} products
                      </p>
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
                        onClick={() => setShowRemoveDialog(true)}
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
                <h3 className="text-lg font-semibold text-gray-900">
                  Remove Uploaded Data?
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  Are you sure you want to remove this uploaded sales data? This
                  will also clear all analysis and forecast results.
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
                onClick={() => {
                  handleRemoveData();
                  setShowRemoveDialog(false);
                }}
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
                      {salesData.length} records • {computedProductDetails.length} products
                    </p>
                  </div>
                  <TrendingUp className="w-10 h-10 opacity-70" />
                </div>
              </CardContent>
            </Card>

            <Card className="border border-green-200 border-2 border-green-900 bg-green-50/60 shadow-sm">
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

            <Card className="border border-blue-200 border-2 border-blue-600 bg-blue-50/60 shadow-sm">
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
                      ? "Sales Trend Analysis"
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
            <CardContent>
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
              <div className="flex items-center justify-center gap-5 rounded-xl border border-emerald-100 bg-emerald-50/50 p-4 text-sm text-slate-700">
                <div className="flex items-center gap-2">
                  <span className="h-1.5 w-8 rounded bg-green-900"></span>
                 Sales
                </div>
                {forecastData && (
                  <div className="flex items-center gap-2">
                    <span className="h-1.5 w-8 border-t-2 border-dashed border-green-500"></span>
                    Forecasted Sales
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
              <Card className="border border-blue-200 border-2 border-blue-600 bg-blue-50/50 shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-blue-800">
                    <CloudRain className="w-5 h-5" />
                    Rainy Season Analysis
                  </CardTitle>
                  <CardDescription>
                    Based on {computedSeasonalData.rainy.monthCount} months
                  </CardDescription>
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

              <Card className="border border-green-200 border-2 border-green-900 bg-green-50/50 shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-green-700">
                    <Sun className="w-5 h-5" />
                    Dry Season Analysis
                  </CardTitle>
                  <CardDescription>
                    Based on {computedSeasonalData.dry.monthCount} months
                  </CardDescription>
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

          {topProductsBySeason && (
            <Card className="shadow-lg border-0 overflow-hidden">
              <div className="bg-gradient-to-r from-green-900 to-emerald-600 px-6 py-4">
                <div className="flex items-center gap-3">
                  <Lightbulb className="w-5 h-5 text-white" />
                  <div>
                    <h3 className="text-lg font-bold text-white">Top Product Per Season</h3>
                  </div>
                </div>
              </div>
              <CardContent>
                <Tabs defaultValue="dry" className="w-full">
                  <div className="items-center justify-between ml-125">  
                  <TabsList className="grid w-full max-w-sm grid-cols-2 mb-6">
                    <TabsTrigger value="dry" className="data-[state=active]:bg-[#174d32] data-[state=active]:text-white">
                      Dry Season
                    </TabsTrigger>
                    <TabsTrigger value="rainy" className="data-[state=active]:bg-blue-700 data-[state=active]:text-white">
                      Rainy Season
                    </TabsTrigger>
                  </TabsList>
                  </div>

                  <TabsContent value="dry">
                    <Card className="border border-green-200 bg-green-50/30 shadow-sm">
                      <CardHeader className="border-b border-green-100">
                        <div className="flex justify-between items-center">
                          <div>
                            <CardTitle className="flex items-center gap-2 text-lg text-green-800">
                              <Sun className="size-5" />
                              Dry Season
                            </CardTitle>
                            <CardDescription>November – May</CardDescription>
                          </div>
                          <Badge className="bg-[#174d32] text-white">
                            {topProductsBySeason.dry.length} Products
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent>
                        {topProductsBySeason.dry.length > 0 ? (
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="w-16" style={{ color: '#174d32' }}>Rank</TableHead>
                                <TableHead style={{ color: '#174d32' }}>Brand</TableHead>
                                <TableHead style={{ color: '#174d32' }}>Product</TableHead>
                                <TableHead style={{ color: '#174d32' }}>Total Units Sold</TableHead>
                                <TableHead style={{ color: '#174d32' }}>Total Revenue</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {topProductsBySeason.dry.map((product: SeasonProduct, index: number) => (
                                <TableRow key={product.productKey} className="hover:bg-gray-50 transition-colors">
                                  <TableCell>
                                    <Badge className="bg-[#174d32]">#{index + 1}</Badge>
                                  </TableCell>
                                  <TableCell>
                                    <p className="font-semibold text-sm">{product.brand}</p>
                                  </TableCell>
                                  <TableCell>
                                    <p className="font-medium text-sm">{product.name}</p>
                                  </TableCell>
                                  <TableCell className="font-medium">
                                    {product.totalUnits.toLocaleString()}
                                  </TableCell>
                                  <TableCell className="font-bold">
                                    ₱{product.revenue.toLocaleString()}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        ) : (
                          <div className="text-center py-8 text-gray-500">
                            <p>No products found for Dry season.</p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="rainy">
                    <Card className="border border-blue-200 bg-blue-50/30 shadow-sm">
                      <CardHeader className="border-b border-blue-100">
                        <div className="flex justify-between items-center">
                          <div>
                            <CardTitle className="flex items-center gap-2 text-lg text-blue-800">
                              <CloudRain className="size-5" />
                              Rainy Season
                            </CardTitle>
                            <CardDescription>June – October</CardDescription>
                          </div>
                          <Badge className="bg-blue-700 text-white">
                            {topProductsBySeason.rainy.length} Products
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent>
                        {topProductsBySeason.rainy.length > 0 ? (
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="w-16" style={{ color: '#1d4ed8' }}>Rank</TableHead>
                                <TableHead style={{ color: '#1d4ed8' }}>Brand</TableHead>
                                <TableHead style={{ color: '#1d4ed8' }}>Product</TableHead>
                                <TableHead style={{ color: '#1d4ed8' }}>Total Units Sold</TableHead>
                                <TableHead style={{ color: '#1d4ed8' }}>Total Revenue</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {topProductsBySeason.rainy.map((product: SeasonProduct, index: number) => (
                                <TableRow key={product.productKey} className="hover:bg-gray-50 transition-colors">
                                  <TableCell>
                                    <Badge className="bg-blue-700">#{index + 1}</Badge>
                                  </TableCell>
                                  <TableCell>
                                    <p className="font-semibold text-sm">{product.brand}</p>
                                  </TableCell>
                                  <TableCell>
                                    <p className="font-medium text-sm">{product.name}</p>
                                  </TableCell>
                                  <TableCell className="font-medium">
                                    {product.totalUnits.toLocaleString()}
                                  </TableCell>
                                  <TableCell className="font-bold">
                                    ₱{product.revenue.toLocaleString()}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        ) : (
                          <div className="text-center py-8 text-gray-500">
                            <p>No products found for Rainy season.</p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          )}

          {/* FIXED: Stock Recommendations with working dropdown */}
          {isDataSaved && stockRecommendations.length > 0 && (
            <Card className="shadow-lg border-0 overflow-visible">
              <div className="rounded-t-xl bg-gradient-to-r from-green-900 to-emerald-600 px-6 py-4">
                <div className="flex items-center gap-3">
                  <Lightbulb className="w-5 h-5 text-white" />
                  <div>
                    <h3 className="text-lg font-bold text-white">Product Stock Recommendations</h3>
                   
                  </div>
                </div>
              </div>

              <CardContent className="overflow-visible p-4">
                {(() => {
                  const groupedByAction = stockRecommendations.reduce((acc: any, category: any) => {
                    const action = category.action || "Maintain";
                    if (!acc[action]) acc[action] = [];
                    acc[action].push(category);
                    return acc;
                  }, {});

                  const actionOrder = ["Increase", "Maintain"];

                  return (
                    <div className="space-y-6">
                      {actionOrder
                        .filter((action) => groupedByAction[action])
                        .map((action) => {
                          const isIncrease = action === "Increase";
                          const borderColor = isIncrease ? "border-orange-500" : "border-green-900";
                          const bgColor = isIncrease ? "bg-orange-50/30" : "bg-green-50/30";
                          const headerBg = isIncrease ? "bg-orange-50/50" : "bg-green-50/50";
                          const headerText = isIncrease ? "text-orange-700" : "text-green-700";
                          const rowHover = isIncrease ? "hover:bg-orange-50/30" : "hover:bg-green-50/30";
                          const productText = isIncrease ? "text-orange-800" : "text-gray-800";
                          const recommendedText = isIncrease ? "text-orange-600" : "text-green-600";
                          const actionBadge = isIncrease
                            ? "bg-orange-100 text-orange-700"
                            : "bg-green-100 text-green-700";
                          const peakBadge = isIncrease
                            ? "bg-orange-200 text-orange-800"
                            : "bg-green-200 text-green-800";
                          
                          const actionLabel = isIncrease ? "Increase before peak month" : "Maintain current stock";

                          return (
                            <div
                              key={action}
                              className={`border-2 rounded-lg ${borderColor} ${bgColor} rounded-r-lg p-4 overflow-visible`}
                            >
                              <div className="flex items-center gap-3 mb-4 pb-3 border-b border-gray-200">
                                <h4 className="text-md font-semibold text-gray-700">
                                  {action} Stock
                                </h4>
                              </div>

                              <div className="overflow-x-auto overflow-visible">
                                <table className="w-full text-sm table-fixed overflow-visible">
                                  <thead>
                                    <tr className={headerBg}>
                                      <th className={`text-left px-3 py-2 text-xs font-semibold ${headerText} w-[40%]`}>
                                        Product
                                      </th>
                                      <th className={`text-center px-3 py-2 text-xs font-semibold ${headerText} w-[20%]`}>
                                        Recommended
                                      </th>
                                      <th className={`text-center px-3 py-2 text-xs font-semibold ${headerText} w-[20%]`}>
                                        Peak Month
                                      </th>
                                      <th className={`text-left px-3 py-2 text-xs font-semibold ${headerText} w-[20%]`}>
                                        Action
                                      </th>
                                    </tr>
                                  </thead>
                                  <tbody>

{groupedByAction[action].map((category: any, idx: number) => {
  const categoryKey = category.category;
  const currentStock = productStockStates[categoryKey] !== undefined 
    ? productStockStates[categoryKey] 
    : category.defaultStock || 60;
  
  const monthLabels = category.items.map((item: any) => item.month);
  
  // Create recommendations map with month-specific stock values
  const recommendationsMap = category.items.map((item: any) => ({
    month: item.month,
    recommendedStock: item.recommendedStock, // This should be different per month
    peakUnits: item.peakUnits,
    peakSales: item.peakSales,
  }));
  
  const updateStock = (stock: number) => {
    setProductStockStates(prev => ({
      ...prev,
      [categoryKey]: stock
    }));
  };
  
  return (
    <tr key={idx} className={`border-b border-gray-100 ${rowHover} transition-colors`}>
      <td className="px-3 py-3">
        <span className={`font-medium text-sm ${productText}`}>
          {category.category}
        </span>
      </td>
      
      <td className={`text-center px-3 py-3 text-sm font-bold ${recommendedText}`}>
        {currentStock} units
      </td>
      
      <td className="text-center px-3 py-3">
        {monthLabels.length > 0 && monthLabels[0] !== "No data" ? (
          <MonthDropdown 
            months={monthLabels} 
            badgeClass={peakBadge}
            recommendations={recommendationsMap}
            currentStock={currentStock}
            setCurrentStock={updateStock}
          />
        ) : (
          <span className="text-xs text-gray-400">No data</span>
        )}
      </td>
      
      <td className="px-3 py-3">
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${actionBadge} whitespace-nowrap`}>
          {actionLabel}
        </span>
      </td>
    </tr>
  );
})}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          )}

          {(bestSellingProducts.length > 0 || slowMovingProducts.length > 0) && (
            <section>
              <div className="bg-gradient-to-r from-green-900 to-emerald-600 rounded-t-2xl px-6 py-4">
                <div className="flex items-center gap-3">
                  <Target className="size-5 text-white" />
                  <div>
                    <h3 className="text-lg font-bold text-white">Product Performance</h3>
                  </div>
                </div>
              </div>
              
              <div className="bg-white rounded-b-2xl shadow-lg border border-t-0 border-gray-200 p-4">
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                  {bestSellingProducts.length > 0 && (
                    <Card className="shadow-lg border-1 border-green-300 hover:shadow-xl transition-all duration-300">
                      <CardHeader className="bg-gradient-to-r from-green-900 to-emerald-700 rounded-t-lg border-b border-green-900 !p-2">
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
                        {bestSellingProducts.map((product: any, index: number) => (
                          <div key={index} className="border rounded-lg p-3 hover:shadow-md transition">
                            <div className="flex justify-between items-start">
                              <div>
                                <h4 className="font-semibold text-gray-800 text-sm">{product.name}</h4>
                                <p className="text-xs text-gray-500">
                                  {product.unitsSold?.toLocaleString() || 0} units
                                </p>
                              </div>
                              <div className="text-right">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-green-600"> Dry: {product.dryUnits || 0}</span>
                                  <span className="text-xs text-blue-600"> Rainy: {product.rainyUnits || 0}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  )}

                  {slowMovingProducts.length > 0 && (
                    <Card className=" border-1 border-orange-300 shadow-lg hover:shadow-xl transition-all duration-300">
                      <CardHeader className="bg-gradient-to-r from-orange-700 to-amber-600 rounded-t-lg border-b border-orange-100 !p-2">
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
                        {slowMovingProducts.map((product: any, index: number) => (
                          <div key={index} className="border rounded-lg p-3 hover:shadow-md transition">
                            <div className="flex justify-between items-start">
                              <div>
                                <h4 className="font-semibold text-gray-800 text-sm">{product.name}</h4>
                                <p className="text-xs text-gray-500">
                                  {product.unitsSold?.toLocaleString() || 0} units sold
                                </p>
                              </div>
                              <div className="text-right">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-green-600"> Dry: {product.dryUnits || 0}</span>
                                  <span className="text-xs text-blue-600"> Rainy: {product.rainyUnits || 0}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  )}
                </div>
              </div>
            </section>
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
                <span>Generating Marketing Strategies...</span>
              </>
            ) : (
              <>
                <Zap className="size-5" />
                Generate Marketing Strategies
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
          {forecastData.marketingStrategies?.length > 0 && (
            <section className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-white flex items-center justify-center shadow-sm">
                  <Lightbulb className="size-5 text-green-700" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900 tracking-tight">
                    AI-Generated Marketing Strategies
                  </h2>
                </div>
              </div>
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {forecastData.marketingStrategies.map((strategy: any, index: number) => {
                  const drySeason = (strategy.season || "").toLowerCase().includes("dry");
                  return (
                    <Card
                      key={index}
                      className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden"
                    >
                      <div
                        className={`${
                          drySeason
                            ? "bg-gradient-to-r from-green-900 to-emerald-600"
                            : "bg-gradient-to-r from-blue-700 to-sky-600"
                        } px-4 py-3`}
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center backdrop-blur-sm">
                            <Lightbulb className="size-4 text-white" />
                          </div>
                          <div>
                            <h3 className="text-sm font-semibold text-white">{strategy.season}</h3>
                            <p className="text-xs text-white/70">
                              {drySeason ? "November – May" : "June – October"}
                            </p>
                          </div>
                          <Badge
                            className={`ml-auto ${
                              drySeason ? "bg-white/20 text-white" : "bg-white/20 text-white"
                            } border-0`}
                          >
                            {(strategy.strategies || []).length} strategies
                          </Badge>
                        </div>
                      </div>

                      <CardContent>
                        <div className="grid gap-2.5">
                          {(strategy.strategies || []).map((item: string, i: number) => (
                            <div
                              key={i}
                              className="flex gap-3 rounded-xl border border-gray-100 bg-white p-3 hover:shadow-md transition-all hover:border-gray-200"
                            >
                              <div
                                className={`flex h-7 w-7 items-center justify-center rounded-full flex-shrink-0 ${
                                  drySeason ? "bg-green-100" : "bg-blue-100"
                                }`}
                              >
                                <CheckCircle2
                                  className={`size-4 ${drySeason ? "text-green-600" : "text-blue-700"}`}
                                />
                              </div>
                              <div className="flex-1">
                                <p className="text-sm font-medium text-gray-700">Strategy {i + 1}</p>
                                <p className="text-sm leading-relaxed text-gray-600 break-words mt-0.5">
                                  {item}
                                </p>
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