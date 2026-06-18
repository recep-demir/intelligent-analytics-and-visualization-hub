export type ChartType =
  | "bar"
  | "line"
  | "grid"
  | "heatmap"
  | "pie"
  | "donut"
  | "map"
  | "stat"
  | "treemap";

export type GroupByValue =
  | "province"
  | "month"
  | "year"
  | "category"
  | "productGroup"
  | "product"
  | "status"
  | "total"
  | "none";

export type Operator = "eq" | "gt" | "lt" | "gte" | "lte" | "contains";

export interface Filter {
  field: string;
  operator: Operator;
  value: string;
}

export type Metric = "subtotal" | "tax" | "total" | "both";

export interface ChartConfig {
  chartType: ChartType; // required
  dataset: string; // required — must match a SQLite table or view name
  filters?: Filter[]; // optional — omit or pass [] for no filters
  groupBy?: GroupByValue; // optional — field name to group results by
  title?: string; // optional — frontend shows a default if omitted
  limit?: number; // optional — controls the max rows returned
  aggregation?: "sum" | "avg" | "count" | "min" | "max"; // optional — aggregation function; defaults to "sum"
  metric?: Metric; // optional — which Orders money field to aggregate (default: subtotal = pre-tax revenue)
}

export interface Dataset {
  label: string;
  data: number[];
  chartType: ChartType;
}

export interface ChartData {
  labels: string[];
  datasets: Dataset[];
}
