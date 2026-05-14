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
    <div className="relative min-h-screen overflow-hidden bg-[#F9FAFE] text-[#1F3149]">
      {/* Gradient blobs — charte INRI'S (#281B59 → #C10058) */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 -left-40 h-[520px] w-[520px] rounded-full bg-[#281B59]/15 blur-[140px] animate-[pulse_8s_ease-in-out_infinite]" />
        <div className="absolute top-1/3 -right-32 h-[480px] w-[480px] rounded-full bg-[#C10058]/12 blur-[140px] animate-[pulse_10s_ease-in-out_infinite]" />
        <div className="absolute -bottom-32 left-1/4 h-[460px] w-[460px] rounded-full bg-[#C10058]/10 blur-[140px] animate-[pulse_12s_ease-in-out_infinite]" />
      </div>

      {/* Subtle grid */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.5]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(31,49,73,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(31,49,73,0.05) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />

      <div className="relative flex min-h-screen items-center justify-center px-4 py-10">
        <div className="w-full max-w-md">
          {/* Glass card */}
          <div className="relative rounded-3xl border border-[#9AA6B7]/30 bg-white/85 p-8 shadow-[0_8px_32px_rgba(40,27,89,0.10)] backdrop-blur-2xl backdrop-saturate-150">
            {/* Highlight ring */}
            <div className="pointer-events-none absolute inset-0 rounded-3xl bg-gradient-to-br from-white/60 via-transparent to-transparent" />

            <div className="relative space-y-7">
              {/* Brand */}
              <div className="text-center">
                <h1 className="font-heading text-2xl font-extrabold tracking-tight">
                  <span className="bg-gradient-to-r from-[#281B59] to-[#C10058] bg-clip-text text-transparent">
                    INRI&apos;S
                  </span>
                  <span className="text-[#1F3149]"> FORMATIONS</span>
                </h1>
                <p className="mt-2 text-[10px] uppercase tracking-[0.32em] text-[#9AA6B7]">
                  Agent IRIS
                </p>
              </div>

              <div className="text-center">
                <h2 className="font-heading text-xl font-bold text-[#1F3149]">Connexion</h2>
                <p className="mt-1 text-sm text-[#9AA6B7]">
                  Utilisez vos identifiants WordPress admin ou collaborateur.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <div className="flex items-center gap-2 rounded-xl border border-red-300/60 bg-red-50 px-3 py-2.5 text-sm text-red-700">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    {error}
                  </div>
                )}

                <div className="space-y-1.5">
                  <label
                    htmlFor="username"
                    className="block text-xs font-medium uppercase tracking-wider text-[#1F3149]"
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
                    className="w-full rounded-xl border border-[#9AA6B7]/40 bg-white px-4 py-3 text-sm text-[#1F3149] placeholder:text-[#9AA6B7] outline-none transition focus:border-[#C10058]/60 focus:ring-2 focus:ring-[#C10058]/20"
                  />
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="password"
                    className="block text-xs font-medium uppercase tracking-wider text-[#1F3149]"
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
                    className="w-full rounded-xl border border-[#9AA6B7]/40 bg-white px-4 py-3 text-sm text-[#1F3149] placeholder:text-[#9AA6B7] outline-none transition focus:border-[#C10058]/60 focus:ring-2 focus:ring-[#C10058]/20"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading || !username || !password}
                  className="group relative mt-2 flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-gradient-to-r from-[#281B59] to-[#C10058] px-4 py-3 text-sm font-semibold text-white shadow-[0_8px_30px_rgba(193,0,88,0.30)] transition hover:shadow-[0_12px_40px_rgba(193,0,88,0.50)] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
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

              <p className="text-center text-[11px] text-[#9AA6B7]">
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
