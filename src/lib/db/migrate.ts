/**
 * Run database migrations via the WP REST proxy on o2switch.
 * Robust against malformed proxy responses (no toString-on-undefined crash).
 */

import { extractJson } from "./connection"

export async function runMigrations(): Promise<string[]> {
  const proxyUrl = process.env.MYSQL_PROXY_URL
  const proxySecret = process.env.MYSQL_PROXY_SECRET

  if (!proxyUrl || !proxySecret) {
    return ["ERREUR: MYSQL_PROXY_URL ou MYSQL_PROXY_SECRET non configuré"]
  }

  try {
    const res = await fetch(proxyUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Lou-Secret": proxySecret,
      },
      body: JSON.stringify({ action: "migrate" }),
    })

    const raw = await res.text()

    if (!res.ok) {
      return [`ERREUR: HTTP ${res.status} — ${raw.slice(0, 200)}`]
    }

    const clean = extractJson(raw)
    let data: { results?: unknown } = {}
    try {
      data = JSON.parse(clean)
    } catch {
      return [`ERREUR: réponse proxy non-JSON — ${raw.slice(0, 200)}`]
    }

    const results = Array.isArray(data.results)
      ? data.results.map((r) => (r == null ? "ERREUR: résultat null" : String(r)))
      : ["Migration terminée (pas de détails)"]

    return results
  } catch (err) {
    return [`ERREUR: ${err instanceof Error ? err.message : String(err ?? "inconnue")}`]
  }
}
