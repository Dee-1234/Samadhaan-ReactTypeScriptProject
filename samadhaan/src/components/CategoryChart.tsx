import React from "react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell } from "recharts";
import { BarChart3, AlertCircle, Info } from "lucide-react";
import { CommunityReport } from "../types";

interface CategoryChartProps {
  reports: CommunityReport[];
}

const CATEGORY_COLORS: Record<string, string> = {
  "Pothole": "#f43f5e",        // rose-500
  "Water Leakage": "#3b82f6",   // blue-500
  "Power Outage": "#f59e0b",    // amber-500
  "Trash Dump": "#84cc16",      // lime-500
  "Street Light": "#06b6d4",    // cyan-500
  "Other": "#64748b"            // slate-500
};

export default function CategoryChart({ reports }: CategoryChartProps) {
  // Aggregate reports by category
  const data = React.useMemo(() => {
    const counts: Record<string, number> = {};
    
    reports.forEach((report) => {
      const cat = report.category || "Other";
      counts[cat] = (counts[cat] || 0) + 1;
    });

    return Object.entries(counts)
      .map(([category, count]) => ({
        category,
        count,
        color: CATEGORY_COLORS[category] || "#3b82f6"
      }))
      .sort((a, b) => b.count - a.count);
  }, [reports]);

  // Highlight stats
  const totalReports = reports.length;
  const mostFrequent = data[0] ? data[0].category : "None";
  const mostFrequentCount = data[0] ? data[0].count : 0;

  // Custom tooltip for polished look
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const item = payload[0].payload;
      return (
        <div className="bg-white border border-slate-200 p-3 rounded-xl shadow-lg text-xs">
          <p className="font-bold text-slate-800 font-display flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
            {item.category}
          </p>
          <p className="text-slate-500 mt-1 font-sans">
            Total Issues: <span className="font-mono font-bold text-slate-800">{item.count}</span>
          </p>
          <p className="text-[10px] text-slate-400 mt-0.5">
            ({((item.count / totalReports) * 100).toFixed(0)}% of community reports)
          </p>
        </div>
      );
    }
    return null;
  };

  if (reports.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col items-center justify-center py-12 text-center">
        <BarChart3 className="w-10 h-10 text-slate-300 mb-3" />
        <p className="text-xs font-semibold text-slate-600">No category breakdown available</p>
        <p className="text-[10px] text-slate-400 mt-1 max-w-xs font-sans">
          Report an issue to display the live category distribution chart.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-3xl p-6 md:p-8 shadow-sm flex flex-col h-full">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4 mb-6">
        <div>
          <span className="text-blue-600 text-xs font-semibold uppercase tracking-wider font-mono flex items-center gap-1.5">
            <BarChart3 className="w-3.5 h-3.5" /> Community Dashboard
          </span>
          <h3 className="text-lg font-bold text-slate-800 font-display mt-1">Issues by Category</h3>
          <p className="text-slate-500 text-xs mt-0.5 font-sans">
            Distribution of reported infrastructure problems in your neighborhood.
          </p>
        </div>

        {/* Micro KPI Badge */}
        <div className="flex items-center gap-3 self-start sm:self-center bg-slate-50 border border-slate-100 px-3.5 py-1.5 rounded-xl text-xs font-sans text-slate-600">
          <div>
            <span className="text-[10px] text-slate-400 block uppercase font-mono">Top Issue</span>
            <span className="font-bold text-slate-800">{mostFrequent} ({mostFrequentCount})</span>
          </div>
        </div>
      </div>

      {/* Recharts Bar Chart container */}
      <div className="h-[260px] w-full min-h-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 10, right: 10, left: -20, bottom: 5 }}
            barSize={32}
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis
              dataKey="category"
              axisLine={false}
              tickLine={false}
              tick={{ fill: "#64748b", fontSize: 10, fontFamily: "Space Grotesk" }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: "#94a3b8", fontSize: 10, fontFamily: "JetBrains Mono" }}
              allowDecimals={false}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: "#f8fafc" }} />
            <Bar
              dataKey="count"
              radius={[8, 8, 0, 0]}
              animationDuration={1000}
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-6 flex items-start gap-2 bg-blue-50/50 border border-blue-100/60 p-3 rounded-2xl text-[11px] text-slate-500 font-sans">
        <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          These counts are updated in real-time as users report new hazards or as resolved issues are updated. 
          Use this to prioritize municipal resources and community vigilance.
        </p>
      </div>
    </div>
  );
}
