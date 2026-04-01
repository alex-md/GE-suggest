import {
    calculateAverageNotionalVolume,
    calculateAverageVolume,
    calculateEMA,
    calculateRSI,
    calculateSMA,
    calculateVolatility
} from './indicators';
import type { DailyPoint } from './indicators';

const TAX_RATE = 0.02;
const TAX_CAP = 5_000_000;

export interface StrategyResult {
    decision: string;
    subtext: string;
    explanation: string;
    color: "green" | "red" | "yellow" | "gray";
    metrics: {
        discountPct: number;
        taxBasis: number;
        netReturn: number;
        flipMarginAfterTax: number;
        rsi: number;
        emaShort: number;
        emaLong: number;
        volatility: number;
        vsAveragePct: number;
        rawInstantBuyPrice: number;
        rawInstantSellPrice: number;
        instantBuyPrice: number;
        instantSellPrice: number;
        spread: number;
        spreadPct: number;
        geLimit: number;
        dailyVolumeItems: number;
        dailyVolumeNotional: number;
        fillsPerLimit: number;
        liquidityScore: number;
        executionAdjustment: number;
        liquidityState: "Illiquid" | "Low" | "Medium" | "High";
    };
    suggestedPrice: number;
    suggestedPriceLabel: string;
}

function calculateTax(price: number): number {
    return Math.min(Math.floor(price * TAX_RATE), TAX_CAP);
}

function clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
}

function average(values: number[]): number {
    return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function getLiquidityScore(fillsPerLimit: number, dailyVolumeItems: number): number {
    const absoluteVolumeFloor = Math.log10(51);
    const absoluteVolumeCeiling = Math.log10(5_001);
    const absoluteVolumeScore = clamp(
        (Math.log10(dailyVolumeItems + 1) - absoluteVolumeFloor) / (absoluteVolumeCeiling - absoluteVolumeFloor),
        0,
        1
    );
    const relativeFillScore = clamp(
        Math.log10(fillsPerLimit + 1) / Math.log10(13),
        0,
        1
    );

    return clamp((absoluteVolumeScore * 0.72) + (relativeFillScore * 0.28), 0, 1);
}

function getLiquidityState(
    fillsPerLimit: number,
    dailyVolumeItems: number,
    liquidityScore: number
): StrategyResult["metrics"]["liquidityState"] {
    if (dailyVolumeItems < 10 || fillsPerLimit < 0.25 || liquidityScore < 0.18) return "Illiquid";
    if (dailyVolumeItems < 150 || fillsPerLimit < 1 || liquidityScore < 0.42) return "Low";
    if (dailyVolumeItems < 2_500 || fillsPerLimit < 4 || liquidityScore < 0.72) return "Medium";
    return "High";
}

function getExecutionAdjustment(
    referencePrice: number,
    spread: number,
    volatility: number,
    liquidityScore: number
): number {
    const depthPenaltyPct = 0.0015 + ((1 - liquidityScore) * 0.025) + Math.min(0.01, volatility * 0.12);
    const spreadPenalty = spread * (0.1 + ((1 - liquidityScore) * 0.75));
    const pctPenalty = referencePrice * depthPenaltyPct;

    return Math.max(1, Math.round(Math.max(spreadPenalty, pctPenalty)));
}

function getBuyAggression(decision: string, liquidityState: StrategyResult["metrics"]["liquidityState"], hasPositiveFlipEdge: boolean): number {
    const baseAggression: Record<string, number> = {
        "SCREAMING BUY": 0.9,
        "MOMENTUM BUY": 0.82,
        "STRONG BUY": 0.72,
        "ACCUMULATE": 0.58,
        "BUY": 0.62,
        "BUY DIP": 0.48,
        "WATCH": 0.28,
        "WAIT": 0.14
    };

    let aggression = baseAggression[decision] ?? 0.45;

    if (!hasPositiveFlipEdge) aggression = Math.min(aggression, 0.35);
    if (liquidityState === "Illiquid") aggression = Math.min(aggression, 0.2);
    else if (liquidityState === "Low") aggression = Math.min(aggression, 0.45);
    else if (liquidityState === "High" && hasPositiveFlipEdge) aggression = Math.min(0.95, aggression + 0.08);

    return aggression;
}

function getSellPatience(decision: string, liquidityState: StrategyResult["metrics"]["liquidityState"]): number {
    const basePatience: Record<string, number> = {
        "PANIC SELL": 0.08,
        "CUT LOSSES": 0.12,
        "HOLD": 0.72,
        "MANIC SELL": 0.78,
        "SELL NOW": 0.7,
        "RIDE TREND": 0.9,
        "LIST": 0.58
    };

    let patience = basePatience[decision] ?? 0.55;

    if (liquidityState === "Illiquid") patience = Math.min(patience, 0.45);
    else if (liquidityState === "Low") patience = Math.min(patience, 0.6);

    return patience;
}

export function analyzeItemData(
    instantBuyPrice: number,
    instantSellPrice: number,
    geLimit: number,
    dailyPoints: DailyPoint[],
    isBuying: boolean
): StrategyResult {
    const safeRawInstantBuy = Math.max(1, instantBuyPrice || 0);
    const safeRawInstantSell = Math.max(1, instantSellPrice || 0);
    const rawSpread = Math.max(0, safeRawInstantBuy - safeRawInstantSell);
    const rsi14 = calculateRSI(dailyPoints, 14);
    const ema12 = calculateEMA(dailyPoints, 12);
    const ema26 = calculateEMA(dailyPoints, 26);
    const volatility = calculateVolatility(dailyPoints, 7);
    const sma7 = calculateSMA(dailyPoints, 7);
    const dailyVolumeItems = calculateAverageVolume(dailyPoints, 7, isBuying ? "low" : "high");
    const dailyVolumeNotional = calculateAverageNotionalVolume(dailyPoints, 7, isBuying ? "low" : "high");
    const fillsPerLimit = geLimit > 0 ? dailyVolumeItems / geLimit : 0;
    const liquidityScore = getLiquidityScore(fillsPerLimit, dailyVolumeItems);
    const liquidityState = getLiquidityState(fillsPerLimit, dailyVolumeItems, liquidityScore);
    const executionAdjustment = getExecutionAdjustment(
        Math.max(1, Math.floor((safeRawInstantBuy + safeRawInstantSell) / 2)),
        rawSpread,
        volatility,
        liquidityScore
    );
    const safeInstantBuy = safeRawInstantBuy + executionAdjustment;
    const safeInstantSell = Math.max(1, safeRawInstantSell - executionAdjustment);
    const marketPrice = isBuying ? safeInstantBuy : safeInstantSell;
    const spread = Math.max(0, safeInstantBuy - safeInstantSell);
    const spreadPct = safeInstantSell > 0 ? (spread / safeInstantSell) * 100 : 0;

    const highs = dailyPoints.map(point => point.avgHighPrice ?? 0);
    const high30d = Math.max(...highs, 0);
    const discountPct = high30d > 0 ? ((high30d - marketPrice) / high30d) * 100 : 0;

    const taxBasis = calculateTax(marketPrice);
    const netReturn = marketPrice - taxBasis;
    const flipMarginAfterTax = safeInstantBuy - safeInstantSell - calculateTax(safeInstantBuy);
    const vsAveragePct = sma7 > 0 ? ((marketPrice - sma7) / sma7) * 100 : 0;

    let decision = "WAIT";
    let subtext = "Checking...";
    const reasons: string[] = [];
    let color: StrategyResult["color"] = "gray";

    const isRising = ema12 > ema26;
    const isOversold = rsi14 < 30;
    const isAccumulation = rsi14 >= 30 && rsi14 < 45;
    const isMomentum = rsi14 > 55 && rsi14 <= 80;
    const isOverbought = rsi14 > 80;
    const isStable = volatility < 0.02;
    const isBreakout = vsAveragePct > 10;
    const isCrash = vsAveragePct < -10;
    const isSoftSelloff = vsAveragePct < -4;
    const hasPositiveFlipEdge = flipMarginAfterTax > 0;

    if (liquidityState === "Illiquid") {
        reasons.push(`Passive fills average only ${Math.round(dailyVolumeItems).toLocaleString()} items/day (${fillsPerLimit.toFixed(2)}x limit/day)`);
    } else if (liquidityState === "Low") {
        reasons.push(`Fill rate is modest at ${Math.round(dailyVolumeItems).toLocaleString()} items/day (${fillsPerLimit.toFixed(2)}x limit/day)`);
    } else if (liquidityState === "Medium" && dailyVolumeItems < 2_500) {
        reasons.push(`Relative fills are fine, but depth is still only ${Math.round(dailyVolumeItems).toLocaleString()} items/day`);
    }

    if (liquidityScore < 0.72) {
        reasons.push(`Modeled instant execution widens by about ${executionAdjustment.toLocaleString()} gp to account for thin depth`);
    }

    if (isBuying && !hasPositiveFlipEdge) {
        reasons.push(`Live spread is ${spread.toLocaleString()} gp, which does not clear the 2% GE tax`);
    }

    if (isBuying) {
        if (!hasPositiveFlipEdge && !isOversold && !isCrash) {
            decision = "WAIT";
            subtext = "Tax Locked";
            reasons.push("Current spread is too thin for a realistic flip entry");
            color = "red";
        }
        else if (isOversold && liquidityState !== "Illiquid" && hasPositiveFlipEdge) {
            decision = "SCREAMING BUY";
            subtext = "Deep Value";
            reasons.push(`Market is extremely oversold (RSI ${rsi14.toFixed(0)}) with room above tax`);
            color = "green";
        }
        else if (isAccumulation && isStable && hasPositiveFlipEdge) {
            decision = "ACCUMULATE";
            subtext = "Accumulate";
            reasons.push(`Price is stable with RSI ${rsi14.toFixed(0)} and a tradeable spread`);
            color = "green";
        }
        else if (isBreakout && isRising && liquidityState !== "Illiquid" && hasPositiveFlipEdge) {
            decision = "MOMENTUM BUY";
            subtext = "Breakout";
            reasons.push(`Trend is breaking out at +${vsAveragePct.toFixed(1)}% vs 7d average`);
            color = "green";
        }
        else if (isAccumulation && vsAveragePct < -2 && hasPositiveFlipEdge) {
            decision = "STRONG BUY";
            subtext = "Undervalued";
            reasons.push("Price is below the weekly average and still clears tax");
            color = "green";
        }
        else if (isRising && !isOverbought && !isMomentum && hasPositiveFlipEdge) {
            decision = "BUY";
            subtext = "Trend Up";
            reasons.push("Momentum is positive and the live spread remains workable");
            color = "green";
        }
        else if (discountPct > 15 && isRising && hasPositiveFlipEdge) {
            decision = "BUY DIP";
            subtext = "Recovering";
            reasons.push("Price is rebounding from a meaningful discount without giving up the edge to tax");
            color = "green";
        }
        else if (isOverbought) {
            decision = "WAIT";
            subtext = "Overextended";
            reasons.push(`RSI is ${rsi14.toFixed(0)}. Let the market cool before chasing`);
            color = "red";
        }
        else if (vsAveragePct > 5) {
            decision = "WAIT";
            subtext = "Inflated";
            reasons.push("Current price is stretched above the recent average");
            color = "red";
        }
        else {
            decision = "WATCH";
            subtext = "Passive";
            reasons.push("Set a patient bid near the live spread instead of paying up");
            color = "yellow";
        }
    } else {
        if (isOverbought) {
            decision = "MANIC SELL";
            subtext = "Overextended";
            reasons.push(`RSI is ${rsi14.toFixed(0)} and buyers are likely overpaying`);
            color = "green";
        }
        else if (isCrash) {
            decision = "PANIC SELL";
            subtext = "Crash";
            reasons.push(`Price is down ${Math.abs(vsAveragePct).toFixed(1)}% vs the 7d average`);
            color = "green";
        }
        else if ((isMomentum || isRising) && rsi14 <= 75) {
            decision = "RIDE TREND";
            subtext = "Momentum";
            reasons.push(`Trend is still constructive (RSI ${rsi14.toFixed(0)})`);
            color = "green";
        }
        else if (isMomentum && !isRising) {
            decision = "SELL NOW";
            subtext = "Take Profit";
            reasons.push("Momentum remains elevated but trend follow-through is fading");
            color = "green";
        }
        else if (!isRising && isOversold && isSoftSelloff && liquidityState !== "High") {
            decision = "CUT LOSSES";
            subtext = "Falling";
            reasons.push("Price action is weak enough that a faster exit is safer than holding out for a better ask");
            color = "green";
        }
        else if (!isRising && (isOversold || isAccumulation || (isStable && vsAveragePct < 2))) {
            decision = "HOLD";
            subtext = "Soft";
            reasons.push("Momentum is soft enough that holding is favored over selling into weakness");
            color = "red";
        }
        else {
            decision = "LIST";
            subtext = "Neutral";
            reasons.push("List inside the spread and make buyers meet your price");
            color = "green";
        }
    }

    const fairValueInputs = [sma7, ema12, ema26].filter(value => value > 0);
    const fairValue = fairValueInputs.length > 0
        ? average(fairValueInputs)
        : average([safeRawInstantBuy, safeRawInstantSell].filter(value => value > 0));

    let suggestedPrice = marketPrice;
    let suggestedPriceLabel = "Order Price";

    if (isBuying) {
        const aggression = getBuyAggression(decision, liquidityState, hasPositiveFlipEdge);
        const underbidFloor = Math.max(1, Math.floor(safeInstantSell - Math.max(1, spread * 0.2)));
        const fairCap = Math.min(
            safeInstantBuy,
            Math.max(safeInstantSell, Math.floor(fairValue * (hasPositiveFlipEdge ? 1.005 : 0.99)))
        );
        const spreadBid = safeInstantSell + spread * aggression;

        suggestedPrice = clamp(
            Math.floor(spreadBid),
            decision === "WAIT" || decision === "WATCH" ? underbidFloor : safeInstantSell,
            Math.max(safeInstantSell, fairCap)
        );

        if (decision === "SCREAMING BUY" || decision === "MOMENTUM BUY") {
            suggestedPriceLabel = "Aggressive Bid";
        } else if (decision === "WAIT" || decision === "WATCH") {
            suggestedPriceLabel = "Passive Bid";
        } else {
            suggestedPriceLabel = "Competitive Bid";
        }
    } else {
        const patience = getSellPatience(decision, liquidityState);
        const spreadAsk = safeInstantSell + spread * patience;
        const fairFloor = Math.max(safeInstantSell, Math.floor(fairValue * 0.995));
        const reachAboveAsk = decision === "RIDE TREND" && liquidityState !== "Illiquid"
            ? Math.max(1, Math.floor(spread * 0.15))
            : 0;

        suggestedPrice = clamp(
            Math.floor(spreadAsk),
            decision === "PANIC SELL" || decision === "CUT LOSSES" ? safeInstantSell : fairFloor,
            safeInstantBuy + reachAboveAsk
        );

        if (decision === "PANIC SELL" || decision === "CUT LOSSES") {
            suggestedPriceLabel = "Fast Exit";
        } else if (decision === "HOLD") {
            suggestedPriceLabel = "Patient Ask";
        } else if (decision === "RIDE TREND") {
            suggestedPriceLabel = "Profit Ask";
        } else {
            suggestedPriceLabel = "Competitive Ask";
        }
    }

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
            flipMarginAfterTax,
            rsi: rsi14,
            emaShort: ema12,
            emaLong: ema26,
            volatility,
            vsAveragePct,
            rawInstantBuyPrice: safeRawInstantBuy,
            rawInstantSellPrice: safeRawInstantSell,
            instantBuyPrice: safeInstantBuy,
            instantSellPrice: safeInstantSell,
            spread,
            spreadPct,
            geLimit,
            dailyVolumeItems,
            dailyVolumeNotional,
            fillsPerLimit,
            liquidityScore,
            executionAdjustment,
            liquidityState
        },
        suggestedPrice,
        suggestedPriceLabel
    };
}
