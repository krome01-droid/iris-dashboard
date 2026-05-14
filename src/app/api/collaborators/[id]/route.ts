import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/options"
import { execute } from "@/lib/db/connection"
import { hashPassword } from "@/lib/auth/password"

function isAdmin(session: { user?: { role?: string } } | null): boolean {
  return session?.user?.role === "admin"
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions)
  if (!session) return Response.json({ error: "Non autorisé" }, { status: 401 })
  if (!isAdmin(session)) return Response.json({ error: "Admin requis" }, { status: 403 })

  const { id } = await params
  const numericId = Number(id)
  if (!Number.isFinite(numericId)) {
    return Response.json({ error: "ID invalide" }, { status: 400 })
  }

  let body: {
    password?: string
    email?: string
    full_name?: string
    role?: "admin" | "collaborator"
    active?: boolean
  }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: "JSON invalide" }, { status: 400 })
  }

  const sets: string[] = []
  const vals: (string | number | null)[] = []

  if (body.password !== undefined) {
    if (body.password.length < 8) {
      return Response.json({ error: "Mot de passe trop court" }, { status: 400 })
    }
    sets.push("password_hash = ?")
    vals.push(await hashPassword(body.password))
  }
  if (body.email !== undefined) {
    sets.push("email = ?")
    vals.push(body.email.trim() || null)
  }
  if (body.full_name !== undefined) {
    sets.push("full_name = ?")
    vals.push(body.full_name.trim() || null)
  }
  if (body.role !== undefined) {
    sets.push("role = ?")
    vals.push(body.role === "admin" ? "admin" : "collaborator")
  }
  if (body.active !== undefined) {
    sets.push("active = ?")
    vals.push(body.active ? 1 : 0)
  }

  if (sets.length === 0) {
    return Response.json({ error: "Aucun champ à mettre à jour" }, { status: 400 })
  }

  try {
    vals.push(numericId)
    await execute(
      `UPDATE wp_iris_collaborators SET ${sets.join(", ")} WHERE id = ?`,
      vals,
    )
    return Response.json({ success: true })
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Erreur mise à jour" },
      { status: 500 },
    )
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions)
  if (!session) return Response.json({ error: "Non autorisé" }, { status: 401 })
  if (!isAdmin(session)) return Response.json({ error: "Admin requis" }, { status: 403 })

  const { id } = await params
  const numericId = Number(id)
  if (!Number.isFinite(numericId)) {
    return Response.json({ error: "ID invalide" }, { status: 400 })
  }

  try {
    await execute("DELETE FROM wp_iris_collaborators WHERE id = ?", [numericId])
    return Response.json({ success: true })
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Erreur suppression" },
      { status: 500 },
    )
  }
}
