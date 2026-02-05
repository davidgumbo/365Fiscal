import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "../api";
import { useListView } from "../context/ListViewContext";
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

interface PortalInvoice {
  id: number;
  quotation_id: number | null;
  reference: string;
  status: string;
  total_amount: number;
  fiscalized_at?: string | null;
}

interface PortalQuotation {
  id: number;
  customer_id: number;
  reference: string;
  status: string;
}

interface PortalProduct {
  id: number;
  name: string;
  sale_price: number;
  purchase_cost: number;
  reference: string;
}

interface PortalContact {
  id: number;
  name: string;
}

export default function DashboardPage() {
  const { me } = useMe();
  const isAdmin = Boolean(me?.is_admin);
  const companyId = me?.company_ids?.[0];
  const { state: listState } = useListView();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [error, setError] = useState("");
  const [portalInvoices, setPortalInvoices] = useState<PortalInvoice[]>([]);
  const [portalQuotations, setPortalQuotations] = useState<PortalQuotation[]>([]);
  const [portalProducts, setPortalProducts] = useState<PortalProduct[]>([]);
  const [portalContacts, setPortalContacts] = useState<PortalContact[]>([]);
  const [portalLoading, setPortalLoading] = useState(false);
  const [portalError, setPortalError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdmin) {
      return;
    }
    apiFetch<DashboardSummary>("/dashboard/summary")
      .then(setSummary)
      .catch((err) => setError(err.message || "Failed to load dashboard"));
  }, [isAdmin]);

  useEffect(() => {
    if (isAdmin) {
      return;
    }
    if (!companyId) {
      setPortalError("No company assigned to this portal user.");
      return;
    }
    setPortalLoading(true);
    setPortalError(null);
    const params = new URLSearchParams({ company_id: String(companyId) });
    listState.filters.forEach((chip) => {
      Object.entries(chip.params).forEach(([key, value]) => {
        params.set(key, value as string);
      });
    });

    Promise.all([
      apiFetch<PortalInvoice[]>(`/invoices?${params.toString()}`),
      apiFetch<PortalQuotation[]>(`/quotations?${params.toString()}`),
      apiFetch<PortalProduct[]>(`/products?${params.toString()}`),
      apiFetch<PortalContact[]>(`/contacts?${params.toString()}`)
    ])
      .then(([invoices, quotations, products, contacts]) => {
        setPortalInvoices(invoices);
        setPortalQuotations(quotations);
        setPortalProducts(products);
        setPortalContacts(contacts);
      })
      .catch((err) => setPortalError(err.message || "Failed to load portal data"))
      .finally(() => setPortalLoading(false));
  }, [companyId, isAdmin, JSON.stringify(listState.filters)]);

  const metrics = useMemo(() => {
    if (!summary) {
      return [];
    }
    return [
      { label: "Active Companies", value: summary.metrics.active_companies, delta: "Registered" },
      {
        label: "Avg Certificate Days",
        value: summary.metrics.avg_certificate_days,
        delta: "Remaining"
      },
      {
        label: "Companies With Errors",
        value: summary.metrics.companies_with_errors,
        delta: "Validation required"
      },
      {
        label: "Devices Online",
        value: `${summary.metrics.devices_online}/${summary.metrics.devices_total}`,
        delta: summary.metrics.devices_total ? "Active now" : "No devices"
      }
    ];
  }, [summary]);

  const invoiceSeries = summary?.trends.invoices ?? [];
  const quoteSeries = summary?.trends.quotations ?? [];
  const deviceSeries = summary
    ? [
        { label: "Online", value: summary.device_health.online, color: "#0b57d0" },
        { label: "Attention", value: summary.device_health.attention, color: "#d12b2b" }
      ]
    : [];

  const maxInvoice = Math.max(1, ...invoiceSeries.map((point) => point.value));
  const maxQuote = Math.max(1, ...quoteSeries.map((point) => point.value));
  const contactById = useMemo(() => {
    return new Map(portalContacts.map((contact) => [contact.id, contact.name]));
  }, [portalContacts]);

  const quotationById = useMemo(() => {
    return new Map(portalQuotations.map((quotation) => [quotation.id, quotation]));
  }, [portalQuotations]);

  const recentInvoices = portalInvoices.slice(0, 5);
  const recentQuotations = portalQuotations.slice(0, 4);
  const inventoryItems = portalProducts.slice(0, 6);

  const portalView = (
    <div className="content">
      {portalError ? <div className="card">{portalError}</div> : null}
      <div className="page-header">
        <div>
          <h1>PORTAL OVERVIEW</h1>
          <p className="page-subtitle">Invoices, quotations, and inventory at a glance.</p>
        </div>
        <div className="header-actions">
          <button className="primary">NEW QUOTATION</button>
        </div>
      </div>

      <div className="card-grid">
        <div className="card">
          <h3>INVOICES</h3>
          <div className="metric-value">{portalInvoices.length}</div>
          <div className="metric-delta">Total recorded</div>
        </div>
        <div className="card">
          <h3>QUOTATIONS</h3>
          <div className="metric-value">{portalQuotations.length}</div>
          <div className="metric-delta">Total recorded</div>
        </div>
        <div className="card">
          <h3>INVENTORY</h3>
          <div className="metric-value">{portalProducts.length}</div>
          <div className="metric-delta">Products tracked</div>
        </div>
        <div className="card">
          <h3>REORDER ALERTS</h3>
          <div className="metric-value">0</div>
          <div className="metric-delta">Stock thresholds not configured</div>
        </div>
      </div>

      <div className="card-grid">
        <div className="card" style={{ gridColumn: "span 2" }}>
          <div className="page-header" style={{ marginBottom: 12 }}>
            <div>
              <h3>RECENT INVOICES</h3>
              <p className="page-subtitle">Latest customer invoices</p>
            </div>
            <button className="outline">VIEW ALL</button>
          </div>
          <table className="table">
            <thead>
              <tr>
                <th>Invoice</th>
                <th>Customer</th>
                <th>Date</th>
                <th>Total</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {recentInvoices.map((invoice) => {
                const quotation = invoice.quotation_id
                  ? quotationById.get(invoice.quotation_id)
                  : undefined;
                const customerName = quotation
                  ? contactById.get(quotation.customer_id) ?? "-"
                  : "-";
                const dateLabel = invoice.fiscalized_at
                  ? new Date(invoice.fiscalized_at).toLocaleDateString()
                  : "-";
                const amountLabel = invoice.total_amount.toLocaleString(undefined, {
                  style: "currency",
                  currency: "USD"
                });
                const statusClass = invoice.status === "fiscalized"
                  ? "success"
                  : invoice.status === "draft"
                  ? "neutral"
                  : "warning";
                return (
                  <tr key={invoice.id}>
                    <td>{invoice.reference}</td>
                    <td>{customerName}</td>
                    <td>{dateLabel}</td>
                    <td>{amountLabel}</td>
                    <td>
                      <span className={`status-badge ${statusClass}`}>
                        {invoice.status}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {!portalLoading && recentInvoices.length === 0 ? (
                <tr>
                  <td colSpan={5}>No invoices found.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="card">
          <div className="page-header" style={{ marginBottom: 12 }}>
            <div>
              <h3>QUOTATIONS PIPELINE</h3>
              <p className="page-subtitle">Follow-up the pending proposals.</p>
            </div>
          </div>
          <div className="list">
            {recentQuotations.map((quotation) => {
              const customerName = contactById.get(quotation.customer_id) ?? "-";
              const statusClass = quotation.status === "confirmed"
                ? "success"
                : quotation.status === "sent"
                ? "warning"
                : "neutral";
              return (
                <div className="list-row" key={quotation.id}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{quotation.reference}</div>
                    <div style={{ color: "#5b6169" }}>{customerName}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <span className={`status-badge ${statusClass}`}>{quotation.status}</span>
                  </div>
                </div>
              );
            })}
            {!portalLoading && recentQuotations.length === 0 ? (
              <div className="list-row">
                <div style={{ color: "#5b6169" }}>No quotations found.</div>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="card-grid">
        <div className="card" style={{ gridColumn: "span 2" }}>
          <div className="page-header" style={{ marginBottom: 12 }}>
            <div>
              <h3>INVENTORY SNAPSHOT</h3>
              <p className="page-subtitle">Stock levels.</p>
            </div>
            <button className="outline">REPLENISH</button>
          </div>
          <table className="table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Reference</th>
                <th>Sales Price</th>
                <th>Purchase Cost</th>
              </tr>
            </thead>
            <tbody>
              {inventoryItems.map((product) => (
                <tr key={product.id}>
                  <td>{product.name}</td>
                  <td>{product.reference || "-"}</td>
                  <td>
                    {product.sale_price.toLocaleString(undefined, {
                      style: "currency",
                      currency: "USD"
                    })}
                  </td>
                  <td>
                    {product.purchase_cost.toLocaleString(undefined, {
                      style: "currency",
                      currency: "USD"
                    })}
                  </td>
                </tr>
              ))}
              {!portalLoading && inventoryItems.length === 0 ? (
                <tr>
                  <td colSpan={4}>No products found.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const adminView = (
    <div className="content">
      {error ? <div className="card">{error}</div> : null}
      <div className="card-grid metrics-grid">
        {metrics.map((metric, index) => (
          <div className="card" key={metric.label} style={{ animationDelay: `${index * 0.05}s` }}>
            <h3>{metric.label}</h3>
            <div className="metric-value">{metric.value}</div>
            <div className="metric-delta">{metric.delta}</div>
          </div>
        ))}
      </div>
      <div className="card-grid">
        <div className="card chart-card" style={{ animationDelay: "0.1s" }}>
          <div className="chart-header">
            <div>
              <h3>Certificate Renewal Trend</h3>
              <div className="chart-sub">Days remaining per week</div>
            </div>
            <div className="mini-stat">
              <span className="dot blue" />
              Avg {summary ? summary.metrics.avg_certificate_days : 0} days
            </div>
          </div>
          <svg className="chart-svg" viewBox="0 0 240 100" preserveAspectRatio="none">
            <polyline
              className="chart-line"
              fill="none"
              stroke="#0b57d0"
              strokeWidth="3"
              points={invoiceSeries
                .map((point, index) => `${index * 20},${100 - (point.value / maxInvoice) * 80}`)
                .join(" ")}
            />
            <polyline
              fill="rgba(11, 87, 208, 0.12)"
              stroke="none"
              points={`0,100 ${invoiceSeries
                .map((point, index) => `${index * 20},${100 - (point.value / maxInvoice) * 80}`)
                .join(" ")} 220,100`}
            />
          </svg>
          <div className="chart-legend">
            <span>Monitoring window</span>
            <span>{invoiceSeries.length ? invoiceSeries[invoiceSeries.length - 1].label : ""}</span>
          </div>
        </div>
        <div className="card chart-card" style={{ animationDelay: "0.15s" }}>
          <div className="chart-header">
            <div>
              <h3>Validation Alerts</h3>
              <div className="chart-sub">Companies needing attention</div>
            </div>
            <div className="mini-stat">
              <span className="dot red" />
              {summary ? `${summary.metrics.companies_with_errors} flagged` : "Loading"}
            </div>
          </div>
          <svg className="chart-svg" viewBox="0 0 240 100" preserveAspectRatio="none">
            {quoteSeries.map((point, index) => (
              <rect
                key={point.label}
                className="chart-bar"
                x={index * 20 + 2}
                y={100 - (point.value / maxQuote) * 80}
                width={12}
                height={(point.value / maxQuote) * 80}
                rx={4}
                fill="rgba(209, 43, 43, 0.35)"
              />
            ))}
          </svg>
          <div className="chart-legend">
            <span>Last 12 weeks</span>
            <span>{quoteSeries.length ? quoteSeries[quoteSeries.length - 1].label : ""}</span>
          </div>
        </div>
      </div>
      <div className="card-grid">
        <div className="card chart-card" style={{ animationDelay: "0.2s" }}>
          <div className="chart-header">
            <div>
              <h3>Device Health</h3>
              <div className="chart-sub">FDMS connectivity status</div>
            </div>
          </div>
          <div className="device-bars">
            {deviceSeries.map((item) => (
              <div key={item.label} className="device-row">
                <div className="device-label">
                  <span className="dot" style={{ background: item.color }} />
                  {item.label}
                </div>
                <div className="device-bar">
                  <span
                    className="device-fill"
                    style={{
                      width: summary
                        ? `${(item.value / Math.max(summary.metrics.devices_total, 1)) * 100}%`
                        : "0%",
                      background: item.color
                    }}
                  />
                </div>
                <div className="device-value">{item.value}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="card" style={{ animationDelay: "0.25s" }}>
          <h3>Company Open/Close Status</h3>
          <table className="table">
            <thead>
              <tr>
                <th>Company</th>
                <th>Open Day</th>
                <th>Close Status</th>
                <th>Devices</th>
                <th>Certificate</th>
                <th>Last Sync</th>
              </tr>
            </thead>
            <tbody>
              {(summary?.company_status ?? []).map((row) => (
                <tr key={row.company_id}>
                  <td>{row.company_name}</td>
                  <td>{row.open_day_status} #{row.last_fiscal_day_no}</td>
                  <td>{row.close_status}</td>
                  <td>
                    {row.devices_online}/{row.device_count}
                  </td>
                  <td>
                    {row.certificate_status}
                    {row.certificate_days_remaining !== null
                      ? ` (${row.certificate_days_remaining}d)`
                      : ""}
                  </td>
                  <td>{row.last_sync ? new Date(row.last_sync).toLocaleString() : "?"}</td>
                </tr>
              ))}
              {!summary?.company_status.length ? (
                <tr>
                  <td colSpan={6}>No company data available</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  return isAdmin ? adminView : portalView;
}
