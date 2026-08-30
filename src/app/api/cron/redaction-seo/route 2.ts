import { createArticle, titresExistants } from "@/lib/webflow/client"
import {
  requestArticle,
  requestImage,
  attendreImage,
  fetchCatalogue,
  formatArticle,
  isCromeConfigured,
  type ArticleRedige,
} from "@/lib/crome/client"
import { getTopKeywords } from "@/lib/google/search-console"

// Rédaction d'un article SEO/GEO, puis dépôt sur autoecole-inris.com.
//
// IRIS était la SEULE des cinq marques sans rédaction (constaté le 30/08/2026) :
// elle avait un `seo-report`, un `seo-positions` et une newsletter — laquelle
// sortait chaque lundi par « aucun article cette semaine », faute d'articles à
// résumer. Le blog Webflow ne recevait donc rien, et la newsletter n'a jamais
// eu de matière. Cette tâche produit ce que les deux autres attendent.
//
// La séparation des rôles est celle des quatre autres marques : CROME OS rédige
// (règles SEO/GEO, profil éditorial de la marque, clé Anthropic) et rend un
// verdict ; IRIS dépose dans Webflow avec ses propres identifiants. Le hub n'a
// aucun accès au site, et le site ne connaît aucune règle éditoriale.
//
// ── Ce qu'IRIS ne fait PAS ───────────────────────────────────────────────────
// Elle ne relaie rien sur les réseaux. `social-auto` est désactivée depuis le
// 04/08/2026 parce qu'autoecole-inris.com n'a aucune page sociale active —
// revérifié dans `postiz_integrations` le 30/08 : Instagram et LinkedIn y sont
// tous deux `active = false`. Le social de l'enseigne est porté par ANGÈLE.
// Les articles écrits ici servent le site, le référencement et la newsletter.
//
// ── La publication directe, et sa seule exception ────────────────────────────
// Les articles partent publiés. Une file de validation que personne n'ouvre
// équivaut à ne rien publier. Mais un article reste indexé des mois, et une
// auto-école qui annonce un tarif, un délai d'examen ou une éligibilité engage
// autre chose qu'une coquille. Le hub retient donc l'article — et lui seul —
// quand le rédacteur a signalé une affirmation « bloquante » ou trop de points
// mineurs. L'alerte part du hub, par Telegram.

/** Longueur visée. En deçà, un article se fait mal citer ; au-delà, il se dilue. */
const LONGUEUR = 1300

/**
 * La zone où un mot-clé mérite un article : le site apparaît déjà dessus mais
 * hors des trois premiers résultats. Écrire sur une requête où l'on est 15e
 * rapporte davantage qu'inventer un sujet sur lequel on n'existe pas — et
 * au-delà de la 40e place, la requête n'est en général pas dans notre thème.
 */
const POSITION_MIN = 6
const POSITION_MAX = 40
/** En dessous, l'échantillon est trop petit pour dire quoi que ce soit. */
const IMPRESSIONS_MIN = 25

function echapper(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
}

/**
 * Assemble le HTML déposé dans le champ Rich Text de Webflow.
 *
 * L'ordre n'est pas cosmétique : la réponse directe est en tête parce que c'est
 * le passage qu'un moteur de réponse lèvera tel quel. Placée après le chapô,
 * elle perdrait cette fonction.
 *
 * `corps_html` est du HTML voulu comme tel ; tout le reste vient du modèle en
 * texte brut et est échappé.
 *
 * PAS de JSON-LD ici, contrairement à WordPress : Webflow nettoie les balises
 * `<script>` d'un champ Rich Text. Les données structurées doivent venir du
 * gabarit de la page — même limite que chez STAN, pour une autre raison.
 */
function assembler(a: ArticleRedige): string {
  const morceaux: string[] = [
    `<p><strong>${echapper(a.reponse_directe)}</strong></p>`,
    `<p>${echapper(a.chapo)}</p>`,
    a.corps_html,
  ]

  if (a.points_cles?.length) {
    morceaux.push(
      "<h2>À retenir</h2>",
      `<ul>${a.points_cles.map((p) => `<li>${echapper(p)}</li>`).join("")}</ul>`,
    )
  }

  if (a.faq?.length) {
    morceaux.push("<h2>Questions fréquentes</h2>")
    for (const q of a.faq) {
      morceaux.push(`<h3>${echapper(q.question)}</h3>`, `<p>${echapper(q.reponse)}</p>`)
    }
  }

  return morceaux.join("\n\n")
}

/**
 * Choisit le mot-clé à viser à partir de la Search Console : une requête sur
 * laquelle le site apparaît déjà, hors du podium, et qu'aucun article existant
 * ne traite frontalement.
 *
 * Injoignable ou vide, on rend `null` et le moteur choisira lui-même son angle.
 * Ce n'est pas un échec : c'est la version dégradée acceptable.
 */
async function choisirMotCle(
  titres: string[],
): Promise<{ motCle: string | null; diagnostic: string }> {
  let mots: Awaited<ReturnType<typeof getTopKeywords>>
  try {
    mots = await getTopKeywords(200)
  } catch (e) {
    const raison = e instanceof Error ? e.message.slice(0, 200) : "injoignable"
    console.warn("[cron/redaction-seo] Search Console indisponible:", raison)
    return { motCle: null, diagnostic: `Search Console injoignable : ${raison}` }
  }

  const normalises = titres.map((t) => t.toLowerCase())
  const retenus = mots.filter(
    (m) =>
      m.position >= POSITION_MIN &&
      m.position <= POSITION_MAX &&
      m.impressions >= IMPRESSIONS_MIN &&
      // Une requête de marque ne se travaille pas par un article.
      !/inri'?s/i.test(m.keyword) &&
      !normalises.some((t) => t.includes(m.keyword.toLowerCase())),
  )
  // Le plus d'impressions d'abord : c'est la demande réelle, pas la position.
  const candidat = [...retenus].sort((a, b) => b.impressions - a.impressions)[0]

  if (!candidat) {
    return {
      motCle: null,
      diagnostic: `${mots.length} requêtes remontées, aucune entre la ${POSITION_MIN}e et la ${POSITION_MAX}e place avec ${IMPRESSIONS_MIN}+ impressions et non déjà traitée.`,
    }
  }
  return {
    motCle: candidat.keyword,
    diagnostic: `${retenus.length} requêtes éligibles sur ${mots.length} ; retenue : position ${candidat.position}, ${candidat.impressions} impressions.`,
  }
}

export async function GET(req: Request) {
  if (req.headers.get("Authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const params = new URL(req.url).searchParams
  // `?dry_run=1` : tout se déroule, rien n'est déposé dans Webflow. C'est
  // l'outil de vérification, jamais un réglage du cron.
  const dryRun = params.get("dry_run") === "1"
  const sujet = params.get("sujet") ?? undefined
  const motCleImpose = params.get("mot_cle") ?? undefined
  const forcerRelecture = params.get("relire") === "1"

  try {
    if (!isCromeConfigured()) {
      return Response.json(
        { status: "error", error: "CROME_INGEST_URL / CROME_INGEST_SECRET absents" },
        { status: 500 },
      )
    }

    // Les titres déjà en ligne servent deux fois : le hub s'en sert pour ne pas
    // réécrire l'existant (deux articles proches se cannibalisent et perdent
    // leur classement TOUS LES DEUX), et le choix du mot-clé pour écarter ce qui
    // est déjà traité. Les BROUILLONS en font partie : un article retenu la
    // veille est invisible d'une liste « publiés seulement », et le sujet
    // repartirait à l'identique le lendemain.
    const titres = await titresExistants().catch(() => [] as string[])

    // Un mot-clé imposé ou un sujet imposé court-circuitent la Search Console :
    // l'opérateur a déjà décidé de l'angle.
    const choix =
      motCleImpose || sujet
        ? { motCle: null, diagnostic: "angle imposé par l'appelant" }
        : await choisirMotCle(titres)
    const motCle = motCleImpose ?? choix.motCle ?? undefined

    // Le catalogue du studio se lit AVANT la rédaction, et son résultat sert
    // deux fois : le rédacteur choisit la scène qui montre ce dont il parle, et
    // l'illustration réclame ensuite un format que la marque possède vraiment.
    const { scenes, formats } = await fetchCatalogue()

    const rendu = await requestArticle({
      sujet,
      mot_cle: motCle,
      titres_existants: titres,
      longueur: LONGUEUR,
      forcer_relecture: forcerRelecture,
      scenes,
    })

    if (rendu.error || !rendu.article || !rendu.publication) {
      console.error("[cron/redaction-seo] rédaction:", rendu.error ?? rendu.reason)
      return Response.json(
        { status: "error", step: "crome_redaction", error: rendu.error ?? rendu.reason },
        { status: 502 },
      )
    }

    const article = rendu.article
    const verdict = rendu.publication
    const statut = verdict.statut_conseille === "publier" ? "publish" : "draft"

    // Le visuel. Non bloquant : un article sans vignette reste un article, et la
    // rédaction a déjà coûté plusieurs minutes de modèle.
    //
    // Webflow héberge l'image à partir de son URL — pas de téléversement en
    // deux temps comme dans la médiathèque WordPress.
    let imageUrl: string | null = null
    let imageErreur: string | undefined
    if (!dryRun) {
      const scene = scenes.some((s) => s.key === article.scene_visuel)
        ? article.scene_visuel
        : undefined
      // 3:2 est le format « Blog/Article » — un 1:1 serait rogné en vignette et
      // un 9:16 illisible en tête d'article. Mais on ne le demande que si la
      // marque l'a : en réclamer un absent fait échouer la génération entière.
      let media = await requestImage(scene, formatArticle(formats))
      // L'attente du studio est bornée à 45 s et le 3:2 la dépasse presque
      // toujours : sans cette reprise, l'image aboutit quelques secondes après
      // qu'on l'ait déclarée perdue, et l'article sort sans vignette.
      if (!media.image_url && media.generation_id && media.status !== "error") {
        media = await attendreImage(media.generation_id)
      }
      if (media.image_url) imageUrl = media.image_url
      else imageErreur = media.error ?? media.reason ?? `studio : ${media.status ?? "sans réponse"}`
      if (imageErreur) console.warn("[cron/redaction-seo] pas de vignette:", imageErreur)
    }

    const contenu = assembler(article)

    if (dryRun) {
      return Response.json({
        status: "ok",
        dry_run: true,
        publie: false,
        titre: article.titre,
        slug: article.slug,
        mot_cle: article.mot_cle_principal,
        mot_cle_source: motCleImpose ? "paramètre" : motCle ? "search-console" : "moteur",
        // Dire POURQUOI la Search Console n'a rien donné : sans cela, la
        // sélection stratégique se dégrade en choix libre sans que rien ne le
        // signale, et on croit qu'elle fonctionne.
        mot_cle_diagnostic: choix.diagnostic,
        titres_connus: titres.length,
        statut_conseille: verdict.statut_conseille,
        // Vide = scène par défaut de la marque : c'est le signal que le
        // catalogue n'a pas été lu ou qu'aucune scène ne collait.
        scene: article.scene_visuel || null,
        motif: verdict.motif,
        bloquants: verdict.bloquants,
        mineurs: verdict.mineurs,
        longueur_html: contenu.length,
        nb_faq: article.faq?.length ?? 0,
      })
    }

    const depose = await createArticle({
      title: article.titre,
      slug: article.slug,
      content: contenu,
      excerpt: article.meta_description,
      status: statut,
      imageUrl,
    })

    // Un brouillon dont personne n'est informé est un article perdu. C'est la
    // contrepartie exacte de la publication directe : l'exception doit sonner.
    // Le hub a déjà alerté (ou non) au moment du verdict. On ne réémet rien ici :
    // on rapporte ce qu'il dit, pour qu'un « retenu » sans alerte partie se voie.
    const alerte =
      statut === "publish"
        ? "sans objet (article publié)"
        : rendu.alerte?.envoyee
          ? "Telegram, envoyée par le hub"
          : `NON ENVOYÉE — ${rendu.alerte?.erreur ?? "le hub n'a pas alerté"}`
    if (statut === "draft" && !rendu.alerte?.envoyee) {
      console.error("[cron/redaction-seo] brouillon retenu sans alerte :", rendu.alerte?.erreur)
    }

    return Response.json({
      status: "ok",
      // « publié » veut dire EN LIGNE. Webflow crée l'item puis le publie en un
      // second appel : un item créé dont la publication a échoué n'est pas
      // publié, et le dire évite de croire l'article en ligne.
      publie: depose.published,
      webflow_id: depose.id,
      url: depose.url,
      slug: depose.slug,
      slug_modifie: depose.slug !== article.slug ? article.slug : undefined,
      titre: article.titre,
      mot_cle: article.mot_cle_principal,
      mot_cle_source: motCleImpose ? "paramètre" : motCle ? "search-console" : "moteur",
      mot_cle_diagnostic: choix.diagnostic,
      statut_conseille: verdict.statut_conseille,
      scene: article.scene_visuel || null,
      motif: verdict.motif,
      bloquants: verdict.bloquants,
      mineurs: verdict.mineurs,
      publish_error: depose.publishError,
      image_url: imageUrl,
      // Distinct d'un `null` muet : dire pourquoi il n'y a pas de vignette.
      image_error: imageUrl ? undefined : imageErreur,
      alerte_relecture: alerte,
    })
  } catch (err) {
    console.error("[cron/redaction-seo]", err instanceof Error ? err.message : err)
    return Response.json(
      { status: "error", error: err instanceof Error ? err.message : "Erreur rédaction" },
      { status: 500 },
    )
  }
}
