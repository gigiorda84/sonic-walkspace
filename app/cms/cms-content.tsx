'use client';

import React, { useEffect, useMemo, useRef, useState } from "react";

const IS_CLIENT = typeof window !== "undefined";
const LANG_CODES = ["it-IT", "fr-FR"]; // IT + FR

// Dynamic recharts components
function DynamicChart({ data }: { data: any[] }) {
  const [ChartComponents, setChartComponents] = useState<any>(null);

  useEffect(() => {
    if (!IS_CLIENT) return;
    
    import("recharts").then((recharts) => {
      setChartComponents({
        ResponsiveContainer: recharts.ResponsiveContainer,
        LineChart: recharts.LineChart,
        CartesianGrid: recharts.CartesianGrid,
        XAxis: recharts.XAxis,
        YAxis: recharts.YAxis,
        Tooltip: recharts.Tooltip,
        Line: recharts.Line,
        BarChart: recharts.BarChart,
        Bar: recharts.Bar
      });
    });
  }, []);

  if (!ChartComponents) {
    return <div className="h-64 w-full flex items-center justify-center text-neutral-400">Loading chart...</div>;
  }

  const { ResponsiveContainer, LineChart, CartesianGrid, XAxis, YAxis, Tooltip, Line } = ChartComponents;

  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="name" />
        <YAxis />
        <Tooltip />
        <Line type="monotone" dataKey="value" stroke="#8884d8" />
      </LineChart>
    </ResponsiveContainer>
  );
}

async function seedTour() {
  if (!IS_CLIENT) return null;
  const { v4: uuidv4 } = await import("uuid");
  return {
    id: uuidv4(),
    slug: "bandite-demo",
    title: "BANDITE — Demo Tour",
    priceEUR: 3.99,
    published: false,
    locales: [{ code: "it-IT", title: "BANDITE (IT)", description: "Passeggiata sonora geolocalizzata." }],
    regions: [
      { id: uuidv4(), lat: 45.0749, lng: 7.6774, radiusM: 120, sort: 1 },
      { id: uuidv4(), lat: 45.0705, lng: 7.6868, radiusM: 120, sort: 2 },
      { id: uuidv4(), lat: 45.0567, lng: 7.6861, radiusM: 140, sort: 3 },
    ],
    tracks: { "it-IT": {} },
    vouchers: [],
  };
}

function formatEUR(n:number) {
  try { return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(n); }
  catch { return `€${Number(n).toFixed(2)}`; }
}

function randomCode() {
  if (!IS_CLIENT) return "WS-XXXX-XXXX";
  const p = () => Math.random().toString(36).slice(2, 6).toUpperCase();
  return `WS-${p()}-${p()}`;
}

class ErrorBoundary extends React.Component<any, any> {
  constructor(props:any) { super(props); this.state = { hasError: false, msg: "" }; }
  static getDerivedStateFromError(err:any) { return { hasError: true, msg: String(err) }; }
  componentDidCatch(err:any) { if (process.env.NODE_ENV !== 'production') console.error(err); }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950 text-neutral-100 flex items-center justify-center">
          <div className="flex flex-col items-center gap-4 p-6 rounded-2xl border border-red-500/20 bg-red-500/10">
            <div className="text-red-400 font-medium">Errore UI</div>
            <div className="text-sm text-red-300 max-w-md text-center">{this.state.msg}</div>
            <button 
              className="px-4 py-2 rounded-xl bg-red-500/20 border border-red-500/30 text-red-300 hover:bg-red-500/30 transition-all duration-200"
              onClick={() => window.location.reload()}
            >
              Ricarica pagina
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// Click handler component for map
function ClickAddCircle({ onAdd, useMapEvents }: { onAdd: (lat: number, lng: number) => void, useMapEvents: any }) {
  const map = useMapEvents({
    click: (e: any) => {
      onAdd(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

// Draggable marker component
function DraggableMarker({ region, onDragEnd, Marker }: { 
  region: any; 
  onDragEnd: (regionId: string, lat: number, lng: number) => void;
  Marker: any;
}) {
  const eventHandlers = {
    dragend: (e: any) => {
      const marker = e.target;
      const position = marker.getLatLng();
      onDragEnd(region.id, position.lat, position.lng);
    },
  };

  return (
    <Marker
      position={[region.lat, region.lng]}
      draggable={true}
      eventHandlers={eventHandlers}
    >
      <div className="bg-white text-black px-2 py-1 rounded text-xs font-medium shadow-lg cursor-move">
        #{region.sort}
      </div>
    </Marker>
  );
}

// Layer switcher component
function LayerSwitcher({ currentLayer, onLayerChange, layers }: {
  currentLayer: string;
  onLayerChange: (layer: string) => void;
  layers: Record<string, { name: string; url: string; attribution: string }>;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="absolute top-4 right-4 z-[1000]">
      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-all duration-200 shadow-lg flex items-center gap-2"
        >
          <span>🗺️</span>
          {layers[currentLayer]?.name || 'Map'}
          <span className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}>▼</span>
        </button>
        
        {isOpen && (
          <div className="absolute top-full right-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-xl overflow-hidden min-w-[120px]">
            {Object.entries(layers).map(([key, layer]) => (
              <button
                key={key}
                onClick={() => {
                  onLayerChange(key);
                  setIsOpen(false);
                }}
                className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-100 transition-colors duration-200 ${
                  currentLayer === key ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-gray-700'
                }`}
              >
                {layer.name}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Map component that handles Leaflet initialization
function MapComponent({ tour, updateTour }: { tour: any, updateTour: (p: (t: any) => void) => void }) {
  const [isMapReady, setIsMapReady] = useState(false);
  const [MapContainer, setMapContainer] = useState<any>(null);
  const [TileLayer, setTileLayer] = useState<any>(null);
  const [Circle, setCircle] = useState<any>(null);
  const [Polyline, setPolyline] = useState<any>(null);
  const [Marker, setMarker] = useState<any>(null);
  const [useMapEvents, setUseMapEvents] = useState<any>(null);
  const [currentLayer, setCurrentLayer] = useState('streets');

  // Define available map layers
  const mapLayers = {
    streets: {
      name: 'Streets',
      url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    },
    satellite: {
      name: 'Satellite',
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      attribution: '&copy; <a href="https://www.esri.com/">Esri</a>'
    },
    terrain: {
      name: 'Terrain',
      url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
      attribution: '&copy; <a href="https://opentopomap.org/">OpenTopoMap</a>'
    },
    dark: {
      name: 'Dark',
      url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
    }
  };

  useEffect(() => {
    if (!IS_CLIENT) return;
    
    // Load Leaflet CSS
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    link.integrity = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';
    link.crossOrigin = '';
    document.head.appendChild(link);

    // Load all components dynamically
    Promise.all([
      import('leaflet'),
      import('react-leaflet').then(m => m.MapContainer),
      import('react-leaflet').then(m => m.TileLayer),
      import('react-leaflet').then(m => m.Circle),
      import('react-leaflet').then(m => m.Polyline),
      import('react-leaflet').then(m => m.Marker),
      import('react-leaflet').then(m => m.useMapEvents)
    ]).then(([leaflet, MapContainerComp, TileLayerComp, CircleComp, PolylineComp, MarkerComp, useMapEventsHook]) => {
      // Set Leaflet icon options
      leaflet.Icon.Default.imagePath = 'https://unpkg.com/leaflet@1.9.4/dist/images/';
      
      setMapContainer(() => MapContainerComp);
      setTileLayer(() => TileLayerComp);
      setCircle(() => CircleComp);
      setPolyline(() => PolylineComp);
      setMarker(() => MarkerComp);
      setUseMapEvents(() => useMapEventsHook);
      setIsMapReady(true);
    });
  }, []);

  const addRegion = async (lat: number, lng: number) => {
    const { v4: uuidv4 } = await import("uuid");
    updateTour((t: any) => {
      const newRegion = {
        id: uuidv4(),
        lat,
        lng,
        radiusM: 120,
        sort: Math.max(...t.regions.map((r: any) => r.sort), 0) + 1,
      };
      t.regions.push(newRegion);
      // Initialize tracks for new region
      Object.keys(t.tracks).forEach((locale: string) => {
        if (!t.tracks[locale]) t.tracks[locale] = {};
        t.tracks[locale][newRegion.id] = {};
      });
    });
  };

  const handleMarkerDragEnd = (regionId: string, lat: number, lng: number) => {
    updateTour((t: any) => {
      const region = t.regions.find((r: any) => r.id === regionId);
      if (region) {
        region.lat = lat;
        region.lng = lng;
      }
    });
  };

  if (!isMapReady || !MapContainer || !TileLayer || !Circle || !Polyline || !Marker || !useMapEvents) {
    return (
      <div className="rounded-2xl border border-neutral-800/50 bg-neutral-900/30 backdrop-blur-sm p-6 shadow-xl">
        <div className="text-sm text-neutral-400 mb-4 font-medium">Mappa</div>
        <div className="h-64 w-full rounded-xl bg-neutral-800/30 flex items-center justify-center">
          <div className="text-sm text-neutral-400">Caricamento mappa...</div>
        </div>
      </div>
    );
  }

  const sorted = [...(tour.regions || [])].sort((a, b) => (a.sort || 0) - (b.sort || 0));
  const center = sorted.length > 0 ? [sorted[0].lat, sorted[0].lng] : [45.0705, 7.6868];

  return (
    <div className="rounded-2xl border border-neutral-800/50 bg-neutral-900/30 backdrop-blur-sm p-6 shadow-xl">
      <div className="flex items-center justify-between mb-4">
        <div className="text-sm text-neutral-400 font-medium">Mappa</div>
        <div className="text-xs text-neutral-500">Clicca per aggiungere • Trascina i marker per spostare</div>
      </div>
      <div className="h-64 w-full rounded-xl overflow-hidden border border-neutral-700/50 relative">
        <LayerSwitcher
          currentLayer={currentLayer}
          onLayerChange={(layer) => {
            console.log('Switching to layer:', layer);
            setCurrentLayer(layer);
          }}
          layers={mapLayers}
        />
        <MapContainer
          center={center as [number, number]}
          zoom={15}
          style={{ height: "100%", width: "100%" }}
          className="z-0"
        >
          <TileLayer
            attribution={mapLayers[currentLayer].attribution}
            url={mapLayers[currentLayer].url}
            key={currentLayer} // Force re-render when layer changes
          />
          {sorted.map((r: any, idx: number) => (
            <React.Fragment key={r.id}>
              <Circle
                center={[r.lat, r.lng]}
                radius={r.radiusM}
                pathOptions={{
                  color: idx === 0 ? "#10b981" : "#6366f1",
                  fillColor: idx === 0 ? "#10b981" : "#6366f1",
                  fillOpacity: 0.2,
                  weight: 2,
                }}
              />
              <DraggableMarker
                region={r}
                onDragEnd={handleMarkerDragEnd}
                Marker={Marker}
              />
            </React.Fragment>
          ))}
          {sorted.length > 1 && (
            <Polyline
              positions={sorted.map((r: any) => [r.lat, r.lng])}
              pathOptions={{
                color: "#f59e0b",
                weight: 3,
                opacity: 0.8,
              }}
            />
          )}
          <ClickAddCircle onAdd={addRegion} useMapEvents={useMapEvents} />
        </MapContainer>
      </div>
    </div>
  );
}

export default function PageCMSContent() {
  const [tours, setTours] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useState("editor");
  
  useEffect(() => {
    if (IS_CLIENT) {
      // Try to load tours from localStorage first
      try {
        const savedTours = localStorage.getItem('WS_CMS_TOURS');
        if (savedTours) {
          const parsedTours = JSON.parse(savedTours);
          if (parsedTours && parsedTours.length > 0) {
            setTours(parsedTours);
            setSelectedId(parsedTours[0].id);
            return;
          }
        }
      } catch (err) {
        console.error('Failed to load tours from localStorage:', err);
      }
      
      // Fallback to creating a new tour
      seedTour().then((initialTour) => {
        if (initialTour) {
          setTours([initialTour]);
          setSelectedId(initialTour.id);
        } else {
          console.error('Failed to create initial tour');
          // Create a minimal fallback tour
          const fallbackTour = {
            id: 'fallback-' + Date.now(),
            slug: "fallback-tour",
            title: "Fallback Tour",
            priceEUR: 0,
            published: false,
            locales: [{ code: "it-IT", title: "Fallback Tour", description: "Tour di fallback." }],
            regions: [],
            tracks: { "it-IT": {} },
            vouchers: [],
          };
          setTours([fallbackTour]);
          setSelectedId(fallbackTour.id);
        }
      }).catch((err) => {
        console.error('Failed to seed tour:', err);
        // Create a minimal fallback tour
        const fallbackTour = {
          id: 'fallback-' + Date.now(),
          slug: "fallback-tour",
          title: "Fallback Tour",
          priceEUR: 0,
          published: false,
          locales: [{ code: "it-IT", title: "Fallback Tour", description: "Tour di fallback." }],
          regions: [],
          tracks: { "it-IT": {} },
          vouchers: [],
        };
        setTours([fallbackTour]);
        setSelectedId(fallbackTour.id);
      });
    }
  }, []);
  
  const tour = useMemo(() => tours.find((t) => t && t.id === selectedId), [tours, selectedId]);

  if (!tour) {
    // If no tour is selected but we have tours, select the first one
    if (tours.length > 0 && !selectedId) {
      setSelectedId(tours[0].id);
      return (
        <div className="min-h-screen bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950 text-neutral-100 flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 animate-spin" />
            <div className="text-sm text-neutral-400">Selecting tour...</div>
          </div>
        </div>
      );
    }
    
    return (
      <div className="min-h-screen bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950 text-neutral-100 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 animate-spin" />
          <div className="text-sm text-neutral-400">Initializing tour data...</div>
        </div>
      </div>
    );
  }

  const updateTour = (patch:(t:any)=>void) => {
    setTours((s) => {
      const updated = s.map((t) => {
        if (t && t.id === selectedId) {
          const tourCopy = { ...t };
          patch(tourCopy);
          // Ensure required properties exist
          if (!tourCopy.regions) tourCopy.regions = [];
          if (!tourCopy.tracks) tourCopy.tracks = {};
          if (!tourCopy.locales) tourCopy.locales = [];
          if (!tourCopy.vouchers) tourCopy.vouchers = [];
          return tourCopy;
        }
        return t;
      });
      // Save to localStorage for player access
      if (IS_CLIENT) {
        try {
          // Check localStorage size before saving
          const dataToSave = JSON.stringify(updated);
          const dataSize = new Blob([dataToSave]).size;
          const maxSize = 5 * 1024 * 1024; // 5MB limit
          
          console.log(`Data size to save: ${(dataSize / 1024 / 1024).toFixed(2)}MB`);
          
          if (dataSize > maxSize) {
            console.warn('Data too large for localStorage, attempting to clean up...');
            
            // Try to clean up old data by removing large media files
            const cleanedTours = updated.map(tour => {
              const cleanedTour = { ...tour };
              if (cleanedTour.tracks) {
                Object.keys(cleanedTour.tracks).forEach(locale => {
                  Object.keys(cleanedTour.tracks[locale]).forEach(regionId => {
                    const track = cleanedTour.tracks[locale][regionId];
                    // Keep only essential data, remove large media files
                    if (track.audioDataUrl && track.audioDataUrl.length > 100000) {
                      console.log(`Removing large audio file from ${regionId}`);
                      delete track.audioDataUrl;
                      track.audioFilename = track.audioFilename || 'removed-large-file.mp3';
                    }
                    if (track.imageDataUrl && track.imageDataUrl.length > 100000) {
                      console.log(`Removing large image file from ${regionId}`);
                      delete track.imageDataUrl;
                      track.imageFilename = track.imageFilename || 'removed-large-file.jpg';
                    }
                  });
                });
              }
              return cleanedTour;
            });
            
            const cleanedData = JSON.stringify(cleanedTours);
            const cleanedSize = new Blob([cleanedData]).size;
            
            console.log(`Cleaned data size: ${(cleanedSize / 1024 / 1024).toFixed(2)}MB`);
            
            if (cleanedSize <= maxSize) {
              localStorage.setItem('WS_CMS_TOURS', cleanedData);
              console.log('Tours saved to localStorage after cleanup');
            } else {
              // If still too large, save only essential data
              const essentialTours = updated.map(tour => ({
                id: tour.id,
                title: tour.title,
                description: tour.description,
                locale: tour.locale,
                published: tour.published,
                regions: tour.regions?.map(r => ({
                  id: r.id,
                  name: r.name,
                  lat: r.lat,
                  lng: r.lng,
                  radiusM: r.radiusM,
                  sort: r.sort
                })),
                tracks: tour.tracks ? Object.keys(tour.tracks).reduce((acc, locale) => {
                  acc[locale] = Object.keys(tour.tracks[locale]).reduce((regionAcc, regionId) => {
                    const track = tour.tracks[locale][regionId];
                    regionAcc[regionId] = {
                      title: track.title,
                      description: track.description,
                      transcript: track.transcript,
                      frequency: track.frequency,
                      audioFilename: track.audioFilename,
                      imageFilename: track.imageFilename
                    };
                    return regionAcc;
                  }, {});
                  return acc;
                }, {}) : {}
              }));
              
              localStorage.setItem('WS_CMS_TOURS', JSON.stringify(essentialTours));
              console.log('Tours saved to localStorage with essential data only');
            }
          } else {
            // Data is small enough, save normally
            localStorage.setItem('WS_CMS_TOURS', dataToSave);
            console.log('Tours saved to localStorage successfully');
          }
          
          // Debug: log the updated tour data
          const updatedTour = updated.find(t => t.id === selectedId);
          if (updatedTour) {
            console.log('Updated tour data:', {
              id: updatedTour.id,
              title: updatedTour.title,
              regions: updatedTour.regions?.length,
              tracks: updatedTour.tracks ? Object.keys(updatedTour.tracks) : [],
              sampleTrack: updatedTour.tracks?.[updatedTour.locale || 'it-IT'] ? 
                Object.keys(updatedTour.tracks[updatedTour.locale || 'it-IT'])[0] : null
            });
          }
        } catch (err) {
          console.error('Failed to save tours to localStorage:', err);
          
          // If quota exceeded, try to clear some space
          if (err.name === 'QuotaExceededError') {
            console.log('Attempting to clear localStorage space...');
            try {
              // Clear old data and try again with essential data only
              const essentialTours = updated.map(tour => ({
                id: tour.id,
                title: tour.title,
                description: tour.description,
                locale: tour.locale,
                published: tour.published,
                regions: tour.regions?.map(r => ({
                  id: r.id,
                  name: r.name,
                  lat: r.lat,
                  lng: r.lng,
                  radiusM: r.radiusM,
                  sort: r.sort
                })),
                tracks: tour.tracks ? Object.keys(tour.tracks).reduce((acc, locale) => {
                  acc[locale] = Object.keys(tour.tracks[locale]).reduce((regionAcc, regionId) => {
                    const track = tour.tracks[locale][regionId];
                    regionAcc[regionId] = {
                      title: track.title,
                      description: track.description,
                      transcript: track.transcript,
                      frequency: track.frequency,
                      audioFilename: track.audioFilename,
                      imageFilename: track.imageFilename
                    };
                    return regionAcc;
                  }, {});
                  return acc;
                }, {}) : {}
              }));
              
              localStorage.setItem('WS_CMS_TOURS', JSON.stringify(essentialTours));
              console.log('Tours saved to localStorage with essential data only after quota error');
            } catch (retryErr) {
              console.error('Failed to save even essential data:', retryErr);
              alert('Errore: Impossibile salvare i dati. Prova a rimuovere alcuni file audio o immagini per liberare spazio.');
            }
          }
        }
      }
      return updated;
    });
  };

  const addTour = async () => {
    const t = await seedTour(); 
    if (t) {
      setTours((s) => {
        const updated = [t, ...s];
        // Save to localStorage for player access
        if (IS_CLIENT) {
          try {
            localStorage.setItem('WS_CMS_TOURS', JSON.stringify(updated));
          } catch (err) {
            console.error('Failed to save tours to localStorage:', err);
          }
        }
        return updated;
      }); 
      setSelectedId(t.id); 
    }
  };

  const deleteTour = (tourId: string) => {
    setTours((s) => {
      const updated = s.filter((t) => t.id !== tourId);
      // Save to localStorage for player access
      if (IS_CLIENT) {
        try {
          localStorage.setItem('WS_CMS_TOURS', JSON.stringify(updated));
        } catch (err) {
          console.error('Failed to save tours to localStorage:', err);
        }
      }
      return updated;
    });
    if (selectedId === tourId) {
      const remainingTours = tours.filter((t) => t.id !== tourId);
      setSelectedId(remainingTours.length > 0 ? remainingTours[0].id : null);
    }
  };

  const addRegion = async () => {
    const { v4: uuidv4 } = await import("uuid");
    updateTour((t: any) => {
      // Ensure regions array exists
      if (!t.regions) t.regions = [];
      
      // Calculate next sort value safely
      const maxSort = t.regions.length > 0 
        ? Math.max(...t.regions.map((r: any) => r.sort || 0))
        : 0;
      
      const newRegion = {
        id: uuidv4(),
        lat: 45.0705,
        lng: 7.6868,
        radiusM: 120,
        sort: maxSort + 1,
      };
      t.regions.push(newRegion);
      
      // Initialize tracks for new region
      if (!t.tracks) t.tracks = {};
      Object.keys(t.tracks).forEach((locale: string) => {
        if (!t.tracks[locale]) t.tracks[locale] = {};
        t.tracks[locale][newRegion.id] = {};
      });
    });
  };

  const deleteRegion = (regionId: string) => {
    updateTour((t: any) => {
      if (!t.regions) t.regions = [];
      t.regions = t.regions.filter((r: any) => r.id !== regionId);
      
      // Remove tracks for deleted region
      if (t.tracks) {
        Object.keys(t.tracks).forEach((locale: string) => {
          if (t.tracks[locale]) {
            delete t.tracks[locale][regionId];
          }
        });
      }
    });
  };

  const addLocale = () => {
    const newCode = LANG_CODES.find((c) => !tour.locales.some((l: any) => l.code === c));
    if (newCode) {
      // Create a complete copy of the tour for the new language
      const { v4: uuidv4 } = require("uuid");
      const newTour = {
        ...tour,
        id: uuidv4(),
        slug: `${tour.slug}-${newCode.split("-")[0].toLowerCase()}`,
        title: `${tour.title} (${newCode.split("-")[0].toUpperCase()})`,
        locale: newCode,
        parentTourId: tour.id, // Reference to original tour
        published: false, // New language versions start as unpublished
        locales: [{ 
          code: newCode, 
          title: `${tour.title} (${newCode.split("-")[0].toUpperCase()})`, 
          description: tour.locales[0]?.description || "Passeggiata sonora geolocalizzata." 
        }],
        // Copy all regions but reset tracks for new language
        regions: tour.regions.map((r: any) => ({ ...r })),
        tracks: { [newCode]: {} },
        vouchers: []
      };

      setTours((s) => {
        const updated = [newTour, ...s];
        if (IS_CLIENT) {
          try {
            localStorage.setItem('WS_CMS_TOURS', JSON.stringify(updated));
          } catch (err) {
            console.error('Failed to save tours to localStorage:', err);
          }
        }
        return updated;
      });
      
      setSelectedId(newTour.id);
    }
  };

  const removeLocale = (code: string) => {
    // Find and delete the tour for this specific language
    const tourToDelete = tours.find((t: any) => t.locale === code && t.parentTourId === tour.parentTourId);
    if (tourToDelete) {
      deleteTour(tourToDelete.id);
    }
  };

  const createLanguageCopy = () => {
    // Get available languages that don't have a tour version yet
    const availableLanguages = LANG_CODES.filter((code) => {
      const hasTour = tours.some((t: any) => 
        (t.parentTourId === tour.parentTourId || t.id === tour.parentTourId) && 
        (t.locale === code || t.locales?.[0]?.code === code)
      );
      return !hasTour;
    });

    if (availableLanguages.length === 0) {
      alert("Tutte le lingue disponibili hanno già una versione del tour!");
      return;
    }

    // Show language selection dialog
    const selectedLanguage = prompt(
      `Seleziona la lingua per la nuova versione del tour:\n${availableLanguages.map(code => `${code} (${code.split('-')[0] === 'it' ? 'Italiano' : code.split('-')[0] === 'en' ? 'English' : code.split('-')[0] === 'fr' ? 'Français' : code.split('-')[0] === 'de' ? 'Deutsch' : code.split('-')[0] === 'es' ? 'Español' : code})`).join('\n')}`
    );

    if (!selectedLanguage || !availableLanguages.includes(selectedLanguage)) {
      return;
    }

    // Create a complete copy of the tour for the new language
    const { v4: uuidv4 } = require("uuid");
    const newTour = {
      ...tour,
      id: uuidv4(),
      slug: `${tour.slug}-${selectedLanguage.split("-")[0].toLowerCase()}`,
      title: `${tour.title} (${selectedLanguage.split("-")[0].toUpperCase()})`,
      locale: selectedLanguage,
      parentTourId: tour.parentTourId || tour.id,
      published: false, // New language versions start as unpublished
      locales: [{ 
        code: selectedLanguage, 
        title: `${tour.title} (${selectedLanguage.split("-")[0].toUpperCase()})`, 
        description: tour.description || "Passeggiata sonora geolocalizzata." 
      }],
      // Copy all regions but reset tracks for new language
      regions: tour.regions.map((r: any) => ({ ...r })),
      tracks: { [selectedLanguage]: {} },
      vouchers: []
    };

    setTours((s) => {
      const updated = [newTour, ...s];
      if (IS_CLIENT) {
        try {
          localStorage.setItem('WS_CMS_TOURS', JSON.stringify(updated));
        } catch (err) {
          console.error('Failed to save tours to localStorage:', err);
        }
      }
      return updated;
    });
    
    setSelectedId(newTour.id);
    alert(`Tour copiato con successo in ${selectedLanguage}! Ora puoi modificare i contenuti per questa lingua.`);
  };

  const moveRegion = (regionId: string, direction: 'up' | 'down') => {
    updateTour((t: any) => {
      if (!t.regions) return;
      
      const regions = [...t.regions];
      const currentIndex = regions.findIndex((r: any) => r.id === regionId);
      
      if (currentIndex === -1) return;
      
      if (direction === 'up' && currentIndex > 0) {
        // Swap with previous
        const temp = regions[currentIndex];
        regions[currentIndex] = regions[currentIndex - 1];
        regions[currentIndex - 1] = temp;
      } else if (direction === 'down' && currentIndex < regions.length - 1) {
        // Swap with next
        const temp = regions[currentIndex];
        regions[currentIndex] = regions[currentIndex + 1];
        regions[currentIndex + 1] = temp;
      }
      
      // Update the regions array in the tour
      t.regions = regions;
    });
  };

  const updateTrackField = (regionId: string, field: string, value: string) => {
    console.log(`Updating track field: ${regionId}.${field} = "${value}"`);
    
    updateTour((t: any) => {
      if (!t.tracks) t.tracks = {};
      const currentLocale = t.locale || 'it-IT';
      if (!t.tracks[currentLocale]) t.tracks[currentLocale] = {};
      if (!t.tracks[currentLocale][regionId]) t.tracks[currentLocale][regionId] = {};
      t.tracks[currentLocale][regionId][field] = value;
      
      console.log(`Updated track data for ${regionId}:`, t.tracks[currentLocale][regionId]);
    });
  };

  const onUploadMp3 = async (regionId: string, file: File | undefined) => {
    if (!file || !tour) return;
    
    // Check file size (limit to 2MB for audio)
    const maxSize = 2 * 1024 * 1024; // 2MB
    if (file.size > maxSize) {
      alert(`File troppo grande! Il file audio deve essere inferiore a 2MB. Dimensione attuale: ${(file.size / 1024 / 1024).toFixed(2)}MB`);
      return;
    }
    
    try {
      // Convert to data URL for local playback
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsDataURL(file);
      });

      // Generate a simple filename
      const fileName = `${regionId}-${Date.now()}.mp3`;

      updateTour((t: any) => {
        if (!t || !t.tracks) return;
        const currentLocale = t.locale || 'it-IT';
        if (!t.tracks[currentLocale]) t.tracks[currentLocale] = {};
        if (!t.tracks[currentLocale][regionId]) t.tracks[currentLocale][regionId] = {};
        t.tracks[currentLocale][regionId].audioDataUrl = dataUrl;
        t.tracks[currentLocale][regionId].audioFilename = fileName;
        t.tracks[currentLocale][regionId].audioKey = `local://${fileName}`;
      });
    } catch (err) {
      console.error("Upload error:", err);
      alert("Errore durante il caricamento del file audio. Riprova.");
    }
  };

  const onUploadImage = async (regionId: string, file: File | undefined) => {
    if (!file || !tour) return;
    
    // Check file size (limit to 1MB for images)
    const maxSize = 1 * 1024 * 1024; // 1MB
    if (file.size > maxSize) {
      alert(`File troppo grande! L'immagine deve essere inferiore a 1MB. Dimensione attuale: ${(file.size / 1024 / 1024).toFixed(2)}MB`);
      return;
    }
    
    try {
      // Convert to data URL for local display
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsDataURL(file);
      });

      // Generate a simple filename
      const fileName = `${regionId}-${Date.now()}.jpg`;

      updateTour((t: any) => {
        if (!t || !t.tracks) return;
        const currentLocale = t.locale || 'it-IT';
        if (!t.tracks[currentLocale]) t.tracks[currentLocale] = {};
        if (!t.tracks[currentLocale][regionId]) t.tracks[currentLocale][regionId] = {};
        t.tracks[currentLocale][regionId].imageDataUrl = dataUrl;
        t.tracks[currentLocale][regionId].imageFilename = fileName;
        t.tracks[currentLocale][regionId].imageKey = `local://${fileName}`;
      });
    } catch (err) {
      console.error("Image upload error:", err);
      alert("Errore durante il caricamento dell'immagine. Riprova.");
    }
  };

  const onUploadTourImage = async (file: File | undefined) => {
    if (!file || !tour) return;
    
    // Check file size (limit to 1MB for tour images)
    const maxSize = 1 * 1024 * 1024; // 1MB
    if (file.size > maxSize) {
      alert(`File troppo grande! L'immagine del tour deve essere inferiore a 1MB. Dimensione attuale: ${(file.size / 1024 / 1024).toFixed(2)}MB`);
      return;
    }
    
    try {
      // Convert to data URL for local display
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsDataURL(file);
      });

      // Generate a simple filename
      const fileName = `tour-${tour.id}-${Date.now()}.jpg`;

      updateTour((t: any) => {
        t.tourImageDataUrl = dataUrl;
        t.tourImageFilename = fileName;
        t.tourImageKey = `local://${fileName}`;
      });
    } catch (err) {
      console.error("Tour image upload error:", err);
      alert("Errore durante il caricamento dell'immagine del tour. Riprova.");
    }
  };

  const clearLocalStorage = () => {
    if (confirm('Sei sicuro di voler pulire il localStorage? Questo rimuoverà tutti i file audio e immagini salvati, mantenendo solo i dati testuali.')) {
      if (IS_CLIENT) {
        try {
          // Get current tours and remove media files
          const currentTours = JSON.parse(localStorage.getItem('WS_CMS_TOURS') || '[]');
          const cleanedTours = currentTours.map((tour: any) => {
            const cleanedTour = { ...tour };
            if (cleanedTour.tracks) {
              Object.keys(cleanedTour.tracks).forEach(locale => {
                Object.keys(cleanedTour.tracks[locale]).forEach(regionId => {
                  const track = cleanedTour.tracks[locale][regionId];
                  // Remove large media files but keep metadata
                  delete track.audioDataUrl;
                  delete track.imageDataUrl;
                  if (track.audioFilename) track.audioFilename = 'removed-large-file.mp3';
                  if (track.imageFilename) track.imageFilename = 'removed-large-file.jpg';
                });
              });
            }
            // Remove tour image
            delete cleanedTour.tourImageDataUrl;
            return cleanedTour;
          });
          
          localStorage.setItem('WS_CMS_TOURS', JSON.stringify(cleanedTours));
          setTours(cleanedTours);
          alert('localStorage pulito! I file audio e immagini sono stati rimossi per liberare spazio.');
        } catch (err) {
          console.error('Error clearing localStorage:', err);
          alert('Errore durante la pulizia del localStorage.');
        }
      }
    }
  };

  const getStorageInfo = () => {
    if (IS_CLIENT) {
      try {
        const data = localStorage.getItem('WS_CMS_TOURS');
        if (data) {
          const size = new Blob([data]).size;
          const sizeMB = (size / 1024 / 1024).toFixed(2);
          alert(`Dimensione localStorage: ${sizeMB}MB\n\nPer liberare spazio, usa "Pulisci localStorage" o riduci le dimensioni dei file audio/immagini.`);
        } else {
          alert('Nessun dato salvato nel localStorage.');
        }
      } catch (err) {
        console.error('Error getting storage info:', err);
        alert('Errore nel calcolo della dimensione del localStorage.');
      }
    }
  };

  const checkS3Status = async () => {
    try {
      const response = await fetch('/api/s3/status');
      const data = await response.json();
      
      if (data.status === 'success') {
        alert(`✅ S3 Configuration OK!\n\nBucket: ${data.bucket}\nPrefix: ${data.prefix}\nObjects: ${data.bucketInfo.totalObjects}\n\nAWS Region: ${data.config.awsRegion}\nAccess Key: ${data.config.awsAccessKeyId}\nPublic Read: ${data.config.s3PublicRead}`);
      } else {
        alert(`❌ S3 Configuration Error:\n\n${data.message}\n\nConfig:\nAWS Region: ${data.config.awsRegion}\nAccess Key: ${data.config.awsAccessKeyId}\nSecret Key: ${data.config.awsSecretAccessKey}\nPublic Read: ${data.config.s3PublicRead}`);
      }
    } catch (error) {
      console.error('Error checking S3 status:', error);
      alert('❌ Errore nel controllo dello stato S3. Controlla la console per i dettagli.');
    }
  };

  const sorted = [...(tour.regions || [])].sort((a, b) => (a.sort || 0) - (b.sort || 0));

  // Mock analytics data
  const daily = [
    { name: "Lun", value: 12 }, { name: "Mar", value: 19 }, { name: "Mer", value: 15 },
    { name: "Gio", value: 23 }, { name: "Ven", value: 28 }, { name: "Sab", value: 35 },
    { name: "Dom", value: 42 }, { name: "Lun", value: 18 }, { name: "Mar", value: 22 },
    { name: "Mer", value: 31 }, { name: "Gio", value: 27 }, { name: "Ven", value: 38 },
    { name: "Sab", value: 45 }, { name: "Dom", value: 52 }
  ];
  const langs = [
    { name: "Italiano", value: 65 }, { name: "Français", value: 35 }
  ];

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950 text-neutral-100">
        {/* Header */}
        <div className="border-b border-neutral-800/50 bg-neutral-900/30 backdrop-blur-sm">
          <div className="max-w-7xl mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg shadow-lg">
                  S
                </div>
                <div>
                  <h1 className="text-xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                    Sonic Walkscape — CMS
                  </h1>
                  <div className="text-sm text-neutral-400">Content Management System</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-sm text-neutral-400">
                  Tour: <span className="text-indigo-400 font-medium">{tour.title}</span>
                </div>
                          <button 
            className="px-3 py-2 rounded-xl bg-blue-600/50 hover:bg-blue-500/50 text-white text-xs font-medium transition-all duration-200 hover:scale-105 shadow-lg"
            onClick={getStorageInfo}
            title="Verifica spazio localStorage"
          >
            💾 Spazio
          </button>
          <button 
            className="px-3 py-2 rounded-xl bg-yellow-600/50 hover:bg-yellow-500/50 text-white text-xs font-medium transition-all duration-200 hover:scale-105 shadow-lg"
            onClick={clearLocalStorage}
            title="Pulisci file audio e immagini"
          >
            🧹 Pulisci
          </button>
          <button 
            className="px-3 py-2 rounded-xl bg-green-600/50 hover:bg-green-500/50 text-white text-xs font-medium transition-all duration-200 hover:scale-105 shadow-lg"
            onClick={checkS3Status}
            title="Verifica configurazione S3"
          >
            ☁️ S3 Status
          </button>
                <button 
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-sm font-medium transition-all duration-200 hover:scale-105 shadow-lg"
                  onClick={() => {
                    try {
                      window.open('/player', '_self');
                    } catch {
                      window.location.hash = '#player';
                    }
                  }}
                >
                  🎵 Apri Player
                </button>
                <button 
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-sm font-medium transition-all duration-200 hover:scale-105 shadow-lg"
                  onClick={addTour}
                >
                  + Nuovo Tour
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Tour Selection */}
        <div className="border-b border-neutral-800/50 bg-neutral-800/20">
          <div className="max-w-7xl mx-auto px-6 py-3">
            <div className="flex items-center gap-3 overflow-x-auto">
              {tours.map((t) => (
                <button
                  key={t.id}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200 whitespace-nowrap ${
                    selectedId === t.id
                      ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg"
                      : "bg-neutral-800/50 hover:bg-neutral-700/50 text-neutral-300 hover:text-neutral-100"
                  }`}
                  onClick={() => setSelectedId(t.id)}
                >
                  <span>{t.title}</span>
                  {tours.length > 1 && (
                    <button
                      className="ml-1 text-xs hover:text-red-300 transition-colors duration-200"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteTour(t.id);
                      }}
                    >
                      ✕
                    </button>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="grid grid-cols-1 lg:grid-cols-6 gap-6">
            {/* Left: tour settings, languages */}
            <div className="lg:col-span-3 flex flex-col gap-6">
              {/* Tab Navigation */}
              <div className="flex items-center gap-1 p-1 rounded-2xl bg-neutral-900/30 border border-neutral-800/50">
                {["editor", "analytics"].map((t) => (
                  <button
                    key={t}
                    className={`flex-1 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                      tab === t
                        ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg"
                        : "text-neutral-400 hover:text-neutral-300 hover:bg-neutral-800/50"
                    }`}
                    onClick={() => setTab(t)}
                  >
                    {t === "editor" ? "Editor" : "Analytics"}
                  </button>
                ))}
              </div>

              {tab === "editor" && (
                <>
                  {/* Tour Settings */}
                  <div className="rounded-2xl border border-neutral-800/50 bg-neutral-900/30 backdrop-blur-sm p-6 shadow-xl">
                    <div className="text-sm text-neutral-400 mb-4 font-medium">Impostazioni Tour</div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs text-neutral-500 mb-2">Slug</label>
                        <input 
                          className="w-full rounded-xl bg-neutral-900/50 border border-neutral-600/50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all duration-200" 
                          value={tour.slug} 
                          onChange={(e) => updateTour((t: any) => { t.slug = e.target.value; })} 
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-neutral-500 mb-2">Prezzo EUR</label>
                        <input 
                          type="number" 
                          step="0.01" 
                          className="w-full rounded-xl bg-neutral-900/50 border border-neutral-600/50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all duration-200" 
                          value={tour.priceEUR} 
                          onChange={(e) => updateTour((t: any) => { t.priceEUR = parseFloat(e.target.value || "0"); })} 
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-xs text-neutral-500 mb-2">Titolo</label>
                        <input 
                          className="w-full rounded-xl bg-neutral-900/50 border border-neutral-600/50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all duration-200" 
                          value={tour.title} 
                          onChange={(e) => updateTour((t: any) => { t.title = e.target.value; })} 
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-neutral-500 mb-2">Lingua</label>
                        <select 
                          className="w-full rounded-xl bg-neutral-900/50 border border-neutral-600/50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all duration-200" 
                          value={tour.locale || 'it-IT'} 
                          onChange={(e) => updateTour((t: any) => { t.locale = e.target.value; })} 
                        >
                          <option value="it-IT">Italiano (IT)</option>
                          <option value="en-US">English (US)</option>
                          <option value="fr-FR">Français (FR)</option>
                          <option value="de-DE">Deutsch (DE)</option>
                          <option value="es-ES">Español (ES)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-neutral-500 mb-2">ID Tour Padre</label>
                        <input 
                          className="w-full rounded-xl bg-neutral-900/50 border border-neutral-600/50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all duration-200" 
                          placeholder="ID del tour originale (opzionale)"
                          value={tour.parentTourId || ""} 
                          onChange={(e) => updateTour((t: any) => { t.parentTourId = e.target.value; })} 
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-xs text-neutral-500 mb-2">Descrizione Tour</label>
                        <textarea 
                          className="w-full rounded-xl bg-neutral-900/50 border border-neutral-600/50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all duration-200 resize-none" 
                          rows={3}
                          placeholder="Descrizione del tour per gli utenti..."
                          value={tour.description || ""} 
                          onChange={(e) => updateTour((t: any) => { t.description = e.target.value; })} 
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-xs text-neutral-500 mb-2">Foto Tour</label>
                        <div className="flex items-center gap-3">
                          <input 
                            className="flex-1 rounded-xl bg-neutral-900/50 border border-neutral-600/50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all duration-200" 
                            placeholder="URL immagine o carica file" 
                            value={tour.tourImageUrl || ""} 
                            onChange={(e) => updateTour((t: any) => { t.tourImageUrl = e.target.value; })} 
                          />
                          <label className="text-xs rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 px-3 py-2 cursor-pointer transition-all duration-200 hover:scale-105 shadow-lg">
                            Upload
                            <input type="file" accept="image/*" className="hidden" onChange={(e) => onUploadTourImage(e.target.files?.[0])} />
                          </label>
                        </div>
                        {tour.tourImageDataUrl && (
                          <div className="mt-3">
                            <img 
                              src={tour.tourImageDataUrl} 
                              alt="Tour" 
                              className="w-full h-32 object-cover rounded-xl border border-neutral-700/50" 
                            />
                          </div>
                        )}
                      </div>
                      <div className="md:col-span-2 flex items-center gap-3">
                        <label className="flex items-center gap-2 text-sm">
                          <input 
                            type="checkbox" 
                            className="rounded bg-neutral-900/50 border border-neutral-600/50 focus:ring-2 focus:ring-indigo-500/50 transition-all duration-200" 
                            checked={tour.published} 
                            onChange={(e) => updateTour((t: any) => { t.published = e.target.checked; })} 
                          />
                          Pubblicato
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* Languages */}
                  <div className="rounded-2xl border border-neutral-800/50 bg-neutral-900/30 backdrop-blur-sm p-6 shadow-xl">
                    <div className="flex items-center justify-between mb-4">
                      <div className="text-sm text-neutral-400 font-medium">Lingue</div>
                      <button 
                        className="text-xs rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 px-3 py-1 text-white transition-all duration-200 hover:scale-105 shadow-lg"
                        onClick={createLanguageCopy}
                      >
                        + Copia Tour in Altra Lingua
                      </button>
                    </div>
                    
                    {/* Current Language */}
                    <div className="mb-4">
                      <div className="text-xs text-neutral-500 mb-2">Lingua Corrente</div>
                      <div className="flex items-center gap-3 p-3 rounded-xl border border-emerald-700/50 bg-emerald-800/20">
                        <div className="flex-1">
                          <div className="text-sm font-medium text-emerald-300">{tour.locales[0]?.title || tour.title}</div>
                          <div className="text-xs text-emerald-400">{tour.locale || tour.locales[0]?.code || 'it-IT'}</div>
                        </div>
                        <div className="text-xs text-emerald-400">Attiva</div>
                      </div>
                    </div>

                    {/* Available Languages for this Tour */}
                    <div className="mb-4">
                      <div className="text-xs text-neutral-500 mb-2">Versioni Linguistiche Disponibili</div>
                      <div className="space-y-2">
                        {tours
                          .filter((t: any) => t.parentTourId === tour.parentTourId || t.id === tour.parentTourId)
                          .map((t: any) => (
                            <div key={t.id} className="flex items-center gap-3 p-2 rounded-lg border border-neutral-700/50 bg-neutral-800/30">
                              <div className="flex-1">
                                <div className="text-sm font-medium text-neutral-200">{t.title}</div>
                                <div className="text-xs text-neutral-400">{t.locale || t.locales[0]?.code}</div>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className={`text-xs px-2 py-1 rounded ${
                                  t.published 
                                    ? 'bg-emerald-600/20 text-emerald-300 border border-emerald-500/30' 
                                    : 'bg-neutral-600/20 text-neutral-400 border border-neutral-500/30'
                                }`}>
                                  {t.published ? 'Pubblicato' : 'Bozza'}
                                </span>
                                {t.id !== selectedId && (
                                  <button 
                                    className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors duration-200"
                                    onClick={() => setSelectedId(t.id)}
                                  >
                                    Modifica
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>


                  </div>


                </>
              )}

              {tab === "analytics" && (
                <div className="rounded-2xl border border-neutral-800/50 bg-neutral-900/30 backdrop-blur-sm p-6 shadow-xl">
                  <div className="text-sm text-neutral-400 mb-4 font-medium">Analytics</div>
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    <div className="rounded-2xl border border-neutral-800 p-4 lg:col-span-2">
                      <div className="text-sm text-neutral-400 mb-2">Andamento ultimi 14 giorni</div>
                      <div style={{ width: "100%", height: 280 }}>
                        <DynamicChart data={daily} />
                      </div>
                    </div>
                    <div className="rounded-2xl border border-neutral-800 p-4">
                      <div className="text-sm text-neutral-400 mb-2">Distribuzione lingue</div>
                      <div style={{ width: "100%", height: 280 }}>
                        <DynamicChart data={langs} />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Right: map and regions */}
            <div className="lg:col-span-3 flex flex-col gap-6">
              {/* Map */}
              {tour && <MapComponent tour={tour} updateTour={updateTour} />}

              {/* Regions - Consolidated Section */}
              {tab === "editor" && (
                <div className="rounded-2xl border border-neutral-800/50 bg-neutral-900/30 backdrop-blur-sm p-6 shadow-xl">
                  <div className="flex items-center justify-between mb-4">
                    <div className="text-sm text-neutral-400 font-medium">Regioni e Tracce Audio</div>
                    <button 
                      className="text-xs rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 px-3 py-1 text-white transition-all duration-200 hover:scale-105 shadow-lg"
                      onClick={addRegion}
                    >
                      + Aggiungi Regione
                    </button>
                  </div>
                  <div className="space-y-4">
                    {sorted.map((r: any, idx: number) => {
                      const currentLocale = tour.locale || 'it-IT';
                      const tr = tour.tracks[currentLocale]?.[r.id] || {};
                      const up = tr.audioKey;
                      return (
                        <div key={r.id} className="p-4 rounded-xl border border-neutral-700/50 bg-neutral-800/30">
                          {/* Region Header */}
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-3">
                              <div className="text-sm font-medium text-indigo-400">Regione #{r.sort}</div>
                              <div className="text-xs text-neutral-500">({r.lat.toFixed(6)}, {r.lng.toFixed(6)})</div>
                            </div>
                            <div className="flex items-center gap-2">
                              {/* Reorder buttons */}
                              <div className="flex items-center gap-1">
                                <button 
                                  className="text-xs bg-neutral-700/50 hover:bg-neutral-600/50 text-neutral-300 hover:text-white px-2 py-1 rounded transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed" 
                                  onClick={() => moveRegion(r.id, 'up')}
                                  disabled={idx === 0}
                                  title="Sposta su"
                                >
                                  ↑
                                </button>
                                <button 
                                  className="text-xs bg-neutral-700/50 hover:bg-neutral-600/50 text-neutral-300 hover:text-white px-2 py-1 rounded transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed" 
                                  onClick={() => moveRegion(r.id, 'down')}
                                  disabled={idx === sorted.length - 1}
                                  title="Sposta giù"
                                >
                                  ↓
                                </button>
                              </div>
                              <button 
                                className="text-xs text-red-400 hover:text-red-300 transition-colors duration-200 hover:scale-110" 
                                onClick={() => deleteRegion(r.id)}
                              >
                                Elimina Regione
                              </button>
                            </div>
                          </div>

                          {/* Region Position and Radius */}
                          <div className="grid grid-cols-3 gap-2 mb-3">
                            <div>
                              <label className="block text-xs text-neutral-500 mb-1">Latitudine</label>
                              <input 
                                type="number" 
                                step="0.000001"
                                className="w-full rounded-xl bg-neutral-900/50 border border-neutral-600/50 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500/50 transition-all duration-200" 
                                value={Number(r.lat).toFixed(6)} 
                                onChange={(e) => {
                                  const value = parseFloat(e.target.value);
                                  if (!isNaN(value)) {
                                    updateTour((t: any) => { 
                                      const rr = t.regions.find((x: any) => x.id === r.id); 
                                      if (rr) rr.lat = value; 
                                    });
                                  }
                                }} 
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-neutral-500 mb-1">Longitudine</label>
                              <input 
                                type="number" 
                                step="0.000001"
                                className="w-full rounded-xl bg-neutral-900/50 border border-neutral-600/50 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500/50 transition-all duration-200" 
                                value={Number(r.lng).toFixed(6)} 
                                onChange={(e) => {
                                  const value = parseFloat(e.target.value);
                                  if (!isNaN(value)) {
                                    updateTour((t: any) => { 
                                      const rr = t.regions.find((x: any) => x.id === r.id); 
                                      if (rr) rr.lng = value; 
                                    });
                                  }
                                }} 
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-neutral-500 mb-1">Raggio (m)</label>
                              <input 
                                type="number" 
                                className="w-full rounded-xl bg-neutral-900/50 border border-neutral-600/50 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500/50 transition-all duration-200" 
                                value={r.radiusM} 
                                onChange={(e) => {
                                  const value = parseInt(e.target.value || "0", 10);
                                  if (!isNaN(value) && value > 0) {
                                    updateTour((t: any) => { 
                                      const rr = t.regions.find((x: any) => x.id === r.id); 
                                      if (rr) rr.radiusM = value; 
                                    });
                                  }
                                }} 
                              />
                            </div>
                          </div>

                          {/* Content Settings */}
                          <div className="space-y-3">
                            {/* Title and Description */}
                            <div className="space-y-2">
                              <input 
                                className="w-full rounded-xl bg-neutral-900/50 border border-neutral-600/50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all duration-200" 
                                placeholder="Titolo traccia" 
                                value={tr.title || ""} 
                                onChange={(e) => updateTrackField(r.id, "title", e.target.value)} 
                              />
                              <textarea 
                                className="w-full rounded-xl bg-neutral-900/50 border border-neutral-600/50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all duration-200 resize-none" 
                                placeholder="Descrizione (opzionale)" 
                                rows={2}
                                value={tr.description || ""} 
                                onChange={(e) => updateTrackField(r.id, "description", e.target.value)} 
                              />
                              <textarea 
                                className="w-full rounded-xl bg-neutral-900/50 border border-neutral-600/50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all duration-200 resize-none" 
                                placeholder="Trascrizione (opzionale)" 
                                rows={3}
                                value={tr.transcript || ""} 
                                onChange={(e) => updateTrackField(r.id, "transcript", e.target.value)} 
                              />
                            </div>

                            {/* Audio Upload */}
                            <div className="space-y-2">
                              <div className="text-xs text-neutral-400 font-medium">Audio Track</div>
                              <div className="flex items-center gap-2">
                                <input 
                                  className="flex-1 rounded-xl bg-neutral-900/50 border border-neutral-600/50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all duration-200" 
                                  placeholder="S3 key/OPFS path" 
                                  value={tr.audioKey || ""} 
                                  onChange={(e) => updateTrackField(r.id, "audioKey", e.target.value)} 
                                />
                                <label className="text-xs rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 px-3 py-2 cursor-pointer transition-all duration-200 hover:scale-105 shadow-lg">
                                  Upload MP3
                                  <input type="file" accept="audio/mpeg,audio/mp3,audio/wav" className="hidden" onChange={(e) => onUploadMp3(r.id, e.target.files?.[0])} />
                                </label>
                              </div>
                            </div>

                            {/* Image Upload */}
                            <div className="space-y-2">
                              <div className="text-xs text-neutral-400 font-medium">Reference Image</div>
                              <div className="flex items-center gap-2">
                                <input 
                                  className="flex-1 rounded-xl bg-neutral-900/50 border border-neutral-600/50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all duration-200" 
                                  placeholder="Image URL or path" 
                                  value={tr.imageKey || ""} 
                                  onChange={(e) => updateTrackField(r.id, "imageKey", e.target.value)} 
                                />
                                <label className="text-xs rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 px-3 py-2 cursor-pointer transition-all duration-200 hover:scale-105 shadow-lg">
                                  Upload Image
                                  <input type="file" accept="image/*" className="hidden" onChange={(e) => onUploadImage(r.id, e.target.files?.[0])} />
                                </label>
                              </div>
                            </div>
                          </div>
                          {/* Preview Section */}
                          <div className="mt-4 space-y-3">
                            {/* Audio Preview */}
                            {tr.audioDataUrl && (
                              <div className="space-y-2">
                                <div className="text-xs text-neutral-400 font-medium">Audio Preview</div>
                                <audio controls src={tr.audioDataUrl} className="w-full rounded-xl" />
                                <div className="text-xs text-neutral-500">{tr.audioFilename}</div>
                              </div>
                            )}

                            {/* Image Preview */}
                            {tr.imageDataUrl && (
                              <div className="space-y-2">
                                <div className="text-xs text-neutral-400 font-medium">Image Preview</div>
                                <div className="relative">
                                  <img 
                                    src={tr.imageDataUrl} 
                                    alt="Reference" 
                                    className="w-full h-32 object-cover rounded-xl border border-neutral-700/50" 
                                  />
                                  <div className="absolute top-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded">
                                    {tr.imageFilename}
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* File Info */}
                            <div className="flex items-center justify-between text-xs text-neutral-500">
                              <div className="truncate">
                                Audio: {tr.audioHttpUrl ? <a className="underline hover:text-indigo-400 transition-colors duration-200" href={tr.audioHttpUrl} target="_blank" rel="noreferrer">HTTP</a> : '—'}
                              </div>
                              <div className="ml-2">
                                {tr.audioKey ? `S3: ${tr.audioKey}` : ''}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
}
