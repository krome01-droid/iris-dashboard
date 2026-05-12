#!/usr/bin/env node
// Géocode tous les centres publiés via OSM Nominatim (1 req/s, gratuit).
// Sauvegarde data/centres-coords.json : { slug: { lat, lon, name, ville, adresse } }
// Utilisé pour : maillage interne (3 plus proches voisins), JSON-LD geo, futurs features.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..")

try {
  const raw = readFileSync(join(ROOT, ".env.local"), "utf8")
  for (const line of raw.split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim()
  }
} catch { /* ignore */ }

const WF_API_KEY = process.env.WF_API_KEY
const COL_RDV = process.env.WF_COLLECTION_ID_POINTS_DE_RDV ?? "67ebdb2c5b536cee781ef623"
if (!WF_API_KEY) { console.error("❌ WF_API_KEY manquant"); process.exit(1) }

function extractVille(slug) {
  return slug.replace(/^auto-ecole-inris-/, "").replace(/^point-conduite-inris-/, "").replace(/^point-de-rdv-+/, "").replace(/^inris-/, "")
    .split("-").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join("-")
}

async function fetchAll() {
  const out = []
  let offset = 0
  while (true) {
    const r = await fetch(`https://api.webflow.com/v2/collections/${COL_RDV}/items?limit=100&offset=${offset}`, {
      headers: { Authorization: `Bearer ${WF_API_KEY}` },
    })
    const d = await r.json()
    out.push(...(d.items ?? []))
    offset += (d.items ?? []).length
    if (offset >= (d.pagination?.total ?? 0)) break
  }
  return out
}

async function geocode(query) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`
  const r = await fetch(url, { headers: { "User-Agent": "iris-dashboard/0.1 (autoecole-inris.com)" } })
  if (!r.ok) return null
  const d = await r.json()
  if (!Array.isArray(d) || d.length === 0) return null
  return { lat: parseFloat(d[0].lat), lon: parseFloat(d[0].lon) }
}

console.log("→ Fetch Webflow…")
const all = await fetchAll()
const published = all.filter(c => !c.isDraft && !c.isArchived)
console.log(`✓ ${published.length} centres publiés à géocoder`)

const cachePath = join(ROOT, "data", "centres-coords.json")
if (!existsSync(join(ROOT, "data"))) mkdirSync(join(ROOT, "data"))
let cache = {}
try { cache = JSON.parse(readFileSync(cachePath, "utf8")) } catch {}

let i = 0
for (const c of published) {
  i++
  const fd = c.fieldData ?? {}
  const slug = fd.slug
  if (cache[slug]?.lat) continue // skip already cached
  const ville = extractVille(slug)
  const query = [fd.adresse, fd["code-postal"], ville].filter(Boolean).join(" ")
  process.stdout.write(`  [${i}/${published.length}] ${slug}… `)
  let geo = null
  try { geo = await geocode(query) } catch { /* */ }
  if (!geo) {
    try { geo = await geocode(`${ville} France`) } catch { /* */ }
  }
  if (geo) {
    cache[slug] = { lat: geo.lat, lon: geo.lon, name: fd.name, ville, adresse: fd.adresse ?? "", codePostal: fd["code-postal"] ?? "" }
    console.log(`✓ ${geo.lat.toFixed(4)}, ${geo.lon.toFixed(4)}`)
  } else {
    cache[slug] = { lat: null, lon: null, name: fd.name, ville, error: "no_match" }
    console.log("✗ no match")
  }
  if (i % 10 === 0) writeFileSync(cachePath, JSON.stringify(cache, null, 2))
  await new Promise(r => setTimeout(r, 1100)) // respect 1 req/s
}
writeFileSync(cachePath, JSON.stringify(cache, null, 2))
const ok = Object.values(cache).filter(v => v.lat).length
console.log(`\n✓ ${ok}/${Object.keys(cache).length} géocodés → ${cachePath}`)
