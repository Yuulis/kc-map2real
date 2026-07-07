"use client";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import MuiCheckbox from "@mui/material/Checkbox";
import Typography from "@mui/material/Typography";

import { blueCheckboxSx, submapToggleSx } from "@/app/components/ui/panelStyles";
import { useAppStore } from "@/app/store/useAppStore";
import type { SectionData } from "@/app/hooks/useMapSections";

/** Base/submap edge-set switcher with per-submap node visibility checkboxes */
export default function SubmapSelector({ sea }: { sea: SectionData }) {
  const selectedSubmaps = useAppStore((s) => s.selectedSubmaps);
  const setSelectedSubmap = useAppStore((s) => s.setSelectedSubmap);
  const visibleSubmapNodes = useAppStore((s) => s.visibleSubmapNodes);
  const toggleSubmapNodeVisibility = useAppStore((s) => s.toggleSubmapNodeVisibility);

  const submaps = sea.submaps ?? [];
  if (submaps.length === 0) return null;

  const selected = selectedSubmaps[sea.key] ?? null;
  const allSubmapIds = submaps.map((sm) => sm.id);

  return (
    <Box sx={{ px: 1.25, py: 0.75, borderTop: "1px solid rgba(255,255,255,0.2)" }}>
      <Typography sx={{ fontSize: 11, fontWeight: 700, mb: 0.5, opacity: 0.8 }}>
        Sub-map ({sea.key})
      </Typography>
      <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
        {/* Default (base edges) button */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
          <Button
            size="small"
            variant={!selected ? "contained" : "outlined"}
            onClick={() => setSelectedSubmap(sea.key, null)}
            sx={submapToggleSx(!selected)}
          >
            Base
          </Button>
        </Box>
        {submaps.map((sm) => {
          const nodeVisibility = visibleSubmapNodes[sea.key];
          const isNodeVisible = !nodeVisibility || nodeVisibility.has(sm.id);
          return (
            <Box key={sm.id} sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
              <MuiCheckbox
                checked={isNodeVisible}
                onChange={() => toggleSubmapNodeVisibility(sea.key, sm.id, allSubmapIds)}
                size="small"
                title={`${sm.name} ノード表示`}
                sx={blueCheckboxSx(18)}
              />
              <Button
                size="small"
                variant={selected === sm.id ? "contained" : "outlined"}
                onClick={() => setSelectedSubmap(sea.key, sm.id)}
                sx={submapToggleSx(selected === sm.id)}
              >
                {sm.name}
              </Button>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
