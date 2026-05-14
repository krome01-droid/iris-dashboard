import type { Metadata } from "next"
import { Quicksand, Montserrat, Geist_Mono } from "next/font/google"
import { AuthProvider } from "@/providers/auth-provider"
import { TooltipProvider } from "@/components/ui/tooltip"
import "./globals.css"

// Charte INRI'S — corps de texte
const quicksand = Quicksand({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
})

// Charte INRI'S — titres (Extra Bold = 800)
const montserrat = Montserrat({
  variable: "--font-heading",
  subsets: ["latin"],
  weight: ["600", "700", "800", "900"],
  display: "swap",
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: "IRIS — Auto-École INRI'S",
  description: "Dashboard Communication & Content Manager",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="fr"
      className={`${quicksand.variable} ${montserrat.variable} ${geistMono.variable} h-full`}
    >
      <body className="h-full bg-background text-foreground antialiased">
        <AuthProvider>
          <TooltipProvider delay={300}>{children}</TooltipProvider>
        </AuthProvider>
      </body>
    </html>
  )
}
