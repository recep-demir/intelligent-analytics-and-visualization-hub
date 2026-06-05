/**
 * Adapter test — uses LocalEngine (no API key required).
 *
 * Questions are intentionally AMBIGUOUS — no chart type hints.
 * Real users don't say "show me a bar chart", they just ask.
 * This tests whether the adapter reasons correctly about intent.
 */
import { AIAdapter } from '../src/ai/adapter'
import { LocalEngine } from '../src/ai/engines/local'

const adapter = new AIAdapter(new LocalEngine())

const TEST_QUESTIONS = [
  // Ambiguous — no chart type mentioned, AI must reason
  'show me product status for Ontario',
  'give me tax split of 2025',
  'what happened to orders over time',
  'Ontario revenue',
  'categorise all products by status',

  // Filter extraction — must detect conditions
  'only shipped orders from 2023',
  'orders from British Columbia where tax is greater than 500',

  // Explicit override — user names the chart type, must honour it
  'show me a bar chart of monthly trends',
  'give me a pie chart of order statuses',

  // Edge case — very short query
  'tax by province',
]

async function run(): Promise<void> {
  console.log('=== Adapter Test — Realistic Ambiguous Questions ===')
  console.log('Engine: LocalEngine (no API key required)')
  console.log(`Testing ${TEST_QUESTIONS.length} questions\n`)

  for (const [i, nl] of TEST_QUESTIONS.entries()) {
    const result = await adapter.resolve({ nl }, '')
    const { chartConfig, fromCache } = result

    console.log(`[${i + 1}/${TEST_QUESTIONS.length}] Q: "${nl}"`)
    console.log(`  chartType: ${chartConfig.chartType}`)
    console.log(`  dataset:   ${chartConfig.dataset}`)
    console.log(`  groupBy:   ${chartConfig.groupBy ?? '—'}`)
    console.log(`  filters:   ${chartConfig.filters?.length ? JSON.stringify(chartConfig.filters) : '[]'}`)
    console.log(`  fromCache: ${fromCache}`)
    console.log('---')
  }

  // Cache test — repeat first question, must return fromCache: true
  console.log('\n=== Cache test ===')
  const cached = await adapter.resolve({ nl: TEST_QUESTIONS[0] }, '')
  console.log(`Q: "${TEST_QUESTIONS[0]}"`)
  console.log(`fromCache: ${cached.fromCache}  ← should be true`)
}

run()
