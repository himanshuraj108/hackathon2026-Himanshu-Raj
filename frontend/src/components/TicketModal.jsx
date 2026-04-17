import { useState } from "react";
import { X, CheckCircle, AlertTriangle, ArrowUpRight, Shield, Clock, Wrench, MessageSquare, ChevronDown, ChevronUp } from "lucide-react";
import { StatusBadge, UrgencyBadge, ConfidenceBar } from "./Badges";

export default function TicketModal({ entry, onClose }) {
  const [expandedTool, setExpandedTool] = useState(null);

  if (!entry) return null;

  const flagList = [
    { key: "is_fraud_flagged", label: "Fraud Flagged" },
    { key: "is_social_engineering", label: "Social Engineering" },
    { key: "has_threatening_language", label: "Threatening Language" },
  ];

  const decisionColor = {
    resolve: "text-emerald-400",
    escalate: "text-amber-400",
    decline: "text-rose-400",
    clarify: "text-cyan-400",
  }[entry.decision] || "text-slate-400";

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-6 animate-[fadeIn_0.15s_ease]"
      onClick={onClose}
    >
      <div
        className="bg-[#13161e] border border-white/[0.06] rounded-2xl w-full max-w-3xl max-h-[88vh] flex flex-col shadow-2xl animate-[slideUp_0.2s_ease]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-white/[0.06]">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-[11px] text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded">{entry.ticket_id}</span>
              <StatusBadge status={entry.status} />
              <UrgencyBadge urgency={entry.urgency} />
            </div>
            <p className="text-base font-bold text-slate-100">{entry.subject || "No subject"}</p>
            <p className="text-xs text-slate-500 mt-0.5">{entry.customer_email}</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-[#1e2230] border border-white/[0.06] flex items-center justify-center text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 hover:border-rose-500/20 transition-all shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto p-6 flex flex-col gap-6">
          {/* KPIs row */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-[#0f1117] rounded-xl p-3 border border-white/[0.06]">
              <p className="text-[10px] uppercase tracking-wider text-slate-600 font-semibold mb-1">Decision</p>
              <p className={`text-sm font-bold capitalize ${decisionColor}`}>{entry.decision || "—"}</p>
            </div>
            <div className="bg-[#0f1117] rounded-xl p-3 border border-white/[0.06]">
              <p className="text-[10px] uppercase tracking-wider text-slate-600 font-semibold mb-1">Confidence</p>
              <ConfidenceBar score={entry.confidence_score} />
            </div>
            <div className="bg-[#0f1117] rounded-xl p-3 border border-white/[0.06]">
              <p className="text-[10px] uppercase tracking-wider text-slate-600 font-semibold mb-1">LLM Provider</p>
              <p className="text-sm font-bold text-slate-300 capitalize">{entry.llm_provider || "—"}</p>
            </div>
          </div>

          {/* Meta grid */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Classification", value: entry.classification },
              { label: "Resolution Type", value: entry.resolution_type || "N/A" },
              { label: "Processing Time", value: entry.processing_time_ms ? `${entry.processing_time_ms}ms` : "—" },
              { label: "Tool Calls", value: `${entry.tool_calls?.length || 0} calls` },
            ].map(({ label, value }) => (
              <div key={label} className="bg-[#0f1117] rounded-xl p-3 border border-white/[0.06]">
                <p className="text-[10px] uppercase tracking-wider text-slate-600 font-semibold mb-1">{label}</p>
                <p className="text-sm text-slate-300 font-medium capitalize">{value}</p>
              </div>
            ))}
          </div>

          {/* Security Flags */}
          <div>
            <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-slate-600 font-semibold mb-2">
              <Shield className="w-3 h-3" />
              Security Flags
            </p>
            <div className="flex flex-wrap gap-2">
              {flagList.map(({ key, label }) => {
                const active = entry.flags?.[key];
                return (
                  <span
                    key={key}
                    className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border flex items-center gap-1.5 ${
                      active
                        ? "bg-rose-500/10 text-rose-400 border-rose-500/20"
                        : "bg-[#1e2230] text-slate-600 border-white/[0.06]"
                    }`}
                  >
                    {active ? <AlertTriangle className="w-3 h-3" /> : <CheckCircle className="w-3 h-3" />}
                    {label}
                  </span>
                );
              })}
            </div>
          </div>

          {/* Tool Calls */}
          {entry.tool_calls?.length > 0 && (
            <div>
              <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-slate-600 font-semibold mb-2">
                <Wrench className="w-3 h-3" />
                Tool Call Chain ({entry.tool_calls.length})
              </p>
              <div className="flex flex-col gap-2">
                {entry.tool_calls.map((tc, i) => (
                  <div key={i} className="bg-[#0f1117] border border-white/[0.06] rounded-xl overflow-hidden">
                    <button
                      className="w-full flex items-center gap-2 px-4 py-2.5 text-left hover:bg-white/[0.02] transition-all"
                      onClick={() => setExpandedTool(expandedTool === i ? null : i)}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${tc.success ? "bg-emerald-400" : "bg-rose-400"}`} />
                      <span className="font-mono text-xs text-cyan-400 font-medium">{tc.tool}</span>
                      <span className="font-mono text-[10px] text-slate-600 ml-auto">{tc.duration_ms}ms</span>
                      {expandedTool === i ? <ChevronUp className="w-3 h-3 text-slate-600" /> : <ChevronDown className="w-3 h-3 text-slate-600" />}
                    </button>
                    {expandedTool === i && (
                      <div className="px-4 pb-3 border-t border-white/[0.04]">
                        <p className="text-[10px] text-slate-600 mt-2 mb-1 font-semibold uppercase">Input</p>
                        <pre className="text-[11px] text-slate-400 font-mono bg-[#13161e] rounded-lg p-3 overflow-x-auto whitespace-pre-wrap break-all">
                          {JSON.stringify(tc.input, null, 2)}
                        </pre>
                        <p className="text-[10px] text-slate-600 mt-2 mb-1 font-semibold uppercase">Output</p>
                        <pre className="text-[11px] text-slate-400 font-mono bg-[#13161e] rounded-lg p-3 overflow-x-auto whitespace-pre-wrap break-all">
                          {JSON.stringify(tc.output, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Reasoning Steps */}
          {entry.reasoning_steps?.length > 0 && (
            <div>
              <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-slate-600 font-semibold mb-3">
                <ArrowUpRight className="w-3 h-3" />
                Reasoning Chain ({entry.reasoning_steps.length} steps)
              </p>
              <div className="flex flex-col relative">
                {entry.reasoning_steps.map((step, i) => (
                  <div key={i} className="flex gap-3 pb-3">
                    <div className="flex flex-col items-center shrink-0">
                      <div className="w-5 h-5 rounded-full bg-indigo-500/10 border-2 border-indigo-500 flex items-center justify-center text-[9px] font-bold text-indigo-400">
                        {step.step || i + 1}
                      </div>
                      {i < entry.reasoning_steps.length - 1 && (
                        <div className="flex-1 w-px bg-white/[0.06] mt-1" />
                      )}
                    </div>
                    <p className="text-[12px] text-slate-400 leading-relaxed pt-0.5 pb-3">{step.thought}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Final Reply */}
          {entry.final_reply && (
            <div>
              <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-slate-600 font-semibold mb-2">
                <MessageSquare className="w-3 h-3" />
                Customer Reply Sent
              </p>
              <div className="bg-[#0f1117] border border-indigo-500/20 border-l-4 border-l-indigo-500 rounded-xl p-4 text-[13px] text-slate-300 leading-relaxed">
                {entry.final_reply}
              </div>
            </div>
          )}

          {/* Escalation Summary */}
          {entry.escalation_summary && (
            <div>
              <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-slate-600 font-semibold mb-2">
                <AlertTriangle className="w-3 h-3" />
                Escalation Summary (for human agent)
              </p>
              <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4 text-[13px] text-amber-300/80 leading-relaxed">
                {entry.escalation_summary}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
