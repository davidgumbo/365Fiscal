import { useEffect, useMemo, useState } from "react";
import { NavLink } from "react-router-dom";
import { apiFetch } from "../api";
import { useMe } from "../hooks/useMe";

interface DashboardMetrics {
  active_companies: number;
  avg_certificate_days: number;
  companies_with_errors: number;
  devices_online: number;
  devices_total: number;
}

interface TrendPoint {
  label: string;
  value: number;
}

interface Trends {
  invoices: TrendPoint[];
  quotations: TrendPoint[];
}

interface DeviceHealth {
  online: number;
  attention: number;
}

interface CompanyStatus {
  company_id: number;
  company_name: string;
  device_count: number;
  devices_online: number;
  open_day_status: string;
  close_status: string;
  last_fiscal_day_no: number;
  last_sync: string | null;
  certificate_status: string;
  certificate_days_remaining: number | null;
}

interface DashboardSummary {
  metrics: DashboardMetrics;
  trends: Trends;
  device_health: DeviceHealth;
  company_status: CompanyStatus[];
}

interface Invoice {
  id: number;
  reference: string;
  status: string;
  total_amount: number;
  amount_paid?: number;
  amount_due?: number;
  fiscalized_at?: string | null;
  created_at?: string;
}

interface Quotation {
  id: number;
  reference: string;
  status: string;
  total_amount?: number;
  created_at?: string;
}

interface Product {
  id: number;
  name: string;
  sale_price: number;
  purchase_cost: number;
}

interface Contact {
  id: number;
  name: string;
}

interface PaymentStats {
  total_payments: number;
  total_amount: number;
  reconciled_count: number;
  pending_count: number;
}

interface AuditLog {
  id: number;
  action: string;
  resource_type: string;
  user_email: string;
  action_at: string;
}

// SVG Icons
const BuildingIcon = () => (
  <svg
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="4" y="2" width="16" height="20" rx="2" ry="2" />
    <path d="M9 22v-4h6v4" />
    <path d="M8 6h.01M16 6h.01M12 6h.01M8 10h.01M16 10h.01M12 10h.01M8 14h.01M16 14h.01M12 14h.01" />
  </svg>
);

const MonitorIcon = () => (
  <svg
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
    <line x1="8" y1="21" x2="16" y2="21" />
    <line x1="12" y1="17" x2="12" y2="21" />
  </svg>
);

const FileTextIcon = () => (
  <svg
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
    <polyline points="10 9 9 9 8 9" />
  </svg>
);

const AlertTriangleIcon = () => (
  <svg
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);

const CheckIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const SendIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="22" y1="2" x2="11" y2="13" />
    <polygon points="22 2 15 22 11 13 2 9 22 2" />
  </svg>
);

const EditIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);

const PlusIcon = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

export default function DashboardPage() {
  const { me } = useMe();
  const isAdmin = Boolean(me?.is_admin);
  const companyId = me?.company_ids?.[0];

  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [paymentStats, setPaymentStats] = useState<PaymentStats | null>(null);
  const [recentAuditLogs, setRecentAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    // Must have a company to load data
    if (!companyId) {
      setLoading(false);
      setError("No company assigned to your account.");
      return;
    }

    setLoading(true);
    setError("");

    const params = `?company_id=${companyId}`;

    // Build requests - always filter by company
    const requests: Promise<unknown>[] = [
      isAdmin
        ? apiFetch<DashboardSummary>("/dashboard/summary").catch(() => null)
        : Promise.resolve(null),
      apiFetch<Invoice[]>(`/invoices${params}`).catch(() => []),
      apiFetch<Quotation[]>(`/quotations${params}`).catch(() => []),
      apiFetch<Product[]>(`/products${params}`).catch(() => []),
      apiFetch<Contact[]>(`/contacts${params}`).catch(() => []),
      apiFetch<PaymentStats>(`/payments/summary${params}`).catch(() => null),
      apiFetch<AuditLog[]>(`/audit-logs${params}&limit=5`).catch(() => []),
    ];

    Promise.all(requests)
      .then(
        ([
          summaryData,
          invoicesData,
          quotationsData,
          productsData,
          contactsData,
          paymentData,
          auditData,
        ]) => {
          setSummary(summaryData as DashboardSummary | null);
          setInvoices((invoicesData as Invoice[]) || []);
          setQuotations((quotationsData as Quotation[]) || []);
          setProducts((productsData as Product[]) || []);
          setContacts((contactsData as Contact[]) || []);
          setPaymentStats(paymentData as PaymentStats | null);
          setRecentAuditLogs((auditData as AuditLog[]) || []);
        },
      )
      .catch((err) => setError(err.message || "Failed to load dashboard"))
      .finally(() => setLoading(false));
  }, [isAdmin, companyId]);

  // Filter company status to only show user's company (for non-admin)
  const filteredCompanyStatus = useMemo(() => {
    if (!summary?.company_status) return [];
    if (isAdmin) return summary.company_status;
    return summary.company_status.filter((c) => c.company_id === companyId);
  }, [summary, isAdmin, companyId]);

  // Calculate invoice stats
  const invoiceStats = useMemo(() => {
    const total = invoices.reduce(
      (sum, inv) => sum + (inv.total_amount || 0),
      0,
    );
    const fiscalized = invoices.filter(
      (inv) => inv.status === "fiscalized",
    ).length;
    const pending = invoices.filter(
      (inv) => inv.status === "draft" || inv.status === "pending",
    ).length;
    return { total, count: invoices.length, fiscalized, pending };
  }, [invoices]);

  // Calculate quotation stats with new workflow states
  const quotationStats = useMemo(() => {
    const accepted = quotations.filter((q) => q.status === "accepted").length;
    const sent = quotations.filter((q) => q.status === "sent").length;
    const draft = quotations.filter((q) => q.status === "draft").length;
    const rejected = quotations.filter((q) => q.status === "rejected").length;
    const converted = quotations.filter((q) => q.status === "converted").length;
    return {
      count: quotations.length,
      accepted,
      sent,
      draft,
      rejected,
      converted,
    };
  }, [quotations]);

  // Calculate payment stats from invoice data
  const invoicePaymentStats = useMemo(() => {
    const totalPaid = invoices.reduce(
      (sum, inv) => sum + (inv.amount_paid || 0),
      0,
    );
    const totalDue = invoices.reduce(
      (sum, inv) => sum + (inv.amount_due || 0),
      0,
    );
    const paidInvoices = invoices.filter(
      (inv) => (inv.amount_due || 0) <= 0 && (inv.amount_paid || 0) > 0,
    ).length;
    const partialPaid = invoices.filter(
      (inv) => (inv.amount_paid || 0) > 0 && (inv.amount_due || 0) > 0,
    ).length;
    return { totalPaid, totalDue, paidInvoices, partialPaid };
  }, [invoices]);

  // Recent items
  const recentInvoices = invoices.slice(0, 5);
  const recentQuotations = quotations.slice(0, 5);

  // Chart data - Monthly invoices (last 6 months)
  const monthlyData = useMemo(() => {
    const months: { [key: string]: number } = {};
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = d.toLocaleString("default", { month: "short" });
      months[key] = 0;
    }
    invoices.forEach((inv) => {
      if (inv.created_at || inv.fiscalized_at) {
        const date = new Date(inv.fiscalized_at || inv.created_at!);
        const key = date.toLocaleString("default", { month: "short" });
        if (key in months) {
          months[key] += inv.total_amount || 0;
        }
      }
    });
    return Object.entries(months).map(([label, value]) => ({ label, value }));
  }, [invoices]);

  const maxMonthly = Math.max(1, ...monthlyData.map((d) => d.value));

  // Get device stats for user's company
  const deviceStats = useMemo(() => {
    if (filteredCompanyStatus.length > 0) {
      const company = filteredCompanyStatus[0];
      return { online: company.devices_online, total: company.device_count };
    }
    return {
      online: summary?.metrics.devices_online || 0,
      total: summary?.metrics.devices_total || 0,
    };
  }, [filteredCompanyStatus, summary]);

  if (loading) {
    return (
      <div className="dashboard-page">
        <div className="dashboard-loading">
          <div className="loading-spinner"></div>
          <p>Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-page">
      {error && <div className="dashboard-error">{error}</div>}

      <div className="dashboard-header">
        <div>
          <h1>Dashboard</h1>
          <p className="dashboard-subtitle">
            Welcome back! Here's an overview of your fiscal operations.
          </p>
        </div>
        <div className="dashboard-actions">
          <NavLink to="/invoices" className="btn-primary">
            <PlusIcon /> New Invoice
          </NavLink>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="dashboard-kpis">
        <div className="kpi-card card-bg-shadow">
          <div className="kpi-icon blue">
            <BuildingIcon />
          </div>
          <div className="kpi-content">
            <div className="kpi-value">
              {isAdmin ? summary?.metrics.active_companies || 0 : 1}
            </div>
            <div className="kpi-label">
              {isAdmin ? "Active Companies" : "Your Company"}
            </div>
          </div>
        </div>

        <div className="kpi-card card-bg-shadow">
          <div className="kpi-icon green">
            <MonitorIcon />
          </div>
          <div className="kpi-content">
            <div className="kpi-value">
              {deviceStats.online}/{deviceStats.total}
            </div>
            <div className="kpi-label">Devices Online</div>
          </div>
        </div>

        <div className="kpi-card card-bg-shadow">
          <div className="kpi-icon purple">
            <FileTextIcon />
          </div>
          <div className="kpi-content">
            <div className="kpi-value">{invoiceStats.count}</div>
            <div className="kpi-label">Total Invoices</div>
          </div>
          <div className="kpi-badge">
            $
            {invoiceStats.total.toLocaleString(undefined, {
              minimumFractionDigits: 0,
              maximumFractionDigits: 0,
            })}
          </div>
        </div>

        <div className="kpi-card card-bg-shadow">
          <div className="kpi-icon orange">
            <AlertTriangleIcon />
          </div>
          <div className="kpi-content">
            <div className="kpi-value">{invoiceStats.pending}</div>
            <div className="kpi-label">Pending Invoices</div>
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="dashboard-charts ">
        <div className="chart-card card-bg-shadow">
          <div className="chart-header">
            <h3>Revenue Overview</h3>
            <span className="chart-period">Last 6 months</span>
          </div>
          <div className="bar-chart">
            {monthlyData.map((item, index) => (
              <div key={item.label} className="bar-item">
                <div className="bar-container">
                  <div
                    className="bar-fill"
                    style={{
                      height: `${(item.value / maxMonthly) * 100}%`,
                      animationDelay: `${index * 0.1}s`,
                    }}
                  >
                    {item.value > 0 && (
                      <span className="bar-value">
                        ${(item.value / 1000).toFixed(0)}k
                      </span>
                    )}
                  </div>
                </div>
                <span className="bar-label">{item.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="chart-card card-bg-shadow">
          <div className="chart-header">
            <h3>Invoice Status</h3>
            <span className="chart-period">Current period</span>
          </div>
          <div className="donut-chart">
            <svg viewBox="0 0 100 100" className="donut-svg">
              <circle className="donut-bg" cx="50" cy="50" r="40" />
              <circle
                className="donut-segment green"
                cx="50"
                cy="50"
                r="40"
                strokeDasharray={`${(invoiceStats.fiscalized / Math.max(invoiceStats.count, 1)) * 251.2} 251.2`}
                strokeDashoffset="0"
              />
              <circle
                className="donut-segment orange"
                cx="50"
                cy="50"
                r="40"
                strokeDasharray={`${(invoiceStats.pending / Math.max(invoiceStats.count, 1)) * 251.2} 251.2`}
                strokeDashoffset={`-${(invoiceStats.fiscalized / Math.max(invoiceStats.count, 1)) * 251.2}`}
              />
            </svg>
            <div className="donut-center">
              <div className="donut-value">{invoiceStats.count}</div>
              <div className="donut-label">Total</div>
            </div>
          </div>
          <div className="donut-legend">
            <div className="legend-item">
              <span className="legend-dot green"></span>
              <span>Fiscalized ({invoiceStats.fiscalized})</span>
            </div>
            <div className="legend-item">
              <span className="legend-dot orange"></span>
              <span>Pending ({invoiceStats.pending})</span>
            </div>
          </div>
        </div>

        <div className="chart-card card-bg-shadow">
          <div className="chart-header">
            <h3>Quotations Pipeline</h3>
            <span className="chart-period">Workflow status</span>
          </div>
          <div className="stats-list">
            <div className="stat-row">
              <div className="stat-icon green">
                <CheckIcon />
              </div>
              <div className="stat-info">
                <span className="stat-label">Accepted</span>
                <span className="stat-value">{quotationStats.accepted}</span>
              </div>
              <div className="stat-bar">
                <div
                  className="stat-fill green"
                  style={{
                    width: `${(quotationStats.accepted / Math.max(quotationStats.count, 1)) * 100}%`,
                  }}
                ></div>
              </div>
            </div>
            <div className="stat-row">
              <div className="stat-icon blue">
                <SendIcon />
              </div>
              <div className="stat-info">
                <span className="stat-label">Sent</span>
                <span className="stat-value">{quotationStats.sent}</span>
              </div>
              <div className="stat-bar">
                <div
                  className="stat-fill blue"
                  style={{
                    width: `${(quotationStats.sent / Math.max(quotationStats.count, 1)) * 100}%`,
                  }}
                ></div>
              </div>
            </div>
            <div className="stat-row">
              <div className="stat-icon gray">
                <EditIcon />
              </div>
              <div className="stat-info">
                <span className="stat-label">Draft</span>
                <span className="stat-value">{quotationStats.draft}</span>
              </div>
              <div className="stat-bar">
                <div
                  className="stat-fill gray"
                  style={{
                    width: `${(quotationStats.draft / Math.max(quotationStats.count, 1)) * 100}%`,
                  }}
                ></div>
              </div>
            </div>
            <div className="stat-row">
              <div className="stat-icon purple">
                <FileTextIcon />
              </div>
              <div className="stat-info">
                <span className="stat-label">Converted</span>
                <span className="stat-value">{quotationStats.converted}</span>
              </div>
              <div className="stat-bar">
                <div
                  className="stat-fill purple"
                  style={{
                    width: `${(quotationStats.converted / Math.max(quotationStats.count, 1)) * 100}%`,
                  }}
                ></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tables Row */}
      <div className="dashboard-tables">
        <div className="table-card card-bg-shadow">
          <div className="table-header">
            <h3>Recent Invoices</h3>
            <NavLink to="/invoices" className="view-all-link">
              View All →
            </NavLink>
          </div>
          <table className="dashboard-table">
            <thead>
              <tr>
                <th>Reference</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {recentInvoices.map((invoice) => (
                <tr key={invoice.id}>
                  <td className="ref-cell">{invoice.reference}</td>
                  <td>${invoice.total_amount?.toLocaleString() || "0"}</td>
                  <td>
                    <span className={`status-pill ${invoice.status}`}>
                      {invoice.status}
                    </span>
                  </td>
                  <td className="date-cell">
                    {invoice.fiscalized_at
                      ? new Date(invoice.fiscalized_at).toLocaleDateString()
                      : invoice.created_at
                        ? new Date(invoice.created_at).toLocaleDateString()
                        : "-"}
                  </td>
                </tr>
              ))}
              {recentInvoices.length === 0 && (
                <tr>
                  <td colSpan={4} className="empty-cell">
                    No invoices yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="table-card card-bg-shadow">
          <div className="table-header">
            <h3>Recent Quotations</h3>
            <NavLink to="/quotations" className="view-all-link">
              View All →
            </NavLink>
          </div>
          <table className="dashboard-table">
            <thead>
              <tr>
                <th>Reference</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {recentQuotations.map((quotation) => (
                <tr key={quotation.id}>
                  <td className="ref-cell">{quotation.reference}</td>
                  <td>
                    <span className={`status-pill ${quotation.status}`}>
                      {quotation.status}
                    </span>
                  </td>
                </tr>
              ))}
              {recentQuotations.length === 0 && (
                <tr>
                  <td colSpan={2} className="empty-cell">
                    No quotations yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Company Status Table */}
      {filteredCompanyStatus.length > 0 && (
        <div className="table-card full-width">
          <div className="table-header">
            <h3>
              {isAdmin ? "Company Status Overview" : "Your Company Status"}
            </h3>
            {isAdmin && (
              <NavLink to="/companies" className="view-all-link">
                Manage Companies →
              </NavLink>
            )}
          </div>
          <table className="dashboard-table">
            <thead>
              <tr>
                <th>Company</th>
                <th>Devices</th>
                <th>Fiscal Day</th>
                <th>Certificate</th>
                <th>Last Sync</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredCompanyStatus.map((company) => (
                <tr key={company.company_id}>
                  <td className="company-cell">{company.company_name}</td>
                  <td>
                    <span
                      className={
                        company.devices_online > 0 ? "text-green" : "text-red"
                      }
                    >
                      {company.devices_online}/{company.device_count}
                    </span>
                  </td>
                  <td>Day #{company.last_fiscal_day_no}</td>
                  <td>
                    <span
                      className={`cert-badge ${company.certificate_status.toLowerCase()}`}
                    >
                      {company.certificate_status}
                      {company.certificate_days_remaining !== null && (
                        <span className="cert-days">
                          {" "}
                          ({company.certificate_days_remaining}d)
                        </span>
                      )}
                    </span>
                  </td>
                  <td className="date-cell">
                    {company.last_sync
                      ? new Date(company.last_sync).toLocaleString()
                      : "Never"}
                  </td>
                  <td>
                    <span
                      className={`status-pill ${company.open_day_status.toLowerCase()}`}
                    >
                      {company.open_day_status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Quick Stats Footer */}
      <div className="dashboard-footer card-bg-shadow">
        <div className="footer-stat">
          <span className="footer-label">Products</span>
          <span className="footer-value">{products.length}</span>
        </div>
        <div className="footer-stat">
          <span className="footer-label">Contacts</span>
          <span className="footer-value">{contacts.length}</span>
        </div>
        <div className="footer-stat">
          <span className="footer-label">Payments</span>
          <span className="footer-value">
            {paymentStats?.total_payments || 0}
          </span>
        </div>
        <div className="footer-stat">
          <span className="footer-label">Amount Collected</span>
          <span className="footer-value">
            $
            {invoicePaymentStats.totalPaid.toLocaleString(undefined, {
              minimumFractionDigits: 0,
              maximumFractionDigits: 0,
            })}
          </span>
        </div>
        {filteredCompanyStatus.length > 0 &&
          filteredCompanyStatus[0].certificate_days_remaining !== null && (
            <div className="footer-stat">
              <span className="footer-label">Certificate Days</span>
              <span className="footer-value">
                {filteredCompanyStatus[0].certificate_days_remaining}
              </span>
            </div>
          )}
      </div>

      {/* Recent Activity Section */}
      {recentAuditLogs.length > 0 && (
        <div
          className="table-card full-width card-bg-shadow"
          style={{ marginTop: 20 }}
        >
          <div className="table-header">
            <h3>Recent Activity</h3>
            <NavLink to="/audit-logs" className="view-all-link">
              View All →
            </NavLink>
          </div>
          <table className="dashboard-table">
            <thead>
              <tr>
                <th>Action</th>
                <th>Resource</th>
                <th>User</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              {recentAuditLogs.map((log) => (
                <tr key={log.id}>
                  <td>
                    <span
                      className={`action-badge ${log.action.includes("create") ? "green" : log.action.includes("delete") ? "red" : "blue"}`}
                    >
                      {log.action.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td>{log.resource_type}</td>
                  <td>{log.user_email || "System"}</td>
                  <td className="date-cell">
                    {new Date(log.action_at).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
