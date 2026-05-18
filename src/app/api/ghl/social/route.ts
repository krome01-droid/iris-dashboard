import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/options"
import { scheduleSocialPost } from "@/lib/ghl/social-planner"
import { getServiceClient, isSupabaseConfigured } from "@/lib/supabase/client"
import { z } from "zod"

const socialSchema = z.object({
  platform: z.enum(["facebook", "instagram", "linkedin", "tiktok", "threads", "youtube"]),
  text: z.string().min(1),
  hashtags: z.array(z.string()).optional(),
  scheduled_at: z.string(),
  link_url: z.string().optional(),
  media_url: z.string().optional(),
})

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return Response.json({ error: "Non autorisé" }, { status: 401 })
  }

  const body = await req.json()
  const parsed = socialSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: "Données invalides" }, { status: 400 })
  }

  try {
    const result = await scheduleSocialPost(parsed.data)

    // Log to iris_social_posts (non bloquant)
    if (isSupabaseConfigured()) {
      try {
        await getServiceClient()
          .from("iris_social_posts")
          .insert({
            platform: parsed.data.platform,
            scheduled_at: parsed.data.scheduled_at,
            status: "scheduled",
            caption: parsed.data.text,
            media_urls: parsed.data.media_url
              ? { media: parsed.data.media_url, link: parsed.data.link_url }
              : parsed.data.link_url
              ? { link: parsed.data.link_url }
              : null,
          })
      } catch {
        // Le logging ne doit pas bloquer la programmation
      }
    }

    return Response.json({ success: true, result })
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Erreur programmation" },
      { status: 500 },
    )
  }
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) {
    return Response.json({ error: "Non autorisé" }, { status: 401 })
  }

  if (!isSupabaseConfigured()) {
    return Response.json([])
  }

  try {
    const { data, error } = await getServiceClient()
      .from("iris_social_posts")
      .select("id, platform, scheduled_at, published_at, status, caption")
      .order("scheduled_at", { ascending: false })
      .limit(20)

    if (error) throw new Error(error.message)
    return Response.json(data ?? [])
  } catch {
    return Response.json([])
  }
}
