import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import Sidebar from "./components/Sidebar";
import Topbar from "./components/Topbar";
import Dashboard from "./pages/Dashboard";
import AuditLogPage from "./pages/AuditLogPage";
import DeadLetterPage from "./pages/DeadLetterPage";

const API = import.meta.env.VITE_API_URL || "http://localhost:4000";

export default function App() {
  const [page, setPage] = useState("dashboard");
  const [stats, setStats] = useState(null);
  const [auditLog, setAuditLog] = useState([]);
  const [dlq, setDlq] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      const [statsRes, auditRes, dlqRes] = await Promise.all([
        axios.get(`${API}/api/audit/stats/summary`).catch(() => ({ data: null })),
        axios.get(`${API}/api/audit`).catch(() => ({ data: { data: [] } })),
        axios.get(`${API}/api/audit/dlq/list`).catch(() => ({ data: { data: [] } })),
      ]);
      if (statsRes.data?.success) setStats(statsRes.data.data);
      if (auditRes.data?.success) setAuditLog(auditRes.data.data);
      if (dlqRes.data?.success) setDlq(dlqRes.data.data);
      setLastRefresh(new Date());
    } catch (err) {
      console.error("Failed to fetch data:", err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    // Auto-refresh every 10 seconds
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [fetchData]);

  return (
    <div className="min-h-screen bg-[#0a0c10] flex flex-col" style={{ fontFamily: "'Inter', sans-serif" }}>
      <Topbar onRefresh={fetchData} lastRefresh={lastRefresh} dlqCount={dlq.length} />
      <div className="flex flex-1">
        <Sidebar page={page} setPage={setPage} dlqCount={dlq.length} auditCount={auditLog.length} />
        <main className="flex-1 overflow-y-auto p-7">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="w-9 h-9 border-2 border-[#1e2230] border-t-indigo-500 rounded-full animate-spin" />
            </div>
          ) : page === "dashboard" ? (
            <Dashboard stats={stats} auditLog={auditLog} setPage={setPage} />
          ) : page === "audit" ? (
            <AuditLogPage auditLog={auditLog} />
          ) : page === "dlq" ? (
            <DeadLetterPage dlq={dlq} />
          ) : null}
        </main>
      </div>
    </div>
  );
}
