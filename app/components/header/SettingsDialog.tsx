"use client";

import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import IconButton from "@mui/material/IconButton";
import Typography from "@mui/material/Typography";
import { X } from "lucide-react";
import { toast } from "sonner";

import { useAppStore } from "@/app/store/useAppStore";

/** App settings dialog (developer tools toggle) */
export default function SettingsDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const devToolsEnabled = useAppStore((s) => s.devToolsEnabled);
  const setDevToolsEnabled = useAppStore((s) => s.setDevToolsEnabled);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      slotProps={{
        paper: { sx: { backgroundColor: "#111111", color: "#fff" } },
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
          設定
        </Typography>
        <IconButton size="small" onClick={onClose} sx={{ color: "#9ca3af" }}>
          <X size={18} />
        </IconButton>
      </DialogTitle>
      <DialogContent sx={{ p: 2 }}>
        <FormControlLabel
          control={
            <Checkbox
              checked={devToolsEnabled}
              onChange={(e) => {
                const next = e.target.checked;
                setDevToolsEnabled(next);
                toast[next ? "success" : "info"](
                  next
                    ? "デベロッパーツールを有効にしました"
                    : "デベロッパーツールを無効にしました",
                );
              }}
              size="small"
              sx={{
                color: "#6b7280",
                "&.Mui-checked": { color: "#90caf9" },
              }}
            />
          }
          label={<Typography variant="body2">デベロッパーツール</Typography>}
          sx={{ ml: 0, display: "flex" }}
        />
      </DialogContent>
    </Dialog>
  );
}
