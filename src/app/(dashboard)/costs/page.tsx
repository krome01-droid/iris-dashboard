"use client"

import { useEffect, useState } from "react"
import { Header } from "@/components/layout/header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Wallet,
  WalletCards,
  RefreshCw,
  ExternalLink,
  Bot,
  Globe2,
  MessageSquare,
  ImageIcon,
  Search,
  Mail,
  Database,
  BarChart3,
} from "lucide-react"

type CostService = {
  key: string
  label: string
  subtitle: string
  icon: typeof Bot
  status: "balance" | "no_api" | "no_balance" | "subscription"
  balanceEur?: number
  balanceUsd?: number
  spent30dEur?: number
  spent30dUsd?: number
  meta?: string
  dashboardUrl?: string
  details?: { label: string; value: string }[]
}

const FALLBACK_SERVICES: CostService[] = [
  {
    key: "claude",
    label: "Claude API (Anthropic)",
    subtitle: "Cerveau de l'agent IRIS — conso 30 derniers jours",
    icon: Bot,
    status: "balance",
    spent30dUsd: 0,
    meta: "Aucun appel loggé sur les 30 derniers jours",
    dashboardUrl: "https://console.anthropic.com/settings/billing",
    details: [
      { label: "Requêtes", value: "0" },
      { label: "Input tokens", value: "0" },
      { label: "Output tokens", value: "0" },
      { label: "Cache R/W", value: "0 / 0" },
      { label: "Total tokens", value: "0" },
    ],
  },
  {
    key: "webflow",
    label: "Webflow API",
    subtitle: "Hébergement & API du site autoecole-inris.com",
    icon: Globe2,
    status: "subscription",
    meta: "Plan CMS — pas de solde par requête",
    dashboardUrl: "https://webflow.com/dashboard/account/billing",
  },
  {
    key: "ghl",
    label: "GoHighLevel",
    subtitle: "Webhook rappel + emails de confirmation",
    icon: MessageSquare,
    status: "subscription",
    meta: "Abonnement mensuel — pas de solde API",
    dashboardUrl: "https://app.gohighlevel.com",
  },
  {
    key: "resend",
    label: "Resend",
    subtitle: "Emails transactionnels (si activé)",
    icon: Mail,
    status: "no_balance",
    meta: "Abonnement mensuel — voir dashboard",
    dashboardUrl: "https://resend.com/overview",
  },
  {
    key: "supabase",
    label: "Supabase",
    subtitle: "Postgres + Auth + Storage",
    icon: Database,
    status: "subscription",
    meta: "Abonnement mensuel — voir dashboard",
    dashboardUrl: "https://supabase.com/dashboard/project/_/settings/billing",
  },
  {
    key: "apify",
    label: "Apify",
    subtitle: "Scraping SERP & veille concurrentielle",
    icon: Search,
    status: "no_balance",
    meta: "Pas de solde public — voir dashboard",
    dashboardUrl: "https://console.apify.com/billing",
  },
  {
    key: "google",
    label: "Google APIs (GA4 / GSC)",
    subtitle: "Analytics & Search Console",
    icon: BarChart3,
    status: "no_balance",
    meta: "Quota gratuit — voir GCP Billing",
    dashboardUrl: "https://console.cloud.google.com/billing",
  },
  {
    key: "kie",
    label: "Kie.ai",
    subtitle: "Génération d'images IA (GPT-4o Image)",
    icon: ImageIcon,
    status: "no_api",
    meta: "Réponse inattendue — voir dashboard",
    dashboardUrl: "https://kie.ai",
  },
  {
    key: "fal",
    label: "Fal.ai",
    subtitle: "Génération d'images IA (flux-pro) — fallback",
    icon: ImageIcon,
    status: "no_api",
    meta: "Pas d'API publique de solde — voir dashboard",
    dashboardUrl: "https://fal.ai/dashboard/billing",
  },
]

function formatEur(value?: number) {
  if (value === undefined || value === null) return "—"
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(value)
}

function StatusPill({ status }: { status: CostService["status"] }) {
  if (status === "balance")
    return (
      <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-emerald-200">
        ◉ Solde récupéré
      </Badge>
    )
  if (status === "subscription")
    return (
      <Badge variant="outline" className="border-blue-200 text-blue-700">
        Voir dashboard
      </Badge>
    )
  return (
    <Badge variant="outline" className="text-muted-foreground">
      Voir dashboard
    </Badge>
  )
}

export default function CostsPage() {
  const [services, setServices] = useState<CostService[]>(FALLBACK_SERVICES)
  const [loading, setLoading] = useState(false)
  const [lastUpdate, setLastUpdate] = useState<string>(() =>
    new Date().toLocaleString("fr-FR")
  )

  async function refresh() {
    setLoading(true)
    try {
      const res = await fetch("/admin-iris/api/costs", { cache: "no-store" })
      if (res.ok) {
        const data = (await res.json()) as { services?: CostService[] }
        if (data.services?.length) setServices(data.services)
      }
    } catch {
      // silent — keep fallback
    } finally {
      setLastUpdate(new Date().toLocaleString("fr-FR"))
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
  }, [])

  const totalBalanceEur = services.reduce(
    (sum, s) => sum + (s.balanceEur ?? 0),
    0
  )
  const totalSpent30dEur = services.reduce(
    (sum, s) => sum + (s.spent30dEur ?? 0),
    0
  )

  return (
    <>
      <Header title="Coûts & soldes API">
        <Button size="sm" variant="outline" onClick={refresh} disabled={loading}>
          <RefreshCw
            className={`mr-2 h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`}
          />
          Actualiser
        </Button>
      </Header>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        <p className="text-sm text-muted-foreground">
          Solde en euros (ou équivalent) de chaque service utilisé par l&apos;agent IRIS.
        </p>

        {/* Top : 2 KPI cards */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardContent className="flex items-center gap-4 p-5">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                <Wallet className="h-6 w-6" />
              </div>
              <div className="flex-1">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Soldes positifs (crédits restants)
                </p>
                <p className="mt-1 text-3xl font-bold tracking-tight">
                  {formatEur(totalBalanceEur)}
                </p>
                <p className="text-xs text-muted-foreground">
                  Mis à jour {lastUpdate}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex items-center gap-4 p-5">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-rose-50 text-rose-600">
                <WalletCards className="h-6 w-6" />
              </div>
              <div className="flex-1">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Dépenses 30 derniers jours
                </p>
                <p className="mt-1 text-3xl font-bold tracking-tight">
                  {formatEur(totalSpent30dEur)}
                </p>
                <p className="text-xs text-muted-foreground">
                  Basé sur tokens loggés + conso mensuelle
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Services grid */}
        <div className="grid gap-4 md:grid-cols-2">
          {services.map((s) => {
            const Icon = s.icon
            return (
              <Card key={s.key}>
                <CardHeader className="flex flex-row items-start gap-3 space-y-0 pb-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-muted">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <CardTitle className="text-sm">{s.label}</CardTitle>
                      <StatusPill status={s.status} />
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {s.subtitle}
                    </p>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {s.balanceEur !== undefined && (
                    <div>
                      <p className="text-2xl font-bold tracking-tight">
                        {formatEur(s.balanceEur)}
                      </p>
                      {s.balanceUsd !== undefined && (
                        <p className="text-xs text-muted-foreground">
                          ≈ {s.balanceUsd.toFixed(2)} $
                        </p>
                      )}
                    </div>
                  )}

                  {s.spent30dEur !== undefined && s.balanceEur === undefined && (
                    <div>
                      <p className="text-2xl font-bold tracking-tight text-rose-600">
                        −{formatEur(s.spent30dEur)}
                      </p>
                      {s.spent30dUsd !== undefined && (
                        <p className="text-xs text-muted-foreground">
                          ≈ −{s.spent30dUsd.toFixed(2)} $
                        </p>
                      )}
                    </div>
                  )}

                  {s.meta && (
                    <p className="text-xs text-emerald-600 font-mono">
                      {s.meta}
                    </p>
                  )}

                  {s.details && s.details.length > 0 && (
                    <div className="rounded-md border bg-muted/30 p-3 space-y-1.5">
                      {s.details.map((d) => (
                        <div
                          key={d.label}
                          className="flex items-center justify-between text-xs"
                        >
                          <span className="text-muted-foreground">{d.label}</span>
                          <span className="font-mono font-medium tabular-nums">
                            {d.value}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {s.dashboardUrl && (
                    <a
                      href={s.dashboardUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
                    >
                      Dashboard
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>
    </>
  )
}
