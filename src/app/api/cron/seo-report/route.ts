import Anthropic from "@anthropic-ai/sdk"
import { listAllArticles, type IrisArticle } from "@/lib/webflow/client"
import { getServiceClient, isSupabaseConfigured } from "@/lib/supabase/client"

export async function GET(req: Request) {
  if (req.headers.get("Authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return Response.json({ status: "error", error: "ANTHROPIC_API_KEY manquant" }, { status: 500 })
    }

    const articles = await listAllArticles().catch(() => [] as IrisArticle[])
    const totalArticles = articles.length

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const newThisWeek = articles.filter((a) => a.date >= sevenDaysAgo).length

    // Analyze content quality with Claude
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    const sample = articles.slice(0, 30)
    const postsSummary = sample
      .map((a) => {
        const contentLength = a.content.replace(/<[^>]*>/g, "").length
        return `- "${a.title}" (${a.collection}, ${contentLength} chars) — /${a.slug}`
      })
      .join("\n")

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1500,
      messages: [
        {
          role: "user",
          content: `Tu es IRIS, expert SEO pour autoecole-inris.com (comparateur d'auto-écoles en France, sur Webflow).

Analyse ces articles et génère un rapport SEO hebdomadaire :

Total articles publiés : ${totalArticles}
Nouveaux cette semaine : ${newThisWeek}

Échantillon (30 articles) :
${postsSummary}

Génère un rapport avec :
1. Score SEO estimé (0-100) basé sur la couverture thématique, la fréquence de publication, la qualité des titres/slugs et la longueur des contenus
2. Top 3 forces
3. Top 3 faiblesses
4. 5 recommandations concrètes pour la semaine prochaine
5. Idées d'articles à fort potentiel SEO

Réponds en JSON : {
  "score": number,
  "strengths": [string],
  "weaknesses": [string],
  "recommendations": [string],
  "article_ideas": [{ "title": string, "keyword": string, "estimated_volume": string }],
  "summary": string
}`,
        },
      ],
    })

    const responseText = response.content[0].type === "text" ? response.content[0].text : ""

    let report: {
      score: number
      strengths: string[]
      weaknesses: string[]
      recommendations: string[]
      article_ideas: { title: string; keyword: string; estimated_volume: string }[]
      summary: string
    }

    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/)
      if (!jsonMatch) throw new Error("No JSON")
      report = JSON.parse(jsonMatch[0])
    } catch {
      return Response.json({ status: "error", error: "Impossible de générer le rapport" }, { status: 500 })
    }

    const periodEnd = new Date()
    const periodStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

    const sb = isSupabaseConfigured() ? getServiceClient() : null
    if (sb) {
      await sb.from("iris_seo_reports").insert({
        report_type: "weekly",
        period_start: periodStart.toISOString().slice(0, 10),
        period_end: periodEnd.toISOString().slice(0, 10),
        summary: report.summary,
        data_json: {
          score: report.score,
          total_articles: totalArticles,
          new_this_week: newThisWeek,
          strengths: report.strengths,
          weaknesses: report.weaknesses,
          recommendations: report.recommendations,
          article_ideas: report.article_ideas,
        },
      })
    }

    return Response.json({
      status: "ok",
      score: report.score,
      total_articles: totalArticles,
      new_this_week: newThisWeek,
      recommendations: report.recommendations.length,
      article_ideas: report.article_ideas.length,
      summary: report.summary,
    })
  } catch (err) {
    return Response.json(
      { status: "error", error: err instanceof Error ? err.message : "Erreur SEO report" },
      { status: 500 },
    )
  }
}
