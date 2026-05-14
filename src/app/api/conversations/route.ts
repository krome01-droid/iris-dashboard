import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/options"
import { getServiceClient, isSupabaseConfigured } from "@/lib/supabase/client"

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) {
    return Response.json({ error: "Non autorise" }, { status: 401 })
  }

  if (!isSupabaseConfigured()) return Response.json([])

  const email = session.user?.email ?? null
  const sb = getServiceClient()
  const q = sb
    .from("iris_conversations")
    .select("id, title, created_at, updated_at")
    .order("updated_at", { ascending: false })
    .limit(30)

  const { data, error } = email ? await q.eq("user_email", email) : await q
  if (error) return Response.json([])
  return Response.json(data ?? [])
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return Response.json({ error: "Non autorise" }, { status: 401 })
  }

  if (!isSupabaseConfigured()) {
    return Response.json(
      { error: "Supabase non configuré (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY manquants)" },
      { status: 503 },
    )
  }

  const body = await req.json()
  const { id, title, messages } = body as {
    id?: string
    title?: string
    messages: unknown[]
  }

  if (!messages || !Array.isArray(messages)) {
    return Response.json({ error: "Messages requis" }, { status: 400 })
  }

  const email = session.user?.email ?? "iris@autoecole-inris.com"
  const sb = getServiceClient()

  try {
    if (id) {
      const { error } = await sb
        .from("iris_conversations")
        .update({
          title: title || null,
          messages_json: messages,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
      if (error) throw new Error(error.message)
      return Response.json({ success: true, id })
    }

    const { data, error } = await sb
      .from("iris_conversations")
      .insert({
        user_email: email,
        title: title || null,
        messages_json: messages,
      })
      .select("id")
      .single()
    if (error) throw new Error(error.message)
    return Response.json({ success: true, id: data.id })
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Erreur sauvegarde" },
      { status: 500 },
    )
  }
}
