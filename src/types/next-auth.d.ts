import type { DefaultSession } from "next-auth"

declare module "next-auth" {
  interface Session {
    user: {
      role?: "admin" | "collaborator"
    } & DefaultSession["user"]
  }

  interface User {
    role?: "admin" | "collaborator"
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: "admin" | "collaborator"
  }
}
