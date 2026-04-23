import { NextResponse } from "next/server";

import {
  readIndex,
  readSea,
  writeSea,
} from "@/app/lib/maps-io";

export async function POST() {
  try {
    const index = await readIndex();

    // Ensure all node IDs have a name (default to ID).
    let changed = false;
    for (const group of index.groups) {
      for (const seaRef of group.seas) {
        const sea = await readSea(seaRef.code);
        let seaChanged = false;
        for (const node of sea.nodes ?? []) {
          if (!node.name || node.name.length === 0) {
            node.name = node.id;
            seaChanged = true;
          }
        }
        if (seaChanged) {
          await writeSea(sea);
          changed = true;
        }
      }
    }

    // Return backward-compatible NamesData shape
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
        return { id: g.id, name: g.name, seas };
      }),
    );

    const namesData = {
      version: index.version,
      groups,
    };

    return NextResponse.json({ updated: changed, data: namesData });
  } catch {
    return NextResponse.json({ error: "Sync failed" }, { status: 500 });
  }
}
