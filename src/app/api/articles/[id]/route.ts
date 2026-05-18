import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/options"
import { getArticleById, updateArticle } from "@/lib/webflow/client"
import { z } from "zod"

const updateSchema = z.object({
  title: z.string().min(1).optional(),
  status: z.enum(["publish", "draft"]).optional(),
  collectionId: z.string().min(1),
})

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return Response.json({ error: "Non autorise" }, { status: 401 })
  }

  const { id } = await params
  const collectionId = new URL(req.url).searchParams.get("collectionId") ?? undefined

  try {
    const article = await getArticleById(id, collectionId)
    if (!article) {
      return Response.json({ error: "Article introuvable" }, { status: 404 })
    }
    return Response.json(article)
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Erreur" },
      { status: 500 },
    )
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return Response.json({ error: "Non autorise" }, { status: 401 })
  }

  const { id } = await params
  const body = await req.json()
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: "Donnees invalides" }, { status: 400 })
  }

  try {
    await updateArticle(parsed.data.collectionId, id, {
      title: parsed.data.title,
      status: parsed.data.status,
    })

    const article = await getArticleById(id, parsed.data.collectionId)
    return Response.json(article ?? { success: true })
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Erreur sauvegarde" },
      { status: 500 },
    )
  }
}
