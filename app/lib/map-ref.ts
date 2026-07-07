import type { MapRef } from "react-map-gl/maplibre";

/**
 * Module-level holder for the MapLibre map instance.
 * Set by MapView on mount; consumed by components outside the map tree
 * (e.g. the sea selector dialog for fitBounds on selection).
 */
export const mapRefHolder: { current: MapRef | null } = { current: null };
