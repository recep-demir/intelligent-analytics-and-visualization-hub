const AXIS_TITLE_STYLE = { display: true, color: "#64748b", font: { size: 11 } };

export function baseChartOptions(title: string, xLabel = "", yLabel = "") {
  return {
    responsive: true,
    plugins: {
      legend: { display: false },
      title: { display: true, text: title, color: "#e2e8f0", font: { size: 14 } },
    },
    scales: {
      x: {
        ticks: { color: "#94a3b8" },
        grid:  { color: "#1e293b" },
        title: { ...AXIS_TITLE_STYLE, text: xLabel },
      },
      y: {
        ticks: { color: "#94a3b8" },
        grid:  { color: "#1e293b" },
        title: { ...AXIS_TITLE_STYLE, text: yLabel },
      },
    },
  };
}

export function horizontalBarOptions(title: string, xLabel = "", yLabel = "") {
  return { ...baseChartOptions(title, xLabel, yLabel), indexAxis: "y" as const };
}
