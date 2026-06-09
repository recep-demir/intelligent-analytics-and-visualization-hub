export const supportedAggregations = ["sum", "avg", "count", "min", "max"] as const;

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
  if (isAggregation(requestedAggregation)) {
    return requestedAggregation.toLowerCase() as Aggregation;
  }

  const normalizedQuestion = question.toLowerCase();

  if (/\b(avg|average|mean)\b/.test(normalizedQuestion)) return "avg";
  if (/\b(count|number of|how many)\b/.test(normalizedQuestion)) return "count";
  if (/\b(min|minimum)\b/.test(normalizedQuestion)) return "min";
  if (/\b(max|maximum)\b/.test(normalizedQuestion)) return "max";

  return "sum";
}

export function detectCalculation(
  question: string,
  requestedCalculation?: unknown,
): Calculation {
  if (typeof requestedCalculation === "string") {
    const normalizedCalculation = requestedCalculation.toLowerCase();

    if (["percentage", "percent", "share"].includes(normalizedCalculation)) {
      return "percentage";
    }

    if (normalizedCalculation === "ratio") {
      return "ratio";
    }

    if (
      ["yearOverYearGrowth", "year-over-year-growth", "yoy", "growth"].includes(
        normalizedCalculation,
      )
    ) {
      return "yearOverYearGrowth";
    }
  }

  const normalizedQuestion = question.toLowerCase();

  if (/\b(year over year|year-over-year|yoy|growth|compared to previous year)\b/.test(normalizedQuestion)) {
    return "yearOverYearGrowth";
  }

  if (/\b(percentage|percent|share)\b|%/.test(normalizedQuestion)) {
    return "percentage";
  }

  if (/\b(ratio|per)\b/.test(normalizedQuestion)) {
    return "ratio";
  }

  return detectAggregation(question, requestedCalculation);
}

export function buildAggregateExpression(
  aggregation: Aggregation,
  valueExpression: string,
  countExpression = "*",
): string {
  switch (aggregation) {
    case "count":
      return `COUNT(${countExpression})`;
    case "avg":
      return `ROUND(AVG(${valueExpression}), 2)`;
    case "min":
      return `ROUND(MIN(${valueExpression}), 2)`;
    case "max":
      return `ROUND(MAX(${valueExpression}), 2)`;
    case "sum":
    default:
      return `ROUND(SUM(${valueExpression}), 2)`;
  }
}

export function buildPercentageExpression(
  numeratorExpression: string,
  denominatorSql: string,
): string {
  return `ROUND((${numeratorExpression}) * 100.0 / NULLIF((${denominatorSql}), 0), 2)`;
}

export function buildRatioExpression(
  numeratorExpression: string,
  denominatorExpression: string,
): string {
  return `ROUND((${numeratorExpression}) * 1.0 / NULLIF((${denominatorExpression}), 0), 2)`;
}
