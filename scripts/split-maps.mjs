/**
 * Migration script: split public/data/maps.json into per-sea files.
 *
 * Creates:
 *   public/data/maps-index.json  -- index with group/sea metadata (no nodes/edges)
 *   public/data/seas/{code}.json -- full MapSea object per sea area
 *
 * Does NOT delete the original maps.json (kept as backup).
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, "..");

const MAPS_JSON = join(ROOT, "public", "data", "maps.json");
const INDEX_OUT = join(ROOT, "public", "data", "maps-index.json");
const SEAS_DIR = join(ROOT, "public", "data", "seas");

// ---------------------------------------------------------------------------
// 1. Read maps.json
// ---------------------------------------------------------------------------
if (!existsSync(MAPS_JSON)) {
  console.error(`ERROR: ${MAPS_JSON} not found`);
  process.exit(1);
}

const raw = readFileSync(MAPS_JSON, "utf-8");
const data = JSON.parse(raw);

if (!data || !Array.isArray(data.groups)) {
  console.error("ERROR: maps.json has unexpected structure (missing groups[])");
  process.exit(1);
}

// ---------------------------------------------------------------------------
// 2. Create seas/ directory
// ---------------------------------------------------------------------------
mkdirSync(SEAS_DIR, { recursive: true });

// ---------------------------------------------------------------------------
// 3. Build index and write per-sea files
// ---------------------------------------------------------------------------
const indexGroups = [];
let seaCount = 0;

for (const group of data.groups) {
  const indexSeas = [];

  for (const sea of group.seas ?? []) {
    // Write individual sea file
    const seaFile = join(SEAS_DIR, `${sea.code}.json`);
    const seaObj = {
      code: sea.code,
      name: sea.name,
      meta: sea.meta ?? {},
      nodes: sea.nodes ?? [],
      edges: sea.edges ?? [],
    };
    if (sea.submaps) {
      seaObj.submaps = sea.submaps;
    }
    writeFileSync(seaFile, JSON.stringify(seaObj, null, 2), "utf-8");
    seaCount++;

    // Add to index (no nodes/edges)
    indexSeas.push({
      code: sea.code,
      name: sea.name,
      meta: sea.meta ?? {},
    });
  }

  indexGroups.push({
    id: group.id,
    name: group.name,
    meta: group.meta ?? {},
    seas: indexSeas,
  });
}

const indexData = {
  version: data.version ?? 2,
  groups: indexGroups,
};

writeFileSync(INDEX_OUT, JSON.stringify(indexData, null, 2), "utf-8");

// ---------------------------------------------------------------------------
// 4. Summary
// ---------------------------------------------------------------------------
console.log("Migration complete:");
console.log(`  Index file : ${INDEX_OUT}`);
console.log(`  Seas dir   : ${SEAS_DIR}`);
console.log(`  Sea files  : ${seaCount}`);
console.log(`  Groups     : ${indexGroups.length}`);
console.log("");
console.log("Original maps.json has NOT been deleted (kept as backup).");
