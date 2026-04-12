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
  type:
    | "start"
    | "normal"
    | "boss"
    | "supply"
    | "relay"
    | "whirlpool"
    | "port"
    | "aerial";
  lat: number;
  lng: number;
  // 任意: 表示名（nodes.json の name フィールド）
  name?: string;
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

// 許可するノード種別のホワイトリスト（ランタイム検証用）
const ALLOWED_NODE_TYPES = new Set<SectionData["nodes"][number]["type"]>([
  "start",
  "normal",
  "boss",
  "supply",
  "relay",
  "whirlpool",
  "port",
  "aerial",
]);

export default function Home() {
  const [sections, setSections] = useState<SectionData[]>([]);
  const [activeSectionKeys, setActiveSectionKeys] = useState<string[] | null>(
    null
  );
  const mapRef = React.useRef<MapRef>(null);
  // 矢印オフセット距離を固定（5km = 5000m）
  const arrowOffsetKm = 30;
  // ピン配置モード・ピン配列
  const [pinMode, setPinMode] = useState(false);
  const [pins, setPins] = useState<
    Array<{ id: string; lat: number; lng: number; num: number }>
  >([]);
  // Feature 1: Persisted map view state (read once before mount)
  const initialViewState = useMemo(() => {
    if (typeof window === "undefined") {
      return { longitude: 139.7, latitude: 35.25, zoom: 11 };
    }
    try {
      const raw = localStorage.getItem("kc-map-view");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (
          typeof parsed.longitude === "number" &&
          typeof parsed.latitude === "number" &&
          typeof parsed.zoom === "number"
        ) {
          return parsed;
        }
      }
    } catch {
      // Ignore parse errors
    }
    return { longitude: 139.7, latitude: 35.25, zoom: 11 };
  }, []);
  // Feature 3: Cursor coordinate tooltip
  const [cursorCoord, setCursorCoord] = useState<{
    lat: number;
    lng: number;
    x: number;
    y: number;
  } | null>(null);

  // Feature 1: Callback to persist view state on map move end
  const handleMoveEnd = useCallback(
    (e: { viewState: { longitude: number; latitude: number; zoom: number } }) => {
      const { longitude, latitude, zoom } = e.viewState;
      try {
        localStorage.setItem(
          "kc-map-view",
          JSON.stringify({ longitude, latitude, zoom })
        );
      } catch {
        // Ignore storage errors
      }
    },
    []
  );

  // MapスタイルURL（環境変数でMapTilerキーを管理）。キー未設定時はデモタイルへフォールバック
  const MAPTILER_KEY = process.env.NEXT_PUBLIC_MAPTILER_KEY;
  const isProd = process.env.NODE_ENV === "production";
  const mapStyleUrl = useMemo(() => {
    if (!MAPTILER_KEY) {
      if (isProd) {
        console.error(
          "NEXT_PUBLIC_MAPTILER_KEY が未設定です。Vercel環境変数を設定してください。"
        );
      } else {
        console.warn(
          "NEXT_PUBLIC_MAPTILER_KEY 未設定。デモスタイルにフォールバックします。"
        );
      }
      return "https://demotiles.maplibre.org/style.json";
    }
    return `https://api.maptiler.com/maps/streets/style.json?key=${MAPTILER_KEY}`;
  }, [MAPTILER_KEY, isProd]);

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

  // 初期表示は全海域を表示（Headerでも全選択にしているが保険）
  useEffect(() => {
    if (
      sections.length > 0 &&
      (activeSectionKeys === null || activeSectionKeys.length === 0)
    ) {
      setActiveSectionKeys(sections.map((s) => s.key));
    }
  }, [sections]);

  // ヘッダーの海域選択イベントを受け取る
  useEffect(() => {
    const handler = (e: Event) => {
      const ce = e as CustomEvent<string[]>;
      // 配列が空なら非表示（何も表示しない）
      setActiveSectionKeys(ce.detail ?? []);
    };
    window.addEventListener("kc:set-active-sections", handler as EventListener);
    return () =>
      window.removeEventListener(
        "kc:set-active-sections",
        handler as EventListener
      );
  }, []);

  // ヘッダーのピンモード切替イベントを受け取る
  useEffect(() => {
    const handler = (e: Event) => {
      const ce = e as CustomEvent<boolean>;
      setPinMode(!!ce.detail);
    };
    window.addEventListener("kc:set-pin-mode", handler as EventListener);
    return () =>
      window.removeEventListener("kc:set-pin-mode", handler as EventListener);
  }, []);

  const visibleSections = useMemo(() => {
    if (!activeSectionKeys) return sections; // 初期は全部
    if (activeSectionKeys.length === 0) return [];
    return sections.filter((s) => activeSectionKeys.includes(s.key));
  }, [sections, activeSectionKeys]);

  // 全ノード（Marker描画用）
  const allNodes = useMemo(
    () =>
      visibleSections.flatMap((s) =>
        s.nodes.filter((n) => ALLOWED_NODE_TYPES.has(n.type))
      ),
    [visibleSections]
  );

  // エッジをGeoJSON(LineStringのFeatureCollection)に変換
  // セクションごとのLineString FeatureCollection
  const edgeCollections = useMemo(() => {
    return visibleSections.map((s) => {
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
  }, [visibleSections]);

  // 矢印用のGeoJSON（ラインの末端=to座標に1つだけ矢印を置く）
  // セクションごとの矢印Point FeatureCollection
  const arrowCollections = useMemo(() => {
    return visibleSections.map((s) => {
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
  }, [visibleSections]);

  return (
    <main
      style={{
        width: "100vw",
        height: "calc(100vh - 3rem)",
        marginTop: "3rem",
      }}
    >
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
        initialViewState={initialViewState}
        onMoveEnd={handleMoveEnd}
        onMouseMove={(e) => {
          if (pinMode) {
            setCursorCoord({
              lat: e.lngLat.lat,
              lng: e.lngLat.lng,
              x: e.point.x,
              y: e.point.y,
            });
          }
        }}
        onMouseLeave={() => {
          setCursorCoord(null);
        }}
        mapStyle={mapStyleUrl}
        style={{ width: "100%", height: "100%" }}
        onClick={(e) => {
          const { lng, lat } = e.lngLat;
          if (pinMode) {
            const id = `pin-${Date.now()}`;
            setPins((prev) => [
              ...prev,
              { id, lat, lng, num: prev.length + 1 },
            ]);
          } else {
            console.log(
              `{ "id": "NEW", "type": "normal", "lat": ${lat}, "lng": ${lng} },`
            );
          }
        }}
      >
        {/* オフセットは5000m固定 */}
        {/* 2. 読み込んだデータに基づいてマーカーを配置 */}
        {allNodes.map((node) => {
          const safeType = ALLOWED_NODE_TYPES.has(node.type)
            ? node.type
            : "normal";
          const sizePx =
            safeType === "start" || safeType === "boss" || safeType === "port"
              ? 50
              : 30;
          return (
            <React.Fragment key={`${node.id}-${node.lng}-${node.lat}`}>
              {/* 画像用マーカー（中心を座標に合わせる）*/}
              <Marker longitude={node.lng} latitude={node.lat} anchor="center">
                <img
                  src={`/img/nodes/${safeType}.png`}
                  alt={node.name ?? node.id}
                  title={node.name ?? node.id}
                  style={{
                    width: `${sizePx}px`,
                    cursor: "pointer",
                    filter: "drop-shadow(0px 0px 4px rgba(0,0,0,0.5))",
                  }}
                  onClick={() => alert(`マス: ${node.id} (${node.type})`)}
                />
              </Marker>

              {/* ラベル用マーカー（画像の下にオフセットして表示）*/}
              <Marker
                longitude={node.lng}
                latitude={node.lat}
                anchor="center"
                offset={[0, sizePx / 2 + 10] as any}
              >
                <span
                  style={{
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
              </Marker>
            </React.Fragment>
          );
        })}
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

        {/* クリックで配置されたピンの描画 */}
        {pins.map((p) => (
          <Marker key={p.id} longitude={p.lng} latitude={p.lat} anchor="center">
            <div
              title={`#${p.num} lat: ${p.lat.toFixed(6)}, lng: ${p.lng.toFixed(6)}`}
              onClick={(e) => {
                e.stopPropagation();
                setPins((prev) => prev.filter((pin) => pin.id !== p.id));
              }}
              style={{
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
              }}
            >
              {p.num}
            </div>
          </Marker>
        ))}
      </Map>

      {/* Feature 3: Cursor coordinate tooltip when pin mode is ON */}
      {pinMode && cursorCoord !== null && (
        <div
          style={{
            position: "fixed",
            left: cursorCoord.x + 12,
            top: cursorCoord.y + 48 + 12,
            zIndex: 70,
            background: "rgba(0,0,0,0.75)",
            color: "#fff",
            padding: "4px 8px",
            borderRadius: 4,
            fontSize: 12,
            pointerEvents: "none",
            whiteSpace: "nowrap",
          }}
        >
          lat: {cursorCoord.lat.toFixed(6)}, lng: {cursorCoord.lng.toFixed(6)}
        </div>
      )}

      {/* 座標情報のフローティングパネル */}
      <div
        style={{
          position: "fixed",
          right: 12,
          bottom: 12,
          zIndex: 60,
          background: pinMode
            ? "rgba(239, 68, 68, 0.7)"
            : "rgba(0,0,0,0.7)",
          border: pinMode
            ? "1px solid rgba(239, 68, 68, 1)"
            : "1px solid transparent",
          color: "#fff",
          borderRadius: 8,
          fontSize: 13,
          userSelect: "none",
          minWidth: 220,
        }}
      >
        {/* Header: toggle pin mode */}
        <div
          onClick={() => setPinMode((prev) => !prev)}
          style={{
            padding: "8px 10px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
            borderBottom:
              pinMode && pins.length > 0
                ? "1px solid rgba(255,255,255,0.2)"
                : "none",
          }}
        >
          <span>{pinMode ? "ピン配置モード: ON" : "ピン配置モード: OFF"}</span>
          {pinMode && pins.length > 0 && (
            <span style={{ fontSize: 11, opacity: 0.8 }}>
              {pins.length}件
            </span>
          )}
        </div>

        {/* Pin list + action buttons */}
        {pinMode && pins.length > 0 && (
          <div style={{ padding: "4px 10px 8px" }}>
            {/* Scrollable pin list */}
            <div
              style={{
                maxHeight: 180,
                overflowY: "auto",
                marginBottom: 6,
              }}
            >
              {pins.map((p) => (
                <div
                  key={p.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    fontSize: 12,
                    padding: "2px 0",
                    fontFamily: "monospace",
                  }}
                >
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: 18,
                      height: 18,
                      background: "#ef4444",
                      borderRadius: "50%",
                      fontSize: 10,
                      fontWeight: 700,
                      flexShrink: 0,
                    }}
                  >
                    {p.num}
                  </span>
                  <span>
                    {p.lat.toFixed(6)}, {p.lng.toFixed(6)}
                  </span>
                </div>
              ))}
            </div>

            {/* Action buttons */}
            <div style={{ display: "flex", gap: 6 }}>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  const text = pins
                    .map(
                      (p) =>
                        `{ "lat": ${p.lat.toFixed(6)}, "lng": ${p.lng.toFixed(
                          6
                        )} },`
                    )
                    .join("\n");
                  navigator.clipboard?.writeText(text).catch(() => {});
                }}
                style={{
                  background: "#22c55e",
                  color: "#000",
                  borderRadius: 6,
                  padding: "4px 8px",
                  fontWeight: 600,
                  fontSize: 12,
                  border: "none",
                  cursor: "pointer",
                  flex: 1,
                }}
              >
                全コピー
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setPins([]);
                }}
                style={{
                  background: "#6b7280",
                  color: "#fff",
                  borderRadius: 6,
                  padding: "4px 8px",
                  fontWeight: 600,
                  fontSize: 12,
                  border: "none",
                  cursor: "pointer",
                  flex: 1,
                }}
              >
                クリア
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
