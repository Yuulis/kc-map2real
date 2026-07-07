"use client";

import React, { useEffect, useState } from "react";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import { X } from "lucide-react";
import ReactMarkdown from "react-markdown";

type SeaInfo = {
  code: string;
  name: string;
};

type GroupInfo = {
  id: string;
  name: string;
  seas: SeaInfo[];
  isEvent: boolean;
};

type Props = {
  open: boolean;
  onClose: () => void;
  groupData: GroupInfo[];
};

export default function SeaNotesDialog({ open, onClose, groupData }: Props) {
  const [selectedOverride, setSelectedCode] = useState<string | null>(null);
  const [noteContent, setNoteContent] = useState<string>("");

  // Default to the first sea until the user picks one
  const selectedCode = selectedOverride ?? groupData[0]?.seas[0]?.code ?? "";

  useEffect(() => {
    if (!selectedCode) return;
    fetch(`/data/notes/${selectedCode}.md`)
      .then((res) => res.text())
      .then(setNoteContent)
      .catch(() => setNoteContent("（考察メモ未記入）"));
  }, [selectedCode]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      slotProps={{
        paper: {
          sx: {
            backgroundColor: "#111111",
            color: "#fff",
            maxHeight: "90vh",
            height: "90vh",
          },
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
          海域考察
        </Typography>
        <IconButton size="small" onClick={onClose} sx={{ color: "#9ca3af" }}>
          <X size={18} />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ p: 0, display: "flex", overflow: "hidden", height: "100%" }}>
        {/* Left: sea area list */}
        <Box
          sx={{
            width: 220,
            flexShrink: 0,
            borderRight: "1px solid #222",
            overflowY: "auto",
            py: 1,
          }}
        >
          {groupData.map((group) => (
            <Box key={group.id} sx={{ mb: 0.5 }}>
              <Typography
                variant="caption"
                sx={{
                  color: "#6b7280",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  px: 2,
                  py: 0.5,
                  display: "block",
                }}
              >
                {group.name}
              </Typography>
              {group.seas.map((sea) => (
                <Box
                  key={sea.code}
                  onClick={() => setSelectedCode(sea.code)}
                  sx={{
                    px: 2,
                    py: 0.75,
                    cursor: "pointer",
                    backgroundColor:
                      selectedCode === sea.code
                        ? "rgba(144, 202, 249, 0.08)"
                        : "transparent",
                    borderLeft:
                      selectedCode === sea.code
                        ? "2px solid #90caf9"
                        : "2px solid transparent",
                    "&:hover": {
                      backgroundColor: "rgba(255, 255, 255, 0.05)",
                    },
                  }}
                >
                  <Typography
                    variant="body2"
                    sx={{
                      color: selectedCode === sea.code ? "#e5e7eb" : "#9ca3af",
                      fontSize: "0.75rem",
                    }}
                  >
                    <span style={{ fontWeight: 700 }}>{sea.code}</span>{" "}
                    {sea.name}
                  </Typography>
                </Box>
              ))}
            </Box>
          ))}
        </Box>

        {/* Right: markdown content */}
        <Box sx={{ flex: 1, overflowY: "auto", p: 3 }}>
          <Box
            sx={{
              "& h1, & h2, & h3": { color: "#e5e7eb", mt: 2, mb: 1 },
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
            <ReactMarkdown>{noteContent}</ReactMarkdown>
          </Box>
        </Box>
      </DialogContent>
    </Dialog>
  );
}
