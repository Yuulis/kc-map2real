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

    // Build code -> nodeId->name map from names.json
    const namesMap: Record<string, Record<string, string>> = {};
    if (Array.isArray(namesJson.groups)) {
      for (const group of namesJson.groups) {
        if (!Array.isArray(group.seas)) continue;
        for (const sea of group.seas) {
          namesMap[sea.code] = { ...(sea.nodes || {}) };
        }
      }
    }

    let changed = false;
    for (const [code, sea] of Object.entries(nodesJson)) {
      const nodes = Array.isArray((sea as any).nodes) ? (sea as any).nodes : [];
      const codeMap = namesMap[code] || {};
      for (const node of nodes) {
        const id = String(node.id);
        const nameFromNames = codeMap[id];
        if (typeof nameFromNames === "string" && nameFromNames.length > 0) {
          if (node.name !== nameFromNames) {
            node.name = nameFromNames;
            changed = true;
          }
        } else {
          // Fallback: ensure name exists; default to id
          if (node.name !== id) {
            node.name = id;
            changed = true;
          }
        }
      }
    }

    if (changed) {
      await fs.writeFile(
        nodesPath,
        JSON.stringify(nodesJson, null, 2),
        "utf-8"
      );
    }

    return NextResponse.json({ updated: changed });
  } catch (error) {
    return NextResponse.json(
      { error: "Sync to nodes.json failed" },
      { status: 500 }
    );
  }
}
