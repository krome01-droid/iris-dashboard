# Webflow — Config Iris v1.1

**Site cible** : https://www.autoecole-inris.com — **Webflow**, pas WordPress.

## Stack confirmée par scan HTML (2026-05-11)

- `<!-- This site was created in Webflow. https://webflow.com -->`
- `data-wf-site="67c976202edb4724b88395f9"` → `WF_SITE_ID`
- `data-wf-page="67c976212edb4724b883978e"` (page d'accueil)
- CDN : `cdn.prod.website-files.com/67c976202edb4724b88395f9/...`
- Sitemap : `https://www.autoecole-inris.com/sitemap.xml` (766 URLs, 253 centres `/points-de-rdv/[slug]`)

## Token API

Le token initial fourni (`ws-2076...`) a été testé contre `/v2/token/authorized_by`, `/v2/sites`, `/v2/sites/{id}` → **HTTP 403 OAuthForbidden: missing scopes**.

### Scopes requis pour Iris V0/V1

À cocher dans webflow.com → Site Settings → Apps & Integrations → API access → Generate API Token :

| Scope | Usage Iris |
|---|---|
| `sites:read` | métadonnées site, publish status |
| `pages:read` | lister pages statiques |
| `pages:write` | éditer SEO meta des pages (titre, description) |
| `cms:read` | lire collections (blog, centres) |
| `cms:write` | créer/màj items en mode `isDraft: true` |
| `assets:read` | lister assets |
| `assets:write` | uploader nouveaux assets (images générées) |
| `authorized_user:read` | (optionnel) info sur le user qui a généré le token |

→ **Régénérer le token avec ces scopes**, le mettre dans `.env.local` sous `WF_API_KEY=`.

## Modules à modifier dans le fork

| Module Iris (PRD) | Implémentation Webflow |
|---|---|
| Iris Content (articles) | `createItem(blogCollectionId, fields, isDraft=true)` via `src/lib/webflow/client.ts` |
| Iris SEO Local (pages villes) | Collection CMS "SEO local" à créer dans Webflow Designer, puis `createItem` |
| Iris Newsletter | Pas de dépendance Webflow — utilise Resend/GHL directement |
| Iris Brand Guard | Scan d'images via assets API (`assets:read`) |
| Iris Analytics | GA4 + GSC (indépendant de Webflow) |
| Locks "page non touchable" | Pas de post_meta WP. Stocker en Supabase `iris_locks_cache` (key = Webflow item_id) |
| Webhook backups | Pas d'UpdraftPlus. Snapshot via `cms/items` GET → archive S3/Supabase Storage |

## Modules WP existants dans le fork (dormants)

Les répertoires suivants viennent de lou-dashboard (WordPress) et restent en place mais **ne seront pas chargés** tant que les env vars `WP_*` / `MYSQL_*` ne sont pas renseignées :

- `src/lib/wordpress/client.ts`
- `src/app/api/wordpress/{posts,media,publish}/`
- `deploy/iris-db-proxy.php`, `deploy/iris-ga4-tag.php`
- `src/lib/db/connection.ts` (MySQL proxy)

Si INRI'S a un WP secondaire à connecter plus tard, ces modules pourront être réactivés. Sinon, à supprimer en Phase 2 (cleanup).

## Discovery API — fait le 2026-05-11

Snapshot complet : voir [`webflow-discovery-2026-05-11.md`](./webflow-discovery-2026-05-11.md).

Résumé :
- **7 Collections** au total ; **3 critiques** pour Iris (Permis blogs 139, Code blogs 312, Points de RDVs 413).
- Points de RDVs a déjà un champ `texte-seo` (RichText) → Iris SEO Local enrichit l'existant, pas besoin de nouvelle Collection.
- IDs Collections injectés dans `.env.example` sous `WF_COLLECTION_ID_*`.

Pour re-snapshotter après modif structure Webflow :

```bash
TOKEN="$WF_API_KEY"
SITE_ID="$WF_SITE_ID"
curl -s -H "Authorization: Bearer $TOKEN" \
  "https://api.webflow.com/v2/sites/$SITE_ID/collections" | jq
curl -s -H "Authorization: Bearer $TOKEN" \
  "https://api.webflow.com/v2/collections/$WF_COLLECTION_ID_POINTS_DE_RDV" | jq
```
