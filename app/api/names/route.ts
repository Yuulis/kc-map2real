import { NextResponse } from "next/server";
import path from "path";
import { promises as fs } from "fs";

const dataPath = path.join(process.cwd(), "public", "data", "names.json");

export async function GET() {
  try {
    const content = await fs.readFile(dataPath, "utf-8");
    const json = JSON.parse(content);
    return NextResponse.json(json);
  } catch (error) {
    return NextResponse.json(
      { error: "names.json not found or invalid" },
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

    // Persist
    const serialized = JSON.stringify(body, null, 2);
    await fs.writeFile(dataPath, serialized, "utf-8");
    return NextResponse.json(body);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to save names.json" },
      { status: 500 }
    );
  }
}
