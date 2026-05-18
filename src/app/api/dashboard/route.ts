import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/options"
import { listAllArticles, type IrisArticle } from "@/lib/webflow/client"
import { getServiceClient, isSupabaseConfigured } from "@/lib/supabase/client"

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) {
    return Response.json({ error: "Non autorise" }, { status: 401 })
  }

  const now = new Date()
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .split("T")[0]

  try {
    // Articles publiés depuis Webflow (Permis + Code)
    const allArticles = await listAllArticles().catch(() => [] as IrisArticle[])
    const totalArticles = allArticles.length
    const thisMonthArticles = allArticles.filter(
      (a) => a.date >= firstDayOfMonth,
    ).length

    let recentActivity: { title: string; type: string; status: string; created_at: string }[] = []
    let upcomingEvents: { title: string; content_type: string; planned_date: string }[] = []
    let latestSeoScore: number | null = null
    let top10Keywords: number | null = null

    if (isSupabaseConfigured()) {
      const sb = getServiceClient()
      const today = now.toISOString().split("T")[0]

      const [activityRes, eventsRes, seoRes, positionsRes] = await Promise.all([
        sb
          .from("iris_content_log")
          .select("title, type, status, created_at")
          .order("created_at", { ascending: false })
          .limit(5),
        sb
          .from("iris_editorial_calendar")
          .select("title, content_type, planned_date")
          .gte("planned_date", today)
          .order("planned_date", { ascending: true })
          .limit(5),
        sb
          .from("iris_seo_reports")
          .select("data_json")
          .order("created_at", { ascending: false })
          .limit(1),
        sb
          .from("iris_seo_positions")
          .select("keyword, position, tracked_at")
          .order("tracked_at", { ascending: false })
          .limit(200),
      ])

      recentActivity = activityRes.data ?? []
      upcomingEvents = eventsRes.data ?? []

      const seoRow = seoRes.data?.[0]
      if (seoRow?.data_json && typeof seoRow.data_json === "object") {
        const score = (seoRow.data_json as { score?: unknown }).score
        if (typeof score === "number") latestSeoScore = score
      }

      // Top 10 : on garde la position la plus récente par mot-clé.
      const positions = (positionsRes.data ?? []) as {
        keyword: string
        position: number | null
      }[]
      if (positions.length > 0) {
        const latestByKeyword = new Map<string, number | null>()
        for (const p of positions) {
          if (!latestByKeyword.has(p.keyword)) latestByKeyword.set(p.keyword, p.position)
        }
        top10Keywords = [...latestByKeyword.values()].filter(
          (pos) => pos != null && pos <= 10,
        ).length
      }
    }

    return Response.json({
      totalArticles,
      thisMonthArticles,
      recentActivity,
      upcomingEvents,
      latestSeoScore,
      top10Keywords,
    })
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Erreur" },
      { status: 500 },
    )
  }
}
