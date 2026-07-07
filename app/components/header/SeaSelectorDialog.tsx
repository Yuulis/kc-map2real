"use client";

import { useCallback, useMemo } from "react";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import IconButton from "@mui/material/IconButton";
import Typography from "@mui/material/Typography";
import useMediaQuery from "@mui/material/useMediaQuery";
import { X } from "lucide-react";

import { MOBILE_MEDIA_QUERY } from "@/app/lib/constants";
import { seaBounds } from "@/app/lib/geo";
import { mapRefHolder } from "@/app/lib/map-ref";
import { useAppStore } from "@/app/store/useAppStore";
import { useMapDataStore } from "@/app/store/useMapDataStore";
import { useGroupData, type HeaderGroupInfo } from "@/app/hooks/useGroupData";

const FIT_BOUNDS_OPTIONS = { padding: 100, duration: 800, maxZoom: 11 };

/** Sea area selector dialog with per-sea toggle, group toggle, and auto-zoom */
export default function SeaSelectorDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const groupData = useGroupData();
  const data = useMapDataStore((s) => s.data);
  const activeSectionKeys = useAppStore((s) => s.activeSectionKeys);
  const setActiveSectionKeys = useAppStore((s) => s.setActiveSectionKeys);
  const isMobile = useMediaQuery(MOBILE_MEDIA_QUERY);

  const allCodes = useMemo(
    () => groupData.flatMap((g) => g.seas.map((s) => s.code)),
    [groupData],
  );
  // null = all seas visible (initial state)
  const activeKeys = activeSectionKeys ?? allCodes;

  // Fly to a sea's bounding box (nodes incl. submap nodes) when it is turned on
  const zoomToSea = useCallback(
    (code: string) => {
      const sea = data?.groups
        .flatMap((g) => g.seas)
        .find((s) => s.code === code);
      if (!sea) return;
      const nodes = [
        ...sea.nodes,
        ...(sea.submaps ?? []).flatMap((sm) => sm.nodes ?? []),
      ];
      const bounds = seaBounds(nodes);
      if (bounds) {
        mapRefHolder.current?.fitBounds(bounds, FIT_BOUNDS_OPTIONS);
      }
    },
    [data],
  );

  const toggleSea = useCallback(
    (code: string) => {
      const active = activeKeys.includes(code);
      setActiveSectionKeys(
        active ? activeKeys.filter((k) => k !== code) : [...activeKeys, code],
      );
      if (!active) zoomToSea(code);
    },
    [activeKeys, setActiveSectionKeys, zoomToSea],
  );

  const toggleGroup = useCallback(
    (group: HeaderGroupInfo) => {
      const groupCodes = group.seas.map((s) => s.code);
      const allSelected = groupCodes.every((c) => activeKeys.includes(c));
      if (allSelected) {
        setActiveSectionKeys(activeKeys.filter((k) => !groupCodes.includes(k)));
      } else {
        setActiveSectionKeys(Array.from(new Set([...activeKeys, ...groupCodes])));
      }
    },
    [activeKeys, setActiveSectionKeys],
  );

  const renderGroup = (group: HeaderGroupInfo) => {
    const groupCodes = group.seas.map((s) => s.code);
    const selectedCount = groupCodes.filter((c) => activeKeys.includes(c)).length;
    const allSelected = selectedCount === groupCodes.length;
    const noneSelected = selectedCount === 0;
    return (
      <Box key={group.id} sx={{ mb: 2.5, breakInside: "avoid" }}>
        {/* Group header with checkbox */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            mb: 1,
            borderBottom: "1px solid #222",
            pb: 0.5,
          }}
        >
          <Checkbox
            checked={allSelected}
            indeterminate={!allSelected && !noneSelected}
            onChange={() => toggleGroup(group)}
            size="small"
            sx={{
              p: 0,
              mr: 0.75,
              color: "#6b7280",
              "&.Mui-checked": { color: "#90caf9" },
              "&.MuiCheckbox-indeterminate": { color: "#90caf9" },
              "& .MuiSvgIcon-root": { fontSize: 18 },
            }}
          />
          <Typography
            variant="caption"
            sx={{
              color: "#6b7280",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
            }}
          >
            {group.name}
          </Typography>
        </Box>

        {/* Sea chips row */}
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75 }}>
          {group.seas.map((sea) => {
            const active = activeKeys.includes(sea.code);
            return (
              <Button
                key={sea.code}
                size="small"
                variant={active ? "contained" : "outlined"}
                title={`${sea.code} ${sea.name}`}
                onClick={() => toggleSea(sea.code)}
                sx={{
                  fontSize: "0.75rem",
                  fontWeight: 700,
                  textTransform: "none",
                  width: 56,
                  minWidth: 0,
                  px: 1.25,
                  py: 0.375,
                  backgroundColor: active ? "#fff" : "transparent",
                  color: active ? "#000" : "#9ca3af",
                  borderColor: active ? "#fff" : "#4b5563",
                  "&:hover": {
                    backgroundColor: active ? "#e5e7eb" : "rgba(255,255,255,0.08)",
                    borderColor: active ? "#e5e7eb" : "#9ca3af",
                  },
                }}
              >
                {sea.code}
              </Button>
            );
          })}
        </Box>
      </Box>
    );
  };

  const regularGroups = groupData.filter((g) => !g.isEvent);
  const eventGroups = groupData.filter((g) => g.isEvent);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      fullScreen={isMobile}
      slotProps={{
        paper: {
          sx: { backgroundColor: "#111111", color: "#fff", maxHeight: "95vh" },
        },
      }}
    >
      <DialogTitle
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderBottom: "1px solid #333",
          py: 1.25,
          px: 2,
        }}
      >
        <Typography component="span" variant="subtitle1" sx={{ fontWeight: 700 }}>
          海域選択
        </Typography>
        <IconButton size="small" onClick={onClose} sx={{ color: "#9ca3af" }}>
          <X size={18} />
        </IconButton>
      </DialogTitle>

      <DialogContent
        sx={{
          p: 0,
          display: "flex",
          flexDirection: isMobile ? "column" : "row",
          overflow: isMobile ? "auto" : "hidden",
        }}
      >
        {/* Left column: regular seas */}
        <Box
          sx={{
            flex: 1,
            p: 2,
            borderRight: isMobile ? "none" : "1px solid #222",
            columnCount: isMobile ? 1 : 2,
            columnGap: "24px",
          }}
        >
          {/* Select all / Deselect all */}
          <Box sx={{ display: "flex", gap: 1, mb: 2, breakInside: "avoid" }}>
            <Button
              size="small"
              variant="outlined"
              onClick={() => setActiveSectionKeys(allCodes)}
              sx={{
                fontSize: "0.7rem",
                textTransform: "none",
                color: "#9ca3af",
                borderColor: "#4b5563",
                "&:hover": { borderColor: "#9ca3af" },
              }}
            >
              全選択
            </Button>
            <Button
              size="small"
              variant="outlined"
              onClick={() => setActiveSectionKeys([])}
              sx={{
                fontSize: "0.7rem",
                textTransform: "none",
                color: "#9ca3af",
                borderColor: "#4b5563",
                "&:hover": { borderColor: "#9ca3af" },
              }}
            >
              全解除
            </Button>
          </Box>

          {regularGroups.map(renderGroup)}
        </Box>

        {/* Right column: event seas (only when event groups exist) */}
        {eventGroups.length > 0 && (
          <Box sx={{ width: isMobile ? "auto" : 320, p: 2, flexShrink: 0 }}>
            {eventGroups.map(renderGroup)}
          </Box>
        )}
      </DialogContent>
    </Dialog>
  );
}
