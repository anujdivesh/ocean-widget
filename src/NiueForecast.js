import React, { useEffect, useRef, useState, useCallback } from "react";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import Accordion from "react-bootstrap/Accordion";
import Form from "react-bootstrap/Form";
import addWMSTileLayer from "./addWMSTileLayer";
import BottomOffCanvas from "./BottomOffCanvas";
import WaveForecastAccordion from "./WaveForecastAccordion";
import WavebuoyAccordion from "./WavebuoyAccordion";
import BottomBuoyOffCanvas from "./BottomBuoyOffCanvas";

const COMMON_LEGEND_URL = "https://ocean-plotter.spc.int/plotter/GetLegendGraphic?layer_map=40&mode=standard&min_color=0&max_color=4&step=1&color=jet&unit=m";

//For prod
/*
const widgetContainerStyle = {
    width: "100vw",
    height: "100%",
    position: "relative", // or just remove this line
    zIndex: 1, // or remove
  };
  */
const widgetContainerStyle = {
  position: "fixed",
  top: 0,
  left: 0,
  width: "100vw",
  height: "calc(100dvh - 0px)",
  zIndex: 9999,
};

// Note: floatingSidebarStyle will be created dynamically in the component

const WAVE_FORECAST_LAYERS = [
  {
    label: "Significant Wave Height + Dir",
    value: "composite_hs_dirm",
    id: 100,
    composite: true,
    legendUrl: COMMON_LEGEND_URL,
    layers: [
      {
        value: "niue_forecast/hs",
        style: "default-scalar/x-Sst",
        colorscalerange: "0,4",
        wmsUrl: "https://gem-ncwms-hpc.spc.int/ncWMS/wms",
        id: 1,
        numcolorbands: 250,
        legendUrl: COMMON_LEGEND_URL,
      },
      {
        value: "dirm",
        style: "black-arrow",
        colorscalerange: "",
        wmsUrl: "https://gemthreddshpc.spc.int/thredds/wms/POP/model/country/spc/forecast/hourly/NIU/ForecastNiue_latest.nc",
        id: 3,
        legendUrl: COMMON_LEGEND_URL,
      }
    ]
  },
  {
    label: "Significant Wave Height",
    value: "niue_forecast/hs",
    style: "default-scalar/x-Sst",
    colorscalerange: "0,4",
    id: 1,
    wmsUrl: "https://gem-ncwms-hpc.spc.int/ncWMS/wms",
    legendUrl: COMMON_LEGEND_URL,
  },
  {
    label: "Wave Direction (arrow)",
    value: "dirm",
    style: "black-arrow",
    colorscalerange: "",
    id: 3,
    wmsUrl: "https://gemthreddshpc.spc.int/thredds/wms/POP/model/country/spc/forecast/hourly/NIU/ForecastNiue_latest.nc",
    legendUrl: COMMON_LEGEND_URL,
  },
  {
    label: "Mean Wave Period",
    value: "niue_forecast/tm02",
    style: "default-scalar/x-Sst",
    colorscalerange: "0,20",
    id: 4,
    wmsUrl: "https://gem-ncwms-hpc.spc.int/ncWMS/wms",
    numcolorbands: 250,
    legendUrl: 'https://ocean-plotter.spc.int/plotter/GetLegendGraphic?layer_map=43&mode=standard&min_color=0&max_color=20&step=1&color=jet&unit=s',
  },
  {
    label: "Peak Wave Period",
    value: "niue_forecast/tpeak",
    style: "default-scalar/x-Sst",
    colorscalerange: "0,20",
    id: 5,
    wmsUrl: "https://gem-ncwms-hpc.spc.int/ncWMS/wms",
    numcolorbands: 250,
    legendUrl: 'https://ocean-plotter.spc.int/plotter/GetLegendGraphic?layer_map=43&mode=standard&min_color=0&max_color=20&step=1&color=jet&unit=s',
  }
];

const WAVE_BUOYS = [
  {
    id: "SPOT-31153C",
    lon: -169.9024667,
    lat: -18.9747,
  },
  {
    id: "SPOT-31071C",
    lon: -169.98535,
    lat: -19.0662333,
  },
  {
    id: "SPOT-31091C",
    lon: -169.9315,
    lat: -19.05455,
  },
];

const southWest = L.latLng(-19.5001571942, -170.4975885576);
const northEast = L.latLng(-18.502050914, -168.9938105764);
const bounds = L.latLngBounds(southWest, northEast);

function formatDateISOString(date) {
  return date.toISOString().split(".")[0] + ".000Z";
}

function parseTimeDimensionFromCapabilities(xml, layerName) {
  const parser = new window.DOMParser();
  const dom = parser.parseFromString(xml, "text/xml");
  const layers = Array.from(dom.getElementsByTagName("Layer"));
  let targetLayer = null;
  for (const l of layers) {
    const nameNode = l.getElementsByTagName("Name")[0];
    if (nameNode && nameNode.textContent === layerName) {
      targetLayer = l;
      break;
    }
  }
  if (!targetLayer) return null;
  const dimensionNodes = Array.from(targetLayer.getElementsByTagName("Dimension"));
  for (const dim of dimensionNodes) {
    if (dim.getAttribute("name") === "time") {
      return dim.textContent.trim();
    }
  }
  const extentNodes = Array.from(targetLayer.getElementsByTagName("Extent"));
  for (const ext of extentNodes) {
    if (ext.getAttribute("name") === "time") {
      return ext.textContent.trim();
    }
  }
  return null;
}

function getTimeRangeFromDimension(dimStr) {
  if (!dimStr) return null;
  if (dimStr.includes("/")) {
    const [start, end, step] = dimStr.split("/");
    return {
      start: new Date(start),
      end: new Date(end),
      step: step || "PT1H"
    };
  }
  const times = dimStr.split(",").map(s => new Date(s));
  if (times.length > 1) {
    const stepMs = times[1] - times[0];
    return {
      start: times[0],
      end: times[times.length - 1],
      step: `PT${Math.round(stepMs / 1000 / 60 / 60)}H`
    };
  }
  return null;
}

function getStepHours(stepStr) {
  if (!stepStr.startsWith("PT") || !stepStr.endsWith("H")) return 1;
  return parseInt(stepStr.substring(2, stepStr.length - 1), 10) || 1;
}

function NiueForecast() {
  const [showBuoyCanvas, setShowBuoyCanvas] = useState(false);
  const [showBottomCanvas, setShowBottomCanvas] = useState(false);
  const [bottomCanvasData, setBottomCanvasData] = useState(null);
  const [selectedBuoyId, setSelectedBuoyId] = useState(null);

  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const layerRefs = useRef({});
  const wmsLayerGroup = useRef(null);
  const wmsLayerRefs = useRef([]);
  const buoyMarkersRef = useRef([]);

  const [activeLayers, setActiveLayers] = useState({
    osm: true,
    "stamen-toner": true,
    "stamen-terrain": false,
    waveForecast: true,
  });
  const [selectedWaveForecast, setSelectedWaveForecast] = useState(WAVE_FORECAST_LAYERS[0].value);

  const [capTime, setCapTime] = useState({
    loading: true,
    start: new Date("2025-07-07T12:00:00.000Z"),
    end: new Date("2025-07-16T00:00:00.000Z"),
    stepHours: 1
  });
  const [sliderIndex, setSliderIndex] = useState(0);

  const [isPlaying, setIsPlaying] = useState(false);
  const playTimer = useRef(null);
  const [wmsOpacity, setWmsOpacity] = useState(1);
  
  // Drag state for movable sidebar
  const [sidebarPosition, setSidebarPosition] = useState({ x: 24, y: 100 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // Only one bottom canvas open at once:
  const openBottomCanvas = (data) => {
    setShowBottomCanvas(true);
    setShowBuoyCanvas(false);
    setBottomCanvasData(data);
  };
  const openBuoyCanvas = (buoyId) => {
    setShowBottomCanvas(false);
    setShowBuoyCanvas(true);
    setSelectedBuoyId(buoyId);
  };

  const handleShow = useCallback((info) => openBottomCanvas(info), []);

  // Drag handlers for movable sidebar
  const handleMouseDown = (e) => {
    if (e.target.closest('.accordion-button, .accordion-collapse, .form-check, button, input, select')) {
      return; // Don't start drag if clicking on interactive elements
    }
    
    setIsDragging(true);
    const rect = e.currentTarget.getBoundingClientRect();
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    });
    e.preventDefault();
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    
    const newX = e.clientX - dragOffset.x;
    const newY = e.clientY - dragOffset.y;
    
    // Keep sidebar within viewport bounds
    const maxX = window.innerWidth - 400; // sidebar width
    const maxY = window.innerHeight - 200; // approximate sidebar height
    
    setSidebarPosition({
      x: Math.max(0, Math.min(newX, maxX)),
      y: Math.max(0, Math.min(newY, maxY))
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Add global mouse event listeners
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'grabbing';
      document.body.style.userSelect = 'none';
    } else {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isDragging, dragOffset]);

  useEffect(() => {
    async function fetchCapabilities() {
      setCapTime((prev) => ({ ...prev, loading: true }));
      try {
        const selectedLayer = WAVE_FORECAST_LAYERS.find(l => l.value === selectedWaveForecast);
        const capsLayer = selectedLayer.composite ? selectedLayer.layers[0] : selectedLayer;
        let url = capsLayer?.wmsUrl;
        let urlForCaps = url;
        if (url && !url.toLowerCase().includes("request=getcapabilities")) {
          urlForCaps = url + (url.includes("?") ? "&" : "?") + "SERVICE=WMS&REQUEST=GetCapabilities&VERSION=1.3.0";
        }
        const layerName = capsLayer?.value;
        const res = await fetch(urlForCaps);
        const xml = await res.text();
        const timeDim = parseTimeDimensionFromCapabilities(xml, layerName);
        if (!timeDim) throw new Error("No time dimension found in capabilities.");
        const { start, end, step } = getTimeRangeFromDimension(timeDim) || {};
        const stepHours = getStepHours(step || "PT1H");
        setCapTime({
          loading: false,
          start,
          end,
          stepHours
        });
        setSliderIndex(0);
      } catch (e) {
        setCapTime((prev) => ({ ...prev, loading: false }));
      }
    }
    fetchCapabilities();
  }, [selectedWaveForecast]);

  const totalSteps = Math.floor((capTime.end - capTime.start) / (capTime.stepHours * 60 * 60 * 1000));
  const currentSliderDate = new Date(capTime.start.getTime() + sliderIndex * capTime.stepHours * 60 * 60 * 1000);
  const currentSliderDateStr = formatDateISOString(currentSliderDate);

  useEffect(() => {
    if (mapRef.current && !mapInstance.current) {
      mapInstance.current = L.map(mapRef.current, { zoomControl: false });
      mapInstance.current.fitBounds(bounds);
      mapInstance.current.setZoom(10);

      // Map click opens the main bottom canvas, but not if a marker is open!
      mapInstance.current.on("click", (e) => {
        // Only open if buoy canvas is not open
        if (!showBuoyCanvas) {
          openBottomCanvas({ latlng: e.latlng });
        }
      });

      const osmLayer = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://osm.org/copyright">OpenStreetMap</a> contributors',
        detectRetina: true,
      });
      osmLayer.addTo(mapInstance.current);
      layerRefs.current.osm = osmLayer;
      wmsLayerGroup.current = L.layerGroup().addTo(mapInstance.current);
    }
    return () => {
      if (mapInstance.current) {
        mapInstance.current.off("click");
        mapInstance.current.remove();
        mapInstance.current = null;
        layerRefs.current = {};
        wmsLayerGroup.current = null;
        wmsLayerRefs.current = [];
      }
      if (playTimer.current) {
        clearInterval(playTimer.current);
      }
    };
    // eslint-disable-next-line
  }, []);

  useEffect(() => {
    if (!mapInstance.current) return;
    if (activeLayers.osm && !layerRefs.current.osm) {
      const osmLayer = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://osm.org/copyright">OpenStreetMap</a> contributors',
        detectRetina: true,
      });
      osmLayer.addTo(mapInstance.current);
      layerRefs.current.osm = osmLayer;
    } else if (!activeLayers.osm && layerRefs.current.osm) {
      mapInstance.current.removeLayer(layerRefs.current.osm);
      layerRefs.current.osm = null;
    }
    if (activeLayers["stamen-toner"] && !layerRefs.current["stamen-toner"]) {
    /* const tonerLayer = L.tileLayer("https://stamen-tiles.a.ssl.fastly.net/toner/{z}/{x}/{y}.png", {
        attribution: 'Map tiles by <a href="http://stamen.com">Stamen Design</a>',
        detectRetina: true,
      });
      tonerLayer.addTo(mapInstance.current);*/
     // layerRefs.current["stamen-toner"] = tonerLayer;
    } else if (!activeLayers["stamen-toner"] && layerRefs.current["stamen-toner"]) {
      mapInstance.current.removeLayer(layerRefs.current["stamen-toner"]);
      layerRefs.current["stamen-toner"] = null;
    }
    if (activeLayers["stamen-terrain"] && !layerRefs.current["stamen-terrain"]) {
      const terrainLayer = L.tileLayer("https://stamen-tiles.a.ssl.fastly.net/terrain/{z}/{x}/{y}.png", {
        attribution: 'Map tiles by <a href="http://stamen.com">Stamen Design</a>',
        detectRetina: true,
      });
      terrainLayer.addTo(mapInstance.current);
      layerRefs.current["stamen-terrain"] = terrainLayer;
    } else if (!activeLayers["stamen-terrain"] && layerRefs.current["stamen-terrain"]) {
      mapInstance.current.removeLayer(layerRefs.current["stamen-terrain"]);
      layerRefs.current["stamen-terrain"] = null;
    }
  }, [activeLayers]);

  useEffect(() => {
    if (!mapInstance.current || !wmsLayerGroup.current || capTime.loading) return;
    if (wmsLayerRefs.current && wmsLayerRefs.current.length > 0) {
      wmsLayerRefs.current.forEach(layer => {
        if (layer) wmsLayerGroup.current.removeLayer(layer);
      });
      wmsLayerRefs.current = [];
    }
    if (!activeLayers.waveForecast) return;

    const selected = WAVE_FORECAST_LAYERS.find(l => l.value === selectedWaveForecast);

    if (selected.composite && Array.isArray(selected.layers)) {
      wmsLayerRefs.current = selected.layers.map((sub) => {
        if (sub.value === "dirm") {
          const wmsLayer = L.tileLayer.wms(
            sub.wmsUrl,
            {
              layers: sub.value,
              format: "image/png",
              transparent: true,
              opacity: wmsOpacity,
              styles: sub.style,
              time: currentSliderDateStr,
            }
          );
          wmsLayer.addTo(wmsLayerGroup.current);
          return wmsLayer;
        } else {
          const wmsLayer = addWMSTileLayer(
            mapInstance.current,
            sub.wmsUrl,
            {
              id: sub.id,
              layers: sub.value,
              format: "image/png",
              transparent: true,
              opacity: wmsOpacity,
              styles: sub.style,
              colorscalerange: sub.colorscalerange,
              abovemaxcolor: "extend",
              belowmincolor: "transparent",
              numcolorbands: sub.numcolorbands || "250",
              time: currentSliderDateStr,
            },
            handleShow
          );
          wmsLayerGroup.current.addLayer(wmsLayer);
          return wmsLayer;
        }
      });
    } else if (selected.value === "dirm") {
      const wmsLayer = L.tileLayer.wms(
        selected.wmsUrl,
        {
          layers: selected.value,
          format: "image/png",
          transparent: true,
          opacity: wmsOpacity,
          styles: selected.style,
          time: currentSliderDateStr,
        }
      );
      wmsLayer.addTo(wmsLayerGroup.current);
      wmsLayerRefs.current = [wmsLayer];
    } else {
      const wmsLayer = addWMSTileLayer(
        mapInstance.current,
        selected.wmsUrl,
        {
          id: selected.id,
          layers: selected.value,
          format: "image/png",
          transparent: true,
          opacity: wmsOpacity,
          styles: selected.style,
          colorscalerange: selected.colorscalerange,
          abovemaxcolor: "extend",
          belowmincolor: "transparent",
          numcolorbands: selected.numcolorbands || "250",
          time: currentSliderDateStr,
        },
        handleShow
      );
      wmsLayerGroup.current.addLayer(wmsLayer);
      wmsLayerRefs.current = [wmsLayer];
    }
  }, [activeLayers.waveForecast, selectedWaveForecast, handleShow, currentSliderDateStr, capTime.loading, wmsOpacity]);

  useEffect(() => {
    if (isPlaying && !capTime.loading) {
      playTimer.current = setInterval(() => {
        setSliderIndex((prev) =>
          prev < totalSteps ? prev + 1 : 0
        );
      }, 600);
    } else if (playTimer.current) {
      clearInterval(playTimer.current);
    }
    return () => {
      if (playTimer.current) {
        clearInterval(playTimer.current);
      }
    };
  }, [isPlaying, capTime.loading, totalSteps]);

  const blueIcon = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41],
  });
  const greenIcon = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41],
  });

  // BUOY MARKERS LOGIC (appear/disappear with 'stamen-toner')
  useEffect(() => {
    if (!mapInstance.current) return;
    buoyMarkersRef.current.forEach(marker => marker.remove());
    buoyMarkersRef.current = [];
    if (!activeLayers["stamen-toner"]) return;

    buoyMarkersRef.current = WAVE_BUOYS.map(buoy => {
      let marker;
      if (buoy.id === "SPOT-31091C"){
        marker = L.marker([buoy.lat, buoy.lon], {
          title: buoy.id,
          icon: greenIcon,
        }).addTo(mapInstance.current);
      } else{
        marker = L.marker([buoy.lat, buoy.lon], {
          title: buoy.id,
          icon: blueIcon,
        }).addTo(mapInstance.current);
      }
      marker.bindPopup(`<b>${buoy.id}</b><br>Lat: ${buoy.lat}<br>Lon: ${buoy.lon}`);
      marker.on("click", () => {
        openBuoyCanvas(buoy.id);
      });
      return marker;
    });
    return () => {
      buoyMarkersRef.current.forEach(marker => marker.remove());
      buoyMarkersRef.current = [];
    };
    // eslint-disable-next-line
  }, [activeLayers["stamen-toner"], mapInstance.current]);

  // Create dynamic sidebar style with current position
  const floatingSidebarStyle = {
    position: "absolute",
    top: sidebarPosition.y,
    left: sidebarPosition.x,
    width: 400,
    background: "rgba(255,255,255,0.97)",
    borderRadius: 8,
    boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
    zIndex: 10001,
    maxHeight: "calc(100vh - 48px)",
    overflowY: "auto",
    padding: "16px",
    cursor: isDragging ? "grabbing" : "grab",
    userSelect: "none"
  };

  const LayerAccordionHeader = ({ children, checked, onChange, eventKey }) => (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        width: "100%",
        justifyContent: "flex-start",
        gap: 8
      }}
    >
      <Form.Check
        type="checkbox"
        id={`layer-toggle-${eventKey}`}
        checked={checked}
        onChange={onChange}
        label={null}
        style={{ marginLeft: 0, marginRight: 4 }}
        onClick={e => e.stopPropagation()}
      />
      <span>{children}</span>
    </div>
  );

  return (
    <div style={widgetContainerStyle}>
      <div 
        style={floatingSidebarStyle}
        onMouseDown={handleMouseDown}
        title="Drag to move sidebar"
      >
        <Accordion defaultActiveKey="layers">
          <Accordion.Item eventKey="layers">
            <Accordion.Header onClick={e => e.currentTarget.blur()}>Map Overlay</Accordion.Header>
            <Accordion.Body>
              <Accordion defaultActiveKey="waveForecast">
                {/* Wave Forecast */}
                <Accordion.Item eventKey="waveForecast">
                  <Accordion.Header onClick={e => e.currentTarget.blur()}>
                    <LayerAccordionHeader
                      checked={!!activeLayers.waveForecast}
                      onChange={() => setActiveLayers(layers => ({ ...layers, waveForecast: !layers.waveForecast }))}
                      eventKey="waveForecast"
                    >
                      Wave Forecast
                    </LayerAccordionHeader>
                  </Accordion.Header>
                  <Accordion.Body>
                    <WaveForecastAccordion
                      active={!!activeLayers.waveForecast}
                      onToggleActive={() =>
                        setActiveLayers(layers => ({ ...layers, waveForecast: !layers.waveForecast }))
                      }
                      WAVE_FORECAST_LAYERS={WAVE_FORECAST_LAYERS}
                      selectedWaveForecast={selectedWaveForecast}
                      setSelectedWaveForecast={setSelectedWaveForecast}
                      opacity={wmsOpacity}
                      setOpacity={setWmsOpacity}
                      capTime={capTime}
                      totalSteps={totalSteps}
                      sliderIndex={sliderIndex}
                      setSliderIndex={setSliderIndex}
                      isPlaying={isPlaying}
                      setIsPlaying={setIsPlaying}
                      currentSliderDate={currentSliderDate}
                    />
                  </Accordion.Body>
                </Accordion.Item>
                {/* Wavebuoy */}
                <Accordion.Item eventKey="stamen-toner">
                  <Accordion.Header>
                    <LayerAccordionHeader
                      checked={!!activeLayers["stamen-toner"]}
                      onChange={() => setActiveLayers(layers => ({ ...layers, "stamen-toner": !layers["stamen-toner"] }))}
                      eventKey="stamen-toner"
                    >
                      Wavebuoy
                    </LayerAccordionHeader>
                  </Accordion.Header>
                  <Accordion.Body>
                    <WavebuoyAccordion />
                  </Accordion.Body>
                </Accordion.Item>
                {/* Inundation */}
              
              </Accordion>
            </Accordion.Body>
          </Accordion.Item>
        </Accordion>
      </div>
      {/* Map container */}
      <div
        ref={mapRef}
        id="leaflet-fullscreen-map"
        style={{ width: "100%", height: "100%" }}
      />
      <BottomOffCanvas
        show={showBottomCanvas}
        onHide={() => setShowBottomCanvas(false)}
        data={bottomCanvasData}
      />
      <BottomBuoyOffCanvas
        show={showBuoyCanvas}
        onHide={() => setShowBuoyCanvas(false)}
        buoyId={selectedBuoyId}
      />
    </div>
  );
}

export default NiueForecast;