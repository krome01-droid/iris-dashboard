// Liste des keywords stratégiques pour le tracking hebdomadaire INRI'S
// 50 villes (top trafic potentiel) × pattern "auto école [ville]"
// + keywords génériques nationaux à fort volume

export const PRIORITY_CITIES = [
  "Paris", "Marseille", "Lyon", "Toulouse", "Nice", "Nantes", "Montpellier",
  "Strasbourg", "Bordeaux", "Lille", "Rennes", "Reims", "Le Havre",
  "Saint-Étienne", "Toulon", "Grenoble", "Dijon", "Angers", "Nîmes",
  "Villeurbanne", "Saint-Denis", "Le Mans", "Aix-en-Provence", "Clermont-Ferrand",
  "Brest", "Tours", "Amiens", "Limoges", "Annecy", "Perpignan",
  "Boulogne-Billancourt", "Metz", "Besançon", "Orléans", "Rouen",
  "Argenteuil", "Mulhouse", "Caen", "Nancy", "Saint-Paul",
  "Tourcoing", "Roubaix", "Nanterre", "Vitry-sur-Seine", "Avignon",
  "Créteil", "Poitiers", "Dunkerque", "Aubervilliers", "Versailles",
] as const

export const GENERIC_KEYWORDS = [
  "permis de conduire pas cher",
  "auto école en ligne",
  "code de la route en ligne",
  "permis accéléré",
  "permis B prix",
] as const

// Patterns appliqués à chaque ville
export const CITY_PATTERNS = [
  (city: string) => `auto école ${city}`,
  (city: string) => `permis de conduire ${city}`,
] as const

export function buildPriorityKeywords(): string[] {
  const cityKws = PRIORITY_CITIES.flatMap((c) => CITY_PATTERNS.map((p) => p(c)))
  return [...cityKws, ...GENERIC_KEYWORDS]
}

// Pour limiter le coût hebdo, on track une seule pattern par défaut (~55 calls/semaine)
export function buildWeeklyTrackingKeywords(): string[] {
  return [...PRIORITY_CITIES.map((c) => `auto école ${c}`), ...GENERIC_KEYWORDS]
}
