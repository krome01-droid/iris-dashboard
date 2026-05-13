import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/options"
import { getRankedKeywords, getContentGap } from "@/lib/dataforseo/competitors"
import { isDataForSeoConfigured } from "@/lib/dataforseo/client"

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return Response.json({ error: "Non autorisé" }, { status: 401 })
  if (!isDataForSeoConfigured()) {
    return Response.json({ error: "DATAFORSEO_API_KEY non configuré" }, { status: 503 })
  }

  try {
    const body = (await req.json()) as {
      mode?: "ranked" | "gap"
      domain?: string
      limit?: number
    }
    if (!body.domain) return Response.json({ error: "domain requis" }, { status: 400 })

    if ((body.mode ?? "ranked") === "gap") {
      const data = await getContentGap({ competitorDomain: body.domain })
      return Response.json({ mode: "gap", count: data.length, data: data.slice(0, 100) })
    }

    const data = await getRankedKeywords({ domain: body.domain, limit: body.limit ?? 100 })
    return Response.json({ mode: "ranked", count: data.length, data })
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    )
  }
}
