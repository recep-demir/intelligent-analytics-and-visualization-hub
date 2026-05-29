import { GoogleGenerativeAI } from '@google/generative-ai'
import { AIEngine } from '../../../../shared/types/ai'
import { ChartConfig } from '../../../../shared/types/chart'

export class GeminiEngine implements AIEngine {
  private model

  constructor(apiKey: string) {
    const genAI = new GoogleGenerativeAI(apiKey)
    this.model  = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })
  }

  async resolve(nl: string, schemaSdl: string): Promise<ChartConfig> {
    const prompt = `You are a data query assistant for a Canadian tax analytics platform.

Here is the database schema:
${schemaSdl}

Available chart types: bar, line, grid, heatmap, pie, donut, map
Available filter operators: eq, gt, lt, contains

Convert this question into a ChartConfig JSON object:
"${nl}"

Return ONLY valid JSON — no explanation, no markdown fences:
{
  "chartType": "bar | line | grid | heatmap | pie | donut | map",
  "dataset": "string",
  "filters": [{ "field": "string", "operator": "eq | gt | lt | contains", "value": "string" }],
  "groupBy": "string",
  "title": "string"
}`

    const result = await this.model.generateContent(prompt)
    const raw    = result.response.text().trim()

    // Strip markdown code fences if Gemini wraps the response
    const json = raw.replace(/^```json?\n?/, '').replace(/\n?```$/, '').trim()

    return JSON.parse(json) as ChartConfig
  }
}
