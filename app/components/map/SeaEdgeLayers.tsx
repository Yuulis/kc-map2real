"use client";

import React from "react";
import { Source, Layer } from "react-map-gl/maplibre";
import type { FeatureCollection, LineString, Point } from "geojson";
import type { ExpressionSpecification } from "maplibre-gl";

import type { ArrowProperties, EdgeProperties } from "@/app/lib/geo";

export interface SectionGeoJson {
  key: string;
  edges: FeatureCollection<LineString, EdgeProperties>;
  arrows: FeatureCollection<Point, ArrowProperties>;
}

const rotateExpression: ExpressionSpecification = ["get", "rotation"];

/** Dashed edge lines + directional arrow symbols, one Source per section */
export default function SeaEdgeLayers({
  collections,
}: {
  collections: readonly SectionGeoJson[];
}) {
  return (
    <React.Fragment>
      {collections.map(({ key, edges }) => (
        <Source key={`edges-${key}`} id={`edges-${key}`} type="geojson" data={edges}>
          <Layer
            id={`edges-line-${key}`}
            type="line"
            source={`edges-${key}`}
            paint={{
              "line-color": "#ffffff",
              "line-width": 3,
              "line-opacity": 1.0,
              "line-dasharray": [2, 2],
            }}
            layout={{
              "line-join": "round",
              "line-cap": "round",
            }}
          />
        </Source>
      ))}

      {collections.map(({ key, arrows }) => (
        <Source key={`arrows-${key}`} id={`arrows-${key}`} type="geojson" data={arrows}>
          <Layer
            id={`arrows-symbol-${key}`}
            type="symbol"
            source={`arrows-${key}`}
            layout={{
              "symbol-placement": "point",
              "icon-image": "arrow-icon",
              "icon-size": 0.05,
              "icon-rotation-alignment": "map",
              "icon-rotate": rotateExpression,
              "icon-allow-overlap": true,
              "icon-anchor": "center",
            }}
          />
        </Source>
      ))}
    </React.Fragment>
  );
}
