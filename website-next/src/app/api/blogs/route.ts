import { NextRequest, NextResponse } from "next/server";
import { getBlogs, createBlog } from "@/lib/db";

export async function GET() {
  try {
    const blogs = await getBlogs();
    return NextResponse.json(blogs);
  } catch (error) {
    console.error("GET /api/blogs error:", error);
    return NextResponse.json({ error: "Failed to fetch blogs" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const blog = await createBlog(body);
    return NextResponse.json(blog, { status: 201 });
  } catch (error) {
    console.error("POST /api/blogs error:", error);
    return NextResponse.json({ error: "Failed to create blog" }, { status: 500 });
  }
}
