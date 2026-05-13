// Supabase — clients server-side
// - serviceClient: privilèges admin (bypass RLS), à utiliser uniquement dans routes API/cron
// - anonClient: pour requêtes publiques avec RLS (futur usage côté navigateur si besoin)
import { createClient, type SupabaseClient } from "@supabase/supabase-js"

let _service: SupabaseClient | null = null
let _anon: SupabaseClient | null = null

export function isSupabaseConfigured(): boolean {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
}

export function getServiceClient(): SupabaseClient {
  if (_service) return _service
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error("SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY manquant")
  _service = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return _service
}

export function getAnonClient(): SupabaseClient {
  if (_anon) return _anon
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_ANON_KEY
  if (!url || !key) throw new Error("SUPABASE_URL ou SUPABASE_ANON_KEY manquant")
  _anon = createClient(url, key, { auth: { persistSession: false } })
  return _anon
}
