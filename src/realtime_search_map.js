import React, { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Improved longitude normalization
const normalizeLongitude = (lon) => {
  // Normalize to [-180, 180]
  return ((lon % 360) + 540) % 360 - 180;
};

// Function to adjust coordinates for dateline crossing
const getAdjustedCoordinates = (coordinates) => {
  const [lon, lat] = coordinates;
  const normalizedLon = normalizeLongitude(lon);
  
  // If the point is near the dateline (within 30 degrees), 
  // we'll create two points - one on each side
  if (Math.abs(normalizedLon) > 150) {
    return [
      [normalizedLon, lat],
      [normalizedLon > 0 ? normalizedLon - 360 : normalizedLon + 360, lat]
    ];
  }
  return [[normalizedLon, lat]];
};

// Create blue marker icon for unselected buoys
const createBlueMarkerIcon = () => {
  return L.icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-blue.png',
    iconRetinaUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  });
};

// Create green marker icon for selected buoys
const createGreenMarkerIcon = () => {
  return L.icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png',
    iconRetinaUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  });
};

const RealtimeSearchMap = forwardRef(({ buoyOptions, selectedStations }, ref) => {
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const layerGroupRef = useRef(null);

  useImperativeHandle(ref, () => ({
    getMap: () => mapRef.current
  }));

  useEffect(() => {
    // Initialize map
    const map = L.map('realtime-search-map', {
      zoomControl: true,
      center: [-15, 160],
      zoom: 3
    });

    // Add tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);

    layerGroupRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    const handleResize = () => map.invalidateSize();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      map.remove();
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current || !buoyOptions.length) return;

    // Clear existing markers
    layerGroupRef.current.clearLayers();
    markersRef.current = [];

    buoyOptions.forEach(buoy => {
      if (!buoy.coordinates) return;

      // Get adjusted coordinates (may return multiple points for dateline crossing)
      const adjustedCoords = getAdjustedCoordinates(buoy.coordinates);
      
      adjustedCoords.forEach(([lon, lat]) => {
        const isSelected = selectedStations.includes(buoy.spotter_id);
        
        const marker = L.marker([lat, lon], {
          icon: isSelected ? createGreenMarkerIcon() : createBlueMarkerIcon(),
          opacity: isSelected ? 1 : 0.8,
          zIndexOffset: isSelected ? 1000 : 0,
          buoyId: buoy.spotter_id
        })
        .bindPopup(`
          <div>
            <strong>${buoy.spotter_id}</strong><br>
            <small>${buoy.country_co || 'Unknown location'}</small><br>
            Status: <b>${buoy.is_active ? 'Active' : 'Inactive'}</b><br>
            Last data: ${buoy.latest_date || 'Unknown'}<br>
            Coordinates: ${lat.toFixed(4)}°N, ${lon.toFixed(4)}°E
          </div>
        `)
        .addTo(layerGroupRef.current);

        markersRef.current.push(marker);
      });
    });

  }, [buoyOptions]);

  useEffect(() => {
    if (!mapRef.current || markersRef.current.length === 0) return;

    // Update marker appearance based on selection
    markersRef.current.forEach(marker => {
      const buoyId = marker.options.buoyId;
      const isSelected = selectedStations.includes(buoyId);
      
      // Change both icon and opacity
      marker.setIcon(isSelected ? createGreenMarkerIcon() : createBlueMarkerIcon());
      marker.setOpacity(isSelected ? 1 : 0.8);
      marker.setZIndexOffset(isSelected ? 1000 : 0);
    });

    // Fit bounds to selected stations if any
    if (selectedStations.length > 0) {
      const selectedCoords = [];
      
      markersRef.current.forEach(marker => {
        if (selectedStations.includes(marker.options.buoyId)) {
          selectedCoords.push(marker.getLatLng());
        }
      });

      if (selectedCoords.length > 0) {
        const bounds = L.latLngBounds(selectedCoords);
       // mapRef.current.fitBounds(bounds, { padding: [50, 50] });
      }
    }

  }, [selectedStations]);

  return (
    <div 
      id="realtime-search-map" 
      style={{ 
        height: '100%', 
        width: '100%',
        borderRadius: '0.25rem'
      }} 
    />
  );
});

RealtimeSearchMap.displayName = 'RealtimeSearchMap';

export default RealtimeSearchMap;