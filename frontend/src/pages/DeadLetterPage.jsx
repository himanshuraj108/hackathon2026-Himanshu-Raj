import { AlertTriangle, Inbox } from "lucide-react";

export default function DeadLetterPage({ dlq }) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold text-slate-100 tracking-tight">Dead Letter Queue</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Tickets that exhausted all retry attempts — require manual review
        </p>
      </div>

      {dlq.length === 0 ? (
        <div className="bg-[#13161e] border border-white/[0.06] rounded-2xl flex flex-col items-center justify-center py-24 gap-4">
          <div className="w-14 h-14 bg-emerald-500/10 rounded-2xl flex items-center justify-center">
            <Inbox className="w-7 h-7 text-emerald-400" />
          </div>
          <p className="text-sm font-bold text-slate-300">Dead letter queue is empty</p>
          <p className="text-xs text-slate-600">All tickets were processed successfully or are still being retried.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {dlq.map((item, i) => (
            <div
              key={i}
              className="bg-[#13161e] border border-rose-500/20 rounded-2xl p-5 flex items-start gap-4"
            >
              <div className="w-10 h-10 bg-rose-500/10 rounded-xl flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-rose-400" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-1">
                  <span className="font-mono text-sm font-bold text-rose-400">{item.ticket_id}</span>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20">
                    {item.error_type}
                  </span>
                  <span className="text-[10px] text-slate-600 ml-auto">{item.retry_count} retries exhausted</span>
                </div>
                <p className="text-xs text-slate-400 mb-1">{item.customer_email} — {item.subject}</p>
                <p className="font-mono text-[11px] text-rose-300/70 bg-rose-500/5 border border-rose-500/10 rounded-lg px-3 py-2">
                  {item.error}
                </p>
                <p className="text-[10px] text-slate-600 mt-2">
                  Failed at: {item.timestamp ? new Date(item.timestamp).toLocaleString() : "—"}
                  {item.last_tool && ` · Last tool: ${item.last_tool}`}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
