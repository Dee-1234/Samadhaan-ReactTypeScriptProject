import React from "react";
import { X, Camera, Sparkles, MapPin, Loader2, AlertCircle } from "lucide-react";

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedLocation: { lat: number; lng: number; address: string } | null;
  onSubmit: (data: {
    title: string;
    description: string;
    category: string;
    imageUrl: string;
    severity: 'Low' | 'Medium' | 'High' | 'Critical';
    latitude: number;
    longitude: number;
    address: string;
  }) => void;
}

// Highly stylized preset issue images to make testing incredibly fun and visually authentic
const PRESET_IMAGES = [
  {
    name: "Severe Pothole",
    category: "Pothole",
    url: "https://images.unsplash.com/photo-1515162305285-0293e4767cc2?auto=format&fit=crop&w=400&q=80",
    description: "Huge asphalt crater in the center of the lane"
  },
  {
    name: "Burst Water Main",
    category: "Water Leakage",
    url: "https://images.unsplash.com/photo-1542060748-10c28b629f6f?auto=format&fit=crop&w=400&q=80",
    description: "Flooding spilling over the sidewalk"
  },
  {
    name: "Fallen Streetlight",
    category: "Damaged Streetlight",
    url: "https://images.unsplash.com/photo-1508514177221-188b1cf16e9d?auto=format&fit=crop&w=400&q=80",
    description: "Damaged lamp pole hanging dangerously"
  },
  {
    name: "Dumped Electronic Waste",
    category: "Waste Management",
    url: "https://images.unsplash.com/photo-1611284446314-60a58ac0deb9?auto=format&fit=crop&w=400&q=80",
    description: "Illegal appliance and tire disposal"
  }
];

export default function ReportModal({ isOpen, onClose, selectedLocation, onSubmit }: ReportModalProps) {
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [category, setCategory] = React.useState("Pothole");
  const [severity, setSeverity] = React.useState<'Low' | 'Medium' | 'High' | 'Critical'>("Medium");
  const [imageUrl, setImageUrl] = React.useState("");
  const [customBase64, setCustomBase64] = React.useState("");
  const [analyzing, setAnalyzing] = React.useState(false);
  const [address, setAddress] = React.useState("");
  const [lat, setLat] = React.useState(0);
  const [lng, setLng] = React.useState(0);
  const [errorMessage, setErrorMessage] = React.useState("");

  // Camera integration state & refs
  const [isCameraActive, setIsCameraActive] = React.useState(false);
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const streamRef = React.useRef<MediaStream | null>(null);

  // Sync selectedLocation coordinates
  React.useEffect(() => {
    if (selectedLocation) {
      setAddress(selectedLocation.address);
      setLat(selectedLocation.lat);
      setLng(selectedLocation.lng);
    }
  }, [selectedLocation]);

  // Clean up camera on close or unmount
  React.useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  React.useEffect(() => {
    if (!isOpen) {
      stopCamera();
    }
  }, [isOpen]);

  const startCamera = async () => {
    setImageUrl("");
    setCustomBase64("");
    setErrorMessage("");
    setIsCameraActive(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.warn("Could not load environment camera, trying default", err);
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (fallbackErr) {
        console.error("Camera access failed:", fallbackErr);
        setErrorMessage("Camera access denied or unavailable. Please upload a photo manually.");
        setIsCameraActive(false);
      }
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  };

  const capturePhoto = () => {
    if (videoRef.current) {
      const video = videoRef.current;
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        try {
          const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
          setImageUrl(dataUrl);
          const base64Str = dataUrl.split(",")[1] || dataUrl;
          setCustomBase64(base64Str);
          setErrorMessage("");
          stopCamera();
        } catch (captureErr) {
          console.error("Photo capture failed:", captureErr);
          setErrorMessage("Failed to capture photo from video stream.");
        }
      }
    }
  };

  if (!isOpen) return null;

  // Converts native file uploads into Base64 format securely
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      setErrorMessage("Please select an image smaller than 2MB.");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64Str = reader.result as string;
      setImageUrl(base64Str);
      // Strip mimetype header for direct Gemini inlineData payloads
      const dataStr = base64Str.split(",")[1] || base64Str;
      setCustomBase64(dataStr);
      setErrorMessage("");
    };
    reader.readAsDataURL(file);
  };

  const selectPreset = (preset: typeof PRESET_IMAGES[0]) => {
    setImageUrl(preset.url);
    setDescription(preset.description);
    setCategory(preset.category);
    setCustomBase64(""); // Presets don't need raw upload base64
  };

  // Automated AI Assistant triggers Gemini model on backend
  const handleAIAnalysis = async () => {
    setAnalyzing(true);
    setErrorMessage("");
    try {
      // Build analysis request body
      let requestBody: any = { descriptionNotes: description };
      if (customBase64) {
        requestBody.imageBase64 = customBase64;
        requestBody.mimeType = "image/png"; // Default standard
      } else if (imageUrl) {
        // If they selected a preset, pass it as hints to make it accurate
        requestBody.descriptionNotes += ` (Visual reference: ${imageUrl})`;
      }

      const res = await fetch("/api/analyze-issue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      const data = await res.json();
      if (data.success && data.analysis) {
        const ai = data.analysis;
        setTitle(ai.title || title);
        setDescription(ai.description || description);
        setCategory(ai.category || category);
        setSeverity((ai.severity as any) || severity);
      } else {
        setErrorMessage("AI analysis failed to categorize. Please enter details manually.");
      }
    } catch (err) {
      console.error(err);
      setErrorMessage("Could not connect to Gemini service. Please verify server status.");
    } finally {
      setAnalyzing(false);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) {
      setErrorMessage("Please provide a title and detailed description.");
      return;
    }
    if (!imageUrl) {
      setErrorMessage("Please select a photo or preset template.");
      return;
    }
    if (!lat || !lng) {
      setErrorMessage("Please pin a location on the map first.");
      return;
    }

    onSubmit({
      title,
      description,
      category,
      imageUrl,
      severity,
      latitude: lat,
      longitude: lng,
      address: address || "Maple Heights Area"
    });

    // Reset fields
    setTitle("");
    setDescription("");
    setImageUrl("");
    setCustomBase64("");
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-200 flex justify-between items-center bg-white sticky top-0 z-10">
          <div>
            <h3 className="text-lg font-bold text-slate-800 font-display">Report Community Issue</h3>
            <p className="text-xs text-slate-500 mt-0.5 font-sans">Report local hazards & track live fixes</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleFormSubmit} className="p-6 space-y-6 flex-1">
          {errorMessage && (
            <div className="flex items-start gap-2 bg-rose-50 border border-rose-100 text-rose-600 text-xs p-3 rounded-xl">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Location Verification Info */}
          {!selectedLocation ? (
            <div className="bg-amber-50 border border-amber-200 text-amber-700 text-xs p-4 rounded-xl flex items-start gap-2 font-sans">
              <MapPin className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">No Map Pin Found:</span> Close this modal, click on the map dashboard to pinpoint the coordinate of the issue, and then click "Report Issue". This auto-fills GPS metadata correctly.
              </div>
            </div>
          ) : (
            <div className="bg-blue-50 border border-blue-100 text-blue-600 text-xs px-4 py-3 rounded-xl flex items-center justify-between font-sans">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                <span>Pinned Location: <strong className="text-slate-800">{address}</strong></span>
              </div>
              <span className="text-[10px] bg-white px-2 py-0.5 rounded font-mono border border-blue-100 text-blue-700">
                {lat.toFixed(4)}, {lng.toFixed(4)}
              </span>
            </div>
          )}

          {/* Photo Selection / Upload */}
          <div className="space-y-3">
            <label className="block text-xs font-semibold text-slate-700">Issue Visuals (Required)</label>
            
            {/* Image Preview Box */}
            {imageUrl ? (
              <div className="relative h-44 rounded-2xl overflow-hidden border border-slate-200 group bg-slate-50">
                <img src={imageUrl} alt="Issue preview" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => {
                    setImageUrl("");
                    setCustomBase64("");
                  }}
                  className="absolute top-3 right-3 p-2 bg-white hover:bg-slate-50 rounded-xl text-slate-600 hover:text-slate-800 transition-colors cursor-pointer border border-slate-200 shadow-md"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : isCameraActive ? (
              <div className="relative h-64 rounded-2xl overflow-hidden border border-slate-200 bg-black flex flex-col items-center justify-center group shadow-inner">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  className="w-full h-full object-cover"
                />
                
                {/* Camera controls overlay */}
                <div className="absolute bottom-4 left-0 right-0 flex items-center justify-center gap-4 px-4 z-20">
                  <button
                    type="button"
                    onClick={stopCamera}
                    className="px-4 py-2 bg-slate-900/80 hover:bg-slate-900 border border-slate-700/50 backdrop-blur-md text-white text-[11px] font-semibold rounded-xl transition-all cursor-pointer shadow-md"
                  >
                    Cancel
                  </button>
                  
                  {/* Shutter Button */}
                  <button
                    type="button"
                    onClick={capturePhoto}
                    className="h-14 w-14 rounded-full bg-white border-4 border-slate-200 flex items-center justify-center cursor-pointer transition-all active:scale-95 shadow-xl hover:scale-105"
                    title="Capture Photo"
                  >
                    <span className="block h-8 w-8 rounded-full bg-rose-600 active:bg-rose-700 transition-colors" />
                  </button>
                  
                  <div className="w-[60px]" /> {/* Spacer to align visually with Cancel button */}
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* Native Upload Card */}
                <div className="relative border border-dashed border-slate-300 hover:border-blue-500 rounded-2xl p-5 text-center bg-slate-50 flex flex-col items-center justify-center transition-all min-h-[140px]">
                  <Camera className="w-6 h-6 text-slate-400 mb-1.5" />
                  <span className="text-xs font-bold text-slate-700">Upload Photo File</span>
                  <span className="text-[10px] text-slate-400 mt-1 font-sans">Drag & drop or browse</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                </div>
                
                {/* Camera Option Card */}
                <button
                  type="button"
                  onClick={startCamera}
                  className="border border-slate-200 hover:border-indigo-500 hover:bg-indigo-50/10 rounded-2xl p-5 text-center bg-white flex flex-col items-center justify-center transition-all cursor-pointer group min-h-[140px]"
                >
                  <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl group-hover:scale-105 transition-transform mb-2">
                    <Camera className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-bold text-slate-700">Capture Live Photo</span>
                  <span className="text-[10px] text-indigo-500 font-semibold mt-1 font-sans">Use device camera</span>
                </button>
              </div>
            )}

            {/* Visual Presets */}
            {!imageUrl && !isCameraActive && (
              <div className="space-y-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide font-mono">Or Select testing preset:</span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {PRESET_IMAGES.map((img, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => selectPreset(img)}
                      className="text-left bg-white border border-slate-200 hover:border-blue-500 p-1.5 rounded-xl transition-all cursor-pointer overflow-hidden group shadow-sm"
                    >
                      <img src={img.url} alt={img.name} className="h-14 w-full object-cover rounded-lg group-hover:scale-105 transition-transform" />
                      <span className="block text-[9px] font-bold text-slate-700 mt-1 truncate font-mono">{img.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* AI Autofill trigger banner */}
          <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-indigo-100 rounded-xl text-indigo-600">
                <Sparkles className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-indigo-900 font-display">AI Intelligent Routing</h4>
                <p className="text-[10px] text-indigo-600 font-sans">Autofill details, categories, and severity level using Gemini model.</p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleAIAnalysis}
              disabled={analyzing}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-100 text-white disabled:text-slate-400 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer whitespace-nowrap self-start sm:self-center"
            >
              {analyzing ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Analyzing...
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" /> Analyze with AI
                </>
              )}
            </button>
          </div>

          {/* Title, Category & Severity */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            <div className="md:col-span-12">
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Issue Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Pothole on Oak Street lane"
                className="w-full bg-white border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 focus:outline-none rounded-xl px-4 py-2.5 text-xs text-slate-800 transition-all"
                required
              />
            </div>

            <div className="md:col-span-6">
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-white border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 focus:outline-none rounded-xl px-4 py-2.5 text-xs text-slate-800 transition-all"
              >
                <option value="Pothole">Pothole</option>
                <option value="Water Leakage">Water Leakage</option>
                <option value="Damaged Streetlight">Damaged Streetlight</option>
                <option value="Waste Management">Waste Management</option>
                <option value="Public Infrastructure">Public Infrastructure</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div className="md:col-span-6">
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Estimated Severity</label>
              <select
                value={severity}
                onChange={(e) => setSeverity(e.target.value as any)}
                className="w-full bg-white border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 focus:outline-none rounded-xl px-4 py-2.5 text-xs text-slate-800 transition-all"
              >
                <option value="Low">Low (No Immediate Danger)</option>
                <option value="Medium">Medium (General Hazard)</option>
                <option value="High">High (Disruptive / Dangerous)</option>
                <option value="Critical">Critical (Immediate Hazard)</option>
              </select>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Problem Details & Observations</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Provide exact landmarks, dangers, or context. Include any relevant information..."
              rows={4}
              className="w-full bg-white border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 focus:outline-none rounded-xl px-4 py-2.5 text-xs text-slate-800 transition-all"
              required
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 sticky bottom-0 bg-white pb-2">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 rounded-xl font-bold text-xs transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={analyzing}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs transition-all shadow-md shadow-blue-500/10 hover-scale cursor-pointer"
            >
              Report Issue
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
