// Copyright 2026 TheQuantAI
// NextAuth.js middleware for route protection

export { auth as middleware } from "@/lib/auth";

export const config = {
  // Only run middleware on protected routes
  // Studio, explore, backends, pricing are public
  // Dashboard requires auth
  matcher: ["/dashboard/:path*"],
};
