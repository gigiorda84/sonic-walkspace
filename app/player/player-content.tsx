'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const IS_CLIENT = typeof window !== 'undefined';
const hasOPFS = IS_CLIENT && (navigator as any)?.storage?.getDirectory;

// Subtitle Functions
interface SubtitleEntry {
  id: number;
  startTime: string;
  endTime: string;
  text: string;
  startSeconds: number;
  endSeconds: number;
}

function parseSRT(srtContent: string): SubtitleEntry[] {
  if (!srtContent) return [];
  
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
        entries.push({
          id,
          startTime: startTime.trim(),
          endTime: endTime.trim(),
          text,
          startSeconds: timeToSeconds(startTime.trim()),
          endSeconds: timeToSeconds(endTime.trim())
        });
      }
    }
  });
  
  return entries;
}

function timeToSeconds(timeStr: string): number {
  const [time, ms] = timeStr.split(',');
  const [hours, minutes, seconds] = time.split(':').map(Number);
  return hours * 3600 + minutes * 60 + seconds + (ms ? parseInt(ms) / 1000 : 0);
}

function getCurrentSubtitle(subtitles: SubtitleEntry[], currentTime: number): SubtitleEntry | null {
  const currentSub = subtitles.find(sub => {
    return currentTime >= sub.startSeconds && currentTime <= sub.endSeconds;
  });
  
  return currentSub || null;
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

// Map component for the player
function PlayerMap({ tour, userPos, activeRegionId, jumpToRegion, setUserPos, openModal }: {
  tour: any;
  userPos: { lat: number; lng: number } | null;
  activeRegionId: string | null;
  jumpToRegion: (id: string) => void;
  setUserPos: (pos: { lat: number; lng: number }) => void;
  openModal?: (region: any) => void;
}) {
  const [isMapReady, setIsMapReady] = useState(false);
  const [MapContainer, setMapContainer] = useState<any>(null);
  const [TileLayer, setTileLayer] = useState<any>(null);
  const [Circle, setCircle] = useState<any>(null);
  const [Polyline, setPolyline] = useState<any>(null);
  const [useMapEvents, setUseMapEvents] = useState<any>(null);
  const [currentLayer, setCurrentLayer] = useState('dark');

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
            eventHandlers={{ click: () => openModal ? openModal(r) : jumpToRegion(r.id) }} 
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
    
    // Filter only published tours
    const publishedTours = parsed.filter(tour => 
      tour && 
      typeof tour === 'object' && 
      tour.slug && 
      tour.title && 
      Array.isArray(tour.regions) &&
      tour.published === true // Only published tours
    );
    
    if (publishedTours.length !== parsed.length) {
      console.log(`Filtered ${parsed.length - publishedTours.length} unpublished tours`);
    }
    
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
  const localCMSTours = IS_CLIENT ? getCMSTours() : null;

  // S3 tours state - loads tours shared across all users
  const [s3Tours, setS3Tours] = useState<any[] | null>(null);
  const [isLoadingS3Tours, setIsLoadingS3Tours] = useState(true);

  // Combine local and S3 tours
  const cmsTours = useMemo(() => {
    const tours = [];

    // Add local tours (for backward compatibility)
    if (localCMSTours && Array.isArray(localCMSTours)) {
      tours.push(...localCMSTours);
    }

    // Add S3 tours (shared across all users)
    if (s3Tours && Array.isArray(s3Tours)) {
      // Filter out duplicates based on slug
      const existingSlugs = new Set(tours.map((t: any) => t.slug));
      const uniqueS3Tours = s3Tours.filter((t: any) => !existingSlugs.has(t.slug));
      tours.push(...uniqueS3Tours);
    }

    return tours.length > 0 ? tours : null;
  }, [localCMSTours, s3Tours]);

  // Load tours from S3 on mount
  useEffect(() => {
    if (!IS_CLIENT) return;

    async function loadS3Tours() {
      try {
        console.log('🌐 Loading tours from S3...');
        const response = await fetch('/api/tours/list');

        if (!response.ok) {
          console.error('Failed to load tours from S3:', response.statusText);
          setIsLoadingS3Tours(false);
          return;
        }

        const data = await response.json();
        console.log(`✅ Loaded ${data.tours?.length || 0} tours from S3`);

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

          setS3Tours(fullTours.filter(t => t !== null));
        } else {
          setS3Tours([]);
        }
      } catch (error) {
        console.error('Error loading tours from S3:', error);
        setS3Tours([]);
      } finally {
        setIsLoadingS3Tours(false);
      }
    }

    loadS3Tours();
  }, []);

  // Audio context and state
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);
  const [currentAudio, setCurrentAudio] = useState<HTMLAudioElement | null>(null);
  const [currentOscillator, setCurrentOscillator] = useState<{ oscillator: OscillatorNode; gainNode: GainNode } | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioDuration, setAudioDuration] = useState(0);
  const [audioCurrentTime, setAudioCurrentTime] = useState(0);
  
  // Subtitle state
  const [currentSubtitle, setCurrentSubtitle] = useState<SubtitleEntry | null>(null);
  const [subtitles, setSubtitles] = useState<SubtitleEntry[]>([]);
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalRegion, setModalRegion] = useState<any>(null);
  const [currentRegionIndex, setCurrentRegionIndex] = useState(0);
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
  
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
        slug: cmsTour.slug,
        title: cmsTour.title,
        description: cmsTour.description || '',
        tourImageDataUrl: cmsTour.tourImageDataUrl || '',
        locale: tourLocale,
        parentTourId: cmsTour.parentTourId,
        regions: cmsTour.regions.map((r: any) => ({
          id: r.id || `region-${Math.random()}`,
          name: cmsTour.tracks?.[tourLocale]?.[r.id]?.title || `Punto ${r.sort || 1}`,
          description: cmsTour.tracks?.[tourLocale]?.[r.id]?.description || '',
          transcript: cmsTour.tracks?.[tourLocale]?.[r.id]?.transcript || '',
          imageDataUrl: cmsTour.tracks?.[tourLocale]?.[r.id]?.imageDataUrl || '',
          center: { lat: r.lat || 45.07, lng: r.lng || 7.68 },
          radiusM: r.radiusM || 120,
          sort: r.sort || 1,
          track: cmsTour.tracks?.[tourLocale]?.[r.id] || { kind: 'tone', frequency: 440 }
        })),
        availableLanguages: [] // Will be populated later
      } as any;
    } catch (error) {
      console.error('Error converting CMS tour to player format:', error, cmsTour);
      return null;
    }
  };

  const availableTours = useMemo(() => {
    const tours = [];
    
    if (cmsTours && cmsTours.length > 0) {
      // Group tours by parent tour ID to show language variants
      const tourGroups = new Map();
      
      cmsTours.forEach((cmsTour: any) => {
        const parentId = cmsTour.parentTourId || cmsTour.id;
        if (!tourGroups.has(parentId)) {
          tourGroups.set(parentId, []);
        }
        tourGroups.get(parentId).push(cmsTour);
      });
      
      // Convert each group to a single tour with language options
      tourGroups.forEach((groupTours: any[]) => {
        const mainTour = groupTours[0];
        const convertedTour = convertCMSTourToPlayer(mainTour);
        if (convertedTour) {
          // Add available languages
          convertedTour.availableLanguages = groupTours.map((t: any) => ({
            code: t.locale || t.locales?.[0]?.code || 'it-IT',
            title: t.title,
            tourId: t.id
          }));
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

  const [selectedTourIndex, setSelectedTourIndex] = useState(0);
  const [locale, setLocale] = useState(availableTours[0]?.locale || 'it-IT');
  const [usingGPS, setUsingGPS] = useState(false);
  const [userPos, setUserPos] = useState<{lat:number,lng:number}|null>(null);
  const [activeRegionId, setActiveRegionId] = useState<string|null>(null);

  const TOUR = availableTours[selectedTourIndex] || DEMO_TOUR;

  // Update locale when tour changes
  useEffect(() => {
    setLocale(TOUR.locale || TOUR.defaultLocale || 'it-IT');
  }, [TOUR.locale, TOUR.defaultLocale]);

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
            if (track.kind === 'tone' && track.frequency) {
              playTone(track.frequency);
            } else if (track.audioDataUrl) {
              playAudio(track.audioDataUrl);
            } else {
              // Try to find audio data in CMS tracks
              const cmsTour = findCMSTour();
              if (cmsTour) {
                const cmsTrack = cmsTour.tracks?.[locale]?.[enteredRegion.id];
                if (cmsTrack?.audioDataUrl) {
                  // Get subtitle content if available
                  const subtitleContent = cmsTour.subtitles?.[locale]?.[cmsTrack.subtitleId]?.content || '';
                  playAudio(cmsTrack.audioDataUrl, subtitleContent);
                }
              }
            }
          }
        }
      }, 
      ()=>{}, 
      { enableHighAccuracy:true, timeout:10000, maximumAge:1000 } 
    ); 
    return ()=> navigator.geolocation.clearWatch(id); 
  }, [usingGPS, TOUR, locale, activeRegionId, cmsTours]);

  // Initialize audio context
  useEffect(() => {
    if (IS_CLIENT && !audioContext) {
      console.log('Initializing audio context');
      try {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        console.log('Audio context created, state:', ctx.state);
        setAudioContext(ctx);
      } catch (error) {
        console.error('Failed to create audio context:', error);
      }
    }
  }, [audioContext]);

  // Function to play tone
  const playTone = async (frequency: number, duration: number = 15000) => {
    console.log('playTone called with frequency:', frequency);

    if (!audioContext) {
      console.error('No audio context available');
      return;
    }

    try {
      // Resume audio context if suspended (required for browser autoplay policies)
      if (audioContext.state === 'suspended') {
        console.log('Resuming suspended audio context');
        await audioContext.resume();
      }

      // Stop current audio if playing
      stopAudio();

      // Create demo subtitles for tone audio
      const demoSubtitles: SubtitleEntry[] = [
        { id: 1, startTime: '00:00:00,000', endTime: '00:00:03,000', startSeconds: 0, endSeconds: 3, text: `Playing ${frequency}Hz tone...` },
        { id: 2, startTime: '00:00:03,000', endTime: '00:00:08,000', startSeconds: 3, endSeconds: 8, text: 'This is a demo subtitle for the audio tone.' },
        { id: 3, startTime: '00:00:08,000', endTime: '00:00:12,000', startSeconds: 8, endSeconds: 12, text: 'Subtitles sync with the audio playback.' },
        { id: 4, startTime: '00:00:12,000', endTime: '00:00:15,000', startSeconds: 12, endSeconds: duration / 1000, text: 'Audio will stop automatically.' }
      ];

      setSubtitles(demoSubtitles);
      setCurrentSubtitle(demoSubtitles[0]);

      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
      oscillator.type = 'sine';

      gainNode.gain.setValueAtTime(0, audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.1, audioContext.currentTime + 0.1);
      gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + duration / 1000);

      console.log('Starting oscillator');
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + duration / 1000);

      // Store oscillator reference for stopping
      setCurrentOscillator({ oscillator, gainNode });
      setIsPlaying(true);

      // Start subtitle timing
      const startTime = Date.now();
      const subtitleInterval = setInterval(() => {
        const elapsed = (Date.now() - startTime) / 1000;
        const currentSub = getCurrentSubtitle(demoSubtitles, elapsed);
        setCurrentSubtitle(currentSub);

        if (elapsed >= duration / 1000) {
          clearInterval(subtitleInterval);
        }
      }, 100);

      // Auto-stop when finished
      oscillator.onended = () => {
        console.log('Oscillator ended');
        setIsPlaying(false);
        setCurrentOscillator(null);
        clearInterval(subtitleInterval);
        setCurrentSubtitle(null);
      };

    } catch (error) {
      console.error('Error playing tone:', error);
      setIsPlaying(false);
    }
  };

  // Function to play audio file
  const playAudio = (audioSource: string, srtContent?: string) => {
    console.log('playAudio called with source:', audioSource);
    console.log('Subtitle content:', srtContent);
    if (!audioSource) return;

    // Stop current audio if playing
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
    }

    // Parse subtitles if provided
    let parsedSubtitles: SubtitleEntry[] = [];
    if (srtContent && srtContent.trim()) {
      parsedSubtitles = parseSRT(srtContent);
      console.log('Parsed subtitles:', parsedSubtitles);
      setSubtitles(parsedSubtitles);
    } else {
      console.log('No subtitle content provided');
      setSubtitles([]);
    }
    setCurrentSubtitle(null);
    
    console.log('Creating audio element with source:', audioSource);
    const audio = new Audio(audioSource);
    audio.volume = 1.0;

    audio.onplay = () => setIsPlaying(true);
    audio.onpause = () => setIsPlaying(false);
    audio.onended = () => {
      setIsPlaying(false);
      setCurrentSubtitle(null);
      setAudioCurrentTime(0);
    };
    audio.onerror = (e) => {
      console.error('Audio playback error:', e);
      setIsPlaying(false);
    };

    // Track audio progress
    audio.ontimeupdate = () => {
      setAudioCurrentTime(audio.currentTime);

      // Update subtitles based on current time
      if (parsedSubtitles.length > 0) {
        const currentSub = getCurrentSubtitle(parsedSubtitles, audio.currentTime);
        setCurrentSubtitle(currentSub);
      }
    };

    // Set duration when metadata loads
    audio.onloadedmetadata = () => {
      setAudioDuration(audio.duration);
    };
    
    setCurrentAudio(audio);
    audio.play().catch(err => {
      console.error('Failed to play audio:', err);
      setIsPlaying(false);
    });
  };

  // Function to stop current audio
  const stopAudio = () => {
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
      setCurrentAudio(null);
    }
    if (currentOscillator) {
      try {
        currentOscillator.oscillator.stop();
      } catch (e) {
        // Oscillator might already be stopped
      }
      setCurrentOscillator(null);
    }
    setIsPlaying(false);
    setCurrentSubtitle(null);
    setSubtitles([]);
    setAudioCurrentTime(0);
    setAudioDuration(0);
  };

  // Audio control functions
  const pauseAudio = () => {
    if (currentAudio && !currentAudio.paused) {
      currentAudio.pause();
    }
  };

  const resumeAudio = () => {
    if (currentAudio && currentAudio.paused) {
      currentAudio.play().catch(err => {
        console.error('Failed to resume audio:', err);
      });
    }
  };

  const seekAudio = (seconds: number) => {
    if (currentAudio) {
      const newTime = Math.max(0, Math.min(currentAudio.duration, currentAudio.currentTime + seconds));
      currentAudio.currentTime = newTime;
      setAudioCurrentTime(newTime);
    }
  };

  const setAudioTime = (time: number) => {
    if (currentAudio) {
      currentAudio.currentTime = time;
      setAudioCurrentTime(time);
    }
  };

  // Helper function to format time
  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  // Modal functions
  const openModal = (region: any) => {
    const regionIndex = (TOUR.regions || []).findIndex((r: any) => r.id === region.id);
    setCurrentRegionIndex(regionIndex);
    setModalRegion(region);
    setIsModalOpen(true);
    
    // Auto-start audio when opening modal
    const currentLocale = TOUR.locale || locale || 'it-IT';
    const track = typeof region.track === 'object' && region.track[currentLocale]
      ? region.track[currentLocale]
      : region.track;

    if (track) {
      if (track.kind === 'tone' && track.frequency) {
        playTone(track.frequency);
      } else if (track.audioDataUrl || track.audioUrl) {
        const audioSource = track.audioDataUrl || track.audioUrl;
        // Try to get subtitles for this track
        let subtitleContent = '';
        const cmsTour = findCMSTour();
        console.log('Looking for subtitles. Track:', track);
        console.log('Region ID:', region.id);
        console.log('Current locale:', currentLocale);
        console.log('CMS Tour available:', !!cmsTour);

        if (cmsTour) {
          console.log('CMS Tour structure:', {
            id: cmsTour.id,
            title: cmsTour.title,
            tracksKeys: Object.keys(cmsTour.tracks || {}),
            subtitlesKeys: Object.keys(cmsTour.subtitles || {}),
            locales: cmsTour.locales
          });

          console.log('CMS tracks for locale:', cmsTour.tracks?.[currentLocale]);
          console.log('CMS subtitles for locale:', cmsTour.subtitles?.[currentLocale]);

          // Check if track has subtitleId
          if (track.subtitleId) {
            console.log('Track has subtitleId:', track.subtitleId);
            subtitleContent = cmsTour.subtitles?.[currentLocale]?.[track.subtitleId]?.content || '';
            console.log('Found subtitle content from track.subtitleId:', subtitleContent);
          } else {
            console.log('Track has no subtitleId, checking CMS track for region');
            // Try to find subtitle by region ID
            const cmsTrack = cmsTour.tracks?.[currentLocale]?.[region.id];
            console.log('CMS track for region:', cmsTrack);

            if (cmsTrack?.subtitleId) {
              console.log('CMS track has subtitleId:', cmsTrack.subtitleId);
              subtitleContent = cmsTour.subtitles?.[currentLocale]?.[cmsTrack.subtitleId]?.content || '';
              console.log('Found subtitle content from CMS track:', subtitleContent);
            } else {
              console.log('No subtitleId found in CMS track, trying alternative matching');

              // Try to match subtitle by region ID
              const availableSubtitles = cmsTour.subtitles?.[currentLocale] || {};
              console.log('Available subtitle entries:', Object.keys(availableSubtitles));

              // Check each subtitle to see if it matches the region
              for (const [subtitleId, subtitle] of Object.entries(availableSubtitles)) {
                console.log(`Checking subtitle ${subtitleId}:`, subtitle);
                const sub = subtitle as any;

                // Try different matching strategies
                if (sub.regionId === region.id ||
                    sub.id === region.id ||
                    sub.name === region.id ||
                    subtitleId === region.id) {
                  console.log('Found matching subtitle by ID:', subtitleId);
                  subtitleContent = sub.content || '';
                  break;
                }

                // Check if subtitle filename/name matches track filename
                if (cmsTrack.audioFilename && sub.name &&
                    sub.name.toLowerCase().includes(cmsTrack.audioFilename.toLowerCase().split('.')[0])) {
                  console.log('Found matching subtitle by filename:', subtitleId);
                  subtitleContent = sub.content || '';
                  break;
                }
              }

              // If still no match, try the first available subtitle as fallback
              if (!subtitleContent && Object.keys(availableSubtitles).length > 0) {
                const firstSubtitleId = Object.keys(availableSubtitles)[0];
                console.log('Using first available subtitle as fallback:', firstSubtitleId);
                subtitleContent = availableSubtitles[firstSubtitleId]?.content || '';
              }

              console.log('Final subtitle content found:', subtitleContent ? 'YES' : 'NO');
            }
          }
        } else {
          console.log('No CMS tour found');
        }

        playAudio(audioSource, subtitleContent);
      } else {
        // Try to find audio data in CMS tracks
        const cmsTour = findCMSTour();
        if (cmsTour) {
          const cmsTrack = cmsTour.tracks?.[currentLocale]?.[region.id];
          if (cmsTrack?.audioDataUrl || cmsTrack?.audioUrl) {
            const audioSource = cmsTrack.audioDataUrl || cmsTrack.audioUrl;
            // Get subtitle content if available
            const subtitleContent = cmsTour.subtitles?.[currentLocale]?.[cmsTrack.subtitleId]?.content || '';
            playAudio(audioSource, subtitleContent);
          }
        }
      }
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setModalRegion(null);
  };

  const navigateModal = (direction: 'prev' | 'next') => {
    const regions = TOUR.regions || [];
    let newIndex = currentRegionIndex;
    
    if (direction === 'prev') {
      newIndex = currentRegionIndex > 0 ? currentRegionIndex - 1 : regions.length - 1;
    } else {
      newIndex = currentRegionIndex < regions.length - 1 ? currentRegionIndex + 1 : 0;
    }
    
    // Stop current audio
    stopAudio();
    
    const newRegion = regions[newIndex];
    setCurrentRegionIndex(newIndex);
    setModalRegion(newRegion);
    
    // Start new audio after a short delay
    setTimeout(() => {
      const track = newRegion.track;
      if (track) {
        if (track.kind === 'tone' && track.frequency) {
          playTone(track.frequency);
        } else if (track.audioDataUrl) {
          playAudio(track.audioDataUrl);
        } else {
          // Try to find audio data in CMS tracks
          const cmsTour = findCMSTour();
          if (cmsTour) {
            const locale = TOUR.locale || 'it-IT';
            const cmsTrack = cmsTour.tracks?.[locale]?.[newRegion.id];
            if (cmsTrack?.audioDataUrl) {
              // Get subtitle content if available
              const subtitleContent = cmsTour.subtitles?.[locale]?.[cmsTrack.subtitleId]?.content || '';
              playAudio(cmsTrack.audioDataUrl, subtitleContent);
            }
          }
        }
      }
    }, 100);
  };

  // Info modal functions
  const openInfoModal = () => {
    setIsInfoModalOpen(true);
  };

  const closeInfoModal = () => {
    setIsInfoModalOpen(false);
  };

  // Start tour function
  const startTour = () => {
    const firstRegion = (TOUR.regions || [])[0];
    if (firstRegion) {
      openModal(firstRegion);
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
      if (track) {
        if (track.kind === 'tone' && track.frequency) {
          playTone(track.frequency);
        } else if (track.audioDataUrl) {
          playAudio(track.audioDataUrl);
        } else {
          // Try to find audio data in CMS tracks
          const cmsTour = findCMSTour();
          if (cmsTour) {
            const cmsTrack = cmsTour.tracks?.[locale]?.[r.id];
            if (cmsTrack?.audioDataUrl) {
              // Get subtitle content if available
              const subtitleContent = cmsTour.subtitles?.[locale]?.[cmsTrack.subtitleId]?.content || '';
              playAudio(cmsTrack.audioDataUrl, subtitleContent);
            }
          }
        }
      }
    }
  };
  
  // Helper function to find the correct CMS tour
  const findCMSTour = () => {
    if (!cmsTours) return null;
    
    // First try to find by slug
    let cmsTour = cmsTours.find(t => t.slug === TOUR.slug);
    
    // If not found, try to find by available languages
    if (!cmsTour && TOUR.availableLanguages) {
      for (const lang of TOUR.availableLanguages) {
        cmsTour = cmsTours.find(t => t.id === lang.tourId);
        if (cmsTour) break;
      }
    }
    
    // If still not found, try to find by parent tour ID
    if (!cmsTour && TOUR.parentTourId) {
      cmsTour = cmsTours.find(t => t.id === TOUR.parentTourId);
    }
    
    return cmsTour;
  };

  // Keyboard navigation for modals
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isModalOpen) {
          closeModal();
        } else if (isInfoModalOpen) {
          closeInfoModal();
        }
      } else if (isModalOpen) {
        if (e.key === 'ArrowLeft') {
          navigateModal('prev');
        } else if (e.key === 'ArrowRight') {
          navigateModal('next');
        }
      }
    };
    
    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, [isModalOpen, isInfoModalOpen, currentRegionIndex]);

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
          <select 
            className="rounded-xl bg-neutral-800/50 border border-neutral-700/50 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all duration-200" 
            value={selectedTourIndex}
            onChange={(e)=> setSelectedTourIndex(parseInt(e.target.value))}
          >
            {availableTours.map((tour, index) => (
              <option key={index} value={index}>{tour.title}</option>
            ))}
          </select>
          <select 
            className="rounded-xl bg-neutral-800/50 border border-neutral-700/50 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all duration-200" 
            value={locale} 
            onChange={(e)=> {
              const newLocale = e.target.value;
              setLocale(newLocale);
              
              // If this is a CMS tour with available languages, switch to the correct tour
              if (TOUR.availableLanguages) {
                const targetLanguage = TOUR.availableLanguages.find((lang: any) => lang.code === newLocale);
                if (targetLanguage) {
                  // Find the tour with this language
                  const targetTourIndex = availableTours.findIndex((tour: any) => 
                    tour.availableLanguages?.some((lang: any) => lang.tourId === targetLanguage.tourId)
                  );
                  if (targetTourIndex !== -1) {
                    setSelectedTourIndex(targetTourIndex);
                  }
                }
              }
            }}
          >
            {TOUR.availableLanguages ? 
              TOUR.availableLanguages.map((lang: any) => (
                <option key={lang.code} value={lang.code}>
                  {lang.code.split('-')[0].toUpperCase()}
                </option>
              )) : 
              (TOUR.locales||[]).map((l:string)=> (
                <option key={l} value={l}>{l}</option>
              ))
            }
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
      <div className="mx-auto max-w-7xl px-6 pb-8">
          {/* Map */}
          <div className="w-full">
            <PlayerMap 
              tour={TOUR}
              userPos={userPos}
              activeRegionId={activeRegionId}
              jumpToRegion={jumpToRegion}
              setUserPos={setUserPos}
              openModal={openModal}
            />
          </div>

          {/* Action Buttons */}
          <div className="flex justify-center gap-4 mt-6">
            <button
              onClick={openInfoModal}
              className="px-8 py-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 border border-blue-500/50 text-white font-bold transition-all duration-200 hover:scale-105 shadow-lg"
            >
              📋 Info
            </button>
            <button
              onClick={startTour}
              className="px-8 py-4 rounded-xl bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 border border-emerald-500/50 text-white font-bold transition-all duration-200 hover:scale-105 shadow-lg"
            >
              🚀 Inizia
            </button>
          </div>
        </div>

      {/* Info Modal */}
      {isInfoModalOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-gradient-to-br from-neutral-900 to-neutral-950 border border-neutral-700 rounded-2xl shadow-2xl mx-4">
            {/* Info Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-neutral-700">
              <h2 className="text-xl font-bold text-neutral-100">Informazioni Tour</h2>
              <button
                onClick={closeInfoModal}
                className="p-2 rounded-xl bg-neutral-800/50 hover:bg-neutral-700/50 transition-all duration-200 hover:scale-105"
                title="Close (Esc)"
              >
                ✕
              </button>
            </div>

            {/* Info Modal Content */}
            <div className="p-6 space-y-6">
              {/* Tour Title */}
              <div>
                <h3 className="text-2xl font-bold text-neutral-100 mb-2">{TOUR.title}</h3>
              </div>

              {/* Tour Image */}
              {TOUR.tourImageDataUrl && (
                <div className="relative">
                  <img 
                    src={TOUR.tourImageDataUrl} 
                    alt={TOUR.title}
                    className="w-full h-64 object-cover rounded-lg border border-neutral-700 bg-neutral-900/50" 
                  />
                </div>
              )}

              {/* Tour Description */}
              {TOUR.description && (
                <div>
                  <div className="text-sm text-neutral-100 leading-relaxed">
                    {TOUR.description}
                  </div>
                </div>
              )}

              {/* Start Button */}
              <div className="flex justify-center pt-4">
                <button
                  onClick={() => {
                    closeInfoModal();
                    startTour();
                  }}
                  className="px-8 py-4 rounded-xl bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 border border-emerald-500/50 text-white font-bold transition-all duration-200 hover:scale-105 shadow-lg"
                >
                  🚀 Inizia Tour
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Region Modal */}
      {isModalOpen && modalRegion && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-gradient-to-br from-neutral-900 to-neutral-950 border border-neutral-700 rounded-2xl shadow-2xl mx-4">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-neutral-700">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => navigateModal('prev')}
                  className="p-2 rounded-xl bg-neutral-800/50 hover:bg-neutral-700/50 transition-all duration-200 hover:scale-105"
                  title="Previous region (←)"
                >
                  ←
                </button>
                <div>
                  <h2 className="text-xl font-bold text-neutral-100">
                    {(typeof modalRegion.name === 'object' ? modalRegion.name[locale] : modalRegion.name) || `Punto ${modalRegion.sort}`}
                  </h2>
                  <div className="text-sm text-neutral-400">
                    {currentRegionIndex + 1} di {(TOUR.regions || []).length}
                  </div>
                </div>
                <button
                  onClick={() => navigateModal('next')}
                  className="p-2 rounded-xl bg-neutral-800/50 hover:bg-neutral-700/50 transition-all duration-200 hover:scale-105"
                  title="Next region (→)"
                >
                  →
                </button>
              </div>
              <button
                onClick={closeModal}
                className="p-2 rounded-xl bg-neutral-800/50 hover:bg-neutral-700/50 transition-all duration-200 hover:scale-105"
                title="Close (Esc)"
              >
                ✕
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-6">
              {/* Description */}
              {modalRegion.description && (
                <div>
                  <div className="text-sm text-neutral-100 leading-relaxed">
                    {modalRegion.description}
                  </div>
                </div>
              )}

              {/* Transcript */}
              {modalRegion.transcript && (
                <div>
                  <div className="text-sm text-neutral-100 leading-relaxed">
                    {modalRegion.transcript}
                  </div>
                </div>
              )}


              {/* Image */}
              {modalRegion.imageDataUrl && (
                <div className="relative">
                  <img 
                    src={modalRegion.imageDataUrl} 
                    alt={(typeof modalRegion.name === 'object' ? modalRegion.name[locale] : modalRegion.name) || `Region ${modalRegion.sort}`}
                    className="w-full h-64 object-contain rounded-lg border border-neutral-700 bg-neutral-900/50" 
                  />
                </div>
              )}

              {/* Audio Player Controls */}
              <div className="bg-gradient-to-r from-purple-600/10 to-pink-600/10 border border-purple-500/30 rounded-xl p-4">
                <div className="space-y-4">
                  {/* Audio Controls Header */}
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-purple-200 font-medium">
                      🎵 Audio Player
                    </span>
                    {currentAudio && audioDuration > 0 && (
                      <span className="text-xs text-neutral-400">
                        {formatTime(audioCurrentTime)} / {formatTime(audioDuration)}
                      </span>
                    )}
                  </div>

                  {/* Progress Bar */}
                  {currentAudio && audioDuration > 0 && (
                    <div className="space-y-2">
                      <div className="relative">
                        <input
                          type="range"
                          min="0"
                          max={audioDuration}
                          value={audioCurrentTime}
                          onChange={(e) => setAudioTime(parseFloat(e.target.value))}
                          className="w-full h-2 bg-neutral-700 rounded-lg appearance-none cursor-pointer slider"
                        />
                        <style jsx>{`
                          .slider::-webkit-slider-thumb {
                            appearance: none;
                            width: 16px;
                            height: 16px;
                            border-radius: 50%;
                            background: #8b5cf6;
                            cursor: pointer;
                            border: 2px solid #ffffff;
                            box-shadow: 0 2px 4px rgba(0,0,0,0.2);
                          }
                          .slider::-moz-range-thumb {
                            width: 16px;
                            height: 16px;
                            border-radius: 50%;
                            background: #8b5cf6;
                            cursor: pointer;
                            border: 2px solid #ffffff;
                            box-shadow: 0 2px 4px rgba(0,0,0,0.2);
                          }
                        `}</style>
                      </div>
                    </div>
                  )}

                  {/* Main Controls */}
                  <div className="flex items-center justify-center gap-3">
                    {/* Back 10s */}
                    <button
                      onClick={() => seekAudio(-10)}
                      disabled={!currentAudio}
                      className="p-2 rounded-lg bg-neutral-700/50 hover:bg-neutral-600/50 disabled:opacity-50 disabled:cursor-not-allowed text-neutral-200 transition-all duration-200"
                      title="Back 10 seconds"
                    >
                      ⏪ 10s
                    </button>

                    {/* Play/Pause */}
                    {!isPlaying ? (
                      <button
                        onClick={() => {
                          if (currentAudio && currentAudio.paused) {
                            resumeAudio();
                          } else {
                            // Initial play
                            const track = typeof modalRegion.track === 'object' && modalRegion.track[locale]
                              ? modalRegion.track[locale]
                              : modalRegion.track;

                            if (track) {
                              if (track.kind === 'tone' && track.frequency) {
                                playTone(track.frequency);
                              } else if (track.audioDataUrl || track.audioUrl) {
                                const audioSource = track.audioDataUrl || track.audioUrl;
                                // Try to get subtitles for this track
                                let subtitleContent = '';
                                const cmsTour = findCMSTour();
                                console.log('Manual play - Looking for subtitles. Track:', track);
                                console.log('Modal Region ID:', modalRegion.id);

                                if (cmsTour) {
                                  console.log('Manual CMS tracks for locale:', cmsTour.tracks?.[locale]);
                                  console.log('Manual CMS subtitles for locale:', cmsTour.subtitles?.[locale]);

                                  if (track.subtitleId) {
                                    console.log('Manual - Track has subtitleId:', track.subtitleId);
                                    subtitleContent = cmsTour.subtitles?.[locale]?.[track.subtitleId]?.content || '';
                                    console.log('Manual - Found subtitle content from track.subtitleId:', subtitleContent);
                                  } else {
                                    console.log('Manual - Track has no subtitleId, checking CMS track for region');
                                    // Try to find subtitle by region ID
                                    const cmsTrack = cmsTour.tracks?.[locale]?.[modalRegion.id];
                                    console.log('Manual - CMS track for region:', cmsTrack);

                                    if (cmsTrack?.subtitleId) {
                                      console.log('Manual - CMS track has subtitleId:', cmsTrack.subtitleId);
                                      subtitleContent = cmsTour.subtitles?.[locale]?.[cmsTrack.subtitleId]?.content || '';
                                      console.log('Manual - Found subtitle content from CMS track:', subtitleContent);
                                    } else {
                                      console.log('Manual - No subtitleId found in CMS track, trying alternative matching');

                                      // Try to match subtitle by region ID
                                      const availableSubtitles = cmsTour.subtitles?.[locale] || {};
                                      console.log('Manual - Available subtitle entries:', Object.keys(availableSubtitles));

                                      // Check each subtitle to see if it matches the region
                                      for (const [subtitleId, subtitle] of Object.entries(availableSubtitles)) {
                                        console.log(`Manual - Checking subtitle ${subtitleId}:`, subtitle);
                                        const sub = subtitle as any;

                                        // Try different matching strategies
                                        if (sub.regionId === modalRegion.id ||
                                            sub.id === modalRegion.id ||
                                            sub.name === modalRegion.id ||
                                            subtitleId === modalRegion.id) {
                                          console.log('Manual - Found matching subtitle by ID:', subtitleId);
                                          subtitleContent = sub.content || '';
                                          break;
                                        }

                                        // Check if subtitle filename/name matches track filename
                                        if (cmsTrack.audioFilename && sub.name &&
                                            sub.name.toLowerCase().includes(cmsTrack.audioFilename.toLowerCase().split('.')[0])) {
                                          console.log('Manual - Found matching subtitle by filename:', subtitleId);
                                          subtitleContent = sub.content || '';
                                          break;
                                        }
                                      }

                                      // If still no match, try the first available subtitle as fallback
                                      if (!subtitleContent && Object.keys(availableSubtitles).length > 0) {
                                        const firstSubtitleId = Object.keys(availableSubtitles)[0];
                                        console.log('Manual - Using first available subtitle as fallback:', firstSubtitleId);
                                        subtitleContent = availableSubtitles[firstSubtitleId]?.content || '';
                                      }

                                      console.log('Manual - Final subtitle content found:', subtitleContent ? 'YES' : 'NO');
                                    }
                                  }
                                }

                                playAudio(audioSource, subtitleContent);
                              } else {
                                const cmsTour = findCMSTour();
                                if (cmsTour) {
                                  const cmsTrack = cmsTour.tracks?.[locale]?.[modalRegion.id];
                                  if (cmsTrack?.audioDataUrl || cmsTrack?.audioUrl) {
                                    const audioSource = cmsTrack.audioDataUrl || cmsTrack.audioUrl;
                                    const subtitleContent = cmsTour.subtitles?.[locale]?.[cmsTrack.subtitleId]?.content || '';
                                    playAudio(audioSource, subtitleContent);
                                  }
                                }
                              }
                            }
                          }
                        }}
                        className="p-3 rounded-lg bg-green-600/20 hover:bg-green-600/30 border border-green-500/30 text-green-200 transition-all duration-200"
                      >
                        ▶️
                      </button>
                    ) : (
                      <button
                        onClick={pauseAudio}
                        className="p-3 rounded-lg bg-yellow-600/20 hover:bg-yellow-600/30 border border-yellow-500/30 text-yellow-200 transition-all duration-200"
                      >
                        ⏸️
                      </button>
                    )}

                    {/* Forward 10s */}
                    <button
                      onClick={() => seekAudio(10)}
                      disabled={!currentAudio}
                      className="p-2 rounded-lg bg-neutral-700/50 hover:bg-neutral-600/50 disabled:opacity-50 disabled:cursor-not-allowed text-neutral-200 transition-all duration-200"
                      title="Forward 10 seconds"
                    >
                      10s ⏩
                    </button>

                    {/* Stop */}
                    <button
                      onClick={stopAudio}
                      disabled={!isPlaying && !currentAudio}
                      className="p-2 rounded-lg bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 text-red-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                    >
                      ⏹️
                    </button>
                  </div>

                  {/* Subtitle Display Area */}
                  {subtitles.length > 0 && currentSubtitle && (
                    <div className="bg-black/20 rounded-lg p-3 min-h-[60px] flex items-center justify-center">
                      <div className="text-sm text-neutral-100 leading-relaxed font-medium text-center">
                        {currentSubtitle.text}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
