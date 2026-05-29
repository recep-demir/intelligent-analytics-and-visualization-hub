import { AIAdapter } from './adapter'
import { LocalEngine } from './engines/local'

const adapter = new AIAdapter(new LocalEngine())

const TEST_QUESTIONS = [
  'Show me tax by province as a bar chart',
  'Show me tax trends by year as a line chart',
  'Show me tax breakdown by country as a pie chart',
  'Show me orders from Ontario in 2023',
  'Show me all towns in Quebec on a map',
]

async function run(): Promise<void> {
  console.log('=== AI Adapter Test — Local Engine (no API key required) ===\n')

  for (const nl of TEST_QUESTIONS) {
    const result = await adapter.resolve({ nl }, '')
    console.log(`Q: "${nl}"`)
    console.log(JSON.stringify(result.chartConfig, null, 2))
    console.log(`fromCache: ${result.fromCache}`)
    console.log('---')
  }

  // Second run — same questions should come from cache
  console.log('\n=== Cache test: repeating first question ===')
  const cached = await adapter.resolve({ nl: TEST_QUESTIONS[0] }, '')
  console.log(`fromCache: ${cached.fromCache}`)
}

run()
