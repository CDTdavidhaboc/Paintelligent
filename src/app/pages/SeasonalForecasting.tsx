import { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Badge } from "../components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceArea,
} from "recharts";
import {
  TrendingUp, TrendingDown, AlertCircle, CheckCircle, Target, Lightbulb,
  Calendar, Filter, Plus, Trash2,
  Loader2, CheckCircle2,
} from "lucide-react";


const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const SEASON_FOR_MONTH = (m) => (m >= 10 || m <= 4) ? "Dry" : "Rainy"; // 0-indexed

// ── Helpers ────────────────────────────────────────────────────────────────

const toCSV = (rows) => {
  const header = "Month,Year,Season,Sales (PHP)";
  const body = rows.map(r => `${r.month},${r.year},${r.season},${r.sales}`).join("\n");
  return `${header}\n${body}`;
};

// ── Main Component ─────────────────────────────────────────────────────────

export default function SeasonalForecasting() {

  // ── Sales Data (user-inputted) ───────────────────────────────────────────
  const [salesData, setSalesData] = useState(() => {
    try { return JSON.parse(localStorage.getItem("gpc_sales_data") || "[]"); }
    catch { return []; }
  });

  useEffect(() => {
    localStorage.setItem("gpc_sales_data", JSON.stringify(salesData));
  }, [salesData]);

  const [newRow, setNewRow] = useState({ month: "Jan", year: new Date().getFullYear(), sales: "" });

  const addRow = () => {
    if (!newRow.sales || isNaN(parseFloat(newRow.sales))) return;
    const monthIdx = MONTH_NAMES.indexOf(newRow.month);
    const season = SEASON_FOR_MONTH(monthIdx);
    const entry = {
      id: `row-${Date.now()}`,
      month: newRow.month,
      year: newRow.year,
      season,
      sales: parseFloat(newRow.sales),
    };
    const sorted = [...salesData, entry].sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      return MONTH_NAMES.indexOf(a.month) - MONTH_NAMES.indexOf(b.month);
    });
    setSalesData(sorted);
    setNewRow({ month: "Jan", year: new Date().getFullYear(), sales: "" });
  };

  const deleteRow = (id) => setSalesData(prev => prev.filter(r => r.id !== id));

  // ── n8n — Sales Forecasting Agent ───────────────────────────────────────
  const [forecastData, setForecastData] = useState(null);
  const [forecastStatus, setForecastStatus] = useState("idle");

  const runForecastAgent = async (data) => {
    if (!data.length) return;
    setForecastStatus("fetching");
    try {
      const res = await fetch(N8N_FORECAST_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          salesData: data.map(r => ({ Month: r.month, Year: r.year, Season: r.season, "Sales (PHP)": r.sales })),
          csvExport: toCSV(data),
          source: "Paintelligent - Sales Forecasting",
          timestamp: new Date().toISOString(),
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const result = await res.json();
      setForecastData(result);
      setForecastStatus("success");
      setTimeout(() => setForecastStatus("idle"), 3000);
      return result;
    } catch {
      setForecastStatus("idle");
    }
  };

  // ── n8n — Prescriptive Analytics Agent ──────────────────────────────────
  const [prescriptiveData, setPrescriptiveData] = useState(null);
  const [prescriptiveStatus, setPrescriptiveStatus] = useState("idle");

  const runPrescriptiveAgent = async (data, forecast) => {
    if (!data.length) return;
    setPrescriptiveStatus("fetching");
    try {
      const res = await fetch(N8N_PRESCRIPTIVE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          salesData: data.map(r => ({ Month: r.month, Year: r.year, Season: r.season, "Sales (PHP)": r.sales })),
          forecastData: forecast?.forecast || [],
          csvExport: toCSV(data),
          source: "Paintelligent - Prescriptive Analytics",
          timestamp: new Date().toISOString(),
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const result = await res.json();
      setPrescriptiveData(result);
      setPrescriptiveStatus("success");
      setTimeout(() => setPrescriptiveStatus("idle"), 3000);
    } catch {
      setPrescriptiveStatus("idle");
    }
  };

  // ── Auto-run both agents on mount (fires when admin logs in) ────────────
  useEffect(() => {
    if (!salesData.length) return;
    const init = async () => {
      const forecast = await runForecastAgent(salesData);
      await runPrescriptiveAgent(salesData, forecast);
    };
    init();
  }, []);


  // ── Chart / view state ───────────────────────────────────────────────────
  const [viewMode, setViewMode] = useState("monthly");
  const [selectedMonth, setSelectedMonth] = useState("");
  const [timeFilter, setTimeFilter] = useState("all");
  const [chartKey, setChartKey] = useState(0);

  useEffect(() => { setChartKey(k => k + 1); }, [viewMode, timeFilter, selectedMonth, salesData, forecastData]);

  // First available month for weekly selector
  useEffect(() => {
    if (salesData.length && !selectedMonth) {
      setSelectedMonth(`${salesData[0].month} ${salesData[0].year}`);
    }
  }, [salesData]);

  // ── Derived chart data ───────────────────────────────────────────────────
  const historicalChartData = useMemo(() =>
    salesData.map((r, i) => ({
      id: `hist-${i}`,
      month: `${r.month} ${r.year}`,
      sales: r.sales,
      season: r.season,
      isForecast: false,
      upperBound: null,
      lowerBound: null,
    })),
    [salesData]
  );

  const forecastChartData = useMemo(() => {
    if (!forecastData?.forecast) return [];
    return forecastData.forecast.map((f, i) => ({
      id: `fore-${i}`,
      month: f.month,
      sales: f.sales,
      season: f.season || "Dry",
      isForecast: true,
      upperBound: f.upperBound ?? null,
      lowerBound: f.lowerBound ?? null,
    }));
  }, [forecastData]);

  const allMonthlyData = useMemo(() => [...historicalChartData, ...forecastChartData], [historicalChartData, forecastChartData]);

  const filteredMonthlyData = useMemo(() => {
    let data = allMonthlyData;
    if (timeFilter !== "all") {
      const hist = data.filter(d => !d.isForecast && d.month.includes(timeFilter));
      const fore = data.filter(d => d.isForecast);
      data = timeFilter === new Date().getFullYear().toString() ? [...hist, ...fore] : hist;
    }
    return data.map((d, i) => ({ ...d, id: `${chartKey}-${i}` }));
  }, [allMonthlyData, timeFilter, chartKey]);

  const weeklyChartData = useMemo(() => {
    const row = salesData.find(r => `${r.month} ${r.year}` === selectedMonth);
    if (!row) return [];
    const base = row.sales / 4;
    return ["Week 1", "Week 2", "Week 3", "Week 4"].map((week, i) => ({
      id: `w-${i}`,
      week,
      sales: Math.round(base + (Math.random() * base * 0.1 - base * 0.05)),
      season: row.season,
    }));
  }, [selectedMonth, salesData]);

  const seasonalAreas = useMemo(() => {
    const areas = [];
    let areaIdx = 0;
    const data = filteredMonthlyData;
    for (let i = 0; i < data.length; i++) {
      const curr = data[i];
      const prev = data[i - 1];
      if (i === 0 || prev?.season !== curr.season) {
        let end = i;
        while (end < data.length - 1 && data[end + 1].season === curr.season) end++;
        areas.push({
          key: `area-${chartKey}-${areaIdx++}`,
          x1: curr.month,
          x2: data[end].month,
          fill: curr.season === "Dry" ? "#86efac" : "#d1fae5",
          stroke: curr.season === "Dry" ? "#22c55e" : "#6ee7b7",
        });
      }
    }
    return areas;
  }, [filteredMonthlyData, chartKey]);

  // ── Computed summary stats ───────────────────────────────────────────────
  const totalSales = useMemo(() => salesData.reduce((s, r) => s + r.sales, 0), [salesData]);
  const drySales = useMemo(() => salesData.filter(r => r.season === "Dry").reduce((s, r) => s + r.sales, 0), [salesData]);
  const rainySales = useMemo(() => salesData.filter(r => r.season === "Rainy").reduce((s, r) => s + r.sales, 0), [salesData]);
  const availableMonths = useMemo(() => salesData.map(r => `${r.month} ${r.year}`), [salesData]);

  const seasonalTrends = forecastData?.seasonalTrends || null;
  const highDemand = prescriptiveData?.highDemandProducts || null;
  const bestSelling = prescriptiveData?.bestSellingProducts || [];
  const slowMoving = prescriptiveData?.slowMovingProducts || [];
  const stockRecs = prescriptiveData?.stockRecommendations || [];
  const marketing = prescriptiveData?.marketingStrategies || [];

  // ── Years available for filter ────────────────────────────────────────────
  const availableYears = useMemo(() => [...new Set(salesData.map(r => r.year))].sort(), [salesData]);

  return (
    <div className="p-8 space-y-6 bg-gray-50">


      {/* ── Sales Data Input ── */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Calendar className="size-5 text-[#1a4d2e]" />
                Sales Data Input
              </CardTitle>
              <CardDescription>Enter monthly sales figures. Export as CSV to feed your n8n agents.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Add row form */}
          <div className="flex gap-2 mb-4 flex-wrap">
            <select value={newRow.month} onChange={e => setNewRow(p => ({ ...p, month: e.target.value }))}
              className="border-2 border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#1a4d2e]">
              {MONTH_NAMES.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            <input type="number" value={newRow.year} onChange={e => setNewRow(p => ({ ...p, year: parseInt(e.target.value) }))}
              placeholder="Year" min={2000} max={2100}
              className="border-2 border-gray-300 rounded-lg px-3 py-2 text-sm w-24 focus:outline-none focus:border-[#1a4d2e]" />
            <input type="number" value={newRow.sales} onChange={e => setNewRow(p => ({ ...p, sales: e.target.value }))}
              placeholder="Sales (PHP)" min={0}
              className="border-2 border-gray-300 rounded-lg px-3 py-2 text-sm w-44 focus:outline-none focus:border-[#1a4d2e]" />
            <button onClick={addRow}
              className="flex items-center gap-2 bg-[#1a4d2e] hover:bg-[#2d6b45] text-white px-4 py-2 rounded-lg text-sm font-medium">
              <Plus className="size-4" /> Add
            </button>
          </div>

          {salesData.length === 0 ? (
            <div className="text-center py-12 text-gray-400 border-2 border-dashed border-gray-200 rounded-lg">
              <Calendar className="size-10 mx-auto mb-2 opacity-40" />
              <p className="font-medium">No sales data yet</p>
              <p className="text-sm">Add monthly entries above or import a CSV file.</p>
            </div>
          ) : (
            <div className="overflow-auto max-h-72">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Month</TableHead>
                    <TableHead>Year</TableHead>
                    <TableHead>Season</TableHead>
                    <TableHead>Sales (PHP)</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {salesData.map(r => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.month}</TableCell>
                      <TableCell>{r.year}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={r.season === "Dry" ? "bg-green-100 text-green-800" : "bg-blue-100 text-blue-800"}>
                          {r.season}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-semibold">₱{r.sales.toLocaleString()}</TableCell>
                      <TableCell>
                        <button onClick={() => deleteRow(r.id)} className="text-red-400 hover:text-red-600 transition-colors">
                          <Trash2 className="size-4" />
                        </button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Summary Cards ── */}
      {salesData.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="border-l-4 border-[#1a4d2e]">
            <CardContent className="pt-5">
              <p className="text-sm text-gray-500">Total Sales</p>
              <p className="text-2xl font-bold text-gray-900">₱{totalSales.toLocaleString()}</p>
              <p className="text-xs text-gray-400 mt-1">{salesData.length} months recorded</p>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-green-500">
            <CardContent className="pt-5">
              <p className="text-sm text-gray-500 flex items-center gap-1"><TrendingUp className="size-4 text-green-500" /> Dry Season</p>
              <p className="text-2xl font-bold text-gray-900">₱{drySales.toLocaleString()}</p>
              <p className="text-xs text-gray-400 mt-1">{salesData.filter(r => r.season === "Dry").length} months</p>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-blue-400">
            <CardContent className="pt-5">
              <p className="text-sm text-gray-500 flex items-center gap-1"><TrendingDown className="size-4 text-blue-500" /> Rainy Season</p>
              <p className="text-2xl font-bold text-gray-900">₱{rainySales.toLocaleString()}</p>
              <p className="text-xs text-gray-400 mt-1">{salesData.filter(r => r.season === "Rainy").length} months</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Charts ── */}
      {salesData.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-3">
              <CardTitle className="text-lg">
                {viewMode === "monthly" ? "Monthly Sales Trend" : `Weekly Breakdown — ${selectedMonth}`}
              </CardTitle>
              <div className="flex items-center gap-3 flex-wrap">
                {viewMode === "monthly" && (
                  <select value={timeFilter} onChange={e => setTimeFilter(e.target.value)}
                    className="border-2 border-[#1a4d2e] rounded-lg px-3 py-2 text-sm focus:outline-none">
                    <option value="all">All Years</option>
                    {availableYears.map(y => <option key={y} value={String(y)}>{y}</option>)}
                  </select>
                )}
                <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
                  <button onClick={() => setViewMode("monthly")}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${viewMode === "monthly" ? "bg-[#1a4d2e] text-white" : "text-gray-600"}`}>
                    <Calendar className="size-4 inline mr-1" />Monthly
                  </button>
                  <button onClick={() => setViewMode("weekly")} disabled={!salesData.length}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all disabled:opacity-40 ${viewMode === "weekly" ? "bg-[#1a4d2e] text-white" : "text-gray-600"}`}>
                    <Filter className="size-4 inline mr-1" />Weekly
                  </button>
                </div>
                {viewMode === "weekly" && (
                  <select value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}
                    className="border-2 border-[#1a4d2e] rounded-lg px-3 py-2 text-sm focus:outline-none">
                    {availableMonths.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={350} key={`container-${chartKey}`}>
              <LineChart data={viewMode === "monthly" ? filteredMonthlyData : weeklyChartData} key={`chart-${chartKey}`}>
                <CartesianGrid strokeDasharray="3 3" />
                {viewMode === "monthly" && seasonalAreas.map(a => (
                  <ReferenceArea key={a.key} x1={a.x1} x2={a.x2} fill={a.fill} fillOpacity={0.5} stroke={a.stroke} strokeOpacity={0.5} ifOverflow="extendDomain" />
                ))}
                <XAxis dataKey={viewMode === "monthly" ? "month" : "week"} angle={viewMode === "monthly" ? -45 : 0}
                  textAnchor={viewMode === "monthly" ? "end" : "middle"} height={viewMode === "monthly" ? 80 : 60}
                  interval="preserveStartEnd" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={v => `₱${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v, name) => [`₱${Number(v).toLocaleString()}`, name]}
                  labelFormatter={label => {
                    const pt = allMonthlyData.find(d => d.month === label);
                    return pt ? `${label} (${pt.season}) ${pt.isForecast ? "— Forecast" : "— Historical"}` : label;
                  }} />
                {viewMode === "monthly" ? (
                  <>
                    <Line dataKey={e => e.isForecast ? null : e.sales} type="monotone" stroke="#1a4d2e" strokeWidth={3} dot={false} name="Historical Sales" connectNulls={false} isAnimationActive={false} key={`hist-${chartKey}`} />
                    <Line dataKey={e => e.isForecast ? e.sales : null} type="monotone" stroke="#15803d" strokeWidth={3} strokeDasharray="8 4" dot={false} name="Forecasted Sales" connectNulls isAnimationActive={false} key={`fore-${chartKey}`} />
                    <Line dataKey="upperBound" type="monotone" stroke="#86efac" strokeWidth={1.5} strokeDasharray="3 3" dot={false} name="Upper Bound" connectNulls={false} isAnimationActive={false} key={`ub-${chartKey}`} />
                    <Line dataKey="lowerBound" type="monotone" stroke="#86efac" strokeWidth={1.5} strokeDasharray="3 3" dot={false} name="Lower Bound" connectNulls={false} isAnimationActive={false} key={`lb-${chartKey}`} />
                  </>
                ) : (
                  <Line dataKey="sales" type="monotone" stroke="#1a4d2e" strokeWidth={3} name="Weekly Sales" isAnimationActive={false} key={`weekly-${chartKey}`} />
                )}
              </LineChart>
            </ResponsiveContainer>

            {/* Chart legend */}
            <div className="flex items-center gap-4 mt-3 flex-wrap text-xs text-gray-600">
              <span className="flex items-center gap-1"><span className="inline-block w-6 h-0.5 bg-[#1a4d2e]" /> Historical</span>
              {forecastData && <span className="flex items-center gap-1"><span className="inline-block w-6 h-0.5 bg-green-600 border-t-2 border-dashed border-green-600" /> Forecast (n8n)</span>}
              <span className="flex items-center gap-1"><span className="inline-block w-4 h-3 rounded bg-green-200 opacity-70" /> Dry Season</span>
              <span className="flex items-center gap-1"><span className="inline-block w-4 h-3 rounded bg-green-100 opacity-70" /> Rainy Season</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── n8n Forecast — Seasonal Trends ── */}
      {seasonalTrends && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="border-l-4 border-blue-400">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><TrendingDown className="size-5 text-blue-500" /> Rainy Season (Jun–Oct)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between"><span className="text-gray-500">Total Sales</span><span className="font-bold">₱{seasonalTrends.rainy?.totalSales?.toLocaleString()}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Avg Monthly</span><span className="font-bold">₱{seasonalTrends.rainy?.averageMonthlySales?.toLocaleString()}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Trend</span><Badge variant="secondary" className="bg-blue-100 text-blue-800">{seasonalTrends.rainy?.trend}</Badge></div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-green-500">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><TrendingUp className="size-5 text-green-600" /> Dry Season (Nov–May)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between"><span className="text-gray-500">Total Sales</span><span className="font-bold">₱{seasonalTrends.dry?.totalSales?.toLocaleString()}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Avg Monthly</span><span className="font-bold">₱{seasonalTrends.dry?.averageMonthlySales?.toLocaleString()}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Trend</span><Badge variant="secondary" className="bg-green-100 text-green-800">{seasonalTrends.dry?.trend}</Badge></div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── n8n Prescriptive — High Demand Products ── */}
      {highDemand && (
        <Tabs defaultValue="dry" className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="dry">Dry Season</TabsTrigger>
            <TabsTrigger value="rainy">Rainy Season</TabsTrigger>
          </TabsList>
          {["dry", "rainy"].map(s => (
            <TabsContent key={s} value={s}>
              <Card>
                <CardHeader>
                  <CardTitle>Top Products — {s === "dry" ? "Dry Season (Nov–May)" : "Rainy Season (Jun–Oct)"}</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Rank</TableHead><TableHead>Product</TableHead>
                        <TableHead>Units Sold</TableHead><TableHead>Revenue</TableHead><TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(highDemand[s] || []).map((p, i) => (
                        <TableRow key={i}>
                          <TableCell><Badge className={s === "dry" ? "bg-[#1a4d2e]" : "bg-blue-600"}>#{i + 1}</Badge></TableCell>
                          <TableCell className="font-medium">{p.name}</TableCell>
                          <TableCell>{p.units?.toLocaleString()}</TableCell>
                          <TableCell>₱{p.revenue?.toLocaleString()}</TableCell>
                          <TableCell><Badge variant="secondary" className={s === "dry" ? "bg-green-100 text-green-800" : "bg-blue-100 text-blue-800"}>{s === "dry" ? "High Demand" : "Weather-Specific"}</Badge></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>
      )}

      {/* ── n8n Prescriptive — Full analytics section ── */}
      {prescriptiveData && (
        <div className="bg-gradient-to-r from-green-50 to-green-100 p-6 rounded-lg border-2 border-green-300 space-y-6">

          {/* Stock Recommendations */}
          {stockRecs.length > 0 && (
            <div>
              <h2 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <div className="size-2 bg-[#1a4d2e] rounded-full" />
                Stock Recommendations
              </h2>
              <div className="space-y-4">
                {stockRecs.map((cat, idx) => (
                  <Card key={idx} className={`border-l-4 ${idx === 0 ? "border-red-600" : idx === 1 ? "border-yellow-500" : "border-green-600"}`}>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-base">
                        {idx < 2 ? <AlertCircle className="size-5" /> : <CheckCircle className="size-5 text-green-600" />}
                        {cat.category}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Product</TableHead><TableHead>Current Stock</TableHead>
                            <TableHead>Recommended</TableHead><TableHead>Action</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(cat.items || []).map((item, i) => (
                            <TableRow key={i}>
                              <TableCell className="font-medium">{item.name}</TableCell>
                              <TableCell className="font-semibold">{item.currentStock} units</TableCell>
                              <TableCell className="text-green-700 font-medium">{item.recommendedStock} units</TableCell>
                              <TableCell><Badge variant="secondary" className={idx === 0 ? "bg-red-600 text-white" : idx === 1 ? "bg-yellow-500 text-white" : "bg-green-600 text-white"}>{item.action}</Badge></TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Best & Slow Moving */}
          {(bestSelling.length > 0 || slowMoving.length > 0) && (
            <div>
              <h2 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <div className="size-2 bg-[#1a4d2e] rounded-full" />
                Product Performance Analysis
              </h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {bestSelling.length > 0 && (
                  <Card className="border-l-4 border-green-500">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-base"><TrendingUp className="size-5 text-green-600" /> Best-Selling Products</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Table>
                        <TableHeader><TableRow><TableHead>Product</TableHead><TableHead>Units</TableHead><TableHead>Growth</TableHead></TableRow></TableHeader>
                        <TableBody>
                          {bestSelling.map((p, i) => (
                            <TableRow key={i}>
                              <TableCell className="font-medium">{p.name}</TableCell>
                              <TableCell>{p.unitsSold?.toLocaleString()}</TableCell>
                              <TableCell><Badge className="bg-green-100 text-green-800">{p.growth}</Badge></TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                )}
                {slowMoving.length > 0 && (
                  <Card className="border-l-4 border-lime-600">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-base"><TrendingDown className="size-5 text-lime-700" /> Slow-Moving Products</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Table>
                        <TableHeader><TableRow><TableHead>Product</TableHead><TableHead>Units</TableHead><TableHead>Recommendation</TableHead></TableRow></TableHeader>
                        <TableBody>
                          {slowMoving.map((p, i) => (
                            <TableRow key={i}>
                              <TableCell className="font-medium">{p.name}</TableCell>
                              <TableCell className="text-lime-700">{p.unitsSold}</TableCell>
                              <TableCell><Badge variant="secondary" className="bg-lime-100 text-lime-800 text-xs">{p.recommendation}</Badge></TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          )}

          {/* Marketing Strategies */}
          {marketing.length > 0 && (
            <div>
              <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <Target className="size-5 text-[#1a4d2e]" /> Marketing Strategy Recommendations
              </h3>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {marketing.map((strat, idx) => (
                  <Card key={idx} className={`border-l-4 ${idx === 0 ? "border-green-500" : "border-blue-400"}`}>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Lightbulb className={`size-5 ${idx === 0 ? "text-green-600" : "text-blue-500"}`} />
                        {strat.season}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2">
                        {(strat.strategies || []).map((item, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <CheckCircle className={`size-4 mt-0.5 flex-shrink-0 ${idx === 0 ? "text-green-600" : "text-blue-500"}`} />
                            <span className="text-sm text-gray-700">{item}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Empty state when no data and no prescriptive */}
      {salesData.length === 0 && !prescriptiveData && (
        <Card className="border-dashed border-2 border-gray-300">
          <CardContent className="py-16 text-center">
            <TrendingUp className="size-14 text-gray-300 mx-auto mb-3" />
            <p className="text-lg font-semibold text-gray-400">No data yet</p>
            <p className="text-sm text-gray-400 mt-1">Add monthly sales entries above to get started. Then run your n8n agents for forecasting and prescriptive analytics.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
