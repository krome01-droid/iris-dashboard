"use client"

import { useEffect, useState, useCallback } from "react"
import { useSession } from "next-auth/react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Users, Plus, Trash2, Shield, UserCog, Loader2 } from "lucide-react"

interface Collaborator {
  id: number
  username: string
  email: string | null
  full_name: string | null
  role: "admin" | "collaborator"
  active: number
  last_login_at: string | null
  created_at: string
}

export function CollaboratorsCard() {
  const { data: session } = useSession()
  const role = (session?.user as { role?: string } | undefined)?.role
  const isAdmin = role === "admin"

  const [list, setList] = useState<Collaborator[]>([])
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // form
  const [username, setUsername] = useState("")
  const [fullName, setFullName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [formRole, setFormRole] = useState<"admin" | "collaborator">("collaborator")

  const fetchList = useCallback(async () => {
    if (!isAdmin) return
    setLoading(true)
    try {
      const res = await fetch("/admin-iris/api/collaborators")
      if (res.ok) {
        setList(await res.json())
        setError(null)
      } else {
        const data = await res.json().catch(() => ({}))
        setError(data.error ?? `Erreur ${res.status}`)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur réseau")
    } finally {
      setLoading(false)
    }
  }, [isAdmin])

  useEffect(() => {
    fetchList()
  }, [fetchList])

  async function createCollaborator(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const res = await fetch("/admin-iris/api/collaborators", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          full_name: fullName,
          email,
          password,
          role: formRole,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? "Erreur création")
      } else {
        setUsername("")
        setFullName("")
        setEmail("")
        setPassword("")
        setFormRole("collaborator")
        setShowForm(false)
        await fetchList()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur réseau")
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(c: Collaborator) {
    await fetch(`/admin-iris/api/collaborators/${c.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !c.active }),
    })
    fetchList()
  }

  async function deleteCollaborator(id: number) {
    if (!confirm("Supprimer définitivement ce collaborateur ?")) return
    await fetch(`/admin-iris/api/collaborators/${id}`, { method: "DELETE" })
    fetchList()
  }

  if (!isAdmin) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4" />
            Collaborateurs
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Seuls les administrateurs peuvent gérer les collaborateurs.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base flex items-center gap-2">
          <Users className="h-4 w-4" />
          Collaborateurs
          {list.length > 0 && (
            <Badge variant="outline" className="ml-1">
              {list.length}
            </Badge>
          )}
        </CardTitle>
        <Button
          size="sm"
          onClick={() => setShowForm((v) => !v)}
          variant={showForm ? "outline" : "default"}
        >
          <Plus className="mr-2 h-3.5 w-3.5" />
          {showForm ? "Annuler" : "Ajouter"}
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {error}
          </div>
        )}

        {showForm && (
          <form
            onSubmit={createCollaborator}
            className="space-y-3 rounded-lg border bg-muted/30 p-4"
          >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="c-username" className="text-xs">
                  Identifiant *
                </Label>
                <Input
                  id="c-username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="jean.dupont"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="c-fullname" className="text-xs">
                  Nom complet
                </Label>
                <Input
                  id="c-fullname"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Jean Dupont"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="c-email" className="text-xs">
                  Email
                </Label>
                <Input
                  id="c-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="jean@autoecole-inris.com"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="c-password" className="text-xs">
                  Mot de passe * (min 8)
                </Label>
                <Input
                  id="c-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={8}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Rôle</Label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setFormRole("collaborator")}
                  className={`flex-1 rounded-md border px-3 py-2 text-xs transition ${
                    formRole === "collaborator"
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-input bg-background"
                  }`}
                >
                  <UserCog className="mr-1.5 inline h-3.5 w-3.5" />
                  Collaborateur
                </button>
                <button
                  type="button"
                  onClick={() => setFormRole("admin")}
                  className={`flex-1 rounded-md border px-3 py-2 text-xs transition ${
                    formRole === "admin"
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-input bg-background"
                  }`}
                >
                  <Shield className="mr-1.5 inline h-3.5 w-3.5" />
                  Administrateur
                </button>
              </div>
              <p className="text-[10px] text-muted-foreground">
                {formRole === "admin"
                  ? "Accès complet — paramètres, coûts, intégrations, gestion des collaborateurs."
                  : "Accès chat, articles, social, newsletter. Pas d'accès aux paramètres ni aux coûts."}
              </p>
            </div>
            <Button type="submit" size="sm" disabled={saving} className="w-full">
              {saving ? (
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Plus className="mr-2 h-3.5 w-3.5" />
              )}
              Créer le collaborateur
            </Button>
          </form>
        )}

        {loading && list.length === 0 ? (
          <p className="text-sm text-muted-foreground">Chargement...</p>
        ) : list.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aucun collaborateur. Cliquez sur Ajouter pour en créer un.
          </p>
        ) : (
          <div className="space-y-2">
            {list.map((c) => (
              <div
                key={c.id}
                className="flex items-center gap-3 rounded-lg border p-3"
              >
                <div className="rounded-md bg-muted p-2">
                  {c.role === "admin" ? (
                    <Shield className="h-4 w-4 text-primary" />
                  ) : (
                    <UserCog className="h-4 w-4" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium truncate">
                      {c.full_name || c.username}
                    </span>
                    <Badge
                      variant={c.role === "admin" ? "default" : "outline"}
                      className="text-[10px]"
                    >
                      {c.role === "admin" ? "Admin" : "Collaborateur"}
                    </Badge>
                    {!c.active && (
                      <Badge variant="outline" className="text-[10px] text-muted-foreground">
                        Désactivé
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    @{c.username}
                    {c.email ? ` · ${c.email}` : ""}
                  </p>
                  {c.last_login_at && (
                    <p className="text-[10px] text-muted-foreground">
                      Dernière connexion :{" "}
                      {new Date(c.last_login_at).toLocaleString("fr-FR")}
                    </p>
                  )}
                </div>
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => toggleActive(c)}
                    title={c.active ? "Désactiver" : "Réactiver"}
                  >
                    {c.active ? "Désactiver" : "Activer"}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => deleteCollaborator(c.id)}
                    title="Supprimer"
                  >
                    <Trash2 className="h-3.5 w-3.5 text-red-500" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
