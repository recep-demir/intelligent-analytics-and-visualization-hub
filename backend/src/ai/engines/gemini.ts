import { GoogleGenerativeAI, SchemaType, Schema } from '@google/generative-ai'
import { AIEngine } from '../../../../shared/types/ai'
import { ChartConfig } from '../../../../shared/types/chart'
import { SYSTEM_INSTRUCTION, buildUserPrompt } from '../prompt'

// JSON schema that forces Gemini to return a valid ChartConfig structure.
// Gemini cannot return invalid chartType values or unknown operators.
const CHART_CONFIG_SCHEMA: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    chartType: {
      type: SchemaType.STRING,
      format: 'enum',
      enum: ['bar', 'line', 'grid', 'heatmap', 'pie', 'donut', 'map'],
    },
    dataset: { type: SchemaType.STRING },
    groupBy: { type: SchemaType.STRING },
    title:   { type: SchemaType.STRING },
    filters: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          field:    { type: SchemaType.STRING },
          operator: { type: SchemaType.STRING, format: 'enum', enum: ['eq', 'gt', 'lt', 'contains'] },
          value:    { type: SchemaType.STRING },
        },
        required: ['field', 'operator', 'value'],
      },
    },
  },
  required: ['chartType', 'dataset'],
}

export class GeminiEngine implements AIEngine {
  private model

  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is required')
    }
    const genAI = new GoogleGenerativeAI(apiKey)
    this.model  = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      systemInstruction: SYSTEM_INSTRUCTION,
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema:   CHART_CONFIG_SCHEMA,
      },
    })
  }

  async resolve(nl: string, schemaSdl: string): Promise<ChartConfig> {
    const result = await this.model.generateContent(buildUserPrompt(nl, schemaSdl))
    const raw    = result.response.text().trim()

    try {
      return JSON.parse(raw) as ChartConfig
    } catch {
      throw new Error(`Gemini returned malformed JSON: ${raw.slice(0, 100)}`)
    }
  }
}
