"use client";

import { useCallback } from "react";
import { toast } from "sonner";

import type { MapNode, MapSea } from "@/app/types/maps";
import { useAppStore } from "@/app/store/useAppStore";
import type { SeaRef, SectionData } from "@/app/hooks/useMapSections";

/**
 * Contribution mode: client-side-only editing of a single sea's copy,
 * exported as JSON for a pull request (no API writes).
 */
export function useContribution(singleActiveSea: SectionData | null, allSeas: SeaRef[]) {
  const contributionMode = useAppStore((s) => s.contributionMode);
  const contributionData = useAppStore((s) => s.contributionData);
  const setContribution = useAppStore((s) => s.setContribution);
  const setContributionData = useAppStore((s) => s.setContributionData);
  const editDialog = useAppStore((s) => s.editDialog);
  const closeEditDialog = useAppStore((s) => s.closeEditDialog);

  const toggleContributionMode = useCallback(() => {
    if (contributionMode) {
      setContribution(false, null);
      toast.success("Contribution mode OFF");
      return;
    }
    // Entering requires exactly one active sea
    if (!singleActiveSea) {
      toast.error("Please select exactly one sea area first");
      return;
    }
    const seaInfo = allSeas.find((s) => s.code === singleActiveSea.key);
    const mapSea: MapSea = {
      code: singleActiveSea.key,
      name: seaInfo?.name ?? singleActiveSea.key,
      meta: {},
      nodes: singleActiveSea.nodes.map((n) => ({ ...n })),
      edges: singleActiveSea.edges.map((e) => ({ ...e })),
    };
    setContribution(true, mapSea);
    toast.success(`Contribution mode ON: ${mapSea.code}`);
  }, [contributionMode, singleActiveSea, allSeas, setContribution]);

  // Add or edit a node in the local draft
  const confirmNode = useCallback(
    (_seaCode: string, node: MapNode, _submapIds: string[]) => {
      if (!contributionData) return;
      if (editDialog.mode === "add") {
        if (contributionData.nodes.some((n) => n.id === node.id)) {
          toast.error(`Node "${node.id}" already exists`);
          return;
        }
        setContributionData({
          ...contributionData,
          nodes: [...contributionData.nodes, node],
        });
        toast.success(`Node "${node.id}" added (local)`);
      } else {
        const originalId = editDialog.editingNode?.node.id ?? node.id;
        setContributionData({
          ...contributionData,
          nodes: contributionData.nodes.map((n) => (n.id === originalId ? node : n)),
          // If the id changed, update edges too
          edges:
            originalId !== node.id
              ? contributionData.edges.map((e) => ({
                  ...e,
                  from: e.from === originalId ? node.id : e.from,
                  to: e.to === originalId ? node.id : e.to,
                }))
              : contributionData.edges,
        });
        toast.success(`Node "${node.id}" updated (local)`);
      }
      closeEditDialog();
    },
    [contributionData, editDialog, setContributionData, closeEditDialog],
  );

  // Delete a node (and its edges) from the local draft
  const deleteNode = useCallback(
    (_seaCode: string, nodeId: string, _submapIds: string[]) => {
      if (!contributionData) return;
      setContributionData({
        ...contributionData,
        nodes: contributionData.nodes.filter((n) => n.id !== nodeId),
        edges: contributionData.edges.filter(
          (e) => e.from !== nodeId && e.to !== nodeId,
        ),
      });
      toast.success(`Node "${nodeId}" deleted (local)`);
      closeEditDialog();
    },
    [contributionData, setContributionData, closeEditDialog],
  );

  return { toggleContributionMode, confirmNode, deleteNode };
}
