import { NextRequest, NextResponse } from "next/server";

import { readFullMapsData } from "@/app/lib/maps-io";
import { jsonError, toErrorResponse } from "@/app/lib/maps-handlers/http";
import { addGroup, deleteGroup, updateGroup } from "@/app/lib/maps-handlers/groups";
import { addSea, removeSea, updateSea } from "@/app/lib/maps-handlers/seas";
import { addSubmap, deleteSubmap, updateSubmap } from "@/app/lib/maps-handlers/submaps";
import { addNode, deleteNode, updateNode } from "@/app/lib/maps-handlers/nodes";
import { addEdge, deleteEdge, moveEdge } from "@/app/lib/maps-handlers/edges";

// Editing API for the local dev tools. Handlers live in app/lib/maps-handlers/;
// this route only dispatches on the request's `target` field.

// ---------------------------------------------------------------------------
// GET: Return full MapsData (assembled from index + sea files)
// ---------------------------------------------------------------------------
export async function GET(): Promise<NextResponse> {
  try {
    const data = await readFullMapsData();
    return NextResponse.json(data);
  } catch (err) {
    return toErrorResponse("GET /api/maps", err);
  }
}

// ---------------------------------------------------------------------------
// POST: Add a node, edge, submap, sea, or group
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json();
    const { target } = body as { target?: string };
    switch (target) {
      case "nodes":
        return await addNode(body);
      case "edges":
        return await addEdge(body);
      case "submaps":
        return await addSubmap(body);
      case "seas":
        return await addSea(body);
      case "groups":
        return await addGroup(body);
      case undefined:
      case "":
        return jsonError("Missing target", 400);
      default:
        return jsonError(`Unknown target: "${target}"`, 400);
    }
  } catch (err) {
    return toErrorResponse("POST /api/maps", err);
  }
}

// ---------------------------------------------------------------------------
// PUT: Update a node (default), edge location, submap, sea, or group
// ---------------------------------------------------------------------------
export async function PUT(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json();
    const { target } = body as { target?: string };
    switch (target) {
      case "edges":
        return await moveEdge(body);
      case "submaps":
        return await updateSubmap(body);
      case "seas":
        return await updateSea(body);
      case "groups":
        return await updateGroup(body);
      default:
        // Backward compatible: node update needs no target
        return await updateNode(body);
    }
  } catch (err) {
    return toErrorResponse("PUT /api/maps", err);
  }
}

// ---------------------------------------------------------------------------
// DELETE: Remove a node (and its edges), an edge, a submap, a sea, or a group
// ---------------------------------------------------------------------------
export async function DELETE(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json();
    const { target } = body as { target?: string };
    switch (target) {
      case "nodes":
        return await deleteNode(body);
      case "edges":
        return await deleteEdge(body);
      case "submaps":
        return await deleteSubmap(body);
      case "seas":
        return await removeSea(body);
      case "groups":
        return await deleteGroup(body);
      case undefined:
      case "":
        return jsonError("Missing target", 400);
      default:
        return jsonError(`Unknown target: "${target}"`, 400);
    }
  } catch (err) {
    return toErrorResponse("DELETE /api/maps", err);
  }
}
