import type { NextResponse } from "next/server";

import type { MapNode } from "@/app/types/maps";
import { writeSea } from "@/app/lib/maps-io";
import { ApiError, jsonOk, requireSea, requireSubmap } from "@/app/lib/maps-handlers/http";

/** POST target: "nodes" — add a node to base or to a submap */
export async function addNode(body: unknown): Promise<NextResponse> {
  const { seaCode, node, submapId } = body as {
    seaCode: string;
    node: MapNode;
    submapId?: string;
  };
  if (!node || !node.id || !node.type) {
    throw new ApiError("Invalid node data", 400);
  }
  const sea = await requireSea(seaCode);
  if (submapId) {
    const submap = requireSubmap(sea, submapId);
    if ((submap.nodes ?? []).some((n) => n.id === node.id)) {
      throw new ApiError(`Node "${node.id}" already exists in submap "${submapId}"`, 409);
    }
    if (!submap.nodes) {
      submap.nodes = [];
    }
    submap.nodes.push(node);
  } else {
    if (sea.nodes.find((n) => n.id === node.id)) {
      throw new ApiError(
        `Node "${node.id}" already exists in base of sea "${seaCode}"`,
        409,
      );
    }
    sea.nodes.push(node);
  }
  await writeSea(sea);
  return jsonOk();
}

/** PUT (default target) — update node fields, optionally moving between submaps */
export async function updateNode(body: unknown): Promise<NextResponse> {
  const { seaCode, nodeId, submapId, newSubmapId, updates } = body as {
    seaCode: string;
    nodeId: string;
    submapId?: string;
    newSubmapId?: string | null;
    updates: Partial<MapNode>;
  };
  if (!seaCode || !nodeId || !updates) {
    throw new ApiError("Missing seaCode, nodeId, or updates", 400);
  }
  const sea = await requireSea(seaCode);

  // Find node in submap or base sea
  let node: MapNode | undefined;
  if (submapId) {
    const submap = requireSubmap(sea, submapId);
    node = (submap.nodes ?? []).find((n) => n.id === nodeId);
  } else {
    node = sea.nodes.find((n) => n.id === nodeId);
  }
  if (!node) {
    throw new ApiError(`Node "${nodeId}" not found in sea "${seaCode}"`, 404);
  }

  // Move the node when a different target submap is requested
  const resolvedNewSubmapId = newSubmapId === null ? undefined : newSubmapId;
  const needsMove =
    newSubmapId !== undefined && resolvedNewSubmapId !== (submapId ?? undefined);

  if (needsMove) {
    // Remove node from current location
    if (submapId) {
      const submap = requireSubmap(sea, submapId);
      submap.nodes = (submap.nodes ?? []).filter((n) => n.id !== nodeId);
    } else {
      sea.nodes = sea.nodes.filter((n) => n.id !== nodeId);
    }

    // Add node to target location
    if (resolvedNewSubmapId) {
      const targetSubmap = sea.submaps?.find((sm) => sm.id === resolvedNewSubmapId);
      if (!targetSubmap) {
        throw new ApiError(
          `Target submap "${resolvedNewSubmapId}" not found in sea "${seaCode}"`,
          404,
        );
      }
      if (!targetSubmap.nodes) targetSubmap.nodes = [];
      targetSubmap.nodes.push(node);
    } else {
      sea.nodes.push(node);
    }
  }

  // Apply updates (only allowed fields)
  if (updates.id !== undefined) node.id = updates.id;
  if (updates.type !== undefined) node.type = updates.type;
  if (updates.name !== undefined) node.name = updates.name;
  if (updates.lat !== undefined) node.lat = updates.lat;
  if (updates.lng !== undefined) node.lng = updates.lng;
  if (updates.bossDialogue !== undefined) node.bossDialogue = updates.bossDialogue;
  if (updates.meta !== undefined) node.meta = updates.meta;

  // If the node id changed, update all edges referencing the old id
  if (updates.id !== undefined && updates.id !== nodeId) {
    for (const edge of sea.edges) {
      if (edge.from === nodeId) edge.from = updates.id;
      if (edge.to === nodeId) edge.to = updates.id;
    }
    for (const submap of sea.submaps ?? []) {
      for (const edge of submap.edges) {
        if (edge.from === nodeId) edge.from = updates.id;
        if (edge.to === nodeId) edge.to = updates.id;
      }
    }
  }

  await writeSea(sea);
  return jsonOk();
}

/** DELETE target: "nodes" — remove a node and every edge referencing it */
export async function deleteNode(body: unknown): Promise<NextResponse> {
  const { seaCode, nodeId, submapId } = body as {
    seaCode: string;
    nodeId: string;
    submapId?: string;
  };
  if (!nodeId) {
    throw new ApiError("Missing nodeId", 400);
  }
  const sea = await requireSea(seaCode);
  if (submapId) {
    const submap = requireSubmap(sea, submapId);
    const nodeIndex = (submap.nodes ?? []).findIndex((n) => n.id === nodeId);
    if (nodeIndex === -1) {
      throw new ApiError(`Node "${nodeId}" not found in submap "${submapId}"`, 404);
    }
    submap.nodes!.splice(nodeIndex, 1);
  } else {
    const nodeIndex = sea.nodes.findIndex((n) => n.id === nodeId);
    if (nodeIndex === -1) {
      throw new ApiError(`Node "${nodeId}" not found`, 404);
    }
    sea.nodes.splice(nodeIndex, 1);
  }
  // Remove all edges referencing this node (from base and all submaps)
  sea.edges = sea.edges.filter((e) => e.from !== nodeId && e.to !== nodeId);
  for (const sm of sea.submaps ?? []) {
    sm.edges = sm.edges.filter((e) => e.from !== nodeId && e.to !== nodeId);
  }
  await writeSea(sea);
  return jsonOk();
}
