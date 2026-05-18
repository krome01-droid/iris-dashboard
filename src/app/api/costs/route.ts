import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/options"
import { getServiceClient, isSupabaseConfigured } from "@/lib/supabase/client"

const USD_TO_EUR = 0.92

// iris_api_costs.service → clé service de la page Coûts
const SERVICE_KEY: Record<string, string> = { anthropic: "claude" }

interface CostRow {
  service: string
  cost_usd: number | null
  units: number | null
  metadata: Record<string, unknown> | null
}

interface ServicePatch {
  key: string
  status: "balance"
  spent30dUsd: number
  spent30dEur: number
  meta: string
  details?: { label: string; value: string }[]
}

function fmtInt(n: number) {
  return new Intl.NumberFormat("fr-FR").format(Math.round(n))
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) {
    return Response.json({ error: "Non autorise" }, { status: 401 })
  }

  if (!isSupabaseConfigured()) {
    return Response.json({ services: [] })
  }

  try {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

    const { data, error } = await getServiceClient()
      .from("iris_api_costs")
      .select("service, cost_usd, units, metadata")
      .gte("occurred_at", since)

    if (error) throw new Error(error.message)

    const rows = (data ?? []) as CostRow[]
    if (rows.length === 0) {
      return Response.json({ services: [] })
    }

    // Agrégation par service
    const agg = new Map<
      string,
      { usd: number; requests: number; input: number; output: number; cacheW: number; cacheR: number }
    >()

    for (const row of rows) {
      const svc = row.service
      const cur =
        agg.get(svc) ?? { usd: 0, requests: 0, input: 0, output: 0, cacheW: 0, cacheR: 0 }
      cur.usd += Number(row.cost_usd) || 0
      cur.requests += 1
      const m = row.metadata ?? {}
      cur.input += Number(m.input_tokens) || 0
      cur.output += Number(m.output_tokens) || 0
      cur.cacheW += Number(m.cache_creation_input_tokens) || 0
      cur.cacheR += Number(m.cache_read_input_tokens) || 0
      agg.set(svc, cur)
    }

    const services: ServicePatch[] = []

    for (const [svc, v] of agg) {
      const key = SERVICE_KEY[svc] ?? svc
      const patch: ServicePatch = {
        key,
        status: "balance",
        spent30dUsd: Number(v.usd.toFixed(2)),
        spent30dEur: Number((v.usd * USD_TO_EUR).toFixed(2)),
        meta: `${v.requests} appel(s) loggé(s) sur 30 jours`,
      }

      if (key === "claude") {
        patch.details = [
          { label: "Requêtes", value: fmtInt(v.requests) },
          { label: "Input tokens", value: fmtInt(v.input) },
          { label: "Output tokens", value: fmtInt(v.output) },
          { label: "Cache R/W", value: `${fmtInt(v.cacheR)} / ${fmtInt(v.cacheW)}` },
          { label: "Total tokens", value: fmtInt(v.input + v.output + v.cacheW + v.cacheR) },
        ]
      }

      services.push(patch)
    }

    return Response.json({ services })
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Erreur" },
      { status: 500 },
    )
  }
}
