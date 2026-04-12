import { NextResponse } from "next/server";
import path from "path";
import { promises as fs } from "fs";

const namesPath = path.join(process.cwd(), "public", "data", "names.json");
const nodesPath = path.join(process.cwd(), "public", "data", "nodes.json");

export async function POST() {
  try {
    const [namesRaw, nodesRaw] = await Promise.all([
      fs.readFile(namesPath, "utf-8"),
      fs.readFile(nodesPath, "utf-8"),
    ]);

    const namesJson = JSON.parse(namesRaw);
    const nodesJson = JSON.parse(nodesRaw);

    // nodes.json は { "1-1": { nodes: [{id: ...}, ...] }, ... } の形
    const seaToNodeIds: Record<string, string[]> = {};
    for (const [code, sea] of Object.entries(nodesJson)) {
      const list = Array.isArray((sea as any).nodes) ? (sea as any).nodes : [];
      seaToNodeIds[code] = list.map((n: any) => String(n.id));
    }

    // names.json の各 sea に対応する nodeId を補完（既存は維持、欠けを追加）
    let changed = false;
    if (Array.isArray(namesJson.groups)) {
      for (const group of namesJson.groups) {
        if (!Array.isArray(group.seas)) continue;
        for (const sea of group.seas) {
          const code: string = sea.code;
          const ids = seaToNodeIds[code] ?? [];
          if (!sea.nodes || typeof sea.nodes !== "object") {
            sea.nodes = {};
          }
          for (const id of ids) {
            if (!(id in sea.nodes)) {
              sea.nodes[id] = id; // 初期名はIDと同じ
              changed = true;
            }
          }
        }
      }
    }

    if (changed) {
      await fs.writeFile(
        namesPath,
        JSON.stringify(namesJson, null, 2),
        "utf-8"
      );
    }

    return NextResponse.json({ updated: changed, data: namesJson });
  } catch (error) {
    return NextResponse.json({ error: "Sync failed" }, { status: 500 });
  }
}
