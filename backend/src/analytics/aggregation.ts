export const supportedAggregations = ["sum", "avg", "count", "min", "max", "minmax"] as const;

export type Aggregation = (typeof supportedAggregations)[number];

export type Calculation = Aggregation | "percentage" | "ratio" | "yearOverYearGrowth";

export function isAggregation(value: unknown): value is Aggregation {
  if (typeof value !== "string") return false;
  return supportedAggregations.includes(value.toLowerCase() as Aggregation);
}

export function detectAggregation(
  question: string,
  requestedAggregation?: unknown,
): Aggregation {
  // minmax must be checked first — Gemini may return "min" when the question
  // says "min and max", so we detect it from the question before short-circuiting.
  const q = question.toLowerCase();
  if (
    /\b(min|minimum)\b.*\b(max|maximum)\b/.test(q) ||
    /\b(max|maximum)\b.*\b(min|minimum)\b/.test(q)
  ) return "minmax";

  if (isAggregation(requestedAggregation)) {
    return requestedAggregation.toLowerCase() as Aggregation;
  }
  if (/\b(avg|average|mean)\b/.test(q))        return "avg";
  // "sum of orders" / "total orders" = count of order entities, not monetary sum.
  // Negative lookahead guards against "total order value/amount/revenue".
  if (
    /\b(count|number of|how many|by orders?|orders? count)\b/.test(q) ||
    /\bsum of (?:all )?orders?\b(?!\s*(?:amount|value|revenue|price|cost|subtotal))/.test(q) ||
    /\btotal orders?\b(?!\s*(?:amount|value|revenue|price|cost|subtotal))/.test(q) ||
    /\b(highest|most|fewest|lowest|least|greatest)\s+orders?\b/.test(q) ||
    /\borders?\s+(?:as|by|per|in)\b/.test(q)
  ) return "count";
  if (/\b(min|minimum)\b/.test(q))              return "min";
  if (/\b(max|maximum)\b/.test(q))              return "max";
  return "sum";
}

export function detectCalculation(
  question: string,
  requestedCalculation?: unknown,
): Calculation {
  if (typeof requestedCalculation === "string") {
    const c = requestedCalculation.toLowerCase();
    if (["percentage", "percent", "share"].includes(c))                          return "percentage";
    if (c === "ratio")                                                            return "ratio";
    if (["yearOverYearGrowth", "year-over-year-growth", "yoy", "growth"].includes(c)) return "yearOverYearGrowth";
  }

  const q = question.toLowerCase();
  if (/\b(year over year|year-over-year|yoy|growth|compared to previous year)\b/.test(q)) return "yearOverYearGrowth";
  if (/\b(percentage|percent|share)\b|%/.test(q))                                         return "percentage";
  if (/\b(ratio|per)\b/.test(q))                                                           return "ratio";
  return detectAggregation(question, requestedCalculation);
}

export function buildAggregateExpression(
  aggregation: Aggregation,
  valueExpression: string,
  countExpression = "*",
): string {
  switch (aggregation) {
    case "count": return `COUNT(${countExpression})`;
    case "avg":   return `ROUND(AVG(${valueExpression}), 2)`;
    case "min":   return `ROUND(MIN(${valueExpression}), 2)`;
    case "max":   return `ROUND(MAX(${valueExpression}), 2)`;
    default:      return `ROUND(SUM(${valueExpression}), 2)`;
  }
}

export function buildPercentageExpression(numeratorExpression: string, denominatorSql: string): string {
  return `ROUND((${numeratorExpression}) * 100.0 / NULLIF((${denominatorSql}), 0), 2)`;
}

export function buildRatioExpression(numeratorExpression: string, denominatorExpression: string): string {
  return `ROUND((${numeratorExpression}) * 1.0 / NULLIF((${denominatorExpression}), 0), 2)`;
}
