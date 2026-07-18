/**
 * Validation script: check integrity of maps-index.json + per-sea files.
 *
 * Checks:
 *   - every sea listed in the index has a seas/{code}.json file (and vice versa)
 *   - sea.code inside each file matches its filename / index entry
 *   - node types are in the allowed list
 *   - node ids are unique within their scope (base / each submap)
 *   - every edge endpoint (base and submap edges) references an existing node
 *
 * Exits non-zero when any error is found. Run via `npm run validate:maps`.
 */

import { readFileSync, readdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, "..");

const INDEX_PATH = join(ROOT, "public", "data", "maps-index.json");
const SEAS_DIR = join(ROOT, "public", "data", "seas");

// Keep in sync with NODE_TYPES in app/lib/constants.ts
const NODE_TYPES = new Set([
  "start",
  "normal",
  "boss",
  "supply",
  "landing",
  "relay",
  "whirlpool",
  "port",
  "air-base",
  "aerial",
  "air-rade",
  "anti-sub-air-rade",
  "night-battle",
]);

const errors = [];
const warnings = [];

function checkNodes(nodes, scope) {
  const ids = new Set();
  for (const node of nodes) {
    if (!node.id || typeof node.id !== "string") {
      errors.push(`${scope}: node with missing/invalid id`);
      continue;
    }
    if (ids.has(node.id)) {
      errors.push(`${scope}: duplicate node id "${node.id}"`);
    }
    ids.add(node.id);
    if (!NODE_TYPES.has(node.type)) {
      errors.push(`${scope}: node "${node.id}" has unknown type "${node.type}"`);
    }
    if (typeof node.lat !== "number" || typeof node.lng !== "number") {
      errors.push(`${scope}: node "${node.id}" has invalid coordinates`);
    }
    if (node.bossDialogue !== undefined && typeof node.bossDialogue !== "string") {
      errors.push(`${scope}: node "${node.id}" has invalid bossDialogue`);
    }
  }
  return ids;
}

function checkEdges(edges, knownIds, scope) {
  for (const edge of edges) {
    if (!knownIds.has(edge.from)) {
      errors.push(`${scope}: edge ${edge.from} -> ${edge.to} references unknown node "${edge.from}"`);
    }
    if (!knownIds.has(edge.to)) {
      errors.push(`${scope}: edge ${edge.from} -> ${edge.to} references unknown node "${edge.to}"`);
    }
  }
}

if (!existsSync(INDEX_PATH)) {
  console.error(`ERROR: ${INDEX_PATH} not found`);
  process.exit(1);
}

const index = JSON.parse(readFileSync(INDEX_PATH, "utf-8"));
const indexCodes = new Set();

for (const group of index.groups) {
  for (const seaRef of group.seas) {
    const code = seaRef.code;
    if (indexCodes.has(code)) {
      errors.push(`index: duplicate sea code "${code}"`);
      continue;
    }
    indexCodes.add(code);

    const seaPath = join(SEAS_DIR, `${code}.json`);
    if (!existsSync(seaPath)) {
      errors.push(`index: sea "${code}" has no file at seas/${code}.json`);
      continue;
    }

    let sea;
    try {
      sea = JSON.parse(readFileSync(seaPath, "utf-8"));
    } catch (err) {
      errors.push(`seas/${code}.json: invalid JSON (${err.message})`);
      continue;
    }

    if (sea.code !== code) {
      errors.push(`seas/${code}.json: sea.code is "${sea.code}" (expected "${code}")`);
    }

    // Base nodes + all submap nodes form the id universe for edges,
    // matching how the app resolves edges across base/submap scopes.
    const baseIds = checkNodes(sea.nodes ?? [], `${code} (base)`);
    const allIds = new Set(baseIds);
    for (const submap of sea.submaps ?? []) {
      const submapIds = checkNodes(submap.nodes ?? [], `${code}/submap ${submap.id}`);
      for (const id of submapIds) allIds.add(id);
    }

    checkEdges(sea.edges ?? [], allIds, `${code} (base)`);
    for (const submap of sea.submaps ?? []) {
      checkEdges(submap.edges ?? [], allIds, `${code}/submap ${submap.id}`);
    }
  }
}

// Orphan sea files not referenced by the index
for (const file of readdirSync(SEAS_DIR)) {
  if (!file.endsWith(".json")) continue;
  const code = file.replace(/\.json$/, "");
  if (!indexCodes.has(code)) {
    warnings.push(`seas/${file} is not referenced by maps-index.json`);
  }
}

for (const w of warnings) console.warn(`WARN: ${w}`);
if (errors.length > 0) {
  for (const e of errors) console.error(`ERROR: ${e}`);
  console.error(`\nValidation failed: ${errors.length} error(s), ${warnings.length} warning(s)`);
  process.exit(1);
}
console.log(`Validation OK: ${indexCodes.size} seas, ${warnings.length} warning(s)`);
