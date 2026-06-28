import React from "react";
import {
  MapPin,
  Calendar,
  Edit3,
  Trash2,
  CheckCircle2,
  X,
  Check,
  Search,
  ExternalLink,
  ShieldAlert,
  Activity,
  AlertTriangle,
  FolderOpen,
  Award,
} from "lucide-react";
import { CommunityReport, UserProfile } from "../types";

interface MyActivityProps {
  reports: CommunityReport[];
  profile: UserProfile | null;
  onSelectReport: (id: string) => void;
  setActiveTab: (tab: "map" | "insights" | "leaderboard" | "my-activity") => void;
  onEditReport: (
    id: string,
    updatedData: {
      title: string;
      description: string;
      category: string;
      severity: "Low" | "Medium" | "High" | "Critical";
    }
  ) => Promise<void>;
  onDeleteReport: (id: string) => Promise<void>;
}

export default function MyActivity({
  reports,
  profile,
  onSelectReport,
  setActiveTab,
  onEditReport,
  onDeleteReport,
}: MyActivityProps) {
  const [searchQuery, setSearchQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("All");

  // Track editing state per report ID
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editForm, setEditForm] = React.useState({
    title: "",
    description: "",
    category: "",
    severity: "Medium" as "Low" | "Medium" | "High" | "Critical",
  });

  // Track deletion confirmation state per report ID
  const [deletingId, setDeletingId] = React.useState<string | null>(null);

  const deletingReport = React.useMemo(() => {
    return deletingId ? reports.find((r) => r.id === deletingId) : null;
  }, [deletingId, reports]);

  // Filter reports to only those created by the logged-in user
  const myReports = React.useMemo(() => {
    if (!profile) return [];
    return reports.filter((r) => r.reporterId === profile.uid);
  }, [reports, profile]);

  // Compute statistics from user's reports
  const stats = React.useMemo(() => {
    const total = myReports.length;
    const resolved = myReports.filter((r) => r.status === "Resolved").length;
    const inProgress = myReports.filter(
      (r) => r.status === "In Progress" || r.status === "Investigating"
    ).length;
    const reported = myReports.filter((r) => r.status === "Reported").length;

    return { total, resolved, inProgress, reported };
  }, [myReports]);

  // Apply search query and status filter on user's reports
  const filteredMyReports = React.useMemo(() => {
    return myReports.filter((r) => {
      const matchesSearch =
        r.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.address.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus = statusFilter === "All" || r.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [myReports, searchQuery, statusFilter]);

  // Handle Edit Action Toggle
  const startEditing = (report: CommunityReport) => {
    setEditingId(report.id);
    setEditForm({
      title: report.title,
      description: report.description,
      category: report.category,
      severity: report.severity,
    });
    setDeletingId(null); // Cancel deletion if editing starts
  };

  const cancelEditing = () => {
    setEditingId(null);
  };

  const handleSaveEdit = async (id: string) => {
    if (!editForm.title.trim() || !editForm.description.trim()) return;
    await onEditReport(id, editForm);
    setEditingId(null);
  };

  // Format timestamp safely
  const formatDate = (timestamp: any) => {
    if (!timestamp) return "Just now";
    if (timestamp.toDate) {
      return timestamp.toDate().toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    }
    return new Date(timestamp).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case "Resolved":
        return "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900/40";
      case "In Progress":
        return "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-400 dark:border-indigo-900/40";
      case "Investigating":
        return "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900/40";
      default:
        return "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-350 dark:border-slate-700";
    }
  };

  const getSeverityStyle = (severity: string) => {
    switch (severity) {
      case "Critical":
        return "bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-900/40";
      case "High":
        return "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-950/40 dark:text-orange-400 dark:border-orange-900/40";
      case "Medium":
        return "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900/40";
      default:
        return "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-355 dark:border-slate-700";
    }
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

  const civicImpactScore = (stats.resolved * 3) + ((profile?.verificationsCount || 0) * 1);

  return (
    <div className="space-y-8">
      {/* Header section */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 md:p-8 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="text-blue-600 dark:text-blue-400 text-xs font-semibold uppercase tracking-wider font-mono">
              My Submissions
            </span>
            <h2 className="text-2xl font-bold text-slate-800 dark:text-white font-display mt-1">
              My Activity & Dashboard
            </h2>
            <p className="text-slate-500 dark:text-slate-400 text-xs mt-1 font-sans">
              Manage, edit, and keep track of all safety hazards you have reported in the community.
            </p>
          </div>

          {profile && (
            <div className="flex flex-wrap items-center gap-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl px-4 py-2 text-xs text-slate-600 dark:text-slate-300 font-sans shadow-sm">
              <span className="font-bold text-blue-600 dark:text-blue-400">{profile.points} XP Earned</span>
              <span className="text-slate-300 dark:text-slate-700">|</span>
              <span className="font-semibold text-slate-700 dark:text-slate-300">{stats.total} Reports Submitted</span>
              <span className="text-slate-300 dark:text-slate-700">|</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                <Award className="w-3.5 h-3.5 text-emerald-500" /> Civic Impact: {civicImpactScore}
              </span>
            </div>
          )}
        </div>

        {/* User Specific Mini-stats widgets */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-8">
          <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200/60 dark:border-slate-800/60 rounded-2xl p-4 shadow-inner">
            <p className="text-[10px] text-slate-400 dark:text-slate-500 font-mono uppercase">Total Reports</p>
            <h4 className="text-xl font-bold text-slate-800 dark:text-slate-200 font-mono mt-1">
              {stats.total}
            </h4>
          </div>

          <div className="bg-amber-50/30 dark:bg-amber-950/10 border border-amber-200/40 dark:border-amber-900/20 rounded-2xl p-4 shadow-inner">
            <p className="text-[10px] text-amber-600 dark:text-amber-500 font-mono uppercase">Pending/New</p>
            <h4 className="text-xl font-bold text-amber-700 dark:text-amber-400 font-mono mt-1">
              {stats.reported}
            </h4>
          </div>

          <div className="bg-indigo-50/30 dark:bg-indigo-950/10 border border-indigo-200/40 dark:border-indigo-900/20 rounded-2xl p-4 shadow-inner">
            <p className="text-[10px] text-indigo-600 dark:text-indigo-500 font-mono uppercase">In Action</p>
            <h4 className="text-xl font-bold text-indigo-700 dark:text-indigo-400 font-mono mt-1">
              {stats.inProgress}
            </h4>
          </div>

          <div className="bg-emerald-50/30 dark:bg-emerald-950/10 border border-emerald-200/40 dark:border-emerald-900/20 rounded-2xl p-4 shadow-inner">
            <p className="text-[10px] text-emerald-600 dark:text-emerald-500 font-mono uppercase">Resolved</p>
            <h4 className="text-xl font-bold text-emerald-700 dark:text-emerald-400 font-mono mt-1">
              {stats.resolved}
            </h4>
          </div>

          <div className="bg-emerald-500/10 dark:bg-emerald-950/20 border border-emerald-500/20 dark:border-emerald-900/40 rounded-2xl p-4 flex flex-col justify-between relative overflow-hidden shadow-inner">
            <div>
              <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono uppercase tracking-wider">Civic Impact Badge</p>
              <h4 className="text-xl font-bold text-slate-800 dark:text-white font-mono mt-0.5">
                {civicImpactScore} <span className="text-xs text-slate-500 dark:text-slate-400 font-sans">pts</span>
              </h4>
            </div>
            <div className="mt-1 flex items-center gap-1.5">
              <Award className="w-4 h-4 text-emerald-500 animate-pulse" />
              <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300">
                {civicImpactScore >= 50 ? "Civic Champion" : civicImpactScore >= 20 ? "Active Steward" : civicImpactScore >= 5 ? "Local Contributor" : "Civic Novice"}
              </span>
            </div>
            <p className="text-[8px] text-slate-400 dark:text-slate-500 font-sans mt-0.5 leading-tight">
              Resolved (3x) + Verified (1x)
            </p>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Filter / Search panel */}
        <div className="lg:col-span-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-3xl shadow-sm space-y-4">
          <h3 className="text-xs font-bold text-slate-700 dark:text-slate-200 font-display uppercase tracking-wider flex items-center gap-2">
            <Search className="w-4 h-4 text-blue-600 dark:text-blue-400" /> Filter My Activity
          </h3>

          <div className="space-y-3 font-sans">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase font-mono mb-1.5">
                Search Submissions
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Keywords in title or address..."
                  className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 hover:border-slate-300 focus:border-blue-500 focus:bg-white text-xs text-slate-800 dark:text-white placeholder-slate-400 rounded-xl transition-all focus:outline-none"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 rounded-full transition-colors cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase font-mono mb-1.5">
                Resolution Status
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 hover:border-slate-300 focus:border-blue-500 text-xs font-semibold text-slate-600 dark:text-slate-300 px-3.5 py-2 rounded-xl focus:outline-none transition-all cursor-pointer"
              >
                <option value="All">All Statuses</option>
                <option value="Reported">Reported</option>
                <option value="Investigating">Investigating</option>
                <option value="In Progress">In Progress</option>
                <option value="Resolved">Resolved</option>
              </select>
            </div>
          </div>
        </div>

        {/* Main List Column */}
        <div className="lg:col-span-8 space-y-4">
          {filteredMyReports.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-12 text-center shadow-sm">
              <FolderOpen className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
              <h4 className="text-sm font-bold text-slate-700 dark:text-white font-display">No Submissions Found</h4>
              {myReports.length === 0 ? (
                <>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto font-sans">
                    You have not reported any community hazards yet. Together we can keep Maple Heights safe!
                  </p>
                  <button
                    onClick={() => setActiveTab("map")}
                    className="mt-5 px-4.5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl transition-all shadow-md shadow-blue-500/10 cursor-pointer"
                  >
                    Report First Issue
                  </button>
                </>
              ) : (
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-sans">
                  No submissions match the selected search query or status filter.
                </p>
              )}
            </div>
          ) : (
            filteredMyReports.map((report) => {
              const isEditing = editingId === report.id;
              const isDeleting = deletingId === report.id;

              return (
                <div
                  key={report.id}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm hover:shadow-md transition-shadow"
                >
                  {isEditing ? (
                    /* EDIT MODE INPUT FORM */
                    <div className="p-5 md:p-6 space-y-4 font-sans">
                      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                        <span className="text-xs font-bold text-slate-700 dark:text-white font-display flex items-center gap-1.5">
                          <Edit3 className="w-4 h-4 text-blue-600" /> Edit Report Details
                        </span>
                        <button
                          onClick={cancelEditing}
                          className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-3 md:col-span-2">
                          <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase font-mono">
                            Title
                          </label>
                          <input
                            type="text"
                            value={editForm.title}
                            onChange={(e) =>
                              setEditForm({ ...editForm, title: e.target.value })
                            }
                            placeholder="Briefly describe the hazard..."
                            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-blue-500 text-xs px-3.5 py-2 rounded-xl focus:outline-none transition-all font-sans text-slate-800 dark:text-white"
                            required
                          />
                        </div>

                        <div className="space-y-3">
                          <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase font-mono">
                            Category
                          </label>
                          <select
                            value={editForm.category}
                            onChange={(e) =>
                              setEditForm({ ...editForm, category: e.target.value })
                            }
                            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-blue-500 text-xs px-3 py-2 rounded-xl focus:outline-none transition-all cursor-pointer font-sans text-slate-800 dark:text-white"
                          >
                            <option value="Pothole">Pothole</option>
                            <option value="Water Leakage">Water Leakage</option>
                            <option value="Damaged Streetlight">Damaged Streetlight</option>
                            <option value="Waste Management">Waste Management</option>
                            <option value="Public Infrastructure">Public Infrastructure</option>
                          </select>
                        </div>

                        <div className="space-y-3">
                          <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase font-mono">
                            Severity Level
                          </label>
                          <select
                            value={editForm.severity}
                            onChange={(e) =>
                              setEditForm({
                                ...editForm,
                                severity: e.target.value as any,
                              })
                            }
                            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-blue-500 text-xs px-3 py-2 rounded-xl focus:outline-none transition-all cursor-pointer font-sans text-slate-800 dark:text-white"
                          >
                            <option value="Low">Low Severity</option>
                            <option value="Medium">Medium Severity</option>
                            <option value="High">High Severity</option>
                            <option value="Critical">Critical Severity</option>
                          </select>
                        </div>

                        <div className="space-y-3 md:col-span-2">
                          <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase font-mono">
                            Description Note
                          </label>
                          <textarea
                            value={editForm.description}
                            onChange={(e) =>
                              setEditForm({ ...editForm, description: e.target.value })
                            }
                            rows={3}
                            placeholder="Provide details of the hazard (e.g. dimensions, danger it causes, etc.)..."
                            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-blue-500 text-xs px-3.5 py-2 rounded-xl focus:outline-none transition-all font-sans resize-none text-slate-800 dark:text-white"
                            required
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-end gap-2 border-t border-slate-100 dark:border-slate-800 pt-3">
                        <button
                          type="button"
                          onClick={cancelEditing}
                          className="px-3.5 py-2 border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-slate-700 text-xs font-bold rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSaveEdit(report.id)}
                          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-blue-500/10 cursor-pointer"
                        >
                          Save Changes
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* VIEW MODE CARD DISPLAY */
                    <div className="flex flex-col md:flex-row">
                      {/* Left Thumbnail Section */}
                      <div className="md:w-48 h-36 md:h-auto relative bg-slate-100 dark:bg-slate-950 shrink-0">
                        <img
                          src={report.imageUrl}
                          alt={report.title}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute top-3 left-3 flex flex-col gap-1.5 z-10">
                          <span
                            className={`text-[8px] tracking-wider border px-2 py-0.5 rounded-md font-bold uppercase backdrop-blur-md shadow-sm ${getSeverityStyle(
                              report.severity
                            )}`}
                          >
                            {report.severity}
                          </span>
                        </div>
                      </div>

                      {/* Right Card Content */}
                      <div className="flex-1 p-5 md:p-6 flex flex-col justify-between space-y-4">
                        <div>
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-[10px] bg-slate-100 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60 text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded-md font-semibold tracking-wide uppercase font-mono">
                              {report.category}
                            </span>

                            <div className="flex items-center gap-2">
                              {isAwaitingAttention(report) && (
                                <span className="text-[9px] px-2 py-0.5 rounded font-bold uppercase bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-400 border border-amber-200 dark:border-amber-900/50 flex items-center gap-1 shrink-0 shadow-sm animate-pulse" title="Active for over 30 days without resolution">
                                  ⚠️ Awaiting Attention
                                </span>
                              )}
                              <span
                                className={`text-[9px] font-bold px-2 py-0.5 border rounded-lg uppercase tracking-wide ${getStatusStyle(
                                  report.status
                                )}`}
                              >
                                {report.status}
                              </span>
                            </div>
                          </div>

                          <h4 className="text-sm font-bold text-slate-800 dark:text-white font-display mt-2 leading-tight">
                            {report.title}
                          </h4>

                          <p className="text-xs text-slate-500 dark:text-slate-400 font-sans mt-2 line-clamp-2 leading-relaxed">
                            {report.description}
                          </p>

                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-slate-400 dark:text-slate-500 font-mono mt-3">
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3.5 h-3.5 text-slate-300 dark:text-slate-750" /> {report.address}
                            </span>
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3.5 h-3.5 text-slate-300 dark:text-slate-750" />{" "}
                              {formatDate(report.createdAt)}
                            </span>
                          </div>
                        </div>

                        {/* Card Actions Footer */}
                        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 dark:border-slate-800/80 pt-3.5">
                          <div className="text-[10px] text-slate-500 dark:text-slate-400 font-sans">
                            <span className="font-bold text-slate-700 dark:text-slate-300 font-mono">
                              {report.upvotes}
                            </span>{" "}
                            community verifications
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => startEditing(report)}
                              className="p-2 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer flex items-center gap-1 text-[10px] font-bold"
                              title="Edit details"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                              <span>Edit</span>
                            </button>

                            <button
                              onClick={() => setDeletingId(report.id)}
                              className="p-2 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors cursor-pointer flex items-center gap-1 text-[10px] font-bold"
                              title="Delete report"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Delete</span>
                            </button>

                            <button
                              onClick={() => {
                                onSelectReport(report.id);
                                setActiveTab("map");
                                // Scroll to map top nicely
                                window.scrollTo({ top: 0, behavior: "smooth" });
                              }}
                              className="p-2 bg-blue-50 dark:bg-blue-950/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl text-[10px] font-bold transition-all flex items-center gap-1 hover-scale shadow-sm cursor-pointer border border-blue-100 dark:border-blue-900/45"
                              title="Locate and track on Live Map"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                              <span>Track on Map</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      {deletingReport && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-md p-6 relative overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-rose-50 dark:bg-rose-950/40 rounded-2xl border border-rose-100 dark:border-rose-900/50 text-rose-600 dark:text-rose-400 shrink-0">
                <Trash2 className="w-6 h-6" />
              </div>
              <div className="space-y-2">
                <h3 className="text-base font-bold text-slate-900 dark:text-white font-display">Delete Report?</h3>
                <p className="text-slate-500 dark:text-slate-400 text-xs leading-relaxed font-sans">
                  Are you sure you want to delete <span className="font-semibold text-slate-850 dark:text-slate-200">"{deletingReport.title}"</span>? This action is permanent and will completely remove this civic report and all of its community upvotes/verifications.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 mt-6 border-t border-slate-100 dark:border-slate-800 pt-4">
              <button
                onClick={() => setDeletingId(null)}
                className="px-4 py-2 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-xs transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  await onDeleteReport(deletingReport.id);
                  setDeletingId(null);
                }}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold text-xs transition-colors shadow-sm cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
