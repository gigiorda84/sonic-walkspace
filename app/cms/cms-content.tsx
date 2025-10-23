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
    slug: `tour-${Date.now()}`, // Generate unique slug
    title: "BANDITE — Demo Tour",
    priceEUR: 3.99,
    published: true, // Default to published so tours appear in player
    locales: [{ code: "it-IT", title: "BANDITE (IT)", description: "Passeggiata sonora geolocalizzata." }],
    regions: [
      { id: uuidv4(), lat: 45.0749, lng: 7.6774, radiusM: 120, sort: 1 },
      { id: uuidv4(), lat: 45.0705, lng: 7.6868, radiusM: 120, sort: 2 },
      { id: uuidv4(), lat: 45.0567, lng: 7.6861, radiusM: 140, sort: 3 },
    ],
    tracks: { "it-IT": {} },
    subtitles: { "it-IT": {} }, // Store SRT files per locale
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

// SRT Subtitle Functions
interface SubtitleEntry {
  id: number;
  startTime: string; // Format: "00:00:10,500"
  endTime: string;   // Format: "00:00:13,000"
  text: string;
}

function parseSRT(srtContent: string): SubtitleEntry[] {
  const entries: SubtitleEntry[] = [];
  const blocks = srtContent.trim().split('\n\n');
  
  blocks.forEach(block => {
    const lines = block.trim().split('\n');
    if (lines.length >= 3) {
      const id = parseInt(lines[0]);
      const timecode = lines[1];
      const text = lines.slice(2).join('\n');
      
      const [startTime, endTime] = timecode.split(' --> ');
      if (startTime && endTime) {
        entries.push({ id, startTime, endTime, text });
      }
    }
  });
  
  return entries;
}

function generateSRT(entries: SubtitleEntry[]): string {
  return entries.map(entry => 
    `${entry.id}\n${entry.startTime} --> ${entry.endTime}\n${entry.text}`
  ).join('\n\n');
}

function timeToSeconds(timeStr: string): number {
  const [time, ms] = timeStr.split(',');
  const [hours, minutes, seconds] = time.split(':').map(Number);
  return hours * 3600 + minutes * 60 + seconds + (ms ? parseInt(ms) / 1000 : 0);
}

function secondsToTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')},${ms.toString().padStart(3, '0')}`;
}

// Generate subtitles from audio using OpenAI Whisper API or fallback
async function generateSubtitlesFromAudio(audioFile: File, language: string = 'it-IT'): Promise<{
  entries: SubtitleEntry[];
  source: string;
  duration?: number;
  warning?: string;
}> {
  console.log('Generating subtitles from audio using advanced speech-to-text...', { 
    fileName: audioFile.name, 
    fileSize: audioFile.size, 
    language 
  });
  
  try {
    // Prepare FormData for API call
    const formData = new FormData();
    formData.append('audio', audioFile);
    formData.append('language', language.split('-')[0]); // Extract language code (it from it-IT)
    
    // Call our transcription API
    const response = await fetch('/api/transcribe', {
      method: 'POST',
      body: formData,
    });
    
    if (!response.ok) {
      throw new Error(`API Error: ${response.status} - ${response.statusText}`);
    }
    
    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || 'Transcription failed');
    }
    
    console.log(`✅ Transcription completed successfully!`, {
      source: result.source,
      duration: result.duration,
      entriesCount: result.entries.length,
      warning: result.warning
    });
    
    if (result.warning) {
      console.warn('⚠️ Transcription Warning:', result.warning);
    }
    
    return result;
    
  } catch (error) {
    console.error('❌ Error in generateSubtitlesFromAudio:', error);
    
    // Fallback to client-side mock generation
    console.log('🔄 Falling back to client-side generation...');
    const fallbackEntries = await generateFallbackSubtitles(audioFile, language);
    return {
      entries: fallbackEntries,
      source: 'fallback-client',
      warning: 'Utilizzata generazione locale. Aggiungi OPENAI_API_KEY per trascrizione AI.'
    };
  }
}

// Fallback subtitle generation for when API fails
async function generateFallbackSubtitles(audioFile: File, language: string): Promise<SubtitleEntry[]> {
  return new Promise((resolve, reject) => {
    try {
      // Create an audio element to analyze the audio file
      const audio = new Audio();
      const audioUrl = URL.createObjectURL(audioFile);
      
      audio.onloadedmetadata = () => {
        const duration = audio.duration;
        console.log(`📊 Audio analysis: ${duration} seconds duration`);
        
        // Generate dynamic subtitles based on audio duration
        const entries: SubtitleEntry[] = [];
        const segmentDuration = Math.max(3, Math.min(6, duration / 8)); // 3-6 seconds per segment
        let currentTime = 0;
        let id = 1;
        
        // Sample texts based on language
        const sampleTexts: { [key: string]: string[] } = {
          'it-IT': [
            "Benvenuti in questa passeggiata sonora.",
            "Qui potrete scoprire la storia di questo luogo.",
            "Ascoltate attentamente i suoni che vi circondano.",
            "Questa zona ha una storia molto particolare.",
            "Noterete i dettagli architettonici interessanti.",
            "Il paesaggio qui cambia durante le stagioni.",
            "Questo punto offre una vista panoramica unica.",
            "La tradizione locale racconta storie affascinanti.",
            "Osservate come la luce cambia durante il giorno.",
            "Grazie per aver partecipato a questo tour."
          ],
          'en-US': [
            "Welcome to this audio walking tour.",
            "Here you can discover the history of this place.",
            "Listen carefully to the sounds around you.",
            "This area has a very particular history.",
            "Notice the interesting architectural details.",
            "The landscape here changes with the seasons.",
            "This point offers a unique panoramic view.",
            "Local tradition tells fascinating stories.",
            "Observe how the light changes during the day.",
            "Thank you for participating in this tour."
          ]
        };
        
        const texts = sampleTexts[language] || sampleTexts['it-IT'];
        
        while (currentTime < duration - 1) {
          const endTime = Math.min(currentTime + segmentDuration, duration);
          const textIndex = (id - 1) % texts.length;
          
          entries.push({
            id: id,
            startTime: secondsToTime(currentTime),
            endTime: secondsToTime(endTime),
            text: texts[textIndex]
          });
          
          currentTime = endTime + 0.5; // Small gap between segments
          id++;
        }
        
        console.log(`📝 Generated ${entries.length} fallback subtitle entries for ${duration.toFixed(1)}s audio`);
        
        // Cleanup
        URL.revokeObjectURL(audioUrl);
        resolve(entries);
      };
      
      audio.onerror = () => {
        console.error('❌ Error loading audio for analysis');
        URL.revokeObjectURL(audioUrl);
        
        // Ultimate fallback
        const fallbackEntries: SubtitleEntry[] = [
          {
            id: 1,
            startTime: "00:00:00,000",
            endTime: "00:00:03,000",
            text: "Sottotitolo generato automaticamente."
          },
          {
            id: 2,
            startTime: "00:00:03,500",
            endTime: "00:00:07,000",
            text: "Modifica questo testo secondo le tue esigenze."
          }
        ];
        resolve(fallbackEntries);
      };
      
      // Load the audio data
      audio.src = audioUrl;
      
      // Timeout fallback (10 seconds)
      setTimeout(() => {
        if (audio.readyState === 0) {
          console.warn('⏱️ Audio loading timeout, using minimal fallback');
          URL.revokeObjectURL(audioUrl);
          
          const timeoutEntries: SubtitleEntry[] = [
            {
              id: 1,
              startTime: "00:00:00,000",
              endTime: "00:00:05,000",
              text: "Audio caricato con successo."
            },
            {
              id: 2,
              startTime: "00:00:05,500",
              endTime: "00:00:10,000",
              text: "Modifica questi sottotitoli secondo le tue esigenze."
            }
          ];
          resolve(timeoutEntries);
        }
      }, 10000); // 10 second timeout
      
    } catch (error) {
      console.error('❌ Error in generateFallbackSubtitles:', error);
      reject(error);
    }
  });
}


// Function to download SRT file
const downloadSRT = (subtitleName: string, content: string) => {
  try {
    // Create blob with SRT content
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    
    // Create download link
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${subtitleName}.srt`;
    
    // Trigger download
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Clean up
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Error downloading SRT file:', error);
    alert('Errore durante il download del file SRT.');
  }
};

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
  const [isDeletingTour, setIsDeletingTour] = useState<string | null>(null);
  const [playingAudio, setPlayingAudio] = useState<string | null>(null);

  // Subtitle editor modal state
  const [isEditingSubtitle, setIsEditingSubtitle] = useState(false);
  const [editingSubtitleId, setEditingSubtitleId] = useState<string | null>(null);
  const [editingSubtitleContent, setEditingSubtitleContent] = useState('');

  // Upload progress state
  const [uploadingAudio, setUploadingAudio] = useState<string | null>(null);

  useEffect(() => {
    if (IS_CLIENT) {
      // Load tours from both localStorage and S3
      const loadTours = async () => {
        let localTours: any[] = [];
        let s3Tours: any[] = [];

        // Try to load tours from localStorage first
        try {
          const savedTours = localStorage.getItem('WS_CMS_TOURS');
          if (savedTours) {
            const parsedTours = JSON.parse(savedTours);
            if (parsedTours && Array.isArray(parsedTours)) {
              // Filter out null/undefined tours and ensure they have IDs
              localTours = parsedTours.filter(t => t && t.id);
              console.log(`📦 Loaded ${localTours.length} tours from localStorage`);
            }
          }
        } catch (err) {
          console.error('Failed to load tours from localStorage:', err);
        }

        // Try to load tours from S3
        try {
          console.log('🌐 Loading published tours from S3...');
          const response = await fetch('/api/tours/list');
          if (response.ok) {
            const data = await response.json();
            if (data.tours && data.tours.length > 0) {
              // Fetch full manifests for each tour
              const fullTours = await Promise.all(
                data.tours.map(async (tourSummary: any) => {
                  try {
                    const manifestResponse = await fetch(`/api/tours/${tourSummary.slug}`);
                    if (manifestResponse.ok) {
                      const manifestData = await manifestResponse.json();
                      return manifestData.tour;
                    }
                    return null;
                  } catch (error) {
                    console.error(`Failed to load manifest for ${tourSummary.slug}:`, error);
                    return null;
                  }
                })
              );
              s3Tours = fullTours.filter(t => t !== null);
              console.log(`✅ Loaded ${s3Tours.length} tours from S3`);
            }
          }
        } catch (err) {
          console.error('Failed to load tours from S3:', err);
        }

        // Merge tours: prioritize localStorage, add S3 tours that aren't in localStorage
        const mergedTours = [...localTours];
        const localSlugs = new Set(localTours.map(t => t.slug));

        s3Tours.forEach(s3Tour => {
          if (!localSlugs.has(s3Tour.slug)) {
            mergedTours.push(s3Tour);
          }
        });

        if (mergedTours.length > 0) {
          console.log(`📚 Total tours available: ${mergedTours.length} (${localTours.length} local + ${s3Tours.filter(t => !localSlugs.has(t.slug)).length} from S3)`);
          setTours(mergedTours);
          setSelectedId(mergedTours[0].id);
          return;
        }

        // Only create demo tour if no tours found anywhere
        console.log('⚠️ No tours found in localStorage or S3, creating demo tour...');
        const initialTour = await seedTour();
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
      };

      // Call the async function
      loadTours();
    }
  }, []);
  
  const tour = useMemo(() => tours.find((t) => t && t.id === selectedId), [tours, selectedId]);

  if (!tour) {
    // If no tour is selected but we have tours, select the first one
    if (tours.length > 0 && !selectedId) {
      const firstValidTour = tours.find(t => t && t.id);
      if (firstValidTour) {
        setSelectedId(firstValidTour.id);
      }
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
          if (!tourCopy.subtitles) tourCopy.subtitles = {};
          if (!tourCopy.locales) tourCopy.locales = [];
          if (!tourCopy.vouchers) tourCopy.vouchers = [];
          return tourCopy;
        }
        return t;
      }).filter(t => t && t.id); // Filter out null/undefined tours
      // Save to localStorage for player access
      if (IS_CLIENT) {
        try {
          // First, try to save optimized data that should fit in most browsers
          const optimizedTours = updated.map(tour => {
            const optimizedTour = { ...tour };
            
            // Proactively optimize audio files > 2MB to prevent quota issues
            if (optimizedTour.tracks) {
              Object.keys(optimizedTour.tracks).forEach(locale => {
                Object.keys(optimizedTour.tracks[locale]).forEach(regionId => {
                  const track = optimizedTour.tracks[locale][regionId];
                  if (track.audioDataUrl && track.audioDataUrl.length > 2000000) { // 2MB
                    console.log(`📉 Optimizing large audio for storage: ${regionId} (${(track.audioDataUrl.length/1024/1024).toFixed(2)}MB → metadata only)`);
                    // Keep metadata but remove large audio data
                    track.audioRemovedDueToSize = true;
                    track.audioFilename = track.audioFilename || `audio-${regionId}.mp3`;
                    delete track.audioDataUrl;
                  }
                });
              });
            }
            
            return optimizedTour;
          });

          const dataToSave = JSON.stringify(optimizedTours);
          const dataSize = new Blob([dataToSave]).size;
          
          console.log(`📊 Optimized data size: ${(dataSize / 1024 / 1024).toFixed(2)}MB`);
          console.log(`📋 Number of tours: ${updated.length}`);
          console.log(`🎵 Tours with audio:`, updated.map(t => ({
            title: t.title?.substring(0, 20),
            hasAudio: Object.values(t.tracks?.['it-IT'] || {}).some((track: any) => track.audioDataUrl)
          })));
          
          // Try to save the optimized data
          localStorage.setItem('WS_CMS_TOURS', dataToSave);
          console.log('✅ Tours saved successfully with smart optimization');
          
          // Debug: log the updated tour data
          const updatedTour = updated.find(t => t.id === selectedId);
          if (updatedTour) {
            console.log('Updated tour data:', {
              id: updatedTour.id,
              title: updatedTour.title,
              regions: updatedTour.regions?.length,
              tracks: updatedTour.tracks ? Object.keys(updatedTour.tracks) : [],
              sampleTrack: updatedTour.tracks?.[updatedTour.locale || 'it-IT'] ? 
                Object.keys(updatedTour.tracks[updatedTour.locale || 'it-IT'])[0] : null,
              subtitles: updatedTour.subtitles ? Object.keys(updatedTour.subtitles) : 'No subtitles'
            });
            
            // Debug subtitles structure
            if (updatedTour.subtitles) {
              console.log('📝 Subtitles structure:', {
                locales: Object.keys(updatedTour.subtitles),
                itIT: updatedTour.subtitles['it-IT'] ? Object.keys(updatedTour.subtitles['it-IT']) : 'No it-IT locale',
                itITContent: updatedTour.subtitles['it-IT'] ? Object.values(updatedTour.subtitles['it-IT']).map((s: any) => ({ name: s.name, contentLength: s.content?.length || 0 })) : 'No content'
              });
            }
          }
        } catch (err) {
          console.error('Failed to save optimized tours:', err);
          
          // Final fallback: save only essential data
          if (err.name === 'QuotaExceededError') {
            console.log('⚠️ localStorage quota exceeded even with optimization, saving essential data only...');
            
            try {
              // If still too large, save essential data but preserve tour structure for player
              const essentialTours = updated.map(tour => ({
                id: tour.id,
                title: tour.title,
                description: tour.description,
                locale: tour.locale,
                published: tour.published,
                slug: tour.slug, // Keep slug for player
                tourImageDataUrl: tour.tourImageDataUrl, // Keep tour image
                parentTourId: tour.parentTourId,
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
                      imageFilename: track.imageFilename,
                      imageDataUrl: track.imageDataUrl, // Keep small images
                      // Mark when audio was removed due to size
                      audioRemovedDueToSize: !track.audioDataUrl && track.audioFilename
                    };
                    return regionAcc;
                  }, {});
                  return acc;
      
                }, {}) : {}
              }));
              
              localStorage.setItem('WS_CMS_TOURS', JSON.stringify(essentialTours));
              console.log('✅ Tours saved successfully with essential data only (large audio files excluded)');
            } catch (retryErr) {
              console.error('❌ Failed to save even essential data:', retryErr);
              alert('Errore: Impossibile salvare i dati. Prova a rimuovere alcuni file audio o immagini per liberare spazio.');
            }
          }
        }
      }
      
      return updated;
    });
  };

  // Publish tour to S3 for shared access
  const publishTourToS3 = async (tourToPublish: any) => {
    if (!tourToPublish || !tourToPublish.slug) {
      console.error('Cannot publish tour: missing slug');
      return { success: false, error: 'Tour must have a slug' };
    }

    try {
      console.log('📤 Publishing tour to S3:', tourToPublish.title);

      const response = await fetch('/api/tours/publish', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(tourToPublish),
      });

      const result = await response.json();

      if (!response.ok) {
        console.error('Failed to publish tour:', result.error);
        return { success: false, error: result.error };
      }

      console.log('✅ Tour published to S3:', result.manifestUrl);
      return { success: true, ...result };
    } catch (error) {
      console.error('Error publishing tour to S3:', error);
      return { success: false, error: error.message };
    }
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

  // Function to delete S3 files for a tour
  const deleteS3FilesForTour = async (tour: any) => {
    if (!tour) return;
    
    console.log('🗑️ Deleting S3 files for tour:', tour.title);
    
    const filesToDelete = [];
    
    // Collect all S3 file keys from tracks
    if (tour.tracks) {
      Object.keys(tour.tracks).forEach(locale => {
        const localeTracks = tour.tracks[locale];
        if (localeTracks && typeof localeTracks === 'object') {
          Object.keys(localeTracks).forEach(regionId => {
            const track = localeTracks[regionId];
            if (track) {
              // Audio files
              if (track.audioKey) {
                filesToDelete.push(track.audioKey);
                console.log('📄 Will delete audio:', track.audioKey);
              }
              // Image files
              if (track.imageKey) {
                filesToDelete.push(track.imageKey);
                console.log('📄 Will delete image:', track.imageKey);
              }
            }
          });
        }
      });
    }
    
    // Delete files from S3
    if (filesToDelete.length > 0) {
      try {
        const response = await fetch('/api/s3/delete', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            keys: filesToDelete,
            tourTitle: tour.title
          }),
        });
        
        if (response.ok) {
          const result = await response.json();
          console.log('✅ S3 files deleted successfully:', result);
        } else {
          console.error('❌ Failed to delete S3 files:', response.statusText);
        }
      } catch (error) {
        console.error('❌ Error deleting S3 files:', error);
      }
    } else {
      console.log('ℹ️ No S3 files to delete for tour:', tour.title);
    }
  };

  const deleteTour = async (tourId: string) => {
    setIsDeletingTour(tourId);
    
    try {
      // Find the tour to delete to get its S3 files
      const tourToDelete = tours.find(t => t.id === tourId);
      
      if (tourToDelete) {
        // Delete S3 files first
        await deleteS3FilesForTour(tourToDelete);
      }
      
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
      
      console.log('✅ Tour deleted successfully:', tourToDelete?.title);
    } catch (error) {
      console.error('❌ Error deleting tour:', error);
      alert('Errore durante l\'eliminazione del tour. Controllare la console per dettagli.');
    } finally {
      setIsDeletingTour(null);
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
    const newCode = LANG_CODES.find((c) => !tour.locales?.some((l: any) => l.code === c));
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
          description: tour.locales?.[0]?.description || "Passeggiata sonora geolocalizzata." 
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

  const removeLocale = async (code: string) => {
    // Find and delete the tour for this specific language
    const tourToDelete = tours.find((t: any) => t.locale === code && t.parentTourId === tour.parentTourId);
    if (tourToDelete) {
      await deleteTour(tourToDelete.id);
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

    // Check file size (limit to 50MB for audio)
    const maxSize = 50 * 1024 * 1024; // 50MB
    if (file.size > maxSize) {
      alert(`File troppo grande! Il file audio deve essere inferiore a 50MB. Dimensione attuale: ${(file.size / 1024 / 1024).toFixed(2)}MB`);
      return;
    }

    const fileSizeMB = file.size / 1024 / 1024;
    console.log(`📤 Uploading audio to Supabase Storage: ${file.name} (${fileSizeMB.toFixed(2)}MB)`);

    // Show uploading state
    setUploadingAudio(regionId);

    try {
      // Import Supabase client dynamically
      const { createClient } = await import('@supabase/supabase-js');

      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://kiwufyymymzuapbjatat.supabase.co';
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_VJG7Il93z4QAdV7EHHpB2Q_4fIBkHfy';

      const supabase = createClient(supabaseUrl, supabaseAnonKey);

      // Build file path
      const slug = tour.slug || `tour-${tour.id}`;
      const locale = tour.locale || 'it-IT';
      const ext = file.name.split('.').pop() || 'mp3';
      const filePath = `tours/${slug}/${locale}/audio/${regionId}.${ext}`;

      console.log(`📁 Upload path: ${filePath}`);

      // Upload directly to Supabase from client
      const { data, error } = await supabase.storage
        .from('walkscape-audio')
        .upload(filePath, file, {
          contentType: file.type || 'audio/mpeg',
          upsert: true, // Allow overwriting
        });

      if (error) {
        throw new Error(`Supabase upload error: ${error.message}`);
      }

      // Build public URL
      const publicUrl = `${supabaseUrl}/storage/v1/object/public/walkscape-audio/${filePath}`;

      console.log(`✅ Audio uploaded successfully to Supabase: ${publicUrl}`);

      // Update tour with Supabase URL
      updateTour((t: any) => {
        if (!t || !t.tracks) return;
        const currentLocale = t.locale || 'it-IT';
        if (!t.tracks[currentLocale]) t.tracks[currentLocale] = {};
        if (!t.tracks[currentLocale][regionId]) t.tracks[currentLocale][regionId] = {};

        // Store Supabase URL instead of data URL - no more localStorage quota issues!
        t.tracks[currentLocale][regionId].audioUrl = publicUrl; // Supabase public URL for playback
        t.tracks[currentLocale][regionId].audioKey = filePath; // Storage path for management
        t.tracks[currentLocale][regionId].audioFilename = file.name;

        // Remove any old data URL to save space
        delete t.tracks[currentLocale][regionId].audioDataUrl;
      });

      // Simple success feedback
      console.log(`✅ Audio caricato con successo: ${file.name}`);
      alert(`✅ Audio caricato con successo!\n\nFile: ${file.name}\nDimensione: ${fileSizeMB.toFixed(2)}MB\nURL: ${publicUrl}`);

    } catch (err) {
      console.error("Upload error:", err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      alert(`❌ Errore durante il caricamento del file audio.\n\nDettagli: ${errorMessage}\n\nFile: ${file.name} (${fileSizeMB.toFixed(2)}MB)\n\nSuggerimenti:\n- Verifica che il file sia un MP3 valido\n- Assicurati che sia inferiore a 50MB\n- Controlla la connessione internet\n- Riprova tra qualche secondo`);
    } finally {
      // Clear uploading state
      setUploadingAudio(null);
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

  // Function to handle SRT file upload
  const onUploadSRT = async (file: File | undefined, inputElement?: HTMLInputElement) => {
    if (!file) return;
    
    // Check file type
    if (!file.name.toLowerCase().endsWith('.srt')) {
      alert('Per favore seleziona un file .srt valido');
      return;
    }
    
    // Check file size (limit to 1MB for SRT files)
    const maxSize = 1 * 1024 * 1024; // 1MB
    if (file.size > maxSize) {
      alert(`File troppo grande! Il file SRT deve essere inferiore a 1MB. Dimensione attuale: ${(file.size / 1024 / 1024).toFixed(2)}MB`);
      return;
    }
    
    try {
      // Read file content
      const fileContent = await file.text();
      
      // Validate SRT format by trying to parse it
      const parsedEntries = parseSRT(fileContent);
      if (parsedEntries.length === 0) {
        alert('Il file SRT sembra essere vuoto o mal formattato. Controlla il formato del file.');
        return;
      }
      
      // Get filename without extension for display name
      const fileName = file.name.replace(/\.srt$/i, '');
      
      // Check if subtitle with same name already exists
      const currentLocale = tour.locale || 'it-IT';
      const existingSubtitles = tour.subtitles?.[currentLocale] || {};
      const existingNames = Object.values(existingSubtitles).map((sub: any) => sub.name.toLowerCase());
      
      if (existingNames.includes(fileName.toLowerCase())) {
        const overwrite = confirm(`Un sottotitolo con il nome "${fileName}" esiste già. Vuoi sovrascriverlo?`);
        if (!overwrite) {
          // Reset the input
          if (inputElement) inputElement.value = '';
          return;
        }
      }
      
      // Add to tour
      updateTour((t: any) => {
        const currentLocale = t.locale || 'it-IT';
        if (!t.subtitles) t.subtitles = {};
        if (!t.subtitles[currentLocale]) t.subtitles[currentLocale] = {};
        
        // Remove existing subtitle with same name if overwriting
        for (const [id, subtitle] of Object.entries(t.subtitles[currentLocale])) {
          if ((subtitle as any).name.toLowerCase() === fileName.toLowerCase()) {
            delete t.subtitles[currentLocale][id];
            break;
          }
        }
        
        const srtId = Date.now().toString();
        t.subtitles[currentLocale][srtId] = {
          id: srtId,
          name: fileName,
          content: fileContent,
          language: currentLocale,
          createdAt: new Date().toISOString(),
          uploadedFile: file.name // Keep track of original filename
        };
      });
      
      // Reset the input to allow re-uploading the same file
      if (inputElement) inputElement.value = '';
      
      alert(`File SRT "${file.name}" caricato con successo! Trovate ${parsedEntries.length} entry di sottotitoli.`);
      
    } catch (error) {
      console.error('Error uploading SRT file:', error);
      alert('Errore durante il caricamento del file SRT. Controlla che sia un file di testo valido.');
    }
  };

  // Function to create SRT from audio file
  const onCreateSRTFromAudio = async (file: File | undefined) => {
    if (!file) return;
    
    // Check file type
    const allowedTypes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/m4a', 'audio/ogg'];
    if (!allowedTypes.includes(file.type) && !file.name.match(/\.(mp3|wav|m4a|ogg)$/i)) {
      alert('Per favore seleziona un file audio valido (MP3, WAV, M4A, OGG)');
      return;
    }
    
    // Check file size (limit to 50MB for audio files)
    const maxSize = 50 * 1024 * 1024; // 50MB
    if (file.size > maxSize) {
      alert(`File troppo grande! Il file audio deve essere inferiore a 50MB. Dimensione attuale: ${(file.size / 1024 / 1024).toFixed(2)}MB`);
      return;
    }
    
    try {
      console.log(`🎵 Starting SRT generation from audio: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)}MB)`);
      
      // Generate subtitles from audio using advanced speech-to-text
      const result = await generateSubtitlesFromAudio(file, tour.locale || 'it-IT');
      console.log(`Subtitle generation completed. Generated ${result.entries.length} entries:`, result.entries);
      
      const srtContent = generateSRT(result.entries);
      console.log('Generated SRT content:', srtContent);
      
      // Get filename without extension for display name
      const fileName = file.name.replace(/\.(mp3|wav|m4a|ogg)$/i, '');
      
      // Generate unique ID for the subtitle
      const srtId = Date.now().toString();
      
      // Add to tour
      updateTour((t: any) => {
        const currentLocale = t.locale || 'it-IT';
        if (!t.subtitles) t.subtitles = {};
        if (!t.subtitles[currentLocale]) t.subtitles[currentLocale] = {};
        
        t.subtitles[currentLocale][srtId] = {
          id: srtId,
          name: `${fileName} - Generati`,
          content: srtContent,
          language: currentLocale,
          createdAt: new Date().toISOString(),
          generatedFromAudio: file.name, // Track that this was generated from audio
          transcriptionSource: result.source, // Track which transcription method was used
          audioDuration: result.duration // Store audio duration
        };
        
        console.log('Subtitle added to tour successfully');
      });
      
      // Show different message based on transcription source
      let statusMessage = '';
      if (result.source === 'openai-whisper') {
        statusMessage = `🤖 Sottotitoli generati con AI professionale!\n\nTrovate ${result.entries.length} entry di trascrizione reale.`;
      } else {
        statusMessage = `⚡ Sottotitoli generati con simulazione!\n\nTrovate ${result.entries.length} entry simulate.\n\n⚠️ L'API OpenAI non è disponibile (quota/errore).\nPer trascrizione reale, riprova più tardi.`;
      }
      
      // Ask user for subtitle name and language
      const subtitleName = prompt(`${statusMessage}\n\nCome vuoi chiamare questo file di sottotitoli?`, `${fileName} - Sottotitoli`) || `${fileName} - Auto Generated`;
      
      const languages = [
        { code: 'it-IT', name: 'Italiano' },
        { code: 'en-US', name: 'English' },
        { code: 'es-ES', name: 'Español' },
        { code: 'fr-FR', name: 'Français' },
        { code: 'de-DE', name: 'Deutsch' }
      ];
      
      const languageChoice = prompt(
        `Seleziona la lingua dei sottotitoli:\n\n${languages.map((lang, index) => `${index + 1}. ${lang.name}`).join('\n')}\n\nInserisci il numero (1-${languages.length}):`,
        '1'
      );
      
      const selectedLanguage = languages[parseInt(languageChoice || '1') - 1] || languages[0];
      
      // Update the subtitle name and language
      updateTour((t: any) => {
        const currentLocale = t.locale || 'it-IT';
        if (t.subtitles?.[currentLocale]?.[srtId]) {
          t.subtitles[currentLocale][srtId].name = subtitleName;
          t.subtitles[currentLocale][srtId].language = selectedLanguage.code;
        }
      });
      
      // Ask if user wants to edit content
      const editNow = confirm('Vuoi modificare il contenuto dei sottotitoli ora?');
      
      if (editNow) {
        // Open editor for the newly created subtitle
        setTimeout(() => {
          editSubtitleContent(srtId, srtContent);
        }, 100);
      }
      
    } catch (error) {
      console.error('Error creating SRT from audio:', error);
      alert('❌ Errore durante la generazione dei sottotitoli dall\'audio.\n\nDettagli errore: ' + (error instanceof Error ? error.message : 'Errore sconosciuto') + '\n\nRiprova con un file diverso o controlla la console per maggiori dettagli.');
    }
  };

  // Function to edit subtitle content with better UX
  const editSubtitleContent = (id: string, currentContent: string) => {
    setEditingSubtitleId(id);
    setEditingSubtitleContent(currentContent);
    setIsEditingSubtitle(true);
  };

  // Save edited subtitle content
  const saveSubtitleContent = () => {
    if (!editingSubtitleId) return;

    if (editingSubtitleContent.trim() === '') {
      alert('Il contenuto non può essere vuoto.');
      return;
    }

    // Validate the SRT format
    try {
      const parsedEntries = parseSRT(editingSubtitleContent);
      if (parsedEntries.length === 0) {
        alert('Il formato SRT non è valido. Controlla la sintassi.');
        return;
      }

      // Update the subtitle
      updateTour((t: any) => {
        const currentLocale = t.locale || 'it-IT';
        if (t.subtitles?.[currentLocale]?.[editingSubtitleId]) {
          t.subtitles[currentLocale][editingSubtitleId].content = editingSubtitleContent;
        }
      });

      alert(`✅ Sottotitoli aggiornati con ${parsedEntries.length} segmenti.`);
      setIsEditingSubtitle(false);
      setEditingSubtitleId(null);
      setEditingSubtitleContent('');
    } catch (error) {
      alert('❌ Errore nel formato SRT. Ricontrolla il contenuto.');
    }
  };

  // Close subtitle editor modal
  const closeSubtitleEditor = () => {
    if (confirm('Sei sicuro di voler chiudere senza salvare?')) {
      setIsEditingSubtitle(false);
      setEditingSubtitleId(null);
      setEditingSubtitleContent('');
    }
  };

  const checkS3Status = async () => {
    try {
      const response = await fetch('/api/s3/status');
      const data = await response.json();
      
      if (data.status === 'success') {
        alert(`✅ S3 Configuration OK!\n\nBucket: ${data.bucket}\nPrefix: ${data.prefix}\n\n${data.bucketInfo.message}\nTest File: ${data.bucketInfo.testFile}\n\nAWS Region: ${data.config.awsRegion}\nAccess Key: ${data.config.awsAccessKeyId}\nPublic Read: ${data.config.s3PublicRead}\n\nNote: ${data.bucketInfo.note}`);
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
              {tours.filter(t => t && t.id).map((t) => (
                <div key={t.id} className="relative flex items-center">
                  <button
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200 whitespace-nowrap ${
                      selectedId === t.id
                        ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg"
                        : "bg-neutral-800/50 hover:bg-neutral-700/50 text-neutral-300 hover:text-neutral-100"
                    } ${tours.length > 1 ? 'pr-8' : ''}`}
                    onClick={() => setSelectedId(t.id)}
                  >
                    <span>{t.title}</span>
                  </button>
                  {tours.length > 1 && (
                    <button
                      className={`absolute right-1 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center text-xs transition-all duration-200 rounded-full ${
                        isDeletingTour === t.id 
                          ? 'text-orange-400 bg-orange-500/20 animate-spin' 
                          : 'hover:text-red-300 hover:bg-red-500/20'
                      }`}
                      onClick={async (e) => {
                        e.stopPropagation();
                        if (isDeletingTour === t.id) return; // Prevent multiple clicks
                        if (confirm(`Eliminare il tour "${t.title}"? Tutti i file S3 associati verranno eliminati permanentemente.`)) {
                          await deleteTour(t.id);
                        }
                      }}
                      disabled={isDeletingTour === t.id}
                      title={isDeletingTour === t.id ? "Eliminazione in corso..." : "Elimina tour (inclusi file S3)"}
                    >
                      {isDeletingTour === t.id ? '⏳' : '✕'}
                    </button>
                  )}
                </div>
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
                {["editor", "subtitles", "analytics"].map((t) => (
                  <button
                    key={t}
                    className={`flex-1 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                      tab === t
                        ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg"
                        : "text-neutral-400 hover:text-neutral-300 hover:bg-neutral-800/50"
                    }`}
                    onClick={() => setTab(t)}
                  >
                    {t === "editor" ? "Editor" : t === "subtitles" ? "🎬 Sottotitoli" : "Analytics"}
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
                          value={tour.locale ?? 'it-IT'} 
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
                          value={tour.parentTourId ?? ""} 
                          onChange={(e) => updateTour((t: any) => { t.parentTourId = e.target.value; })} 
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-xs text-neutral-500 mb-2">Descrizione Tour</label>
                        <textarea 
                          className="w-full rounded-xl bg-neutral-900/50 border border-neutral-600/50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all duration-200 resize-none" 
                          rows={3}
                          placeholder="Descrizione del tour per gli utenti..."
                          value={tour.description ?? ""} 
                          onChange={(e) => updateTour((t: any) => { t.description = e.target.value; })} 
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-xs text-neutral-500 mb-2">Foto Tour</label>
                        <div className="flex items-center gap-3">
                          <input 
                            className="flex-1 rounded-xl bg-neutral-900/50 border border-neutral-600/50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all duration-200" 
                            placeholder="URL immagine o carica file" 
                            value={tour.tourImageUrl ?? ""} 
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
                        <div className={`flex items-center gap-3 p-3 rounded-xl border transition-all duration-200 ${
                          tour.published 
                            ? 'bg-green-600/20 border-green-500/40 text-green-300' 
                            : 'bg-orange-600/20 border-orange-500/40 text-orange-300'
                        }`}>
                          <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                            <input
                              type="checkbox"
                              className="rounded bg-neutral-900/50 border border-neutral-600/50 focus:ring-2 focus:ring-indigo-500/50 transition-all duration-200"
                              checked={tour.published}
                              onChange={async (e) => {
                                const isPublishing = e.target.checked;
                                updateTour((t: any) => { t.published = isPublishing; });

                                // If publishing, sync to S3
                                if (isPublishing) {
                                  const result = await publishTourToS3(tour);
                                  if (!result.success) {
                                    alert(`Failed to publish tour to S3: ${result.error}`);
                                    // Revert the checkbox
                                    updateTour((t: any) => { t.published = false; });
                                  } else {
                                    alert('✅ Tour published successfully! It is now available to all users.');
                                  }
                                }
                              }}
                            />
                            {tour.published ? '📢 Tour Pubblicato' : '📝 Tour in Bozza'}
                          </label>
                          <div className="text-xs opacity-70">
                            {tour.published ? 'Visibile nel Player' : 'Solo in CMS'}
                          </div>
                        </div>
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
                          <div className="text-sm font-medium text-emerald-300">{tour.locales?.[0]?.title || tour.title}</div>
                          <div className="text-xs text-emerald-400">{tour.locale || tour.locales?.[0]?.code || 'it-IT'}</div>
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
                                <div className="text-xs text-neutral-400">{t.locale || t.locales?.[0]?.code}</div>
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

              {/* Subtitles Management Tab */}
              {tab === "subtitles" && (
                <div className="rounded-2xl border border-neutral-800/50 bg-neutral-900/30 backdrop-blur-sm p-6 shadow-xl">
                  <div className="text-sm text-neutral-400 mb-6 font-medium">🎬 Gestione Sottotitoli</div>
                  
                  {/* Subtitle List */}
                  <div className="space-y-4">
                    {/* API Status Info */}
                    {Object.values(tour.subtitles?.[tour.locale || 'it-IT'] || {}).some((sub: any) => sub.transcriptionSource && sub.transcriptionSource !== 'openai-whisper') && (
                      <div className="bg-orange-600/10 border border-orange-500/30 rounded-lg p-4 flex items-start gap-3">
                        <div className="text-orange-400 text-lg">⚡</div>
                        <div>
                          <div className="text-orange-300 font-medium text-sm">Modalità Simulazione Rilevata</div>
                          <div className="text-orange-200/80 text-xs mt-1">
                            Alcuni sottotitoli sono stati generati con simulazione intelligente. 
                            Per trascrizione AI professionale, aggiungi <code className="bg-orange-900/30 px-1 rounded">OPENAI_API_KEY</code> al file <code className="bg-orange-900/30 px-1 rounded">.env.local</code>.
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {/* Success message for AI transcription */}
                    {Object.values(tour.subtitles?.[tour.locale || 'it-IT'] || {}).some((sub: any) => sub.transcriptionSource === 'openai-whisper') && (
                      <div className="bg-green-600/10 border border-green-500/30 rounded-lg p-4 flex items-start gap-3">
                        <div className="text-green-400 text-lg">🤖</div>
                        <div>
                          <div className="text-green-300 font-medium text-sm">AI Professionale Attiva</div>
                          <div className="text-green-200/80 text-xs mt-1">
                            OpenAI Whisper è configurato e funzionante. I sottotitoli vengono generati con trascrizione AI professionale.
                          </div>
                        </div>
                      </div>
                    )}
                    
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-medium text-neutral-100">Sottotitoli Disponibili</h3>
                      <div className="flex items-center gap-2">
                        <label className="px-3 py-2 text-sm bg-emerald-600/50 hover:bg-emerald-600/70 text-white rounded-xl transition-all duration-200 cursor-pointer">
                          📁 Carica SRT
                          <input 
                            type="file" 
                            accept=".srt" 
                            className="hidden" 
                            onChange={(e) => onUploadSRT(e.target.files?.[0], e.target)} 
                          />
                        </label>
                        <label className="px-3 py-2 text-sm bg-purple-600/50 hover:bg-purple-600/70 text-white rounded-xl transition-all duration-200 cursor-pointer">
                          🎵 Nuovo da Audio
                          <input 
                            type="file" 
                            accept="audio/mpeg,audio/mp3,audio/wav,audio/m4a,audio/ogg" 
                            className="hidden" 
                            onChange={(e) => onCreateSRTFromAudio(e.target.files?.[0])} 
                          />
                        </label>
                        <button
                          onClick={() => {
                            const name = prompt('Nome del nuovo file sottotitoli:');
                            if (name) {
                              const srtId = Date.now().toString();
                              updateTour((t: any) => {
                                const currentLocale = t.locale || 'it-IT';
                                if (!t.subtitles) t.subtitles = {};
                                if (!t.subtitles[currentLocale]) t.subtitles[currentLocale] = {};
                                
                                t.subtitles[currentLocale][srtId] = {
                                  id: srtId,
                                  name: name,
                                  content: '1\n00:00:00,000 --> 00:00:03,000\nNuovo sottotitolo\n\n2\n00:00:03,500 --> 00:00:06,000\nModifica questo testo',
                                  language: currentLocale,
                                  createdAt: new Date().toISOString()
                                };
                              });
                              
                              // Ask if user wants to edit immediately
                              setTimeout(() => {
                                if (confirm('Vuoi modificare il contenuto ora?')) {
                                  editSubtitleContent(srtId, '1\n00:00:00,000 --> 00:00:03,000\nNuovo sottotitolo\n\n2\n00:00:03,500 --> 00:00:06,000\nModifica questo testo');
                                }
                              }, 100);
                            }
                          }}
                          className="px-3 py-2 text-sm bg-indigo-600/50 hover:bg-indigo-600/70 text-white rounded-xl transition-all duration-200"
                        >
                          ✏️ Nuovo Manuale
                        </button>
                      </div>
                    </div>
                    
                    {/* Subtitle Files */}
                    <div className="space-y-3">
                      {Object.entries(tour.subtitles?.[tour.locale || 'it-IT'] || {}).map(([id, subtitle]: [string, any]) => (
                        <div key={id} className="border border-neutral-700/50 rounded-xl p-5 bg-neutral-800/30 hover:bg-neutral-800/50 transition-all duration-200 shadow-lg">
                          <div className="flex flex-col gap-4">
                            {/* Header with title input */}
                            <div className="flex items-center justify-between">
                              <input
                                type="text"
                                value={subtitle.name}
                                onChange={(e) => updateTour((t: any) => {
                                  const currentLocale = t.locale || 'it-IT';
                                  t.subtitles[currentLocale][id].name = e.target.value;
                                })}
                                className="flex-1 bg-neutral-700/50 border border-neutral-600/50 rounded-lg px-3 py-2 text-sm text-neutral-100 font-medium focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                                placeholder="Nome sottotitoli..."
                              />
                            </div>
                            
                            {/* Metadata badges */}
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-xs text-neutral-400 bg-neutral-700/30 px-2 py-1 rounded-md flex items-center gap-1">
                                📅 {new Date(subtitle.createdAt).toLocaleDateString('it-IT', { 
                                  day: '2-digit', 
                                  month: '2-digit', 
                                  year: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </span>
                              
                              {subtitle.uploadedFile && (
                                <span className="text-xs bg-emerald-600/20 text-emerald-300 px-3 py-1 rounded-full border border-emerald-500/30 font-medium flex items-center gap-1">
                                  📁 File: {subtitle.uploadedFile}
                                </span>
                              )}
                              
                              {subtitle.generatedFromAudio && (
                                <span className="text-xs bg-purple-600/20 text-purple-300 px-3 py-1 rounded-full border border-purple-500/30 font-medium flex items-center gap-1">
                                  🎵 Audio: {subtitle.generatedFromAudio}
                                </span>
                              )}
                              
                              {subtitle.transcriptionSource && (
                                <span className={`text-xs px-3 py-1 rounded-full border font-medium flex items-center gap-1 ${
                                  subtitle.transcriptionSource === 'openai-whisper' 
                                    ? 'bg-green-600/20 text-green-300 border-green-500/40 shadow-green-500/10 shadow-md' 
                                    : 'bg-orange-600/20 text-orange-300 border-orange-500/40 shadow-orange-500/10 shadow-md'
                                }`}>
                                  {subtitle.transcriptionSource === 'openai-whisper' ? '🤖 AI Professionale' : '⚡ Simulazione Intelligente'}
                                </span>
                              )}
                              
                              {subtitle.audioDuration && (
                                <span className="text-xs bg-blue-600/20 text-blue-300 px-3 py-1 rounded-full border border-blue-500/30 font-medium flex items-center gap-1">
                                  🕒 {Math.round(subtitle.audioDuration)}s
                                </span>
                              )}
                              
                              {/* Add entries count */}
                              {subtitle.content && (
                                <span className="text-xs bg-indigo-600/20 text-indigo-300 px-3 py-1 rounded-full border border-indigo-500/30 font-medium flex items-center gap-1">
                                  📝 {subtitle.content.split('\n\n').filter(Boolean).length} segmenti
                                </span>
                              )}
                            </div>
                            
                            {/* SRT Preview */}
                            <div className="bg-neutral-900/50 p-3 rounded-lg border border-neutral-700/30">
                              <div className="text-xs text-neutral-400 mb-2 font-medium">📄 Anteprima SRT:</div>
                              <div className="text-xs text-neutral-300 font-mono max-h-32 overflow-y-auto whitespace-pre-wrap bg-neutral-800/30 p-2 rounded">
                                {subtitle.content.substring(0, 300)}{subtitle.content.length > 300 ? '...' : ''}
                              </div>
                            </div>
                            
                            {/* Usage info */}
                            <div className="text-xs text-neutral-500">
                              <div className="font-medium mb-2 text-neutral-400">🏷️ Utilizzato nelle regioni:</div>
                              <div className="flex flex-wrap gap-1">
                                {Object.entries(tour.tracks?.[tour.locale || 'it-IT'] || {})
                                  .filter(([, track]: [string, any]) => track.subtitleId === id)
                                  .map(([regionId]: [string, any]) => (
                                    <span key={regionId} className="inline-block bg-neutral-700/50 text-neutral-300 px-2 py-1 rounded-md text-xs">
                                      {regionId}
                                    </span>
                                  ))}
                                {Object.entries(tour.tracks?.[tour.locale || 'it-IT'] || {})
                                  .filter(([, track]: [string, any]) => track.subtitleId === id).length === 0 && (
                                  <span className="text-neutral-500 italic text-xs">Nessuna regione assegnata</span>
                                )}
                              </div>
                            </div>
                            
                            {/* Action buttons */}
                            <div className="flex items-center justify-between pt-3 border-t border-neutral-700/30">
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => downloadSRT(subtitle.name, subtitle.content)}
                                  className="px-3 py-2 text-xs bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 rounded-lg border border-blue-500/30 transition-all duration-200 font-medium flex items-center gap-1"
                                  title="Scarica file SRT"
                                >
                                  💾 Download
                                </button>
                                <button
                                  onClick={() => editSubtitleContent(id, subtitle.content)}
                                  className="px-3 py-2 text-xs bg-yellow-600/20 hover:bg-yellow-600/30 text-yellow-300 rounded-lg border border-yellow-500/30 transition-all duration-200 font-medium flex items-center gap-1"
                                >
                                  ✏️ Modifica
                                </button>
                              </div>
                              <button
                                onClick={() => {
                                  if (confirm('Eliminare questo file di sottotitoli?')) {
                                    updateTour((t: any) => {
                                      const currentLocale = t.locale || 'it-IT';
                                      delete t.subtitles[currentLocale][id];
                                      
                                      // Remove references in tracks
                                      Object.keys(t.tracks[currentLocale] || {}).forEach(regionId => {
                                        if (t.tracks[currentLocale][regionId]?.subtitleId === id) {
                                          delete t.tracks[currentLocale][regionId].subtitleId;
                                        }
                                      });
                                    });
                                  }
                                }}
                                className="px-3 py-2 text-xs bg-red-600/20 hover:bg-red-600/30 text-red-300 rounded-lg border border-red-500/30 transition-all duration-200 font-medium flex items-center gap-1"
                              >
                                🗑️ Elimina
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                      
                      {Object.keys(tour.subtitles?.[tour.locale || 'it-IT'] || {}).length === 0 && (
                        <div className="text-center py-8 text-neutral-500">
                          Nessun file di sottotitoli creato.
                          <br />
                          <strong>Opzioni disponibili:</strong>
                          <br />
                          📁 <strong>Carica SRT</strong> - Importa un file .srt esistente
                          <br />
                          🎵 <strong>Nuovo da Audio</strong> - Genera automaticamente da file audio (MP3, WAV, ecc.)
                          <br />
                          ✏️ <strong>Nuovo Manuale</strong> - Crea un file vuoto da modificare
                          <br />
                          🤖 <strong>Auto-genera</strong> - Usa il bottone nelle regioni con audio esistente
                        </div>
                      )}
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
                                value={tr.title ?? ""} 
                                onChange={(e) => updateTrackField(r.id, "title", e.target.value)} 
                              />
                              <textarea 
                                className="w-full rounded-xl bg-neutral-900/50 border border-neutral-600/50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all duration-200 resize-none" 
                                placeholder="Descrizione (opzionale)" 
                                rows={2}
                                value={tr.description ?? ""} 
                                onChange={(e) => updateTrackField(r.id, "description", e.target.value)} 
                              />
                              <textarea 
                                className="w-full rounded-xl bg-neutral-900/50 border border-neutral-600/50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all duration-200 resize-none" 
                                placeholder="Trascrizione (opzionale)" 
                                rows={3}
                                value={tr.transcript ?? ""} 
                                onChange={(e) => updateTrackField(r.id, "transcript", e.target.value)} 
                              />
                            </div>

                            {/* Audio Upload */}
                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <div className="text-xs text-neutral-400 font-medium">Audio Track</div>
                              </div>
                              <div className="flex items-center gap-2">
                                <input 
                                  className="flex-1 rounded-xl bg-neutral-900/50 border border-neutral-600/50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all duration-200" 
                                  placeholder="S3 key/OPFS path" 
                                  value={tr.audioKey ?? ""} 
                                  onChange={(e) => updateTrackField(r.id, "audioKey", e.target.value)} 
                                />
                                <label className={`text-xs rounded-xl px-3 py-2 transition-all duration-200 shadow-lg ${
                                  uploadingAudio === r.id
                                    ? 'bg-yellow-600/50 cursor-wait'
                                    : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 cursor-pointer hover:scale-105'
                                }`}>
                                  {uploadingAudio === r.id ? '⏳ Caricamento...' : '📤 Upload MP3'}
                                  <input
                                    type="file"
                                    accept="audio/mpeg,audio/mp3,audio/wav"
                                    className="hidden"
                                    onChange={(e) => onUploadMp3(r.id, e.target.files?.[0])}
                                    disabled={uploadingAudio === r.id}
                                  />
                                </label>
                              </div>
                              
                              {/* Audio Player */}
                              {(tr.audioUrl || tr.audioDataUrl) && (
                                <div className="mt-2 p-3 rounded-xl bg-gradient-to-r from-neutral-800/50 to-neutral-700/50 border border-neutral-600/50">
                                  <div className="flex items-center justify-between mb-2">
                                    <div className="text-xs text-neutral-300 font-medium">🎵 Audio Preview</div>
                                    <div className="flex items-center gap-2 text-xs">
                                      {tr.audioFilename && (
                                        <span className="text-neutral-400">📁 {tr.audioFilename}</span>
                                      )}
                                      {tr.audioUrl && (
                                        <span className="bg-green-600/20 text-green-300 px-2 py-1 rounded">☁️ S3</span>
                                      )}
                                      {tr.audioDataUrl && !tr.audioUrl && (
                                        <span className="bg-blue-600/20 text-blue-300 px-2 py-1 rounded">💾 Local</span>
                                      )}
                                    </div>
                                  </div>
                                  
                                  <div className="flex items-center gap-3">
                                    <button
                                      onClick={() => {
                                        const audioId = `audio-${r.id}`;
                                        const audio = document.getElementById(audioId) as HTMLAudioElement;
                                        if (audio) {
                                          if (playingAudio === audioId) {
                                            // Currently playing, pause it
                                            audio.pause();
                                            setPlayingAudio(null);
                                          } else {
                                            // Pause all other audio elements first
                                            document.querySelectorAll('audio').forEach(a => a.pause());
                                            setPlayingAudio(null);
                                            // Play this audio
                                            audio.play();
                                            setPlayingAudio(audioId);
                                          }
                                        }
                                      }}
                                      className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm transition-all duration-200 hover:scale-105 shadow-lg ${
                                        playingAudio === `audio-${r.id}` 
                                          ? 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500' 
                                          : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500'
                                      }`}
                                      title={playingAudio === `audio-${r.id}` ? "Pause" : "Play"}
                                    >
                                      {playingAudio === `audio-${r.id}` ? '⏸️' : '▶️'}
                                    </button>
                                    
                                    <button
                                      onClick={() => {
                                        const audioId = `audio-${r.id}`;
                                        const audio = document.getElementById(audioId) as HTMLAudioElement;
                                        if (audio) {
                                          audio.currentTime = 0;
                                          audio.pause();
                                          setPlayingAudio(null);
                                        }
                                      }}
                                      className="w-6 h-6 rounded bg-neutral-700 hover:bg-neutral-600 flex items-center justify-center text-neutral-300 hover:text-white text-xs transition-all duration-200"
                                      title="Stop"
                                    >
                                      ⏹️
                                    </button>
                                    
                                    <div className="flex-1 text-xs text-neutral-400">
                                      {playingAudio === `audio-${r.id}` ? (
                                        <span className="text-green-400">🔊 In riproduzione...</span>
                                      ) : (
                                        'Clicca ▶️ per ascoltare l\'audio caricato'
                                      )}
                                    </div>
                                  </div>
                                  
                                  {/* Hidden audio element */}
                                  <audio 
                                    id={`audio-${r.id}`}
                                    className="hidden"
                                    preload="metadata"
                                    onEnded={() => setPlayingAudio(null)}
                                    onPause={() => setPlayingAudio(null)}
                                  >
                                    <source src={tr.audioUrl || tr.audioDataUrl} type="audio/mpeg" />
                                  </audio>
                                </div>
                              )}
                            </div>

                            {/* Image Upload */}
                            <div className="space-y-2">
                              <div className="text-xs text-neutral-400 font-medium">Reference Image</div>
                              <div className="flex items-center gap-2">
                                <input 
                                  className="flex-1 rounded-xl bg-neutral-900/50 border border-neutral-600/50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all duration-200" 
                                  placeholder="Image URL or path" 
                                  value={tr.imageKey ?? ""} 
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

                            {/* Subtitles Management */}
                            <div className="space-y-3 border-t border-neutral-800/50 pt-3">
                              <div className="flex items-center justify-between">
                                <div className="text-xs text-neutral-400 font-medium">🎬 Sottotitoli</div>
                                {tr.audioDataUrl && (
                                  <button
                                    onClick={async () => {
                                      try {
                                        // Convert data URL to File for consistency
                                        const response = await fetch(tr.audioDataUrl);
                                        const blob = await response.blob();
                                        const audioFile = new File([blob], `region-${r.id}-audio.mp3`, { type: 'audio/mpeg' });
                                        
                                        const result = await generateSubtitlesFromAudio(audioFile, tour.locale || 'it-IT');
                                        const srtContent = generateSRT(result.entries);
                                        
                                        updateTour((t: any) => {
                                          const currentLocale = t.locale || 'it-IT';
                                          if (!t.subtitles) t.subtitles = {};
                                          if (!t.subtitles[currentLocale]) t.subtitles[currentLocale] = {};
                                          
                                          const srtId = Date.now().toString();
                                          t.subtitles[currentLocale][srtId] = {
                                            id: srtId,
                                            name: `Auto-generated for ${r.id}`,
                                            content: srtContent,
                                            language: currentLocale,
                                            createdAt: new Date().toISOString(),
                                            generatedFromAudio: `region-${r.id}-audio.mp3`,
                                            transcriptionSource: result.source
                                          };
                                          
                                          // Assign this subtitle to the region
                                          if (!t.tracks[currentLocale][r.id].subtitleId) {
                                            t.tracks[currentLocale][r.id].subtitleId = srtId;
                                          }
                                        });
                                        
                                        const methodText = result.source === 'openai-whisper' ? 'AI (OpenAI Whisper)' : 'Simulazione avanzata';
                                        alert(`✅ Sottotitoli generati! ${result.entries.length} entry create.\n💫 Metodo: ${methodText}`);
                                      } catch (error) {
                                        console.error('Error generating subtitles:', error);
                                        alert('Errore nella generazione dei sottotitoli');
                                      }
                                    }}
                                    className="px-2 py-1 text-xs bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 rounded border border-emerald-500/30 transition-all duration-200"
                                  >
                                    🤖 Auto-genera
                                  </button>
                                )}
                              </div>
                              
                              {/* Current subtitle selection */}
                              <div className="space-y-2">
                                <select
                                  value={tr.subtitleId ?? ''}
                                  onChange={(e) => updateTour((t: any) => {
                                    const currentLocale = t.locale || 'it-IT';
                                    if (!t.tracks[currentLocale]) t.tracks[currentLocale] = {};
                                    if (!t.tracks[currentLocale][r.id]) t.tracks[currentLocale][r.id] = {};
                                    t.tracks[currentLocale][r.id].subtitleId = e.target.value || null;
                                  })}
                                  className="w-full px-3 py-2 bg-neutral-900/50 border border-neutral-600/50 rounded-xl text-sm text-neutral-100 focus:ring-2 focus:ring-indigo-500/50 transition-all duration-200"
                                >
                                  <option value="">Nessun sottotitolo</option>
                                  {Object.entries(tour.subtitles?.[tour.locale || 'it-IT'] || {}).map(([id, subtitle]: [string, any]) => (
                                    <option key={id} value={id}>
                                      {subtitle.name}
                                    </option>
                                  ))}
                                </select>
                                
                                {tr.subtitleId && tour.subtitles?.[tour.locale || 'it-IT']?.[tr.subtitleId] && (
                                  <div className="text-xs text-neutral-500 bg-neutral-800/30 p-2 rounded border border-neutral-700/50">
                                    <div className="font-medium mb-1">Anteprima sottotitoli:</div>
                                    <div className="max-h-20 overflow-y-auto whitespace-pre-wrap">
                                      {tour.subtitles[tour.locale || 'it-IT'][tr.subtitleId].content.substring(0, 200)}...
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>

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

      {/* Subtitle Editor Modal - Large Size */}
      {isEditingSubtitle && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 sm:p-6">
          <div className="bg-gradient-to-br from-neutral-900 via-neutral-800 to-neutral-900 rounded-2xl border border-neutral-700/50 shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-neutral-700/50">
              <div>
                <h2 className="text-2xl font-bold text-white">✏️ Modifica Sottotitoli</h2>
                <p className="text-sm text-neutral-400 mt-1">Formato SRT - Modifica il contenuto dei sottotitoli</p>
              </div>
              <button
                onClick={closeSubtitleEditor}
                className="text-neutral-400 hover:text-white transition-colors duration-200 p-2 hover:bg-neutral-800/50 rounded-lg"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Body - Scrollable */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-4">
                {/* Info Box */}
                <div className="bg-blue-600/10 border border-blue-500/30 rounded-xl p-4">
                  <div className="text-sm text-blue-300">
                    <div className="font-medium mb-2">📝 Formato SRT</div>
                    <div className="text-xs text-blue-400 space-y-1">
                      <div>1. Numero sequenziale</div>
                      <div>2. Timecode: 00:00:00,000 --&gt; 00:00:03,000</div>
                      <div>3. Testo del sottotitolo</div>
                      <div>4. Riga vuota tra i blocchi</div>
                    </div>
                  </div>
                </div>

                {/* Text Editor */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-neutral-300">
                    Contenuto Sottotitoli
                  </label>
                  <textarea
                    value={editingSubtitleContent}
                    onChange={(e) => setEditingSubtitleContent(e.target.value)}
                    className="w-full h-[500px] bg-neutral-900/50 border border-neutral-600/50 rounded-xl p-4 text-neutral-100 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all duration-200 resize-none"
                    placeholder="1
00:00:00,000 --> 00:00:03,000
Primo sottotitolo

2
00:00:03,500 --> 00:00:06,000
Secondo sottotitolo"
                    spellCheck={false}
                  />
                  <div className="flex items-center justify-between text-xs text-neutral-500">
                    <div>Caratteri: {editingSubtitleContent.length}</div>
                    <div>Linee: {editingSubtitleContent.split('\n').length}</div>
                  </div>
                </div>

                {/* Preview */}
                {editingSubtitleContent && (
                  <div className="bg-neutral-800/30 border border-neutral-700/50 rounded-xl p-4">
                    <div className="text-sm font-medium text-neutral-300 mb-3">👁️ Anteprima</div>
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {(() => {
                        try {
                          const entries = parseSRT(editingSubtitleContent);
                          return entries.slice(0, 5).map((entry, idx) => (
                            <div key={idx} className="text-xs bg-neutral-900/50 p-2 rounded border border-neutral-700/30">
                              <div className="text-indigo-400 mb-1">
                                #{entry.id} • {entry.startTime} → {entry.endTime}
                              </div>
                              <div className="text-neutral-300">{entry.text}</div>
                            </div>
                          ));
                        } catch {
                          return <div className="text-xs text-red-400">❌ Formato non valido</div>;
                        }
                      })()}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 p-6 border-t border-neutral-700/50">
              <button
                onClick={closeSubtitleEditor}
                className="px-6 py-2.5 bg-neutral-700/50 hover:bg-neutral-700 text-neutral-200 rounded-xl transition-all duration-200 font-medium"
              >
                Annulla
              </button>
              <button
                onClick={saveSubtitleContent}
                className="px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-xl transition-all duration-200 font-medium shadow-lg hover:shadow-indigo-500/50"
              >
                💾 Salva Sottotitoli
              </button>
            </div>
          </div>
        </div>
      )}
    </ErrorBoundary>
  );
}
