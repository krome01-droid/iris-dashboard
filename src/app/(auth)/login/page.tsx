"use client"

import { signIn } from "next-auth/react"
import { useState, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { LogIn, AlertCircle, Loader2 } from "lucide-react"

function LoginForm() {
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const searchParams = useSearchParams()
  const raw = searchParams.get("callbackUrl") ?? "/admin-iris"
  const callbackUrl = raw.endsWith("/signin") ? "/admin-iris" : raw

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setLoading(true)

    const result = await signIn("credentials", {
      username,
      password,
      callbackUrl,
      redirect: false,
    })

    if (result?.error) {
      setError("Identifiants incorrects ou accès non autorisé.")
      setLoading(false)
    } else if (result?.url) {
      window.location.href = result.url
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0a0612] text-white">
      {/* Animated gradient background */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 -left-40 h-[520px] w-[520px] rounded-full bg-[#e91e63]/40 blur-[140px] animate-[pulse_8s_ease-in-out_infinite]" />
        <div className="absolute top-1/3 -right-32 h-[480px] w-[480px] rounded-full bg-[#7c3aed]/30 blur-[140px] animate-[pulse_10s_ease-in-out_infinite]" />
        <div className="absolute -bottom-32 left-1/4 h-[460px] w-[460px] rounded-full bg-[#ec4899]/25 blur-[140px] animate-[pulse_12s_ease-in-out_infinite]" />
      </div>

      {/* Subtle grid */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />

      <div className="relative flex min-h-screen items-center justify-center px-4 py-10">
        <div className="w-full max-w-md">
          {/* Glass card */}
          <div className="relative rounded-3xl border border-white/10 bg-white/[0.04] p-8 shadow-[0_8px_32px_rgba(0,0,0,0.45)] backdrop-blur-2xl backdrop-saturate-150">
            {/* Highlight ring */}
            <div className="pointer-events-none absolute inset-0 rounded-3xl bg-gradient-to-br from-white/10 via-transparent to-transparent" />

            <div className="relative space-y-7">
              {/* Brand */}
              <div className="text-center">
                <h1 className="text-2xl font-black tracking-tight">
                  <span className="italic bg-gradient-to-r from-[#ff4d8d] to-[#e91e63] bg-clip-text text-transparent">
                    AUTO-ECOLE
                  </span>
                  <span className="italic text-white">MAGAZINE</span>
                </h1>
                <p className="mt-2 text-[10px] uppercase tracking-[0.32em] text-white/50">
                  Agent IRIS
                </p>
              </div>

              <div className="text-center">
                <h2 className="text-xl font-semibold text-white">Connexion</h2>
                <p className="mt-1 text-sm text-white/60">
                  Utilisez vos identifiants WordPress admin ou collaborateur.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <div className="flex items-center gap-2 rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-2.5 text-sm text-red-200 backdrop-blur">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    {error}
                  </div>
                )}

                <div className="space-y-1.5">
                  <label
                    htmlFor="username"
                    className="block text-xs font-medium uppercase tracking-wider text-white/70"
                  >
                    Identifiant
                  </label>
                  <input
                    id="username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="votre identifiant"
                    required
                    autoComplete="username"
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/30 outline-none transition focus:border-[#ff4d8d]/60 focus:bg-white/[0.08] focus:ring-2 focus:ring-[#ff4d8d]/30"
                  />
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="password"
                    className="block text-xs font-medium uppercase tracking-wider text-white/70"
                  >
                    Mot de passe
                  </label>
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••"
                    required
                    autoComplete="current-password"
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/30 outline-none transition focus:border-[#ff4d8d]/60 focus:bg-white/[0.08] focus:ring-2 focus:ring-[#ff4d8d]/30"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading || !username || !password}
                  className="group relative mt-2 flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-gradient-to-r from-[#ff4d8d] to-[#e91e63] px-4 py-3 text-sm font-semibold text-white shadow-[0_8px_30px_rgba(233,30,99,0.35)] transition hover:shadow-[0_12px_40px_rgba(233,30,99,0.55)] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
                >
                  <span className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Connexion...
                    </>
                  ) : (
                    <>
                      <LogIn className="h-4 w-4" />
                      Se connecter
                    </>
                  )}
                </button>
              </form>

              <p className="text-center text-[11px] text-white/40">
                IRIS v1.0 — autoecole-inris.com
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}
