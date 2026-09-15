import { createClient, SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** True when real Google/Facebook OAuth (via Supabase Auth) is configured at build time. */
export const oauthEnabled = !!url && !!anonKey;

let client: SupabaseClient | null = null;

/** Lazily-created Supabase client. Returns null when OAuth is not configured (dev mock mode). */
export function getSupabase(): SupabaseClient | null {
  if (!oauthEnabled) return null;
  if (!client) {
    client = createClient(url as string, anonKey as string, {
      auth: { persistSession: true, detectSessionInUrl: true },
    });
  }
  return client;
}
