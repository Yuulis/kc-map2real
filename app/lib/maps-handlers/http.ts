import { NextResponse } from "next/server";

import type { MapSea, MapSubSea } from "@/app/types/maps";
import { findSeaInIndex, readIndex, readSea } from "@/app/lib/maps-io";

/** Error carrying an HTTP status, converted to a JSON response by the route */
export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export function jsonOk(): NextResponse {
  return NextResponse.json({ success: true });
}

export function jsonError(error: string, status: number): NextResponse {
  return NextResponse.json({ error }, { status });
}

/** Convert a thrown error into a JSON response (ApiError keeps its status) */
export function toErrorResponse(scope: string, err: unknown): NextResponse {
  if (err instanceof ApiError) {
    return jsonError(err.message, err.status);
  }
  console.error(`${scope} error:`, err);
  return jsonError("Internal server error", 500);
}

/** Load a sea file, throwing 404 when the code is not in the index */
export async function requireSea(seaCode: string | undefined): Promise<MapSea> {
  if (!seaCode) throw new ApiError("Missing seaCode", 400);
  const index = await readIndex();
  if (!findSeaInIndex(index, seaCode)) {
    throw new ApiError(`Sea "${seaCode}" not found`, 404);
  }
  return readSea(seaCode);
}

/** Find a submap in a sea, throwing 404 when absent */
export function requireSubmap(sea: MapSea, submapId: string): MapSubSea {
  const submap = sea.submaps?.find((sm) => sm.id === submapId);
  if (!submap) {
    throw new ApiError(`Submap "${submapId}" not found in sea "${sea.code}"`, 404);
  }
  return submap;
}
