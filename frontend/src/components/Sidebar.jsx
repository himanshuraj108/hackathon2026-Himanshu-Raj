import { LayoutDashboard, ScrollText, AlertTriangle, ChevronRight } from "lucide-react";

const navItems = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "audit", label: "Audit Log", icon: ScrollText },
  { id: "dlq", label: "Dead Letter Queue", icon: AlertTriangle, badge: true },
];

export default function Sidebar({ page, setPage, dlqCount, auditCount }) {
  return (
    <aside className="w-56 bg-[#0f1117] border-r border-white/[0.06] flex flex-col sticky top-14 h-[calc(100vh-3.5rem)] shrink-0">
      <div className="pt-4 pb-2">
        <p className="text-[10px] font-semibold tracking-widest uppercase text-slate-600 px-5 pb-3">
          Navigation
        </p>
        {navItems.map(({ id, label, icon: Icon, badge }) => {
          const active = page === id;
          const count = id === "dlq" ? dlqCount : id === "audit" ? auditCount : null;
          return (
            <button
              key={id}
              onClick={() => setPage(id)}
              className={`w-full flex items-center gap-3 px-5 py-2.5 text-sm font-medium transition-all border-l-2 ${
                active
                  ? "text-indigo-400 bg-indigo-500/10 border-indigo-500"
                  : "text-slate-400 border-transparent hover:text-slate-200 hover:bg-white/[0.03]"
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="flex-1 text-left">{label}</span>
              {count !== null && count > 0 && (
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                    badge
                      ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                      : "bg-slate-700 text-slate-400"
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Footer */}
      <div className="mt-auto px-5 pb-5">
        <div className="rounded-xl bg-[#13161e] border border-white/[0.06] p-4">
          <p className="text-[11px] font-bold text-slate-300 mb-1">Hackathon 2026</p>
          <p className="text-[10px] text-slate-600 leading-relaxed">
            MERN · Groq · Gemini
            <br />
            ReAct Agent · Concurrent
          </p>
        </div>
      </div>
    </aside>
  );
}
