import { point } from "@turf/helpers";
import turfBearing from "@turf/bearing";
import destination from "@turf/destination";
import type { Feature, FeatureCollection, LineString, Point } from "geojson";
import type { LngLatBoundsLike } from "maplibre-gl";

import type { MapEdge, MapNode } from "@/app/types/maps";

export type EdgeProperties = {
  from: string;
  to: string;
  arrow: boolean;
  section: string;
};

export type ArrowProperties = {
  rotation: number;
  from: string;
  to: string;
  section: string;
};

const EARTH_RADIUS_KM = 6371;

/** Great-circle distance (km) between two [lng, lat] points */
export function haversineKm(from: [number, number], to: [number, number]): number {
  const dLat = ((to[1] - from[1]) * Math.PI) / 180;
  const dLng = ((to[0] - from[0]) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((from[1] * Math.PI) / 180) *
      Math.cos((to[1] * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Normalize a destination longitude so the shorter antimeridian path is used */
function normalizeToLng(fromLng: number, toLng: number): number {
  const diff = toLng - fromLng;
  if (diff > 180) return toLng - 360;
  if (diff < -180) return toLng + 360;
  return toLng;
}

/** Build a node-id -> [lng, lat] lookup */
function buildCoordIndex(nodes: readonly MapNode[]): Record<string, [number, number]> {
  const idx: Record<string, [number, number]> = {};
  for (const n of nodes) idx[n.id] = [n.lng, n.lat];
  return idx;
}

/** Convert edges to a LineString FeatureCollection for a section */
export function buildEdgeFeatureCollection(
  nodes: readonly MapNode[],
  edges: readonly MapEdge[],
  sectionKey: string,
): FeatureCollection<LineString, EdgeProperties> {
  const idx = buildCoordIndex(nodes);
  const features: Feature<LineString, EdgeProperties>[] = [];
  for (const e of edges) {
    const from = idx[e.from];
    const to = idx[e.to];
    if (!from || !to) continue;
    const toLng = normalizeToLng(from[0], to[0]);
    features.push({
      type: "Feature",
      properties: { from: e.from, to: e.to, arrow: !!e.arrow, section: sectionKey },
      geometry: { type: "LineString", coordinates: [from, [toLng, to[1]]] },
    });
  }
  return { type: "FeatureCollection", features };
}

/**
 * Build arrow point features for directed edges.
 * Each arrow is placed near the destination, offset backwards along the edge
 * (capped to 40% of the segment length so it stays within the edge).
 */
export function buildArrowFeatureCollection(
  nodes: readonly MapNode[],
  edges: readonly MapEdge[],
  sectionKey: string,
  arrowOffsetKm: number,
): FeatureCollection<Point, ArrowProperties> {
  const idx = buildCoordIndex(nodes);
  const features: Feature<Point, ArrowProperties>[] = [];
  for (const e of edges) {
    if (!e.arrow) continue;
    const from = idx[e.from];
    const to = idx[e.to];
    if (!from || !to) continue;
    const toCoord: [number, number] = [normalizeToLng(from[0], to[0]), to[1]];
    const deg = turfBearing(point(from), point(toCoord));
    const segmentKm = haversineKm(from, toCoord);
    const clampedOffsetKm = Math.min(arrowOffsetKm, segmentKm * 0.4);
    const reverseDeg = (deg + 180) % 360;
    const fwd = destination(point(toCoord), clampedOffsetKm, reverseDeg, {
      units: "kilometers",
    });
    const fwdCoord = fwd?.geometry?.coordinates ?? from;
    features.push({
      type: "Feature",
      properties: { rotation: deg, from: e.from, to: e.to, section: sectionKey },
      geometry: { type: "Point", coordinates: fwdCoord },
    });
  }
  return { type: "FeatureCollection", features };
}

/**
 * Bounding box [[west, south], [east, north]] of a node set,
 * or null when there are no nodes. Used for fitBounds on sea selection.
 */
export function seaBounds(nodes: readonly MapNode[]): LngLatBoundsLike | null {
  if (nodes.length === 0) return null;
  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;
  for (const n of nodes) {
    west = Math.min(west, n.lng);
    south = Math.min(south, n.lat);
    east = Math.max(east, n.lng);
    north = Math.max(north, n.lat);
  }
  return [
    [west, south],
    [east, north],
  ];
}
