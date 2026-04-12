"use client";

import { useEffect, useState } from "react";
import type { NamesData, SeaGroup, Sea } from "@/app/types/maps";

function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export default function NamesAdminPage() {
  const [data, setData] = useState<NamesData | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setError(null);
      setSuccess(null);
      try {
        const res = await fetch("/api/names", { cache: "no-store" });
        if (!res.ok) throw new Error(`GET /api/names failed: ${res.status}`);
        const json: NamesData = await res.json();
        setData(json);
      } catch (e: unknown) {
        setError(getErrorMessage(e, "Failed to load names"));
      }
    })();
  }, []);

  const updateGroup = (idx: number, updater: (g: SeaGroup) => SeaGroup) => {
    if (!data) return;
    const copy = deepClone(data);
    copy.groups[idx] = updater(copy.groups[idx]);
    setData(copy);
  };

  const addGroup = () => {
    if (!data) return;
    const copy = deepClone(data);
    copy.groups.push({ id: "new", name: "新規グループ", seas: [] });
    setData(copy);
  };

  const removeGroup = (idx: number) => {
    if (!data) return;
    const copy = deepClone(data);
    copy.groups.splice(idx, 1);
    setData(copy);
  };

  const addSea = (groupIdx: number) => {
    updateGroup(groupIdx, (g) => ({
      ...g,
      seas: [...g.seas, { code: "x-y", name: "新規海域", nodes: {} }],
    }));
  };

  const updateSea = (
    groupIdx: number,
    seaIdx: number,
    updater: (s: Sea) => Sea
  ) => {
    updateGroup(groupIdx, (g) => {
      const seas = deepClone(g.seas);
      seas[seaIdx] = updater(seas[seaIdx]);
      return { ...g, seas };
    });
  };

  const removeSea = (groupIdx: number, seaIdx: number) => {
    updateGroup(groupIdx, (g) => {
      const seas = deepClone(g.seas);
      seas.splice(seaIdx, 1);
      return { ...g, seas };
    });
  };

  const addNodeName = (groupIdx: number, seaIdx: number) => {
    updateSea(groupIdx, seaIdx, (s) => ({
      ...s,
      nodes: { ...s.nodes, newNode: "新規マス名" },
    }));
  };

  const removeNodeName = (groupIdx: number, seaIdx: number, nodeId: string) => {
    updateSea(groupIdx, seaIdx, (s) => {
      const nodes = deepClone(s.nodes);
      delete nodes[nodeId];
      return { ...s, nodes };
    });
  };

  const save = async () => {
    if (!data) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/names", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(`PUT /api/names failed: ${res.status}`);
      // names.json 保存成功後、nodes.json にも反映
      const reflect = await fetch("/api/nodes/sync-names", { method: "POST" });
      if (!reflect.ok)
        throw new Error(`POST /api/nodes/sync-names failed: ${reflect.status}`);
      const reflectJson = await reflect.json();
      setSuccess(
        reflectJson.updated
          ? "保存 + nodes.jsonへ反映しました"
          : "保存しました（nodes.jsonは反映済み）"
      );
    } catch (e: unknown) {
      setError(getErrorMessage(e, "保存に失敗しました"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ padding: 16 }}>
      <h1>名前管理（海域グループ / 海域 / マス）</h1>
      {!data && !error && <p>読み込み中...</p>}
      {error && <p style={{ color: "red" }}>エラー: {error}</p>}
      {success && <p style={{ color: "green" }}>{success}</p>}
      {data && (
        <div>
          <div style={{ marginBottom: 8 }}>
            <label>
              スキーマVersion:{" "}
              <input
                type="number"
                value={data.version}
                onChange={(e) =>
                  setData({
                    ...deepClone(data),
                    version: Number(e.target.value),
                  })
                }
                style={{ width: 100 }}
              />
            </label>
          </div>
          <button onClick={addGroup}>グループ追加</button>
          <hr />
          {data.groups.map((g, gi) => (
            <div
              key={gi}
              style={{
                border: "1px solid #ccc",
                padding: 12,
                marginBottom: 12,
              }}
            >
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <label>
                  グループID:{" "}
                  <input
                    value={g.id}
                    onChange={(e) =>
                      updateGroup(gi, (gg) => ({ ...gg, id: e.target.value }))
                    }
                    style={{ width: 120 }}
                  />
                </label>
                <label>
                  グループ名:{" "}
                  <input
                    value={g.name}
                    onChange={(e) =>
                      updateGroup(gi, (gg) => ({ ...gg, name: e.target.value }))
                    }
                    style={{ width: 240 }}
                  />
                </label>
                <button onClick={() => addSea(gi)}>海域追加</button>
                <button
                  onClick={() => removeGroup(gi)}
                  style={{ marginLeft: "auto", color: "#a00" }}
                >
                  グループ削除
                </button>
              </div>
              <div style={{ marginTop: 8 }}>
                {g.seas.map((s, si) => (
                  <div
                    key={si}
                    style={{
                      border: "1px dashed #aaa",
                      padding: 8,
                      marginBottom: 8,
                    }}
                  >
                    <div
                      style={{ display: "flex", gap: 8, alignItems: "center" }}
                    >
                      <label>
                        海域コード:{" "}
                        <input
                          value={s.code}
                          onChange={(e) =>
                            updateSea(gi, si, (ss) => ({
                              ...ss,
                              code: e.target.value,
                            }))
                          }
                          style={{ width: 120 }}
                        />
                      </label>
                      <label>
                        海域名:{" "}
                        <input
                          value={s.name}
                          onChange={(e) =>
                            updateSea(gi, si, (ss) => ({
                              ...ss,
                              name: e.target.value,
                            }))
                          }
                          style={{ width: 240 }}
                        />
                      </label>
                      <button onClick={() => addNodeName(gi, si)}>
                        マス名追加
                      </button>
                      <button
                        onClick={() => removeSea(gi, si)}
                        style={{ marginLeft: "auto", color: "#a00" }}
                      >
                        海域削除
                      </button>
                    </div>
                    <div style={{ marginTop: 8 }}>
                      {Object.entries(s.nodes).map(([nodeId, nodeName]) => (
                        <div
                          key={nodeId}
                          style={{
                            display: "flex",
                            gap: 8,
                            alignItems: "center",
                            marginBottom: 4,
                          }}
                        >
                          <input
                            value={nodeId}
                            onChange={(e) => {
                              const newId = e.target.value;
                              updateSea(gi, si, (ss) => {
                                const next = deepClone(ss.nodes);
                                delete next[nodeId];
                                next[newId] = nodeName as string;
                                return { ...ss, nodes: next };
                              });
                            }}
                            style={{ width: 120 }}
                          />
                          <input
                            value={nodeName as string}
                            onChange={(e) =>
                              updateSea(gi, si, (ss) => ({
                                ...ss,
                                nodes: {
                                  ...ss.nodes,
                                  [nodeId]: e.target.value,
                                },
                              }))
                            }
                            style={{ width: 240 }}
                          />
                          <button
                            onClick={() => removeNodeName(gi, si, nodeId)}
                            style={{ color: "#a00" }}
                          >
                            削除
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={save} disabled={saving}>
              保存
            </button>
            {saving && <span>保存中...</span>}
            <button
              onClick={async () => {
                setError(null);
                setSuccess(null);
                try {
                  const res = await fetch("/api/names/sync", {
                    method: "POST",
                  });
                  if (!res.ok)
                    throw new Error(
                      `POST /api/names/sync failed: ${res.status}`,
                    );
                  const json = await res.json();
                  setSuccess(
                    json.updated
                      ? "ノードIDを補完しました"
                      : "補完対象はありませんでした",
                  );
                  if (json?.data) setData(json.data as NamesData);
                } catch (e: unknown) {
                  setError(getErrorMessage(e, "補完に失敗しました"));
                }
              }}
            >
              ノード名を自動補完
            </button>
            <button
              onClick={async () => {
                setError(null);
                setSuccess(null);
                try {
                  const res = await fetch("/api/nodes/sync-names", {
                    method: "POST",
                  });
                  if (!res.ok)
                    throw new Error(
                      `POST /api/nodes/sync-names failed: ${res.status}`,
                    );
                  const json = await res.json();
                  setSuccess(
                    json.updated
                      ? "nodes.json に名前を反映しました"
                      : "反映済みでした",
                  );
                } catch (e: unknown) {
                  setError(
                    getErrorMessage(e, "nodes.json への反映に失敗しました"),
                  );
                }
              }}
            >
              nodes.json に反映
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
