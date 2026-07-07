"use client";

import { useMemo } from "react";

import { useMapDataStore } from "@/app/store/useMapDataStore";

export interface HeaderSeaInfo {
  code: string;
  name: string;
  submaps: { id: string; name: string }[];
}

export interface HeaderGroupInfo {
  id: string;
  name: string;
  seas: HeaderSeaInfo[];
  isEvent: boolean;
}

/** Group/sea summary for the header dialogs (sea selector, notes) */
export function useGroupData(): HeaderGroupInfo[] {
  const data = useMapDataStore((s) => s.data);
  return useMemo(() => {
    const groups: HeaderGroupInfo[] = [];
    for (const group of data?.groups ?? []) {
      groups.push({
        id: group.id,
        name: group.name,
        isEvent: group.meta?.type === "event",
        seas: group.seas.map((sea) => ({
          code: sea.code,
          name: sea.name,
          submaps: (sea.submaps ?? []).map((sm) => ({ id: sm.id, name: sm.name })),
        })),
      });
    }
    return groups;
  }, [data]);
}
