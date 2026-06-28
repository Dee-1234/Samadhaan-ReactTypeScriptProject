import React from "react";
import { motion } from "motion/react";
import {
  MapPin,
  Calendar,
  BookmarkX,
  CheckCircle2,
  ExternalLink,
  ShieldAlert,
  Search,
  Filter,
  AlertTriangle,
  Flame,
  Droplet,
  Trash2,
  ThumbsUp,
} from "lucide-react";
import { CommunityReport } from "../types";

interface SavedIssuesProps {
  reports: CommunityReport[];
  savedIssueIds: string[];
  onToggleSave: (id: string) => void;
  onSelectReport: (id: string) => void;
  setActiveTab: (tab: "map" | "insights" | "leaderboard" | "my-activity" | "saved-issues") => void;
}

export default function SavedIssues({
  reports,
  savedIssueIds,
  onToggleSave,
  onSelectReport,
  setActiveTab,
}: SavedIssuesProps) {
  const [searchQuery, setSearchQuery] = React.useState("");
  const [severityFilter, setSeverityFilter] = React.useState("All");

  // Get bookmarked reports
  const savedReports = React.useMemo(() => {
    return reports.filter((r) => savedIssueIds.includes(r.id));
  }, [reports, savedIssueIds]);

  // Apply search query and severity filters
  const filteredReports = React.useMemo(() => {
    return savedReports.filter((r) => {
      const matchesSearch =
        r.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.address.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.category.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesSeverity = severityFilter === "All" || r.severity === severityFilter;

      return matchesSearch && matchesSeverity;
    });
  }, [savedReports, searchQuery, severityFilter]);

  // Helper for severity color codes
  const getSeverityBadgeStyles = (severity: string) => {
    switch (severity) {
      case "Critical":
        return "bg-rose-100 border border-rose-200 text-rose-700 dark:bg-rose-950/40 dark:border-rose-900/50 dark:text-rose-400";
      case "High":
        return "bg-orange-100 border border-orange-200 text-orange-700 dark:bg-orange-950/40 dark:border-orange-900/50 dark:text-orange-400";
      case "Medium":
        return "bg-amber-100 border border-amber-200 text-amber-700 dark:bg-amber-950/40 dark:border-amber-900/50 dark:text-amber-400";
      default:
        return "bg-slate-100 border border-slate-200 text-slate-700 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300";
    }
  };

  const getStatusBadgeStyles = (status: string) => {
    switch (status) {
      case "Resolved":
        return "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900/50";
      case "In Progress":
        return "bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-900/50";
      case "Investigating":
        return "bg-purple-50 text-purple-700 border border-purple-200 dark:bg-purple-950/40 dark:text-purple-400 dark:border-purple-900/50";
      default:
        return "bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-800 dark:text-slate-350 dark:border-slate-700";
    }
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return "Recent";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const isAwaitingAttention = (report: any): boolean => {
    if (report.status === "Resolved") return false;
    if (!report.createdAt) return false;
    
    const createdMs = report.createdAt.toDate 
      ? report.createdAt.toDate().getTime() 
      : (report.createdAt.seconds !== undefined ? report.createdAt.seconds * 1000 : new Date(report.createdAt).getTime());
      
    const ageInDays = (Date.now() - createdMs) / (1000 * 60 * 60 * 24);
    return ageInDays > 30;
  };

  return (
    <div className="space-y-6">
      
      {/* Overview stats header */}
      <div className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-3xl p-6 sm:p-8 shadow-sm relative overflow-hidden">
        <div className="absolute right-0 bottom-0 translate-y-12 translate-x-12 opacity-10 pointer-events-none">
          <ShieldAlert className="w-64 h-64" />
        </div>
        <div className="relative z-10 max-w-2xl space-y-2">
          <span className="bg-white/20 text-white text-[10px] font-extrabold px-3 py-1 rounded-xl uppercase tracking-wider font-mono">
            Personal Hazard Watchlist
          </span>
          <h2 className="text-2xl sm:text-3xl font-black font-display tracking-tight leading-none">
            Saved Issues &amp; Hazards
          </h2>
          <p className="text-xs sm:text-sm text-blue-50/90 font-sans max-w-lg">
            Keep track of active community concerns near your daily routes. You will receive proximity alerts for bookmarked high-severity issues.
          </p>
        </div>
      </div>

      {/* Controls: Search and Severity Filters */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row items-center gap-3.5">
          
          {/* Search bar */}
          <div className="relative w-full md:flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search through saved hazards by name, location, or notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-950 hover:bg-slate-50/80 focus:bg-white focus:dark:bg-slate-900 border border-slate-200 dark:border-slate-800 focus:border-blue-500 pl-11 pr-4 py-2.5 rounded-2xl text-xs font-semibold focus:outline-none transition-all shadow-inner dark:text-white"
            />
          </div>

          {/* Filters */}
          <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto shrink-0 pb-1 md:pb-0">
            <div className="flex items-center gap-1.5 text-slate-400 shrink-0 text-xs font-bold mr-1">
              <Filter className="w-4 h-4" />
              <span>Severity:</span>
            </div>
            {["All", "Critical", "High", "Medium", "Low"].map((level) => (
              <button
                key={`filter-${level}`}
                onClick={() => setSeverityFilter(level)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  severityFilter === level
                    ? "bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 shadow-sm"
                    : "bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"
                }`}
              >
                {level}
              </button>
            ))}
          </div>

        </div>
      </div>

      {/* List / Cards Layout */}
      {filteredReports.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-12 text-center shadow-sm max-w-lg mx-auto space-y-4">
          <div className="w-16 h-16 bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900/50 rounded-2xl text-blue-500 flex items-center justify-center mx-auto">
            <BookmarkX className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-slate-800 dark:text-white font-display">
              {savedReports.length === 0 ? "No Saved Issues Yet" : "No Matching Hazards"}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-sans leading-relaxed">
              {savedReports.length === 0
                ? "Bookmark hazards of concern from the report details panel to track and view them in this central hub."
                : "Try adjusting your search keywords or choosing a different severity filter level."}
            </p>
          </div>
          {savedReports.length === 0 && (
            <button
              onClick={() => setActiveTab("map")}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-xs font-bold shadow-md hover-scale transition-all cursor-pointer"
            >
              Explore Live Map
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredReports.map((report, idx) => (
            <motion.div
              key={`saved-issue-card-${report.id}`}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: idx * 0.05 }}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm flex flex-col hover:shadow-md hover:border-slate-300 dark:hover:border-slate-700 transition-all group"
            >
              {/* Photo preview with overlays */}
              <div className="relative h-44 bg-slate-100 dark:bg-slate-950 overflow-hidden">
                <img
                  src={report.imageUrl}
                  alt={report.title}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
                
                {/* Category & Severity badges */}
                <div className="absolute top-4 left-4 flex gap-1.5 z-10">
                  <span className="text-[9px] bg-white/95 dark:bg-slate-900/95 backdrop-blur-md px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-800 font-bold text-blue-600 dark:text-blue-400 uppercase font-mono shadow-sm">
                    {report.category}
                  </span>
                  <span className={`text-[9px] px-2.5 py-1 rounded-lg font-bold uppercase shadow-sm ${getSeverityBadgeStyles(report.severity)}`}>
                    {report.severity}
                  </span>
                </div>

                {/* Bookmark remove button */}
                <button
                  onClick={() => onToggleSave(report.id)}
                  className="absolute top-4 right-4 p-2 bg-white/90 dark:bg-slate-900/90 hover:bg-white dark:hover:bg-slate-800 text-rose-500 rounded-xl hover:text-rose-600 border border-slate-200 dark:border-slate-700 transition-all shadow-md cursor-pointer"
                  title="Remove bookmark"
                >
                  <Trash2 className="w-4 h-4" />
                </button>

                {/* Bottom overlays on image */}
                <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between text-white">
                  <div className="flex items-center gap-1.5 text-[10px] font-bold font-mono">
                    <Calendar className="w-3.5 h-3.5 text-blue-300" />
                    <span>Reported {formatDate(report.createdAt)}</span>
                  </div>
                  <div className="flex items-center gap-1 bg-white/20 px-2 py-0.5 rounded-md backdrop-blur-sm text-[10px] font-bold font-mono">
                    <ThumbsUp className="w-3 h-3 text-blue-300" />
                    <span>{report.upvotes}</span>
                  </div>
                </div>
              </div>

              {/* Card Main Contents */}
              <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 font-display leading-snug truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                      {report.title}
                    </h3>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {isAwaitingAttention(report) && (
                        <span className="text-[9px] px-2 py-0.5 rounded font-bold uppercase bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-400 border border-amber-200 dark:border-amber-900/50 flex items-center gap-1 shadow-sm animate-pulse" title="Active for over 30 days without resolution">
                          ⚠️ Awaiting Attention
                        </span>
                      )}
                      <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wide font-mono ${getStatusBadgeStyles(report.status)}`}>
                        {report.status}
                      </span>
                    </div>
                  </div>

                  <p className="text-[10px] text-slate-500 dark:text-slate-400 font-mono flex items-center gap-1 leading-tight">
                    <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                    <span className="truncate">{report.address}</span>
                  </p>

                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed line-clamp-3 pt-1.5 border-t border-slate-100 dark:border-slate-800/80 font-sans">
                    {report.description}
                  </p>
                </div>

                {/* Actions banner */}
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-2 shrink-0">
                  <button
                    onClick={() => {
                      onSelectReport(report.id);
                      setActiveTab("map");
                      // Smoothly scroll down to map element
                      setTimeout(() => {
                        const mapElement = document.getElementById("map-anchor");
                        if (mapElement) {
                          mapElement.scrollIntoView({ behavior: "smooth" });
                        }
                      }, 100);
                    }}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3.5 py-2 bg-blue-50 dark:bg-blue-950/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Locate on Map</span>
                  </button>
                  
                  <button
                    onClick={() => onToggleSave(report.id)}
                    className="px-3.5 py-2 bg-rose-50 dark:bg-rose-950/20 hover:bg-rose-100 dark:hover:bg-rose-900/30 text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-900/40 hover:border-rose-200 rounded-xl text-xs font-bold transition-all cursor-pointer"
                    title="Remove Bookmark"
                  >
                    Unsave
                  </button>
                </div>
              </div>

            </motion.div>
          ))}
        </div>
      )}

    </div>
  );
}
