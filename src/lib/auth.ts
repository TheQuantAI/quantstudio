// Copyright 2026 TheQuantAI
// Auth module — migrated from NextAuth to Supabase Auth in D7.
// This file is kept for backward compatibility. New code should import from:
//   - @/lib/supabase (Supabase client)
//   - @/components/auth-provider (useAuth hook)

export { supabase } from "./supabase";
export { useAuth } from "@/components/auth-provider";
