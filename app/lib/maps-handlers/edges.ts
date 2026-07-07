import type { NextResponse } from "next/server";

import type { MapEdge } from "@/app/types/maps";
import { writeSea } from "@/app/lib/maps-io";
import { ApiError, jsonOk, requireSea, requireSubmap } from "@/app/lib/maps-handlers/http";

/** POST target: "edges" — add an edge to base or to a submap */
export async function addEdge(body: unknown): Promise<NextResponse> {
  const { seaCode, edge, submapId } = body as {
    seaCode: string;
    edge: MapEdge;
    submapId?: string;
  };
  if (!edge || !edge.from || !edge.to) {
    throw new ApiError("Invalid edge data", 400);
  }
  const sea = await requireSea(seaCode);

  // Both endpoints must exist somewhere in the sea (base or any submap)
  const allNodeIds = new Set<string>(sea.nodes.map((n) => n.id));
  for (const sm of sea.submaps ?? []) {
    for (const n of sm.nodes ?? []) {
      allNodeIds.add(n.id);
    }
  }
  if (!allNodeIds.has(edge.from) || !allNodeIds.has(edge.to)) {
    throw new ApiError("Edge references non-existent node(s)", 400);
  }

  if (submapId) {
    const submap = requireSubmap(sea, submapId);
    if (submap.edges.some((e) => e.from === edge.from && e.to === edge.to)) {
      throw new ApiError(
        `Edge "${edge.from} -> ${edge.to}" already exists in submap "${submapId}"`,
        409,
      );
    }
    submap.edges.push(edge);
  } else {
    if (sea.edges.some((e) => e.from === edge.from && e.to === edge.to)) {
      throw new ApiError(
        `Edge "${edge.from} -> ${edge.to}" already exists in base of sea "${seaCode}"`,
        409,
      );
    }
    sea.edges.push(edge);
  }
  await writeSea(sea);
  return jsonOk();
}

/** PUT target: "edges" — move an edge between base and submaps */
export async function moveEdge(body: unknown): Promise<NextResponse> {
  const { seaCode, from, to, submapId, newSubmapId } = body as {
    seaCode: string;
    from: string;
    to: string;
    submapId?: string;
    newSubmapId?: string | null;
  };
  if (!seaCode || !from || !to) {
    throw new ApiError("Missing seaCode, from, or to", 400);
  }
  const sea = await requireSea(seaCode);

  // Find and remove edge from its current location
  let edge: MapEdge | undefined;
  if (submapId) {
    const submap = requireSubmap(sea, submapId);
    const idx = submap.edges.findIndex((e) => e.from === from && e.to === to);
    if (idx === -1) {
      throw new ApiError(
        `Edge "${from} -> ${to}" not found in submap "${submapId}"`,
        404,
      );
    }
    edge = submap.edges[idx];
    submap.edges.splice(idx, 1);
  } else {
    const idx = sea.edges.findIndex((e) => e.from === from && e.to === to);
    if (idx === -1) {
      throw new ApiError(
        `Edge "${from} -> ${to}" not found in base of sea "${seaCode}"`,
        404,
      );
    }
    edge = sea.edges[idx];
    sea.edges.splice(idx, 1);
  }

  // Add edge to the target location
  const targetSubmapId = newSubmapId === null ? undefined : newSubmapId;
  if (targetSubmapId) {
    const targetSubmap = sea.submaps?.find((sm) => sm.id === targetSubmapId);
    if (!targetSubmap) {
      throw new ApiError(
        `Target submap "${targetSubmapId}" not found in sea "${seaCode}"`,
        404,
      );
    }
    targetSubmap.edges.push(edge);
  } else {
    sea.edges.push(edge);
  }

  await writeSea(sea);
  return jsonOk();
}

/** DELETE target: "edges" — remove an edge from base or a submap */
export async function deleteEdge(body: unknown): Promise<NextResponse> {
  const { seaCode, from, to, submapId } = body as {
    seaCode: string;
    from: string;
    to: string;
    submapId?: string;
  };
  if (!from || !to) {
    throw new ApiError("Missing from or to", 400);
  }
  const sea = await requireSea(seaCode);
  if (submapId) {
    const submap = requireSubmap(sea, submapId);
    const edgeIndex = submap.edges.findIndex((e) => e.from === from && e.to === to);
    if (edgeIndex === -1) {
      throw new ApiError(`Edge ${from}->${to} not found in submap "${submapId}"`, 404);
    }
    submap.edges.splice(edgeIndex, 1);
  } else {
    const edgeIndex = sea.edges.findIndex((e) => e.from === from && e.to === to);
    if (edgeIndex === -1) {
      throw new ApiError(`Edge ${from}->${to} not found`, 404);
    }
    sea.edges.splice(edgeIndex, 1);
  }
  await writeSea(sea);
  return jsonOk();
}
