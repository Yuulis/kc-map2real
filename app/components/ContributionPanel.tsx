"use client";

import { useState, useMemo, useCallback } from "react";
import { Copy, Download, LogOut, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import MuiCheckbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import Typography from "@mui/material/Typography";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import IconButton from "@mui/material/IconButton";
import type { MapSea, MapEdge } from "@/app/types/maps";

interface ContributionPanelProps {
  contributionData: MapSea;
  onContributionDataChange: (updated: MapSea) => void;
  onExit: () => void;
}

export default function ContributionPanel({
  contributionData,
  onContributionDataChange,
  onExit,
}: ContributionPanelProps) {
  const [edgeFrom, setEdgeFrom] = useState("");
  const [edgeTo, setEdgeTo] = useState("");
  const [edgeArrow, setEdgeArrow] = useState(false);

  // Sorted node list for edge dropdown selects
  const sortedNodes = useMemo(() => {
    return [...contributionData.nodes].sort((a, b) =>
      a.id.localeCompare(b.id)
    );
  }, [contributionData.nodes]);

  // Add edge to contribution data
  const handleAddEdge = useCallback(() => {
    if (!edgeFrom || !edgeTo || edgeFrom === edgeTo) return;

    // Check for duplicate
    const exists = contributionData.edges.some(
      (e) => e.from === edgeFrom && e.to === edgeTo
    );
    if (exists) {
      toast.error(`Edge ${edgeFrom} -> ${edgeTo} already exists`);
      return;
    }

    const newEdge: MapEdge = { from: edgeFrom, to: edgeTo };
    if (edgeArrow) newEdge.arrow = true;

    onContributionDataChange({
      ...contributionData,
      edges: [...contributionData.edges, newEdge],
    });
    toast.success(`Edge ${edgeFrom} -> ${edgeTo} added`);
    setEdgeFrom("");
    setEdgeTo("");
    setEdgeArrow(false);
  }, [edgeFrom, edgeTo, edgeArrow, contributionData, onContributionDataChange]);

  // Delete edge from contribution data
  const handleDeleteEdge = useCallback(
    (from: string, to: string) => {
      onContributionDataChange({
        ...contributionData,
        edges: contributionData.edges.filter(
          (e) => !(e.from === from && e.to === to)
        ),
      });
      toast.success(`Edge ${from} -> ${to} deleted`);
    },
    [contributionData, onContributionDataChange]
  );

  // Copy JSON to clipboard
  const handleCopyJson = useCallback(() => {
    const json = JSON.stringify(contributionData, null, 2);
    navigator.clipboard
      ?.writeText(json)
      .then(() => toast.success("JSON copied to clipboard"))
      .catch(() => toast.error("Failed to copy to clipboard"));
  }, [contributionData]);

  // Download JSON file
  const handleDownloadJson = useCallback(() => {
    const json = JSON.stringify(contributionData, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${contributionData.code}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(`Downloaded ${contributionData.code}.json`);
  }, [contributionData]);

  return (
    <Box>
      {/* Header */}
      <Box
        sx={{
          px: 1.25,
          py: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 1,
          borderBottom: "1px solid rgba(255,255,255,0.2)",
        }}
      >
        <Typography
          sx={{
            fontSize: 12,
            fontWeight: 700,
            color: "#4ade80",
          }}
        >
          Contribution Mode: {contributionData.code}
        </Typography>
        <IconButton
          size="small"
          onClick={onExit}
          title="Exit contribution mode"
          sx={{
            backgroundColor: "#4b5563",
            color: "#fff",
            borderRadius: 1,
            "&:hover": { backgroundColor: "#6b7280" },
            p: 0.5,
          }}
        >
          <LogOut size={12} />
        </IconButton>
      </Box>

      {/* Stats */}
      <Box sx={{ px: 1.25, py: 0.5 }}>
        <Typography sx={{ fontSize: 11, opacity: 0.7 }}>
          Nodes: {contributionData.nodes.length} | Edges:{" "}
          {contributionData.edges.length}
        </Typography>
      </Box>

      {/* Edge editor */}
      <Box
        sx={{
          px: 1.25,
          py: 0.75,
          borderTop: "1px solid rgba(255,255,255,0.2)",
        }}
      >
        <Typography
          sx={{ fontSize: 11, fontWeight: 700, mb: 0.75, opacity: 0.8 }}
        >
          Add Edge
        </Typography>

        {/* Add edge form */}
        <Box sx={{ display: "flex", gap: 0.5, mb: 0.75, flexWrap: "wrap" }}>
          <Select
            value={edgeFrom}
            onChange={(e) => setEdgeFrom(e.target.value as string)}
            displayEmpty
            size="small"
            sx={{
              flex: 1,
              minWidth: 60,
              backgroundColor: "#374151",
              color: "#fff",
              fontSize: 11,
              "& .MuiSelect-select": { py: 0.25, px: 0.5 },
              "& .MuiOutlinedInput-notchedOutline": {
                borderColor: "#6b7280",
              },
              "&:hover .MuiOutlinedInput-notchedOutline": {
                borderColor: "#9ca3af",
              },
              "& .MuiSvgIcon-root": { color: "#fff", fontSize: 16 },
            }}
            MenuProps={{
              slotProps: {
                paper: {
                  sx: { backgroundColor: "#374151", color: "#fff" },
                },
              },
            }}
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
            onChange={(e) => setEdgeTo(e.target.value as string)}
            displayEmpty
            size="small"
            sx={{
              flex: 1,
              minWidth: 60,
              backgroundColor: "#374151",
              color: "#fff",
              fontSize: 11,
              "& .MuiSelect-select": { py: 0.25, px: 0.5 },
              "& .MuiOutlinedInput-notchedOutline": {
                borderColor: "#6b7280",
              },
              "&:hover .MuiOutlinedInput-notchedOutline": {
                borderColor: "#9ca3af",
              },
              "& .MuiSvgIcon-root": { color: "#fff", fontSize: 16 },
            }}
            MenuProps={{
              slotProps: {
                paper: {
                  sx: { backgroundColor: "#374151", color: "#fff" },
                },
              },
            }}
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
                sx={{
                  p: 0,
                  color: "#6b7280",
                  "&.Mui-checked": { color: "#90caf9" },
                  "& .MuiSvgIcon-root": { fontSize: 16 },
                }}
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
              handleAddEdge();
            }}
            disabled={!edgeFrom || !edgeTo || edgeFrom === edgeTo}
            startIcon={<Plus size={10} />}
            sx={{
              backgroundColor:
                !edgeFrom || !edgeTo || edgeFrom === edgeTo
                  ? "#4b5563"
                  : "#3b82f6",
              color: "#fff",
              fontWeight: 600,
              fontSize: 11,
              px: 1,
              py: 0.25,
              minWidth: 0,
              textTransform: "none",
              "&:hover": {
                backgroundColor:
                  !edgeFrom || !edgeTo || edgeFrom === edgeTo
                    ? "#4b5563"
                    : "#2563eb",
              },
            }}
          >
            Add
          </Button>
        </Box>

        {/* Edge list */}
        <Box sx={{ maxHeight: 160, overflowY: "auto" }}>
          {contributionData.edges.map((edge) => (
            <Box
              key={`${edge.from}-${edge.to}`}
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 0.5,
                fontSize: 11,
                py: 0.375,
                fontFamily: "monospace",
                borderBottom: "1px solid rgba(255,255,255,0.05)",
              }}
            >
              <Typography
                component="span"
                sx={{ fontSize: 11, fontFamily: "monospace" }}
              >
                {edge.from} {edge.arrow ? "->" : "--"} {edge.to}
              </Typography>
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteEdge(edge.from, edge.to);
                }}
                title={`Delete edge ${edge.from} -> ${edge.to}`}
                sx={{
                  backgroundColor: "rgba(239,68,68,0.85)",
                  color: "#fff",
                  borderRadius: 0.75,
                  p: 0.25,
                  flex: "0 0 auto",
                  "&:hover": { backgroundColor: "rgba(239,68,68,1)" },
                  width: 20,
                  height: 20,
                }}
              >
                <Trash2 size={10} />
              </IconButton>
            </Box>
          ))}
          {contributionData.edges.length === 0 && (
            <Typography sx={{ fontSize: 11, opacity: 0.5 }}>
              No edges
            </Typography>
          )}
        </Box>
      </Box>

      {/* Export section */}
      <Box
        sx={{
          px: 1.25,
          py: 1,
          borderTop: "1px solid rgba(255,255,255,0.2)",
        }}
      >
        <Typography
          sx={{ fontSize: 11, fontWeight: 700, mb: 0.75, opacity: 0.8 }}
        >
          Export
        </Typography>
        <Box sx={{ display: "flex", gap: 0.75, mb: 0.75 }}>
          <Button
            variant="contained"
            size="small"
            onClick={handleCopyJson}
            startIcon={<Copy size={10} />}
            sx={{
              backgroundColor: "#22c55e",
              color: "#000",
              fontWeight: 600,
              fontSize: 11,
              flex: 1,
              textTransform: "none",
              "&:hover": { backgroundColor: "#16a34a" },
            }}
          >
            Copy JSON
          </Button>
          <Button
            variant="contained"
            size="small"
            onClick={handleDownloadJson}
            startIcon={<Download size={10} />}
            sx={{
              backgroundColor: "#3b82f6",
              color: "#fff",
              fontWeight: 600,
              fontSize: 11,
              flex: 1,
              textTransform: "none",
              "&:hover": { backgroundColor: "#2563eb" },
            }}
          >
            Download
          </Button>
        </Box>
        <Typography sx={{ fontSize: 10, opacity: 0.5, lineHeight: 1.3 }}>
          Copy JSON and paste to GitHub Issue for contribution.
        </Typography>
      </Box>
    </Box>
  );
}
