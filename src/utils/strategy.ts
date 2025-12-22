import { calculateEMA, calculateRSI, calculateSMA, calculateVolatility, calculateLiquidity } from './indicators';
import type { DailyPoint } from './indicators';

const TAX_RATE = 0.02;
const TAX_CAP = 5000000;

export interface StrategyResult {
    decision: string;
    subtext: string;
    explanation: string;
    color: "green" | "red" | "yellow" | "gray";
    metrics: {
        discountPct: number;
        taxBasis: number;
        netReturn: number;
        rsi: number;
        emaShort: number;
        emaLong: number;
        volatility: number;
        vsAveragePct: number;
        targetLimit: number;
        volume: number; // Daily Volume (items)
        liquidity: number; // Daily Volume (GP)
        liquidityState: "Illiquid" | "Low" | "Medium" | "High";
    };
    suggestedPrice: number;
    suggestedPriceLabel: string;
}

export function analyzeItemData(
    currentPrice: number,
    targetLimit: number,
    dailyPoints: DailyPoint[],
    isBuying: boolean
): StrategyResult {
    // 1. Calculate Metrics

    // A. Discount Factor (Buying)
    // High 30d
    const highs = dailyPoints.map(d => d.avgHighPrice ?? 0);
    const high30d = Math.max(...highs);
    const discountPct = high30d > 0 ? ((high30d - currentPrice) / high30d) * 100 : 0;

    // B. Profit/Tax (Selling)
    const taxBasis = Math.min(Math.floor(currentPrice * TAX_RATE), TAX_CAP);
    const netReturn = currentPrice - taxBasis;

    // C. Technical Indicators
    const rsi14 = calculateRSI(dailyPoints, 14);
    const ema12 = calculateEMA(dailyPoints, 12);
    const ema26 = calculateEMA(dailyPoints, 26);
    const volatility = calculateVolatility(dailyPoints, 7);
    const liquidity = calculateLiquidity(dailyPoints, currentPrice);

    // Liquidity Thresholds (Daily GP Volume)
    let liquidityState: StrategyResult["metrics"]["liquidityState"] = "Medium";
    if (liquidity < 50_000_000) liquidityState = "Illiquid";
    else if (liquidity < 250_000_000) liquidityState = "Low";
    else if (liquidity > 1_000_000_000) liquidityState = "High";

    // E. Volume
    // Average volume over 7 days for context
    const volume7d = liquidity / currentPrice; // Approximation based on current price, or we could calculateAverageVolume separately.
    // Let's use the helper if we want exact item volume, but liquidity is better for strategy.

    // D. Value vs Average (SMA)
    const sma7 = calculateSMA(dailyPoints, 7);
    const vsAveragePct = sma7 > 0 ? ((currentPrice - sma7) / sma7) * 100 : 0;

    // 2. Analyze Intention
    let decision = "WAIT";
    let subtext = "Checking...";
    const reasons: string[] = [];
    let color: StrategyResult["color"] = "gray";

    const isRising = ema12 > ema26;
    const isOversold = rsi14 < 30;
    const isAccumulation = rsi14 >= 30 && rsi14 < 45;
    // const isNeutral = rsi14 >= 45 && rsi14 <= 55; // Unused
    const isMomentum = rsi14 > 55 && rsi14 <= 80;
    const isOverbought = rsi14 > 80;

    const isStable = volatility < 0.02;
    // const isVolatile = volatility > 0.08; // Unused, but concept is used in logic below via 'volatility' check

    const isBreakout = vsAveragePct > 10;
    const isCrash = vsAveragePct < -10;

    if (isBuying) {
        if (liquidityState === "Illiquid") {
            // Safety override for illiquid items
            reasons.push(`Warning: Item is Illiquid (${(liquidity / 1000000).toFixed(1)}M GP/day). Limit orders may take days to fill`);
        }

        if (isOversold && liquidityState !== "Illiquid") {
            decision = "SCREAMING BUY";
            subtext = "Deep Value";
            reasons.push(`Market is extremely oversold (RSI: ${rsi14.toFixed(0)} < 30). High potential for mean reversion`);
            color = "green";
        }
        else if (isAccumulation && isStable) {
            decision = "ACCUMULATE";
            subtext = "Accumulate";
            reasons.push(`Price is low (RSI: ${rsi14.toFixed(0)}) and stable. Good environment for patient accumulation`);
            color = "green";
        }
        else if (isBreakout && isRising && liquidityState !== "Illiquid") {
            decision = "MOMENTUM BUY";
            subtext = "Breakout";
            reasons.push(`Price is breaking out (+${vsAveragePct.toFixed(1)}% vs Avg). Enter now to catch the pump`);
            color = "green";
        }
        else if (isAccumulation && vsAveragePct < -2) {
            decision = "STRONG BUY";
            subtext = "Undervalued";
            reasons.push(`Price is undervalued (Score: ${rsi14.toFixed(0)}) and below weekly average`);
            color = "green";
        }
        else if (isRising && !isOverbought && !isMomentum) {
            decision = "BUY";
            subtext = "Trend Up";
            reasons.push("Enter position. Trend is positive and price is reasonable");
            color = "green";
        }
        else if (discountPct > 15 && isRising) {
            decision = "BUY DIP";
            subtext = "Recovering";
            reasons.push(`Buy the dip. Recovering from 15%+ discount`);
            color = "green";
        }
        else if (isOverbought) {
            decision = "WAIT";
            subtext = "Overextended";
            reasons.push(`Do not buy. RSI is ${rsi14.toFixed(0)} (Overbought). Wait for a correction`);
            color = "red";
        }
        else if (vsAveragePct > 5) {
            decision = "WAIT";
            subtext = "Inflated";
            reasons.push(`Current price is 5% above weekly average`);
            color = "red";
        }
        else {
            decision = "WATCH";
            subtext = "Stable";
            reasons.push("Market is neutral. Place passive bids");
            color = "yellow";
        }
    } else {
        if (liquidityState === "Illiquid") {
            reasons.push(`Warning: Item is Illiquid. Exiting may be difficult. Prioritize filling orders over squeezing profit`);
        }

        if (isOverbought) {
            decision = "MANIC SELL";
            subtext = "Overextended";
            reasons.push(`RSI is ${rsi14.toFixed(0)} (>80). Price is likely unsustainable. Exit now`);
            color = "green";
        }
        else if (isCrash) {
            decision = "PANIC SELL";
            subtext = "Crash";
            reasons.push(`Price has collapsed (-${Math.abs(vsAveragePct).toFixed(1)}% vs Avg). Liquidity danger`);
            color = "red";
        }
        else if ((isMomentum || isRising) && rsi14 <= 75) {
            decision = "RIDE TREND";
            subtext = "Momentum";
            reasons.push(`Trend is strong (RSI ${rsi14.toFixed(0)}). Hold for max profit but set trailing stops`);
            color = "green";
        }
        else if (isMomentum && !isRising) {
            decision = "SELL NOW";
            subtext = "Peak Profit";
            reasons.push(`Price is high (Score: ${rsi14.toFixed(0)}). Good time to take profit`);
            color = "green";
        }
        else if (!isRising && (isOversold || isAccumulation)) {
            decision = "CUT LOSSES";
            subtext = "Price Falling";
            reasons.push("Trend is negative and price is dropping. Sell to preserve capital");
            color = "red";
        }
        else {
            decision = "LIST";
            subtext = "Hold / List";
            reasons.push("List at competitive Ask. Strategy is neutral");
            color = "yellow";
        }
    }

    // 3. Calculate Suggested Price
    let suggestedPrice = currentPrice;
    let suggestedPriceLabel = "Limit Price";

    if (isBuying) {
        if (decision === "SCREAMING BUY" || decision === "STRONG BUY") {
            suggestedPrice = targetLimit;
            suggestedPriceLabel = "Unfiltered Bid";
        } else if (decision.includes("WAIT")) {
            suggestedPrice = Math.min(sma7, ema26);
            if (suggestedPrice > currentPrice) suggestedPrice = currentPrice * 0.95;
            suggestedPriceLabel = "Limit Buy";
        } else if (decision === "BUY DIP") {
            suggestedPrice = currentPrice * 0.98;
            suggestedPriceLabel = "Catch Floor";
        } else {
            suggestedPrice = targetLimit > 0 ? targetLimit : currentPrice;
            suggestedPriceLabel = "Competitve Bid";
        }

        // --- VOLUME ADJUSTMENT (Buy) ---
        if (liquidityState === "Illiquid" || liquidityState === "Low") {
            // Low volume logic: Widen spread largely.
            // Don't just pay bid (targetLimit), undermine it.
            // If already at "Unfiltered Bid", maybe drop another 5%.
            suggestedPrice = suggestedPrice * 0.92;
            suggestedPriceLabel += " (Deep)";
        } else if (liquidityState === "High") {
            // High volume: Tighten spread, compete aggressively.
            // If suggested is < current, maybe inch up to ensure fill.
            // e.g. midpoint between sugg and current
            const midpoint = (suggestedPrice + currentPrice) / 2;
            if (midpoint < currentPrice) suggestedPrice = midpoint;
        }

    } else {
        // Selling
        if (decision === "RIDE TREND") {
            const trendStrength = (rsi14 - 50) / 100; // 0.05 to 0.3
            const upside = Math.max(0.05, trendStrength + volatility);
            suggestedPrice = currentPrice * (1 + upside);
            suggestedPriceLabel = "Take Profit Target";
        } else if (decision === "PANIC SELL" || decision === "CUT LOSSES") {
            suggestedPrice = targetLimit; // The Bid (Low), immediate sell
            suggestedPriceLabel = "Dump Price";
        } else if (decision === "SELL NOW") {
            suggestedPrice = currentPrice; // The Ask (High), competitive sell
            suggestedPriceLabel = "List Price";
        } else {
            suggestedPrice = Math.max(currentPrice, sma7 * 1.02);
            suggestedPriceLabel = "Ask Price";
        }

        // --- VOLUME ADJUSTMENT (Sell) ---
        if (liquidityState === "Illiquid" || liquidityState === "Low") {
            // Illiquid sell:
            // If Panic/Cut Loss -> We need to be below targetLimit probably to actually exit.
            if (decision.includes("SELL") || decision.includes("CUT")) {
                suggestedPrice = suggestedPrice * 0.95; // Undercut the bid to escape
                suggestedPriceLabel += " (Escape)";
            } else {
                // Determine if we hold. Illiquid = patience.
                // Increase the ask higher because spread is wide.
                suggestedPrice = suggestedPrice * 1.05;
                suggestedPriceLabel += " (Patient)";
            }
        }
    }

    // Safety check: ensure suggested price is positive and integer
    suggestedPrice = Math.floor(Math.max(1, suggestedPrice));

    return {
        decision,
        subtext,
        explanation: reasons.length ? reasons.join(". ") + "." : "No specific signals.",
        color,
        metrics: {
            discountPct,
            taxBasis,
            netReturn,
            rsi: rsi14,
            emaShort: ema12,
            emaLong: ema26,
            volatility,
            vsAveragePct,
            targetLimit,
            volume: volume7d,
            liquidity,
            liquidityState
        },
        suggestedPrice,
        suggestedPriceLabel
    };
}
