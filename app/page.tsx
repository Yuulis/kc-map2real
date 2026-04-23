"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import Map, { Marker, Source, Layer, MapRef } from "react-map-gl/maplibre";
import NextImage from "next/image";
import "maplibre-gl/dist/maplibre-gl.css";
import { point } from "@turf/helpers";
import turfBearing from "@turf/bearing";
import destination from "@turf/destination";
import type { Feature, FeatureCollection, LineString, Point } from "geojson";
import type { ExpressionSpecification, MapLayerMouseEvent } from "maplibre-gl";

import { toast } from "sonner";
import { Pencil, MapIcon } from "lucide-react";
import Paper from "@mui/material/Paper";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import MuiCheckbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import Typography from "@mui/material/Typography";
import Divider from "@mui/material/Divider";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import IconButton from "@mui/material/IconButton";
import type { MapsData, MapNode, MapEdge } from "@/app/types/maps";
import NodeEditDialog from "@/app/components/NodeEditDialog";
import SeaManagerDialog from "@/app/components/SeaManagerDialog";

// Internal view-layer types derived from MapsData
type Node = MapNode;

type Edge = MapEdge;

type SubMapInfo = {
  id: string;
  name: string;
  nodes?: Node[];
  edges: Edge[];
};

type SectionData = {
  key: string;
  nodes: Node[];
  edges: Edge[];
  submaps?: SubMapInfo[];
};

// Whitelist of allowed node types (runtime validation)
const ALLOWED_NODE_TYPES = new Set<SectionData["nodes"][number]["type"]>([
  "start",
  "normal",
  "boss",
  "supply",
  "relay",
  "whirlpool",
  "port",
  "aerial",
  "air-rade",
  "night-battle",
]);

// Great-circle distance (km) between two [lng, lat] points
function haversineKm(from: [number, number], to: [number, number]): number {
  const R = 6371;
  const dLat = ((to[1] - from[1]) * Math.PI) / 180;
  const dLng = ((to[0] - from[0]) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((from[1] * Math.PI) / 180) *
      Math.cos((to[1] * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Static rotation expression for arrow icon layers
const rotateExpression: ExpressionSpecification = ["get", "rotation"];

// Static style for node image markers
const nodeImageStyle: React.CSSProperties = {
  cursor: "pointer",
  filter: "drop-shadow(0px 0px 4px rgba(0,0,0,0.5))",
};

// Memoized node marker component to avoid re-rendering all markers on parent state changes
const NodeMarker = React.memo(function NodeMarker({
  node,
  onClickNode,
}: {
  node: Node;
  onClickNode: (node: MapNode) => void;
}) {
  const safeType = ALLOWED_NODE_TYPES.has(node.type) ? node.type : "normal";
  const sizePx =
    safeType === "start" || safeType === "boss" || safeType === "port"
      ? 50
      : 30;
  return (
    <React.Fragment>
      {/* Image marker (centered on coordinates) */}
      <Marker longitude={node.lng} latitude={node.lat} anchor="center">
        <NextImage
          src={`/img/nodes/${safeType}.png`}
          alt={node.name ?? node.id}
          title={node.name ?? node.id}
          width={sizePx}
          height={sizePx}
          unoptimized
          style={nodeImageStyle}
          onClick={(ev) => {
            ev.stopPropagation();
            onClickNode(node);
          }}
        />
      </Marker>

      {/* Label marker (offset below the image) */}
      <Marker
        longitude={node.lng}
        latitude={node.lat}
        anchor="center"
        offset={[0, sizePx / 2 + 10] as [number, number]}
      >
        <span
          style={{
            padding: "0px 4px",
            fontSize: 20,
            fontWeight: 600,
            color: "#ffffff",
            textShadow: "0 0 2px #000, 0 0 4px #000",
            pointerEvents: "none",
            userSelect: "none",
          }}
          aria-hidden
        >
          {node.id}
        </span>
      </Marker>
    </React.Fragment>
  );
});

export default function Home() {
  const [sections, setSections] = useState<SectionData[]>([]);
  const [activeSectionKeys, setActiveSectionKeys] = useState<string[] | null>(
    null
  );
  const mapRef = React.useRef<MapRef>(null);
  // Arrow offset distance fixed at 30km
  const arrowOffsetKm = 30;
  // Developer tools mode
  const [devToolsEnabled, setDevToolsEnabled] = useState(false);
  // Pin placement mode and pins array
  const [pinMode, setPinMode] = useState(false);
  const [pins, setPins] = useState<
    Array<{ id: string; lat: number; lng: number; num: number }>
  >([]);
  // Edit mode (independent of pin mode)
  const [editMode, setEditMode] = useState(false);
  // Sub-map selection: maps seaCode -> selected submap id (null = default edges)
  const [selectedSubmaps, setSelectedSubmaps] = useState<Record<string, string | null>>({});
  // Per-submap node visibility: maps seaCode -> Set of visible submap IDs
  // undefined entry = all submaps visible (default)
  const [visibleSubmapNodes, setVisibleSubmapNodes] = useState<Record<string, Set<string>>>({});
  // Sea manager dialog state
  const [seaManagerOpen, setSeaManagerOpen] = useState(false);
  const [fullMapsData, setFullMapsData] = useState<MapsData | null>(null);
  // Node edit dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editDialogMode, setEditDialogMode] = useState<"add" | "edit">("add");
  const [pendingCoord, setPendingCoord] = useState<{ lat: number; lng: number } | null>(null);
  const [editingNode, setEditingNode] = useState<{ node: MapNode; seaCode: string; submapId?: string } | null>(null);
  const [allSeas, setAllSeas] = useState<Array<{ code: string; name: string }>>([]);
  // Edge editing state
  const [edgeFrom, setEdgeFrom] = useState("");
  const [edgeTo, setEdgeTo] = useState("");
  const [edgeArrow, setEdgeArrow] = useState(false);
  // Feature 1: Persisted map view state (read once before mount)
  const initialViewState = useMemo(() => {
    if (typeof window === "undefined") {
      return { longitude: 139.7, latitude: 35.25, zoom: 11 };
    }
    try {
      const raw = localStorage.getItem("kc-map-view");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (
          typeof parsed.longitude === "number" &&
          typeof parsed.latitude === "number" &&
          typeof parsed.zoom === "number"
        ) {
          return parsed;
        }
      }
    } catch {
      // Ignore parse errors
    }
    return { longitude: 139.7, latitude: 35.25, zoom: 11 };
  }, []);
  // Feature 3: Cursor coordinate tooltip
  const [cursorCoord, setCursorCoord] = useState<{
    lat: number;
    lng: number;
    x: number;
    y: number;
  } | null>(null);

  // Feature 1: Callback to persist view state on map move end
  const handleMoveEnd = useCallback(
    (e: { viewState: { longitude: number; latitude: number; zoom: number } }) => {
      const { longitude, latitude, zoom } = e.viewState;
      try {
        localStorage.setItem(
          "kc-map-view",
          JSON.stringify({ longitude, latitude, zoom })
        );
      } catch {
        // Ignore storage errors
      }
    },
    []
  );

  // Map style URL (MapTiler key managed via env variable). Falls back to demo tiles when key is not set.
  const MAPTILER_KEY = process.env.NEXT_PUBLIC_MAPTILER_KEY;
  const isProd = process.env.NODE_ENV === "production";
  const mapStyleUrl = useMemo(() => {
    if (!MAPTILER_KEY) {
      if (isProd) {
        console.error(
          "NEXT_PUBLIC_MAPTILER_KEY is not set. Please configure it in Vercel environment variables."
        );
      } else {
        console.warn(
          "NEXT_PUBLIC_MAPTILER_KEY not set. Falling back to demo style."
        );
      }
      return "https://demotiles.maplibre.org/style.json";
    }
    return `https://api.maptiler.com/maps/streets/style.json?key=${MAPTILER_KEY}`;
  }, [MAPTILER_KEY, isProd]);

  // Helper to load/reload map data from maps.json
  const loadMapData = useCallback(() => {
    fetch(`/api/maps?t=${Date.now()}`)
      .then((res) => res.json())
      .then((data: MapsData) => {
        const arr: SectionData[] = [];
        const seas: Array<{ code: string; name: string }> = [];
        for (const group of data.groups) {
          for (const sea of group.seas) {
            arr.push({
              key: sea.code,
              nodes: sea.nodes,
              edges: sea.edges,
              submaps: sea.submaps?.map((sm) => ({
                id: sm.id,
                name: sm.name,
                nodes: sm.nodes,
                edges: sm.edges,
              })),
            });
            seas.push({ code: sea.code, name: sea.name });
          }
        }
        setSections(arr);
        setAllSeas(seas);
        setFullMapsData(data);
      })
      .catch((err) => console.error("maps data loading failed", err));
  }, []);

  // 1. Load map data from merged maps.json
  useEffect(() => {
    loadMapData();
  }, [loadMapData]);

  // Listen for sea selection events from the header
  useEffect(() => {
    const handler = (e: Event) => {
      const ce = e as CustomEvent<string[]>;
      setActiveSectionKeys(ce.detail ?? []);
    };
    window.addEventListener("kc:set-active-sections", handler as EventListener);
    return () =>
      window.removeEventListener(
        "kc:set-active-sections",
        handler as EventListener
      );
  }, []);

  // Listen for pin mode toggle events from the header
  useEffect(() => {
    const handler = (e: Event) => {
      const ce = e as CustomEvent<boolean>;
      setPinMode(!!ce.detail);
    };
    window.addEventListener("kc:set-pin-mode", handler as EventListener);
    return () =>
      window.removeEventListener("kc:set-pin-mode", handler as EventListener);
  }, []);

  // Initialize devToolsEnabled from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem("kc-dev-tools");
      if (stored === "1") {
        setDevToolsEnabled(true);
      }
    } catch {
      // Ignore storage errors
    }
  }, []);

  // Listen for dev tools toggle events from the header
  useEffect(() => {
    const handler = (e: Event) => {
      const ce = e as CustomEvent<boolean>;
      const enabled = !!ce.detail;
      setDevToolsEnabled(enabled);
      if (!enabled) {
        setEditMode(false);
        setPinMode(false);
      }
    };
    window.addEventListener("kc:set-dev-tools", handler as EventListener);
    return () =>
      window.removeEventListener("kc:set-dev-tools", handler as EventListener);
  }, []);

  // Listen for submap visibility events from the header sea selector
  useEffect(() => {
    const handler = (e: Event) => {
      const { seaCode, visibleSubmapIds } = (
        e as CustomEvent<{ seaCode: string; visibleSubmapIds: string[] }>
      ).detail;
      setVisibleSubmapNodes((prev) => ({
        ...prev,
        [seaCode]: new Set(visibleSubmapIds),
      }));
    };
    window.addEventListener(
      "kc:set-submap-visibility",
      handler as EventListener
    );
    return () =>
      window.removeEventListener(
        "kc:set-submap-visibility",
        handler as EventListener
      );
  }, []);

  const filteredSections = useMemo(() => {
    if (!activeSectionKeys) return sections; // Initially show all
    if (activeSectionKeys.length === 0) return [];
    return sections.filter((s) => activeSectionKeys.includes(s.key));
  }, [sections, activeSectionKeys]);

  // Resolve edges and nodes based on submap selection and node visibility.
  // Node visibility is controlled by visibleSubmapNodes (independent of edge selection).
  // Edge set is controlled by selectedSubmaps.
  const visibleSections = useMemo(() => {
    return filteredSections.map((s) => {
      // Collect node IDs that belong to ANY submap
      const submapNodeIds = new Set<string>();
      if (s.submaps) {
        for (const sm of s.submaps) {
          for (const n of sm.nodes ?? []) {
            submapNodeIds.add(n.id);
          }
        }
      }
      // Base nodes = nodes in sea.nodes that are NOT in any submap (always visible)
      const baseNodes = s.nodes.filter((n) => !submapNodeIds.has(n.id));

      // Add nodes from visible submaps (deduplicated by node ID)
      const nodeVisibility = visibleSubmapNodes[s.key]; // undefined = all visible
      const seenNodeIds = new Set<string>(baseNodes.map((n) => n.id));
      const submapNodes: typeof s.nodes = [];
      if (s.submaps) {
        for (const sm of s.submaps) {
          const isVisible = !nodeVisibility || nodeVisibility.has(sm.id);
          if (isVisible) {
            for (const n of sm.nodes ?? []) {
              if (!seenNodeIds.has(n.id)) {
                seenNodeIds.add(n.id);
                submapNodes.push(n);
              }
            }
          }
        }
      }
      const mergedNodes = [...baseNodes, ...submapNodes];

      // Edge set: controlled by selectedSubmaps (unchanged)
      const submapId = selectedSubmaps[s.key];
      let edges = s.edges;
      if (submapId && s.submaps) {
        const submap = s.submaps.find((sm) => sm.id === submapId);
        if (submap) edges = submap.edges;
      }

      return { ...s, nodes: mergedNodes, edges };
    });
  }, [filteredSections, selectedSubmaps, visibleSubmapNodes]);

  // All nodes (for Marker rendering)
  const allNodes = useMemo(
    () =>
      visibleSections.flatMap((s) =>
        s.nodes.filter((n) => ALLOWED_NODE_TYPES.has(n.type))
      ),
    [visibleSections]
  );

  // Convert edges to GeoJSON (LineString FeatureCollection per section)
  const edgeCollections = useMemo(() => {
    return visibleSections.map((s) => {
      const idx: Record<string, [number, number]> = {};
      for (const n of s.nodes) idx[n.id] = [n.lng, n.lat];
      const features: Feature<
        LineString,
        { from: string; to: string; arrow: boolean; section: string }
      >[] = [];
      for (const e of s.edges) {
        const from = idx[e.from];
        const to = idx[e.to];
        if (!from || !to) continue;
        // Normalize to-longitude so the shorter antimeridian path is used
        const diff = to[0] - from[0];
        const toLngNorm =
          diff > 180 ? to[0] - 360 : diff < -180 ? to[0] + 360 : to[0];
        features.push({
          type: "Feature",
          properties: {
            from: e.from,
            to: e.to,
            arrow: !!e.arrow,
            section: s.key,
          },
          geometry: {
            type: "LineString",
            coordinates: [from, [toLngNorm, to[1]]],
          },
        });
      }
      const fc: FeatureCollection<
        LineString,
        { from: string; to: string; arrow: boolean; section: string }
      > = { type: "FeatureCollection", features };
      return {
        key: s.key,
        fc,
      } as const;
    });
  }, [visibleSections]);

  // Arrow GeoJSON (point at start of line for directional arrows)
  const arrowCollections = useMemo(() => {
    return visibleSections.map((s) => {
      const idx: Record<string, [number, number]> = {};
      for (const n of s.nodes) idx[n.id] = [n.lng, n.lat];
      const features: Feature<
        Point,
        { rotation: number; from: string; to: string; section: string }
      >[] = [];
      for (const e of s.edges) {
        if (!e.arrow) continue;
        const from = idx[e.from];
        const to = idx[e.to];
        if (!from || !to) continue;
        const [fromLng, fromLat] = from;
        // Normalize to-longitude so bearing calculation uses shorter antimeridian path
        const lngDiff = to[0] - fromLng;
        const toLngNorm =
          lngDiff > 180 ? to[0] - 360 : lngDiff < -180 ? to[0] + 360 : to[0];
        const [toLng, toLat] = [toLngNorm, to[1]];
        const start = point([fromLng, fromLat]);
        const end = point([toLng, toLat]);
        const deg = turfBearing(start, end);
        // Offset backward from end point (place arrow near destination)
        // Cap offset to 40% of segment length so arrow stays within the edge
        const segmentKm = haversineKm([fromLng, fromLat], [toLng, toLat]);
        const clampedOffsetKm = Math.min(arrowOffsetKm, segmentKm * 0.4);
        const reverseDeg = (deg + 180) % 360;
        const fwd = destination(end, clampedOffsetKm, reverseDeg, {
          units: "kilometers",
        });
        const fwdCoord = fwd?.geometry?.coordinates ?? from;
        features.push({
          type: "Feature",
          properties: {
            rotation: deg,
            from: e.from,
            to: e.to,
            section: s.key,
          },
          geometry: { type: "Point", coordinates: fwdCoord },
        });
      }
      const fc: FeatureCollection<
        Point,
        { rotation: number; from: string; to: string; section: string }
      > = { type: "FeatureCollection", features };
      return {
        key: s.key,
        fc,
      } as const;
    });
  }, [visibleSections]);

  // Find which sea (and optionally submap) a node belongs to.
  // Returns { seaCode, submapId? } or undefined if not found.
  const findSeaForNode = useCallback(
    (nodeId: string, lat: number, lng: number): { seaCode: string; submapId?: string } | undefined => {
      for (const s of filteredSections) {
        // Check submap nodes first (more specific)
        if (s.submaps) {
          for (const sm of s.submaps) {
            const found = (sm.nodes ?? []).find(
              (n) => n.id === nodeId && n.lat === lat && n.lng === lng,
            );
            if (found) return { seaCode: s.key, submapId: sm.id };
          }
        }
        // Check base sea nodes
        const found = s.nodes.find(
          (n) => n.id === nodeId && n.lat === lat && n.lng === lng,
        );
        if (found) return { seaCode: s.key };
      }
      return undefined;
    },
    [filteredSections],
  );

  // Find all submap memberships of a node within a given sea.
  // Returns array of submap IDs that contain the node.
  const findNodeSubmapMemberships = useCallback(
    (seaCode: string, nodeId: string): string[] => {
      const section = filteredSections.find((s) => s.key === seaCode);
      if (!section || !section.submaps) return [];
      const result: string[] = [];
      for (const sm of section.submaps) {
        if ((sm.nodes ?? []).some((n) => n.id === nodeId)) {
          result.push(sm.id);
        }
      }
      return result;
    },
    [filteredSections],
  );

  // Determine the current active sea (for edge editing and submap selection)
  // Uses filteredSections (not visibleSections) to preserve original submap data
  const singleActiveSea = useMemo(() => {
    if (filteredSections.length === 1) return filteredSections[0];
    return null;
  }, [filteredSections]);

  // Resolved edges for the single active sea (respects submap selection)
  const activeSeaEdges = useMemo(() => {
    if (!singleActiveSea) return [];
    const submapId = selectedSubmaps[singleActiveSea.key];
    if (submapId && singleActiveSea.submaps) {
      const submap = singleActiveSea.submaps.find((sm) => sm.id === submapId);
      if (submap) return submap.edges;
    }
    return singleActiveSea.edges;
  }, [singleActiveSea, selectedSubmaps]);

  // All edges grouped by identity (from+to), with the set of submap memberships
  const activeSeaEdgesWithSubmap = useMemo((): Array<{ edge: MapEdge; submapIds: Set<string | undefined> }> => {
    if (!singleActiveSea) return [];
    const edgeMap: Record<string, { edge: MapEdge; submapIds: Set<string | undefined> }> = {};

    const edgeKey = (e: MapEdge) => `${e.from}\u2192${e.to}`;

    for (const e of singleActiveSea.edges) {
      const k = edgeKey(e);
      if (!edgeMap[k]) edgeMap[k] = { edge: e, submapIds: new Set() };
      edgeMap[k].submapIds.add(undefined); // base
    }
    for (const sm of singleActiveSea.submaps ?? []) {
      for (const e of sm.edges) {
        const k = edgeKey(e);
        if (!edgeMap[k]) edgeMap[k] = { edge: e, submapIds: new Set() };
        edgeMap[k].submapIds.add(sm.id);
      }
    }
    return Object.values(edgeMap);
  }, [singleActiveSea]);

  // Toggle submap node visibility for a given sea
  const toggleSubmapNodeVisibility = useCallback(
    (seaKey: string, submapId: string) => {
      setVisibleSubmapNodes((prev) => {
        // On first toggle, initialize with all submap IDs (all visible), then toggle
        const allSubmapIds =
          singleActiveSea?.submaps?.map((sm) => sm.id) ?? [];
        const current = prev[seaKey] ?? new Set(allSubmapIds);
        const next = new Set(current);
        if (next.has(submapId)) next.delete(submapId);
        else next.add(submapId);
        return { ...prev, [seaKey]: next };
      });
    },
    [singleActiveSea],
  );

  // Open dialog to add a node at clicked coordinates
  const openAddNodeDialog = useCallback((lat: number, lng: number) => {
    setPendingCoord({ lat, lng });
    setEditingNode(null);
    setEditDialogMode("add");
    setEditDialogOpen(true);
  }, []);

  // Open dialog to edit an existing node
  const openEditNodeDialog = useCallback((node: MapNode, seaCode: string, submapId?: string) => {
    setEditingNode({ node, seaCode, submapId });
    setPendingCoord(null);
    setEditDialogMode("edit");
    setEditDialogOpen(true);
  }, []);

  // Callback passed to NodeMarker — looks up sea code (and submap) and opens edit dialog
  const handleNodeClick = useCallback(
    (node: MapNode) => {
      const result = findSeaForNode(node.id, node.lat, node.lng);
      if (result) {
        openEditNodeDialog(node, result.seaCode, result.submapId);
      }
    },
    [findSeaForNode, openEditNodeDialog],
  );

  // Handle node add/update from dialog
  const handleNodeConfirm = useCallback(
    async (seaCode: string, node: MapNode, submapIds: string[]) => {
      try {
        if (editDialogMode === "add") {
          if (submapIds.length === 0) {
            // Add to base only
            const res = await fetch("/api/maps", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ target: "nodes", seaCode, node }),
            });
            if (!res.ok) {
              const err = await res.json();
              toast.error(err.error ?? "Failed to add node");
              return;
            }
          } else {
            // Add to each selected submap
            for (const smId of submapIds) {
              const res = await fetch("/api/maps", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ target: "nodes", seaCode, node, submapId: smId }),
              });
              if (!res.ok) {
                const err = await res.json();
                toast.error(err.error ?? `Failed to add node to submap ${smId}`);
                return;
              }
            }
          }
          toast.success(`Node "${node.id}" added to ${seaCode}${submapIds.length > 0 ? ` (${submapIds.length} submap(s))` : ""}`);
        } else {
          const originalId = editingNode?.node.id ?? node.id;
          const currentSubmapIds = findNodeSubmapMemberships(seaCode, originalId);
          const currentSet = new Set(currentSubmapIds);
          const newSet = new Set(submapIds);

          // Determine the node's primary location for updating fields
          // (first current submap, or base if in no submap)
          const primarySubmapId = currentSubmapIds.length > 0 ? currentSubmapIds[0] : undefined;

          // Update node fields via PUT at primary location
          const res = await fetch("/api/maps", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              seaCode,
              nodeId: originalId,
              submapId: primarySubmapId,
              updates: {
                id: node.id,
                type: node.type,
                name: node.name,
                lat: node.lat,
                lng: node.lng,
                meta: node.meta,
              },
            }),
          });
          if (!res.ok) {
            const err = await res.json();
            toast.error(err.error ?? "Failed to update node");
            return;
          }

          // Also update fields in other submaps where the node exists
          for (const smId of currentSubmapIds.slice(1)) {
            if (newSet.has(smId)) {
              await fetch("/api/maps", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  seaCode,
                  nodeId: originalId,
                  submapId: smId,
                  updates: {
                    id: node.id,
                    type: node.type,
                    name: node.name,
                    lat: node.lat,
                    lng: node.lng,
                    meta: node.meta,
                  },
                }),
              });
            }
          }

          // Reconcile memberships: add to new submaps
          const toAdd = submapIds.filter((id) => !currentSet.has(id));
          for (const smId of toAdd) {
            await fetch("/api/maps", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ target: "nodes", seaCode, node, submapId: smId }),
            });
          }

          // Reconcile memberships: remove from old submaps
          const toRemove = currentSubmapIds.filter((id) => !newSet.has(id));
          for (const smId of toRemove) {
            await fetch("/api/maps", {
              method: "DELETE",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ target: "nodes", seaCode, nodeId: originalId, submapId: smId }),
            });
          }

          toast.success(`Node "${node.id}" updated`);
        }
        setEditDialogOpen(false);
        loadMapData();
      } catch {
        toast.error("Network error");
      }
    },
    [editDialogMode, editingNode, findNodeSubmapMemberships, loadMapData],
  );

  // Handle node delete from dialog
  const handleNodeDelete = useCallback(
    async (seaCode: string, nodeId: string, submapIds: string[]) => {
      try {
        if (submapIds.length === 0) {
          // Delete from base
          const res = await fetch("/api/maps", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ target: "nodes", seaCode, nodeId }),
          });
          if (!res.ok) {
            const err = await res.json();
            toast.error(err.error ?? "Failed to delete node");
            return;
          }
        } else {
          // Delete from each submap the node belongs to
          for (const smId of submapIds) {
            const res = await fetch("/api/maps", {
              method: "DELETE",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ target: "nodes", seaCode, nodeId, submapId: smId }),
            });
            if (!res.ok) {
              const err = await res.json();
              toast.error(err.error ?? `Failed to delete node from submap ${smId}`);
              return;
            }
          }
        }
        toast.success(`Node "${nodeId}" deleted from ${seaCode}`);
        setEditDialogOpen(false);
        loadMapData();
      } catch {
        toast.error("Network error");
      }
    },
    [loadMapData],
  );

  // Handle edge add (supports submap targeting)
  const handleAddEdge = useCallback(async () => {
    if (!singleActiveSea || !edgeFrom || !edgeTo || edgeFrom === edgeTo) return;
    const submapId = selectedSubmaps[singleActiveSea.key] ?? undefined;
    try {
      const res = await fetch("/api/maps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target: "edges",
          seaCode: singleActiveSea.key,
          edge: { from: edgeFrom, to: edgeTo, arrow: edgeArrow },
          submapId,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error ?? "Failed to add edge");
        return;
      }
      toast.success(`Edge ${edgeFrom} -> ${edgeTo} added`);
      setEdgeFrom("");
      setEdgeTo("");
      setEdgeArrow(false);
      loadMapData();
    } catch {
      toast.error("Network error");
    }
  }, [singleActiveSea, edgeFrom, edgeTo, edgeArrow, selectedSubmaps, loadMapData]);

  // Handle edge delete (supports submap targeting)
  const handleDeleteEdge = useCallback(
    async (from: string, to: string, edgeSubmapId?: string) => {
      if (!singleActiveSea) return;
      const submapId = edgeSubmapId !== undefined ? edgeSubmapId : (selectedSubmaps[singleActiveSea.key] ?? undefined);
      try {
        const res = await fetch("/api/maps", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            target: "edges",
            seaCode: singleActiveSea.key,
            from,
            to,
            submapId,
          }),
        });
        if (!res.ok) {
          const err = await res.json();
          toast.error(err.error ?? "Failed to delete edge");
          return;
        }
        toast.success(`Edge ${from} -> ${to} deleted`);
        loadMapData();
      } catch {
        toast.error("Network error");
      }
    },
    [singleActiveSea, selectedSubmaps, loadMapData],
  );

  // Handle edge submap membership toggle (add or remove from a submap)
  const handleEdgeSubmapToggle = useCallback(
    async (from: string, to: string, submapId: string | undefined, checked: boolean, arrow?: boolean) => {
      if (!singleActiveSea) return;
      try {
        if (checked) {
          // Add edge to this submap/base
          const res = await fetch("/api/maps", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              target: "edges",
              seaCode: singleActiveSea.key,
              edge: { from, to, arrow: arrow ?? false },
              submapId,
            }),
          });
          if (!res.ok) {
            const err = await res.json();
            toast.error(err.error ?? "Failed to add edge to submap");
            return;
          }
          toast.success(`Edge ${from} -> ${to} added to ${submapId ?? "base"}`);
        } else {
          // Remove edge from this submap/base
          const res = await fetch("/api/maps", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              target: "edges",
              seaCode: singleActiveSea.key,
              from,
              to,
              submapId,
            }),
          });
          if (!res.ok) {
            const err = await res.json();
            toast.error(err.error ?? "Failed to remove edge from submap");
            return;
          }
          toast.success(`Edge ${from} -> ${to} removed from ${submapId ?? "base"}`);
        }
        loadMapData();
      } catch {
        toast.error("Network error");
      }
    },
    [singleActiveSea, loadMapData],
  );

  // Memoized sorted node list for edge dropdown selects.
  // Includes ALL nodes (base + all submaps) so cross-submap edge creation is possible.
  const sortedSeaNodes = useMemo(() => {
    if (!singleActiveSea) return [];
    const seen: Record<string, Node> = {};
    for (const n of singleActiveSea.nodes) {
      seen[n.id] = n;
    }
    if (singleActiveSea.submaps) {
      for (const sm of singleActiveSea.submaps) {
        for (const n of sm.nodes ?? []) {
          seen[n.id] = n;
        }
      }
    }
    return Object.values(seen).sort((a, b) => a.id.localeCompare(b.id));
  }, [singleActiveSea]);

  // Map onLoad handler — registers the arrow icon image
  const handleMapLoad = useCallback(() => {
    const map = mapRef.current?.getMap();
    if (map && !map.hasImage("arrow-icon")) {
      const img = new window.Image();
      img.crossOrigin = "anonymous";
      img.src = "/img/nodes/arrow.png";
      img.onload = () => {
        try {
          if (!map.hasImage("arrow-icon")) {
            map.addImage("arrow-icon", img);
          }
        } catch (err) {
          console.error("Failed to register arrow image", err);
        }
      };
      img.onerror = (err: Event | string) => {
        console.error("Failed to load arrow image", err);
      };
    }
  }, []);

  // Map onMouseMove handler — updates cursor coordinate tooltip in pin mode
  const handleMouseMove = useCallback(
    (e: MapLayerMouseEvent) => {
      if (pinMode) {
        setCursorCoord({
          lat: e.lngLat.lat,
          lng: e.lngLat.lng,
          x: e.point.x,
          y: e.point.y,
        });
      }
    },
    [pinMode],
  );

  // Map onClick handler — places pins or logs coordinates
  const handleMapClick = useCallback(
    (e: MapLayerMouseEvent) => {
      const { lng, lat } = e.lngLat;
      if (pinMode) {
        const id = `pin-${Date.now()}`;
        setPins((prev) => [
          ...prev,
          { id, lat, lng, num: prev.length + 1 },
        ]);
        // Also open the node add dialog
        openAddNodeDialog(lat, lng);
      } else {
        console.log(
          `{ "id": "NEW", "type": "normal", "lat": ${lat}, "lng": ${lng} },`,
        );
      }
    },
    [pinMode, openAddNodeDialog],
  );

  return (
    <main
      style={{
        width: "100vw",
        height: "calc(100vh - 3rem)",
        marginTop: "3rem",
      }}
    >
      <Map
        ref={mapRef}
        onLoad={handleMapLoad}
        initialViewState={initialViewState}
        onMoveEnd={handleMoveEnd}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => {
          setCursorCoord(null);
        }}
        mapStyle={mapStyleUrl}
        style={{ width: "100%", height: "100%" }}
        onClick={handleMapClick}
      >
        {/* 2. Render markers based on loaded data */}
        {allNodes.map((node) => (
          <NodeMarker
            key={`${node.id}-${node.lng}-${node.lat}`}
            node={node}
            onClickNode={handleNodeClick}
          />
        ))}
        {/* 3. Draw lines and arrows per section */}
        {edgeCollections.map(({ key, fc }) => (
          <Source
            key={`edges-${key}`}
            id={`edges-${key}`}
            type="geojson"
            data={fc}
          >
            <Layer
              id={`edges-line-${key}`}
              type="line"
              source={`edges-${key}`}
              paint={{
                "line-color": "#ffffff",
                "line-width": 3,
                "line-opacity": 1.0,
                "line-dasharray": [2, 2],
              }}
              layout={{
                "line-join": "round",
                "line-cap": "round",
              }}
            />
          </Source>
        ))}

        {arrowCollections.map(({ key, fc }) => (
          <Source
            key={`arrows-${key}`}
            id={`arrows-${key}`}
            type="geojson"
            data={fc}
          >
            <Layer
              id={`arrows-symbol-${key}`}
              type="symbol"
              source={`arrows-${key}`}
              layout={{
                "symbol-placement": "point",
                "icon-image": "arrow-icon",
                "icon-size": 0.05,
                "icon-rotation-alignment": "map",
                "icon-rotate": rotateExpression,
                "icon-allow-overlap": true,
                "icon-anchor": "center",
              }}
            />
          </Source>
        ))}

        {/* Render pins placed by clicks */}
        {pins.map((p) => (
          <Marker key={p.id} longitude={p.lng} latitude={p.lat} anchor="center">
            <div
              title={`#${p.num} lat: ${p.lat.toFixed(6)}, lng: ${p.lng.toFixed(6)}`}
              onClick={(e) => {
                e.stopPropagation();
                setPins((prev) => prev.filter((pin) => pin.id !== p.id));
              }}
              style={{
                width: 24,
                height: 24,
                background: "#ef4444",
                borderRadius: "50%",
                border: "2px solid white",
                boxShadow: "0 0 6px rgba(0,0,0,0.5)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 11,
                fontWeight: 700,
                color: "#fff",
                lineHeight: 1,
                userSelect: "none",
              }}
            >
              {p.num}
            </div>
          </Marker>
        ))}
      </Map>

      {/* Cursor coordinate tooltip when pin mode is ON */}
      {pinMode && cursorCoord !== null && (
        <Paper
          elevation={0}
          sx={{
            position: "fixed",
            left: cursorCoord.x + 12,
            top: cursorCoord.y + 48 + 12,
            zIndex: 70,
            backgroundColor: "rgba(0,0,0,0.75)",
            color: "#fff",
            px: 1,
            py: 0.5,
            borderRadius: 1,
            fontSize: 12,
            pointerEvents: "none",
            whiteSpace: "nowrap",
          }}
        >
          lat: {cursorCoord.lat.toFixed(6)}, lng: {cursorCoord.lng.toFixed(6)}
        </Paper>
      )}

      {/* Floating panel (bottom-right): visible when devTools enabled OR submaps available */}
      {(devToolsEnabled || (singleActiveSea && singleActiveSea.submaps && singleActiveSea.submaps.length > 0)) && (
      <Paper
        elevation={4}
        sx={{
          position: "fixed",
          right: 12,
          bottom: 12,
          zIndex: 60,
          backgroundColor: pinMode ? "rgba(239, 68, 68, 0.7)" : "rgba(0,0,0,0.85)",
          border: pinMode
            ? "1px solid rgba(239, 68, 68, 1)"
            : "1px solid transparent",
          color: "#fff",
          borderRadius: 2,
          fontSize: 13,
          userSelect: "none",
          minWidth: 220,
        }}
      >
        {/* Header: mode toggles (only visible when developer tools are enabled) */}
        {devToolsEnabled && (
          <Box
            sx={{
              px: 1.25,
              py: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 1,
              borderBottom:
                (pinMode && pins.length > 0) || (editMode && singleActiveSea)
                  ? "1px solid rgba(255,255,255,0.2)"
                  : "none",
            }}
          >
            {/* Pin mode toggle */}
            <Typography
              component="span"
              variant="body2"
              onClick={() => setPinMode((prev) => !prev)}
              sx={{ cursor: "pointer", flex: 1, fontSize: 13 }}
            >
              {pinMode ? "Pin: ON" : "Pin: OFF"}
              {pinMode && pins.length > 0 && (
                <Typography component="span" sx={{ fontSize: 11, opacity: 0.8, ml: 0.5 }}>
                  {pins.length}
                </Typography>
              )}
            </Typography>

            {/* Edit mode toggle */}
            <Button
              size="small"
              variant="contained"
              onClick={() => setEditMode((prev) => !prev)}
              title={editMode ? "Edit mode: ON" : "Edit mode: OFF"}
              startIcon={<Pencil size={12} />}
              sx={{
                backgroundColor: editMode ? "#3b82f6" : "#4b5563",
                "&:hover": { backgroundColor: editMode ? "#2563eb" : "#6b7280" },
                fontSize: 11,
                fontWeight: 600,
                minWidth: 0,
                px: 0.75,
                py: 0.5,
                textTransform: "none",
              }}
            >
              {editMode ? "ON" : "OFF"}
            </Button>

            {/* Sea manager button */}
            <IconButton
              size="small"
              onClick={() => setSeaManagerOpen(true)}
              title="Sea area management"
              sx={{
                backgroundColor: "#4b5563",
                color: "#fff",
                borderRadius: 1,
                "&:hover": { backgroundColor: "#6b7280" },
                p: 0.75,
              }}
            >
              <MapIcon size={12} />
            </IconButton>
          </Box>
        )}

        {/* Pin list + action buttons */}
        {pinMode && pins.length > 0 && (
          <Box sx={{ px: 1.25, pt: 0.5, pb: 1 }}>
            {/* Scrollable pin list */}
            <Box sx={{ maxHeight: 180, overflowY: "auto", mb: 0.75 }}>
              {pins.map((p) => (
                <Box
                  key={p.id}
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 0.75,
                    fontSize: 12,
                    py: 0.25,
                    fontFamily: "monospace",
                  }}
                >
                  <Box
                    component="span"
                    sx={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: 18,
                      height: 18,
                      backgroundColor: "#ef4444",
                      borderRadius: "50%",
                      fontSize: 10,
                      fontWeight: 700,
                      flexShrink: 0,
                    }}
                  >
                    {p.num}
                  </Box>
                  <Typography component="span" sx={{ fontSize: 12, fontFamily: "monospace" }}>
                    {p.lat.toFixed(6)}, {p.lng.toFixed(6)}
                  </Typography>
                </Box>
              ))}
            </Box>

            {/* Action buttons */}
            <Box sx={{ display: "flex", gap: 0.75 }}>
              <Button
                variant="contained"
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  const text = pins
                    .map(
                      (p) =>
                        `{ "lat": ${p.lat.toFixed(6)}, "lng": ${p.lng.toFixed(
                          6,
                        )} },`,
                    )
                    .join("\n");
                  navigator.clipboard?.writeText(text).catch(() => {});
                }}
                sx={{
                  backgroundColor: "#22c55e",
                  color: "#000",
                  fontWeight: 600,
                  fontSize: 12,
                  flex: 1,
                  textTransform: "none",
                  "&:hover": { backgroundColor: "#16a34a" },
                }}
              >
                Copy All
              </Button>
              <Button
                variant="contained"
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  setPins([]);
                }}
                sx={{
                  backgroundColor: "#6b7280",
                  color: "#fff",
                  fontWeight: 600,
                  fontSize: 12,
                  flex: 1,
                  textTransform: "none",
                  "&:hover": { backgroundColor: "#9ca3af" },
                }}
              >
                Clear
              </Button>
            </Box>
          </Box>
        )}

        {/* Sub-map selector (visible when a single sea with submaps is active) */}
        {singleActiveSea && singleActiveSea.submaps && singleActiveSea.submaps.length > 0 && (
          <Box sx={{ px: 1.25, py: 0.75, borderTop: "1px solid rgba(255,255,255,0.2)" }}>
            <Typography sx={{ fontSize: 11, fontWeight: 700, mb: 0.5, opacity: 0.8 }}>
              Sub-map ({singleActiveSea.key})
            </Typography>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
              {/* Default (base edges) button */}
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                <Button
                  size="small"
                  variant={!selectedSubmaps[singleActiveSea.key] ? "contained" : "outlined"}
                  onClick={() =>
                    setSelectedSubmaps((prev) => ({ ...prev, [singleActiveSea.key]: null }))
                  }
                  sx={{
                    backgroundColor: !selectedSubmaps[singleActiveSea.key] ? "#3b82f6" : "#374151",
                    color: "#fff",
                    borderColor: !selectedSubmaps[singleActiveSea.key] ? "#3b82f6" : "#6b7280",
                    fontSize: 11,
                    fontWeight: 600,
                    px: 1,
                    py: 0.25,
                    minWidth: 0,
                    textTransform: "none",
                    "&:hover": {
                      backgroundColor: !selectedSubmaps[singleActiveSea.key] ? "#2563eb" : "#4b5563",
                      borderColor: !selectedSubmaps[singleActiveSea.key] ? "#3b82f6" : "#6b7280",
                    },
                  }}
                >
                  Base
                </Button>
              </Box>
              {singleActiveSea.submaps.map((sm) => {
                const nodeVisibility = visibleSubmapNodes[singleActiveSea.key];
                const isNodeVisible = !nodeVisibility || nodeVisibility.has(sm.id);
                return (
                  <Box key={sm.id} sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                    <MuiCheckbox
                      checked={isNodeVisible}
                      onChange={() => toggleSubmapNodeVisibility(singleActiveSea.key, sm.id)}
                      size="small"
                      title={`${sm.name} ノード表示`}
                      sx={{
                        p: 0,
                        color: "#6b7280",
                        "&.Mui-checked": { color: "#90caf9" },
                        "& .MuiSvgIcon-root": { fontSize: 18 },
                      }}
                    />
                    <Button
                      size="small"
                      variant={selectedSubmaps[singleActiveSea.key] === sm.id ? "contained" : "outlined"}
                      onClick={() =>
                        setSelectedSubmaps((prev) => ({
                          ...prev,
                          [singleActiveSea.key]: sm.id,
                        }))
                      }
                      sx={{
                        backgroundColor:
                          selectedSubmaps[singleActiveSea.key] === sm.id
                            ? "#3b82f6"
                            : "#374151",
                        color: "#fff",
                        borderColor:
                          selectedSubmaps[singleActiveSea.key] === sm.id
                            ? "#3b82f6"
                            : "#6b7280",
                        fontSize: 11,
                        fontWeight: 600,
                        px: 1,
                        py: 0.25,
                        minWidth: 0,
                        textTransform: "none",
                        "&:hover": {
                          backgroundColor:
                            selectedSubmaps[singleActiveSea.key] === sm.id ? "#2563eb" : "#4b5563",
                          borderColor:
                            selectedSubmaps[singleActiveSea.key] === sm.id ? "#3b82f6" : "#6b7280",
                        },
                      }}
                    >
                      {sm.name}
                    </Button>
                  </Box>
                );
              })}
            </Box>
          </Box>
        )}

        {/* Edge editing section (visible when editMode is ON and exactly one sea is active) */}
        {editMode && singleActiveSea && (
          <Box sx={{ px: 1.25, py: 1, borderTop: "1px solid rgba(255,255,255,0.2)" }}>
            <Typography sx={{ fontSize: 11, fontWeight: 700, mb: 0.75, opacity: 0.8 }}>
              Edges ({singleActiveSea.key} - all)
            </Typography>

            {/* Add edge form */}
            <Box sx={{ display: "flex", gap: 0.5, mb: 0.75, flexWrap: "wrap" }}>
              <Select
                value={edgeFrom}
                onChange={(e) => setEdgeFrom(e.target.value as string)}
                displayEmpty
                size="small"
                sx={{
                  flex: 1,
                  minWidth: 60,
                  backgroundColor: "#374151",
                  color: "#fff",
                  fontSize: 11,
                  "& .MuiSelect-select": { py: 0.25, px: 0.5 },
                  "& .MuiOutlinedInput-notchedOutline": { borderColor: "#6b7280" },
                  "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: "#9ca3af" },
                  "& .MuiSvgIcon-root": { color: "#fff", fontSize: 16 },
                }}
                MenuProps={{ slotProps: { paper: { sx: { backgroundColor: "#374151", color: "#fff" } } } }}
              >
                <MenuItem value="" sx={{ fontSize: 11 }}>From</MenuItem>
                {sortedSeaNodes.map((n) => (
                  <MenuItem key={n.id} value={n.id} sx={{ fontSize: 11 }}>
                    {n.id}
                  </MenuItem>
                ))}
              </Select>
              <Select
                value={edgeTo}
                onChange={(e) => setEdgeTo(e.target.value as string)}
                displayEmpty
                size="small"
                sx={{
                  flex: 1,
                  minWidth: 60,
                  backgroundColor: "#374151",
                  color: "#fff",
                  fontSize: 11,
                  "& .MuiSelect-select": { py: 0.25, px: 0.5 },
                  "& .MuiOutlinedInput-notchedOutline": { borderColor: "#6b7280" },
                  "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: "#9ca3af" },
                  "& .MuiSvgIcon-root": { color: "#fff", fontSize: 16 },
                }}
                MenuProps={{ slotProps: { paper: { sx: { backgroundColor: "#374151", color: "#fff" } } } }}
              >
                <MenuItem value="" sx={{ fontSize: 11 }}>To</MenuItem>
                {sortedSeaNodes.map((n) => (
                  <MenuItem key={n.id} value={n.id} sx={{ fontSize: 11 }}>
                    {n.id}
                  </MenuItem>
                ))}
              </Select>
              <FormControlLabel
                control={
                  <MuiCheckbox
                    checked={edgeArrow}
                    onChange={(e) => setEdgeArrow(e.target.checked)}
                    size="small"
                    sx={{
                      p: 0,
                      color: "#6b7280",
                      "&.Mui-checked": { color: "#90caf9" },
                      "& .MuiSvgIcon-root": { fontSize: 16 },
                    }}
                  />
                }
                label={<Typography sx={{ fontSize: 11 }}>Arrow</Typography>}
                sx={{ mx: 0, gap: 0.25 }}
              />
              <Button
                variant="contained"
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  handleAddEdge();
                }}
                disabled={!edgeFrom || !edgeTo || edgeFrom === edgeTo}
                sx={{
                  backgroundColor:
                    !edgeFrom || !edgeTo || edgeFrom === edgeTo
                      ? "#4b5563"
                      : "#3b82f6",
                  color: "#fff",
                  fontWeight: 600,
                  fontSize: 11,
                  px: 1,
                  py: 0.25,
                  minWidth: 0,
                  textTransform: "none",
                  "&:hover": {
                    backgroundColor:
                      !edgeFrom || !edgeTo || edgeFrom === edgeTo
                        ? "#4b5563"
                        : "#2563eb",
                  },
                }}
              >
                Add
              </Button>
            </Box>

            {/* Current edges list (grouped by identity, with inline submap checkboxes) */}
            <Box sx={{ maxHeight: 200, overflowY: "auto" }}>
              {activeSeaEdgesWithSubmap.map(({ edge, submapIds: edgeSubmapIds }) => (
                <Box
                  key={`${edge.from}-${edge.to}`}
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 0.5,
                    fontSize: 11,
                    py: 0.375,
                    fontFamily: "monospace",
                    borderBottom: "1px solid rgba(255,255,255,0.05)",
                  }}
                >
                  <Typography component="span" sx={{ flex: "0 0 auto", minWidth: 60, fontSize: 11, fontFamily: "monospace" }}>
                    {edge.from} {edge.arrow ? "->" : "--"} {edge.to}
                  </Typography>
                  <Box component="span" sx={{ display: "flex", gap: 0.25, flexWrap: "wrap", flex: "1 1 auto" }}>
                    <Box
                      component="label"
                      sx={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 0.125,
                        fontSize: 9,
                        cursor: "pointer",
                        backgroundColor: edgeSubmapIds.has(undefined) ? "#1d4ed8" : "#374151",
                        borderRadius: 0.75,
                        px: 0.5,
                        py: 0.125,
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={edgeSubmapIds.has(undefined)}
                        onChange={(e) => {
                          e.stopPropagation();
                          handleEdgeSubmapToggle(edge.from, edge.to, undefined, e.target.checked, edge.arrow);
                        }}
                        style={{ width: 10, height: 10 }}
                      />
                      B
                    </Box>
                    {(singleActiveSea?.submaps ?? []).map((sm) => (
                      <Box
                        component="label"
                        key={sm.id}
                        sx={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 0.125,
                          fontSize: 9,
                          cursor: "pointer",
                          backgroundColor: edgeSubmapIds.has(sm.id) ? "#1d4ed8" : "#374151",
                          borderRadius: 0.75,
                          px: 0.5,
                          py: 0.125,
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={edgeSubmapIds.has(sm.id)}
                          onChange={(e) => {
                            e.stopPropagation();
                            handleEdgeSubmapToggle(edge.from, edge.to, sm.id, e.target.checked, edge.arrow);
                          }}
                          style={{ width: 10, height: 10 }}
                        />
                        {sm.name.length > 6 ? sm.name.slice(0, 6) : sm.name}
                      </Box>
                    ))}
                  </Box>
                  <IconButton
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      // Delete from all locations
                      for (const smId of edgeSubmapIds) {
                        handleDeleteEdge(edge.from, edge.to, smId === undefined ? undefined : smId);
                      }
                    }}
                    title={`Delete edge ${edge.from} -> ${edge.to} from all locations`}
                    sx={{
                      backgroundColor: "rgba(239,68,68,0.85)",
                      color: "#fff",
                      fontSize: 10,
                      fontWeight: 700,
                      borderRadius: 0.75,
                      p: 0.25,
                      lineHeight: 1.4,
                      flex: "0 0 auto",
                      "&:hover": { backgroundColor: "rgba(239,68,68,1)" },
                      width: 20,
                      height: 20,
                    }}
                  >
                    ×
                  </IconButton>
                </Box>
              ))}
              {activeSeaEdgesWithSubmap.length === 0 && (
                <Typography sx={{ fontSize: 11, opacity: 0.5 }}>No edges</Typography>
              )}
            </Box>
          </Box>
        )}
      </Paper>
      )}

      {/* Node edit dialog */}
      <NodeEditDialog
        open={editDialogOpen}
        mode={editDialogMode}
        lat={pendingCoord?.lat}
        lng={pendingCoord?.lng}
        node={editingNode?.node}
        seaCode={editingNode?.seaCode ?? singleActiveSea?.key}
        submapIds={
          editingNode
            ? findNodeSubmapMemberships(editingNode.seaCode, editingNode.node.id)
            : (singleActiveSea && selectedSubmaps[singleActiveSea.key]
              ? [selectedSubmaps[singleActiveSea.key]!]
              : [])
        }
        availableSeas={allSeas}
        availableSubmaps={singleActiveSea?.submaps}
        onConfirm={handleNodeConfirm}
        onDelete={handleNodeDelete}
        onClose={() => setEditDialogOpen(false)}
      />

      {/* Sea manager dialog */}
      <SeaManagerDialog
        open={seaManagerOpen}
        onClose={() => setSeaManagerOpen(false)}
        mapsData={fullMapsData}
        onDataChanged={loadMapData}
      />
    </main>
  );
}
