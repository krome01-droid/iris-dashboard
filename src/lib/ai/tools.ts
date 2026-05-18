import type Anthropic from "@anthropic-ai/sdk"

export const IRIS_TOOLS: Anthropic.Tool[] = [
  {
    name: "publish_article",
    description:
      "Publie un article de blog sur Webflow (autoecole-inris.com). L'article est créé dans une des deux collections blog : 'permis' ou 'code'. Peut créer un brouillon ou publier directement.",
    input_schema: {
      type: "object" as const,
      properties: {
        title: { type: "string", description: "Titre de l'article" },
        content_markdown: {
          type: "string",
          description: "Contenu en markdown — converti automatiquement en rich text Webflow",
        },
        slug: { type: "string", description: "Slug URL (ex: auto-ecole-lens)" },
        collection: {
          type: "string",
          enum: ["permis", "code"],
          description:
            "Collection blog Webflow cible : 'permis' (blog permis de conduire) ou 'code' (blog code de la route)",
        },
        summary: {
          type: "string",
          description: "Résumé court de l'article (chapô / blog-post-summary). Optionnel.",
        },
        target_keyword: {
          type: "string",
          description: "Mot-clé cible principal",
        },
        status: {
          type: "string",
          enum: ["draft", "publish"],
          description: "Statut de publication (draft par défaut)",
        },
      },
      required: ["title", "content_markdown", "slug", "collection", "target_keyword"],
    },
  },
  {
    name: "schedule_social",
    description:
      "Programme un post sur les réseaux sociaux via GoHighLevel Social Planner. Instagram et TikTok exigent une image (media_url).",
    input_schema: {
      type: "object" as const,
      properties: {
        platform: {
          type: "string",
          enum: ["facebook", "instagram", "linkedin", "tiktok", "threads"],
          description: "Plateforme cible",
        },
        text: { type: "string", description: "Texte du post" },
        hashtags: {
          type: "array",
          items: { type: "string" },
          description: "Hashtags (sans #)",
        },
        scheduled_at: {
          type: "string",
          description: "Date/heure de publication (ISO 8601)",
        },
        link_url: {
          type: "string",
          description: "URL du lien à partager",
        },
        media_url: {
          type: "string",
          description: "URL directe de l'image (JPEG/PNG). Obligatoire pour Instagram et TikTok. Utilise l'URL image_url retournée par generate_image.",
        },
      },
      required: ["platform", "text", "scheduled_at"],
    },
  },
  {
    name: "send_email",
    description:
      "Envoie un email via GoHighLevel. Peut être un email unique ou une newsletter.",
    input_schema: {
      type: "object" as const,
      properties: {
        subject: { type: "string", description: "Objet de l'email" },
        html_content: {
          type: "string",
          description: "Contenu HTML de l'email",
        },
        mode: {
          type: "string",
          enum: ["preview", "send_all"],
          description: "preview = envoi test, send_all = envoi à tous les contacts",
        },
      },
      required: ["subject", "html_content", "mode"],
    },
  },
  {
    name: "get_site_content_audit",
    description:
      "Récupère l'intégralité du contenu blog du site Webflow en un seul appel : tous les articles des collections Permis et Code (pagination automatique), stats par collection et par statut, articles anciens à rafraîchir (> 18 mois), articles récents (< 30 jours). À utiliser quand l'utilisateur demande une analyse complète du site ou un audit de contenu. Remplace les appels multiples à search_wp_posts.",
    input_schema: {
      type: "object" as const,
      properties: {},
    },
  },
  {
    name: "search_wp_posts",
    description:
      "Recherche des articles de blog existants sur Webflow (collections Permis et Code) par mot-clé. Le mot-clé est cherché dans le titre, le slug et le résumé.",
    input_schema: {
      type: "object" as const,
      properties: {
        search: {
          type: "string",
          description: "Terme de recherche",
        },
        per_page: {
          type: "number",
          description: "Nombre de résultats (max 20)",
        },
        collection: {
          type: "string",
          enum: ["permis", "code", "all"],
          description: "Limiter la recherche à une collection blog (défaut: all)",
        },
        status: {
          type: "string",
          enum: ["publish", "draft", "any"],
          description: "Filtre par statut éditorial",
        },
      },
      required: ["search"],
    },
  },
  {
    name: "get_calendar",
    description: "Récupère les événements du calendrier éditorial.",
    input_schema: {
      type: "object" as const,
      properties: {
        month: {
          type: "string",
          description: "Mois au format YYYY-MM",
        },
        status: {
          type: "string",
          enum: ["idea", "planned", "in_progress", "review", "published", "cancelled"],
          description: "Filtre par statut",
        },
      },
    },
  },
  {
    name: "create_calendar_event",
    description: "Ajoute un événement au calendrier éditorial.",
    input_schema: {
      type: "object" as const,
      properties: {
        title: { type: "string", description: "Titre du contenu" },
        content_type: {
          type: "string",
          enum: ["article", "newsletter", "social_campaign", "email_sequence"],
          description: "Type de contenu",
        },
        planned_date: {
          type: "string",
          description: "Date prévue (YYYY-MM-DD)",
        },
        notes: {
          type: "string",
          description: "Notes et brief",
        },
      },
      required: ["title", "content_type", "planned_date"],
    },
  },
  {
    name: "get_seo_data",
    description:
      "Récupère des données SEO : mots-clés positionnés, scores, recommandations.",
    input_schema: {
      type: "object" as const,
      properties: {
        type: {
          type: "string",
          enum: ["keywords", "audit", "recommendations"],
          description: "Type de données SEO",
        },
        url: {
          type: "string",
          description: "URL spécifique à analyser (optionnel)",
        },
      },
      required: ["type"],
    },
  },
  {
    name: "get_analytics",
    description: "Récupère les données de trafic et performance.",
    input_schema: {
      type: "object" as const,
      properties: {
        metric: {
          type: "string",
          enum: ["sessions", "pageviews", "top_pages", "sources"],
          description: "Métrique demandée",
        },
        period: {
          type: "string",
          enum: ["7d", "30d", "90d"],
          description: "Période",
        },
      },
      required: ["metric"],
    },
  },
  {
    name: "scrape_serp",
    description:
      "Recherche Google (SERP) pour analyser la concurrence SEO. Retourne les résultats organiques, les questions People Also Ask, et les recherches associées. Utile AVANT de rédiger un article pour vérifier la concurrence sur le mot-clé cible.",
    input_schema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description: "Requête de recherche Google (ex: 'auto-école pas cher Paris')",
        },
        country_code: {
          type: "string",
          description: "Code pays pour localiser les résultats (défaut: fr)",
        },
        max_results: {
          type: "number",
          description: "Nombre max de résultats organiques (1-20, défaut: 10)",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "scrape_webpage",
    description:
      "Extrait le contenu textuel d'une page web. Utile pour analyser le contenu d'un concurrent, extraire des données d'une source, ou préparer une synthèse. Retourne le texte nettoyé (sans navigation, pubs, etc.).",
    input_schema: {
      type: "object" as const,
      properties: {
        url: {
          type: "string",
          description: "URL de la page à scraper",
        },
        max_chars: {
          type: "number",
          description: "Nombre max de caractères à retourner (défaut: 3000)",
        },
      },
      required: ["url"],
    },
  },
  // ── GHL CRM ──────────────────────────────────────────────────────
  {
    name: "ghl_search_contacts",
    description: "Recherche des contacts dans GoHighLevel par nom, email, téléphone ou tag. Retourne les informations et tags de chaque contact.",
    input_schema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "Texte de recherche (nom, email, téléphone)" },
        limit: { type: "number", description: "Nombre max de résultats (défaut: 20)" },
      },
      required: ["query"],
    },
  },
  {
    name: "ghl_create_contact",
    description: "Crée un nouveau contact dans GoHighLevel (lead B2B, abonné, prospect auto-école…).",
    input_schema: {
      type: "object" as const,
      properties: {
        firstName: { type: "string", description: "Prénom" },
        lastName: { type: "string", description: "Nom" },
        email: { type: "string", description: "Email" },
        phone: { type: "string", description: "Téléphone (format international ex: +33612345678)" },
        companyName: { type: "string", description: "Nom de l'entreprise (auto-école)" },
        tags: { type: "array", items: { type: "string" }, description: "Tags à appliquer au contact" },
        source: { type: "string", description: "Source du contact (ex: newsletter, site, linkedin)" },
        city: { type: "string", description: "Ville" },
      },
    },
  },
  {
    name: "ghl_update_contact",
    description: "Met à jour un contact existant dans GoHighLevel (infos, tags, champ personnalisé).",
    input_schema: {
      type: "object" as const,
      properties: {
        contactId: { type: "string", description: "ID du contact GHL" },
        firstName: { type: "string" },
        lastName: { type: "string" },
        email: { type: "string" },
        phone: { type: "string" },
        companyName: { type: "string" },
        city: { type: "string" },
        tags_add: { type: "array", items: { type: "string" }, description: "Tags à ajouter" },
        tags_remove: { type: "array", items: { type: "string" }, description: "Tags à supprimer" },
      },
      required: ["contactId"],
    },
  },
  {
    name: "ghl_add_note",
    description: "Ajoute une note à un contact GHL (résumé d'un appel, compte-rendu de réunion, observation commerciale…).",
    input_schema: {
      type: "object" as const,
      properties: {
        contactId: { type: "string", description: "ID du contact GHL" },
        body: { type: "string", description: "Contenu de la note" },
      },
      required: ["contactId", "body"],
    },
  },
  {
    name: "ghl_create_task",
    description: "Crée une tâche à faire pour un contact GHL (relance, envoi de doc, appel à passer…).",
    input_schema: {
      type: "object" as const,
      properties: {
        contactId: { type: "string", description: "ID du contact GHL" },
        title: { type: "string", description: "Titre de la tâche" },
        dueDate: { type: "string", description: "Date d'échéance (ISO 8601, ex: 2026-04-20T10:00:00Z)" },
        description: { type: "string", description: "Description optionnelle" },
      },
      required: ["contactId", "title", "dueDate"],
    },
  },
  {
    name: "ghl_send_sms",
    description: "Envoie un SMS à un contact via GoHighLevel. À utiliser pour les relances B2B, confirmations, ou messages urgents.",
    input_schema: {
      type: "object" as const,
      properties: {
        contactId: { type: "string", description: "ID du contact GHL destinataire" },
        message: { type: "string", description: "Contenu du SMS (max 160 caractères recommandé)" },
      },
      required: ["contactId", "message"],
    },
  },
  {
    name: "ghl_get_conversations",
    description: "Récupère les conversations récentes dans GoHighLevel. Peut filtrer par contact pour voir l'historique des échanges (emails, SMS, appels).",
    input_schema: {
      type: "object" as const,
      properties: {
        contactId: { type: "string", description: "ID du contact pour voir ses conversations spécifiques (optionnel)" },
        limit: { type: "number", description: "Nombre max de conversations (défaut: 20)" },
      },
    },
  },
  {
    name: "ghl_get_pipeline",
    description: "Affiche les opportunités dans le pipeline commercial GoHighLevel. Peut filtrer par pipeline, stage ou statut. Utile pour suivre les prospects auto-écoles.",
    input_schema: {
      type: "object" as const,
      properties: {
        list_pipelines: { type: "boolean", description: "Si true, liste les pipelines et leurs stages (pour connaître les IDs). À faire avant de créer une opportunité." },
        pipelineId: { type: "string", description: "Filtrer par pipeline (ID)" },
        stageId: { type: "string", description: "Filtrer par stage (ID)" },
        status: { type: "string", enum: ["open", "won", "lost", "abandoned"], description: "Filtrer par statut" },
        contactId: { type: "string", description: "Filtrer par contact" },
        limit: { type: "number", description: "Nombre max de résultats (défaut: 20)" },
      },
    },
  },
  {
    name: "ghl_create_opportunity",
    description: "Crée une nouvelle opportunité (deal) dans le pipeline GoHighLevel pour un contact. Utilise ghl_get_pipeline avec list_pipelines:true pour connaître les IDs de pipeline et de stage.",
    input_schema: {
      type: "object" as const,
      properties: {
        name: { type: "string", description: "Nom de l'opportunité (ex: 'Auto-Ecole Martin — Partenariat')" },
        contactId: { type: "string", description: "ID du contact GHL" },
        pipelineId: { type: "string", description: "ID du pipeline" },
        pipelineStageId: { type: "string", description: "ID du stage dans le pipeline" },
        monetaryValue: { type: "number", description: "Valeur monétaire du deal en euros (optionnel)" },
        status: { type: "string", enum: ["open", "won", "lost", "abandoned"], description: "Statut (défaut: open)" },
      },
      required: ["name", "contactId", "pipelineId", "pipelineStageId"],
    },
  },
  {
    name: "ghl_update_opportunity",
    description: "Met à jour une opportunité dans le pipeline GHL (changer de stage, mettre à jour la valeur, marquer comme gagnée/perdue).",
    input_schema: {
      type: "object" as const,
      properties: {
        opportunityId: { type: "string", description: "ID de l'opportunité à modifier" },
        name: { type: "string", description: "Nouveau nom (optionnel)" },
        pipelineStageId: { type: "string", description: "Nouveau stage (ID) — pour avancer dans le pipeline" },
        status: { type: "string", enum: ["open", "won", "lost", "abandoned"], description: "Nouveau statut" },
        monetaryValue: { type: "number", description: "Valeur mise à jour" },
      },
      required: ["opportunityId"],
    },
  },
  {
    name: "ghl_list_workflows",
    description: "Liste les workflows d'automatisation configurés dans GoHighLevel. Retourne les IDs et noms pour pouvoir les déclencher.",
    input_schema: {
      type: "object" as const,
      properties: {},
    },
  },
  {
    name: "ghl_trigger_workflow",
    description: "Déclenche un workflow d'automatisation GoHighLevel pour un contact (ex: séquence email de bienvenue, relance automatique, notification interne).",
    input_schema: {
      type: "object" as const,
      properties: {
        workflowId: { type: "string", description: "ID du workflow à déclencher (obtenu via ghl_list_workflows)" },
        contactId: { type: "string", description: "ID du contact pour lequel déclencher le workflow" },
      },
      required: ["workflowId", "contactId"],
    },
  },
  {
    name: "ghl_get_appointments",
    description: "Récupère les rendez-vous GoHighLevel. Peut filtrer par calendrier, contact ou période.",
    input_schema: {
      type: "object" as const,
      properties: {
        list_calendars: { type: "boolean", description: "Si true, liste les calendriers disponibles et leurs IDs" },
        calendarId: { type: "string", description: "Filtrer par calendrier (ID)" },
        contactId: { type: "string", description: "Filtrer par contact" },
        startDate: { type: "string", description: "Date de début (ISO 8601)" },
        endDate: { type: "string", description: "Date de fin (ISO 8601)" },
      },
    },
  },
  {
    name: "ghl_create_appointment",
    description: "Crée un rendez-vous dans un calendrier GoHighLevel pour un contact (démo B2B, appel découverte, consultation…).",
    input_schema: {
      type: "object" as const,
      properties: {
        calendarId: { type: "string", description: "ID du calendrier GHL (obtenu via ghl_get_appointments avec list_calendars:true)" },
        contactId: { type: "string", description: "ID du contact GHL" },
        startTime: { type: "string", description: "Début du rendez-vous (ISO 8601, ex: 2026-04-20T14:00:00+02:00)" },
        endTime: { type: "string", description: "Fin du rendez-vous (ISO 8601)" },
        title: { type: "string", description: "Titre du rendez-vous" },
        notes: { type: "string", description: "Notes/agenda du rendez-vous (optionnel)" },
        appointmentStatus: { type: "string", enum: ["new", "confirmed", "cancelled", "showed", "noshow"], description: "Statut (défaut: new)" },
      },
      required: ["calendarId", "contactId", "startTime", "endTime"],
    },
  },
  // ── Email & Templates ─────────────────────────────────────────────
  {
    name: "get_email_template",
    description:
      "Récupère un template HTML prêt à l'emploi pour une newsletter, un email de séquence ou un email B2B. Retourne le HTML avec les variables à remplacer, la liste des variables et un exemple d'objet.",
    input_schema: {
      type: "object" as const,
      properties: {
        template: {
          type: "string",
          enum: [
            "newsletter_hebdomadaire",
            "newsletter_actualite",
            "bienvenue",
            "sequence_j1",
            "sequence_j3",
            "sequence_j7",
            "b2b_prospection",
            "b2b_partenariat",
            "b2b_reengagement",
          ],
          description: "Nom du template à récupérer",
        },
        list_only: {
          type: "boolean",
          description: "Si true, liste uniquement les templates disponibles sans retourner le HTML (pour découvrir les options)",
        },
      },
    },
  },
  {
    name: "score_content",
    description:
      "Analyse la qualité SEO d'un article avant publication. Retourne un score sur 100 avec une liste de recommandations prioritaires. À utiliser après la rédaction, avant publish_article.",
    input_schema: {
      type: "object" as const,
      properties: {
        title: {
          type: "string",
          description: "Titre H1 de l'article",
        },
        content_markdown: {
          type: "string",
          description: "Contenu complet de l'article en markdown",
        },
        target_keyword: {
          type: "string",
          description: "Mot-clé principal ciblé",
        },
        meta_title: {
          type: "string",
          description: "Meta title proposé (optionnel)",
        },
        meta_description: {
          type: "string",
          description: "Meta description proposée (optionnel)",
        },
      },
      required: ["title", "content_markdown", "target_keyword"],
    },
  },
  {
    name: "get_internal_links",
    description:
      "Cherche des articles de blog existants sur Webflow (collections Permis et Code) pouvant servir de liens internes pertinents pour un article en cours de rédaction. Retourne une liste d'articles avec URL, titre et pertinence.",
    input_schema: {
      type: "object" as const,
      properties: {
        keywords: {
          type: "array",
          items: { type: "string" },
          description: "Mots-clés ou thèmes à rechercher (ex: ['permis', 'auto-école Paris', 'prix'])",
        },
        limit: {
          type: "number",
          description: "Nombre max d'articles à retourner par mot-clé (défaut: 5)",
        },
      },
      required: ["keywords"],
    },
  },
  {
    name: "update_article",
    description:
      "Met à jour un article de blog Webflow existant (contenu, titre, slug, résumé, statut). Utile pour le content refresh ou corriger un article publié. L'item_id s'obtient via search_wp_posts ou get_site_content_audit.",
    input_schema: {
      type: "object" as const,
      properties: {
        item_id: {
          type: "string",
          description: "ID Webflow de l'article à mettre à jour",
        },
        collection: {
          type: "string",
          enum: ["permis", "code"],
          description:
            "Collection blog de l'article ('permis' ou 'code'). Optionnel — si absent, la collection est détectée automatiquement.",
        },
        title: {
          type: "string",
          description: "Nouveau titre (optionnel)",
        },
        slug: {
          type: "string",
          description: "Nouveau slug URL (optionnel)",
        },
        content_markdown: {
          type: "string",
          description: "Nouveau contenu en markdown (optionnel)",
        },
        summary: {
          type: "string",
          description: "Nouveau résumé court (optionnel)",
        },
        status: {
          type: "string",
          enum: ["draft", "publish"],
          description: "Nouveau statut (optionnel)",
        },
        target_keyword: {
          type: "string",
          description: "Nouveau mot-clé cible (optionnel, indicatif)",
        },
      },
      required: ["item_id"],
    },
  },
  {
    name: "generate_image",
    description:
      "Génère une image photo-réaliste via IA et retourne son URL directe (hébergée par le fournisseur d'images). Utilise cette URL (image_url) comme media_url dans schedule_social pour les posts sociaux.",
    input_schema: {
      type: "object" as const,
      properties: {
        prompt: {
          type: "string",
          description:
            "Description de la scène à générer (ex: 'Jeune femme souriante au volant d'une voiture d'auto-école dans une rue de Paris'). Le style photo-réaliste et les paramètres techniques sont ajoutés automatiquement.",
        },
      },
      required: ["prompt"],
    },
  },

  // ─── CMS Webflow ──────────────────────────────────────────────────────────
  {
    name: "publish_webflow_item",
    description:
      "Crée un item (article/page) dans une collection Webflow via la Content API v2. Convertit le contenu Markdown en rich text Webflow. Peut créer en brouillon ou publier directement. Requiert WF_API_KEY dans les ENV vars et un collection_id explicite (7 collections disponibles : PERMIS_BLOGS, CODE_BLOGS, POINTS_DE_RDV, LEXIQUES, PRODUCTS, SKUS, CATEGORIES).",
    input_schema: {
      type: "object" as const,
      properties: {
        collection_id: {
          type: "string",
          description:
            "ID de la collection cible (obligatoire). Ex: 67c976212edb4724b8839729 = articles permis, 67f3cadace1bbcd2670c8e4e = articles code.",
        },
        title: { type: "string", description: "Titre de l'item" },
        slug: { type: "string", description: "Slug URL (ex: mon-article)" },
        content_markdown: {
          type: "string",
          description: "Contenu en Markdown — converti automatiquement en rich text Webflow",
        },
        meta_title: {
          type: "string",
          description: "Meta title SEO (< 60 caractères)",
        },
        meta_description: {
          type: "string",
          description: "Meta description SEO (< 155 caractères)",
        },
        publish: {
          type: "boolean",
          description: "Si true, publie l'item directement (draft par défaut)",
        },
        extra_fields: {
          type: "object",
          description: "Champs supplémentaires propres à la collection (catégorie, auteur, image…)",
        },
      },
      required: ["collection_id", "title", "slug", "content_markdown"],
    },
  },
  {
    name: "update_webflow_item",
    description:
      "Met à jour un item existant dans une collection Webflow. Permet de modifier le contenu, les métadonnées SEO ou les champs personnalisés d'un item.",
    input_schema: {
      type: "object" as const,
      properties: {
        item_id: { type: "string", description: "ID Webflow de l'item à modifier" },
        collection_id: {
          type: "string",
          description: "ID de la collection contenant l'item (obligatoire)",
        },
        title: { type: "string", description: "Nouveau titre (optionnel)" },
        content_markdown: {
          type: "string",
          description: "Nouveau contenu Markdown (optionnel)",
        },
        meta_title: { type: "string", description: "Nouveau meta title SEO (optionnel)" },
        meta_description: { type: "string", description: "Nouvelle meta description SEO (optionnel)" },
        publish: {
          type: "boolean",
          description: "Si true, publie l'item après mise à jour",
        },
        extra_fields: {
          type: "object",
          description: "Champs supplémentaires à mettre à jour",
        },
      },
      required: ["item_id", "collection_id"],
    },
  },
  {
    name: "list_webflow_items",
    description:
      "Liste les items d'une collection Webflow (articles, pages…). Utile pour trouver l'ID d'un item existant avant de le mettre à jour. Collections disponibles : 67c976212edb4724b8839729 (PERMIS_BLOGS, 139 articles), 67f3cadace1bbcd2670c8e4e (CODE_BLOGS, 312 articles), 67ebdb2c5b536cee781ef623 (POINTS_DE_RDV, 413 centres), 67d3e470b6482baaa37000f0 (LEXIQUES, 20 termes), 67c976212edb4724b8839753 (PRODUCTS), 67c976212edb4724b8839703 (SKUS), 67c976212edb4724b8839773 (CATEGORIES).",
    input_schema: {
      type: "object" as const,
      properties: {
        collection_id: {
          type: "string",
          description: "ID de la collection à lister (obligatoire)",
        },
        limit: {
          type: "number",
          description: "Nombre d'items à retourner (défaut: 20, max: 100)",
        },
        offset: {
          type: "number",
          description: "Décalage pour la pagination (défaut: 0)",
        },
      },
      required: ["collection_id"],
    },
  },

  // ─── GHL — contact direct ─────────────────────────────────────────────────
  {
    name: "ghl_get_contact",
    description:
      "Récupère les informations complètes d'un contact GHL par son ID. Utile après ghl_search_contacts pour obtenir tous les détails (custom fields, historique, tags complets).",
    input_schema: {
      type: "object" as const,
      properties: {
        contactId: {
          type: "string",
          description: "ID GHL du contact",
        },
      },
      required: ["contactId"],
    },
  },

  // ─── Calendrier éditorial — mise à jour / suppression ────────────────────
  {
    name: "update_calendar_event",
    description:
      "Met à jour un événement du calendrier éditorial (titre, date, statut, notes). Utile pour faire avancer le statut d'un contenu (planned → in_progress → review → published).",
    input_schema: {
      type: "object" as const,
      properties: {
        id: {
          type: "number",
          description: "ID de l'événement à modifier",
        },
        title: { type: "string", description: "Nouveau titre (optionnel)" },
        planned_date: {
          type: "string",
          description: "Nouvelle date planifiée ISO 8601 (optionnel)",
        },
        status: {
          type: "string",
          enum: ["idea", "planned", "in_progress", "review", "published", "cancelled"],
          description: "Nouveau statut (optionnel)",
        },
        notes: { type: "string", description: "Nouvelles notes (optionnel)" },
      },
      required: ["id"],
    },
  },
  {
    name: "delete_calendar_event",
    description:
      "Supprime définitivement un événement du calendrier éditorial. Demander confirmation avant d'appeler cet outil.",
    input_schema: {
      type: "object" as const,
      properties: {
        id: {
          type: "number",
          description: "ID de l'événement à supprimer",
        },
      },
      required: ["id"],
    },
  },
  {
    name: "seo_check_position",
    description:
      "DataForSEO — vérifie la position d'autoecole-inris.com (ou autre domaine) sur Google France pour un mot-clé. Renvoie position absolue + top 10 SERP. Utiliser pour mesurer où se classe le site sur 'auto école [ville]', 'permis [ville]', etc.",
    input_schema: {
      type: "object" as const,
      properties: {
        keyword: { type: "string", description: "Mot-clé à tester (ex: 'auto école Marseille')" },
        target: {
          type: "string",
          description: "Domaine cible (défaut: autoecole-inris.com)",
        },
      },
      required: ["keyword"],
    },
  },
  {
    name: "seo_keyword_research",
    description:
      "DataForSEO — recherche de mots-clés. Mode 'volumes' : volume + concurrence pour une liste exacte. Mode 'suggestions' : suggestions à partir d'un seed avec volumes + difficulté. Utiliser pour identifier les opportunités SEO par ville/intent.",
    input_schema: {
      type: "object" as const,
      properties: {
        mode: { type: "string", enum: ["volumes", "suggestions"] },
        keywords: {
          type: "array",
          items: { type: "string" },
          description: "Liste de mots-clés (mode volumes)",
        },
        seed: { type: "string", description: "Mot-clé seed (mode suggestions, ex: 'permis de conduire')" },
        limit: { type: "number", description: "Nombre max de suggestions (défaut 50)" },
      },
    },
  },
  {
    name: "seo_competitor_analysis",
    description:
      "DataForSEO — analyse concurrentielle. Mode 'ranked' : keywords sur lesquels un concurrent (ornikar.com, lepermislibre.fr, envoituresimone.com, vroomvroom.fr) se classe top 20. Mode 'gap' : content gap = keywords que le concurrent rank mais pas autoecole-inris.com. Utiliser pour identifier opportunités de contenu.",
    input_schema: {
      type: "object" as const,
      properties: {
        domain: { type: "string", description: "Domaine concurrent (ex: ornikar.com)" },
        mode: { type: "string", enum: ["ranked", "gap"] },
        limit: { type: "number", description: "Nombre max résultats (défaut 100)" },
      },
      required: ["domain"],
    },
  },
  {
    name: "seo_onpage_audit",
    description:
      "DataForSEO — audit on-page instantané d'une URL. Renvoie score 0-100, title/H1/meta, performance (LCP, TTI), issues critiques et warnings. Utiliser pour vérifier la santé SEO d'une page (ex: page ville Webflow).",
    input_schema: {
      type: "object" as const,
      properties: {
        url: { type: "string", description: "URL complète à auditer (https://…)" },
      },
      required: ["url"],
    },
  },
]
