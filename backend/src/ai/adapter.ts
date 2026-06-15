import { createHash } from 'crypto'
import { AIEngine, NLQueryRequest, NLQueryResponse } from '../../../shared/types/ai'
import { ChartConfig } from '../../../shared/types/chart'
import { LocalEngine } from './engines/local'

type CacheEntry = { chartConfig: ChartConfig; engine: "gemini" | "local" }

export class AIAdapter {
  private cache    = new Map<string, CacheEntry>()
  private fallback = new LocalEngine()

  constructor(
    private engine: AIEngine,
    private primaryEngineName: "gemini" | "local" = "local",
  ) {}

  async resolve(request: NLQueryRequest, schemaSdl: string): Promise<NLQueryResponse> {
    const cacheKey = createHash('sha1')
      .update(request.nl + schemaSdl)
      .digest('hex')

    const cached = this.cache.get(cacheKey)
    if (cached) return { chartConfig: cached.chartConfig, fromCache: true, engine: cached.engine }

    const result = await this.resolveWithFallback(request.nl, schemaSdl)

    this.cache.set(cacheKey, result)
    return { chartConfig: result.chartConfig, fromCache: false, engine: result.engine }
  }

  // Try the primary engine with a 3 s timeout; fall back to LocalEngine on any failure.
  // The timeout handle is always cleared via .finally() to avoid open-handle leaks.
  private async resolveWithFallback(nl: string, schemaSdl: string): Promise<CacheEntry> {
    try {
      let timeoutId: ReturnType<typeof setTimeout> | undefined
      const chartConfig = await Promise.race([
        this.engine.resolve(nl, schemaSdl),
        new Promise<never>((_, reject) => {
          timeoutId = setTimeout(() => reject(new Error("AI timeout")), 3000)
        }),
      ]).finally(() => clearTimeout(timeoutId))
      return { chartConfig, engine: this.primaryEngineName }
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
