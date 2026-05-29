export type ChartType = 'bar' | 'line' | 'grid' | 'heatmap' | 'pie' | 'donut' | 'map'
export type Operator  = 'eq' | 'gt' | 'lt' | 'contains'

export interface Filter {
  field:    string
  operator: Operator
  value:    string
}

export interface ChartConfig {
  chartType: ChartType   // required
  dataset:   string      // required — must match a SQLite table or view name
  filters?:  Filter[]    // optional — omit or pass [] for no filters
  groupBy?:  string      // optional — field name to group results by
  title?:    string      // optional — frontend shows a default if omitted
}

export interface Dataset {
  label:     string
  data:      number[]
  chartType: ChartType
}

export interface ChartData {
  labels:   string[]
  datasets: Dataset[]
}
