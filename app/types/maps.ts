/** Node type identifiers for map cells */
export type NodeType =
  | "start"
  | "normal"
  | "boss"
  | "supply"
  | "relay"
  | "whirlpool"
  | "port"
  | "aerial"
  | "air-rade"
  | "night-battle";

/** Extensible metadata object for future fields */
export type Meta = Record<string, unknown>;

/** A single map node (cell) */
export interface MapNode {
  /** Node identifier (e.g. "A", "Start") */
  id: string;
  /** Node type */
  type: NodeType;
  /** Latitude */
  lat: number;
  /** Longitude */
  lng: number;
  /** Display name */
  name: string;
  /** Extensible metadata */
  meta: Meta;
}

/** A directed or undirected edge between nodes */
export interface MapEdge {
  /** Source node id */
  from: string;
  /** Target node id */
  to: string;
  /** Whether to display an arrow indicator */
  arrow?: boolean;
}

/** A sub-map within a sea area (e.g. "7-2-1", "7-2-2") sharing the same nodes but with different edges */
export interface MapSubSea {
  /** Sub-map identifier (e.g. "1", "2") */
  id: string;
  /** Display name (e.g. "7-2-1") */
  name: string;
  /** Nodes specific to this sub-map (optional; base nodes live in the parent sea) */
  nodes?: MapNode[];
  /** Edges for this sub-map */
  edges: MapEdge[];
}

/** A single sea area (e.g. "1-1") */
export interface MapSea {
  /** Sea area code (e.g. "1-1") */
  code: string;
  /** Display name of the sea area */
  name: string;
  /** Extensible metadata */
  meta: Meta;
  /** Nodes in this sea area */
  nodes: MapNode[];
  /** Edges connecting nodes (used when submaps is absent for backward compatibility) */
  edges: MapEdge[];
  /** Optional sub-maps with different edge sets sharing the same nodes */
  submaps?: MapSubSea[];
}

/** A group of sea areas (e.g. world 1) */
export interface MapGroup {
  /** Group identifier (e.g. "1") */
  id: string;
  /** Display name of the group */
  name: string;
  /** Extensible metadata */
  meta: Meta;
  /** Sea areas in this group */
  seas: MapSea[];
}

/** Root schema for maps.json */
export interface MapsData {
  /** Schema version */
  version: number;
  /** Sea area groups */
  groups: MapGroup[];
}

// ---------------------------------------------------------------------------
// Index-only types (per-sea split: maps-index.json has no nodes/edges)
// ---------------------------------------------------------------------------

/** Sea area reference in the index (no nodes/edges) */
export interface MapSeaIndex {
  /** Sea area code (e.g. "1-1") */
  code: string;
  /** Display name of the sea area */
  name: string;
  /** Extensible metadata */
  meta: Meta;
}

/** Group in the index file */
export interface MapGroupIndex {
  /** Group identifier (e.g. "1") */
  id: string;
  /** Display name of the group */
  name: string;
  /** Extensible metadata */
  meta: Meta;
  /** Sea area references (no nodes/edges) */
  seas: MapSeaIndex[];
}

/** Root schema for maps-index.json */
export interface MapsIndex {
  /** Schema version */
  version: number;
  /** Sea area groups (index-only, no nodes/edges) */
  groups: MapGroupIndex[];
}

// ---------------------------------------------------------------------------
// Legacy / API response types (used by /api/names and the admin UI)
// These represent the backward-compatible shape returned by the names API,
// where node names are stored as a flat { [nodeId]: name } map rather than
// the full MapNode[] array used in maps.json.
// ---------------------------------------------------------------------------

export type NodeId = string;

/** Flat map of node ID → display name (used in API responses) */
export type NodeNames = Record<NodeId, string>;

/** Sea area shape returned by the names API */
export interface Sea {
  /** Sea area code e.g. "1-1" */
  code: string;
  /** Display name */
  name: string;
  /** Node ID → display name map */
  nodes: NodeNames;
  /** Optional display order */
  order?: number;
}

/** Sea group shape returned by the names API */
export interface SeaGroup {
  /** Group ID e.g. "1" */
  id: string;
  /** Display name */
  name: string;
  /** Sea areas in this group */
  seas: Sea[];
  /** Optional display order */
  order?: number;
}

/** Root shape returned by GET /api/names */
export interface NamesData {
  /** Schema version */
  version: number;
  /** Sea area groups */
  groups: SeaGroup[];
}
