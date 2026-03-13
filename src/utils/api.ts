
import type { DailyPoint } from './indicators';

export interface ItemMapping {
    id: number;
    name: string;
    examine: string;
    members: boolean;
    lowalch: number;
    limit: number;
    value: number;
    highalch: number;
    icon: string;
}

export interface LatestPrice {
    high: number;
    highTime: number;
    low: number;
    lowTime: number;
}

const USER_AGENT = "OSRS-Flipper-Web/1.0";
const BASE_URL = "https://prices.runescape.wiki/api/v1/osrs";

export async function fetchItemMapping(): Promise<ItemMapping[]> {
    try {
        const response = await fetch(`${BASE_URL}/mapping`, {
            headers: { "User-Agent": USER_AGENT }
        });
        if (!response.ok) throw new Error("Failed to fetch mapping");
        return await response.json();
    } catch (e) {
        console.error(e);
        return [];
    }
}

export async function fetchLatest(id: number): Promise<LatestPrice | null> {
    try {
        const response = await fetch(`${BASE_URL}/latest?id=${id}`, {
            headers: { "User-Agent": USER_AGENT }
        });
        if (!response.ok) throw new Error("Failed to fetch latest");
        const json = await response.json() as { data?: Record<number, LatestPrice> };
        return json.data?.[id] ?? null;
    } catch (e) {
        console.error(e);
        return null;
    }
}

export async function fetchTimeSeries(id: number, timestep: "5m" | "1h" | "6h" | "24h"): Promise<DailyPoint[]> {
    try {
        const response = await fetch(`${BASE_URL}/timeseries?id=${id}&timestep=${timestep}`, {
            headers: { "User-Agent": USER_AGENT }
        });
        if (!response.ok) throw new Error("Failed to fetch timeseries");
        const json = await response.json() as { data?: DailyPoint[] };
        return json.data ?? [];
    } catch (e) {
        console.error(e);
        return [];
    }
}
