import React, { useRef, useState, useEffect } from "react";
import Offcanvas from "react-bootstrap/Offcanvas";
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

const MIN_HEIGHT = 100;
const MAX_HEIGHT = 800;

const MODEL_VARIABLES = ["hs", "tpeak", "dirp"];
const MODEL_BASE_URL =
  "https://gemthreddshpc.spc.int/thredds/wms/POP/model/country/spc/forecast/hourly/NIU/ForecastNiue_latest.nc?REQUEST=GetTimeseries&LAYERS={layer}&QUERY_LAYERS={layer}&BBOX=-169.91273760795596%2C-18.980304292913193%2C-169.89213824272156%2C-18.973273303415304&SRS=CRS:84&FEATURE_COUNT=5&HEIGHT=693&WIDTH=1920&X=948&Y=147&STYLES=default/default&VERSION=1.1.1&TIME=2025-07-08T18%3A00%3A00.000Z%2F2025-07-15T18%3A00%3A00.000Z&INFO_FORMAT=text/json";

async function fetchModelVariable(layer) {
  const url = MODEL_BASE_URL.replace(/{layer}/g, layer);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Model API error for ${layer}`);
  const json = await res.json();
  return { layer, json };
}

async function fetchAllModelVariables() {
  const fetches = MODEL_VARIABLES.map(fetchModelVariable);
  // Results: [{ layer: "hs", json: {...} }, ...]
  return Promise.all(fetches);
}

function extractModelVariables(model, variables) {
  // Always return arrays for requested variables, fill with nulls if missing
  const result = {};
  const N = model.domain.axes.t.values.length;
  for (const v of variables) {
    if (model.ranges && model.ranges[v]) {
      result[v] = {
        values: model.ranges[v].values,
        label:
          (model.parameters &&
            model.parameters[v] &&
            (model.parameters[v].description?.en ||
              model.parameters[v].observedProperty?.label?.en ||
              v)) ||
          v,
      };
    } else {
      // Fill with nulls so axes always appear, but line will not show
      result[v] = {
        values: Array(N).fill(null),
        label: v,
      };
    }
  }
  return result;
}

function BottomBuoyOffCanvas({ show, onHide, buoyId }) {
  const [height, setHeight] = useState(400);
  const [activeTab, setActiveTab] = useState("buoy");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState("");
  const [parentHeight, setParentHeight] = useState(undefined);

  // Model state
  const [modelData, setModelData] = useState(null);
  const [modelLoading, setModelLoading] = useState(false);
  const [modelError, setModelError] = useState("");

  // Drag handle logic
  const dragging = useRef(false);
  const startY = useRef(0);
  const startHeight = useRef(400);
  const onMouseDown = (e) => {
    dragging.current = true;
    startY.current = e.clientY;
    startHeight.current = height;
    document.body.style.cursor = "ns-resize";
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  };
  const onMouseMove = (e) => {
    if (!dragging.current) return;
    let newHeight = startHeight.current - (e.clientY - startY.current);
    newHeight = Math.min(Math.max(newHeight, MIN_HEIGHT), MAX_HEIGHT);
    setHeight(newHeight);
  };
  const onMouseUp = () => {
    dragging.current = false;
    document.body.style.cursor = "";
    document.removeEventListener("mousemove", onMouseMove);
    document.removeEventListener("mouseup", onMouseUp);
  };

  // Chart dynamic height based on Offcanvas.Body
  useEffect(() => {
    let timer = null;
    let observer = null;
    function measure() {
      const el = document.querySelector('.offcanvas-body');
      if (el) setParentHeight(el.clientHeight - 36);
    }
    if (show) {
      timer = setTimeout(measure, 250);
      const el = document.querySelector('.offcanvas-body');
      if (el && window.ResizeObserver) {
        observer = new window.ResizeObserver(measure);
        observer.observe(el);
      }
    }
    return () => {
      if (timer) clearTimeout(timer);
      if (observer) observer.disconnect();
    };
  }, [show, buoyId]);

  // Fetch Sofarocean data when buoyId changes and panel is open
  useEffect(() => {
    if (!show || !buoyId) return;
    setLoading(true);
    setFetchError("");
    setData(null);
    const token = "2a348598f294c6b0ce5f7e41e5c0f5";
    const url = `https://api.sofarocean.com/api/wave-data?spotterId=${buoyId}&token=${token}&includeWindData=false&includeDirectionalMoments=true&includeSurfaceTempData=true&limit=100&includeTrack=true`;
    fetch(url)
      .then(res => {
        if (!res.ok) throw new Error("API error");
        return res.json();
      })
      .then(json => {
        setData(json.data);
        setLoading(false);
      })
      .catch(e => {
        setFetchError("Failed to fetch buoy data");
        setLoading(false);
      });
  }, [buoyId, show]);

  // Fetch model data for all variables in parallel
  useEffect(() => {
    if (!show) return;
    setModelLoading(true);
    setModelError("");
    setModelData(null);

    fetchAllModelVariables()
      .then(results => {
        // Use the first result's domain as base (all should match)
        const domain = results[0].json.domain;
        const parameters = {};
        const ranges = {};
        results.forEach(({ layer, json }) => {
          parameters[layer] = json.parameters[layer] || { description: { en: layer } };
          ranges[layer] = json.ranges[layer];
        });
        setModelData({ domain, parameters, ranges });
        setModelLoading(false);
      })
      .catch(e => {
        setModelError("Failed to fetch model data");
        setModelLoading(false);
      });
  }, [show]);

  // Prepare chart data and formatting for Sofarocean
  let chartData = null;
  let chartOptions = {};
  if (activeTab === "buoy" && data && data.waves && data.waves.length > 0) {
    const waves = data.waves;
    const labels = waves.map(w =>
      typeof w.timestamp === "string" && w.timestamp.length > 15
        ? w.timestamp.substring(0, 16).replace("T", " ")
        : w.timestamp
    );
    chartData = {
      labels,
      datasets: [
        {
          label: "Significant Wave Height (m)",
          data: waves.map(w => w.significantWaveHeight),
          fill: false,
          backgroundColor: fixedColors[0].replace("rgb", "rgba").replace(")", ", 0.2)"),
          borderColor: fixedColors[0],
          tension: 0.3,
          yAxisID: "hs",
          pointRadius: 2,
          showLine: true,
          type: "line"
        },
        {
          label: "Mean Period (s)",
          data: waves.map(w => w.meanPeriod),
          fill: false,
          backgroundColor: fixedColors[1].replace("rgb", "rgba").replace(")", ", 0.2)"),
          borderColor: fixedColors[1],
          tension: 0.3,
          yAxisID: "tpeak",
          pointRadius: 2,
          showLine: true,
          type: "line"
        },
        {
          label: "Mean Direction (°)",
          data: waves.map(w => w.meanDirection),
          fill: false,
          borderColor: fixedColors[2],
          backgroundColor: fixedColors[2],
          yAxisID: "dirp",
          showLine: false,
          pointRadius: 4,
          type: "scatter"
        }
      ]
    };
    chartOptions = {
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
  }

  // Prepare chart data for model
  let modelChartData = null;
  let modelChartOptions = {};
  let modelMissingVars = [];
  if (activeTab === "model" && modelData && modelData.domain && modelData.domain.axes && modelData.domain.axes.t) {
    // Always try to plot hs, tpeak, dirp
    const variables = MODEL_VARIABLES;
    const varMeta = extractModelVariables(modelData, variables);

    // Track missing variables
    modelMissingVars = variables.filter(v => !modelData.ranges || !modelData.ranges[v]);

    const labels = modelData.domain.axes.t.values.map(t =>
      t.length > 15 ? t.substring(0, 16).replace("T", " ") : t
    );

    let dsIdx = 0;
    const datasets = variables.map(v => {
      const meta = varMeta[v];
      const color = fixedColors[dsIdx % fixedColors.length];
      dsIdx++;
      let yAxisID = v;
      let type = v === "dirp" ? "scatter" : "line";
      let showLine = v !== "dirp";
      let pointRadius = v === "dirp" ? 4 : 2;
      return {
        label: meta.label || v,
        data: meta.values,
        fill: false,
        backgroundColor: color.replace("rgb", "rgba").replace(")", ", 0.2)"),
        borderColor: color,
        tension: 0.3,
        yAxisID,
        pointRadius,
        showLine,
        type
      };
    });

    modelChartData = {
      labels,
      datasets,
    };
    modelChartOptions = {
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
  }

  // Tab labels, you can add more tabs here in the future
  const tabLabels = [
    { key: "buoy", label: `Buoy: ${buoyId || ""}` },
    { key: "model", label: "Model" }
  ];

  return (
    <Offcanvas
      show={show}
      onHide={onHide}
      placement="bottom"
      style={{
        height: height,
        zIndex: 12000,
        background: "rgba(255,255,255,0.98)",
        overflow: "visible",
        transition: "height 0.1s",
      }}
      backdrop={false}
      scroll={true}
    >
      {/* Drag Handle */}
      <div
        style={{
          height: 12,
          cursor: "ns-resize",
          background: "#e0e0e0",
          borderTopLeftRadius: 8,
          borderTopRightRadius: 8,
          textAlign: "center",
          userSelect: "none",
          margin: "-8px 0 0 0",
        }}
        onMouseDown={onMouseDown}
        title="Drag to resize"
      >
        <div
          style={{
            width: 40,
            height: 4,
            background: "#aaa",
            borderRadius: 2,
            margin: "4px auto",
          }}
        />
      </div>
      <div style={{ display: "flex", alignItems: "center", borderBottom: "1px solid #eee", padding: "0 1rem 0 0.5rem" }}>
        {/* Custom CSS Tabs */}
        <div style={{ display: "flex", flex: 1, paddingTop: 10 }}>
          {tabLabels.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                border: "none",
                borderBottom: activeTab === tab.key ? "2px solid #007bff" : "2px solid transparent",
                background: "none",
                padding: "8px 20px",
                marginRight: 8,
                fontWeight: activeTab === tab.key ? "bold" : "normal",
                color: activeTab === tab.key ? "#007bff" : "#555",
                cursor: "pointer",
                fontSize: 16,
                transition: "border-bottom 0.1s"
              }}
              aria-selected={activeTab === tab.key}
              aria-controls={`tab-panel-${tab.key}`}
              tabIndex={activeTab === tab.key ? 0 : -1}
              type="button"
            >
              {tab.label}
            </button>
          ))}
        </div>
        <button
          onClick={onHide}
          type="button"
          aria-label="Close"
          style={{
            border: "none",
            background: "none",
            fontSize: 26,
            marginLeft: 8,
            color: "#666",
            cursor: "pointer",
            lineHeight: 1,
          }}
        >
          ×
        </button>
      </div>
      <Offcanvas.Body style={{ paddingTop: 16 }}>
        {activeTab === "buoy" && loading && <div style={{ textAlign: "center", padding: "2rem" }}>Loading buoy data...</div>}
        {activeTab === "buoy" && fetchError && <div style={{ color: "red", textAlign: "center" }}>{fetchError}</div>}
        {activeTab === "buoy" && !loading && !fetchError && chartData && (
          <div style={{ width: "100%", height: `${Math.max(height - 100, 100)}px` }}>
            <Line data={chartData} options={chartOptions} />
          </div>
        )}
        {activeTab === "buoy" && !loading && !fetchError && data && (!data.waves || data.waves.length === 0) && (
          <div style={{ textAlign: "center", color: "#999" }}>No data available for this buoy.</div>
        )}
        {activeTab === "model" && modelLoading && <div style={{ textAlign: "center", padding: "2rem" }}>Loading model data...</div>}
        {activeTab === "model" && modelError && <div style={{ color: "red", textAlign: "center" }}>{modelError}</div>}
        {activeTab === "model" && !modelLoading && !modelError && modelChartData && (
          <>
            <div style={{ width: "100%", height: `${Math.max(height - 100, 100)}px` }}>
              <Line data={modelChartData} options={modelChartOptions} />
            </div>
            {modelMissingVars.length > 0 && (
              <div style={{ color: "orange", textAlign: "center", paddingTop: 10 }}>
                No model data for: {modelMissingVars.join(', ')}
              </div>
            )}
          </>
        )}
        {activeTab === "model" && !modelLoading && !modelError && !modelChartData && (
          <div style={{ textAlign: "center", color: "#999" }}>No model data available.</div>
        )}
      </Offcanvas.Body>
    </Offcanvas>
  );
}

export default BottomBuoyOffCanvas;