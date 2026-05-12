#!/usr/bin/env node
// Iris Batch SEO — Génère + push tous les centres publiés (ou un sous-ensemble).
//
// Pipeline par centre :
//   1. node scripts/iris-seo-local-test.mjs <slug>   → /tmp/iris-seo-<slug>.json
//   2. node scripts/iris-webflow-write.mjs <slug>    → PATCH Webflow (item)
//
// Pas de publish auto à la fin (l'user le déclenche après validation staging).
//
// Usage :
//   node scripts/iris-batch-seo.mjs --limit 10            # dry-run (10 premiers non traités)
//   node scripts/iris-batch-seo.mjs --limit 10 --skip-existing  # skip ceux dont le JSON SEO existe
//   node scripts/iris-batch-seo.mjs --all                 # tous (~249)
//   node scripts/iris-batch-seo.mjs --slugs a,b,c         # liste explicite

import { readFileSync, existsSync, writeFileSync, mkdirSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { spawn } from "node:child_process"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..")

try {
  const raw = readFileSync(join(ROOT, ".env.local"), "utf8")
  for (const line of raw.split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim()
  }
} catch {}

const WF_API_KEY = process.env.WF_API_KEY
const COL_RDV = process.env.WF_COLLECTION_ID_POINTS_DE_RDV ?? "67ebdb2c5b536cee781ef623"

const argv = process.argv.slice(2)
const flag = (name) => argv.includes(name)
const optVal = (name) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : null }
const limit = parseInt(optVal("--limit") ?? "0", 10)
const all = flag("--all")
const skipExisting = flag("--skip-existing")
const explicitSlugs = optVal("--slugs")?.split(",").filter(Boolean)

async function fetchAllPublished() {
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
  return out.filter(c => !c.isDraft && !c.isArchived)
}

function run(cmd, args) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { cwd: ROOT, env: process.env })
    let stdout = "", stderr = ""
    child.stdout.on("data", (d) => { stdout += d.toString() })
    child.stderr.on("data", (d) => { stderr += d.toString() })
    child.on("close", (code) => resolve({ code, stdout, stderr }))
  })
}

console.log("→ Fetching Webflow centres…")
const allCentres = await fetchAllPublished()
console.log(`✓ ${allCentres.length} centres publiés`)

let slugs
if (explicitSlugs?.length) {
  slugs = explicitSlugs
} else {
  slugs = allCentres.map(c => c.fieldData?.slug).filter(Boolean)
  if (skipExisting) {
    slugs = slugs.filter(s => !existsSync(`/tmp/iris-seo-${s}.json`))
  }
}

if (limit && limit > 0) slugs = slugs.slice(0, limit)
if (!all && !limit && !explicitSlugs) {
  console.error("❌ Pas de mode : utilise --limit N ou --all ou --slugs a,b,c")
  process.exit(1)
}

console.log(`\n→ ${slugs.length} centres à traiter\n`)

const logDir = join(ROOT, "data", "batch-logs")
if (!existsSync(logDir)) mkdirSync(logDir, { recursive: true })
const runId = new Date().toISOString().replace(/[:.]/g, "-")
const reportPath = join(logDir, `batch-${runId}.json`)
const report = { startedAt: new Date().toISOString(), slugs: [], stats: { ok: 0, seoFail: 0, writeFail: 0 } }

for (let i = 0; i < slugs.length; i++) {
  const slug = slugs[i]
  const t0 = Date.now()
  process.stdout.write(`[${i + 1}/${slugs.length}] ${slug}\n`)

  // 1. SEO generation (Claude)
  process.stdout.write(`  → claude…`)
  const seoRes = await run("node", ["scripts/iris-seo-local-test.mjs", slug])
  if (seoRes.code !== 0 || !existsSync(`/tmp/iris-seo-${slug}.json`)) {
    console.log(` ❌ SEO failed (code=${seoRes.code})`)
    const tail = seoRes.stderr.split("\n").slice(-5).join(" | ")
    console.log(`    stderr: ${tail.slice(0, 300)}`)
    report.slugs.push({ slug, ok: false, stage: "seo", durationMs: Date.now() - t0, errTail: tail.slice(0, 500) })
    report.stats.seoFail++
    continue
  }
  process.stdout.write(` ✓`)

  // 2. Push Webflow
  process.stdout.write(`  → push…`)
  const writeRes = await run("node", ["scripts/iris-webflow-write.mjs", slug])
  if (writeRes.code !== 0) {
    console.log(` ❌ WRITE failed (code=${writeRes.code})`)
    const tail = writeRes.stderr.split("\n").slice(-5).join(" | ")
    console.log(`    stderr: ${tail.slice(0, 300)}`)
    report.slugs.push({ slug, ok: false, stage: "write", durationMs: Date.now() - t0, errTail: tail.slice(0, 500) })
    report.stats.writeFail++
    continue
  }
  console.log(` ✓  (${Math.round((Date.now() - t0) / 1000)}s)`)
  report.slugs.push({ slug, ok: true, durationMs: Date.now() - t0 })
  report.stats.ok++

  // Persist after each (resilience)
  writeFileSync(reportPath, JSON.stringify(report, null, 2))
}

report.finishedAt = new Date().toISOString()
writeFileSync(reportPath, JSON.stringify(report, null, 2))

console.log(`\n=== Batch terminé ===`)
console.log(`  ok          : ${report.stats.ok}`)
console.log(`  SEO failed  : ${report.stats.seoFail}`)
console.log(`  write failed: ${report.stats.writeFail}`)
console.log(`  rapport     : ${reportPath}`)
console.log(`\nÉtape suivante : valider sur staging puis publish (curl POST publish avec customDomains).`)
