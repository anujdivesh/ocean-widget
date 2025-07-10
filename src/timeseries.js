import React, { useEffect, useState } from "react";
import 'chart.js/auto';
import { Line } from "react-chartjs-2";

// Fixed color palette for datasets
const fixedColors = [
  'rgb(255, 99, 132)',   // 0: hs
  'rgb(54, 162, 235)',   // 1: tpeak
  'rgb(255, 206, 86)',   // 2: dirp
  'rgb(75, 192, 192)',
  'rgb(153, 102, 255)',
];

function extractCoverageTimeseries(json, variable) {
  if (
    !json ||
    !json.domain ||
    !json.domain.axes ||
    !json.domain.axes.t ||
    !json.domain.axes.t.values ||
    !json.ranges ||
    !json.ranges[variable] ||
    !json.ranges[variable].values
  )
    return null;
  const times = json.domain.axes.t.values;
  const values = json.ranges[variable].values;
  return { times, values };
}

function Timeseries({ perVariableData }) {
  const [series, setSeries] = useState([]);
  const [labels, setLabels] = useState([]);
  const [error, setError] = useState("");
  const [parentHeight, setParentHeight] = useState(undefined);

  // Dynamically read parent height (Offcanvas.Body)
  useEffect(() => {
    const el = document.querySelector('.offcanvas-body');
    if (el) {
      setParentHeight(el.clientHeight - 36);
    }
    const observer = el
      ? new ResizeObserver(() => setParentHeight(el.clientHeight - 36))
      : null;
    if (observer && el) observer.observe(el);
    return () => observer && observer.disconnect();
  }, [perVariableData]);

  useEffect(() => {
    let isMounted = true;
    if (!perVariableData) {
      setSeries([]);
      setLabels([]);
      setError("No timeseries data available.");
      return;
    }

    // Order: hs, tpeak, dirp
    const layers = [
      { key: "hs", label: "Significant Wave Height", yAxisID: "hs", type: "line", colorIdx: 0 },
      { key: "tpeak", label: "Peak Wave Period", yAxisID: "tpeak", type: "line", colorIdx: 1 },
      { key: "dirp", label: "Mean Wave Direction", yAxisID: "dirp", type: "scatter", colorIdx: 2 },
    ];
    const results = [];
    let newLabels = [];

    for (let idx = 0; idx < layers.length; idx++) {
      const { key, label, yAxisID, type, colorIdx } = layers[idx];
      const color = fixedColors[colorIdx % fixedColors.length];
      const tsJson = perVariableData[key];
      const ts = extractCoverageTimeseries(tsJson, key);
      if (ts && ts.times && ts.values) {
        if (newLabels.length === 0) {
          newLabels = ts.times.map(v =>
            typeof v === "string" && v.length > 15 ? v.substring(0, 16).replace("T", " ") : v
          );
        }
        if (type === "line") {
          results.push({
            label,
            data: ts.values,
            fill: false,
            backgroundColor: color.replace('rgb', 'rgba').replace(')', ', 0.2)'),
            borderColor: color,
            tension: 0.3,
            yAxisID,
            pointRadius: 2,
            showLine: true,
            type: 'line'
          });
        } else if (type === "scatter") {
          results.push({
            label,
            data: ts.values,
            fill: false,
            borderColor: color,
            backgroundColor: color,
            yAxisID,
            showLine: false,
            pointRadius: 4,
            type: 'scatter'
          });
        }
      }
    }
    if (!isMounted) return;
    setLabels(newLabels);
    setSeries(results);
    if (results.length === 0) setError("No timeseries data returned.");
    else setError("");
    return () => {
      isMounted = false;
    };
  }, [perVariableData]);

  if (!perVariableData) return <div>No data available.</div>;
  if (error) return <div style={{ color: "red" }}>{error}</div>;
  if (series.length === 0) return <div>No timeseries data.</div>;

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
        mode: 'nearest',
        intersect: false,
      },
    plugins: {
      legend: { position: "top" },
    },
    scales: {
      hs: { type: "linear", display: true, position: "left", title: { display: true, text: "Height (m)" } },
      tpeak: { type: "linear", display: true, position: "right", title: { display: true, text: "Period (s)" }, grid: { drawOnChartArea: false } },
      dirp: { type: "linear", display: true, position: "right", title: { display: true, text: "Direction (°)" }, grid: { drawOnChartArea: false } },
    },
    elements: {
      point: {
        radius: 3
      }
    }
  };

  return (
    <div style={{ width: "100%", height: parentHeight ? `${parentHeight}px` : "100%" }}>
      <Line data={{ labels, datasets: series }} options={options} />
    </div>
  );
}

export default Timeseries;