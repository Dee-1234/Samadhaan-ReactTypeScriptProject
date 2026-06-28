import React from "react";
import { Sparkles, AlertTriangle, FileText, ChevronRight, BarChart3, Loader2, Megaphone, Check, Clock, TrendingUp, TrendingDown, Timer, CheckCircle2, Calendar, ShieldAlert, Download } from "lucide-react";
import { CommunityReport, HotspotPrediction, UserProfile } from "../types";
import CategoryChart from "./CategoryChart";

interface PredictiveDashboardProps {
  reports: CommunityReport[];
  profile?: UserProfile | null;
}

export default function PredictiveDashboard({ reports, profile }: PredictiveDashboardProps) {
  const [loading, setLoading] = React.useState(false);
  const [predictions, setPredictions] = React.useState<HotspotPrediction[]>([]);
  const [summary, setSummary] = React.useState<string>("");
  const [announcement, setAnnouncement] = React.useState<string>("");
  const [copied, setCopied] = React.useState(false);

  const isMunicipalAgent = profile?.role === "municipal_agent" || profile?.role === "admin";

  const exportToCSV = () => {
    if (reports.length === 0) return;

    const escapeCSV = (val: any) => {
      if (val === undefined || val === null) return "";
      let str = "";
      if (typeof val.toDate === "function") {
        str = val.toDate().toISOString();
      } else if (val.seconds !== undefined) {
        str = new Date(val.seconds * 1000).toISOString();
      } else if (val instanceof Date) {
        str = val.toISOString();
      } else {
        str = String(val);
      }
      // Escape double quotes and surround with double quotes
      return `"${str.replace(/"/g, '""')}"`;
    };

    const headers = [
      "ID",
      "Title",
      "Description",
      "Category",
      "Address",
      "Latitude",
      "Longitude",
      "Status",
      "Severity",
      "Reporter ID",
      "Reporter Name",
      "Upvotes",
      "Created At",
      "Updated At"
    ];

    const rows = reports.map((r) => [
      escapeCSV(r.id),
      escapeCSV(r.title),
      escapeCSV(r.description),
      escapeCSV(r.category),
      escapeCSV(r.address),
      r.latitude !== undefined ? String(r.latitude) : "",
      r.longitude !== undefined ? String(r.longitude) : "",
      escapeCSV(r.status),
      escapeCSV(r.severity),
      escapeCSV(r.reporterId),
      escapeCSV(r.reporterName),
      r.upvotes !== undefined ? String(r.upvotes) : "0",
      escapeCSV(r.createdAt),
      escapeCSV(r.updatedAt)
    ]);

    const csvString = [headers.join(","), ...rows.map((e) => e.join(","))].join("\r\n");
    const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `community_hazard_reports_${new Date().toISOString().slice(0, 10)}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Helper to format hours in a beautiful human-readable way
  const formatHours = (hours: number) => {
    if (hours < 1) {
      return `${Math.round(hours * 60)}m`;
    }
    if (hours < 24) {
      return `${hours.toFixed(1)}h`;
    }
    const days = hours / 24;
    return `${days.toFixed(1)}d`;
  };

  const resolutionMetrics = React.useMemo(() => {
    const getTimestampMs = (val: any): number => {
      if (!val) return Date.now();
      if (typeof val.toDate === "function") return val.toDate().getTime();
      if (val.seconds !== undefined) return val.seconds * 1000;
      return new Date(val).getTime();
    };

    const categories = Array.from(new Set(reports.map((r) => r.category || "Other")));
    
    // Default/Historical targets in hours
    const targets: Record<string, number> = {
      "Pothole": 48,
      "Water Leakage": 24,
      "Damaged Streetlight": 72,
      "Street Light": 72,
      "Waste Management": 36,
      "Trash Dump": 36,
      "Power Outage": 12,
      "Public Infrastructure": 96,
      "Other": 48
    };

    const categoryData = categories.map((cat) => {
      const catReports = reports.filter((r) => (r.category || "Other") === cat);
      const resolved = catReports.filter((r) => r.status === "Resolved");
      const active = catReports.filter((r) => r.status !== "Resolved");

      // Calculate actual average resolution time
      let actualAvgHours: number | null = null;
      if (resolved.length > 0) {
        const totalDurationMs = resolved.reduce((acc, r) => {
          const start = getTimestampMs(r.createdAt);
          const end = getTimestampMs(r.updatedAt);
          return acc + Math.max(0, end - start);
        }, 0);
        actualAvgHours = totalDurationMs / resolved.length / (1000 * 60 * 60);
      }

      // Calculate average open time for active issues
      let avgOpenHours: number | null = null;
      let overdueCount = 0;
      const targetHours = targets[cat] || 48;

      if (active.length > 0) {
        const now = Date.now();
        const totalOpenMs = active.reduce((acc, r) => {
          const start = getTimestampMs(r.createdAt);
          const ageMs = Math.max(0, now - start);
          const ageHours = ageMs / (1000 * 60 * 60);
          if (ageHours > targetHours) {
            overdueCount++;
          }
          return acc + ageMs;
        }, 0);
        avgOpenHours = totalOpenMs / active.length / (1000 * 60 * 60);
      }

      return {
        category: cat,
        targetHours,
        actualAvgHours,
        avgOpenHours,
        resolvedCount: resolved.length,
        activeCount: active.length,
        overdueCount
      };
    });

    // Global KPIs
    const totalResolved = reports.filter((r) => r.status === "Resolved");
    let globalActualAvgHours: number | null = null;
    if (totalResolved.length > 0) {
      const sumMs = totalResolved.reduce((acc, r) => {
        const start = getTimestampMs(r.createdAt);
        const end = getTimestampMs(r.updatedAt);
        return acc + Math.max(0, end - start);
      }, 0);
      globalActualAvgHours = sumMs / totalResolved.length / (1000 * 60 * 60);
    }

    const resolutionRate = reports.length > 0 ? (totalResolved.length / reports.length) * 100 : 0;

    // Longest standing active report
    const activeReports = reports.filter((r) => r.status !== "Resolved");
    let longestStandingReport: CommunityReport | null = null;
    let maxAgeMs = 0;
    if (activeReports.length > 0) {
      const now = Date.now();
      activeReports.forEach((r) => {
        const start = getTimestampMs(r.createdAt);
        const ageMs = now - start;
        if (ageMs > maxAgeMs) {
          maxAgeMs = ageMs;
          longestStandingReport = r;
        }
      });
    }

    return {
      categories: categoryData,
      globalActualAvgHours,
      resolutionRate,
      longestStandingAgeDays: maxAgeMs / (1000 * 60 * 60 * 24),
      longestStandingReport
    };
  }, [reports]);

  const fetchPredictiveInsights = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/predictive-insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentReports: reports }),
      });
      const data = await response.json();
      if (data.success && data.insights) {
        setPredictions(data.insights.hotspotPredictions || []);
        setSummary(data.insights.systemReportSummary || "");
        setAnnouncement(data.insights.officialAnnouncementDraft || "");
      }
    } catch (error) {
      console.error("Failed to generate predictive insights:", error);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    if (reports.length > 0 && predictions.length === 0) {
      fetchPredictiveInsights();
    }
  }, [reports]);

  const copyAnnouncement = () => {
    if (!announcement) return;
    navigator.clipboard.writeText(announcement);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-8">
      {/* Overview Card */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 md:p-8 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-10 right-10 opacity-10">
          <Sparkles className="w-24 h-24 text-blue-600" />
        </div>

        <div className="max-w-2xl">
          <span className="text-blue-600 text-xs font-semibold uppercase tracking-wider font-mono flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" /> Gemini Municipal Analytics
          </span>
          <h2 className="text-2xl font-bold text-slate-800 font-display mt-2">Predictive Infrastructure Insights</h2>
          <p className="text-slate-500 text-xs mt-1.5 leading-relaxed font-sans">
            By analyzing citizen report density, weather conditions, and infrastructure lifespans, 
            Gemini forecasts failure hotspots, estimates community safety risks, and drafts official neighborhood announcements.
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              onClick={fetchPredictiveInsights}
              disabled={loading}
              className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-100 text-white disabled:text-slate-400 rounded-xl font-bold text-xs transition-all shadow-md shadow-blue-500/10 hover-scale cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Analyzing Report Trends...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" /> Recalculate Predictions
                </>
              )}
            </button>

            {isMunicipalAgent && (
              <button
                id="export-csv-btn"
                onClick={exportToCSV}
                className="flex items-center gap-2 px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-xl font-bold text-xs transition-all hover-scale cursor-pointer"
                title="Export report data as CSV file"
              >
                <Download className="w-4 h-4 text-slate-500" /> Export Data
              </button>
            )}
          </div>
        </div>
      </div>

      {loading && (
        <div className="flex flex-col items-center justify-center py-20 bg-white border border-slate-200 rounded-3xl shadow-sm">
          <Loader2 className="w-10 h-10 text-blue-600 animate-spin mb-4" />
          <p className="text-xs font-semibold text-slate-700">Gemini model is scanning the local sector database...</p>
          <p className="text-[10px] text-slate-500 mt-1 font-sans">Estimating soil moisture, pipe aging, and structural fatigue metrics.</p>
        </div>
      )}

      {!loading && reports.length > 0 && (
        <>
          <CategoryChart reports={reports} />
          
          {/* Average Time to Resolution Performance Dashboard */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 md:p-8 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <span className="text-blue-600 text-xs font-semibold uppercase tracking-wider font-mono flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" /> Resolution Performance
                </span>
                <h3 className="text-lg font-bold text-slate-800 font-display mt-1">Average Time to Resolution</h3>
                <p className="text-slate-500 text-xs mt-0.5 font-sans">
                  Comparing current active and resolved issue times against historical municipal targets.
                </p>
              </div>
            </div>

            {/* KPI grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-slate-50 border border-slate-200/60 rounded-2xl p-4.5 space-y-1 shadow-sm">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block font-mono">City Resolution Speed</span>
                <div className="flex items-baseline gap-2">
                  <span className="text-xl sm:text-2xl font-black text-slate-800 font-display">
                    {resolutionMetrics.globalActualAvgHours !== null ? formatHours(resolutionMetrics.globalActualAvgHours) : "No data yet"}
                  </span>
                  {resolutionMetrics.globalActualAvgHours !== null && (
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md flex items-center gap-0.5 ${
                      resolutionMetrics.globalActualAvgHours <= 36 ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
                    }`}>
                      {resolutionMetrics.globalActualAvgHours <= 36 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                      {resolutionMetrics.globalActualAvgHours <= 36 ? "Ahead" : "Delayed"}
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-slate-400 font-sans">
                  Target Baseline: 36h City Average
                </p>
              </div>

              <div className="bg-slate-50 border border-slate-200/60 rounded-2xl p-4.5 space-y-1 shadow-sm">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block font-mono">Resolution Rate</span>
                <div className="text-xl sm:text-2xl font-black text-slate-800 font-display">
                  {resolutionMetrics.resolutionRate.toFixed(1)}%
                </div>
                <p className="text-[10px] text-slate-400 font-sans">
                  {reports.filter((r) => r.status === "Resolved").length} of {reports.length} total concerns resolved
                </p>
              </div>

              <div className="bg-slate-50 border border-slate-200/60 rounded-2xl p-4.5 space-y-1 shadow-sm">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block font-mono">Oldest Active Concern</span>
                {resolutionMetrics.longestStandingReport ? (
                  <div className="space-y-0.5">
                    <div className="text-xs font-bold text-slate-800 truncate" title={resolutionMetrics.longestStandingReport.title}>
                      {resolutionMetrics.longestStandingReport.title}
                    </div>
                    <p className="text-[10px] text-rose-600 font-semibold font-mono flex items-center gap-1">
                      <Timer className="w-3.5 h-3.5" /> Open for {resolutionMetrics.longestStandingAgeDays.toFixed(1)} days
                    </p>
                  </div>
                ) : (
                  <div className="text-xs text-slate-500 italic flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" /> All issues resolved!
                  </div>
                )}
              </div>
            </div>

            {/* Category Comparison Table */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider font-mono">Category Breakdown</h4>
              <div className="border border-slate-200 rounded-2xl overflow-hidden bg-slate-50/10">
                <div className="grid grid-cols-12 bg-slate-100/80 px-4 py-2.5 text-[10px] font-bold text-slate-500 uppercase font-mono tracking-wider border-b border-slate-200">
                  <div className="col-span-4">Category</div>
                  <div className="col-span-2 text-center">Historical Standard</div>
                  <div className="col-span-3 text-center">Current Resolved Avg</div>
                  <div className="col-span-3 text-right font-sans">Performance vs Standard</div>
                </div>
                <div className="divide-y divide-slate-100 bg-white">
                  {resolutionMetrics.categories.map((catData) => {
                    const hasData = catData.actualAvgHours !== null;
                    let percentageDiff = 0;
                    let isFaster = false;
                    if (hasData && catData.actualAvgHours) {
                      percentageDiff = Math.abs(((catData.actualAvgHours - catData.targetHours) / catData.targetHours) * 100);
                      isFaster = catData.actualAvgHours <= catData.targetHours;
                    }

                    return (
                      <div key={catData.category} className="grid grid-cols-12 items-center px-4 py-3 text-xs hover:bg-slate-50/50 transition-colors">
                        {/* Category name + status stats */}
                        <div className="col-span-4 pr-2">
                          <span className="font-bold text-slate-800 font-display block">{catData.category}</span>
                          <span className="text-[9px] text-slate-400 font-sans block mt-0.5">
                            {catData.resolvedCount} resolved &bull; {catData.activeCount} active {catData.overdueCount > 0 && <span className="text-rose-500 font-bold">({catData.overdueCount} overdue)</span>}
                          </span>
                        </div>

                        {/* Standard baseline */}
                        <div className="col-span-2 text-center font-mono font-bold text-slate-600">
                          {catData.targetHours}h
                        </div>

                        {/* Actual resolution average */}
                        <div className="col-span-3 text-center">
                          {hasData && catData.actualAvgHours !== null ? (
                            <span className="font-mono font-bold text-slate-800">
                              {formatHours(catData.actualAvgHours)}
                            </span>
                          ) : (
                            <span className="text-slate-400 italic text-[10px]">No resolved issues</span>
                          )}
                        </div>

                        {/* Performance label */}
                        <div className="col-span-3 text-right">
                          {hasData ? (
                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl font-bold text-[10px] uppercase font-mono shadow-sm ${
                              isFaster
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                                : "bg-rose-50 text-rose-700 border border-rose-100"
                            }`}>
                              {isFaster ? <TrendingUp className="w-3.5 h-3.5 text-emerald-500" /> : <TrendingDown className="w-3.5 h-3.5 text-rose-500" />}
                              {isFaster ? `${percentageDiff.toFixed(0)}% Faster` : `${percentageDiff.toFixed(0)}% Slower`}
                            </span>
                          ) : (
                            <span className="inline-block px-2.5 py-1 rounded-xl font-bold text-[10px] text-slate-400 bg-slate-50 border border-slate-200 font-mono">
                              N/A
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {!loading && predictions.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Predicted Hotspots list */}
          <div className="lg:col-span-7 space-y-4">
            <h3 className="text-sm font-bold text-slate-700 uppercase font-mono tracking-wider flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-500" /> High-Risk Infrastructure Hotspots
            </h3>

            <div className="space-y-4">
              {predictions.map((p, idx) => (
                <div key={idx} className="bg-white border border-slate-200 rounded-2xl p-5 hover:border-slate-300 transition-all flex items-start gap-4 shadow-sm">
                  <div className="p-3 bg-rose-50 rounded-xl border border-rose-100">
                    <span className="text-sm font-bold text-rose-600 font-mono">{p.riskScore}%</span>
                    <span className="block text-[8px] text-rose-500 font-semibold uppercase text-center mt-0.5">Risk</span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="text-sm font-bold text-slate-800 truncate">{p.category} Hazard</h4>
                      <span className="text-[10px] bg-slate-50 border border-slate-200 text-slate-600 px-2 py-0.5 rounded-md font-mono">
                        {p.predictedLocation}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-2 leading-relaxed font-sans">{p.reasoning}</p>

                    <div className="mt-4 flex items-center gap-2 bg-emerald-50 border border-emerald-100 px-3.5 py-2 rounded-xl">
                      <span className="text-[9px] font-bold text-emerald-700 uppercase font-mono whitespace-nowrap">Proposed Fix:</span>
                      <span className="text-xs text-emerald-600 line-clamp-1 font-sans">{p.preventiveAction}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* System Report Summary & Public Notice Panel */}
          <div className="lg:col-span-5 space-y-6">
            {/* Report Summary */}
            {summary && (
              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                <h3 className="text-xs font-bold text-slate-700 uppercase font-mono tracking-wider flex items-center gap-2 mb-3">
                  <BarChart3 className="w-4 h-4 text-blue-600" /> Executive Digest
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-line font-sans">{summary}</p>
              </div>
            )}

            {/* Announcement Draft */}
            {announcement && (
              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
                <div className="flex items-center justify-between gap-4 border-b border-slate-200 pb-3">
                  <h3 className="text-xs font-bold text-slate-700 uppercase font-mono tracking-wider flex items-center gap-2">
                    <Megaphone className="w-4 h-4 text-indigo-600" /> Public Notice Draft
                  </h3>
                  <button
                    onClick={copyAnnouncement}
                    className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                    title="Copy announcement"
                  >
                    {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <FileText className="w-4 h-4" />}
                  </button>
                </div>
                <div className="bg-indigo-50/30 border border-indigo-100 p-4 rounded-xl shadow-inner max-h-56 overflow-y-auto">
                  <p className="text-xs font-mono text-indigo-700 leading-relaxed whitespace-pre-line">{announcement}</p>
                </div>
                <p className="text-[9px] text-slate-400 text-center font-sans">Generated automatically via Gemini 2.5. Official use only.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {!loading && predictions.length === 0 && (
        <div className="py-16 text-center bg-white border border-slate-200 rounded-3xl flex flex-col items-center shadow-sm">
          <BarChart3 className="w-12 h-12 text-slate-400 mb-3" />
          <p className="text-xs font-semibold text-slate-600">No predictions generated yet</p>
          <p className="text-[10px] text-slate-400 mt-1 max-w-xs mx-auto font-sans">
            Report at least one community issue to seed the localized predictive analysis models.
          </p>
        </div>
      )}
    </div>
  );
}
