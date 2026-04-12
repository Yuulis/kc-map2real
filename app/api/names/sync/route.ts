import { NextResponse } from "next/server";
import path from "path";
import { promises as fs } from "fs";

const mapsPath = path.join(process.cwd(), "public", "data", "maps.json");

export async function POST() {
  try {
    const mapsRaw = await fs.readFile(mapsPath, "utf-8");
    const mapsJson = JSON.parse(mapsRaw);

    // In the merged schema, node names are already in maps.json.
    // This endpoint now ensures all node IDs have a name (default to ID).
    let changed = false;
    if (Array.isArray(mapsJson.groups)) {
      for (const group of mapsJson.groups) {
        if (!Array.isArray(group.seas)) continue;
        for (const sea of group.seas) {
          if (!Array.isArray(sea.nodes)) continue;
          for (const node of sea.nodes) {
            if (!node.name || node.name.length === 0) {
              node.name = node.id;
              changed = true;
            }
          }
        }
      }
    }

    if (changed) {
      await fs.writeFile(mapsPath, JSON.stringify(mapsJson, null, 2), "utf-8");
    }

    // Return backward-compatible NamesData shape
    const namesData = {
      version: mapsJson.version ?? 2,
      groups: (mapsJson.groups ?? []).map((g: any) => ({
        id: g.id,
        name: g.name,
        seas: (g.seas ?? []).map((s: any) => ({
          code: s.code,
          name: s.name,
          nodes: Object.fromEntries(
            (s.nodes ?? []).map((n: any) => [n.id, n.name])
          ),
        })),
      })),
    };

    return NextResponse.json({ updated: changed, data: namesData });
  } catch {
    return NextResponse.json({ error: "Sync failed" }, { status: 500 });
  }
}
