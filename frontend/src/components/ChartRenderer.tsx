import React from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { Bar, Line, Pie } from "react-chartjs-2";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

const PALETTE = [
  "rgba(59,130,246,0.8)",
  "rgba(16,185,129,0.8)",
  "rgba(249,115,22,0.8)",
  "rgba(168,85,247,0.8)",
  "rgba(236,72,153,0.8)",
  "rgba(234,179,8,0.8)",
  "rgba(20,184,166,0.8)",
  "rgba(239,68,68,0.8)",
];

export interface ChartDataset {
  label: string;
  data: number[];
  chartType: string;
}

export interface ChartRenderData {
  labels: string[];
  datasets: ChartDataset[];
}

export interface ChartConfigProps {
  chartType: string;
  dataset: string;
  groupBy?: string;
  title?: string;
}

interface Props {
  config: ChartConfigProps;
  data: ChartRenderData;
}

export function ChartRenderer({ config, data }: Props) {
  if (!data.labels.length) {
    return (
      <p className="text-gray-500 text-center">No data available for this query.</p>
    );
  }

  const colors = data.labels.map((_, i) => PALETTE[i % PALETTE.length]);
  const dataset = data.datasets[0];

  const chartJsData = {
    labels: data.labels,
    datasets: [
      {
        label: config.title ?? config.dataset,
        data: dataset.data,
        backgroundColor: colors,
        borderColor: colors.map((c) => c.replace("0.8", "1")),
        borderWidth: 1,
        fill: false,
        tension: 0.3,
        pointRadius: 4,
      },
    ],
  };

  const baseOptions = {
    responsive: true,
    plugins: {
      legend: { position: "top" as const, labels: { color: "#d1d5db" } },
      title: { display: !!config.title, text: config.title ?? "", color: "#d1d5db" },
    },
  };

  const axisOptions = {
    ...baseOptions,
    scales: {
      y: {
        beginAtZero: true,
        ticks: { color: "#9ca3af" },
        grid: { color: "rgba(255,255,255,0.05)" },
      },
      x: {
        ticks: { color: "#9ca3af", maxRotation: 45 },
        grid: { color: "rgba(255,255,255,0.05)" },
      },
    },
  };

  if (config.chartType === "line") {
    return <Line data={chartJsData} options={axisOptions} />;
  }
  if (config.chartType === "pie" || config.chartType === "donut") {
    return <Pie data={chartJsData} options={baseOptions} />;
  }
  return <Bar data={chartJsData} options={axisOptions} />;
}
