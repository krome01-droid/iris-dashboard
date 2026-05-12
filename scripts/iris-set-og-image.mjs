#!/usr/bin/env node
// Iris OG Image — PATCH le champ `image` (bindé à og:image + twitter:image) sur les 253 items.
// Usage : node scripts/iris-set-og-image.mjs

import { readFileSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..")

try {
  const raw = readFileSync(join(ROOT, ".env.local"), "utf8")
  for (const line of raw.split("\n")) { const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim() }
} catch {}

const WF_API_KEY = process.env.WF_API_KEY
const COL = "67ebdb2c5b536cee781ef623"
const OG_URL = "https://cdn.prod.website-files.com/67c976202edb4724b88395f9/6a02ebba605cce120cc63f0f_inris-og-default.jpg"
const OG_FILE_ID = "6a02ebba605cce120cc63f0f"
const OG_ALT = "INRI'S Auto-Moto-École — Stages permis accélérés"

async function fetchAll() {
  const out = []; let offset = 0
  while (true) {
    const r = await fetch(`https://api.webflow.com/v2/collections/${COL}/items?limit=100&offset=${offset}`, { headers: { Authorization: `Bearer ${WF_API_KEY}` } })
    const d = await r.json()
    out.push(...(d.items ?? []))
    offset += (d.items ?? []).length
    if (offset >= (d.pagination?.total ?? 0)) break
  }
  return out.filter(c => !c.isDraft && !c.isArchived)
}

const items = await fetchAll()
console.log(`→ ${items.length} items à patcher (image field)\n`)

let ok = 0, fail = 0, skipped = 0
for (let i = 0; i < items.length; i++) {
  const it = items[i]
  const slug = it.fieldData?.slug
  // skip if already set to our new asset
  if (it.fieldData?.image?.url?.includes("inris-og-default")) {
    skipped++
    process.stdout.write(`[${i + 1}/${items.length}] ${slug} = (already set)\n`)
    continue
  }
  process.stdout.write(`[${i + 1}/${items.length}] ${slug}`)
  const r = await fetch(`https://api.webflow.com/v2/collections/${COL}/items/${it.id}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${WF_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ fieldData: { image: { url: OG_URL, alt: OG_ALT, fileId: OG_FILE_ID } } }),
  })
  if (r.ok) { console.log(" ✓"); ok++ }
  else { const d = await r.json(); console.log(` ❌ ${r.status} ${d.message ?? ""}`); fail++ }
}

console.log(`\n=== OG Image patch terminé ===`)
console.log(`  ok      : ${ok}`)
console.log(`  skipped : ${skipped}`)
console.log(`  fail    : ${fail}`)
