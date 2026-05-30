/**
 * SDL Spike — proof of concept, not production code.
 * Goal: verify Gemini 2.5 Flash can read a GraphQL schema (SDL) and convert
 * plain-English questions into valid ChartConfig JSON.
 * Result feeds Timnit's AI engine decision in S2.
 */
import * as path from 'path'
import { GoogleGenerativeAI } from '@google/generative-ai'
import * as dotenv from 'dotenv'
import { ChartConfig } from '../../../../shared/types/chart'

// Absolute path — works regardless of which directory the script is run from
// spike/ → ai/ → src/ → backend/ → project root
dotenv.config({ path: path.join(__dirname, '../../../../.env') })

// Explicit API key validation with a clear error message
const apiKey = process.env.GEMINI_API_KEY
if (!apiKey) {
  console.error('❌ GEMINI_API_KEY not set in .env')
  process.exit(1)
}

const genAI = new GoogleGenerativeAI(apiKey)
const model  = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

const REQUEST_TIMEOUT_MS = 30_000

// Flattened view — Orders JOIN Addresses, pre-processed for tax analytics
const SCHEMA_SDL = `
type TaxRecord {
  id:         ID!
  tax:        Float!      # tax amount collected on this order
  subtotal:   Float!      # order subtotal before tax
  total:      Float!      # order total including tax
  status:     String!     # order status: pending, completed, cancelled
  province:   String!     # Canadian province or US state
  city:       String!     # city name
  country:    String!     # country code: CA, US, MX
  postalCode: String!
  year:       Int!        # extracted from order date
  month:      Int!        # extracted from order date (1-12)
}
`

const TEST_QUESTIONS = [
  'Show me total tax collected by province as a bar chart',
  'Show me tax revenue trends by year as a line chart',
  'Show me tax breakdown by country as a pie chart',
  'Show me tax collected in Canada only, grouped by province',
  'Show me orders from Ontario in 2023',
  'Show me cities where tax collected is greater than 500',
  'Show me monthly tax trends for Canada as a line chart',
  'Show me total tax by province on a map',
]

function buildPrompt(question: string): string {
  return `You are a data query assistant for a Canadian tax analytics platform.

Here is the database schema:
${SCHEMA_SDL}

Available chart types: bar, line, grid, heatmap, pie, donut, map
Available filter operators: eq, gt, lt, contains
Dataset name: tax_records

Convert this question into a ChartConfig JSON object:
"${question}"

Return ONLY valid JSON — no explanation, no markdown fences:
{
  "chartType": "bar | line | grid | heatmap | pie | donut | map",
  "dataset": "tax_records",
  "filters": [{ "field": "string", "operator": "eq | gt | lt | contains", "value": "string" }],
  "groupBy": "string",
  "title": "string"
}`
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(`Request timed out after ${ms}ms`)), ms)
  )
  return Promise.race([promise, timeout])
}

async function runSpike(): Promise<void> {
  console.log('=== SDL Spike — Gemini 2.5 Flash ===')
  console.log(`Schema: TaxRecord (Orders + Addresses flattened view)`)
  console.log(`Testing ${TEST_QUESTIONS.length} questions\n`)

  let passed = 0
  let failed = 0

  for (const [i, question] of TEST_QUESTIONS.entries()) {
    console.log(`[${i + 1}/${TEST_QUESTIONS.length}] Q: "${question}"`)

    try {
      await new Promise(resolve => setTimeout(resolve, 5000))

      const result = await withTimeout(
        model.generateContent(buildPrompt(question)),
        REQUEST_TIMEOUT_MS
      )
      const raw    = result.response.text().trim()
      const json   = raw.replace(/^```json?\n?/, '').replace(/\n?```$/, '').trim()
      const config = JSON.parse(json) as ChartConfig

      console.log('✅ Valid ChartConfig')
      console.log(JSON.stringify(config, null, 2))
      passed++
    } catch (err) {
      console.log('❌ Failed')
      console.log(err instanceof Error ? err.message : err)
      failed++
    }

    console.log('---')
  }

  console.log(`\n=== Results: ${passed}/${TEST_QUESTIONS.length} passed ===`)
  console.log(passed === TEST_QUESTIONS.length
    ? '✅ Gemini understands the schema — proceed with Gemini engine'
    : `⚠️  ${failed} questions failed — review and consider local rule-based fallback`
  )
}

runSpike()
