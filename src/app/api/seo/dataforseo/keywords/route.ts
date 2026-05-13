import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/options"
import { getKeywordVolumes, getKeywordSuggestions } from "@/lib/dataforseo/keywords"
import { isDataForSeoConfigured } from "@/lib/dataforseo/client"

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return Response.json({ error: "Non autorisé" }, { status: 401 })
  if (!isDataForSeoConfigured()) {
    return Response.json({ error: "DATAFORSEO_API_KEY non configuré" }, { status: 503 })
  }

  try {
    const body = (await req.json()) as {
      mode?: "volumes" | "suggestions"
      keywords?: string[]
      seed?: string
      limit?: number
    }
    const mode = body.mode ?? (body.seed ? "suggestions" : "volumes")

    if (mode === "suggestions") {
      if (!body.seed) return Response.json({ error: "seed requis" }, { status: 400 })
      const data = await getKeywordSuggestions({ seed: body.seed, limit: body.limit })
      return Response.json({ mode, data })
    }

    if (!body.keywords?.length) return Response.json({ error: "keywords[] requis" }, { status: 400 })
    const data = await getKeywordVolumes({ keywords: body.keywords })
    return Response.json({ mode, data })
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    )
  }
}
