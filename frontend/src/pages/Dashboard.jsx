import { CheckCircle2, GitBranch, TrendingUp, AlertTriangle, Layers, Clock, ArrowRight } from "lucide-react";
import { StatusBadge, ConfidenceBar } from "../components/Badges";
import { useState } from "react";
import TicketModal from "../components/TicketModal";

const StatCard = ({ label, value, sub, icon: Icon, accentClass, iconBg }) => (
  <div className="bg-[#13161e] border border-white/[0.06] rounded-2xl p-5 flex flex-col gap-3 hover:border-indigo-500/20 hover:bg-[#181c27] transition-all group">
    <div className="flex items-center justify-between">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">{label}</p>
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${iconBg}`}>
        <Icon className={`w-4 h-4 ${accentClass}`} />
      </div>
    </div>
    <p className={`text-4xl font-extrabold tracking-tight leading-none ${accentClass}`}>{value ?? "—"}</p>
    {sub && <p className="text-[11px] text-slate-600">{sub}</p>}
  </div>
);

export default function Dashboard({ stats, auditLog, setPage }) {
  const [selected, setSelected] = useState(null);

  const recent = auditLog.slice(0, 8);

  return (
    <div className="flex flex-col gap-7">
      {/* Page title */}
      <div>
        <h1 className="text-xl font-bold text-slate-100 tracking-tight">Agent Dashboard</h1>
        <p className="text-sm text-slate-500 mt-0.5">Real-time processing overview for all 20 support tickets</p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard
          label="Total Processed"
          value={stats?.total_processed ?? "—"}
          sub="of 20 tickets"
          icon={Layers}
          accentClass="text-indigo-400"
          iconBg="bg-indigo-500/10"
        />
        <StatCard
          label="Resolved"
          value={stats?.by_status?.resolved ?? 0}
          sub="autonomously"
          icon={CheckCircle2}
          accentClass="text-emerald-400"
          iconBg="bg-emerald-500/10"
        />
        <StatCard
          label="Escalated"
          value={stats?.by_status?.escalated ?? 0}
          sub="to human queue"
          icon={GitBranch}
          accentClass="text-amber-400"
          iconBg="bg-amber-500/10"
        />
        <StatCard
          label="Avg Confidence"
          value={stats?.avg_confidence != null ? `${Math.round(stats.avg_confidence * 100)}%` : "—"}
          sub="across all decisions"
          icon={TrendingUp}
          accentClass="text-cyan-400"
          iconBg="bg-cyan-500/10"
        />
        <StatCard
          label="Fraud Flags"
          value={stats?.flags?.fraud_flagged ?? 0}
          sub="detected & blocked"
          icon={AlertTriangle}
          accentClass="text-rose-400"
          iconBg="bg-rose-500/10"
        />
        <StatCard
          label="Dead Letter"
          value={stats?.dead_letter_queue_count ?? 0}
          sub="failed — in DLQ"
          icon={Clock}
          accentClass="text-violet-400"
          iconBg="bg-violet-500/10"
        />
      </div>

      {/* Decision Distribution */}
      {stats?.by_decision && (
        <div className="bg-[#13161e] border border-white/[0.06] rounded-2xl p-5">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Decision Distribution</p>
          <div className="flex gap-3 flex-wrap">
            {Object.entries(stats.by_decision).map(([decision, count]) => {
              const total = stats.total_processed || 1;
              const pct = Math.round((count / total) * 100);
              const color = {
                resolve: "bg-emerald-500",
                escalate: "bg-amber-500",
                decline: "bg-rose-500",
                clarify: "bg-cyan-500",
              }[decision] || "bg-slate-500";

              return (
                <div key={decision} className="flex-1 min-w-36">
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="text-xs capitalize text-slate-400 font-medium">{decision}</span>
                    <span className="text-xs font-bold text-slate-300">{count}</span>
                  </div>
                  <div className="h-1.5 bg-[#1e2230] rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${color} transition-all duration-700`} style={{ width: `${pct}%` }} />
                  </div>
                  <p className="text-[10px] text-slate-600 mt-1">{pct}%</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Recent Tickets */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-sm font-bold text-slate-100">Recent Tickets</p>
            <p className="text-[11px] text-slate-500 mt-0.5">Latest processed tickets — click any row to inspect the full reasoning trace</p>
          </div>
          <button
            onClick={() => setPage("audit")}
            className="flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 transition-colors font-medium"
          >
            View all <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {recent.length === 0 ? (
          <div className="bg-[#13161e] border border-white/[0.06] rounded-2xl flex flex-col items-center justify-center py-16 gap-3 text-slate-600">
            <Layers className="w-10 h-10 opacity-30" />
            <p className="text-sm font-semibold text-slate-500">No tickets processed yet</p>
            <p className="text-xs">Run <code className="font-mono bg-[#1e2230] px-1.5 py-0.5 rounded text-slate-400">node main.js</code> in the backend to start processing</p>
          </div>
        ) : (
          <div className="bg-[#13161e] border border-white/[0.06] rounded-2xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-[#0f1117] border-b border-white/[0.06]">
                  {["Ticket ID", "Subject", "Status", "Decision", "Confidence", "Time (ms)"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-slate-600 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recent.map((entry, i) => (
                  <tr
                    key={entry.ticket_id}
                    onClick={() => setSelected(entry)}
                    className={`border-b border-white/[0.04] cursor-pointer hover:bg-white/[0.02] transition-colors ${i === recent.length - 1 ? "border-b-0" : ""}`}
                  >
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs text-indigo-400">{entry.ticket_id}</span>
                    </td>
                    <td className="px-4 py-3 max-w-[200px]">
                      <p className="text-xs text-slate-300 truncate">{entry.subject || "—"}</p>
                      <p className="text-[10px] text-slate-600 truncate">{entry.customer_email}</p>
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={entry.status} /></td>
                    <td className="px-4 py-3">
                      <span className="text-xs capitalize text-slate-400">{entry.decision || "—"}</span>
                    </td>
                    <td className="px-4 py-3 w-32">
                      <ConfidenceBar score={entry.confidence_score} />
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-[11px] text-slate-500">{entry.processing_time_ms ?? "—"}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selected && <TicketModal entry={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
