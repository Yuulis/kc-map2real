"use client";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";

import { useAppStore } from "@/app/store/useAppStore";

/** Scrollable list of placed pins with copy/clear actions */
export default function PinList() {
  const pins = useAppStore((s) => s.pins);
  const clearPins = useAppStore((s) => s.clearPins);

  if (pins.length === 0) return null;

  return (
    <Box sx={{ px: 1.25, pt: 0.5, pb: 1 }}>
      {/* Scrollable pin list */}
      <Box sx={{ maxHeight: 180, overflowY: "auto", mb: 0.75 }}>
        {pins.map((p) => (
          <Box
            key={p.id}
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 0.75,
              fontSize: 12,
              py: 0.25,
              fontFamily: "monospace",
            }}
          >
            <Box
              component="span"
              sx={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: 18,
                height: 18,
                backgroundColor: "#ef4444",
                borderRadius: "50%",
                fontSize: 10,
                fontWeight: 700,
                flexShrink: 0,
              }}
            >
              {p.num}
            </Box>
            <Typography component="span" sx={{ fontSize: 12, fontFamily: "monospace" }}>
              {p.lat.toFixed(6)}, {p.lng.toFixed(6)}
            </Typography>
          </Box>
        ))}
      </Box>

      {/* Action buttons */}
      <Box sx={{ display: "flex", gap: 0.75 }}>
        <Button
          variant="contained"
          size="small"
          onClick={(e) => {
            e.stopPropagation();
            const text = pins
              .map((p) => `{ "lat": ${p.lat.toFixed(6)}, "lng": ${p.lng.toFixed(6)} },`)
              .join("\n");
            navigator.clipboard?.writeText(text).catch(() => {});
          }}
          sx={{
            backgroundColor: "#22c55e",
            color: "#000",
            fontWeight: 600,
            fontSize: 12,
            flex: 1,
            textTransform: "none",
            "&:hover": { backgroundColor: "#16a34a" },
          }}
        >
          Copy All
        </Button>
        <Button
          variant="contained"
          size="small"
          onClick={(e) => {
            e.stopPropagation();
            clearPins();
          }}
          sx={{
            backgroundColor: "#6b7280",
            color: "#fff",
            fontWeight: 600,
            fontSize: 12,
            flex: 1,
            textTransform: "none",
            "&:hover": { backgroundColor: "#9ca3af" },
          }}
        >
          Clear
        </Button>
      </Box>
    </Box>
  );
}
