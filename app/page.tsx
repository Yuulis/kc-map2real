"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import Map, { Marker, Source, Layer, MapRef } from "react-map-gl/maplibre";
import NextImage from "next/image";
import "maplibre-gl/dist/maplibre-gl.css";
import { point } from "@turf/helpers";
import turfBearing from "@turf/bearing";
import destination from "@turf/destination";
import type { Feature, FeatureCollection, LineString, Point } from "geojson";
import type { ExpressionSpecification } from "maplibre-gl";

import { toast } from "sonner";
import { Pencil, MapIcon } from "lucide-react";
import type { MapsData, MapNode, MapEdge } from "@/app/types/maps";
import NodeEditDialog from "@/app/components/NodeEditDialog";
import SeaManagerDialog from "@/app/components/SeaManagerDialog";

// Internal view-layer types derived from MapsData
type Node = MapNode;

type Edge = MapEdge;

type SectionData = {
  key: string;
  nodes: Node[];
  edges: Edge[];
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
]);

export default function Home() {
  const [sections, setSections] = useState<SectionData[]>([]);
  const [activeSectionKeys, setActiveSectionKeys] = useState<string[] | null>(
    null
  );
  const mapRef = React.useRef<MapRef>(null);
  // Arrow offset distance fixed at 30km
  const arrowOffsetKm = 30;
  // Pin placement mode and pins array
  const [pinMode, setPinMode] = useState(false);
  const [pins, setPins] = useState<
    Array<{ id: string; lat: number; lng: number; num: number }>
  >([]);
  // Edit mode (independent of pin mode)
  const [editMode, setEditMode] = useState(false);
  // Sea manager dialog state
  const [seaManagerOpen, setSeaManagerOpen] = useState(false);
  const [fullMapsData, setFullMapsData] = useState<MapsData | null>(null);
  // Node edit dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editDialogMode, setEditDialogMode] = useState<"add" | "edit">("add");
  const [pendingCoord, setPendingCoord] = useState<{ lat: number; lng: number } | null>(null);
  const [editingNode, setEditingNode] = useState<{ node: MapNode; seaCode: string } | null>(null);
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
    fetch(`/data/maps.json?t=${Date.now()}`)
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
            });
            seas.push({ code: sea.code, name: sea.name });
          }
        }
        setSections(arr);
        setAllSeas(seas);
        setFullMapsData(data);
      })
      .catch((err) => console.error("maps.json loading failed", err));
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

  const visibleSections = useMemo(() => {
    if (!activeSectionKeys) return sections; // Initially show all
    if (activeSectionKeys.length === 0) return [];
    return sections.filter((s) => activeSectionKeys.includes(s.key));
  }, [sections, activeSectionKeys]);

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
        features.push({
          type: "Feature",
          properties: {
            from: e.from,
            to: e.to,
            arrow: !!e.arrow,
            section: s.key,
          },
          geometry: { type: "LineString", coordinates: [from, to] },
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
        const [toLng, toLat] = to;
        const start = point([fromLng, fromLat]);
        const end = point([toLng, toLat]);
        const deg = turfBearing(start, end);
        // Offset backward from end point (place arrow near destination)
        const reverseDeg = (deg + 180) % 360;
        const fwd = destination(end, arrowOffsetKm, reverseDeg, {
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

  const rotateExpression: ExpressionSpecification = ["get", "rotation"];

  // Find which sea a node belongs to
  const findSeaForNode = useCallback(
    (nodeId: string, lat: number, lng: number): string | undefined => {
      for (const s of visibleSections) {
        const found = s.nodes.find(
          (n) => n.id === nodeId && n.lat === lat && n.lng === lng,
        );
        if (found) return s.key;
      }
      return undefined;
    },
    [visibleSections],
  );

  // Determine the current active sea (for edge editing, only when exactly one sea is active)
  const singleActiveSea = useMemo(() => {
    if (visibleSections.length === 1) return visibleSections[0];
    return null;
  }, [visibleSections]);

  // Open dialog to add a node at clicked coordinates
  const openAddNodeDialog = useCallback(
    (lat: number, lng: number) => {
      setPendingCoord({ lat, lng });
      setEditingNode(null);
      setEditDialogMode("add");
      setEditDialogOpen(true);
    },
    [],
  );

  // Open dialog to edit an existing node
  const openEditNodeDialog = useCallback(
    (node: MapNode, seaCode: string) => {
      setEditingNode({ node, seaCode });
      setPendingCoord(null);
      setEditDialogMode("edit");
      setEditDialogOpen(true);
    },
    [],
  );

  // Handle node add/update from dialog
  const handleNodeConfirm = useCallback(
    async (seaCode: string, node: MapNode) => {
      try {
        if (editDialogMode === "add") {
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
          toast.success(`Node "${node.id}" added to ${seaCode}`);
        } else {
          const originalId = editingNode?.node.id ?? node.id;
          const res = await fetch("/api/maps", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              seaCode,
              nodeId: originalId,
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
          toast.success(`Node "${node.id}" updated`);
        }
        setEditDialogOpen(false);
        loadMapData();
      } catch {
        toast.error("Network error");
      }
    },
    [editDialogMode, editingNode, loadMapData],
  );

  // Handle node delete from dialog
  const handleNodeDelete = useCallback(
    async (seaCode: string, nodeId: string) => {
      try {
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
        toast.success(`Node "${nodeId}" deleted from ${seaCode}`);
        setEditDialogOpen(false);
        loadMapData();
      } catch {
        toast.error("Network error");
      }
    },
    [loadMapData],
  );

  // Handle edge add
  const handleAddEdge = useCallback(async () => {
    if (!singleActiveSea || !edgeFrom || !edgeTo || edgeFrom === edgeTo) return;
    try {
      const res = await fetch("/api/maps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target: "edges",
          seaCode: singleActiveSea.key,
          edge: { from: edgeFrom, to: edgeTo, arrow: edgeArrow },
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
  }, [singleActiveSea, edgeFrom, edgeTo, edgeArrow, loadMapData]);

  // Handle edge delete
  const handleDeleteEdge = useCallback(
    async (from: string, to: string) => {
      if (!singleActiveSea) return;
      try {
        const res = await fetch("/api/maps", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            target: "edges",
            seaCode: singleActiveSea.key,
            from,
            to,
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
    [singleActiveSea, loadMapData],
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
        onLoad={() => {
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
        }}
        initialViewState={initialViewState}
        onMoveEnd={handleMoveEnd}
        onMouseMove={(e) => {
          if (pinMode) {
            setCursorCoord({
              lat: e.lngLat.lat,
              lng: e.lngLat.lng,
              x: e.point.x,
              y: e.point.y,
            });
          }
        }}
        onMouseLeave={() => {
          setCursorCoord(null);
        }}
        mapStyle={mapStyleUrl}
        style={{ width: "100%", height: "100%" }}
        onClick={(e) => {
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
        }}
      >
        {/* 2. Render markers based on loaded data */}
        {allNodes.map((node) => {
          const safeType = ALLOWED_NODE_TYPES.has(node.type)
            ? node.type
            : "normal";
          const sizePx =
            safeType === "start" || safeType === "boss" || safeType === "port"
              ? 50
              : 30;
          return (
            <React.Fragment key={`${node.id}-${node.lng}-${node.lat}`}>
              {/* Image marker (centered on coordinates) */}
              <Marker longitude={node.lng} latitude={node.lat} anchor="center">
                <NextImage
                  src={`/img/nodes/${safeType}.png`}
                  alt={node.name ?? node.id}
                  title={node.name ?? node.id}
                  width={sizePx}
                  height={sizePx}
                  unoptimized
                  style={{
                    cursor: "pointer",
                    filter: "drop-shadow(0px 0px 4px rgba(0,0,0,0.5))",
                  }}
                  onClick={(ev) => {
                    ev.stopPropagation();
                    const seaCode = findSeaForNode(node.id, node.lat, node.lng);
                    if (seaCode) {
                      openEditNodeDialog(node, seaCode);
                    }
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
        })}
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
        <div
          style={{
            position: "fixed",
            left: cursorCoord.x + 12,
            top: cursorCoord.y + 48 + 12,
            zIndex: 70,
            background: "rgba(0,0,0,0.75)",
            color: "#fff",
            padding: "4px 8px",
            borderRadius: 4,
            fontSize: 12,
            pointerEvents: "none",
            whiteSpace: "nowrap",
          }}
        >
          lat: {cursorCoord.lat.toFixed(6)}, lng: {cursorCoord.lng.toFixed(6)}
        </div>
      )}

      {/* Floating panel (bottom-right) */}
      <div
        style={{
          position: "fixed",
          right: 12,
          bottom: 12,
          zIndex: 60,
          background: pinMode ? "rgba(239, 68, 68, 0.7)" : "rgba(0,0,0,0.7)",
          border: pinMode
            ? "1px solid rgba(239, 68, 68, 1)"
            : "1px solid transparent",
          color: "#fff",
          borderRadius: 8,
          fontSize: 13,
          userSelect: "none",
          minWidth: 220,
        }}
      >
        {/* Header: mode toggles */}
        <div
          style={{
            padding: "8px 10px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
            borderBottom:
              (pinMode && pins.length > 0) || (editMode && singleActiveSea)
                ? "1px solid rgba(255,255,255,0.2)"
                : "none",
          }}
        >
          {/* Pin mode toggle */}
          <span
            onClick={() => setPinMode((prev) => !prev)}
            style={{ cursor: "pointer", flex: 1 }}
          >
            {pinMode ? "Pin: ON" : "Pin: OFF"}
            {pinMode && pins.length > 0 && (
              <span style={{ fontSize: 11, opacity: 0.8, marginLeft: 4 }}>
                {pins.length}
              </span>
            )}
          </span>

          {/* Edit mode toggle */}
          <button
            onClick={() => setEditMode((prev) => !prev)}
            title={editMode ? "Edit mode: ON" : "Edit mode: OFF"}
            style={{
              background: editMode ? "#3b82f6" : "#4b5563",
              color: "#fff",
              border: "none",
              borderRadius: 4,
              padding: "4px 6px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 3,
              fontSize: 11,
              fontWeight: 600,
            }}
          >
            <Pencil size={12} />
            {editMode ? "ON" : "OFF"}
          </button>

          {/* Sea manager button */}
          <button
            onClick={() => setSeaManagerOpen(true)}
            title="Sea area management"
            style={{
              background: "#4b5563",
              color: "#fff",
              border: "none",
              borderRadius: 4,
              padding: "4px 6px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 3,
              fontSize: 11,
              fontWeight: 600,
            }}
          >
            <MapIcon size={12} />
          </button>
        </div>

        {/* Pin list + action buttons */}
        {pinMode && pins.length > 0 && (
          <div style={{ padding: "4px 10px 8px" }}>
            {/* Scrollable pin list */}
            <div
              style={{
                maxHeight: 180,
                overflowY: "auto",
                marginBottom: 6,
              }}
            >
              {pins.map((p) => (
                <div
                  key={p.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    fontSize: 12,
                    padding: "2px 0",
                    fontFamily: "monospace",
                  }}
                >
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: 18,
                      height: 18,
                      background: "#ef4444",
                      borderRadius: "50%",
                      fontSize: 10,
                      fontWeight: 700,
                      flexShrink: 0,
                    }}
                  >
                    {p.num}
                  </span>
                  <span>
                    {p.lat.toFixed(6)}, {p.lng.toFixed(6)}
                  </span>
                </div>
              ))}
            </div>

            {/* Action buttons */}
            <div style={{ display: "flex", gap: 6 }}>
              <button
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
                style={{
                  background: "#22c55e",
                  color: "#000",
                  borderRadius: 6,
                  padding: "4px 8px",
                  fontWeight: 600,
                  fontSize: 12,
                  border: "none",
                  cursor: "pointer",
                  flex: 1,
                }}
              >
                Copy All
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setPins([]);
                }}
                style={{
                  background: "#6b7280",
                  color: "#fff",
                  borderRadius: 6,
                  padding: "4px 8px",
                  fontWeight: 600,
                  fontSize: 12,
                  border: "none",
                  cursor: "pointer",
                  flex: 1,
                }}
              >
                Clear
              </button>
            </div>
          </div>
        )}

        {/* Edge editing section (visible when editMode is ON and exactly one sea is active) */}
        {editMode && singleActiveSea && (
          <div
            style={{
              padding: "8px 10px",
              borderTop: "1px solid rgba(255,255,255,0.2)",
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                marginBottom: 6,
                opacity: 0.8,
              }}
            >
              Edges ({singleActiveSea.key})
            </div>

            {/* Add edge form */}
            <div style={{ display: "flex", gap: 4, marginBottom: 6, flexWrap: "wrap" }}>
              <select
                value={edgeFrom}
                onChange={(e) => setEdgeFrom(e.target.value)}
                style={{
                  flex: 1,
                  minWidth: 60,
                  background: "#374151",
                  color: "#fff",
                  border: "1px solid #6b7280",
                  borderRadius: 4,
                  padding: "2px 4px",
                  fontSize: 11,
                }}
              >
                <option value="">From</option>
                {singleActiveSea.nodes.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.id}
                  </option>
                ))}
              </select>
              <select
                value={edgeTo}
                onChange={(e) => setEdgeTo(e.target.value)}
                style={{
                  flex: 1,
                  minWidth: 60,
                  background: "#374151",
                  color: "#fff",
                  border: "1px solid #6b7280",
                  borderRadius: 4,
                  padding: "2px 4px",
                  fontSize: 11,
                }}
              >
                <option value="">To</option>
                {singleActiveSea.nodes.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.id}
                  </option>
                ))}
              </select>
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 2,
                  fontSize: 11,
                }}
              >
                <input
                  type="checkbox"
                  checked={edgeArrow}
                  onChange={(e) => setEdgeArrow(e.target.checked)}
                  style={{ width: 12, height: 12 }}
                />
                Arrow
              </label>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleAddEdge();
                }}
                disabled={!edgeFrom || !edgeTo || edgeFrom === edgeTo}
                style={{
                  background: !edgeFrom || !edgeTo || edgeFrom === edgeTo ? "#4b5563" : "#3b82f6",
                  color: "#fff",
                  borderRadius: 4,
                  padding: "2px 8px",
                  fontWeight: 600,
                  fontSize: 11,
                  border: "none",
                  cursor: !edgeFrom || !edgeTo || edgeFrom === edgeTo ? "not-allowed" : "pointer",
                }}
              >
                Add
              </button>
            </div>

            {/* Current edges list */}
            <div style={{ maxHeight: 120, overflowY: "auto" }}>
              {singleActiveSea.edges.map((edge) => (
                <div
                  key={`${edge.from}-${edge.to}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    fontSize: 11,
                    padding: "1px 0",
                    fontFamily: "monospace",
                  }}
                >
                  <span>
                    {edge.from} {edge.arrow ? "->" : "--"} {edge.to}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteEdge(edge.from, edge.to);
                    }}
                    style={{
                      background: "transparent",
                      color: "#ef4444",
                      border: "none",
                      cursor: "pointer",
                      fontSize: 11,
                      padding: "0 4px",
                      fontWeight: 700,
                    }}
                    title={`Delete edge ${edge.from} -> ${edge.to}`}
                  >
                    x
                  </button>
                </div>
              ))}
              {singleActiveSea.edges.length === 0 && (
                <div style={{ fontSize: 11, opacity: 0.5 }}>No edges</div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Node edit dialog */}
      <NodeEditDialog
        open={editDialogOpen}
        mode={editDialogMode}
        lat={pendingCoord?.lat}
        lng={pendingCoord?.lng}
        node={editingNode?.node}
        seaCode={editingNode?.seaCode ?? (singleActiveSea?.key)}
        availableSeas={allSeas}
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
