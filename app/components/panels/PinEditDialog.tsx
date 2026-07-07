"use client";

import { useState } from "react";
import Paper from "@mui/material/Paper";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";

import type { Pin } from "@/app/store/useAppStore";

const coordInputStyle: React.CSSProperties = {
  width: "100%",
  background: "#2a2a3e",
  border: "1px solid #4b5563",
  borderRadius: 4,
  padding: "6px 10px",
  color: "#fff",
  fontSize: 13,
  fontFamily: "monospace",
  outline: "none",
  boxSizing: "border-box",
};

interface PinEditDialogProps {
  pin: Pin;
  onSave: (lat: number, lng: number) => void;
  onDelete: () => void;
  onClose: () => void;
}

/** Centered dialog for editing/deleting a placed pin */
export default function PinEditDialog({ pin, onSave, onDelete, onClose }: PinEditDialogProps) {
  // Parent remounts this dialog (via key=pin.id) when a different pin is selected
  const [lat, setLat] = useState(pin.lat);
  const [lng, setLng] = useState(pin.lng);

  return (
    <Paper
      elevation={4}
      sx={{
        position: "fixed",
        left: "50%",
        top: "50%",
        transform: "translate(-50%, -50%)",
        zIndex: 1000,
        backgroundColor: "#1e1e2e",
        color: "#fff",
        p: 2,
        borderRadius: 2,
        minWidth: 240,
        border: "1px solid rgba(255,255,255,0.12)",
      }}
    >
      <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 700 }}>
        Pin #{pin.num}
      </Typography>
      <Box sx={{ display: "flex", flexDirection: "column", gap: 1, mb: 2 }}>
        <Box>
          <Typography variant="caption" sx={{ color: "#9ca3af", display: "block", mb: 0.5 }}>
            Latitude
          </Typography>
          <input
            type="number"
            step="any"
            value={lat}
            onChange={(e) => setLat(parseFloat(e.target.value) || 0)}
            style={coordInputStyle}
          />
        </Box>
        <Box>
          <Typography variant="caption" sx={{ color: "#9ca3af", display: "block", mb: 0.5 }}>
            Longitude
          </Typography>
          <input
            type="number"
            step="any"
            value={lng}
            onChange={(e) => setLng(parseFloat(e.target.value) || 0)}
            style={coordInputStyle}
          />
        </Box>
      </Box>
      <Box sx={{ display: "flex", gap: 1 }}>
        <Button
          size="small"
          variant="contained"
          sx={{ flex: 1, fontSize: 12 }}
          onClick={() => onSave(lat, lng)}
        >
          Save
        </Button>
        <Button
          size="small"
          variant="outlined"
          color="error"
          sx={{ flex: 1, fontSize: 12 }}
          onClick={onDelete}
        >
          Delete
        </Button>
        <Button
          size="small"
          variant="text"
          sx={{ flex: 1, fontSize: 12, color: "#9ca3af" }}
          onClick={onClose}
        >
          Cancel
        </Button>
      </Box>
    </Paper>
  );
}
