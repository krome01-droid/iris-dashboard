"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Header } from "@/components/layout/header"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Search,
  ExternalLink,
  RefreshCw,
  FileText,
  Clock,
  Filter,
} from "lucide-react"
import Link from "next/link"

interface Article {
  id: string
  collectionId: string
  collection: "permis" | "code"
  title: string
  slug: string
  status: string
  url: string
  date: string
}

const STATUS_LABELS: Record<string, string> = {
  publish: "Publie",
  draft: "Brouillon",
}

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "outline"> = {
  publish: "default",
  draft: "secondary",
}

const COLLECTION_LABELS: Record<string, string> = {
  permis: "Permis",
  code: "Code",
}

export default function ArticlesPage() {
  const router = useRouter()
  const [articles, setArticles] = useState<Article[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("publish")
  const [error, setError] = useState("")

  const fetchArticles = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const params = new URLSearchParams({
        per_page: "50",
        status: statusFilter,
      })
      if (search) params.set("search", search)

      const res = await fetch(`/admin-iris/api/articles?${params}`)
      if (!res.ok) throw new Error("Erreur chargement")
      const data = await res.json()
      setArticles(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur")
    } finally {
      setLoading(false)
    }
  }, [search, statusFilter])

  useEffect(() => {
    fetchArticles()
  }, [fetchArticles])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    fetchArticles()
  }

  return (
    <>
      <Header title="Articles" />
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Toolbar */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <form onSubmit={handleSearch} className="flex gap-2 flex-1 max-w-md">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher un article..."
                className="pl-9"
              />
            </div>
            <Button type="submit" variant="outline" size="icon">
              <Search className="h-4 w-4" />
            </Button>
          </form>

          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            {["publish", "draft"].map((s) => (
              <Button
                key={s}
                variant={statusFilter === s ? "default" : "outline"}
                size="sm"
                onClick={() => setStatusFilter(s)}
              >
                {STATUS_LABELS[s] || s}
              </Button>
            ))}
            <Button variant="ghost" size="icon" onClick={fetchArticles}>
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-1">
            <FileText className="h-4 w-4" />
            {articles.length} article{articles.length !== 1 ? "s" : ""}
          </span>
        </div>

        {/* Error */}
        {error && (
          <Card>
            <CardContent className="p-4 text-destructive text-sm">{error}</CardContent>
          </Card>
        )}

        {/* Articles list */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <div className="h-5 bg-muted animate-pulse rounded w-3/4 mb-2" />
                  <div className="h-4 bg-muted animate-pulse rounded w-1/2" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : articles.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
              <p className="text-muted-foreground">Aucun article trouve</p>
              <p className="text-xs text-muted-foreground mt-1">
                Utilisez Chat IRIS pour creer votre premier article
              </p>
              <Button className="mt-4" size="sm" render={<Link href="/chat" />}>
                Creer avec IRIS
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {articles.map((article) => (
              <Card
                key={article.id}
                className="transition-shadow hover:shadow-md cursor-pointer"
                onClick={() =>
                  router.push(`/articles/${article.id}?collectionId=${article.collectionId}`)
                }
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-medium text-sm truncate">{article.title}</h3>
                        <Badge variant={STATUS_VARIANTS[article.status] || "outline"}>
                          {STATUS_LABELS[article.status] || article.status}
                        </Badge>
                        <Badge variant="outline">
                          {COLLECTION_LABELS[article.collection] || article.collection}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {new Date(article.date).toLocaleDateString("fr-FR", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </span>
                        <span className="truncate">/{article.slug}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      {article.status === "publish" && (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          render={
                            <a href={article.url} target="_blank" rel="noopener noreferrer" />
                          }
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* CTA */}
        <Card className="border-dashed">
          <CardContent className="p-4 text-center">
            <p className="text-sm text-muted-foreground mb-2">
              Pour creer un nouvel article, demandez a IRIS dans le chat
            </p>
            <Button size="sm" variant="outline" render={<Link href="/chat" />}>
              Ouvrir le Chat IRIS
            </Button>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
