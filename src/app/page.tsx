'use client';

import { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Property, AnalysisResponse, AttendedSchoolsResult } from '@/lib/types/property';
import { Bed, Bath, Ruler, Home, MapPin, Copy, Check, ChevronDown, ChevronUp, Loader2, Zap, Train, CircleDot, HelpCircle, Clipboard, X, GraduationCap, Sparkles, FileText, Trash2, Plus, ArrowLeft, RefreshCw } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ThemeToggle } from '@/components/ThemeToggle';
import { PropertyCard } from '@/components/PropertyCard';
import { UndoToast } from '@/components/UndoToast';
import { getSavedProperties, saveProperty, deleteProperty, restoreProperty } from '@/lib/storage';
import type { SavedProperty } from '@/lib/storage';

// EPC rating colors (A=dark green, G=red)
function getEpcColor(rating: string): string {
  const colors: Record<string, string> = {
    'A': 'bg-green-600 text-white',
    'B': 'bg-green-500 text-white',
    'C': 'bg-lime-500 text-white',
    'D': 'bg-yellow-400 text-slate-900',
    'E': 'bg-orange-400 text-white',
    'F': 'bg-orange-500 text-white',
    'G': 'bg-red-500 text-white',
  };
  return colors[rating.toUpperCase()] || 'bg-slate-200 text-slate-700';
}

// Ofsted rating colors
function getOfstedColor(rating: string | null): string {
  switch (rating) {
    case 'Outstanding': return 'bg-green-600 text-white';
    case 'Good': return 'bg-lime-500 text-white';
    case 'Requires Improvement': return 'bg-yellow-400 text-slate-900';
    case 'Inadequate': return 'bg-red-500 text-white';
    default: return 'bg-slate-200 text-slate-600';
  }
}

function getOfstedShort(rating: string | null): string {
  switch (rating) {
    case 'Outstanding': return 'Outstanding';
    case 'Good': return 'Good';
    case 'Requires Improvement': return 'RI';
    case 'Inadequate': return 'Inadequate';
    default: return 'N/A';
  }
}

// Build DfE school page URL from URN (e.g. "urn101333" → GIAS details page)
function getSchoolUrl(urn: string): string {
  const urnNumber = urn.replace(/^urn/i, '');
  return `https://get-information-schools.service.gov.uk/Establishments/Establishment/Details/${urnNumber}`;
}

// Format distance in miles (from km or meters)
function formatDistanceMiles(km: number): string {
  const miles = km * 0.621371;
  return miles < 0.1 ? `${Math.round(miles * 5280)} ft` : `${miles.toFixed(1)} mi`;
}

// Tube line colors
const tubeLineColors: Record<string, string> = {
  'Bakerloo': '#B36305',
  'Central': '#DC241F',
  'Circle': '#FFD300',
  'District': '#007D32',
  'Hammersmith & City': '#F3A9BB',
  'Jubilee': '#A0A5A9',
  'Metropolitan': '#9B0056',
  'Northern': '#000000',
  'Piccadilly': '#00095B',
  'Victoria': '#0088D3',
  'Waterloo & City': '#94CEBE',
  'DLR': '#00A4A7',
  'Overground': '#E86100',
  'Elizabeth': '#B97AC0',
};

// Get color for a tube line - returns text color based on background brightness
function getLineBadgeStyle(line: string): { bg: string; text: string } {
  const color = tubeLineColors[line] || '#888888';
  // For dark colors, use white text; for light colors, use dark text
  const darkLines = ['Northern', 'Piccadilly', 'Jubilee', 'Metropolitan', 'Bakerloo', 'Central', 'District', 'Elizabeth'];
  const isDark = darkLines.includes(line) || color === '#000000' || color === '#00095B' || color === '#9B0056';
  return { bg: color, text: isDark ? 'text-white' : 'text-slate-900 dark:text-slate-100' };
}

function HomeContent() {
  const searchParams = useSearchParams();
  const inputRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ property: Property; postcode: string | null } | null>(null);
  const [jsonExpanded, setJsonExpanded] = useState(false);
  const [helpExpanded, setHelpExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [clipboardAvailable, setClipboardAvailable] = useState(false);
  const [schoolsLoading, setSchoolsLoading] = useState(false);
  const [schoolsData, setSchoolsData] = useState<AttendedSchoolsResult | null>(null);
  const [schoolsError, setSchoolsError] = useState<string | null>(null);
  const [secondaryExpanded, setSecondaryExpanded] = useState(true);
  const [primaryExpanded, setPrimaryExpanded] = useState(true);
  const [secondaryMoreExpanded, setSecondaryMoreExpanded] = useState(false);
  const [primaryMoreExpanded, setPrimaryMoreExpanded] = useState(false);
  const [stationsLoading, setStationsLoading] = useState(false);
  const [commuteLoading, setCommuteLoading] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiModel, setAiModel] = useState<string | null>(null);

  // Ref to track the currently active property ID to avoid UI state collisions
  // from background tasks processing previous searches
  const activePropertyIdRef = useRef<string | null>(null);
  
  // Ref to track latest commute times to prevent race conditions in parallel saves
  const commuteTimesRef = useRef<Property['commuteTimes']>([]);

  // Saved properties state
  const [savedProperties, setSavedProperties] = useState<SavedProperty[]>([]);
  const [view, setView] = useState<'dashboard' | 'analysis'>('dashboard');
  const [selectedProperty, setSelectedProperty] = useState<SavedProperty | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [undoState, setUndoState] = useState<{ show: boolean; deletedProperty: SavedProperty | null }>({ show: false, deletedProperty: null });
  const [logsExpanded, setLogsExpanded] = useState(false);
  const [logs, setLogs] = useState<{ id: string; timestamp: string; level: string; message: string; source?: string }[]>([]);

  // Merge new logs into state, deduplicating by id, sorted newest first
  const mergeLogs = useCallback((newLogs: { id: string; timestamp: string; level: string; message: string; source?: string }[]) => {
    if (!newLogs || newLogs.length === 0) return;
    setLogs(prev => {
      const existingIds = new Set(prev.map(l => l.id));
      const unique = newLogs.filter(l => !existingIds.has(l.id));
      if (unique.length === 0) return prev;
      return [...unique, ...prev].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    });
  }, []);

  // Load saved properties on mount
  useEffect(() => {
    const loadSavedProperties = async () => {
      const properties = await getSavedProperties();
      setSavedProperties(properties);
    };
    loadSavedProperties();
  }, []);

  // Track whether we're loading from a saved property (skip re-fetching)
  const loadedFromSaveRef = useRef(false);

  const handlePropertyClick = (property: SavedProperty) => {
    setSelectedProperty(property);
    activePropertyIdRef.current = property.id;
    // Reset commute times ref when loading a saved property
    commuteTimesRef.current = property.data.commuteTimes || [];
    // Mark as loaded from save so the useEffect skips re-fetching
    loadedFromSaveRef.current = true;
    setResult({
      property: {
        ...property.data.property,
        commuteTimes: property.data.commuteTimes || [],
      },
      postcode: property.data.property.address.postcode,
    });
    setSchoolsData(property.data.schools);
    setAiAnalysis(property.data.aiAnalysis);
    setAiModel(property.data.aiModel);

    setView('analysis');
  };

  const handleDeleteProperty = async (e: React.MouseEvent, property: SavedProperty) => {
    e.stopPropagation();
    const deleted = await deleteProperty(property.id);
    if (deleted) {
      setSavedProperties(prev => prev.filter(p => p.id !== property.id));
      setUndoState({ show: true, deletedProperty: deleted });
    }
  };

  const handleUndo = async () => {
    if (undoState.deletedProperty) {
      await restoreProperty(undoState.deletedProperty);
      const properties = await getSavedProperties();
      setSavedProperties(properties);
      setUndoState({ show: false, deletedProperty: null });
    }
  };

  const handleDismissUndo = () => {
    setUndoState({ show: false, deletedProperty: null });
  };

  const handleNewAnalysis = () => {
    setView('analysis');
    setSelectedProperty(null);
    setUrl('');
    setResult(null);
    setSchoolsData(null);
    setSchoolsError(null);
    setAiAnalysis(null);
    setAiError(null);
    setError(null);
  };

  const handleBackToDashboard = async () => {
    setView('dashboard');
    setSelectedProperty(null);
    setResult(null);
    setSchoolsData(null);
    setSchoolsError(null);
    setAiAnalysis(null);
    setAiError(null);
    setError(null);
    setUrl('');
    
    // Refresh the list when going back to dashboard
    const properties = await getSavedProperties();
    setSavedProperties(properties);
  };

  const handleRefresh = async () => {
    if (!result?.property?.sourceUrl) return;
    setIsRefreshing(true);
    setSchoolsData(null);
    setSchoolsError(null);
    setAiAnalysis(null);
    setAiError(null);
    setLogs([]);
    await submitUrl(result.property.sourceUrl);
    setIsRefreshing(false);
  };

  const submitUrl = useCallback(async (urlToSubmit: string) => {
    if (!urlToSubmit.includes('rightmove.co.uk')) {
      setError('Please enter a valid Rightmove URL');
      return;
    }

    setError(null);
    setResult(null);
    setSchoolsData(null);
    setSchoolsError(null);
    setAiAnalysis(null);
    setAiError(null);
    setAiLoading(false);
    setLoading(true);

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: urlToSubmit }),
      });

      const data: AnalysisResponse = await response.json();

      if (data.logs) mergeLogs(data.logs);

      if (!data.success || !data.data) {
        setError(data.error || 'Failed to analyze property');
        return;
      }

      // 1. Mark as current and initial save (so it shows up on dashboard immediately)
      const property = data.data.property;
      activePropertyIdRef.current = property.id;
      // Reset commute times ref for new property search
      commuteTimesRef.current = [];
      
      saveProperty(property.id, property.sourceUrl, {
        property,
        schools: null,
        aiAnalysis: null,
        aiModel: null,
        commuteTimes: commuteTimesRef.current,
      }).then(() => {
        getSavedProperties().then(setSavedProperties);
      });

      // 2. Update UI
      setResult({
        property: data.data.property,
        postcode: data.data.postcode,
      });
    } catch {
      setError('Network error - please try again');
    } finally {
      setLoading(false);
    }
  }, [mergeLogs]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submitUrl(url);
  };

  // Feature-detect clipboard API
  useEffect(() => {
    setClipboardAvailable(!!navigator.clipboard?.readText);
  }, []);

  // Read ?url= or ?text= query param on mount and auto-submit
  // (Web Share Target may pass the link in either field)
  useEffect(() => {
    const paramUrl = searchParams.get('url');
    const paramText = searchParams.get('text') || '';
    // Try ?url= first, then look for a Rightmove URL inside ?text=
    const rightmoveUrl = paramUrl && paramUrl.includes('rightmove.co.uk')
      ? paramUrl
      : paramText.match(/https?:\/\/[^\s]*rightmove\.co\.uk[^\s]*/)?.[0] || null;
    if (rightmoveUrl) {
      setUrl(rightmoveUrl);
      submitUrl(rightmoveUrl);
    }
  }, [searchParams, submitUrl]);

  // Fetch school data when property result changes
  useEffect(() => {
    if (!result) {
      setSchoolsData(null);
      setSchoolsError(null);
      return;
    }

    // Skip re-fetching if loaded from a saved property
    if (loadedFromSaveRef.current) {
      loadedFromSaveRef.current = false;
      return;
    }

    // Build the best possible full address for the schools lookup:
    // 1. Prepend door number if available and not already in displayAddress
    // 2. Replace trailing outward code (e.g. "EN5") with full postcode (e.g. "EN5 1HH")
    let addr = result.property.address.displayAddress;
    const doorNumber = result.property.address.doorNumber;
    const postcode = result.property.address.postcode;

    // Prepend door number if we have it and it's not already in the address
    if (doorNumber && !addr.startsWith(doorNumber)) {
      addr = `${doorNumber} ${addr}`;
    }

    // Ensure full postcode is present (replace outward-only code to avoid "EN5, EN5 1HH")
    if (postcode && !addr.includes(postcode)) {
      const outcode = postcode.split(' ')[0];
      if (outcode && addr.includes(outcode)) {
        // Replace trailing outcode with full postcode
        const regex = new RegExp(`,?\\s*${outcode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`);
        addr = addr.replace(regex, `, ${postcode}`);
      } else {
        addr = `${addr}, ${postcode}`;
      }
    }

    const fullAddress = addr;

    if (!fullAddress || fullAddress.length < 3) return;

    const propertyId = result.property.id;
    const propertyUrl = result.property.sourceUrl;
    const initialProperty = result.property;

    setSchoolsLoading(true);
    setSchoolsError(null);
    setSchoolsData(null);

    const coords = result.property.coordinates;
    let schoolsUrl = `/api/schools?address=${encodeURIComponent(fullAddress)}`;
    if (coords) {
      schoolsUrl += `&lat=${coords.latitude}&lng=${coords.longitude}`;
    }

    fetch(schoolsUrl)
      .then(res => res.json())
      .then((data: AttendedSchoolsResult & { logs?: { id: string; timestamp: string; level: string; message: string; source?: string }[] }) => {
        if (data.logs) mergeLogs(data.logs);
        if (data.success) {
          // 1. Save results to DB for this specific property
          saveProperty(propertyId, propertyUrl, {
            property: initialProperty,
            schools: data,
            aiAnalysis: aiAnalysis,
            aiModel: aiModel,
            commuteTimes: commuteTimesRef.current,
          }).then(() => {
            getSavedProperties().then(setSavedProperties);
          });

          // 2. Update UI ONLY if active
          if (activePropertyIdRef.current === propertyId) {
            setSchoolsData(data);
          }
        } else {
          if (activePropertyIdRef.current === propertyId) {
            setSchoolsError(data.error || 'Failed to fetch school data');
          }
        }
      })
      .catch(() => {
        if (activePropertyIdRef.current === propertyId) {
          setSchoolsError('Network error fetching school data');
        }
      })
      .finally(() => {
        if (activePropertyIdRef.current === propertyId) {
          setSchoolsLoading(false);
        }
      });

    // Fetch stations and commute in parallel (if we have coordinates)
    if (coords) {
      const propertyId = result.property.id;
      const propertyUrl = result.property.sourceUrl;
      const initialProperty = result.property;

      // Stations
      setStationsLoading(true);
      fetch(`/api/stations?lat=${coords.latitude}&lng=${coords.longitude}`)
        .then(res => res.json())
        .then(data => {
          if (data.logs) mergeLogs(data.logs);
          if (data.success) {
            // Update UI state ONLY if this is still the active property
            if (activePropertyIdRef.current === propertyId) {
              setResult(prev => {
                if (!prev || prev.property?.id !== propertyId) return prev;
                const merged = {
                  ...prev.property,
                  nearestStations: data.nearestStations,
                  nearestTubeStations: data.nearestTubeStations,
                };
                // Save merged data to DB
                saveProperty(propertyId, propertyUrl, {
                  property: merged,
                  schools: schoolsData,
                  aiAnalysis: aiAnalysis,
                  aiModel: aiModel,
                  commuteTimes: commuteTimesRef.current,
                }).then(() => {
                  getSavedProperties().then(setSavedProperties);
                });
                return { ...prev, property: merged };
              });
            }
          }
        })
        .catch(() => {})
        .finally(() => {
          if (activePropertyIdRef.current === propertyId) {
            setStationsLoading(false);
          }
        });

      // Commute times
      setCommuteLoading(true);
      fetch(`/api/commute?lat=${coords.latitude}&lng=${coords.longitude}`)
        .then(res => res.json())
        .then(data => {
          if (data.logs) mergeLogs(data.logs);
          if (data.success) {
            // Update ref with latest commute times for other parallel saves
            commuteTimesRef.current = data.commuteTimes || [];

            // Update UI ONLY if active
            if (activePropertyIdRef.current === propertyId) {
              setResult(prev => {
                if (!prev || prev.property?.id !== propertyId) return prev;
                const merged = {
                  ...prev.property,
                  commuteTimes: data.commuteTimes,
                };
                // Save merged data to DB
                saveProperty(propertyId, propertyUrl, {
                  property: merged,
                  schools: schoolsData,
                  aiAnalysis: aiAnalysis,
                  aiModel: aiModel,
                  commuteTimes: commuteTimesRef.current,
                }).then(() => {
                  getSavedProperties().then(setSavedProperties);
                });
                return { ...prev, property: merged };
              });
            }
          }
        })
        .catch(() => {})
        .finally(() => {
          if (activePropertyIdRef.current === propertyId) {
            setCommuteLoading(false);
          }
        });
    }
  }, [result?.property?.id]);

  // Fetch AI analyses when property + schools data are ready (or schools failed)
  useEffect(() => {
    if (!result || schoolsLoading) return;
    if (!schoolsData && !schoolsError) return;

    const combinedJson = {
      ...result.property,
      ...(schoolsData ? {
        schoolsAttended: {
          areaName: schoolsData.areaName,
          primarySchools: schoolsData.primarySchools,
          secondarySchools: schoolsData.secondarySchools,
        },
      } : {}),
    };

    const propertyId = result.property.id;
    const propertyUrl = result.property.sourceUrl;
    const initialProperty = result.property;
    const initialSchools = schoolsData;

    // Claude Opus report
    setAiLoading(true);
    setAiError(null);
    setAiAnalysis(null);
    setAiModel(null);

    fetch('/api/ai-analysis', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ propertyJson: combinedJson, model: 'anthropic/claude-opus-4.6' }),
    })
      .then(res => res.json())
      .then(data => {
        if (data.logs) mergeLogs(data.logs);
        if (data.success) {
          // 1. Save AI analysis results for this property
          saveProperty(propertyId, propertyUrl, {
            property: initialProperty,
            schools: initialSchools,
            aiAnalysis: data.analysis,
            aiModel: data.model || null,
            commuteTimes: commuteTimesRef.current,
          }).then(() => {
            getSavedProperties().then(setSavedProperties);
          });

          // 2. Update UI state ONLY if active
          if (activePropertyIdRef.current === propertyId) {
            setAiAnalysis(data.analysis);
            setAiModel(data.model || null);
          }
        } else {
          if (activePropertyIdRef.current === propertyId) {
            setAiError(data.error || 'Failed to generate AI analysis');
          }
        }
      })
      .catch(() => {
        if (activePropertyIdRef.current === propertyId) {
          setAiError('Network error fetching AI analysis');
        }
      })
      .finally(() => {
        if (activePropertyIdRef.current === propertyId) {
          setAiLoading(false);
        }
      });
  }, [result, schoolsData, schoolsError, schoolsLoading]);

  // Clear input and refocus
  const handleClear = () => {
    setUrl('');
    inputRef.current?.focus();
  };

  // Paste from clipboard button
  const handlePasteButton = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setUrl(text);
      if (text.includes('rightmove.co.uk')) {
        submitUrl(text);
      }
    } catch {
      // Permission denied or API unavailable — ignore
    }
  };

  // Native paste event on input — auto-submit if Rightmove URL
  const handleNativePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData('text');
    if (text.includes('rightmove.co.uk')) {
      e.preventDefault();
      setUrl(text);
      submitUrl(text);
    }
  };

  const copyJson = async () => {
    if (result) {
      const fullData = {
        ...result.property,
        ...(schoolsData ? { schoolsAttended: { areaName: schoolsData.areaName, primarySchools: schoolsData.primarySchools, secondarySchools: schoolsData.secondarySchools } } : {}),
      };
      await navigator.clipboard.writeText(JSON.stringify(fullData, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 py-4 sm:py-8 px-4 transition-colors duration-300">
      <div className="max-w-4xl mx-auto">
        <header className="mb-6 sm:mb-8">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-slate-900 dark:text-slate-100 font-[family-name:var(--font-playfair)] truncate">
                UK Property Analyzer
              </h1>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {view === 'analysis' && (
                <>
                  <button
                    onClick={handleBackToDashboard}
                    className="p-2.5 rounded-lg bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors"
                    title="Back to saved properties"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                  {result && (
                    <button
                      onClick={handleRefresh}
                      disabled={isRefreshing}
                      className="p-2.5 rounded-lg bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors"
                      title="Refresh analysis"
                    >
                      <RefreshCw className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
                    </button>
                  )}
                </>
              )}
              <ThemeToggle />
            </div>
          </div>
          <p className="text-slate-600 dark:text-slate-400 mt-2 text-sm sm:text-base">
            {view === 'dashboard'
              ? `${savedProperties.length} saved propert${savedProperties.length === 1 ? 'y' : 'ies'}`
              : 'Paste a Rightmove URL to extract and analyze property data'}
          </p>
        </header>

        {/* Dashboard View */}
        {view === 'dashboard' && (
          <div className="space-y-6">
            <button
              onClick={handleNewAnalysis}
              className="w-full p-4 bg-white dark:bg-slate-900 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl hover:border-teal-500 dark:hover:border-teal-500 hover:bg-teal-50 dark:hover:bg-teal-900/10 transition-all group"
            >
              <div className="flex items-center justify-center gap-3 text-slate-600 dark:text-slate-400 group-hover:text-teal-600 dark:group-hover:text-teal-400">
                <Plus className="w-6 h-6" />
                <span className="font-medium">Analyze New Property</span>
              </div>
            </button>
            {savedProperties.length > 0 ? (
              <div className="space-y-3">
                {savedProperties.map((savedProp) => (
                  <PropertyCard
                    key={savedProp.id}
                    property={savedProp}
                    onClick={() => handlePropertyClick(savedProp)}
                    onDelete={(e) => handleDeleteProperty(e, savedProp)}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <Home className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
                <p className="text-slate-500 dark:text-slate-400 mb-2">No saved properties yet</p>
                <p className="text-slate-400 dark:text-slate-500 text-sm">Start by analyzing a property above</p>
              </div>
            )}
          </div>
        )}

        {/* Analysis View */}
        {view === 'analysis' && (
          <div>
        {/* Search Form */}
        <form onSubmit={handleSubmit} className="mb-8">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <input
                ref={inputRef}
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onPaste={handleNativePaste}
                placeholder="Paste a Rightmove link..."
                className="w-full pl-4 pr-20 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent text-slate-900 dark:text-slate-100 placeholder:text-slate-400 shadow-sm"
                disabled={loading}
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                {url ? (
                  <button
                    type="button"
                    onClick={handleClear}
                    className="p-2 text-slate-500 hover:text-slate-700 dark:text-slate-300 dark:hover:text-slate-100 bg-slate-100 dark:bg-slate-800 rounded-full transition-colors mr-1 shadow-sm"
                    aria-label="Clear"
                  >
                    <X className="w-4 h-4" />
                  </button>
                ) : clipboardAvailable ? (
                  <button
                    type="button"
                    onClick={handlePasteButton}
                    className="p-2 text-slate-500 hover:text-slate-700 dark:text-slate-300 dark:hover:text-slate-100 bg-slate-100 dark:bg-slate-800 rounded-full transition-colors mr-1 shadow-sm"
                    aria-label="Paste from clipboard"
                  >
                    <Clipboard className="w-4 h-4" />
                  </button>
                ) : null}
              </div>
            </div>
            <button
              type="submit"
              disabled={loading || !url}
              className="px-6 py-3 bg-slate-800 text-white font-medium rounded-xl hover:bg-slate-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Analyzing...
                </>
              ) : (
                'Analyze'
              )}
            </button>
          </div>
        </form>

        {/* Error */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl shadow-sm">
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {/* Results */}
        {result && (
          <div className="space-y-6">
            {/* Property Summary Card */}
            <div className="p-6 bg-white dark:bg-slate-900 rounded-xl shadow-md">
              <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-4">Property Summary</h2>

              <div className="flex flex-col lg:flex-row gap-6">
              <div className="flex-1">
              {/* Full Address - Prominent at top */}
              {result.property.address.displayAddress && (
                <div className="mb-4 pb-4 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-start gap-3">
                    <MapPin className="w-5 h-5 text-slate-500 dark:text-slate-400 mt-0.5 flex-shrink-0" />
                    <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                      {result.property.address.doorNumber && (
                        <span>{result.property.address.doorNumber} </span>
                      )}
                      {(() => {
                        const addr = result.property.address.displayAddress;
                        const postcode = result.property.address.postcode;
                        if (!postcode) return addr;
                        // If display address already contains the full postcode, show as-is
                        if (addr.includes(postcode)) return addr;
                        // If display address contains just the outcode (e.g. "EN5"), replace it with full postcode
                        const outcode = postcode.split(' ')[0];
                        if (outcode && addr.includes(outcode)) {
                          // Replace trailing outcode (with optional comma/space before it) with full postcode
                          const regex = new RegExp(`,?\\s*${outcode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`);
                          return addr.replace(regex, `, ${postcode}`);
                        }
                        // Postcode not present at all — append it
                        return `${addr}, ${postcode}`;
                      })()}
                    </p>
                  </div>
                </div>
              )}

              {/* Stats Grid - 4 columns on desktop, 2 on mobile */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {/* Row 1 */}
                <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                  <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 mb-1">
                    <span className="text-lg">£</span>
                    <span className="text-sm">Price</span>
                  </div>
                  <p className="text-xl font-bold text-slate-900 dark:text-slate-100">
                    {result.property.price
                      ? `${result.property.price.toLocaleString()}`
                      : 'N/A'}
                    {result.property.listingType === 'rent' && (
                      <span className="text-sm font-normal text-slate-500 dark:text-slate-400"> pcm</span>
                    )}
                  </p>
                </div>

                <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                  <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 mb-1">
                    <Bed className="w-4 h-4" />
                    <span className="text-sm">Bedrooms</span>
                  </div>
                  <p className="text-xl font-bold text-slate-900 dark:text-slate-100">
                    {result.property.bedrooms ?? 'N/A'}
                  </p>
                </div>

                <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                  <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 mb-1">
                    <Bath className="w-4 h-4" />
                    <span className="text-sm">Bathrooms</span>
                  </div>
                  <p className="text-xl font-bold text-slate-900 dark:text-slate-100">
                    {result.property.bathrooms ?? 'N/A'}
                  </p>
                </div>

                {/* Row 2 */}
                <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                  <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 mb-1">
                    <Home className="w-4 h-4" />
                    <span className="text-sm">Type</span>
                  </div>
                  <p className="text-xl font-bold text-slate-900 dark:text-slate-100 capitalize">
                    {result.property.propertyType}
                  </p>
                </div>

                <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                  <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 mb-1">
                    <Ruler className="w-4 h-4" />
                    <span className="text-sm">Size</span>
                  </div>
                  <p className="text-xl font-bold text-slate-900 dark:text-slate-100">
                    {result.property.squareFootage
                      ? `${result.property.squareFootage.toLocaleString()} sqft`
                      : 'N/A'}
                  </p>
                </div>

                <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                  <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 mb-1">
                    <span className="text-lg">£</span>
                    <span className="text-sm">£ per sqft</span>
                  </div>
                  <p className="text-xl font-bold text-slate-900 dark:text-slate-100">
                    {result.property.pricePerSqFt
                      ? `£${result.property.pricePerSqFt.toLocaleString()}`
                      : 'N/A'}
                  </p>
                </div>

                <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                  <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 mb-1">
                    <Zap className="w-4 h-4" />
                    <span className="text-sm">EPC</span>
                  </div>
                  <p className="text-xl font-bold text-slate-900 dark:text-slate-100">
                    {result.property.epc?.currentRating || 'N/A'}
                  </p>
                </div>
              </div>

              </div>

              {/* Right side - Property Image */}
              {result.property.images && result.property.images.length > 0 && (
                <div className="lg:w-80 flex-shrink-0">
                  <a 
                    href={result.property.sourceUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="block relative w-full h-64 lg:h-full min-h-[300px] rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800 group"
                    title="View on Rightmove"
                  >
                    <img
                      src={result.property.images[0]}
                      alt="Property"
                      className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300" />
                    {result.property.images.length > 1 && (
                      <div className="absolute bottom-3 right-3 px-2 py-1 bg-black/60 text-white text-xs rounded-full">
                        +{result.property.images.length - 1} more
                      </div>
                    )}
                  </a>
                </div>
              )}
              </div>

              {/* EPC Graph Image */}
              {result.property.epc?.graphUrl && (
                <div className="pt-4 mt-4 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 mb-3">
                    <Zap className="w-4 h-4" />
                    <span className="text-sm font-medium">EPC Certificate</span>
                  </div>
                  <img
                    src={result.property.epc.graphUrl}
                    alt="EPC Rating Graph"
                    className="max-w-full h-auto rounded-lg border border-slate-200 dark:border-slate-700"
                  />
                </div>
              )}

              {/* Stations Loading */}
              {stationsLoading && (
                <div className="pt-4 mt-4 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-3 py-4 text-slate-400">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-sm">Finding nearby stations...</span>
                  </div>
                </div>
              )}

              {/* Nearest Rail Stations */}
              {!stationsLoading && result.property.nearestStations && result.property.nearestStations.length > 0 && (
                <div className="pt-4 mt-4 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 mb-3">
                    <Train className="w-4 h-4" />
                    <span className="text-sm font-medium">Nearest Rail Stations</span>
                  </div>
                  <div className="space-y-2">
                    {result.property.nearestStations.map((station, index) => (
                      <div
                        key={station.name}
                        className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-lg"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="w-6 h-6 flex items-center justify-center bg-blue-100 text-blue-700 rounded-full text-sm font-medium flex-shrink-0">
                            {index + 1}
                          </span>
                          <div className="min-w-0">
                            <span className="font-medium text-slate-900 dark:text-slate-100 block truncate">{station.name}</span>
                            {station.operators && station.operators.length > 0 && (
                              <span className="inline-block mt-1 px-2 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs rounded-full font-medium">
                                {station.operators.join(', ')}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0 ml-3">
                          {station.walkingTime ? (
                            <>
                              <span className="text-slate-900 dark:text-slate-100 font-medium block">
                                {station.walkingTime} min walk
                              </span>
                              <span className="text-xs text-slate-400">
                                {station.walkingDistance
                                  ? station.walkingDistance >= 1000
                                    ? `${(station.walkingDistance / 1000).toFixed(1)} km`
                                    : `${station.walkingDistance}m`
                                  : ''}
                              </span>
                            </>
                          ) : (
                            <span className="text-slate-400 text-sm">—</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Nearest Tube Stations */}
              {!stationsLoading && result.property.nearestTubeStations && result.property.nearestTubeStations.length > 0 && (
                <div className="pt-4 mt-4 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 mb-3">
                    <CircleDot className="w-4 h-4" />
                    <span className="text-sm font-medium">Nearest Tube Stations</span>
                  </div>
                  <div className="space-y-2">
                    {result.property.nearestTubeStations.map((station, index) => (
                      <div
                        key={station.name}
                        className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-lg"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="w-6 h-6 flex items-center justify-center bg-blue-100 text-blue-700 rounded-full text-sm font-medium flex-shrink-0">
                            {index + 1}
                          </span>
                          <div className="min-w-0">
                            <span className="font-medium text-slate-900 dark:text-slate-100 block truncate">{station.name}</span>
                            {station.lines && station.lines.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {station.lines.slice(0, 4).map((line) => {
                                  const style = getLineBadgeStyle(line);
                                  return (
                                    <span
                                      key={line}
                                      className={`px-1.5 py-0.5 text-[10px] rounded font-medium ${style.text}`}
                                      style={{ backgroundColor: style.bg }}
                                    >
                                      {line}
                                    </span>
                                  );
                                })}
                                {station.lines.length > 4 && (
                                  <span className="text-xs text-slate-500 dark:text-slate-400">+{station.lines.length - 4}</span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0 ml-3">
                          {station.walkingTime ? (
                            <>
                              <span className="text-slate-900 dark:text-slate-100 font-medium block">
                                {station.walkingTime} min walk
                              </span>
                              <span className="text-xs text-slate-400">
                                {station.walkingDistance
                                  ? station.walkingDistance >= 1000
                                    ? `${(station.walkingDistance / 1000).toFixed(1)} km`
                                    : `${station.walkingDistance}m`
                                  : ''}
                              </span>
                            </>
                          ) : (
                            <span className="text-slate-400 text-sm">—</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Commute Times Section */}
            {(commuteLoading || result.property.coordinates) && (
              <div className="p-6 bg-white dark:bg-slate-900 rounded-xl shadow-md">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-5 h-5 text-slate-500 dark:text-slate-400" />
                    <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200">Commute Times</h2>
                  </div>
                  {!commuteLoading && result.property.commuteTimes && result.property.commuteTimes.length > 0 && (
                    <span className="text-xs text-slate-400">Wed 6:40 AM departure</span>
                  )}
                </div>

                {/* Loading state */}
                {commuteLoading && (
                  <div className="flex items-center justify-center gap-3 py-8 text-slate-400">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span className="text-sm">Calculating commute times...</span>
                  </div>
                )}

                {/* Commute data */}
                {!commuteLoading && result.property.commuteTimes && result.property.commuteTimes.length > 0 && (
                  <div className="space-y-3">
                    {result.property.commuteTimes.map((commute) => (
                      <div key={commute.destination} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                            commute.destination === 'Bloomberg' ? 'bg-blue-100 text-blue-600' : 'bg-purple-100 text-purple-600'
                          }`}>
                            {commute.destination === 'Bloomberg' ? (
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                              </svg>
                            ) : (
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path d="M12 14l9-5-9-5-9 5 9 5z" />
                                <path d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
                              </svg>
                            )}
                          </div>
                          <div>
                            <span className="font-semibold text-slate-900 dark:text-slate-100">{commute.destination}</span>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className={`text-sm font-medium ${
                                commute.isFaster ? 'text-green-600' : commute.benchmarkDiffSeconds === 0 ? 'text-slate-500 dark:text-slate-400' : 'text-red-500'
                              }`}>
                                {commute.isFaster ? '✓' : commute.benchmarkDiffSeconds === 0 ? '=' : '↑'} {commute.durationText}
                              </span>
                              <span className="text-xs text-slate-400">arrive {commute.arrivalTime}</span>
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                            commute.isFaster 
                              ? 'bg-green-100 text-green-700' 
                              : commute.benchmarkDiffSeconds === 0 
                                ? 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                                : 'bg-red-100 text-red-700'
                          }`}>
                            {commute.benchmarkDiffText}
                          </span>
                          <div className="text-xs text-slate-400 mt-1">vs 20 Woodcroft</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Schools Attended Section */}
            {(schoolsLoading || schoolsData || schoolsError) && (
              <div className="p-6 bg-white dark:bg-slate-900 rounded-xl shadow-md">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <GraduationCap className="w-5 h-5 text-slate-500 dark:text-slate-400" />
                    <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200">Schools Attended</h2>
                  </div>
                  {schoolsData?.areaName && (
                    <span className="text-xs px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-full">
                      {schoolsData.areaName}
                    </span>
                  )}
                </div>

                {/* Loading state */}
                {schoolsLoading && (
                  <div className="flex items-center justify-center gap-3 py-8 text-slate-400">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span className="text-sm">Fetching school data...</span>
                  </div>
                )}

                {/* Error state */}
                {schoolsError && !schoolsLoading && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-red-600">{schoolsError}</p>
                  </div>
                )}

                {/* Schools data */}
                {schoolsData && !schoolsLoading && (
                  <div className="space-y-6">
                    {/* Secondary Schools */}
                    {schoolsData.secondarySchools.length > 0 && (() => {
                      const sorted = schoolsData.secondarySchools
                        .filter(s => s.percentage >= 1)
                        .sort((a, b) => b.percentage - a.percentage);
                      const top5 = sorted.slice(0, 5);
                      const rest = sorted.slice(5);
                      return (
                      <div>
                        <button
                          onClick={() => setSecondaryExpanded(!secondaryExpanded)}
                          className="flex items-center gap-2 text-slate-500 dark:text-slate-400 mb-3 hover:text-slate-700 dark:text-slate-300 transition-colors"
                        >
                          {secondaryExpanded ? (
                            <ChevronUp className="w-4 h-4" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                          <span className="text-sm font-medium">Secondary Schools</span>
                          <span className="text-xs text-slate-400">({sorted.length})</span>
                        </button>
                        {secondaryExpanded && (
                        <div className="space-y-2">
                          {top5.map((school) => (
                            <div
                              key={school.urn}
                              className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-lg"
                            >
                              <div className="flex items-center gap-3 min-w-0 flex-1">
                                <span className="w-12 text-right font-bold text-slate-900 dark:text-slate-100 flex-shrink-0">
                                  {school.percentage}%
                                </span>
                                <div className="min-w-0 flex-1">
                                  <a href={getSchoolUrl(school.urn)} target="_blank" rel="noopener noreferrer" className="font-medium text-slate-900 dark:text-slate-100 hover:text-teal-700 hover:underline truncate block">
                                    {school.name}
                                  </a>
                                  {(school.walkingTime || school.crowFliesDistance !== undefined) && (
                                    <span className="text-xs text-slate-400 block">
                                      {school.walkingTime ? (
                                        <>
                                          {school.walkingTime} min walk
                                          {school.walkingDistance ? ` · ${formatDistanceMiles(school.walkingDistance / 1000)}` : ''}
                                          {school.crowFliesDistance !== undefined && (
                                            <> ({formatDistanceMiles(school.crowFliesDistance)} as the crow flies)</>
                                          )}
                                        </>
                                      ) : school.crowFliesDistance !== undefined ? (
                                        <>{formatDistanceMiles(school.crowFliesDistance)} as the crow flies</>
                                      ) : null}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getOfstedColor(school.ofstedRating)}`}>
                                  {getOfstedShort(school.ofstedRating)}
                                </span>
                                {school.isGrammar && (
                                  <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-teal-100 text-teal-700">
                                    Grammar
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                          {rest.length > 0 && (
                            <>
                              <button
                                onClick={() => setSecondaryMoreExpanded(!secondaryMoreExpanded)}
                                className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 dark:text-slate-400 transition-colors px-3 py-1"
                              >
                                {secondaryMoreExpanded ? (
                                  <ChevronUp className="w-3 h-3" />
                                ) : (
                                  <ChevronDown className="w-3 h-3" />
                                )}
                                {secondaryMoreExpanded ? 'Less' : `More (${rest.length})`}
                              </button>
                              {secondaryMoreExpanded && rest.map((school) => (
                                <div
                                  key={school.urn}
                                  className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-lg"
                                >
                                  <div className="flex items-center gap-3 min-w-0 flex-1">
                                    <span className="w-12 text-right font-bold text-slate-900 dark:text-slate-100 flex-shrink-0">
                                      {school.percentage}%
                                    </span>
                                    <div className="min-w-0 flex-1">
                                      <a href={getSchoolUrl(school.urn)} target="_blank" rel="noopener noreferrer" className="font-medium text-slate-900 dark:text-slate-100 hover:text-teal-700 hover:underline truncate block">
                                        {school.name}
                                      </a>
                                      {school.crowFliesDistance !== undefined && (
                                        <span className="text-xs text-slate-400 block">
                                          {formatDistanceMiles(school.crowFliesDistance)} as the crow flies
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getOfstedColor(school.ofstedRating)}`}>
                                      {getOfstedShort(school.ofstedRating)}
                                    </span>
                                    {school.isGrammar && (
                                      <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-teal-100 text-teal-700">
                                        Grammar
                                      </span>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </>
                          )}
                        </div>
                        )}
                      </div>
                      );
                    })()}

                    {/* Primary Schools */}
                    {schoolsData.primarySchools.length > 0 && (() => {
                      const sorted = schoolsData.primarySchools
                        .filter(s => s.percentage >= 1)
                        .sort((a, b) => b.percentage - a.percentage);
                      const top5 = sorted.slice(0, 5);
                      const rest = sorted.slice(5);
                      return (
                      <div className={schoolsData.secondarySchools.length > 0 ? 'pt-2 border-t border-slate-100 dark:border-slate-800' : ''}>
                        <button
                          onClick={() => setPrimaryExpanded(!primaryExpanded)}
                          className="flex items-center gap-2 text-slate-500 dark:text-slate-400 mb-3 hover:text-slate-700 dark:text-slate-300 transition-colors"
                        >
                          {primaryExpanded ? (
                            <ChevronUp className="w-4 h-4" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                          <span className="text-sm font-medium">Primary Schools</span>
                          <span className="text-xs text-slate-400">({sorted.length})</span>
                        </button>
                        {primaryExpanded && (
                        <div className="space-y-2">
                          {top5.map((school) => (
                            <div
                              key={school.urn}
                              className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-lg"
                            >
                              <div className="flex items-center gap-3 min-w-0 flex-1">
                                <span className="w-12 text-right font-bold text-slate-900 dark:text-slate-100 flex-shrink-0">
                                  {school.percentage}%
                                </span>
                                <div className="min-w-0 flex-1">
                                  <a href={getSchoolUrl(school.urn)} target="_blank" rel="noopener noreferrer" className="font-medium text-slate-900 dark:text-slate-100 hover:text-teal-700 hover:underline truncate block">
                                    {school.name}
                                  </a>
                                  {(school.walkingTime || school.crowFliesDistance !== undefined) && (
                                    <span className="text-xs text-slate-400 block">
                                      {school.walkingTime ? (
                                        <>
                                          {school.walkingTime} min walk
                                          {school.walkingDistance ? ` · ${formatDistanceMiles(school.walkingDistance / 1000)}` : ''}
                                          {school.crowFliesDistance !== undefined && (
                                            <> ({formatDistanceMiles(school.crowFliesDistance)} as the crow flies)</>
                                          )}
                                        </>
                                      ) : school.crowFliesDistance !== undefined ? (
                                        <>{formatDistanceMiles(school.crowFliesDistance)} as the crow flies</>
                                      ) : null}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getOfstedColor(school.ofstedRating)}`}>
                                  {getOfstedShort(school.ofstedRating)}
                                </span>
                                {school.isGrammar && (
                                  <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-teal-100 text-teal-700">
                                    Grammar
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                          {rest.length > 0 && (
                            <>
                              <button
                                onClick={() => setPrimaryMoreExpanded(!primaryMoreExpanded)}
                                className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 dark:text-slate-400 transition-colors px-3 py-1"
                              >
                                {primaryMoreExpanded ? (
                                  <ChevronUp className="w-3 h-3" />
                                ) : (
                                  <ChevronDown className="w-3 h-3" />
                                )}
                                {primaryMoreExpanded ? 'Less' : `More (${rest.length})`}
                              </button>
                              {primaryMoreExpanded && rest.map((school) => (
                                <div
                                  key={school.urn}
                                  className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-lg"
                                >
                                  <div className="flex items-center gap-3 min-w-0 flex-1">
                                    <span className="w-12 text-right font-bold text-slate-900 dark:text-slate-100 flex-shrink-0">
                                      {school.percentage}%
                                    </span>
                                    <div className="min-w-0 flex-1">
                                      <a href={getSchoolUrl(school.urn)} target="_blank" rel="noopener noreferrer" className="font-medium text-slate-900 dark:text-slate-100 hover:text-teal-700 hover:underline truncate block">
                                        {school.name}
                                      </a>
                                      {school.crowFliesDistance !== undefined && (
                                        <span className="text-xs text-slate-400 block">
                                          {formatDistanceMiles(school.crowFliesDistance)} as the crow flies
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getOfstedColor(school.ofstedRating)}`}>
                                      {getOfstedShort(school.ofstedRating)}
                                    </span>
                                    {school.isGrammar && (
                                      <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-teal-100 text-teal-700">
                                        Grammar
                                      </span>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </>
                          )}
                        </div>
                        )}
                      </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            )}

            {/* AI Summary Report */}
            <div className="p-6 bg-white dark:bg-slate-900 rounded-xl shadow-md">
              <div className="flex items-center gap-2 mb-4">
                <Sparkles className="w-5 h-5 text-slate-500 dark:text-slate-400" />
                <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200">Summary Report</h2>
                <span className="text-xs text-slate-400 font-normal">Claude Opus</span>
              </div>

              {!aiLoading && !aiAnalysis && !aiError && (
                <div className="flex items-center justify-center gap-3 py-8 text-slate-400">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span className="text-sm">Waiting for school data before analysing...</span>
                </div>
              )}

              {aiLoading && (
                <div className="flex items-center justify-center gap-3 py-8 text-slate-400">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span className="text-sm">Generating AI analysis...</span>
                </div>
              )}

              {aiError && !aiLoading && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-600">{aiError}</p>
                </div>
              )}

              {aiAnalysis && !aiLoading && (
                <div className="prose prose-sm prose-slate dark:prose-invert max-w-none">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{aiAnalysis}</ReactMarkdown>
                </div>
              )}
            </div>

            {/* Help Section - Data Sources */}
            <div className="bg-slate-100 dark:bg-slate-800 rounded-xl shadow-md overflow-hidden">
              <button
                onClick={() => setHelpExpanded(!helpExpanded)}
                className="w-full px-6 py-4 flex items-center gap-2 font-medium text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:text-slate-100 transition-colors"
              >
                {helpExpanded ? (
                  <ChevronUp className="w-5 h-5" />
                ) : (
                  <ChevronDown className="w-5 h-5" />
                )}
                <HelpCircle className="w-5 h-5" />
                Help
              </button>

              {helpExpanded && (
                <div className="px-6 pb-6 text-slate-700 dark:text-slate-300 space-y-4">
                  <p className="text-sm">
                    This tool extracts and enriches property data from multiple sources to give you a comprehensive view. Here&apos;s where each piece of information comes from:
                  </p>

                  <div className="space-y-3 text-sm">
                    <div className="p-3 bg-white dark:bg-slate-900 rounded-lg">
                      <p className="font-semibold text-slate-900 dark:text-slate-100">Address &amp; Door Number</p>
                      <p className="text-slate-600 dark:text-slate-400 mt-1">
                        The street address is extracted directly from the Rightmove listing. The door/building number is obtained using Google&apos;s reverse geocoding service, which looks up the precise address from the property&apos;s geographic coordinates. This may not always be available if Rightmove doesn&apos;t provide exact coordinates.
                      </p>
                    </div>

                    <div className="p-3 bg-white dark:bg-slate-900 rounded-lg">
                      <p className="font-semibold text-slate-900 dark:text-slate-100">Price</p>
                      <p className="text-slate-600 dark:text-slate-400 mt-1">
                        Extracted directly from the Rightmove listing page. For rental properties, this is the monthly price (pcm).
                      </p>
                    </div>

                    <div className="p-3 bg-white dark:bg-slate-900 rounded-lg">
                      <p className="font-semibold text-slate-900 dark:text-slate-100">Bedrooms, Bathrooms &amp; Property Type</p>
                      <p className="text-slate-600 dark:text-slate-400 mt-1">
                        Extracted from Rightmove&apos;s structured property data embedded in the listing page.
                      </p>
                    </div>

                    <div className="p-3 bg-white dark:bg-slate-900 rounded-lg">
                      <p className="font-semibold text-slate-900 dark:text-slate-100">Size (Square Footage)</p>
                      <p className="text-slate-600 dark:text-slate-400 mt-1">
                        Extracted from Rightmove when available. Not all listings include this information.
                      </p>
                    </div>

                    <div className="p-3 bg-white dark:bg-slate-900 rounded-lg">
                      <p className="font-semibold text-slate-900 dark:text-slate-100">Price Per Square Foot</p>
                      <p className="text-slate-600 dark:text-slate-400 mt-1">
                        <span className="italic">Calculated value.</span> This is computed by dividing the property price by the square footage, rounded to the nearest pound. Only shown when both price and size are available.
                      </p>
                    </div>

                    <div className="p-3 bg-white dark:bg-slate-900 rounded-lg">
                      <p className="font-semibold text-slate-900 dark:text-slate-100">EPC Rating &amp; Certificate</p>
                      <p className="text-slate-600 dark:text-slate-400 mt-1">
                        The Energy Performance Certificate rating and graph are extracted from Rightmove when the seller has provided this information.
                      </p>
                    </div>

                    <div className="p-3 bg-white dark:bg-slate-900 rounded-lg">
                      <p className="font-semibold text-slate-900 dark:text-slate-100">Nearest Rail Stations</p>
                      <p className="text-slate-600 dark:text-slate-400 mt-1">
                        The closest National Rail stations are found using the Google Places Nearby Search API, which searches for train stations near the property&apos;s coordinates sorted by distance. Walking times and distances are then calculated using the Google Maps Distance Matrix API with walking mode.
                      </p>
                    </div>

                    <div className="p-3 bg-white dark:bg-slate-900 rounded-lg">
                      <p className="font-semibold text-slate-900 dark:text-slate-100">Nearest Tube Stations</p>
                      <p className="text-slate-600 dark:text-slate-400 mt-1">
                        London Underground stations are also found using the Google Places Nearby Search API, searching for subway stations near the property&apos;s coordinates. Walking times and distances are calculated using the Google Maps Distance Matrix API. This section only appears for properties near London where tube stations are found within range.
                      </p>
                    </div>

                    <div className="p-3 bg-white dark:bg-slate-900 rounded-lg">
                      <p className="font-semibold text-slate-900 dark:text-slate-100">Postcode &amp; Coordinates</p>
                      <p className="text-slate-600 dark:text-slate-400 mt-1">
                        The postcode is extracted from Rightmove&apos;s property data. If geographic coordinates aren&apos;t available directly from Rightmove, they are looked up using the free Postcodes.io API based on the postcode.
                      </p>
                    </div>

                    <div className="p-3 bg-white dark:bg-slate-900 rounded-lg">
                      <p className="font-semibold text-slate-900 dark:text-slate-100">Schools Attended</p>
                      <p className="text-slate-600 dark:text-slate-400 mt-1">
                        Sourced from Locrating.com&apos;s neighbourhood analysis (LSOA data). Shows which primary and secondary schools pupils from the property&apos;s immediate neighbourhood actually attend. The area name (e.g. &quot;Barnet 005C&quot;) refers to the Lower Super Output Area (LSOA) — a small census area typically covering around 1,500 residents.
                      </p>
                      <p className="text-slate-600 dark:text-slate-400 mt-1">
                        <span className="font-medium text-slate-700 dark:text-slate-300">Understanding the percentages:</span> The percentage next to each school (e.g. &quot;20%&quot;) means that 20% of school-age children living in this neighbourhood attend that school. A higher percentage suggests the school is a popular choice locally — but it does not indicate how likely your child is to gain a place there. Schools with low percentages (below 1%) are filtered out. The percentages won&apos;t add up to 100% because children attend many different schools across the area.
                      </p>
                      <p className="text-slate-600 dark:text-slate-400 mt-1">
                        Ofsted ratings reflect the school&apos;s most recent inspection result. &quot;Grammar&quot; indicates a selective school that requires passing an entrance exam.
                      </p>
                      <p className="text-slate-600 dark:text-slate-400 mt-1">
                        The underlying data has been sourced from the National School Census and relates to pupils attending school in the academic year 2024/25. Crow-flies (straight-line) distances are calculated from the property to each school using the Haversine formula. Walking times and distances for the top 5 schools per phase (by attendance %) are calculated using the Google Maps Distance Matrix API.
                      </p>
                    </div>
                  </div>

                  <p className="text-xs text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-200">
                    Data accuracy depends on the information provided by Rightmove and the precision of third-party services. Always verify important details independently before making any decisions.
                  </p>
                </div>
              )}
            </div>

            {/* JSON Section - Collapsible */}
            <div className="bg-slate-800 rounded-xl shadow-md overflow-hidden">
              <div className="px-6 py-4 flex items-center justify-between text-white">
                <button
                  onClick={() => setJsonExpanded(!jsonExpanded)}
                  className="flex items-center gap-2 font-medium hover:text-slate-300 transition-colors"
                >
                  {jsonExpanded ? (
                    <ChevronUp className="w-5 h-5" />
                  ) : (
                    <ChevronDown className="w-5 h-5" />
                  )}
                  Full JSON Response
                </button>
                {jsonExpanded && (
                  <button
                    onClick={copyJson}
                    className="px-3 py-1 text-sm bg-slate-700 hover:bg-slate-600 rounded-md flex items-center gap-1 transition-colors"
                  >
                    {copied ? (
                      <>
                        <Check className="w-4 h-4 text-green-400" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        Copy
                      </>
                    )}
                  </button>
                )}
              </div>

              {jsonExpanded && (
                <div className="px-6 pb-6">
                  <pre className="text-sm text-teal-300 overflow-x-auto whitespace-pre-wrap font-mono">
                    {JSON.stringify({
                      ...result.property,
                      ...(schoolsData ? { schoolsAttended: { areaName: schoolsData.areaName, primarySchools: schoolsData.primarySchools, secondarySchools: schoolsData.secondarySchools } } : {}),
                    }, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            {/* Logs Section - Collapsible */}
            <div className="bg-slate-800 rounded-xl shadow-md overflow-hidden">
              <div
                onClick={() => setLogsExpanded(!logsExpanded)}
                className="w-full px-6 py-4 flex items-center justify-between text-white hover:bg-slate-700 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  {logsExpanded ? (
                    <ChevronUp className="w-5 h-5" />
                  ) : (
                    <ChevronDown className="w-5 h-5" />
                  )}
                  <FileText className="w-5 h-5" />
                  <span className="font-medium">Activity Log</span>
                  {logs.length > 0 && (
                    <span className="text-xs px-2 py-0.5 bg-slate-600 rounded-full">
                      {logs.length}
                    </span>
                  )}
                </div>
                {logsExpanded && logs.length > 0 && (
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      setLogs([]);
                    }}
                    className="px-3 py-1 text-sm bg-slate-700 hover:bg-slate-600 rounded-md flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                    Clear
                  </span>
                )}
              </div>

              {logsExpanded && (
                <div className="px-6 pb-6 max-h-96 overflow-y-auto">
                  {logs.length === 0 ? (
                    <p className="text-slate-400 text-sm py-4">No activity yet</p>
                  ) : (
                    <div className="space-y-2">
                      {logs.map((log) => (
                        <div
                          key={log.id}
                          className={`p-2 rounded text-sm font-mono ${
                            log.level === 'error' ? 'bg-red-900/30 text-red-300' :
                            log.level === 'warn' ? 'bg-yellow-900/30 text-yellow-300' :
                            'bg-slate-700/50 text-slate-300'
                          }`}
                        >
                          <span className="text-slate-500 dark:text-slate-400 text-xs">
                            {new Date(log.timestamp).toLocaleTimeString()}
                          </span>
                          {log.source && (
                            <span className="text-slate-500 dark:text-slate-400 text-xs ml-2">
                              [{log.source}]
                            </span>
                          )}
                          <span className="ml-2">{log.message}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
          </div>
        )}

        {/* Undo Toast */}
        {undoState.show && undoState.deletedProperty && (
          <UndoToast
            message="Property deleted"
            onUndo={handleUndo}
            onDismiss={handleDismissUndo}
          />
        )}
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <Suspense>
      <HomeContent />
    </Suspense>
  );
}
