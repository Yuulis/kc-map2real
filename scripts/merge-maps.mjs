/**
 * Build script: merge maps-index.json + per-sea files into a single static file.
 *
 * Creates:
 *   public/data/maps.json -- full MapsData served statically in production
 *
 * Run automatically before `next build` (see package.json "build" script).
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, "..");

const INDEX_PATH = join(ROOT, "public", "data", "maps-index.json");
const SEAS_DIR = join(ROOT, "public", "data", "seas");
const OUT_PATH = join(ROOT, "public", "data", "maps.json");

if (!existsSync(INDEX_PATH)) {
  console.error(`ERROR: ${INDEX_PATH} not found`);
  process.exit(1);
}

const index = JSON.parse(readFileSync(INDEX_PATH, "utf-8"));

const groups = index.groups.map((group) => ({
  id: group.id,
  name: group.name,
  meta: group.meta,
  seas: group.seas.map((seaRef) => {
    const seaPath = join(SEAS_DIR, `${seaRef.code}.json`);
    if (!existsSync(seaPath)) {
      console.error(`ERROR: sea file not found: ${seaPath}`);
      process.exit(1);
    }
    return JSON.parse(readFileSync(seaPath, "utf-8"));
  }),
}));

const merged = { version: index.version, groups };

writeFileSync(OUT_PATH, JSON.stringify(merged), "utf-8");

const seaCount = groups.reduce((n, g) => n + g.seas.length, 0);
console.log(`Merged ${seaCount} seas into ${OUT_PATH}`);
