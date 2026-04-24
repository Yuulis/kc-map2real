import { NextResponse } from "next/server";

import {
  readIndex,
  readSea,
  writeSea,
} from "@/app/lib/maps-io";

export async function POST() {
  try {
    const index = await readIndex();

    // Ensure node names are consistent (non-empty).
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

    return NextResponse.json({ updated: changed });
  } catch {
    return NextResponse.json(
      { error: "Sync to maps data failed" },
      { status: 500 },
    );
  }
}
