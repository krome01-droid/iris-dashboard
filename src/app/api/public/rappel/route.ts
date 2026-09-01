import type { NextRequest } from "next/server"
import { sendEmail, isResendConfigured } from "@/lib/resend/client"

// Endpoint public : formulaire "demande de rappel" des fiches auto-école physique
// (autoecole-inris.com / inris-formations.com). Le mail part vers l'adresse de
// l'auto-école, résolue côté serveur — le client ne choisit jamais le destinataire.

const ALLOWED_ORIGINS = [
  "https://www.autoecole-inris.com",
  "https://autoecole-inris.com",
  "https://inris-formation.webflow.io",
  "https://www.inris-formations.com",
  "https://inris-formations.com",
]

const BOOKING_API =
  process.env.INRIS_BOOKING_API ?? "https://connect.inris-formations.com"

// Charte INRI'S : dégradé violet → magenta, corps blanc, pied bleu nuit.
const VIOLET = "#281B59"
const MAGENTA = "#C10058"
const NAVY = "#1F3149"
// Nom affiché à la réception. L'agence doit reconnaître l'expéditeur avant même
// d'ouvrir : l'adresse technique seule ne dit rien.
const EXPEDITEUR = "Réseau INRI'S"

const LOGO =
  "https://cdn.prod.website-files.com/67c976202edb4724b88395f9/685d4f98141023c622fdc5fb_logo_inris_hor_blanc-p-500.png"

// Fenêtre glissante anti-spam, par IP. Mono-instance : suffisant pour ce volume.
const RATE_LIMIT_MAX = 5
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000
const hits = new Map<string, number[]>()

function isRateLimited(ip: string): boolean {
  const now = Date.now()
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS)
  recent.push(now)
  hits.set(ip, recent)
  if (hits.size > 5000) hits.clear()
  return recent.length > RATE_LIMIT_MAX
}

function corsHeaders(origin: string | null): Record<string, string> {
  const allowed = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  }
}

function json(body: unknown, status: number, origin: string | null) {
  return Response.json(body, { status, headers: corsHeaders(origin) })
}

function esc(v: string): string {
  return v
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

type Agency = {
  name?: string
  city?: string
  email?: string
  phone?: string
  type?: string
  url?: string
}

async function getAgency(code: string): Promise<Agency | null> {
  const url = `${BOOKING_API}/api/agencies/get?code=${encodeURIComponent(code)}`
  const res = await fetch(url, { cache: "no-store" })
  if (!res.ok) return null
  const text = await res.text()
  if (!text.trim()) return null
  try {
    const data = JSON.parse(text) as Agency
    return data && typeof data === "object" ? data : null
  } catch {
    return null
  }
}

// Une ligne du récapitulatif. Les tableaux restent le seul agencement fiable
// d'un client de messagerie à l'autre.
function row(label: string, valueHtml: string): string {
  return `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid #eef0f4;color:#6b7280;font-size:14px;width:170px;vertical-align:top">${esc(label)}</td>
      <td style="padding:10px 0;border-bottom:1px solid #eef0f4;color:${NAVY};font-size:15px;vertical-align:top">${valueHtml}</td>
    </tr>`
}

function buildEmail(params: {
  agencyName: string
  agencyUrl: string
  prenom: string
  nom: string
  telephone: string
  telDigits: string
  email: string
  typeFormation: string
  creneau: string
  provenance: string
  message: string
}): string {
  const p = params
  const identite = [p.prenom, p.nom].filter(Boolean).join(" ")

  const lignes = [
    row("Nom", `<strong>${esc(p.nom)}</strong>`),
    p.prenom ? row("Prénom", `<strong>${esc(p.prenom)}</strong>`) : "",
    row(
      "Téléphone",
      `<a href="tel:${esc(p.telDigits)}" style="color:${MAGENTA};text-decoration:none;font-weight:700">${esc(p.telephone)}</a>`,
    ),
    p.email
      ? row(
          "E-mail",
          `<a href="mailto:${esc(p.email)}" style="color:${MAGENTA};text-decoration:none">${esc(p.email)}</a>`,
        )
      : "",
    p.typeFormation ? row("Type de formation", esc(p.typeFormation)) : "",
    p.creneau ? row("Créneau souhaité", esc(p.creneau)) : "",
    p.provenance ? row("Nous a connus par", esc(p.provenance)) : "",
  ].join("")

  return `<!doctype html>
<html lang="fr">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f7">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f7;padding:24px 12px">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#ffffff;border-radius:14px;overflow:hidden;font-family:Arial,Helvetica,sans-serif">

        <tr>
          <td align="center" style="background-color:${VIOLET};background-image:linear-gradient(120deg,${VIOLET} 0%,${MAGENTA} 100%);padding:30px 24px">
            <img src="${LOGO}" alt="INRI'S Formations" width="240" style="display:block;border:0;width:240px;max-width:70%;height:auto">
          </td>
        </tr>

        <tr>
          <td style="padding:34px 36px 10px">
            <p style="margin:0 0 6px;font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:${MAGENTA};font-weight:700">Nouvelle demande de rappel</p>
            <p style="margin:0 0 24px;font-size:20px;line-height:1.35;color:${NAVY};font-weight:700">${esc(p.agencyName)}</p>
            <p style="margin:0 0 18px;font-size:15px;line-height:1.6;color:#4b5563">
              ${esc(identite || "Un élève")} souhaite être rappelé au sujet d'une formation.
            </p>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${lignes}</table>
          </td>
        </tr>
        ${
          p.message
            ? `<tr><td style="padding:8px 36px 0">
                 <p style="margin:0 0 8px;color:#6b7280;font-size:14px">Message</p>
                 <p style="margin:0;padding:16px 18px;background:#f6f7f9;border-left:3px solid ${MAGENTA};border-radius:8px;color:${NAVY};font-size:15px;line-height:1.6;white-space:pre-wrap">${esc(p.message)}</p>
               </td></tr>`
            : ""
        }

        <tr>
          <td style="padding:26px 36px 34px">
            <table role="presentation" cellpadding="0" cellspacing="0">
              <tr>
                <td style="padding-right:10px">
                  <a href="tel:${esc(p.telDigits)}" style="display:inline-block;background:#00B87C;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:13px 24px;border-radius:9999px">Appeler ${esc(p.prenom || p.nom)}</a>
                </td>
                ${
                  p.email
                    ? `<td><a href="mailto:${esc(p.email)}" style="display:inline-block;background:#ffffff;color:${NAVY};border:1px solid #d8dce4;text-decoration:none;font-weight:700;font-size:15px;padding:12px 24px;border-radius:9999px">Répondre par e-mail</a></td>`
                    : ""
                }
              </tr>
            </table>
          </td>
        </tr>

        <tr>
          <td style="background:${NAVY};padding:26px 36px;text-align:center">
            <p style="margin:0 0 8px;color:#ffffff;font-size:14px;font-weight:700">Répondez directement à cet e-mail</p>
            <p style="margin:0 0 14px;color:#aab3c4;font-size:13px;line-height:1.6">
              Votre réponse part vers l'élève. Merci de le recontacter sous 24 h ouvrées.
            </p>
            <a href="${esc(p.agencyUrl)}" style="color:#ffffff;font-size:13px;text-decoration:underline">Voir la fiche de l'agence</a>
          </td>
        </tr>

      </table>
      <p style="margin:16px 0 0;color:#9ca3af;font-size:12px;font-family:Arial,Helvetica,sans-serif">
        Demande envoyée depuis le site INRI'S Formations
      </p>
    </td></tr>
  </table>
</body>
</html>`
}

// Diagnostic : dit si l'environnement d'envoi est complet, sans rien révéler
// des valeurs. Sert à trancher entre « variable absente du conteneur » et
// « message parti mais non remis », que le 200 d'un POST ne distingue pas.
export async function GET(req: NextRequest) {
  const origin = req.headers.get("origin")
  return json(
    {
      resendConfigured: isResendConfigured(),
      bccConfigured: Boolean(process.env.IRIS_RAPPEL_BCC),
      fallbackConfigured: Boolean(process.env.IRIS_RAPPEL_FALLBACK_EMAIL),
      fromDomain: (process.env.RESEND_RAPPEL_FROM || process.env.RESEND_FROM_EMAIL || "")
        .split("@")[1] ?? null,
      bookingApi: BOOKING_API,
    },
    200,
    origin,
  )
}

export async function OPTIONS(req: NextRequest) {
  return new Response(null, { status: 204, headers: corsHeaders(req.headers.get("origin")) })
}

export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin")

  if (origin && !ALLOWED_ORIGINS.includes(origin)) {
    return json({ error: "Origine non autorisée" }, 403, origin)
  }

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  if (isRateLimited(ip)) {
    return json({ error: "Trop de demandes, réessayez dans quelques minutes." }, 429, origin)
  }

  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return json({ error: "Requête invalide" }, 400, origin)
  }

  const str = (k: string) => (typeof body[k] === "string" ? (body[k] as string).trim() : "")

  // Honeypot : rempli = bot. On répond 200 pour ne pas l'informer.
  if (str("website")) return json({ ok: true }, 200, origin)

  const code = str("code")
  const nom = str("nom")
  // Optionnel : les pages servent encore l'ancien formulaire le temps que le
  // script se propage sur les deux sites.
  const prenom = str("prenom")
  const telephone = str("telephone")
  const email = str("email")
  const message = str("message")
  const creneau = str("creneau")
  const typeFormation = str("typeFormation")
  const provenance = str("provenance")

  if (!code) return json({ error: "Centre non identifié" }, 400, origin)
  if (nom.length < 2 || nom.length > 80) {
    return json({ error: "Merci d'indiquer votre nom." }, 400, origin)
  }
  if (prenom.length > 80) {
    return json({ error: "Prénom trop long." }, 400, origin)
  }
  const telDigits = telephone.replace(/[^0-9+]/g, "")
  if (telDigits.length < 10 || telDigits.length > 15) {
    return json({ error: "Merci d'indiquer un numéro de téléphone valide." }, 400, origin)
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return json({ error: "Adresse e-mail invalide." }, 400, origin)
  }
  if (message.length > 1000) {
    return json({ error: "Message trop long (1000 caractères maximum)." }, 400, origin)
  }
  if (typeFormation.length > 120 || provenance.length > 120 || creneau.length > 120) {
    return json({ error: "Requête invalide" }, 400, origin)
  }

  const agency = await getAgency(code)
  if (!agency) {
    return json({ error: "Centre introuvable." }, 404, origin)
  }

  const destinataire = agency.email || process.env.IRIS_RAPPEL_FALLBACK_EMAIL
  if (!destinataire) {
    return json(
      { error: "Aucune adresse de contact pour ce centre. Appelez-nous directement." },
      503,
      origin,
    )
  }

  if (!isResendConfigured()) {
    return json({ error: "Service d'envoi indisponible." }, 503, origin)
  }

  const libelle = agency.name || agency.city || code
  const html = buildEmail({
    agencyName: libelle,
    agencyUrl: agency.url || "https://www.autoecole-inris.com",
    prenom,
    nom,
    telephone,
    telDigits,
    email,
    typeFormation,
    creneau,
    provenance,
    message,
  })

  // L'objet porte le nom du prospect : l'agence trie ses demandes d'un coup d'œil.
  const identite = [prenom, nom].filter(Boolean).join(" ")
  const subject = `Demande de rappel — ${identite || "nouveau contact"} (${libelle})`

  // L'adresse configurée n'est qu'une boîte technique : on lui accole le nom
  // affiché, sauf si elle en porte déjà un.
  const adresse = process.env.RESEND_RAPPEL_FROM || process.env.RESEND_FROM_EMAIL || ""
  const from = adresse
    ? adresse.includes("<")
      ? adresse
      : `${EXPEDITEUR} <${adresse}>`
    : undefined

  try {
    await sendEmail({
      to: destinataire,
      bcc: process.env.IRIS_RAPPEL_BCC || undefined,
      subject,
      html,
      from,
      replyTo: email || undefined,
    })
  } catch (err) {
    console.error("[rappel] envoi Resend échoué:", err)
    return json({ error: "L'envoi a échoué. Appelez-nous directement." }, 502, origin)
  }

  return json({ ok: true }, 200, origin)
}
