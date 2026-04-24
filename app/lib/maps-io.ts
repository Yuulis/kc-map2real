import path from "path";
import { promises as fs } from "fs";

import type {
  MapsData,
  MapsIndex,
  MapSea,
  MapGroupIndex,
  MapSeaIndex,
} from "@/app/types/maps";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Path to the index file (no nodes/edges) */
export const INDEX_PATH = path.join(
  process.cwd(),
  "public",
  "data",
  "maps-index.json",
);

/** Directory containing per-sea JSON files */
export const SEAS_DIR = path.join(process.cwd(), "public", "data", "seas");

// ---------------------------------------------------------------------------
// Path helpers
// ---------------------------------------------------------------------------

/** Return the absolute file path for a sea code (e.g. "1-1" -> ".../seas/1-1.json") */
export function seaFilePath(code: string): string {
  return path.join(SEAS_DIR, `${code}.json`);
}

// ---------------------------------------------------------------------------
// Index read / write
// ---------------------------------------------------------------------------

/** Read and parse maps-index.json */
export async function readIndex(): Promise<MapsIndex> {
  const content = await fs.readFile(INDEX_PATH, "utf-8");
  return JSON.parse(content) as MapsIndex;
}

/** Write maps-index.json */
export async function writeIndex(data: MapsIndex): Promise<void> {
  await fs.writeFile(INDEX_PATH, JSON.stringify(data, null, 2), "utf-8");
}

// ---------------------------------------------------------------------------
// Sea file read / write / delete
// ---------------------------------------------------------------------------

/** Read and parse a single sea file */
export async function readSea(code: string): Promise<MapSea> {
  const content = await fs.readFile(seaFilePath(code), "utf-8");
  return JSON.parse(content) as MapSea;
}

/** Write a single sea file (uses sea.code for the filename) */
export async function writeSea(sea: MapSea): Promise<void> {
  await fs.mkdir(SEAS_DIR, { recursive: true });
  await fs.writeFile(seaFilePath(sea.code), JSON.stringify(sea, null, 2), "utf-8");
}

/** Delete a sea file */
export async function deleteSea(code: string): Promise<void> {
  await fs.unlink(seaFilePath(code));
}

// ---------------------------------------------------------------------------
// Full data assembly
// ---------------------------------------------------------------------------

/** Assemble the full MapsData by combining index + all sea files */
export async function readFullMapsData(): Promise<MapsData> {
  const index = await readIndex();
  const groups = await Promise.all(
    index.groups.map(async (group) => {
      const seas = await Promise.all(
        group.seas.map((seaRef) => readSea(seaRef.code)),
      );
      return {
        id: group.id,
        name: group.name,
        meta: group.meta,
        seas,
      };
    }),
  );
  return {
    version: index.version,
    groups,
  };
}

// ---------------------------------------------------------------------------
// Lookup helpers
// ---------------------------------------------------------------------------

/** Find a sea reference and its parent group in the index */
export function findSeaInIndex(
  index: MapsIndex,
  code: string,
): { group: MapGroupIndex; sea: MapSeaIndex } | undefined {
  for (const group of index.groups) {
    for (const sea of group.seas) {
      if (sea.code === code) {
        return { group, sea };
      }
    }
  }
  return undefined;
}

/** Find a group in the index by id */
export function findGroupInIndex(
  index: MapsIndex,
  id: string,
): MapGroupIndex | undefined {
  return index.groups.find((g) => g.id === id);
}
