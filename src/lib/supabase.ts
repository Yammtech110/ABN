import { createClient, SupabaseClient } from '@supabase/supabase-js';

/** Live project — used when build env forgot VITE_* (old zxyofml… must never ship). */
const PROD_SUPABASE_URL = 'https://ogawxkmjrwcujulvnahy.supabase.co';
const PROD_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9nYXd4a21qcndjdWp1bHZuYWh5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ3MjI4ODAsImV4cCI6MjEwMDI5ODg4MH0.5h0VVUNAknFaPbY5BYHk0MHb9W-Y9UiHMAOJAiRtqYw';

const supabaseUrl =
  (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() ||
  (import.meta.env.PROD ? PROD_SUPABASE_URL : undefined);
const supabaseAnonKey =
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim() ||
  (import.meta.env.PROD ? PROD_SUPABASE_ANON_KEY : undefined);

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

/** Browser Supabase client — persists session for onAuthStateChange */
export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabaseAnonKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: 'pkce',
      },
    })
  : null;
