import type { ToolCallResult } from "./types"
import { marked } from "marked"
import { scheduleSocialPost } from "@/lib/ghl/social-planner"
import { sendPreviewEmail, sendBulkEmail } from "@/lib/ghl/email"
import { query, execute } from "@/lib/db/connection"
import { isGoogleConfigured } from "@/lib/google/auth"
import { getSessions, getTopPages, getTrafficSources, getDevices, getDailyVisits } from "@/lib/google/ga4"
import { getTopKeywords } from "@/lib/google/search-console"
import { searchGoogleSerp, scrapeWebpage } from "@/lib/apify/client"
import { generateImage } from "@/lib/openrouter/client"
import { getTemplate, listTemplates, type TemplateName } from "@/lib/templates/email-templates"
import {
  searchContacts, createContact, updateContact, addContactTags, removeContactTags,
  addContactNote, createContactTask, sendSms, getConversations,
  listPipelines, getOpportunities, createOpportunity, updateOpportunity,
  listWorkflows, triggerWorkflow,
  listCalendars, getAppointments, createAppointment,
  getContact,
} from "@/lib/ghl/crm"
import {
  createItem, updateItem, listItems, publishItem, markdownToWebflowRichText,
  listAllArticlesAdmin, getArticleById, updateArticle,
  type IrisArticleAdmin,
} from "@/lib/webflow/client"

// IDs des deux collections blog Webflow (Permis / Code).
const BLOG_COLLECTION_IDS: Record<"permis" | "code", string> = {
  permis: process.env.WF_COLLECTION_ID_PERMIS_BLOGS ?? "67c976212edb4724b8839729",
  code: process.env.WF_COLLECTION_ID_CODE_BLOGS ?? "67f3cadace1bbcd2670c8e4e",
}
import { getPosition } from "@/lib/dataforseo/serp"
import { getKeywordVolumes, getKeywordSuggestions } from "@/lib/dataforseo/keywords"
import { getRankedKeywords, getContentGap } from "@/lib/dataforseo/competitors"
import { auditUrl } from "@/lib/dataforseo/onpage"

type ToolHandler = (input: Record<string, unknown>) => Promise<unknown>

const toolHandlers: Record<string, ToolHandler> = {
  async publish_article(input) {
    const collection = String(input.collection ?? "") as "permis" | "code"
    const collectionId = BLOG_COLLECTION_IDS[collection]
    if (!collectionId) {
      throw new Error("collection requise — valeurs autorisées : 'permis' ou 'code'")
    }

    const htmlContent = await marked.parse(String(input.content_markdown ?? ""))
    const isDraft = input.status !== "publish"

    const fields: Record<string, unknown> = {
      name: String(input.title),
      slug: String(input.slug),
      "blog-post-richt-text": htmlContent,
    }
    if (input.summary) fields["blog-post-summary"] = String(input.summary)

    const item = await createItem(collectionId, fields, isDraft)

    if (!isDraft) {
      await publishItem(collectionId, item.id).catch(() => {
        // La publication peut échouer si le site n'est pas prêt — non bloquant.
      })
    }

    const slug = String(input.slug ?? "")
    const url = slug
      ? `https://autoecole-inris.com/${collection}/${slug}`
      : "https://autoecole-inris.com"

    // Log dans le journal de contenu (non bloquant)
    try {
      await execute(
        `INSERT INTO wp_iris_content_log (title, type, status, wp_post_id, wp_url, meta_json, created_by)
         VALUES (?, 'article', ?, ?, ?, ?, 'iris')`,
        [
          String(input.title),
          isDraft ? "draft" : "published",
          item.id,
          url,
          JSON.stringify({ collection, target_keyword: input.target_keyword }),
        ],
      )
    } catch {
      // DB logging failure should not block
    }

    return {
      success: true,
      item_id: item.id,
      collection,
      url,
      status: isDraft ? "draft" : "publish",
    }
  },

  async schedule_social(input) {
    // L'URL de l'image est fournie directement (image_url retournée par generate_image).
    const mediaUrl = input.media_url ? String(input.media_url) : undefined

    const result = await scheduleSocialPost({
      platform: String(input.platform),
      text: String(input.text),
      hashtags: input.hashtags as string[] | undefined,
      scheduled_at: String(input.scheduled_at),
      link_url: input.link_url ? String(input.link_url) : undefined,
      media_url: mediaUrl,
    })

    // Log to social_posts
    try {
      await execute(
        `INSERT INTO wp_iris_social_posts (platform, scheduled_at, status, caption)
         VALUES (?, ?, 'scheduled', ?)`,
        [String(input.platform), String(input.scheduled_at), String(input.text)],
      )
    } catch {
      // DB logging failure should not block
    }

    // Log to editorial calendar so posts appear in the calendar view
    try {
      const title = String(input.text).slice(0, 100)
      const plannedDate = String(input.scheduled_at).split("T")[0]
      const notes = `Post ${input.platform}`
      await execute(
        `INSERT INTO wp_iris_editorial_calendar (title, content_type, planned_date, status, notes)
         VALUES (?, 'social_campaign', ?, 'planned', ?)`,
        [title, plannedDate, notes],
      )
    } catch {
      // DB logging failure should not block
    }

    return { success: true, result }
  },

  async send_email(input) {
    const subject = String(input.subject)
    const html_content = String(input.html_content)
    const mode = String(input.mode ?? "preview")

    if (mode === "preview") {
      return await sendPreviewEmail(subject, html_content)
    }
    return await sendBulkEmail(subject, html_content)
  },

  async get_site_content_audit(_input) {
    const articles = await listAllArticlesAdmin()

    const summarize = (a: IrisArticleAdmin) => ({
      id: a.id,
      title: a.title,
      slug: a.slug,
      collection: a.collection,
      status: a.status,
      link: a.url,
      date: a.date,
    })

    const cutoff18months = new Date()
    cutoff18months.setMonth(cutoff18months.getMonth() - 18)
    const cutoff30days = new Date()
    cutoff30days.setDate(cutoff30days.getDate() - 30)

    const published = articles.filter((a) => a.status === "publish")
    const drafts = articles.filter((a) => a.status === "draft")

    const byCollection = {
      permis: articles.filter((a) => a.collection === "permis").length,
      code: articles.filter((a) => a.collection === "code").length,
    }

    const oldArticles = published
      .filter((a) => new Date(a.date) < cutoff18months)
      .slice(0, 30)
      .map(summarize)
    const recentArticles = published
      .filter((a) => new Date(a.date) >= cutoff30days)
      .slice(0, 20)
      .map(summarize)

    return {
      total_articles: articles.length,
      published: published.length,
      drafts: drafts.length,
      by_collection: byCollection,
      old_articles_to_refresh: {
        count: oldArticles.length,
        note: "Articles non publiés/modifiés depuis > 18 mois — candidats au content refresh",
        articles: oldArticles,
      },
      recent_articles: {
        count: recentArticles.length,
        note: "Articles publiés dans les 30 derniers jours",
        articles: recentArticles,
      },
      sample_published: published.slice(0, 50).map(summarize),
    }
  },

  async search_wp_posts(input) {
    const term = String(input.search ?? "").toLowerCase().trim()
    const perPage = Math.min(Number(input.per_page ?? 10), 20)
    const collectionFilter = input.collection ? String(input.collection) : "all"
    const statusFilter = input.status ? String(input.status) : "publish"

    let articles = await listAllArticlesAdmin()

    if (collectionFilter === "permis" || collectionFilter === "code") {
      articles = articles.filter((a) => a.collection === collectionFilter)
    }
    if (statusFilter === "publish" || statusFilter === "draft") {
      articles = articles.filter((a) => a.status === statusFilter)
    }
    if (term) {
      articles = articles.filter((a) =>
        a.title.toLowerCase().includes(term) ||
        a.slug.toLowerCase().includes(term) ||
        a.summary.toLowerCase().includes(term),
      )
    }

    return articles.slice(0, perPage).map((a) => ({
      id: a.id,
      title: a.title,
      slug: a.slug,
      collection: a.collection,
      status: a.status,
      link: a.url,
      date: a.date,
    }))
  },

  async get_calendar(input) {
    let sql = "SELECT * FROM wp_iris_editorial_calendar WHERE 1=1"
    const params: (string | number)[] = []

    if (input.month) {
      sql += " AND DATE_FORMAT(planned_date, '%Y-%m') = ?"
      params.push(String(input.month))
    }
    if (input.status) {
      sql += " AND status = ?"
      params.push(String(input.status))
    }
    sql += " ORDER BY planned_date ASC"

    return await query(sql, params)
  },

  async create_calendar_event(input) {
    const result = await execute(
      `INSERT INTO wp_iris_editorial_calendar (title, content_type, planned_date, status, notes)
       VALUES (?, ?, ?, ?, ?)`,
      [
        String(input.title),
        String(input.content_type ?? "other"),
        String(input.planned_date),
        String(input.status ?? "planned"),
        input.notes ? String(input.notes) : null,
      ],
    )

    return { success: true, id: result.insertId }
  },

  async get_seo_data(input) {
    const type = String(input.type ?? "keywords")

    if (!isGoogleConfigured()) {
      // Try DB reports as fallback
      let reportData: Record<string, unknown> = {}
      try {
        const rows = await query<{ data_json: string }>(
          "SELECT data_json FROM wp_iris_seo_reports WHERE report_type = 'weekly' ORDER BY created_at DESC LIMIT 1",
        )
        if (rows[0]) reportData = JSON.parse(rows[0].data_json)
      } catch {
        // DB not available
      }

      if (Object.keys(reportData).length > 0) {
        return { searchConsoleConnected: false, note: "Données issues du dernier rapport SEO en base", ...reportData }
      }

      return {
        searchConsoleConnected: false,
        note: "Google Search Console non connecté et aucun rapport SEO en base. L'administrateur doit connecter Google dans Paramètres > Google.",
      }
    }

    // Get latest SEO report from DB
    let reportData: Record<string, unknown> = {}
    try {
      const rows = await query<{ data_json: string }>(
        "SELECT data_json FROM wp_iris_seo_reports WHERE report_type = 'weekly' ORDER BY created_at DESC LIMIT 1",
      )
      if (rows[0]) reportData = JSON.parse(rows[0].data_json)
    } catch {
      // DB may not be available
    }

    let keywords: { keyword: string; position: number; trend: string; clicks: number; impressions: number }[] = []
    try {
      keywords = await getTopKeywords(15)
    } catch {
      // Search Console may fail
    }

    if (type === "keywords") {
      return {
        searchConsoleConnected: true,
        keywords: keywords.map((k) => ({
          keyword: k.keyword,
          position: k.position,
          trend: k.trend,
          volume: k.impressions,
        })),
      }
    }

    const score = (reportData.score as number) ?? null
    const strengths = (reportData.strengths as string[]) ?? []
    const weaknesses = (reportData.weaknesses as string[]) ?? []
    const recommendations = (reportData.recommendations as string[]) ?? []

    return {
      searchConsoleConnected: true,
      score,
      strengths,
      weaknesses,
      recommendations,
      issues: weaknesses.map((w, i) => ({
        severity: i < 2 ? "error" : "warning",
        message: w,
      })),
    }
  },

  async get_analytics(input) {
    const period = String(input.period ?? "30d")

    if (!isGoogleConfigured()) {
      return {
        configured: false,
        note: "Google Analytics (GA4) non connecté. L'administrateur doit connecter Google dans Paramètres > Google et ajouter GA4_PROPERTY_ID.",
      }
    }

    const [sessions, topPages, sources, devices, dailyVisits] = await Promise.all([
      getSessions(period),
      getTopPages(period),
      getTrafficSources(period),
      getDevices(period),
      getDailyVisits(period),
    ])

    return {
      configured: true,
      period,
      ...sessions,
      topPages,
      sources,
      devices,
      dailyVisits,
    }
  },

  // ── GHL CRM ──────────────────────────────────────────────────────

  async ghl_search_contacts(input) {
    const contacts = await searchContacts(String(input.query), Number(input.limit ?? 20))
    return {
      total: contacts.length,
      contacts: contacts.map((c) => ({
        id: c.id,
        name: [c.firstName, c.lastName].filter(Boolean).join(" "),
        email: c.email,
        phone: c.phone,
        company: c.companyName,
        tags: c.tags ?? [],
        dateAdded: c.dateAdded,
      })),
    }
  },

  async ghl_create_contact(input) {
    const contact = await createContact({
      firstName: input.firstName ? String(input.firstName) : undefined,
      lastName: input.lastName ? String(input.lastName) : undefined,
      email: input.email ? String(input.email) : undefined,
      phone: input.phone ? String(input.phone) : undefined,
      companyName: input.companyName ? String(input.companyName) : undefined,
      city: input.city ? String(input.city) : undefined,
      source: input.source ? String(input.source) : undefined,
      tags: input.tags as string[] | undefined,
    })
    return {
      success: true,
      contactId: contact.id,
      name: [contact.firstName, contact.lastName].filter(Boolean).join(" "),
    }
  },

  async ghl_update_contact(input) {
    const contactId = String(input.contactId)
    const updateData: Record<string, unknown> = {}
    if (input.firstName) updateData.firstName = String(input.firstName)
    if (input.lastName) updateData.lastName = String(input.lastName)
    if (input.email) updateData.email = String(input.email)
    if (input.phone) updateData.phone = String(input.phone)
    if (input.companyName) updateData.companyName = String(input.companyName)
    if (input.city) updateData.city = String(input.city)

    const promises: Promise<unknown>[] = []
    if (Object.keys(updateData).length > 0) {
      promises.push(updateContact(contactId, updateData))
    }
    if ((input.tags_add as string[] | undefined)?.length) {
      promises.push(addContactTags(contactId, input.tags_add as string[]))
    }
    if ((input.tags_remove as string[] | undefined)?.length) {
      promises.push(removeContactTags(contactId, input.tags_remove as string[]))
    }

    await Promise.all(promises)
    return { success: true, contactId }
  },

  async ghl_add_note(input) {
    const result = await addContactNote(String(input.contactId), String(input.body))
    return { success: true, noteId: result.id }
  },

  async ghl_create_task(input) {
    const result = await createContactTask(
      String(input.contactId),
      String(input.title),
      String(input.dueDate),
      input.description ? String(input.description) : undefined,
    )
    return { success: true, taskId: result.id }
  },

  async ghl_send_sms(input) {
    const result = await sendSms(String(input.contactId), String(input.message))
    return { success: true, messageId: result.id }
  },

  async ghl_get_conversations(input) {
    const conversations = await getConversations({
      contactId: input.contactId ? String(input.contactId) : undefined,
      limit: Number(input.limit ?? 20),
    })
    return {
      total: conversations.length,
      conversations: conversations.map((c) => ({
        id: c.id,
        contact: c.fullName ?? c.email ?? c.contactId,
        lastMessage: c.lastMessageBody,
        lastMessageType: c.lastMessageType,
        unread: c.unreadCount,
        updatedAt: c.dateUpdated,
      })),
    }
  },

  async ghl_get_pipeline(input) {
    if (input.list_pipelines) {
      const pipelines = await listPipelines()
      return {
        pipelines: pipelines.map((p) => ({
          id: p.id,
          name: p.name,
          stages: p.stages.map((s) => ({ id: s.id, name: s.name, position: s.position })),
        })),
      }
    }
    const opportunities = await getOpportunities({
      pipelineId: input.pipelineId ? String(input.pipelineId) : undefined,
      stageId: input.stageId ? String(input.stageId) : undefined,
      status: input.status ? String(input.status) : undefined,
      contactId: input.contactId ? String(input.contactId) : undefined,
      limit: Number(input.limit ?? 20),
    })
    return {
      total: opportunities.length,
      opportunities: opportunities.map((o) => ({
        id: o.id,
        name: o.name,
        status: o.status,
        value: o.monetaryValue,
        contact: o.contact,
        pipelineId: o.pipelineId,
        stageId: o.pipelineStageId,
        updatedAt: o.updatedAt,
      })),
    }
  },

  async ghl_create_opportunity(input) {
    const opp = await createOpportunity({
      name: String(input.name),
      contactId: String(input.contactId),
      pipelineId: String(input.pipelineId),
      pipelineStageId: String(input.pipelineStageId),
      monetaryValue: input.monetaryValue ? Number(input.monetaryValue) : undefined,
      status: (input.status as "open" | "won" | "lost" | "abandoned") ?? "open",
    })
    return { success: true, opportunityId: opp.id, name: opp.name, status: opp.status }
  },

  async ghl_update_opportunity(input) {
    const opp = await updateOpportunity(String(input.opportunityId), {
      name: input.name ? String(input.name) : undefined,
      pipelineStageId: input.pipelineStageId ? String(input.pipelineStageId) : undefined,
      status: input.status as "open" | "won" | "lost" | "abandoned" | undefined,
      monetaryValue: input.monetaryValue ? Number(input.monetaryValue) : undefined,
    })
    return { success: true, opportunityId: opp.id, status: opp.status }
  },

  async ghl_list_workflows(_input) {
    const workflows = await listWorkflows()
    return {
      total: workflows.length,
      workflows: workflows.map((w) => ({
        id: w.id,
        name: w.name,
        status: w.status,
      })),
    }
  },

  async ghl_trigger_workflow(input) {
    await triggerWorkflow(String(input.workflowId), String(input.contactId))
    return { success: true, workflowId: input.workflowId, contactId: input.contactId }
  },

  async ghl_get_appointments(input) {
    if (input.list_calendars) {
      const calendars = await listCalendars()
      return {
        calendars: calendars.map((c) => ({ id: c.id, name: c.name, slug: c.slug })),
      }
    }
    const appointments = await getAppointments({
      calendarId: input.calendarId ? String(input.calendarId) : undefined,
      contactId: input.contactId ? String(input.contactId) : undefined,
      startDate: input.startDate ? String(input.startDate) : undefined,
      endDate: input.endDate ? String(input.endDate) : undefined,
    })
    return {
      total: appointments.length,
      appointments: appointments.map((a) => ({
        id: a.id,
        title: a.title,
        startTime: a.startTime,
        endTime: a.endTime,
        status: a.appointmentStatus ?? a.status,
        contactId: a.contactId,
        calendarId: a.calendarId,
      })),
    }
  },

  async ghl_create_appointment(input) {
    const appt = await createAppointment({
      calendarId: String(input.calendarId),
      contactId: String(input.contactId),
      startTime: String(input.startTime),
      endTime: String(input.endTime),
      title: input.title ? String(input.title) : undefined,
      notes: input.notes ? String(input.notes) : undefined,
      appointmentStatus: (input.appointmentStatus as string) ?? "new",
    })
    return { success: true, appointmentId: appt.id, startTime: appt.startTime }
  },

  async get_email_template(input) {
    if (input.list_only) {
      return {
        templates: listTemplates(),
        usage: "Appelez get_email_template avec le nom du template choisi (sans list_only) pour obtenir le HTML complet.",
      }
    }

    if (!input.template) {
      return {
        templates: listTemplates(),
        message: "Précisez le nom du template dans le champ 'template'.",
      }
    }

    const tpl = getTemplate(input.template as TemplateName)
    return {
      name: tpl.name,
      label: tpl.label,
      subject_example: tpl.subject_example,
      description: tpl.description,
      variables: tpl.variables,
      html: tpl.html,
      instructions: [
        "1. Remplace TOUTES les variables {{...}} par le contenu réel avant d'appeler send_email.",
        "2. La variable {{contact.first_name}} est gérée automatiquement par GHL — laisse-la telle quelle.",
        "3. La variable {unsubscribe} est gérée par GHL — laisse-la telle quelle.",
        "4. Envoie toujours en mode 'preview' (krome01@gmail.com) avant 'send_all'.",
      ],
    }
  },

  async score_content(input) {
    const title = String(input.title ?? "")
    const content = String(input.content_markdown ?? "")
    const keyword = String(input.target_keyword ?? "").toLowerCase()
    const metaTitle = input.meta_title ? String(input.meta_title) : ""
    const metaDesc = input.meta_description ? String(input.meta_description) : ""

    const kwLower = keyword.toLowerCase()
    const contentLower = content.toLowerCase()
    const titleLower = title.toLowerCase()

    const scores: Record<string, { score: number; max: number; label: string; ok: boolean }> = {}
    const recommendations: string[] = []

    // 1. Mot-clé dans le titre H1 (20 pts)
    const kwInTitle = titleLower.includes(kwLower)
    scores.keyword_in_title = { score: kwInTitle ? 20 : 0, max: 20, label: "Mot-clé dans le titre H1", ok: kwInTitle }
    if (!kwInTitle) recommendations.push(`Intégrer "${keyword}" dans le titre H1`)

    // 2. Mot-clé dans les 150 premiers mots (10 pts)
    const first150words = contentLower.split(/\s+/).slice(0, 150).join(" ")
    const kwInIntro = first150words.includes(kwLower)
    scores.keyword_in_intro = { score: kwInIntro ? 10 : 0, max: 10, label: "Mot-clé dans l'introduction", ok: kwInIntro }
    if (!kwInIntro) recommendations.push(`Placer "${keyword}" dans les 150 premiers mots de l'article`)

    // 3. Nombre de mots (20 pts)
    const wordCount = content.split(/\s+/).filter(Boolean).length
    let wordScore = 0
    if (wordCount >= 2000) wordScore = 20
    else if (wordCount >= 1500) wordScore = 15
    else if (wordCount >= 800) wordScore = 10
    else if (wordCount >= 500) wordScore = 5
    scores.word_count = { score: wordScore, max: 20, label: `Longueur du contenu (${wordCount} mots)`, ok: wordCount >= 1200 }
    if (wordCount < 1200) recommendations.push(`Étoffer le contenu : ${wordCount} mots actuellement, viser 1 500+ pour un guide`)

    // 4. Structure H2/H3 (15 pts)
    const h2count = (content.match(/^##\s/gm) ?? []).length
    const h3count = (content.match(/^###\s/gm) ?? []).length
    const headingTotal = h2count + h3count
    let headingScore = 0
    if (headingTotal >= 6) headingScore = 15
    else if (headingTotal >= 4) headingScore = 10
    else if (headingTotal >= 2) headingScore = 5
    scores.headings = { score: headingScore, max: 15, label: `Structure (${h2count} H2 + ${h3count} H3)`, ok: headingTotal >= 4 }
    if (headingTotal < 4) recommendations.push(`Ajouter des sous-titres H2/H3 (actuellement ${headingTotal}, viser 4+)`)

    // 5. FAQ présente (10 pts)
    const hasFaq = /faq|questions?\s+fréquentes?|questions?\s+courantes?/i.test(content)
    scores.faq = { score: hasFaq ? 10 : 0, max: 10, label: "Section FAQ", ok: hasFaq }
    if (!hasFaq) recommendations.push("Ajouter une section FAQ (4-5 questions) en fin d'article")

    // 6. CTA présent (5 pts)
    const hasCta = /comparateur|comparez|trouvez\s+votre|chatbot|notre\s+outil/i.test(content)
    scores.cta = { score: hasCta ? 5 : 0, max: 5, label: "Appel à l'action (CTA)", ok: hasCta }
    if (!hasCta) recommendations.push("Ajouter un CTA vers le comparateur ou le chatbot")

    // 7. Liens (5 pts)
    const linkCount = (content.match(/\[.+?\]\(https?:\/\//g) ?? []).length
    const hasLinks = linkCount >= 1
    scores.links = { score: hasLinks ? 5 : 0, max: 5, label: `Liens externes (${linkCount} trouvé(s))`, ok: hasLinks }
    if (!hasLinks) recommendations.push("Ajouter 1-2 liens vers des sources officielles (securite-routiere.gouv.fr, service-public.fr)")

    // 8. Images (5 pts)
    const imgCount = (content.match(/!\[/g) ?? []).length
    const hasImages = imgCount >= 1
    scores.images = { score: hasImages ? 5 : 0, max: 5, label: `Images (${imgCount} trouvée(s))`, ok: hasImages }
    if (!hasImages) recommendations.push("Intégrer au moins 1 image dans le contenu de l'article")

    // 9. Meta title (5 pts)
    const metaTitleOk = metaTitle.length > 0 && metaTitle.length <= 60 && metaTitle.toLowerCase().includes(kwLower)
    scores.meta_title = { score: metaTitleOk ? 5 : metaTitle.length > 0 ? 2 : 0, max: 5, label: `Meta title (${metaTitle.length} car.)`, ok: metaTitleOk }
    if (!metaTitleOk) {
      if (!metaTitle) recommendations.push("Définir un meta title contenant le mot-clé (< 60 caractères)")
      else if (metaTitle.length > 60) recommendations.push(`Meta title trop long (${metaTitle.length} car.) — raccourcir à moins de 60 caractères`)
      else if (!metaTitle.toLowerCase().includes(kwLower)) recommendations.push(`Intégrer "${keyword}" dans le meta title`)
    }

    // 10. Meta description (5 pts)
    const metaDescOk = metaDesc.length > 0 && metaDesc.length <= 155
    scores.meta_description = { score: metaDescOk ? 5 : metaDesc.length > 0 ? 2 : 0, max: 5, label: `Meta description (${metaDesc.length} car.)`, ok: metaDescOk }
    if (!metaDescOk) {
      if (!metaDesc) recommendations.push("Rédiger une meta description (< 155 caractères)")
      else if (metaDesc.length > 155) recommendations.push(`Meta description trop longue (${metaDesc.length} car.) — raccourcir à 155 caractères max`)
    }

    const totalScore = Object.values(scores).reduce((sum, s) => sum + s.score, 0)
    const maxScore = Object.values(scores).reduce((sum, s) => sum + s.max, 0)
    const scorePercent = Math.round((totalScore / maxScore) * 100)

    const grade = scorePercent >= 85 ? "A — Excellent" : scorePercent >= 70 ? "B — Bon" : scorePercent >= 50 ? "C — À améliorer" : "D — Insuffisant"

    return {
      score: scorePercent,
      grade,
      details: scores,
      recommendations: recommendations.length > 0 ? recommendations : ["Aucune amélioration critique — l'article est prêt à publier"],
      word_count: wordCount,
    }
  },

  async get_internal_links(input) {
    const keywords = (input.keywords as string[]) ?? []
    const limit = Number(input.limit ?? 5)

    // Un seul appel — on filtre ensuite localement par mot-clé.
    const published = (await listAllArticlesAdmin()).filter((a) => a.status === "publish")

    const results: { keyword: string; articles: { id: string; title: string; slug: string; link: string; date: string }[] }[] = []

    for (const kw of keywords.slice(0, 5)) {
      const term = kw.toLowerCase()
      const matches = published
        .filter((a) =>
          a.title.toLowerCase().includes(term) ||
          a.slug.toLowerCase().includes(term) ||
          a.summary.toLowerCase().includes(term),
        )
        .slice(0, Math.min(limit, 10))
      results.push({
        keyword: kw,
        articles: matches.map((a) => ({
          id: a.id,
          title: a.title,
          slug: a.slug,
          link: a.url,
          date: a.date,
        })),
      })
    }

    const allArticles = results.flatMap((r) =>
      r.articles.map((a) => ({ ...a, matched_keyword: r.keyword })),
    )

    // Deduplicate by id
    const seen = new Set<string>()
    const unique = allArticles.filter((a) => {
      if (seen.has(a.id)) return false
      seen.add(a.id)
      return true
    })

    return {
      total_found: unique.length,
      suggestion: unique.length > 0
        ? "Intégre ces liens dans ton article avec un texte d'ancre descriptif contenant le mot-clé."
        : "Aucun article existant trouvé pour ces mots-clés. C'est peut-être un sujet pionnier — crée d'autres articles complémentaires.",
      articles: unique.slice(0, 10),
    }
  },

  async update_article(input) {
    const itemId = String(input.item_id ?? "")
    if (!itemId) throw new Error("item_id requis")

    // Détermination de la collection : explicite ou auto-détectée.
    let collection = input.collection ? (String(input.collection) as "permis" | "code") : null
    let collectionId = collection ? BLOG_COLLECTION_IDS[collection] : null

    if (!collectionId) {
      const found = await getArticleById(itemId)
      if (!found) {
        throw new Error(
          `Article Webflow introuvable (item_id: ${itemId}). Vérifier l'ID via search_wp_posts.`,
        )
      }
      collection = found.collection
      collectionId = BLOG_COLLECTION_IDS[found.collection]
    }

    const fields: Record<string, unknown> = {}
    if (input.title) fields["name"] = String(input.title)
    if (input.slug) fields["slug"] = String(input.slug)
    if (input.content_markdown) {
      fields["blog-post-richt-text"] = await marked.parse(String(input.content_markdown))
    }
    if (input.summary) fields["blog-post-summary"] = String(input.summary)

    if (Object.keys(fields).length > 0) {
      await updateItem(collectionId, itemId, fields)
    }

    // Changement de statut éditorial (bascule isDraft + publication live).
    const status = (input.status as "draft" | "publish" | undefined) ?? undefined
    if (status) {
      await updateArticle(collectionId, itemId, { status })
    }

    return {
      success: true,
      item_id: itemId,
      collection,
      status: status ?? "updated",
    }
  },

  async scrape_serp(input) {
    return searchGoogleSerp(
      String(input.query),
      String(input.country_code ?? "fr"),
      Number(input.max_results ?? 10),
    )
  },

  async scrape_webpage(input) {
    return scrapeWebpage(
      String(input.url),
      Number(input.max_chars ?? 3000),
    )
  },

  async generate_image(input) {
    const result = await generateImage(String(input.prompt))

    return {
      success: true,
      image_url: result.url,
      task_id: result.taskId,
      note: "Image générée. Utilise image_url comme media_url dans schedule_social pour les posts sociaux.",
    }
  },

  // ─── CMS Webflow ──────────────────────────────────────────────────────────

  async publish_webflow_item(input) {
    const collectionId = input.collection_id ? String(input.collection_id) : ""
    if (!collectionId) {
      throw new Error(
        "collection_id requis — utiliser un des IDs disponibles : WF_COLLECTION_ID_PERMIS_BLOGS (articles permis), _CODE_BLOGS (articles code), _POINTS_DE_RDV, _LEXIQUES, _PRODUCTS, _SKUS, _CATEGORIES",
      )
    }

    const richText = markdownToWebflowRichText(String(input.content_markdown ?? ""))
    const isDraft = !input.publish

    const fields: Record<string, unknown> = {
      name: String(input.title),
      slug: String(input.slug),
      "post-body": richText,
    }
    if (input.meta_title) fields["seo-title"] = String(input.meta_title)
    if (input.meta_description) fields["seo-description"] = String(input.meta_description)
    if (input.extra_fields && typeof input.extra_fields === "object") {
      Object.assign(fields, input.extra_fields)
    }

    const item = await createItem(collectionId, fields, isDraft)

    if (!isDraft) {
      await publishItem(collectionId, item.id)
    }

    return {
      success: true,
      itemId: item.id,
      status: isDraft ? "draft" : "published",
      note: isDraft
        ? "Item créé en brouillon dans Webflow. Utiliser update_webflow_item avec publish:true pour publier."
        : "Item créé et publié sur Webflow.",
    }
  },

  async update_webflow_item(input) {
    const collectionId = input.collection_id ? String(input.collection_id) : ""
    if (!collectionId) {
      throw new Error("collection_id requis pour update_webflow_item")
    }

    const fields: Record<string, unknown> = {}
    if (input.title) fields["name"] = String(input.title)
    if (input.content_markdown) fields["post-body"] = markdownToWebflowRichText(String(input.content_markdown))
    if (input.meta_title) fields["seo-title"] = String(input.meta_title)
    if (input.meta_description) fields["seo-description"] = String(input.meta_description)
    if (input.extra_fields && typeof input.extra_fields === "object") {
      Object.assign(fields, input.extra_fields)
    }

    await updateItem(collectionId, String(input.item_id), fields)

    if (input.publish) {
      await publishItem(collectionId, String(input.item_id))
    }

    return {
      success: true,
      itemId: String(input.item_id),
      status: input.publish ? "published" : "updated",
    }
  },

  async list_webflow_items(input) {
    const collectionId = input.collection_id ? String(input.collection_id) : ""
    if (!collectionId) {
      throw new Error(
        "collection_id requis — IDs disponibles : 67c976212edb4724b8839729 (PERMIS_BLOGS, 139 articles), 67f3cadace1bbcd2670c8e4e (CODE_BLOGS, 312 articles), 67ebdb2c5b536cee781ef623 (POINTS_DE_RDV, 413 centres), 67d3e470b6482baaa37000f0 (LEXIQUES, 20 termes), 67c976212edb4724b8839753 (PRODUCTS), 67c976212edb4724b8839703 (SKUS), 67c976212edb4724b8839773 (CATEGORIES)",
      )
    }

    const res = await listItems(collectionId, {
      limit: input.limit ? Number(input.limit) : 20,
      offset: input.offset ? Number(input.offset) : 0,
    })

    return {
      total: res.pagination.total,
      items: res.items.map((item) => ({
        id: item.id,
        name: item.fieldData["name"] ?? item.fieldData["title"],
        slug: item.fieldData["slug"],
        isDraft: item.isDraft,
        lastPublished: item.lastPublished,
        lastUpdated: item.lastUpdated,
      })),
    }
  },

  // ─── GHL — contact direct ─────────────────────────────────────────────────

  async ghl_get_contact(input) {
    const contact = await getContact(String(input.contactId))
    return {
      id: contact.id,
      name: [contact.firstName, contact.lastName].filter(Boolean).join(" "),
      email: contact.email,
      phone: contact.phone,
      company: contact.companyName,
      address: contact.address1,
      city: contact.city,
      country: contact.country,
      tags: contact.tags ?? [],
      source: contact.source,
      customFields: contact.customFields ?? [],
      dateAdded: contact.dateAdded,
      dateUpdated: contact.dateUpdated,
    }
  },

  // ─── Calendrier éditorial — mise à jour / suppression ────────────────────

  async update_calendar_event(input) {
    const id = Number(input.id)
    const updates: string[] = []
    const params: (string | number)[] = []

    if (input.title) { updates.push("title = ?"); params.push(String(input.title)) }
    if (input.planned_date) { updates.push("planned_date = ?"); params.push(String(input.planned_date)) }
    if (input.status) { updates.push("status = ?"); params.push(String(input.status)) }
    if (input.notes !== undefined) { updates.push("notes = ?"); params.push(String(input.notes)) }

    if (updates.length === 0) return { success: false, error: "Aucun champ à mettre à jour" }

    params.push(id)
    await execute(
      `UPDATE wp_iris_editorial_calendar SET ${updates.join(", ")} WHERE id = ?`,
      params,
    )

    return { success: true, id }
  },

  async delete_calendar_event(input) {
    const id = Number(input.id)
    await execute("DELETE FROM wp_iris_editorial_calendar WHERE id = ?", [id])
    return { success: true, id, message: `Événement #${id} supprimé du calendrier éditorial.` }
  },

  async seo_check_position(input) {
    return await getPosition({
      keyword: String(input.keyword),
      target: input.target ? String(input.target) : undefined,
    })
  },

  async seo_keyword_research(input) {
    const mode = (input.mode as "volumes" | "suggestions") ?? (input.seed ? "suggestions" : "volumes")
    if (mode === "suggestions") {
      if (!input.seed) throw new Error("seed requis pour mode 'suggestions'")
      const data = await getKeywordSuggestions({
        seed: String(input.seed),
        limit: input.limit ? Number(input.limit) : undefined,
      })
      return { mode, count: data.length, data }
    }
    const keywords = Array.isArray(input.keywords) ? (input.keywords as string[]) : []
    if (!keywords.length) throw new Error("keywords[] requis pour mode 'volumes'")
    const data = await getKeywordVolumes({ keywords })
    return { mode, count: data.length, data }
  },

  async seo_competitor_analysis(input) {
    if (!input.domain) throw new Error("domain requis")
    const mode = (input.mode as "ranked" | "gap") ?? "ranked"
    if (mode === "gap") {
      const data = await getContentGap({ competitorDomain: String(input.domain) })
      return { mode, count: data.length, data: data.slice(0, 100) }
    }
    const data = await getRankedKeywords({
      domain: String(input.domain),
      limit: input.limit ? Number(input.limit) : 100,
    })
    return { mode, count: data.length, data }
  },

  async seo_onpage_audit(input) {
    if (!input.url) throw new Error("url requis")
    return await auditUrl(String(input.url))
  },
}

export async function executeTool(
  toolName: string,
  toolInput: Record<string, unknown>,
): Promise<ToolCallResult> {
  const handler = toolHandlers[toolName]
  if (!handler) {
    return {
      toolName,
      toolInput,
      result: { error: `Tool inconnu: ${toolName}` },
      status: "error",
    }
  }

  try {
    const result = await handler(toolInput)
    return { toolName, toolInput, result, status: "success" }
  } catch (err) {
    return {
      toolName,
      toolInput,
      result: { error: err instanceof Error ? err.message : String(err) },
      status: "error",
    }
  }
}
