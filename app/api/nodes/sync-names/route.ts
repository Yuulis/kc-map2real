import { NextResponse } from "next/server";
import path from "path";
import { promises as fs } from "fs";

const mapsPath = path.join(process.cwd(), "public", "data", "maps.json");

export async function POST() {
  try {
    const mapsRaw = await fs.readFile(mapsPath, "utf-8");
    const mapsJson = JSON.parse(mapsRaw);

    // In the merged schema, names and nodes live in the same file.
    // This endpoint now ensures node names are consistent (non-empty).
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

    return NextResponse.json({ updated: changed });
  } catch {
    return NextResponse.json(
      { error: "Sync to maps.json failed" },
      { status: 500 }
    );
  }
}
