"use client";

import { Popup } from "react-map-gl/maplibre";
import NextImage from "next/image";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

import type { MapNode } from "@/app/types/maps";
import { ALLOWED_NODE_TYPES, NODE_TYPE_LABELS } from "@/app/lib/constants";

export interface NodePopupInfo {
  node: MapNode;
  seaLabel?: string;
  submapNames: string[];
}

/** Read-only node info popup shown when clicking a node in view mode */
export default function NodePopup({
  info,
  onClose,
}: {
  info: NodePopupInfo;
  onClose: () => void;
}) {
  const { node, seaLabel, submapNames } = info;
  const safeType = ALLOWED_NODE_TYPES.has(node.type) ? node.type : "normal";
  const iconType = safeType === "landing" ? "supply" : safeType;
  return (
    <Popup
      longitude={node.lng}
      latitude={node.lat}
      anchor="bottom"
      offset={[0, -20] as [number, number]}
      onClose={onClose}
      closeButton={false}
      closeOnClick
      maxWidth="260px"
      className="kc-node-popup"
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <NextImage
          src={`/img/nodes/${iconType}.png`}
          alt={NODE_TYPE_LABELS[safeType]}
          width={28}
          height={28}
          unoptimized
        />
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontSize: 14, fontWeight: 700, lineHeight: 1.3 }}>
            {node.id}
            {node.name && node.name !== node.id ? ` — ${node.name}` : ""}
          </Typography>
          <Typography sx={{ fontSize: 11, color: "#9ca3af" }}>
            {NODE_TYPE_LABELS[safeType]}
            {seaLabel ? ` ・ ${seaLabel}` : ""}
          </Typography>
        </Box>
      </Box>
      {submapNames.length > 0 && (
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, mt: 0.75 }}>
          {submapNames.map((name) => (
            <Box
              key={name}
              component="span"
              sx={{
                fontSize: 10,
                fontWeight: 600,
                backgroundColor: "#1d4ed8",
                color: "#fff",
                borderRadius: 0.75,
                px: 0.75,
                py: 0.125,
              }}
            >
              {name}
            </Box>
          ))}
        </Box>
      )}
      {node.bossDialogue && (
        <Typography
          sx={{ mt: 1, borderLeft: "3px solid #dc2626", pl: 1, fontSize: 12, fontStyle: "italic" }}
        >
          {node.bossDialogue}
        </Typography>
      )}
    </Popup>
  );
}
