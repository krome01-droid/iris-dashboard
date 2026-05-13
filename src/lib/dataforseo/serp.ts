// SERP — position tracker (où se classe le domaine cible sur un keyword)
import {
  dfsPost,
  DEFAULT_LANGUAGE_CODE,
  DEFAULT_LOCATION_CODE,
  DEFAULT_TARGET_DOMAIN,
} from "./client"

type SerpItem = {
  type: string
  rank_group?: number
  rank_absolute?: number
  domain?: string
  title?: string
  url?: string
  description?: string
}

type SerpResponse = {
  tasks: Array<{
    result: Array<{
      keyword: string
      total_count: number
      items: SerpItem[]
    }>
  }>
}

export type SerpPositionResult = {
  keyword: string
  target: string
  found: boolean
  position: number | null
  url: string | null
  totalResults: number
  top10: Array<{ rank: number; domain: string; url: string; title: string }>
}

export async function getPosition(opts: {
  keyword: string
  target?: string
  locationCode?: number
  languageCode?: string
}): Promise<SerpPositionResult> {
  const target = (opts.target ?? DEFAULT_TARGET_DOMAIN).replace(/^https?:\/\//, "").replace(/\/$/, "")
  const json = await dfsPost<SerpResponse>("/v3/serp/google/organic/live/regular", [
    {
      keyword: opts.keyword,
      location_code: opts.locationCode ?? DEFAULT_LOCATION_CODE,
      language_code: opts.languageCode ?? DEFAULT_LANGUAGE_CODE,
      device: "desktop",
      depth: 100,
    },
  ])

  const result = json.tasks?.[0]?.result?.[0]
  const items = result?.items?.filter((i) => i.type === "organic") ?? []
  const match = items.find((i) => i.domain?.endsWith(target))

  return {
    keyword: opts.keyword,
    target,
    found: Boolean(match),
    position: match?.rank_absolute ?? null,
    url: match?.url ?? null,
    totalResults: result?.total_count ?? 0,
    top10: items.slice(0, 10).map((i) => ({
      rank: i.rank_absolute ?? 0,
      domain: i.domain ?? "",
      url: i.url ?? "",
      title: i.title ?? "",
    })),
  }
}
