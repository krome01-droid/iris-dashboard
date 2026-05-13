// DataForSEO HTTP client — Basic auth via DATAFORSEO_API_KEY (base64 login:password)
// Docs: https://docs.dataforseo.com/v3/

const BASE_URL = "https://api.dataforseo.com"

export const DEFAULT_LOCATION_CODE = 2250 // France
export const DEFAULT_LANGUAGE_CODE = "fr"
export const DEFAULT_TARGET_DOMAIN = "autoecole-inris.com"

export const COMPETITOR_DOMAINS = [
  "ornikar.com",
  "lepermislibre.fr",
  "envoituresimone.com",
  "vroomvroom.fr",
  "stych.fr",
]

export function isDataForSeoConfigured(): boolean {
  return Boolean(process.env.DATAFORSEO_API_KEY?.length)
}

export class DataForSeoError extends Error {
  constructor(message: string, public statusCode?: number, public payload?: unknown) {
    super(message)
    this.name = "DataForSeoError"
  }
}

export async function dfsPost<T = unknown>(path: string, body: unknown): Promise<T> {
  const key = process.env.DATAFORSEO_API_KEY
  if (!key) throw new DataForSeoError("DATAFORSEO_API_KEY non configuré")

  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  })

  const json = (await res.json()) as { status_code: number; status_message: string; tasks?: unknown }
  if (!res.ok || (json.status_code && json.status_code >= 40000)) {
    throw new DataForSeoError(
      `DataForSEO ${path} → ${json.status_message ?? res.statusText}`,
      res.status,
      json,
    )
  }
  return json as T
}
