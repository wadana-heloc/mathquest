// Server-side ONLY — never import this in client components or pages.
// The service-role key bypasses RLS, giving full read/write access.
// It is safe here because server actions never ship to the browser.

import { createClient } from '@supabase/supabase-js'

export function createAdminClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY is not set. ' +
      'Add it to .env.local — find it in your Supabase dashboard under ' +
      'Project Settings → API → service_role key.'
    )
  }
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceKey,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}
