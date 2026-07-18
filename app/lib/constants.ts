import type { NodeType } from "@/app/types/maps";

/** Available base map styles (MapTiler style ids) */
export const MAP_STYLES = [
  { id: "ocean",         label: "Ocean (航海図)",     maptiler: "ocean" },
  { id: "streets",       label: "Streets (標準)",      maptiler: "streets" },
  { id: "openstreetmap", label: "OpenStreetMap",        maptiler: "openstreetmap" },
  { id: "satellite",     label: "Satellite (衛星)",    maptiler: "satellite" },
  { id: "topo",          label: "Topo (地形図)",       maptiler: "topo" },
] as const;

export type MapStyleId = (typeof MAP_STYLES)[number]["id"];

export const DEFAULT_MAP_STYLE_ID: MapStyleId = "ocean";

export function isMapStyleId(value: string): value is MapStyleId {
  return MAP_STYLES.some((s) => s.id === value);
}

/**
 * Single source of truth for node types.
 * Adding a new node type: extend NodeType in types/maps.ts, add it here
 * (and add a label below + an icon at public/img/nodes/{type}.png).
 */
export const NODE_TYPES: readonly NodeType[] = [
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
];

/** Runtime whitelist of allowed node types (derived from NODE_TYPES) */
export const ALLOWED_NODE_TYPES: ReadonlySet<NodeType> = new Set(NODE_TYPES);

/** Japanese display labels for node types (used in the node info popup) */
export const NODE_TYPE_LABELS: Record<NodeType, string> = {
  start: "出撃地点",
  normal: "通常戦闘",
  boss: "ボス",
  supply: "補給",
  landing: "揚陸地点",
  relay: "中継地点",
  whirlpool: "渦潮",
  port: "泊地",
  "air-base": "航空基地",
  aerial: "航空戦",
  "air-rade": "空襲戦",
  "anti-sub-air-rade": "対潜空襲戦",
  "night-battle": "夜戦",
};

/** Node types rendered with the large icon size */
const LARGE_NODE_TYPES: ReadonlySet<NodeType> = new Set([
  "start",
  "boss",
  "port",
  "air-base",
  "aerial",
  "air-rade",
  "anti-sub-air-rade",
]);

const NODE_ICON_SIZE_LARGE = 50;
const NODE_ICON_SIZE_DEFAULT = 30;

/** Icon size in pixels for a node type */
export function nodeIconSize(type: NodeType): number {
  return LARGE_NODE_TYPES.has(type) ? NODE_ICON_SIZE_LARGE : NODE_ICON_SIZE_DEFAULT;
}

/** Distance (km) an arrow icon is offset back from the edge end point */
export const ARROW_OFFSET_KM = 30;

/** localStorage keys */
export const STORAGE_KEYS = {
  mapStyle: "kc-map-style",
  mapView: "kc-map-view",
  devTools: "kc-dev-tools",
} as const;

/** Breakpoint (px) below which the mobile layout is used */
export const MOBILE_BREAKPOINT_PX = 768;
export const MOBILE_MEDIA_QUERY = `(max-width:${MOBILE_BREAKPOINT_PX}px)`;
