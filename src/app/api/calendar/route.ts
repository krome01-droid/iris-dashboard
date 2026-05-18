import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/options"
import { getServiceClient, isSupabaseConfigured } from "@/lib/supabase/client"
import { z } from "zod"

const eventSchema = z.object({
  title: z.string().min(1),
  content_type: z.enum(["article", "newsletter", "social_campaign", "email_sequence", "other"]),
  planned_date: z.string(),
  status: z.enum(["idea", "planned", "in_progress", "review", "published", "cancelled"]).default("planned"),
  notes: z.string().optional(),
})

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return Response.json({ error: "Non autorise" }, { status: 401 })
  }

  if (!isSupabaseConfigured()) {
    return Response.json([])
  }

  const { searchParams } = new URL(req.url)
  const month = searchParams.get("month") // format: YYYY-MM
  const status = searchParams.get("status")

  try {
    let q = getServiceClient()
      .from("iris_editorial_calendar")
      .select("id, title, content_type, planned_date, status, notes, created_at")
      .order("planned_date", { ascending: true })

    if (month) {
      q = q.gte("planned_date", `${month}-01`).lte("planned_date", `${month}-31`)
    }
    if (status) {
      q = q.eq("status", status)
    }

    const { data, error } = await q
    if (error) throw new Error(error.message)

    return Response.json(data ?? [])
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Erreur" },
      { status: 500 },
    )
  }
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return Response.json({ error: "Non autorise" }, { status: 401 })
  }

  if (!isSupabaseConfigured()) {
    return Response.json({ error: "Supabase non configure" }, { status: 503 })
  }

  const body = await req.json()
  const parsed = eventSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: "Donnees invalides", details: parsed.error.flatten() }, { status: 400 })
  }

  const data = parsed.data

  try {
    const { data: inserted, error } = await getServiceClient()
      .from("iris_editorial_calendar")
      .insert({
        title: data.title,
        content_type: data.content_type,
        planned_date: data.planned_date,
        status: data.status,
        notes: data.notes || null,
      })
      .select("id")
      .single()

    if (error) throw new Error(error.message)

    return Response.json({ success: true, id: inserted?.id })
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Erreur creation" },
      { status: 500 },
    )
  }
}
