// Copyright 2026 TheQuantAI
// Supabase client singleton for QuantStudio (browser-side)

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://ccqacsutdpetwjuprhfu.supabase.co";
const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNjcWFjc3V0ZHBldHdqdXByaGZ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM1ODE2NjEsImV4cCI6MjA4OTE1NzY2MX0.JTx-0s1AMj4gUFRcOhLCjnRSgHI3jSjwR54cvMs8RzM";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true, // handles OAuth redirect hash fragments
  },
});
