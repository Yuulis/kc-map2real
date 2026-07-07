"use client";

import { useEffect, useState } from "react";

import { useAppStore, type Pin } from "@/app/store/useAppStore";
import { useMapDataStore } from "@/app/store/useMapDataStore";
import { useMapSections } from "@/app/hooks/useMapSections";
import { useEditActions } from "@/app/hooks/useEditActions";
import { useContribution } from "@/app/hooks/useContribution";
import MapView from "@/app/components/map/MapView";
import LayerSwitcher from "@/app/components/map/LayerSwitcher";
import MapDataOverlay from "@/app/components/MapDataOverlay";
import FloatingPanel from "@/app/components/panels/FloatingPanel";
import PinEditDialog from "@/app/components/panels/PinEditDialog";
import NodeEditDialog from "@/app/components/NodeEditDialog";
import SeaManagerDialog from "@/app/components/SeaManagerDialog";

export default function Home() {
  const hydratePrefs = useAppStore((s) => s.hydratePrefs);
  const load = useMapDataStore((s) => s.load);

  useEffect(() => {
    hydratePrefs();
    load();
  }, [hydratePrefs, load]);

  const {
    allSeas,
    allNodes,
    geoJsonCollections,
    singleActiveSea,
    activeSeaEdgesWithSubmap,
    sortedSeaNodes,
    findSeaForNode,
    findNodeSubmapMemberships,
    getNodePopupContext,
  } = useMapSections();

  const editActions = useEditActions(singleActiveSea, findNodeSubmapMemberships);
  const contribution = useContribution(singleActiveSea, allSeas);

  const editDialog = useAppStore((s) => s.editDialog);
  const closeEditDialog = useAppStore((s) => s.closeEditDialog);
  const contributionMode = useAppStore((s) => s.contributionMode);
  const contributionData = useAppStore((s) => s.contributionData);
  const selectedSubmaps = useAppStore((s) => s.selectedSubmaps);
  const updatePin = useAppStore((s) => s.updatePin);
  const removePin = useAppStore((s) => s.removePin);

  const fullMapsData = useMapDataStore((s) => s.data);
  const reload = useMapDataStore((s) => s.reload);

  const [selectedPin, setSelectedPin] = useState<Pin | null>(null);
  const [seaManagerOpen, setSeaManagerOpen] = useState(false);

  // Node edit dialog context (contribution mode overrides the sea/submap scope)
  const activeSubmapId = singleActiveSea
    ? (selectedSubmaps[singleActiveSea.key] ?? null)
    : null;
  const dialogSeaCode =
    contributionMode && contributionData
      ? contributionData.code
      : (editDialog.editingNode?.seaCode ?? singleActiveSea?.key);
  const dialogSubmapIds = contributionMode
    ? []
    : editDialog.editingNode
      ? findNodeSubmapMemberships(
          editDialog.editingNode.seaCode,
          editDialog.editingNode.node.id,
        )
      : activeSubmapId
        ? [activeSubmapId]
        : [];

  return (
    <main
      style={{
        width: "100vw",
        height: "calc(100vh - 3rem)",
        marginTop: "3rem",
      }}
    >
      <MapView
        allNodes={allNodes}
        geoJsonCollections={geoJsonCollections}
        findSeaForNode={findSeaForNode}
        getNodePopupContext={getNodePopupContext}
        onPinSelect={setSelectedPin}
      />

      <MapDataOverlay />

      {selectedPin !== null && (
        <PinEditDialog
          key={selectedPin.id}
          pin={selectedPin}
          onSave={(lat, lng) => {
            updatePin(selectedPin.id, lat, lng);
            setSelectedPin(null);
          }}
          onDelete={() => {
            removePin(selectedPin.id);
            setSelectedPin(null);
          }}
          onClose={() => setSelectedPin(null)}
        />
      )}

      <FloatingPanel
        singleActiveSea={singleActiveSea}
        sortedSeaNodes={sortedSeaNodes}
        activeSeaEdgesWithSubmap={activeSeaEdgesWithSubmap}
        onOpenSeaManager={() => setSeaManagerOpen(true)}
        onToggleContribution={contribution.toggleContributionMode}
        onAddEdge={editActions.addEdge}
        onDeleteEdge={editActions.deleteEdge}
        onToggleEdgeSubmap={editActions.toggleEdgeSubmap}
      />

      <NodeEditDialog
        key={`${editDialog.open}-${editDialog.mode}-${editDialog.editingNode?.node.id ?? "new"}-${editDialog.pendingCoord?.lat ?? ""}-${editDialog.pendingCoord?.lng ?? ""}`}
        open={editDialog.open}
        mode={editDialog.mode}
        lat={editDialog.pendingCoord?.lat}
        lng={editDialog.pendingCoord?.lng}
        node={editDialog.editingNode?.node}
        seaCode={dialogSeaCode}
        submapIds={dialogSubmapIds}
        availableSeas={
          contributionMode && contributionData
            ? [{ code: contributionData.code, name: contributionData.name }]
            : allSeas
        }
        availableSubmaps={contributionMode ? [] : singleActiveSea?.submaps}
        onConfirm={contributionMode ? contribution.confirmNode : editActions.confirmNode}
        onDelete={contributionMode ? contribution.deleteNode : editActions.deleteNode}
        onClose={closeEditDialog}
      />

      <SeaManagerDialog
        open={seaManagerOpen}
        onClose={() => setSeaManagerOpen(false)}
        mapsData={fullMapsData}
        onDataChanged={reload}
      />

      <LayerSwitcher />
    </main>
  );
}
