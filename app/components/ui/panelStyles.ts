import type { SxProps, Theme } from "@mui/material/styles";

/** Blue-checked checkbox used across dark panels/dialogs */
export function blueCheckboxSx(iconFontSize = 18): SxProps<Theme> {
  return {
    p: 0,
    color: "#6b7280",
    "&.Mui-checked": { color: "#90caf9" },
    "& .MuiSvgIcon-root": { fontSize: iconFontSize },
  };
}

/** Compact dark Select used in the edge editor */
export const darkSelectSx: SxProps<Theme> = {
  flex: 1,
  minWidth: 60,
  backgroundColor: "#374151",
  color: "#fff",
  fontSize: 11,
  "& .MuiSelect-select": { py: 0.25, px: 0.5 },
  "& .MuiOutlinedInput-notchedOutline": { borderColor: "#6b7280" },
  "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: "#9ca3af" },
  "& .MuiSvgIcon-root": { color: "#fff", fontSize: 16 },
};

/** Menu paper styling matching darkSelectSx */
export const darkSelectMenuProps = {
  slotProps: { paper: { sx: { backgroundColor: "#374151", color: "#fff" } } },
} as const;

/** Small toggle button (submap selector) — blue when selected, gray otherwise */
export function submapToggleSx(selected: boolean): SxProps<Theme> {
  return {
    backgroundColor: selected ? "#3b82f6" : "#374151",
    color: "#fff",
    borderColor: selected ? "#3b82f6" : "#6b7280",
    fontSize: 11,
    fontWeight: 600,
    px: 1,
    py: 0.25,
    minWidth: 0,
    textTransform: "none",
    "&:hover": {
      backgroundColor: selected ? "#2563eb" : "#4b5563",
      borderColor: selected ? "#3b82f6" : "#6b7280",
    },
  };
}
