"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Map, { type MapRef } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import type { MapLayerMouseEvent } from "maplibre-gl";

import type { MapNode } from "@/app/types/maps";
import { MAP_STYLES, STORAGE_KEYS } from "@/app/lib/constants";
import { mapRefHolder } from "@/app/lib/map-ref";
import { useAppStore, type Pin } from "@/app/store/useAppStore";
import type { NodeLocation } from "@/app/hooks/useMapSections";
import NodeMarker from "@/app/components/map/NodeMarker";
import SeaEdgeLayers, { type SectionGeoJson } from "@/app/components/map/SeaEdgeLayers";
import PinMarkers from "@/app/components/map/PinMarkers";
import CursorTooltip, { type CursorCoord } from "@/app/components/map/CursorTooltip";
import NodePopup, { type NodePopupInfo } from "@/app/components/map/NodePopup";

const DEFAULT_VIEW = { longitude: 139.7, latitude: 35.25, zoom: 11 };

interface MapViewProps {
  allNodes: MapNode[];
  geoJsonCollections: SectionGeoJson[];
  findSeaForNode: (nodeId: string, lat: number, lng: number) => NodeLocation | undefined;
  getNodePopupContext: (node: MapNode) => { seaLabel?: string; submapNames: string[] };
  onPinSelect: (pin: Pin) => void;
}

/** The MapLibre map with node markers, edge/arrow layers, pins, and popups */
export default function MapView({
  allNodes,
  geoJsonCollections,
  findSeaForNode,
  getNodePopupContext,
  onPinSelect,
}: MapViewProps) {
  const mapRef = useRef<MapRef>(null);
  const devToolsEnabled = useAppStore((s) => s.devToolsEnabled);
  const pinMode = useAppStore((s) => s.pinMode);
  const contributionMode = useAppStore((s) => s.contributionMode);
  const contributionData = useAppStore((s) => s.contributionData);
  const mapStyleId = useAppStore((s) => s.mapStyleId);
  const addPin = useAppStore((s) => s.addPin);
  const openAddNodeDialog = useAppStore((s) => s.openAddNodeDialog);
  const openEditNodeDialog = useAppStore((s) => s.openEditNodeDialog);

  const [cursorCoord, setCursorCoord] = useState<CursorCoord | null>(null);
  const [popupInfo, setPopupInfo] = useState<NodePopupInfo | null>(null);

  // Expose the map instance to components outside the map tree (auto-zoom)
  useEffect(() => {
    return () => {
      mapRefHolder.current = null;
    };
  }, []);

  // Persisted map view state (read once before mount)
  const initialViewState = useMemo(() => {
    if (typeof window === "undefined") return DEFAULT_VIEW;
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.mapView);
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
    return DEFAULT_VIEW;
  }, []);

  const handleMoveEnd = useCallback(
    (e: { viewState: { longitude: number; latitude: number; zoom: number } }) => {
      const { longitude, latitude, zoom } = e.viewState;
      try {
        localStorage.setItem(
          STORAGE_KEYS.mapView,
          JSON.stringify({ longitude, latitude, zoom }),
        );
      } catch {
        // Ignore storage errors
      }
    },
    [],
  );

  // Map style URL (MapTiler key via env). Falls back to demo tiles when unset.
  const MAPTILER_KEY = process.env.NEXT_PUBLIC_MAPTILER_KEY;
  const mapStyleUrl = useMemo(() => {
    if (!MAPTILER_KEY) {
      if (process.env.NODE_ENV === "production") {
        console.error(
          "NEXT_PUBLIC_MAPTILER_KEY is not set. Please configure it in Vercel environment variables.",
        );
      } else {
        console.warn("NEXT_PUBLIC_MAPTILER_KEY not set. Falling back to demo style.");
      }
      return "https://demotiles.maplibre.org/style.json";
    }
    const style = MAP_STYLES.find((s) => s.id === mapStyleId) ?? MAP_STYLES[0];
    return `https://api.maptiler.com/maps/${style.maptiler}/style.json?key=${MAPTILER_KEY}`;
  }, [MAPTILER_KEY, mapStyleId]);

  // Register the arrow icon image once the style is loaded
  const handleMapLoad = useCallback(() => {
    mapRefHolder.current = mapRef.current;
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

  // Node click: edit dialog in dev/contribution mode, info popup otherwise
  const handleNodeClick = useCallback(
    (node: MapNode) => {
      if (contributionMode && contributionData) {
        openEditNodeDialog(node, contributionData.code);
        return;
      }
      if (devToolsEnabled) {
        const result = findSeaForNode(node.id, node.lat, node.lng);
        if (result) {
          openEditNodeDialog(node, result.seaCode, result.submapId);
        }
        return;
      }
      // View mode: show the read-only info popup
      const context = getNodePopupContext(node);
      setPopupInfo({ node, ...context });
    },
    [
      contributionMode,
      contributionData,
      devToolsEnabled,
      findSeaForNode,
      getNodePopupContext,
      openEditNodeDialog,
    ],
  );

  // Map click: add node (contribution), place pin (pin mode), or log coords (dev)
  const handleMapClick = useCallback(
    (e: MapLayerMouseEvent) => {
      const { lng, lat } = e.lngLat;
      if (contributionMode) {
        openAddNodeDialog(lat, lng);
        return;
      }
      if (pinMode) {
        addPin(lat, lng);
        openAddNodeDialog(lat, lng);
        return;
      }
      if (devToolsEnabled) {
        console.log(`{ "id": "NEW", "type": "normal", "lat": ${lat}, "lng": ${lng} },`);
      }
    },
    [contributionMode, pinMode, devToolsEnabled, addPin, openAddNodeDialog],
  );

  return (
    <>
      <Map
        ref={mapRef}
        onLoad={handleMapLoad}
        initialViewState={initialViewState}
        onMoveEnd={handleMoveEnd}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setCursorCoord(null)}
        mapStyle={mapStyleUrl}
        style={{ width: "100%", height: "100%" }}
        onClick={handleMapClick}
      >
        {allNodes.map((node) => (
          <NodeMarker
            key={`${node.id}-${node.lng}-${node.lat}`}
            node={node}
            onClickNode={handleNodeClick}
          />
        ))}

        <SeaEdgeLayers collections={geoJsonCollections} />

        <PinMarkers onSelect={onPinSelect} />

        {popupInfo && <NodePopup info={popupInfo} onClose={() => setPopupInfo(null)} />}
      </Map>

      {/* Cursor coordinate tooltip while pin mode is ON */}
      {pinMode && cursorCoord !== null && <CursorTooltip coord={cursorCoord} />}
    </>
  );
}
