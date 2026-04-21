import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";

import type { MapsData, MapNode, MapEdge, MapSea, MapGroup, MapSubSea } from "@/app/types/maps";

const DATA_PATH = path.join(process.cwd(), "public", "data", "maps.json");

/** Read and parse maps.json */
function readMapsData(): MapsData {
  const content = fs.readFileSync(DATA_PATH, "utf-8");
  return JSON.parse(content) as MapsData;
}

/** Write maps data back to maps.json */
function writeMapsData(data: MapsData): void {
  fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2), "utf-8");
}

/** Find a sea by code across all groups */
function findSea(data: MapsData, seaCode: string): MapSea | undefined {
  for (const group of data.groups) {
    for (const sea of group.seas) {
      if (sea.code === seaCode) {
        return sea;
      }
    }
  }
  return undefined;
}

/** Check if a sea code is unique across all groups */
function isSeaCodeUnique(data: MapsData, code: string): boolean {
  return findSea(data, code) === undefined;
}

/** Find a group by id */
function findGroup(data: MapsData, groupId: string): MapGroup | undefined {
  return data.groups.find((g) => g.id === groupId);
}

// ---------------------------------------------------------------------------
// POST: Add a node, edge, sea, or group
// Body: { target: "nodes", seaCode: string, node: MapNode }
//    or { target: "edges", seaCode: string, edge: MapEdge }
//    or { target: "seas", groupId: string, sea: { code: string, name: string } }
//    or { target: "groups", group: { id: string, name: string } }
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json();
    const { target } = body as { target: string };

    if (!target) {
      return NextResponse.json(
        { error: "Missing target" },
        { status: 400 },
      );
    }

    const data = readMapsData();

    // --- Add a new sea to a group ---
    if (target === "seas") {
      const { groupId, sea } = body as {
        groupId: string;
        sea: { code: string; name: string };
      };
      if (!groupId || !sea || !sea.code || !sea.name) {
        return NextResponse.json(
          { error: "Missing groupId, sea.code, or sea.name" },
          { status: 400 },
        );
      }
      const group = findGroup(data, groupId);
      if (!group) {
        return NextResponse.json(
          { error: `Group "${groupId}" not found` },
          { status: 404 },
        );
      }
      if (!isSeaCodeUnique(data, sea.code)) {
        return NextResponse.json(
          { error: `Sea code "${sea.code}" already exists` },
          { status: 409 },
        );
      }
      const newSea: MapSea = {
        code: sea.code,
        name: sea.name,
        meta: {},
        nodes: [],
        edges: [],
      };
      group.seas.push(newSea);
      writeMapsData(data);
      return NextResponse.json({ success: true });
    }

    // --- Add a new group ---
    if (target === "groups") {
      const { group } = body as {
        group: { id: string; name: string };
      };
      if (!group || !group.id || !group.name) {
        return NextResponse.json(
          { error: "Missing group.id or group.name" },
          { status: 400 },
        );
      }
      if (findGroup(data, group.id)) {
        return NextResponse.json(
          { error: `Group "${group.id}" already exists` },
          { status: 409 },
        );
      }
      const newGroup: MapGroup = {
        id: group.id,
        name: group.name,
        meta: {},
        seas: [],
      };
      data.groups.push(newGroup);
      writeMapsData(data);
      return NextResponse.json({ success: true });
    }

    // --- Existing: Add node or edge (require seaCode) ---
    const { seaCode } = body as { seaCode: string };
    if (!seaCode) {
      return NextResponse.json(
        { error: "Missing seaCode" },
        { status: 400 },
      );
    }

    const sea = findSea(data, seaCode);
    if (!sea) {
      return NextResponse.json(
        { error: `Sea "${seaCode}" not found` },
        { status: 404 },
      );
    }

    if (target === "nodes") {
      const { node, submapId } = body as { node: MapNode; submapId?: string };
      if (!node || !node.id || !node.type) {
        return NextResponse.json(
          { error: "Invalid node data" },
          { status: 400 },
        );
      }
      // Check for duplicate node ID only within the target location
      // (cross-location duplicates are allowed for multi-submap membership)
      if (submapId) {
        const submap = sea.submaps?.find((sm) => sm.id === submapId);
        if (!submap) {
          return NextResponse.json(
            { error: `Submap "${submapId}" not found in sea "${seaCode}"` },
            { status: 404 },
          );
        }
        const existsInSubmap = (submap.nodes ?? []).some((n) => n.id === node.id);
        if (existsInSubmap) {
          return NextResponse.json(
            { error: `Node "${node.id}" already exists in submap "${submapId}"` },
            { status: 409 },
          );
        }
        if (!submap.nodes) {
          submap.nodes = [];
        }
        submap.nodes.push(node);
      } else {
        const existsInSea = sea.nodes.find((n) => n.id === node.id);
        if (existsInSea) {
          return NextResponse.json(
            { error: `Node "${node.id}" already exists in base of sea "${seaCode}"` },
            { status: 409 },
          );
        }
        sea.nodes.push(node);
      }
      writeMapsData(data);
      return NextResponse.json({ success: true });
    }

    if (target === "edges") {
      const { edge, submapId } = body as { edge: MapEdge; submapId?: string };
      if (!edge || !edge.from || !edge.to) {
        return NextResponse.json(
          { error: "Invalid edge data" },
          { status: 400 },
        );
      }
      // Collect all node IDs across the sea and all submaps
      const allNodeIds = new Set<string>(sea.nodes.map((n) => n.id));
      if (sea.submaps) {
        for (const sm of sea.submaps) {
          for (const n of sm.nodes ?? []) {
            allNodeIds.add(n.id);
          }
        }
      }
      // Verify both nodes exist (in base or any submap)
      if (!allNodeIds.has(edge.from) || !allNodeIds.has(edge.to)) {
        return NextResponse.json(
          { error: "Edge references non-existent node(s)" },
          { status: 400 },
        );
      }
      // Check for duplicate edge only within the target location
      // (cross-location duplicates are allowed for multi-submap membership)
      if (submapId) {
        const submap = sea.submaps?.find((sm) => sm.id === submapId);
        if (!submap) {
          return NextResponse.json(
            { error: `Submap "${submapId}" not found in sea "${seaCode}"` },
            { status: 404 },
          );
        }
        const existsInSubmap = submap.edges.some(
          (e) => e.from === edge.from && e.to === edge.to,
        );
        if (existsInSubmap) {
          return NextResponse.json(
            { error: `Edge "${edge.from} -> ${edge.to}" already exists in submap "${submapId}"` },
            { status: 409 },
          );
        }
        submap.edges.push(edge);
      } else {
        const existsInBase = sea.edges.some(
          (e) => e.from === edge.from && e.to === edge.to,
        );
        if (existsInBase) {
          return NextResponse.json(
            { error: `Edge "${edge.from} -> ${edge.to}" already exists in base of sea "${seaCode}"` },
            { status: 409 },
          );
        }
        sea.edges.push(edge);
      }
      writeMapsData(data);
      return NextResponse.json({ success: true });
    }

    // --- Add a new submap to a sea ---
    if (target === "submaps") {
      const { submap } = body as { submap: { id: string; name: string } };
      if (!submap || !submap.id || !submap.name) {
        return NextResponse.json(
          { error: "Missing submap.id or submap.name" },
          { status: 400 },
        );
      }
      if (!sea.submaps) {
        sea.submaps = [];
      }
      if (sea.submaps.find((sm) => sm.id === submap.id)) {
        return NextResponse.json(
          { error: `Submap "${submap.id}" already exists in sea "${seaCode}"` },
          { status: 409 },
        );
      }
      const newSubmap: MapSubSea = {
        id: submap.id,
        name: submap.name,
        nodes: [],
        edges: [],
      };
      sea.submaps.push(newSubmap);
      writeMapsData(data);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json(
      { error: `Unknown target: "${target}"` },
      { status: 400 },
    );
  } catch (err) {
    console.error("POST /api/maps error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// ---------------------------------------------------------------------------
// PUT: Update a node, sea, or group
// Body: { target?: "nodes", seaCode: string, nodeId: string, updates: Partial<MapNode> }
//    or { target: "seas", seaCode: string, updates: { name?: string, code?: string } }
//    or { target: "groups", groupId: string, updates: { name?: string, id?: string } }
// ---------------------------------------------------------------------------
export async function PUT(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json();
    const { target } = body as { target?: string };
    const data = readMapsData();

    // --- Update a sea ---
    if (target === "seas") {
      const { seaCode, updates } = body as {
        seaCode: string;
        updates: { name?: string; code?: string };
      };
      if (!seaCode || !updates) {
        return NextResponse.json(
          { error: "Missing seaCode or updates" },
          { status: 400 },
        );
      }
      const sea = findSea(data, seaCode);
      if (!sea) {
        return NextResponse.json(
          { error: `Sea "${seaCode}" not found` },
          { status: 404 },
        );
      }
      if (updates.code !== undefined && updates.code !== seaCode) {
        if (!isSeaCodeUnique(data, updates.code)) {
          return NextResponse.json(
            { error: `Sea code "${updates.code}" already exists` },
            { status: 409 },
          );
        }
        sea.code = updates.code;
      }
      if (updates.name !== undefined) {
        sea.name = updates.name;
      }
      writeMapsData(data);
      return NextResponse.json({ success: true });
    }

    // --- Update a group ---
    if (target === "groups") {
      const { groupId, updates } = body as {
        groupId: string;
        updates: { name?: string; id?: string };
      };
      if (!groupId || !updates) {
        return NextResponse.json(
          { error: "Missing groupId or updates" },
          { status: 400 },
        );
      }
      const group = findGroup(data, groupId);
      if (!group) {
        return NextResponse.json(
          { error: `Group "${groupId}" not found` },
          { status: 404 },
        );
      }
      if (updates.id !== undefined && updates.id !== groupId) {
        if (findGroup(data, updates.id)) {
          return NextResponse.json(
            { error: `Group "${updates.id}" already exists` },
            { status: 409 },
          );
        }
        group.id = updates.id;
      }
      if (updates.name !== undefined) {
        group.name = updates.name;
      }
      writeMapsData(data);
      return NextResponse.json({ success: true });
    }

    // --- Update a submap ---
    if (target === "submaps") {
      const { seaCode: smSeaCode, submapId, updates: smUpdates } = body as {
        seaCode: string;
        submapId: string;
        updates: { name?: string; id?: string };
      };
      if (!smSeaCode || !submapId || !smUpdates) {
        return NextResponse.json(
          { error: "Missing seaCode, submapId, or updates" },
          { status: 400 },
        );
      }
      const smSea = findSea(data, smSeaCode);
      if (!smSea) {
        return NextResponse.json(
          { error: `Sea "${smSeaCode}" not found` },
          { status: 404 },
        );
      }
      const submap = smSea.submaps?.find((sm) => sm.id === submapId);
      if (!submap) {
        return NextResponse.json(
          { error: `Submap "${submapId}" not found in sea "${smSeaCode}"` },
          { status: 404 },
        );
      }
      if (smUpdates.id !== undefined && smUpdates.id !== submapId) {
        if (smSea.submaps?.find((sm) => sm.id === smUpdates.id)) {
          return NextResponse.json(
            { error: `Submap "${smUpdates.id}" already exists` },
            { status: 409 },
          );
        }
        submap.id = smUpdates.id;
      }
      if (smUpdates.name !== undefined) {
        submap.name = smUpdates.name;
      }
      writeMapsData(data);
      return NextResponse.json({ success: true });
    }

    // --- Update an edge's submap assignment ---
    if (target === "edges") {
      const { seaCode: edgeSeaCode, from, to, submapId: edgeSubmapId, newSubmapId } = body as {
        seaCode: string;
        from: string;
        to: string;
        submapId?: string;
        newSubmapId?: string | null;
      };

      if (!edgeSeaCode || !from || !to) {
        return NextResponse.json(
          { error: "Missing seaCode, from, or to" },
          { status: 400 },
        );
      }

      const edgeSea = findSea(data, edgeSeaCode);
      if (!edgeSea) {
        return NextResponse.json(
          { error: `Sea "${edgeSeaCode}" not found` },
          { status: 404 },
        );
      }

      // Find and remove edge from current location
      let edge: MapEdge | undefined;
      if (edgeSubmapId) {
        const submap = edgeSea.submaps?.find((sm) => sm.id === edgeSubmapId);
        if (!submap) {
          return NextResponse.json(
            { error: `Submap "${edgeSubmapId}" not found in sea "${edgeSeaCode}"` },
            { status: 404 },
          );
        }
        const idx = submap.edges.findIndex((e) => e.from === from && e.to === to);
        if (idx === -1) {
          return NextResponse.json(
            { error: `Edge "${from} -> ${to}" not found in submap "${edgeSubmapId}"` },
            { status: 404 },
          );
        }
        edge = submap.edges[idx];
        submap.edges.splice(idx, 1);
      } else {
        const idx = edgeSea.edges.findIndex((e) => e.from === from && e.to === to);
        if (idx === -1) {
          return NextResponse.json(
            { error: `Edge "${from} -> ${to}" not found in base of sea "${edgeSeaCode}"` },
            { status: 404 },
          );
        }
        edge = edgeSea.edges[idx];
        edgeSea.edges.splice(idx, 1);
      }

      // Add edge to target location
      const targetSubmapId = newSubmapId === null ? undefined : newSubmapId;
      if (targetSubmapId) {
        const targetSubmap = edgeSea.submaps?.find((sm) => sm.id === targetSubmapId);
        if (!targetSubmap) {
          return NextResponse.json(
            { error: `Target submap "${targetSubmapId}" not found in sea "${edgeSeaCode}"` },
            { status: 404 },
          );
        }
        targetSubmap.edges.push(edge);
      } else {
        edgeSea.edges.push(edge);
      }

      writeMapsData(data);
      return NextResponse.json({ success: true });
    }

    // --- Existing: Update a node (backward compatible, target is optional) ---
    const { seaCode, nodeId, submapId: nodeSubmapId, newSubmapId: nodeNewSubmapId, updates } = body as {
      seaCode: string;
      nodeId: string;
      submapId?: string;
      newSubmapId?: string | null;
      updates: Partial<MapNode>;
    };

    if (!seaCode || !nodeId || !updates) {
      return NextResponse.json(
        { error: "Missing seaCode, nodeId, or updates" },
        { status: 400 },
      );
    }

    const sea = findSea(data, seaCode);

    if (!sea) {
      return NextResponse.json(
        { error: `Sea "${seaCode}" not found` },
        { status: 404 },
      );
    }

    // Find node in submap or base sea
    let node: MapNode | undefined;
    if (nodeSubmapId) {
      const submap = sea.submaps?.find((sm) => sm.id === nodeSubmapId);
      if (!submap) {
        return NextResponse.json(
          { error: `Submap "${nodeSubmapId}" not found in sea "${seaCode}"` },
          { status: 404 },
        );
      }
      node = (submap.nodes ?? []).find((n) => n.id === nodeId);
    } else {
      node = sea.nodes.find((n) => n.id === nodeId);
    }

    if (!node) {
      return NextResponse.json(
        { error: `Node "${nodeId}" not found in sea "${seaCode}"` },
        { status: 404 },
      );
    }

    // Determine if we need to move the node to a different submap
    const resolvedNewSubmapId = nodeNewSubmapId === null ? undefined : nodeNewSubmapId;
    const needsMove = nodeNewSubmapId !== undefined && resolvedNewSubmapId !== (nodeSubmapId ?? undefined);

    if (needsMove) {
      // Remove node from current location
      if (nodeSubmapId) {
        const submap = sea.submaps!.find((sm) => sm.id === nodeSubmapId)!;
        submap.nodes = (submap.nodes ?? []).filter((n) => n.id !== nodeId);
      } else {
        sea.nodes = sea.nodes.filter((n) => n.id !== nodeId);
      }

      // Add node to target location
      if (resolvedNewSubmapId) {
        const targetSubmap = sea.submaps?.find((sm) => sm.id === resolvedNewSubmapId);
        if (!targetSubmap) {
          return NextResponse.json(
            { error: `Target submap "${resolvedNewSubmapId}" not found in sea "${seaCode}"` },
            { status: 404 },
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
    if (updates.meta !== undefined) node.meta = updates.meta;

    // If the node ID changed, update all edges referencing the old ID
    if (updates.id !== undefined && updates.id !== nodeId) {
      for (const edge of sea.edges) {
        if (edge.from === nodeId) edge.from = updates.id;
        if (edge.to === nodeId) edge.to = updates.id;
      }
      // Also update edges in all submaps
      if (sea.submaps) {
        for (const submap of sea.submaps) {
          for (const edge of submap.edges) {
            if (edge.from === nodeId) edge.from = updates.id;
            if (edge.to === nodeId) edge.to = updates.id;
          }
        }
      }
    }

    writeMapsData(data);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("PUT /api/maps error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// ---------------------------------------------------------------------------
// DELETE: Remove a node (and its edges), an edge, a sea, or a group
// Body: { target: "nodes", seaCode: string, nodeId: string }
//    or { target: "edges", seaCode: string, from: string, to: string }
//    or { target: "seas", seaCode: string }
//    or { target: "groups", groupId: string, force?: boolean }
// ---------------------------------------------------------------------------
export async function DELETE(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json();
    const { target } = body as { target: string };

    if (!target) {
      return NextResponse.json(
        { error: "Missing target" },
        { status: 400 },
      );
    }

    const data = readMapsData();

    // --- Delete a sea ---
    if (target === "seas") {
      const { seaCode } = body as { seaCode: string };
      if (!seaCode) {
        return NextResponse.json(
          { error: "Missing seaCode" },
          { status: 400 },
        );
      }
      let found = false;
      for (const group of data.groups) {
        const seaIndex = group.seas.findIndex((s) => s.code === seaCode);
        if (seaIndex !== -1) {
          group.seas.splice(seaIndex, 1);
          found = true;
          break;
        }
      }
      if (!found) {
        return NextResponse.json(
          { error: `Sea "${seaCode}" not found` },
          { status: 404 },
        );
      }
      writeMapsData(data);
      return NextResponse.json({ success: true });
    }

    // --- Delete a group ---
    if (target === "groups") {
      const { groupId, force } = body as {
        groupId: string;
        force?: boolean;
      };
      if (!groupId) {
        return NextResponse.json(
          { error: "Missing groupId" },
          { status: 400 },
        );
      }
      const groupIndex = data.groups.findIndex((g) => g.id === groupId);
      if (groupIndex === -1) {
        return NextResponse.json(
          { error: `Group "${groupId}" not found` },
          { status: 404 },
        );
      }
      const group = data.groups[groupIndex];
      if (group.seas.length > 0 && !force) {
        return NextResponse.json(
          {
            error: `Group "${groupId}" has ${group.seas.length} sea(s). Use force: true to cascade delete.`,
          },
          { status: 400 },
        );
      }
      data.groups.splice(groupIndex, 1);
      writeMapsData(data);
      return NextResponse.json({ success: true });
    }

    // --- Existing: Delete node or edge (require seaCode) ---
    const { seaCode } = body as { seaCode: string };
    if (!seaCode) {
      return NextResponse.json(
        { error: "Missing seaCode" },
        { status: 400 },
      );
    }

    const sea = findSea(data, seaCode);
    if (!sea) {
      return NextResponse.json(
        { error: `Sea "${seaCode}" not found` },
        { status: 404 },
      );
    }

    if (target === "nodes") {
      const { nodeId, submapId } = body as { nodeId: string; submapId?: string };
      if (!nodeId) {
        return NextResponse.json(
          { error: "Missing nodeId" },
          { status: 400 },
        );
      }
      // Remove from submap nodes if submapId is specified
      if (submapId) {
        const submap = sea.submaps?.find((sm) => sm.id === submapId);
        if (!submap) {
          return NextResponse.json(
            { error: `Submap "${submapId}" not found in sea "${seaCode}"` },
            { status: 404 },
          );
        }
        const nodeIndex = (submap.nodes ?? []).findIndex((n) => n.id === nodeId);
        if (nodeIndex === -1) {
          return NextResponse.json(
            { error: `Node "${nodeId}" not found in submap "${submapId}"` },
            { status: 404 },
          );
        }
        submap.nodes!.splice(nodeIndex, 1);
      } else {
        const nodeIndex = sea.nodes.findIndex((n) => n.id === nodeId);
        if (nodeIndex === -1) {
          return NextResponse.json(
            { error: `Node "${nodeId}" not found` },
            { status: 404 },
          );
        }
        // Remove node from base
        sea.nodes.splice(nodeIndex, 1);
      }
      // Remove all edges referencing this node (from base and all submaps)
      sea.edges = sea.edges.filter(
        (e) => e.from !== nodeId && e.to !== nodeId,
      );
      if (sea.submaps) {
        for (const sm of sea.submaps) {
          sm.edges = sm.edges.filter(
            (e) => e.from !== nodeId && e.to !== nodeId,
          );
        }
      }
      writeMapsData(data);
      return NextResponse.json({ success: true });
    }

    if (target === "edges") {
      const { from, to, submapId } = body as { from: string; to: string; submapId?: string };
      if (!from || !to) {
        return NextResponse.json(
          { error: "Missing from or to" },
          { status: 400 },
        );
      }
      // Delete from submap edges if submapId is specified
      if (submapId) {
        const submap = sea.submaps?.find((sm) => sm.id === submapId);
        if (!submap) {
          return NextResponse.json(
            { error: `Submap "${submapId}" not found in sea "${seaCode}"` },
            { status: 404 },
          );
        }
        const edgeIndex = submap.edges.findIndex(
          (e) => e.from === from && e.to === to,
        );
        if (edgeIndex === -1) {
          return NextResponse.json(
            { error: `Edge ${from}->${to} not found in submap "${submapId}"` },
            { status: 404 },
          );
        }
        submap.edges.splice(edgeIndex, 1);
      } else {
        const edgeIndex = sea.edges.findIndex(
          (e) => e.from === from && e.to === to,
        );
        if (edgeIndex === -1) {
          return NextResponse.json(
            { error: `Edge ${from}->${to} not found` },
            { status: 404 },
          );
        }
        sea.edges.splice(edgeIndex, 1);
      }
      writeMapsData(data);
      return NextResponse.json({ success: true });
    }

    // --- Delete a submap ---
    if (target === "submaps") {
      const { submapId } = body as { submapId: string };
      if (!submapId) {
        return NextResponse.json(
          { error: "Missing submapId" },
          { status: 400 },
        );
      }
      if (!sea.submaps) {
        return NextResponse.json(
          { error: `No submaps in sea "${seaCode}"` },
          { status: 404 },
        );
      }
      const submapIndex = sea.submaps.findIndex((sm) => sm.id === submapId);
      if (submapIndex === -1) {
        return NextResponse.json(
          { error: `Submap "${submapId}" not found in sea "${seaCode}"` },
          { status: 404 },
        );
      }
      sea.submaps.splice(submapIndex, 1);
      // Remove empty submaps array
      if (sea.submaps.length === 0) {
        delete sea.submaps;
      }
      writeMapsData(data);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json(
      { error: `Unknown target: "${target}"` },
      { status: 400 },
    );
  } catch (err) {
    console.error("DELETE /api/maps error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
