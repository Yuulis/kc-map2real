import { NextRequest, NextResponse } from "next/server";

import type { MapNode, MapEdge, MapSea, MapSubSea } from "@/app/types/maps";
import {
  readIndex,
  writeIndex,
  readSea,
  writeSea,
  deleteSea,
  readFullMapsData,
  findSeaInIndex,
  findGroupInIndex,
} from "@/app/lib/maps-io";

// ---------------------------------------------------------------------------
// GET: Return full MapsData (assembled from index + sea files)
// ---------------------------------------------------------------------------
export async function GET(): Promise<NextResponse> {
  try {
    const data = await readFullMapsData();
    return NextResponse.json(data);
  } catch (err) {
    console.error("GET /api/maps error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
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
      const index = await readIndex();
      const group = findGroupInIndex(index, groupId);
      if (!group) {
        return NextResponse.json(
          { error: `Group "${groupId}" not found` },
          { status: 404 },
        );
      }
      if (findSeaInIndex(index, sea.code)) {
        return NextResponse.json(
          { error: `Sea code "${sea.code}" already exists` },
          { status: 409 },
        );
      }
      // Add to index
      group.seas.push({ code: sea.code, name: sea.name, meta: {} });
      await writeIndex(index);
      // Create sea file
      const newSea: MapSea = {
        code: sea.code,
        name: sea.name,
        meta: {},
        nodes: [],
        edges: [],
      };
      await writeSea(newSea);
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
      const index = await readIndex();
      if (findGroupInIndex(index, group.id)) {
        return NextResponse.json(
          { error: `Group "${group.id}" already exists` },
          { status: 409 },
        );
      }
      index.groups.push({
        id: group.id,
        name: group.name,
        meta: {},
        seas: [],
      });
      await writeIndex(index);
      return NextResponse.json({ success: true });
    }

    // --- Add node, edge, or submap (require seaCode) ---
    const { seaCode } = body as { seaCode: string };
    if (!seaCode) {
      return NextResponse.json(
        { error: "Missing seaCode" },
        { status: 400 },
      );
    }

    const index = await readIndex();
    if (!findSeaInIndex(index, seaCode)) {
      return NextResponse.json(
        { error: `Sea "${seaCode}" not found` },
        { status: 404 },
      );
    }

    const sea = await readSea(seaCode);

    if (target === "nodes") {
      const { node, submapId } = body as { node: MapNode; submapId?: string };
      if (!node || !node.id || !node.type) {
        return NextResponse.json(
          { error: "Invalid node data" },
          { status: 400 },
        );
      }
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
      await writeSea(sea);
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
      const allNodeIds = new Set<string>(sea.nodes.map((n) => n.id));
      if (sea.submaps) {
        for (const sm of sea.submaps) {
          for (const n of sm.nodes ?? []) {
            allNodeIds.add(n.id);
          }
        }
      }
      if (!allNodeIds.has(edge.from) || !allNodeIds.has(edge.to)) {
        return NextResponse.json(
          { error: "Edge references non-existent node(s)" },
          { status: 400 },
        );
      }
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
      await writeSea(sea);
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
      await writeSea(sea);
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
      const index = await readIndex();
      const result = findSeaInIndex(index, seaCode);
      if (!result) {
        return NextResponse.json(
          { error: `Sea "${seaCode}" not found` },
          { status: 404 },
        );
      }
      const sea = await readSea(seaCode);

      if (updates.code !== undefined && updates.code !== seaCode) {
        if (findSeaInIndex(index, updates.code)) {
          return NextResponse.json(
            { error: `Sea code "${updates.code}" already exists` },
            { status: 409 },
          );
        }
        // Update index entry
        result.sea.code = updates.code;
        // Update sea object and rename file
        sea.code = updates.code;
        await deleteSea(seaCode);
      }
      if (updates.name !== undefined) {
        result.sea.name = updates.name;
        sea.name = updates.name;
      }
      await writeIndex(index);
      await writeSea(sea);
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
      const index = await readIndex();
      const group = findGroupInIndex(index, groupId);
      if (!group) {
        return NextResponse.json(
          { error: `Group "${groupId}" not found` },
          { status: 404 },
        );
      }
      if (updates.id !== undefined && updates.id !== groupId) {
        if (findGroupInIndex(index, updates.id)) {
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
      await writeIndex(index);
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
      const index = await readIndex();
      if (!findSeaInIndex(index, smSeaCode)) {
        return NextResponse.json(
          { error: `Sea "${smSeaCode}" not found` },
          { status: 404 },
        );
      }
      const sea = await readSea(smSeaCode);
      const submap = sea.submaps?.find((sm) => sm.id === submapId);
      if (!submap) {
        return NextResponse.json(
          { error: `Submap "${submapId}" not found in sea "${smSeaCode}"` },
          { status: 404 },
        );
      }
      if (smUpdates.id !== undefined && smUpdates.id !== submapId) {
        if (sea.submaps?.find((sm) => sm.id === smUpdates.id)) {
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
      await writeSea(sea);
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

      const index = await readIndex();
      if (!findSeaInIndex(index, edgeSeaCode)) {
        return NextResponse.json(
          { error: `Sea "${edgeSeaCode}" not found` },
          { status: 404 },
        );
      }
      const edgeSea = await readSea(edgeSeaCode);

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

      await writeSea(edgeSea);
      return NextResponse.json({ success: true });
    }

    // --- Update a node (backward compatible, target is optional) ---
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

    const index = await readIndex();
    if (!findSeaInIndex(index, seaCode)) {
      return NextResponse.json(
        { error: `Sea "${seaCode}" not found` },
        { status: 404 },
      );
    }
    const sea = await readSea(seaCode);

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
      if (sea.submaps) {
        for (const submap of sea.submaps) {
          for (const edge of submap.edges) {
            if (edge.from === nodeId) edge.from = updates.id;
            if (edge.to === nodeId) edge.to = updates.id;
          }
        }
      }
    }

    await writeSea(sea);
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

    // --- Delete a sea ---
    if (target === "seas") {
      const { seaCode } = body as { seaCode: string };
      if (!seaCode) {
        return NextResponse.json(
          { error: "Missing seaCode" },
          { status: 400 },
        );
      }
      const index = await readIndex();
      let found = false;
      for (const group of index.groups) {
        const seaIdx = group.seas.findIndex((s) => s.code === seaCode);
        if (seaIdx !== -1) {
          group.seas.splice(seaIdx, 1);
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
      await writeIndex(index);
      await deleteSea(seaCode);
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
      const index = await readIndex();
      const groupIndex = index.groups.findIndex((g) => g.id === groupId);
      if (groupIndex === -1) {
        return NextResponse.json(
          { error: `Group "${groupId}" not found` },
          { status: 404 },
        );
      }
      const group = index.groups[groupIndex];
      if (group.seas.length > 0 && !force) {
        return NextResponse.json(
          {
            error: `Group "${groupId}" has ${group.seas.length} sea(s). Use force: true to cascade delete.`,
          },
          { status: 400 },
        );
      }
      // Delete all sea files in the group
      for (const sea of group.seas) {
        try {
          await deleteSea(sea.code);
        } catch {
          // Sea file may not exist; ignore
        }
      }
      index.groups.splice(groupIndex, 1);
      await writeIndex(index);
      return NextResponse.json({ success: true });
    }

    // --- Delete node, edge, or submap (require seaCode) ---
    const { seaCode } = body as { seaCode: string };
    if (!seaCode) {
      return NextResponse.json(
        { error: "Missing seaCode" },
        { status: 400 },
      );
    }

    const index = await readIndex();
    if (!findSeaInIndex(index, seaCode)) {
      return NextResponse.json(
        { error: `Sea "${seaCode}" not found` },
        { status: 404 },
      );
    }
    const sea = await readSea(seaCode);

    if (target === "nodes") {
      const { nodeId, submapId } = body as { nodeId: string; submapId?: string };
      if (!nodeId) {
        return NextResponse.json(
          { error: "Missing nodeId" },
          { status: 400 },
        );
      }
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
      await writeSea(sea);
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
      await writeSea(sea);
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
      if (sea.submaps.length === 0) {
        delete sea.submaps;
      }
      await writeSea(sea);
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
