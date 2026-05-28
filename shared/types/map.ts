export interface ProvinceDataPoint {
  province: string   // must match GeoJSON name exactly e.g. "Ontario"
  value:    number   // tax figure that determines colour intensity
  label:    string   // display text e.g. "$2.4B"
}

export interface TownDataPoint {
  name:  string   // town name e.g. "Whitehorse"
  lat:   number
  lng:   number
  value: number
  label: string   // display text e.g. "$4.2M"
}
