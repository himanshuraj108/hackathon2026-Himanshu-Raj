import { useState, useMemo } from "react";
import { Search, Filter, Eye } from "lucide-react";
import { StatusBadge, UrgencyBadge, ConfidenceBar } from "../components/Badges";
import TicketModal from "../components/TicketModal";

export default function AuditLogPage({ auditLog }) {
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterDecision, setFilterDecision] = useState("all");

  const filtered = useMemo(() => {
    return auditLog.filter((e) => {
      const matchSearch =
        !search ||
        e.ticket_id?.toLowerCase().includes(search.toLowerCase()) ||
        e.customer_email?.toLowerCase().includes(search.toLowerCase()) ||
        e.subject?.toLowerCase().includes(search.toLowerCase()) ||
        e.classification?.toLowerCase().includes(search.toLowerCase());

      const matchStatus = filterStatus === "all" || e.status === filterStatus;
      const matchDecision = filterDecision === "all" || e.decision === filterDecision;

      return matchSearch && matchStatus && matchDecision;
    });
  }, [auditLog, search, filterStatus, filterDecision]);

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-slate-100 tracking-tight">Audit Log</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Complete reasoning trace for every ticket — {auditLog.length} total entries
        </p>
      </div>

      {/* Filters */}
      <div className="bg-[#13161e] border border-white/[0.06] rounded-2xl overflow-hidden">
        <div className="flex items-center gap-3 p-4 border-b border-white/[0.06]">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-600" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tickets, emails, classifications..."
              className="w-full bg-[#1e2230] border border-white/[0.06] rounded-lg pl-9 pr-3 py-2 text-sm text-slate-200 placeholder-slate-600 outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition-all"
            />
          </div>

          <Filter className="w-4 h-4 text-slate-600 shrink-0" />

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="bg-[#1e2230] border border-white/[0.06] rounded-lg px-3 py-2 text-xs text-slate-400 outline-none cursor-pointer focus:border-indigo-500/50"
          >
            <option value="all">All Statuses</option>
            <option value="resolved">Resolved</option>
            <option value="escalated">Escalated</option>
            <option value="failed">Failed</option>
            <option value="dlq">DLQ</option>
          </select>

          <select
            value={filterDecision}
            onChange={(e) => setFilterDecision(e.target.value)}
            className="bg-[#1e2230] border border-white/[0.06] rounded-lg px-3 py-2 text-xs text-slate-400 outline-none cursor-pointer focus:border-indigo-500/50"
          >
            <option value="all">All Decisions</option>
            <option value="resolve">Resolve</option>
            <option value="escalate">Escalate</option>
            <option value="decline">Decline</option>
            <option value="clarify">Clarify</option>
          </select>

          <span className="text-xs text-slate-600 whitespace-nowrap">{filtered.length} results</span>
        </div>

        {/* Table */}
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-600">
            <Search className="w-10 h-10 opacity-30" />
            <p className="text-sm font-semibold text-slate-500">No tickets match your filters</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-[#0f1117]">
                  {["Ticket", "Customer", "Category", "Status", "Decision", "Confidence", "Flags", "Time", ""].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-slate-600 whitespace-nowrap first:pl-5 last:pr-5">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((entry, i) => {
                  const flagCount = Object.values(entry.flags || {}).filter(Boolean).length;
                  return (
                    <tr
                      key={entry.ticket_id}
                      className={`border-t border-white/[0.04] hover:bg-white/[0.02] cursor-pointer transition-colors`}
                      onClick={() => setSelected(entry)}
                    >
                      <td className="px-4 py-3 pl-5">
                        <span className="font-mono text-xs text-indigo-400">{entry.ticket_id}</span>
                      </td>
                      <td className="px-4 py-3 max-w-[160px]">
                        <p className="text-xs text-slate-300 truncate">{entry.customer_email}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-slate-400 capitalize">{entry.classification?.replace(/_/g, " ") || "—"}</span>
                      </td>
                      <td className="px-4 py-3"><StatusBadge status={entry.status} /></td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-slate-400 capitalize">{entry.decision || "—"}</span>
                      </td>
                      <td className="px-4 py-3 w-32">
                        <ConfidenceBar score={entry.confidence_score} />
                      </td>
                      <td className="px-4 py-3">
                        {flagCount > 0 ? (
                          <span className="text-[11px] font-semibold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/20">
                            {flagCount} flag{flagCount > 1 ? "s" : ""}
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-600">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-mono text-[11px] text-slate-600">{entry.processing_time_ms ?? "—"}ms</span>
                      </td>
                      <td className="px-4 py-3 pr-5">
                        <Eye className="w-4 h-4 text-slate-600 hover:text-indigo-400 transition-colors" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selected && <TicketModal entry={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
