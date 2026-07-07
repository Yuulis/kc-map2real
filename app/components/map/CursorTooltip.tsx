"use client";

import Paper from "@mui/material/Paper";

export interface CursorCoord {
  lat: number;
  lng: number;
  x: number;
  y: number;
}

/** Coordinate tooltip following the cursor while pin mode is ON */
export default function CursorTooltip({ coord }: { coord: CursorCoord }) {
  return (
    <Paper
      elevation={0}
      sx={{
        position: "fixed",
        left: coord.x + 12,
        top: coord.y + 48 + 12,
        zIndex: 70,
        backgroundColor: "rgba(0,0,0,0.75)",
        color: "#fff",
        px: 1,
        py: 0.5,
        borderRadius: 1,
        fontSize: 12,
        pointerEvents: "none",
        whiteSpace: "nowrap",
      }}
    >
      lat: {coord.lat.toFixed(6)}, lng: {coord.lng.toFixed(6)}
    </Paper>
  );
}
