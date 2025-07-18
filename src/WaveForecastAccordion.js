import React from "react";
import Button from "react-bootstrap/Button";
import ButtonGroup from "react-bootstrap/ButtonGroup";
import Form from "react-bootstrap/Form";
import { FaPlay, FaPause, FaForward, FaBackward } from "react-icons/fa";
import Badge from 'react-bootstrap/Badge';
import './timeseries_scroll.css';
import './opacity.css';

const sideLabelStyle = {
  width: 54,
  minWidth: 54,
  fontSize: "12px",
  marginRight: 6,
  display: "flex",
  alignItems: "center",
  flexShrink: 0,
  lineHeight: 1.1,
};

const sliderRowStyle = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  marginTop: 7,
  marginBottom: 2,
};

const smallSelect = {
  fontSize: "12px",
  height: 26,
  minHeight: 26,
  minWidth: 0,
  width: "100%",
  padding: "2px 8px"
};

const smallRange = {
  flex: 1,
  height: 22,
  minHeight: 18,
  margin: 0,
  padding: 0,
};

const smallButtonGroup = {
  height: 22,
  display: "flex",
  alignItems: "center",
};

const valueText = {
  minWidth: 30,
  fontSize: "11px",
  textAlign: "right",
  fontVariantNumeric: "tabular-nums",
  paddingLeft: 2,
  lineHeight: 1.1,
};

const legendBox = {
  width: "98%",
  margin: "8px auto 0 auto",
  display: "flex",
  justifyContent: "center",
};

export default function WaveForecastAccordion({
  active,
  onToggleActive,
  WAVE_FORECAST_LAYERS,
  selectedWaveForecast,
  setSelectedWaveForecast,
  opacity,
  setOpacity,
  capTime,
  totalSteps,
  sliderIndex,
  setSliderIndex,
  isPlaying,
  setIsPlaying,
  currentSliderDate,
}) {
  // Get the legend URL from the selected layer (or sublayer if composite)
  const selectedLayer = WAVE_FORECAST_LAYERS.find(l => l.value === selectedWaveForecast);
  let legendUrl = "";
  if (selectedLayer) {
    if (selectedLayer.composite && selectedLayer.layers) {
      // If composite, just take the first sublayer's legend for now
      legendUrl = selectedLayer.layers[0]?.legendUrl || selectedLayer.legendUrl;
    } else {
      legendUrl = selectedLayer.legendUrl;
    }
  }

  return (
    <div style={{ fontSize: "14px", width: "100%", maxWidth: 370, margin: "0 auto" }}>
      {/* Layer select */}
      <div style={sliderRowStyle}>
        <label style={sideLabelStyle} htmlFor="select-wave-forecast">Layer</label>
        <Form.Select
          id="select-wave-forecast"
          size="sm"
          value={selectedWaveForecast}
          onChange={e => setSelectedWaveForecast(e.target.value)}
          style={smallSelect}
          onClick={e => e.currentTarget.blur()}
        >
          {WAVE_FORECAST_LAYERS.map(layer => (
            <option key={layer.value} value={layer.value}>{layer.label}</option>
          ))}
        </Form.Select>
      </div>

      {/* Opacity slider */}
      <div style={sliderRowStyle}>
        <label style={sideLabelStyle} htmlFor="wave-opacity-slider">Opacity</label>
        <input
          type="range"
          id="wave-opacity-slider"
          className="form-range custom-range-slider"
          min={0}
          max={100}
          step={1}
          value={Math.round(opacity * 100)}
          onChange={e => setOpacity(Number(e.target.value) / 100)}
          style={smallRange}
        />
        <span style={valueText}>{Math.round(opacity * 100)}%</span>
      </div>

      {/* Time range slider */}
      <div style={sliderRowStyle}>
        <label style={sideLabelStyle} htmlFor="wave-time-slider">Time</label>
        <input
          type="range"
          className="form-range custom-range-slider2"
          id="wave-time-slider"
          min={0}
          max={totalSteps}
          value={sliderIndex}
          disabled={capTime.loading}
          step={1}
          onChange={e => setSliderIndex(Number(e.target.value))}
          style={smallRange}
        />
        <ButtonGroup size="sm" style={smallButtonGroup}>
          <Button
            variant="outline-secondary"
            size="sm"
            onClick={() => setSliderIndex(prev => prev > 0 ? prev - 1 : totalSteps)}
            title="Previous"
            style={{ padding: "0.05rem 0.3rem", fontSize: "1.02em", height: 20, minHeight: 20, display: "flex", alignItems: "center", justifyContent: "center" }}
          >
            <FaBackward size={8}/>
          </Button>
          <Button
            variant={isPlaying ? "danger" : "success"}
            size="sm"
            onClick={() => setIsPlaying((p) => !p)}
            title={isPlaying ? "Pause" : "Play"}
            style={{ padding: "0.05rem 0.3rem", height: 20, minHeight: 20, display: "flex", alignItems: "center", justifyContent: "center" }}
            disabled={capTime.loading}
          >
            {isPlaying ? <FaPause size={8}/> : <FaPlay size={8}/>}
          </Button>
          <Button
            variant="outline-secondary"
            size="sm"
            onClick={() => setSliderIndex(prev => prev < totalSteps ? prev + 1 : 0)}
            title="Next"
            style={{ padding: "0.05rem 0.3rem", fontSize: "1.02em", height: 20, minHeight: 20, display: "flex", alignItems: "center", justifyContent: "center" }}
          >
            <FaForward size={8}/>
          </Button>
        </ButtonGroup>
      </div>
     

      <div style={{ 
            marginTop: "2px",
            marginLeft: "2px",
            textAlign: "right"
          }}>
            <Badge bg="secondary" className="fw-bold small p-1" style={{
              fontSize: "11px",
              color: "white",
              backgroundColor: "#6c757d",
              padding: "2px 6px",
              borderRadius: "4px"
            }}>
              {capTime.loading
          ? "Loading…"
          : (currentSliderDate?.toISOString().replace("T", " ").substring(0, 16) + " UTC")}
            </Badge>
          </div>

      {/* Legend */}
      <div style={legendBox}>
        {legendUrl && (
          <img src={legendUrl} alt="Legend" style={{ width: "100%", maxWidth: 280, display: "block" }} />
        )}
      </div>

      {/* Source */}
      <div style={{ fontSize: "10px", color: "#666", marginTop: 8, wordBreak: "break-all" }}>
        Source: https://gemthreddshpc.spc.int/thredds
      </div>
    </div>
  );
}