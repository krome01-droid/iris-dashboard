# Webflow — Snapshot discovery 2026-05-11

**Site** : Inris Formation
**Site ID** : `67c976202edb4724b88395f9`
**Slug** : `inris-formation`
**User token** : al@inris-formations.com

## Collections (7)

| Collection | ID | Slug URL | Items | Usage Iris |
|---|---|---|---|---|
| Permis blogs | `67c976212edb4724b8839729` | `permis` | 139 | **Iris Content** — articles permis |
| Code blogs | `67f3cadace1bbcd2670c8e4e` | `code` | 312 | **Iris Content** — articles code de la route |
| Points de RDVs | `67ebdb2c5b536cee781ef623` | `points-de-rdv` | **413** | **Iris SEO Local** — enrichir `texte-seo` |
| Lexiques | `67d3e470b6482baaa37000f0` | `lexique` | 20 | **Iris Content** — expansion glossaire |
| Products | `67c976212edb4724b8839753` | `product` | ? | lecture seule (e-commerce) |
| SKUs | `67c976212edb4724b8839703` | `sku` | ? | lecture seule (e-commerce) |
| Categories | `67c976212edb4724b8839773` | `category` | ? | lecture seule |

> **Note** : 413 centres en CMS vs 253 dans sitemap.xml → ~160 items sont draft, archivés ou avec slug non public. À explorer avec `?isDraft=true` côté API si pertinent.

## Schémas — champs des Collections clés

### Permis blogs (`67c976212edb4724b8839729`)

```
name                                  PlainText  [REQ]   Blog Post - Title
slug                                  PlainText  [REQ]   Blog Post - Link
blog-post-featured-image-photo        Image              Blog Post - Thumbnail V1
blog-post-thumbnail-image-illustration Image             Blog Post - Featured Image
blog-post-excerpt                     PlainText          Blog Post - Excerpt V1
blog-post-excerpt-v2                  PlainText          Blog Post - Excerpt V2
blog-post-summary                     PlainText          Blog Post - Summary
blog-post-richt-text                  RichText           Blog Post - Richt Text  ← corps de l'article
blog-post-is-featured                 Switch             Blog Post - Is Featured?
```

### Code blogs (`67f3cadace1bbcd2670c8e4e`)

```
name                                  PlainText  [REQ]   Blog Post - Title
slug                                  PlainText  [REQ]   Blog Post - Link
blog-post-thumbnail-image-illustration Image             Blog Post - Featured Image
blog-post-summary                     PlainText          Blog Post - Summary
blog-post-richt-text                  RichText           Blog Post - Richt Text
blog-post-is-featured                 Switch             Blog Post - Is Featured?
```

### Points de RDVs (`67ebdb2c5b536cee781ef623`) — **clé pour SEO Local**

```
name                          PlainText  [REQ]   Name      (ex: "AUTO-ÉCOLE INRI'S CONFLANS-SAINTE-HONORINE")
slug                          PlainText  [REQ]   Slug
adresse                       PlainText          Adresse
code-postal                   PlainText          Code Postal
telephone                     Phone              Téléphone
horaires-d-ouverture-text     RichText           Horaires d'ouverture
formations-proposees-text     RichText           Formations proposées
horaires-de-conduite-text     RichText           Horaires de conduite
image                         Image              Image
show-preview                  Switch             Section qualiopi visible ?
qualiopi                      RichText           ÉTABLISSEMENT LABEL QUALITÉ ET QUALIOPI
qualiopi-processus-certifie   Link               QUALIOPI PROCESSUS CERTIFIE
ecole-conduite-qualite        Link               ECOLE CONDUITE QUALITE
texte-seo                     RichText           ← Iris SEO Local écrit ICI
```

### Lexiques (`67d3e470b6482baaa37000f0`)

```
name                          PlainText  [REQ]   Terme
slug                          PlainText  [REQ]   Lien URL
team-member-excerpt           PlainText  [REQ]   H1
team-member-excerpt-long      PlainText  [REQ]   Définition
```

## Impact PRD

1. **Iris SEO Local** : pas besoin de créer une nouvelle Collection. On enrichit le champ `texte-seo` (RichText) des 413 items existants de **Points de RDVs**. Ça simplifie radicalement vs le clonage de templates Divi prévu en v1.0.

2. **Iris Content** : deux blogs distincts à servir (Permis 139 / Code 312). Le routing par sujet (permis vs code de la route) doit être explicite dans le briefing.

3. **Centres** = 413 (pas 380 estimés, pas 253 du sitemap). Le KPI nord-étoile "pages SEO locales en pos ≤ 20" doit être recalculé sur cette base.

4. **Pas de Webflow Collection "Auteur"** détectée → Iris publie sans auteur explicite.

5. **Pas de champ "meta description"** sur les blogs → soit le SEO meta est géré dans Webflow Designer au niveau page (pas accessible via Data API CMS), soit il faut passer par l'API Pages (`pages:write`).
