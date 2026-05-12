#!/usr/bin/env node
// Iris SEO Local — Test E2E sur 1 centre publié (READ-ONLY côté Webflow).
//
// Pipeline :
//   1. GET le centre depuis Webflow (slug fourni en arg ou Conflans par défaut)
//   2. Construit le prompt (system + user) à partir des données réelles
//   3. Appelle Claude API si ANTHROPIC_API_KEY est set
//   4. Affiche le JSON résultat + sauvegarde dans /tmp/iris-seo-<slug>.json
//   5. N'ÉCRIT JAMAIS dans Webflow (validation Armel manuelle ensuite)
//
// Usage :
//   node scripts/iris-seo-local-test.mjs                            # Conflans par défaut
//   node scripts/iris-seo-local-test.mjs auto-ecole-inris-bondy
//
// Variables nécessaires : WF_API_KEY, ANTHROPIC_API_KEY (depuis .env.local)

import { readFileSync, writeFileSync, existsSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))

// --- Places cache (rating + reviews fetchés par iris-places-sync.mjs) ---
let placesCache = {}
try {
  const cp = join(__dirname, "..", "data", "places-cache.json")
  if (existsSync(cp)) placesCache = JSON.parse(readFileSync(cp, "utf8"))
} catch { /* ignore */ }

// --- Load .env.local ---
try {
  const raw = readFileSync(join(__dirname, "..", ".env.local"), "utf8")
  for (const line of raw.split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim()
  }
} catch { /* ignore */ }

const WF_API_KEY = process.env.WF_API_KEY
const COL_RDV = process.env.WF_COLLECTION_ID_POINTS_DE_RDV ?? "67ebdb2c5b536cee781ef623"
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY
const MODEL = process.env.ANTHROPIC_MODEL_SEO ?? "claude-opus-4-7"

if (!WF_API_KEY) {
  console.error("❌ WF_API_KEY manquant")
  process.exit(1)
}

const targetSlug = process.argv[2] ?? "auto-ecole-inris-conflans-sainte-honorine"

// --- 1. Find the centre by slug ---
console.log(`→ Search centre slug=${targetSlug}`)
let centre = null
let offset = 0
while (!centre) {
  const r = await fetch(
    `https://api.webflow.com/v2/collections/${COL_RDV}/items?limit=100&offset=${offset}`,
    { headers: { Authorization: `Bearer ${WF_API_KEY}`, Accept: "application/json" } },
  )
  const d = await r.json()
  for (const it of d.items ?? []) {
    if ((it.fieldData?.slug ?? "") === targetSlug) {
      centre = it
      break
    }
  }
  const total = d.pagination?.total ?? 0
  offset += (d.items ?? []).length
  if (centre || offset >= total) break
}

if (!centre) {
  console.error(`❌ Centre introuvable: ${targetSlug}`)
  process.exit(2)
}

// --- Géocodage Nominatim (OSM gratuit, 1 req/sec max, User-Agent obligatoire) ---
async function geocodeOSM(query) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`
  const r = await fetch(url, { headers: { "User-Agent": "iris-dashboard/0.1 (autoecole-inris.com)" } })
  if (!r.ok) return null
  const d = await r.json()
  if (!Array.isArray(d) || d.length === 0) return null
  return { lat: parseFloat(d[0].lat), lon: parseFloat(d[0].lon) }
}

function buildOSMEmbed(lat, lon) {
  const delta = 0.005 // ~500m bbox
  const bbox = `${lon - delta},${lat - delta},${lon + delta},${lat + delta}`
  return `<iframe src="https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat},${lon}" width="100%" height="350" style="border:0;border-radius:8px" loading="lazy"></iframe><p style="font-size:0.85em;text-align:right;margin-top:4px"><a href="https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=17/${lat}/${lon}" target="_blank" rel="noopener">Voir une carte plus grande</a></p>`
}

// --- Avis Google (CTA gratuit, sans Places API) ---
// Construit 2 liens deep-link Google Maps depuis le nom + ville du centre.
// Ne nécessite pas de Place ID — Google résout automatiquement.
function buildAvisGoogleSection(name, ville, adresse) {
  const queryView = encodeURIComponent(`${name} ${ville}`.trim())
  const queryReview = encodeURIComponent(`${name} ${adresse ?? ""} ${ville}`.trim())
  return `<h3>Avis Google des élèves de ${escapeHtml(ville)}</h3>
<p>Les avis de nos élèves sur Google sont la meilleure source pour découvrir notre approche pédagogique. Consultez librement les retours d'expérience publiés sur la fiche Google de notre centre.</p>
<p>
<a href="https://www.google.com/maps/search/?api=1&query=${queryView}" target="_blank" rel="noopener"><strong>👉 Consulter nos avis Google</strong></a><br>
<a href="https://search.google.com/local/writereview?placeid=&q=${queryReview}" target="_blank" rel="noopener"><strong>✍️ Laisser un avis sur Google</strong></a>
</p>`
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]))
}
if (centre.isDraft || centre.isArchived) {
  console.error(`❌ Centre non publié (draft=${centre.isDraft}, archived=${centre.isArchived}). Iris ne traite que les publiés.`)
  process.exit(3)
}

const fd = centre.fieldData ?? {}
console.log(`✓ Centre trouvé : ${fd.name} (ID ${centre.id})`)
console.log(`  texte-seo actuel : ${(fd["texte-seo"] ?? "").length} chars`)

// Geocode address now (script-side, deterministic, free via OSM)
const adresseComplete = [fd.adresse, fd["code-postal"], extractVille(fd.slug)].filter(Boolean).join(" ")
console.log(`→ Geocoding (OSM Nominatim) : ${adresseComplete}`)
let geo = null
try {
  geo = await geocodeOSM(adresseComplete)
  if (geo) console.log(`✓ Coordonnées : ${geo.lat}, ${geo.lon}`)
  else console.warn(`⚠️  Géocodage sans résultat — la carte sera omise.`)
} catch (e) {
  console.warn(`⚠️  Géocodage échoué : ${e.message}`)
}
const mapEmbedHtml = geo ? buildOSMEmbed(geo.lat, geo.lon) : ""

// --- 2. Extract ville from slug (heuristic) ---
function extractVille(slug) {
  let s = slug
    .replace(/^auto-ecole-inris-/, "")
    .replace(/^point-conduite-inris-/, "")
    .replace(/^point-de-rdv-+/, "")
    .replace(/^inris-/, "")
  return s.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join("-")
}

const centreInput = {
  name: fd.name,
  slug: fd.slug,
  ville: extractVille(fd.slug),
  adresse: fd.adresse,
  codePostal: fd["code-postal"],
  telephone: fd.telephone,
  horairesOuverture: stripHtml(fd["horaires-d-ouverture-text"]),
  horairesConduite: stripHtml(fd["horaires-de-conduite-text"]),
  formationsProposees: stripHtml(fd["formations-proposees-text"]),
}

function stripHtml(s) {
  if (!s) return null
  return s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 400)
}

// --- 3. Inline import the prompt (avoid TS compile in standalone script) ---
const IRIS_SEO_LOCAL_SYSTEM_PROMPT = readFileSync(
  join(__dirname, "..", "src", "lib", "ai", "prompts", "seo-local.ts"),
  "utf8",
).match(/IRIS_SEO_LOCAL_SYSTEM_PROMPT\s*=\s*`([\s\S]*?)`/)[1].replace(/\\`/g, "`")

const userMsg = [
  "Centre INRI'S à traiter :",
  "",
  `- Nom : ${centreInput.name}`,
  `- Slug : ${centreInput.slug}`,
  `- Ville : ${centreInput.ville}`,
  centreInput.adresse ? `- Adresse : ${centreInput.adresse}` : null,
  centreInput.codePostal ? `- Code postal : ${centreInput.codePostal}` : null,
  centreInput.telephone ? `- Téléphone : ${centreInput.telephone}` : null,
  centreInput.horairesOuverture ? `- Horaires d'ouverture : ${centreInput.horairesOuverture}` : null,
  centreInput.horairesConduite ? `- Horaires de conduite : ${centreInput.horairesConduite}` : null,
  centreInput.formationsProposees ? `- Formations proposées (extrait) : ${centreInput.formationsProposees}` : null,
  "",
  "Génère la sortie JSON selon les règles définies. Rappel : la clé du HTML est `texte_seo_html` (avec underscores), pas `texte-seo`. Le JSON doit contenir EXACTEMENT les 10 clés listées (la carte n'est PAS générée par toi, elle est ajoutée par le script depuis l'adresse géocodée — n'inclus PAS map_embed_html dans ta sortie).",
].filter(Boolean).join("\n")

console.log("\n--- USER MESSAGE ---")
console.log(userMsg)
console.log("---\n")

// --- 4. Call Claude or skip ---
if (!ANTHROPIC_API_KEY) {
  console.warn("⚠️  ANTHROPIC_API_KEY manquant — affichage du prompt sans appel.")
  console.warn("    Pour exécuter : ajouter la clé dans .env.local et relancer.")
  process.exit(0)
}

// --- Tool-use forcé : on contraint le modèle à appeler submit_seo_output ---
const SEO_TOOL = {
  name: "submit_seo_output",
  description:
    "Soumets le contenu SEO local généré pour le centre INRI'S. Tous les champs sont obligatoires. " +
    "Le HTML doit contenir au moins UNE mention différenciante INRI'S (stages 5j/20h, 3j/13h, garantie de place d'examen en stage accéléré, ou « spécialiste des permis accélérés depuis 2003 »). " +
    "INTERDIT : promesse de taux de réussite, superlatifs non sourçables, chiffres inventés (X ans d'expérience > 23, centaines d'élèves), noms propres locaux non vérifiables.",
  input_schema: {
    type: "object",
    additionalProperties: false,
    required: [
      "texte_seo_html",
      "meta_description",
      "h1_suggere",
      "mots_cles_cibles",
      "particularite_locale_citee",
      "longueur_chars",
      "notes_review",
      "jsonld_driving_school",
      "jsonld_faq",
      "jsonld_breadcrumb",
    ],
    properties: {
      texte_seo_html: {
        type: "string",
        description: "HTML inline propre (h2, h3, p, strong, br uniquement — pas de <html>, <body>, ni styles inline). 600 à 800 mots.",
      },
      meta_description: {
        type: "string",
        maxLength: 155,
        description: "Meta description SEO, max 155 caractères.",
      },
      h1_suggere: { type: "string" },
      mots_cles_cibles: {
        type: "array",
        items: { type: "string" },
        minItems: 3,
        maxItems: 6,
      },
      particularite_locale_citee: { type: "string" },
      longueur_chars: { type: "integer", minimum: 1 },
      notes_review: {
        type: "string",
        description: "1 phrase à destination d'Armel : signature INRI'S utilisée, choix éditoriaux.",
      },
      jsonld_driving_school: {
        type: "string",
        description: "JSON-LD sérialisé DrivingSchool — string parseable en JSON valide.",
      },
      jsonld_faq: {
        type: "string",
        description: "JSON-LD sérialisé FAQPage — string parseable en JSON valide. Questions doivent être présentes dans texte_seo_html.",
      },
      jsonld_breadcrumb: {
        type: "string",
        description: "JSON-LD sérialisé BreadcrumbList — string parseable en JSON valide.",
      },
    },
  },
}

async function callOnce(messages) {
  const apiRes = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 8000,
      system: IRIS_SEO_LOCAL_SYSTEM_PROMPT,
      tools: [SEO_TOOL],
      tool_choice: { type: "tool", name: "submit_seo_output" },
      messages,
    }),
  })
  const apiData = await apiRes.json()
  if (!apiRes.ok) {
    console.error("❌ Anthropic error:", JSON.stringify(apiData, null, 2))
    process.exit(4)
  }
  const toolUse = (apiData.content ?? []).find((c) => c.type === "tool_use")
  return toolUse?.input ?? null
}

console.log(`→ Anthropic call (model=${MODEL}, tool-use forcé)...`)
let messages = [{ role: "user", content: userMsg }]
let parsed = await callOnce(messages)
let attempt = 1

// --- 5. QA gate — vérifie les règles INRI'S avant validation ---
function qaCheck(p) {
  if (!p?.texte_seo_html) return ["MISSING_TEXTE_SEO_HTML"]
  const html = p.texte_seo_html
  const violations = []
  if (/\b(\d{2,3})\s*(?:ans|années)\s+d['']expérience/i.test(html)) {
    const m = html.match(/(\d{2,3})\s*(?:ans|années)\s+d['']expérience/i)
    if (m && Number(m[1]) > 23) violations.push(`HALLUCINATION_EXPERIENCE_${m[1]}_ans`)
  }
  if (/taux de réussite|100\s?%\s+(?:de\s+)?(?:reçus|réussite)|garanti(?:e)? la (?:réussite|réception)/i.test(html)) {
    violations.push("PROMESSE_REUSSITE")
  }
  if (/\b(?:meilleur(?:e)?|n[°o]\s?1|leader|numéro un)\b/i.test(html)) {
    violations.push("SUPERLATIF_NON_SOURCABLE")
  }
  const hasInrisSignature =
    /5\s*jours?\s*\/?\s*20\s*h(?:eures)?|3\s*jours?\s*\/?\s*13\s*h(?:eures)?|garantie?\s+(?:de\s+)?place\s+d['']examen|spécialiste.{0,20}permis\s+accéléré/i.test(html)
  if (!hasInrisSignature) violations.push("MISSING_INRIS_SIGNATURE")
  const required = ["meta_description", "h1_suggere", "mots_cles_cibles", "particularite_locale_citee", "longueur_chars", "notes_review", "jsonld_driving_school", "jsonld_faq", "jsonld_breadcrumb"]
  for (const k of required) if (p[k] === undefined) violations.push(`MISSING_FIELD_${k}`)
  // JSON-LD parseable + @type correct
  const checks = [
    ["jsonld_driving_school", "DrivingSchool"],
    ["jsonld_faq", "FAQPage"],
    ["jsonld_breadcrumb", "BreadcrumbList"],
  ]
  for (const [key, expectedType] of checks) {
    if (!p[key]) continue
    try {
      const obj = JSON.parse(p[key])
      if (obj["@type"] !== expectedType) violations.push(`${key.toUpperCase()}_WRONG_TYPE`)
    } catch {
      violations.push(`${key.toUpperCase()}_INVALID_JSON`)
    }
  }
  return violations
}

let qa = parsed ? qaCheck(parsed) : ["NO_PARSED_JSON"]

// --- Retry loop : si violations éditoriales, re-prompt avec feedback (max 2 retries) ---
const MAX_RETRIES = 2
while (qa.length > 0 && attempt <= MAX_RETRIES) {
  console.log(`\n⚠️  QA fail (tentative ${attempt}) : ${qa.join(", ")}`)
  console.log(`→ Re-prompt avec feedback (tentative ${attempt + 1}/${MAX_RETRIES + 1})...`)
  // Re-injecte le résultat précédent + violations dans la conversation
  messages = [
    { role: "user", content: userMsg },
    {
      role: "assistant",
      content: [
        {
          type: "tool_use",
          id: `toolu_retry_${attempt}`,
          name: "submit_seo_output",
          input: parsed ?? {},
        },
      ],
    },
    {
      role: "user",
      content: [
        {
          type: "tool_result",
          tool_use_id: `toolu_retry_${attempt}`,
          is_error: true,
          content:
            "REJETÉ. Violations détectées : " +
            qa.join(", ") +
            ". Corrige IMPÉRATIVEMENT et resoumets. Rappels : (1) au moins une signature INRI'S parmi « stages 5 jours / 20 heures », « stages 3 jours / 13 heures », « garantie de place d'examen à l'inscription en stage accéléré », ou « réseau INRI'S, spécialiste des permis accélérés depuis 2003 ». (2) INTERDIT : « taux de réussite », « meilleur », « n°1 », chiffres d'expérience > 23 ans, noms propres locaux non listés dans les données d'entrée.",
        },
      ],
    },
  ]
  parsed = await callOnce(messages)
  qa = parsed ? qaCheck(parsed) : ["NO_PARSED_JSON"]
  attempt++
}

// --- Places (Google Maps) injection : rating + AggregateRating + section avis ---
// On n'injecte les avis QUE si le match Place contient "INRI" (sinon faux match → silencieux)
const placesEntry = placesCache[targetSlug]
let placesUsed = null
if (placesEntry && placesEntry.status === "ok") {
  const matchedName = (placesEntry.name ?? "").toUpperCase()
  if (matchedName.includes("INRI")) {
    placesUsed = placesEntry
  } else {
    console.warn(`⚠️  Places match "${placesEntry.name}" ne contient pas "INRI" — avis ignorés (probable faux match Google)`)
  }
}

function buildAvisGoogleReviewsSection(p, ville) {
  const stars = "★".repeat(Math.round(p.rating)) + "☆".repeat(5 - Math.round(p.rating))
  const reviews = (p.reviews ?? []).filter((r) => r.text && r.text.length > 30).slice(0, 3)
  const items = reviews.map((r) => {
    const rstars = "★".repeat(r.rating) + "☆".repeat(5 - r.rating)
    const safeText = escapeHtml(r.text).slice(0, 320)
    const author = escapeHtml(r.author ?? "Élève")
    const when = escapeHtml(r.relativeTime ?? "")
    return `<p><strong>${rstars}</strong> — <em>${author}${when ? ` (${when})` : ""}</em><br>${safeText}${r.text.length > 320 ? "…" : ""}</p>`
  }).join("\n")
  const writeReviewUrl = `https://search.google.com/local/writereview?placeid=${encodeURIComponent(p.placeId)}`
  const mapsUrl = p.googleMapsUri ?? `https://www.google.com/maps/place/?q=place_id:${p.placeId}`
  return `<h3>Avis Google des élèves de ${escapeHtml(ville)}</h3>
<p><strong>${stars}</strong> <strong>${p.rating}/5</strong> — basé sur <strong>${p.userRatingCount} avis Google</strong> vérifiés sur la fiche du centre.</p>
${items}
<p>
<a href="${mapsUrl}" target="_blank" rel="noopener"><strong>👉 Voir tous les avis Google</strong></a><br>
<a href="${writeReviewUrl}" target="_blank" rel="noopener"><strong>✍️ Laisser un avis</strong></a>
</p>`
}

function injectAggregateRating(jsonLdString, p) {
  try {
    const obj = JSON.parse(jsonLdString)
    obj.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: String(p.rating),
      reviewCount: String(p.userRatingCount),
      bestRating: "5",
      worstRating: "1",
    }
    return JSON.stringify(obj)
  } catch {
    return jsonLdString
  }
}

// Inject script-generated OSM map + Avis Google (CTA ou reviews enrichies)
if (parsed) {
  parsed.map_embed_html = mapEmbedHtml
  if (placesUsed) {
    parsed.avis_google_html = buildAvisGoogleReviewsSection(placesUsed, centreInput.ville)
    parsed.jsonld_driving_school = injectAggregateRating(parsed.jsonld_driving_school, placesUsed)
  } else {
    // Fallback : CTA générique sans note (centre sans match Google INRI'S)
    parsed.avis_google_html = buildAvisGoogleSection(fd.name, centreInput.ville, fd.adresse)
  }
}

const outPath = `/tmp/iris-seo-${targetSlug}.json`
writeFileSync(outPath, JSON.stringify({
  centre: { id: centre.id, slug: fd.slug, name: fd.name },
  geocode: geo,
  places: placesEntry ?? null,
  placesUsed: placesUsed ? { placeId: placesUsed.placeId, name: placesUsed.name, rating: placesUsed.rating, reviewCount: placesUsed.userRatingCount } : null,
  generated: parsed ?? { raw },
  qa: { violations: qa, passed: qa.length === 0, attempts: attempt },
  meta: { model: MODEL, mapProvider: "openstreetmap", generatedAt: new Date().toISOString() },
}, null, 2))

console.log(`\n✅ Sauvegardé : ${outPath}`)
if (parsed) {
  console.log(`   H1 suggéré : ${parsed.h1_suggere ?? "(n/a)"}`)
  console.log(`   Meta desc  : ${parsed.meta_description ?? "(n/a)"}`)
  console.log(`   Longueur   : ${parsed.longueur_chars ?? "(n/a)"} chars`)
  console.log(`   Notes      : ${parsed.notes_review ?? "(n/a)"}`)
}
console.log(`\n--- QA GATE ---`)
if (qa.length === 0) console.log("✅ Toutes les règles INRI'S respectées.")
else {
  console.log("❌ Violations détectées :")
  for (const v of qa) console.log(`   - ${v}`)
}
console.log(`\n   AUCUNE ÉCRITURE DANS WEBFLOW. Validation Armel manuelle requise.`)
