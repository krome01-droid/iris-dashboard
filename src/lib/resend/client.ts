// Resend — client minimal (HTTPS direct, pas de SDK)
// Docs: https://resend.com/docs/api-reference/emails/send-email

export function isResendConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.length)
}

export type SendEmailParams = {
  to: string | string[]
  subject: string
  html: string
  from?: string
  replyTo?: string
}

export async function sendEmail(params: SendEmailParams): Promise<{ id: string }> {
  const key = process.env.RESEND_API_KEY
  if (!key) throw new Error("RESEND_API_KEY non configuré")

  const from = params.from ?? process.env.RESEND_FROM_EMAIL ?? "newsletter@autoecole-inris.com"

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: Array.isArray(params.to) ? params.to : [params.to],
      subject: params.subject,
      html: params.html,
      reply_to: params.replyTo,
    }),
  })

  const json = (await res.json()) as { id?: string; message?: string }
  if (!res.ok) throw new Error(`Resend ${res.status}: ${json.message ?? "unknown"}`)
  return { id: json.id ?? "" }
}
