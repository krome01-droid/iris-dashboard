/**
 * Webflow Content API v2 — Client
 * Doc : https://developers.webflow.com/v2.0/reference/
 *
 * Variables d'environnement requises :
 *   WF_API_KEY        — clé API Webflow (Bearer token)
 *   WF_SITE_ID        — ID du site Webflow
 *   WF_COLLECTION_ID  — ID de la collection principale (articles/blog)
 */

const BASE_URL = "https://api.webflow.com/v2"

function apiKey() {
  const key = process.env.WF_API_KEY
  if (!key) throw new Error("WF_API_KEY manquant — configurer dans .env.local")
  return key
}

async function wfFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(options.headers ?? {}),
    },
  })

  const body = await res.json()

  if (!res.ok) {
    throw new Error(`Webflow API ${res.status}: ${JSON.stringify(body)}`)
  }

  return body as T
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WebflowItem {
  id: string
  fieldData: Record<string, unknown>
  cmsLocaleId?: string
  lastPublished?: string
  lastUpdated?: string
  createdOn?: string
  isArchived?: boolean
  isDraft?: boolean
}

export interface WebflowItemsResponse {
  items: WebflowItem[]
  pagination: { limit: number; offset: number; total: number }
}

// ─── Markdown → Webflow Rich Text ────────────────────────────────────────────
// Conversion simplifiée : chaque paragraphe devient un nœud "paragraph".
// Pour un rendu riche, utiliser un parser Markdown complet (remark, unified).

export function markdownToWebflowRichText(markdown: string): object {
  const lines = markdown.split("\n")
  const children: object[] = []

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue

    // Headings
    const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/)
    if (headingMatch) {
      const level = headingMatch[1].length
      const tagMap: Record<number, string> = { 1: "h1", 2: "h2", 3: "h3", 4: "h4", 5: "h5", 6: "h6" }
      children.push({
        type: tagMap[level],
        children: [{ type: "text", text: headingMatch[2] }],
      })
      continue
    }

    // List items
    if (/^[-*]\s+/.test(trimmed)) {
      children.push({
        type: "list",
        tag: "ul",
        children: [
          {
            type: "listitem",
            children: [{ type: "text", text: trimmed.replace(/^[-*]\s+/, "") }],
          },
        ],
      })
      continue
    }

    // Paragraph (default)
    // Handle inline bold/italic minimally
    children.push({
      type: "paragraph",
      children: [{ type: "text", text: trimmed }],
    })
  }

  return { type: "root", children }
}

// ─── API Functions ────────────────────────────────────────────────────────────

/**
 * Créer un item dans une collection Webflow.
 * fields : objet clé/valeur correspondant aux champs de la collection.
 */
export async function createItem(
  collectionId: string,
  fields: Record<string, unknown>,
  isDraft = true,
): Promise<WebflowItem> {
  const res = await wfFetch<{ id: string; fieldData: Record<string, unknown> }>(
    `/collections/${collectionId}/items`,
    {
      method: "POST",
      body: JSON.stringify({
        isArchived: false,
        isDraft,
        fieldData: fields,
      }),
    },
  )

  return res as WebflowItem
}

/**
 * Mettre à jour un item existant dans une collection.
 */
export async function updateItem(
  collectionId: string,
  itemId: string,
  fields: Partial<Record<string, unknown>>,
): Promise<WebflowItem> {
  const res = await wfFetch<WebflowItem>(`/collections/${collectionId}/items/${itemId}`, {
    method: "PATCH",
    body: JSON.stringify({ fieldData: fields }),
  })

  return res
}

/**
 * Lister / rechercher des items dans une collection.
 */
export async function listItems(
  collectionId: string,
  options: { limit?: number; offset?: number } = {},
): Promise<WebflowItemsResponse> {
  const params = new URLSearchParams()
  if (options.limit) params.set("limit", String(options.limit))
  if (options.offset) params.set("offset", String(options.offset))

  return wfFetch<WebflowItemsResponse>(
    `/collections/${collectionId}/items?${params.toString()}`,
  )
}

/**
 * Publier un ou plusieurs items (passer de draft → live).
 */
export async function publishItem(
  collectionId: string,
  itemId: string,
): Promise<{ publishedItemIds: string[] }> {
  return wfFetch(`/collections/${collectionId}/items/publish`, {
    method: "POST",
    body: JSON.stringify({ itemIds: [itemId] }),
  })
}

/**
 * Récupérer un item unique d'une collection.
 */
export async function getItem(
  collectionId: string,
  itemId: string,
): Promise<WebflowItem> {
  return wfFetch<WebflowItem>(`/collections/${collectionId}/items/${itemId}`)
}

// ─── Articles normalisés (cron jobs IRIS) ────────────────────────────────────

/**
 * Forme unifiée d'un article Webflow utilisée par les cron jobs IRIS.
 * Remplace l'ancien `WPPost` du temps WordPress.
 */
export interface IrisArticle {
  id: string
  collectionId: string
  collection: "permis" | "code"
  title: string
  slug: string
  url: string
  date: string         // ISO — lastPublished sinon lastUpdated sinon createdOn
  content: string      // HTML (blog-post-richt-text)
  summary: string      // texte court (blog-post-summary)
  isDraft: boolean
  isArchived: boolean
  imageUrl?: string    // URL de l'image principale Webflow (fieldData.image)
}

const SITE_BASE_URL = "https://autoecole-inris.com"

const BLOG_COLLECTIONS: { id: string; label: "permis" | "code" }[] = [
  { id: process.env.WF_COLLECTION_ID_PERMIS_BLOGS ?? "67c976212edb4724b8839729", label: "permis" },
  { id: process.env.WF_COLLECTION_ID_CODE_BLOGS ?? "67f3cadace1bbcd2670c8e4e", label: "code" },
]

function asString(v: unknown): string {
  if (typeof v === "string") return v
  if (v == null) return ""
  return String(v)
}

function normalizeArticle(
  item: WebflowItem,
  collectionId: string,
  label: "permis" | "code",
): IrisArticle {
  const fd = item.fieldData ?? {}
  const slug = asString(fd.slug)
  const image = fd.image as { url?: string } | undefined
  return {
    id: item.id,
    collectionId,
    collection: label,
    title: asString(fd.name),
    slug,
    url: slug ? `${SITE_BASE_URL}/${label === "code" ? "code" : "permis"}/${slug}` : SITE_BASE_URL,
    date: item.lastPublished ?? item.lastUpdated ?? item.createdOn ?? new Date(0).toISOString(),
    content: asString(fd["blog-post-richt-text"]),
    summary: asString(fd["blog-post-summary"]),
    isDraft: item.isDraft ?? false,
    isArchived: item.isArchived ?? false,
    imageUrl: typeof image?.url === "string" ? image.url : undefined,
  }
}

/**
 * Liste TOUS les items d'une collection en paginant (limit max Webflow = 100).
 */
export async function listAllItems(collectionId: string): Promise<WebflowItem[]> {
  const all: WebflowItem[] = []
  const limit = 100
  let offset = 0
  // Garde-fou : on plafonne à 50 pages (5 000 items) — bien plus que les ~450 actuels.
  for (let page = 0; page < 50; page++) {
    const res = await listItems(collectionId, { limit, offset })
    all.push(...res.items)
    const total = res.pagination?.total ?? 0
    offset += limit
    if (offset >= total || res.items.length === 0) break
  }
  return all
}

/**
 * Liste TOUS les articles publiés (Permis + Code) sous une forme normalisée.
 * Exclut les drafts et les archived.
 */
export async function listAllArticles(): Promise<IrisArticle[]> {
  const perCollection = await Promise.all(
    BLOG_COLLECTIONS.map(async ({ id, label }) => {
      const items = await listAllItems(id).catch(() => [] as WebflowItem[])
      return items.map((it) => normalizeArticle(it, id, label))
    }),
  )
  return perCollection.flat().filter((a) => !a.isDraft && !a.isArchived)
}

// ─── Articles — gestion admin (dashboard Articles) ───────────────────────────

/** Article Webflow avec son statut éditorial pour l'interface d'admin. */
export interface IrisArticleAdmin extends IrisArticle {
  status: "publish" | "draft"
}

function toAdmin(a: IrisArticle): IrisArticleAdmin {
  return { ...a, status: a.isDraft ? "draft" : "publish" }
}

/**
 * Liste TOUS les articles (Permis + Code), brouillons inclus, pour l'admin.
 * Exclut uniquement les items archivés.
 */
export async function listAllArticlesAdmin(): Promise<IrisArticleAdmin[]> {
  const perCollection = await Promise.all(
    BLOG_COLLECTIONS.map(async ({ id, label }) => {
      const items = await listAllItems(id).catch(() => [] as WebflowItem[])
      return items.map((it) => toAdmin(normalizeArticle(it, id, label)))
    }),
  )
  return perCollection.flat().filter((a) => !a.isArchived)
}

/**
 * Récupère un article par son id Webflow. Si `collectionId` est absent,
 * tente les deux collections blog (Permis puis Code).
 */
export async function getArticleById(
  itemId: string,
  collectionId?: string,
): Promise<IrisArticleAdmin | null> {
  const pool = collectionId
    ? (BLOG_COLLECTIONS.filter((c) => c.id === collectionId).length > 0
        ? BLOG_COLLECTIONS.filter((c) => c.id === collectionId)
        : BLOG_COLLECTIONS)
    : BLOG_COLLECTIONS

  for (const { id, label } of pool) {
    try {
      const item = await getItem(id, itemId)
      return toAdmin(normalizeArticle(item, id, label))
    } catch {
      // Pas dans cette collection — on tente la suivante.
    }
  }
  return null
}

/**
 * Met à jour le titre et/ou le statut d'un article.
 * status "publish" déclenche aussi la publication live de l'item.
 */
export async function updateArticle(
  collectionId: string,
  itemId: string,
  patch: { title?: string; status?: "publish" | "draft" },
): Promise<void> {
  const body: Record<string, unknown> = {}
  if (patch.title !== undefined) body.fieldData = { name: patch.title }
  if (patch.status !== undefined) body.isDraft = patch.status === "draft"

  if (Object.keys(body).length > 0) {
    await wfFetch(`/collections/${collectionId}/items/${itemId}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    })
  }

  if (patch.status === "publish") {
    await publishItem(collectionId, itemId).catch(() => {
      // La publication peut échouer si le site n'est pas prêt — non bloquant.
    })
  }
}
