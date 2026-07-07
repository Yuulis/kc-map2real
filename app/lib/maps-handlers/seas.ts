import type { NextResponse } from "next/server";

import type { MapSea } from "@/app/types/maps";
import {
  deleteSea as deleteSeaFile,
  findGroupInIndex,
  findSeaInIndex,
  readIndex,
  readSea,
  writeIndex,
  writeSea,
} from "@/app/lib/maps-io";
import { ApiError, jsonOk } from "@/app/lib/maps-handlers/http";

/** POST target: "seas" — add a new sea to a group */
export async function addSea(body: unknown): Promise<NextResponse> {
  const { groupId, sea } = body as {
    groupId: string;
    sea: { code: string; name: string };
  };
  if (!groupId || !sea || !sea.code || !sea.name) {
    throw new ApiError("Missing groupId, sea.code, or sea.name", 400);
  }
  const index = await readIndex();
  const group = findGroupInIndex(index, groupId);
  if (!group) {
    throw new ApiError(`Group "${groupId}" not found`, 404);
  }
  if (findSeaInIndex(index, sea.code)) {
    throw new ApiError(`Sea code "${sea.code}" already exists`, 409);
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
  return jsonOk();
}

/** PUT target: "seas" — rename a sea or change its code (renames the file) */
export async function updateSea(body: unknown): Promise<NextResponse> {
  const { seaCode, updates } = body as {
    seaCode: string;
    updates: { name?: string; code?: string };
  };
  if (!seaCode || !updates) {
    throw new ApiError("Missing seaCode or updates", 400);
  }
  const index = await readIndex();
  const result = findSeaInIndex(index, seaCode);
  if (!result) {
    throw new ApiError(`Sea "${seaCode}" not found`, 404);
  }
  const sea = await readSea(seaCode);

  if (updates.code !== undefined && updates.code !== seaCode) {
    if (findSeaInIndex(index, updates.code)) {
      throw new ApiError(`Sea code "${updates.code}" already exists`, 409);
    }
    // Update index entry, sea object, and rename the file
    result.sea.code = updates.code;
    sea.code = updates.code;
    await deleteSeaFile(seaCode);
  }
  if (updates.name !== undefined) {
    result.sea.name = updates.name;
    sea.name = updates.name;
  }
  await writeIndex(index);
  await writeSea(sea);
  return jsonOk();
}

/** DELETE target: "seas" — remove a sea from the index and delete its file */
export async function removeSea(body: unknown): Promise<NextResponse> {
  const { seaCode } = body as { seaCode: string };
  if (!seaCode) {
    throw new ApiError("Missing seaCode", 400);
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
    throw new ApiError(`Sea "${seaCode}" not found`, 404);
  }
  await writeIndex(index);
  await deleteSeaFile(seaCode);
  return jsonOk();
}
