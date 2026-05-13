// Keyword research — volumes + suggestions + difficulté
import { dfsPost, DEFAULT_LANGUAGE_CODE, DEFAULT_LOCATION_CODE } from "./client"

type VolumeItem = {
  keyword: string
  search_volume: number | null
  competition: string | null // LOW | MEDIUM | HIGH
  competition_index: number | null
  cpc: number | null
  low_top_of_page_bid: number | null
  high_top_of_page_bid: number | null
}

export type KeywordVolume = {
  keyword: string
  searchVolume: number
  competition: "LOW" | "MEDIUM" | "HIGH" | "UNKNOWN"
  cpc: number
}

export async function getKeywordVolumes(opts: {
  keywords: string[]
  locationCode?: number
  languageCode?: string
}): Promise<KeywordVolume[]> {
  if (!opts.keywords.length) return []
  const json = await dfsPost<{ tasks: Array<{ result: VolumeItem[] }> }>(
    "/v3/keywords_data/google_ads/search_volume/live",
    [
      {
        keywords: opts.keywords.slice(0, 1000),
        location_code: opts.locationCode ?? DEFAULT_LOCATION_CODE,
        language_code: opts.languageCode ?? DEFAULT_LANGUAGE_CODE,
      },
    ],
  )
  const items = json.tasks?.[0]?.result ?? []
  return items.map((it) => ({
    keyword: it.keyword,
    searchVolume: it.search_volume ?? 0,
    competition: (it.competition as "LOW" | "MEDIUM" | "HIGH") ?? "UNKNOWN",
    cpc: it.cpc ?? 0,
  }))
}

type SuggestionItem = {
  keyword: string
  keyword_info?: {
    search_volume?: number
    competition?: string
    cpc?: number
  }
  keyword_properties?: { keyword_difficulty?: number }
}

export type KeywordSuggestion = {
  keyword: string
  searchVolume: number
  difficulty: number // 0-100
  cpc: number
}

export async function getKeywordSuggestions(opts: {
  seed: string
  locationCode?: number
  languageCode?: string
  limit?: number
}): Promise<KeywordSuggestion[]> {
  const json = await dfsPost<{
    tasks: Array<{ result: Array<{ items: SuggestionItem[] }> }>
  }>("/v3/dataforseo_labs/google/keyword_suggestions/live", [
    {
      keyword: opts.seed,
      location_code: opts.locationCode ?? DEFAULT_LOCATION_CODE,
      language_code: opts.languageCode ?? DEFAULT_LANGUAGE_CODE,
      limit: opts.limit ?? 50,
      include_seed_keyword: true,
    },
  ])
  const items = json.tasks?.[0]?.result?.[0]?.items ?? []
  return items.map((it) => ({
    keyword: it.keyword,
    searchVolume: it.keyword_info?.search_volume ?? 0,
    difficulty: it.keyword_properties?.keyword_difficulty ?? 0,
    cpc: it.keyword_info?.cpc ?? 0,
  }))
}
