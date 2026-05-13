// On-page audit — analyse instantanée d'une URL (title, H1, meta, signaux SEO)
import { dfsPost } from "./client"

type InstantPageMeta = {
  title?: string
  description?: string
  charset?: number
  follow?: boolean
  generator?: string
  htags?: { h1?: string[]; h2?: string[]; h3?: string[] }
  internal_links_count?: number
  external_links_count?: number
  images_count?: number
  images_size?: number
  scripts_count?: number
  stylesheets_count?: number
  social_media_tags?: Record<string, string>
}

type InstantPageItem = {
  status_code?: number
  location?: string
  url?: string
  meta?: InstantPageMeta
  page_timing?: {
    time_to_interactive?: number
    dom_complete?: number
    largest_contentful_paint?: number
    first_input_delay?: number
    connection_time?: number
    download_time?: number
  }
  onpage_score?: number // 0-100
  total_dom_size?: number
  checks?: Record<string, boolean> // ex: no_h1_tag, no_title, duplicate_meta_tags…
  content?: {
    plain_text_word_count?: number
    plain_text_rate?: number
    plain_text_size?: number
    automated_readability_index?: number
  }
}

export type OnPageAudit = {
  url: string
  statusCode: number
  onpageScore: number // 0 = mauvais, 100 = parfait
  title: string
  titleLength: number
  metaDescription: string
  metaDescriptionLength: number
  h1: string[]
  h2Count: number
  wordCount: number
  internalLinks: number
  externalLinks: number
  imagesCount: number
  largestContentfulPaint: number // ms
  timeToInteractive: number // ms
  issues: string[]
  warnings: string[]
}

const CRITICAL_CHECKS: Record<string, string> = {
  no_h1_tag: "Aucune balise H1",
  no_title: "Title manquant",
  no_description: "Meta description manquante",
  no_image_alt: "Images sans alt",
  no_image_title: "Images sans title",
  no_favicon: "Favicon manquant",
  no_doctype: "Doctype manquant",
  no_encoding_meta_tag: "Charset non déclaré",
  high_loading_time: "Temps de chargement élevé",
  is_redirect: "URL redirige",
  is_4xx_code: "Erreur 4xx",
  is_5xx_code: "Erreur 5xx",
  is_broken: "Page cassée",
  canonical: "Canonical manquant",
  duplicate_meta_tags: "Meta tags dupliqués",
  duplicate_title_tag: "Title dupliqué",
}

export async function auditUrl(url: string): Promise<OnPageAudit> {
  const json = await dfsPost<{
    tasks: Array<{ result: Array<{ items: InstantPageItem[] }> }>
  }>("/v3/on_page/instant_pages", [
    {
      url,
      enable_javascript: true,
      load_resources: false,
      enable_browser_rendering: true,
    },
  ])
  const item = json.tasks?.[0]?.result?.[0]?.items?.[0]
  if (!item) throw new Error(`Aucun résultat pour ${url}`)

  const m = item.meta ?? {}
  const checks = item.checks ?? {}
  const issues: string[] = []
  const warnings: string[] = []

  for (const [key, label] of Object.entries(CRITICAL_CHECKS)) {
    if (checks[key]) {
      const critical = ["no_h1_tag", "no_title", "is_4xx_code", "is_5xx_code", "is_broken"].includes(key)
      ;(critical ? issues : warnings).push(label)
    }
  }

  const title = m.title ?? ""
  if (title && (title.length < 30 || title.length > 65)) {
    warnings.push(`Title longueur ${title.length} (idéal 30-65)`)
  }
  const desc = m.description ?? ""
  if (desc && (desc.length < 80 || desc.length > 160)) {
    warnings.push(`Meta description longueur ${desc.length} (idéal 80-160)`)
  }
  const wc = item.content?.plain_text_word_count ?? 0
  if (wc < 300) warnings.push(`Contenu court (${wc} mots)`)

  return {
    url: item.url ?? url,
    statusCode: item.status_code ?? 0,
    onpageScore: Math.round(item.onpage_score ?? 0),
    title,
    titleLength: title.length,
    metaDescription: desc,
    metaDescriptionLength: desc.length,
    h1: m.htags?.h1 ?? [],
    h2Count: m.htags?.h2?.length ?? 0,
    wordCount: wc,
    internalLinks: m.internal_links_count ?? 0,
    externalLinks: m.external_links_count ?? 0,
    imagesCount: m.images_count ?? 0,
    largestContentfulPaint: item.page_timing?.largest_contentful_paint ?? 0,
    timeToInteractive: item.page_timing?.time_to_interactive ?? 0,
    issues,
    warnings,
  }
}
