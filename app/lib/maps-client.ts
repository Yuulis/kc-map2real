import type { MapsData, MapSea } from "@/app/types/maps";

const IS_DEV = process.env.NODE_ENV === "development";

/**
 * Load the full maps data set.
 *
 * - Production: served as a static file (`/data/maps.json`, generated at build
 *   time by scripts/merge-maps.mjs) so it is CDN-cacheable and needs no
 *   server function.
 * - Development: read via the API route so edits made through the dev tools
 *   are reflected immediately.
 */
export async function fetchMapsData(): Promise<MapsData> {
  const url = IS_DEV ? "/api/maps" : "/data/maps.json";
  const res = await fetch(url, IS_DEV ? { cache: "no-store" } : undefined);
  if (!res.ok) {
    throw new Error(`Failed to load maps data (HTTP ${res.status})`);
  }
  return (await res.json()) as MapsData;
}

/**
 * Load a single sea file. Used to refresh only the edited sea after a
 * dev-tools write instead of re-assembling every sea.
 */
export async function fetchSea(code: string): Promise<MapSea> {
  const res = await fetch(`/data/seas/${encodeURIComponent(code)}.json`, {
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Failed to load sea "${code}" (HTTP ${res.status})`);
  }
  return (await res.json()) as MapSea;
}
