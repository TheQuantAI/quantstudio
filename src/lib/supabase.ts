// Copyright 2026 TheQuantAI
// Supabase client singleton for QuantStudio (browser-side)

import { createClient } from "@supabase/supabase-js";

// Config comes from env only (STUDIO-017) — no hardcoded fallback. Set these in
// .env.local for local dev and in Vercel (Prod+Preview) for deploys.
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    "Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY — set them in your env (.env.local / Vercel).",
  );
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true, // handles OAuth redirect hash fragments
  },
});
