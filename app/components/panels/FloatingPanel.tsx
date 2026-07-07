"use client";

import { useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import useMediaQuery from "@mui/material/useMediaQuery";
import { ChevronDown, ChevronUp, GitPullRequest, MapIcon, Pencil } from "lucide-react";

import { MOBILE_MEDIA_QUERY } from "@/app/lib/constants";
import { useAppStore } from "@/app/store/useAppStore";
import type { EdgeWithSubmaps, SectionData } from "@/app/hooks/useMapSections";
import type { MapNode, MapSea } from "@/app/types/maps";
import ContributionPanel from "@/app/components/ContributionPanel";
import EdgeEditor from "@/app/components/panels/EdgeEditor";
import PinList from "@/app/components/panels/PinList";
import SubmapSelector from "@/app/components/panels/SubmapSelector";

interface FloatingPanelProps {
  singleActiveSea: SectionData | null;
  sortedSeaNodes: MapNode[];
  activeSeaEdgesWithSubmap: EdgeWithSubmaps[];
  onOpenSeaManager: () => void;
  onToggleContribution: () => void;
  onAddEdge: (edge: { from: string; to: string; arrow: boolean }) => void;
  onDeleteEdge: (from: string, to: string, submapId: string | undefined) => void;
  onToggleEdgeSubmap: (
    from: string,
    to: string,
    submapId: string | undefined,
    checked: boolean,
    arrow?: boolean,
  ) => void;
}

/** Bottom-right floating panel: mode toggles, pins, submap selector, edge editor */
export default function FloatingPanel({
  singleActiveSea,
  sortedSeaNodes,
  activeSeaEdgesWithSubmap,
  onOpenSeaManager,
  onToggleContribution,
  onAddEdge,
  onDeleteEdge,
  onToggleEdgeSubmap,
}: FloatingPanelProps) {
  const devToolsEnabled = useAppStore((s) => s.devToolsEnabled);
  const pinMode = useAppStore((s) => s.pinMode);
  const togglePinMode = useAppStore((s) => s.togglePinMode);
  const editMode = useAppStore((s) => s.editMode);
  const toggleEditMode = useAppStore((s) => s.toggleEditMode);
  const contributionMode = useAppStore((s) => s.contributionMode);
  const contributionData = useAppStore((s) => s.contributionData);
  const setContributionData = useAppStore((s) => s.setContributionData);
  const pinCount = useAppStore((s) => s.pins.length);

  const isMobile = useMediaQuery(MOBILE_MEDIA_QUERY);
  // Collapsed by default on mobile until the user toggles it explicitly
  const [collapsedOverride, setCollapsedOverride] = useState<boolean | null>(null);
  const collapsed = collapsedOverride ?? isMobile;

  const hasSubmaps = !!singleActiveSea?.submaps?.length;
  const visible = devToolsEnabled || contributionMode || hasSubmaps;
  if (!visible) return null;

  return (
    <Paper
      elevation={4}
      sx={{
        position: "fixed",
        right: 12,
        bottom: 12,
        zIndex: 60,
        backgroundColor: contributionMode
          ? "rgba(0,0,0,0.9)"
          : pinMode
            ? "rgba(239, 68, 68, 0.7)"
            : "rgba(0,0,0,0.85)",
        border: contributionMode
          ? "2px solid #22c55e"
          : pinMode
            ? "1px solid rgba(239, 68, 68, 1)"
            : "1px solid transparent",
        color: "#fff",
        borderRadius: 2,
        fontSize: 13,
        userSelect: "none",
        minWidth: collapsed ? 0 : 220,
        maxWidth: isMobile ? "calc(100vw - 24px)" : undefined,
        maxHeight: isMobile ? "60vh" : undefined,
        overflowY: isMobile ? "auto" : undefined,
      }}
    >
      {/* Collapse toggle (mobile) */}
      {isMobile && (
        <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
          <Button
            size="small"
            onClick={() => setCollapsedOverride(!collapsed)}
            startIcon={collapsed ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            sx={{
              color: "#fff",
              fontSize: 11,
              fontWeight: 600,
              textTransform: "none",
              px: 1,
              py: 0.5,
              minWidth: 0,
            }}
          >
            {collapsed ? "パネルを開く" : "閉じる"}
          </Button>
        </Box>
      )}

      {!collapsed && (
        <>
          {/* Header: mode toggles (only when developer tools are enabled) */}
          {devToolsEnabled && (
            <Box
              sx={{
                px: 1.25,
                py: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 1,
                borderBottom:
                  (pinMode && pinCount > 0) || (editMode && singleActiveSea)
                    ? "1px solid rgba(255,255,255,0.2)"
                    : "none",
              }}
            >
              {/* Pin mode toggle (hidden in contribution mode) */}
              {!contributionMode && (
                <Typography
                  component="span"
                  variant="body2"
                  onClick={togglePinMode}
                  sx={{ cursor: "pointer", flex: 1, fontSize: 13 }}
                >
                  {pinMode ? "Pin: ON" : "Pin: OFF"}
                  {pinMode && pinCount > 0 && (
                    <Typography component="span" sx={{ fontSize: 11, opacity: 0.8, ml: 0.5 }}>
                      {pinCount}
                    </Typography>
                  )}
                </Typography>
              )}

              {/* Edit mode toggle (hidden in contribution mode) */}
              {!contributionMode && (
                <Button
                  size="small"
                  variant="contained"
                  onClick={toggleEditMode}
                  title={editMode ? "Edit mode: ON" : "Edit mode: OFF"}
                  startIcon={<Pencil size={12} />}
                  sx={{
                    backgroundColor: editMode ? "#3b82f6" : "#4b5563",
                    "&:hover": { backgroundColor: editMode ? "#2563eb" : "#6b7280" },
                    fontSize: 11,
                    fontWeight: 600,
                    minWidth: 0,
                    px: 0.75,
                    py: 0.5,
                    textTransform: "none",
                  }}
                >
                  {editMode ? "ON" : "OFF"}
                </Button>
              )}

              {/* Sea manager button */}
              <IconButton
                size="small"
                onClick={onOpenSeaManager}
                title="Sea area management"
                sx={{
                  backgroundColor: "#4b5563",
                  color: "#fff",
                  borderRadius: 1,
                  "&:hover": { backgroundColor: "#6b7280" },
                  p: 0.75,
                }}
              >
                <MapIcon size={12} />
              </IconButton>

              {/* Contribution mode toggle */}
              <IconButton
                size="small"
                onClick={onToggleContribution}
                title={contributionMode ? "Contribution mode: ON" : "Contribution mode: OFF"}
                sx={{
                  backgroundColor: contributionMode ? "#16a34a" : "#4b5563",
                  color: "#fff",
                  borderRadius: 1,
                  "&:hover": { backgroundColor: contributionMode ? "#15803d" : "#6b7280" },
                  p: 0.75,
                }}
              >
                <GitPullRequest size={12} />
              </IconButton>
            </Box>
          )}

          {/* Pin list + actions */}
          {pinMode && <PinList />}

          {/* Sub-map selector (single active sea with submaps) */}
          {singleActiveSea && <SubmapSelector sea={singleActiveSea} />}

          {/* Contribution panel */}
          {contributionMode && contributionData && (
            <ContributionPanel
              contributionData={contributionData}
              onContributionDataChange={(data: MapSea) => setContributionData(data)}
              onExit={onToggleContribution}
            />
          )}

          {/* Edge editor (edit mode + single active sea, not in contribution mode) */}
          {editMode && singleActiveSea && !contributionMode && (
            <EdgeEditor
              sea={singleActiveSea}
              sortedNodes={sortedSeaNodes}
              edgesWithSubmap={activeSeaEdgesWithSubmap}
              onAddEdge={onAddEdge}
              onDeleteEdge={onDeleteEdge}
              onToggleEdgeSubmap={onToggleEdgeSubmap}
            />
          )}
        </>
      )}
    </Paper>
  );
}
