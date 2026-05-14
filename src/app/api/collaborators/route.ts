import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/options"
import { query, execute } from "@/lib/db/connection"
import { hashPassword } from "@/lib/auth/password"

type CollabRow = {
  id: number
  username: string
  email: string | null
  full_name: string | null
  role: "admin" | "collaborator"
  active: number
  last_login_at: string | null
  created_by: string | null
  created_at: string
}

function isAdmin(session: { user?: { role?: string } } | null): boolean {
  return session?.user?.role === "admin"
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return Response.json({ error: "Non autorisé" }, { status: 401 })
  if (!isAdmin(session)) return Response.json({ error: "Admin requis" }, { status: 403 })

  try {
    const rows = await query<CollabRow>(
      "SELECT id, username, email, full_name, role, active, last_login_at, created_by, created_at FROM wp_iris_collaborators ORDER BY created_at DESC",
    )
    return Response.json(rows)
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Erreur BDD" },
      { status: 500 },
    )
  }
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return Response.json({ error: "Non autorisé" }, { status: 401 })
  if (!isAdmin(session)) return Response.json({ error: "Admin requis" }, { status: 403 })

  let body: {
    username?: string
    password?: string
    email?: string
    full_name?: string
    role?: "admin" | "collaborator"
  }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: "JSON invalide" }, { status: 400 })
  }

  const username = body.username?.trim()
  const password = body.password
  const role = body.role === "admin" ? "admin" : "collaborator"

  if (!username || !password) {
    return Response.json(
      { error: "Identifiant et mot de passe requis" },
      { status: 400 },
    )
  }
  if (password.length < 8) {
    return Response.json(
      { error: "Mot de passe trop court (min 8 caractères)" },
      { status: 400 },
    )
  }
  if (!/^[a-zA-Z0-9_.-]{3,100}$/.test(username)) {
    return Response.json(
      { error: "Identifiant invalide (3-100 car., a-z 0-9 _ . -)" },
      { status: 400 },
    )
  }

  try {
    const existing = await query<{ id: number }>(
      "SELECT id FROM wp_iris_collaborators WHERE username = ? LIMIT 1",
      [username],
    )
    if (existing.length > 0) {
      return Response.json(
        { error: "Cet identifiant existe déjà" },
        { status: 409 },
      )
    }

    const passwordHash = await hashPassword(password)
    const createdBy = session.user?.email ?? "admin"

    const result = await execute(
      "INSERT INTO wp_iris_collaborators (username, email, full_name, password_hash, role, active, created_by) VALUES (?, ?, ?, ?, ?, 1, ?)",
      [
        username,
        body.email?.trim() || null,
        body.full_name?.trim() || null,
        passwordHash,
        role,
        createdBy,
      ],
    )
    return Response.json({ success: true, id: result.insertId })
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Erreur création" },
      { status: 500 },
    )
  }
}
