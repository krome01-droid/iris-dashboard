import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/options"
import { getServiceClient, isSupabaseConfigured } from "@/lib/supabase/client"

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return Response.json({ error: "Non autorise" }, { status: 401 })
  }

  if (!isSupabaseConfigured()) {
    return Response.json({ error: "Supabase non configuré" }, { status: 503 })
  }

  const { id } = await params
  const sb = getServiceClient()

  const { data, error } = await sb
    .from("iris_conversations")
    .select("id, title, messages_json, created_at, updated_at")
    .eq("id", id)
    .maybeSingle()

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }
  if (!data) {
    return Response.json({ error: "Conversation introuvable" }, { status: 404 })
  }

  return Response.json({
    id: data.id,
    title: data.title,
    created_at: data.created_at,
    updated_at: data.updated_at,
    messages: Array.isArray(data.messages_json) ? data.messages_json : [],
  })
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
    return Response.json({ error: "Supabase non configuré" }, { status: 503 })
  }

  const { id } = await params
  const sb = getServiceClient()

  const { error } = await sb.from("iris_conversations").delete().eq("id", id)
  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }
  return Response.json({ success: true })
}
