"use client";

import { useCallback, useMemo } from "react";

import type { MapEdge, MapNode } from "@/app/types/maps";
import { ALLOWED_NODE_TYPES, ARROW_OFFSET_KM } from "@/app/lib/constants";
import {
  buildArrowFeatureCollection,
  buildEdgeFeatureCollection,
} from "@/app/lib/geo";
import type { SectionGeoJson } from "@/app/components/map/SeaEdgeLayers";
import { useAppStore } from "@/app/store/useAppStore";
import { useMapDataStore } from "@/app/store/useMapDataStore";

export interface SubMapInfo {
  id: string;
  name: string;
  nodes?: MapNode[];
  edges: MapEdge[];
}

export interface SectionData {
  key: string;
  nodes: MapNode[];
  edges: MapEdge[];
  submaps?: SubMapInfo[];
}

export interface SeaRef {
  code: string;
  name: string;
}

export interface EdgeWithSubmaps {
  edge: MapEdge;
  /** Submap ids containing this edge; `undefined` entry = base edge set */
  submapIds: Set<string | undefined>;
}

export interface NodeLocation {
  seaCode: string;
  submapId?: string;
}

/**
 * Derives all view-layer data from the maps data + app selection state:
 * visible sections, GeoJSON collections, active-sea helpers.
 */
export function useMapSections() {
  const data = useMapDataStore((s) => s.data);
  const activeSectionKeys = useAppStore((s) => s.activeSectionKeys);
  const selectedSubmaps = useAppStore((s) => s.selectedSubmaps);
  const visibleSubmapNodes = useAppStore((s) => s.visibleSubmapNodes);
  const contributionMode = useAppStore((s) => s.contributionMode);
  const contributionData = useAppStore((s) => s.contributionData);

  // Flatten groups into per-sea sections
  const { sections, allSeas } = useMemo(() => {
    const sectionArr: SectionData[] = [];
    const seaArr: SeaRef[] = [];
    for (const group of data?.groups ?? []) {
      for (const sea of group.seas) {
        sectionArr.push({
          key: sea.code,
          nodes: sea.nodes,
          edges: sea.edges,
          submaps: sea.submaps?.map((sm) => ({
            id: sm.id,
            name: sm.name,
            nodes: sm.nodes,
            edges: sm.edges,
          })),
        });
        seaArr.push({ code: sea.code, name: sea.name });
      }
    }
    return { sections: sectionArr, allSeas: seaArr };
  }, [data]);

  const filteredSections = useMemo(() => {
    if (!activeSectionKeys) return sections; // Initially show all
    if (activeSectionKeys.length === 0) return [];
    return sections.filter((s) => activeSectionKeys.includes(s.key));
  }, [sections, activeSectionKeys]);

  // Resolve nodes/edges based on submap selection and node visibility.
  // Node visibility follows visibleSubmapNodes; edge set follows selectedSubmaps.
  const visibleSections = useMemo(() => {
    return filteredSections.map((s) => {
      // Collect node ids that belong to ANY submap
      const submapNodeIds = new Set<string>();
      for (const sm of s.submaps ?? []) {
        for (const n of sm.nodes ?? []) {
          submapNodeIds.add(n.id);
        }
      }
      // Base nodes = sea nodes NOT in any submap (always visible)
      const baseNodes = s.nodes.filter((n) => !submapNodeIds.has(n.id));

      // Add nodes from visible submaps (deduplicated by node id)
      const nodeVisibility = visibleSubmapNodes[s.key]; // undefined = all visible
      const seenNodeIds = new Set<string>(baseNodes.map((n) => n.id));
      const submapNodes: MapNode[] = [];
      for (const sm of s.submaps ?? []) {
        const isVisible = !nodeVisibility || nodeVisibility.has(sm.id);
        if (!isVisible) continue;
        for (const n of sm.nodes ?? []) {
          if (!seenNodeIds.has(n.id)) {
            seenNodeIds.add(n.id);
            submapNodes.push(n);
          }
        }
      }
      const mergedNodes = [...baseNodes, ...submapNodes];

      // Edge set: controlled by selectedSubmaps
      const submapId = selectedSubmaps[s.key];
      let edges = s.edges;
      if (submapId && s.submaps) {
        const submap = s.submaps.find((sm) => sm.id === submapId);
        if (submap) edges = submap.edges;
      }

      return { ...s, nodes: mergedNodes, edges };
    });
  }, [filteredSections, selectedSubmaps, visibleSubmapNodes]);

  // In contribution mode the local draft replaces the visible sections
  const renderSections = useMemo((): SectionData[] => {
    if (contributionMode && contributionData) {
      return [
        {
          key: contributionData.code,
          nodes: contributionData.nodes,
          edges: contributionData.edges,
        },
      ];
    }
    return visibleSections;
  }, [contributionMode, contributionData, visibleSections]);

  // All nodes (for Marker rendering)
  const allNodes = useMemo(
    () =>
      renderSections.flatMap((s) =>
        s.nodes.filter((n) => ALLOWED_NODE_TYPES.has(n.type)),
      ),
    [renderSections],
  );

  // Edge lines + arrow points as GeoJSON per section
  const geoJsonCollections = useMemo(
    (): SectionGeoJson[] =>
      renderSections.map((s) => ({
        key: s.key,
        edges: buildEdgeFeatureCollection(s.nodes, s.edges, s.key),
        arrows: buildArrowFeatureCollection(s.nodes, s.edges, s.key, ARROW_OFFSET_KM),
      })),
    [renderSections],
  );

  // Single active sea (for edge editing and submap selection)
  const singleActiveSea = useMemo(() => {
    if (filteredSections.length === 1) return filteredSections[0];
    return null;
  }, [filteredSections]);

  // All edges of the active sea grouped by identity, with submap memberships
  const activeSeaEdgesWithSubmap = useMemo((): EdgeWithSubmaps[] => {
    if (!singleActiveSea) return [];
    const edgeMap: Record<string, EdgeWithSubmaps> = {};
    const edgeKey = (e: MapEdge) => `${e.from}→${e.to}`;

    for (const e of singleActiveSea.edges) {
      const k = edgeKey(e);
      if (!edgeMap[k]) edgeMap[k] = { edge: e, submapIds: new Set() };
      edgeMap[k].submapIds.add(undefined); // base
    }
    for (const sm of singleActiveSea.submaps ?? []) {
      for (const e of sm.edges) {
        const k = edgeKey(e);
        if (!edgeMap[k]) edgeMap[k] = { edge: e, submapIds: new Set() };
        edgeMap[k].submapIds.add(sm.id);
      }
    }
    return Object.values(edgeMap);
  }, [singleActiveSea]);

  // Sorted unique nodes of the active sea (base + all submaps) for edge selects
  const sortedSeaNodes = useMemo(() => {
    if (!singleActiveSea) return [];
    const seen: Record<string, MapNode> = {};
    for (const n of singleActiveSea.nodes) {
      seen[n.id] = n;
    }
    for (const sm of singleActiveSea.submaps ?? []) {
      for (const n of sm.nodes ?? []) {
        seen[n.id] = n;
      }
    }
    return Object.values(seen).sort((a, b) => a.id.localeCompare(b.id));
  }, [singleActiveSea]);

  // Find which sea (and optionally submap) a node belongs to
  const findSeaForNode = useCallback(
    (nodeId: string, lat: number, lng: number): NodeLocation | undefined => {
      for (const s of filteredSections) {
        // Check submap nodes first (more specific)
        for (const sm of s.submaps ?? []) {
          const found = (sm.nodes ?? []).find(
            (n) => n.id === nodeId && n.lat === lat && n.lng === lng,
          );
          if (found) return { seaCode: s.key, submapId: sm.id };
        }
        const found = s.nodes.find(
          (n) => n.id === nodeId && n.lat === lat && n.lng === lng,
        );
        if (found) return { seaCode: s.key };
      }
      return undefined;
    },
    [filteredSections],
  );

  // All submap ids of a sea that contain the given node
  const findNodeSubmapMemberships = useCallback(
    (seaCode: string, nodeId: string): string[] => {
      const section = filteredSections.find((s) => s.key === seaCode);
      if (!section || !section.submaps) return [];
      const result: string[] = [];
      for (const sm of section.submaps) {
        if ((sm.nodes ?? []).some((n) => n.id === nodeId)) {
          result.push(sm.id);
        }
      }
      return result;
    },
    [filteredSections],
  );

  // Node info for the read-only popup: sea label + submap display names
  const getNodePopupContext = useCallback(
    (node: MapNode): { seaLabel?: string; submapNames: string[] } => {
      const loc = findSeaForNode(node.id, node.lat, node.lng);
      if (!loc) return { submapNames: [] };
      const section = filteredSections.find((s) => s.key === loc.seaCode);
      const seaName = allSeas.find((s) => s.code === loc.seaCode)?.name;
      const submapNames = findNodeSubmapMemberships(loc.seaCode, node.id).map(
        (id) => section?.submaps?.find((sm) => sm.id === id)?.name ?? id,
      );
      return {
        seaLabel: seaName ? `${loc.seaCode} ${seaName}` : loc.seaCode,
        submapNames,
      };
    },
    [findSeaForNode, findNodeSubmapMemberships, filteredSections, allSeas],
  );

  return {
    sections,
    allSeas,
    filteredSections,
    visibleSections,
    allNodes,
    geoJsonCollections,
    singleActiveSea,
    activeSeaEdgesWithSubmap,
    sortedSeaNodes,
    findSeaForNode,
    findNodeSubmapMemberships,
    getNodePopupContext,
  };
}
