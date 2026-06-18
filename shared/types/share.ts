import { ChartConfig } from './chart'

export interface ShareLink {
  id:          number
  uuid:        string
  queryConfig: ChartConfig
  createdBy:   number   // user id
  createdAt:   number
}

export interface CreateShareRequest {
  queryConfig: ChartConfig
}

export interface CreateShareResponse {
  uuid: string
  url:  string
}
// ── APPEND AFTER LINE 19 ──────────────────────────────────────────

export interface DashboardSharePayload {
  filtersJson: string
  title?:      string
}

export interface DashboardShareCreateResponse {
  shareId: string
}

export interface DashboardShareGetResponse {
  shareId:     string
  filtersJson: string
  title:       string | null
  role:        'admin' | 'analyst' | 'viewer'
  interactive: boolean
}