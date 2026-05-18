import Anthropic from "@anthropic-ai/sdk"
import { listAllArticles, type IrisArticle } from "@/lib/webflow/client"
import { scheduleSocialPost } from "@/lib/ghl/social-planner"
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
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const recentArticles = articles
      .filter((a) => a.date >= sevenDaysAgo)
      .sort((a, b) => (a.date < b.date ? 1 : -1))
      .slice(0, 10)

    if (recentArticles.length === 0) {
      return Response.json({ status: "ok", message: "Aucun article récent à promouvoir", scheduled: 0 })
    }

    const sb = isSupabaseConfigured() ? getServiceClient() : null

    // Articles déjà promus cette semaine (clé = webflow id stocké dans meta_json.article_id)
    const promotedIds = new Set<string>()
    if (sb) {
      const { data } = await sb
        .from("iris_social_posts")
        .select("media_urls")
        .gte("created_at", sevenDaysAgo)
      for (const row of data ?? []) {
        const meta = row.media_urls as { article_id?: string } | null
        if (meta?.article_id) promotedIds.add(meta.article_id)
      }
    }

    const articlesToPromote = recentArticles.filter((a) => !promotedIds.has(a.id)).slice(0, 3)

    if (articlesToPromote.length === 0) {
      return Response.json({ status: "ok", message: "Tous les articles récents ont déjà des posts", scheduled: 0 })
    }

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    const articlesText = articlesToPromote
      .map((a, i) => `${i + 1}. "${a.title}" — ${a.url}`)
      .join("\n")

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1500,
      messages: [
        {
          role: "user",
          content: `Tu es IRIS, community manager pour autoecole-inris.com.

Génère des posts Facebook pour promouvoir ces articles. Chaque post doit :
- Accrocher avec une question ou un chiffre
- Être engageant et accessible (cible : 17-25 ans)
- Inclure 3-5 hashtags pertinents
- Faire 100-200 caractères (hors hashtags)
- NE PAS inclure le lien (il sera ajouté automatiquement)

Articles :
${articlesText}

Réponds en JSON : { "posts": [{ "article_index": number, "text": string, "hashtags": ["tag1", "tag2"] }] }`,
        },
      ],
    })

    const responseText = response.content[0].type === "text" ? response.content[0].text : ""

    let socialPosts: { article_index: number; text: string; hashtags: string[] }[] = []
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        socialPosts = parsed.posts ?? []
      }
    } catch {
      return Response.json({ status: "error", error: "Impossible de parser la réponse Claude" }, { status: 500 })
    }

    let scheduled = 0
    const baseHour = 12

    for (const post of socialPosts) {
      const article = articlesToPromote[post.article_index - 1]
      if (!article) continue

      const scheduleTime = new Date()
      scheduleTime.setHours(baseHour + scheduled * 3, 0, 0, 0)
      if (scheduleTime < new Date()) {
        scheduleTime.setDate(scheduleTime.getDate() + 1)
      }

      try {
        await scheduleSocialPost({
          platform: "facebook",
          text: post.text,
          hashtags: post.hashtags,
          scheduled_at: scheduleTime.toISOString(),
          link_url: article.url,
          media_url: article.imageUrl,
        })

        if (sb) {
          await sb.from("iris_social_posts").insert({
            platform: "facebook",
            scheduled_at: scheduleTime.toISOString(),
            status: "scheduled",
            caption: `${post.text}\n\n${post.hashtags.map((h) => `#${h}`).join(" ")}`,
            media_urls: {
              link: article.url,
              media: article.imageUrl,
              article_id: article.id,
              article_slug: article.slug,
            },
          })
        }

        scheduled++
      } catch {
        // GHL API may fail — continue with next post
      }
    }

    return Response.json({
      status: "ok",
      articles_found: recentArticles.length,
      articles_promoted: articlesToPromote.length,
      posts_scheduled: scheduled,
    })
  } catch (err) {
    return Response.json(
      { status: "error", error: err instanceof Error ? err.message : "Erreur social auto" },
      { status: 500 },
    )
  }
}
