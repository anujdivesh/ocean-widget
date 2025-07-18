import React, { useRef, useState, useEffect } from "react";
import Offcanvas from "react-bootstrap/Offcanvas";
import 'chart.js/auto';
import { Line } from "react-chartjs-2";
import 'chartjs-adapter-date-fns';

const fixedColors = [
  'rgb(255, 99, 132)',   // 0: hs
  'rgb(54, 162, 235)',   // 1: tm02
  'rgb(255, 206, 86)',   // 2: dirm
  'rgb(75, 192, 192)',
  'rgb(153, 102, 255)',
];

const MIN_HEIGHT = 100;
const MAX_HEIGHT = 800;

const MODEL_VARIABLES = ["hs", "tm02", "dirm"];
const MODEL_COMBINED_URL =
  "https://gemthreddshpc.spc.int/thredds/fileServer/POP/model/country/spc/forecast/hourly/NIU/combined_model.json";
const COMBINED_TAB_KEY = "combined";
const SPECIAL_BUOY_ID = "SPOT-31091C";

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

  // Fetch Sofarocean data
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

  // Fetch model data (ONLY for SPECIAL_BUOY_ID and when relevant tab is shown)
  useEffect(() => {
    if (!show || buoyId !== SPECIAL_BUOY_ID || (activeTab !== "model" && activeTab !== COMBINED_TAB_KEY)) {
      setModelData(null);
      setModelError("");
      setModelLoading(false);
      return;
    }
    setModelLoading(true);
    setModelError("");
    setModelData(null);
    fetch(MODEL_COMBINED_URL)
      .then(res => {
        if (!res.ok) throw new Error("Model API error");
        return res.json();
      })
      .then(json => {
        setModelData(json);
        setModelLoading(false);
      })
      .catch(e => {
        setModelError("Failed to fetch model data");
        setModelLoading(false);
      });
  }, [show, buoyId, activeTab]);

  // Chart data for Sofarocean
  let chartData = null;
  let chartOptions = {};
  if (data && data.waves && data.waves.length > 0) {
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
          yAxisID: "tm02",
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
          yAxisID: "dirm",
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
        mode: 'index',
        intersect: false,
      },
      plugins: {
        legend: { position: "top" },
      },
      scales: {
        hs: { type: "linear", display: true, position: "left", title: { display: true, text: "Height (m)" } },
        tm02: { type: "linear", display: true, position: "right", title: { display: true, text: "Period (s)" }, grid: { drawOnChartArea: false } },
        dirm: { type: "linear", display: true, position: "right", title: { display: true, text: "Direction (°)" }, grid: { drawOnChartArea: false } },
        x: {
          type: "category",
          title: { display: true, text: "Date (UTC)" }
        }
      },
      elements: {
        point: {
          radius: 3
        }
      }
    };
  }

  // Chart data for model
  let modelChartData = null;
  let modelChartOptions = {};
  let modelMissingVars = [];
  if (
    activeTab === "model" &&
    buoyId === SPECIAL_BUOY_ID &&
    modelData &&
    Array.isArray(modelData.timestamps)
  ) {
    const labels = modelData.timestamps.map(t =>
      t.length === 16 ? t + ":00Z" : t + "Z"
    );
    modelMissingVars = MODEL_VARIABLES.filter(v => !Array.isArray(modelData[v]));
    let dsIdx = 0;
    const datasets = MODEL_VARIABLES.map((v, i) => {
      const color = fixedColors[dsIdx % fixedColors.length];
      dsIdx++;
      let yAxisID = v === "dirm" ? "dirm" : v;
      let type = v === "dirm" ? "scatter" : "line";
      let showLine = v !== "dirm";
      let pointRadius = v === "dirm" ? 4 : 2;
      return {
        label:
          v === "hs"
            ? "Significant Wave Height (m)"
            : v === "tm02"
            ? "Energy Period (s)"
            : v === "dirm"
            ? "Mean Direction (°)"
            : v,
        data: Array.isArray(modelData[v]) ? modelData[v] : Array(labels.length).fill(null),
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
        mode: 'index',
        intersect: false,
      },
      plugins: {
        legend: { position: "top" },
      },
      scales: {
        x: {
          type: "time",
          time: {
            timeZone: "UTC",
            unit: "day",
            tooltipFormat: "yyyy-MM-dd HH:mm",
            displayFormats: {
              day: "MMM dd",
              hour: "HH:mm"
            }
          },
          title: { display: true, text: "Date (UTC)" }
        },
        hs: { type: "linear", display: true, position: "left", title: { display: true, text: "Height (m)" } },
        tm02: { type: "linear", display: true, position: "right", title: { display: true, text: "Period (s)" }, grid: { drawOnChartArea: false } },
        dirm: { type: "linear", display: true, position: "right", min: 0, max: 360, title: { display: true, text: "Direction (°)" }, grid: { drawOnChartArea: false } },
      },
      elements: {
        point: {
          radius: 3
        }
      }
    };
  }

  // --- Combined Tab Logic ---
  let combinedChartData = null;
  let combinedChartOptions = {};
  if (
    activeTab === COMBINED_TAB_KEY &&
    buoyId === SPECIAL_BUOY_ID &&
    modelData &&
    Array.isArray(modelData.timestamps) &&
    data &&
    data.waves &&
    data.waves.length > 0
  ) {
    // Always use UTC ISO strings everywhere!
    let buoyStart = null;
    if (data && data.waves && data.waves.length > 0) {
      let t = data.waves[0].timestamp;
      buoyStart = t.length === 16 ? t + ":00Z" : t + "Z";
    }
    let modelFiltered = [];
    if (modelData && Array.isArray(modelData.timestamps) && buoyStart) {
      modelFiltered = modelData.timestamps
        .map((t, i) => {
          const iso = t.length === 16 ? t + ":00Z" : t + "Z";
          return {
            x: iso,
            hs: modelData.hs ? modelData.hs[i] : null,
            tm02: modelData.tm02 ? modelData.tm02[i] : null,
            dirm: modelData.dirm ? modelData.dirm[i] : null
          };
        })
        .filter(d => d.x >= buoyStart);
    }
    const buoyPoints = data.waves.map((w) => {
      let t = w.timestamp;
      if (t.length === 16) t += ":00Z";
      else if (t.length === 19) t += "Z";
      return {
        x: t,
        hs: w.significantWaveHeight ?? null,
        tm02: w.meanPeriod ?? null,
        dirm: w.meanDirection ?? null
      };
    });

    combinedChartData = {
      datasets: [
        {
          label: "Model Hs (m)",
          data: modelFiltered.map(d => ({ x: d.x, y: d.hs })),
          borderColor: fixedColors[0],
          backgroundColor: fixedColors[0].replace("rgb", "rgba").replace(")", ", 0.15)"),
          borderDash: [8, 4],
          yAxisID: "hs",
          pointRadius: 0,
          fill: false,
          type: "line",
          order: 1,
        },
        {
          label: "Buoy Hs (m)",
          data: buoyPoints.map(d => ({ x: d.x, y: d.hs })),
          borderColor: "#000",
          backgroundColor: "#00000022",
          yAxisID: "hs",
          pointRadius: 0,
          fill: false,
          type: "line",
          borderWidth: 2,
          order: 2,
        },
        {
          label: "Model tm02 (s)",
          data: modelFiltered.map(d => ({ x: d.x, y: d.tm02 })),
          borderColor: fixedColors[1],
          backgroundColor: fixedColors[1].replace("rgb", "rgba").replace(")", ", 0.15)"),
          borderDash: [8, 4],
          yAxisID: "tm02",
          pointRadius: 0,
          fill: false,
          type: "line",
          order: 1,
        },
        {
          label: "Buoy Mean Period (s)",
          data: buoyPoints.map(d => ({ x: d.x, y: d.tm02 })),
          borderColor: "#229944",
          backgroundColor: "#22994422",
          yAxisID: "tm02",
          pointRadius: 0,
          fill: false,
          type: "line",
          borderWidth: 2,
          order: 2,
        },
        {
          label: "Model dirm (°)",
          data: modelFiltered.map(d => ({ x: d.x, y: d.dirm })),
          borderColor: fixedColors[2],
          backgroundColor: fixedColors[2].replace("rgb", "rgba").replace(")", ", 0.15)"),
          borderDash: [8, 4],
          yAxisID: "dirm",
          pointRadius: 3,
          fill: false,
          type: "scatter",
          order: 1,
        },
        {
          label: "Buoy Mean Direction (°)",
          data: buoyPoints.map(d => ({ x: d.x, y: d.dirm })),
          borderColor: "#c06500",
          backgroundColor: "#c0650022",
          yAxisID: "dirm",
          pointRadius: 3,
          fill: false,
          type: "scatter",
          order: 2,
        },
      ],
    };

    combinedChartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: "index",
        intersect: false,
      },
      plugins: {
        legend: { position: "top" },
      },
      scales: {
        x: {
          type: "time",
          time: {
            unit: "day",
            tooltipFormat: "yyyy-MM-dd HH:mm",
            displayFormats: {
              day: "MMM dd",
              hour: "HH:mm"
            }
          },
          title: { display: true, text: "Date (UTC)" }
        },
        hs: { type: "linear", display: true, position: "left", title: { display: true, text: "Height (m)" } },
        tm02: { type: "linear", display: true, position: "right", title: { display: true, text: "Period (s)" }, grid: { drawOnChartArea: false } },
        dirm: { type: "linear", display: true, position: "right", min: 0, max: 360, title: { display: true, text: "Direction (°)" }, grid: { drawOnChartArea: false } },
      },
      elements: {
        point: { radius: 3 }
      }
    };
  }

  // Tab labels: Only show model/combined for SPECIAL_BUOY_ID, else only buoy
  const tabLabels =
    buoyId === SPECIAL_BUOY_ID
      ? [
          { key: "buoy", label: `Buoy: ${buoyId || ""}` },
          { key: "model", label: "Model" },
          { key: COMBINED_TAB_KEY, label: "Combined" }
        ]
      : [{ key: "buoy", label: `Buoy: ${buoyId || ""}` }];

  // Only allow tab switching if tab exists for this buoy
  const availableTabs = tabLabels.map(t => t.key);

  // Ensure activeTab is valid for this buoy
  useEffect(() => {
    if (!availableTabs.includes(activeTab)) setActiveTab("buoy");
    // eslint-disable-next-line
  }, [buoyId]);

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
              disabled={!availableTabs.includes(tab.key)}
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
        {activeTab === COMBINED_TAB_KEY && buoyId === SPECIAL_BUOY_ID && (
          <>
            {(!modelData || !data || !data.waves) && (
              <div style={{ textAlign: "center", color: "#999" }}>No combined data available.</div>
            )}
            {modelData && data && data.waves && (
              <div style={{ width: "100%", height: `${Math.max(height - 100, 100)}px` }}>
                <Line data={combinedChartData} options={combinedChartOptions} />
              </div>
            )}
          </>
        )}
      </Offcanvas.Body>
    </Offcanvas>
  );
}

export default BottomBuoyOffCanvas;