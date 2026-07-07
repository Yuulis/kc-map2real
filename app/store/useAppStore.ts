"use client";

import { create } from "zustand";

import type { MapNode, MapSea } from "@/app/types/maps";
import {
  DEFAULT_MAP_STYLE_ID,
  isMapStyleId,
  STORAGE_KEYS,
  type MapStyleId,
} from "@/app/lib/constants";

export interface Pin {
  id: string;
  lat: number;
  lng: number;
  num: number;
}

export interface EditingNodeRef {
  node: MapNode;
  seaCode: string;
  submapId?: string;
}

interface EditDialogState {
  open: boolean;
  mode: "add" | "edit";
  pendingCoord: { lat: number; lng: number } | null;
  editingNode: EditingNodeRef | null;
}

interface AppState {
  /** True once localStorage-backed prefs have been read on the client */
  hydrated: boolean;
  devToolsEnabled: boolean;
  mapStyleId: MapStyleId;

  pinMode: boolean;
  editMode: boolean;
  pins: Pin[];

  contributionMode: boolean;
  contributionData: MapSea | null;

  /** null = show all seas (initial state) */
  activeSectionKeys: string[] | null;
  /** seaCode -> selected submap id (null/absent = base edges) */
  selectedSubmaps: Record<string, string | null>;
  /** seaCode -> visible submap ids (absent = all visible) */
  visibleSubmapNodes: Record<string, Set<string>>;

  editDialog: EditDialogState;

  hydratePrefs: () => void;
  setDevToolsEnabled: (enabled: boolean) => void;
  setMapStyleId: (id: MapStyleId) => void;
  setPinMode: (on: boolean) => void;
  togglePinMode: () => void;
  toggleEditMode: () => void;
  addPin: (lat: number, lng: number) => void;
  updatePin: (id: string, lat: number, lng: number) => void;
  removePin: (id: string) => void;
  clearPins: () => void;

  setContribution: (mode: boolean, data: MapSea | null) => void;
  setContributionData: (data: MapSea) => void;

  setActiveSectionKeys: (keys: string[] | null) => void;
  setSelectedSubmap: (seaCode: string, submapId: string | null) => void;
  toggleSubmapNodeVisibility: (
    seaCode: string,
    submapId: string,
    allSubmapIds: string[],
  ) => void;

  openAddNodeDialog: (lat: number, lng: number) => void;
  openEditNodeDialog: (node: MapNode, seaCode: string, submapId?: string) => void;
  closeEditDialog: () => void;
}

function readStoredPrefs(): { devToolsEnabled: boolean; mapStyleId: MapStyleId } {
  const prefs = { devToolsEnabled: false, mapStyleId: DEFAULT_MAP_STYLE_ID };
  try {
    if (localStorage.getItem(STORAGE_KEYS.devTools) === "1") {
      prefs.devToolsEnabled = true;
    }
    const style = localStorage.getItem(STORAGE_KEYS.mapStyle);
    if (style && isMapStyleId(style)) {
      prefs.mapStyleId = style;
    }
  } catch {
    // Ignore storage errors
  }
  return prefs;
}

function writeStorage(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // Ignore storage errors
  }
}

const CLOSED_DIALOG: EditDialogState = {
  open: false,
  mode: "add",
  pendingCoord: null,
  editingNode: null,
};

export const useAppStore = create<AppState>()((set) => ({
  hydrated: false,
  devToolsEnabled: false,
  mapStyleId: DEFAULT_MAP_STYLE_ID,

  pinMode: false,
  editMode: false,
  pins: [],

  contributionMode: false,
  contributionData: null,

  activeSectionKeys: null,
  selectedSubmaps: {},
  visibleSubmapNodes: {},

  editDialog: CLOSED_DIALOG,

  hydratePrefs: () => set({ ...readStoredPrefs(), hydrated: true }),

  setDevToolsEnabled: (enabled) => {
    writeStorage(STORAGE_KEYS.devTools, enabled ? "1" : null);
    set(
      enabled
        ? { devToolsEnabled: true }
        : { devToolsEnabled: false, editMode: false, pinMode: false },
    );
  },

  setMapStyleId: (id) => {
    writeStorage(STORAGE_KEYS.mapStyle, id);
    set({ mapStyleId: id });
  },

  setPinMode: (on) => set({ pinMode: on }),
  togglePinMode: () => set((s) => ({ pinMode: !s.pinMode })),
  toggleEditMode: () => set((s) => ({ editMode: !s.editMode })),

  addPin: (lat, lng) =>
    set((s) => ({
      pins: [...s.pins, { id: `pin-${Date.now()}`, lat, lng, num: s.pins.length + 1 }],
    })),
  updatePin: (id, lat, lng) =>
    set((s) => ({
      pins: s.pins.map((p) => (p.id === id ? { ...p, lat, lng } : p)),
    })),
  removePin: (id) => set((s) => ({ pins: s.pins.filter((p) => p.id !== id) })),
  clearPins: () => set({ pins: [] }),

  setContribution: (mode, data) =>
    set(
      mode
        ? { contributionMode: true, contributionData: data, editMode: false, pinMode: false }
        : { contributionMode: false, contributionData: null },
    ),
  setContributionData: (data) => set({ contributionData: data }),

  setActiveSectionKeys: (keys) => set({ activeSectionKeys: keys }),

  setSelectedSubmap: (seaCode, submapId) =>
    set((s) => ({ selectedSubmaps: { ...s.selectedSubmaps, [seaCode]: submapId } })),

  toggleSubmapNodeVisibility: (seaCode, submapId, allSubmapIds) =>
    set((s) => {
      // On first toggle, initialize with all submap ids (all visible), then toggle
      const current = s.visibleSubmapNodes[seaCode] ?? new Set(allSubmapIds);
      const next = new Set(current);
      if (next.has(submapId)) next.delete(submapId);
      else next.add(submapId);
      return { visibleSubmapNodes: { ...s.visibleSubmapNodes, [seaCode]: next } };
    }),

  openAddNodeDialog: (lat, lng) =>
    set({
      editDialog: { open: true, mode: "add", pendingCoord: { lat, lng }, editingNode: null },
    }),
  openEditNodeDialog: (node, seaCode, submapId) =>
    set({
      editDialog: {
        open: true,
        mode: "edit",
        pendingCoord: null,
        editingNode: { node, seaCode, submapId },
      },
    }),
  closeEditDialog: () => set({ editDialog: CLOSED_DIALOG }),
}));
