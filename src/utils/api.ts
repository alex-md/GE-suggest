
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

export async function fetchLatest(id: number) {
    try {
        const response = await fetch(`${BASE_URL}/latest?id=${id}`, {
            headers: { "User-Agent": USER_AGENT }
        });
        if (!response.ok) throw new Error("Failed to fetch latest");
        const json = await response.json();
        return json.data[id];
    } catch (e) {
        console.error(e);
        return null;
    }
}

export async function fetchTimeSeries(id: number, timestep: "5m" | "1h" | "6h" | "24h") {
    try {
        const response = await fetch(`${BASE_URL}/timeseries?id=${id}&timestep=${timestep}`, {
            headers: { "User-Agent": USER_AGENT }
        });
        if (!response.ok) throw new Error("Failed to fetch timeseries");
        const json = await response.json();
        return json.data;
    } catch (e) {
        console.error(e);
        return [];
    }
}
