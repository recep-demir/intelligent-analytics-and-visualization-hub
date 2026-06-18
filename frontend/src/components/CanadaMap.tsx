import { useState, useCallback } from "react";
import {
  ComposableMap,
  Geographies,
  Geography,
  Marker,
} from "react-simple-maps";

const CANADA_GEO = "/canada-provinces.json";

const PROVINCE_LABELS: {
  province: string;
  capital: string;
  coords: [number, number];
  anchor: "middle" | "start" | "end";
  dx: number;
  dy: number;
}[] = [
  {
    province: "British Columbia",
    capital: "Victoria",
    coords: [-123.37, 48.43],
    anchor: "end",
    dx: -3,
    dy: -4,
  },
  {
    province: "Alberta",
    capital: "Edmonton",
    coords: [-113.49, 53.55],
    anchor: "middle",
    dx: 0,
    dy: -4,
  },
  {
    province: "Saskatchewan",
    capital: "Regina",
    coords: [-104.62, 50.45],
    anchor: "middle",
    dx: 0,
    dy: -4,
  },
  {
    province: "Manitoba",
    capital: "Winnipeg",
    coords: [-97.14, 49.9],
    anchor: "middle",
    dx: 0,
    dy: -4,
  },
  {
    province: "Ontario",
    capital: "Toronto",
    coords: [-79.38, 43.65],
    anchor: "start",
    dx: 3,
    dy: -4,
  },
  {
    province: "Quebec",
    capital: "Quebec City",
    coords: [-71.21, 46.81],
    anchor: "end",
    dx: -4,
    dy: -3,
  },
  {
    province: "New Brunswick",
    capital: "Fredericton",
    coords: [-66.64, 45.96],
    anchor: "start",
    dx: 4,
    dy: 6,
  },
  {
    province: "Nova Scotia",
    capital: "Halifax",
    coords: [-63.58, 44.65],
    anchor: "start",
    dx: 4,
    dy: 7,
  },
  {
    province: "Prince Edward Island",
    capital: "Charlottetown",
    coords: [-63.13, 46.24],
    anchor: "end",
    dx: -4,
    dy: 6,
  },
  {
    province: "Newfoundland and Labrador",
    capital: "St. John's",
    coords: [-52.71, 47.56],
    anchor: "start",
    dx: 3,
    dy: -4,
  },
  {
    province: "Yukon",
    capital: "Whitehorse",
    coords: [-135.06, 60.72],
    anchor: "start",
    dx: 3,
    dy: -4,
  },
  {
    province: "Northwest Territories",
    capital: "Yellowknife",
    coords: [-114.37, 62.45],
    anchor: "middle",
    dx: 0,
    dy: -4,
  },
  {
    province: "Nunavut",
    capital: "Iqaluit",
    coords: [-68.52, 63.75],
    anchor: "end",
    dx: -3,
    dy: -4,
  },
];

function normalizeProvince(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function heatColor(t: number): string {
  const r = Math.round(59 + (239 - 59) * t);
  const g = Math.round(130 + (68 - 130) * t);
  const b = Math.round(246 + (68 - 246) * t);
  return `rgb(${r},${g},${b})`;
}

function formatVal(v: number, aggregation?: string): string {
  if (aggregation === "count") {
    if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
    if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
    return String(Math.round(v));
  }
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}K`;
  return `$${Number(v).toFixed(2)}`;
}

function getTooltipPos(
  e: MouseEvent,
  target: SVGElement,
): { x: number; y: number } {
  const rect = target.closest(".rounded-xl")!.getBoundingClientRect();
  return { x: e.clientX - rect.left, y: e.clientY - rect.top };
}

function VerticalLegend({
  minV,
  maxV,
  agg,
  label,
}: {
  minV: number;
  maxV: number;
  agg?: string;
  label: string;
}) {
  return (
    <div className="flex flex-col items-center justify-between py-2 w-20 shrink-0">
      <span className="text-xs text-gray-400 text-center mb-1 uppercase tracking-wider leading-tight">
        {label}
      </span>
      <span className="text-sm font-bold text-white text-center leading-tight">
        {formatVal(maxV, agg)}
      </span>
      <div
        className="flex-1 w-5 rounded-full my-3"
        style={{
          background: "linear-gradient(to bottom, #ef4444, #8b5cf6, #3b82f6)",
          minHeight: "200px",
        }}
      />
      <span className="text-sm font-bold text-white text-center leading-tight">
        {formatVal(minV, agg)}
      </span>
      <span className="text-xs text-gray-500 text-center mt-1 leading-tight">
        ← low
      </span>
    </div>
  );
}

interface TooltipState {
  text: string;
  x: number;
  y: number;
}

interface Props {
  data: { name: string; value: number; orders?: number }[];
  aggregation?: string;
  legend?: string;
}

export function CanadaMap({ data, aggregation, legend = "Value" }: Props) {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  const lookup: Record<string, number> = {};
  const ordersLookup: Record<string, number> = {};
  data.forEach((d) => {
    lookup[normalizeProvince(d.name)] = d.value;
    if (d.orders !== undefined)
      ordersLookup[normalizeProvince(d.name)] = d.orders;
  });

  const vals = Object.values(lookup);
  const maxV = vals.length ? Math.max(...vals) : 1;
  const minV = vals.length ? Math.min(...vals) : 0;
  const range = maxV - minV || 1;

  const MARITIMES = [
    "New Brunswick",
    "Nova Scotia",
    "Prince Edward Island",
    "Newfoundland and Labrador",
    "Newfoundland",
  ];
  const hasMaritimeData = MARITIMES.some(
    (p) => (lookup[normalizeProvince(p)] ?? 0) > 0,
  );

  const buildTooltip = useCallback(
    (rawName: string, name: string, val: number): string => {
      const orders = ordersLookup[name];
      const ordersStr =
        orders !== undefined ? `  ·  ${formatVal(orders, "count")} orders` : "";
      return `${rawName}  ·  ${val ? formatVal(val, aggregation) : "No data"}${ordersStr}`;
    },
    [ordersLookup, aggregation],
  );

  return (
    <div className="w-full">
      <div className="flex items-stretch gap-4">
        <div className="flex-1 relative">
          <div
            className="rounded-xl overflow-hidden border border-gray-800/60 bg-[#0d1117] relative"
            onMouseMove={(e) => {
              if (!tooltip) return;
              const rect = e.currentTarget.getBoundingClientRect();
              setTooltip((t) =>
                t
                  ? { ...t, x: e.clientX - rect.left, y: e.clientY - rect.top }
                  : null,
              );
            }}
          >
            {tooltip && (
              <div
                className="pointer-events-none absolute z-20 text-sm font-bold text-white bg-gray-800 border border-gray-500 px-3 py-1.5 rounded-lg shadow-xl whitespace-nowrap"
                style={{ left: tooltip.x + 12, top: tooltip.y - 36 }}
              >
                {tooltip.text}
              </div>
            )}

            <ComposableMap
              projection="geoAzimuthalEqualArea"
              projectionConfig={{ rotate: [96, -60, 0], scale: 500 }}
              width={800}
              height={430}
              style={{ width: "100%", height: "auto", display: "block" }}
            >
              <Geographies geography={CANADA_GEO}>
                {({ geographies }) =>
                  geographies.map(
                    (geo: {
                      rsmKey: string;
                      properties: Record<string, unknown>;
                    }) => {
                      const rawName =
                        (geo.properties.name as string | null) ?? "";
                      if (!rawName) return null;
                      const name = normalizeProvince(rawName);
                      const val = lookup[name] ?? 0;
                      const t = val ? (val - minV) / range : 0;
                      return (
                        <Geography
                          key={geo.rsmKey}
                          geography={geo}
                          fill={val ? heatColor(t) : "#1e2939"}
                          fillOpacity={val ? 0.9 : 0.4}
                          stroke="#374151"
                          strokeWidth={0.4}
                          onMouseEnter={(e) => {
                            const pos = getTooltipPos(
                              e as unknown as MouseEvent,
                              e.currentTarget as SVGElement,
                            );
                            setTooltip({
                              text: buildTooltip(rawName, name, val),
                              ...pos,
                            });
                          }}
                          onMouseLeave={() => setTooltip(null)}
                          style={{
                            default: { outline: "none" },
                            hover: {
                              outline: "none",
                              fillOpacity: 0.65,
                              cursor: "pointer",
                            },
                            pressed: { outline: "none" },
                          }}
                        />
                      );
                    },
                  )
                }
              </Geographies>
              {PROVINCE_LABELS.map(
                ({ province, capital, coords, anchor, dx, dy }) => (
                  <Marker key={province} coordinates={coords}>
                    <circle
                      r={2.5}
                      fill="#ffffff"
                      fillOpacity={0.9}
                      stroke="#0d1117"
                      strokeWidth={0.6}
                      style={{ cursor: "pointer" }}
                      onMouseEnter={(e) => {
                        const normProv = normalizeProvince(province);
                        const val = lookup[normProv] ?? 0;
                        const orders = ordersLookup[normProv];
                        const ordersStr =
                          orders !== undefined
                            ? `  ·  ${formatVal(orders, "count")} orders`
                            : "";
                        const pos = getTooltipPos(
                          e as unknown as MouseEvent,
                          e.currentTarget as SVGElement,
                        );
                        setTooltip({
                          text: `${capital} (${province})${val ? `  ·  ${formatVal(val, aggregation)}` : ""}${ordersStr}`,
                          ...pos,
                        });
                      }}
                      onMouseLeave={() => setTooltip(null)}
                    />
                    <text
                      textAnchor={anchor}
                      x={dx}
                      y={dy}
                      style={{
                        fontSize: "7px",
                        fill: "#d1d5db",
                        fontFamily: "sans-serif",
                        pointerEvents: "none",
                      }}
                    >
                      {capital}
                    </text>
                  </Marker>
                ),
              )}
            </ComposableMap>
          </div>

          {hasMaritimeData && (
            <div className="hidden md:block absolute top-4 right-4 z-10 w-48 h-32 rounded-lg border border-gray-600/70 bg-[#0d1117]/90 overflow-hidden shadow-xl backdrop-blur-sm">
              <div className="text-[10px] font-bold text-gray-400 tracking-widest uppercase px-2 pt-1.5">
                Maritimes · zoomed
              </div>
              <ComposableMap
                projection="geoAzimuthalEqualArea"
                projectionConfig={{ rotate: [63, -46, 0], scale: 3200 }}
                width={280}
                height={180}
                style={{ width: "100%", height: "auto", display: "block" }}
              >
                <Geographies geography={CANADA_GEO}>
                  {({ geographies }) =>
                    geographies.map(
                      (geo: {
                        rsmKey: string;
                        properties: Record<string, unknown>;
                      }) => {
                        const rawName =
                          (geo.properties.name as string | null) ?? "";
                        if (!rawName) return null;
                        const name = normalizeProvince(rawName);
                        const val = lookup[name] ?? 0;
                        const t = val ? (val - minV) / range : 0;
                        return (
                          <Geography
                            key={geo.rsmKey}
                            geography={geo}
                            fill={val ? heatColor(t) : "#1e2939"}
                            fillOpacity={val ? 0.9 : 0.35}
                            stroke="#374151"
                            strokeWidth={0.8}
                            onMouseEnter={(e) => {
                              const pos = getTooltipPos(
                                e as unknown as MouseEvent,
                                e.currentTarget as SVGElement,
                              );
                              setTooltip({
                                text: buildTooltip(rawName, name, val),
                                ...pos,
                              });
                            }}
                            onMouseLeave={() => setTooltip(null)}
                            style={{
                              default: { outline: "none" },
                              hover: {
                                outline: "none",
                                fillOpacity: 0.65,
                                cursor: "pointer",
                              },
                              pressed: { outline: "none" },
                            }}
                          />
                        );
                      },
                    )
                  }
                </Geographies>
              </ComposableMap>
            </div>
          )}
        </div>

        <VerticalLegend
          minV={minV}
          maxV={maxV}
          agg={aggregation}
          label={legend}
        />
      </div>
    </div>
  );
}
