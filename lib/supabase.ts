import { createClient } from '@supabase/supabase-js';

// Server-side Supabase client with service role key for admin operations
export function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase environment variables');
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

// Client-side Supabase client (anon key)
export function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables');
  }

  return createClient(supabaseUrl, supabaseAnonKey);
}

// Helper to get public URL for a file
export function getSupabasePublicUrl(bucket: string, path: string): string {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) throw new Error('NEXT_PUBLIC_SUPABASE_URL not set');

  return `${supabaseUrl}/storage/v1/object/public/${bucket}/${path}`;
}

// Parse storage URL format: storage://bucket-name/path
export function parseStorageUrl(url?: string): { bucket: string; path: string } {
  if (!url) return { bucket: '', path: '' };

  const match = url.match(/^storage:\/\/([^\/]+)(?:\/(.*))?$/);
  if (!match) return { bucket: '', path: '' };

  return {
    bucket: match[1],
    path: (match[2] || '').replace(/^\/+|\/+$/g, '')
  };
}
