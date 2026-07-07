"use client";

import { useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import MuiCheckbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import IconButton from "@mui/material/IconButton";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Typography from "@mui/material/Typography";

import type { MapNode } from "@/app/types/maps";
import {
  blueCheckboxSx,
  darkSelectMenuProps,
  darkSelectSx,
} from "@/app/components/ui/panelStyles";
import type { EdgeWithSubmaps, SectionData } from "@/app/hooks/useMapSections";

interface EdgeEditorProps {
  sea: SectionData;
  sortedNodes: MapNode[];
  edgesWithSubmap: EdgeWithSubmaps[];
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

/** Edge add form + per-edge submap membership list (edit mode) */
export default function EdgeEditor({
  sea,
  sortedNodes,
  edgesWithSubmap,
  onAddEdge,
  onDeleteEdge,
  onToggleEdgeSubmap,
}: EdgeEditorProps) {
  const [edgeFrom, setEdgeFrom] = useState("");
  const [edgeTo, setEdgeTo] = useState("");
  const [edgeArrow, setEdgeArrow] = useState(false);

  const canAdd = !!edgeFrom && !!edgeTo && edgeFrom !== edgeTo;

  const handleAdd = () => {
    if (!canAdd) return;
    onAddEdge({ from: edgeFrom, to: edgeTo, arrow: edgeArrow });
    setEdgeFrom("");
    setEdgeTo("");
    setEdgeArrow(false);
  };

  return (
    <Box sx={{ px: 1.25, py: 1, borderTop: "1px solid rgba(255,255,255,0.2)" }}>
      <Typography sx={{ fontSize: 11, fontWeight: 700, mb: 0.75, opacity: 0.8 }}>
        Edges ({sea.key} - all)
      </Typography>

      {/* Add edge form */}
      <Box sx={{ display: "flex", gap: 0.5, mb: 0.75, flexWrap: "wrap" }}>
        <Select
          value={edgeFrom}
          onChange={(e) => setEdgeFrom(e.target.value)}
          displayEmpty
          size="small"
          sx={darkSelectSx}
          MenuProps={darkSelectMenuProps}
        >
          <MenuItem value="" sx={{ fontSize: 11 }}>
            From
          </MenuItem>
          {sortedNodes.map((n) => (
            <MenuItem key={n.id} value={n.id} sx={{ fontSize: 11 }}>
              {n.id}
            </MenuItem>
          ))}
        </Select>
        <Select
          value={edgeTo}
          onChange={(e) => setEdgeTo(e.target.value)}
          displayEmpty
          size="small"
          sx={darkSelectSx}
          MenuProps={darkSelectMenuProps}
        >
          <MenuItem value="" sx={{ fontSize: 11 }}>
            To
          </MenuItem>
          {sortedNodes.map((n) => (
            <MenuItem key={n.id} value={n.id} sx={{ fontSize: 11 }}>
              {n.id}
            </MenuItem>
          ))}
        </Select>
        <FormControlLabel
          control={
            <MuiCheckbox
              checked={edgeArrow}
              onChange={(e) => setEdgeArrow(e.target.checked)}
              size="small"
              sx={blueCheckboxSx(16)}
            />
          }
          label={<Typography sx={{ fontSize: 11 }}>Arrow</Typography>}
          sx={{ mx: 0, gap: 0.25 }}
        />
        <Button
          variant="contained"
          size="small"
          onClick={(e) => {
            e.stopPropagation();
            handleAdd();
          }}
          disabled={!canAdd}
          sx={{
            backgroundColor: canAdd ? "#3b82f6" : "#4b5563",
            color: "#fff",
            fontWeight: 600,
            fontSize: 11,
            px: 1,
            py: 0.25,
            minWidth: 0,
            textTransform: "none",
            "&:hover": { backgroundColor: canAdd ? "#2563eb" : "#4b5563" },
          }}
        >
          Add
        </Button>
      </Box>

      {/* Current edges list (grouped by identity, with inline submap checkboxes) */}
      <Box sx={{ maxHeight: 200, overflowY: "auto" }}>
        {edgesWithSubmap.map(({ edge, submapIds: edgeSubmapIds }) => (
          <Box
            key={`${edge.from}-${edge.to}`}
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 0.5,
              fontSize: 11,
              py: 0.375,
              fontFamily: "monospace",
              borderBottom: "1px solid rgba(255,255,255,0.05)",
            }}
          >
            <Typography
              component="span"
              sx={{ flex: "0 0 auto", minWidth: 60, fontSize: 11, fontFamily: "monospace" }}
            >
              {edge.from} {edge.arrow ? "->" : "--"} {edge.to}
            </Typography>
            <Box
              component="span"
              sx={{ display: "flex", gap: 0.25, flexWrap: "wrap", flex: "1 1 auto" }}
            >
              {[undefined, ...(sea.submaps ?? []).map((sm) => sm.id)].map((smId) => {
                const label =
                  smId === undefined
                    ? "B"
                    : (sea.submaps?.find((sm) => sm.id === smId)?.name ?? smId);
                const shortLabel = label.length > 6 ? label.slice(0, 6) : label;
                return (
                  <Box
                    component="label"
                    key={smId ?? "base"}
                    sx={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 0.125,
                      fontSize: 9,
                      cursor: "pointer",
                      backgroundColor: edgeSubmapIds.has(smId) ? "#1d4ed8" : "#374151",
                      borderRadius: 0.75,
                      px: 0.5,
                      py: 0.125,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={edgeSubmapIds.has(smId)}
                      onChange={(e) => {
                        e.stopPropagation();
                        onToggleEdgeSubmap(edge.from, edge.to, smId, e.target.checked, edge.arrow);
                      }}
                      style={{ width: 10, height: 10 }}
                    />
                    {shortLabel}
                  </Box>
                );
              })}
            </Box>
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                // Delete from all locations the edge belongs to
                for (const smId of edgeSubmapIds) {
                  onDeleteEdge(edge.from, edge.to, smId);
                }
              }}
              title={`Delete edge ${edge.from} -> ${edge.to} from all locations`}
              sx={{
                backgroundColor: "rgba(239,68,68,0.85)",
                color: "#fff",
                fontSize: 10,
                fontWeight: 700,
                borderRadius: 0.75,
                p: 0.25,
                lineHeight: 1.4,
                flex: "0 0 auto",
                "&:hover": { backgroundColor: "rgba(239,68,68,1)" },
                width: 20,
                height: 20,
              }}
            >
              ×
            </IconButton>
          </Box>
        ))}
        {edgesWithSubmap.length === 0 && (
          <Typography sx={{ fontSize: 11, opacity: 0.5 }}>No edges</Typography>
        )}
      </Box>
    </Box>
  );
}
