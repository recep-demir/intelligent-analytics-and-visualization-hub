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
import { SYSTEM_INSTRUCTION, buildUserPrompt, EXAMPLE_QUESTIONS } from '../prompt'

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
const model  = genAI.getGenerativeModel({
  model: 'gemini-2.5-flash',
  systemInstruction: SYSTEM_INSTRUCTION,
})

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

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(`Request timed out after ${ms}ms`)), ms)
  )
  return Promise.race([promise, timeout])
}

async function runSpike(): Promise<void> {
  console.log('=== SDL Spike — Gemini 2.5 Flash ===')
  console.log(`Schema: TaxRecord (Orders + Addresses flattened view)`)
  console.log(`Testing ${EXAMPLE_QUESTIONS.length} questions\n`)

  let passed = 0
  let failed = 0

  for (const [i, question] of EXAMPLE_QUESTIONS.entries()) {
    console.log(`[${i + 1}/${EXAMPLE_QUESTIONS.length}] Q: "${question}"`)

    try {
      await new Promise(resolve => setTimeout(resolve, 5000))

      const result = await withTimeout(
        model.generateContent(buildUserPrompt(question, SCHEMA_SDL)),
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

  console.log(`\n=== Results: ${passed}/${EXAMPLE_QUESTIONS.length} passed ===`)
  console.log(passed === EXAMPLE_QUESTIONS.length
    ? '✅ Gemini understands the schema — proceed with Gemini engine'
    : `⚠️  ${passed} passed — review failures and consider local rule-based fallback`
  )
}

runSpike()
