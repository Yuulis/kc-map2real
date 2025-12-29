"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import Map, { Marker, Source, Layer, MapRef } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import { point } from "@turf/helpers";
import turfBearing from "@turf/bearing";
import destination from "@turf/destination";

// マス情報の型定義
type Node = {
  id: string;
  type: "start" | "normal" | "boss" | "supply" | "relay" | "whirlpool" | "port";
  lat: number;
  lng: number;
};

type Edge = {
  from: string;
  to: string;
  arrow?: boolean; // 矢印表示の指定（任意）
};

type MapData = {
  nodes: Node[];
  edges: Edge[];
};

type SectionData = {
  key: string;
  nodes: Node[];
  edges: Edge[];
};

export default function Home() {
  const [sections, setSections] = useState<SectionData[]>([]);
  const mapRef = React.useRef<MapRef>(null);
  // 矢印オフセット距離を固定（5km = 5000m）
  const arrowOffsetKm = 30;

  // 1. 外部JSONファイルを読み込む
  useEffect(() => {
    fetch("/data/nodes.json")
      .then((res) => res.json())
      .then((data) => {
        const arr: SectionData[] = Object.entries(data)
          .filter(
            ([, v]: any) => Array.isArray(v?.nodes) && Array.isArray(v?.edges)
          )
          .map(([key, v]: [string, any]) => ({
            key,
            nodes: v.nodes,
            edges: v.edges,
          }));
        setSections(arr);
      })
      .catch((err) => console.error("nodes.json の読み込みに失敗", err));
  }, []);

  // 全ノード（Marker描画用）
  const allNodes = useMemo(() => sections.flatMap((s) => s.nodes), [sections]);

  // エッジをGeoJSON(LineStringのFeatureCollection)に変換
  // セクションごとのLineString FeatureCollection
  const edgeCollections = useMemo(() => {
    return sections.map((s) => {
      const idx: Record<string, [number, number]> = {};
      for (const n of s.nodes) idx[n.id] = [n.lng, n.lat];
      const features = s.edges
        .map((e) => {
          const from = idx[e.from];
          const to = idx[e.to];
          if (!from || !to) return null;
          return {
            type: "Feature",
            properties: {
              from: e.from,
              to: e.to,
              arrow: !!e.arrow,
              section: s.key,
            },
            geometry: { type: "LineString", coordinates: [from, to] },
          };
        })
        .filter(Boolean);
      return {
        key: s.key,
        fc: { type: "FeatureCollection", features },
      } as const;
    });
  }, [sections]);

  // 矢印用のGeoJSON（ラインの末端=to座標に1つだけ矢印を置く）
  // セクションごとの矢印Point FeatureCollection
  const arrowCollections = useMemo(() => {
    return sections.map((s) => {
      const idx: Record<string, [number, number]> = {};
      for (const n of s.nodes) idx[n.id] = [n.lng, n.lat];
      const features = s.edges
        .filter((e) => !!e.arrow)
        .map((e) => {
          const from = idx[e.from];
          const to = idx[e.to];
          if (!from || !to) return null;
          const [fromLng, fromLat] = from;
          const [toLng, toLat] = to;
          const start = point([fromLng, fromLat]);
          const end = point([toLng, toLat]);
          const deg = turfBearing(start, end);
          // 開始点から前方へオフセット（開始側に矢印を配置）
          const fwd = destination(start, arrowOffsetKm, deg, {
            units: "kilometers",
          });
          const fwdCoord = fwd?.geometry?.coordinates ?? from;
          return {
            type: "Feature",
            properties: {
              rotation: deg,
              from: e.from,
              to: e.to,
              section: s.key,
            },
            geometry: { type: "Point", coordinates: fwdCoord },
          };
        })
        .filter(Boolean);
      return {
        key: s.key,
        fc: { type: "FeatureCollection", features },
      } as const;
    });
  }, [sections]);

  return (
    <main style={{ width: "100vw", height: "100vh" }}>
      <Map
        ref={mapRef}
        onLoad={() => {
          const map = mapRef.current?.getMap();
          if (map && !map.hasImage("arrow-icon")) {
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.src = "/img/nodes/arrow.png";
            img.onload = () => {
              try {
                if (!map.hasImage("arrow-icon")) {
                  map.addImage("arrow-icon", img);
                }
              } catch (err) {
                console.error("矢印画像の登録に失敗", err);
              }
            };
            img.onerror = (err) => {
              console.error("矢印画像の読み込みに失敗", err);
            };
          }
        }}
        initialViewState={{
          longitude: 139.7,
          latitude: 35.25,
          zoom: 11,
        }}
        mapStyle="https://api.maptiler.com/maps/streets/style.json?key=y1HMGFsCIxAH9qNt8bAL"
        style={{ width: "100%", height: "100%" }}
        onClick={(e) => {
          const { lng, lat } = e.lngLat;
          console.log(
            `{ "id": "NEW", "type": "normal", "lat": ${lat}, "lng": ${lng} },`
          );
        }}
      >
        {/* オフセットは5000m固定 */}
        {/* 2. 読み込んだデータに基づいてマーカーを配置 */}
        {allNodes.map((node) => (
          <Marker
            key={`${node.id}-${node.lng}-${node.lat}`}
            longitude={node.lng}
            latitude={node.lat}
            anchor="center"
          >
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
              }}
            >
              {/* マスの種類に応じて画像を出し分ける */}
              <img
                src={`/img/nodes/${node.type}.png`}
                alt={node.id}
                style={{
                  width:
                    node.type === "start" ||
                    node.type === "boss" ||
                    node.type === "port"
                      ? "50px"
                      : "30px",
                  cursor: "pointer",
                  filter: "drop-shadow(0px 0px 4px rgba(0,0,0,0.5))",
                }}
                onClick={() => alert(`マス: ${node.id} (${node.type})`)}
              />
              {/* 近くにIDラベルを表示 */}
              <span
                style={{
                  marginTop: 4,
                  padding: "0px 4px",
                  fontSize: 20,
                  fontWeight: 600,
                  color: "#ffffff",
                  textShadow: "0 0 2px #000, 0 0 4px #000",
                  pointerEvents: "none",
                  userSelect: "none",
                }}
                aria-hidden
              >
                {node.id}
              </span>
            </div>
          </Marker>
        ))}
        {/* 3. セクションごとにレイヤー分離して線と矢印を描画 */}
        {edgeCollections.map(({ key, fc }) => (
          <Source
            key={`edges-${key}`}
            id={`edges-${key}`}
            type="geojson"
            data={fc as any}
          >
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

        {arrowCollections.map(({ key, fc }) => (
          <Source
            key={`arrows-${key}`}
            id={`arrows-${key}`}
            type="geojson"
            data={fc as any}
          >
            <Layer
              id={`arrows-symbol-${key}`}
              type="symbol"
              source={`arrows-${key}`}
              layout={{
                "symbol-placement": "point",
                "icon-image": "arrow-icon",
                "icon-size": 0.05,
                "icon-rotation-alignment": "map",
                "icon-rotate": ["get", "rotation"] as any,
                "icon-allow-overlap": true,
                "icon-anchor": "center",
              }}
            />
          </Source>
        ))}
      </Map>
    </main>
  );
}
