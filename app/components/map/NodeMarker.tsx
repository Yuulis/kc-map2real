"use client";

import React from "react";
import { Marker } from "react-map-gl/maplibre";
import NextImage from "next/image";

import type { MapNode } from "@/app/types/maps";
import { ALLOWED_NODE_TYPES, nodeIconSize } from "@/app/lib/constants";

const nodeImageStyle: React.CSSProperties = {
  cursor: "pointer",
  filter: "drop-shadow(0px 0px 4px rgba(0,0,0,0.5))",
};

const labelStyle: React.CSSProperties = {
  padding: "0px 4px",
  fontSize: 20,
  fontWeight: 600,
  color: "#ffffff",
  textShadow: "0 0 2px #000, 0 0 4px #000",
  pointerEvents: "none",
  userSelect: "none",
};

const flagStyle: React.CSSProperties = {
  position: "absolute",
  left: "calc(50% + 10px)",
  bottom: "50%",
  width: 22,
  height: 30,
  borderLeft: "3px solid #365314",
  filter: "drop-shadow(0 0 2px rgba(0,0,0,0.8))",
  pointerEvents: "none",
};

const flagPennantStyle: React.CSSProperties = {
  display: "block",
  width: 0,
  height: 0,
  borderTop: "7px solid transparent",
  borderBottom: "7px solid transparent",
  borderLeft: "18px solid #a3e635",
};

/** Memoized node marker to avoid re-rendering all markers on parent state changes */
const NodeMarker = React.memo(function NodeMarker({
  node,
  onClickNode,
}: {
  node: MapNode;
  onClickNode: (node: MapNode) => void;
}) {
  const safeType = ALLOWED_NODE_TYPES.has(node.type) ? node.type : "normal";
  const sizePx = nodeIconSize(safeType);
  const iconType = safeType === "landing" ? "supply" : safeType;
  return (
    <React.Fragment>
      {/* Image marker (centered on coordinates) */}
      <Marker longitude={node.lng} latitude={node.lat} anchor="center">
        <div style={{ position: "relative" }}>
          <NextImage
            src={`/img/nodes/${iconType}.png`}
            alt={node.name ?? node.id}
            title={node.name ?? node.id}
            width={sizePx}
            height={sizePx}
            unoptimized
            style={nodeImageStyle}
            onClick={(ev) => {
              ev.stopPropagation();
              onClickNode(node);
            }}
          />
          {safeType === "landing" && (
            <span style={flagStyle} aria-hidden>
              <span style={flagPennantStyle} />
            </span>
          )}
        </div>
      </Marker>

      {/* Label marker (offset below the image) */}
      <Marker
        longitude={node.lng}
        latitude={node.lat}
        anchor="center"
        offset={[0, sizePx / 2 + 10] as [number, number]}
      >
        <span style={labelStyle} aria-hidden>
          {node.id}
        </span>
      </Marker>
    </React.Fragment>
  );
});

export default NodeMarker;
