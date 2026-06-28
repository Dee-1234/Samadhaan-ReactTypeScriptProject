import React from "react";
import { Pin, Info, MapPin, Layers, Map, Globe, Flame, Share2, Check, Plus, Minus } from "lucide-react";
import { CommunityReport } from "../types";

interface MapWidgetProps {
  reports: CommunityReport[];
  selectedLocation: { lat: number; lng: number; address: string } | null;
  onSelectLocation: (lat: number, lng: number, address: string) => void;
  activeReportId: string | null;
  onSelectReport: (reportId: string) => void;
  userLocation?: { lat: number; lng: number } | null;
  enableDistanceFilter?: boolean;
  maxDistance?: number;
}

// Fixed bounds representing "Maple Heights" community center (approximately center at 45.523, -122.676)
const MAP_LAT_MIN = 45.515;
const MAP_LAT_MAX = 45.530;
const MAP_LNG_MIN = -122.690;
const MAP_LNG_MAX = -122.660;

// Addresses database to make the mock reverse-geocoding look completely organic and genuine
const SAMPLE_STREETS = [
  "Elm Street", "Oak Avenue", "Pine Boulevard", "Maple Court", "Cedar Lane",
  "Washington Street", "Broadway Ave", "Jefferson Parkway", "Hilltop Road", "River Road"
];

function convertCoordsToPct(lat: number, lng: number) {
  const x = ((lng - MAP_LNG_MIN) / (MAP_LNG_MAX - MAP_LNG_MIN)) * 100;
  // SVG origin is top-left, so we invert latitude percentage
  const y = (1 - (lat - MAP_LAT_MIN) / (MAP_LAT_MAX - MAP_LAT_MIN)) * 100;
  return { x: Math.min(100, Math.max(0, x)), y: Math.min(100, Math.max(0, y)) };
}

function convertPctToCoords(x: number, y: number) {
  const lng = MAP_LNG_MIN + (x / 100) * (MAP_LNG_MAX - MAP_LNG_MIN);
  const lat = MAP_LAT_MIN + (1 - y / 100) * (MAP_LAT_MAX - MAP_LAT_MIN);
  return { lat: Number(lat.toFixed(6)), lng: Number(lng.toFixed(6)) };
}

export default function MapWidget({
  reports,
  selectedLocation,
  onSelectLocation,
  activeReportId,
  onSelectReport,
  userLocation,
  enableDistanceFilter = false,
  maxDistance = 5,
}: MapWidgetProps) {
  const mapRef = React.useRef<HTMLDivElement>(null);
  const [activeLayer, setActiveLayer] = React.useState<"street" | "satellite" | "heatmap">("street");
  const [copied, setCopied] = React.useState(false);

  // Zoom and Pan States for Interactive Map
  const [zoom, setZoom] = React.useState(1);
  const [pan, setPan] = React.useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = React.useState(false);
  const dragStartRef = React.useRef({ x: 0, y: 0 });
  const panStartRef = React.useRef({ x: 0, y: 0 });
  const dragDistanceRef = React.useRef(0);

  const handleShareLocation = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (userLocation) {
      const coordsStr = `${userLocation.lat.toFixed(6)}, ${userLocation.lng.toFixed(6)}`;
      navigator.clipboard.writeText(coordsStr);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleZoomIn = () => {
    setZoom((prev) => Math.min(3, prev + 0.5));
  };

  const handleZoomOut = () => {
    setZoom((prev) => {
      const nextZoom = Math.max(1, prev - 0.5);
      if (nextZoom === 1) {
        setPan({ x: 0, y: 0 });
      } else {
        setPan((currentPan) => {
          if (!mapRef.current) return currentPan;
          const rect = mapRef.current.getBoundingClientRect();
          const minX = rect.width * (1 - nextZoom);
          const minY = rect.height * (1 - nextZoom);
          return {
            x: Math.min(0, Math.max(minX, currentPan.x)),
            y: Math.min(0, Math.max(minY, currentPan.y)),
          };
        });
      }
      return nextZoom;
    });
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return; // Left click only
    if (!mapRef.current) return;
    
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    panStartRef.current = { ...pan };
    dragDistanceRef.current = 0;
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    dragDistanceRef.current = Math.sqrt(dx * dx + dy * dy);
    
    if (zoom > 1) {
      if (!mapRef.current) return;
      const rect = mapRef.current.getBoundingClientRect();
      const nextX = panStartRef.current.x + dx;
      const nextY = panStartRef.current.y + dy;
      
      const minX = rect.width * (1 - zoom);
      const minY = rect.height * (1 - zoom);
      
      setPan({
        x: Math.min(0, Math.max(minX, nextX)),
        y: Math.min(0, Math.max(minY, nextY)),
      });
    }
  };

  const handleMouseUpOrLeave = () => {
    setIsDragging(false);
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length !== 1) return;
    if (!mapRef.current) return;
    
    setIsDragging(true);
    const touch = e.touches[0];
    dragStartRef.current = { x: touch.clientX, y: touch.clientY };
    panStartRef.current = { ...pan };
    dragDistanceRef.current = 0;
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!isDragging || e.touches.length !== 1) return;
    
    const touch = e.touches[0];
    const dx = touch.clientX - dragStartRef.current.x;
    const dy = touch.clientY - dragStartRef.current.y;
    dragDistanceRef.current = Math.sqrt(dx * dx + dy * dy);
    
    if (zoom > 1) {
      if (!mapRef.current) return;
      const rect = mapRef.current.getBoundingClientRect();
      const nextX = panStartRef.current.x + dx;
      const nextY = panStartRef.current.y + dy;
      
      const minX = rect.width * (1 - zoom);
      const minY = rect.height * (1 - zoom);
      
      setPan({
        x: Math.min(0, Math.max(minX, nextX)),
        y: Math.min(0, Math.max(minY, nextY)),
      });
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  const handleMapClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (dragDistanceRef.current > 5) {
      return;
    }
    if (!mapRef.current) return;
    const rect = mapRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const xPct = ((clickX - pan.x) / zoom / rect.width) * 100;
    const yPct = ((clickY - pan.y) / zoom / rect.height) * 100;

    const clampedXPct = Math.min(100, Math.max(0, xPct));
    const clampedYPct = Math.min(100, Math.max(0, yPct));

    const coords = convertPctToCoords(clampedXPct, clampedYPct);
    const randomStreet = SAMPLE_STREETS[Math.floor(Math.random() * SAMPLE_STREETS.length)];
    const randomNum = Math.floor(Math.random() * 850) + 10;
    const resolvedAddress = `${randomNum} ${randomStreet}, Maple Heights`;

    onSelectLocation(coords.lat, coords.lng, resolvedAddress);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Resolved":
        return "bg-emerald-500 ring-emerald-100";
      case "In Progress":
        return "bg-blue-500 ring-blue-100";
      case "Investigating":
        return "bg-amber-500 ring-amber-100";
      default:
        return "bg-rose-500 ring-rose-100";
    }
  };

  const isDarkLayer = activeLayer === "satellite" || activeLayer === "heatmap";

  return (
    <div className="relative bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm h-[450px] flex flex-col transition-all">
      {/* Map Header */}
      <div className="absolute top-4 left-4 right-4 z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pointer-events-none">
        <div className={`px-4 py-2 rounded-2xl border transition-colors shadow-md flex items-center gap-2 pointer-events-auto ${
          isDarkLayer ? "bg-slate-900/95 border-slate-800 text-white" : "bg-white/95 border-slate-200 text-slate-800"
        }`}>
          <MapPin className={`w-5 h-5 ${isDarkLayer ? "text-indigo-400 animate-pulse" : "text-blue-600"}`} />
          <div>
            <h4 className="text-xs font-semibold font-display">Maple Heights Sector</h4>
            <p className={`text-[10px] ${isDarkLayer ? "text-slate-400" : "text-slate-500"}`}>
              Click anywhere to select coordinates
            </p>
          </div>
        </div>

        <div className="flex gap-2 pointer-events-auto self-start sm:self-auto">
          {activeLayer === "heatmap" ? (
            <>
              <div className="bg-slate-900/95 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-800 shadow-sm flex items-center gap-1.5 text-[10px] text-slate-300 font-sans">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-[0_0_8px_#f43f5e]" /> High Density
              </div>
              <div className="bg-slate-900/95 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-800 shadow-sm flex items-center gap-1.5 text-[10px] text-slate-300 font-sans">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-[0_0_8px_#f59e0b]" /> Med Density
              </div>
              <div className="bg-slate-900/95 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-800 shadow-sm flex items-center gap-1.5 text-[10px] text-slate-300 font-sans">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981]" /> Low / Resolved
              </div>
            </>
          ) : (
            <>
              <div className={`px-3 py-1.5 rounded-xl border shadow-sm flex items-center gap-1.5 text-[10px] transition-colors font-sans ${
                isDarkLayer ? "bg-slate-900/95 border-slate-800 text-slate-300" : "bg-white/95 border-slate-200 text-slate-600"
              }`}>
                <span className="w-2 h-2 rounded-full bg-rose-500" /> Reported
              </div>
              <div className={`px-3 py-1.5 rounded-xl border shadow-sm flex items-center gap-1.5 text-[10px] transition-colors font-sans ${
                isDarkLayer ? "bg-slate-900/95 border-slate-800 text-slate-300" : "bg-white/95 border-slate-200 text-slate-600"
              }`}>
                <span className="w-2 h-2 rounded-full bg-blue-500" /> Active Fix
              </div>
            </>
          )}
        </div>
      </div>

      {/* The Visual Neighborhood Interactive Map Area */}
      <div
        ref={mapRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUpOrLeave}
        onMouseLeave={handleMouseUpOrLeave}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={handleMapClick}
        className={`flex-1 relative overflow-hidden select-none transition-colors duration-500 ${
          zoom > 1 ? (isDragging ? "cursor-grabbing" : "cursor-grab") : "cursor-crosshair"
        } ${
          activeLayer === "street" 
            ? "bg-slate-50" 
            : activeLayer === "satellite" 
            ? "bg-[#0f172a]" 
            : "bg-[#030712]"
        }`}
      >
        {/* Zoomable & Pannable Wrapper */}
        <div
          className="w-full h-full absolute inset-0 select-none"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: "0 0",
            transition: isDragging ? "none" : "transform 0.15s ease-out",
            ...(activeLayer === "street" ? {
              backgroundImage: `radial-gradient(circle at 1px 1px, #cbd5e1 1px, transparent 0)`,
              backgroundSize: "24px 24px"
            } : {})
          }}
        >
        {/* Distance Filter Radius Circle */}
        {enableDistanceFilter && userLocation && (() => {
          const { x, y } = convertCoordsToPct(userLocation.lat, userLocation.lng);
          // 100% of width is approx 2.34 km. 100% of height is approx 1.667 km.
          const rxPct = (maxDistance / 2.34) * 100;
          const ryPct = (maxDistance / 1.667) * 100;
          return (
            <svg className="absolute inset-0 w-full h-full pointer-events-none z-0" xmlns="http://www.w3.org/2000/svg">
              <ellipse
                cx={`${x}%`}
                cy={`${y}%`}
                rx={`${rxPct}%`}
                ry={`${ryPct}%`}
                fill="rgba(59, 130, 246, 0.05)"
                stroke="rgba(59, 130, 246, 0.45)"
                strokeWidth="2"
                strokeDasharray="5 4"
                className="animate-pulse"
              />
            </svg>
          );
        })()}

        {/* Layer SVG Backgrounds */}
        {activeLayer === "street" && (
          <svg className="absolute inset-0 w-full h-full opacity-45 pointer-events-none" xmlns="http://www.w3.org/2000/svg">
            {/* Main Boulevards */}
            <line x1="10%" y1="0%" x2="10%" y2="100%" stroke="#e2e8f0" strokeWidth="12" strokeLinecap="round" />
            <line x1="50%" y1="0%" x2="50%" y2="100%" stroke="#e2e8f0" strokeWidth="16" strokeLinecap="round" />
            <line x1="85%" y1="0%" x2="85%" y2="100%" stroke="#e2e8f0" strokeWidth="12" strokeLinecap="round" />
            
            <line x1="0%" y1="20%" x2="100%" y2="20%" stroke="#e2e8f0" strokeWidth="12" strokeLinecap="round" />
            <line x1="0%" y1="60%" x2="100%" y2="60%" stroke="#e2e8f0" strokeWidth="16" strokeLinecap="round" />
            <line x1="0%" y1="85%" x2="100%" y2="85%" stroke="#e2e8f0" strokeWidth="10" strokeLinecap="round" />

            {/* Local secondary avenues */}
            <line x1="30%" y1="20%" x2="30%" y2="60%" stroke="#cbd5e1" strokeWidth="6" strokeDasharray="6 4" />
            <line x1="70%" y1="0%" x2="70%" y2="60%" stroke="#cbd5e1" strokeWidth="6" />
            <line x1="0%" y1="40%" x2="50%" y2="40%" stroke="#cbd5e1" strokeWidth="6" />

            {/* Central Park Area */}
            <rect x="58%" y="28%" width="20%" height="22%" fill="#bbf7d0" rx="16" opacity="0.4" />
            <text x="68%" y="40%" fill="#15803d" fontSize="12" fontFamily="Space Grotesk" fontWeight="bold" textAnchor="middle" opacity="0.8">Community Park</text>

            {/* Local River */}
            <path d="M -10,150 Q 200,250 400,100 T 1200,300" fill="none" stroke="#93c5fd" strokeWidth="18" opacity="0.3" />
          </svg>
        )}

        {activeLayer === "satellite" && (
          <svg className="absolute inset-0 w-full h-full opacity-70 pointer-events-none" xmlns="http://www.w3.org/2000/svg">
            {/* Satellite Grid pattern */}
            <defs>
              <pattern id="satelliteGrid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#334155" strokeWidth="1" opacity="0.15" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#satelliteGrid)" />

            {/* Dense Forest & Crop Patches */}
            <rect x="5%" y="45%" width="20%" height="30%" fill="#14532d" rx="12" opacity="0.45" />
            <rect x="65%" y="10%" width="25%" height="25%" fill="#166534" rx="16" opacity="0.4" />
            <rect x="58%" y="28%" width="20%" height="22%" fill="#15803d" rx="16" opacity="0.55" />
            <text x="68%" y="40%" fill="#86efac" fontSize="11" fontFamily="Space Grotesk" fontWeight="bold" textAnchor="middle" opacity="0.9">Community Park</text>

            {/* Industrial Blocks (grey rectangles) */}
            <rect x="15%" y="10%" width="8%" height="6%" fill="#475569" rx="2" opacity="0.6" />
            <rect x="25%" y="12%" width="10%" height="7%" fill="#475569" rx="2" opacity="0.6" />
            <rect x="18%" y="25%" width="6%" height="5%" fill="#475569" rx="2" opacity="0.6" />

            {/* Residential Housing Blocks */}
            <g opacity="0.5" fill="#334155">
              <rect x="52%" y="65%" width="4%" height="4%" rx="1" />
              <rect x="58%" y="65%" width="4%" height="4%" rx="1" />
              <rect x="64%" y="65%" width="4%" height="4%" rx="1" />
              <rect x="70%" y="65%" width="4%" height="4%" rx="1" />
              
              <rect x="52%" y="72%" width="4%" height="4%" rx="1" />
              <rect x="58%" y="72%" width="4%" height="4%" rx="1" />
              <rect x="64%" y="72%" width="4%" height="4%" rx="1" />
              <rect x="70%" y="72%" width="4%" height="4%" rx="1" />
            </g>

            {/* Dark River */}
            <path d="M -10,150 Q 200,250 400,100 T 1200,300" fill="none" stroke="#0369a1" strokeWidth="20" opacity="0.75" />
            
            {/* Asphalt Boulevards with Yellow Centrelines */}
            <g opacity="0.8">
              {/* Highway 1 */}
              <line x1="50%" y1="0%" x2="50%" y2="100%" stroke="#1e293b" strokeWidth="14" strokeLinecap="round" />
              <line x1="50%" y1="0%" x2="50%" y2="100%" stroke="#eab308" strokeWidth="1" strokeDasharray="3 3" />

              {/* Highway 2 */}
              <line x1="0%" y1="60%" x2="100%" y2="60%" stroke="#1e293b" strokeWidth="14" strokeLinecap="round" />
              <line x1="0%" y1="60%" x2="100%" y2="60%" stroke="#eab308" strokeWidth="1" strokeDasharray="3 3" />

              {/* Secondary roads */}
              <line x1="10%" y1="0%" x2="10%" y2="100%" stroke="#334155" strokeWidth="8" strokeLinecap="round" />
              <line x1="85%" y1="0%" x2="85%" y2="100%" stroke="#334155" strokeWidth="8" strokeLinecap="round" />
              <line x1="0%" y1="20%" x2="100%" y2="20%" stroke="#334155" strokeWidth="8" strokeLinecap="round" />
              <line x1="0%" y1="85%" x2="100%" y2="85%" stroke="#334155" strokeWidth="6" strokeLinecap="round" />
            </g>
          </svg>
        )}

        {activeLayer === "heatmap" && (
          <svg className="absolute inset-0 w-full h-full pointer-events-none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <radialGradient id="highHeat" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.85" />
                <stop offset="35%" stopColor="#f43f5e" stopOpacity="0.45" />
                <stop offset="70%" stopColor="#f43f5e" stopOpacity="0.15" />
                <stop offset="100%" stopColor="#f43f5e" stopOpacity="0" />
              </radialGradient>
              <radialGradient id="mediumHeat" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.8" />
                <stop offset="40%" stopColor="#f59e0b" stopOpacity="0.38" />
                <stop offset="75%" stopColor="#f59e0b" stopOpacity="0.12" />
                <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
              </radialGradient>
              <radialGradient id="lowHeat" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#10b981" stopOpacity="0.65" />
                <stop offset="45%" stopColor="#10b981" stopOpacity="0.25" />
                <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
              </radialGradient>
            </defs>

            {/* Faded roads for spatial density reference */}
            <g opacity="0.12">
              <line x1="10%" y1="0%" x2="10%" y2="100%" stroke="#94a3b8" strokeWidth="8" />
              <line x1="50%" y1="0%" x2="50%" y2="100%" stroke="#94a3b8" strokeWidth="12" />
              <line x1="85%" y1="0%" x2="85%" y2="100%" stroke="#94a3b8" strokeWidth="8" />
              <line x1="0%" y1="20%" x2="100%" y2="20%" stroke="#94a3b8" strokeWidth="8" />
              <line x1="0%" y1="60%" x2="100%" y2="60%" stroke="#94a3b8" strokeWidth="12" />
              <line x1="0%" y1="85%" x2="100%" y2="85%" stroke="#94a3b8" strokeWidth="6" />
            </g>

            {/* Glowing density hotspots */}
            <g style={{ mixBlendMode: "screen" }}>
              {reports.map((report) => {
                const { x, y } = convertCoordsToPct(report.latitude, report.longitude);
                let gradientId = "highHeat";
                let radius = 65;

                if (report.status === "Resolved") {
                  gradientId = "lowHeat";
                  radius = 48;
                } else if (report.status === "In Progress" || report.status === "Investigating") {
                  gradientId = "mediumHeat";
                  radius = 58;
                }

                return (
                  <circle
                    key={`heat-${report.id}`}
                    cx={`${x}%`}
                    cy={`${y}%`}
                    r={radius}
                    fill={`url(#${gradientId})`}
                  />
                );
              })}
            </g>
          </svg>
        )}

        {/* Selected Geolocation reporting pin */}
        {selectedLocation && (() => {
          const { x, y } = convertCoordsToPct(selectedLocation.lat, selectedLocation.lng);
          return (
            <div
              className="absolute -translate-x-1/2 -translate-y-full z-20 pointer-events-none transition-all duration-300"
              style={{ left: `${x}%`, top: `${y}%` }}
            >
              <div className="flex flex-col items-center animate-bounce">
                <div className="bg-blue-600 text-white font-semibold text-[10px] px-2.5 py-1 rounded-lg shadow-md border border-blue-500 whitespace-nowrap">
                  Selected Location
                </div>
                <div className="w-3 h-3 bg-blue-600 rounded-full border-2 border-white shadow-lg -mt-1 ring-4 ring-blue-500/30" />
                <div className="w-1.5 h-3 bg-blue-600 -mt-1 shadow-md" />
              </div>
            </div>
          );
        })()}

        {/* User Current / Simulated Geolocation pulse dot */}
        {userLocation && (() => {
          const { x, y } = convertCoordsToPct(userLocation.lat, userLocation.lng);
          return (
            <div
              className="absolute -translate-x-1/2 -translate-y-1/2 z-25 pointer-events-none transition-all duration-300"
              style={{ left: `${x}%`, top: `${y}%` }}
              title="Your Location"
            >
              <div className="relative flex items-center justify-center">
                <div className="absolute w-8 h-8 bg-blue-500/40 rounded-full animate-ping" />
                <div className="absolute w-5 h-5 bg-blue-500/60 rounded-full animate-pulse" />
                <div className="w-3 h-3 bg-blue-600 rounded-full border border-white shadow-md ring-4 ring-blue-500/30" />
              </div>
            </div>
          );
        })()}

        {/* Existing Issues Pins */}
        {reports.map((report) => {
          const { x, y } = convertCoordsToPct(report.latitude, report.longitude);
          const isSelected = activeReportId === report.id;

          // Calculate if the hazard is unresolved and older than 30 days
          const createdAtMs = report.createdAt?.toDate 
            ? report.createdAt.toDate().getTime() 
            : report.createdAt 
              ? new Date(report.createdAt).getTime() 
              : 0;
          const isOverdue = report.status !== "Resolved" && (Date.now() - createdAtMs > 30 * 24 * 60 * 60 * 1000);

          return (
            <button
              key={report.id}
              onClick={(e) => {
                e.stopPropagation();
                onSelectReport(report.id);
              }}
              className={`absolute -translate-x-1/2 -translate-y-1/2 group z-10 p-2 focus:outline-none transition-transform duration-200 cursor-pointer ${
                isSelected ? "scale-125 z-30" : "hover:scale-110"
              }`}
              style={{ left: `${x}%`, top: `${y}%` }}
            >
              {/* Overdue background Urgency Pulse */}
              {isOverdue && (
                <span className="absolute inset-0 m-auto w-8 h-8 rounded-full bg-rose-500/45 animate-ping pointer-events-none z-0" />
              )}

              <div className={`relative flex items-center justify-center w-6 h-6 rounded-full text-white shadow-sm ring-4 z-10 ${getStatusColor(report.status)} ${
                activeLayer === "heatmap" ? "opacity-60 hover:opacity-100 transition-opacity" : ""
              }`}>
                <Pin className={`w-3.5 h-3.5 ${isSelected ? "animate-pulse" : ""}`} />
                
                {/* Micro tooltip card */}
                <div className="absolute bottom-8 left-1/2 -translate-x-1/2 hidden group-hover:block bg-white border border-slate-200 p-2.5 rounded-xl shadow-md w-48 text-left z-50 pointer-events-none">
                  <div className="flex justify-between items-start gap-1">
                    <span className="text-[10px] font-bold text-slate-800 line-clamp-1">{report.title}</span>
                    <span className="text-[8px] bg-slate-100 text-slate-600 px-1 py-0.5 rounded uppercase font-semibold">{report.category}</span>
                  </div>
                  <p className="text-[9px] text-slate-500 mt-1 line-clamp-2">{report.description}</p>
                  <p className="text-[8px] text-blue-600 mt-1 font-mono">{report.address}</p>
                  
                  {isOverdue && (
                    <div className="mt-1.5 flex items-center gap-1 text-[8px] font-bold text-rose-600 font-mono uppercase bg-rose-50 border border-rose-100 px-1.5 py-0.5 rounded">
                      <span className="relative flex h-1.5 w-1.5 shrink-0">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-rose-500"></span>
                      </span>
                      Overdue Hazard (30+ Days)
                    </div>
                  )}
                </div>
              </div>
            </button>
          );
        })}
        </div>

        {/* Floating Share My Location Button */}
        {userLocation && (
          <button
            onClick={handleShareLocation}
            className={`absolute left-4 bottom-4 z-30 px-3.5 py-2.5 rounded-2xl border backdrop-blur-md transition-all shadow-md flex items-center gap-2 cursor-pointer pointer-events-auto text-xs font-bold font-sans ${
              copied
                ? "bg-emerald-50 border-emerald-200 text-emerald-700 scale-[1.02]"
                : isDarkLayer
                ? "bg-slate-900/95 border-slate-800 text-slate-200 hover:text-white hover:bg-slate-800/95"
                : "bg-white/95 border-slate-200 text-slate-700 hover:text-slate-900 hover:bg-slate-50"
            }`}
            title="Copy your current GPS coordinates to clipboard"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 text-emerald-600 animate-bounce" />
                <span className="text-emerald-700 font-extrabold">Location Copied!</span>
              </>
            ) : (
              <>
                <Share2 className="w-4 h-4 text-blue-500 animate-pulse" />
                <span>Share My Location</span>
              </>
            )}
          </button>
        )}

        {/* Floating Zoom Controls Widget */}
        <div className="absolute right-4 bottom-[206px] z-30 flex flex-col items-center gap-1 bg-white/95 backdrop-blur-md p-1.5 rounded-2xl border border-slate-200 shadow-lg pointer-events-auto font-sans w-14 select-none">
          {/* Zoom In button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleZoomIn();
            }}
            disabled={zoom >= 3}
            className={`p-2 rounded-xl transition-all flex items-center justify-center cursor-pointer w-11 h-11 ${
              zoom >= 3
                ? "text-slate-350 bg-slate-50/50 cursor-not-allowed"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
            }`}
            title="Zoom In"
          >
            <Plus className="w-5 h-5 stroke-[2.5]" />
          </button>

          {/* Zoom Level Indicator */}
          <div className="text-[9px] font-bold text-slate-500 text-center select-none font-mono py-1">
            {Math.round(zoom * 100)}%
          </div>

          {/* Zoom Out button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleZoomOut();
            }}
            disabled={zoom <= 1}
            className={`p-2 rounded-xl transition-all flex items-center justify-center cursor-pointer w-11 h-11 ${
              zoom <= 1
                ? "text-slate-350 bg-slate-50/50 cursor-not-allowed"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
            }`}
            title="Zoom Out"
          >
            <Minus className="w-5 h-5 stroke-[2.5]" />
          </button>
        </div>

        {/* Floating Layer Selection Widget */}
        <div className="absolute right-4 bottom-4 z-30 flex flex-col gap-1.5 bg-white/95 backdrop-blur-md p-1.5 rounded-2xl border border-slate-200 shadow-lg pointer-events-auto font-sans">
          {/* Street view button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setActiveLayer("street");
            }}
            className={`p-2 rounded-xl transition-all flex flex-col items-center gap-1 cursor-pointer w-14 ${
              activeLayer === "street" 
                ? "bg-blue-50 text-blue-600 font-bold scale-[1.03]" 
                : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"
            }`}
            title="Street Map"
          >
            <Map className="w-4 h-4" />
            <span className="text-[8px] font-bold tracking-wider uppercase font-mono">Street</span>
          </button>

          {/* Satellite view button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setActiveLayer("satellite");
            }}
            className={`p-2 rounded-xl transition-all flex flex-col items-center gap-1 cursor-pointer w-14 ${
              activeLayer === "satellite" 
                ? "bg-slate-800 text-indigo-400 font-bold scale-[1.03]" 
                : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"
            }`}
            title="Satellite Map"
          >
            <Globe className="w-4 h-4" />
            <span className="text-[8px] font-bold tracking-wider uppercase font-mono">Satellite</span>
          </button>

          {/* Heatmap view button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setActiveLayer("heatmap");
            }}
            className={`p-2 rounded-xl transition-all flex flex-col items-center gap-1 cursor-pointer w-14 ${
              activeLayer === "heatmap" 
                ? "bg-rose-50 text-rose-600 font-bold scale-[1.03]" 
                : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"
            }`}
            title="Density Heatmap"
          >
            <Flame className="w-4 h-4 text-rose-500 animate-pulse" />
            <span className="text-[8px] font-bold tracking-wider uppercase font-mono">Heat</span>
          </button>
        </div>
      </div>

      {/* Map Footer showing coordinates */}
      {selectedLocation && (
        <div className="bg-white border-t border-slate-200 px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 z-10">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 rounded-lg">
              <MapPin className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-800">{selectedLocation.address}</p>
              <p className="text-[10px] text-slate-500 font-mono">
                Lat: {selectedLocation.lat}, Lng: {selectedLocation.lng}
              </p>
            </div>
          </div>
          <p className="text-[10px] text-blue-600 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-100 self-start sm:sm:self-center">
            Position pinned. Ready to report!
          </p>
        </div>
      )}
    </div>
  );
}
