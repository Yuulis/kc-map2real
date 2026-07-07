"use client";

import { useState } from "react";
import Paper from "@mui/material/Paper";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import { Layers } from "lucide-react";

import { MAP_STYLES } from "@/app/lib/constants";
import { useAppStore } from "@/app/store/useAppStore";

/** Bottom-left base map style switcher */
export default function LayerSwitcher() {
  const mapStyleId = useAppStore((s) => s.mapStyleId);
  const setMapStyleId = useAppStore((s) => s.setMapStyleId);
  const [open, setOpen] = useState(false);

  const currentLabel =
    MAP_STYLES.find((s) => s.id === mapStyleId)?.label ?? MAP_STYLES[0].label;

  return (
    <Paper
      elevation={4}
      sx={{
        position: "fixed",
        left: 12,
        bottom: 12,
        zIndex: 60,
        backgroundColor: "rgba(0,0,0,0.85)",
        color: "#fff",
        borderRadius: 2,
        userSelect: "none",
        minWidth: 0,
      }}
    >
      <Button
        size="small"
        onClick={() => setOpen((prev) => !prev)}
        startIcon={<Layers size={14} />}
        sx={{
          color: "#fff",
          fontSize: 11,
          fontWeight: 600,
          textTransform: "none",
          px: 1.25,
          py: 0.5,
          minWidth: 0,
          "&:hover": { backgroundColor: "rgba(255,255,255,0.1)" },
        }}
      >
        {currentLabel} {open ? "▲" : "▼"}
      </Button>
      {open && (
        <Box sx={{ px: 0.5, pb: 0.5 }}>
          {MAP_STYLES.map((s) => (
            <Button
              key={s.id}
              size="small"
              onClick={() => {
                setMapStyleId(s.id);
                setOpen(false);
              }}
              sx={{
                display: "flex",
                justifyContent: "flex-start",
                width: "100%",
                color: "#fff",
                fontSize: 11,
                fontWeight: mapStyleId === s.id ? 700 : 400,
                textTransform: "none",
                px: 1,
                py: 0.25,
                minWidth: 0,
                backgroundColor:
                  mapStyleId === s.id ? "rgba(59,130,246,0.3)" : "transparent",
                "&:hover": { backgroundColor: "rgba(255,255,255,0.1)" },
              }}
            >
              {mapStyleId === s.id ? "● " : "○ "}
              {s.label}
            </Button>
          ))}
        </Box>
      )}
    </Paper>
  );
}
