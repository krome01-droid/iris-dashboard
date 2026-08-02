import Anthropic from "@anthropic-ai/sdk"
import { listAllArticles, type IrisArticle } from "@/lib/webflow/client"
import { fetchScenes, requestImage, submitPost, isCromeConfigured, type SubmitResult } from "@/lib/crome/client"
import { getServiceClient, isSupabaseConfigured } from "@/lib/supabase/client"

// Promotion d'un article, puis soumission à CROME OS.
//
// Cette tâche programmait jusqu'ici directement dans GoHighLevel : IRIS
// décidait seule de ce qui partait, à quelle heure, sur quel réseau, sans quota
// ni relecture, et l'écosystème n'en gardait aucune trace — `iris_social_posts`
// n'a d'ailleurs jamais reçu une seule ligne. Elle propose désormais à CROME
// OS, qui décide (palier d'autonomie, quota, fenêtre calme, canaux réellement
// branchés) et publie via Postiz.
//
// IRIS ne choisit pas ses canaux : `platforms` est omis côté client, et le hub
// route vers les comptes réellement connectés pour autoecole-inris.com. C'est
// lui qui détient la carte des intégrations, pas l'agent.
//
// Un seul article par passage. Le palier plafonne les publications machine à
// 2 par jour : en produire davantage n'empilerait que des refus de quota, ou
// noierait la file de validation d'Armel.

const AGENT_LABEL = "IRIS"
const MAX_AGE_DAYS = 7

export async function GET(req: Request) {
  if (req.headers.get("Authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  // `?review_only=1` : tout se déroule normalement, mais le post s'arrête en
  // file de validation. Le cron ne le passe jamais — c'est un outil de
  // vérification humaine, pas un réglage de production.
  const reviewOnly = new URL(req.url).searchParams.get("review_only") === "1"

  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return Response.json({ status: "error", error: "ANTHROPIC_API_KEY manquant" }, { status: 500 })
    }
    if (!isCromeConfigured()) {
      return Response.json(
        { status: "error", error: "CROME_INGEST_URL / CROME_INGEST_SECRET absents" },
        { status: 500 },
      )
    }

    const articles = await listAllArticles().catch(() => [] as IrisArticle[])
    const since = new Date(Date.now() - MAX_AGE_DAYS * 24 * 3600_000).toISOString()
    const recents = articles
      .filter((a) => a.date >= since)
      .sort((a, b) => (a.date < b.date ? 1 : -1))

    if (recents.length === 0) {
      return Response.json({ status: "ok", message: "Aucun article récent à promouvoir", submitted: 0 })
    }

    const sb = isSupabaseConfigured() ? getServiceClient() : null

    // Articles déjà promus cette semaine (clé = id Webflow, dans media_urls).
    const promus = new Set<string>()
    if (sb) {
      const { data, error } = await sb
        .from("iris_social_posts")
        .select("media_urls")
        .gte("created_at", since)
      if (error) {
        // Mieux vaut risquer un doublon que ne rien publier : CROME OS refuse
        // de toute façon un texte identique dans les 24 h.
        console.warn("[cron/social-auto] déduplication indisponible:", error.message)
      }
      for (const row of data ?? []) {
        const meta = row.media_urls as { article_id?: string; crome_post_id?: string | null } | null
        // Promu veut dire « CROME OS l'a accepté », pas « on a essayé ». Sans
        // cette condition, une semaine de hub injoignable consommerait tous les
        // articles récents sans qu'aucun ne soit jamais publié.
        if (meta?.article_id && meta.crome_post_id) promus.add(meta.article_id)
      }
    }

    const article = recents.find((a) => !promus.has(a.id))
    if (!article) {
      return Response.json({
        status: "ok",
        message: "Tous les articles récents ont déjà été promus",
        submitted: 0,
      })
    }

    // Le catalogue vient du studio : IRIS choisit une scène existante, elle n'en
    // invente pas. Injoignable, la liste est vide et la scène par défaut
    // s'appliquera.
    const scenes = await fetchScenes()
    const menuScenes = scenes.length
      ? scenes.map((s) => `- ${s.key} : ${s.depicts}`).join("\n")
      : "(catalogue indisponible — omets le champ scene)"

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1000,
      messages: [
        {
          role: "user",
          content: `Tu es ${AGENT_LABEL}, community manager pour Auto-école INRI'S (autoecole-inris.com).

Article à promouvoir :
Titre : "${article.title}"
Résumé : ${article.summary?.trim() || "(non disponible)"}

Rédige 1 post social qui donne envie de lire cet article, publiable tel quel
sur une page professionnelle (Facebook ou LinkedIn — écris donc un texte qui
fonctionne sur les deux : pas de « lien en bio », pas de format propre à un
réseau).

N'écris pas le lien dans ton texte : il sera ajouté juste en dessous.

Choisis aussi le visuel qui accompagnera ce texte, parmi ces scènes :
${menuScenes}

Format JSON :
{ "contenu": string, "hashtags": string[], "scene": string }

Le champ "scene" doit être exactement l'une des clés ci-dessus, celle dont
l'image illustre le mieux ton texte.

RÈGLE ABSOLUE — ce que tu n'as pas le droit d'affirmer.
Ta seule source est le titre et le résumé ci-dessus. Tout le reste, tu ne le
sais pas. N'écris donc jamais :
- de chiffres, statistiques, pourcentages, tarifs, taux de réussite ou délais
  qui ne figurent pas dans le résumé,
- de villes, de zones de couverture ou de nombre d'agences,
- de dates, d'échéances ou de changements de réglementation,
- de noms de partenaires, de clients ou d'entreprises.
Un post d'un agent voisin a déjà annoncé « Déjà actif à Strasbourg, Rennes,
Lille » : c'était faux, inventé de toutes pièces, et il a fallu l'intercepter
avant publication. Une seule affirmation fausse sur une page publique coûte
plus cher que dix posts réussis ne rapportent. Dans le doute, reste sur ce que
l'article dit et invite à le lire.

Ton engageant et accessible. Cible : 17-25 ans. 100 à 200 caractères hors
hashtags. 3 à 5 hashtags maximum, en français, sans mélange franglais.`,
        },
      ],
    })

    const texte = response.content[0].type === "text" ? response.content[0].text : ""
    let redige: { contenu?: string; hashtags?: string[]; scene?: string } | null = null
    try {
      const bloc = texte.match(/\{[\s\S]*\}/)
      if (bloc) redige = JSON.parse(bloc[0])
    } catch {
      redige = null
    }
    if (!redige?.contenu) {
      return Response.json({ status: "error", error: "Réponse IA non parsable" }, { status: 502 })
    }

    // Le hub n'ajoute aucun lien : il doit vivre dans le texte, sinon l'article
    // qu'on promeut devient inatteignable depuis le post.
    const hashtags = (redige.hashtags ?? [])
      .map((h) => "#" + String(h).replace(/^#+/, "").trim())
      .filter((h) => h.length > 1)
    const contenu = [redige.contenu.trim(), article.url, hashtags.join(" ")]
      .filter(Boolean)
      .join("\n\n")

    // Une scène hors catalogue serait refusée par le studio : on préfère laisser
    // la valeur par défaut s'appliquer plutôt que perdre le visuel.
    const choisie = redige.scene
    const scene = scenes.some((s) => s.key === choisie) ? choisie : undefined

    // L'image de l'article d'abord : elle montre le sujet réel, elle est déjà
    // en ligne et déjà validée. Le studio n'intervient que si l'article n'en a pas.
    let imageUrl: string | null = article.imageUrl ?? null
    let imageOrigine: "article" | "studio" | null = imageUrl ? "article" : null
    let imageErreur: string | undefined

    if (!imageUrl) {
      const media = await requestImage(scene)
      if (media.image_url) {
        imageUrl = media.image_url
        imageOrigine = "studio"
      } else {
        imageErreur = media.error ?? media.reason ?? "inconnu"
        console.warn("[cron/social-auto] pas de visuel:", imageErreur)
      }
    }

    // CROME OS décide et publie.
    const resultat: SubmitResult = await submitPost(contenu, imageUrl ? [imageUrl] : [], reviewOnly)

    // Trace locale — même quand CROME OS refuse ou est injoignable, le texte
    // rédigé ne doit pas être perdu, et l'article doit compter comme promu pour
    // que le prochain passage en choisisse un autre. Le statut dit ce qui s'est
    // réellement passé, plutôt que « scheduled » quoi qu'il arrive.
    const statut = resultat.published
      ? "published"
      : resultat.error
        ? "error"
        : "pending_review"
    if (sb) {
      const { error } = await sb.from("iris_social_posts").insert({
        platform: "social",
        scheduled_at: null,
        status: statut,
        caption: contenu,
        media_urls: {
          link: article.url,
          media: imageUrl,
          media_source: imageOrigine,
          article_id: article.id,
          article_slug: article.slug,
          crome_post_id: resultat.post_id ?? null,
        },
      })
      if (error) console.error("[cron/social-auto] copie locale:", error.message)
    }

    if (resultat.error) {
      console.error("[cron/social-auto] soumission CROME OS:", resultat.error)
      return Response.json(
        { status: "error", step: "crome_submit", error: resultat.error, article_id: article.id },
        { status: 502 },
      )
    }

    return Response.json({
      status: "ok",
      submitted: 1,
      article_id: article.id,
      post_id: resultat.post_id,
      published: resultat.published ?? false,
      duplicate: resultat.duplicate ?? false,
      // Le motif quand rien n'est parti : quota, fenêtre calme, palier…
      reason: resultat.reason,
      review_only: reviewOnly,
      scene: scene ?? null,
      image_url: imageUrl,
      image_source: imageOrigine,
      // Distinct de `null` sans explication : dire pourquoi il n'y a pas d'image.
      image_error: imageUrl ? undefined : imageErreur,
    })
  } catch (err) {
    console.error("[cron/social-auto]", err instanceof Error ? err.message : err)
    return Response.json(
      { status: "error", error: err instanceof Error ? err.message : "Erreur social auto" },
      { status: 500 },
    )
  }
}
