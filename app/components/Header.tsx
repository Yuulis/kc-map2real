"use client";

import React, { useEffect, useState } from "react";
import AppBar from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";
import IconButton from "@mui/material/IconButton";
import Typography from "@mui/material/Typography";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import { Settings, X, Map, History, Link2, Info } from "lucide-react";
import { Toaster, toast } from "sonner";
import ReactMarkdown from "react-markdown";
import Tooltip from "@mui/material/Tooltip";

type SeaInfo = {
  code: string;
  name: string;
  submaps: { id: string; name: string }[];
};

type GroupInfo = {
  id: string;
  name: string;
  seas: SeaInfo[];
  isEvent: boolean;
};

type HeaderLink =
  | { label: string; type: "external"; href: string }
  | { label: string; type: "dialog"; file: string };

const HEADER_LINK_ICONS: Record<string, React.ReactNode> = {
  更新履歴: <History size={18} />,
  リンク集: <Link2 size={18} />,
  当サイトについて: <Info size={18} />,
};

const HEADER_LINK_TOOLTIPS: Record<string, string> = {
  更新履歴: "更新履歴",
  リンク集: "リンク集",
  当サイトについて: "当サイトについて",
};

export default function Header() {
  const [rightOpen, setRightOpen] = useState(false);
  const [devToolsEnabled, setDevToolsEnabled] = useState(false);
  const [appVersion, setAppVersion] = useState<string>("");
  const [headerLinks, setHeaderLinks] = useState<HeaderLink[]>([]);

  // Markdown dialog state
  const [activeDialog, setActiveDialog] = useState<{
    label: string;
    content: string;
  } | null>(null);

  // Map selector dialog state
  const [mapSelectorOpen, setMapSelectorOpen] = useState(false);

  // Full group data including submaps (loaded from maps.json)
  const [groupData, setGroupData] = useState<GroupInfo[]>([]);

  // Which sea codes are active (visible on map) — initially all
  const [activeSectionKeys, setActiveSectionKeys] = useState<string[]>([]);

  // Which submap IDs are visible per sea code — empty set = all visible (default)
  const [visibleSubmapIds, setVisibleSubmapIds] = useState<
    Record<string, Set<string>>
  >({});

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

  // Load devToolsEnabled from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem("kc-dev-tools");
      if (stored === "1") {
        setDevToolsEnabled(true);
      }
    } catch {
      // Ignore storage errors
    }
  }, []);

  // Load maps.json and capture group/submap info
  useEffect(() => {
    fetch("/data/maps.json")
      .then((res) => res.json())
      .then((data) => {
        const groups: GroupInfo[] = [];
        const allCodes: string[] = [];
        if (data && Array.isArray(data.groups)) {
          for (const group of data.groups) {
            const isEvent = group.meta?.type === "event";
            const seas: SeaInfo[] = (group.seas ?? []).map(
              (sea: { code: string; name: string; submaps?: { id: string; name: string }[] }) => ({
                code: sea.code,
                name: sea.name,
                submaps: (sea.submaps ?? []).map(
                  (sm: { id: string; name: string }) => ({
                    id: sm.id,
                    name: sm.name,
                  })
                ),
              })
            );
            seas.forEach((s) => allCodes.push(s.code));
            groups.push({
              id: group.id,
              name: group.name,
              seas,
              isEvent,
            });
          }
        }
        setGroupData(groups);
        setActiveSectionKeys(allCodes);
      })
      .catch(() => setGroupData([]));
  }, []);

  // Dispatch kc:set-active-sections whenever activeSectionKeys changes
  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent<string[]>("kc:set-active-sections", {
        detail: activeSectionKeys,
      })
    );
  }, [activeSectionKeys]);

  // Dispatch kc:set-submap-visibility whenever visibleSubmapIds changes
  useEffect(() => {
    for (const [seaCode, submapSet] of Object.entries(visibleSubmapIds)) {
      window.dispatchEvent(
        new CustomEvent("kc:set-submap-visibility", {
          detail: {
            seaCode,
            visibleSubmapIds: Array.from(submapSet),
          },
        })
      );
    }
  }, [visibleSubmapIds]);

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
            <Typography
              variant="subtitle2"
              component="div"
              sx={{ fontWeight: 700 }}
            >
              鎮守府水路図誌
            </Typography>
            {appVersion && (
              <Typography
                variant="caption"
                component="div"
                sx={{ color: "#9ca3af", fontWeight: 400 }}
              >
                {appVersion}
              </Typography>
            )}
          </Box>

          {/* Right: Links + Settings */}
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.25 }}>
            {headerLinks.map((link) => {
              const icon = HEADER_LINK_ICONS[link.label];
              const tooltip = HEADER_LINK_TOOLTIPS[link.label] ?? link.label;
              return link.type === "external" ? (
                <Tooltip key={link.label} title={tooltip} placement="bottom">
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
                <Tooltip key={link.label} title={tooltip} placement="bottom">
                  <IconButton
                    size="small"
                    onClick={() => {
                      fetch(link.file)
                        .then((res) => res.text())
                        .then((text) =>
                          setActiveDialog({ label: link.label, content: text }),
                        )
                        .catch(() =>
                          setActiveDialog({
                            label: link.label,
                            content: "コンテンツを読み込めませんでした。",
                          }),
                        );
                    }}
                    sx={{ color: "#9ca3af", "&:hover": { color: "#fff" } }}
                  >
                    {icon}
                  </IconButton>
                </Tooltip>
              );
            })}
            <Tooltip title="設定" placement="bottom">
              <IconButton
                edge="end"
                color="inherit"
                aria-label="設定を開く"
                onClick={() => setRightOpen(true)}
              >
                <Settings size={20} />
              </IconButton>
            </Tooltip>
          </Box>
        </Toolbar>
      </AppBar>

      {/* Settings Dialog */}
      <Dialog
        open={rightOpen}
        onClose={() => setRightOpen(false)}
        maxWidth="xs"
        fullWidth
        slotProps={{
          paper: {
            sx: {
              backgroundColor: "#111111",
              color: "#fff",
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
          <Typography
            component="span"
            variant="subtitle1"
            sx={{ fontWeight: 700 }}
          >
            設定
          </Typography>
          <IconButton
            size="small"
            onClick={() => setRightOpen(false)}
            sx={{ color: "#9ca3af" }}
          >
            <X size={18} />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ p: 2 }}>
          {/* Developer tools checkbox */}
          <FormControlLabel
            control={
              <Checkbox
                checked={devToolsEnabled}
                onChange={(e) => {
                  const next = e.target.checked;
                  setDevToolsEnabled(next);
                  try {
                    if (next) {
                      localStorage.setItem("kc-dev-tools", "1");
                    } else {
                      localStorage.removeItem("kc-dev-tools");
                    }
                  } catch {
                    // Ignore storage errors
                  }
                  window.dispatchEvent(
                    new CustomEvent<boolean>("kc:set-dev-tools", {
                      detail: next,
                    }),
                  );
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

      {/* Markdown content Dialog */}
      <Dialog
        open={activeDialog !== null}
        onClose={() => setActiveDialog(null)}
        maxWidth="md"
        fullWidth
        slotProps={{
          paper: {
            sx: {
              backgroundColor: "#111111",
              color: "#fff",
              maxHeight: "80vh",
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
          <Typography
            component="span"
            variant="subtitle1"
            sx={{ fontWeight: 700 }}
          >
            {activeDialog?.label}
          </Typography>
          <IconButton
            size="small"
            onClick={() => setActiveDialog(null)}
            sx={{ color: "#9ca3af" }}
          >
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
            <ReactMarkdown>{activeDialog?.content ?? ""}</ReactMarkdown>
          </Box>
        </DialogContent>
      </Dialog>

      {/* Map selector Dialog */}
      <Dialog
        open={mapSelectorOpen}
        onClose={() => setMapSelectorOpen(false)}
        maxWidth="lg"
        fullWidth
        slotProps={{
          paper: {
            sx: {
              backgroundColor: "#111111",
              color: "#fff",
              maxHeight: "95vh",
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
          <Typography
            component="span"
            variant="subtitle1"
            sx={{ fontWeight: 700 }}
          >
            海域選択
          </Typography>
          <IconButton
            size="small"
            onClick={() => setMapSelectorOpen(false)}
            sx={{ color: "#9ca3af" }}
          >
            <X size={18} />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ p: 0, display: "flex", overflow: "hidden" }}>
          {/* Left column: regular seas */}
          <Box
            sx={{
              flex: 1,
              p: 2,
              borderRight: "1px solid #222",
              columnCount: 2,
              columnGap: "24px",
            }}
          >
            {/* Select all / Deselect all */}
            <Box sx={{ display: "flex", gap: 1, mb: 2, breakInside: "avoid" }}>
              <Button
                size="small"
                variant="outlined"
                onClick={() => {
                  const allCodes = groupData.flatMap((g) =>
                    g.seas.map((s) => s.code),
                  );
                  setActiveSectionKeys(allCodes);
                }}
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

            {/* Regular sea groups */}
            {groupData
              .filter((g) => !g.isEvent)
              .map((group) => {
                const groupCodes = group.seas.map((s) => s.code);
                const selectedCount = groupCodes.filter((c) =>
                  activeSectionKeys.includes(c),
                ).length;
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
                        onChange={() => {
                          setActiveSectionKeys((prev) => {
                            if (allSelected) {
                              return prev.filter(
                                (k) => !groupCodes.includes(k),
                              );
                            }
                            const next = new Set(prev);
                            groupCodes.forEach((c) => next.add(c));
                            return Array.from(next);
                          });
                        }}
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
                        const active = activeSectionKeys.includes(sea.code);
                        return (
                          <Box key={sea.code} sx={{ width: 56 }}>
                            {/* Sea toggle button */}
                            <Button
                              size="small"
                              variant={active ? "contained" : "outlined"}
                              title={`${sea.code} ${sea.name}`}
                              onClick={() => {
                                setActiveSectionKeys((prev) =>
                                  active
                                    ? prev.filter((k) => k !== sea.code)
                                    : [...prev, sea.code],
                                );
                              }}
                              sx={{
                                fontSize: "0.75rem",
                                fontWeight: 700,
                                textTransform: "none",
                                width: "100%",
                                minWidth: 0,
                                px: 1.25,
                                py: 0.375,
                                backgroundColor: active
                                  ? "#fff"
                                  : "transparent",
                                color: active ? "#000" : "#9ca3af",
                                borderColor: active ? "#fff" : "#4b5563",
                                "&:hover": {
                                  backgroundColor: active
                                    ? "#e5e7eb"
                                    : "rgba(255,255,255,0.08)",
                                  borderColor: active ? "#e5e7eb" : "#9ca3af",
                                },
                              }}
                            >
                              {sea.code}
                            </Button>
                          </Box>
                        );
                      })}
                    </Box>
                  </Box>
                );
              })}
          </Box>

          {/* Right column: event seas (only shown if event groups exist) */}
          {groupData.some((g) => g.isEvent) && (
            <Box
              sx={{
                width: 320,
                p: 2,
                flexShrink: 0,
              }}
            >
              {groupData
                .filter((g) => g.isEvent)
                .map((group) => {
                  const groupCodes = group.seas.map((s) => s.code);
                  const selectedCount = groupCodes.filter((c) =>
                    activeSectionKeys.includes(c),
                  ).length;
                  const allSelected = selectedCount === groupCodes.length;
                  const noneSelected = selectedCount === 0;
                  return (
                    <Box key={group.id} sx={{ mb: 2.5 }}>
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
                          onChange={() => {
                            setActiveSectionKeys((prev) => {
                              if (allSelected) {
                                return prev.filter(
                                  (k) => !groupCodes.includes(k),
                                );
                              }
                              const next = new Set(prev);
                              groupCodes.forEach((c) => next.add(c));
                              return Array.from(next);
                            });
                          }}
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
                          }}
                        >
                          {group.name}
                        </Typography>
                      </Box>
                      <Box
                        sx={{
                          display: "flex",
                          flexWrap: "wrap",
                          gap: 0.75,
                        }}
                      >
                        {group.seas.map((sea) => {
                          const active = activeSectionKeys.includes(sea.code);
                          return (
                            <Button
                              key={sea.code}
                              size="small"
                              variant={active ? "contained" : "outlined"}
                              title={`${sea.code} ${sea.name}`}
                              onClick={() => {
                                setActiveSectionKeys((prev) =>
                                  active
                                    ? prev.filter((k) => k !== sea.code)
                                    : [...prev, sea.code],
                                );
                              }}
                              sx={{
                                fontSize: "0.75rem",
                                fontWeight: 700,
                                textTransform: "none",
                                width: 56,
                                minWidth: 0,
                                px: 1.25,
                                py: 0.375,
                                backgroundColor: active
                                  ? "#fff"
                                  : "transparent",
                                color: active ? "#000" : "#9ca3af",
                                borderColor: active ? "#fff" : "#4b5563",
                                "&:hover": {
                                  backgroundColor: active
                                    ? "#e5e7eb"
                                    : "rgba(255,255,255,0.08)",
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
                })}
            </Box>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
