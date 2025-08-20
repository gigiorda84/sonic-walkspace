'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';

const IS_CLIENT = typeof window !== 'undefined';

const hasOPFS = IS_CLIENT && (navigator as any)?.storage?.getDirectory;

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

// Map component for the player
function PlayerMap({ tour, userPos, activeRegionId, jumpToRegion, setUserPos }: {
  tour: any;
  userPos: { lat: number; lng: number } | null;
  activeRegionId: string | null;
  jumpToRegion: (id: string) => void;
  setUserPos: (pos: { lat: number; lng: number }) => void;
}) {
  const [isMapReady, setIsMapReady] = useState(false);
  const [MapContainer, setMapContainer] = useState<any>(null);
  const [TileLayer, setTileLayer] = useState<any>(null);
  const [Circle, setCircle] = useState<any>(null);
  const [Polyline, setPolyline] = useState<any>(null);
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
    const id = "leaflet-css-cdn";
    if (!document.getElementById(id)) {
      const link = document.createElement("link");
      link.id = id;
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      link.integrity = "sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=";
      link.crossOrigin = "";
      document.head.appendChild(link);
    }

    // Load all components dynamically
    Promise.all([
      import("leaflet"),
      import("react-leaflet").then(mod => mod.MapContainer),
      import("react-leaflet").then(mod => mod.TileLayer),
      import("react-leaflet").then(mod => mod.Circle),
      import("react-leaflet").then(mod => mod.Polyline),
      import("react-leaflet").then(mod => mod.useMapEvents)
    ]).then(([leaflet, MapContainerComp, TileLayerComp, CircleComp, PolylineComp, useMapEventsHook]) => {
      const L = leaflet.default;
      const iconUrl = "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png";
      const iconRetinaUrl = "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png";
      const shadowUrl = "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png";
      // @ts-ignore
      delete L.Icon.Default.prototype._getIconUrl;
      L.Icon.Default.mergeOptions({ iconUrl, iconRetinaUrl, shadowUrl });
      
      setMapContainer(() => MapContainerComp);
      setTileLayer(() => TileLayerComp);
      setCircle(() => CircleComp);
      setPolyline(() => PolylineComp);
      setUseMapEvents(() => useMapEventsHook);
      setIsMapReady(true);
    });
  }, []);

  if (!isMapReady || !MapContainer) {
    return (
      <div className="h-[520px] w-full flex items-center justify-center bg-gradient-to-br from-neutral-900 to-neutral-800 rounded-2xl border border-neutral-800">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 animate-spin" />
          <div className="text-sm text-neutral-400">Loading interactive map...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-neutral-800/50 overflow-hidden shadow-2xl relative">
      <LayerSwitcher
        currentLayer={currentLayer}
        onLayerChange={(layer) => {
          console.log('Player: Switching to layer:', layer);
          setCurrentLayer(layer);
        }}
        layers={mapLayers}
      />
      <MapContainer 
        center={[(tour.regions[0]?.center.lat || 45.07), (tour.regions[0]?.center.lng || 7.68)]} 
        zoom={14} 
        style={{ height: 520, width: '100%' }} 
        scrollWheelZoom
        className="rounded-2xl"
      >
        <TileLayer 
          attribution={mapLayers[currentLayer].attribution}
          url={mapLayers[currentLayer].url}
          key={currentLayer} // Force re-render when layer changes
        />
        <Polyline positions={(tour.regions || []).map((r: any) => [r.center.lat, r.center.lng])} pathOptions={{ color: '#8b5cf6', weight: 3, opacity: 0.8 }} />
        {(tour.regions || []).map((r: any) => (
          <Circle 
            key={r.id} 
            center={[r.center.lat, r.center.lng]} 
            radius={r.radiusM} 
            pathOptions={{ 
              color: r.id === activeRegionId ? '#10b981' : '#8b5cf6', 
              fillColor: r.id === activeRegionId ? '#10b981' : '#8b5cf6', 
              fillOpacity: r.id === activeRegionId ? 0.2 : 0.1, 
              weight: r.id === activeRegionId ? 3 : 2 
            }} 
            eventHandlers={{ click: () => jumpToRegion(r.id) }} 
          />
        ))}
        {userPos && (
          <Circle 
            center={[userPos.lat, userPos.lng]} 
            radius={8} 
            pathOptions={{ color: '#f59e0b', fillColor: '#f59e0b', fillOpacity: 0.8, weight: 2 }} 
          />
        )}
        {useMapEvents && <ClickToSimulate on={(ll) => setUserPos(ll)} useMapEvents={useMapEvents} />}
      </MapContainer>
    </div>
  );
}

// Click handler component
function ClickToSimulate({ on, useMapEvents }: { on: (p: { lat: number; lng: number }) => void, useMapEvents: any }) {
  const map = useMapEvents({
    click(e: any) {
      on({ lat: e.latlng.lat, lng: e.latlng.lng });
    }
  });

  return null; // useMapEvents doesn't return a component, it returns the map instance
}

const DEMO_TOUR = { 
  slug:'bandite-demo', 
  title:'Sonic Walkscape — Player', 
  locales:['it-IT','fr-FR'], 
  defaultLocale:'it-IT', 
  regions:[ 
    { id:'reg-1', name:{'it-IT':'Porta Palazzo','fr-FR':'Porta Palazzo'}, center:{ lat:45.0749,lng:7.6774 }, radiusM:120, sort:1, track:{'it-IT':{ kind:'tone', frequency:440 }, 'fr-FR':{ kind:'tone', frequency:442}} }, 
    { id:'reg-2', name:{'it-IT':'Piazza Castello','fr-FR':'Piazza Castello'}, center:{ lat:45.0705,lng:7.6868 }, radiusM:120, sort:2, track:{'it-IT':{ kind:'tone', frequency:494 }, 'fr-FR':{ kind:'tone', frequency:496}} }, 
    { id:'reg-3', name:{'it-IT':'Parco del Valentino','fr-FR':'Parc du Valentino'}, center:{ lat:45.0567,lng:7.6861 }, radiusM:140, sort:3, track:{'it-IT':{ kind:'tone', frequency:523 }, 'fr-FR':{ kind:'tone', frequency:525}} } 
  ] 
};

function getPreviewTour() {
  try { const raw = localStorage.getItem('WS_PREVIEW_MANIFEST'); if (!raw) return null; return JSON.parse(raw); } catch { return null; }
}

function getCMSTours() {
  try { 
    const raw = localStorage.getItem('WS_CMS_TOURS'); 
    if (!raw) return null; 
    const parsed = JSON.parse(raw);
    
    // Validate that we have a valid array of tours
    if (!Array.isArray(parsed)) {
      console.warn('WS_CMS_TOURS is not an array:', parsed);
      return null;
    }
    
    // Filter valid tours (show all during development, only published in production)
    const validTours = parsed.filter(tour => 
      tour && 
      typeof tour === 'object' && 
      tour.slug && 
      tour.title && 
      Array.isArray(tour.regions)
    );
    
    // In development, show all tours. In production, show only published tours
    const publishedTours = process.env.NODE_ENV === 'production' 
      ? validTours.filter(tour => tour.published === true)
      : validTours;
    
    // Debug: log audio data in tracks
    publishedTours.forEach(tour => {
      console.log(`Tour ${tour.title} (${tour.id}):`, {
        locale: tour.locale,
        regions: tour.regions?.length,
        tracks: tour.tracks ? Object.keys(tour.tracks) : [],
        audioRegions: tour.tracks?.[tour.locale] ? 
          Object.keys(tour.tracks[tour.locale]).filter(regionId => 
            tour.tracks[tour.locale][regionId]?.audioDataUrl
          ) : []
      });
    });
    
    return publishedTours.length > 0 ? publishedTours : null;
  } catch (error) { 
    console.error('Error reading CMS tours from localStorage:', error);
    return null; 
  }
}

function saveCMSTours(tours: any[]) {
  try {
    localStorage.setItem('WS_CMS_TOURS', JSON.stringify(tours));
  } catch (err) {
    console.error('Failed to save tours to localStorage:', err);
  }
}

export default function SonicWalkscapeWebPlayer(){
  const preview = IS_CLIENT ? getPreviewTour() : null;
  const cmsTours = IS_CLIENT ? getCMSTours() : null;
  
  // Audio context and state
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);
  const [currentAudio, setCurrentAudio] = useState<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  
  // Convert CMS tour format to player format
  const convertCMSTourToPlayer = (cmsTour: any) => {
    // Validate tour structure
    if (!cmsTour || typeof cmsTour !== 'object') {
      console.warn('Invalid CMS tour structure:', cmsTour);
      return null;
    }
    
    if (!cmsTour.slug || !cmsTour.title || !Array.isArray(cmsTour.regions)) {
      console.warn('CMS tour missing required properties:', cmsTour);
      return null;
    }

    try {
      // Get the language for this tour
      const tourLocale = cmsTour.locale || cmsTour.locales?.[0]?.code || 'it-IT';
      
      return {
        id: cmsTour.id,
        slug: cmsTour.slug,
        title: cmsTour.title,
        description: cmsTour.description || '',
        tourImageDataUrl: cmsTour.tourImageDataUrl || '',
        locale: tourLocale,
        parentTourId: cmsTour.parentTourId,
        regions: cmsTour.regions.map((r: any) => {
          const cmsTrack = cmsTour.tracks?.[tourLocale]?.[r.id] || {};
          
          // Debug: log track conversion for all regions
          if (cmsTrack.title || cmsTrack.description || cmsTrack.transcript || cmsTrack.audioDataUrl || cmsTrack.imageDataUrl) {
            console.log(`Converting region ${r.id}:`, {
              regionId: r.id,
              hasTitle: !!cmsTrack.title,
              hasDescription: !!cmsTrack.description,
              hasTranscript: !!cmsTrack.transcript,
              hasImageDataUrl: !!cmsTrack.imageDataUrl,
              hasAudioDataUrl: !!cmsTrack.audioDataUrl,
              title: cmsTrack.title,
              description: cmsTrack.description?.substring(0, 50) + '...',
              transcript: cmsTrack.transcript?.substring(0, 50) + '...'
            });
          }
          
          return {
            id: r.id || `region-${Math.random()}`,
            name: cmsTrack.title || `Punto ${r.sort || 1}`,
            description: cmsTrack.description || '',
            transcript: cmsTrack.transcript || '',
            imageDataUrl: cmsTrack.imageDataUrl || '',
            center: { lat: r.lat || 45.07, lng: r.lng || 7.68 },
            radiusM: r.radiusM || 120,
            sort: r.sort || 1,
            track: {
              ...cmsTrack,
              kind: cmsTrack.audioDataUrl ? 'audio' : 'tone',
              frequency: cmsTrack.frequency || 440
            }
          };
        })
      } as any;
    } catch (error) {
      console.error('Error converting CMS tour to player format:', error, cmsTour);
      return null;
    }
  };

  // Available tours with CMS tours and preview
  const availableTours = useMemo(() => {
    const tours = [];
    
    if (cmsTours && cmsTours.length > 0) {
      // Show each CMS tour individually
      cmsTours.forEach((cmsTour: any) => {
        const convertedTour = convertCMSTourToPlayer(cmsTour);
        if (convertedTour) {
          tours.push(convertedTour);
        }
      });
    }
    
    if (preview) {
      tours.push(preview);
    }
    
    if (tours.length === 0) {
      tours.push(DEMO_TOUR);
    }
    
    return tours;
  }, [cmsTours, preview]);

  // State management
  const [selectedTourIndex, setSelectedTourIndex] = useState(0);
  const [usingGPS, setUsingGPS] = useState(false);
  const [userPos, setUserPos] = useState<{lat:number,lng:number}|null>(null);
  const [activeRegionId, setActiveRegionId] = useState<string|null>(null);

  const TOUR = availableTours[selectedTourIndex] || DEMO_TOUR;
  const locale = TOUR.locale || TOUR.defaultLocale || 'it-IT';

  const center = useMemo(()=> userPos ?? (TOUR.regions[0]?.center || {lat:45.07,lng:7.68}), [userPos, TOUR]);

  useEffect(()=>{ 
    if(!usingGPS) return; 
    const id = navigator.geolocation.watchPosition( 
      (pos)=> {
        const newPos = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserPos(newPos);
        
        // Check if user entered a region
        const enteredRegion = (TOUR.regions || []).find((r: any) => {
          const distance = Math.sqrt(
            Math.pow(newPos.lat - r.center.lat, 2) + 
            Math.pow(newPos.lng - r.center.lng, 2)
          ) * 111000; // Convert to meters (roughly)
          return distance <= r.radiusM;
        });
        
        if (enteredRegion && enteredRegion.id !== activeRegionId) {
          // Stop current audio if playing
          stopAudio();
          
          setActiveRegionId(enteredRegion.id);
          
          // Play audio for the region
          const track = enteredRegion.track;
          if (track) {
            if (track.audioDataUrl) {
              playAudio(track.audioDataUrl);
            } else if (track.frequency) {
              playTone(track.frequency);
            }
          }
        }
      }, 
      ()=>{}, 
      { enableHighAccuracy:true, timeout:10000, maximumAge:1000 } 
    ); 
    return ()=> navigator.geolocation.clearWatch(id); 
  }, [usingGPS, TOUR, locale, activeRegionId, cmsTours]);

  // Initialize audio context after user interaction
  const initAudioContext = () => {
    if (IS_CLIENT && !audioContext) {
      try {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        setAudioContext(ctx);
        console.log('AudioContext initialized successfully');
        return ctx;
      } catch (error) {
        console.error('Failed to initialize AudioContext:', error);
        return null;
      }
    }
    return audioContext;
  };

  // Function to play tone
  const playTone = (frequency: number, duration: number = 2000) => {
    const ctx = initAudioContext();
    if (!ctx) {
      console.log('AudioContext not available for tone playback');
      return;
    }
    
    // Resume context if suspended
    if (ctx.state === 'suspended') {
      ctx.resume();
    }
    
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    oscillator.frequency.setValueAtTime(frequency, ctx.currentTime);
    oscillator.type = 'sine';
    
    gainNode.gain.setValueAtTime(0, ctx.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.1, ctx.currentTime + 0.1);
    gainNode.gain.linearRampToValueAtTime(0, ctx.currentTime + duration / 1000);
    
    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + duration / 1000);
  };

  // Function to play audio file
  const playAudio = (audioDataUrl: string) => {
    console.log('playAudio called with:', audioDataUrl ? audioDataUrl.substring(0, 50) + '...' : 'null');
    
    if (!audioDataUrl) {
      console.log('No audioDataUrl provided');
      return;
    }
    
    // Initialize AudioContext to ensure browser permissions
    initAudioContext();
    
    // Stop current audio if playing
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
    }
    
    const audio = new Audio(audioDataUrl);
    audio.volume = 0.7;
    
    audio.onloadstart = () => {
      console.log('Audio loading started');
    };
    audio.oncanplay = () => {
      console.log('Audio can start playing');
    };
    audio.onplay = () => {
      console.log('Audio started playing');
      setIsPlaying(true);
    };
    audio.onpause = () => {
      console.log('Audio paused');
      setIsPlaying(false);
    };
    audio.onended = () => {
      console.log('Audio ended');
      setIsPlaying(false);
    };
    audio.onerror = (e) => {
      console.error('Audio playback error:', e);
      console.error('Audio error details:', audio.error);
      setIsPlaying(false);
    };
    
    setCurrentAudio(audio);
    console.log('Attempting to play audio...');
    
    // Try to play with better error handling
    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          console.log('Audio play promise resolved');
        })
        .catch(err => {
          console.error('Failed to play audio:', err);
          setIsPlaying(false);
          
          // If autoplay is blocked, suggest user interaction
          if (err.name === 'NotAllowedError') {
            console.log('Autoplay blocked - user interaction required');
          }
        });
    }
  };

  // Function to stop current audio
  const stopAudio = () => {
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
      setCurrentAudio(null);
      setIsPlaying(false);
    }
  };

  const jumpToRegion = (id:string)=> { 
    const r = (TOUR.regions||[]).find((x:any)=> x.id===id); 
    if(r){ 
      // Stop current audio if playing
      stopAudio();
      
      setUserPos(r.center); 
      setUsingGPS(false); 
      setActiveRegionId(r.id);
      
      // Play audio for the region
      const track = r.track;
      console.log('Region track data:', {
        regionId: r.id,
        hasTrack: !!track,
        hasAudioDataUrl: !!track?.audioDataUrl,
        hasFrequency: !!track?.frequency,
        audioDataUrlLength: track?.audioDataUrl?.length
      });
      
      if (track) {
        if (track.audioDataUrl) {
          console.log('Playing audio for region:', r.id);
          playAudio(track.audioDataUrl);
        } else if (track.frequency) {
          console.log('Playing tone for region:', r.id);
          playTone(track.frequency);
        } else {
          console.log('No audio found for region:', r.id);
        }
      }
    }
  };
  
  // Helper function to find the correct CMS tour
  const findCMSTour = () => {
    if (!cmsTours) return null;
    
    // Find by slug or ID
    let cmsTour = cmsTours.find(t => t.slug === TOUR.slug || t.id === TOUR.id);
    
    return cmsTour;
  };

  // Helper function to get region name safely
  const getRegionName = (region: any, currentLocale: string) => {
    if (typeof region.name === 'string') {
      return region.name;
    } else if (typeof region.name === 'object' && region.name !== null) {
      // Handle multilingual name object
      return region.name[currentLocale] || region.name['it-IT'] || region.name[Object.keys(region.name)[0]] || `Punto ${region.sort || 1}`;
    }
    return `Punto ${region.sort || 1}`;
  };

  // Helper function to get audio duration
  const getAudioDuration = (region: any) => {
    // Check if there's audio data URL
    if (region.track?.audioDataUrl) {
      return '🎵 Audio disponibile';
    }
    
    // Check if there's a tone frequency
    if (region.track?.frequency) {
      return '🔊 Tono audio';
    }
    
    return '🔇 Nessun audio';
  };

  const nowPlaying = (TOUR.regions||[]).find((r:any)=> r.id===activeRegionId);

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950 text-neutral-100">
      {/* Header */}
      <div className="mx-auto max-w-7xl px-6 py-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg" />
          <div>
            <div className="text-xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">{TOUR.title}</div>
            <div className="text-sm text-neutral-400">GPS‑triggered audio walk {preview ? '· Preview CMS' : ''}</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button 
            className="rounded-xl bg-neutral-800/50 hover:bg-neutral-700/50 px-4 py-2 text-sm transition-all duration-200 hover:scale-105" 
            onClick={()=>{ try{ window.open('/cms','_self'); }catch{ window.location.hash='#cms'; } }}
          >
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-400"></span>
              Apri CMS
            </span>
          </button>
          <button 
            className="rounded-xl bg-green-800/50 hover:bg-green-700/50 px-4 py-2 text-sm transition-all duration-200 hover:scale-105" 
            onClick={() => {
              const ctx = initAudioContext();
              if (ctx && ctx.state === 'suspended') {
                ctx.resume().then(() => {
                  console.log('AudioContext resumed');
                });
              }
              console.log('AudioContext status:', ctx?.state);
            }}
          >
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-400"></span>
              Init Audio
            </span>
          </button>
          <button 
            className="rounded-xl bg-red-800/50 hover:bg-red-700/50 px-4 py-2 text-sm transition-all duration-200 hover:scale-105" 
            onClick={() => {
              console.log('=== DEBUG AUDIO DATA ===');
              console.log('AudioContext state:', audioContext?.state);
              console.log('Current tour:', TOUR);
              console.log('CMS tours:', cmsTours);
              console.log('Current region:', nowPlaying);
              if (nowPlaying?.track) {
                console.log('Current region track:', nowPlaying.track);
              }
              console.log('=== END DEBUG ===');
            }}
          >
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-400"></span>
              Debug Audio
            </span>
          </button>
          <select 
            className="rounded-xl bg-neutral-800/50 border border-neutral-700/50 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all duration-200" 
            value={selectedTourIndex}
            onChange={(e)=> setSelectedTourIndex(parseInt(e.target.value))}
          >
            {availableTours.map((tour, index) => (
              <option key={index} value={index}>
                {tour.title} {tour.locale ? `(${tour.locale.split('-')[0].toUpperCase()})` : ''} {!tour.published ? '[Bozza]' : ''}
              </option>
            ))}
          </select>
          <button 
            className={`rounded-xl px-4 py-2 text-sm font-medium transition-all duration-200 hover:scale-105 shadow-lg ${
              usingGPS 
                ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500' 
                : 'bg-neutral-800/50 hover:bg-neutral-700/50'
            }`} 
            onClick={()=> setUsingGPS((v)=> !v)}
          >
            <span className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${usingGPS ? 'bg-emerald-400 animate-pulse' : 'bg-neutral-400'}`}></span>
              {usingGPS ? 'GPS Attivo' : 'GPS Off'}
            </span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 px-6 pb-8 md:grid-cols-12">
        {/* Left Column: Map and Tour Info */}
        <div className="md:col-span-6 flex flex-col gap-6">
          {/* Map */}
          <PlayerMap 
            tour={TOUR}
            userPos={userPos}
            activeRegionId={activeRegionId}
            jumpToRegion={jumpToRegion}
            setUserPos={setUserPos}
          />

          {/* Tour Info */}
          <div className="rounded-2xl border border-neutral-800/50 bg-neutral-900/30 backdrop-blur-sm p-6 shadow-xl">
            <div className="text-sm text-neutral-400 mb-4 font-medium">Informazioni Tour</div>
            <div className="space-y-4">
              {/* Tour Header */}
              <div className="bg-gradient-to-r from-indigo-600/20 to-purple-600/20 border border-indigo-500/30 rounded-xl p-4">
                <div className="text-xl font-bold text-indigo-200 mb-1">{TOUR.title}</div>
                <div className="text-xs text-indigo-400">Tour #{TOUR.slug}</div>
              </div>

              {/* Tour Image */}
              {TOUR.tourImageDataUrl && (
                <div className="bg-gradient-to-r from-blue-600/10 to-cyan-600/10 border border-blue-500/30 rounded-xl p-4">
                  <div className="text-xs text-blue-400 mb-3 font-bold uppercase tracking-wide">🖼️ Foto Tour</div>
                  <div className="relative">
                    <img 
                      src={TOUR.tourImageDataUrl} 
                      alt="Tour" 
                      className="w-full h-48 object-cover rounded-lg border border-blue-500/30 shadow-lg" 
                    />
                    <div className="absolute top-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded-full">
                      🏛️
                    </div>
                  </div>
                </div>
              )}

              {/* Tour Description */}
              {TOUR.description && (
                <div className="bg-gradient-to-r from-emerald-600/10 to-teal-600/10 border border-emerald-500/30 rounded-xl p-4">
                  <div className="text-xs text-emerald-400 mb-2 font-bold uppercase tracking-wide">📖 Descrizione Tour</div>
                  <div className="text-sm text-neutral-100 leading-relaxed">
                    {TOUR.description}
                  </div>
                </div>
              )}

              {/* Tour Stats */}
              <div className="bg-gradient-to-r from-purple-600/10 to-pink-600/10 border border-purple-500/30 rounded-xl p-4">
                <div className="text-xs text-purple-400 mb-2 font-bold uppercase tracking-wide">📊 Statistiche</div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="text-neutral-400">Regioni</div>
                    <div className="text-neutral-200 font-bold">{(TOUR.regions || []).length}</div>
                  </div>
                  <div>
                    <div className="text-neutral-400">Lingue</div>
                    <div className="text-neutral-200 font-bold">
                      {TOUR.availableLanguages ? TOUR.availableLanguages.length : 1}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Player Controls and Regions */}
        <div className="md:col-span-6 flex flex-col gap-6">

          {/* Now Playing */}
          <div className="rounded-2xl border border-neutral-800/50 bg-neutral-900/30 backdrop-blur-sm p-6 shadow-xl">
            <div className="text-sm text-neutral-400 mb-4 font-medium">In riproduzione</div>
            {nowPlaying ? (
              <div className="space-y-4">
                {/* Header with enhanced styling */}
                <div className="bg-gradient-to-r from-indigo-600/20 to-purple-600/20 border border-indigo-500/30 rounded-xl p-4">
                  <div className="text-xl font-bold text-indigo-200 mb-1">{getRegionName(nowPlaying, locale)}</div>
                  <div className="text-xs text-indigo-400">Regione #{nowPlaying.sort} • Raggio {nowPlaying.radiusM}m</div>
                </div>
                
                {/* Description with enhanced styling */}
                {nowPlaying.description && (
                  <div className="bg-gradient-to-r from-emerald-600/10 to-teal-600/10 border border-emerald-500/30 rounded-xl p-4">
                    <div className="text-xs text-emerald-400 mb-2 font-bold uppercase tracking-wide">📝 Descrizione</div>
                    <div className="text-sm text-neutral-100 leading-relaxed">
                      {nowPlaying.description}
                    </div>
                  </div>
                )}

                {/* Reference Image with enhanced styling */}
                {nowPlaying.imageDataUrl && (
                  <div className="bg-gradient-to-r from-blue-600/10 to-cyan-600/10 border border-blue-500/30 rounded-xl p-4">
                    <div className="text-xs text-blue-400 mb-3 font-bold uppercase tracking-wide">🖼️ Immagine di Riferimento</div>
                    <div className="relative">
                      <img 
                        src={nowPlaying.imageDataUrl} 
                        alt="Reference" 
                        className="w-full h-64 object-contain rounded-lg border border-blue-500/30 shadow-lg bg-neutral-900/50" 
                      />
                      <div className="absolute top-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded-full">
                        📷
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Transcript with enhanced styling */}
                {nowPlaying.transcript && (
                  <div className="bg-gradient-to-r from-purple-600/10 to-pink-600/10 border border-purple-500/30 rounded-xl p-4">
                    <div className="text-xs text-purple-400 mb-2 font-bold uppercase tracking-wide">📄 Trascrizione</div>
                    <div className="text-sm text-neutral-100 leading-relaxed">
                      {nowPlaying.transcript}
                    </div>
                  </div>
                )}
                
                {/* Status badges with enhanced styling */}
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full bg-emerald-600/30 border border-emerald-500/50 px-3 py-1 text-xs text-emerald-200 font-bold shadow-lg">🎵 Auto‑play</span>
                  <span className="rounded-full bg-blue-600/30 border border-blue-500/50 px-3 py-1 text-xs text-blue-200 font-bold shadow-lg">📍 Geofence</span>
                  {isPlaying && (
                    <span className="rounded-full bg-purple-600/30 border border-purple-500/50 px-3 py-1 text-xs text-purple-200 font-bold shadow-lg animate-pulse">
                      🔊 Playing Now
                    </span>
                  )}
                </div>
                
                {/* Stop button with enhanced styling */}
                {isPlaying && (
                  <button 
                    onClick={stopAudio}
                    className="w-full rounded-xl bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-500 hover:to-pink-500 border border-red-500/50 px-4 py-3 text-sm text-white font-bold transition-all duration-200 hover:scale-105 shadow-lg"
                  >
                    ⏹️ Stop Audio
                  </button>
                )}
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="text-4xl mb-2">🎵</div>
                <div className="text-neutral-400 text-sm">Nessun brano in riproduzione</div>
                <div className="text-neutral-500 text-xs mt-1">Seleziona una regione per iniziare</div>
              </div>
            )}
          </div>

          {/* Regions List */}
          <div className="rounded-2xl border border-neutral-800/50 bg-neutral-900/30 backdrop-blur-sm p-6 shadow-xl">
            <div className="text-sm text-neutral-400 mb-4 font-medium">Regioni del tour</div>
            <div className="flex flex-col gap-3">
              {(TOUR.regions||[]).map((r: any) => (
                <button 
                  key={r.id} 
                  className={`flex w-full items-start justify-between rounded-xl p-4 text-left transition-all duration-300 hover:scale-105 ${
                    activeRegionId === r.id 
                      ? 'bg-gradient-to-r from-indigo-600/30 to-purple-600/30 border-2 border-indigo-400/50 shadow-2xl scale-105' 
                      : 'bg-neutral-800/30 hover:bg-neutral-700/30 border border-neutral-700/50 hover:border-neutral-600/50'
                  }`} 
                  onClick={() => jumpToRegion(r.id)}
                >
                  <div className="flex-1">
                    <div className={`text-sm font-bold ${activeRegionId === r.id ? 'text-indigo-200' : 'text-neutral-100'}`}>
                      {getRegionName(r, locale)}
                    </div>
                    <div className={`text-xs mt-1 ${activeRegionId === r.id ? 'text-indigo-400' : 'text-neutral-400'}`}>
                      {getAudioDuration(r)}
                    </div>
                    {r.description && (
                      <div className={`text-xs mt-1 line-clamp-1 ${activeRegionId === r.id ? 'text-indigo-300' : 'text-neutral-500'}`}>
                        {r.description}
                      </div>
                    )}
                    {r.transcript && (
                      <div className={`text-xs mt-1 line-clamp-2 ${activeRegionId === r.id ? 'text-indigo-300' : 'text-neutral-500'}`}>
                        {r.transcript}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2 ml-2">
                    {r.imageDataUrl && (
                      <div className={`relative ${activeRegionId === r.id ? 'ring-2 ring-indigo-400/50' : ''}`}>
                        <img 
                          src={r.imageDataUrl} 
                          alt="Preview" 
                          className="w-12 h-12 object-cover rounded-lg border border-neutral-600/50" 
                        />
                        {activeRegionId === r.id && (
                          <div className="absolute -top-1 -right-1 bg-indigo-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">
                            ▶
                          </div>
                        )}
                      </div>
                    )}
                    <div className={`text-xs ${activeRegionId === r.id ? 'text-indigo-300 font-bold' : 'text-neutral-300'}`}>
                      {activeRegionId === r.id ? '🎵 In riproduzione' : 'Tap per simulare'}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
