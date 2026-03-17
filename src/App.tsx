import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  DollarSign,
  Percent,
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

  const suggestedDeltaPct = analysis && activeInstantPrice > 0
    ? ((analysis.suggestedPrice - activeInstantPrice) / activeInstantPrice) * 100
    : 0;

  const guidance = analysis ? getGuidanceCopy(analysis, mode) : null;
  const priceDeltaTone = getPriceDeltaTone(suggestedDeltaPct);
  const showSearchTray = query.length >= 2 && query !== selectedItem?.name;

  return (
    <div className="min-h-screen pt-4 pb-12">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <header className="grid gap-6 p-6 lg:grid-cols-[1.35fr_0.65fr]">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-md bg-secondary/80 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest text-secondary-foreground border border-border/80 shadow-sm backdrop-blur-md">
              Grand Exchange Strategy Desk
            </div>
            <div className="space-y-2">
              <h1 className="max-w-2xl text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
                OSRS Flipper
              </h1>
              <p className="max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
                Cleaner signals, liquidity-aware execution, and a decision-first dashboard for fast reads.
              </p>
            </div>
          </div>

          <div className="inline-flex justify-end gap-2 px-3 py-1.5 text-sm font-medium text-foreground">
            <span
              className={cn(
                'h-2 w-2 rounded-full',
                loadingItems
                  ? 'bg-amber-500 animate-pulse outline outline-2 outline-amber-500/20'
                  : 'bg-emerald-500 outline outline-2 outline-emerald-500/20'
              )}
            />
            {loadingItems ? 'Syncing...' : 'Ready'}
          </div>
        </header>

        <section className="grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">
          <div className="relative macos-window p-6 flex flex-col gap-3">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Find an item</p>
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search an item name..."
                className="h-10 w-full rounded-md border border-input bg-background/50 pl-10 pr-10 text-sm text-foreground shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:border-primary transition-all backdrop-blur-sm"
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
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {showSearchTray && (
              <div className="absolute top-[88px] left-6 right-6 z-50 overflow-hidden rounded-xl border border-border bg-popover/95 shadow-2xl backdrop-blur-xl">
                <div className="flex items-center justify-between gap-3 border-b border-border/80 bg-muted/50 px-4 py-2.5">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                    {searchResults.length > 0 ? 'Matching items' : 'No matches yet'}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {searchResults.length > 0 ? `${searchResults.length} shown` : 'Try a broader search'}
                  </p>
                </div>

                {searchResults.length > 0 ? (
                  <div className="max-h-[min(24rem,calc(100vh-18rem))] overflow-y-auto p-1">
                    {searchResults.map(item => (
                      <button
                        key={item.id}
                        className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-accent hover:text-accent-foreground"
                        onClick={() => handleSelect(item)}
                      >
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border/80 bg-background/50 shadow-sm">
                          <img
                            src={`https://oldschool.runescape.wiki/images/${item.icon.replace(/ /g, '_')}`}
                            alt=""
                            className="h-5 w-5 object-contain drop-shadow-sm"
                            onError={event => {
                              event.currentTarget.style.display = 'none';
                            }}
                          />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">{item.name}</p>
                          <p className="text-xs text-muted-foreground">
                            GE limit {formatItems(item.limit)} every 4 hours
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                    No items matched that search. Try fewer letters or a broader name.
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="macos-window p-6 flex flex-col gap-3">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Trading mode</p>
            <div className="grid grid-cols-2 rounded-lg border border-border/80 bg-secondary/30 p-1 shadow-inner backdrop-blur-md">
              {(['Buying', 'Selling'] as TradeMode[]).map(option => (
                <button
                  key={option}
                  onClick={() => handleModeToggle(option)}
                  className={cn(
                    'rounded-md px-3 py-1.5 text-sm font-medium transition-all',
                    mode === option
                      ? 'bg-background text-foreground shadow-sm ring-1 ring-border/80'
                      : 'text-muted-foreground hover:bg-secondary/50 hover:text-foreground'
                  )}
                >
                  {option}
                </button>
              ))}
            </div>
            <div className="mt-2 flex flex-col gap-1.5 rounded-lg border border-border/80 bg-muted/20 p-4">
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Current lens</p>
              <p className="text-sm font-semibold text-foreground">
                {mode === 'Buying' ? 'Prioritize entry price and tax-clearing margin.' : 'Prioritize exit quality and liquidity.'}
              </p>
              <p className="text-xs leading-5 text-muted-foreground">
                {mode === 'Buying'
                  ? 'The model leans on trend, spread, and market depth to decide whether to bid patiently or pay up.'
                  : 'The model weighs trend persistence against depth so thin items do not look easier to unload than they really are.'}
              </p>
            </div>
          </div>
        </section>

        {selectedItem && (
          <div className="grid gap-6">
            <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
              <div className={cn(
                'macos-window p-8 transition-all relative overflow-hidden',
                loadingAnalysis ? 'opacity-60' : getDecisionSurface(analysis?.color)
              )}>
                {loadingAnalysis ? (
                  <div className="flex h-full min-h-[260px] items-center justify-center gap-3 text-muted-foreground">
                    <Activity className="h-5 w-5 animate-spin" />
                    <span className="text-sm font-medium">Refreshing market read...</span>
                  </div>
                ) : analysis ? (
                  <div className="space-y-6 relative z-10">
                    <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                      <div className="space-y-5 lg:max-w-[70%]">
                        <div className="flex items-center gap-4">
                          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-background border border-border shadow-sm">
                            <img
                              src={`https://oldschool.runescape.wiki/images/${selectedItem.icon.replace(/ /g, '_')}`}
                              alt=""
                              className="h-8 w-8 object-contain drop-shadow-sm"
                              onError={event => {
                                event.currentTarget.style.display = 'none';
                              }}
                            />
                          </div>
                          <div className="space-y-1">
                            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                              {mode === 'Buying' ? 'Buy signal' : 'Sell signal'}
                            </p>
                            <h2 className="text-3xl font-bold tracking-tight text-foreground">
                              {selectedItem.name}
                            </h2>
                            <div className="flex flex-wrap gap-2 text-xs">
                              <Tag>{analysis.metrics.liquidityState}</Tag>
                              <Tag>{formatItems(selectedItem.limit)} / 4h limit</Tag>
                              <Tag>{formatItems(analysis.metrics.dailyVolumeItems)} fills/day</Tag>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-md border border-border/80 bg-background/60 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-foreground shadow-sm backdrop-blur-sm">
                              {analysis.decision}
                            </span>
                            <span className={cn(
                              'rounded-md px-2.5 py-1 text-[11px] font-medium tracking-wider shadow-sm border',
                              getSubtextTone(analysis.color)
                            )}>
                              {analysis.subtext}
                            </span>
                          </div>
                          <p className="text-lg font-semibold leading-tight text-foreground">
                            {guidance?.headline ?? analysis.decision}
                          </p>
                          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
                            {guidance?.detail ?? analysis.explanation}
                          </p>
                        </div>
                      </div>

                      <div className="flex min-w-[200px] flex-col gap-3 macos-panel p-4 mt-6 lg:mt-0">
                        <CompactStat
                          label="Instant buy"
                          value={`${formatGp(analysis.metrics.instantBuyPrice)} gp`}
                          note={`Last print ${formatGp(analysis.metrics.rawInstantBuyPrice)}`}
                        />
                        <CompactStat
                          label="Instant sell"
                          value={`${formatGp(analysis.metrics.instantSellPrice)} gp`}
                          note={`Last print ${formatGp(analysis.metrics.rawInstantSellPrice)}`}
                        />

                      </div>
                    </div>
                  </div>
                ) : (
                  <EmptyAnalysisState />
                )}
              </div>

              <div className="macos-window p-8">
                {analysis ? (
                  <div className="space-y-6">
                    <div className="space-y-1">
                      <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Quick prices</p>
                      <h3 className="text-2xl font-bold tracking-tight text-foreground">
                        {mode === 'Buying' ? 'Entry and exit levels' : 'Exit and re-entry levels'}
                      </h3>
                    </div>

                    <div className="macos-panel p-5 bg-gradient-to-br from-green-500/10 via-transparent to-transparent border-green-500/40">
                      <p className="text-[10px] font-medium uppercase tracking-wider text-green-400">
                        Best price to use now
                      </p>
                      <div className="mt-2 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                        <div>
                          <div className="text-4xl font-bold tracking-tight text-foreground">
                            {formatGp(analysis.suggestedPrice)}
                            <span className="ml-2 text-lg font-medium text-muted-foreground">gp</span>
                          </div>
                          <p className="mt-2 max-w-xs text-xs leading-relaxed text-muted-foreground">
                            {mode === 'Buying'
                              ? 'Use this as the buy level if you want a realistic fill without overpaying.'
                              : 'Use this as the sell level if you want a realistic exit without dumping.'}
                          </p>
                        </div>
                        <div className={cn(
                          'rounded-md px-2.5 py-1 text-[11px] font-medium tracking-wider whitespace-nowrap self-start sm:self-auto border',
                          priceDeltaTone
                        )}>
                          {formatDeltaText(suggestedDeltaPct)}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      <PriceLine
                        label="Instant buy"
                        value={analysis.metrics.instantBuyPrice}
                        emphasis={mode === 'Buying'}
                      />
                      <PriceLine
                        label="Instant sell"
                        value={analysis.metrics.instantSellPrice}
                        emphasis={mode === 'Selling'}
                      />
                      <PriceLine
                        label={mode === 'Buying' ? 'Suggested buy' : 'Suggested sell'}
                        value={analysis.suggestedPrice}
                        emphasis
                      />
                      <PriceLine
                        label="Liquidity cushion"
                        value={analysis.metrics.executionAdjustment}
                        prefix="±"
                      />
                    </div>

                    <div className="macos-panel p-5 bg-muted/30">
                      <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">At a glance</p>
                      <div className="mt-3 grid gap-4 sm:grid-cols-2">
                        <ExecutionMetric
                          label="Spread"
                          value={`${formatGp(analysis.metrics.spread)} gp`}
                          note={`${analysis.metrics.spreadPct.toFixed(2)}% modeled`}
                        />
                        <ExecutionMetric
                          label={mode === 'Buying' ? 'Turnover edge' : 'Net after tax'}
                          value={mode === 'Buying'
                            ? `${analysis.metrics.flipMarginAfterTax >= 0 ? '+' : ''}${formatGp(analysis.metrics.flipMarginAfterTax)} gp`
                            : `${formatGp(analysis.metrics.netReturn)} gp`}
                          note={mode === 'Buying' ? 'Buy now, sell now estimate' : 'Instant exit estimate'}
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
              <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
                <MetricCard
                  label={mode === 'Buying' ? 'Value' : 'Tax'}
                  value={mode === 'Buying' ? `${analysis.metrics.discountPct.toFixed(1)}%` : `${formatGp(analysis.metrics.taxBasis)} gp`}
                  subValue={mode === 'Buying' ? 'Off 30d high' : 'GE tax'}
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
                  label="Depth"
                  value={formatItems(analysis.metrics.dailyVolumeItems)}
                  subValue={`${analysis.metrics.liquidityState} • ${analysis.metrics.fillsPerLimit.toFixed(1)}x GE limit per day`}
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
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function HeaderStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 p-2">
      <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}

function CompactStat({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="macos-panel p-3">
      <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium text-foreground">{value}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{note}</p>
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
      'flex items-center justify-between p-3 macos-panel',
      emphasis ? 'bg-primary/10 border-primary/20' : ''
    )}>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className={cn('text-right', emphasis ? 'font-semibold text-foreground' : 'text-foreground/80')}>
        <span className="font-mono">{prefix}{formatGp(value)}</span>
        <span className="ml-1 text-xs text-muted-foreground">gp</span>
      </p>
    </div>
  );
}

function ExecutionMetric({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="space-y-1 p-2">
      <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-base font-medium text-foreground">{value}</p>
      <p className="text-xs text-muted-foreground">{note}</p>
    </div>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-md bg-secondary/80 px-2 py-0.5 text-[11px] font-medium text-secondary-foreground border border-border/80">
      {children}
    </span>
  );
}

function EmptyAnalysisState() {
  return (
    <div className="flex min-h-[240px] items-center justify-center p-6 text-center text-sm text-muted-foreground">
      Select an item to view execution-adjusted recommendations and pricing data.
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
    <div className="macos-panel p-4 flex flex-col justify-between">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
          <div className="mt-1 text-2xl font-semibold text-foreground">{value}</div>
        </div>
        <div className="rounded-md bg-secondary/50 p-2">
          <Icon className="h-4 w-4 text-secondary-foreground/70" />
        </div>
      </div>
      <div className="mt-3 flex items-center gap-1.5 text-xs font-medium">
        {trend === 'up' && <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />}
        {trend === 'down' && <TrendingDown className="h-3.5 w-3.5 text-rose-400" />}
        <span className={cn(
          trend === 'up' && 'text-emerald-400',
          trend === 'down' && 'text-rose-400',
          trend === 'neutral' && 'text-muted-foreground'
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
  if (value < 0) return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/40';
  if (value > 0) return 'bg-amber-500/10 text-amber-400 border-amber-500/40';
  return 'bg-secondary/50 text-secondary-foreground border-border/80';
}

function getDecisionSurface(color?: StrategyResult['color']) {
  if (color === 'green') return 'bg-emerald-500/5 border-emerald-500/40 shadow-[0_0_40px_-15px_rgba(16,185,129,0.1)]';
  if (color === 'red') return 'bg-rose-500/5 border-rose-500/40 shadow-[0_0_40px_-15px_rgba(244,63,94,0.1)]';
  return 'bg-amber-500/5 border-amber-500/40 shadow-[0_0_40px_-15px_rgba(245,158,11,0.1)]';
}

function getSubtextTone(color?: StrategyResult['color']) {
  if (color === 'green') return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/40';
  if (color === 'red') return 'bg-rose-500/10 text-rose-400 border-rose-500/40';
  return 'bg-amber-500/10 text-amber-400 border-amber-500/40';
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
