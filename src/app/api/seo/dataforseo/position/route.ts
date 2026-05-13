import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/options"
import { getPosition } from "@/lib/dataforseo/serp"
import { isDataForSeoConfigured } from "@/lib/dataforseo/client"

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return Response.json({ error: "Non autorisé" }, { status: 401 })
  if (!isDataForSeoConfigured()) {
    return Response.json({ error: "DATAFORSEO_API_KEY non configuré" }, { status: 503 })
  }

  try {
    const body = (await req.json()) as { keyword?: string; target?: string }
    if (!body.keyword) return Response.json({ error: "keyword requis" }, { status: 400 })
    const result = await getPosition({ keyword: body.keyword, target: body.target })
    return Response.json(result)
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    )
  }
}
