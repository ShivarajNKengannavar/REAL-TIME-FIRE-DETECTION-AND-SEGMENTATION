import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Box, Input, Button } from '@chakra-ui/react';

interface MapProps {
  incidents: Array<{
    lat: number;
    lon: number;
    risk_level: number;
    timestamp: string;
    location_name: string;
    zone_type: string;
  }>;
}

const Map = ({ incidents }: MapProps) => {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef<any>(null);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [manualLocation, setManualLocation] = useState<string>('');
  const [marker, setMarker] = useState<L.Marker | null>(null);
  const [locationMode, setLocationMode] = useState<'prompt' | 'live' | 'manual'>('prompt');

  useEffect(() => {
    if (!mapInstanceRef.current) {
      // Initialize map
      mapInstanceRef.current = L.map(mapRef.current!).setView([12.9716, 77.5946], 13);

      // Add tile layer
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
      }).addTo(mapInstanceRef.current);

      // Layer control
      const baseLayers = {
        'OpenStreetMap': L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'),
        'Light Mode': L.tileLayer('https://cartodb-basemaps-{s}.global.ssl.fastly.net/light_all/{z}/{x}/{y}.png'),
        'Dark Mode': L.tileLayer('https://cartodb-basemaps-{s}.global.ssl.fastly.net/dark_all/{z}/{x}/{y}.png'),
      };

      L.control.layers(baseLayers).addTo(mapInstanceRef.current);
    }

    if (mapInstanceRef.current) {
      // Clear existing markers and layers
      mapInstanceRef.current.eachLayer((layer: any) => {
        if (layer instanceof L.Marker || layer instanceof L.LayerGroup) {
          mapInstanceRef.current.removeLayer(layer);
        }
      });

      // Add incident markers
      const validIncidents = incidents.filter(
        (incident) =>
          typeof incident.lat === 'number' &&
          typeof incident.lon === 'number' &&
          !isNaN(incident.lat) &&
          !isNaN(incident.lon)
      );

      validIncidents.forEach((incident) => {
        const color =
          incident.risk_level > 0.7
            ? 'red'
            : incident.risk_level > 0.3
            ? 'orange'
            : 'green';

        const icon = L.divIcon({
          className: 'custom-div-icon',
          html: `<div style="background-color: ${color}; width: 10px; height: 10px; border-radius: 50%; border: 2px solid white;"></div>`,
          iconSize: [10, 10],
          iconAnchor: [5, 5],
        });

        L.marker([incident.lat, incident.lon], { icon })
          .bindPopup(`
            <b>${incident.location_name}</b><br>
            Risk Level: ${(incident.risk_level * 100).toFixed(1)}%<br>
            Time: ${incident.timestamp}<br>
            Zone: ${incident.zone_type}
          `)
          .addTo(mapInstanceRef.current);
      });

      // Heatmap layer
      if (validIncidents.length > 0) {
        const heatData = validIncidents.map((i) => [i.lat, i.lon, i.risk_level]);

        // @ts-ignore
        L.heatLayer(heatData, {
          radius: 25,
          blur: 15,
          maxZoom: 10,
          max: 1.0,
          gradient: {
            0.4: 'blue',
            0.6: 'yellow',
            0.8: 'orange',
            1.0: 'red',
          },
        }).addTo(mapInstanceRef.current);
      }

      // Use geolocation only if selected
      if (navigator.geolocation && locationMode === 'live') {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const { latitude, longitude } = position.coords;
            setUserLocation([latitude, longitude]);
            mapInstanceRef.current.setView([latitude, longitude], 13);
            L.marker([latitude, longitude]).addTo(mapInstanceRef.current);
          },
          () => {
            alert('Could not get your location');
          }
        );
      }
    }
  }, [incidents, locationMode]);

  const handleLocationSearch = async () => {
    if (!manualLocation.trim()) return;

    const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${manualLocation}`);
    const data = await response.json();

    if (data && data[0]) {
      const { lat, lon } = data[0];
      setUserLocation([parseFloat(lat), parseFloat(lon)]);
      mapInstanceRef.current.setView([lat, lon], 13);

      if (marker) {
        mapInstanceRef.current.removeLayer(marker);
      }

      const newMarker = L.marker([lat, lon]).addTo(mapInstanceRef.current);
      setMarker(newMarker);
    } else {
      alert('Location not found');
    }
  };

  return (
    <Box h="100%" w="100%">
      {locationMode === 'prompt' && (
        <Box mb={4}>
          <Button onClick={() => setLocationMode('live')} colorScheme="green" mr={4}>
            Use My Current Location
          </Button>
          <Button onClick={() => setLocationMode('manual')} colorScheme="blue">
            Enter Location Manually
          </Button>
        </Box>
      )}

      {locationMode === 'manual' && (
        <>
          <Input
            value={manualLocation}
            onChange={(e) => setManualLocation(e.target.value)}
            placeholder="Enter a location"
            size="lg"
            mb={4}
          />
          <Button onClick={handleLocationSearch} colorScheme="blue" mb={4}>
            Search Location
          </Button>
        </>
      )}

      <Box ref={mapRef} h="500px" w="100%" />
    </Box>
  );
};

export default Map;
