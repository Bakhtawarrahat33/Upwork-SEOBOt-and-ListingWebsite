import { NextRequest, NextResponse } from "next/server";
import { getServices, createService } from "@/lib/db";

export async function GET() {
  try {
    const services = await getServices();
    return NextResponse.json(services);
  } catch (error) {
    console.error("GET /api/services error:", error);
    return NextResponse.json({ error: "Failed to fetch services" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const service = await createService(body);
    return NextResponse.json(service, { status: 201 });
  } catch (error) {
    console.error("POST /api/services error:", error);
    return NextResponse.json({ error: "Failed to create service" }, { status: 500 });
  }
}
