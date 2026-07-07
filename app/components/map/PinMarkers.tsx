"use client";

import { Marker } from "react-map-gl/maplibre";

import { useAppStore, type Pin } from "@/app/store/useAppStore";

const pinStyle: React.CSSProperties = {
  width: 24,
  height: 24,
  background: "#ef4444",
  borderRadius: "50%",
  border: "2px solid white",
  boxShadow: "0 0 6px rgba(0,0,0,0.5)",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 11,
  fontWeight: 700,
  color: "#fff",
  lineHeight: 1,
  userSelect: "none",
};

/** Numbered coordinate pins placed in pin mode */
export default function PinMarkers({ onSelect }: { onSelect: (pin: Pin) => void }) {
  const pins = useAppStore((s) => s.pins);
  return (
    <>
      {pins.map((p) => (
        <Marker key={p.id} longitude={p.lng} latitude={p.lat} anchor="center">
          <div
            title={`#${p.num} lat: ${p.lat.toFixed(6)}, lng: ${p.lng.toFixed(6)}`}
            onClick={(e) => {
              e.stopPropagation();
              onSelect(p);
            }}
            style={pinStyle}
          >
            {p.num}
          </div>
        </Marker>
      ))}
    </>
  );
}
