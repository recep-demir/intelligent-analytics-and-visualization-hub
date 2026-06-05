/**
 * US-13 — Analytics Prompt Template
 *
 * Centralised prompt definitions for the AI adapter.
 * All prompt changes go here — never scattered across engine files.
 *
 * Two-part design:
 *   SYSTEM_INSTRUCTION — fixed rules loaded once at engine startup
 *   buildUserPrompt()  — dynamic part, includes schema + user question
 */

// ---------------------------------------------------------------------------
// System instruction — loaded once when GeminiEngine is initialised.
// Tells the model its role, output rules, and what it must never do.
// ---------------------------------------------------------------------------
export const SYSTEM_INSTRUCTION = `
You are a data query assistant for the Elio Tax intelligent analytics platform.
Your only job is to convert a plain-English question into a ChartConfig JSON object.

Rules:
- Return ONLY valid JSON — no explanation, no markdown, no code fences.
- Use only field names that exist in the schema provided by the user.
- chartType must be one of: bar | line | grid | heatmap | pie | donut | map
- operator must be one of: = | eq | gt | lt | contains
- If the question is ambiguous, default to chartType "bar" and no filters.
- Never invent dataset names — use only what is in the schema.
- If the user specifies a specific location or province (e.g., "Ontario"), you MUST populate the filters array using the "=" operator.

Output format:
{
  "chartType": "bar | line | grid | heatmap | pie | donut | map",
  "dataset": "string — must match a dataset name from the schema",
  "filters": [{ "field": "string", "operator": "eq | gt | lt | contains", "value": "string" }],
  "groupBy": "string — optional, field to group results by",
  "title": "string — short human-readable title for the chart"
}
`.trim();

// ---------------------------------------------------------------------------
// User prompt — built fresh for every request.
// Combines the live schema with the user's question.
// ---------------------------------------------------------------------------
export function buildUserPrompt(nl: string, schemaSdl: string): string {
  return `
Database schema:
${schemaSdl}

Available dataset names (use exactly as written): tax_records, towns

Convert this question into a ChartConfig JSON object:
"${nl}"
`.trim();
}

// ---------------------------------------------------------------------------
// Example questions — used in tests, spike, and documentation.
// ---------------------------------------------------------------------------
export const EXAMPLE_QUESTIONS = [
  "Show me total tax collected by province as a bar chart",
  "Show me tax revenue trends by year as a line chart",
  "Show me tax breakdown by country as a pie chart",
  "Show me tax collected in Canada only, grouped by province",
  "Show me orders from Ontario in 2023",
  "Show me cities where tax collected is greater than 500",
  "Show me monthly tax trends for Canada as a line chart",
  "Show me total tax by province on a map",
];
