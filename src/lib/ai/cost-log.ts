import { getServiceClient, isSupabaseConfigured } from "@/lib/supabase/client"

// Tarifs Claude Sonnet 4.x — USD par token (source : console.anthropic.com)
const PRICE_INPUT = 3.0 / 1_000_000
const PRICE_OUTPUT = 15.0 / 1_000_000
const PRICE_CACHE_WRITE = 3.75 / 1_000_000
const PRICE_CACHE_READ = 0.3 / 1_000_000

export interface AnthropicUsage {
  input_tokens: number
  output_tokens: number
  cache_creation_input_tokens?: number | null
  cache_read_input_tokens?: number | null
}

/**
 * Enregistre le coût d'un appel Claude dans iris_api_costs.
 * Non bloquant : toute erreur est silencieuse pour ne jamais casser le chat.
 */
export async function logAnthropicCost(
  usage: AnthropicUsage,
  operation = "chat",
): Promise<void> {
  if (!isSupabaseConfigured()) return

  const input = usage.input_tokens || 0
  const output = usage.output_tokens || 0
  const cacheWrite = usage.cache_creation_input_tokens || 0
  const cacheRead = usage.cache_read_input_tokens || 0

  const costUsd =
    input * PRICE_INPUT +
    output * PRICE_OUTPUT +
    cacheWrite * PRICE_CACHE_WRITE +
    cacheRead * PRICE_CACHE_READ

  const units = input + output + cacheWrite + cacheRead
  if (units === 0) return

  try {
    await getServiceClient()
      .from("iris_api_costs")
      .insert({
        service: "anthropic",
        operation,
        cost_usd: Number(costUsd.toFixed(6)),
        units,
        metadata: {
          input_tokens: input,
          output_tokens: output,
          cache_creation_input_tokens: cacheWrite,
          cache_read_input_tokens: cacheRead,
          model: "claude-sonnet-4-6",
        },
      })
  } catch {
    // Le logging de coût ne doit jamais bloquer la réponse
  }
}
