#!/usr/bin/env node
// Audit du cache géocodage : reverse-geocode chaque coord, compare au display_name Nominatim
// avec l'adresse Webflow d'origine. Flag les matches douteux (rue absente du résultat).
//
// Stratégie heuristique :
//  - extrait le mot-clé fort de l'adresse (nom de rue après numéro + type voie)
//  - fetch reverse-geocode des coords cachées
//  - si le mot-clé n'apparaît PAS dans display_name → suspect
//  - écrit data/geocode-audit.json avec status: ok | suspect | missing
//
// Usage : node scripts/iris-geocode-audit.mjs

import { readFileSync, writeFileSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..")

const coords = JSON.parse(readFileSync(join(ROOT, "data", "centres-coords.json"), "utf8"))

function extractRueKey(adresse) {
  if (!adresse) return null
  // ex: "4 Rue des Fossés , 77000 MELUN" → "Fossés"
  // ex: "Avenue de la République, 92140 Clamart" → "République"
  // on prend les mots significatifs après le type voie
  const types = /(rue|avenue|av|boulevard|bd|place|allée|allee|chemin|impasse|route|rte|cours|quai|passage|square|esplanade|parvis|voie)\s+(?:de\s+la\s+|du\s+|de\s+l['']?|des\s+|de\s+|d['']?)?/i
  const m = adresse.match(new RegExp(types.source + "([\\p{L}'\\- ]+)", "iu"))
  if (!m) return null
  // garde 1-3 premiers mots significatifs
  const rest = m[2].trim().split(/[\s,]+/).filter(w => w.length >= 3).slice(0, 2)
  return rest[0] || null
}

async function reverseGeocode(lat, lon) {
  const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`
  const r = await fetch(url, { headers: { "User-Agent": "iris-dashboard/0.1 (autoecole-inris.com)" } })
  if (!r.ok) return null
  return await r.json()
}

const results = {}
const entries = Object.entries(coords).filter(([, v]) => v.lat != null)
console.log(`→ Audit ${entries.length} centres géocodés…`)

let i = 0
let suspectCount = 0
for (const [slug, v] of entries) {
  i++
  const key = extractRueKey(v.adresse)
  if (!key) {
    results[slug] = { status: "skip", reason: "no_rue_key", adresse: v.adresse }
    process.stdout.write(`  [${i}/${entries.length}] ${slug} — skip (pas de clé rue)\n`)
    continue
  }
  process.stdout.write(`  [${i}/${entries.length}] ${slug} (clé="${key}")… `)
  let rev = null
  try { rev = await reverseGeocode(v.lat, v.lon) } catch {}
  const display = rev?.display_name ?? ""
  const road = rev?.address?.road ?? ""
  const ok = display.toLowerCase().includes(key.toLowerCase()) || road.toLowerCase().includes(key.toLowerCase())
  results[slug] = {
    status: ok ? "ok" : "suspect",
    adresse: v.adresse,
    coords: { lat: v.lat, lon: v.lon },
    osmDisplay: display,
    osmRoad: road,
    rueKey: key,
  }
  if (!ok) {
    suspectCount++
    console.log(`⚠ SUSPECT (rue="${road}")`)
  } else {
    console.log(`✓`)
  }
  await new Promise(r => setTimeout(r, 1100)) // 1 req/s Nominatim
}

writeFileSync(join(ROOT, "data", "geocode-audit.json"), JSON.stringify(results, null, 2))
console.log(`\n✓ Audit terminé : ${suspectCount} suspects / ${entries.length} centres`)
console.log(`→ data/geocode-audit.json`)
console.log(`\nPour lister les suspects :`)
console.log(`  node -e "const a=JSON.parse(require('fs').readFileSync('data/geocode-audit.json','utf8'));Object.entries(a).filter(([,v])=>v.status==='suspect').forEach(([s,v])=>console.log(s,'|',v.adresse,'→',v.osmRoad||v.osmDisplay.slice(0,60)))"`)
