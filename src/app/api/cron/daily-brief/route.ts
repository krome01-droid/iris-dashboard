import Anthropic from "@anthropic-ai/sdk"
import { listAllArticles, type IrisArticle } from "@/lib/webflow/client"
import { getServiceClient, isSupabaseConfigured } from "@/lib/supabase/client"

interface LinkStats {
  slug: string
  title: string
  collection: "permis" | "code"
  date: string
  wordCount: number
  outgoingInternal: number
  incomingInternal: number
}

function analyzeContent(articles: IrisArticle[]): LinkStats[] {
  const incomingBySlug = new Map<string, number>()
  const stats: Omit<LinkStats, "incomingInternal">[] = []
  const hrefRe = /href=["']([^"']+)["']/gi

  for (const article of articles) {
    const html = article.content
    const text = html.replace(/<[^>]+>/g, " ")
    const wordCount = text.split(/\s+/).filter(Boolean).length

    let outgoingInternal = 0
    let m: RegExpExecArray | null
    while ((m = hrefRe.exec(html)) !== null) {
      const href = m[1]
      if (!href.includes("autoecole-inris.com")) continue
      outgoingInternal++
      try {
        const u = new URL(href, "https://autoecole-inris.com")
        const segments = u.pathname.split("/").filter(Boolean)
        const targetSlug = segments[segments.length - 1]
        if (targetSlug) {
          incomingBySlug.set(targetSlug, (incomingBySlug.get(targetSlug) ?? 0) + 1)
        }
      } catch {
        // ignore malformed URLs
      }
    }

    stats.push({
      slug: article.slug,
      title: article.title,
      collection: article.collection,
      date: article.date,
      wordCount,
      outgoingInternal,
    })
  }

  return stats.map((s) => ({ ...s, incomingInternal: incomingBySlug.get(s.slug) ?? 0 }))
}

export async function GET(req: Request) {
  if (req.headers.get("Authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const url = new URL(req.url)
  const dryRun = url.searchParams.get("dry_run") === "1"

  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return Response.json({ status: "error", error: "ANTHROPIC_API_KEY manquant" }, { status: 500 })
    }
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    const today = new Date().toLocaleDateString("fr-FR", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: "Europe/Paris",
    })

    const sb = isSupabaseConfigured() ? getServiceClient() : null

    // Inventaire Webflow + briefs récents + dernier rapport SEO (Supabase)
    const [articles, recentBriefsRes, seoReportsRes] = await Promise.all([
      listAllArticles().catch(() => [] as IrisArticle[]),
      sb
        ? sb
            .from("iris_content_log")
            .select("content_markdown, meta_json, created_at")
            .eq("type", "brief")
            .eq("created_by", "iris-cron")
            .order("created_at", { ascending: false })
            .limit(5)
        : Promise.resolve({ data: [], error: null }),
      sb
        ? sb
            .from("iris_seo_reports")
            .select("data_json, created_at")
            .order("created_at", { ascending: false })
            .limit(1)
        : Promise.resolve({ data: [], error: null }),
    ])

    const recentBriefs =
      (recentBriefsRes as { data: { content_markdown: string | null; meta_json: unknown }[] | null }).data ?? []
    const seoReports =
      (seoReportsRes as { data: { data_json: unknown }[] | null }).data ?? []

    const stats = analyzeContent(articles)

    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    const recentStats = stats.filter((s) => new Date(s.date) >= weekAgo)

    const orphans = stats.filter((s) => s.incomingInternal === 0)
    const linkPoor = stats
      .filter((s) => s.outgoingInternal < 3)
      .sort((a, b) => b.wordCount - a.wordCount)
    const thin = stats.filter((s) => s.wordCount < 400)
    const recentOrphans = recentStats.filter((s) => s.incomingInternal === 0)

    // Actions déjà proposées dans les briefs précédents
    const previousActions: string[] = []
    for (const b of recentBriefs) {
      const meta = b.meta_json as { actions?: { title: string }[] } | null
      if (meta?.actions) {
        for (const a of meta.actions) previousActions.push(a.title)
      } else if (b.content_markdown) {
        const matches = b.content_markdown.match(/\*\*([^*]+)\*\*/g) ?? []
        previousActions.push(...matches.map((m) => m.replace(/\*\*/g, "").trim()))
      }
    }

    const lastSeoData = (seoReports[0]?.data_json as { score?: number } | null) ?? null

    const articlesPermis = articles.filter((a) => a.collection === "permis").length
    const articlesCode = articles.filter((a) => a.collection === "code").length
    const totalArticles = articles.length
    const seoScore =
      lastSeoData?.score ?? Math.min(100, 40 + totalArticles * 0.05 + recentStats.length * 5)

    const fmt = (s: LinkStats) =>
      `${s.slug} (${s.collection}, ${s.wordCount}w, in:${s.incomingInternal} out:${s.outgoingInternal})`

    const prompt = `Tu es IRIS, l'agent IA d'autoecole-inris.com — comparateur d'auto-écoles en France.

Date du jour : ${today}

## Inventaire complet (Webflow, vérifié)

- Articles permis : ${articlesPermis}
- Articles code : ${articlesCode}
- Total publiés : ${totalArticles}
- Publiés cette semaine : ${recentStats.length}
- Score SEO : ${Math.round(seoScore)}/100

## Maillage interne — données réelles

**Pages orphelines (0 lien entrant) — ${orphans.length} :**
${orphans.slice(0, 30).map(fmt).join("\n") || "aucune"}

**Pages récentes orphelines (cette semaine, 0 lien entrant) — ${recentOrphans.length} :**
${recentOrphans.map(fmt).join("\n") || "aucune"}

**Pages pauvres en liens sortants (<3) — ${linkPoor.length}, top 20 triées par taille :**
${linkPoor.slice(0, 20).map(fmt).join("\n") || "aucune"}

**Pages thin content (<400 mots) — ${thin.length} :**
${thin.slice(0, 20).map(fmt).join("\n") || "aucune"}

## Briefs précédents — actions DÉJÀ proposées (NE PAS RÉPÉTER)

${previousActions.length ? previousActions.map((a) => `- ${a}`).join("\n") : "aucun brief précédent"}

## Mission

Génère le brief du jour pour Laurent. Règles strictes :

1. **Cite des slugs précis** issus de l'inventaire ci-dessus. Pas de généralités.
2. **N'invente aucune métrique** non listée ici.
3. **Ne propose PAS** d'action déjà listée dans "Briefs précédents". Soit tu proposes une suite/évolution explicite ("relancer X car…"), soit du neuf.
4. Si l'inventaire montre que le site est sain (peu d'orphelins, etc.), dis-le et propose des actions de croissance, pas de correction.
5. Direct, concret, sans blabla.

Réponds en JSON strict :
{
  "date": string,
  "site_status": string,
  "actions": [{ "title": string, "description": string, "impact": "fort"|"moyen"|"faible", "time_needed": string, "target_slugs": string[] }],
  "article_idea": { "title": string, "keywords": string[], "why": string, "estimated_traffic": string },
  "alert": string,
  "weekly_goal": string,
  "score": number
}`

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 3000,
      messages: [{ role: "user", content: prompt }],
    })

    const responseText = response.content[0].type === "text" ? response.content[0].text : ""

    const jsonMatch = responseText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error("Pas de JSON dans la réponse")
    const brief = JSON.parse(jsonMatch[0]) as {
      date: string
      site_status: string
      actions: {
        title: string
        description: string
        impact: string
        time_needed: string
        target_slugs?: string[]
      }[]
      article_idea: { title: string; keywords: string[]; why: string; estimated_traffic: string }
      alert: string
      weekly_goal: string
      score: number
    }

    const markdown = `## ${today}\n\n**État du site :** ${brief.site_status}\n\n**Actions prioritaires :**\n${brief.actions
      .map(
        (a) =>
          `- [${a.impact.toUpperCase()}] **${a.title}** (${a.time_needed}): ${a.description}${a.target_slugs?.length ? ` — cibles : ${a.target_slugs.join(", ")}` : ""}`,
      )
      .join("\n")}\n\n**Idée d'article :** ${brief.article_idea.title}\nMots-clés : ${brief.article_idea.keywords.join(", ")}\n${brief.article_idea.why}\n\n**Alerte :** ${brief.alert}\n\n**Objectif semaine :** ${brief.weekly_goal}`

    if (!dryRun && sb) {
      await sb.from("iris_content_log").insert({
        title: `Brief matinal — ${today}`,
        type: "brief",
        status: "published",
        content_markdown: markdown,
        meta_json: {
          source: "cron_daily_brief",
          score: brief.score,
          article_idea: brief.article_idea,
          actions: brief.actions,
          inventory: {
            articles: totalArticles,
            permis: articlesPermis,
            code: articlesCode,
            orphans: orphans.length,
            recent_orphans: recentOrphans.length,
            link_poor: linkPoor.length,
            thin: thin.length,
          },
        },
        created_by: "iris-cron",
      })
    }

    return Response.json({
      status: "ok",
      dry_run: dryRun,
      date: today,
      score: brief.score,
      site_status: brief.site_status,
      actions: brief.actions,
      article_idea: brief.article_idea,
      alert: brief.alert,
      weekly_goal: brief.weekly_goal,
      inventory: {
        articles: totalArticles,
        permis: articlesPermis,
        code: articlesCode,
        recent: recentStats.length,
        orphans: orphans.length,
        recent_orphans: recentOrphans.length,
        link_poor: linkPoor.length,
        thin: thin.length,
      },
    })
  } catch (err) {
    return Response.json(
      { status: "error", error: err instanceof Error ? err.message : "Erreur daily-brief" },
      { status: 500 },
    )
  }
}
