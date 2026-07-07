"use client";

import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";

import { useMapDataStore } from "@/app/store/useMapDataStore";

/** Loading indicator / error overlay for the maps data fetch */
export default function MapDataOverlay() {
  const status = useMapDataStore((s) => s.status);
  const error = useMapDataStore((s) => s.error);
  const reload = useMapDataStore((s) => s.reload);

  if (status === "loading" || status === "idle") {
    return (
      <Paper
        elevation={4}
        sx={{
          position: "fixed",
          top: 60,
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 70,
          display: "flex",
          alignItems: "center",
          gap: 1,
          px: 2,
          py: 0.75,
          borderRadius: 999,
          backgroundColor: "rgba(0,0,0,0.85)",
          color: "#fff",
        }}
      >
        <CircularProgress size={14} sx={{ color: "#90caf9" }} />
        <Typography sx={{ fontSize: 12 }}>海域データを読み込み中…</Typography>
      </Paper>
    );
  }

  if (status === "error") {
    return (
      <Paper
        elevation={6}
        sx={{
          position: "fixed",
          top: "40%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          zIndex: 80,
          px: 3,
          py: 2.5,
          borderRadius: 2,
          backgroundColor: "#1e1e2e",
          color: "#fff",
          border: "1px solid rgba(239,68,68,0.6)",
          textAlign: "center",
          maxWidth: 320,
        }}
      >
        <Typography sx={{ fontSize: 14, fontWeight: 700, mb: 0.5 }}>
          海域データの読み込みに失敗しました
        </Typography>
        {error && (
          <Typography sx={{ fontSize: 11, color: "#9ca3af", mb: 1.5 }}>{error}</Typography>
        )}
        <Button size="small" variant="contained" onClick={() => reload()}>
          再試行
        </Button>
      </Paper>
    );
  }

  return null;
}
