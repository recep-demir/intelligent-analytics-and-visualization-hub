import { createHash } from 'crypto'
import { AIEngine, NLQueryRequest, NLQueryResponse } from '../../../shared/types/ai'
import { ChartConfig } from '../../../shared/types/chart'
import { LocalEngine } from './engines/local'

export class AIAdapter {
  private cache    = new Map<string, ChartConfig>()
  private fallback = new LocalEngine()

  constructor(private engine: AIEngine) {}

  async resolve(request: NLQueryRequest, schemaSdl: string): Promise<NLQueryResponse> {
    const cacheKey = createHash('sha1')
      .update(request.nl + schemaSdl)
      .digest('hex')

    const cached = this.cache.get(cacheKey)
    if (cached) return { chartConfig: cached, fromCache: true, engine: "gemini" }

    const { chartConfig, engine } = await this.resolveWithFallback(request.nl, schemaSdl)

    this.cache.set(cacheKey, chartConfig)
    return { chartConfig, fromCache: false, engine }
  }

  // Try the primary engine (Gemini) with a 5s timeout.
  // If it fails for any reason — timeout, quota, network, bad JSON —
  // fall back to LocalEngine silently so the user always gets a response.
  private async resolveWithFallback(nl: string, schemaSdl: string): Promise<{ chartConfig: ChartConfig; engine: "gemini" | "local" }> {
    try {
      const chartConfig = await Promise.race([
        this.engine.resolve(nl, schemaSdl),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("AI timeout")), 3000)
        ),
      ])
      return { chartConfig, engine: "gemini" }
    } catch (err) {
      console.warn("⚠️ Primary AI engine failed, falling back to LocalEngine:", (err as Error).message)
      const chartConfig = await this.fallback.resolve(nl, schemaSdl)
      return { chartConfig, engine: "local" }
    }
  }

  clearCache(): void {
    this.cache.clear()
  }
}
