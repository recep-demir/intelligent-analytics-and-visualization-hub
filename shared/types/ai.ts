import { ChartConfig } from './chart'

export interface NLQueryRequest {
  nl: string
}

export interface NLQueryResponse {
  chartConfig: ChartConfig
  fromCache:   boolean
}

export interface AIEngine {
  resolve(nl: string, schemaSdl: string): Promise<ChartConfig>
}
