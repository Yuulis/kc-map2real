"use client";

import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Typography from "@mui/material/Typography";
import { X } from "lucide-react";
import ReactMarkdown from "react-markdown";

/** Dialog rendering fetched markdown content (更新履歴 / 当サイトについて etc.) */
export default function MarkdownDialog({
  label,
  content,
  onClose,
}: {
  label: string;
  content: string;
  onClose: () => void;
}) {
  return (
    <Dialog
      open
      onClose={onClose}
      maxWidth="md"
      fullWidth
      slotProps={{
        paper: {
          sx: { backgroundColor: "#111111", color: "#fff", maxHeight: "80vh" },
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
          {label}
        </Typography>
        <IconButton size="small" onClick={onClose} sx={{ color: "#9ca3af" }}>
          <X size={18} />
        </IconButton>
      </DialogTitle>
      <DialogContent sx={{ p: 2, overflow: "auto" }}>
        <Box
          sx={{
            "& h1,h2,h3": { color: "#e5e7eb", mt: 2, mb: 1 },
            "& p": { color: "#9ca3af", mb: 1 },
            "& a": { color: "#90caf9" },
            "& ul": { color: "#9ca3af", pl: 3, listStyleType: "disc" },
            "& ol": { color: "#9ca3af", pl: 3, listStyleType: "decimal" },
            "& li": { mb: 0.25 },
            "& code": {
              backgroundColor: "#1a1a1a",
              px: 0.5,
              borderRadius: 0.5,
              fontFamily: "monospace",
            },
          }}
        >
          <ReactMarkdown>{content}</ReactMarkdown>
        </Box>
      </DialogContent>
    </Dialog>
  );
}
