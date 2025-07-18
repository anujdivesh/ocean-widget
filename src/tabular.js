import React, { useEffect, useState } from "react";

// Jet colormap: returns rgb string for value in [min, max]
function jetColor(value, min = 0, max = 4) {
  let v = Math.max(min, Math.min(max, value));
  v = (v - min) / (max - min);
  let r = Math.floor(255 * Math.max(Math.min(1.5 - Math.abs(4 * v - 3), 1), 0));
  let g = Math.floor(255 * Math.max(Math.min(1.5 - Math.abs(4 * v - 2), 1), 0));
  let b = Math.floor(255 * Math.max(Math.min(1.5 - Math.abs(4 * v - 1), 1), 0));
  if ([r, g, b].some(x => isNaN(x))) return "rgb(127,127,127)";
  return `rgb(${r},${g},${b})`;
}
function redColor(value, min = 0, max = 20) {
  let v = Math.max(min, Math.min(max, value));
  v = (v - min) / (max - min);
  const start = { r: 255, g: 229, b: 229 };
  const end = { r: 127, g: 0, b: 0 };
  const r = Math.round(start.r + (end.r - start.r) * v);
  const g = Math.round(start.g + (end.g - start.g) * v);
  const b = Math.round(start.b + (end.b - start.b) * v);
  return `rgb(${r},${g},${b})`;
}
function blueColor(value, min = 0, max = 4) {
  let v = Math.max(min, Math.min(max, value));
  v = (v - min) / (max - min);
  const start = { r: 232, g: 244, b: 255 };
  const end = { r: 0, g: 51, b: 102 };
  const r = Math.round(start.r + (end.r - start.r) * v);
  const g = Math.round(start.g + (end.g - start.g) * v);
  const b = Math.round(start.b + (end.b - start.b) * v);
  return `rgb(${r},${g},${b})`;
}
function isColorDark(colorString) {
  if (!colorString) return false;
  let r, g, b;
  const rgbMatch = colorString.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);
  if (rgbMatch) {
    [r, g, b] = rgbMatch.slice(1, 4).map(Number);
  } else {
    return false;
  }
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness < 128;
}

// Arrow SVG for direction
const ArrowSVG = ({ angle }) => (
  <svg width="22" height="22" viewBox="0 0 22 22" style={{
    display: 'inline-block',
    transform: `rotate(${angle}deg)`,
    verticalAlign: "middle"
  }}>
    <line x1="11" y1="18" x2="11" y2="4" stroke="#222" strokeWidth="2"/>
    <polygon points="11,2 7,8 15,8" fill="#222" />
  </svg>
);

// Parse label config, detect {calc}, color type, range, decimal places (default 0)
function parseLabelConfig(label) {
  const configMatch = label.match(/\{([^}]*)\}/);
  let config = {};
  if (configMatch) {
    const configParts = configMatch[1].split('/');
    configParts.forEach(part => {
      const lower = part.trim().toLowerCase();
      if (lower === 'calc') config.calc = true;
      else if (['jet', 'dir', 'rd', 'bu'].includes(lower)) config.type = lower;
      else if (/^\d+\s*-\s*\d+$/.test(lower)) {
        const [min, max] = lower.split('-').map(Number);
        config.min = min;
        config.max = max;
      } else if (/^\d+$/.test(lower)) {
        config.decimalPlaces = parseInt(lower, 10);
      }
    });
  }
  if (typeof config.decimalPlaces !== "number") {
    config.decimalPlaces = 0;
  }
  const cleanLabel = label.replace(/\{[^}]*\}/, '').trim();
  return { ...config, cleanLabel };
}

// Variables & labels with config strings
const variableDefs = [
  { key: "hs", label: "Wave{0-5/Bu/1}" },
  { key: "tpeak", label: "Wave Period{0-20/Rd/0}" },
  { key: "dirp", label: "Wave direction{0/dir}" },
  { key: "transp_x", label: "Wave Energy{calc/0-100/jet/0}" },
  { key: "hs_p2", label: "Swell(m){0-5/Bu/1}" },
  { key: "tp_p2", label: "Swell Period{0-25/Rd/0}" },
  { key: "dirp_p2", label: "Swell Dir{0/dir}" },
  { key: "hs_p3", label: "2.Swell (m) {0-5/Bu/1}" },
  { key: "tp_p3", label: "2.Swell Period{0-25/Rd/0}" },
  { key: "dirp_p3", label: "2. Swell Dir{0-5/dir}" },
  { key: "hs_p1", label: "Wind wave(m){0-5/Bu/1}" },
  { key: "tp_p1", label: "Wind wave period{0-25/Rd/0}" },
  { key: "dirp_p1", label: "Wind wave dir{0-4/dir}" }
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
function calculateWaveEnergyKw(xValues = [], yValues = []) {
  const rho = 1025;
  const g = 9.81;
  const len = Math.min(xValues.length, yValues.length);
  const result = [];
  for (let i = 0; i < len; i++) {
    const x = xValues[i];
    const y = yValues[i];
    if ((typeof x === "number" || !isNaN(Number(x)))
      && (typeof y === "number" || !isNaN(Number(y)))) {
      const mag = Math.sqrt(Number(x) * Number(x) + Number(y) * Number(y));
      const Hs = mag;
      const T = 8;
      const P = (rho * g * g / (32 * Math.PI)) * (Hs * Hs) * T;
      result.push(P / 1000);
    } else {
      result.push(null);
    }
  }
  return result;
}
const formatSmart = (value, decimalPlaces) => {
  if (value === null || value === undefined || value === "") return '';
  if (typeof value !== "number") {
    let num = Number(value);
    if (isNaN(num)) return String(value).slice(0, 2);
    value = num;
  }
  if (typeof decimalPlaces !== "number") decimalPlaces = 0;
  return value.toFixed(decimalPlaces);
};
function filterToSixHourly(times, values) {
  const filteredTimes = [];
  const filteredValues = [];
  if (!times.length) return { times: filteredTimes, values: filteredValues };
  let firstIdx = -1;
  for (let i = 0; i < times.length; i++) {
    const date = new Date(times[i]);
    if (date.getUTCHours() % 6 === 0) {
      firstIdx = i;
      break;
    }
  }
  if (firstIdx !== -1) {
    for (let i = firstIdx; i < times.length; i += 6) {
      filteredTimes.push(times[i]);
      filteredValues.push(values[i]);
    }
  }
  return { times: filteredTimes, values: filteredValues };
}
function formatTableTime(time) {
  const date = new Date(time);
  const days = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
  const dayCode = days[date.getDay()];
  const dayNum = String(date.getDate());
  const hour = `${String(date.getHours()).padStart(2, '0')}hr`;
  return (
    <>
      {dayCode} <br />
      {dayNum} <br />
      {hour}
    </>
  );
}
function Tabular({ perVariableData }) {
  const [tableRows, setTableRows] = useState([]);
  const [times, setTimes] = useState([]);
  const [error, setError] = useState("");
  useEffect(() => {
    let allRows = [];
    let timesArr = [];
    let transpX = [];
    let transpY = [];
    for (let j = 0; j < variableDefs.length; j++) {
      const { key, label } = variableDefs[j];
      const config = parseLabelConfig(label);
      if (key === "transp_x") {
        const tsX = extractCoverageTimeseries(perVariableData["transp_x"], "transp_x");
        const tsY = extractCoverageTimeseries(perVariableData["transp_y"], "transp_y");
        transpX = tsX && tsX.values ? tsX.values : [];
        transpY = tsY && tsY.values ? tsY.values : [];
        const filtered = filterToSixHourly(tsX?.times || [], transpX);
        const filteredY = filterToSixHourly(tsY?.times || [], transpY);
        const energyVals = calculateWaveEnergyKw(filtered.values, filteredY.values);
        if (!timesArr.length && filtered.times) timesArr = filtered.times;
        allRows.push({
          key,
          label: config.cleanLabel,
          config,
          values: energyVals
        });
      } else if (key === "transp_y") {
        continue;
      } else {
        const json = perVariableData[key];
        const ts = extractCoverageTimeseries(json, key);
        if (ts && ts.values) {
          const filtered = filterToSixHourly(ts.times, ts.values);
          if (!timesArr.length && filtered.times) timesArr = filtered.times;
          allRows.push({
            key,
            label: config.cleanLabel,
            config,
            values: filtered.values
          });
        } else {
          allRows.push({
            key,
            label: config.cleanLabel,
            config,
            values: []
          });
        }
      }
    }
    setTableRows(allRows);
    setTimes(timesArr || []);
    if (allRows.every(s => !s.values.length)) setError("No tabular timeseries data returned.");
    else setError("");
  }, [perVariableData]);
  if (!perVariableData) return <div>No data available.</div>;
  if (error) return <div style={{ color: "red" }}>{error}</div>;
  if (!times.length || !tableRows.length) return <div>No tabular timeseries data available.</div>;

  // Table CSS as in your example
  const thFirstCol = {
    textAlign: 'center',
    fontWeight: 'normal',
    backgroundColor: '#eeeeee',
    color: 'black',
    border: '1px solid #E5E4E2',
    whiteSpace: 'nowrap',
    maxWidth: '240px',
    width: 'max-content',
  };
  const thOtherCols = {
    fontWeight: 'normal',
    textAlign: 'center',
    backgroundColor: '#eeeeee',
    color: 'black',
    border: '1px solid #E5E4E2',
    padding: '0 4px',
    minWidth: 32,
    maxWidth: 48,
    width: 38,
    whiteSpace: 'nowrap',
  };
  const tdFirstCol = {
    fontWeight: 'normal',
    textAlign: 'left',
    padding: '2px 6px',
    border: '1px solid #E5E4E2',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    maxWidth: '240px',
    width: 'max-content',
    backgroundColor: '#eeeeee',
  };
  const tdOtherCols = {
    fontWeight: 'normal',
    textAlign: 'center',
    padding: '0 6px',
    border: '1px solid #E5E4E2',
    minWidth: 32,
    maxWidth: 48,
    width: 38,
    whiteSpace: 'nowrap',
    cursor: 'pointer',
    transition: 'background 0.2s, color 0.2s'
  };

  return (
    <div style={{ overflowX: "auto", maxWidth: "100%" }}>
      <table
        style={{
          borderCollapse: 'collapse',
          textAlign: 'center',
          fontSize: 14,
          border: '1px solid #fff',
          tableLayout: 'auto',
          width: 'auto',
          minWidth: 0,
          maxWidth: '100vw'
        }}
        className="table table-bordered"
      >
        <thead>
          <tr>
            <th style={thFirstCol}>Parameter</th>
            {times.map((t, idx) => (
              <th key={t} style={thOtherCols}>
                {formatTableTime(t)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {tableRows.map((row) => (
            <tr key={row.key}>
              <td style={tdFirstCol}>{row.label}</td>
              {row.values.map((value, colIdx) => {
                let cellStyle = { ...tdOtherCols };
                const { min=0, max=5, type="bu", decimalPlaces } = row.config || {};
                let colorText = "#000";
                let colorBg = "";
                if ((type === "jet" || type === "rd" || type === "bu") && typeof value === "number") {
                  if (type === "jet") colorBg = jetColor(value, min, max);
                  else if (type === "rd") colorBg = redColor(value, min, max);
                  else if (type === "bu") colorBg = blueColor(value, min, max);
                  colorText = isColorDark(colorBg) ? "#eeeeee" : "#000";
                  cellStyle = { ...cellStyle, backgroundColor: colorBg, color: colorText };
                }
                const isDirection = type === "dir";
                return (
                  <td key={colIdx} style={cellStyle}>
                    {isDirection && typeof value === "number"
                      ? <ArrowSVG angle={value + 180} />
                      : formatSmart(value, decimalPlaces)
                    }
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
export default Tabular;