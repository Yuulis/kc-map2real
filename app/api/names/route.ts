import { NextResponse } from "next/server";
import path from "path";
import { promises as fs } from "fs";

const dataPath = path.join(process.cwd(), "public", "data", "maps.json");

export async function GET() {
  try {
    const content = await fs.readFile(dataPath, "utf-8");
    const json = JSON.parse(content);
    // Return backward-compatible NamesData shape from maps.json
    const namesData = {
      version: json.version ?? 2,
      groups: (json.groups ?? []).map((g: any) => ({
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
    return NextResponse.json(namesData);
  } catch {
    return NextResponse.json(
      { error: "maps.json not found or invalid" },
      { status: 404 }
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
        { status: 400 }
      );
    }
    if (!Array.isArray(body.groups)) {
      return NextResponse.json(
        { error: "Missing or invalid groups[]" },
        { status: 400 }
      );
    }

    // Read existing maps.json to merge name updates into it
    const existing = JSON.parse(await fs.readFile(dataPath, "utf-8"));

    // Build lookup: code -> { seaName, nodeNames }
    const namesMap: Record<string, { name: string; nodes: Record<string, string> }> = {};
    for (const group of body.groups) {
      if (!Array.isArray(group.seas)) continue;
      for (const sea of group.seas) {
        namesMap[sea.code] = { name: sea.name, nodes: sea.nodes || {} };
      }
    }

    // Update group and sea names, and node names in existing maps.json
    for (const group of existing.groups) {
      // Update group name from first matching sea's group
      const matchingGroup = body.groups.find((g: any) => g.id === group.id);
      if (matchingGroup) {
        group.name = matchingGroup.name;
      }

      for (const sea of group.seas) {
        const nameInfo = namesMap[sea.code];
        if (!nameInfo) continue;
        sea.name = nameInfo.name;
        for (const node of sea.nodes) {
          const newName = nameInfo.nodes[node.id];
          if (typeof newName === "string") {
            node.name = newName;
          }
        }
      }
    }

    existing.version = body.version;

    // Persist
    const serialized = JSON.stringify(existing, null, 2);
    await fs.writeFile(dataPath, serialized, "utf-8");

    // Also write to legacy names.json for backward compatibility
    const legacyPath = path.join(process.cwd(), "public", "data", "names.json");
    await fs.writeFile(legacyPath, JSON.stringify(body, null, 2), "utf-8");

    return NextResponse.json(body);
  } catch {
    return NextResponse.json(
      { error: "Failed to save maps.json" },
      { status: 500 }
    );
  }
}
