import { RefreshCw, Cpu, Wifi } from "lucide-react";

export default function Topbar({ onRefresh, lastRefresh, dlqCount }) {
  const timeStr = lastRefresh
    ? lastRefresh.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
    : "--:--:--";

  return (
    <header className="sticky top-0 z-50 flex items-center justify-between px-6 h-14 bg-[#0f1117] border-b border-white/[0.06]">
      {/* Brand */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
          <Cpu className="w-4 h-4 text-white" />
        </div>
        <div>
          <p className="text-sm font-bold text-slate-100 leading-none tracking-tight">ShopWave Agent</p>
          <p className="text-[10px] text-slate-500 leading-none mt-0.5">Autonomous Support Resolution</p>
        </div>
      </div>

      {/* Right */}
      <div className="flex items-center gap-3">
        {dlqCount > 0 && (
          <span className="text-[10px] font-semibold px-2.5 py-1 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20">
            {dlqCount} in DLQ
          </span>
        )}

        <div className="flex items-center gap-1.5 text-[11px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <Wifi className="w-3 h-3" />
          Live
        </div>

        <span className="text-[11px] text-slate-500 font-mono hidden md:block">
          Refreshed {timeStr}
        </span>

        <button
          onClick={onRefresh}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1e2230] border border-white/[0.06] text-slate-400 text-xs font-medium hover:text-slate-200 hover:bg-[#252937] transition-all"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </button>
      </div>
    </header>
  );
}
