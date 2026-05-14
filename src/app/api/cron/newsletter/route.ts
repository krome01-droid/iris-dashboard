import Anthropic from "@anthropic-ai/sdk"
import { listAllArticles, type IrisArticle } from "@/lib/webflow/client"
import { sendBulkEmail } from "@/lib/ghl/email"
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
    const weeklyArticles = articles
      .filter((a) => a.date >= sevenDaysAgo)
      .sort((a, b) => (a.date < b.date ? 1 : -1))
      .slice(0, 8)

    if (weeklyArticles.length === 0) {
      return Response.json({ status: "ok", message: "Aucun article cette semaine, newsletter non envoyée", sent: 0 })
    }

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    const articlesText = weeklyArticles
      .map((a) => `- "${a.title}" — ${a.url}`)
      .join("\n")

    const today = new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2000,
      messages: [
        {
          role: "user",
          content: `Tu es IRIS, rédacteur de la newsletter hebdomadaire d'autoecole-inris.com.

Génère le CONTENU (pas le HTML complet, juste le corps) d'une newsletter digest avec :
- Un titre accrocheur pour cette semaine
- Un court édito (2-3 phrases) sur l'actualité auto-école
- La liste des articles de la semaine avec un résumé d'une phrase pour chacun
- Un CTA vers le site

Date : ${today}
Articles de la semaine :
${articlesText}

Réponds en JSON : { "subject": string, "edito": string, "articles": [{ "title": string, "summary": string, "url": string }], "cta_text": string }`,
        },
      ],
    })

    const responseText = response.content[0].type === "text" ? response.content[0].text : ""

    let newsletter: {
      subject: string
      edito: string
      articles: { title: string; summary: string; url: string }[]
      cta_text: string
    }
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/)
      if (!jsonMatch) throw new Error("No JSON")
      newsletter = JSON.parse(jsonMatch[0])
    } catch {
      return Response.json({ status: "error", error: "Impossible de générer le contenu newsletter" }, { status: 500 })
    }

    // Build HTML — charte INRI'S (#281B59 → #C10058)
    const articleRows = newsletter.articles
      .map(
        (a) => `
        <tr>
          <td style="padding: 16px 20px; border-bottom: 1px solid #eeeeee;">
            <h3 style="margin: 0 0 4px 0; font-size: 16px; font-family: Arial, sans-serif;">
              <a href="${a.url}" style="color: #C10058; text-decoration: none;">${a.title}</a>
            </h3>
            <p style="margin: 0; font-size: 14px; color: #1F3149; font-family: Arial, sans-serif; line-height: 1.5;">${a.summary}</p>
          </td>
        </tr>`,
      )
      .join("")

    const html = `
      <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; background:#F9FAFE;">
        <div style="padding: 28px 40px; background: linear-gradient(90deg, #281B59 0%, #C10058 100%); text-align: center;">
          <h1 style="margin: 0; font-size: 28px; font-family: 'Montserrat', Arial, sans-serif; font-weight: 800; color:#ffffff;">
            INRI'S <span style="font-weight:600;">FORMATIONS</span>
          </h1>
          <p style="margin: 8px 0 0 0; font-size: 12px; color: #ffffffcc; text-transform: uppercase; letter-spacing: 2px;">Newsletter Hebdomadaire</p>
        </div>

        <div style="padding: 30px 40px; background:#ffffff;">
          <p style="font-size: 16px; line-height: 1.6; color: #1F3149; margin: 0 0 20px 0;">
            Bonjour {{contact.first_name}},
          </p>
          <p style="font-size: 16px; line-height: 1.6; color: #1F3149; margin: 0 0 25px 0;">
            ${newsletter.edito}
          </p>

          <h2 style="color: #C10058; font-size: 18px; margin: 0 0 16px 0; font-family: 'Montserrat', Arial, sans-serif; font-weight: 800;">Les articles de la semaine</h2>
          <table width="100%" border="0" cellpadding="0" cellspacing="0" style="margin-bottom: 25px;">
            ${articleRows}
          </table>

          <table width="100%" border="0" cellpadding="0" cellspacing="0">
            <tr>
              <td align="center">
                <a href="https://autoecole-inris.com" style="display: inline-block; background: linear-gradient(90deg, #281B59 0%, #C10058 100%); color: #ffffff; font-family: Arial, sans-serif; font-size: 16px; font-weight: bold; text-decoration: none; padding: 14px 36px; border-radius: 8px;">${newsletter.cta_text}</a>
              </td>
            </tr>
          </table>
        </div>

        <div style="padding: 20px 40px; background-color: #1F3149; text-align: center;">
          <p style="font-size: 12px; color: #9AA6B7; margin: 0; font-family: Arial, sans-serif;">
            INRI'S Formations — Le comparateur d'auto-écoles en France
          </p>
        </div>
      </div>`

    const result = await sendBulkEmail(newsletter.subject, html)

    const sb = isSupabaseConfigured() ? getServiceClient() : null
    if (sb) {
      await sb.from("iris_content_log").insert({
        title: newsletter.subject,
        type: "newsletter",
        status: "published",
        content_markdown: newsletter.edito,
        meta_json: {
          total: result.total,
          success: result.success,
          errors: result.errors.length,
          articles_count: weeklyArticles.length,
        },
        created_by: "iris-newsletter",
      })
    }

    return Response.json({
      status: "ok",
      subject: newsletter.subject,
      articles_count: weeklyArticles.length,
      sent: result.success,
      total: result.total,
      errors: result.errors.length,
    })
  } catch (err) {
    return Response.json(
      { status: "error", error: err instanceof Error ? err.message : "Erreur newsletter" },
      { status: 500 },
    )
  }
}
