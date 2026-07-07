import type { NextResponse } from "next/server";

import { deleteSea, findGroupInIndex, readIndex, writeIndex } from "@/app/lib/maps-io";
import { ApiError, jsonOk } from "@/app/lib/maps-handlers/http";

/** POST target: "groups" — add a new group */
export async function addGroup(body: unknown): Promise<NextResponse> {
  const { group } = body as { group: { id: string; name: string } };
  if (!group || !group.id || !group.name) {
    throw new ApiError("Missing group.id or group.name", 400);
  }
  const index = await readIndex();
  if (findGroupInIndex(index, group.id)) {
    throw new ApiError(`Group "${group.id}" already exists`, 409);
  }
  index.groups.push({ id: group.id, name: group.name, meta: {}, seas: [] });
  await writeIndex(index);
  return jsonOk();
}

/** PUT target: "groups" — rename a group or change its id */
export async function updateGroup(body: unknown): Promise<NextResponse> {
  const { groupId, updates } = body as {
    groupId: string;
    updates: { name?: string; id?: string };
  };
  if (!groupId || !updates) {
    throw new ApiError("Missing groupId or updates", 400);
  }
  const index = await readIndex();
  const group = findGroupInIndex(index, groupId);
  if (!group) {
    throw new ApiError(`Group "${groupId}" not found`, 404);
  }
  if (updates.id !== undefined && updates.id !== groupId) {
    if (findGroupInIndex(index, updates.id)) {
      throw new ApiError(`Group "${updates.id}" already exists`, 409);
    }
    group.id = updates.id;
  }
  if (updates.name !== undefined) {
    group.name = updates.name;
  }
  await writeIndex(index);
  return jsonOk();
}

/** DELETE target: "groups" — remove a group (cascade with force) */
export async function deleteGroup(body: unknown): Promise<NextResponse> {
  const { groupId, force } = body as { groupId: string; force?: boolean };
  if (!groupId) {
    throw new ApiError("Missing groupId", 400);
  }
  const index = await readIndex();
  const groupIndex = index.groups.findIndex((g) => g.id === groupId);
  if (groupIndex === -1) {
    throw new ApiError(`Group "${groupId}" not found`, 404);
  }
  const group = index.groups[groupIndex];
  if (group.seas.length > 0 && !force) {
    throw new ApiError(
      `Group "${groupId}" has ${group.seas.length} sea(s). Use force: true to cascade delete.`,
      400,
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
  return jsonOk();
}
