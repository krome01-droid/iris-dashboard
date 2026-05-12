#!/usr/bin/env node
// Iris Webflow Write — PATCH les 3 champs SEO sur 1 item CMS.
//
// Champs poussés :
//   - texte-seo                  → HTML enrichi (texte + carte OSM + avis + JSON-LD inline)
//   - meta-description-seo       → meta description courte (≤155 chars)
//   - head-code-seo-json-ld      → blocs JSON-LD concaténés (utilisable si binding head plus tard)
//
// L'écriture est en mode STAGED par défaut : le contenu existe côté Webflow CMS
// mais n'apparaît sur le site PUBLIC qu'après publication manuelle par Armel.
//
// Usage :
//   node scripts/iris-webflow-write.mjs <slug>
//   # exige : /tmp/iris-seo-<slug>.json (généré par iris-seo-local-test.mjs)
//
// Variables : WF_API_KEY

import { readFileSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { decorateSeoHtml } from "./lib/decorate-seo-html.mjs"

const __dirname = dirname(fileURLToPath(import.meta.url))

function extractVilleFromSlug(slug) {
  return slug
    .replace(/^auto-ecole-inris-/, "").replace(/^point-conduite-inris-/, "").replace(/^point-de-rdv-+/, "").replace(/^inris-/, "")
    .split("-").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join("-")
}

try {
  const raw = readFileSync(join(__dirname, "..", ".env.local"), "utf8")
  for (const line of raw.split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim()
  }
} catch { /* ignore */ }

const WF_API_KEY = process.env.WF_API_KEY
const COL_RDV = process.env.WF_COLLECTION_ID_POINTS_DE_RDV ?? "67ebdb2c5b536cee781ef623"
if (!WF_API_KEY) { console.error("❌ WF_API_KEY manquant"); process.exit(1) }

const slug = process.argv[2]
if (!slug) { console.error("Usage: iris-webflow-write.mjs <slug>"); process.exit(2) }

const payloadPath = `/tmp/iris-seo-${slug}.json`
let data
try { data = JSON.parse(readFileSync(payloadPath, "utf8")) }
catch { console.error(`❌ Payload manquant : ${payloadPath} — génère d'abord avec iris-seo-local-test.mjs`); process.exit(3) }

if (!data.qa?.passed) {
  console.error(`❌ QA non passée pour ${slug} (${(data.qa?.violations || []).join(", ")}). Refus d'écrire.`)
  process.exit(4)
}

const g = data.generated
const itemId = data.centre.id

// --- Charge les reviews depuis le cache Places (le JSON SEO ne porte pas les avis bruts) ---
let placesFull = data.placesUsed
try {
  const cache = JSON.parse(readFileSync(join(__dirname, "..", "data", "places-cache.json"), "utf8"))
  const entry = cache[slug]
  if (entry && entry.status === "ok" && data.placesUsed) {
    placesFull = { ...data.placesUsed, ...entry, reviewCount: entry.userRatingCount }
  }
} catch { /* no cache */ }

// --- Charge les coords (geo + voisins) ---
let coordsCache = {}
try { coordsCache = JSON.parse(readFileSync(join(__dirname, "..", "data", "centres-coords.json"), "utf8")) } catch {}

// --- Trouve les 3 plus proches centres (haversine) ---
function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371 // km
  const toRad = (d) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}
function findNearby(currentSlug, coordsCache, limit = 3) {
  const here = coordsCache[currentSlug]
  if (!here?.lat) return []
  const others = Object.entries(coordsCache)
    .filter(([s, v]) => s !== currentSlug && v.lat != null)
    .map(([s, v]) => ({ slug: s, ville: v.ville, dist: haversine(here.lat, here.lon, v.lat, v.lon) }))
    .filter(o => o.dist > 0.5 && o.dist < 80) // entre 500m et 80km (zone pertinente)
    .sort((a, b) => a.dist - b.dist)
    .slice(0, limit)
  return others.map(o => ({ slug: o.slug, ville: o.ville, distance: o.dist.toFixed(1) }))
}
const nearby = findNearby(slug, coordsCache)

// --- Audit-aware: si l'audit a flaggé ce slug suspect ET pas de fix, on dégrade en silence
// (la carte sera générée mais on log un warning pour traçabilité)
try {
  const auditPath = join(__dirname, "..", "data", "geocode-audit.json")
  const audit = JSON.parse(readFileSync(auditPath, "utf8"))
  if (audit[slug]?.status === "suspect") {
    console.log(`   ⚠ Géocodage flaggé suspect par l'audit (revérifier la carte sur staging)`)
  }
} catch { /* no audit yet */ }

// --- Fallback : si map_embed_html vide mais on a les coords en cache → on génère la carte ---
if (!g.map_embed_html || g.map_embed_html.length === 0) {
  const c = coordsCache[slug]
  if (c?.lat != null) {
    const { lat, lon } = c
    const bbox = `${lon - 0.005},${lat - 0.005},${lon + 0.005},${lat + 0.005}`
    g.map_embed_html = `<iframe src="https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat},${lon}" width="100%" height="350" style="border:0;border-radius:8px" loading="lazy"></iframe><p style="font-size:0.85em;text-align:right;margin-top:4px"><a href="https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=17/${lat}/${lon}" target="_blank" rel="noopener">Voir une carte plus grande</a></p>`
    // également : injecter geocode dans le JSON-LD si absent
    if (!data.geocode) data.geocode = { lat, lon }
  }
}

// --- Enrichit le JSON-LD DrivingSchool : geo + image + review + hasOfferCatalog ---
function enrichDrivingSchoolJsonLd(jsonLdString, { geo, placesFull, slug, name }) {
  try {
    const obj = JSON.parse(jsonLdString)
    // geo coords
    if (geo?.lat) {
      obj.geo = { "@type": "GeoCoordinates", latitude: String(geo.lat), longitude: String(geo.lon) }
    }
    // image : fallback brand par défaut (à terme : per-item)
    if (!obj.image || obj.image === "") {
      obj.image = "https://cdn.prod.website-files.com/67c976202edb4724b88395f9/6a02ebba605cce120cc63f0f_inris-og-default.jpg"
    }
    // individual Review items
    if (placesFull?.reviews?.length) {
      obj.review = placesFull.reviews.slice(0, 5).filter(r => r.text && r.text.length > 30).map(r => ({
        "@type": "Review",
        author: { "@type": "Person", name: r.author ?? "Élève" },
        reviewRating: { "@type": "Rating", ratingValue: String(r.rating), bestRating: "5" },
        reviewBody: (r.text || "").slice(0, 500),
        datePublished: r.publishTime ?? undefined,
      }))
    }
    // hasOfferCatalog — services standards INRI'S (prix omis : non vérifiables centre par centre)
    obj.hasOfferCatalog = {
      "@type": "OfferCatalog",
      name: "Stages permis accélérés INRI'S",
      itemListElement: [
        { "@type": "Offer", itemOffered: { "@type": "Service", name: "Stage permis B accéléré 5 jours / 20 heures", description: "Stage intensif boîte automatique, code et conduite, place d'examen garantie à l'inscription en stage accéléré."} },
        { "@type": "Offer", itemOffered: { "@type": "Service", name: "Stage permis B accéléré 3 jours / 13 heures", description: "Stage court boîte automatique, élèves déjà initiés à la conduite." } },
        { "@type": "Offer", itemOffered: { "@type": "Service", name: "Stage code de la route 2 jours", description: "Préparation accélérée à l'épreuve théorique générale (ETG)." } },
      ],
    }
    return JSON.stringify(obj)
  } catch {
    return jsonLdString
  }
}
g.jsonld_driving_school = enrichDrivingSchoolJsonLd(g.jsonld_driving_school, {
  geo: data.geocode,
  placesFull,
  slug,
  name: data.centre.name,
})

// --- Build the final texte-seo HTML via the design-system decorator ---
const ville = extractVilleFromSlug(slug)

// --- Sonde les labels Qualiopi + Label Qualité sur inris-formations.com ---
// Convention URL : /wp-content/uploads/2025/04/{Certificat-Qualiopi|Attestation-Label}-INRIS-{NomCentre}-2025-2028.pdf
function pascalCaseFromSlug(slug) {
  return slug.replace(/^auto-ecole-inris-/, "").replace(/^point-conduite-inris-/, "").replace(/^inris-/, "")
    .split("-").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join("-")
}
async function probeUrl(url) {
  try {
    const r = await fetch(url, { method: "HEAD" })
    return r.ok
  } catch { return false }
}
async function probeLabels(slug) {
  const name = pascalCaseFromSlug(slug)
  const qualiopi = `https://inris-formations.com/wp-content/uploads/2025/04/Certificat-Qualiopi-INRIS-${name}-2025-2028.pdf`
  const label = `https://inris-formations.com/wp-content/uploads/2025/04/Attestation-Label-INRIS-${name}-2025-2028.pdf`
  const [hasQualiopi, hasLabel] = await Promise.all([probeUrl(qualiopi), probeUrl(label)])
  const out = {}
  if (hasQualiopi) out.qualiopi = { url: qualiopi, period: "2025-2028" }
  if (hasLabel) out.labelQualite = { url: label, period: "2025-2028" }
  return out
}
const labels = await probeLabels(slug)
const labelCount = Object.keys(labels).length
console.log(`   Labels détectés      : ${labelCount > 0 ? Object.keys(labels).join(", ") : "aucun"}`)

// --- Si c'est une auto-école physique → on a un email d'agence pour le CTA "être rappelé" ---
let agencyEmail = null
try {
  const physiques = JSON.parse(readFileSync(join(__dirname, "..", "data", "auto-ecoles-physiques.json"), "utf8"))
  const match = physiques.find(p => p.slug === slug)
  if (match) {
    agencyEmail = match.email
    console.log(`   Agence physique       : ✓ email=${agencyEmail}`)
  }
} catch { /* no file */ }

const finalHtml = decorateSeoHtml({
  generated: g,
  placesUsed: placesFull,
  ville,
  nearby,
  labels,
  agencyEmail,
})

// --- Build head-code-seo-json-ld value (pour binding head futur si on veut migrer le JSON-LD hors body) ---
const headCodeValue = [
  g.jsonld_driving_school,
  g.jsonld_faq,
  g.jsonld_breadcrumb,
].filter(Boolean).map((s) => `<script type="application/ld+json">${s}</script>`).join("\n")

console.log(`→ Push Webflow item ${itemId} (slug=${slug})`)
console.log(`   texte-seo            : ${finalHtml.length} chars`)
console.log(`   meta-description-seo : ${(g.meta_description || "").length} chars`)
console.log(`   head-code-seo-json-ld: ${headCodeValue.length} chars`)
console.log(`   Mode                 : STAGED (publication manuelle requise pour go live)`)

const body = {
  fieldData: {
    "texte-seo": finalHtml,
    "meta-description-seo": g.meta_description ?? "",
    "head-code-seo-json-ld": headCodeValue,
  },
}

const r = await fetch(`https://api.webflow.com/v2/collections/${COL_RDV}/items/${itemId}`, {
  method: "PATCH",
  headers: {
    Authorization: `Bearer ${WF_API_KEY}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  },
  body: JSON.stringify(body),
})
const d = await r.json()
console.log(`\nHTTP ${r.status}`)
if (!r.ok) {
  console.error("❌ Erreur :", JSON.stringify(d, null, 2))
  process.exit(5)
}
console.log(`✓ Item PATCHED — Webflow staging à jour.`)
console.log(`\nProchaines étapes manuelles :`)
console.log(`  1. Aller dans Webflow Designer / CMS → vérifier l'item ${slug}`)
console.log(`  2. Publier le site (bouton Publish en haut à droite) pour rendre les changements live`)
console.log(`  3. Curl : https://www.autoecole-inris.com/points-de-rdv/${slug} (laisser 30s pour la CDN)`)
