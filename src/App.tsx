import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  DollarSign,
  Percent,
  PauseCircle,
  Search,
  TrendingDown,
  TrendingUp,
  X
} from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { fetchItemMapping, fetchLatest, fetchTimeSeries } from './utils/api';
import type { ItemMapping } from './utils/api';
import { analyzeItemData } from './utils/strategy';
import type { StrategyResult } from './utils/strategy';

function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

type GuidanceTone = 'positive' | 'warning' | 'danger';
type TradeMode = 'Buying' | 'Selling';

interface GuidanceCopy {
  headline: string;
  detail: string;
  outcome: string;
  tone: GuidanceTone;
}

export default function App() {
  const [items, setItems] = useState<ItemMapping[]>([]);
  const [loadingItems, setLoadingItems] = useState(true);

  const [query, setQuery] = useState('');
  const [selectedItem, setSelectedItem] = useState<ItemMapping | null>(null);
  const [mode, setMode] = useState<TradeMode>('Buying');

  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [analysis, setAnalysis] = useState<StrategyResult | null>(null);

  useEffect(() => {
    fetchItemMapping().then(data => {
      setItems(data);
      setLoadingItems(false);
    });
  }, []);

  const searchResults = useMemo(() => {
    if (!query || query.length < 2) return [];
    const lower = query.toLowerCase();
    return items.filter(item => item.name.toLowerCase().includes(lower)).slice(0, 10);
  }, [query, items]);

  const handleSelect = (item: ItemMapping) => {
    setSelectedItem(item);
    setQuery(item.name);
    setAnalysis(null);
    runAnalysis(item, mode);
  };

  const handleModeToggle = (newMode: TradeMode) => {
    setMode(newMode);
    if (selectedItem) runAnalysis(selectedItem, newMode);
  };

  const runAnalysis = async (item: ItemMapping, nextMode: TradeMode) => {
    setLoadingAnalysis(true);
    try {
      const [latest, timeseries] = await Promise.all([
        fetchLatest(item.id),
        fetchTimeSeries(item.id, '24h')
      ]);

      if (!latest || latest.high <= 0 || latest.low <= 0 || timeseries.length === 0) {
        setAnalysis(null);
        return;
      }

      const result = analyzeItemData(latest.high, latest.low, item.limit, timeseries, nextMode === 'Buying');
      setAnalysis(result);
    } catch (error) {
      console.error(error);
      setAnalysis(null);
    } finally {
      setLoadingAnalysis(false);
    }
  };

  const activeInstantPrice = analysis
    ? mode === 'Buying'
      ? analysis.metrics.instantBuyPrice
      : analysis.metrics.instantSellPrice
    : 0;

  const passivePrice = analysis
    ? mode === 'Buying'
      ? analysis.metrics.instantSellPrice
      : analysis.metrics.instantBuyPrice
    : 0;

  const rawActiveInstantPrice = analysis
    ? mode === 'Buying'
      ? analysis.metrics.rawInstantBuyPrice
      : analysis.metrics.rawInstantSellPrice
    : 0;

  const suggestedDeltaPct = analysis && activeInstantPrice > 0
    ? ((analysis.suggestedPrice - activeInstantPrice) / activeInstantPrice) * 100
    : 0;

  const guidance = analysis ? getGuidanceCopy(analysis, mode) : null;
  const priceDeltaTone = getPriceDeltaTone(suggestedDeltaPct);

  return (
    <div className="min-h-screen text-slate-100">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <header className="grid gap-4 rounded-[28px] border border-white/10 bg-white/5 p-5 shadow-[0_24px_80px_-40px_rgba(15,23,42,0.9)] backdrop-blur-xl lg:grid-cols-[1.35fr_0.65fr] lg:p-6">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-200">
              Grand Exchange Strategy Desk
            </div>
            <div className="space-y-2">
              <h1 className="max-w-2xl text-4xl font-black tracking-[-0.04em] text-white sm:text-5xl">
                OSRS Flipper
              </h1>
              <p className="max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
                Cleaner signals, liquidity-aware execution, and a decision-first dashboard for fast reads.
              </p>
            </div>
          </div>

          <div className="grid gap-3 rounded-[24px] border border-white/10 bg-slate-950/40 p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Data Status</p>
              <div className="inline-flex items-center gap-2 text-sm text-slate-300">
                <span className={cn('h-2.5 w-2.5 rounded-full', loadingItems ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400')} />
                {loadingItems ? 'Syncing' : 'Ready'}
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
              <HeaderStat label="Live quotes" value="Instant + passive" />
              <HeaderStat label="Decision model" value="Trend + tax + depth" />
              <HeaderStat label="Depth check" value="Abs fills weighted" />
            </div>
          </div>
        </header>

        <section className="grid gap-4 lg:grid-cols-[1.25fr_0.75fr]">
          <div className="relative rounded-[28px] border border-white/10 bg-slate-950/55 p-5 shadow-[0_18px_60px_-38px_rgba(8,15,33,0.95)] backdrop-blur-xl">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Find an item</p>
            <div className="relative">
              <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                placeholder="Search an item name..."
                className="h-14 w-full rounded-2xl border border-white/10 bg-white/5 pl-12 pr-12 text-base text-white outline-none transition-all placeholder:text-slate-500 focus:border-cyan-400/40 focus:bg-white/[0.07] focus:ring-4 focus:ring-cyan-400/10"
                value={query}
                onChange={event => setQuery(event.target.value)}
              />
              {query && (
                <button
                  onClick={() => {
                    setQuery('');
                    setSelectedItem(null);
                    setAnalysis(null);
                  }}
                  className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-500 transition-colors hover:bg-white/10 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {searchResults.length > 0 && query !== selectedItem?.name && (
              <div className="absolute left-5 right-5 top-[calc(100%-0.25rem)] z-50 mt-3 overflow-hidden rounded-3xl border border-white/10 bg-slate-950/95 shadow-2xl backdrop-blur-2xl">
                {searchResults.map(item => (
                  <button
                    key={item.id}
                    className="flex w-full items-center gap-3 border-b border-white/5 px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-white/[0.06]"
                    onClick={() => handleSelect(item)}
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
                      <img
                        src={`https://oldschool.runescape.wiki/images/${item.icon.replace(/ /g, '_')}`}
                        alt=""
                        className="h-6 w-6 object-contain"
                        onError={event => {
                          event.currentTarget.style.display = 'none';
                        }}
                      />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-white">{item.name}</p>
                      <p className="text-xs text-slate-400">
                        GE limit {formatItems(item.limit)} every 4 hours
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-[28px] border border-white/10 bg-slate-950/55 p-5 shadow-[0_18px_60px_-38px_rgba(8,15,33,0.95)] backdrop-blur-xl">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Trading mode</p>
            <div className="grid grid-cols-2 rounded-2xl border border-white/10 bg-white/[0.04] p-1">
              {(['Buying', 'Selling'] as TradeMode[]).map(option => (
                <button
                  key={option}
                  onClick={() => handleModeToggle(option)}
                  className={cn(
                    'rounded-[14px] px-4 py-3 text-sm font-semibold transition-all',
                    mode === option
                      ? 'bg-white text-slate-950 shadow-lg shadow-white/10'
                      : 'text-slate-400 hover:text-white'
                  )}
                >
                  {option}
                </button>
              ))}
            </div>
            <div className="mt-4 grid gap-3 rounded-2xl border border-white/10 bg-gradient-to-br from-cyan-400/10 via-transparent to-emerald-400/10 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Current lens</p>
              <p className="text-lg font-semibold text-white">
                {mode === 'Buying' ? 'Prioritize entry price and tax-clearing margin.' : 'Prioritize exit quality and liquidity.'}
              </p>
              <p className="text-sm leading-6 text-slate-300">
                {mode === 'Buying'
                  ? 'The model leans on trend, spread, and market depth to decide whether to bid patiently or pay up.'
                  : 'The model weighs trend persistence against depth so thin items do not look easier to unload than they really are.'}
              </p>
            </div>
          </div>
        </section>

        {selectedItem && (
          <div className="grid gap-4">
            <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
              <div className={cn(
                'rounded-[32px] border p-6 shadow-[0_28px_90px_-48px_rgba(3,7,18,1)] backdrop-blur-xl transition-all',
                loadingAnalysis ? 'border-white/10 bg-white/[0.04] opacity-60' : getDecisionSurface(analysis?.color)
              )}>
                {loadingAnalysis ? (
                  <div className="flex h-full min-h-[320px] items-center justify-center gap-3 text-slate-300">
                    <Activity className="h-6 w-6 animate-spin" />
                    <span>Refreshing market read...</span>
                  </div>
                ) : analysis ? (
                  <div className="space-y-6">
                    <div className="flex flex-col gap-5 border-b border-white/10 pb-5 lg:flex-row lg:items-start lg:justify-between">
                      <div className="space-y-4">
                        <div className="flex items-center gap-4">
                          <div className="flex h-16 w-16 items-center justify-center rounded-[22px] border border-white/10 bg-white/5 shadow-inner">
                            <img
                              src={`https://oldschool.runescape.wiki/images/${selectedItem.icon.replace(/ /g, '_')}`}
                              alt=""
                              className="h-10 w-10 object-contain"
                              onError={event => {
                                event.currentTarget.style.display = 'none';
                              }}
                            />
                          </div>
                          <div className="space-y-1">
                            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
                              {mode === 'Buying' ? 'Buy-side setup' : 'Sell-side setup'}
                            </p>
                            <h2 className="text-3xl font-black tracking-[-0.04em] text-white sm:text-4xl">
                              {selectedItem.name}
                            </h2>
                            <div className="flex flex-wrap gap-2 text-xs text-slate-300">
                              <Tag>{analysis.metrics.liquidityState} depth</Tag>
                              <Tag>{formatItems(selectedItem.limit)} / 4h limit</Tag>
                              <Tag>{formatItems(analysis.metrics.dailyVolumeItems)} fills/day</Tag>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-3">
                          <div className="flex flex-wrap items-center gap-3">
                            <span className="rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm font-semibold uppercase tracking-[0.16em] text-white">
                              {analysis.decision}
                            </span>
                            <span className={cn(
                              'rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em]',
                              getSubtextTone(analysis.color)
                            )}>
                              {analysis.subtext}
                            </span>
                          </div>
                          <p className="max-w-3xl text-base leading-7 text-slate-200 sm:text-lg">
                            {analysis.explanation}
                          </p>
                        </div>
                      </div>

                      <div className="grid min-w-[220px] gap-3 rounded-[24px] border border-white/10 bg-slate-950/45 p-4">
                        <CompactStat
                          label="Depth score"
                          value={`${Math.round(analysis.metrics.liquidityScore * 100)}/100`}
                          note={getLiquiditySummary(analysis.metrics.liquidityState)}
                        />
                        <CompactStat
                          label="Momentum"
                          value={getRsiLabel(analysis.metrics.rsi)}
                          note={`RSI ${analysis.metrics.rsi.toFixed(0)}`}
                        />
                        <CompactStat
                          label="Risk"
                          value={getVolatilityLabel(analysis.metrics.volatility)}
                          note={`${(analysis.metrics.volatility * 100).toFixed(1)}% 7d vol`}
                        />
                      </div>
                    </div>

                    {guidance && (
                      <GuidancePanel guidance={guidance} />
                    )}
                  </div>
                ) : (
                  <EmptyAnalysisState />
                )}
              </div>

              <div className="rounded-[32px] border border-white/10 bg-slate-950/60 p-6 shadow-[0_28px_90px_-48px_rgba(3,7,18,1)] backdrop-blur-xl">
                {analysis ? (
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Execution plan</p>
                      <h3 className="text-2xl font-black tracking-[-0.04em] text-white">
                        {analysis.suggestedPriceLabel}
                      </h3>
                    </div>

                    <div className="rounded-[28px] border border-emerald-400/20 bg-gradient-to-br from-emerald-400/14 via-emerald-400/6 to-cyan-400/12 p-5">
                      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-100/70">
                        Recommended order
                      </p>
                      <div className="mt-2 flex items-end justify-between gap-4">
                        <div>
                          <div className="text-4xl font-black tracking-[-0.05em] text-white">
                            {formatGp(analysis.suggestedPrice)}
                            <span className="ml-2 text-lg font-semibold text-emerald-200/70">gp</span>
                          </div>
                          <p className="mt-2 max-w-xs text-sm leading-6 text-emerald-50/80">
                            {mode === 'Buying'
                              ? 'Use this as the realistic entry level instead of assuming the last print is instantly available.'
                              : 'Use this as the working exit level instead of assuming immediate fills at the last print.'}
                          </p>
                        </div>
                        <div className={cn(
                          'rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em]',
                          priceDeltaTone
                        )}>
                          {formatDeltaText(suggestedDeltaPct)}
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-3">
                      <PriceLine
                        label={mode === 'Buying' ? 'Estimated instant buy' : 'Estimated instant sell'}
                        value={activeInstantPrice}
                        emphasis
                      />
                      <PriceLine
                        label="Last print"
                        value={rawActiveInstantPrice}
                      />
                      <PriceLine
                        label={mode === 'Buying' ? 'Modeled passive bid' : 'Modeled passive ask'}
                        value={passivePrice}
                      />
                      <PriceLine
                        label="Liquidity cushion"
                        value={analysis.metrics.executionAdjustment}
                        prefix="±"
                      />
                    </div>

                    <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Execution notes</p>
                      <div className="mt-4 grid gap-4 sm:grid-cols-2">
                        <ExecutionMetric
                          label="Spread"
                          value={`${formatGp(analysis.metrics.spread)} gp`}
                          note={`${analysis.metrics.spreadPct.toFixed(2)}% modeled`}
                        />
                        <ExecutionMetric
                          label={mode === 'Buying' ? 'Edge after tax' : 'Net after tax'}
                          value={mode === 'Buying'
                            ? `${analysis.metrics.flipMarginAfterTax >= 0 ? '+' : ''}${formatGp(analysis.metrics.flipMarginAfterTax)} gp`
                            : `${formatGp(analysis.metrics.netReturn)} gp`}
                          note={mode === 'Buying' ? 'Modeled flip margin' : 'Instant exit net'}
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <EmptyAnalysisState />
                )}
              </div>
            </section>

            {analysis && (
              <>
                <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <MetricCard
                    label={mode === 'Buying' ? 'Value check' : 'Exit cost'}
                    value={mode === 'Buying' ? `${analysis.metrics.discountPct.toFixed(1)}%` : `${formatGp(analysis.metrics.taxBasis)} gp`}
                    subValue={mode === 'Buying' ? 'Below 30d high' : 'GE tax'}
                    icon={mode === 'Buying' ? Percent : DollarSign}
                    trend={mode === 'Buying' ? (analysis.metrics.discountPct > 10 ? 'up' : 'neutral') : 'neutral'}
                  />
                  <MetricCard
                    label="Momentum"
                    value={analysis.metrics.rsi.toFixed(0)}
                    subValue={getRsiLabel(analysis.metrics.rsi)}
                    icon={Activity}
                    trend={analysis.metrics.rsi < 30 ? 'up' : analysis.metrics.rsi > 70 ? 'down' : 'neutral'}
                  />
                  <MetricCard
                    label="Market depth"
                    value={formatItems(analysis.metrics.dailyVolumeItems)}
                    subValue={`${analysis.metrics.liquidityState} • ${analysis.metrics.fillsPerLimit.toFixed(1)}x limit/day`}
                    icon={BarChart3}
                    trend={analysis.metrics.liquidityState === 'High' ? 'up' : analysis.metrics.liquidityState === 'Illiquid' ? 'down' : 'neutral'}
                  />
                  <MetricCard
                    label="Volatility"
                    value={`${(analysis.metrics.volatility * 100).toFixed(1)}%`}
                    subValue={getVolatilityLabel(analysis.metrics.volatility)}
                    icon={AlertTriangle}
                    trend={analysis.metrics.volatility < 0.02 ? 'up' : analysis.metrics.volatility > 0.08 ? 'down' : 'neutral'}
                  />
                </section>

                <section className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
                  <div className="rounded-[28px] border border-white/10 bg-slate-950/55 p-6 shadow-[0_24px_80px_-46px_rgba(3,7,18,1)] backdrop-blur-xl">
                    <SectionHeader
                      eyebrow="Market context"
                      title="Readable snapshot"
                      description="The support data is grouped by trading questions rather than raw feed fields."
                    />
                    <div className="mt-5 grid gap-4">
                      <InsightRow
                        title="How liquid is this item?"
                        value={`${analysis.metrics.liquidityState} depth`}
                        detail={`${formatItems(analysis.metrics.dailyVolumeItems)} items/day, ${analysis.metrics.fillsPerLimit.toFixed(1)}x GE limit/day`}
                      />
                      <InsightRow
                        title="How far can the model trust instant pricing?"
                        value={`${formatGp(analysis.metrics.executionAdjustment)} gp cushion`}
                        detail={`Raw print ${formatGp(rawActiveInstantPrice)} gp, modeled instant ${formatGp(activeInstantPrice)} gp`}
                      />
                      <InsightRow
                        title={mode === 'Buying' ? 'Does the spread clear tax?' : 'What is the net on exit?'}
                        value={mode === 'Buying'
                          ? `${analysis.metrics.flipMarginAfterTax >= 0 ? '+' : ''}${formatGp(analysis.metrics.flipMarginAfterTax)} gp`
                          : `${formatGp(analysis.metrics.netReturn)} gp`}
                        detail={mode === 'Buying'
                          ? `${analysis.metrics.spreadPct.toFixed(2)}% modeled spread after slippage`
                          : `Tax basis ${formatGp(analysis.metrics.taxBasis)} gp`}
                      />
                    </div>
                  </div>

                  <div className="rounded-[28px] border border-white/10 bg-slate-950/55 p-6 shadow-[0_24px_80px_-46px_rgba(3,7,18,1)] backdrop-blur-xl">
                    <SectionHeader
                      eyebrow="Decision framing"
                      title="Why the model landed here"
                      description="A concise readout of the most important drivers behind the current recommendation."
                    />
                    <div className="mt-5 grid gap-3">
                      <ReasonPill>
                        {mode === 'Buying'
                          ? `The model compares the entry against a liquidity-adjusted instant price, not just the raw last buy print.`
                          : `The model discounts thin sell-side markets so weak depth is reflected in the exit estimate.`}
                      </ReasonPill>
                      <ReasonPill>
                        {analysis.metrics.liquidityState === 'High'
                          ? 'Depth is strong enough that relative fill speed and absolute fills both support fast execution.'
                          : `Depth is capped at ${analysis.metrics.liquidityState.toLowerCase()} because absolute daily fills are not deep enough to trust raw prints.`}
                      </ReasonPill>
                      <ReasonPill>
                        {mode === 'Buying'
                          ? `Current momentum reads ${getRsiLabel(analysis.metrics.rsi).toLowerCase()} with ${getVolatilityLabel(analysis.metrics.volatility).toLowerCase()} volatility.`
                          : `Exit context shows ${getRsiLabel(analysis.metrics.rsi).toLowerCase()} conditions with ${getVolatilityLabel(analysis.metrics.volatility).toLowerCase()} short-term volatility.`}
                      </ReasonPill>
                    </div>
                  </div>
                </section>
              </>
            )}
          </div>
        )}

        {!selectedItem && !loadingItems && (
          <div className="rounded-[32px] border border-dashed border-white/10 bg-slate-950/45 px-6 py-16 text-center shadow-[0_24px_80px_-50px_rgba(3,7,18,1)] backdrop-blur-xl">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-white/10 bg-white/5">
              <Search className="h-7 w-7 text-slate-400" />
            </div>
            <h2 className="mt-5 text-2xl font-bold tracking-[-0.03em] text-white">Search for an item to begin</h2>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-400 sm:text-base">
              Pick an item name, choose whether you are buying or selling, and the dashboard will surface the execution-adjusted recommendation first.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function HeaderStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">{label}</p>
      <p className="mt-2 text-sm font-semibold text-white">{value}</p>
    </div>
  );
}

function GuidancePanel({ guidance }: { guidance: GuidanceCopy }) {
  return (
    <div className={cn(
      'rounded-[26px] border p-5',
      guidance.tone === 'positive' && 'border-emerald-400/20 bg-emerald-400/10',
      guidance.tone === 'warning' && 'border-amber-400/20 bg-amber-400/10',
      guidance.tone === 'danger' && 'border-rose-400/20 bg-rose-400/10'
    )}>
      <div className="flex items-start gap-4">
        <div className={cn(
          'rounded-2xl p-3',
          guidance.tone === 'positive' && 'bg-emerald-400/15 text-emerald-100',
          guidance.tone === 'warning' && 'bg-amber-400/15 text-amber-100',
          guidance.tone === 'danger' && 'bg-rose-400/15 text-rose-100'
        )}>
          {guidance.tone === 'positive'
            ? <CheckCircle2 className="h-5 w-5" />
            : guidance.tone === 'warning'
              ? <PauseCircle className="h-5 w-5" />
              : <AlertTriangle className="h-5 w-5" />
          }
        </div>
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">What to do next</p>
          <p className="text-xl font-semibold text-white">{guidance.headline}</p>
          <p className="text-sm leading-6 text-slate-200">{guidance.detail}</p>
          <p className="text-sm leading-6 text-slate-400">{guidance.outcome}</p>
        </div>
      </div>
    </div>
  );
}

function CompactStat({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">{label}</p>
      <p className="mt-2 text-base font-semibold text-white">{value}</p>
      <p className="mt-1 text-xs text-slate-400">{note}</p>
    </div>
  );
}

function PriceLine({
  label,
  value,
  prefix = '',
  emphasis = false
}: {
  label: string;
  value: number;
  prefix?: string;
  emphasis?: boolean;
}) {
  return (
    <div className={cn(
      'flex items-center justify-between rounded-2xl border p-4',
      emphasis ? 'border-cyan-400/20 bg-cyan-400/8' : 'border-white/10 bg-white/[0.04]'
    )}>
      <p className="text-sm text-slate-300">{label}</p>
      <p className={cn('text-right font-semibold', emphasis ? 'text-white' : 'text-slate-200')}>
        <span className="font-mono text-lg">{prefix}{formatGp(value)}</span>
        <span className="ml-1 text-xs uppercase tracking-[0.2em] text-slate-500">gp</span>
      </p>
    </div>
  );
}

function ExecutionMetric({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="space-y-1">
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">{label}</p>
      <p className="text-lg font-semibold text-white">{value}</p>
      <p className="text-xs text-slate-400">{note}</p>
    </div>
  );
}

function SectionHeader({
  eyebrow,
  title,
  description
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">{eyebrow}</p>
      <h3 className="text-2xl font-black tracking-[-0.04em] text-white">{title}</h3>
      <p className="max-w-2xl text-sm leading-6 text-slate-400">{description}</p>
    </div>
  );
}

function InsightRow({ title, value, detail }: { title: string; value: string; detail: string }) {
  return (
    <div className="flex flex-col gap-2 rounded-[22px] border border-white/10 bg-white/[0.04] p-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <p className="text-sm font-semibold text-white">{title}</p>
        <p className="mt-1 text-sm leading-6 text-slate-400">{detail}</p>
      </div>
      <div className="text-sm font-semibold text-cyan-200 sm:text-right">{value}</div>
    </div>
  );
}

function ReasonPill({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-[22px] border border-white/10 bg-white/[0.04] px-4 py-4 text-sm leading-6 text-slate-300">
      {children}
    </div>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1">
      {children}
    </span>
  );
}

function EmptyAnalysisState() {
  return (
    <div className="flex min-h-[240px] items-center justify-center rounded-[24px] border border-dashed border-white/10 bg-white/[0.03] px-6 text-center text-sm leading-6 text-slate-400">
      Pulling pricing and time-series data for this item will populate the recommendation and execution panels here.
    </div>
  );
}

function MetricCard({
  label,
  value,
  subValue,
  icon: Icon,
  trend
}: {
  label: string;
  value: string;
  subValue: string;
  icon: React.ElementType;
  trend: 'up' | 'down' | 'neutral';
}) {
  return (
    <div className="rounded-[26px] border border-white/10 bg-slate-950/55 p-5 shadow-[0_20px_70px_-45px_rgba(3,7,18,1)] backdrop-blur-xl transition-colors hover:bg-white/[0.06]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">{label}</p>
          <div className="mt-3 text-3xl font-black tracking-[-0.04em] text-white">{value}</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-2.5">
          <Icon className="h-4 w-4 text-slate-300" />
        </div>
      </div>
      <div className="mt-4 flex items-center gap-2 text-sm">
        {trend === 'up' && <TrendingUp className="h-4 w-4 text-emerald-300" />}
        {trend === 'down' && <TrendingDown className="h-4 w-4 text-rose-300" />}
        <span className={cn(
          trend === 'up' && 'text-emerald-300',
          trend === 'down' && 'text-rose-300',
          trend === 'neutral' && 'text-slate-400'
        )}>
          {subValue}
        </span>
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

function formatDeltaText(value: number) {
  if (value === 0) return 'At market';
  return `${Math.abs(value).toFixed(1)}% ${value < 0 ? 'below market' : 'above market'}`;
}

function getPriceDeltaTone(value: number) {
  if (value < 0) return 'bg-emerald-400/15 text-emerald-100 border border-emerald-400/20';
  if (value > 0) return 'bg-amber-400/15 text-amber-100 border border-amber-400/20';
  return 'bg-white/10 text-slate-200 border border-white/10';
}

function getDecisionSurface(color?: StrategyResult['color']) {
  if (color === 'green') return 'border-emerald-400/20 bg-gradient-to-br from-emerald-500/14 via-slate-950/85 to-cyan-500/10';
  if (color === 'red') return 'border-rose-400/20 bg-gradient-to-br from-rose-500/14 via-slate-950/85 to-orange-500/8';
  return 'border-amber-400/20 bg-gradient-to-br from-amber-400/14 via-slate-950/85 to-cyan-500/8';
}

function getSubtextTone(color?: StrategyResult['color']) {
  if (color === 'green') return 'bg-emerald-400/15 text-emerald-100';
  if (color === 'red') return 'bg-rose-400/15 text-rose-100';
  return 'bg-amber-400/15 text-amber-100';
}

function getRsiLabel(rsi: number) {
  if (rsi < 30) return 'Oversold';
  if (rsi > 70) return 'Overbought';
  if (rsi > 55) return 'Positive';
  if (rsi < 45) return 'Soft';
  return 'Balanced';
}

function getVolatilityLabel(volatility: number) {
  if (volatility > 0.08) return 'High risk';
  if (volatility > 0.04) return 'Active';
  if (volatility > 0.02) return 'Moderate';
  return 'Stable';
}

function getLiquiditySummary(state: StrategyResult['metrics']['liquidityState']) {
  switch (state) {
    case 'High':
      return 'Deep enough for tighter execution assumptions';
    case 'Medium':
      return 'Tradable, but raw prints still need caution';
    case 'Low':
      return 'Execution can move more than the last print suggests';
    case 'Illiquid':
    default:
      return 'Thin market, patience matters';
  }
}

function getGuidanceCopy(analysis: StrategyResult, mode: TradeMode): GuidanceCopy {
  if (mode === 'Buying') {
    switch (analysis.decision) {
      case 'SCREAMING BUY':
      case 'STRONG BUY':
      case 'BUY':
      case 'BUY DIP':
      case 'MOMENTUM BUY':
      case 'ACCUMULATE':
        return {
          headline: `Work bids near ${formatGp(analysis.suggestedPrice)} gp.`,
          detail: analysis.suggestedPrice >= analysis.metrics.instantBuyPrice
            ? 'The setup is strong enough that paying near the modeled instant level is still reasonable.'
            : 'Let sellers come to you. The edge improves if you avoid paying the full modeled instant price.',
          outcome: `Current modeled post-tax edge is ${analysis.metrics.flipMarginAfterTax >= 0 ? '+' : ''}${formatGp(analysis.metrics.flipMarginAfterTax)} gp.`,
          tone: 'positive'
        };
      case 'WATCH':
        return {
          headline: `Queue a patient bid around ${formatGp(analysis.suggestedPrice)} gp.`,
          detail: 'There is not enough strength here to justify chasing the market right now.',
          outcome: 'Keep the order passive and only take the fill if the market comes back to you.',
          tone: 'warning'
        };
      case 'WAIT':
      default:
        return {
          headline: 'Wait for a cleaner entry.',
          detail: analysis.metrics.flipMarginAfterTax <= 0
            ? 'After tax and slippage, the current spread is not attractive enough to enter.'
            : 'The market is stretched relative to the quality of the setup. A better pullback would improve the risk.',
          outcome: `If you want to stay involved, patience starts around ${formatGp(analysis.suggestedPrice)} gp.`,
          tone: 'danger'
        };
    }
  }

  switch (analysis.decision) {
    case 'PANIC SELL':
    case 'CUT LOSSES':
      return {
        headline: `Exit quickly near ${formatGp(analysis.suggestedPrice)} gp.`,
        detail: 'The trend has weakened enough that preserving liquidity now matters more than squeezing out a better ask.',
        outcome: `The current modeled instant exit nets about ${formatGp(analysis.metrics.netReturn)} gp after tax.`,
        tone: 'danger'
      };
    case 'MANIC SELL':
    case 'SELL NOW':
      return {
        headline: `Sell into strength around ${formatGp(analysis.suggestedPrice)} gp.`,
        detail: 'Momentum is still supportive, so you can ask above the instant sell instead of dumping immediately.',
        outcome: 'This is a take-profit setup while buyers are still active.',
        tone: 'positive'
      };
    case 'RIDE TREND':
      return {
        headline: `Hold and work a higher ask near ${formatGp(analysis.suggestedPrice)} gp.`,
        detail: 'The uptrend is still intact enough that forcing an instant exit would leave money on the table.',
        outcome: 'Let the trend work for you, then ask into strength rather than rushing the exit.',
        tone: 'positive'
      };
    case 'LIST':
    default:
      return {
        headline: `List passively around ${formatGp(analysis.suggestedPrice)} gp.`,
        detail: 'There is no urgent sell signal, but the market still supports keeping an offer live.',
        outcome: 'Wait for buyers to meet the ask instead of defaulting to an instant sell.',
        tone: 'warning'
      };
  }
}
