import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/options"
import { auditUrl } from "@/lib/dataforseo/onpage"
import { isDataForSeoConfigured } from "@/lib/dataforseo/client"

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return Response.json({ error: "Non autorisé" }, { status: 401 })
  if (!isDataForSeoConfigured()) {
    return Response.json({ error: "DATAFORSEO_API_KEY non configuré" }, { status: 503 })
  }

  try {
    const body = (await req.json()) as { url?: string }
    if (!body.url) return Response.json({ error: "url requis" }, { status: 400 })
    const data = await auditUrl(body.url)
    return Response.json(data)
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    )
  }
}
