export function StatusBadge({ status }) {
  const map = {
    resolved:   "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    escalated:  "bg-amber-500/10 text-amber-400 border-amber-500/20",
    failed:     "bg-rose-500/10 text-rose-400 border-rose-500/20",
    dlq:        "bg-rose-500/10 text-rose-400 border-rose-500/20",
    processing: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
  };
  return (
    <span className={`inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded-full border ${map[status] || "bg-slate-700/40 text-slate-400 border-slate-700"}`}>
      {status}
    </span>
  );
}

export function UrgencyBadge({ urgency }) {
  const map = {
    low:    "bg-slate-700/40 text-slate-400 border-slate-700",
    medium: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
    high:   "bg-amber-500/10 text-amber-400 border-amber-500/20",
    urgent: "bg-rose-500/10 text-rose-400 border-rose-500/20",
  };
  return (
    <span className={`inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded-full border ${map[urgency] || "bg-slate-700/40 text-slate-400 border-slate-700"}`}>
      {urgency || "—"}
    </span>
  );
}

export function ConfidenceBar({ score }) {
  const pct = Math.round((score || 0) * 100);
  const color =
    pct >= 80 ? "bg-emerald-500" :
    pct >= 60 ? "bg-amber-500" :
    "bg-rose-500";

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-[#1e2230] rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="font-mono text-[11px] text-slate-400 w-8 text-right">{pct}%</span>
    </div>
  );
}
