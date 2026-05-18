import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/options"
import { listAllArticlesAdmin } from "@/lib/webflow/client"

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return Response.json({ error: "Non autorise" }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const status = searchParams.get("status") // "publish" | "draft"
  const search = (searchParams.get("search") ?? "").trim().toLowerCase()
  const perPage = Number(searchParams.get("per_page") ?? "20")

  try {
    let articles = await listAllArticlesAdmin()

    if (status === "publish" || status === "draft") {
      articles = articles.filter((a) => a.status === status)
    }

    if (search) {
      articles = articles.filter(
        (a) =>
          a.title.toLowerCase().includes(search) ||
          a.slug.toLowerCase().includes(search),
      )
    }

    articles.sort((a, b) => (a.date < b.date ? 1 : -1))

    return Response.json(articles.slice(0, perPage))
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Erreur chargement" },
      { status: 500 },
    )
  }
}
