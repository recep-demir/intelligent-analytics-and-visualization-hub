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
