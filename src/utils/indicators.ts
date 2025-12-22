
export interface DailyPoint {
    timestamp: number;
    avgHighPrice: number | null;
    avgLowPrice: number | null;
    highPriceVolume: number;
    lowPriceVolume: number;
}

export function calculateRSI(data: DailyPoint[], periods: number): number {
    if (!data || data.length < periods + 1) return 50;

    // Filter valid prices and map to average price
    // Note: osrs.js logic: Math.floor((d.avgHighPrice + d.avgLowPrice) / 2)
    // If one is null, wiki API returns null. We need to handle that.
    // osrs.js checks .filter(p => p > 0), implying it handles 0 or nulls effectively if they result in 0 or NaN.

    let prices = data.map(d => {
        const h = d.avgHighPrice ?? 0;
        const l = d.avgLowPrice ?? 0;
        if (h === 0 && l === 0) return 0;
        if (h === 0) return l;
        if (l === 0) return h;
        return Math.floor((h + l) / 2);
    }).filter(p => p > 0);

    // Slice to relevant window (periods + 20 for warm up, similar to osrs.js)
    if (prices.length > periods + 20) {
        prices = prices.slice(prices.length - (periods + 20));
    }

    let gains = 0;
    let losses = 0;

    // First period
    for (let i = 1; i <= periods; i++) {
        if (i >= prices.length) break;
        const change = prices[i] - prices[i - 1];
        if (change > 0) gains += change;
        else losses += Math.abs(change);
    }

    let avgGain = gains / periods;
    let avgLoss = losses / periods;

    // Smoothing
    for (let i = periods + 1; i < prices.length; i++) {
        const change = prices[i] - prices[i - 1];
        const currentGain = change > 0 ? change : 0;
        const currentLoss = change < 0 ? Math.abs(change) : 0;

        avgGain = ((avgGain * (periods - 1)) + currentGain) / periods;
        avgLoss = ((avgLoss * (periods - 1)) + currentLoss) / periods;
    }

    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
}

export function calculateEMA(data: DailyPoint[], periods: number): number {
    if (!data || data.length < periods) return 0;

    const prices = data.map(d => {
        const h = d.avgHighPrice ?? 0;
        const l = d.avgLowPrice ?? 0;
        if (h === 0 && l === 0) return 0;
        if (h === 0) return l;
        if (l === 0) return h;
        return Math.floor((h + l) / 2);
    }).filter(p => p > 0);

    if (prices.length < periods) return 0;

    const k = 2 / (periods + 1);

    // Start with SMA of first 'periods' (or just first element if simple)
    // osrs.js: let ema = prices[prices.length - periods]; 
    // This is actually initializing with the price at (N-periods). 
    // It iterates from there.

    let startIndex = prices.length - periods;
    if (startIndex < 0) startIndex = 0;

    let ema = prices[startIndex];

    for (let i = startIndex + 1; i < prices.length; i++) {
        ema = (prices[i] * k) + (ema * (1 - k));
    }

    return ema;
}

export function calculateSMA(data: DailyPoint[], n: number): number {
    if (!data || data.length < n) return 0;

    const slice = data.slice(data.length - n);
    const sum = slice.reduce((acc, b) => {
        const h = b.avgHighPrice ?? 0;
        const l = b.avgLowPrice ?? 0;
        let price = 0;
        if (h > 0 && l > 0) price = (h + l) / 2;
        else if (h > 0) price = h;

        return acc + price;
    }, 0);

    return sum / n;
}

export function calculateVolatility(data: DailyPoint[], periods: number): number {
    if (!data || data.length < periods) return 0;

    const relevant = data.slice(data.length - periods).map(d => {
        const h = d.avgHighPrice ?? 0;
        const l = d.avgLowPrice ?? 0;
        if (h > 0 && l > 0) return (h + l) / 2;
        if (h > 0) return h;
        return 0;
    }).filter(p => p > 0);

    if (relevant.length === 0) return 0;

    const mean = relevant.reduce((a, b) => a + b, 0) / relevant.length;
    const variance = relevant.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / relevant.length;

    return Math.sqrt(variance) / mean;
}

export function calculateAverageVolume(data: DailyPoint[], periods: number): number {
    if (!data || data.length === 0) return 0;
    const slice = data.slice(Math.max(0, data.length - periods));
    const total = slice.reduce((acc, d) => acc + d.highPriceVolume + d.lowPriceVolume, 0);
    return total / slice.length;
}

export function calculateLiquidity(data: DailyPoint[], currentPrice: number): number {
    const avgVol = calculateAverageVolume(data, 7);
    return avgVol * currentPrice;
}
