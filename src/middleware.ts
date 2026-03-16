// Copyright 2026 TheQuantAI
// Middleware — dashboard auth protection is handled client-side via useAuth().
// This file is kept minimal; expand if server-side route guards are needed.

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(_request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: [],
};
