"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useSession } from "next-auth/react"
import { cn } from "@/lib/utils"
import {
  LayoutDashboard,
  MessageSquare,
  FileText,
  Share2,
  Mail,
  CalendarDays,
  Search,
  BarChart3,
  FileBarChart,
  Wallet,
  Settings,
} from "lucide-react"

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard, adminOnly: false },
  { href: "/chat", label: "Chat IRIS", icon: MessageSquare, adminOnly: false },
  { href: "/articles", label: "Articles", icon: FileText, adminOnly: false },
  { href: "/social", label: "Social", icon: Share2, adminOnly: false },
  { href: "/newsletter", label: "Newsletter", icon: Mail, adminOnly: false },
  { href: "/calendar", label: "Calendrier", icon: CalendarDays, adminOnly: false },
  { href: "/seo", label: "SEO / GEO", icon: Search, adminOnly: false },
  { href: "/analytics", label: "Analytics", icon: BarChart3, adminOnly: false },
  { href: "/reports", label: "Rapports", icon: FileBarChart, adminOnly: false },
  { href: "/costs", label: "Coûts", icon: Wallet, adminOnly: true },
  { href: "/settings", label: "Paramètres", icon: Settings, adminOnly: true },
]

export function Sidebar({ onNavigate }: { onNavigate?: () => void } = {}) {
  const pathname = usePathname()
  const { data: session } = useSession()
  const role = (session?.user as { role?: string } | undefined)?.role
  const isAdmin = role === "admin"
  const items = NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin)

  return (
    <aside className="flex h-full w-60 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
      {/* Logo */}
      <div className="flex h-16 items-center gap-2 border-b border-sidebar-border px-5">
        <h1 className="text-xl font-black tracking-tight italic">
          <span>INRI</span>
          <span className="text-sidebar-primary">&apos;S</span>
          <span className="ml-1.5 text-[10px] font-semibold not-italic tracking-[0.2em] text-sidebar-foreground/50 align-middle">
            FORMATIONS
          </span>
        </h1>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        {items.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href)

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-sidebar-accent text-sidebar-primary"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground",
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-sidebar-border px-5 py-3">
        <p className="text-xs text-sidebar-foreground/50">
          IRIS v1.0 — Agent IA
        </p>
      </div>
    </aside>
  )
}
