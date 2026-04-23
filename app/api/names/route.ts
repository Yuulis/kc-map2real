import { NextResponse } from "next/server";
import path from "path";
import { promises as fs } from "fs";

import {
  readIndex,
  writeIndex,
  readSea,
  writeSea,
} from "@/app/lib/maps-io";

export async function GET() {
  try {
    const index = await readIndex();
    // Build backward-compatible NamesData shape
    const groups = await Promise.all(
      index.groups.map(async (g) => {
        const seas = await Promise.all(
          g.seas.map(async (seaRef) => {
            const sea = await readSea(seaRef.code);
            return {
              code: sea.code,
              name: sea.name,
              nodes: Object.fromEntries(
                (sea.nodes ?? []).map((n) => [n.id, n.name]),
              ),
            };
          }),
        );
        return {
          id: g.id,
          name: g.name,
          seas,
        };
      }),
    );

    const namesData = {
      version: index.version,
      groups,
    };
    return NextResponse.json(namesData);
  } catch {
    return NextResponse.json(
      { error: "maps data not found or invalid" },
      { status: 404 },
    );
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();

    // Minimal validation
    if (typeof body !== "object" || body === null) {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    if (typeof body.version !== "number") {
      return NextResponse.json(
        { error: "Missing or invalid version" },
        { status: 400 },
      );
    }
    if (!Array.isArray(body.groups)) {
      return NextResponse.json(
        { error: "Missing or invalid groups[]" },
        { status: 400 },
      );
    }

    // Build lookup: code -> { seaName, nodeNames }
    const namesMap: Record<string, { name: string; nodes: Record<string, string> }> = {};
    for (const group of body.groups) {
      if (!Array.isArray(group.seas)) continue;
      for (const sea of group.seas) {
        namesMap[sea.code] = { name: sea.name, nodes: sea.nodes || {} };
      }
    }

    // Read current data and apply name updates
    const index = await readIndex();

    // Update group names in index
    for (const group of index.groups) {
      const matchingGroup = body.groups.find((g: { id: string }) => g.id === group.id);
      if (matchingGroup) {
        group.name = matchingGroup.name;
      }

      for (const seaRef of group.seas) {
        const nameInfo = namesMap[seaRef.code];
        if (!nameInfo) continue;
        // Update sea name in index
        seaRef.name = nameInfo.name;
        // Update node names in sea file
        const sea = await readSea(seaRef.code);
        sea.name = nameInfo.name;
        for (const node of sea.nodes) {
          const newName = nameInfo.nodes[node.id];
          if (typeof newName === "string") {
            node.name = newName;
          }
        }
        await writeSea(sea);
      }
    }

    index.version = body.version;
    await writeIndex(index);

    // Also write to legacy names.json for backward compatibility
    const legacyPath = path.join(process.cwd(), "public", "data", "names.json");
    await fs.writeFile(legacyPath, JSON.stringify(body, null, 2), "utf-8");

    return NextResponse.json(body);
  } catch {
    return NextResponse.json(
      { error: "Failed to save maps data" },
      { status: 500 },
    );
  }
}
