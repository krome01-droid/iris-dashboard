# Bascule « vente en ligne → mise en relation » — août 2026

Sur les fiches d'auto-école physique, le **catalogue de formations reste
entièrement visible** — l'élève a besoin de connaître les stages et leurs tarifs.
Ce qui disparaît, c'est uniquement la **réservation et le paiement en ligne** :
le bouton « Réserver » devient « Demander un rappel ». Seules **l'agence centrale
de Melun** et les **points de RDV conduite** conservent le tunnel d'achat.

## La règle

Le backoffice `connect.inris-formations.com` porte déjà la distinction, sur
`GET /api/agencies/get?code=<slug>` :

| `type` | Signification | Vente en ligne |
|---|---|---|
| `agency` | Auto-école physique | **Non** — sauf `auto-ecole-inris-melun-centre` |
| `driving-point` | Point de RDV conduite | Oui |

**Ne pas dériver la liste des agences des sitemaps** : elle en manque. La source
authoritative est le backoffice lui-même —
`GET /api/agencies/get?action=formations` renvoie les **379 codes** (sans le
champ `type`), qu'il faut ensuite interroger un par un pour lire leur `type`.
Répartition réelle au 2026-09-01 : **37 `agency`** (dont Melun) et
**342 `driving-point`**.

Inventaire de référence : `INVENTAIRE_AGENCES_BACKOFFICE.csv` (racine du projet),
qui donne pour chaque code son type, son téléphone, et la page correspondante sur
chacun des deux sites. Les inventaires dérivés des sitemaps
(`INVENTAIRE_FICHES_VENTE-EN-LIGNE.csv`, `INVENTAIRE_FICHES_INRIS-FORMATIONS.csv`,
`FICHES_ORPHELINES_85.csv`) sont **incomplets** — conservés pour l'historique.

## Un seul script pour les deux sites

Les pages centres de `inris-formations.com` (WordPress/Divi, `/centres/<slug>/`)
utilisent **exactement les mêmes identifiants de DOM** que les fiches Webflow
(`#title-agence`, `#traineeshipFilter`, `#gearboxContainer`,
`#traineeshipContainer`) et le même backoffice. Depuis la **v1.1.0**, un seul
fichier sert les deux : il détecte son préfixe (`/points-de-rdv/` ou `/centres/`)
et tolère la barre finale ajoutée par WordPress.

Inventaire WordPress : `INVENTAIRE_FICHES_INRIS-FORMATIONS.csv` — sur 382 fiches
`/centres/`, **31 `agency`** (dont Melun), 313 `driving-point`, 32 orphelines et
**6 records dont le champ `type` est vide** (voir Points ouverts).

### Alias de slugs

Quatre fiches Webflow portent un slug que le backoffice ne connaît pas ; sans
alias elles resteraient en vente en ligne alors que ce sont des agences actives :

| Slug de la fiche | Code backoffice |
|---|---|
| `auto-ecole-inris-ste-marthe` | `auto-ecole-inris-sainte-marthe` |
| `auto-ecole-inris-saint-soupplets` | `auto-ecole-saint-soupplets` |
| `auto-ecole-inris-thorigny-sur-marne` | `auto-ecole-thorigny-sur-marne` |
| `auto-ecole-inris-conflans-sainte-honorine-w8avy` | `auto-ecole-inris-conflans-sainte-honorine` |
| `auto-ecole-inris-boissy-saint-leger` | `auto-ecole-inri-s-boissy-saint-leger` |
| `auto-ecole-inris-rognac` | `auto-ecole-inri-s-rognac` |
| `auto-ecole-inris-villemomble` | `inris-point-conduite-villemomble` |

La carte embarquée compte **39 slugs de page** et **7 alias**, pour 36 agences à
basculer. Une entrée absente d'un site y est simplement sans effet.

## Côté autoecole-inris.com — script hébergé `inrisaeicontactagency`

- **Source** : `iris-dashboard/webflow-scripts/inris-aei-contact-agency.src.js`
  (les marqueurs `__AGENCIES_MAP__` et `__ALIASES_MAP__` sont remplacés au build
  par `agences-physiques.json` et `alias-slugs.json`).
- **Build livré** : `inris-aei-contact-agency-1-3-0.js`.
- **Emplacement** : `header` du site — et non footer, pour masquer le bloc de
  stages **avant le premier rendu** (pas de clignotement).
- **Idempotence** : `window.__inrisAeiContactAgencyV1`.

Ce qu'il fait sur une fiche d'auto-école physique — **le catalogue n'est jamais
masqué** :

1. remplace chaque bouton `.btn-reserve` par un bouton « Demander un rappel »
   (`.aei-btn-rappel`) portant le nom et le prix du stage ;
2. masque la seule mention d'achat en ligne (« Réserver en ligne en payant 10 % »,
   repérée par son texte et marquée `.aei-pay-hint`) et le badge
   « Paiement en 3× sans frais » ;
3. insère une note explicative sous `#title-agence` ;
4. insère un bloc `#aei-contact` juste après `#traineeshipContainer` :
   téléphone de l'agence en appel direct, plus un formulaire de demande de rappel.

Un clic sur « Demander un rappel » fait défiler jusqu'au formulaire et
pré-remplit le champ message avec la formation concernée.

**Le bouton d'origine est remplacé, pas masqué** : le modal de réservation écoute
`.btn-reserve` en délégation, donc retirer le nœud et la classe suffit à le
neutraliser. Un `MutationObserver` sur `#traineeshipContainer` ré-applique le
remplacement après chaque re-rendu du catalogue (filtres, recherche).

Titres, filtres, prix, descriptions, badges et encarts `inrisaeimelunhero`
restent intacts.

### Deux voies de décision, volontairement redondantes

La carte des 36 slugs est **embarquée dans le script**. C'est elle qui décide, sans
attendre le réseau : pas de clignotement, et la bascule tient même si le backoffice
est injoignable. Un second contrôle asynchrone interroge `/api/agencies/get` et
rattrape toute agence créée après la génération du build (et complète le titre avec
le nom réel de l'agence).

### Identifiant = le code backoffice, pas l'URL

Le backoffice ne résout **ni** `https://autoecole-inris.com/...` (sans `www`)
**ni** `https://inris-formation.webflow.io/...`. Le script envoie donc le code nu
(`auto-ecole-inris-colombes`), qui fonctionne partout. Note : l'embed de
réservation, lui, envoie toujours `location.href` — les visiteurs arrivant sur le
domaine apex n'ont donc pas de stages du tout. Bug préexistant, hors périmètre.

### Mettre à jour le script

Régénérer le build, uploader un nouvel asset, puis
`update_registered_script` en **gardant la version 1.0.0** (ne changer que
`hosted_location` et `integrity_hash`) et republier. Passer une version SemVer
inexistante renvoie un 404.

| Version fichier | Asset | SRI |
|---|---|---|
| 1.3.0 (courant — +3 agences manquantes) | `…/6a9601021cb507a2ff537bf3_inris-aei-contact-agency-1-3-0.js` | `sha384-yX4vsksv587ZDVq4czsVQ42mdjKbJkXj3YdfWP8S/SyOI0uO/Yg4CsoQpQPWyFt3` |
| 1.2.0 (catalogue conservé) | `…/6a95f6a6a846093e5cb30c05_inris-aei-contact-agency-1-2-0.js` | `sha384-HJbMuUBq/QORZg8vDgB/OdO3Dd8wYpYA7UWuPCbv7CwIPi7REfVO0ArqHkJJTET7` |
| 1.1.0 (multi-sites, masquait le catalogue) | `…/6a95f2270cc2aaf48d153097_inris-aei-contact-agency-1-1-0.js` | `sha384-X1XRpEgg89V5/29pPBF79D0ZlDAUL02rIHpw2c6VvR2/Qn7tqlNU0iwssg/Ina7/` |
| 1.0.2 (Webflow seul, masquait le catalogue) | `…/6a9544aa650e7ddb0df80d0f_inris-aei-contact-agency-1-0-2.js` | `sha384-S/FqIB4CJkc59rIwY9xdiSSlpIXcvrJ6/JSKyx1JsKaAIsz7v6b/EyWlgRd5ML6B` |

**Rollback** : `remove_site_script` sur `inrisaeicontactagency`, puis republier.

## Côté inris-formations.com — snippet WPCode

WordPress n'a pas de staging. Le déploiement passe par **WPCode Lite** (déjà
actif, ex-« Insert Headers and Footers ») : snippet **#58385**,
`site_wide_header`, contenu inline (pas de dépendance au CDN Webflow, et le
snippet survit aux mises à jour du thème Divi).

Le snippet est écrit **désactivé** par WPVibe — l'activation passe obligatoirement
par wp-admin (WPVibe ne peut pas activer un snippet) :
`https://inris-formations.com/wp-admin/admin.php?page=wpcode-snippet-manager&snippet_id=58385`
**Activé le 2026-09-01**, vérifié en production.

Après activation, purger le cache (WP-Optimize est actif).
**Rollback** : désactiver le snippet dans WPCode.

Mise à jour du contenu : `code_snippet` avec `action:"update"` et `id:58385`.
Un snippet `html` conserve son état on/off lors d'une mise à jour.

## Côté serveur — `POST /api/public/rappel`

Fichier : `src/app/api/public/rappel/route.ts`. Route publique (ajoutée à la
liste blanche du `middleware.ts`), appelée par le formulaire.

- Le destinataire est **résolu côté serveur** depuis le backoffice : le client
  n'a aucun moyen de choisir à qui le mail part.
- Garde-fous : liste blanche d'origines CORS, honeypot `website`, limite de
  5 envois par IP sur 10 minutes, validation nom/téléphone/e-mail/longueur.
- Envoi par Resend (`src/lib/resend/client.ts`, qui accepte désormais `bcc`),
  avec `reply_to` sur l'e-mail du prospect quand il est fourni.

Variables d'environnement (voir `.env.example`) :

| Clé | Rôle |
|---|---|
| `RESEND_API_KEY` | **déjà renseignée en production** (gestionnaire Docker Hostinger) ; absente de `.env.local`, qui ne sert qu'au dev local |
| `RESEND_RAPPEL_FROM` | expéditeur ; défaut `RESEND_FROM_EMAIL` |
| `IRIS_RAPPEL_BCC` | copie cachée facultative vers le siège |
| `IRIS_RAPPEL_FALLBACK_EMAIL` | repli si l'agence n'a pas d'e-mail |
| `INRIS_BOOKING_API` | défaut `https://connect.inris-formations.com` |

L'URL appelée par le script est
`https://agent.autoecole-inris.com/admin-iris/api/public/rappel`
(le `basePath` `/admin-iris` vient de `next.config.ts`).

**Le dashboard tourne** (`/admin-iris/api/auth/session` répond 200 ; conteneurs
`iris-dashboard`, `iris-cron` et `traefik` en Running sur le VPS Hostinger). Ne
pas conclure d'un 404 sur `/` que le service est down : l'app vit sous son
basePath.

En revanche la route **n'est pas encore dans l'image déployée** : un appel à
`/admin-iris/api/public/rappel` est redirigé (307) vers `/admin-iris/login`,
comportement du middleware de l'ancien build. Le déploiement passe par
`.github/workflows/deploy.yml` — un push sur `main` construit l'image sur GHCR,
que le VPS récupère. Tant que ce push n'est pas fait, le formulaire affiche un
message d'erreur qui renvoie vers le téléphone de l'agence : le visiteur n'est
jamais dans une impasse.

Les variables d'environnement de production ne sont **ni dans le dépôt ni dans un
`.env` du serveur** : elles se saisissent dans hPanel → Gestionnaire Docker →
variables d'environnement du conteneur `iris-dashboard`.

## Question laissée ouverte

Le lien CPF « Voir le stage » des cartes pointe vers `moncompteformation.gouv.fr`.
Ce n'est pas une vente en ligne INRI'S mais bien un parcours d'inscription. Il a
été **conservé** ; à trancher si le retrait est souhaité.

## Liens cassés sur les pages liste (2026-09-01)

Les pages liste (`/centres/` et `/points-de-rdv`) construisent leurs liens à
partir du backoffice, dont certains codes ne correspondent à aucune page :
**31 liens cassés sur inris-formations.com** (sur 379) et **3 sur
autoecole-inris.com** (sur 358). Les URLs des deux sitemaps, elles, répondent
toutes — le problème est donc uniquement dans les liens, pas dans les pages.

Détail et cible de redirection proposée : `LIENS_CASSES_FICHES.csv`.
27 des 34 ont une page équivalente (redirection 301 possible) ; 7 n'en ont
aucune, dont **`auto-ecole-inris-franconville` et
`auto-ecole-inris-metro-front-populaire`, deux auto-écoles sans page WordPress**.

La bonne correction est en amont : aligner les `code` du backoffice sur les slugs
des pages.

## Points ouverts

- ~~`dev.inris-formations.com` répond 502~~ — **corrigé le 2026-08-31** : la prod
  d'autoecole-inris.com appelle désormais `connect.inris-formations.com`, plus
  aucune référence à `dev.` dans la page.
- **Boulogne** est enregistrée avec l'e-mail `boulogne@autoecole.com` — le
  `-inris` manque. Les demandes de rappel partiraient dans le vide.
- **6 fiches WordPress ont un `type` vide** au backoffice : `auto-ecole-inris-aix-jourdan`,
  `-fresnes`, `-nice-saint-roch`, `-saint-denis`, `-saint-hilaire-de-riez`, `-sceaux`.
  Faute de qualification fiable, le script **ne les touche pas** — elles gardent la
  vente en ligne. À trancher au backoffice (l'une s'appelle « POINT CONDUITE SAINT-DENIS »).
- **Thorigny-sur-Marne n'a pas de téléphone** au backoffice : sa fiche affiche le
  formulaire sans le bouton d'appel. À compléter.
- Les slugs divergents (tableau des alias) gagneraient à être **alignés** entre le
  CMS Webflow et le backoffice ; les alias sont un pansement, pas une correction.

## État au 2026-08-31

- **autoecole-inris.com** : **1.3.0 en production depuis le 2026-09-01**, sur les
  deux domaines (l'apex redirige en 301 vers `www`). Vérifié : Rognac,
  Boissy-Saint-Léger et Villemomble basculées avec leur téléphone, catalogue et
  prix intacts, 0 « Réserver » ; Antony et Melun inchangés. La 1.2.0, publiée un
  peu plus tôt le même jour, couvrait 36 agences sur 39 slugs.
  Historique : le script était arrivé en prod dès le 2026-08-31 à 11 h 23 UTC via
  une publication faite par un tiers, en 1.0.2 — la version qui masquait le
  catalogue.
- **inris-formations.com** : snippet WPCode #58385 **actif en production depuis le
  2026-09-01** et vérifié (Colombes bascule, Vincennes et Melun inchangés).
  ⚠️ Il tourne encore en **1.2.0** : Boissy-Saint-Léger et Rognac y vendent donc
  toujours en ligne tant que la mise à jour vers la 1.3.0 n'est pas approuvée.
