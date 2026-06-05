import { createHash } from 'crypto'
import { AIEngine, NLQueryRequest, NLQueryResponse } from '../../../shared/types/ai'
import { ChartConfig, ChartType, Operator } from '../../../shared/types/chart'

const VALID_CHART_TYPES: ChartType[] = ['bar', 'line', 'grid', 'heatmap', 'pie', 'donut', 'map']
const VALID_OPERATORS:   Operator[]  = ['eq', 'gt', 'lt', 'contains']

function validateChartConfig(config: ChartConfig): ChartConfig {
  // Ensure chartType is one of the allowed values
  if (!VALID_CHART_TYPES.includes(config.chartType)) {
    config.chartType = 'bar'
  }

  // Strip any filters with invalid operators
  if (config.filters) {
    config.filters = config.filters.filter(f => VALID_OPERATORS.includes(f.operator))
  }

  return config
}

export class AIAdapter {
  private cache = new Map<string, ChartConfig>()

  // Engine is injected — swap Gemini for local by passing a different engine
  constructor(private engine: AIEngine) {}

  async resolve(request: NLQueryRequest, schemaSdl: string): Promise<NLQueryResponse> {
    const cacheKey = createHash('sha1')
      .update(request.nl + schemaSdl)
      .digest('hex')

    const cached = this.cache.get(cacheKey)
    if (cached) {
      return { chartConfig: cached, fromCache: true }
    }

    const raw         = await this.engine.resolve(request.nl, schemaSdl)
    const chartConfig = validateChartConfig(raw)

    this.cache.set(cacheKey, chartConfig)

    return { chartConfig, fromCache: false }
  }

  clearCache(): void {
    this.cache.clear()
  }
}
