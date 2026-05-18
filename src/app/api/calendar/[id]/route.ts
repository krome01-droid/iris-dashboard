import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/options"
import { getServiceClient, isSupabaseConfigured } from "@/lib/supabase/client"
import { z } from "zod"

const updateSchema = z.object({
  title: z.string().min(1).optional(),
  content_type: z.enum(["article", "newsletter", "social_campaign", "email_sequence", "other"]).optional(),
  planned_date: z.string().optional(),
  status: z.enum(["idea", "planned", "in_progress", "review", "published", "cancelled"]).optional(),
  notes: z.string().optional(),
})

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return Response.json({ error: "Non autorise" }, { status: 401 })
  }

  if (!isSupabaseConfigured()) {
    return Response.json({ error: "Supabase non configure" }, { status: 503 })
  }

  const { id } = await params
  const body = await req.json()
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: "Donnees invalides" }, { status: 400 })
  }

  const data = parsed.data
  const patch: Record<string, string | null> = {}
  if (data.title !== undefined) patch.title = data.title
  if (data.content_type !== undefined) patch.content_type = data.content_type
  if (data.planned_date !== undefined) patch.planned_date = data.planned_date
  if (data.status !== undefined) patch.status = data.status
  if (data.notes !== undefined) patch.notes = data.notes || null

  if (Object.keys(patch).length === 0) {
    return Response.json({ error: "Aucun champ a mettre a jour" }, { status: 400 })
  }

  try {
    const { error } = await getServiceClient()
      .from("iris_editorial_calendar")
      .update(patch)
      .eq("id", Number(id))

    if (error) throw new Error(error.message)
    return Response.json({ success: true })
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Erreur" },
      { status: 500 },
    )
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return Response.json({ error: "Non autorise" }, { status: 401 })
  }

  if (!isSupabaseConfigured()) {
    return Response.json({ error: "Supabase non configure" }, { status: 503 })
  }

  const { id } = await params

  try {
    const { error } = await getServiceClient()
      .from("iris_editorial_calendar")
      .delete()
      .eq("id", Number(id))

    if (error) throw new Error(error.message)
    return Response.json({ success: true })
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Erreur" },
      { status: 500 },
    )
  }
}
