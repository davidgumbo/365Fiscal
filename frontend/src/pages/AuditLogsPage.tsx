import { useEffect, useState } from "react";
import { apiFetch } from "../api";
import { useMe } from "../hooks/useMe";

interface AuditLog {
  id: number;
  user_id: number | null;
  user_email: string;
  company_id: number | null;
  company_name: string;
  action: string;
  resource_type: string;
  resource_id: number | null;
  resource_reference: string;
  changes_summary: string;
  status: string;
  error_message: string;
  action_at: string;
  created_at: string;
}

interface AuditSummary {
  total_actions: number;
  actions_by_type: Record<string, number>;
  actions_by_user: Record<string, number>;
  recent_errors: AuditLog[];
}

// Icons
const ActivityIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
  </svg>
);

const FilterIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
  </svg>
);

const RefreshIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 4 23 10 17 10"/>
    <polyline points="1 20 1 14 7 14"/>
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
  </svg>
);

const CheckCircleIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
    <polyline points="22 4 12 14.01 9 11.01"/>
  </svg>
);

const AlertCircleIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <line x1="12" y1="8" x2="12" y2="12"/>
    <line x1="12" y1="16" x2="12.01" y2="16"/>
  </svg>
);

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleString();
};

const formatAction = (action: string) => {
  return action
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};

const getActionColor = (action: string): string => {
  if (action.includes("create")) return "#16a34a";
  if (action.includes("delete") || action.includes("cancel")) return "#dc2626";
  if (action.includes("update") || action.includes("edit")) return "#2563eb";
  if (action.includes("fiscalize")) return "#7c3aed";
  if (action.includes("payment")) return "#0891b2";
  if (action.includes("confirm") || action.includes("post")) return "#ea580c";
  if (action.includes("login")) return "#64748b";
  return "#64748b";
};

const getResourceIcon = (resourceType: string): string => {
  const icons: Record<string, string> = {
    invoice: "📄",
    quotation: "📋",
    credit_note: "📝",
    payment: "💳",
    product: "📦",
    contact: "👤",
    user: "👥",
    company: "🏢",
    device: "🖥️",
    settings: "⚙️",
  };
  return icons[resourceType] || "📁";
};

export default function AuditLogsPage() {
  const { me } = useMe();
  const companyId = me?.company_ids?.[0];

  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [summary, setSummary] = useState<AuditSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [actionFilter, setActionFilter] = useState("");
  const [resourceFilter, setResourceFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [searchFilter, setSearchFilter] = useState("");
  const [daysFilter, setDaysFilter] = useState(7);
  const [showFilters, setShowFilters] = useState(false);

  // Available filter options
  const [actionTypes, setActionTypes] = useState<string[]>([]);
  const [resourceTypes, setResourceTypes] = useState<string[]>([]);

  useEffect(() => {
    loadFilterOptions();
  }, []);

  useEffect(() => {
    loadData();
  }, [companyId, actionFilter, resourceFilter, statusFilter, searchFilter, daysFilter]);

  const loadFilterOptions = async () => {
    try {
      const [actions, resources] = await Promise.all([
        apiFetch<string[]>("/audit-logs/actions").catch(() => []),
        apiFetch<string[]>("/audit-logs/resource-types").catch(() => []),
      ]);
      setActionTypes(actions);
      setResourceTypes(resources);
    } catch {
      // Ignore errors for filter options
    }
  };

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (companyId) params.append("company_id", String(companyId));
      if (actionFilter) params.append("action", actionFilter);
      if (resourceFilter) params.append("resource_type", resourceFilter);
      if (statusFilter) params.append("status", statusFilter);
      if (searchFilter) params.append("search", searchFilter);
      params.append("limit", "100");

      const [logsData, summaryData] = await Promise.all([
        apiFetch<AuditLog[]>(`/audit-logs?${params.toString()}`),
        apiFetch<AuditSummary>(`/audit-logs/summary?days=${daysFilter}${companyId ? `&company_id=${companyId}` : ""}`).catch(() => null),
      ]);

      setLogs(logsData);
      setSummary(summaryData);
    } catch (err: any) {
      setError(err.message || "Failed to load audit logs");
    } finally {
      setLoading(false);
    }
  };

  const clearFilters = () => {
    setActionFilter("");
    setResourceFilter("");
    setStatusFilter("");
    setSearchFilter("");
  };

  return (
    <div className="content-area">
      <div className="page-header">
        <div>
          <h1 className="page-title">Audit Logs</h1>
          <p className="page-subtitle">Track all system activities and changes</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            className="btn btn-secondary"
            onClick={() => setShowFilters(!showFilters)}
          >
            <FilterIcon /> Filters
          </button>
          <button className="btn btn-secondary" onClick={loadData}>
            <RefreshIcon /> Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="alert alert-error" style={{ marginBottom: 16 }}>
          {error}
          <button onClick={() => setError(null)} style={{ marginLeft: 8 }}>×</button>
        </div>
      )}

      {/* Summary Cards */}
      {summary && (
        <div className="summary-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 24 }}>
          <div className="summary-card card" style={{ padding: 20 }}>
            <div style={{ fontSize: 32, fontWeight: 700, color: "#1e293b" }}>
              {summary.total_actions.toLocaleString()}
            </div>
            <div style={{ fontSize: 13, color: "#64748b" }}>Total Actions (Last {daysFilter} days)</div>
          </div>
          <div className="summary-card card" style={{ padding: 20 }}>
            <div style={{ fontSize: 32, fontWeight: 700, color: "#16a34a" }}>
              {Object.values(summary.actions_by_type).reduce((a, b) => a + b, 0) - (summary.recent_errors?.length || 0)}
            </div>
            <div style={{ fontSize: 13, color: "#64748b" }}>Successful Actions</div>
          </div>
          <div className="summary-card card" style={{ padding: 20 }}>
            <div style={{ fontSize: 32, fontWeight: 700, color: "#dc2626" }}>
              {summary.recent_errors?.length || 0}
            </div>
            <div style={{ fontSize: 13, color: "#64748b" }}>Recent Errors</div>
          </div>
          <div className="summary-card card" style={{ padding: 20 }}>
            <div style={{ fontSize: 32, fontWeight: 700, color: "#2563eb" }}>
              {Object.keys(summary.actions_by_user).length}
            </div>
            <div style={{ fontSize: 13, color: "#64748b" }}>Active Users</div>
          </div>
        </div>
      )}

      {/* Filters */}
      {showFilters && (
        <div className="card" style={{ padding: 20, marginBottom: 20 }}>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-end" }}>
            <div className="form-group" style={{ flex: 1, minWidth: 180 }}>
              <label>Search</label>
              <input
                type="text"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="Search references, users..."
              />
            </div>
            <div className="form-group" style={{ flex: 1, minWidth: 150 }}>
              <label>Action Type</label>
              <select value={actionFilter} onChange={(e) => setActionFilter(e.target.value)}>
                <option value="">All Actions</option>
                {actionTypes.map((action) => (
                  <option key={action} value={action}>
                    {formatAction(action)}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group" style={{ flex: 1, minWidth: 150 }}>
              <label>Resource Type</label>
              <select value={resourceFilter} onChange={(e) => setResourceFilter(e.target.value)}>
                <option value="">All Resources</option>
                {resourceTypes.map((resource) => (
                  <option key={resource} value={resource}>
                    {resource.charAt(0).toUpperCase() + resource.slice(1)}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group" style={{ flex: 1, minWidth: 120 }}>
              <label>Status</label>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="">All</option>
                <option value="success">Success</option>
                <option value="error">Error</option>
              </select>
            </div>
            <div className="form-group" style={{ flex: 1, minWidth: 120 }}>
              <label>Time Range</label>
              <select value={daysFilter} onChange={(e) => setDaysFilter(Number(e.target.value))}>
                <option value={1}>Last 24h</option>
                <option value={7}>Last 7 days</option>
                <option value={30}>Last 30 days</option>
                <option value={90}>Last 90 days</option>
              </select>
            </div>
            <button className="btn btn-secondary" onClick={clearFilters}>
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Logs Table */}
      {loading ? (
        <div className="loading-spinner" style={{ padding: 40, textAlign: "center", color: "#64748b" }}>
          Loading audit logs...
        </div>
      ) : (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>User</th>
                <th>Action</th>
                <th>Resource</th>
                <th>Details</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", padding: 40, color: "#64748b" }}>
                    No audit logs found matching your filters
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id}>
                    <td style={{ whiteSpace: "nowrap", fontSize: 12, color: "#64748b" }}>
                      {formatDate(log.action_at)}
                    </td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: "50%",
                            background: "#e2e8f0",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 11,
                            fontWeight: 600,
                          }}
                        >
                          {log.user_email?.charAt(0).toUpperCase() || "S"}
                        </div>
                        <span style={{ fontSize: 13 }}>{log.user_email || "System"}</span>
                      </div>
                    </td>
                    <td>
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          padding: "4px 10px",
                          borderRadius: 999,
                          fontSize: 12,
                          fontWeight: 600,
                          background: getActionColor(log.action) + "15",
                          color: getActionColor(log.action),
                        }}
                      >
                        {formatAction(log.action)}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span>{getResourceIcon(log.resource_type)}</span>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 500 }}>
                            {log.resource_reference || `#${log.resource_id}`}
                          </div>
                          <div style={{ fontSize: 11, color: "#94a3b8" }}>
                            {log.resource_type}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td style={{ maxWidth: 300 }}>
                      <div
                        style={{
                          fontSize: 12,
                          color: "#64748b",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                        title={log.changes_summary || log.error_message}
                      >
                        {log.changes_summary || log.error_message || "-"}
                      </div>
                    </td>
                    <td>
                      {log.status === "success" ? (
                        <span style={{ color: "#16a34a", display: "flex", alignItems: "center", gap: 4 }}>
                          <CheckCircleIcon /> Success
                        </span>
                      ) : (
                        <span style={{ color: "#dc2626", display: "flex", alignItems: "center", gap: 4 }}>
                          <AlertCircleIcon /> Error
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      <style>{`
        .alert-error {
          background: #fee2e2;
          color: #dc2626;
          padding: 12px 16px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .summary-card {
          background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
          border: 1px solid #e2e8f0;
        }
      `}</style>
    </div>
  );
}
