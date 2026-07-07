import type { NextResponse } from "next/server";

import type { MapSubSea } from "@/app/types/maps";
import { writeSea } from "@/app/lib/maps-io";
import { ApiError, jsonOk, requireSea } from "@/app/lib/maps-handlers/http";

/** POST target: "submaps" — add a new submap to a sea */
export async function addSubmap(body: unknown): Promise<NextResponse> {
  const { seaCode, submap } = body as {
    seaCode: string;
    submap: { id: string; name: string };
  };
  if (!submap || !submap.id || !submap.name) {
    throw new ApiError("Missing submap.id or submap.name", 400);
  }
  const sea = await requireSea(seaCode);
  if (!sea.submaps) {
    sea.submaps = [];
  }
  if (sea.submaps.find((sm) => sm.id === submap.id)) {
    throw new ApiError(`Submap "${submap.id}" already exists in sea "${seaCode}"`, 409);
  }
  const newSubmap: MapSubSea = {
    id: submap.id,
    name: submap.name,
    nodes: [],
    edges: [],
  };
  sea.submaps.push(newSubmap);
  await writeSea(sea);
  return jsonOk();
}

/** PUT target: "submaps" — rename a submap or change its id */
export async function updateSubmap(body: unknown): Promise<NextResponse> {
  const { seaCode, submapId, updates } = body as {
    seaCode: string;
    submapId: string;
    updates: { name?: string; id?: string };
  };
  if (!seaCode || !submapId || !updates) {
    throw new ApiError("Missing seaCode, submapId, or updates", 400);
  }
  const sea = await requireSea(seaCode);
  const submap = sea.submaps?.find((sm) => sm.id === submapId);
  if (!submap) {
    throw new ApiError(`Submap "${submapId}" not found in sea "${seaCode}"`, 404);
  }
  if (updates.id !== undefined && updates.id !== submapId) {
    if (sea.submaps?.find((sm) => sm.id === updates.id)) {
      throw new ApiError(`Submap "${updates.id}" already exists`, 409);
    }
    submap.id = updates.id;
  }
  if (updates.name !== undefined) {
    submap.name = updates.name;
  }
  await writeSea(sea);
  return jsonOk();
}

/** DELETE target: "submaps" — remove a submap from a sea */
export async function deleteSubmap(body: unknown): Promise<NextResponse> {
  const { seaCode, submapId } = body as { seaCode: string; submapId: string };
  if (!submapId) {
    throw new ApiError("Missing submapId", 400);
  }
  const sea = await requireSea(seaCode);
  if (!sea.submaps) {
    throw new ApiError(`No submaps in sea "${seaCode}"`, 404);
  }
  const submapIndex = sea.submaps.findIndex((sm) => sm.id === submapId);
  if (submapIndex === -1) {
    throw new ApiError(`Submap "${submapId}" not found in sea "${seaCode}"`, 404);
  }
  sea.submaps.splice(submapIndex, 1);
  if (sea.submaps.length === 0) {
    delete sea.submaps;
  }
  await writeSea(sea);
  return jsonOk();
}
