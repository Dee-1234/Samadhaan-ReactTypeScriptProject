import React from "react";
import {
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
  signInAnonymously,
  User as FirebaseUser,
} from "firebase/auth";
import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  orderBy,
  getDocFromServer,
  Timestamp,
} from "firebase/firestore";
import {
  auth,
  db,
  handleFirestoreError,
  OperationType,
} from "./firebase";
import { UserProfile, CommunityReport, IssueComment, VerificationVote, UserNotification } from "./types";
import {
  Trophy,
  Activity,
  CheckCircle2,
  MapPin,
  Sparkles,
  Plus,
  MessageSquare,
  ThumbsUp,
  Filter,
  LogOut,
  User,
  UserCheck,
  ShieldAlert,
  Globe,
  Send,
  Hourglass,
  Wrench,
  ChevronRight,
  AlertOctagon,
  Award,
  Bell,
  X,
  Check,
  Search,
  Maximize2,
  Flag,
  EyeOff,
  Bookmark,
  Share2,
  QrCode,
  Printer,
  Sun,
  Moon,
  HelpCircle,
  Settings,
} from "lucide-react";
import MapWidget from "./components/MapWidget";
import Leaderboard from "./components/Leaderboard";
import PredictiveDashboard from "./components/PredictiveDashboard";
import ReportModal from "./components/ReportModal";
import MyActivity from "./components/MyActivity";
import SavedIssues from "./components/SavedIssues";

// Seed data to automatically populate the community sector on first boot if no reports exist
const SEED_REPORTS = [
  {
    id: "seed_1",
    title: "Dangerous Pothole on Broadway",
    description: "Deep crater on the right lane near the traffic light. Vehicles are swerving into oncoming traffic to avoid it.",
    category: "Pothole",
    imageUrl: "https://images.unsplash.com/photo-1515162305285-0293e4767cc2?auto=format&fit=crop&w=400&q=80",
    latitude: 45.5218,
    longitude: -122.6821,
    address: "1420 Broadway Ave, Maple Heights",
    status: "In Progress" as const,
    severity: "High" as const,
    reporterId: "municipal_system",
    reporterName: "AI Inspector",
    upvotes: 8,
  },
  {
    id: "seed_2",
    title: "Flooding / Damaged Fire Hydrant",
    description: "Water has been leaking heavily for 3 hours. Low water pressure in adjacent residential buildings.",
    category: "Water Leakage",
    imageUrl: "https://images.unsplash.com/photo-1542060748-10c28b629f6f?auto=format&fit=crop&w=400&q=80",
    latitude: 45.5265,
    longitude: -122.6712,
    address: "680 Maple Court, Maple Heights",
    status: "Reported" as const,
    severity: "Critical" as const,
    reporterId: "municipal_system",
    reporterName: "AI Inspector",
    upvotes: 14,
  },
  {
    id: "seed_3",
    title: "Broken Streetlamp - Dark Corner",
    description: "The streetlamp is completely out. It creates a dark zone near the primary school crosswalk.",
    category: "Damaged Streetlight",
    imageUrl: "https://images.unsplash.com/photo-1508514177221-188b1cf16e9d?auto=format&fit=crop&w=400&q=80",
    latitude: 45.5182,
    longitude: -122.6685,
    address: "320 Cedar Lane, Maple Heights",
    status: "Resolved" as const,
    severity: "Medium" as const,
    reporterId: "municipal_system",
    reporterName: "AI Inspector",
    upvotes: 3,
  }
];

export const isAwaitingAttention = (report: CommunityReport): boolean => {
  if (report.status === "Resolved") return false;
  if (!report.createdAt) return false;
  
  const createdMs = report.createdAt.toDate 
    ? report.createdAt.toDate().getTime() 
    : (report.createdAt.seconds !== undefined ? report.createdAt.seconds * 1000 : new Date(report.createdAt).getTime());
    
  const ageInDays = (Date.now() - createdMs) / (1000 * 60 * 60 * 24);
  return ageInDays > 30;
};

export const formatTimeAgo = (timestamp: any): string => {
  if (!timestamp) return "just now";
  
  let ms = 0;
  if (typeof timestamp.toDate === "function") {
    ms = timestamp.toDate().getTime();
  } else if (timestamp.seconds !== undefined) {
    ms = timestamp.seconds * 1000;
  } else if (timestamp instanceof Date) {
    ms = timestamp.getTime();
  } else if (typeof timestamp === "number") {
    ms = timestamp;
  } else {
    ms = new Date(timestamp).getTime();
  }
  
  const now = Date.now();
  const diff = now - ms;
  
  if (isNaN(ms) || diff < 0) return "just now";
  
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const months = Math.floor(days / 30);
  const years = Math.floor(days / 365);
  
  if (seconds < 60) {
    return "just now";
  } else if (minutes < 60) {
    return minutes === 1 ? "1 minute ago" : `${minutes} minutes ago`;
  } else if (hours < 24) {
    return hours === 1 ? "1 hour ago" : `${hours} hours ago`;
  } else if (days < 30) {
    return days === 1 ? "1 day ago" : `${days} days ago`;
  } else if (months < 12) {
    return months === 1 ? "1 month ago" : `${months} months ago`;
  } else {
    return years === 1 ? "1 year ago" : `${years} years ago`;
  }
};

export default function App() {
  const [user, setUser] = React.useState<FirebaseUser | null>(null);
  const [profile, setProfile] = React.useState<UserProfile | null>(null);
  const [isSandbox, setIsSandbox] = React.useState<boolean>(false);
  const [authError, setAuthError] = React.useState<string | null>(null);
  const [reports, setReports] = React.useState<CommunityReport[]>([]);
  const [activeTab, setActiveTab] = React.useState<"map" | "insights" | "leaderboard" | "my-activity" | "saved-issues">("map");
  const [selectedReportId, setSelectedReportId] = React.useState<string | null>(null);
  const [selectedLocation, setSelectedLocation] = React.useState<{ lat: number; lng: number; address: string } | null>(null);
  const [isReportModalOpen, setIsReportModalOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(true);

  // Dark Mode State & Side Effect
  const [darkMode, setDarkMode] = React.useState<boolean>(() => {
    const saved = localStorage.getItem("theme");
    if (saved) return saved === "dark";
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });

  React.useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }, [darkMode]);

  // Saved Issues Bookmark State & Sync
  const [localSavedIssues, setLocalSavedIssues] = React.useState<string[]>([]);

  // Share feedback state
  const [copiedReportId, setCopiedReportId] = React.useState<string | null>(null);
  const [qrModalReport, setQrModalReport] = React.useState<CommunityReport | null>(null);
  const [showResolutionModal, setShowResolutionModal] = React.useState(false);
  const [showSettingsModal, setShowSettingsModal] = React.useState(false);
  const [fixSummaryText, setFixSummaryText] = React.useState("");

  // New User Tour State
  const [tourStep, setTourStep] = React.useState<number | null>(null);

  React.useEffect(() => {
    if (!loading && profile) {
      const tourCompleted = localStorage.getItem("samadhaan_tour_completed");
      if (!tourCompleted) {
        const timer = setTimeout(() => {
          setTourStep(0);
        }, 1500);
        return () => clearTimeout(timer);
      }
    }
  }, [loading, profile]);

  React.useEffect(() => {
    if (tourStep === 1) {
      setActiveTab("map");
    } else if (tourStep === 4) {
      setActiveTab("leaderboard");
    }
  }, [tourStep]);

  const startTour = () => {
    setTourStep(0);
  };

  const handleNextTourStep = () => {
    if (tourStep !== null) {
      if (tourStep < 4) {
        setTourStep(tourStep + 1);
      } else {
        localStorage.setItem("samadhaan_tour_completed", "true");
        setTourStep(null);
      }
    }
  };

  const handlePrevTourStep = () => {
    if (tourStep !== null && tourStep > 0) {
      setTourStep(tourStep - 1);
    }
  };

  const handleSkipTour = () => {
    localStorage.setItem("samadhaan_tour_completed", "true");
    setTourStep(null);
  };

  const handleShareReport = (reportId: string) => {
    const deepLink = `${window.location.origin}${window.location.pathname}?reportId=${reportId}`;
    navigator.clipboard.writeText(deepLink)
      .then(() => {
        setCopiedReportId(reportId);
        setTimeout(() => {
          setCopiedReportId(null);
        }, 2000);
      })
      .catch((err) => {
        console.error("Failed to copy link: ", err);
      });
  };

  const handlePrintQRCode = (report: CommunityReport) => {
    const deepLink = `${window.location.origin}${window.location.pathname}?reportId=${report.id}`;
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(deepLink)}`;
    
    const printWindow = window.open("", "_blank", "width=600,height=600");
    if (!printWindow) {
      alert("Please allow popups to print the QR Code");
      return;
    }
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Print QR Badge - ${report.title}</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
              margin: 0;
              padding: 40px;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              min-height: 80vh;
              color: #1e293b;
            }
            .badge-card {
              border: 3px dashed #3b82f6;
              border-radius: 24px;
              padding: 32px;
              max-width: 420px;
              width: 100%;
              text-align: center;
              box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.05);
              background: #fff;
            }
            .header {
              display: flex;
              align-items: center;
              justify-content: center;
              gap: 8px;
              margin-bottom: 20px;
            }
            .header h1 {
              font-size: 20px;
              font-weight: 800;
              margin: 0;
              color: #0f172a;
              text-transform: uppercase;
              letter-spacing: 0.5px;
            }
            .qr-container {
              margin: 24px 0;
              display: inline-block;
              padding: 16px;
              background: #f8fafc;
              border: 1px solid #e2e8f0;
              border-radius: 16px;
            }
            .qr-img {
              width: 220px;
              height: 220px;
              display: block;
            }
            .title {
              font-size: 18px;
              font-weight: 700;
              margin: 0 0 8px 0;
              color: #1e293b;
            }
            .metadata {
              font-size: 12px;
              font-family: monospace;
              color: #64748b;
              margin-bottom: 16px;
              text-transform: uppercase;
            }
            .badge {
              display: inline-block;
              font-size: 10px;
              font-weight: 700;
              font-family: monospace;
              padding: 4px 10px;
              border-radius: 6px;
              text-transform: uppercase;
              margin-bottom: 16px;
            }
            .badge-critical {
              background-color: #fef2f2;
              color: #991b1b;
              border: 1px solid #fca5a5;
            }
            .badge-high {
              background-color: #fffbeb;
              color: #92400e;
              border: 1px solid #fcd34d;
            }
            .badge-normal {
              background-color: #f0fdf4;
              color: #166534;
              border: 1px solid #86efac;
            }
            .instructions {
              font-size: 11px;
              color: #64748b;
              line-height: 1.5;
              margin: 16px 0 0 0;
              border-top: 1px solid #e2e8f0;
              padding-top: 16px;
            }
            @media print {
              body {
                padding: 0;
                background: none;
              }
              .badge-card {
                border: 3px dashed #1e293b;
                box-shadow: none;
              }
              .no-print {
                display: none;
              }
            }
          </style>
        </head>
        <body>
          <div class="badge-card">
            <div class="header">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-sparkles"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>
              <h1>Samadhaan</h1>
            </div>
            <div class="badge ${report.severity === "Critical" || report.severity === "High" ? "badge-critical" : "badge-normal"}">
              \${report.severity} Severity • \${report.category}
            </div>
            <h2 class="title">\${report.title}</h2>
            <div class="metadata">ID: \${report.id.substring(0, 8)} • ZIP: \${report.zipCode}</div>
            
            <div class="qr-container">
              <img class="qr-img" src="\${qrUrl}" alt="QR Code" />
            </div>
            
            <p class="instructions">
              <strong>MUNICIPAL FIELD AGENTS:</strong> Scan this QR code with any mobile device to immediately view real-time status updates, community logs, and coordinates for this issue.
            </p>
          </div>
          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
              }, 500);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // Connection & Firestore status tracker
  const [isOnline, setIsOnline] = React.useState<boolean>(navigator.onLine);

  React.useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Initialize from profile when profile loads, fallback to localStorage
  React.useEffect(() => {
    if (profile) {
      setLocalSavedIssues(profile.savedIssues || []);
    } else {
      const saved = localStorage.getItem("saved_issues");
      if (saved) {
        try {
          setLocalSavedIssues(JSON.parse(saved));
        } catch (e) {
          console.error(e);
        }
      } else {
        setLocalSavedIssues([]);
      }
    }
  }, [profile]);

  const handleToggleSaveIssue = async (reportId: string) => {
    let updated: string[];
    if (localSavedIssues.includes(reportId)) {
      updated = localSavedIssues.filter((id) => id !== reportId);
    } else {
      updated = [...localSavedIssues, reportId];
    }

    setLocalSavedIssues(updated);

    if (!profile) {
      localStorage.setItem("saved_issues", JSON.stringify(updated));
    }

    if (user && profile) {
      const userRef = doc(db, "users", user.uid);
      try {
        await updateDoc(userRef, {
          savedIssues: updated,
          updatedAt: Timestamp.now(),
        });
        setProfile({
          ...profile,
          savedIssues: updated,
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}`);
      }
    }
  };

  // Geolocation & Proximity Radar states
  const [userLocation, setUserLocation] = React.useState<{ lat: number; lng: number } | null>({ lat: 45.5225, lng: -122.6750 });
  const [isSimulatingLocation, setIsSimulatingLocation] = React.useState(true);
  const [isGPSTrackingActive, setIsGPSTrackingActive] = React.useState(false);
  const [acknowledgedAlerts, setAcknowledgedAlerts] = React.useState<Record<string, boolean>>({});
  const [geolocationError, setGeolocationError] = React.useState<string | null>(null);

  // Distance calculator using Haversine formula
  const getDistanceInMeters = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371000; // Earth's radius in meters
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // Compute nearby High or Critical severity hazards (within 500m)
  const nearbyHazards = React.useMemo(() => {
    if (!userLocation) return [];
    return reports.filter((report) => {
      if (report.status === "Resolved") return false;
      if (report.severity !== "High" && report.severity !== "Critical") return false;

      const distance = getDistanceInMeters(
        userLocation.lat,
        userLocation.lng,
        report.latitude,
        report.longitude
      );
      return distance <= 500;
    });
  }, [reports, userLocation]);

  // Request browser notification permissions on mount
  React.useEffect(() => {
    if ("Notification" in window && Notification.permission !== "granted" && Notification.permission !== "denied") {
      Notification.requestPermission().catch(console.error);
    }
  }, []);

  // Sync / watch real geolocation when GPS is activated
  React.useEffect(() => {
    if (!isGPSTrackingActive) return;

    if (!navigator.geolocation) {
      setGeolocationError("Geolocation is not supported by your browser.");
      setIsGPSTrackingActive(false);
      setIsSimulatingLocation(true);
      return;
    }

    setGeolocationError(null);

    const handleSuccess = (position: GeolocationPosition) => {
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      setUserLocation({ lat, lng });
      setIsSimulatingLocation(false);
    };

    const handleError = (error: GeolocationPositionError) => {
      let msg = "Failed to retrieve location.";
      if (error.code === error.PERMISSION_DENIED) {
        msg = "Location permission denied. Try Simulating instead!";
      } else if (error.code === error.POSITION_UNAVAILABLE) {
        msg = "Location position unavailable.";
      } else if (error.code === error.TIMEOUT) {
        msg = "Location request timed out.";
      }
      setGeolocationError(msg);
      setIsGPSTrackingActive(false);
      setIsSimulatingLocation(true);
    };

    const watchId = navigator.geolocation.watchPosition(handleSuccess, handleError, {
      enableHighAccuracy: true,
      maximumAge: 10000,
      timeout: 10000,
    });

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [isGPSTrackingActive]);

  // Trigger browser notifications and sound for new hazards entered in 500m range
  React.useEffect(() => {
    if (nearbyHazards.length === 0) return;

    nearbyHazards.forEach((hazard) => {
      if (acknowledgedAlerts[hazard.id]) return;

      // 1. Send native browser notification if allowed
      if ("Notification" in window && Notification.permission === "granted") {
        try {
          new Notification(`⚠️ PROXIMITY ALERT: ${hazard.severity} Severity`, {
            body: `You are within 500m of a ${hazard.category} hazard: "${hazard.title}" at ${hazard.address}.`,
            icon: hazard.imageUrl,
          });
        } catch (e) {
          console.warn("Notification construct failed", e);
        }
      }

      // 2. Play subtle alert synthesizer chime
      try {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        oscillator.type = "sine";
        oscillator.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5 pitch
        gainNode.gain.setValueAtTime(0.06, audioCtx.currentTime);
        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.18);
      } catch (err) {}

      // Mark as acknowledged
      setAcknowledgedAlerts((prev) => ({ ...prev, [hazard.id]: true }));
    });
  }, [nearbyHazards, acknowledgedAlerts]);

  // Active unacknowledged proximity warning banner state
  const [activeProximityAlert, setActiveProximityAlert] = React.useState<CommunityReport | null>(null);

  React.useEffect(() => {
    const unacknowledged = nearbyHazards.find((h) => !acknowledgedAlerts[h.id]);
    if (unacknowledged) {
      setActiveProximityAlert(unacknowledged);
    } else {
      setActiveProximityAlert(null);
    }
  }, [nearbyHazards, acknowledgedAlerts]);
  
  // Filtering states
  const [categoryFilter, setCategoryFilter] = React.useState("All");
  const [statusFilter, setStatusFilter] = React.useState("All");
  const [searchQuery, setSearchQuery] = React.useState("");
  const [maxDistance, setMaxDistance] = React.useState<number>(5); // default to 5 km
  const [enableDistanceFilter, setEnableDistanceFilter] = React.useState<boolean>(false);

  // Report details subcollection state
  const [comments, setComments] = React.useState<IssueComment[]>([]);
  const [verifications, setVerifications] = React.useState<VerificationVote[]>([]);
  const [newCommentText, setNewCommentText] = React.useState("");
  const [revealedComments, setRevealedComments] = React.useState<Record<string, boolean>>({});

  // Local draft management
  const handleCommentTextChange = (text: string) => {
    setNewCommentText(text);
    if (selectedReportId) {
      localStorage.setItem(`comment_draft_${selectedReportId}`, text);
    }
  };

  React.useEffect(() => {
    if (selectedReportId) {
      const savedDraft = localStorage.getItem(`comment_draft_${selectedReportId}`) || "";
      setNewCommentText(savedDraft);
    } else {
      setNewCommentText("");
    }
  }, [selectedReportId]);

  // Notification states
  const [notifications, setNotifications] = React.useState<UserNotification[]>([]);
  const [isNotificationOpen, setIsNotificationOpen] = React.useState(false);

  // Lightbox modal state for viewing high-res issue images
  const [lightboxImg, setLightboxImg] = React.useState<string | null>(null);

  // Validate Firestore Connection on load (per criteria constraint)
  const validateFirestoreConnection = async () => {
    try {
      await getDocFromServer(doc(db, "test", "connection"));
    } catch (error) {
      if (error instanceof Error && error.message.includes("the client is offline")) {
        console.error("Please check your Firebase configuration.");
      }
    }
  };

  const enableSandboxMode = (displayName: string) => {
    setIsSandbox(true);
    const sandboxUser = {
      uid: "sandbox_user_123",
      email: "sandbox@communityhero.com",
      displayName: displayName,
      photoURL: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=80&q=80",
    };
    setUser(sandboxUser as any);
    const savedHideOld = localStorage.getItem("sandbox_hide_old_reports") === "true";
    const sandboxProfile: UserProfile = {
      uid: sandboxUser.uid,
      email: sandboxUser.email,
      displayName: sandboxUser.displayName,
      photoURL: sandboxUser.photoURL,
      role: "citizen",
      points: 150,
      reportsCount: 0,
      verificationsCount: 0,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      hideOldReports: savedHideOld,
    };
    setProfile(sandboxProfile);
    
    // Initialize sandbox databases in localStorage if not already present
    if (!localStorage.getItem("sandbox_reports")) {
      const initialReports = SEED_REPORTS.map(r => {
        let seedCreatedAt = Timestamp.now();
        if (r.id === "seed_1") {
          const d = new Date();
          d.setDate(d.getDate() - 35);
          seedCreatedAt = Timestamp.fromDate(d);
        } else if (r.id === "seed_2") {
          const d = new Date();
          d.setDate(d.getDate() - 12);
          seedCreatedAt = Timestamp.fromDate(d);
        }
        return {
          ...r,
          createdAt: { seconds: seedCreatedAt.seconds, nanoseconds: seedCreatedAt.nanoseconds },
          updatedAt: { seconds: seedCreatedAt.seconds, nanoseconds: seedCreatedAt.nanoseconds },
        };
      });
      localStorage.setItem("sandbox_reports", JSON.stringify(initialReports));
    }
    
    if (!localStorage.getItem("sandbox_comments")) {
      localStorage.setItem("sandbox_comments", JSON.stringify([]));
    }
    if (!localStorage.getItem("sandbox_verifications")) {
      localStorage.setItem("sandbox_verifications", JSON.stringify([]));
    }
    if (!localStorage.getItem("sandbox_notifications")) {
      localStorage.setItem("sandbox_notifications", JSON.stringify([]));
    }
    
    setLoading(false);
  };

  React.useEffect(() => {
    validateFirestoreConnection();
  }, []);

  // Listen to Authentication State
  React.useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setIsSandbox(false);
        setUser(firebaseUser);
        // Fetch or create profile
        const userRef = doc(db, "users", firebaseUser.uid);
        try {
          const snap = await getDoc(userRef);
          if (snap.exists()) {
            setProfile(snap.data() as UserProfile);
          } else {
            const newProfile: UserProfile = {
              uid: firebaseUser.uid,
              email: firebaseUser.email || "test@communityhero.com",
              displayName: firebaseUser.displayName || "Civic Hero",
              photoURL: firebaseUser.photoURL || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=80&q=80",
              role: "citizen",
              points: 100,
              reportsCount: 0,
              verificationsCount: 0,
              createdAt: Timestamp.now(),
              updatedAt: Timestamp.now(),
            };
            await setDoc(userRef, newProfile);
            setProfile(newProfile);
          }
        } catch (error) {
          handleFirestoreError(error, OperationType.GET, `users/${firebaseUser.uid}`);
        }
        setLoading(false);
      } else {
        if (!isSandbox) {
          setUser(null);
          setProfile(null);
          setLoading(false);
        }
      }
    });
    return unsubscribe;
  }, [isSandbox]);

  // Subscribe to Reports Real-time Updates
  React.useEffect(() => {
    if (!user) return;

    if (isSandbox) {
      const loadReports = () => {
        const local = localStorage.getItem("sandbox_reports");
        if (local) {
          try {
            const parsed = JSON.parse(local);
            const reportsWithDates = parsed.map((r: any) => ({
              ...r,
              createdAt: r.createdAt?.seconds 
                ? Timestamp.fromMillis(r.createdAt.seconds * 1000)
                : Timestamp.fromDate(new Date(r.createdAt || Date.now())),
              updatedAt: r.updatedAt?.seconds
                ? Timestamp.fromMillis(r.updatedAt.seconds * 1000)
                : Timestamp.fromDate(new Date(r.updatedAt || Date.now()))
            }));
            setReports(reportsWithDates);
          } catch (e) {
            console.error("Failed to parse sandbox reports:", e);
          }
        }
      };
      loadReports();
      const interval = setInterval(loadReports, 1000);
      return () => clearInterval(interval);
    } else {
      const reportsRef = collection(db, "reports");
      const q = query(reportsRef, orderBy("createdAt", "desc"));
      
      const unsubscribe = onSnapshot(q, async (snap) => {
        const data: CommunityReport[] = [];
        snap.forEach((doc) => {
          data.push(doc.data() as CommunityReport);
        });

        // Seed database with highly realistic starting scenarios if empty on fresh installation
        if (data.length === 0) {
          for (const r of SEED_REPORTS) {
            let seedCreatedAt = Timestamp.now();
            if (r.id === "seed_1") {
              const d = new Date();
              d.setDate(d.getDate() - 35);
              seedCreatedAt = Timestamp.fromDate(d);
            } else if (r.id === "seed_2") {
              const d = new Date();
              d.setDate(d.getDate() - 12);
              seedCreatedAt = Timestamp.fromDate(d);
            }
            const newReport: CommunityReport = {
              ...r,
              createdAt: seedCreatedAt,
              updatedAt: seedCreatedAt,
            };
            await setDoc(doc(db, "reports", r.id), newReport);
            data.push(newReport);
          }
        }

        setReports(data);
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, "reports");
      });

      return unsubscribe;
    }
  }, [user, isSandbox]);

  // Deep linking: select report from URL query param on load
  React.useEffect(() => {
    if (reports.length > 0) {
      const params = new URLSearchParams(window.location.search);
      const urlReportId = params.get("reportId");
      if (urlReportId) {
        const exists = reports.some((r) => r.id === urlReportId);
        if (exists) {
          setSelectedReportId(urlReportId);
          setActiveTab("map");
          setTimeout(() => {
            const mapElement = document.getElementById("map-anchor");
            if (mapElement) {
              mapElement.scrollIntoView({ behavior: "smooth" });
            }
          }, 500);
        }
      }
    }
  }, [reports]);

  // Subscribe to Comments and Verifications for Active Report
  React.useEffect(() => {
    if (!user || !selectedReportId) {
      setComments([]);
      setVerifications([]);
      return;
    }

    if (isSandbox) {
      const loadCommentsAndVerifications = () => {
        const allCommentsLocal = localStorage.getItem("sandbox_comments") || "[]";
        const allVerificationsLocal = localStorage.getItem("sandbox_verifications") || "[]";
        try {
          const parsedComments = JSON.parse(allCommentsLocal)
            .filter((c: any) => c.reportId === selectedReportId)
            .map((c: any) => ({
              ...c,
              createdAt: c.createdAt?.seconds
                ? Timestamp.fromMillis(c.createdAt.seconds * 1000)
                : Timestamp.fromDate(new Date(c.createdAt || Date.now()))
            }));
          setComments(parsedComments);

          const parsedVerifications = JSON.parse(allVerificationsLocal)
            .filter((v: any) => v.reportId === selectedReportId)
            .map((v: any) => ({
              ...v,
              createdAt: v.createdAt?.seconds
                ? Timestamp.fromMillis(v.createdAt.seconds * 1000)
                : Timestamp.fromDate(new Date(v.createdAt || Date.now()))
            }));
          setVerifications(parsedVerifications);
        } catch (e) {
          console.error("Failed to parse sandbox comments/verifications:", e);
        }
      };

      loadCommentsAndVerifications();
      const interval = setInterval(loadCommentsAndVerifications, 1000);
      return () => clearInterval(interval);
    } else {
      // Comments Subscription
      const commentsRef = collection(db, "reports", selectedReportId, "comments");
      const commentsQuery = query(commentsRef, orderBy("createdAt", "asc"));
      const unsubscribeComments = onSnapshot(commentsQuery, (snap) => {
        const list: IssueComment[] = [];
        snap.forEach((d) => list.push(d.data() as IssueComment));
        setComments(list);
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, `reports/${selectedReportId}/comments`);
      });

      // Verifications Subscription
      const verificationsRef = collection(db, "reports", selectedReportId, "verifications");
      const unsubscribeVerifications = onSnapshot(verificationsRef, (snap) => {
        const list: VerificationVote[] = [];
        snap.forEach((d) => list.push(d.data() as VerificationVote));
        setVerifications(list);
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, `reports/${selectedReportId}/verifications`);
      });

      return () => {
        unsubscribeComments();
        unsubscribeVerifications();
      };
    }
  }, [user, selectedReportId, isSandbox]);

  // Subscribe to Real-time Notifications for Logged-In User
  React.useEffect(() => {
    if (!user) {
      setNotifications([]);
      return;
    }

    if (isSandbox) {
      const loadNotifications = () => {
        const local = localStorage.getItem("sandbox_notifications") || "[]";
        try {
          const parsed = JSON.parse(local)
            .filter((n: any) => n.userId === user.uid)
            .map((n: any) => ({
              ...n,
              createdAt: n.createdAt?.seconds
                ? Timestamp.fromMillis(n.createdAt.seconds * 1000)
                : Timestamp.fromDate(new Date(n.createdAt || Date.now()))
            }));
          setNotifications(parsed);
        } catch (e) {
          console.error("Failed to parse sandbox notifications:", e);
        }
      };
      loadNotifications();
      const interval = setInterval(loadNotifications, 1000);
      return () => clearInterval(interval);
    } else {
      const notificationsRef = collection(db, "users", user.uid, "notifications");
      const q = query(notificationsRef, orderBy("createdAt", "desc"));

      const unsubscribe = onSnapshot(q, (snap) => {
        const list: UserNotification[] = [];
        snap.forEach((doc) => {
          list.push(doc.data() as UserNotification);
        });
        setNotifications(list);
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, `users/${user.uid}/notifications`);
      });

      return unsubscribe;
    }
  }, [user, isSandbox]);

  const handleMarkAsRead = async (notifId: string) => {
    if (!user) return;
    if (isSandbox) {
      const local = localStorage.getItem("sandbox_notifications") || "[]";
      try {
        const parsed = JSON.parse(local);
        const updated = parsed.map((n: any) => n.id === notifId ? { ...n, read: true } : n);
        localStorage.setItem("sandbox_notifications", JSON.stringify(updated));
      } catch (e) {
        console.error(e);
      }
      return;
    }
    const notifRef = doc(db, "users", user.uid, "notifications", notifId);
    try {
      await updateDoc(notifRef, {
        read: true,
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}/notifications/${notifId}`);
    }
  };

  const handleMarkAllAsRead = async () => {
    if (!user || notifications.length === 0) return;
    if (isSandbox) {
      const local = localStorage.getItem("sandbox_notifications") || "[]";
      try {
        const parsed = JSON.parse(local);
        const updated = parsed.map((n: any) => n.userId === user.uid ? { ...n, read: true } : n);
        localStorage.setItem("sandbox_notifications", JSON.stringify(updated));
      } catch (e) {
        console.error(e);
      }
      return;
    }
    try {
      const unread = notifications.filter(n => !n.read);
      for (const n of unread) {
        const notifRef = doc(db, "users", user.uid, "notifications", n.id);
        await updateDoc(notifRef, { read: true });
      }
    } catch (err) {
      console.error("Failed to mark all as read:", err);
    }
  };

  const handleDeleteNotification = async (notifId: string) => {
    if (!user) return;
    if (isSandbox) {
      const local = localStorage.getItem("sandbox_notifications") || "[]";
      try {
        const parsed = JSON.parse(local);
        const updated = parsed.filter((n: any) => n.id !== notifId);
        localStorage.setItem("sandbox_notifications", JSON.stringify(updated));
      } catch (e) {
        console.error(e);
      }
      return;
    }
    const notifRef = doc(db, "users", user.uid, "notifications", notifId);
    try {
      await deleteDoc(notifRef);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `users/${user.uid}/notifications/${notifId}`);
    }
  };

  // Google Provider Authentication Setup
  const handleGoogleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (err: any) {
      console.error("Google Auth failed. Trying fallback sign-in...", err);
      // Fallback: seamless experience inside constrained layouts
      try {
        await signInAnonymously(auth);
      } catch (anonErr: any) {
        console.error("Anonymous sign-in failed. Falling back to Sandbox Mode...", anonErr);
        setAuthError(err.message || "Google Sign-In popup closed by user.");
        enableSandboxMode("Google Guardian");
      }
    }
  };

  const handleTestLogin = async () => {
    try {
      await signInAnonymously(auth);
    } catch (err: any) {
      console.error("Test Login failed. Falling back to Sandbox Mode...", err);
      setAuthError("Project is restricted or client is offline. Entered Sandbox Mode.");
      enableSandboxMode("Test Guardian");
    }
  };

  const handleLogout = async () => {
    if (isSandbox) {
      setIsSandbox(false);
      setUser(null);
      setProfile(null);
      setSelectedReportId(null);
      return;
    }
    await signOut(auth);
    setSelectedReportId(null);
  };

  // Toggle citizen / municipal official roles for interactive testing
  const handleToggleRole = async () => {
    if (!user || !profile) return;
    const newRole = profile.role === "citizen" ? "municipal_agent" : "citizen";
    if (isSandbox) {
      setProfile({ ...profile, role: newRole });
      return;
    }
    const userRef = doc(db, "users", user.uid);
    try {
      await updateDoc(userRef, { 
        role: newRole,
        updatedAt: Timestamp.now()
      });
      setProfile({ ...profile, role: newRole });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}`);
    }
  };

  // Update Profile settings
  const handleUpdateSettings = async (hideOld: boolean) => {
    if (!profile) return;
    const updatedProfile = { ...profile, hideOldReports: hideOld };
    setProfile(updatedProfile);

    if (isSandbox) {
      localStorage.setItem("sandbox_hide_old_reports", hideOld ? "true" : "false");
    } else if (user) {
      const userRef = doc(db, "users", user.uid);
      try {
        await updateDoc(userRef, {
          hideOldReports: hideOld,
          updatedAt: Timestamp.now(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}`);
      }
    }
  };

  // Create Issue Submission handler
  const handleReportIssue = async (issueData: {
    title: string;
    description: string;
    category: string;
    imageUrl: string;
    severity: 'Low' | 'Medium' | 'High' | 'Critical';
    latitude: number;
    longitude: number;
    address: string;
  }) => {
    if (!user || !profile) return;
    const reportId = `report_${Date.now()}`;
    const newReport: CommunityReport = {
      ...issueData,
      id: reportId,
      status: "Reported",
      reporterId: user.uid,
      reporterName: profile.displayName,
      upvotes: 0,
      createdAt: { seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 } as any,
      updatedAt: { seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 } as any,
    };

    if (isSandbox) {
      const local = localStorage.getItem("sandbox_reports") || "[]";
      try {
        const parsed = JSON.parse(local);
        parsed.unshift(newReport);
        localStorage.setItem("sandbox_reports", JSON.stringify(parsed));
        
        const newPoints = profile.points + 50;
        const newReportsCount = profile.reportsCount + 1;
        setProfile({ ...profile, points: newPoints, reportsCount: newReportsCount });
        setSelectedReportId(reportId);
      } catch (e) {
        console.error(e);
      }
      return;
    }

    try {
      // 1. Save Report Document
      await setDoc(doc(db, "reports", reportId), newReport);

      // 2. Award User Points (+50 XP for reporting!) and increment count
      const userRef = doc(db, "users", user.uid);
      const newPoints = profile.points + 50;
      const newReportsCount = profile.reportsCount + 1;
      await updateDoc(userRef, {
        points: newPoints,
        reportsCount: newReportsCount,
        updatedAt: Timestamp.now(),
      });

      // Update local profile state
      setProfile({ ...profile, points: newPoints, reportsCount: newReportsCount });
      setSelectedReportId(reportId);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `reports/${reportId}`);
    }
  };

  // Edit details of a self-reported hazard
  const handleEditReport = async (
    reportId: string,
    updatedData: {
      title: string;
      description: string;
      category: string;
      severity: "Low" | "Medium" | "High" | "Critical";
    }
  ) => {
    if (!user) return;
    if (isSandbox) {
      const local = localStorage.getItem("sandbox_reports") || "[]";
      try {
        const parsed = JSON.parse(local);
        const updated = parsed.map((r: any) => r.id === reportId ? { ...r, ...updatedData, updatedAt: { seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 } } : r);
        localStorage.setItem("sandbox_reports", JSON.stringify(updated));
      } catch (e) {
        console.error(e);
      }
      return;
    }
    try {
      const reportRef = doc(db, "reports", reportId);
      await updateDoc(reportRef, {
        ...updatedData,
        updatedAt: Timestamp.now(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `reports/${reportId}`);
    }
  };

  // Remove a self-reported hazard
  const handleDeleteReport = async (reportId: string) => {
    if (!user) return;
    if (isSandbox) {
      const local = localStorage.getItem("sandbox_reports") || "[]";
      try {
        const parsed = JSON.parse(local);
        const updated = parsed.filter((r: any) => r.id !== reportId);
        localStorage.setItem("sandbox_reports", JSON.stringify(updated));
        if (selectedReportId === reportId) {
          setSelectedReportId(null);
        }
      } catch (e) {
        console.error(e);
      }
      return;
    }
    try {
      const reportRef = doc(db, "reports", reportId);
      await deleteDoc(reportRef);
      if (selectedReportId === reportId) {
        setSelectedReportId(null);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `reports/${reportId}`);
    }
  };

  // Verification / Upvote validation engine
  const handleVerifyReport = async (report: CommunityReport) => {
    if (!user || !profile) return;
    
    // Check if they already verified this issue to avoid multi-voting
    const hasAlreadyVerified = verifications.some((v) => v.userId === user.uid);
    if (hasAlreadyVerified) return;

    const verificationId = `v_${user.uid}`;

    if (isSandbox) {
      try {
        const verificationsLocal = JSON.parse(localStorage.getItem("sandbox_verifications") || "[]");
        verificationsLocal.push({
          id: verificationId,
          userId: user.uid,
          userName: profile.displayName,
          reportId: report.id,
          createdAt: { seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 },
        });
        localStorage.setItem("sandbox_verifications", JSON.stringify(verificationsLocal));

        const reportsLocal = JSON.parse(localStorage.getItem("sandbox_reports") || "[]");
        const updatedReports = reportsLocal.map((r: any) => 
          r.id === report.id ? { ...r, upvotes: r.upvotes + 1, updatedAt: { seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 } } : r
        );
        localStorage.setItem("sandbox_reports", JSON.stringify(updatedReports));

        const newPoints = profile.points + 15;
        const newVerificationsCount = profile.verificationsCount + 1;
        setProfile({ ...profile, points: newPoints, verificationsCount: newVerificationsCount });
      } catch (e) {
        console.error(e);
      }
      return;
    }

    const verificationRef = doc(db, "reports", report.id, "verifications", verificationId);

    try {
      // 1. Add verification document
      await setDoc(verificationRef, {
        id: verificationId,
        userId: user.uid,
        userName: profile.displayName,
        createdAt: Timestamp.now(),
      });

      // 2. Increment parent report upvotes
      const reportRef = doc(db, "reports", report.id);
      await updateDoc(reportRef, {
        upvotes: report.upvotes + 1,
        updatedAt: Timestamp.now(),
      });

      // 3. Award verifying citizen points (+15 XP) and increment verification count
      const userRef = doc(db, "users", user.uid);
      const newPoints = profile.points + 15;
      const newVerificationsCount = profile.verificationsCount + 1;
      await updateDoc(userRef, {
        points: newPoints,
        verificationsCount: newVerificationsCount,
        updatedAt: Timestamp.now(),
      });

      setProfile({ ...profile, points: newPoints, verificationsCount: newVerificationsCount });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `reports/${report.id}/verifications/${verificationId}`);
    }
  };

  // Submit Comments
  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile || !selectedReportId || !newCommentText.trim()) return;

    const commentId = `c_${Date.now()}`;

    if (isSandbox) {
      try {
        const commentsLocal = JSON.parse(localStorage.getItem("sandbox_comments") || "[]");
        const newComment = {
          id: commentId,
          reportId: selectedReportId,
          userId: user.uid,
          userName: profile.displayName,
          userRole: profile.role,
          text: newCommentText,
          createdAt: { seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 },
        };
        commentsLocal.push(newComment);
        localStorage.setItem("sandbox_comments", JSON.stringify(commentsLocal));

        const currentReport = reports.find((r) => r.id === selectedReportId);
        if (currentReport) {
          const previousCommenters = Array.from(new Set<string>(
            comments
              .map((c) => c.userId)
              .filter((uid) => uid !== user.uid && uid !== currentReport.reporterId && uid !== "municipal_system")
          ));

          const notificationsLocal = JSON.parse(localStorage.getItem("sandbox_notifications") || "[]");

          // Create notification for original reporter
          if (currentReport.reporterId && currentReport.reporterId !== user.uid && currentReport.reporterId !== "municipal_system") {
            const notifId = `notif_${Date.now()}_rep`;
            notificationsLocal.push({
              id: notifId,
              userId: currentReport.reporterId,
              type: "new_comment",
              title: "New Comment on Your Report",
              message: `${profile.displayName} commented: "${newCommentText.substring(0, 50)}${newCommentText.length > 50 ? "..." : ""}"`,
              reportId: currentReport.id,
              reportTitle: currentReport.title,
              commentId: commentId,
              read: false,
              createdAt: { seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 },
            });
          }

          // Create notification for all previous commenters
          for (const uid of previousCommenters) {
            const notifId = `notif_${Date.now()}_${uid}`;
            notificationsLocal.push({
              id: notifId,
              userId: uid,
              type: "new_comment",
              title: "New Comment on Followed Discussion",
              message: `${profile.displayName} commented on "${currentReport.title}": "${newCommentText.substring(0, 50)}${newCommentText.length > 50 ? "..." : ""}"`,
              reportId: currentReport.id,
              reportTitle: currentReport.title,
              commentId: commentId,
              read: false,
              createdAt: { seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 },
            });
          }

          localStorage.setItem("sandbox_notifications", JSON.stringify(notificationsLocal));
        }

        if (selectedReportId) {
          localStorage.removeItem(`comment_draft_${selectedReportId}`);
        }
        setNewCommentText("");
      } catch (err) {
        console.error(err);
      }
      return;
    }

    const commentRef = doc(db, "reports", selectedReportId, "comments", commentId);

    try {
      await setDoc(commentRef, {
        id: commentId,
        userId: user.uid,
        userName: profile.displayName,
        userRole: profile.role,
        text: newCommentText,
        createdAt: Timestamp.now(),
      });

      const currentReport = reports.find((r) => r.id === selectedReportId);
      if (currentReport) {
        // Find unique previous commenters (except the reporter and the current commenter)
        const previousCommenters = Array.from(new Set<string>(
          comments
            .map((c) => c.userId)
            .filter((uid) => uid !== user.uid && uid !== currentReport.reporterId && uid !== "municipal_system")
        ));

        // Create notification for original reporter
        if (currentReport.reporterId && currentReport.reporterId !== user.uid && currentReport.reporterId !== "municipal_system") {
          const notifId = `notif_${Date.now()}_rep`;
          const notifRef = doc(db, "users", currentReport.reporterId, "notifications", notifId);
          await setDoc(notifRef, {
            id: notifId,
            userId: currentReport.reporterId,
            type: "new_comment",
            title: "New Comment on Your Report",
            message: `${profile.displayName} commented: "${newCommentText.substring(0, 50)}${newCommentText.length > 50 ? "..." : ""}"`,
            reportId: currentReport.id,
            reportTitle: currentReport.title,
            commentId: commentId,
            read: false,
            createdAt: Timestamp.now(),
          });
        }

        // Create notification for all previous commenters
        for (const uid of previousCommenters) {
          const notifId = `notif_${Date.now()}_${uid}`;
          const notifRef = doc(db, "users", uid, "notifications", notifId);
          await setDoc(notifRef, {
            id: notifId,
            userId: uid,
            type: "new_comment",
            title: "New Comment on Followed Discussion",
            message: `${profile.displayName} commented on "${currentReport.title}": "${newCommentText.substring(0, 50)}${newCommentText.length > 50 ? "..." : ""}"`,
            reportId: currentReport.id,
            reportTitle: currentReport.title,
            commentId: commentId,
            read: false,
            createdAt: Timestamp.now(),
          });
        }
      }

      if (selectedReportId) {
        localStorage.removeItem(`comment_draft_${selectedReportId}`);
      }
      setNewCommentText("");
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `reports/${selectedReportId}/comments/${commentId}`);
    }
  };

  // Flag inappropriate comment for moderation
  const handleFlagComment = async (comment: IssueComment) => {
    if (!user || !selectedReportId) return;
    if (isSandbox) {
      try {
        const commentsLocal = JSON.parse(localStorage.getItem("sandbox_comments") || "[]");
        const updated = commentsLocal.map((c: any) => {
          if (c.id === comment.id) {
            const flaggedBy = c.flaggedBy || [];
            if (!flaggedBy.includes(user.uid)) {
              flaggedBy.push(user.uid);
            }
            return { ...c, flagged: true, flaggedBy };
          }
          return c;
        });
        localStorage.setItem("sandbox_comments", JSON.stringify(updated));
      } catch (e) {
        console.error(e);
      }
      return;
    }
    try {
      const commentRef = doc(db, "reports", selectedReportId, "comments", comment.id);
      const flaggedBy = comment.flaggedBy || [];
      if (!flaggedBy.includes(user.uid)) {
        flaggedBy.push(user.uid);
      }
      await updateDoc(commentRef, {
        flagged: true,
        flaggedBy: flaggedBy,
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `reports/${selectedReportId}/comments/${comment.id}`);
    }
  };

  // Moderate flagged comment (Dismiss flags or delete comment)
  const handleModerateComment = async (commentId: string, action: "dismiss" | "delete") => {
    if (!user || !profile || !selectedReportId) return;
    if (profile.role !== "municipal_agent" && profile.role !== "admin") return;

    if (isSandbox) {
      try {
        const commentsLocal = JSON.parse(localStorage.getItem("sandbox_comments") || "[]");
        let updated;
        if (action === "delete") {
          updated = commentsLocal.filter((c: any) => c.id !== commentId);
        } else {
          updated = commentsLocal.map((c: any) => c.id === commentId ? { ...c, flagged: false, flaggedBy: [] } : c);
        }
        localStorage.setItem("sandbox_comments", JSON.stringify(updated));
      } catch (e) {
        console.error(e);
      }
      return;
    }

    try {
      const commentRef = doc(db, "reports", selectedReportId, "comments", commentId);
      if (action === "delete") {
        await deleteDoc(commentRef);
      } else {
        await updateDoc(commentRef, {
          flagged: false,
          flaggedBy: [],
        });
      }
    } catch (err) {
      handleFirestoreError(
        err,
        action === "delete" ? OperationType.DELETE : OperationType.UPDATE,
        `reports/${selectedReportId}/comments/${commentId}`
      );
    }
  };

  // Municipal Agent Action: Status and response updates
  const handleUpdateStatus = async (status: 'Reported' | 'Investigating' | 'In Progress' | 'Resolved', fixSummary?: string) => {
    if (!user || !profile || !selectedReportId) return;
    if (profile.role !== "municipal_agent" && profile.role !== "admin") return;

    let updateText = `Official Update: Status transitioned to [${status}].`;
    if (status === "Resolved") {
      updateText = `Official Resolution: This issue has been fully inspected and resolved by Municipal authorities. Thank you to everyone for reporting and verifying!`;
      if (fixSummary && fixSummary.trim() !== "") {
        updateText += `\n\nFix Summary: ${fixSummary.trim()}`;
      }
    } else if (status === "In Progress") {
      updateText = `Official Action: Maintenance crews have been dispatched to the site to implement repairs.`;
    } else if (status === "Investigating") {
      updateText = `Official Action: Assigned to local municipal inspector to assess structural safety risks.`;
    }

    if (isSandbox) {
      try {
        // 1. Update status
        const reportsLocal = JSON.parse(localStorage.getItem("sandbox_reports") || "[]");
        const updatedReports = reportsLocal.map((r: any) => 
          r.id === selectedReportId ? { ...r, status: status, updatedAt: { seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 } } : r
        );
        localStorage.setItem("sandbox_reports", JSON.stringify(updatedReports));

        // 2. Add municipal comment
        const commentsLocal = JSON.parse(localStorage.getItem("sandbox_comments") || "[]");
        const commentId = `m_update_${Date.now()}`;
        commentsLocal.push({
          id: commentId,
          reportId: selectedReportId,
          userId: user.uid,
          userName: `${profile.displayName} (Official)`,
          userRole: profile.role,
          text: updateText,
          createdAt: { seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 },
        });
        localStorage.setItem("sandbox_comments", JSON.stringify(commentsLocal));

        const currentReport = reports.find((r) => r.id === selectedReportId);

        // 3. Create notification for reporter
        if (currentReport && currentReport.reporterId && currentReport.reporterId !== "municipal_system") {
          const notificationsLocal = JSON.parse(localStorage.getItem("sandbox_notifications") || "[]");
          notificationsLocal.push({
            id: `notif_${Date.now()}`,
            userId: currentReport.reporterId,
            type: "status_change",
            title: "Issue Status Updated",
            message: `Your report "${currentReport.title}" has been updated to "${status}".`,
            reportId: currentReport.id,
            reportTitle: currentReport.title,
            read: false,
            createdAt: { seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 },
          });
          localStorage.setItem("sandbox_notifications", JSON.stringify(notificationsLocal));
        }

        // 4. Award original reporter XP if resolved
        if (status === "Resolved" && currentReport && currentReport.reporterId !== "municipal_system" && currentReport.reporterId === user.uid) {
          const newPoints = profile.points + 100;
          setProfile({ ...profile, points: newPoints });
        }
      } catch (e) {
        console.error(e);
      }
      return;
    }

    const reportRef = doc(db, "reports", selectedReportId);
    
    try {
      await updateDoc(reportRef, {
        status: status,
        updatedAt: Timestamp.now(),
      });

      // Automatically add a municipal comment documenting the status update
      const commentId = `m_update_${Date.now()}`;
      const commentRef = doc(db, "reports", selectedReportId, "comments", commentId);

      await setDoc(commentRef, {
        id: commentId,
        userId: user.uid,
        userName: `${profile.displayName} (Official)`,
        userRole: profile.role,
        text: updateText,
        createdAt: Timestamp.now(),
      });

      const currentReport = reports.find((r) => r.id === selectedReportId);

      // Alert the reporter about status change
      if (currentReport && currentReport.reporterId && currentReport.reporterId !== "municipal_system") {
        const notifId = `notif_${Date.now()}`;
        const notifRef = doc(db, "users", currentReport.reporterId, "notifications", notifId);
        await setDoc(notifRef, {
          id: notifId,
          userId: currentReport.reporterId,
          type: "status_change",
          title: "Issue Status Updated",
          message: `Your report "${currentReport.title}" has been updated to "${status}".`,
          reportId: currentReport.id,
          reportTitle: currentReport.title,
          read: false,
          createdAt: Timestamp.now(),
        });
      }

      // Reward the original reporter with significant XP on resolution! (+100 XP)
      if (status === "Resolved" && currentReport && currentReport.reporterId !== "municipal_system") {
        const reporterRef = doc(db, "users", currentReport.reporterId);
        const repSnap = await getDoc(reporterRef);
        if (repSnap.exists()) {
          const reporterProfile = repSnap.data() as UserProfile;
          await updateDoc(reporterRef, {
            points: reporterProfile.points + 100,
            updatedAt: Timestamp.now(),
          });
        }
      }

    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `reports/${selectedReportId}`);
    }
  };

  // Filtered reports computed list
  const filteredReports = React.useMemo(() => {
    return reports.filter((r) => {
      const matchCat = categoryFilter === "All" || r.category === categoryFilter;
      const matchStat = statusFilter === "All" || r.status === statusFilter;
      
      const q = searchQuery.trim().toLowerCase();
      const matchSearch = q === "" || 
        r.title.toLowerCase().includes(q) || 
        r.address.toLowerCase().includes(q) ||
        (r.description && r.description.toLowerCase().includes(q));

      let matchesHideOld = true;
      if (profile?.hideOldReports) {
        if (r.createdAt) {
          const createdMs = r.createdAt.toDate 
            ? r.createdAt.toDate().getTime() 
            : (r.createdAt.seconds !== undefined ? r.createdAt.seconds * 1000 : new Date(r.createdAt).getTime());
          const ageInDays = (Date.now() - createdMs) / (1000 * 60 * 60 * 24);
          if (ageInDays > 90) {
            matchesHideOld = false;
          }
        }
      }

      let matchDistance = true;
      if (enableDistanceFilter && userLocation) {
        const dist = getDistanceInMeters(
          userLocation.lat,
          userLocation.lng,
          r.latitude,
          r.longitude
        );
        if (dist > maxDistance * 1000) {
          matchDistance = false;
        }
      }

      return matchCat && matchStat && matchSearch && matchesHideOld && matchDistance;
    });
  }, [reports, categoryFilter, statusFilter, searchQuery, profile?.hideOldReports, enableDistanceFilter, maxDistance, userLocation]);

  // Statistics counters
  const stats = React.useMemo(() => {
    const active = reports.filter((r) => r.status === "Reported" || r.status === "Investigating").length;
    const progress = reports.filter((r) => r.status === "In Progress").length;
    const resolved = reports.filter((r) => r.status === "Resolved").length;
    return { active, progress, resolved };
  }, [reports]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center">
        <Sparkles className="w-12 h-12 text-blue-600 dark:text-blue-400 animate-pulse mb-4" />
        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 font-display">Booting Samadhaan Engine...</p>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-sans">Connecting to Firestore secure database...</p>
      </div>
    );
  }

  // --- LOGIN PANEL ---
  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4 relative overflow-hidden">
        {/* Ambient backlighting */}
        <div className="absolute -top-40 -left-40 w-[600px] h-[600px] bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-40 -right-40 w-[600px] h-[600px] bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 shadow-xl relative z-10 text-center space-y-8">
          <div className="space-y-3">
            <div className="inline-flex p-3 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 rounded-2xl border border-blue-100 dark:border-blue-900/50 mb-2">
              <Sparkles className="w-8 h-8" />
            </div>
            <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white font-display tracking-tight">Samadhaan</h1>
            <p className="text-slate-500 dark:text-slate-400 text-xs px-2 leading-relaxed font-sans">
              Report local hazards, upvote civic issues, track municipal repairs, and earn points as a hyperlocal guardian.
            </p>
          </div>

          {authError && (
            <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 text-amber-800 dark:text-amber-400 rounded-xl p-3.5 text-xs text-left leading-relaxed space-y-1">
              <span className="font-semibold block">Notice:</span>
              <span>Iframe or permission restrictions detected. We have automatically activated a full Sandbox Mode with offline localStorage storage so you can test all features seamlessly.</span>
            </div>
          )}

          <div className="space-y-3.5">
            <button
              onClick={handleGoogleLogin}
              className="w-full flex items-center justify-center gap-3 py-3 px-5 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-white border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-sm transition-all hover-scale shadow-sm cursor-pointer"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.85z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.85c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Sign In with Google
            </button>

            <button
              onClick={handleTestLogin}
              className="w-full py-3 px-5 bg-slate-900 dark:bg-slate-100 hover:bg-slate-800 dark:hover:bg-white text-white dark:text-slate-900 rounded-xl font-bold text-sm transition-colors cursor-pointer border border-transparent"
            >
              Instant Mock Test Access
            </button>
          </div>

          <div className="border-t border-slate-100 dark:border-slate-800 pt-6 flex items-center justify-center gap-3 text-[10px] text-slate-400 dark:text-slate-500 font-mono">
            <span>Enterprise Firestore Active</span>
            <span>•</span>
            <span>Zero-Trust ABAC Rules</span>
          </div>
        </div>
      </div>
    );
  }

  // Active report details document
  const selectedReport = reports.find((r) => r.id === selectedReportId);

  // --- MAIN APP PANEL ---
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 flex flex-col font-sans pb-10">
      
      {/* Top Banner Header */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 py-4 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-50 dark:bg-blue-950/40 rounded-xl border border-blue-100 dark:border-blue-900/50 text-blue-600 dark:text-blue-400">
              <Sparkles className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-slate-900 dark:text-white font-display tracking-wide">Samadhaan</h1>
                {isSandbox ? (
                  <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-bold uppercase font-mono bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 text-amber-750 dark:text-amber-400 select-none shadow-sm" title="Active Sandbox Mode using offline localStorage">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 block"></span>
                    Sandbox Mode
                  </div>
                ) : isOnline ? (
                  <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-bold uppercase font-mono bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 text-emerald-700 dark:text-emerald-400 select-none shadow-sm" title="Connected to Firestore secure database">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 block"></span>
                    Synced
                  </div>
                ) : (
                  <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-bold uppercase font-mono bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-900/40 text-amber-800 dark:text-amber-400 animate-pulse select-none shadow-sm" title="Firestore connectivity lost. Changes are buffered locally and will sync once connection is restored.">
                    <span className="relative flex h-1.5 w-1.5 shrink-0">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-500"></span>
                    </span>
                    Unsynced
                  </div>
                )}
              </div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400">Hyperlocal Civic Problem Solver</p>
            </div>
          </div>

          {/* Controls / Profile */}
          {profile && (
            <div className="flex flex-wrap items-center gap-3.5">
              
              {/* Role Tester Toggle */}
              <button
                onClick={handleToggleRole}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl border text-[11px] font-bold transition-all cursor-pointer ${
                  profile.role === "municipal_agent"
                    ? "bg-indigo-50 border-indigo-200 text-indigo-600 dark:bg-indigo-950/40 dark:border-indigo-900/40 dark:text-indigo-400"
                    : "bg-slate-100 border-slate-200 text-slate-600 hover:text-slate-800 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-350 dark:hover:text-white"
                }`}
                title="Toggle experience to test citizen or municipal admin features"
              >
                {profile.role === "municipal_agent" ? (
                  <>
                    <UserCheck className="w-4 h-4 text-indigo-500" />
                    Municipal Agent View
                  </>
                ) : (
                  <>
                    <User className="w-4 h-4 text-slate-400" />
                    Citizen View
                  </>
                )}
              </button>

              {/* User XP stats */}
              <div className="flex items-center gap-2.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3.5 py-1.5 rounded-xl">
                <img
                  src={profile.photoURL || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=80&q=80"}
                  alt={profile.displayName}
                  className="w-6 h-6 rounded-lg object-cover"
                  referrerPolicy="no-referrer"
                />
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 truncate max-w-[100px]">
                  {profile.displayName}
                </span>
                <span className="text-xs font-bold text-blue-600 dark:text-blue-400 font-mono">
                  {profile.points} XP
                </span>
              </div>

              {/* Real-time Notification Bell */}
              <div className="relative">
                <button
                  onClick={() => setIsNotificationOpen(!isNotificationOpen)}
                  className="p-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-white transition-colors cursor-pointer relative"
                  title="Notifications"
                >
                  <Bell className="w-4 h-4" />
                  {notifications.filter((n) => !n.read).length > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[9px] font-bold text-white ring-2 ring-white dark:ring-slate-900 animate-pulse">
                      {notifications.filter((n) => !n.read).length}
                    </span>
                  )}
                </button>

                {/* Notifications Dropdown */}
                {isNotificationOpen && (
                  <div className="absolute right-0 mt-2.5 w-80 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl z-50 overflow-hidden flex flex-col max-h-[350px]">
                    <div className="px-4 py-3 bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-800 dark:text-white font-display">Notifications</span>
                      {notifications.some((n) => !n.read) && (
                        <button
                          onClick={handleMarkAllAsRead}
                          className="text-[10px] text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-bold uppercase tracking-wider transition-colors"
                        >
                          Mark all read
                        </button>
                      )}
                    </div>

                    <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                      {notifications.length === 0 ? (
                        <div className="p-8 text-center text-slate-400 dark:text-slate-500">
                          <p className="text-xs font-sans">No notifications yet</p>
                        </div>
                      ) : (
                        notifications.map((notif) => (
                          <div
                            key={notif.id}
                            className={`p-3.5 flex items-start gap-2.5 transition-colors ${
                              notif.read ? "bg-white dark:bg-slate-900" : "bg-blue-50/10 dark:bg-blue-950/10"
                            }`}
                          >
                            <span
                              className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${
                                notif.read ? "bg-transparent" : "bg-blue-600"
                              }`}
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-1">
                                <p className="text-[11px] font-bold text-slate-800 dark:text-slate-200 truncate">
                                  {notif.title}
                                </p>
                                <span className="text-[9px] text-slate-400 dark:text-slate-500 shrink-0 font-mono">
                                  {notif.createdAt?.toDate ? (
                                    new Date(notif.createdAt.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                  ) : "Just now"}
                                </span>
                              </div>
                              <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5 line-clamp-2 leading-relaxed font-sans">
                                {notif.message}
                              </p>
                              <button
                                onClick={() => {
                                  setSelectedReportId(notif.reportId);
                                  handleMarkAsRead(notif.id);
                                  setIsNotificationOpen(false);
                                  setActiveTab("map");
                                }}
                                className="text-[10px] text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-semibold mt-1.5 flex items-center gap-0.5 font-sans"
                              >
                                View details <ChevronRight className="w-3.5 h-3.5" />
                              </button>
                            </div>
                            <button
                              onClick={() => handleDeleteNotification(notif.id)}
                              className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 dark:text-slate-500 hover:text-rose-600 transition-colors shrink-0"
                              title="Delete notification"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Tour Guide Button */}
              <button
                onClick={startTour}
                className="p-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 rounded-xl transition-colors cursor-pointer flex items-center justify-center"
                title="Launch Platform Tour"
              >
                <HelpCircle className="w-4 h-4 animate-pulse" />
              </button>

              {/* Theme Toggle Button */}
              <button
                onClick={() => setDarkMode(!darkMode)}
                className="p-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 rounded-xl transition-colors cursor-pointer"
                title={darkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
              >
                {darkMode ? <Sun className="w-4 h-4 text-amber-500" /> : <Moon className="w-4 h-4" />}
              </button>

              {/* Profile Settings Button */}
              <button
                onClick={() => setShowSettingsModal(true)}
                className="p-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 rounded-xl transition-colors cursor-pointer"
                title="Profile Settings"
                id="profile-settings-btn"
              >
                <Settings className="w-4 h-4" />
              </button>

              {/* Logout */}
              <button
                onClick={handleLogout}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-500 dark:text-slate-400 hover:text-rose-600 transition-colors cursor-pointer border border-slate-200 dark:border-slate-800 sm:border-0"
                title="Log Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}

        </div>
      </header>

      {/* Sticky Geolocation Proximity Warning Banner */}
      {activeProximityAlert && (
        <div className="bg-rose-600 text-white py-3 px-4 sm:px-6 sticky top-[73px] z-30 shadow-md animate-pulse">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-rose-700 rounded-xl text-white border border-rose-500 shrink-0">
                <AlertOctagon className="w-5 h-5" />
              </div>
              <div className="text-center sm:text-left">
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                  <span className="bg-white text-rose-700 text-[9px] font-extrabold px-2 py-0.5 rounded uppercase tracking-wider font-mono">
                    PROXIMITY WARNING: {activeProximityAlert.severity}
                  </span>
                  <span className="text-xs font-bold font-mono">
                    Within 500 Meters!
                  </span>
                </div>
                <p className="text-xs font-semibold mt-1">
                  &ldquo;{activeProximityAlert.title}&rdquo; is located near you at {activeProximityAlert.address}. Exercise extreme safety.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3.5 shrink-0">
              <button
                onClick={() => {
                  setSelectedReportId(activeProximityAlert.id);
                  setActiveTab("map");
                  // Smoothly scroll down to map element
                  const mapElement = document.getElementById("map-anchor");
                  if (mapElement) {
                    mapElement.scrollIntoView({ behavior: "smooth" });
                  }
                }}
                className="px-3.5 py-1.5 bg-white hover:bg-rose-50 text-rose-700 rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
              >
                Track Hazard
              </button>
              <button
                onClick={() => {
                  setAcknowledgedAlerts((prev) => ({ ...prev, [activeProximityAlert.id]: true }));
                }}
                className="p-1.5 bg-rose-700 hover:bg-rose-800 rounded-lg text-white/90 hover:text-white transition-colors cursor-pointer"
                title="Acknowledge and Dismiss Alert"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 md:px-6 mt-8 space-y-8">
        
        {/* Core Stats Overview widget */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex items-center justify-between shadow-sm">
            <div>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 font-mono uppercase">Hazards Reported</p>
              <h3 className="text-2xl font-bold text-rose-500 font-mono mt-1">{stats.active}</h3>
            </div>
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 text-rose-500 rounded-xl border border-rose-100 dark:border-rose-900/40">
              <ShieldAlert className="w-6 h-6" />
            </div>
          </div>
          
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex items-center justify-between shadow-sm">
            <div>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 font-mono uppercase">Under Repair</p>
              <h3 className="text-2xl font-bold text-indigo-500 font-mono mt-1">{stats.progress}</h3>
            </div>
            <div className="p-3 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-500 rounded-xl border border-indigo-100 dark:border-indigo-900/40">
              <Activity className="w-6 h-6 animate-pulse" />
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex items-center justify-between shadow-sm">
            <div>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 font-mono uppercase">Verified Fixes</p>
              <h3 className="text-2xl font-bold text-emerald-500 font-mono mt-1">{stats.resolved}</h3>
            </div>
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-400 rounded-xl border border-emerald-100 dark:border-emerald-900/40">
              <CheckCircle2 className="w-6 h-6" />
            </div>
          </div>
        </div>        {/* Tab Navigation selectors */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 gap-1.5">
          <button
            onClick={() => setActiveTab("map")}
            className={`px-4 py-2.5 text-xs font-bold font-display border-b-2 transition-colors cursor-pointer ${
              activeTab === "map"
                ? "border-blue-600 text-slate-900 dark:text-white"
                : "border-transparent text-slate-500 dark:text-slate-450 hover:text-slate-800 dark:hover:text-white"
            }`}
          >
            Dashboard & Live Map
          </button>
          <button
            onClick={() => setActiveTab("insights")}
            className={`px-4 py-2.5 text-xs font-bold font-display border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === "insights"
                ? "border-blue-600 text-slate-900 dark:text-white"
                : "border-transparent text-slate-500 dark:text-slate-450 hover:text-slate-800 dark:hover:text-white"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            Predictive AI Insights
          </button>
          <button
            onClick={() => setActiveTab("leaderboard")}
            className={`px-4 py-2.5 text-xs font-bold font-display border-b-2 transition-colors cursor-pointer ${
              activeTab === "leaderboard"
                ? "border-blue-600 text-slate-900 dark:text-white"
                : "border-transparent text-slate-500 dark:text-slate-450 hover:text-slate-800 dark:hover:text-white"
            }`}
          >
            Top Samadhaan Leaders
          </button>
          <button
            onClick={() => setActiveTab("my-activity")}
            className={`px-4 py-2.5 text-xs font-bold font-display border-b-2 transition-colors cursor-pointer ${
              activeTab === "my-activity"
                ? "border-blue-600 text-slate-900 dark:text-white"
                : "border-transparent text-slate-500 dark:text-slate-450 hover:text-slate-800 dark:hover:text-white"
            }`}
          >
            My Activity
          </button>
          <button
            onClick={() => setActiveTab("saved-issues")}
            className={`px-4 py-2.5 text-xs font-bold font-display border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === "saved-issues"
                ? "border-blue-600 text-slate-900 dark:text-white"
                : "border-transparent text-slate-500 dark:text-slate-450 hover:text-slate-800 dark:hover:text-white"
            }`}
          >
            <Bookmark className={`w-3.5 h-3.5 ${activeTab === "saved-issues" ? "text-blue-600 dark:text-blue-400 fill-current" : "text-slate-400 dark:text-slate-500"}`} />
            Saved Issues
            {localSavedIssues.length > 0 && (
              <span className="ml-1 bg-amber-100 dark:bg-amber-950/40 text-amber-750 dark:text-amber-450 text-[10px] px-1.5 py-0.5 rounded-full font-mono font-bold border border-amber-200 dark:border-amber-900/40">
                {localSavedIssues.length}
              </span>
            )}
          </button>
        </div>

        {/* Dynamic tabs render */}
        {activeTab === "insights" && <PredictiveDashboard reports={reports} profile={profile} />}
        {activeTab === "leaderboard" && <Leaderboard currentUser={profile} reports={reports} />}
        {activeTab === "my-activity" && (
          <MyActivity
            reports={reports}
            profile={profile}
            onSelectReport={(id) => setSelectedReportId(id)}
            setActiveTab={setActiveTab as any}
            onEditReport={handleEditReport}
            onDeleteReport={handleDeleteReport}
          />
        )}
        {activeTab === "saved-issues" && (
          <SavedIssues
            reports={reports}
            savedIssueIds={localSavedIssues}
            onToggleSave={handleToggleSaveIssue}
            onSelectReport={(id) => setSelectedReportId(id)}
            setActiveTab={setActiveTab}
          />
        )}

        {activeTab === "map" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* Left Col: Interactive Vector Map + Report form triggers */}
            <div className="lg:col-span-7 space-y-6" id="map-anchor">
              
              {/* Geolocation & Hazard Proximity Radar Widget */}
              <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-blue-50 border border-blue-100 rounded-xl text-blue-600 animate-pulse">
                      <Activity className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-slate-800 font-display uppercase tracking-wider">
                        Hazard Proximity Radar
                      </h3>
                      <p className="text-[10px] text-slate-400 font-sans">
                        Auto-detects High &amp; Critical hazards within 500m
                      </p>
                    </div>
                  </div>

                  {/* Mode switcher (Real GPS vs simulation) */}
                  <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 p-1 rounded-xl shrink-0">
                    <button
                      onClick={() => {
                        setIsGPSTrackingActive(true);
                        setIsSimulatingLocation(false);
                      }}
                      className={`px-3 py-1.5 rounded-lg text-[10px] font-bold font-sans transition-all cursor-pointer ${
                        isGPSTrackingActive
                          ? "bg-blue-600 text-white shadow-sm"
                          : "text-slate-500 hover:text-slate-700"
                      }`}
                    >
                      Use Real GPS
                    </button>
                    <button
                      onClick={() => {
                        setIsGPSTrackingActive(false);
                        setIsSimulatingLocation(true);
                      }}
                      className={`px-3 py-1.5 rounded-lg text-[10px] font-bold font-sans transition-all cursor-pointer ${
                        isSimulatingLocation
                          ? "bg-blue-600 text-white shadow-sm"
                          : "text-slate-500 hover:text-slate-700"
                      }`}
                    >
                      Simulate Location
                    </button>
                  </div>
                </div>

                {/* Status Indicator */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 bg-slate-50 border border-slate-200/60 rounded-2xl p-3.5 text-xs">
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-slate-400 uppercase font-mono">Radar Status</p>
                    <div className="flex items-center gap-1.5">
                      <span className={`w-2.5 h-2.5 rounded-full ${isGPSTrackingActive ? "bg-emerald-500 animate-ping" : "bg-blue-500 animate-pulse"}`} />
                      <span className="font-bold text-slate-700">
                        {isGPSTrackingActive ? "Active GPS Tracking" : "Simulation Mode Active"}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-slate-400 uppercase font-mono">Current Coordinates</p>
                    {userLocation ? (
                      <p className="font-mono text-xs font-semibold text-slate-600">
                        {userLocation.lat.toFixed(5)}, {userLocation.lng.toFixed(5)}
                      </p>
                    ) : (
                      <p className="text-slate-500 italic">Determining coordinates...</p>
                    )}
                  </div>
                </div>

                {/* Geolocation error display */}
                {geolocationError && (
                  <div className="bg-rose-50 border border-rose-100 text-rose-700 text-[10px] px-3.5 py-2 rounded-xl flex items-center gap-2">
                    <AlertOctagon className="w-4 h-4 shrink-0" />
                    <span>{geolocationError}</span>
                  </div>
                )}

                {/* Proximity Alerts feedback */}
                <div className="space-y-2">
                  <p className="text-[10px] font-bold text-slate-400 uppercase font-mono">
                    Nearby Active Hazards ({nearbyHazards.length})
                  </p>
                  {nearbyHazards.length === 0 ? (
                    <p className="text-[11px] text-slate-500 italic bg-emerald-50/50 border border-emerald-100 p-3 rounded-2xl text-center">
                      🛡️ All Clear! No active High or Critical severity hazards detected within 500 meters of your position.
                    </p>
                  ) : (
                    <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                      {nearbyHazards.map((hazard) => {
                        const distance = userLocation
                          ? Math.round(
                              getDistanceInMeters(
                                userLocation.lat,
                                userLocation.lng,
                                hazard.latitude,
                                hazard.longitude
                              )
                            )
                          : 99999;
                        return (
                          <div
                            key={`radar-${hazard.id}`}
                            className="bg-rose-50/60 hover:bg-rose-50 border border-rose-100/80 rounded-2xl p-3 flex items-center justify-between gap-3 transition-colors"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span className="bg-rose-100 text-rose-800 text-[8px] font-bold px-1.5 py-0.5 rounded uppercase font-mono shrink-0">
                                {hazard.severity}
                              </span>
                              <div className="min-w-0">
                                <h4 className="text-xs font-bold text-slate-800 truncate">
                                  {hazard.title}
                                </h4>
                                <p className="text-[9px] text-slate-500 truncate">
                                  {hazard.address}
                                </p>
                              </div>
                            </div>
                            <span className="text-[10px] font-bold text-rose-600 font-mono shrink-0 bg-white border border-rose-100 px-2.5 py-1 rounded-xl">
                              {distance}m away
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Simulation coordinates quick warps */}
                {isSimulatingLocation && (
                  <div className="space-y-2.5 border-t border-slate-100 pt-3">
                    <p className="text-[10px] font-bold text-slate-400 uppercase font-mono">
                      Quick Simulator Controls (Warp Near Hazards to test alerts):
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {reports
                        .filter((r) => r.severity === "High" || r.severity === "Critical")
                        .slice(0, 4)
                        .map((hazard) => {
                          const distance = userLocation
                            ? Math.round(
                                getDistanceInMeters(
                                  userLocation.lat,
                                  userLocation.lng,
                                  hazard.latitude,
                                  hazard.longitude
                                )
                              )
                            : 99999;
                          const isNear = distance <= 500;

                          return (
                            <button
                              key={`simulate-warp-${hazard.id}`}
                              onClick={() => {
                                // Warp user position 60 meters east of the hazard to trigger the proximity alerts instantly
                                setUserLocation({
                                  lat: hazard.latitude,
                                  lng: hazard.longitude + 0.0005,
                                });
                              }}
                              className={`px-3 py-2 border rounded-xl text-left transition-all hover:bg-slate-50 flex flex-col justify-between cursor-pointer ${
                                isNear
                                  ? "border-rose-300 bg-rose-50/20 text-rose-800"
                                  : "border-slate-200 text-slate-700"
                              }`}
                            >
                              <div className="flex items-center justify-between w-full">
                                <span className="text-[9px] font-bold font-mono text-slate-400">
                                  {hazard.category}
                                </span>
                                <span
                                  className={`text-[8px] font-bold px-1.5 py-0.5 rounded-md ${
                                    hazard.severity === "Critical"
                                      ? "bg-rose-100 text-rose-800"
                                      : "bg-orange-100 text-orange-800"
                                  }`}
                                >
                                  {hazard.severity}
                                </span>
                              </div>
                              <span className="text-[11px] font-bold truncate mt-1">
                                {hazard.title}
                              </span>
                              <span className="text-[9px] text-slate-400 font-semibold mt-1.5 flex items-center gap-0.5 font-mono">
                                {isNear ? "📍 You are nearby" : "⚡ Click to Warp Near (50m)"}
                              </span>
                            </button>
                          );
                        })}
                    </div>
                  </div>
                )}
              </div>

              <MapWidget
                reports={filteredReports}
                selectedLocation={selectedLocation}
                onSelectLocation={(lat, lng, addr) => {
                  setSelectedLocation({ lat, lng, address: addr });
                  // If they select coordinates on the map, trigger report modal
                  setIsReportModalOpen(true);
                }}
                activeReportId={selectedReportId}
                onSelectReport={(reportId) => setSelectedReportId(reportId)}
                userLocation={userLocation}
                enableDistanceFilter={enableDistanceFilter}
                maxDistance={maxDistance}
              />

              {/* Quick instructions bar */}
              <div className="bg-white border border-slate-200 p-4 rounded-2xl flex items-center justify-between gap-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-50 border border-indigo-100 rounded-xl text-indigo-600 shrink-0">
                    <Plus className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-800 font-display">Witnessed a hazard?</h4>
                    <p className="text-[10px] text-slate-500 font-sans">Click anywhere on the map above to pin location and open the report form.</p>
                  </div>
                </div>

                <button
                  onClick={() => setIsReportModalOpen(true)}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl transition-all shadow-md shadow-blue-500/10 whitespace-nowrap hover-scale cursor-pointer"
                >
                  Report Issue
                </button>
              </div>

              {/* Feed Filters */}
              <div className="flex flex-col gap-4 bg-white border border-slate-200 p-4 rounded-2xl shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-slate-700">
                    <Filter className="w-4 h-4 text-blue-600" />
                    <span className="text-xs font-bold font-display">Local Hazard Feed</span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={categoryFilter}
                      onChange={(e) => setCategoryFilter(e.target.value)}
                      className="bg-slate-50 border border-slate-200 text-[11px] font-semibold text-slate-600 px-3 py-1.5 rounded-xl focus:outline-none focus:border-blue-500 transition-all cursor-pointer"
                    >
                      <option value="All">All Categories</option>
                      <option value="Pothole">Potholes</option>
                      <option value="Water Leakage">Water Leakage</option>
                      <option value="Damaged Streetlight">Streetlights</option>
                      <option value="Waste Management">Waste Management</option>
                      <option value="Public Infrastructure">Infrastructure</option>
                    </select>

                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="bg-slate-50 border border-slate-200 text-[11px] font-semibold text-slate-600 px-3 py-1.5 rounded-xl focus:outline-none focus:border-blue-500 transition-all cursor-pointer"
                    >
                      <option value="All">All Statuses</option>
                      <option value="Reported">Reported</option>
                      <option value="Investigating">Investigating</option>
                      <option value="In Progress">In Progress</option>
                      <option value="Resolved">Resolved</option>
                    </select>
                  </div>
                </div>

                {/* Distance Proximity Filter Slider */}
                <div className="py-2 border-t border-b border-slate-100 dark:border-slate-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <input
                      type="checkbox"
                      id="enable-distance-checkbox"
                      checked={enableDistanceFilter}
                      onChange={(e) => setEnableDistanceFilter(e.target.checked)}
                      className="w-4 h-4 text-blue-600 bg-slate-50 dark:bg-slate-800 border-slate-350 dark:border-slate-700 rounded focus:ring-blue-500 cursor-pointer"
                    />
                    <label htmlFor="enable-distance-checkbox" className="text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer select-none">
                      Filter by distance from my location
                    </label>
                  </div>

                  <div className="flex-1 max-w-xs flex items-center gap-2.5">
                    <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 font-mono shrink-0">1km</span>
                    <input
                      type="range"
                      min="1"
                      max="10"
                      step="1"
                      disabled={!enableDistanceFilter}
                      value={maxDistance}
                      onChange={(e) => setMaxDistance(Number(e.target.value))}
                      className={`w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-600 focus:outline-none ${
                        !enableDistanceFilter ? "opacity-30 cursor-not-allowed" : ""
                      }`}
                      id="distance-slider"
                    />
                    <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 font-mono shrink-0">10km</span>
                    <div className={`px-2 py-1 rounded-lg text-[10px] font-mono font-bold whitespace-nowrap shrink-0 border transition-all ${
                      enableDistanceFilter 
                        ? "bg-blue-50 dark:bg-blue-950/40 border-blue-100 dark:border-blue-900/50 text-blue-600 dark:text-blue-400" 
                        : "bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-500"
                    }`}>
                      {maxDistance} km
                    </div>
                  </div>
                </div>

                {/* Live Keyword Search bar */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search issues by title, description or address keyword..."
                    className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 hover:border-slate-300 focus:border-blue-500 focus:bg-white text-xs text-slate-800 placeholder-slate-400 rounded-xl transition-all focus:outline-none font-sans"
                    id="hazard-search-input"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 hover:bg-slate-200 text-slate-400 hover:text-slate-600 rounded-full transition-colors cursor-pointer"
                      title="Clear search"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* List of current issues reported */}
              <div className="space-y-3.5 max-h-[500px] overflow-y-auto pr-2">
                {filteredReports.length === 0 ? (
                  <div className="text-center py-12 bg-white border border-slate-200 rounded-2xl">
                    <Activity className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                    <p className="text-xs text-slate-500 font-sans">No issues match the selected filters.</p>
                  </div>
                ) : (
                  filteredReports.map((report) => (
                    <button
                      key={report.id}
                      onClick={() => setSelectedReportId(report.id)}
                      className={`w-full text-left p-4 rounded-2xl border transition-all flex gap-4 cursor-pointer ${
                        selectedReportId === report.id
                          ? "bg-blue-50/20 border-blue-500/30 shadow-sm"
                          : "bg-white border-slate-200/80 hover:border-slate-300 hover:bg-slate-50/50"
                      }`}
                    >
                      <img
                        src={report.imageUrl}
                        alt={report.title}
                        className="w-16 h-16 rounded-xl object-cover border border-slate-200 shrink-0"
                      />
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] font-mono text-indigo-600 font-semibold uppercase">{report.category}</span>
                          <div className="flex items-center gap-1.5">
                            {isAwaitingAttention(report) && (
                              <span className="text-[9px] px-2 py-0.5 rounded font-bold uppercase bg-amber-50 text-amber-800 border border-amber-200 flex items-center gap-1 shrink-0 shadow-sm animate-pulse" title="Active for over 30 days without resolution">
                                ⚠️ Awaiting Attention
                              </span>
                            )}
                            <span className={`text-[9px] px-2 py-0.5 rounded font-bold uppercase ${
                              report.status === "Resolved"
                                ? "bg-emerald-50 text-emerald-600 border border-emerald-100"
                                : report.status === "In Progress"
                                ? "bg-indigo-50 text-indigo-600 border border-indigo-100"
                                : "bg-rose-50 text-rose-600 border border-rose-100"
                            }`}>
                              {report.status}
                            </span>
                          </div>
                        </div>

                        <h4 className="text-sm font-bold text-slate-800 mt-1 truncate">{report.title}</h4>
                        <p className="text-xs text-slate-500 line-clamp-1 mt-0.5 font-sans">{report.description}</p>
                        
                        <div className="flex items-center gap-3 mt-3.5 text-[10px] text-slate-400 font-mono">
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5" /> {report.address}
                          </span>
                          <span>•</span>
                          <span className="flex items-center gap-1 text-slate-500">
                            <ThumbsUp className="w-3 h-3 text-blue-600" /> {report.upvotes} Citizens verified
                          </span>
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>

            </div>

            {/* Right Col: Details view for the highlighted report */}
            <div className="lg:col-span-5 sticky top-24">
              {selectedReport ? (
                <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm flex flex-col max-h-[85vh]">
                  
                  {/* Photo attachment */}
                  <div 
                    onClick={() => setLightboxImg(selectedReport.imageUrl)}
                    className="relative h-48 bg-slate-100 group cursor-zoom-in overflow-hidden"
                    title="Click to view large preview"
                  >
                    <img src={selectedReport.imageUrl} alt={selectedReport.title} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
                    <div className="absolute inset-0 bg-gradient-to-t from-white/40 via-transparent to-transparent" />
                    
                    {/* Hover Magnify Overlay */}
                    <div className="absolute inset-0 bg-slate-900/30 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center">
                      <div className="bg-white/90 backdrop-blur-md px-3.5 py-2 rounded-xl shadow-lg border border-slate-200 flex items-center gap-2 text-slate-800 text-xs font-semibold transform translate-y-2 group-hover:translate-y-0 transition-all duration-300">
                        <Maximize2 className="w-4 h-4 text-blue-600" />
                        <span>Enlarge Image</span>
                      </div>
                    </div>

                    <div className="absolute top-4 left-4 flex flex-wrap gap-2 z-10">
                      <span className="text-[9px] bg-white/90 backdrop-blur-md px-2.5 py-1 rounded-lg border border-slate-200 font-bold text-blue-600 uppercase font-mono">
                        {selectedReport.category}
                      </span>
                      <span className={`text-[9px] backdrop-blur-md px-2.5 py-1 rounded-lg font-bold uppercase border ${
                        selectedReport.severity === "Critical" || selectedReport.severity === "High"
                          ? "bg-rose-550/10 border-rose-500/20 text-rose-600"
                          : "bg-amber-550/10 border-amber-500/20 text-amber-600"
                      }`}>
                        {selectedReport.severity} Severity
                      </span>
                      {isAwaitingAttention(selectedReport) && (
                        <span className="text-[9px] bg-amber-500 text-white px-2.5 py-1 rounded-lg font-bold uppercase border border-amber-600 flex items-center gap-1 shadow-md animate-pulse">
                          ⚠️ Awaiting Attention
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Main contents */}
                  <div className="p-6 space-y-6 overflow-y-auto flex-1">
                    <div>
                      <div className="flex items-start justify-between gap-3">
                        <h3 className="text-lg font-bold text-slate-800 font-display leading-tight">{selectedReport.title}</h3>
                        <div className="flex items-center gap-2 shrink-0">
                          {/* QR Code Button */}
                          <button
                            onClick={() => setQrModalReport(selectedReport)}
                            className="p-2.5 rounded-xl border bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-400 hover:text-slate-600 transition-all cursor-pointer flex items-center justify-center shrink-0"
                            title="Generate QR Code Badge"
                          >
                            <QrCode className="w-4.5 h-4.5" />
                          </button>

                          {/* Share Button */}
                          <button
                            onClick={() => handleShareReport(selectedReport.id)}
                            className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-center gap-1.5 shrink-0 ${
                              copiedReportId === selectedReport.id
                                ? "bg-emerald-50 border-emerald-200 text-emerald-600 font-bold"
                                : "bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-400 hover:text-slate-600"
                            }`}
                            title="Copy Deep Link to Clipboard"
                          >
                            {copiedReportId === selectedReport.id ? (
                              <>
                                <Check className="w-4.5 h-4.5 text-emerald-600 animate-bounce" />
                                <span className="text-[10px] font-mono text-emerald-700">Copied!</span>
                              </>
                            ) : (
                              <Share2 className="w-4.5 h-4.5" />
                            )}
                          </button>

                          {/* Bookmark Button */}
                          <button
                            onClick={() => handleToggleSaveIssue(selectedReport.id)}
                            className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-center shrink-0 ${
                              localSavedIssues.includes(selectedReport.id)
                                ? "bg-amber-50 border-amber-200 text-amber-500 hover:text-amber-600"
                                : "bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-400 hover:text-slate-600"
                            }`}
                            title={localSavedIssues.includes(selectedReport.id) ? "Remove Bookmark" : "Bookmark Hazard"}
                          >
                            <Bookmark className={`w-4.5 h-4.5 ${localSavedIssues.includes(selectedReport.id) ? "fill-current" : ""}`} />
                          </button>
                        </div>
                      </div>
                      <p className="text-[10px] text-slate-500 font-mono mt-1 flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5" /> {selectedReport.address}
                      </p>
                      
                      {/* Description notes */}
                      <p className="text-xs text-slate-600 leading-relaxed mt-4 bg-slate-50/50 p-4 rounded-xl border border-slate-200 shadow-inner font-sans">
                        {selectedReport.description}
                      </p>
                    </div>

                    {/* Community verification action bar */}
                    <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl flex items-center justify-between gap-4">
                      <div>
                        <h4 className="text-xs font-bold text-slate-700 font-display">Community Verification</h4>
                        <p className="text-[10px] text-slate-500 mt-0.5 font-sans">Help confirm this hazard for priority action.</p>
                      </div>

                      <button
                        onClick={() => handleVerifyReport(selectedReport)}
                        disabled={verifications.some((v) => v.userId === user?.uid)}
                        className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold font-mono transition-all cursor-pointer ${
                          verifications.some((v) => v.userId === user?.uid)
                            ? "bg-blue-50 border border-blue-200 text-blue-600"
                            : "bg-blue-600 hover:bg-blue-700 text-white hover-scale shadow-md"
                        }`}
                      >
                        <ThumbsUp className="w-4 h-4" />
                        {selectedReport.upvotes} Verified
                      </button>
                    </div>

                    {/* Official Municipal Actions (EXCLUSIVELY FOR MUNICIPAL_AGENT) */}
                    {(profile?.role === "municipal_agent" || profile?.role === "admin") && (
                      <div className="bg-indigo-50/40 border border-indigo-100 p-5 rounded-2xl space-y-3">
                        <h4 className="text-xs font-bold text-indigo-600 font-display flex items-center gap-1.5">
                          <Wrench className="w-4 h-4" /> Municipal Authority Control Panel
                        </h4>
                        <p className="text-[10px] text-slate-600 leading-relaxed font-sans">
                          Transition status to update reporting citizens. Resolving an issue rewards the reporter with <strong className="text-blue-600">+100 XP</strong>!
                        </p>

                        <div className="grid grid-cols-3 gap-2 pt-1">
                          <button
                            onClick={() => handleUpdateStatus("Investigating")}
                            className={`py-2 px-1 text-[10px] font-bold font-mono rounded-lg border transition-all cursor-pointer ${
                              selectedReport.status === "Investigating"
                                ? "bg-amber-50 border-amber-200 text-amber-600"
                                : "bg-white border-slate-200 text-slate-500 hover:text-slate-700"
                            }`}
                          >
                            Investigate
                          </button>
                          
                          <button
                            onClick={() => handleUpdateStatus("In Progress")}
                            className={`py-2 px-1 text-[10px] font-bold font-mono rounded-lg border transition-all cursor-pointer ${
                              selectedReport.status === "In Progress"
                                ? "bg-indigo-50 border-indigo-200 text-indigo-600"
                                : "bg-white border-slate-200 text-slate-500 hover:text-slate-700"
                            }`}
                          >
                            In Progress
                          </button>

                          <button
                            onClick={() => {
                              setFixSummaryText("");
                              setShowResolutionModal(true);
                            }}
                            className={`py-2 px-1 text-[10px] font-bold font-mono rounded-lg border transition-all cursor-pointer ${
                              selectedReport.status === "Resolved"
                                ? "bg-emerald-50 border-emerald-200 text-emerald-600"
                                : "bg-white border-slate-200 text-slate-500 hover:text-slate-700"
                            }`}
                          >
                            Resolve
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Discussions & timeline comments subcollection */}
                    <div className="space-y-4 border-t border-slate-200 pt-4">
                      <h4 className="text-xs font-bold text-slate-700 uppercase font-mono tracking-wider flex items-center gap-1.5">
                        <MessageSquare className="w-4 h-4 text-blue-600" /> Discussion ({comments.length})
                      </h4>

                      {/* Comments Feed list */}
                      <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1">
                        {comments.length === 0 ? (
                          <p className="text-[11px] text-slate-400 text-center py-4 font-sans">No comments posted yet. Start the discussion!</p>
                        ) : (
                          comments.map((c) => {
                            const isUserAdminOrAgent = profile?.role === "municipal_agent" || profile?.role === "admin";
                            const hasUserFlagged = user && c.flaggedBy?.includes(user.uid);
                            const isFlagged = c.flagged;
                            const isRevealed = revealedComments[c.id];

                            return (
                              <div 
                                key={c.id} 
                                className={`p-3 rounded-xl border flex flex-col space-y-1 transition-all ${
                                  isFlagged 
                                    ? isUserAdminOrAgent 
                                      ? "bg-rose-50/50 border-rose-200 border-dashed" 
                                      : "bg-slate-100/75 border-slate-300"
                                    : "bg-slate-50 border-slate-200"
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    <span className={`text-[10px] font-bold truncate ${
                                      c.userRole === "municipal_agent" || c.userRole === "admin"
                                        ? "text-indigo-600"
                                        : "text-slate-700"
                                    }`}>
                                      {c.userName}
                                      {(c.userRole === "municipal_agent" || c.userRole === "admin") && (
                                        <span className="text-[8px] bg-indigo-50 text-indigo-600 border border-indigo-100 px-1 py-0.5 rounded font-mono ml-1 font-semibold uppercase">
                                          Official
                                        </span>
                                      )}
                                    </span>
                                    <span className="text-[9px] text-slate-400 font-sans shrink-0">
                                      • {formatTimeAgo(c.createdAt)}
                                    </span>
                                  </div>

                                  {/* Moderation status / report actions */}
                                  <div className="flex items-center gap-2">
                                    {isFlagged && (
                                      <span className="text-[8px] font-mono font-bold bg-rose-50 text-rose-600 border border-rose-200 px-1.5 py-0.5 rounded-md flex items-center gap-0.5">
                                        <Flag className="w-2.5 h-2.5 fill-rose-600 text-rose-600" /> FLAGGED
                                      </span>
                                    )}

                                    {/* Action buttons */}
                                    <div className="flex items-center gap-1">
                                      {/* Municipal/Admin Moderation Controls */}
                                      {isUserAdminOrAgent && isFlagged && (
                                        <div className="flex items-center gap-1">
                                          <button
                                            onClick={() => handleModerateComment(c.id, "dismiss")}
                                            className="px-1.5 py-0.5 bg-slate-200 hover:bg-slate-300 text-[8px] font-bold text-slate-700 rounded transition-colors cursor-pointer"
                                            title="Dismiss flag"
                                          >
                                            Keep
                                          </button>
                                          <button
                                            onClick={() => handleModerateComment(c.id, "delete")}
                                            className="px-1.5 py-0.5 bg-rose-600 hover:bg-rose-700 text-[8px] font-bold text-white rounded transition-colors cursor-pointer"
                                            title="Delete comment"
                                          >
                                            Delete
                                          </button>
                                        </div>
                                      )}

                                      {/* Standard Citizen Flag Trigger */}
                                      {!hasUserFlagged && !isUserAdminOrAgent && c.userId !== user?.uid && (
                                        <button
                                          onClick={() => handleFlagComment(c)}
                                          className="p-1 text-slate-400 hover:text-rose-500 rounded hover:bg-slate-200/50 transition-all cursor-pointer"
                                          title="Report comment as inappropriate"
                                        >
                                          <Flag className="w-3.5 h-3.5" />
                                        </button>
                                      )}

                                      {hasUserFlagged && !isUserAdminOrAgent && (
                                        <span 
                                          className="text-rose-500 p-1 flex items-center cursor-default" 
                                          title="You flagged this comment"
                                        >
                                          <Flag className="w-3.5 h-3.5 fill-rose-500 text-rose-500" />
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                {/* Comment text or placeholder */}
                                {isFlagged && !isUserAdminOrAgent && !isRevealed ? (
                                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 p-1.5 bg-slate-200/55 rounded-lg border border-slate-300/30 mt-1">
                                    <p className="text-[10px] text-slate-500 italic font-sans flex items-center gap-1">
                                      <EyeOff className="w-3 h-3 text-slate-400 shrink-0" /> Content hidden for review
                                    </p>
                                    <button
                                      onClick={() => setRevealedComments({ ...revealedComments, [c.id]: true })}
                                      className="text-[9px] font-bold text-blue-600 hover:text-blue-800 hover:underline transition-colors cursor-pointer"
                                    >
                                      Reveal anyway
                                    </button>
                                  </div>
                                ) : (
                                  <p className="text-xs text-slate-600 whitespace-pre-line leading-relaxed font-sans mt-0.5">{c.text}</p>
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>

                      {/* Write Comment Form */}
                      <form onSubmit={handleSubmitComment} className="flex gap-2">
                        <input
                          type="text"
                          value={newCommentText}
                          onChange={(e) => handleCommentTextChange(e.target.value)}
                          placeholder="Post public comment or update..."
                          className="flex-1 bg-slate-50 border border-slate-200 focus:border-blue-500 focus:outline-none rounded-xl px-3.5 py-2 text-xs text-slate-700 transition-colors"
                          required
                        />
                        <button
                          type="submit"
                          className="p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-all cursor-pointer hover-scale shrink-0"
                          title="Post Comment"
                        >
                          <Send className="w-4 h-4" />
                        </button>
                      </form>
                    </div>

                  </div>
                </div>
              ) : (
                <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-sm text-center space-y-4">
                  <Activity className="w-12 h-12 text-slate-400 mx-auto" />
                  <div className="space-y-1">
                    <h3 className="text-sm font-bold text-slate-700 font-display">No Issue Selected</h3>
                    <p className="text-xs text-slate-500 max-w-xs mx-auto leading-relaxed font-sans">
                      Select any pinpoint on the vector map or click an item in the neighborhood list feed to view high-resolution photos, timeline status, and municipal agent updates.
                    </p>
                  </div>
                </div>
              )}
            </div>

          </div>
        )}
      </main>

      {/* Floating Add Issue Trigger Modal */}
      <ReportModal
        isOpen={isReportModalOpen}
        onClose={() => {
          setIsReportModalOpen(false);
          setSelectedLocation(null);
        }}
        selectedLocation={selectedLocation}
        onSubmit={handleReportIssue}
      />

      {/* High-Resolution Lightbox Image Modal Preview */}
      {lightboxImg && (
        <div 
          className="fixed inset-0 z-55 flex items-center justify-center p-4 bg-slate-950/95 backdrop-blur-md transition-all duration-300"
          onClick={() => setLightboxImg(null)}
        >
          {/* Close button */}
          <button
            onClick={() => setLightboxImg(null)}
            className="absolute top-6 right-6 p-2.5 bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-white rounded-full transition-colors cursor-pointer shadow-lg z-50"
            title="Close preview"
          >
            <X className="w-5 h-5" />
          </button>

          <div 
            className="relative max-w-5xl max-h-[85vh] flex flex-col items-center justify-center pointer-events-none"
            onClick={(e) => e.stopPropagation()} 
          >
            <img 
              src={lightboxImg} 
              alt="High-resolution preview" 
              className="max-h-[80vh] max-w-full object-contain rounded-2xl shadow-2xl border border-slate-800 pointer-events-auto select-none"
            />
            {selectedReport && selectedReport.imageUrl === lightboxImg && (
              <div className="mt-4 text-center px-4">
                <p className="text-white text-xs font-bold font-display">{selectedReport.title}</p>
                <p className="text-slate-400 text-[10px] mt-1 font-mono flex items-center justify-center gap-1">
                  <MapPin className="w-3 h-3 text-rose-500" /> {selectedReport.address}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Printable QR Code Badge Dialog */}
      {qrModalReport && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-55 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-md p-6 relative overflow-hidden animate-in fade-in zoom-in duration-200">
            {/* Header */}
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-blue-50 dark:bg-blue-950/40 rounded-xl border border-blue-100 dark:border-blue-900/50 text-blue-600 dark:text-blue-400">
                  <QrCode className="w-5 h-5 animate-pulse" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white font-display">Municipal QR Badge</h3>
                  <p className="text-[10px] text-slate-500 dark:text-slate-450 font-mono">ID: {qrModalReport.id.substring(0, 8)}</p>
                </div>
              </div>
              <button
                onClick={() => setQrModalReport(null)}
                className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-350 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-4.5 h-4.5" />
              </button>
            </div>

            {/* QR display card */}
            <div className="my-6 p-6 bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800 rounded-2xl flex flex-col items-center justify-center text-center space-y-4">
              <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(
                    `${window.location.origin}${window.location.pathname}?reportId=${qrModalReport.id}`
                  )}`}
                  alt="Report QR Code"
                  className="w-44 h-44 object-contain select-none block"
                  referrerPolicy="no-referrer"
                />
              </div>

              <div className="space-y-1">
                <p className="text-xs font-bold text-slate-800 dark:text-slate-100 font-display leading-snug">{qrModalReport.title}</p>
                <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400 font-sans flex items-center justify-center gap-1">
                  <MapPin className="w-3 h-3 text-rose-500" /> {qrModalReport.address}
                </p>
              </div>
            </div>

            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed font-sans mb-6">
              This QR code contains the report's deep link. Municipal agents or community monitors can scan it in the physical field to instantly access coordinates, verification tallies, and progress reports.
            </p>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setQrModalReport(null)}
                className="flex-1 py-2.5 bg-slate-50 dark:bg-slate-850 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-xs transition-colors cursor-pointer"
              >
                Close
              </button>
              <button
                onClick={() => handlePrintQRCode(qrModalReport)}
                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs transition-colors shadow-sm cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Printer className="w-4 h-4" />
                Print QR Badge
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Municipal Agent Status Resolution Modal */}
      {showResolutionModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-55 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-md p-6 relative overflow-hidden animate-in fade-in zoom-in duration-200">
            {/* Header */}
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-100 dark:border-emerald-900/40 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white font-display">Resolve Issue</h3>
                  <p className="text-[10px] text-slate-500 dark:text-slate-450 font-mono">Provide a fix summary for the public feed</p>
                </div>
              </div>
              <button
                onClick={() => setShowResolutionModal(false)}
                className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-350 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-4.5 h-4.5" />
              </button>
            </div>

            {/* Form */}
            <div className="my-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 font-mono uppercase tracking-wider block">
                  Fix Summary / Resolution Note
                </label>
                <textarea
                  value={fixSummaryText}
                  onChange={(e) => setFixSummaryText(e.target.value)}
                  placeholder="e.g., The pothole has been successfully filled with warm asphalt mix and leveled with the road surface. Normal traffic flow has resumed."
                  className="w-full min-h-[100px] p-3 text-xs text-slate-800 dark:text-slate-100 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-sans placeholder:text-slate-400 leading-relaxed resize-none"
                />
                <p className="text-[10px] text-slate-400 dark:text-slate-500 font-sans leading-relaxed">
                  This note will be automatically published to the community comment feed, allowing all verified contributors to see the details of the resolution.
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowResolutionModal(false)}
                className="flex-1 py-2.5 bg-slate-50 dark:bg-slate-850 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-xs transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  handleUpdateStatus("Resolved", fixSummaryText);
                  setShowResolutionModal(false);
                }}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs transition-colors shadow-sm cursor-pointer flex items-center justify-center gap-1.5 hover-scale"
              >
                <Check className="w-4 h-4" />
                Mark Resolved
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Tour Modal Sequence */}
      {tourStep !== null && (
        <div className="fixed inset-0 bg-slate-900/40 dark:bg-slate-950/60 backdrop-blur-sm z-55 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-md p-6 relative overflow-hidden animate-in fade-in zoom-in duration-200">
            {/* Tour Background Decoration */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 dark:bg-blue-400/5 rounded-full -mr-10 -mt-10 pointer-events-none" />
            
            {/* Step Content */}
            {tourStep === 0 && (
              <div className="space-y-4">
                <div className="inline-flex p-3 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 rounded-2xl border border-blue-100 dark:border-blue-900/50">
                  <Sparkles className="w-6 h-6 animate-spin-slow" />
                </div>
                <div>
                  <h3 className="text-lg font-extrabold text-slate-900 dark:text-white font-display tracking-tight">Welcome to Samadhaan! 🏛️</h3>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 font-mono uppercase tracking-wider mt-0.5">Step 1 of 5 • Hyperlocal Problem Solver</p>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-sans">
                  <strong>Samadhaan</strong> is your hyperlocal civic engagement platform. Together, we identify, report, and resolve local civic hazards, potholes, and utility breakdowns in real-time. Let's take a quick 1-minute tour to see how you can make an impact.
                </p>
              </div>
            )}

            {tourStep === 1 && (
              <div className="space-y-4">
                <div className="inline-flex p-3 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-2xl border border-indigo-100 dark:border-indigo-900/50">
                  <Globe className="w-6 h-6 animate-pulse" />
                </div>
                <div>
                  <h3 className="text-lg font-extrabold text-slate-900 dark:text-white font-display tracking-tight">Dashboard & Live Map 🗺️</h3>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 font-mono uppercase tracking-wider mt-0.5">Step 2 of 5 • Real-time Tracking</p>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-sans">
                  Keep tabs on active issues in your neighborhood. We have dynamically switched your active tab to the <strong>Dashboard & Live Map</strong>. You can view reported hazards pinpointed with status color codes, filter by category or severity, and configure custom geolocation proximity alerts!
                </p>
              </div>
            )}

            {tourStep === 2 && (
              <div className="space-y-4">
                <div className="inline-flex p-3 bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 rounded-2xl border border-amber-100 dark:border-amber-900/50">
                  <Plus className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-extrabold text-slate-900 dark:text-white font-display tracking-tight">Quick Reporting ➕</h3>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 font-mono uppercase tracking-wider mt-0.5">Step 3 of 5 • Easy Submission</p>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-sans">
                  Did you spot a pothole, open manhole, or broken street light? Simply click the floating <strong className="text-blue-600 dark:text-blue-400">+ Report New Issue</strong> button in the bottom corner. Snap a picture, let GPS auto-locate you, select category severity, and submit it instantly.
                </p>
              </div>
            )}

            {tourStep === 3 && (
              <div className="space-y-4">
                <div className="inline-flex p-3 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 rounded-2xl border border-rose-100 dark:border-rose-900/50">
                  <UserCheck className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-extrabold text-slate-900 dark:text-white font-display tracking-tight">Upvote & Verify 🤝</h3>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 font-mono uppercase tracking-wider mt-0.5">Step 4 of 5 • Crowdsourced Truth</p>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-sans">
                  The community validates reports. Upvote issues on the map to verify they are still active or downvote them if they have been solved. High verification counts elevate issues to high priority, urging municipal agents to act quickly.
                </p>
              </div>
            )}

            {tourStep === 4 && (
              <div className="space-y-4">
                <div className="inline-flex p-3 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-2xl border border-emerald-100 dark:border-emerald-900/50">
                  <Trophy className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-extrabold text-slate-900 dark:text-white font-display tracking-tight">Civic Impact & Leaderboard 🏆</h3>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 font-mono uppercase tracking-wider mt-0.5">Step 5 of 5 • Leaderboard & Badges</p>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-sans">
                  Every action earns points. Check out the <strong>Top Samadhaan Leaders</strong> page to view community standings! We've also added the new <strong>Civic Impact Badge</strong>: gain a heavily weighted score of 3x points for each resolved issue, and 1x points for each verified report!
                </p>
              </div>
            )}

            {/* Pagination Progress Dots */}
            <div className="flex items-center justify-between mt-6 pt-4 border-t border-slate-100 dark:border-slate-800">
              <div className="flex gap-1.5">
                {[0, 1, 2, 3, 4].map((step) => (
                  <button
                    key={step}
                    onClick={() => setTourStep(step)}
                    className={`w-2 h-2 rounded-full transition-all cursor-pointer ${
                      tourStep === step ? "bg-blue-600 dark:bg-blue-400 w-4" : "bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600"
                    }`}
                  />
                ))}
              </div>

              {/* Navigation Actions */}
              <div className="flex items-center gap-2">
                {tourStep > 0 ? (
                  <button
                    onClick={handlePrevTourStep}
                    className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 dark:bg-slate-850 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-bold transition-all cursor-pointer"
                  >
                    Back
                  </button>
                ) : (
                  <button
                    onClick={handleSkipTour}
                    className="px-3 py-1.5 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-350 rounded-xl text-xs font-bold transition-all cursor-pointer"
                  >
                    Skip
                  </button>
                )}
                
                <button
                  onClick={handleNextTourStep}
                  className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white rounded-xl text-xs font-bold transition-all shadow-sm hover-scale cursor-pointer"
                >
                  {tourStep === 4 ? "Get Started" : "Next"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Profile Settings Modal */}
      {showSettingsModal && profile && (
        <div className="fixed inset-0 bg-slate-900/40 dark:bg-slate-950/60 backdrop-blur-sm z-55 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-md p-6 relative overflow-hidden animate-in fade-in zoom-in duration-200">
            {/* Background Accent */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 dark:bg-blue-400/5 rounded-full -mr-10 -mt-10 pointer-events-none" />

            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Settings className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white font-display tracking-tight">Profile Settings</h3>
              </div>
              <button
                onClick={() => setShowSettingsModal(false)}
                className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-350 rounded-xl transition-colors cursor-pointer"
                title="Close settings"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Profile Summary Card */}
            <div className="mt-5 bg-slate-50 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-850 rounded-2xl p-4 flex items-center gap-3.5">
              <img
                src={profile.photoURL || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=80&q=80"}
                alt={profile.displayName}
                className="w-12 h-12 rounded-xl object-cover border border-slate-200/80 dark:border-slate-800 shrink-0"
              />
              <div className="min-w-0 flex-1">
                <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate">{profile.displayName}</h4>
                <p className="text-xs text-slate-400 dark:text-slate-500 truncate font-sans">{profile.email}</p>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="text-[9px] bg-blue-50 dark:bg-blue-950/40 text-blue-650 dark:text-blue-455 font-mono font-bold px-1.5 py-0.5 rounded uppercase tracking-wider">
                    {profile.role}
                  </span>
                  <span className="text-[9px] bg-amber-50 dark:bg-amber-950/40 text-amber-750 dark:text-amber-450 font-mono font-bold px-1.5 py-0.5 rounded uppercase tracking-wider">
                    {profile.points} XP
                  </span>
                </div>
              </div>
            </div>

            {/* Settings Options */}
            <div className="mt-6 space-y-4">
              <p className="text-[10px] text-slate-400 dark:text-slate-500 font-mono uppercase tracking-wider">Feed Preferences</p>
              
              <div className="flex items-start justify-between gap-4 p-1">
                <div className="space-y-1">
                  <label htmlFor="hide-old-reports-checkbox" className="text-xs font-bold text-slate-800 dark:text-slate-200 cursor-pointer">
                    Hide reports older than 90 days
                  </label>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed font-sans">
                    Cleans up your feed by focusing only on recent or actively addressed local concerns.
                  </p>
                </div>
                <button
                  id="hide-old-reports-checkbox"
                  role="checkbox"
                  aria-checked={profile.hideOldReports || false}
                  onClick={() => handleUpdateSettings(!profile.hideOldReports)}
                  className={`w-11 h-6 shrink-0 rounded-full transition-all relative outline-none cursor-pointer p-0.5 ${
                    profile.hideOldReports ? "bg-blue-600 dark:bg-blue-500" : "bg-slate-200 dark:bg-slate-800"
                  }`}
                >
                  <span
                    className={`w-5 h-5 rounded-full bg-white shadow-sm block transition-all ${
                      profile.hideOldReports ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Close Button */}
            <div className="mt-8 pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <button
                onClick={() => setShowSettingsModal(false)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
              >
                Close Settings
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
