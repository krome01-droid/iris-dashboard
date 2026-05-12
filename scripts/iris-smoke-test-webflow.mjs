#!/usr/bin/env node
// Smoke test — création d'un draft dans "Permis blogs" via Webflow Data API v2.
// Standalone (Node 18+ fetch natif, aucune dépendance npm).
//
// Usage :
//   WF_API_KEY=xxx node scripts/iris-smoke-test-webflow.mjs
// Ou avec .env.local (lecture manuelle ci-dessous) :
//   node scripts/iris-smoke-test-webflow.mjs
//
// Le draft est créé avec isDraft=true → INVISIBLE sur le site live.
// À supprimer manuellement dans le CMS Webflow après vérif.

import { readFileSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))

// Lecture .env.local si présent (override par variables d'env existantes)
try {
  const envPath = join(__dirname, "..", ".env.local")
  const raw = readFileSync(envPath, "utf8")
  for (const line of raw.split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim()
  }
} catch {
  /* pas de .env.local, on continue avec env système */
}

const TOKEN = process.env.WF_API_KEY
const BLOG_COL = process.env.WF_COLLECTION_ID_PERMIS_BLOGS ?? "67c976212edb4724b8839729"

if (!TOKEN) {
  console.error("❌ WF_API_KEY manquant (ni env, ni .env.local)")
  process.exit(1)
}

const slug = `iris-smoke-test-${Date.now()}`
const body = {
  isArchived: false,
  isDraft: true,
  fieldData: {
    name: `[SMOKE TEST IRIS] ${new Date().toISOString()}`,
    slug,
    "blog-post-summary":
      "Article smoke-test généré par Iris pour valider l'intégration Webflow Data API. À supprimer.",
    "blog-post-richt-text":
      "<h2>Smoke test</h2><p>Si vous lisez ceci, l'intégration Iris ↔ Webflow CMS fonctionne. Cet item est en mode draft (isDraft=true) et n'est pas visible sur le site public. À supprimer.</p>",
  },
}

console.log("→ POST", `https://api.webflow.com/v2/collections/${BLOG_COL}/items`)
console.log("→ slug:", slug)

const res = await fetch(
  `https://api.webflow.com/v2/collections/${BLOG_COL}/items`,
  {
    method: "POST",
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  },
)

const data = await res.json()
console.log("← HTTP", res.status)

if (!res.ok) {
  console.error("❌ Échec :", JSON.stringify(data, null, 2))
  process.exit(2)
}

console.log("✅ Draft créé.")
console.log("   ID       :", data.id)
console.log("   isDraft  :", data.isDraft)
console.log("   createdOn:", data.createdOn)
console.log("\n⚠️  À supprimer manuellement dans le CMS Webflow :")
console.log("   webflow.com → Inris Formation → CMS → Permis blogs → cet item")
