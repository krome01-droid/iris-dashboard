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
  const telephone = str("telephone")
  const email = str("email")
  const message = str("message")
  const creneau = str("creneau")

  if (!code) return json({ error: "Centre non identifié" }, 400, origin)
  if (nom.length < 2 || nom.length > 80) {
    return json({ error: "Merci d'indiquer votre nom." }, 400, origin)
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
  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#1F3149;line-height:1.6">
      <p style="margin:0 0 4px"><strong>Nouvelle demande de rappel</strong></p>
      <p style="margin:0 0 20px;color:#6b7280">${esc(libelle)}</p>
      <table cellpadding="6" cellspacing="0" style="border-collapse:collapse">
        <tr><td style="color:#6b7280">Nom</td><td><strong>${esc(nom)}</strong></td></tr>
        <tr><td style="color:#6b7280">Téléphone</td><td><a href="tel:${esc(telDigits)}"><strong>${esc(telephone)}</strong></a></td></tr>
        ${email ? `<tr><td style="color:#6b7280">E-mail</td><td><a href="mailto:${esc(email)}">${esc(email)}</a></td></tr>` : ""}
        ${creneau ? `<tr><td style="color:#6b7280">Créneau souhaité</td><td>${esc(creneau)}</td></tr>` : ""}
      </table>
      ${
        message
          ? `<p style="margin:20px 0 4px;color:#6b7280">Message</p>
             <p style="margin:0;padding:12px;background:#f6f7f9;border-radius:8px;white-space:pre-wrap">${esc(message)}</p>`
          : ""
      }
      <p style="margin:24px 0 0;font-size:13px;color:#9ca3af">
        Envoyé depuis ${esc(agency.url || code)}
      </p>
    </div>
  `

  try {
    await sendEmail({
      to: destinataire,
      bcc: process.env.IRIS_RAPPEL_BCC || undefined,
      subject: `Demande de rappel — ${libelle}`,
      html,
      from: process.env.RESEND_RAPPEL_FROM || undefined,
      replyTo: email || undefined,
    })
  } catch (err) {
    console.error("[rappel] envoi Resend échoué:", err)
    return json({ error: "L'envoi a échoué. Appelez-nous directement." }, 502, origin)
  }

  return json({ ok: true }, 200, origin)
}
