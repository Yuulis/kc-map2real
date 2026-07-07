"use client";

import { create } from "zustand";

import type { MapsData } from "@/app/types/maps";
import { fetchMapsData, fetchSea } from "@/app/lib/maps-client";

export type MapDataStatus = "idle" | "loading" | "error" | "ready";

interface MapDataState {
  status: MapDataStatus;
  error: string | null;
  data: MapsData | null;
  /** Load once; no-op when already loading or loaded */
  load: () => Promise<void>;
  /** Full fresh reload (used after sea/group level changes) */
  reload: () => Promise<void>;
  /** Refresh a single sea in place (used after node/edge edits) */
  refreshSea: (code: string) => Promise<void>;
}

export const useMapDataStore = create<MapDataState>()((set, get) => ({
  status: "idle",
  error: null,
  data: null,

  load: async () => {
    if (get().status === "loading" || get().status === "ready") return;
    await get().reload();
  },

  reload: async () => {
    set({ status: "loading", error: null });
    try {
      const data = await fetchMapsData();
      set({ status: "ready", data, error: null });
    } catch (err) {
      console.error("maps data loading failed", err);
      set({ status: "error", error: err instanceof Error ? err.message : String(err) });
    }
  },

  refreshSea: async (code: string) => {
    const { data, reload } = get();
    if (!data) {
      await reload();
      return;
    }
    try {
      const sea = await fetchSea(code);
      set({
        data: {
          ...data,
          groups: data.groups.map((group) => ({
            ...group,
            seas: group.seas.map((s) => (s.code === code ? sea : s)),
          })),
        },
      });
    } catch {
      // Sea file might have been renamed/deleted — fall back to a full reload
      await reload();
    }
  },
}));
