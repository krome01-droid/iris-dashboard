#!/usr/bin/env node
// Iris Places Sync — fetch Google Place ID, rating & reviews pour 1+ centres.
//
// API utilisée : Places API (New) — endpoints :
//   POST https://places.googleapis.com/v1/places:searchText
//   GET  https://places.googleapis.com/v1/places/{place_id}
//
// Coût : ~0.05 $ / centre (1 searchText + 1 details Pro SKU avec reviews).
//
// Pipeline :
//   1. Lit la liste des slugs en arg (ou tous les centres publiés si --all)
//   2. Pour chaque centre : GET Webflow → query Places searchText → Place Details
//   3. Cache le résultat dans data/places-cache.json (clé = slug)
//
// Usage :
//   node scripts/iris-places-sync.mjs slug1 slug2 slug3
//   node scripts/iris-places-sync.mjs --all
//
// Variables : WF_API_KEY, GOOGLE_PLACES_API_KEY (depuis .env.local)

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..")

// --- Load .env.local ---
try {
  const raw = readFileSync(join(ROOT, ".env.local"), "utf8")
  for (const line of raw.split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim()
  }
} catch { /* ignore */ }

const WF_API_KEY = process.env.WF_API_KEY
const COL_RDV = process.env.WF_COLLECTION_ID_POINTS_DE_RDV ?? "67ebdb2c5b536cee781ef623"
const PLACES_KEY = process.env.GOOGLE_PLACES_API_KEY

if (!WF_API_KEY) { console.error("❌ WF_API_KEY manquant"); process.exit(1) }
if (!PLACES_KEY) { console.error("❌ GOOGLE_PLACES_API_KEY manquant"); process.exit(1) }

const args = process.argv.slice(2)
const ALL = args.includes("--all")
const slugs = args.filter((a) => !a.startsWith("--"))

// --- 1. Fetch all centres from Webflow (paginated) ---
async function fetchAllCentres() {
  const out = []
  let offset = 0
  while (true) {
    const r = await fetch(
      `https://api.webflow.com/v2/collections/${COL_RDV}/items?limit=100&offset=${offset}`,
      { headers: { Authorization: `Bearer ${WF_API_KEY}`, Accept: "application/json" } },
    )
    const d = await r.json()
    out.push(...(d.items ?? []))
    const total = d.pagination?.total ?? 0
    offset += (d.items ?? []).length
    if (offset >= total) break
  }
  return out
}

console.log(`→ Fetch centres Webflow…`)
const all = await fetchAllCentres()
console.log(`✓ ${all.length} centres reçus`)

let targets
if (ALL) {
  targets = all.filter((c) => !c.isDraft && !c.isArchived)
  console.log(`→ Mode --all : ${targets.length} centres publiés`)
} else if (slugs.length > 0) {
  targets = slugs
    .map((s) => all.find((c) => (c.fieldData?.slug ?? "") === s))
    .filter(Boolean)
  const missing = slugs.filter((s) => !all.some((c) => (c.fieldData?.slug ?? "") === s))
  if (missing.length) console.warn(`⚠️  Slugs introuvables : ${missing.join(", ")}`)
} else {
  console.error("Usage: iris-places-sync.mjs <slug1> [slug2…]  |  --all")
  process.exit(2)
}

// --- 2. Load existing cache ---
const cachePath = join(ROOT, "data", "places-cache.json")
if (!existsSync(join(ROOT, "data"))) mkdirSync(join(ROOT, "data"))
let cache = {}
try { cache = JSON.parse(readFileSync(cachePath, "utf8")) } catch { /* empty */ }

// --- 3. Helpers Places API (New) ---
function extractVille(slug) {
  return slug
    .replace(/^auto-ecole-inris-/, "")
    .replace(/^point-conduite-inris-/, "")
    .replace(/^point-de-rdv-+/, "")
    .replace(/^inris-/, "")
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join("-")
}

async function placesSearchText(query) {
  const r = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": PLACES_KEY,
      "X-Goog-FieldMask":
        "places.id,places.displayName,places.formattedAddress,places.rating,places.userRatingCount,places.location",
    },
    body: JSON.stringify({ textQuery: query, languageCode: "fr", regionCode: "FR", maxResultCount: 5 }),
  })
  const d = await r.json()
  if (!r.ok) {
    console.error(`   ✗ searchText error:`, JSON.stringify(d).slice(0, 300))
    return null
  }
  return d.places ?? []
}

async function placesDetails(placeId) {
  const r = await fetch(`https://places.googleapis.com/v1/places/${placeId}?languageCode=fr`, {
    headers: {
      "X-Goog-Api-Key": PLACES_KEY,
      "X-Goog-FieldMask":
        "id,displayName,formattedAddress,rating,userRatingCount,reviews,googleMapsUri,location,internationalPhoneNumber",
    },
  })
  const d = await r.json()
  if (!r.ok) {
    console.error(`   ✗ details error:`, JSON.stringify(d).slice(0, 300))
    return null
  }
  return d
}

// Heuristic: choose best candidate when searchText returns several places.
// Priority: 1) name contains "INRI" 2) address contains ville 3) first.
function pickBest(places, ville) {
  if (!places || places.length === 0) return null
  const villeNorm = ville.toLowerCase()
  const byInri = places.find((p) =>
    (p.displayName?.text ?? "").toLowerCase().includes("inri"),
  )
  if (byInri) return byInri
  const byVille = places.find((p) =>
    (p.formattedAddress ?? "").toLowerCase().includes(villeNorm),
  )
  if (byVille) return byVille
  return places[0]
}

// --- 4. Sync loop ---
let okCount = 0
let missCount = 0
for (const centre of targets) {
  const fd = centre.fieldData ?? {}
  const slug = fd.slug
  const ville = extractVille(slug)
  const adresse = fd.adresse ?? ""

  // Multiple query strategies, in order of specificity
  const queries = [
    `INRI'S ${ville} ${adresse}`.trim(),
    `auto école INRI'S ${ville}`.trim(),
    `${fd.name} ${ville}`.trim(),
  ]

  console.log(`\n→ ${fd.name} (${slug})`)
  let best = null
  let usedQuery = null
  for (const q of queries) {
    console.log(`   searchText: "${q}"`)
    const places = await placesSearchText(q)
    if (places && places.length > 0) {
      best = pickBest(places, ville)
      usedQuery = q
      if (best) break
    }
    await new Promise((r) => setTimeout(r, 200))
  }

  if (!best) {
    console.log(`   ⚠️  Aucun résultat Places — centre non listé sur Google Business Profile ?`)
    cache[slug] = { status: "no_match", lastSyncedAt: new Date().toISOString(), queriesTried: queries }
    missCount++
    continue
  }

  console.log(`   ✓ Place ID : ${best.id}`)
  console.log(`   ✓ Match     : ${best.displayName?.text} — ${best.formattedAddress}`)
  console.log(`   → Fetching details…`)
  const details = await placesDetails(best.id)
  if (!details) {
    cache[slug] = { status: "details_failed", placeId: best.id, lastSyncedAt: new Date().toISOString() }
    missCount++
    continue
  }

  const entry = {
    status: "ok",
    placeId: details.id,
    name: details.displayName?.text,
    address: details.formattedAddress,
    googleMapsUri: details.googleMapsUri,
    location: details.location,
    rating: details.rating ?? null,
    userRatingCount: details.userRatingCount ?? 0,
    reviews: (details.reviews ?? []).slice(0, 5).map((r) => ({
      author: r.authorAttribution?.displayName,
      authorUri: r.authorAttribution?.uri,
      rating: r.rating,
      text: r.text?.text ?? r.originalText?.text ?? "",
      publishTime: r.publishTime,
      relativeTime: r.relativePublishTimeDescription,
    })),
    matchedQuery: usedQuery,
    lastSyncedAt: new Date().toISOString(),
  }
  cache[slug] = entry
  okCount++
  console.log(`   ✓ Rating : ${entry.rating} (${entry.userRatingCount} avis) — ${entry.reviews.length} reviews fetchées`)
  // Persist after each centre (résilience)
  writeFileSync(cachePath, JSON.stringify(cache, null, 2))
  await new Promise((r) => setTimeout(r, 300))
}

console.log(`\n=== SYNC TERMINÉ ===`)
console.log(`   OK     : ${okCount}`)
console.log(`   Miss   : ${missCount}`)
console.log(`   Cache  : ${cachePath}`)
