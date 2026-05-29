import { ChartConfig } from './chart'

export interface NLQueryRequest {
  nl: string   // plain-English question from the user
}

export interface NLQueryResponse {
  chartConfig: ChartConfig
  fromCache:   boolean   // true if result came from in-memory cache
}

// Both GPT-4o and local engines must implement this interface
// so Dev B can swap engines without changing any other code
export interface AIEngine {
  resolve(nl: string, schemaSdl: string): Promise<ChartConfig>
}
