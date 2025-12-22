
import { useEffect, useState, useMemo } from 'react';
import { Search, TrendingUp, TrendingDown, AlertTriangle, Activity, DollarSign, Percent, BarChart3, X } from 'lucide-react';
import { fetchItemMapping, fetchLatest, fetchTimeSeries } from './utils/api';
import type { ItemMapping } from './utils/api';
import { analyzeItemData } from './utils/strategy';
import type { StrategyResult } from './utils/strategy';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

export default function App() {
  const [items, setItems] = useState<ItemMapping[]>([]);
  const [loadingItems, setLoadingItems] = useState(true);

  const [query, setQuery] = useState("");
  const [selectedItem, setSelectedItem] = useState<ItemMapping | null>(null);
  const [mode, setMode] = useState<"Buying" | "Selling">("Buying");

  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [analysis, setAnalysis] = useState<StrategyResult | null>(null);
  const [currentPrice, setCurrentPrice] = useState<number>(0);

  // Load Mapping
  useEffect(() => {
    fetchItemMapping().then(data => {
      setItems(data);
      setLoadingItems(false);
    });
  }, []);

  // Filter Search
  const searchResults = useMemo(() => {
    if (!query || query.length < 2) return [];
    const lower = query.toLowerCase();
    return items.filter(i => i.name.toLowerCase().includes(lower)).slice(0, 10);
  }, [query, items]);

  const handleSelect = (item: ItemMapping) => {
    setSelectedItem(item);
    setQuery(item.name);
    setAnalysis(null);
    runAnalysis(item, mode);
  };

  const handleModeToggle = (newMode: "Buying" | "Selling") => {
    setMode(newMode);
    if (selectedItem) {
      runAnalysis(selectedItem, newMode);
    }
  };

  const runAnalysis = async (item: ItemMapping, mode: "Buying" | "Selling") => {
    setLoadingAnalysis(true);
    try {
      const latest = await fetchLatest(item.id);
      const timeseries = await fetchTimeSeries(item.id, "24h");

      if (!latest || !timeseries) {
        setAnalysis(null);
        return;
      }

      // Latest Format: { high, highTime, low, lowTime }
      // Buying: You pay Ask (High) usually.
      // Selling: You get Bid (Low) usually.
      const isBuying = mode === "Buying";
      const price = isBuying ? latest.high : latest.low;
      const targetLimit = isBuying ? latest.low : latest.high; // Target limit (Passive) - Inverse of instant

      // Convert timeseries to DailyPoint[]
      // Wiki Timeseries "24h" endpoint returns { avgHighPrice, avgLowPrice, highPriceVolume, lowPriceVolume, timestamp }
      // This matches our DailyPoint interface exactly.

      const result = analyzeItemData(price, targetLimit, timeseries, isBuying);

      setCurrentPrice(price);
      setAnalysis(result);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingAnalysis(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 p-6 font-sans selection:bg-emerald-500/30">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-neutral-800 pb-6">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
              OSRS Flipper
            </h1>
            <p className="text-neutral-400 mt-1">Advanced Market Intelligence & Strategy Engine</p>
          </div>
          <div className="flex items-center gap-2 text-sm text-neutral-500">
            <div className={cn("w-2 h-2 rounded-full", loadingItems ? "bg-yellow-500 animate-pulse" : "bg-emerald-500")} />
            {loadingItems ? "Syncing GE Database..." : "GE Database Ready"}
          </div>
        </header>

        {/* Controls */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-3 relative z-50">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-500" />
              <input
                type="text"
                placeholder="Search item (e.g., Abyssal Whip)..."
                className="w-full bg-neutral-900 border border-neutral-800 rounded-xl py-3 pl-10 pr-10 focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 outline-none transition-all placeholder:text-neutral-600"
                value={query}
                onChange={e => setQuery(e.target.value)}
              />
              {query && (
                <button
                  onClick={() => {
                    setQuery("");
                    setSelectedItem(null);
                    setAnalysis(null);
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>
            {/* Dropdown */}
            {searchResults.length > 0 && query !== selectedItem?.name && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-neutral-900 border border-neutral-800 rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 z-50">
                {searchResults.map(item => (
                  <button
                    key={item.id}
                    className="w-full text-left px-4 py-3 hover:bg-neutral-800 flex items-center gap-3 transition-colors"
                    onClick={() => handleSelect(item)}
                  >
                    <img src={`https://oldschool.runescape.wiki/images/${item.icon.replace(/ /g, '_')}`} alt="" className="w-6 h-6 object-contain" onError={(e) => e.currentTarget.style.display = 'none'} />
                    <span>{item.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="bg-neutral-900 p-1 rounded-xl flex border border-neutral-800 relative">
            <button
              onClick={() => handleModeToggle("Buying")}
              className={cn(
                "flex-1 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 relative z-10",
                mode === "Buying" ? "text-white shadow-sm" : "text-neutral-500 hover:text-neutral-300"
              )}
            >
              Buying
            </button>
            <button
              onClick={() => handleModeToggle("Selling")}
              className={cn(
                "flex-1 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 relative z-10",
                mode === "Selling" ? "text-white shadow-sm" : "text-neutral-500 hover:text-neutral-300"
              )}
            >
              Selling
            </button>
            {/* Scanning background pill */}
            <div className={cn(
              "absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-lg bg-neutral-700/50 transition-all duration-300",
              mode === "Selling" ? "left-[calc(50%+2px)]" : "left-1"
            )} />
          </div>
        </div>

        {/* Content Area */}
        {selectedItem && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">

            {/* Main Analysis Card */}
            <div className={cn(
              "rounded-2xl p-6 border-2 shadow-[0_0_40px_-10px_rgba(0,0,0,0.5)] transition-all",
              loadingAnalysis ? "opacity-50 blur-[2px]" : "opacity-100 blur-0",
              !analysis ? "border-neutral-800 bg-neutral-900/50" :
                analysis.color === "green" ? "border-emerald-500/30 bg-emerald-950/10 shadow-emerald-900/20" :
                  analysis.color === "red" ? "border-red-500/30 bg-red-950/10 shadow-red-900/20" :
                    "border-yellow-500/30 bg-yellow-950/10 shadow-yellow-900/20"
            )}>
              {loadingAnalysis ? (
                <div className="h-40 flex items-center justify-center text-neutral-400 gap-3">
                  <Activity className="animate-spin w-6 h-6" />
                  <span>Analyzing Market Data...</span>
                </div>
              ) : analysis ? (
                <div className="space-y-6">
                  <div className="flex flex-col md:flex-row justify-between md:items-start gap-4">
                    <div>
                      <div className="flex items-center gap-3">
                        <h2 className="text-4xl font-black tracking-tight flex items-center gap-3">
                          {analysis.decision}
                        </h2>
                        <span className={cn(
                          "px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border",
                          analysis.color === "green" ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-300" :
                            analysis.color === "red" ? "bg-red-500/20 border-red-500/50 text-red-300" :
                              "bg-yellow-500/20 border-yellow-500/50 text-yellow-300"
                        )}>
                          {analysis.subtext}
                        </span>
                      </div>
                      <p className="mt-2 text-lg text-neutral-300 max-w-2xl leading-relaxed">
                        {analysis.explanation}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-neutral-500 uppercase tracking-widest font-semibold mb-1">Current Price</p>
                      <div className="text-3xl font-mono font-medium text-white">
                        {currentPrice.toLocaleString()} <span className="text-yellow-500 text-lg">gp</span>
                      </div>
                      <div className="text-xs text-neutral-500 mt-1">
                        Target: {analysis.metrics.targetLimit.toLocaleString()} gp
                      </div>
                    </div>
                  </div>

                  <div className="h-px bg-gradient-to-r from-transparent via-neutral-700 to-transparent" />

                  {/* Suggested Price Action Bar */}
                  <div className="flex items-center justify-between bg-neutral-800/60 rounded-xl p-4 border border-neutral-700/50">
                    <div className="flex items-center gap-3">
                      <div className="bg-emerald-500/10 p-2 rounded-lg">
                        <DollarSign className="w-5 h-5 text-emerald-400" />
                      </div>
                      <div>
                        <p className="text-xs text-neutral-400 uppercase tracking-wider font-bold">{analysis.suggestedPriceLabel}</p>
                        <p className="text-sm text-neutral-300">Recommended Order Price</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-mono font-bold text-emerald-400">
                        {analysis.suggestedPrice.toLocaleString()} <span className="text-sm text-emerald-600/70">gp</span>
                      </div>
                      <div className={cn(
                        "text-xs font-medium",
                        analysis.suggestedPrice < currentPrice ? "text-emerald-500" : "text-neutral-500"
                      )}>
                        {analysis.suggestedPrice < currentPrice
                          ? `${((currentPrice - analysis.suggestedPrice) / currentPrice * 100).toFixed(1)}% below current`
                          : analysis.suggestedPrice > currentPrice
                            ? `${((analysis.suggestedPrice - currentPrice) / currentPrice * 100).toFixed(1)}% above current`
                            : "At current market price"
                        }
                      </div>
                    </div>
                  </div>

                  {/* Metrics Grid */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <MetricCard
                      label={mode === "Buying" ? "Discount vs 30d" : "Tax Cost"}
                      value={mode === "Buying" ? `${analysis.metrics.discountPct.toFixed(1)}%` : `${analysis.metrics.taxBasis.toLocaleString()}`}
                      subValue={mode === "Buying" ? "vs 30d High" : "gp"}
                      icon={mode === "Buying" ? Percent : DollarSign}
                      trend={mode === "Buying" ? (analysis.metrics.discountPct > 10 ? "up" : "down") : "neutral"}
                    />
                    <MetricCard
                      label="RSI (14)"
                      value={analysis.metrics.rsi.toFixed(0)}
                      subValue={analysis.metrics.rsi > 70 ? "Overbought" : analysis.metrics.rsi < 30 ? "Oversold" : "Neutral"}
                      icon={Activity}
                      trend={analysis.metrics.rsi < 30 ? "up" : analysis.metrics.rsi > 70 ? "down" : "neutral"}
                    // "Good" trend depends on context, but generally deep value (low rsi) is "up" opportunity
                    />
                    <MetricCard
                      label="Volatility"
                      value={(analysis.metrics.volatility * 100).toFixed(1) + "%"}
                      subValue={analysis.metrics.volatility > 0.08 ? "High Risk" : "Stable"}
                      icon={AlertTriangle}
                      trend={analysis.metrics.volatility < 0.02 ? "up" : "down"}
                    />
                    <MetricCard
                      label="Daily Liquidity"
                      value={
                        analysis.metrics.liquidity > 999_999_999
                          ? (analysis.metrics.liquidity / 1_000_000_000).toFixed(1) + "B"
                          : (analysis.metrics.liquidity / 1_000_000).toFixed(1) + "M"
                      }
                      subValue={analysis.metrics.liquidityState + " (GP)"}
                      icon={DollarSign}
                      trend={analysis.metrics.liquidityState === "Illiquid" || analysis.metrics.liquidityState === "Low" ? "down" : "up"}
                    />
                    <MetricCard
                      label={mode === "Buying" ? "vs 7d Avg" : "Net Return"}
                      value={mode === "Buying" ? `${analysis.metrics.vsAveragePct > 0 ? '+' : ''}${analysis.metrics.vsAveragePct.toFixed(1)}%` : `${analysis.metrics.netReturn.toLocaleString()}`}
                      subValue={mode === "Buying" ? "SMA(7)" : "gp"}
                      icon={BarChart3}
                      trend={mode === "Buying" && analysis.metrics.vsAveragePct < 0 ? "up" : "neutral"}
                    />
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        )}

        {!selectedItem && !loadingItems && (
          <div className="text-center py-20 text-neutral-600">
            <Search className="w-12 h-12 mx-auto mb-4 opacity-20" />
            <p className="text-lg">Search for an item to begin analysis</p>
          </div>
        )}
      </div>
    </div>
  );
}

function MetricCard({ label, value, subValue, icon: Icon, trend }: { label: string, value: string, subValue: string, icon: React.ElementType, trend: "up" | "down" | "neutral" }) {
  return (
    <div className="bg-neutral-800/50 rounded-xl p-4 border border-neutral-700/50 hover:bg-neutral-800 transition-colors">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">{label}</span>
        <Icon className="w-4 h-4 text-neutral-500" />
      </div>
      <div className="text-2xl font-mono text-white mb-1">
        {value}
      </div>
      <div className="flex items-center gap-2">
        {trend === "up" && <TrendingUp className="w-3 h-3 text-emerald-400" />}
        {trend === "down" && <TrendingDown className="w-3 h-3 text-red-400" />}
        <span className={cn(
          "text-xs",
          trend === "up" ? "text-emerald-400" :
            trend === "down" ? "text-red-400" : "text-neutral-500"
        )}>
          {subValue}
        </span>
      </div>
    </div>
  )
}
