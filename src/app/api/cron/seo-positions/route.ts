// Cron hebdomadaire — tracking position SERP sur 55 keywords stratégiques
// Lundi 7h Paris. Email résumé envoyé à al@crome-management.com
import { getPosition, type SerpPositionResult } from "@/lib/dataforseo/serp"
import { buildWeeklyTrackingKeywords } from "@/lib/dataforseo/priority-keywords"
import { isDataForSeoConfigured } from "@/lib/dataforseo/client"
import { sendEmail, isResendConfigured } from "@/lib/resend/client"

export const maxDuration = 300 // 5 min — DataForSEO live SERP ≈ 3-5s × 55 keywords

const REPORT_RECIPIENT = process.env.IRIS_REPORT_EMAIL ?? "al@crome-management.com"

type Bucket = { label: string; min: number; max: number; color: string }
const BUCKETS: Bucket[] = [
  { label: "Top 3", min: 1, max: 3, color: "#16a34a" },
  { label: "Top 10", min: 4, max: 10, color: "#22c55e" },
  { label: "Top 20", min: 11, max: 20, color: "#eab308" },
  { label: "Top 50", min: 21, max: 50, color: "#f97316" },
  { label: "Top 100", min: 51, max: 100, color: "#ef4444" },
  { label: "Hors top 100", min: 101, max: Infinity, color: "#6b7280" },
]

function bucketOf(pos: number | null): Bucket {
  if (pos === null) return BUCKETS[5]
  return BUCKETS.find((b) => pos >= b.min && pos <= b.max) ?? BUCKETS[5]
}

function renderHtml(results: SerpPositionResult[]): string {
  const counts = BUCKETS.map((b) => ({
    ...b,
    count: results.filter((r) => bucketOf(r.position).label === b.label).length,
  }))
  const avgPosition =
    results.filter((r) => r.position).reduce((s, r) => s + (r.position ?? 0), 0) /
      Math.max(1, results.filter((r) => r.position).length) || 0

  const rows = [...results]
    .sort((a, b) => (a.position ?? 999) - (b.position ?? 999))
    .map((r) => {
      const b = bucketOf(r.position)
      return `
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #1f2937;color:#e5e7eb;font-size:13px;">${r.keyword}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #1f2937;text-align:center;">
            <span style="display:inline-block;padding:3px 10px;border-radius:999px;background:${b.color};color:#0a0a0a;font-weight:700;font-size:12px;">
              ${r.position ?? "—"}
            </span>
          </td>
          <td style="padding:8px 12px;border-bottom:1px solid #1f2937;color:#9ca3af;font-size:12px;">${r.url ? r.url.replace(/^https?:\/\//, "").slice(0, 60) : ""}</td>
        </tr>`
    })
    .join("")

  const summaryCells = counts
    .map(
      (c) => `
      <td style="padding:14px 8px;text-align:center;border:1px solid #1f2937;">
        <div style="font-size:22px;font-weight:800;color:${c.color};">${c.count}</div>
        <div style="font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.05em;margin-top:4px;">${c.label}</div>
      </td>`,
    )
    .join("")

  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:680px;margin:0 auto;padding:32px 20px;">
    <div style="background:linear-gradient(135deg,#C10058 0%,#281B59 100%);padding:32px;border-radius:12px;margin-bottom:24px;">
      <div style="font-size:11px;letter-spacing:0.15em;text-transform:uppercase;color:rgba(255,255,255,0.7);margin-bottom:8px;">Rapport SEO hebdomadaire</div>
      <h1 style="margin:0;color:#fff;font-size:26px;font-weight:800;">Positions Google · ${new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}</h1>
      <div style="margin-top:16px;color:rgba(255,255,255,0.85);font-size:14px;">
        ${results.length} keywords trackés · Position moyenne : <strong>${avgPosition ? avgPosition.toFixed(1) : "—"}</strong>
      </div>
    </div>

    <table cellspacing="0" cellpadding="0" style="width:100%;border-collapse:collapse;margin-bottom:24px;">
      <tr>${summaryCells}</tr>
    </table>

    <div style="background:#111827;border-radius:12px;overflow:hidden;border:1px solid #1f2937;">
      <div style="padding:16px 20px;background:#0f172a;border-bottom:1px solid #1f2937;">
        <strong style="color:#fff;font-size:14px;">Détail par keyword</strong>
      </div>
      <table style="width:100%;border-collapse:collapse;">${rows}</table>
    </div>

    <div style="margin-top:24px;padding:16px;background:#111827;border-radius:8px;color:#9ca3af;font-size:12px;text-align:center;">
      Iris — agent autoecole-inris.com · <a href="https://agent.autoecole-inris.com/admin-iris" style="color:#C10058;text-decoration:none;">Ouvrir le dashboard</a>
    </div>
  </div>
</body></html>`
}

export async function GET(req: Request) {
  if (req.headers.get("Authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (!isDataForSeoConfigured()) {
    return Response.json({ error: "DATAFORSEO_API_KEY manquant" }, { status: 503 })
  }
  if (!isResendConfigured()) {
    return Response.json({ error: "RESEND_API_KEY manquant" }, { status: 503 })
  }

  try {
    const keywords = buildWeeklyTrackingKeywords()
    const results: SerpPositionResult[] = []
    const errors: string[] = []

    // Run in parallel batches of 5 to avoid rate limits
    const BATCH = 5
    for (let i = 0; i < keywords.length; i += BATCH) {
      const batch = keywords.slice(i, i + BATCH)
      const batchResults = await Promise.allSettled(batch.map((k) => getPosition({ keyword: k })))
      batchResults.forEach((r, idx) => {
        if (r.status === "fulfilled") results.push(r.value)
        else errors.push(`${batch[idx]}: ${r.reason instanceof Error ? r.reason.message : String(r.reason)}`)
      })
    }

    if (!results.length) {
      return Response.json(
        { success: false, error: "Aucune position récupérée", errors },
        { status: 502 },
      )
    }

    const html = renderHtml(results)
    const { id } = await sendEmail({
      to: REPORT_RECIPIENT,
      subject: `[Iris SEO] Rapport positions · ${new Date().toLocaleDateString("fr-FR")}`,
      html,
    })

    return Response.json({
      success: true,
      emailId: id,
      keywordsTracked: results.length,
      errors: errors.length ? errors : undefined,
    })
  } catch (err) {
    return Response.json(
      { success: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    )
  }
}
