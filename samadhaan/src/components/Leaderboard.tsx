import React from "react";
import { Trophy, Award, Medal, ShieldCheck, Flame, Star } from "lucide-react";
import { UserProfile, CommunityReport } from "../types";

interface LeaderboardProps {
  currentUser: UserProfile | null;
  reports: CommunityReport[];
}

interface LeaderItem {
  uid: string;
  displayName: string;
  photoURL: string;
  role: 'citizen' | 'municipal_agent' | 'admin';
  points: number;
  reportsCount: number;
  verificationsCount: number;
  resolvedCount: number;
  rankName: string;
}

// Top contributors in the local Maple Heights community
const MOCK_LEADERS: LeaderItem[] = [
  {
    uid: "leader1",
    displayName: "Marcus Finch",
    photoURL: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=80&q=80",
    role: "citizen",
    points: 1250,
    reportsCount: 14,
    verificationsCount: 45,
    resolvedCount: 9,
    rankName: "Supreme Guardian",
  },
  {
    uid: "leader2",
    displayName: "Elena Rostova",
    photoURL: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=80&q=80",
    role: "citizen",
    points: 980,
    reportsCount: 11,
    verificationsCount: 32,
    resolvedCount: 7,
    rankName: "Elite Resolver",
  },
  {
    uid: "leader3",
    displayName: "Devon Lane",
    photoURL: "https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&w=80&q=80",
    role: "citizen",
    points: 740,
    reportsCount: 8,
    verificationsCount: 22,
    resolvedCount: 5,
    rankName: "Vigilant Scout",
  },
  {
    uid: "leader4",
    displayName: "Amara Okoye",
    photoURL: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=80&q=80",
    role: "citizen",
    points: 590,
    reportsCount: 6,
    verificationsCount: 18,
    resolvedCount: 3,
    rankName: "Active Neighbor",
  }
];

export default function Leaderboard({ currentUser, reports }: LeaderboardProps) {
  const [sortBy, setSortBy] = React.useState<"points" | "civicImpact">("points");

  // Dynamic user resolved reports count
  const userResolvedCount = React.useMemo(() => {
    if (!currentUser || !reports) return 0;
    return reports.filter(
      (r) => r.reporterId === currentUser.uid && r.status === "Resolved"
    ).length;
  }, [currentUser, reports]);

  // Combine mock leaders and current user to build dynamic real-time rankings
  const allLeaders = React.useMemo(() => {
    let combined = [...MOCK_LEADERS];
    if (currentUser) {
      const userExists = combined.some((l) => l.uid === currentUser.uid);
      if (!userExists) {
        combined.push({
          uid: currentUser.uid,
          displayName: `${currentUser.displayName} (You)`,
          photoURL: currentUser.photoURL || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=80&q=80",
          role: currentUser.role,
          points: currentUser.points,
          reportsCount: currentUser.reportsCount,
          verificationsCount: currentUser.verificationsCount,
          resolvedCount: userResolvedCount,
          rankName: currentUser.points >= 500 ? "Active Sentinel" : "Local Recipient",
        });
      } else {
        // Update user points if they changed
        combined = combined.map((l) =>
          l.uid === currentUser.uid
            ? {
                ...l,
                points: currentUser.points,
                reportsCount: currentUser.reportsCount,
                verificationsCount: currentUser.verificationsCount,
                resolvedCount: userResolvedCount,
              }
            : l
        );
      }
    }

    // Sort based on chosen metric
    return combined.sort((a, b) => {
      if (sortBy === "civicImpact") {
        const scoreA = (a.resolvedCount * 3) + (a.verificationsCount * 1);
        const scoreB = (b.resolvedCount * 3) + (b.verificationsCount * 1);
        return scoreB - scoreA;
      }
      return b.points - a.points;
    });
  }, [currentUser, reports, sortBy, userResolvedCount]);

  const getRankBadge = (index: number) => {
    switch (index) {
      case 0:
        return <Trophy className="w-6 h-6 text-yellow-400" />;
      case 1:
        return <Medal className="w-6 h-6 text-slate-300" />;
      case 2:
        return <Medal className="w-6 h-6 text-amber-600" />;
      default:
        return <Star className="w-5 h-5 text-slate-500" />;
    }
  };

  const getPointsTier = (pts: number) => {
    if (pts >= 1000) return { title: "Supreme Guardian", color: "text-rose-600 border-rose-200 bg-rose-50 dark:text-rose-400 dark:border-rose-900/50 dark:bg-rose-950/30" };
    if (pts >= 700) return { title: "Elite Resolver", color: "text-indigo-600 border-indigo-200 bg-indigo-50 dark:text-indigo-400 dark:border-indigo-900/50 dark:bg-indigo-950/30" };
    if (pts >= 400) return { title: "Vigilant Scout", color: "text-emerald-600 border-emerald-200 bg-emerald-50 dark:text-emerald-400 dark:border-emerald-900/50 dark:bg-emerald-950/30" };
    return { title: "Local Hero", color: "text-slate-600 border-slate-200 bg-slate-50 dark:text-slate-400 dark:border-slate-800 dark:bg-slate-950/30" };
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 md:p-8 shadow-sm">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-6 mb-6">
        <div>
          <span className="text-blue-600 dark:text-blue-400 text-xs font-semibold uppercase tracking-wider font-mono">Civic Gamification</span>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white font-display mt-1">Community Leaderboard</h2>
          <p className="text-slate-500 dark:text-slate-400 text-xs mt-1 font-sans">Recognizing outstanding residents fixing our neighborhoods.</p>
        </div>

        {currentUser && (
          <div className="flex items-center gap-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl px-5 py-3 shadow-inner">
            <div className="relative">
              <img
                src={currentUser.photoURL || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=80&q=80"}
                alt={currentUser.displayName}
                className="w-12 h-12 rounded-xl object-cover border border-slate-200 dark:border-slate-800"
                referrerPolicy="no-referrer"
              />
              <div className="absolute -bottom-1 -right-1 bg-blue-600 dark:bg-blue-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                XP
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">{currentUser.displayName}</p>
              <div className="flex flex-col gap-1 mt-0.5">
                <div className="flex items-center gap-1.5">
                  <Flame className="w-3.5 h-3.5 text-rose-500 animate-pulse" />
                  <span className="text-sm font-bold text-slate-800 dark:text-slate-200 font-mono">{currentUser.points}</span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-sans">XP</span>
                </div>
                <div className="flex items-center gap-1">
                  <Award className="w-3.5 h-3.5 text-emerald-500" />
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                    {userResolvedCount * 3 + currentUser.verificationsCount} <span className="text-[9px] font-sans font-medium text-slate-500">Civic pts</span>
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Sorting Tabs */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setSortBy("points")}
          className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
            sortBy === "points"
              ? "bg-blue-600 text-white shadow-sm"
              : "bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"
          }`}
        >
          Sort by Experience (XP)
        </button>
        <button
          onClick={() => setSortBy("civicImpact")}
          className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
            sortBy === "civicImpact"
              ? "bg-emerald-600 text-white shadow-sm"
              : "bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"
          }`}
        >
          <Award className="w-3.5 h-3.5" /> Sort by Civic Impact
        </button>
      </div>

      {/* Ranks grid */}
      <div className="space-y-3.5">
        {allLeaders.map((leader, index) => {
          const tier = getPointsTier(leader.points);
          const isCurrentUser = currentUser?.uid === leader.uid;
          const civicScore = (leader.resolvedCount * 3) + (leader.verificationsCount * 1);
          
          return (
            <div
              key={leader.uid}
              className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${
                isCurrentUser
                  ? "bg-blue-50/20 dark:bg-blue-950/10 border-blue-500/30 shadow-sm"
                  : "bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800/60 hover:bg-slate-50/50 hover:dark:bg-slate-850 hover:border-slate-200 hover:dark:border-slate-700"
              }`}
            >
              <div className="flex items-center gap-4">
                {/* Ranking placement */}
                <div className="flex items-center justify-center w-8">
                  {getRankBadge(index)}
                </div>

                {/* Profile Photo */}
                <img
                  src={leader.photoURL}
                  alt={leader.displayName}
                  className="w-10 h-10 rounded-xl object-cover border border-slate-200 dark:border-slate-800"
                  referrerPolicy="no-referrer"
                />

                {/* Name & Title */}
                <div>
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                    {leader.displayName}
                    {isCurrentUser && <span className="text-blue-600 dark:text-blue-400 font-mono text-[10px] ml-1.5 font-normal">(You)</span>}
                  </p>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 mt-0.5">
                    <span className={`text-[9px] font-semibold border px-1.5 py-0.5 rounded-md ${tier.color} w-fit`}>
                      {tier.title}
                    </span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                      {leader.reportsCount} Reports • {leader.verificationsCount} Verifies
                    </span>
                  </div>
                </div>
              </div>

              {/* Score / XP */}
              <div className="text-right flex flex-col items-end gap-1">
                <div>
                  <span className="text-sm font-bold text-blue-600 dark:text-blue-400 font-mono">{leader.points}</span>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 font-sans ml-1">XP</span>
                </div>
                <div className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-bold font-mono bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 text-emerald-700 dark:text-emerald-400 shadow-sm">
                  <Award className="w-3 h-3 text-emerald-500 animate-pulse" /> Civic: {civicScore}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Badges and achievements reward board */}
      <div className="mt-8 border-t border-slate-200 dark:border-slate-800 pt-6">
        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 font-display mb-3">Earn Civic Badges</h3>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-center">
            <Award className="w-7 h-7 text-emerald-500 mx-auto mb-1.5" />
            <span className="block text-[10px] font-bold text-slate-700 dark:text-slate-300">Eco Guardian</span>
            <span className="text-[8px] text-slate-500 dark:text-slate-500 font-sans">Report 5 Waste issues</span>
          </div>
          <div className="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-center">
            <ShieldCheck className="w-7 h-7 text-indigo-500 mx-auto mb-1.5" />
            <span className="block text-[10px] font-bold text-slate-700 dark:text-slate-300">Street Watch</span>
            <span className="text-[8px] text-slate-500 dark:text-slate-500 font-sans">Verify 10 lighting issues</span>
          </div>
          <div className="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-center">
            <Trophy className="w-7 h-7 text-yellow-500 mx-auto mb-1.5" />
            <span className="block text-[10px] font-bold text-slate-700 dark:text-slate-300">First Responder</span>
            <span className="text-[8px] text-slate-500 dark:text-slate-500 font-sans">Quickest local resolution</span>
          </div>
          <div className="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-center">
            <Flame className="w-7 h-7 text-rose-500 mx-auto mb-1.5" />
            <span className="block text-[10px] font-bold text-slate-700 dark:text-slate-300">Active Hero</span>
            <span className="text-[8px] text-slate-500 dark:text-slate-500 font-sans">Maintain 7-day streak</span>
          </div>
          <div className="p-3 bg-emerald-500/10 dark:bg-emerald-950/20 border border-emerald-500/20 dark:border-emerald-900/40 rounded-xl text-center">
            <Award className="w-7 h-7 text-emerald-500 mx-auto mb-1.5" />
            <span className="block text-[10px] font-bold text-slate-700 dark:text-slate-300">Civic Impact</span>
            <span className="text-[8px] text-slate-500 dark:text-slate-500 font-sans">Resolved (3x) + Verified (1x)</span>
          </div>
        </div>
      </div>
    </div>
  );
}
