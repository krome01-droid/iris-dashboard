#!/usr/bin/env node
// Iris Batch Rewrite — re-push tous les centres dont le payload SEO existe déjà.
// Skip l'étape Claude (réutilise /tmp/iris-seo-<slug>.json), utile pour propager
// un changement de décorateur (CSS, nouveau bloc CTA, etc.) sans recoûter de tokens.
//
// Usage : node scripts/iris-batch-rewrite.mjs [--exclude slug1,slug2]

import { readdirSync, writeFileSync, mkdirSync, existsSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { spawn } from "node:child_process"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..")

const argv = process.argv.slice(2)
const optVal = (n) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : null }
const excludeSet = new Set((optVal("--exclude") ?? "").split(",").filter(Boolean))

const slugs = readdirSync("/tmp")
  .filter(f => f.startsWith("iris-seo-") && f.endsWith(".json"))
  .map(f => f.replace(/^iris-seo-/, "").replace(/\.json$/, ""))
  .filter(s => !excludeSet.has(s))

console.log(`→ ${slugs.length} slugs à re-pusher (payload cached, no Claude)\n`)

function run(cmd, args) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { cwd: ROOT, env: process.env })
    let stdout = "", stderr = ""
    child.stdout.on("data", d => stdout += d.toString())
    child.stderr.on("data", d => stderr += d.toString())
    child.on("close", code => resolve({ code, stdout, stderr }))
  })
}

const logDir = join(ROOT, "data", "batch-logs")
if (!existsSync(logDir)) mkdirSync(logDir, { recursive: true })
const runId = new Date().toISOString().replace(/[:.]/g, "-")
const reportPath = join(logDir, `rewrite-${runId}.json`)
const report = { startedAt: new Date().toISOString(), slugs: [], stats: { ok: 0, fail: 0 } }

for (let i = 0; i < slugs.length; i++) {
  const slug = slugs[i]
  const t0 = Date.now()
  process.stdout.write(`[${i + 1}/${slugs.length}] ${slug}`)
  const r = await run("node", ["scripts/iris-webflow-write.mjs", slug])
  if (r.code !== 0) {
    const tail = r.stderr.split("\n").slice(-3).join(" | ").slice(0, 300)
    console.log(` ❌ (code=${r.code}) ${tail}`)
    report.slugs.push({ slug, ok: false, durationMs: Date.now() - t0, errTail: tail })
    report.stats.fail++
  } else {
    console.log(` ✓ (${Math.round((Date.now() - t0) / 1000)}s)`)
    report.slugs.push({ slug, ok: true, durationMs: Date.now() - t0 })
    report.stats.ok++
  }
  writeFileSync(reportPath, JSON.stringify(report, null, 2))
}

report.finishedAt = new Date().toISOString()
writeFileSync(reportPath, JSON.stringify(report, null, 2))
console.log(`\n=== Rewrite terminé ===`)
console.log(`  ok   : ${report.stats.ok}`)
console.log(`  fail : ${report.stats.fail}`)
console.log(`  log  : ${reportPath}`)
