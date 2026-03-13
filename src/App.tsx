
import { useEffect, useState, useMemo } from 'react';
import { Search, TrendingUp, TrendingDown, AlertTriangle, Activity, DollarSign, Percent, BarChart3, X, CheckCircle2, PauseCircle } from 'lucide-react';
import { fetchItemMapping, fetchLatest, fetchTimeSeries } from './utils/api';
import type { ItemMapping } from './utils/api';
import { analyzeItemData } from './utils/strategy';
import type { StrategyResult } from './utils/strategy';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

type GuidanceTone = "positive" | "warning" | "danger";

interface GuidanceCopy {
  headline: string;
  detail: string;
  outcome: string;
  tone: GuidanceTone;
}

export default function App() {
  const [items, setItems] = useState<ItemMapping[]>([]);
  const [loadingItems, setLoadingItems] = useState(true);

  const [query, setQuery] = useState("");
  const [selectedItem, setSelectedItem] = useState<ItemMapping | null>(null);
  const [mode, setMode] = useState<"Buying" | "Selling">("Buying");

  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [analysis, setAnalysis] = useState<StrategyResult | null>(null);

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
      const [latest, timeseries] = await Promise.all([
        fetchLatest(item.id),
        fetchTimeSeries(item.id, "24h")
      ]);

      if (!latest || latest.high <= 0 || latest.low <= 0 || timeseries.length === 0) {
        setAnalysis(null);
        return;
      }

      const isBuying = mode === "Buying";
      const result = analyzeItemData(latest.high, latest.low, item.limit, timeseries, isBuying);
      setAnalysis(result);
    } catch (e) {
      console.error(e);
      setAnalysis(null);
    } finally {
      setLoadingAnalysis(false);
    }
  };

  const activeInstantPrice = analysis
    ? mode === "Buying"
      ? analysis.metrics.instantBuyPrice
      : analysis.metrics.instantSellPrice
    : 0;

  const passivePrice = analysis
    ? mode === "Buying"
      ? analysis.metrics.instantSellPrice
      : analysis.metrics.instantBuyPrice
    : 0;

  const suggestedDeltaPct = analysis && activeInstantPrice > 0
    ? ((analysis.suggestedPrice - activeInstantPrice) / activeInstantPrice) * 100
    : 0;

  const guidance = analysis ? getGuidanceCopy(analysis, mode) : null;

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
                      <p className="text-sm text-neutral-500 uppercase tracking-widest font-semibold mb-1">
                        {mode === "Buying" ? "Instant Buy" : "Instant Sell"}
                      </p>
                      <div className="text-3xl font-mono font-medium text-white">
                        {formatGp(activeInstantPrice)} <span className="text-yellow-500 text-lg">gp</span>
                      </div>
                      <div className="mt-2 space-y-1 text-xs text-neutral-500">
                        <div>
                          {mode === "Buying" ? "Passive Bid" : "Passive Ask"}: {formatGp(passivePrice)} gp
                        </div>
                        <div>
                          Spread: {formatGp(analysis.metrics.spread)} gp ({analysis.metrics.spreadPct.toFixed(2)}%)
                        </div>
                        <div>
                          GE Limit: {formatItems(analysis.metrics.geLimit)} / 4h
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="h-px bg-gradient-to-r from-transparent via-neutral-700 to-transparent" />

                  {guidance && (
                    <div className={cn(
                      "rounded-xl border p-4",
                      guidance.tone === "positive" && "border-emerald-500/30 bg-emerald-500/10",
                      guidance.tone === "warning" && "border-yellow-500/30 bg-yellow-500/10",
                      guidance.tone === "danger" && "border-red-500/30 bg-red-500/10"
                    )}>
                      <div className="flex items-start gap-3">
                        <div className={cn(
                          "mt-0.5 rounded-lg p-2",
                          guidance.tone === "positive" && "bg-emerald-500/15 text-emerald-300",
                          guidance.tone === "warning" && "bg-yellow-500/15 text-yellow-300",
                          guidance.tone === "danger" && "bg-red-500/15 text-red-300"
                        )}>
                          {guidance.tone === "positive"
                            ? <CheckCircle2 className="w-5 h-5" />
                            : guidance.tone === "warning"
                              ? <PauseCircle className="w-5 h-5" />
                              : <AlertTriangle className="w-5 h-5" />
                          }
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs uppercase tracking-[0.2em] text-neutral-400">What To Do</p>
                          <p className="text-lg font-semibold text-white">{guidance.headline}</p>
                          <p className="text-sm text-neutral-300">{guidance.detail}</p>
                          <p className="text-sm text-neutral-400">{guidance.outcome}</p>
                        </div>
                      </div>
                    </div>
                  )}

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
                        {formatGp(analysis.suggestedPrice)} <span className="text-sm text-emerald-600/70">gp</span>
                      </div>
                      <div className={cn(
                        "text-xs font-medium",
                        analysis.suggestedPrice < activeInstantPrice
                          ? "text-emerald-500"
                          : "text-neutral-500"
                      )}>
                        {analysis.suggestedPrice < activeInstantPrice
                          ? `${Math.abs(suggestedDeltaPct).toFixed(1)}% below current`
                          : analysis.suggestedPrice > activeInstantPrice
                            ? `${suggestedDeltaPct.toFixed(1)}% above current`
                            : "At current market price"
                        }
                      </div>
                    </div>
                  </div>

                  {/* Metrics Grid */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <MetricCard
                      label={mode === "Buying" ? "Discount vs 30d" : "Tax Cost"}
                      value={mode === "Buying" ? `${analysis.metrics.discountPct.toFixed(1)}%` : formatGp(analysis.metrics.taxBasis)}
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
                      label="Daily Fills"
                      value={formatItems(analysis.metrics.dailyVolumeItems)}
                      subValue={`${analysis.metrics.liquidityState} • ${analysis.metrics.fillsPerLimit.toFixed(1)}x limit/day`}
                      icon={DollarSign}
                      trend={analysis.metrics.liquidityState === "Illiquid" || analysis.metrics.liquidityState === "Low" ? "down" : "up"}
                    />
                    <MetricCard
                      label={mode === "Buying" ? "Post-tax Spread" : "Net Return"}
                      value={mode === "Buying" ? `${analysis.metrics.flipMarginAfterTax > 0 ? '+' : ''}${formatGp(analysis.metrics.flipMarginAfterTax)}` : formatGp(analysis.metrics.netReturn)}
                      subValue={mode === "Buying" ? `${analysis.metrics.spreadPct.toFixed(2)}% live spread` : "gp after 2% tax"}
                      icon={BarChart3}
                      trend={mode === "Buying" ? (analysis.metrics.flipMarginAfterTax > 0 ? "up" : "down") : "neutral"}
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

function formatGp(value: number) {
  return Math.round(value).toLocaleString();
}

function formatItems(value: number) {
  return Math.round(value).toLocaleString();
}

function getGuidanceCopy(analysis: StrategyResult, mode: "Buying" | "Selling"): GuidanceCopy {
  if (mode === "Buying") {
    switch (analysis.decision) {
      case "SCREAMING BUY":
      case "STRONG BUY":
      case "BUY":
      case "BUY DIP":
      case "MOMENTUM BUY":
      case "ACCUMULATE":
        return {
          headline: `Buy this item near ${formatGp(analysis.suggestedPrice)} gp.`,
          detail: analysis.suggestedPrice >= analysis.metrics.instantBuyPrice
            ? "The setup is strong enough to pay close to the current market."
            : "Use a limit bid instead of insta-buying so you keep the margin realistic.",
          outcome: `If filled, your current modeled post-tax spread is ${analysis.metrics.flipMarginAfterTax >= 0 ? "+" : ""}${formatGp(analysis.metrics.flipMarginAfterTax)} gp.`,
          tone: "positive"
        };
      case "WATCH":
        return {
          headline: `Do not chase this item. Place a patient buy offer around ${formatGp(analysis.suggestedPrice)} gp.`,
          detail: "The setup is not strong enough to justify paying market right now.",
          outcome: "Leave the order in and only buy if sellers come down to you.",
          tone: "warning"
        };
      case "WAIT":
      default:
        return {
          headline: "Wait before buying this item.",
          detail: analysis.metrics.flipMarginAfterTax <= 0
            ? "The live spread is too thin after GE tax, so the trade is not attractive yet."
            : "The current entry is stretched. Let price come back to a better level first.",
          outcome: `Best current patience price: about ${formatGp(analysis.suggestedPrice)} gp.`,
          tone: "danger"
        };
    }
  }

  switch (analysis.decision) {
    case "PANIC SELL":
    case "CUT LOSSES":
      return {
        headline: `Sell now and take the fast exit near ${formatGp(analysis.suggestedPrice)} gp.`,
        detail: "Price action is deteriorating, so preserving liquidity matters more than squeezing extra margin.",
        outcome: `Expected net after tax at the current instant sell is ${formatGp(analysis.metrics.netReturn)} gp.`,
        tone: "danger"
      };
    case "MANIC SELL":
    case "SELL NOW":
      return {
        headline: `Sell this item now, but list slightly above market at ${formatGp(analysis.suggestedPrice)} gp.`,
        detail: "Momentum is favorable enough to ask for a bit more instead of dumping instantly.",
        outcome: "Take profit while buyers are still paying up.",
        tone: "positive"
      };
    case "RIDE TREND":
      return {
        headline: `Hold for now and list higher around ${formatGp(analysis.suggestedPrice)} gp.`,
        detail: "Trend is still moving up, so there is a case for asking above the current sell price.",
        outcome: "This is a hold-then-sell-higher setup, not an immediate dump.",
        tone: "positive"
      };
    case "LIST":
    default:
      return {
        headline: `List this item passively around ${formatGp(analysis.suggestedPrice)} gp.`,
        detail: "There is no urgent sell signal, but you can keep an offer in the market.",
        outcome: "Wait for buyers to meet your ask instead of insta-selling.",
        tone: "warning"
      };
  }
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
