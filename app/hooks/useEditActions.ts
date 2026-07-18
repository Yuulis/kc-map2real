"use client";

import { useCallback } from "react";
import { toast } from "sonner";

import type { MapEdge, MapNode } from "@/app/types/maps";
import { useAppStore } from "@/app/store/useAppStore";
import { useMapDataStore } from "@/app/store/useMapDataStore";
import type { SectionData } from "@/app/hooks/useMapSections";

async function requestMaps(method: string, body: unknown): Promise<boolean> {
  const res = await fetch("/api/maps", {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json();
    toast.error(err.error ?? `Request failed (${method})`);
    return false;
  }
  return true;
}

/**
 * Persisted node/edge CRUD against /api/maps (dev tools only).
 * After each successful write, only the affected sea is refreshed.
 */
export function useEditActions(
  singleActiveSea: SectionData | null,
  findNodeSubmapMemberships: (seaCode: string, nodeId: string) => string[],
) {
  const refreshSea = useMapDataStore((s) => s.refreshSea);
  const editDialog = useAppStore((s) => s.editDialog);
  const closeEditDialog = useAppStore((s) => s.closeEditDialog);
  const selectedSubmaps = useAppStore((s) => s.selectedSubmaps);

  // Add or update a node (handles submap membership reconciliation)
  const confirmNode = useCallback(
    async (seaCode: string, node: MapNode, submapIds: string[]) => {
      try {
        if (editDialog.mode === "add") {
          if (submapIds.length === 0) {
            // Add to base only
            const ok = await requestMaps("POST", { target: "nodes", seaCode, node });
            if (!ok) return;
          } else {
            // Add to each selected submap
            for (const smId of submapIds) {
              const ok = await requestMaps("POST", {
                target: "nodes",
                seaCode,
                node,
                submapId: smId,
              });
              if (!ok) return;
            }
          }
          toast.success(
            `Node "${node.id}" added to ${seaCode}${submapIds.length > 0 ? ` (${submapIds.length} submap(s))` : ""}`,
          );
        } else {
          const originalId = editDialog.editingNode?.node.id ?? node.id;
          const currentSubmapIds = findNodeSubmapMemberships(seaCode, originalId);
          const currentSet = new Set(currentSubmapIds);
          const newSet = new Set(submapIds);

          // Primary location for the field update (first current submap, or base)
          const primarySubmapId =
            currentSubmapIds.length > 0 ? currentSubmapIds[0] : undefined;
          const updates = {
            id: node.id,
            type: node.type,
            name: node.name,
            lat: node.lat,
            lng: node.lng,
            bossDialogue: node.bossDialogue,
            meta: node.meta,
          };

          const ok = await requestMaps("PUT", {
            seaCode,
            nodeId: originalId,
            submapId: primarySubmapId,
            updates,
          });
          if (!ok) return;

          // Also update fields in other submaps where the node stays
          for (const smId of currentSubmapIds.slice(1)) {
            if (newSet.has(smId)) {
              await requestMaps("PUT", {
                seaCode,
                nodeId: originalId,
                submapId: smId,
                updates,
              });
            }
          }

          // Reconcile memberships: add to new submaps
          for (const smId of submapIds.filter((id) => !currentSet.has(id))) {
            await requestMaps("POST", { target: "nodes", seaCode, node, submapId: smId });
          }

          // Reconcile memberships: remove from old submaps
          for (const smId of currentSubmapIds.filter((id) => !newSet.has(id))) {
            await requestMaps("DELETE", {
              target: "nodes",
              seaCode,
              nodeId: originalId,
              submapId: smId,
            });
          }

          toast.success(`Node "${node.id}" updated`);
        }
        closeEditDialog();
        await refreshSea(seaCode);
      } catch {
        toast.error("Network error");
      }
    },
    [editDialog, findNodeSubmapMemberships, closeEditDialog, refreshSea],
  );

  // Delete a node from base or from each of its submaps
  const deleteNode = useCallback(
    async (seaCode: string, nodeId: string, submapIds: string[]) => {
      try {
        if (submapIds.length === 0) {
          const ok = await requestMaps("DELETE", { target: "nodes", seaCode, nodeId });
          if (!ok) return;
        } else {
          for (const smId of submapIds) {
            const ok = await requestMaps("DELETE", {
              target: "nodes",
              seaCode,
              nodeId,
              submapId: smId,
            });
            if (!ok) return;
          }
        }
        toast.success(`Node "${nodeId}" deleted from ${seaCode}`);
        closeEditDialog();
        await refreshSea(seaCode);
      } catch {
        toast.error("Network error");
      }
    },
    [closeEditDialog, refreshSea],
  );

  // Add an edge to the currently selected submap (or base)
  const addEdge = useCallback(
    async (edge: MapEdge) => {
      if (!singleActiveSea || !edge.from || !edge.to || edge.from === edge.to) return;
      const submapId = selectedSubmaps[singleActiveSea.key] ?? undefined;
      try {
        const ok = await requestMaps("POST", {
          target: "edges",
          seaCode: singleActiveSea.key,
          edge,
          submapId,
        });
        if (!ok) return;
        toast.success(`Edge ${edge.from} -> ${edge.to} added`);
        await refreshSea(singleActiveSea.key);
      } catch {
        toast.error("Network error");
      }
    },
    [singleActiveSea, selectedSubmaps, refreshSea],
  );

  // Delete an edge from an explicit location (undefined submapId = base)
  const deleteEdge = useCallback(
    async (from: string, to: string, submapId: string | undefined) => {
      if (!singleActiveSea) return;
      try {
        const ok = await requestMaps("DELETE", {
          target: "edges",
          seaCode: singleActiveSea.key,
          from,
          to,
          submapId,
        });
        if (!ok) return;
        toast.success(`Edge ${from} -> ${to} deleted`);
        await refreshSea(singleActiveSea.key);
      } catch {
        toast.error("Network error");
      }
    },
    [singleActiveSea, refreshSea],
  );

  // Toggle an edge's membership in a submap (or base)
  const toggleEdgeSubmap = useCallback(
    async (
      from: string,
      to: string,
      submapId: string | undefined,
      checked: boolean,
      arrow?: boolean,
    ) => {
      if (!singleActiveSea) return;
      try {
        if (checked) {
          const ok = await requestMaps("POST", {
            target: "edges",
            seaCode: singleActiveSea.key,
            edge: { from, to, arrow: arrow ?? false },
            submapId,
          });
          if (!ok) return;
          toast.success(`Edge ${from} -> ${to} added to ${submapId ?? "base"}`);
        } else {
          const ok = await requestMaps("DELETE", {
            target: "edges",
            seaCode: singleActiveSea.key,
            from,
            to,
            submapId,
          });
          if (!ok) return;
          toast.success(`Edge ${from} -> ${to} removed from ${submapId ?? "base"}`);
        }
        await refreshSea(singleActiveSea.key);
      } catch {
        toast.error("Network error");
      }
    },
    [singleActiveSea, refreshSea],
  );

  return { confirmNode, deleteNode, addEdge, deleteEdge, toggleEdgeSubmap };
}
