import { NextRequest, NextResponse } from "next/server";
import { searchAll } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const q = request.nextUrl.searchParams.get("q");
    if (!q || q.trim().length === 0) {
      return NextResponse.json([]);
    }
    const results = await searchAll(q.trim());
    return NextResponse.json(results);
  } catch (error) {
    console.error("GET /api/search error:", error);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
