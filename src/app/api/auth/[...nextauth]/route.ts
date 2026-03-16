// Copyright 2026 TheQuantAI
// Legacy NextAuth route — auth is now handled by Supabase Auth.
// This file exists to prevent 404s on any old /api/auth/* requests.

import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    { message: "Auth has been migrated to Supabase. Use /login or /signup." },
    { status: 410 },
  );
}

export async function POST() {
  return NextResponse.json(
    { message: "Auth has been migrated to Supabase. Use /login or /signup." },
    { status: 410 },
  );
}
