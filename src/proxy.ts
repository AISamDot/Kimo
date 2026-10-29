import { NextResponse, type NextRequest } from "next/server";

// Health checks (uptime monitors, dev previews) send HEAD / and expect 200
// instead of following the redirect to the login page.
export function proxy(request: NextRequest) {
  if (request.method === "HEAD") return new NextResponse(null, { status: 200 });
  return NextResponse.next();
}

export const config = { matcher: "/" };
