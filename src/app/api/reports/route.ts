import { getServiceClient, isSupabaseConfigured } from "@/lib/supabase/client"

interface ContentLogRow {
  id: number
  title: string
  type: string
  status: string
  content_markdown: string | null
  meta_json: unknown
  created_by: string | null
  created_at: string
}

interface SeoReportRow {
  id: number
  report_type: string
  period_start: string | null
  period_end: string | null
  summary: string | null
  data_json: unknown
  created_at: string
}

// Le composant client attend `meta_json`/`data_json` en STRING (il appelle JSON.parse).
// Supabase renvoie des objets natifs (jsonb) — on re-stringify pour préserver l'API legacy.
function stringifyContentLog(row: ContentLogRow): ContentLogRow & { meta_json: string | null } {
  return { ...row, meta_json: row.meta_json == null ? null : JSON.stringify(row.meta_json) }
}
function stringifySeoReport(row: SeoReportRow): SeoReportRow & { data_json: string | null } {
  return { ...row, data_json: row.data_json == null ? null : JSON.stringify(row.data_json) }
}

export async function GET() {
  if (!isSupabaseConfigured()) {
    return Response.json({ briefs: [], veille: [], seoReports: [] })
  }

  try {
    const sb = getServiceClient()

    const [briefsRes, veilleRes, seoRes] = await Promise.all([
      sb
        .from("iris_content_log")
        .select("id, title, type, status, content_markdown, meta_json, created_by, created_at")
        .eq("type", "brief")
        .order("created_at", { ascending: false })
        .limit(30),
      sb
        .from("iris_content_log")
        .select("id, title, type, status, content_markdown, meta_json, created_by, created_at")
        .eq("created_by", "iris-veille")
        .order("created_at", { ascending: false })
        .limit(30),
      sb
        .from("iris_seo_reports")
        .select("id, report_type, period_start, period_end, summary, data_json, created_at")
        .order("created_at", { ascending: false })
        .limit(20),
    ])

    const briefs = ((briefsRes.data ?? []) as ContentLogRow[]).map(stringifyContentLog)
    const veille = ((veilleRes.data ?? []) as ContentLogRow[]).map(stringifyContentLog)
    const seoReports = ((seoRes.data ?? []) as SeoReportRow[]).map(stringifySeoReport)

    return Response.json({ briefs, veille, seoReports })
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Erreur reports" },
      { status: 500 },
    )
  }
}
