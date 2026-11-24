  import { useMemo, useState, useEffect, useRef } from "react";
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

  import {
    ComposedChart,
    LineChart,
    Line,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    ReferenceArea,
    PieChart,
    Pie,
    Cell,
    Legend,
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
    Trash2,
    List,
    PieChart as PieChartIcon,
    Plus,
    Pencil,
  } from "lucide-react";

  import Papa from "papaparse";
  import * as XLSX from "xlsx";
  import { useAuth } from "../context/AuthContext";
  import {
    saveSalesForecastData,
    getSalesForecastData,
    clearSalesForecastData,
  } from "../lib/supabase";

  // Import Google Generative AI
  import { GoogleGenerativeAI } from "@google/generative-ai";

  // Initialize Gemini AI
  const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY || '');

  // Season-specific color palettes ordered from most saturated/dark (highest contributor) to least vibrant/lightest (least top contributor in top 50%)
  const DRY_DONUT_COLORS = [
    "#0f3d24", "#174d32", "#1a6b3f", "#22884f", "#2fa862",
    "#4ec07f", "#6ee7b7", "#86efac", "#a7f3d0", "#bbf7d0",
  ];

  const RAINY_DONUT_COLORS = [
    "#1e3a8a", "#1e40af", "#1d4ed8", "#2563eb", "#3b82f6",
    "#60a5fa", "#7dd3fc", "#93c5fd", "#bae6fd", "#dbeafe",
  ];

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
    rank?: number;
  }

  const MONTH_NAMES = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];

  const SEASON_FOR_MONTH = (monthIndex: number): string => {
    if (monthIndex >= 10 || monthIndex <= 3) return "Dry";
    return "Rainy";
  };

  const getMonthIndexFromName = (monthName: string): number => {
    const monthNames = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December",
    ];
    const shortNames = [
      "Jan", "Feb", "Mar", "Apr", "May", "Jun",
      "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
    ];

    const trimmed = monthName.trim();

    const fullIndex = monthNames.findIndex((m) => m.toLowerCase() === trimmed.toLowerCase());
    if (fullIndex !== -1) return fullIndex;

    const shortIndex = shortNames.findIndex((m) => m.toLowerCase() === trimmed.toLowerCase());
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

  // MonthDropdown component
  const MonthDropdown = ({ 
    months, 
    badgeClass,
    recommendations,
    onMonthSelect,
    currentStock,
    setCurrentStock,
    actionType
  }: { 
    months: string[], 
    badgeClass: string,
    recommendations?: { month: string; recommendedStock: number; peakUnits: number; peakSales: number }[],
    onMonthSelect?: (month: string, stock: number) => void,
    currentStock?: number,
    setCurrentStock?: (stock: number) => void,
    actionType?: string
  }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [selectedMonth, setSelectedMonth] = useState<string>(
      months.length > 0 && months[0] !== "No data" && months[0] !== "" ? months[0] : "No data"
    );
    const [dropdownPosition, setDropdownPosition] = useState<{ top: number; left: number } | null>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);
    
    const validMonths = months.filter(m => m !== "No data" && m !== "");
    const firstMonth = validMonths.length > 0 ? validMonths[0] : "No data";
    
    const isIncrease = actionType === "Increase";
    
    const buttonBgColor = isIncrease ? 'bg-orange-500 hover:bg-orange-600' : 'bg-green-700 hover:bg-green-800';
    const buttonTextColor = 'text-white';
    
    const selectedBgColor = isIncrease ? 'bg-orange-100' : 'bg-green-100';
    const selectedTextColor = isIncrease ? 'text-orange-700' : 'text-green-700';
    const selectedStockColor = isIncrease ? 'text-orange-600' : 'text-green-600';
    const hoverBgColor = isIncrease ? 'hover:bg-orange-50' : 'hover:bg-green-50';
    const borderColor = isIncrease ? 'border-orange-200' : 'border-green-200';
    const headerColor = isIncrease ? 'text-orange-600' : 'text-green-600';
    
    const getStockForMonth = (monthLabel: string): number | null => {
      if (!recommendations) return null;
      const found = recommendations.find(r => r.month === monthLabel);
      return found ? found.recommendedStock : null;
    };
    
    useEffect(() => {
      const handleClickOutside = (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        if (isOpen && !target.closest('.month-dropdown-container')) {
          setIsOpen(false);
          setDropdownPosition(null);
        }
      };
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);
    
    const handleMonthClick = (month: string) => {
      const stock = getStockForMonth(month);
      if (stock !== null) {
        setSelectedMonth(month);
        if (setCurrentStock) setCurrentStock(stock);
        if (onMonthSelect) onMonthSelect(month, stock);
      }
      setIsOpen(false);
      setDropdownPosition(null);
    };

    const handleButtonClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (isOpen) {
        setIsOpen(false);
        setDropdownPosition(null);
      } else {
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        setDropdownPosition({
          top: rect.bottom + 4,
          left: rect.left + rect.width / 2,
        });
        setIsOpen(true);
      }
    };
    
    if (validMonths.length === 0) {
      return (
        <div className="month-dropdown-container relative inline-block" style={{ overflow: 'visible' }}>
          <span className="text-xs text-gray-400">No data</span>
        </div>
      );
    }
    
    const displayMonth = selectedMonth !== "No data" ? selectedMonth : firstMonth;
    
    return (
      <div className="month-dropdown-container relative inline-block" style={{ overflow: 'visible' }}>
        <button
          ref={buttonRef}
          onClick={handleButtonClick}
          className={`${buttonBgColor} ${buttonTextColor} text-xs font-medium whitespace-nowrap px-2 py-1 rounded-full flex items-center gap-1 hover:opacity-90 transition cursor-pointer relative z-10`}
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
        
        {isOpen && dropdownPosition && createPortal(
          <div 
            className="fixed bg-white rounded-lg shadow-2xl border py-1 max-h-64 overflow-y-auto min-w-[180px]"
            style={{
              top: dropdownPosition.top,
              left: dropdownPosition.left,
              transform: 'translateX(-50%)',
              zIndex: 999999,
              borderColor: isIncrease ? '#fbd38d' : '#86efac',
            }}
          >
            <div className={`px-3 py-1.5 text-xs font-semibold ${headerColor} border-b ${borderColor} bg-gray-50 sticky top-0`}>
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
                      ? `${selectedBgColor} ${selectedTextColor} font-medium` 
                      : `${hoverBgColor} text-gray-700`
                  }`}
                >
                  <div className="flex justify-between items-center gap-3">
                    <div className="flex items-center gap-2">
                      {isSelected && <span className="text-[10px]">✓</span>}
                      <span>{month}</span>
                    </div>
                    {stock !== null && (
                      <span className={`text-xs font-bold ${isSelected ? selectedStockColor : 'text-gray-500'}`}>
                        {stock} units
                      </span>
                    )}
                  </div>
                  {isSelected && (
                    <div className={`text-[10px] ${selectedStockColor} mt-0.5`}>
                      ✓ Currently selected
                    </div>
                  )}
                </div>
              );
            })}
          </div>,
          document.body
        )}
      </div>
    );
  };

  // ============ Recommended Stock Dropdown ============
  const OPEN_DROPDOWN_REGISTRY = {
    currentId: null as string | null,
    listeners: new Set<(id: string | null) => void>(),
    set(id: string | null) {
      if (this.currentId === id) return;
      this.currentId = id;
      this.listeners.forEach((fn) => fn(id));
    },
    subscribe(fn: (id: string | null) => void) {
      this.listeners.add(fn);
      return () => {
        this.listeners.delete(fn);
      };
    },
  };

  const RecommendedStockDropdown = ({
    items,
    pillBg,
    isIncrease,
  }: {
    items: { month: string; year: number; units: number; recommended: number }[];
    pillBg: string;
    isIncrease: boolean;
  }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [dropdownPosition, setDropdownPosition] = useState<{
      top: number;
      left: number;
      maxHeight: number;
    } | null>(null);

    const buttonRef = useRef<HTMLButtonElement>(null);
    const instanceIdRef = useRef<string>(
      `stock-dd-${Math.random().toString(36).slice(2)}`
    );
    const openedAtRef = useRef<number>(0);
    const lastButtonRectRef = useRef<DOMRect | null>(null);

    // ── 1) Click outside → close ──────────────────────────────
    useEffect(() => {
      const handleClickOutside = (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        if (isOpen && !target.closest(".recommended-stock-container")) {
          setIsOpen(false);
          setDropdownPosition(null);
          if (OPEN_DROPDOWN_REGISTRY.currentId === instanceIdRef.current) {
            OPEN_DROPDOWN_REGISTRY.set(null);
          }
        }
      };
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [isOpen]);

    // ── 2) Only one dropdown open at a time ───────────────────
    useEffect(() => {
      const unsubscribe = OPEN_DROPDOWN_REGISTRY.subscribe((activeId) => {
        if (isOpen && activeId !== instanceIdRef.current) {
          setIsOpen(false);
          setDropdownPosition(null);
        }
      });
      return () => {
        unsubscribe();
        if (OPEN_DROPDOWN_REGISTRY.currentId === instanceIdRef.current) {
          OPEN_DROPDOWN_REGISTRY.set(null);
        }
      };
    }, [isOpen]);

    // ── 3) Position on open + on resize; close on REAL scroll ─
    useEffect(() => {
      if (!isOpen) return;

      const computePosition = () => {
        if (!buttonRef.current) return null;
        const rect = buttonRef.current.getBoundingClientRect();
        lastButtonRectRef.current = rect;

        const viewportH = window.innerHeight;
        const viewportW = window.innerWidth;
        const GAP = 6;
        const MAX_DROPDOWN_H = 320;
        const MIN_DROPDOWN_H = 140;
        const DROPDOWN_W = 260;

        const spaceBelow = viewportH - rect.bottom - GAP;
        const spaceAbove = rect.top - GAP;
        const useTop = spaceBelow < MIN_DROPDOWN_H && spaceAbove > spaceBelow;

        const maxHeight = Math.min(
          MAX_DROPDOWN_H,
          Math.max(MIN_DROPDOWN_H, (useTop ? spaceAbove : spaceBelow) - 8)
        );

        const left = Math.min(
          Math.max(8, rect.left),
          Math.max(8, viewportW - DROPDOWN_W - 8)
        );

        const top = useTop
          ? Math.max(8, rect.top - Math.min(maxHeight, spaceAbove) - GAP)
          : rect.bottom + GAP;

        return { top, left, maxHeight };
      };

      // Immediately compute position (no waiting)
      openedAtRef.current = Date.now();
      const initial = computePosition();
      if (initial) setDropdownPosition(initial);

      const handleResize = () => {
        const next = computePosition();
        if (next) setDropdownPosition(next);
      };

      const handleScrollCapture = (e: Event) => {
        // Guard 1: Ignore the first 150ms after opening (opening-click phantom scroll)
        if (Date.now() - openedAtRef.current < 150) return;

        const target = e.target as HTMLElement | null;

        // Guard 2: Don't close on scrolls inside the dropdown itself
        if (target && target.closest(".recommended-stock-dropdown-panel")) {
          return;
        }

        // Guard 3: Only close if the button actually moved
        if (buttonRef.current && lastButtonRectRef.current) {
          const now = buttonRef.current.getBoundingClientRect();
          const prev = lastButtonRectRef.current;
          const moved =
            Math.abs(now.top - prev.top) > 2 ||
            Math.abs(now.left - prev.left) > 2;
          if (!moved) return;
        }

        setIsOpen(false);
        setDropdownPosition(null);
        if (OPEN_DROPDOWN_REGISTRY.currentId === instanceIdRef.current) {
          OPEN_DROPDOWN_REGISTRY.set(null);
        }
      };

      window.addEventListener("resize", handleResize);
      window.addEventListener("scroll", handleScrollCapture, true);

      return () => {
        window.removeEventListener("resize", handleResize);
        window.removeEventListener("scroll", handleScrollCapture, true);
      };
    }, [isOpen]);

    const handleButtonClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (isOpen) {
        setIsOpen(false);
        setDropdownPosition(null);
        if (OPEN_DROPDOWN_REGISTRY.currentId === instanceIdRef.current) {
          OPEN_DROPDOWN_REGISTRY.set(null);
        }
      } else {
        OPEN_DROPDOWN_REGISTRY.set(instanceIdRef.current);
        setIsOpen(true);
      }
    };

    if (items.length === 0) {
      return <span className="text-xs text-gray-400">No data</span>;
    }

    const accentText = isIncrease ? "text-orange-700" : "text-green-700";
    const accentBg = isIncrease ? "bg-orange-50" : "bg-green-50";
    const accentBorder = isIncrease ? "border-orange-200" : "border-green-200";
    const hoverRow = isIncrease ? "hover:bg-orange-50/60" : "hover:bg-green-50/60";
    const headerBg = isIncrease ? "bg-orange-100" : "bg-green-100";

    const avgRecommended = Math.round(
      items.reduce((s, i) => s + i.recommended, 0) / items.length
    );

    return (
      <div
        className="recommended-stock-container relative inline-block"
        style={{ overflow: "visible" }}
      >
        <button
          ref={buttonRef}
          onClick={handleButtonClick}
          className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium transition hover:opacity-90 cursor-pointer ${pillBg}`}
          type="button"
        >
          <span className="font-bold">{avgRecommended}</span>
          <span className="opacity-80">avg units</span>
          <svg
            className={`w-3 h-3 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </button>

        {isOpen &&
          dropdownPosition &&
          createPortal(
            <div
              className="recommended-stock-dropdown-panel fixed bg-white rounded-lg shadow-2xl border overflow-hidden flex flex-col"
              style={{
                top: dropdownPosition.top,
                left: dropdownPosition.left,
                width: 260,
                maxHeight: dropdownPosition.maxHeight,
                zIndex: 999999,
                borderColor: isIncrease ? "#fbd38d" : "#86efac",
              }}
            >
              <div
                className={`px-3 py-2 text-xs font-semibold ${accentText} border-b ${accentBorder} ${headerBg} flex items-center justify-between flex-shrink-0`}
              >
                <span>2025 Recommended Stock</span>
                <span className="text-[10px] opacity-70">per month</span>
              </div>

              <div className="overflow-y-auto season-table-scroll flex-1 min-h-0">
                {items.map((m, i) => (
                  <div
                    key={i}
                    className={`flex items-center justify-between gap-3 px-3 py-2 text-xs border-b border-gray-50 last:border-0 ${hoverRow}`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className={`inline-flex items-center justify-center text-[10px] font-semibold rounded ${accentBg} ${accentText} px-1.5 py-0.5 flex-shrink-0`}
                      >
                        {m.month}
                      </span>
                      <span className="text-gray-700 flex-shrink-0">2025</span>
                      <span className="text-gray-400 text-[10px] truncate">
                        ({m.units}u avg/ref)
                      </span>
                    </div>
                    <span className={`font-bold ${accentText} flex-shrink-0`}>
                      {m.recommended} units
                    </span>
                  </div>
                ))}
              </div>
            </div>,
            document.body
          )}
      </div>
    );
  };
  // ============ END COMPONENT ============
  // ============ Per-Product Donut Chart Component ============
  const SeasonDonutChart = ({
    products,
    season,
    topUnits,
    topRevenue,
    otherUnits,
    totalUnits,
  }: {
    products: { productKey: string; name: string; brand: string; units: number; revenue: number; percentShare: number }[];
    season: "dry" | "rainy";
    topUnits: number;
    topRevenue: number;
    otherUnits: number;
    totalUnits: number;
  }) => {
    const isDry = season === "dry";
    const colors = isDry ? DRY_DONUT_COLORS : RAINY_DONUT_COLORS;
    const otherColor = isDry ? "#d1d5db" : "#cbd5e1";

    const chartData = useMemo(() => {
      const base = products.map((p) => ({
        name: `${p.brand} ${p.name}`.trim(),
        value: p.units,
        revenue: p.revenue,
        percentShare: p.percentShare,
        isOther: false,
      }));

      if (otherUnits > 0) {
        base.push({
          name: "Other Products",
          value: otherUnits,
          revenue: 0,
          percentShare: totalUnits > 0 ? (otherUnits / totalUnits) * 100 : 0,
          isOther: true,
        });
      }

      return base;
    }, [products, otherUnits, totalUnits]);

    if (chartData.length === 0) {
      return (
        <div
          style={{ width: "100%", height: 320 }}
          className="flex items-center justify-center text-sm text-gray-400"
        >
          No data available for chart.
        </div>
      );
    }

    const grandTotal = chartData.reduce((sum, d) => sum + d.value, 0);
    const topContributors = chartData.filter((d) => !d.isOther);
    const topContributorTotal = topContributors.reduce((sum, d) => sum + d.value, 0);

    return (
      <div className="w-full">
        <div className="grid grid-cols-2 gap-3 mb-2">
          <div
            className={`rounded-lg border px-3 py-1.5 ${
              isDry ? "border-green-200 bg-green-50" : "border-blue-200 bg-blue-50"
            }`}
          >
            <p className={`text-[10px] uppercase tracking-wide font-semibold ${isDry ? "text-green-700" : "text-blue-700"}`}>
              Total Units Sold
            </p>
            <p className={`text-base font-bold ${isDry ? "text-green-900" : "text-blue-900"}`}>
              {topUnits.toLocaleString()}
            </p>
          </div>
          <div
            className={`rounded-lg border px-3 py-1.5 ${
              isDry ? "border-green-200 bg-green-50" : "border-blue-200 bg-blue-50"
            }`}
          >
            <p className={`text-[10px] uppercase tracking-wide font-semibold ${isDry ? "text-green-700" : "text-blue-700"}`}>
              Total Revenue
            </p>
            <p className={`text-base font-bold ${isDry ? "text-green-900" : "text-blue-900"}`}>
              ₱{topRevenue.toLocaleString()}
            </p>
          </div>
        </div>

        <div style={{ width: "100%", height: 225, position: "relative" }}>
          <ResponsiveContainer width="100%" height={225}>
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={56}
                outerRadius={92}
                paddingAngle={2}
                dataKey="value"
                nameKey="name"
                stroke="#fff"
                strokeWidth={2}
                isAnimationActive={false}
              >
                {chartData.map((entry, index) => {
                  const colorIdx = Math.min(
                    colors.length - 1,
                    Math.floor((index / Math.max(1, topContributors.length - 1)) * (colors.length - 1))
                  );
                  return (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.isOther ? otherColor : colors[colorIdx]}
                    />
                  );
                })}
              </Pie>
              <Tooltip
                contentStyle={{
                  borderRadius: 12,
                  border: "none",
                  boxShadow: "0 10px 30px rgba(0,0,0,.15)",
                  fontSize: 12,
                }}
                formatter={(value: number, name: string, entry: any) => {
                  const pct = grandTotal > 0 ? (value / grandTotal) * 100 : 0;
                  const rev = entry?.payload?.revenue ?? 0;
                  const label = entry?.payload?.isOther
                    ? `${value.toLocaleString()} units (${pct.toFixed(1)}%) — remaining products`
                    : `${value.toLocaleString()} units (${pct.toFixed(1)}%) • ₱${rev.toLocaleString()}`;
                  return [label, name];
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Progress-bar style saturation legend for Top 50% Contributors */}
        <div
          className={`mt-1.5 rounded-lg border px-3 py-2 ${
            isDry ? "border-green-200/80 bg-white/80" : "border-blue-200/80 bg-white/80"
          }`}
        >
          <div className="flex items-center justify-between text-[10px] font-semibold mb-1">
            <span className={isDry ? "text-green-900" : "text-blue-900"}>
              ● Highest Contributor
            </span>
            <span className="text-gray-500 font-medium">
              Top 50% Contribution Scale
            </span>
            <span className={isDry ? "text-green-600" : "text-blue-500"}>
              Least Top Contributor ●
            </span>
          </div>

          {/* Segmented Progress Bar matching each top contributor's share & saturation */}
          <div className="h-3 w-full rounded-full overflow-hidden flex border border-gray-200/80 shadow-inner bg-gray-100">
            {topContributors.map((item, idx) => {
              const widthPct =
                topContributorTotal > 0
                  ? (item.value / topContributorTotal) * 100
                  : 100 / Math.max(1, topContributors.length);
              const colorIdx = Math.min(
                colors.length - 1,
                Math.floor((idx / Math.max(1, topContributors.length - 1)) * (colors.length - 1))
              );
              return (
                <div
                  key={idx}
                  style={{
                    width: `${widthPct}%`,
                    backgroundColor: colors[colorIdx],
                  }}
                  className="h-full first:rounded-l-full last:rounded-r-full border-r border-white/40 last:border-r-0 transition-all"
                  title={`#${idx + 1} ${item.name}: ${item.value.toLocaleString()} units (${item.percentShare.toFixed(1)}%)`}
                />
              );
            })}
          </div>

          <div className="mt-1.5 flex items-center justify-between text-[10px] text-gray-600">
            <span className="truncate max-w-[45%] font-medium" title={topContributors[0]?.name}>
              #1 {topContributors[0]?.name || "—"}
            </span>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <span
                className="inline-block size-2 rounded-full"
                style={{ backgroundColor: otherColor }}
              />
              <span className="text-gray-500">
                Other ({totalUnits > 0 ? ((otherUnits / totalUnits) * 100).toFixed(1) : "0"}%)
              </span>
            </div>
            {topContributors.length > 1 && (
              <span
                className="truncate max-w-[35%] text-right text-gray-500"
                title={topContributors[topContributors.length - 1]?.name}
              >
                #{topContributors.length} {topContributors[topContributors.length - 1]?.name}
              </span>
            )}
          </div>
        </div>
      </div>
    );
  };
  // ============ END COMPONENT ============

  export default function SeasonalForecasting() {
    const { userEmail } = useAuth();
    const [isLoading, setIsLoading] = useState(true);
    const [syncStatus, setSyncStatus] = useState<"idle" | "syncing" | "success" | "error">("idle");
    const [syncMessage, setSyncMessage] = useState("");

    const [uploadedData, setUploadedData] = useState<any[] | null>(null);
    const [uploadedDataName, setUploadedDataName] = useState("");
    const [uploadedFiles, setUploadedFiles] = useState<{ name: string; rows: any[] }[]>([]);
    const [uploadMode, setUploadMode] = useState<"append" | "replace">("append");
    const [uploadError, setUploadError] = useState("");
    const [isDraggingFile, setIsDraggingFile] = useState(false);
    const [isDataSaved, setIsDataSaved] = useState(false);
    const [isEditingFiles, setIsEditingFiles] = useState(false);
    const [hasFileChanges, setHasFileChanges] = useState(false);
    const hasModifiedFilesInEditRef = useRef<boolean>(false);
    const lastGeneratedFileSignatureRef = useRef<string>("");
    const editSnapshotSignatureRef = useRef<string | null>(null);
    const [hasData, setHasData] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const csvInputRef = useRef<HTMLInputElement | null>(null);

    const [salesData, setSalesData] = useState<SalesRecord[]>([]);
    const [originalData, setOriginalData] = useState<SalesRecord[]>([]);
    const [productDetails, setProductDetails] = useState<ProductDetail[]>([]);

    const [forecastData, setForecastData] = useState<any>(null);
    const [forecastStatus, setForecastStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
    const [lastGenerated, setLastGenerated] = useState<string | null>(null);

    const [viewMode, setViewMode] = useState("monthly");
    const [selectedMonth, setSelectedMonth] = useState("");
    const [timeFilter, setTimeFilter] = useState("all");
    const [chartKey, setChartKey] = useState(0);
    const [isVisible, setIsVisible] = useState(false);
    const [showRemoveDialog, setShowRemoveDialog] = useState(false);

    const [productViewMode, setProductViewMode] = useState<"list" | "chart">("list");
    const [seasonProductYearFilter, setSeasonProductYearFilter] = useState<string>("all");
    const [strategyFilter, setStrategyFilter] = useState<"seasonal" | "product-demand">("seasonal");

    const [productStockStates, setProductStockStates] = useState<Record<string, number>>({});
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
        const cleanBrand = (record.brand || "Unknown").trim().replace(/\s+/g, " ");
        const cleanProduct = (record.product || "Unknown").trim().replace(/\s+/g, " ");
        const productKey = `${cleanBrand.toLowerCase()}__${cleanProduct.toLowerCase()}`;
        const isDry = (record.season || "").trim().toLowerCase() === "dry";

        if (!productMap.has(productKey)) {
          productMap.set(productKey, {
            productKey: productKey,
            product: cleanProduct,
            brand: cleanBrand,
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
      if (!originalData.length) return null;

      const filteredRecords =
        seasonProductYearFilter === "all"
          ? originalData
          : originalData.filter((r) => String(r.year) === seasonProductYearFilter);

      const seasonProductMap = new Map<
        string,
        {
          productKey: string;
          product: string;
          brand: string;
          dryUnits: number;
          drySales: number;
          dryVolume: number;
          rainyUnits: number;
          rainySales: number;
          rainyVolume: number;
        }
      >();

      filteredRecords.forEach((record) => {
        const cleanBrand = (record.brand || "Unknown").trim().replace(/\s+/g, " ");
        const cleanProduct = (record.product || "Unknown").trim().replace(/\s+/g, " ");
        const productKey = `${cleanBrand.toLowerCase()}__${cleanProduct.toLowerCase()}`;
        const isDry = (record.season || "").trim().toLowerCase() === "dry";
        const salesAmount = Number(record.subtotal || record.sales || 0);
        const unitsAmount = Number(record.unitsSold || 0);
        const volumeAmount = Number(record.usedVolume || 0);

        if (!seasonProductMap.has(productKey)) {
          seasonProductMap.set(productKey, {
            productKey,
            product: cleanProduct,
            brand: cleanBrand,
            dryUnits: 0,
            drySales: 0,
            dryVolume: 0,
            rainyUnits: 0,
            rainySales: 0,
            rainyVolume: 0,
          });
        }

        const item = seasonProductMap.get(productKey)!;
        if (isDry) {
          item.dryUnits += unitsAmount;
          item.drySales += salesAmount;
          item.dryVolume += volumeAmount;
        } else {
          item.rainyUnits += unitsAmount;
          item.rainySales += salesAmount;
          item.rainyVolume += volumeAmount;
        }
      });

      const aggregatedProducts = Array.from(seasonProductMap.values());

      const rankItemsWithTies = (items: any[], getUnits: (item: any) => number) => {
        const sorted = [...items].sort((a, b) => getUnits(b) - getUnits(a));
        const uniqueUnits = [...new Set(sorted.map(getUnits))].sort((a, b) => b - a);
        const seenRank = new Set<number>();

        sorted.forEach((item) => {
          const rankNumber = uniqueUnits.indexOf(getUnits(item)) + 1;
          (item as any).rank = rankNumber;

          if (!seenRank.has(rankNumber)) {
            (item as any).displayRank = `#${rankNumber}`;
            seenRank.add(rankNumber);
          } else {
            (item as any).displayRank = null;
          }
        });

        return sorted;
      };

      const buildSeasonData = (products: any[]) => {
        const totalUnits = products.reduce((sum, p) => sum + p.units, 0);
        if (totalUnits === 0) {
          return {
            list: [],
            totalUnits: 0,
            totalRevenue: 0,
            topUnits: 0,
            topRevenue: 0,
            otherUnits: 0,
          };
        }

        const threshold = totalUnits * 0.5;
        let cumulative = 0;
        const topContributors: any[] = [];

        for (const product of products) {
          topContributors.push(product);
          cumulative += product.units;
          if (cumulative >= threshold) break;
        }

        const topUnits = topContributors.reduce((sum, p) => sum + p.units, 0);
        const topRevenue = topContributors.reduce((sum, p) => sum + p.revenue, 0);
        const otherUnits = totalUnits - topUnits;
        const totalRevenue = products.reduce((sum, p) => sum + p.revenue, 0);

        const listWithPct = topContributors.map((p) => ({
          ...p,
          percentShare: totalUnits > 0 ? (p.units / totalUnits) * 100 : 0,
        }));

        return {
          list: listWithPct,
          totalUnits,
          totalRevenue,
          topUnits,
          topRevenue,
          otherUnits,
        };
      };

      const dryProducts = aggregatedProducts
        .filter((p) => p.dryUnits > 0)
        .map((p) => ({
          productKey: p.productKey,
          name: p.product,
          brand: p.brand,
          totalUnits: p.dryUnits,
          revenue: Math.round(p.drySales),
          totalRevenue: Math.round(p.drySales),
          volumeUsed: Math.round(p.dryVolume),
          units: p.dryUnits,
        }));

      const rankedDry = rankItemsWithTies(dryProducts, (item) => item.units);
      const dryResult = buildSeasonData(rankedDry);

      const rainyProducts = aggregatedProducts
        .filter((p) => p.rainyUnits > 0)
        .map((p) => ({
          productKey: p.productKey,
          name: p.product,
          brand: p.brand,
          totalUnits: p.rainyUnits,
          revenue: Math.round(p.rainySales),
          totalRevenue: Math.round(p.rainySales),
          volumeUsed: Math.round(p.rainyVolume),
          units: p.rainyUnits,
        }));

      const rankedRainy = rankItemsWithTies(rainyProducts, (item) => item.units);
      const rainyResult = buildSeasonData(rankedRainy);

      return {
        dry: dryResult,
        rainy: rainyResult,
      };
    }, [originalData, seasonProductYearFilter]);

    // ============ PER-MONTH UNITS SOLD PER PRODUCT ============
    const perMonthUnitsByProduct = useMemo(() => {
      const bucket: Record<string, Record<string, { month: string; monthIndex: number; year: number; units: number }>> = {};

      originalData.forEach((record) => {
        const brand = (record.brand || "").trim();
        const product = (record.product || "").trim();
        const spaceKey = `${brand} ${product}`.trim();
        const hyphenKey = `${brand}-${product}`;

        const monthShort = record.month.substring(0, 3);
        const monthIdx = MONTH_NAMES.indexOf(monthShort);
        if (monthIdx === -1) return;

        const periodKey = `${record.year}-${String(monthIdx + 1).padStart(2, "0")}`;

        [spaceKey, hyphenKey].forEach((key) => {
          if (!key) return;
          if (!bucket[key]) bucket[key] = {};
          if (!bucket[key][periodKey]) {
            bucket[key][periodKey] = {
              month: monthShort,
              monthIndex: monthIdx,
              year: record.year,
              units: 0,
            };
          }
          bucket[key][periodKey].units += record.unitsSold || 0;
        });
      });

      const result: Record<string, { month: string; monthIndex: number; year: number; units: number }[]> = {};
      Object.entries(bucket).forEach(([key, monthsMap]) => {
        result[key] = Object.values(monthsMap).sort((a, b) => {
          if (a.year !== b.year) return a.year - b.year;
          return a.monthIndex - b.monthIndex;
        });
      });
      return result;
    }, [originalData]);

    // ============ AI STOCK RECOMMENDATIONS (2025) ============
    const stockRecommendations = useMemo(() => {
      if (!forecastData?.stockRecommendations || !Array.isArray(forecastData.stockRecommendations)) {
        return [];
      }
      return forecastData.stockRecommendations;
    }, [forecastData]);

    const recommendedStockByProduct = useMemo(() => {
      const result: Record<string, { month: string; year: number; units: number; recommended: number }[]> = {};

      stockRecommendations.forEach((r: any) => {
        if (r?.category && Array.isArray(r.items)) {
          const only2025 = r.items.filter((item: any) => Number(item.year || 2025) === 2025);
          const sourceItems = only2025.length > 0 ? only2025 : r.items;
          result[r.category] = sourceItems.map((item: any) => ({
            month: String(item.month || "").substring(0, 3),
            year: 2025,
            units: Number(item.units ?? item.peakUnits ?? 0),
            recommended: Number(item.recommended ?? item.recommendedStock ?? 0),
          }));
        }
      });

      return result;
    }, [stockRecommendations]);

    useEffect(() => {
      if (stockRecommendations.length > 0) {
        const initialStates: Record<string, number> = {};
        const initialMonths: Record<string, string> = {};
        stockRecommendations.forEach((category: any) => {
          const key = category.category;
          initialStates[key] = category.defaultStock || 15;
          initialMonths[key] = category.defaultMonth || "No data";
        });
        setProductStockStates(initialStates);
        setProductSelectedMonths(initialMonths);
      }
    }, [stockRecommendations]);

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
      if (!computedProductDetails.length || !originalData.length) return [];

      const BEST_UNIT_THRESHOLD = 100;

      let maxYear = 0;
      let maxMonthIdx = -1;
      originalData.forEach((rec) => {
        const mi = MONTH_NAMES.indexOf(rec.month.substring(0, 3));
        if (mi === -1) return;
        if (rec.year > maxYear || (rec.year === maxYear && mi > maxMonthIdx)) {
          maxYear = rec.year;
          maxMonthIdx = mi;
        }
      });

      if (maxYear === 0) return [];

      const MONTHS_WINDOW = 12;
      const cutoffOrdinal = maxYear * 12 + maxMonthIdx - (MONTHS_WINDOW - 1);

      const unitsInWindow: Record<string, number> = {};
      const metaByProduct: Record<
        string,
        { name: string; dryUnits: number; rainyUnits: number; totalRevenue: number; volumeUsed: number; pricePerMl: number }
      > = {};

      originalData.forEach((rec) => {
        const mi = MONTH_NAMES.indexOf(rec.month.substring(0, 3));
        if (mi === -1) return;
        const ordinal = rec.year * 12 + mi;
        if (ordinal < cutoffOrdinal) return;

        const cleanBrand = (rec.brand || "Unknown").trim().replace(/\s+/g, " ");
        const cleanProduct = (rec.product || "Unknown").trim().replace(/\s+/g, " ");
        const key = `${cleanBrand.toLowerCase()}__${cleanProduct.toLowerCase()}`;
        unitsInWindow[key] = (unitsInWindow[key] || 0) + (rec.unitsSold || 0);
      });

      computedProductDetails.forEach((p) => {
        metaByProduct[p.productKey] = {
          name: `${p.brand} ${p.product}`,
          dryUnits: p.dryUnits || 0,
          rainyUnits: p.rainyUnits || 0,
          totalRevenue: Math.round(p.totalSales),
          volumeUsed: Math.round(p.totalVolumeUsed),
          pricePerMl: p.pricePerMl,
        };
      });

      return Object.entries(unitsInWindow)
        .filter(([key, units]) => units >= BEST_UNIT_THRESHOLD && metaByProduct[key])
        .sort((a, b) => b[1] - a[1])
        .map(([key, units]) => {
          const meta = metaByProduct[key];
          return {
            name: meta.name,
            unitsSold: units,
            dryUnits: meta.dryUnits,
            rainyUnits: meta.rainyUnits,
            totalRevenue: meta.totalRevenue,
            volumeUsed: meta.volumeUsed,
            pricePerMl: meta.pricePerMl,
          };
        });
    }, [computedProductDetails, originalData]);

    const slowMovingProducts = useMemo(() => {
      if (!computedProductDetails.length || !originalData.length) return [];

      const SLOW_UNIT_THRESHOLD = 10;

      let maxYear = 0;
      let maxMonthIdx = -1;
      originalData.forEach((rec) => {
        const mi = MONTH_NAMES.indexOf(rec.month.substring(0, 3));
        if (mi === -1) return;
        if (rec.year > maxYear || (rec.year === maxYear && mi > maxMonthIdx)) {
          maxYear = rec.year;
          maxMonthIdx = mi;
        }
      });

      if (maxYear === 0) return [];

      const MONTHS_WINDOW = 12;
      const cutoffOrdinal = maxYear * 12 + maxMonthIdx - (MONTHS_WINDOW - 1);

      const unitsInWindow: Record<string, number> = {};
      const metaByProduct: Record<
        string,
        { name: string; dryUnits: number; rainyUnits: number; totalRevenue: number; volumeUsed: number; pricePerMl: number }
      > = {};

      originalData.forEach((rec) => {
        const mi = MONTH_NAMES.indexOf(rec.month.substring(0, 3));
        if (mi === -1) return;
        const ordinal = rec.year * 12 + mi;
        if (ordinal < cutoffOrdinal) return;

        const cleanBrand = (rec.brand || "Unknown").trim().replace(/\s+/g, " ");
        const cleanProduct = (rec.product || "Unknown").trim().replace(/\s+/g, " ");
        const key = `${cleanBrand.toLowerCase()}__${cleanProduct.toLowerCase()}`;
        unitsInWindow[key] = (unitsInWindow[key] || 0) + (rec.unitsSold || 0);
      });

      computedProductDetails.forEach((p) => {
        metaByProduct[p.productKey] = {
          name: `${p.brand} ${p.product}`,
          dryUnits: p.dryUnits || 0,
          rainyUnits: p.rainyUnits || 0,
          totalRevenue: Math.round(p.totalSales),
          volumeUsed: Math.round(p.totalVolumeUsed),
          pricePerMl: p.pricePerMl,
        };
      });

      return Object.entries(unitsInWindow)
        .filter(([key, units]) => units < SLOW_UNIT_THRESHOLD && metaByProduct[key])
        .sort((a, b) => a[1] - b[1])
        .map(([key, units]) => {
          const meta = metaByProduct[key];
          return {
            name: meta.name,
            unitsSold: units,
            dryUnits: meta.dryUnits,
            rainyUnits: meta.rainyUnits,
            totalRevenue: meta.totalRevenue,
            volumeUsed: meta.volumeUsed,
            pricePerMl: meta.pricePerMl,
          };
        });
    }, [computedProductDetails, originalData]);

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
              const loadedName = data.sales_data_name || "Saved Sales Data";
              setUploadedData(data.sales_data);
              setUploadedDataName(loadedName);
              const names = loadedName.split(", ").filter(Boolean);
              const rowsArray = Array.isArray(data.sales_data) ? data.sales_data : [];

              if (names.length <= 1) {
                const taggedRows = rowsArray.map((r: any) => ({ ...r, __sourceFile: loadedName }));
                setUploadedFiles([{ name: loadedName, rows: taggedRows }]);
              } else {
                // Check if rows already carry __sourceFile tags
                const hasSourceTags = rowsArray.some((r: any) => r && r.__sourceFile);
                if (hasSourceTags) {
                  setUploadedFiles(
                    names.map((n: string) => ({
                      name: n,
                      rows: rowsArray.filter((r: any) => r?.__sourceFile === n),
                    }))
                  );
                } else {
                  // Partition legacy untagged rows by year matching the filename (or evenly across files)
                  const extractYearFromRow = (row: any): number => {
                    if (row.Year) return parseInt(row.Year);
                    const dateVal = String(row.Date || row["Date"] || "").trim();
                    const match = dateVal.match(/\b(20\d{2})\b/);
                    return match ? parseInt(match[1]) : 0;
                  };

                  const remainingPool = [...rowsArray];
                  const reconstructed = names.map((n: string, idx: number) => {
                    const yearMatch = n.match(/\b(20\d{2})\b/);
                    if (yearMatch) {
                      const targetYear = parseInt(yearMatch[1]);
                      const matched: any[] = [];
                      for (let i = remainingPool.length - 1; i >= 0; i--) {
                        if (extractYearFromRow(remainingPool[i]) === targetYear) {
                          matched.unshift({ ...remainingPool[i], __sourceFile: n });
                          remainingPool.splice(i, 1);
                        }
                      }
                      if (matched.length > 0) {
                        return { name: n, rows: matched };
                      }
                    }
                    if (idx === names.length - 1) {
                      return {
                        name: n,
                        rows: remainingPool.splice(0).map((r) => ({ ...r, __sourceFile: n })),
                      };
                    }
                    const chunkSize = Math.ceil(remainingPool.length / (names.length - idx));
                    return {
                      name: n,
                      rows: remainingPool.splice(0, chunkSize).map((r) => ({ ...r, __sourceFile: n })),
                    };
                  });
                  setUploadedFiles(reconstructed);
                }
              }
              setIsDataSaved(true);
              processUploadedData(data.sales_data, true);
              setHasData(true);
            }

            if (data.forecast_data) {
              const strategies = Array.isArray(data.forecast_data.marketingStrategies)
                ? data.forecast_data.marketingStrategies
                : [];
              const hasHighDemand = strategies.some(
                (s: any) =>
                  (s.categoryType || "").toLowerCase() === "high-demand" ||
                  (s.season || "").toLowerCase().includes("high-demand") ||
                  (s.season || "").toLowerCase().includes("high demand")
              );
              const hasSlowMoving = strategies.some(
                (s: any) =>
                  (s.categoryType || "").toLowerCase() === "slow-moving" ||
                  (s.season || "").toLowerCase().includes("slow-moving") ||
                  (s.season || "").toLowerCase().includes("slow moving")
              );

              if (hasHighDemand && hasSlowMoving) {
                setForecastData(data.forecast_data);
                setForecastStatus("success");
                setLastGenerated(new Date(data.last_fetched || Date.now()).toLocaleString());
              } else {
                setForecastData(null);
                setForecastStatus("idle");
              }
            }

            if (data.last_fetched) {
              setLastGenerated(new Date(data.last_fetched).toLocaleString());
            }

            setSyncStatus("success");
          } else {
            setSyncStatus("idle");
            setSyncMessage("No saved data found");
            setHasData(false);
          }
        } catch (error) {
          console.error("Error loading user data:", error);
          setSyncStatus("error");
          setSyncMessage("❌ Failed to load data from cloud");
          showNotification("❌ Failed to load data from cloud", "error");
          setHasData(false);
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

    const processUploadedData = (data: any[], preserveExistingForecast = false) => {
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

        if (!preserveExistingForecast) {
          setForecastData(null);
          setForecastStatus("idle");
          setLastGenerated(null);

          localStorage.removeItem(CACHE_KEY);
          localStorage.removeItem(CACHE_TIMESTAMP_KEY);
          localStorage.removeItem(CACHE_DATA_COUNT_KEY);
        }

        setUploadError("");
        setHasData(true);

      } catch (error) {
        console.error("Error processing uploaded data:", error);
        setUploadError("Failed to process data. Please check the file format.");
        showNotification("Failed to process data. Please check the file format.", "error");
        setHasData(false);
      }
    };

    const parseSingleFile = (file: File): Promise<{ name: string; rows: any[] }> => {
      return new Promise((resolve, reject) => {
        const fileExtension = file.name.split(".").pop()?.toLowerCase();
        const isValidFile =
          fileExtension === "csv" || fileExtension === "xlsx" || fileExtension === "xls";

        if (!isValidFile) {
          reject(new Error(`"${file.name}" is not a valid CSV or Excel (.xlsx, .xls) file.`));
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
                reject(new Error(`"${file.name}" appears empty or invalid.`));
                return;
              }

              const headers = Object.keys(data[0] || {});
              const validation = validateHeaders(headers);
              if (!validation.valid) {
                reject(
                  new Error(
                    `"${file.name}" is missing required headers: ${validation.missing.join(
                      ", "
                    )}. Required: ${REQUIRED_HEADERS.join(", ")}`
                  )
                );
                return;
              }

              resolve({
                name: file.name,
                rows: data.map((row: any) => ({ ...row, __sourceFile: file.name })),
              });
            } catch (err: any) {
              reject(new Error(`Failed to process "${file.name}": ${err.message}`));
            }
          };
          reader.onerror = () => reject(new Error(`Failed to read "${file.name}".`));
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
              reject(new Error(`"${file.name}" appears empty.`));
              return;
            }

            const headers = Object.keys(jsonData[0] || {});
            const validation = validateHeaders(headers);
            if (!validation.valid) {
              reject(
                new Error(
                  `"${file.name}" is missing required headers: ${validation.missing.join(
                    ", "
                  )}. Required: ${REQUIRED_HEADERS.join(", ")}`
                )
              );
              return;
            }

            resolve({
              name: file.name,
              rows: jsonData.map((row: any) => ({ ...row, __sourceFile: file.name })),
            });
          } catch (err: any) {
            reject(new Error(`Failed to process "${file.name}": ${err.message}`));
          }
        };
        reader.onerror = () => reject(new Error(`Failed to read "${file.name}".`));
        reader.readAsArrayBuffer(file);
      });
    };

    const processFiles = async (fileList: FileList | File[], mode: "append" | "replace" = "append") => {
      const files = Array.from(fileList);
      if (files.length === 0) return;

      setUploadError("");

      try {
        const parsedResults = await Promise.all(files.map((f) => parseSingleFile(f)));

        const baseFiles = mode === "append" && uploadedData && uploadedData.length > 0 ? uploadedFiles : [];
        const updatedFiles = [...baseFiles];

        parsedResults.forEach((parsed) => {
          const existingIdx = updatedFiles.findIndex((f) => f.name === parsed.name);
          if (existingIdx !== -1) {
            updatedFiles[existingIdx] = parsed;
          } else {
            updatedFiles.push(parsed);
          }
        });

        const combinedRows =
          mode === "append" && uploadedData && uploadedData.length > 0 && baseFiles.length === 0
            ? [...uploadedData, ...parsedResults.flatMap((p) => p.rows)]
            : updatedFiles.flatMap((f) => f.rows);

        const combinedNames = updatedFiles.map((f) => f.name).join(", ");

        setUploadedFiles(updatedFiles);
        setUploadedData(combinedRows);
        setUploadedDataName(combinedNames);
        setIsDataSaved(false);
        setIsEditingFiles(true);
        setHasFileChanges(true);
        hasModifiedFilesInEditRef.current = true;
        processUploadedData(combinedRows);
        setUploadError("");

        showNotification(
          `✅ Loaded ${parsedResults.length} file(s) (${combinedRows.length} total rows across all years)`,
          "success"
        );
      } catch (err: any) {
        setUploadError(err.message || "Failed to process uploaded file(s).");
        showNotification(err.message || "Failed to process uploaded file(s).", "error");
      } finally {
        if (csvInputRef.current) csvInputRef.current.value = "";
      }
    };

    const handleRemoveSingleFile = (fileNameToRemove: string) => {
      if (!isEditingFiles) return;
      let remainingFiles = uploadedFiles.filter((f) => f.name !== fileNameToRemove);

      // Fallback if rows weren't populated on individual file entries yet
      let combinedRows = remainingFiles.flatMap((f) => f.rows);
      if (remainingFiles.length > 0 && combinedRows.length === 0 && uploadedData && uploadedData.length > 0) {
        const filteredFromUploaded = uploadedData.filter(
          (r: any) => r?.__sourceFile && r.__sourceFile !== fileNameToRemove
        );
        if (filteredFromUploaded.length > 0) {
          combinedRows = filteredFromUploaded;
        }
      }

      if (remainingFiles.length === 0 || combinedRows.length === 0) {
        setUploadedFiles([]);
        setUploadedData(null);
        setUploadedDataName("");
        setIsDataSaved(false);
        setIsEditingFiles(true);
        setHasFileChanges(true);
        hasModifiedFilesInEditRef.current = true;
        setSalesData([]);
        setOriginalData([]);
        setProductDetails([]);
        setForecastData(null);
        setForecastStatus("idle");
        showNotification(`Removed "${fileNameToRemove}"`, "info");
        return;
      }

      const combinedNames = remainingFiles.map((f) => f.name).join(", ");
      setUploadedFiles(remainingFiles);
      setUploadedData(combinedRows);
      setUploadedDataName(combinedNames);
      setIsDataSaved(false);
      setIsEditingFiles(true);
      setHasFileChanges(true);
      hasModifiedFilesInEditRef.current = true;
      processUploadedData(combinedRows);
      showNotification(`Removed "${fileNameToRemove}" (${remainingFiles.length} file(s) remaining)`, "info");
    };

    const handleFileUploadChange = (e: ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;
      processFiles(files, uploadMode);
    };

    const handleFileDrop = (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDraggingFile(false);
      const files = e.dataTransfer.files;
      if (!files || files.length === 0) return;
      processFiles(files, "append");
    };

    const getFilesSignature = (filesList: { name: string; rows: any[] }[], fallbackName: string, fallbackLen: number) => {
      if (filesList.length > 0) {
        return filesList.map((f) => `${f.name}:${f.rows.length}`).join("|");
      }
      return `${fallbackName}__${fallbackLen}`;
    };

    const handleSaveData = () => {
      if (!uploadedData || uploadedData.length === 0) {
        setUploadError("No data to save. Please upload a file first.");
        showNotification("No data to save. Please upload a file first.", "error");
        return;
      }

      try {
        const wasModified = hasModifiedFilesInEditRef.current;

        setIsDataSaved(true);
        setIsEditingFiles(false);
        setHasFileChanges(false);
        hasModifiedFilesInEditRef.current = false;
        editSnapshotSignatureRef.current = null;
        setUploadError("");

        // If the user did NOT add or remove any uploaded file, just save the previous state and do NOT generate new strategies
        if (!wasModified) {
          return;
        }

        generateForecast();
      } catch (err) {
        console.error("Error saving data:", err);
        setUploadError("Failed to save data.");
        showNotification("Failed to save data.", "error");
      }
    };

    const handleRemoveData = () => {
      setUploadedData(null);
      setUploadedDataName("");
      setUploadedFiles([]);
      setUploadError("");
      setIsDataSaved(false);
      setSalesData([]);
      setOriginalData([]);
      setProductDetails([]);
      setForecastData(null);
      setForecastStatus("idle");
      setLastGenerated(null);
      setHasData(false);
      setIsGenerating(false);
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
      setUploadedFiles([]);
      setSalesData([]);
      setOriginalData([]);
      setProductDetails([]);
      setForecastData(null);
      setForecastStatus("idle");
      setLastGenerated(null);
      setHasData(false);
      setIsGenerating(false);
      if (csvInputRef.current) csvInputRef.current.value = "";

      localStorage.removeItem(CACHE_KEY);
      localStorage.removeItem(CACHE_TIMESTAMP_KEY);
      localStorage.removeItem(CACHE_DATA_COUNT_KEY);

      clearSupabaseData();
      showNotification("🗑️ Data cleared successfully", "info");
      setShowRemoveDialog(false);
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
      setIsGenerating(true);

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

        const uploadedYearsList = [...new Set(salesData.map((r) => r.year))].sort();

        const productMonthlySummary = computedProductDetails.map((p) => {
          const fullName = `${(p.brand || "").trim()} ${(p.product || "").trim()}`.trim();
          const months = perMonthUnitsByProduct[fullName] || [];

          // Compute Year-over-Year (YoY) trend ratio across uploaded years
          const byYear: Record<number, { total: number; monthsCount: number }> = {};
          months.forEach((h) => {
            if (!byYear[h.year]) byYear[h.year] = { total: 0, monthsCount: 0 };
            byYear[h.year].total += h.units;
            byYear[h.year].monthsCount += 1;
          });
          const sortedYears = Object.keys(byYear)
            .map(Number)
            .sort((a, b) => a - b);
          let yoyTrendRatio = 1.0;
          if (sortedYears.length >= 2) {
            const latestYear = sortedYears[sortedYears.length - 1];
            const prevYears = sortedYears.slice(0, -1);
            const latestMonthlyAvg =
              byYear[latestYear].monthsCount > 0
                ? byYear[latestYear].total / byYear[latestYear].monthsCount
                : 0;
            const prevTotal = prevYears.reduce((s, y) => s + byYear[y].total, 0);
            const prevMonths = prevYears.reduce((s, y) => s + byYear[y].monthsCount, 0);
            const prevMonthlyAvg = prevMonths > 0 ? prevTotal / prevMonths : 0;
            if (prevMonthlyAvg > 0 && latestMonthlyAvg > 0) {
              yoyTrendRatio = Number((latestMonthlyAvg / prevMonthlyAvg).toFixed(2));
            }
          }

          // Group multi-year history by calendar month (Jan..Dec) across all uploaded years
          const byCalendarMonth: Record<string, { years: number[]; totalUnits: number; avgUnits: number; maxUnits: number; sigma: number }> = {};
          MONTH_NAMES.forEach((mName) => {
            const matching = months.filter((m) => m.month === mName);
            if (matching.length > 0) {
              const totalU = matching.reduce((s, x) => s + x.units, 0);
              const meanU = totalU / matching.length;
              const sigmaU =
                matching.length > 1
                  ? Math.sqrt(
                      matching.reduce((s, x) => s + Math.pow(x.units - meanU, 2), 0) /
                        matching.length
                    )
                  : 0;
              byCalendarMonth[mName] = {
                years: matching.map((x) => x.year),
                totalUnits: totalU,
                avgUnits: Math.round(meanU),
                maxUnits: Math.max(...matching.map((x) => x.units)),
                sigma: Number(sigmaU.toFixed(1)),
              };
            }
          });

          const monthlyAvgs = Object.values(byCalendarMonth).map((m) => m.avgUnits);
          const meanMonthlyAvg =
            monthlyAvgs.length > 0
              ? monthlyAvgs.reduce((s, u) => s + u, 0) / monthlyAvgs.length
              : 0;
          const maxMonthlyAvg = monthlyAvgs.length > 0 ? Math.max(...monthlyAvgs) : 0;
          const peakToMeanRatio =
            meanMonthlyAvg > 0 ? Number((maxMonthlyAvg / meanMonthlyAvg).toFixed(2)) : 1.0;

          return {
            category: fullName,
            totalUnitsAcrossAllYears: p.totalUnits,
            avgAnnualUnits: Math.round(p.totalUnits / Math.max(1, sortedYears.length)),
            yoyTrendRatio,
            peakToMeanRatio,
            dryUnitsAcrossAllYears: p.dryUnits,
            rainyUnitsAcrossAllYears: p.rainyUnits,
            bestSeason: p.bestSeason,
            allUploadedMonthlyHistory: months.map((m) => ({
              month: m.month,
              year: m.year,
              units: m.units,
            })),
            multiYearMonthlyAverages: byCalendarMonth,
          };
        });

        const pickRandomProducts = (list: string[], count: number): string[] => {
          const shuffled = [...list];
          for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
          }
          return shuffled.slice(0, count);
        };

        const dryCandidatePool = computedProductDetails
          .filter((p) => p.bestSeason === "Dry" || p.dryUnits > 0)
          .map((p) => `${p.brand} ${p.product}`.trim());
        const rainyCandidatePool = computedProductDetails
          .filter((p) => p.bestSeason === "Rainy" || p.rainyUnits > 0)
          .map((p) => `${p.brand} ${p.product}`.trim());

        const selectedDryProducts = pickRandomProducts(dryCandidatePool, 5);
        const selectedRainyProducts = pickRandomProducts(rainyCandidatePool, 5);

        const highDemandNames = bestSellingProducts.map((p) => p.name);
        const slowMovingNames = slowMovingProducts.map((p) => p.name);

        const prompt = `
  You are an AI inventory & marketing strategist for a paint center. Based on the multi-year sales data below (covering years: ${uploadedYearsList.join(", ")}), generate:
  1. Product-specific marketing strategies for:
     - Dry Season (exactly 5 strategies, one for each of the 5 randomly selected Dry Season products below)
     - Rainy Season (exactly 5 strategies, one for each of the 5 randomly selected Rainy Season products below)
     - High-Demand Products (one strategy specifically mentioning and tailored to each listed High-Demand / Best-Selling product below)
     - Slow-Moving Products (one strategy specifically mentioning and tailored to each listed Slow-Moving product below)
  2. AI-computed Product Stock Recommendations ONLY for the target year 2025 (Jan 2025 – Dec 2025), dynamically adapting your rules to the volume distribution of the uploaded dataset in PRODUCT MULTI-YEAR HISTORY below.

  SALES DATA (Across Uploaded Years: ${uploadedYearsList.join(", ")}):
  - Total Sales: ₱${totalSales.toLocaleString()}
  - Average Monthly Paint Sales: ₱${Math.round(avgSales).toLocaleString()}
  - Records: ${salesData.length}
  - Total Products: ${computedProductDetails.length}

  5 RANDOMLY SELECTED DRY SEASON PRODUCTS (Must write 1 strategy per product, 5 strategies total):
  ${selectedDryProducts.map((name, i) => `${i + 1}. ${name}`).join("\n")}

  5 RANDOMLY SELECTED RAINY SEASON PRODUCTS (Must write 1 strategy per product, 5 strategies total):
  ${selectedRainyProducts.map((name, i) => `${i + 1}. ${name}`).join("\n")}

  CURRENT LISTED HIGH-DEMAND (BEST-SELLING) PRODUCTS (Must write strategies ONLY for these exact listed products, explicitly naming the product in each strategy):
  ${highDemandNames.length > 0 ? highDemandNames.map((name, i) => `${i + 1}. ${name}`).join("\n") : "None listed"}

  CURRENT LISTED SLOW-MOVING PRODUCTS (Must write strategies ONLY for these exact listed products, explicitly naming the product in each strategy):
  ${slowMovingNames.length > 0 ? slowMovingNames.map((name, i) => `${i + 1}. ${name}`).join("\n") : "None listed"}

  SEASONAL BREAKDOWN:
  Dry Season: ₱${dryTotal.toLocaleString()} (${dryData.length} months, Avg: ₱${Math.round(dryAvg).toLocaleString()})
  Rainy Season: ₱${rainyTotal.toLocaleString()} (${rainyData.length} months, Avg: ₱${Math.round(rainyAvg).toLocaleString()})

  FORECAST (3 months):
  ${calculatedForecast.map((f, i) => `${f.month}: ₱${f.sales.toLocaleString()} (${f.season})`).join('\n')}

  PRODUCT MULTI-YEAR HISTORY (JSON):
  ${JSON.stringify(productMonthlySummary)}

  TASK 1 (Product-Specific Marketing Strategies):
  CRITICAL RULE: Every single strategy MUST follow the exact format:
  "Strategy Name: Strategy description explicitly mentioning the specific product name"
  For example: "80% Clearance Discount: Give an 80% discount on Weber R-25 Acrylic Thinner LT when bundled with any gallon of primer to quickly clear stagnant stock." or "Contractor Bulk Rebate: Offer a 10% rebate on Davies CS-88 Solo Flat White Latex GAL for orders of 10 gallons or more."
  Use simple words and make sure it is attainable for a small paint center. Do not use markdown bold asterisks (**).
  1. "Dry Season" (categoryType: "seasonal"):
     - Generate exactly 5 strategies — one for each of the 5 RANDOMLY SELECTED DRY SEASON PRODUCTS (${selectedDryProducts.join(", ")}). Format each as "Strategy Name: Description mentioning [Product Name]".
  2. "Rainy Season" (categoryType: "seasonal"):
     - Generate exactly 5 strategies — one for each of the 5 RANDOMLY SELECTED RAINY SEASON PRODUCTS (${selectedRainyProducts.join(", ")}). Format each as "Strategy Name: Description mentioning [Product Name]".
  3. "High-Demand Products" (categoryType: "high-demand"):
     - Propose strategies ONLY for the CURRENT LISTED HIGH-DEMAND PRODUCTS above (${highDemandNames.join(", ") || "None"}).
     - Generate 1 tailored strategy per listed High-Demand product (${highDemandNames.length} strategies total), formatted as "Strategy Name: Description mentioning [Product Name]".
  4. "Slow-Moving Products" (categoryType: "slow-moving"):
     - Propose strategies ONLY for the CURRENT LISTED SLOW-MOVING PRODUCTS above (${slowMovingNames.join(", ") || "None"}).
     - Generate 1 tailored strategy per listed Slow-Moving product (${slowMovingNames.length} strategies total), formatted as "Strategy Name: Description mentioning [Product Name]".

  TASK 2 (AI Product Stock Recommendations FOR YEAR 2025 ONLY — Dynamic Volume-Adaptive Computation):
  Compute the 2025 monthly recommended stock for EVERY product in PRODUCT MULTI-YEAR HISTORY by applying the following inventory management principle (adapting thresholds dynamically to this dataset's overall volume distribution rather than using fixed hardcoded unit cutoffs):
  1. DYNAMIC CLASSIFICATION ("action": "Increase" vs "Maintain"):
     - Compare each product's volume (avgAnnualUnits), seasonal spike (peakToMeanRatio), and year-over-year growth (yoyTrendRatio) against the overall distribution of all products in PRODUCT MULTI-YEAR HISTORY:
     - Classify as "Increase" if the product belongs to the higher-volume tier of this dataset, OR has a notable medium-to-high volume combined with either a strong seasonal demand spike (high peakToMeanRatio) or positive year-over-year growth (yoyTrendRatio > 1).
     - Classify as "Maintain" if the product has steady, flat, or lower relative volume in this dataset without major seasonal surges.
  2. MONTHLY 2025 RECOMMENDED STOCK COMPUTATION ("items" for year 2025 ONLY, ordered Jan to Dec):
     - Step A (Normal Monthly Baseline / "units"): Use the product's historical average units ("avgUnits") for that calendar month across all uploaded years.
     - Step B (Cycle Stock Adjusted for YoY Trend): Adjust the monthly baseline by the product's year-over-year growth/decline trend (yoyTrendRatio, kept within a reasonable bound so outliers do not over-inflate stock).
     - Step C (Safety Buffer): Add a safety stock buffer on top of Cycle Stock based on the product's classification, seasonal peak months (Dry vs Rainy bestSeason), and monthly demand fluctuation (sigma / maxUnits):
       • For "Increase" products: Apply a higher safety buffer during peak season/busiest months (approx. +20% to +30% or accounting for sigma/maxUnits) and a moderate buffer in regular months (approx. +15%).
       • For "Maintain" products: Apply a conservative safety cushion (approx. +10% to +15%) to keep steady shelf availability without overstocking.
     - Output items ONLY for "year": 2025 (never output 2023 or 2024 items).

  Return ONLY valid JSON with this exact structure:
  {
    "stockRecommendations": [
      {
        "category": "Exact product category name from PRODUCT MULTI-YEAR HISTORY",
        "action": "Increase",
        "items": [
          { "month": "Jan", "year": 2025, "units": 15, "recommended": 19 }
        ]
      }
    ],
    "marketingStrategies": [
      {
        "season": "Dry Season",
        "categoryType": "seasonal",
        "targetProducts": ${JSON.stringify(selectedDryProducts)},
        "strategies": [
          "Strategy Name: Strategy description explicitly mentioning Dry Season Product 1",
          "Strategy Name: Strategy description explicitly mentioning Dry Season Product 2",
          "Strategy Name: Strategy description explicitly mentioning Dry Season Product 3",
          "Strategy Name: Strategy description explicitly mentioning Dry Season Product 4",
          "Strategy Name: Strategy description explicitly mentioning Dry Season Product 5"
        ]
      },
      {
        "season": "Rainy Season",
        "categoryType": "seasonal",
        "targetProducts": ${JSON.stringify(selectedRainyProducts)},
        "strategies": [
          "Strategy Name: Strategy description explicitly mentioning Rainy Season Product 1",
          "Strategy Name: Strategy description explicitly mentioning Rainy Season Product 2",
          "Strategy Name: Strategy description explicitly mentioning Rainy Season Product 3",
          "Strategy Name: Strategy description explicitly mentioning Rainy Season Product 4",
          "Strategy Name: Strategy description explicitly mentioning Rainy Season Product 5"
        ]
      },
      {
        "season": "High-Demand Products",
        "categoryType": "high-demand",
        "targetProducts": ${JSON.stringify(highDemandNames)},
        "strategies": [
          "Strategy Name: Strategy description explicitly mentioning the listed High-Demand product"
        ]
      },
      {
        "season": "Slow-Moving Products",
        "categoryType": "slow-moving",
        "targetProducts": ${JSON.stringify(slowMovingNames)},
        "strategies": [
          "Strategy Name: Strategy description explicitly mentioning the listed Slow-Moving product"
        ]
      }
    ]
  }`;

        const model = genAI.getGenerativeModel({ model: "gemini-3.5-flash-lite" });
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        const cleaned = text
          .replace(/```json/g, "")
          .replace(/```/g, "")
          .trim();

        const aiResult = JSON.parse(cleaned);

        const aiStockRecommendations = Array.isArray(aiResult.stockRecommendations)
          ? aiResult.stockRecommendations.map((rec: any) => {
              const categoryName = String(rec.category || "").trim();
              const rawHistory = perMonthUnitsByProduct[categoryName] || [];
              const aiItems = Array.isArray(rec.items) ? rec.items : [];

              // Build multi-year monthly reference per calendar month (Jan..Dec) for 2025
              const monthlyRefMap = new Map<string, { month: string; monthIdx: number; avgUnits: number }>();
              MONTH_NAMES.forEach((mName, mIdx) => {
                const matching = rawHistory.filter((h) => h.month === mName);
                if (matching.length > 0) {
                  const avgU = Math.round(matching.reduce((s, h) => s + h.units, 0) / matching.length);
                  monthlyRefMap.set(mName, { month: mName, monthIdx: mIdx, avgUnits: avgU });
                }
              });

              // Filter or normalize AI items strictly to year 2025, deduplicated by calendar month (Jan..Dec)
              const itemsByMonth = new Map<string, { month: string; year: number; units: number; recommended: number; monthIdx: number }>();

              aiItems.forEach((item: any) => {
                const monthStr = String(item.month || "").substring(0, 3);
                const mIdx = MONTH_NAMES.indexOf(monthStr);
                if (mIdx === -1) return;
                const ref = monthlyRefMap.get(monthStr);
                const unitsNum = Number(item.units ?? ref?.avgUnits ?? 0);
                const recNum = Number(item.recommended ?? item.recommendedStock ?? unitsNum);

                const existing = itemsByMonth.get(monthStr);
                if (!existing || Number(item.year) === 2025) {
                  itemsByMonth.set(monthStr, {
                    month: monthStr,
                    year: 2025,
                    units: ref ? ref.avgUnits : unitsNum,
                    recommended: Math.max(1, Math.round(recNum)),
                    monthIdx: mIdx,
                  });
                }
              });

              const normalizedItems =
                itemsByMonth.size > 0
                  ? Array.from(itemsByMonth.values())
                      .sort((a, b) => a.monthIdx - b.monthIdx)
                      .map(({ month, units, recommended }) => ({
                        month,
                        year: 2025,
                        units,
                        recommended,
                      }))
                  : Array.from(monthlyRefMap.values())
                      .sort((a, b) => a.monthIdx - b.monthIdx)
                      .map((ref) => ({
                        month: ref.month,
                        year: 2025,
                        units: ref.avgUnits,
                        recommended: Math.max(
                          ref.avgUnits + 1,
                          Math.round(ref.avgUnits * (rec.action === "Increase" ? 1.25 : 1.12))
                        ),
                      }));

              return {
                category: categoryName,
                action: rec.action === "Increase" ? "Increase" : "Maintain",
                items: normalizedItems,
              };
            })
          : [];

        const resultData = {
          bestSellingProducts: bestSellingProducts,
          slowMovingProducts: slowMovingProducts,
          stockRecommendations: aiStockRecommendations,
          marketingStrategies: aiResult.marketingStrategies || [],
          forecast: calculatedForecast
        };

        localStorage.setItem(CACHE_KEY, JSON.stringify(resultData));
        localStorage.setItem(CACHE_TIMESTAMP_KEY, String(Date.now()));
        localStorage.setItem(CACHE_DATA_COUNT_KEY, String(salesData.length));

        setForecastData(resultData);
        setForecastStatus("success");
        lastGeneratedFileSignatureRef.current = `${uploadedDataName}__${uploadedData?.length || 0}`;
        const date = new Date();
        setLastGenerated(date.toLocaleString());
        showNotification("✅ Marketing strategies generated successfully!", "success");
      } catch (error) {
        console.error("AI Generation Error:", error);
        setForecastStatus("error");
        showNotification("Failed to generate strategies. Please try again.", "error");
      } finally {
        setIsGenerating(false);
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

    const availableMonths = useMemo(
      () => salesData.map((row) => `${row.month.substring(0, 3)} ${row.year}`),
      [salesData]
    );

    const availableYears = useMemo(
      () => [...new Set(salesData.map((row) => row.year))].sort(),
      [salesData]
    );

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
        const latestYear = availableYears.length > 0
          ? String(availableYears[availableYears.length - 1])
          : String(new Date().getFullYear());
        const forecast = data.filter(
          (d) => d.isForecast && (d.month.includes(timeFilter) || timeFilter === latestYear)
        );
        data = [...historical, ...forecast];
      }
      return data.map((item, index) => ({
        ...item,
        id: `${chartKey}-${index}`,
      }));
    }, [allMonthlyData, timeFilter, chartKey, availableYears]);

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
      const totalSegments = Math.max(1, filteredMonthlyData.length - 1);
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
          // Extend x2 to the next point's x-coordinate so adjacent season background bands touch seamlessly with zero white gap
          const nextPoint = filteredMonthlyData[end + 1];
          const endIdx = nextPoint ? end + 1 : end;
          const startPct = Number(((i / totalSegments) * 100).toFixed(2));
          const endPct = Number(((endIdx / totalSegments) * 100).toFixed(2));
          areas.push({
            key: `area-${chartKey}-${areaIndex++}`,
            season: current.season,
            x1: current.month,
            x2: nextPoint ? nextPoint.month : filteredMonthlyData[end].month,
            startPct,
            endPct,
            fill: current.season === "Dry" ? "#4ade80" : "#60a5fa",
            stroke: current.season === "Dry" ? "#16a34a" : "#2563eb",
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
          ${!hasData && !salesData.length && !uploadedData ? 'h-screen overflow-hidden' : ''}
        `}
      >
        <style>{`
          @keyframes slideUp {
            from { opacity: 0; transform: translateY(20px) scale(0.95); }
            to { opacity: 1; transform: translateY(0) scale(1); }
          }
          .animate-slide-up { animation: slideUp 0.3s ease-out forwards; }
          .forecast-page [data-slot="card"] { border-radius: 1rem; }
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
          .forecast-page [data-slot="table-head"] { color: rgb(22 101 52); font-weight: 700; }
          .forecast-page [data-slot="table-row"]:hover { background: rgb(240 253 244 / 0.7); }
          .forecast-page [data-slot="card-content"] { overflow: visible !important; }
          .forecast-page .overflow-x-auto { overflow: visible !important; }
          .forecast-page table { overflow: visible !important; }
          .forecast-page tbody tr td { overflow: visible !important; }
          .season-table-scroll::-webkit-scrollbar { width: 8px; }
          .season-table-scroll::-webkit-scrollbar-track { background: #f1f5f9; border-radius: 8px; }
          .season-table-scroll::-webkit-scrollbar-thumb { background: #94a3b8; border-radius: 8px; }
          .season-table-scroll::-webkit-scrollbar-thumb:hover { background: #64748b; }
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

            <CardContent className="overflow-visible">
              <input
                ref={csvInputRef}
                type="file"
                multiple
                accept=".csv,.xlsx,.xls"
                onChange={handleFileUploadChange}
                className="hidden"
              />

              {!isDataLoaded && !isEditingFiles ? (
                <div>
                  <div
                    onClick={() => {
                      setUploadMode("append");
                      csvInputRef.current?.click();
                    }}
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
                          Drop one or multiple CSV / Excel files (Multi-Year Sales)
                        </p>
                        <p className="text-xs text-gray-400">or click to browse multiple files at once</p>
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
                      <Badge variant="outline" className="text-xs bg-white border-green-300 text-green-700">Date</Badge>
                      <Badge variant="outline" className="text-xs bg-white border-green-300 text-green-700">Brand</Badge>
                      <Badge variant="outline" className="text-xs bg-white border-green-300 text-green-700">Product</Badge>
                      <Badge variant="outline" className="text-xs bg-white border-green-300 text-green-700">Total Sales (PHP)</Badge>
                      <Badge variant="outline" className="text-xs bg-white border-green-300 text-green-700">Units Sold</Badge>
                      <Badge variant="outline" className="text-xs bg-white border-green-300 text-green-700">Season</Badge>
                    </div>
                    <p className="text-[11px] text-green-600 mt-1.5">
                      Headers are case-sensitive and must match exactly. You can upload multiple yearly files together.
                    </p>
                  </div>
                </div>
              ) : (
                <div
                  className="space-y-2.5"
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDraggingFile(true);
                  }}
                  onDragLeave={() => setIsDraggingFile(false)}
                  onDrop={handleFileDrop}
                >
                  {isDataLoaded ? (
                    <div className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-2.5 rounded-lg border transition-all duration-300 ${
                      isDraggingFile
                        ? "border-green-600 bg-green-50/90 shadow-md"
                        : isDataSaved
                        ? "bg-gray-50 border-gray-200"
                        : "bg-green-50 border-green-200"
                    }`}>
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`flex size-8 flex-shrink-0 items-center justify-center rounded-lg text-white ${
                          isDataSaved ? "bg-gray-400" : "bg-[#174d32]"
                        }`}>
                          {uploadedDataName.endsWith(".csv") && uploadedFiles.length <= 1 ? (
                            <File className="size-4" />
                          ) : (
                            <FileSpreadsheet className="size-4" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate max-w-[260px] sm:max-w-[400px] text-gray-900">
                            {uploadedFiles.length > 1
                              ? `${uploadedFiles.length} sales files combined`
                              : uploadedDataName}
                          </p>
                          <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                            <span className={`text-xs ${isDataSaved ? "text-gray-400" : "text-gray-500"}`}>
                              {uploadedData.length.toLocaleString()} total rows
                            </span>
                            {availableYears.length > 0 && (
                              <>
                                <span className="text-xs text-gray-300">•</span>
                                <span className="text-xs font-medium text-emerald-700">
                                  Years: {availableYears.join(", ")}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {isDataSaved && forecastStatus === "loading" && (
                          <div className="flex items-center gap-2 text-xs text-gray-500">
                            <Loader2 className="size-3 animate-spin" />
                            Generating strategies...
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 rounded-lg border border-dashed border-emerald-300 bg-emerald-50/40 text-xs text-emerald-800">
                      No file loaded in the container. Click <strong>Add</strong> below to upload a file.
                    </div>
                  )}

                  {uploadedFiles.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      {uploadedFiles.map((f, idx) => (
                        <div
                          key={`${f.name}-${idx}`}
                          className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50/70 px-2.5 py-1 text-xs text-emerald-900"
                        >
                          <FileSpreadsheet className="size-3 text-emerald-700 flex-shrink-0" />
                          <span className="truncate max-w-[180px] font-medium">{f.name}</span>
                          {f.rows.length > 0 && (
                            <span className="text-[10px] text-emerald-600">({f.rows.length})</span>
                          )}
                          {isEditingFiles && (
                            <button
                              type="button"
                              onClick={() => handleRemoveSingleFile(f.name)}
                              className="ml-0.5 rounded-full p-0.5 text-emerald-700 hover:bg-emerald-200/70 hover:text-red-600 transition cursor-pointer"
                              title={`Remove ${f.name}`}
                            >
                              <X className="size-3" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-2">
                    {!isDataLoaded ? (
                      <Button
                        onClick={() => {
                          setUploadMode("append");
                          csvInputRef.current?.click();
                        }}
                        variant="outline"
                        className="text-xs h-7 px-2.5 border-emerald-400 bg-emerald-50/50 text-emerald-800 hover:bg-emerald-100"
                      >
                        <Plus className="size-3 mr-1" />
                        Add
                      </Button>
                    ) : !isEditingFiles ? (
                      <Button
                        onClick={() => {
                          hasModifiedFilesInEditRef.current = false;
                          setHasFileChanges(false);
                          setIsEditingFiles(true);
                        }}
                        variant="outline"
                        className="text-xs h-7 px-2.5 border-emerald-400 bg-emerald-50/50 text-emerald-800 hover:bg-emerald-100"
                      >
                        <Pencil className="size-3 mr-1" />
                        Edit
                      </Button>
                    ) : (
                      <>
                        <Button
                          onClick={() => {
                            setUploadMode("append");
                            csvInputRef.current?.click();
                          }}
                          variant="outline"
                          className="text-xs h-7 px-2.5 border-emerald-400 bg-emerald-50/50 text-emerald-800 hover:bg-emerald-100 animate-slide-up"
                        >
                          <Plus className="size-3 mr-1" />
                          Add File
                        </Button>
                        <Button
                          onClick={handleSaveData}
                          className="text-xs h-7 px-2.5 text-white bg-[#174d32] hover:bg-green-700 animate-slide-up"
                        >
                          <Save className="size-3 mr-1" />
                          Save
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

        {showRemoveDialog && createPortal(
          <div 
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-fade-in"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setShowRemoveDialog(false);
              }
            }}
          >
            <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl animate-slide-up">
              <div className="flex items-start gap-4">
                <div className="flex size-12 flex-shrink-0 items-center justify-center rounded-full bg-red-100">
                  <AlertTriangle className="size-6 text-red-600" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900">
                    Clear Uploaded Data?
                  </h3>
                  <p className="mt-1 text-sm text-gray-500">
                    Are you sure you want to clear this uploaded sales data? This
                    will also remove all analysis and forecast results.
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
                    handleClearSavedData();
                  }}
                  className="bg-red-600 hover:bg-red-700 text-white"
                >
                  Yes, Clear Data
                </Button>
              </div>
            </div>
          </div>,
          document.body
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
                  <ComposedChart
                    data={viewMode === "monthly" ? filteredMonthlyData : weeklyChartData}
                    margin={{ top: 20, right: 30, left: 10, bottom: 30 }}
                  >
                    <defs>
                      <linearGradient id="historicalStrokeGradient" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#14532d" />
                        <stop offset="50%" stopColor="#166534" />
                        <stop offset="100%" stopColor="#15803d" />
                      </linearGradient>
                      <linearGradient id="forecastStrokeGradient" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#15803d" />
                        <stop offset="100%" stopColor="#10b981" />
                      </linearGradient>
                      {/* Horizontal gradient below the line proportioned to each Dry/Rainy season span */}
                      <linearGradient id="seasonalAreaHorizontal" x1="0%" y1="0%" x2="100%" y2="0%">
                        {seasonalAreas.map((area, idx) => {
                          const color = area.season === "Dry" ? "#16a34a" : "#2563eb";
                          return [
                            <stop
                              key={`stop-start-${idx}`}
                              offset={`${area.startPct}%`}
                              stopColor={color}
                              stopOpacity={1}
                            />,
                            <stop
                              key={`stop-end-${idx}`}
                              offset={`${area.endPct}%`}
                              stopColor={color}
                              stopOpacity={1}
                            />,
                          ];
                        })}
                      </linearGradient>
                      {/* Vertical fade mask so the seasonal gradient below the line fades smoothly toward the bottom axis */}
                      <linearGradient id="areaVerticalFadeGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#ffffff" stopOpacity={0.62} />
                        <stop offset="55%" stopColor="#ffffff" stopOpacity={0.28} />
                        <stop offset="100%" stopColor="#ffffff" stopOpacity={0.04} />
                      </linearGradient>
                      <mask
                        id="areaVerticalFadeMask"
                        maskUnits="objectBoundingBox"
                        maskContentUnits="objectBoundingBox"
                      >
                        <rect x="0" y="0" width="1" height="1" fill="url(#areaVerticalFadeGrad)" />
                      </mask>
                      {/* Weekly view vertical gradient matched to the selected month's season */}
                      <linearGradient id="weeklyAreaGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop
                          offset="0%"
                          stopColor={weeklyChartData[0]?.season === "Rainy" ? "#2563eb" : "#16a34a"}
                          stopOpacity={0.55}
                        />
                        <stop
                          offset="60%"
                          stopColor={weeklyChartData[0]?.season === "Rainy" ? "#3b82f6" : "#22c55e"}
                          stopOpacity={0.22}
                        />
                        <stop
                          offset="100%"
                          stopColor={weeklyChartData[0]?.season === "Rainy" ? "#60a5fa" : "#4ade80"}
                          stopOpacity={0.03}
                        />
                      </linearGradient>
                      <filter id="lineGlow" x="-20%" y="-20%" width="140%" height="140%">
                        <feDropShadow dx="0" dy="3" stdDeviation="3" floodColor="#14532d" floodOpacity="0.28" />
                      </filter>
                      <filter id="forecastGlow" x="-20%" y="-20%" width="140%" height="140%">
                        <feDropShadow dx="0" dy="3" stdDeviation="3.5" floodColor="#059669" floodOpacity="0.35" />
                      </filter>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                    {viewMode === "monthly" &&
                      seasonalAreas.map((area) => (
                        <ReferenceArea
                          key={area.key}
                          x1={area.x1}
                          x2={area.x2}
                          fill={area.fill}
                          fillOpacity={0.18}
                          stroke={area.stroke}
                          strokeOpacity={0.2}
                        />
                      ))}
                    <XAxis
                      dataKey={viewMode === "monthly" ? "month" : "week"}
                      tick={{ fontSize: 12, fill: "#334155", fontWeight: 500 }}
                      axisLine={{ stroke: "#CBD5E1" }}
                      tickLine={{ stroke: "#CBD5E1" }}
                      angle={viewMode === "monthly" ? -35 : 0}
                      textAnchor={viewMode === "monthly" ? "end" : "middle"}
                      height={70}
                    />
                    <YAxis
                      tick={{ fontSize: 12, fill: "#475569", fontWeight: 500 }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(value) => `₱${(value / 1000).toFixed(0)}k`}
                    />
                    <Tooltip
                      cursor={{ stroke: "#14532d", strokeWidth: 1.5, strokeDasharray: "4 4" }}
                      contentStyle={{
                        borderRadius: 14,
                        border: "1px solid #d1fae5",
                        backgroundColor: "rgba(255, 255, 255, 0.96)",
                        boxShadow: "0 14px 34px rgba(20, 83, 45, 0.16)",
                        padding: "10px 14px",
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
                        <Area
                          type="monotone"
                          dataKey="sales"
                          stroke="none"
                          fill="url(#seasonalAreaHorizontal)"
                          mask="url(#areaVerticalFadeMask)"
                          tooltipType="none"
                          isAnimationActive={false}
                        />
                        <Line
                          type="monotone"
                          dataKey={(d) => (!d.isForecast ? d.sales : null)}
                          stroke="url(#historicalStrokeGradient)"
                          strokeWidth={3.5}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          filter="url(#lineGlow)"
                          dot={(props: any) => {
                            const { cx, cy, payload } = props;
                            if (cx == null || cy == null || payload?.isForecast) {
                              return <g key={`hist-empty-${payload?.id}`} />;
                            }
                            const isDry = payload?.season === "Dry";
                            const ringColor = isDry ? "#14532d" : "#1e3a8a";
                            return (
                              <g key={`hist-dot-${payload?.id}`}>
                                <circle
                                  cx={cx}
                                  cy={cy}
                                  r={7.5}
                                  fill={ringColor}
                                  fillOpacity={0.14}
                                />
                                <circle
                                  cx={cx}
                                  cy={cy}
                                  r={4.5}
                                  fill="#ffffff"
                                  stroke="#14532d"
                                  strokeWidth={2.5}
                                />
                              </g>
                            );
                          }}
                          activeDot={(props: any) => {
                            const { cx, cy, payload } = props;
                            if (cx == null || cy == null) return <g />;
                            return (
                              <g key={`hist-active-${payload?.id}`}>
                                <circle
                                  cx={cx}
                                  cy={cy}
                                  r={12}
                                  fill="#15803d"
                                  fillOpacity={0.22}
                                />
                                <circle
                                  cx={cx}
                                  cy={cy}
                                  r={7}
                                  fill="#14532d"
                                  stroke="#ffffff"
                                  strokeWidth={2.5}
                                />
                                <circle cx={cx} cy={cy} r={2.5} fill="#ffffff" />
                              </g>
                            );
                          }}
                          connectNulls={false}
                          name="Historical Sales"
                        />
                        <Line
                          type="monotone"
                          dataKey={(d) => {
                            if (d.isForecast) return d.sales;
                            const idx = filteredMonthlyData.findIndex((item) => item.id === d.id);
                            const nextItem = idx !== -1 ? filteredMonthlyData[idx + 1] : null;
                            return nextItem?.isForecast ? d.sales : null;
                          }}
                          stroke="url(#forecastStrokeGradient)"
                          strokeWidth={3.5}
                          strokeDasharray="7 6"
                          strokeLinecap="round"
                          filter="url(#forecastGlow)"
                          dot={(props: any) => {
                            const { cx, cy, payload } = props;
                            if (cx == null || cy == null || !payload?.isForecast) {
                              return <g key={`dot-bridge-${payload?.id}`} />;
                            }
                            return (
                              <g key={`dot-fc-${payload?.id}`}>
                                <circle
                                  cx={cx}
                                  cy={cy}
                                  r={10}
                                  fill="#10b981"
                                  fillOpacity={0.24}
                                />
                                <circle
                                  cx={cx}
                                  cy={cy}
                                  r={6}
                                  fill="#10b981"
                                  stroke="#ffffff"
                                  strokeWidth={2.5}
                                />
                                <circle cx={cx} cy={cy} r={2} fill="#ffffff" />
                              </g>
                            );
                          }}
                          activeDot={(props: any) => {
                            const { cx, cy, payload } = props;
                            if (cx == null || cy == null) return <g />;
                            return (
                              <g key={`fc-active-${payload?.id}`}>
                                <circle
                                  cx={cx}
                                  cy={cy}
                                  r={13}
                                  fill="#10b981"
                                  fillOpacity={0.28}
                                />
                                <circle
                                  cx={cx}
                                  cy={cy}
                                  r={7.5}
                                  fill="#059669"
                                  stroke="#ffffff"
                                  strokeWidth={2.5}
                                />
                                <circle cx={cx} cy={cy} r={2.5} fill="#ffffff" />
                              </g>
                            );
                          }}
                          connectNulls
                          name="AR-2 Forecast"
                        />
                        <Line
                          type="monotone"
                          dataKey="upperBound"
                          stroke="#059669"
                          strokeOpacity={0.55}
                          strokeWidth={1.75}
                          strokeDasharray="4 4"
                          strokeLinecap="round"
                          dot={false}
                          name="Upper Bound (95%)"
                        />
                        <Line
                          type="monotone"
                          dataKey="lowerBound"
                          stroke="#059669"
                          strokeOpacity={0.55}
                          strokeWidth={1.75}
                          strokeDasharray="4 4"
                          strokeLinecap="round"
                          dot={false}
                          name="Lower Bound (95%)"
                        />
                      </>
                    ) : (
                      <>
                        <Area
                          type="monotone"
                          dataKey="sales"
                          stroke="none"
                          fill="url(#weeklyAreaGradient)"
                          tooltipType="none"
                          isAnimationActive={false}
                        />
                        <Line
                          type="monotone"
                          dataKey="sales"
                          stroke="url(#historicalStrokeGradient)"
                          strokeWidth={3.5}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          filter="url(#lineGlow)"
                          dot={(props: any) => {
                            const { cx, cy, index } = props;
                            if (cx == null || cy == null) return <g key={`wk-empty-${index}`} />;
                            return (
                              <g key={`wk-dot-${index}`}>
                                <circle cx={cx} cy={cy} r={8.5} fill="#14532d" fillOpacity={0.15} />
                                <circle
                                  cx={cx}
                                  cy={cy}
                                  r={5}
                                  fill="#ffffff"
                                  stroke="#14532d"
                                  strokeWidth={2.75}
                                />
                              </g>
                            );
                          }}
                          activeDot={(props: any) => {
                            const { cx, cy, index } = props;
                            if (cx == null || cy == null) return <g />;
                            return (
                              <g key={`wk-active-${index}`}>
                                <circle cx={cx} cy={cy} r={12} fill="#15803d" fillOpacity={0.22} />
                                <circle
                                  cx={cx}
                                  cy={cy}
                                  r={7}
                                  fill="#14532d"
                                  stroke="#ffffff"
                                  strokeWidth={2.5}
                                />
                                <circle cx={cx} cy={cy} r={2.5} fill="#ffffff" />
                              </g>
                            );
                          }}
                          name="Weekly Sales"
                        />
                      </>
                    )}
                  </ComposedChart>
                </ResponsiveContainer>
                <div className="flex flex-wrap items-center justify-center gap-6 rounded-xl border border-emerald-100 bg-emerald-50/50 p-4 text-sm text-slate-700">
                  <div className="flex items-center gap-2.5">
                    <span className="relative flex items-center justify-center w-8">
                      <span className="h-1 w-full rounded-full bg-[#14532d]"></span>
                      <span className="absolute w-3 h-3 rounded-full bg-white border-2 border-[#14532d] shadow-sm"></span>
                    </span>
                    <span className="font-medium">Sales</span>
                  </div>
                  {forecastData && (
                    <div className="flex items-center gap-2.5">
                      <span className="relative flex items-center justify-center w-8">
                        <span className="w-full border-t-2 border-dashed border-[#10b981]"></span>
                        <span className="absolute w-3 h-3 rounded-full bg-[#10b981] border-2 border-white ring-1 ring-[#10b981] shadow-sm"></span>
                      </span>
                      <span className="font-medium">Forecasted Sales</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <span className="w-4 h-4 rounded bg-green-400/50 ring-1 ring-green-600/60"></span>
                    <span className="font-medium">Dry Season</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-4 h-4 rounded bg-blue-400/50 ring-1 ring-blue-600/60"></span>
                    <span className="font-medium">Rainy Season</span>
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
                      <span>Average Monthly Paint Sales</span>
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
                      <span>Average Monthly Paint Sales</span>
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
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <Lightbulb className="w-5 h-5 text-white" />
                      <div>
                        <h3 className="text-lg font-bold text-white">Top Product Per Season</h3>
                        <p className="text-xs text-white/70 mt-0.5">
                          Products contributing to the top 50% of units sold{" "}
                          {seasonProductYearFilter === "all"
                            ? "(All Years Combined)"
                            : `(${seasonProductYearFilter})`}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 flex-wrap">
                      <select
                        value={seasonProductYearFilter}
                        onChange={(e) => setSeasonProductYearFilter(e.target.value)}
                        className="rounded-lg border border-white/30 bg-white px-3 py-1.5 text-xs font-medium text-green-900 shadow-sm outline-none"
                      >
                        <option value="all">All Years</option>
                        {availableYears.map((year) => (
                          <option key={year} value={String(year)}>
                            {year}
                          </option>
                        ))}
                      </select>

                      <div className="flex bg-white/15 rounded-lg p-1 w-fit">
                        <button
                          onClick={() => setProductViewMode("list")}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition ${
                            productViewMode === "list"
                              ? "bg-white text-green-900"
                              : "text-white/80 hover:text-white"
                          }`}
                        >
                          <List className="size-3.5" />
                          List
                        </button>
                        <button
                          onClick={() => setProductViewMode("chart")}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition ${
                            productViewMode === "chart"
                              ? "bg-white text-green-900"
                              : "text-white/80 hover:text-white"
                          }`}
                        >
                          <PieChartIcon className="size-3.5" />
                          Chart
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <CardContent>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="rounded-xl border border-blue-200 bg-blue-50/30 shadow-sm overflow-hidden flex flex-col">
                      <div className="px-4 py-3 border-b border-blue-100 bg-blue-50/60 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <CloudRain className="size-4 text-blue-800" />
                          <div>
                            <h4 className="text-sm font-semibold text-blue-800 leading-tight">
                              {productViewMode === "list"
                                ? "Rainy Season — Top Contributors"
                                : "Rainy Season — Product Units Share"}
                            </h4>
                            <p className="text-[11px] text-blue-700/80 leading-tight">
                              June – December
                            </p>
                          </div>
                        </div>
                        <Badge className="bg-blue-100 text-blue-800 text-[10px]">
                          {topProductsBySeason.rainy.list.length} products
                        </Badge>
                      </div>

                      <div className="p-4" style={{ height: 400 }}>
                        {productViewMode === "list" ? (
                          topProductsBySeason.rainy.list.length > 0 ? (
                            <div className="season-table-scroll overflow-y-auto rounded-lg border border-blue-100 h-full">
                              <Table>
                                <TableHeader className="sticky top-0 z-10 bg-white shadow-sm">
                                  <TableRow>
                                    <TableHead className="w-14 bg-white" style={{ color: '#1d4ed8' }}>Rank</TableHead>
                                    <TableHead className="bg-white" style={{ color: '#1d4ed8' }}>Product</TableHead>
                                    <TableHead className="bg-white text-right" style={{ color: '#1d4ed8' }}>Units</TableHead>
                                    <TableHead className="bg-white text-right" style={{ color: '#1d4ed8' }}>Revenue</TableHead>
                                    <TableHead className="bg-white text-right" style={{ color: '#1d4ed8' }}>%</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {topProductsBySeason.rainy.list.map((product: any) => (
                                    <TableRow key={product.productKey} className="hover:bg-gray-50 transition-colors">
                                      <TableCell>
    {product.displayRank && (
      <Badge className="bg-[#174d32]">{product.displayRank}</Badge>
    )}
  </TableCell>
                                      <TableCell>
                                        <p className="font-semibold text-sm">{product.brand}</p>
                                        <p className="text-xs text-gray-500">{product.name}</p>
                                      </TableCell>
                                      <TableCell className="text-right font-medium">
                                        {product.units.toLocaleString()}
                                      </TableCell>
                                      <TableCell className="text-right font-bold">
                                        ₱{product.revenue.toLocaleString()}
                                      </TableCell>
                                      <TableCell className="text-right">
                                        <Badge className="bg-blue-100 text-blue-800">
                                          {product.percentShare.toFixed(1)}%
                                        </Badge>
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                          ) : (
                            <div className="text-center py-8 text-gray-500 h-full flex items-center justify-center">
                              <p>No products found for Rainy season.</p>
                            </div>
                          )
                        ) : (
                          <div className="h-full flex items-start justify-center">
                            <SeasonDonutChart
                              products={topProductsBySeason.rainy.list}
                              season="rainy"
                              topUnits={topProductsBySeason.rainy.topUnits}
                              topRevenue={topProductsBySeason.rainy.topRevenue}
                              otherUnits={topProductsBySeason.rainy.otherUnits}
                              totalUnits={topProductsBySeason.rainy.totalUnits}
                            />
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="rounded-xl border border-green-200 bg-green-50/30 shadow-sm overflow-hidden flex flex-col">
                      <div className="px-4 py-3 border-b border-green-100 bg-green-50/60 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Sun className="size-4 text-green-800" />
                          <div>
                            <h4 className="text-sm font-semibold text-green-800 leading-tight">
                              {productViewMode === "list"
                                ? "Dry Season — Top Contributors"
                                : "Dry Season — Product Units Share"}
                            </h4>
                            <p className="text-[11px] text-green-700/80 leading-tight">
                              January – May
                            </p>
                          </div>
                        </div>
                        <Badge className="bg-green-100 text-green-800 text-[10px]">
                          {topProductsBySeason.dry.list.length} products
                        </Badge>
                      </div>

                      <div className="p-4" style={{ height: 400 }}>
                        {productViewMode === "list" ? (
                          topProductsBySeason.dry.list.length > 0 ? (
                            <div className="season-table-scroll overflow-y-auto rounded-lg border border-green-100 h-full">
                              <Table>
                                <TableHeader className="sticky top-0 z-10 bg-white shadow-sm">
                                  <TableRow>
                                    <TableHead className="w-14 bg-white" style={{ color: '#174d32' }}>Rank</TableHead>
                                    <TableHead className="bg-white" style={{ color: '#174d32' }}>Product</TableHead>
                                    <TableHead className="bg-white text-right" style={{ color: '#174d32' }}>Units</TableHead>
                                    <TableHead className="bg-white text-right" style={{ color: '#174d32' }}>Revenue</TableHead>
                                    <TableHead className="bg-white text-right" style={{ color: '#174d32' }}>%</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {topProductsBySeason.dry.list.map((product: any) => (
                                    <TableRow key={product.productKey} className="hover:bg-gray-50 transition-colors">
                                      <TableCell>
    {product.displayRank && (
      <Badge className="bg-[#174d32]">{product.displayRank}</Badge>
    )}
  </TableCell>
                                      <TableCell>
                                        <p className="font-semibold text-sm">{product.brand}</p>
                                        <p className="text-xs text-gray-500">{product.name}</p>
                                      </TableCell>
                                      <TableCell className="text-right font-medium">
                                        {product.units.toLocaleString()}
                                      </TableCell>
                                      <TableCell className="text-right font-bold">
                                        ₱{product.revenue.toLocaleString()}
                                      </TableCell>
                                      <TableCell className="text-right">
                                        <Badge className="bg-green-100 text-green-800">
                                          {product.percentShare.toFixed(1)}%
                                        </Badge>
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                          ) : (
                            <div className="text-center py-8 text-gray-500 h-full flex items-center justify-center">
                              <p>No products found for Dry season.</p>
                            </div>
                          )
                        ) : (
                          <div className="h-full flex items-start justify-center">
                            <SeasonDonutChart
                              products={topProductsBySeason.dry.list}
                              season="dry"
                              topUnits={topProductsBySeason.dry.topUnits}
                              topRevenue={topProductsBySeason.dry.topRevenue}
                              otherUnits={topProductsBySeason.dry.otherUnits}
                              totalUnits={topProductsBySeason.dry.totalUnits}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
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
                  <span>Generating AI Insights & Strategies...</span>
                </>
              ) : (
                <>
                  <Zap className="size-5" />
                  Generate AI Insights & Strategies
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
                  Click the <strong>"Save"</strong> button above to unlock AI forecasting with the AR-2 model.
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
            {/* ==================== STOCK RECOMMENDATIONS ==================== */}
            {(stockRecommendations.length > 0 ? stockRecommendations : (forecastData.stockRecommendations || [])).length > 0 && (
              <Card className="shadow-lg border-0 overflow-hidden">
                <div className="bg-gradient-to-r from-green-900 to-emerald-600 px-6 py-4">
                  <div className="flex items-center gap-3">
                    <Lightbulb className="w-5 h-5 text-white" />
                    <div>
                      <h3 className="text-lg font-bold text-white">Product Stock Recommendations (2025)</h3>
                      <p className="text-xs text-white/70 mt-0.5">
                        Monthly stock for 2025 computed from multi-year historical averages, YoY demand trend, and seasonal safety buffer ({availableYears.join(", ")})
                      </p>
                    </div>
                  </div>
                </div>

                <CardContent>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="rounded-xl border border-orange-200 bg-orange-50/30 shadow-sm overflow-hidden flex flex-col">
                      <div className="px-4 py-3 border-b border-orange-100 bg-orange-50/60 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <TrendingUp className="size-4 text-orange-700" />
                          <div>
                            <h4 className="text-sm font-semibold text-orange-800 leading-tight">
                              Increase before peak month
                            </h4>
                            <p className="text-[11px] text-orange-700/80 leading-tight">
                              High-volume products
                            </p>
                          </div>
                        </div>
                        <Badge className="bg-orange-100 text-orange-800 text-[10px]">
                          {(stockRecommendations.length > 0 ? stockRecommendations : (forecastData.stockRecommendations || [])).filter((r: any) => r.action === "Increase").length} products
                        </Badge>
                      </div>

                      <div className="p-4" style={{ height: 400 }}>
                        {(() => {
                          const list = (stockRecommendations.length > 0 ? stockRecommendations : (forecastData.stockRecommendations || [])).filter((r: any) => r.action === "Increase");
                          if (list.length === 0) {
                            return (
                              <div className="text-center py-8 text-gray-500 h-full flex items-center justify-center">
                                <p>No products flagged for Increase.</p>
                              </div>
                            );
                          }
                          return (
                            <div className="season-table-scroll overflow-y-auto rounded-lg border border-orange-100 h-full">
                              <table className="w-full text-sm">
                                <thead className="sticky top-0 z-10 bg-white shadow-sm">
                                  <tr>
                                    <th className="text-left px-3 py-2 text-xs font-semibold text-orange-700">
                                      Product
                                    </th>
                                    <th className="text-right px-3 py-2 text-xs font-semibold text-orange-700">
                                      Recommended Stock
                                    </th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {list.map((category: any, idx: number) => {
                                    const categoryKey = category.category;
                                    const productRecommended =
                                      recommendedStockByProduct[categoryKey] ||
                                      (Array.isArray(category.items)
                                        ? category.items.map((item: any) => ({
                                            month: String(item.month || "").substring(0, 3),
                                            year: Number(item.year || new Date().getFullYear()),
                                            units: Number(item.units ?? item.peakUnits ?? 0),
                                            recommended: Number(item.recommended ?? item.recommendedStock ?? 0),
                                          }))
                                        : []);
                                    const pillBg = "bg-orange-100 text-orange-800 border-orange-200";

                                    return (
                                      <tr key={idx} className="border-b border-gray-100 hover:bg-orange-50/30 transition-colors">
                                        <td className="px-3 py-3 align-top">
                                          <span className="font-medium text-sm text-orange-800">
                                            {category.category}
                                          </span>
                                        </td>
                                        <td className="px-3 py-3 align-top text-right">
                                          <RecommendedStockDropdown
                                            items={productRecommended}
                                            pillBg={pillBg}
                                            isIncrease={true}
                                          />
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          );
                        })()}
                      </div>
                    </div>

                    <div className="rounded-xl border border-green-200 bg-green-50/30 shadow-sm overflow-hidden flex flex-col">
                      <div className="px-4 py-3 border-b border-green-100 bg-green-50/60 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <TrendingDown className="size-4 text-green-700" />
                          <div>
                            <h4 className="text-sm font-semibold text-green-800 leading-tight">
                              Maintain current stock
                            </h4>
                            <p className="text-[11px] text-green-700/80 leading-tight">
                              Products with steady demand
                            </p>
                          </div>
                        </div>
                        <Badge className="bg-green-100 text-green-800 text-[10px]">
                          {(stockRecommendations.length > 0 ? stockRecommendations : (forecastData.stockRecommendations || [])).filter((r: any) => r.action === "Maintain").length} products
                        </Badge>
                      </div>

                      <div className="p-4" style={{ height: 400 }}>
                        {(() => {
                          const list = (stockRecommendations.length > 0 ? stockRecommendations : (forecastData.stockRecommendations || [])).filter((r: any) => r.action === "Maintain");
                          if (list.length === 0) {
                            return (
                              <div className="text-center py-8 text-gray-500 h-full flex items-center justify-center">
                                <p>No products flagged for Maintain.</p>
                              </div>
                            );
                          }
                          return (
                            <div className="season-table-scroll overflow-y-auto rounded-lg border border-green-100 h-full">
                              <table className="w-full text-sm">
                                <thead className="sticky top-0 z-10 bg-white shadow-sm">
                                  <tr>
                                    <th className="text-left px-3 py-2 text-xs font-semibold text-green-700">
                                      Product
                                    </th>
                                    <th className="text-right px-3 py-2 text-xs font-semibold text-green-700">
                                      Recommended Stock
                                    </th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {list.map((category: any, idx: number) => {
                                    const categoryKey = category.category;
                                    const productRecommended =
                                      recommendedStockByProduct[categoryKey] ||
                                      (Array.isArray(category.items)
                                        ? category.items.map((item: any) => ({
                                            month: String(item.month || "").substring(0, 3),
                                            year: Number(item.year || new Date().getFullYear()),
                                            units: Number(item.units ?? item.peakUnits ?? 0),
                                            recommended: Number(item.recommended ?? item.recommendedStock ?? 0),
                                          }))
                                        : []);
                                    const pillBg = "bg-green-100 text-green-800 border-green-200";

                                    return (
                                      <tr key={idx} className="border-b border-gray-100 hover:bg-green-50/30 transition-colors">
                                        <td className="px-3 py-3 align-top">
                                          <span className="font-medium text-sm text-gray-800">
                                            {category.category}
                                          </span>
                                        </td>
                                        <td className="px-3 py-3 align-top text-right">
                                          <RecommendedStockDropdown
                                            items={productRecommended}
                                            pillBg={pillBg}
                                            isIncrease={false}
                                          />
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* ==================== PRODUCT PERFORMANCE ==================== */}
            {((forecastData.bestSellingProducts ?? bestSellingProducts).length > 0 ||
              (forecastData.slowMovingProducts ?? slowMovingProducts).length > 0) && (
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
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-start">
                    {(forecastData.bestSellingProducts ?? bestSellingProducts).length > 0 && (
                      <Card className="shadow-lg border-1 border-green-300 hover:shadow-xl transition-all duration-300 !gap-0">
                        <CardHeader className="bg-gradient-to-r from-green-900 to-emerald-700 rounded-t-lg border-b border-green-900 !p-2.5">
                          <div className="flex items-center gap-2">
                            <div className="w-5 h-5 rounded-lg ml-2 bg-green-800 flex items-center justify-center flex-shrink-0">
                              <TrendingUp className="size-3 text-white" />
                            </div>
                            <div>
                              <CardTitle className="text-sm font-semibold text-white">
                                Best-Selling Products
                              </CardTitle>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="!p-3">
                          <div className="season-table-scroll max-h-[360px] overflow-y-auto space-y-2 pr-1">
                            {(forecastData.bestSellingProducts ?? bestSellingProducts).map((product: any, index: number) => (
                              <div key={index} className="border rounded-lg p-2.5 hover:shadow-md transition">
                                <div className="flex justify-between items-start gap-2">
                                  <div className="min-w-0">
                                    <h4 className="font-semibold text-gray-800 text-sm truncate">{product.name}</h4>
                                    <p className="text-xs text-gray-500 mt-0.5">
                                      {product.unitsSold?.toLocaleString() || 0} units sold in last 12 months
                                    </p>
                                  </div>
                                  <div className="text-right flex-shrink-0">
                                    <div className="flex items-center gap-2 text-xs">
                                      <span className="text-green-600">Dry: {product.dryUnits || 0}</span>
                                      <span className="text-blue-600">Rainy: {product.rainyUnits || 0}</span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {(forecastData.slowMovingProducts ?? slowMovingProducts).length > 0 && (
                      <Card className="border-1 border-orange-300 shadow-lg hover:shadow-xl transition-all duration-300 !gap-0">
                        <CardHeader className="bg-gradient-to-r from-orange-700 to-amber-600 rounded-t-lg border-b border-orange-100 !p-2.5">
                          <div className="flex items-center gap-2">
                            <div className="w-5 h-5 ml-2 rounded-lg bg-orange-500 flex items-center justify-center flex-shrink-0">
                              <TrendingDown className="size-3 text-white" />
                            </div>
                            <div>
                              <CardTitle className="text-sm font-semibold text-white">
                                Slow-Moving Products
                              </CardTitle>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="!p-3">
                          <div className="season-table-scroll max-h-[360px] overflow-y-auto space-y-2 pr-1">
                            {(forecastData.slowMovingProducts ?? slowMovingProducts).map((product: any, index: number) => (
                              <div key={index} className="border rounded-lg p-2.5 hover:shadow-md transition">
                                <div className="flex justify-between items-start gap-2">
                                  <div className="min-w-0">
                                    <h4 className="font-semibold text-gray-800 text-sm truncate">{product.name}</h4>
                                    <p className="text-xs text-gray-500 mt-0.5">
                                      {product.unitsSold?.toLocaleString() || 0} units sold in last 12 months
                                    </p>
                                  </div>
                                  <div className="text-right flex-shrink-0">
                                    <div className="flex items-center gap-2 text-xs">
                                      <span className="text-green-600">Dry: {product.dryUnits || 0}</span>
                                      <span className="text-blue-600">Rainy: {product.rainyUnits || 0}</span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                </div>
              </section>
            )}

            {forecastData.marketingStrategies?.length > 0 && (
              <section className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
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

                  <div className="flex flex-wrap items-center gap-1.5 bg-white p-1.5 rounded-xl border border-emerald-100 shadow-sm w-fit">
                    {[
                      { id: "seasonal", label: "Dry & Rainy Season" },
                      { id: "product-demand", label: "High-Demand & Slow-Moving Products" },
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setStrategyFilter(tab.id as any)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                          strategyFilter === tab.id
                            ? "bg-[#174d32] text-white shadow-sm"
                            : "text-gray-600 hover:bg-emerald-50 hover:text-emerald-900"
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </div>

                {(() => {
                  const classifyStrategy = (strategy: any): "seasonal" | "high-demand" | "slow-moving" => {
                    const rawType = (strategy.categoryType || "").toLowerCase();
                    const label = (strategy.season || "").toLowerCase();
                    if (rawType === "high-demand" || label.includes("high-demand") || label.includes("high demand") || label.includes("best-selling")) {
                      return "high-demand";
                    }
                    if (rawType === "slow-moving" || label.includes("slow-moving") || label.includes("slow moving")) {
                      return "slow-moving";
                    }
                    return "seasonal";
                  };

                  const filteredStrategies = forecastData.marketingStrategies.filter((strategy: any) => {
                    const type = classifyStrategy(strategy);
                    if (strategyFilter === "seasonal") return type === "seasonal";
                    return type === "high-demand" || type === "slow-moving";
                  });

                  if (filteredStrategies.length === 0) {
                    return (
                      <Card className="border border-dashed border-emerald-200 bg-white">
                        <CardContent className="py-8 text-center text-sm text-gray-500">
                          No marketing strategies found for this filter. Click <strong>Edit</strong> and <strong>Save</strong> above to regenerate all strategy categories.
                        </CardContent>
                      </Card>
                    );
                  }

                  return (
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-start">
                      {filteredStrategies.map((strategy: any, index: number) => {
                        const label = (strategy.season || "").toLowerCase();
                        const sType = classifyStrategy(strategy);
                        const drySeason = label.includes("dry");
                        const isSlowMoving = sType === "slow-moving";
                        const isHighDemand = sType === "high-demand";

                        const headerGradient = isSlowMoving
                          ? "bg-gradient-to-r from-orange-700 to-amber-600"
                          : isHighDemand
                          ? "bg-gradient-to-r from-emerald-800 to-teal-600"
                          : drySeason
                          ? "bg-gradient-to-r from-green-900 to-emerald-600"
                          : "bg-gradient-to-r from-blue-700 to-sky-600";

                        const subTitle = isSlowMoving
                          ? "Clearance, bundling & inventory turnover"
                          : isHighDemand
                          ? "Upselling, contractor loyalty & volume growth"
                          : drySeason
                          ? "January – May"
                          : "June – December";

                        const iconBg = isSlowMoving
                          ? "bg-orange-100"
                          : isHighDemand
                          ? "bg-emerald-100"
                          : drySeason
                          ? "bg-green-100"
                          : "bg-blue-100";

                        const iconColor = isSlowMoving
                          ? "text-orange-600"
                          : isHighDemand
                          ? "text-emerald-700"
                          : drySeason
                          ? "text-green-600"
                          : "text-blue-700";

                        const rawStrategies = Array.isArray(strategy.strategies) ? strategy.strategies : [];
                        const displayStrategies =
                          sType === "seasonal" ? rawStrategies.slice(0, 5) : rawStrategies;
                        const targetProductsList = Array.isArray(strategy.targetProducts)
                          ? strategy.targetProducts
                          : [];

                        return (
                          <Card
                            key={index}
                            className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden !gap-0"
                          >
                            <div className={`${headerGradient} px-4 py-3`}>
                              <div className="flex items-center gap-2.5">
                                <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center backdrop-blur-sm">
                                  {isSlowMoving ? (
                                    <TrendingDown className="size-4 text-white" />
                                  ) : isHighDemand ? (
                                    <TrendingUp className="size-4 text-white" />
                                  ) : (
                                    <Lightbulb className="size-4 text-white" />
                                  )}
                                </div>
                                <div>
                                  <h3 className="text-sm font-semibold text-white">{strategy.season}</h3>
                                  <p className="text-xs text-white/70">{subTitle}</p>
                                </div>
                                <Badge className="ml-auto bg-white/20 text-white border-0">
                                  {displayStrategies.length} {displayStrategies.length === 1 ? "strategy" : "strategies"}
                                </Badge>
                              </div>
                            </div>

                            <CardContent className="!p-3">
                              <div className="season-table-scroll max-h-[420px] overflow-y-auto grid gap-2.5 pr-1">
                                {displayStrategies.map((item: string, i: number) => {
                                  const cleanedItem = String(item || "").replace(/\*\*/g, "").trim();
                                  const colonIdx = cleanedItem.indexOf(":");
                                  const hasTitle = colonIdx > 0 && colonIdx < 80;
                                  const strategyTitle = hasTitle
                                    ? cleanedItem.substring(0, colonIdx).trim()
                                    : `Strategy ${i + 1}`;
                                  const strategyDesc = hasTitle
                                    ? cleanedItem.substring(colonIdx + 1).trim()
                                    : cleanedItem;

                                  return (
                                    <div
                                      key={i}
                                      className="flex gap-3 rounded-xl border border-gray-100 bg-white p-3 hover:shadow-md transition-all hover:border-gray-200"
                                    >
                                      <div
                                        className={`flex h-7 w-7 items-center justify-center rounded-full flex-shrink-0 ${iconBg}`}
                                      >
                                        <CheckCircle2 className={`size-4 ${iconColor}`} />
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-gray-800">
                                          {strategyTitle}
                                        </p>
                                        <p className="text-sm leading-relaxed text-gray-600 break-words mt-0.5">
                                          {strategyDesc}
                                        </p>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  );
                })()}
              </section>
            )}
          </div>
        )}
      </div>
    );
  }