"use client";

import React, { useEffect, useState } from "react";
import AppBar from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";
import IconButton from "@mui/material/IconButton";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Tooltip from "@mui/material/Tooltip";
import { Settings, Map, History, Link2, Info, NotebookPen } from "lucide-react";
import { Toaster } from "sonner";

import { useMapDataStore } from "@/app/store/useMapDataStore";
import { useGroupData } from "@/app/hooks/useGroupData";
import SeaSelectorDialog from "@/app/components/header/SeaSelectorDialog";
import SettingsDialog from "@/app/components/header/SettingsDialog";
import MarkdownDialog from "@/app/components/header/MarkdownDialog";
import SeaNotesDialog from "@/app/components/SeaNotesDialog";

type HeaderLink =
  | { label: string; type: "external"; href: string }
  | { label: string; type: "dialog"; file: string };

const HEADER_LINK_ICONS: Record<string, React.ReactNode> = {
  更新履歴: <History size={18} />,
  リンク集: <Link2 size={18} />,
  当サイトについて: <Info size={18} />,
};

export default function Header() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [appVersion, setAppVersion] = useState<string>("");
  const [headerLinks, setHeaderLinks] = useState<HeaderLink[]>([]);
  const [activeDialog, setActiveDialog] = useState<{
    label: string;
    content: string;
  } | null>(null);
  const [mapSelectorOpen, setMapSelectorOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);

  const load = useMapDataStore((s) => s.load);
  const groupData = useGroupData();

  // Ensure maps data is loaded (idempotent; shared with the map page)
  useEffect(() => {
    load();
  }, [load]);

  // Load app-info.json on mount
  useEffect(() => {
    fetch("/data/app-info.json")
      .then((res) => res.json())
      .then((data) => {
        let versionStr = `${data.version.label}第${data.version.number}号`;
        if (data.version.revision != null) {
          versionStr += ` 改${data.version.revision}版`;
        }
        if (data.version.edition != null) {
          versionStr += ` ${data.version.edition}版`;
        }
        setAppVersion(versionStr);
        setHeaderLinks(data.headerLinks);
      })
      .catch(() => {
        // Ignore fetch errors
      });
  }, []);

  const openMarkdownDialog = (link: { label: string; file: string }) => {
    fetch(link.file)
      .then((res) => res.text())
      .then((text) => setActiveDialog({ label: link.label, content: text }))
      .catch(() =>
        setActiveDialog({
          label: link.label,
          content: "コンテンツを読み込めませんでした。",
        }),
      );
  };

  return (
    <>
      <Toaster richColors position="top-center" />

      {/* Header AppBar */}
      <AppBar
        position="fixed"
        sx={{
          backgroundColor: "#000000",
          height: 48,
          zIndex: (theme) => theme.zIndex.drawer + 1,
        }}
      >
        <Toolbar
          variant="dense"
          sx={{
            minHeight: 48,
            justifyContent: "space-between",
            px: 1.5,
          }}
        >
          {/* Left: Sea selector button */}
          <Button
            size="small"
            color="inherit"
            onClick={() => setMapSelectorOpen(true)}
            startIcon={<Map size={16} />}
            sx={{
              fontSize: "0.75rem",
              textTransform: "none",
              fontWeight: 600,
              border: "1px solid rgba(255,255,255,0.2)",
              px: 1.25,
              py: 0.5,
              borderRadius: 1,
              "&:hover": { backgroundColor: "rgba(255,255,255,0.08)" },
            }}
          >
            海域選択
          </Button>

          {/* Center: Title */}
          <Box
            sx={{
              display: "flex",
              alignItems: "baseline",
              gap: 0.75,
              userSelect: "none",
            }}
          >
            <Typography variant="subtitle2" component="div" sx={{ fontWeight: 700 }}>
              鎮守府水路図誌
            </Typography>
            {appVersion && (
              <Typography
                variant="caption"
                component="div"
                sx={{
                  color: "#9ca3af",
                  fontWeight: 400,
                  // Hide the long version string on small screens
                  display: { xs: "none", sm: "block" },
                }}
              >
                {appVersion}
              </Typography>
            )}
          </Box>

          {/* Right: Links + Notes + Settings */}
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.25 }}>
            {headerLinks.map((link) => {
              const icon = HEADER_LINK_ICONS[link.label];
              return link.type === "external" ? (
                <Tooltip key={link.label} title={link.label} placement="bottom">
                  <IconButton
                    component="a"
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    size="small"
                    sx={{ color: "#9ca3af", "&:hover": { color: "#fff" } }}
                  >
                    {icon}
                  </IconButton>
                </Tooltip>
              ) : (
                <Tooltip key={link.label} title={link.label} placement="bottom">
                  <IconButton
                    size="small"
                    onClick={() => openMarkdownDialog(link)}
                    sx={{ color: "#9ca3af", "&:hover": { color: "#fff" } }}
                  >
                    {icon}
                  </IconButton>
                </Tooltip>
              );
            })}
            <Tooltip title="海域考察" placement="bottom">
              <IconButton
                size="small"
                onClick={() => setNotesOpen(true)}
                sx={{ color: "#9ca3af", "&:hover": { color: "#fff" } }}
              >
                <NotebookPen size={18} />
              </IconButton>
            </Tooltip>
            <Tooltip title="設定" placement="bottom">
              <IconButton
                edge="end"
                color="inherit"
                aria-label="設定を開く"
                onClick={() => setSettingsOpen(true)}
              >
                <Settings size={20} />
              </IconButton>
            </Tooltip>
          </Box>
        </Toolbar>
      </AppBar>

      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />

      {activeDialog !== null && (
        <MarkdownDialog
          label={activeDialog.label}
          content={activeDialog.content}
          onClose={() => setActiveDialog(null)}
        />
      )}

      <SeaSelectorDialog open={mapSelectorOpen} onClose={() => setMapSelectorOpen(false)} />

      <SeaNotesDialog
        open={notesOpen}
        onClose={() => setNotesOpen(false)}
        groupData={groupData}
      />
    </>
  );
}
