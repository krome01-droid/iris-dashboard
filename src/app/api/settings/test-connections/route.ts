import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/options"

interface ConnectionResult {
  name: string
  status: "ok" | "error" | "not_configured"
  detail?: string
}

const TIMEOUT_MS = 8000

async function withTimeout<T>(fn: () => Promise<T>, ms = TIMEOUT_MS): Promise<T> {
  return await Promise.race([
    fn(),
    new Promise<T>((_, rej) => setTimeout(() => rej(new Error(`timeout ${ms}ms`)), ms)),
  ])
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return Response.json({ error: "Non autorisé" }, { status: 401 })

  const results: ConnectionResult[] = []

  // 1. Webflow (CMS)
  try {
    if (!process.env.WF_API_KEY || !process.env.WF_SITE_ID) {
      results.push({ name: "webflow", status: "not_configured", detail: "WF_API_KEY ou WF_SITE_ID manquant" })
    } else {
      const res = await withTimeout(() =>
        fetch(`https://api.webflow.com/v2/sites/${process.env.WF_SITE_ID}`, {
          headers: { Authorization: `Bearer ${process.env.WF_API_KEY}`, "accept-version": "2.0.0" },
        }),
      )
      if (res.ok) {
        const data = (await res.json()) as { displayName?: string; shortName?: string }
        results.push({
          name: "webflow",
          status: "ok",
          detail: `Connecté — site « ${data.displayName ?? data.shortName ?? "inconnu"} »`,
        })
      } else {
        results.push({ name: "webflow", status: "error", detail: `HTTP ${res.status}` })
      }
    }
  } catch (err) {
    results.push({ name: "webflow", status: "error", detail: err instanceof Error ? err.message : String(err) })
  }

  // 2. Supabase
  try {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      results.push({ name: "supabase", status: "not_configured", detail: "SUPABASE_URL ou SERVICE_ROLE_KEY manquant" })
    } else {
      const { getServiceClient } = await import("@/lib/supabase/client")
      const { count, error } = await getServiceClient()
        .from("iris_conversations")
        .select("*", { count: "exact", head: true })
      if (!error) {
        results.push({ name: "supabase", status: "ok", detail: `Connecté — ${count ?? 0} conversation(s) en base` })
      } else {
        results.push({ name: "supabase", status: "error", detail: error.message })
      }
    }
  } catch (err) {
    results.push({ name: "supabase", status: "error", detail: err instanceof Error ? err.message : String(err) })
  }

  // 3. GoHighLevel (PIT v2)
  try {
    if (!process.env.GHL_PIT || !process.env.GHL_LOCATION_ID) {
      results.push({ name: "ghl", status: "not_configured", detail: "GHL_PIT ou GHL_LOCATION_ID manquant" })
    } else {
      const res = await withTimeout(() =>
        fetch(
          `https://services.leadconnectorhq.com/contacts/?locationId=${process.env.GHL_LOCATION_ID}&limit=1`,
          {
            headers: {
              Authorization: `Bearer ${process.env.GHL_PIT}`,
              Version: "2021-07-28",
              Accept: "application/json",
            },
          },
        ),
      )
      if (res.ok) {
        results.push({ name: "ghl", status: "ok", detail: "Connecté — API v2 (PIT)" })
      } else {
        const text = await res.text()
        results.push({ name: "ghl", status: "error", detail: `HTTP ${res.status}: ${text.slice(0, 80)}` })
      }
    }
  } catch (err) {
    results.push({ name: "ghl", status: "error", detail: err instanceof Error ? err.message : String(err) })
  }

  // 4. Claude API
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      results.push({ name: "claude", status: "not_configured" })
    } else {
      const res = await withTimeout(() =>
        fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "x-api-key": process.env.ANTHROPIC_API_KEY!,
            "anthropic-version": "2023-06-01",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: process.env.ANTHROPIC_MODEL_FAST ?? "claude-sonnet-4-6",
            max_tokens: 10,
            messages: [{ role: "user", content: "OK" }],
          }),
        }),
      )
      if (res.ok) {
        results.push({ name: "claude", status: "ok", detail: "Connecté — Claude API fonctionnelle" })
      } else {
        results.push({ name: "claude", status: "error", detail: `HTTP ${res.status}` })
      }
    }
  } catch (err) {
    results.push({ name: "claude", status: "error", detail: err instanceof Error ? err.message : String(err) })
  }

  // 5. DataForSEO
  try {
    if (!process.env.DATAFORSEO_API_KEY) {
      results.push({ name: "dataforseo", status: "not_configured" })
    } else {
      const res = await withTimeout(() =>
        fetch("https://api.dataforseo.com/v3/appendix/user_data", {
          headers: { Authorization: `Basic ${process.env.DATAFORSEO_API_KEY}` },
        }),
      )
      if (res.ok) {
        const data = (await res.json()) as {
          tasks?: Array<{ result?: Array<{ money?: { balance?: number } }> }>
        }
        const balance = data.tasks?.[0]?.result?.[0]?.money?.balance ?? 0
        results.push({ name: "dataforseo", status: "ok", detail: `Connecté — balance $${balance.toFixed(2)}` })
      } else {
        results.push({ name: "dataforseo", status: "error", detail: `HTTP ${res.status}` })
      }
    }
  } catch (err) {
    results.push({ name: "dataforseo", status: "error", detail: err instanceof Error ? err.message : String(err) })
  }

  // 6. Resend
  try {
    if (!process.env.RESEND_API_KEY) {
      results.push({ name: "resend", status: "not_configured" })
    } else {
      const res = await withTimeout(() =>
        fetch("https://api.resend.com/domains", {
          headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
        }),
      )
      if (res.ok) {
        const data = (await res.json()) as { data?: Array<{ name: string; status: string }> }
        const verified = data.data?.filter((d) => d.status === "verified") ?? []
        if (verified.length) {
          results.push({ name: "resend", status: "ok", detail: `Connecté — ${verified.length} domaine(s) vérifié(s)` })
        } else {
          results.push({
            name: "resend",
            status: "error",
            detail: "Aucun domaine vérifié — ajouter autoecole-inris.com sur resend.com/domains",
          })
        }
      } else {
        results.push({ name: "resend", status: "error", detail: `HTTP ${res.status}` })
      }
    }
  } catch (err) {
    results.push({ name: "resend", status: "error", detail: err instanceof Error ? err.message : String(err) })
  }

  // 7. OneSignal
  if (process.env.ONESIGNAL_APP_ID && process.env.ONESIGNAL_REST_API_KEY) {
    results.push({
      name: "onesignal",
      status: "ok",
      detail: `Configuré — App ${process.env.ONESIGNAL_APP_ID.slice(0, 8)}…`,
    })
  } else {
    results.push({ name: "onesignal", status: "not_configured" })
  }

  // 8. Kie.ai
  if (process.env.KIE_API_KEY) {
    results.push({ name: "kie", status: "ok", detail: "Configuré — génération d'images (GPT-4o Image)" })
  } else {
    results.push({ name: "kie", status: "not_configured" })
  }

  // 9. Fal.ai
  if (process.env.FAL_API_KEY) {
    results.push({ name: "fal", status: "ok", detail: "Configuré — fallback images (flux-pro)" })
  } else {
    results.push({ name: "fal", status: "not_configured" })
  }

  // 10. Apify
  try {
    if (!process.env.APIFY_API_TOKEN) {
      results.push({ name: "apify", status: "not_configured" })
    } else {
      const res = await withTimeout(() =>
        fetch(`https://api.apify.com/v2/acts?token=${process.env.APIFY_API_TOKEN}&limit=1`),
      )
      if (res.ok) {
        results.push({ name: "apify", status: "ok", detail: "Connecté" })
      } else {
        results.push({ name: "apify", status: "error", detail: `HTTP ${res.status}` })
      }
    }
  } catch (err) {
    results.push({ name: "apify", status: "error", detail: err instanceof Error ? err.message : String(err) })
  }

  // 11. Google (GA4 + Search Console)
  const hasOAuth = !!(
    process.env.GOOGLE_CLIENT_ID &&
    process.env.GOOGLE_CLIENT_SECRET &&
    process.env.GOOGLE_REFRESH_TOKEN
  )
  if (hasOAuth && process.env.GA4_PROPERTY_ID) {
    results.push({
      name: "google",
      status: "ok",
      detail: `Connecté — OAuth2 + GA4 ${process.env.GA4_PROPERTY_ID}`,
    })
  } else if (hasOAuth) {
    results.push({ name: "google", status: "not_configured", detail: "GA4_PROPERTY_ID manquant" })
  } else {
    results.push({ name: "google", status: "not_configured", detail: "OAuth Google manquant" })
  }

  return Response.json({ results })
}
