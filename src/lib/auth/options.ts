import type { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import { query, execute } from "@/lib/db/connection"
import { verifyPassword } from "./password"

type CollaboratorRow = {
  id: number
  username: string
  email: string | null
  full_name: string | null
  password_hash: string
  role: "admin" | "collaborator"
  active: number
}

async function findCollaborator(username: string): Promise<CollaboratorRow | null> {
  try {
    const rows = await query<CollaboratorRow>(
      "SELECT id, username, email, full_name, password_hash, role, active FROM wp_iris_collaborators WHERE username = ? AND active = 1 LIMIT 1",
      [username],
    )
    return rows[0] ?? null
  } catch {
    return null
  }
}

async function touchLastLogin(id: number) {
  try {
    await execute(
      "UPDATE wp_iris_collaborators SET last_login_at = NOW() WHERE id = ?",
      [id],
    )
  } catch {
    // silent
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "WordPress",
      credentials: {
        username: { label: "Identifiant", type: "text" },
        password: { label: "Mot de passe", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) return null

        // 1. Compte admin local (env vars) — toujours role "admin"
        const adminUser = process.env.ADMIN_USERNAME ?? "iris"
        const adminPass = process.env.ADMIN_PASSWORD
        if (
          adminPass &&
          credentials.username === adminUser &&
          credentials.password === adminPass
        ) {
          return {
            id: "iris",
            name: "Iris",
            email: "iris@autoecole-inris.com",
            role: "admin",
          }
        }

        // 2. Collaborateur en BDD (admin ou collaborator)
        const collab = await findCollaborator(credentials.username)
        if (collab) {
          const ok = await verifyPassword(credentials.password, collab.password_hash)
          if (ok) {
            await touchLastLogin(collab.id)
            return {
              id: `collab-${collab.id}`,
              name: collab.full_name || collab.username,
              email: collab.email || `${collab.username}@autoecole-inris.com`,
              role: collab.role,
            }
          }
          return null
        }

        // 3. Admin WordPress (fallback) — role admin
        const wpUrl = process.env.WP_URL
        if (!wpUrl) return null
        const creds = Buffer.from(
          `${credentials.username}:${credentials.password}`,
        ).toString("base64")

        try {
          const res = await fetch(`${wpUrl}/wp-json/wp/v2/users/me`, {
            headers: { Authorization: `Basic ${creds}` },
          })

          if (!res.ok) return null

          const wpUser = await res.json()

          if (
            !wpUser.capabilities?.administrator &&
            !wpUser.roles?.includes("administrator")
          ) {
            return null
          }

          return {
            id: String(wpUser.id),
            name: wpUser.name,
            email: wpUser.email ?? `${credentials.username}@autoecole-inris.com`,
            image: wpUser.avatar_urls?.["96"] ?? null,
            role: "admin",
          }
        } catch {
          return null
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user && "role" in user) {
        const r = (user as { role?: string }).role
        token.role = r === "admin" ? "admin" : "collaborator"
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        ;(session.user as { role?: string }).role =
          (token.role as string) ?? "collaborator"
      }
      return session
    },
  },
  session: {
    strategy: "jwt",
    maxAge: 7 * 24 * 60 * 60, // 7 jours
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  secret: process.env.NEXTAUTH_SECRET,
}
