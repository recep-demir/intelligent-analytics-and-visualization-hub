import { AIEngine } from '../../../../shared/types/ai'
import { ChartConfig, ChartType } from '../../../../shared/types/chart'

// Rule-based fallback engine — no external API, no cost, works offline
// Handles predictable patterns only. Use GeminiEngine for complex queries.
export class LocalEngine implements AIEngine {

  async resolve(nl: string, _schemaSdl: string): Promise<ChartConfig> {
    const q = nl.toLowerCase()

    return {
      chartType:  this.detectChartType(q),
      dataset:    this.detectDataset(q),
      filters:    this.detectFilters(q),
      groupBy:    this.detectGroupBy(q),
      title:      nl,
    }
  }

  private detectChartType(q: string): ChartType {
    if (q.includes('map'))                          return 'map'
    if (q.includes('pie'))                          return 'pie'
    if (q.includes('donut'))                        return 'donut'
    if (q.includes('heatmap'))                      return 'heatmap'
    if (q.includes('line') || q.includes('trend'))  return 'line'
    if (q.includes('table') || q.includes('list'))  return 'grid'
    return 'bar'
  }

  private detectDataset(q: string): string {
    if (q.includes('town') || q.includes('city'))   return 'towns'
    return 'tax_records'
  }

  private detectGroupBy(q: string): string | undefined {
    if (q.includes('province'))   return 'province'
    if (q.includes('city'))       return 'city'
    if (q.includes('country'))    return 'country'
    if (q.includes('year'))       return 'year'
    if (q.includes('month'))      return 'month'
    if (q.includes('category'))   return 'category'
    return undefined
  }

  private detectFilters(q: string): ChartConfig['filters'] {
    const filters: ChartConfig['filters'] = []

    // Country filter
    if (q.includes('canada') || q.includes(' ca '))
      filters.push({ field: 'country', operator: 'eq', value: 'CA' })
    else if (q.includes('united states') || q.includes(' us '))
      filters.push({ field: 'country', operator: 'eq', value: 'US' })

    // Province filter
    const provinces = [
      'ontario', 'quebec', 'british columbia', 'alberta',
      'manitoba', 'saskatchewan', 'nova scotia', 'new brunswick',
      'newfoundland', 'prince edward island', 'yukon',
      'northwest territories', 'nunavut',
    ]
    for (const p of provinces) {
      if (q.includes(p)) {
        filters.push({ field: 'province', operator: 'eq', value: this.toTitleCase(p) })
        break
      }
    }

    // Year filter — match 4-digit year
    const yearMatch = q.match(/\b(20\d{2})\b/)
    if (yearMatch)
      filters.push({ field: 'year', operator: 'eq', value: yearMatch[1] })

    return filters
  }

  private toTitleCase(str: string): string {
    return str.replace(/\b\w/g, c => c.toUpperCase())
  }
}
