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
    if (cached) return { chartConfig: cached, fromCache: true }

    const chartConfig = await this.resolveWithFallback(request.nl, schemaSdl)

    this.cache.set(cacheKey, chartConfig)
    return { chartConfig, fromCache: false }
  }

  // Try the primary engine (Gemini). If it fails for any reason —
  // no API key, timeout, quota, network — fall back to LocalEngine silently.
  private async resolveWithFallback(nl: string, schemaSdl: string): Promise<ChartConfig> {
    try {
      return await this.engine.resolve(nl, schemaSdl)
    } catch {
      return await this.fallback.resolve(nl, schemaSdl)
    }
  }

  clearCache(): void {
    this.cache.clear()
  }
}
