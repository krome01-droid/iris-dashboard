#!/usr/bin/env node
// Re-géocode les suspects de l'audit en mode STRUCTURÉ (Nominatim street/city/postalcode).
// Beaucoup plus précis que la query libre. Met à jour data/centres-coords.json.
//
// Usage : node scripts/iris-geocode-fix-suspects.mjs

import { readFileSync, writeFileSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..")

const audit = JSON.parse(readFileSync(join(ROOT, "data", "geocode-audit.json"), "utf8"))
const coords = JSON.parse(readFileSync(join(ROOT, "data", "centres-coords.json"), "utf8"))

function parseAdresse(raw) {
  if (!raw) return null
  // Trouve un code postal 5 chiffres
  const cpMatch = raw.match(/\b(\d{5})\b/)
  if (!cpMatch) return null
  const cp = cpMatch[1]
  const before = raw.slice(0, cpMatch.index).trim().replace(/[,\s]+$/, "")
  const after = raw.slice(cpMatch.index + 5).trim().replace(/^[,\s]+/, "")
  // street = tout ce qui est avant le CP ; on garde les chiffres+nom de rue (premiers 80 chars)
  const street = before.replace(/^\W+/, "").slice(0, 80)
  // city = tout ce qui est après le CP, premier segment
  const city = after.split(/[,\n]/)[0].trim().slice(0, 50)
  return { street, city, postalcode: cp }
}

async function structuredGeocode({ street, city, postalcode }) {
  const params = new URLSearchParams({
    format: "json", limit: "1", country: "France",
    street, city, postalcode,
  })
  const url = `https://nominatim.openstreetmap.org/search?${params}`
  const r = await fetch(url, { headers: { "User-Agent": "iris-dashboard/0.1 (autoecole-inris.com)" } })
  if (!r.ok) return null
  const d = await r.json()
  if (!Array.isArray(d) || d.length === 0) return null
  return { lat: parseFloat(d[0].lat), lon: parseFloat(d[0].lon), display: d[0].display_name }
}

const suspects = Object.entries(audit).filter(([, v]) => v.status === "suspect")
console.log(`→ Re-géocodage de ${suspects.length} suspects en mode structuré…\n`)

let fixed = 0, unchanged = 0, failed = 0
for (let i = 0; i < suspects.length; i++) {
  const [slug, v] = suspects[i]
  const parsed = parseAdresse(v.adresse)
  process.stdout.write(`  [${i + 1}/${suspects.length}] ${slug}\n    adresse: ${v.adresse}\n`)
  if (!parsed) {
    console.log("    ✗ adresse non parsable\n")
    failed++
    continue
  }
  console.log(`    parsed: street="${parsed.street}" city="${parsed.city}" cp="${parsed.postalcode}"`)
  let res = null
  try { res = await structuredGeocode(parsed) } catch {}
  if (!res) {
    // fallback : street sans le numéro
    const streetNoNum = parsed.street.replace(/^\d+\s*/, "").trim()
    if (streetNoNum && streetNoNum !== parsed.street) {
      console.log(`    retry sans numéro: "${streetNoNum}"`)
      try { res = await structuredGeocode({ ...parsed, street: streetNoNum }) } catch {}
      await new Promise(r => setTimeout(r, 1100))
    }
  }
  if (!res) {
    console.log("    ✗ Nominatim n'a rien trouvé\n")
    failed++
    await new Promise(r => setTimeout(r, 1100))
    continue
  }
  const oldLat = coords[slug].lat, oldLon = coords[slug].lon
  const dist = Math.sqrt((oldLat - res.lat) ** 2 + (oldLon - res.lon) ** 2) * 111 // ~km
  if (dist < 0.05) {
    console.log(`    = mêmes coords (Δ${dist.toFixed(3)}km)\n`)
    unchanged++
  } else {
    coords[slug].lat = res.lat
    coords[slug].lon = res.lon
    console.log(`    ✓ FIXED: ${oldLat.toFixed(4)},${oldLon.toFixed(4)} → ${res.lat.toFixed(4)},${res.lon.toFixed(4)} (Δ${dist.toFixed(2)}km)`)
    console.log(`      ${res.display}\n`)
    fixed++
  }
  await new Promise(r => setTimeout(r, 1100))
}

writeFileSync(join(ROOT, "data", "centres-coords.json"), JSON.stringify(coords, null, 2))
console.log(`\n=== Résumé ===`)
console.log(`  fixed     : ${fixed}`)
console.log(`  unchanged : ${unchanged}`)
console.log(`  failed    : ${failed}`)
console.log(`✓ data/centres-coords.json mis à jour`)
