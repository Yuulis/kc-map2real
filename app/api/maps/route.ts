import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";

import type { MapsData, MapNode, MapEdge, MapSea, MapGroup } from "@/app/types/maps";

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
      const { node } = body as { node: MapNode };
      if (!node || !node.id || !node.type) {
        return NextResponse.json(
          { error: "Invalid node data" },
          { status: 400 },
        );
      }
      // Check for duplicate node ID in this sea
      const existing = sea.nodes.find((n) => n.id === node.id);
      if (existing) {
        return NextResponse.json(
          { error: `Node "${node.id}" already exists in sea "${seaCode}"` },
          { status: 409 },
        );
      }
      sea.nodes.push(node);
      writeMapsData(data);
      return NextResponse.json({ success: true });
    }

    if (target === "edges") {
      const { edge } = body as { edge: MapEdge };
      if (!edge || !edge.from || !edge.to) {
        return NextResponse.json(
          { error: "Invalid edge data" },
          { status: 400 },
        );
      }
      // Verify both nodes exist
      const fromNode = sea.nodes.find((n) => n.id === edge.from);
      const toNode = sea.nodes.find((n) => n.id === edge.to);
      if (!fromNode || !toNode) {
        return NextResponse.json(
          { error: "Edge references non-existent node(s)" },
          { status: 400 },
        );
      }
      sea.edges.push(edge);
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

    // --- Existing: Update a node (backward compatible, target is optional) ---
    const { seaCode, nodeId, updates } = body as {
      seaCode: string;
      nodeId: string;
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

    const nodeIndex = sea.nodes.findIndex((n) => n.id === nodeId);
    if (nodeIndex === -1) {
      return NextResponse.json(
        { error: `Node "${nodeId}" not found in sea "${seaCode}"` },
        { status: 404 },
      );
    }

    // Apply updates (only allowed fields)
    const node = sea.nodes[nodeIndex];
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
      const { nodeId } = body as { nodeId: string };
      if (!nodeId) {
        return NextResponse.json(
          { error: "Missing nodeId" },
          { status: 400 },
        );
      }
      const nodeIndex = sea.nodes.findIndex((n) => n.id === nodeId);
      if (nodeIndex === -1) {
        return NextResponse.json(
          { error: `Node "${nodeId}" not found` },
          { status: 404 },
        );
      }
      // Remove node
      sea.nodes.splice(nodeIndex, 1);
      // Remove all edges referencing this node
      sea.edges = sea.edges.filter(
        (e) => e.from !== nodeId && e.to !== nodeId,
      );
      writeMapsData(data);
      return NextResponse.json({ success: true });
    }

    if (target === "edges") {
      const { from, to } = body as { from: string; to: string };
      if (!from || !to) {
        return NextResponse.json(
          { error: "Missing from or to" },
          { status: 400 },
        );
      }
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
