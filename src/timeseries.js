import React, { useEffect, useState } from "react";
import Plot from 'react-plotly.js';

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
  const [plotData, setPlotData] = useState([]);
  const [labels, setLabels] = useState([]);
  const [error, setError] = useState("");
  const [parentHeight, setParentHeight] = useState(undefined);

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
      setPlotData([]);
      setLabels([]);
      setError("No timeseries data available.");
      return;
    }

    const layers = [
      { key: "hs", label: "Significant Wave Height", colorIdx: 0, yaxis: 'y1', type: 'scatter', mode: 'lines+markers' },
      { key: "tpeak", label: "Peak Wave Period", colorIdx: 1, yaxis: 'y2', type: 'scatter', mode: 'lines+markers' },
      { key: "dirp", label: "Mean Wave Direction", colorIdx: 2, yaxis: 'y3', type: 'scatter', mode: 'markers' },
    ];
    let newLabels = [];
    const traces = [];
    for (let idx = 0; idx < layers.length; idx++) {
      const { key, label, colorIdx, yaxis, type, mode } = layers[idx];
      const color = fixedColors[colorIdx % fixedColors.length];
      const tsJson = perVariableData[key];
      const ts = extractCoverageTimeseries(tsJson, key);
      if (ts && ts.times && ts.values) {
        if (newLabels.length === 0) {
          newLabels = ts.times.map(v =>
            typeof v === "string" && v.length > 15 ? v.substring(0, 16).replace("T", " ") : v
          );
        }
        traces.push({
          x: newLabels,
          y: ts.values,
          name: label,
          type,
          mode,
          marker: { color },
          line: { color },
          yaxis,
        });
      }
    }
    if (!isMounted) return;
    setLabels(newLabels);
    setPlotData(traces);
    if (traces.length === 0) setError("No timeseries data returned.");
    else setError("");
    return () => {
      isMounted = false;
    };
  }, [perVariableData]);

  if (!perVariableData) return <div>No data available.</div>;
  if (error) return <div style={{ color: "red" }}>{error}</div>;
  if (plotData.length === 0) return <div>No timeseries data.</div>;

  const layout = {
    autosize: true,
    height: parentHeight || 400,
    margin: { t: 40, l: 60, r: 60, b: 60 },
    legend: { orientation: 'h', y: -0.2 },
    xaxis: { title: 'Time', tickangle: -45 },
    yaxis: { title: 'Height (m)', side: 'left' },
    yaxis2: {
      title: 'Period (s)',
      overlaying: 'y',
      side: 'right',
      showgrid: false,
    },
    yaxis3: {
      title: 'Direction (°)',
      overlaying: 'y',
      side: 'right',
      position: 1,
      showgrid: false,
    },
    showlegend: true,
  };

  // Map yaxis for each trace
  plotData.forEach((trace, idx) => {
    if (idx === 0) trace.yaxis = 'y1';
    if (idx === 1) trace.yaxis = 'y2';
    if (idx === 2) trace.yaxis = 'y3';
  });

  return (
    <div style={{ width: "100%", height: parentHeight ? `${parentHeight}px` : "100%" }}>
      <Plot
        data={plotData}
        layout={layout}
        useResizeHandler={true}
        style={{ width: '100%', height: '100%' }}
        config={{ responsive: true }}
      />
    </div>
  );
}

export default Timeseries;