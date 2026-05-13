// Concurrents — keywords sur lesquels un domaine se classe
import {
  dfsPost,
  DEFAULT_LANGUAGE_CODE,
  DEFAULT_LOCATION_CODE,
  DEFAULT_TARGET_DOMAIN,
} from "./client"

type RankedItem = {
  keyword_data: {
    keyword: string
    keyword_info?: { search_volume?: number; cpc?: number; competition?: string }
  }
  ranked_serp_element: {
    serp_item?: { rank_absolute?: number; url?: string; title?: string }
  }
}

export type CompetitorKeyword = {
  keyword: string
  searchVolume: number
  position: number
  url: string
  title: string
  cpc: number
}

export async function getRankedKeywords(opts: {
  domain: string
  locationCode?: number
  languageCode?: string
  limit?: number
}): Promise<CompetitorKeyword[]> {
  const target = opts.domain.replace(/^https?:\/\//, "").replace(/\/$/, "")
  const json = await dfsPost<{
    tasks: Array<{ result: Array<{ items: RankedItem[] }> }>
  }>("/v3/dataforseo_labs/google/ranked_keywords/live", [
    {
      target,
      location_code: opts.locationCode ?? DEFAULT_LOCATION_CODE,
      language_code: opts.languageCode ?? DEFAULT_LANGUAGE_CODE,
      limit: opts.limit ?? 100,
      load_rank_absolute: true,
      filters: [["ranked_serp_element.serp_item.rank_absolute", "<=", 20]],
      order_by: ["keyword_data.keyword_info.search_volume,desc"],
    },
  ])
  const items = json.tasks?.[0]?.result?.[0]?.items ?? []
  return items.map((it) => ({
    keyword: it.keyword_data?.keyword ?? "",
    searchVolume: it.keyword_data?.keyword_info?.search_volume ?? 0,
    position: it.ranked_serp_element?.serp_item?.rank_absolute ?? 0,
    url: it.ranked_serp_element?.serp_item?.url ?? "",
    title: it.ranked_serp_element?.serp_item?.title ?? "",
    cpc: it.keyword_data?.keyword_info?.cpc ?? 0,
  }))
}

// Content gap — mots-clés qu'un concurrent rank et que nous ne rankons pas (ou mal)
export async function getContentGap(opts: {
  competitorDomain: string
  ourDomain?: string
  locationCode?: number
  languageCode?: string
}): Promise<CompetitorKeyword[]> {
  const [competitor, ours] = await Promise.all([
    getRankedKeywords({ ...opts, domain: opts.competitorDomain, limit: 200 }),
    getRankedKeywords({ ...opts, domain: opts.ourDomain ?? DEFAULT_TARGET_DOMAIN, limit: 200 }),
  ])
  const ourKeywords = new Set(ours.map((k) => k.keyword.toLowerCase()))
  return competitor
    .filter((k) => !ourKeywords.has(k.keyword.toLowerCase()))
    .sort((a, b) => b.searchVolume - a.searchVolume)
}
