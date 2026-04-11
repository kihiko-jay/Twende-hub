/**
 * Server-only Supabase client with service role key.
 * Import only from server.ts or other Node backend code – never from React/frontend.
 */
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./supabase.types.ts";

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error(
    "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set for server-side Supabase client."
  );
}

export const supabaseServer = createClient<Database>(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});
