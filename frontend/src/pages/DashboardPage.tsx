import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { NavLink } from "react-router-dom";
import { apiFetch } from "../api";
import { TablePagination } from "../components/TablePagination";
import { useMe } from "../hooks/useMe";
import { useCompanies } from "../hooks/useCompanies";

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

interface RevenueTrendBar {
  key: string;
  label: string;
  value: number;
  heightPercent: number;
}

const niceNumber = (value: number, round: boolean): number => {
  if (value <= 0) return 0;
  const exponent = Math.floor(Math.log10(value));
  const base = 10 ** exponent;
  const fraction = value / base;

  let niceFraction;
  if (round) {
    if (fraction < 1.5) niceFraction = 1;
    else if (fraction < 3) niceFraction = 2;
    else if (fraction < 7) niceFraction = 5;
    else niceFraction = 10;
  } else {
    if (fraction <= 1) niceFraction = 1;
    else if (fraction <= 2) niceFraction = 2;
    else if (fraction <= 5) niceFraction = 5;
    else niceFraction = 10;
  }
  return niceFraction * base;
};

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
  invoice_type?: string;
  total_amount: number;
  amount_paid?: number;
  amount_due?: number;
  fiscalized_at?: string | null;
  created_at?: string;
  invoice_date?: string;
}

interface Quotation {
  id: number;
  reference: string;
  status: string;
  total_amount?: number;
  created_at?: string;
}

interface PurchaseOrder {
  id: number;
  reference: string;
  status: string;
  total_amount: number;
  order_date?: string | null;
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

const formatDateRangeLabel = (isoDate?: string) => {
  if (!isoDate) return "";
  const parsed = new Date(isoDate);
  if (Number.isNaN(parsed.getTime())) return isoDate;
  return parsed.toLocaleDateString("default", {
    month: "short",
    day: "numeric",
  });
};

const getInvoiceEffectiveDate = (invoice: Invoice): Date | null => {
  if (invoice.fiscalized_at) return new Date(invoice.fiscalized_at);
  if (invoice.invoice_date) return new Date(invoice.invoice_date);
  if (invoice.created_at) return new Date(invoice.created_at);
  return null;
};

const formatTrendLabel = (key: string, isMonthly: boolean) => {
  const parts = key.split("-");
  const year = Number(parts[0]);
  const month = Number(parts[1]);
  const day = isMonthly ? 1 : Number(parts[2]);
  const date = new Date(year, month, Number.isNaN(day) ? 1 : day);
  if (Number.isNaN(date.getTime())) return key;
  return isMonthly
    ? date.toLocaleString("default", { month: "short", year: "numeric" })
    : date.toLocaleString("default", { month: "short", day: "numeric" });
};

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
  const { companies: allCompanies, loading: companiesLoading } = useCompanies();
  const isAdmin = Boolean(me?.is_admin);
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(
    null,
  );
  const [companyQuery, setCompanyQuery] = useState("");

  // Portal users auto-select their first company
  useEffect(() => {
    if (!isAdmin && me?.company_ids?.length && !selectedCompanyId) {
      setSelectedCompanyId(me.company_ids[0]);
    }
  }, [isAdmin, me?.company_ids, selectedCompanyId]);

  const companyId = selectedCompanyId;

  const filteredCompanies = useMemo(() => {
    if (!companyQuery.trim()) return allCompanies;
    const q = companyQuery.toLowerCase();
    return allCompanies.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.tin && c.tin.toLowerCase().includes(q)) ||
        (c.vat && c.vat.toLowerCase().includes(q)),
    );
  }, [allCompanies, companyQuery]);

  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [purchases, setPurchases] = useState<PurchaseOrder[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [paymentStats, setPaymentStats] = useState<PaymentStats | null>(null);
  const [recentAuditLogs, setRecentAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dateRange, setDateRange] = useState({ from: "", to: "" });
  const [invoicePage, setInvoicePage] = useState(1);
  const [invoicePageSize, setInvoicePageSize] = useState(8);
  const [quotationPage, setQuotationPage] = useState(1);
  const [quotationPageSize, setQuotationPageSize] = useState(8);
  const [companyStatusPage, setCompanyStatusPage] = useState(1);
  const [companyStatusPageSize, setCompanyStatusPageSize] = useState(8);
  const [auditPage, setAuditPage] = useState(1);
  const [auditPageSize, setAuditPageSize] = useState(8);

  useEffect(() => {
    const now = new Date();
    const first = new Date(now.getFullYear(), now.getMonth(), 1);
    const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    setDateRange({
      from: first.toISOString().split("T")[0],
      to: last.toISOString().split("T")[0],
    });
  }, []);

  useEffect(() => {
    // Must have a company to load data
    if (!companyId) {
      setLoading(false);
      if (!isAdmin) setError("No company assigned to your account.");
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
      apiFetch<PurchaseOrder[]>(`/purchases${params}`).catch(() => []),
      apiFetch<Product[]>(`/products${params}`).catch(() => []),
      apiFetch<Contact[]>(`/contacts${params}`).catch(() => []),
      apiFetch<PaymentStats>(`/payments/summary${params}`).catch(() => null),
      apiFetch<AuditLog[]>(`/audit-logs${params}&limit=100`).catch(() => []),
    ];

    Promise.all(requests)
      .then(
        ([
          summaryData,
          invoicesData,
          quotationsData,
          purchasesData,
          productsData,
          contactsData,
          paymentData,
          auditData,
        ]) => {
          setSummary(summaryData as DashboardSummary | null);
          setInvoices((invoicesData as Invoice[]) || []);
          setQuotations((quotationsData as Quotation[]) || []);
          setPurchases((purchasesData as PurchaseOrder[]) || []);
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
  const filteredInvoices = useMemo(() => {
    const fromDate = dateRange.from ? new Date(dateRange.from) : null;
    const toDate = dateRange.to ? new Date(`${dateRange.to}T23:59:59`) : null;
    return invoices.filter((inv) => {
      if (inv.status === "cancelled" || inv.invoice_type === "credit_note") {
        return false;
      }
      const d = inv.fiscalized_at
        ? new Date(inv.fiscalized_at)
        : inv.created_at
          ? new Date(inv.created_at)
          : null;
      if (fromDate && d && d < fromDate) return false;
      if (toDate && d && d > toDate) return false;
      return true;
    });
  }, [invoices, dateRange]);

  const invoiceStats = useMemo(() => {
    const total = filteredInvoices.reduce(
      (sum, inv) => sum + (inv.total_amount || 0),
      0,
    );
    const fiscalized = filteredInvoices.filter(
      (inv) => inv.status === "fiscalized",
    ).length;
    const pending = filteredInvoices.filter(
      (inv) => inv.status === "draft" || inv.status === "pending",
    ).length;
    return { total, count: filteredInvoices.length, fiscalized, pending };
  }, [filteredInvoices]);

  const filteredPurchases = useMemo(() => {
    const fromDate = dateRange.from ? new Date(dateRange.from) : null;
    const toDate = dateRange.to ? new Date(`${dateRange.to}T23:59:59`) : null;
    return purchases.filter((po) => {
      if (po.status === "cancelled") return false;
      const d = po.order_date ? new Date(po.order_date) : null;
      if (fromDate && d && d < fromDate) return false;
      if (toDate && d && d > toDate) return false;
      return true;
    });
  }, [purchases, dateRange]);

  const purchaseStats = useMemo(() => {
    const total = filteredPurchases.reduce(
      (sum, po) => sum + (po.total_amount || 0),
      0,
    );
    return { total, count: filteredPurchases.length };
  }, [filteredPurchases]);

  const profitTotal = invoiceStats.total - purchaseStats.total;

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

  const sortedInvoicesForTable = useMemo(() => {
    return filteredInvoices.slice().sort((a, b) => {
      const ad = a.fiscalized_at || a.created_at || "";
      const bd = b.fiscalized_at || b.created_at || "";
      return new Date(bd).getTime() - new Date(ad).getTime();
    });
  }, [filteredInvoices]);

  const sortedQuotationsForTable = useMemo(() => {
    return quotations.slice().sort((a, b) => {
      const ad = a.created_at || "";
      const bd = b.created_at || "";
      return new Date(bd).getTime() - new Date(ad).getTime();
    });
  }, [quotations]);

  const sortedAuditLogs = useMemo(() => {
    return recentAuditLogs
      .slice()
      .sort(
        (a, b) =>
          new Date(b.action_at).getTime() - new Date(a.action_at).getTime(),
      );
  }, [recentAuditLogs]);

  const invoiceTotalPages = Math.max(
    1,
    Math.ceil(sortedInvoicesForTable.length / invoicePageSize),
  );
  const quotationTotalPages = Math.max(
    1,
    Math.ceil(sortedQuotationsForTable.length / quotationPageSize),
  );
  const companyStatusTotalPages = Math.max(
    1,
    Math.ceil(filteredCompanyStatus.length / companyStatusPageSize),
  );
  const auditTotalPages = Math.max(
    1,
    Math.ceil(sortedAuditLogs.length / auditPageSize),
  );

  const pagedInvoices = paginateRows(
    sortedInvoicesForTable,
    invoicePage,
    invoicePageSize,
  );
  const pagedQuotations = paginateRows(
    sortedQuotationsForTable,
    quotationPage,
    quotationPageSize,
  );
  const pagedCompanyStatus = paginateRows(
    filteredCompanyStatus,
    companyStatusPage,
    companyStatusPageSize,
  );
  const pagedAuditLogs = paginateRows(
    sortedAuditLogs,
    auditPage,
    auditPageSize,
  );

  useEffect(() => {
    setInvoicePage((prev) => Math.min(prev, invoiceTotalPages));
  }, [invoiceTotalPages]);

  useEffect(() => {
    setQuotationPage((prev) => Math.min(prev, quotationTotalPages));
  }, [quotationTotalPages]);

  useEffect(() => {
    setCompanyStatusPage((prev) => Math.min(prev, companyStatusTotalPages));
  }, [companyStatusTotalPages]);

  useEffect(() => {
    setAuditPage((prev) => Math.min(prev, auditTotalPages));
  }, [auditTotalPages]);

  useEffect(() => {
    setInvoicePage(1);
    setQuotationPage(1);
    setCompanyStatusPage(1);
    setAuditPage(1);
  }, [companyId, dateRange.from, dateRange.to]);

  const formatCurrency = (value: number) =>
    `$${value.toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })}`;

  const revenueTrendChart = useMemo(() => {
    if (!dateRange.from || !dateRange.to) {
      return {
        bars: [] as RevenueTrendBar[],
        totalRevenue: 0,
        latestValue: 0,
        latestLabel: "",
        axisTicks: [] as number[],
      };
    }

    const startDate = new Date(dateRange.from);
    const endDate = new Date(`${dateRange.to}T23:59:59`);
    if (
      Number.isNaN(startDate.getTime()) ||
      Number.isNaN(endDate.getTime()) ||
      startDate > endDate
    ) {
      return {
        bars: [] as RevenueTrendBar[],
        totalRevenue: 0,
        latestValue: 0,
        latestLabel: "",
        axisTicks: [] as number[],
      };
    }

    const diffDays = Math.max(
      1,
      Math.ceil(
        (endDate.getTime() - startDate.getTime() + 1) / (1000 * 60 * 60 * 24),
      ),
    );
    const isMonthly = diffDays > 90;
    const buildKey = (date: Date) =>
      isMonthly
        ? `${date.getFullYear()}-${date.getMonth()}`
        : `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;

    const buckets = new Map<string, number>();
    if (isMonthly) {
      let cursor = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
      while (cursor <= endDate) {
        buckets.set(buildKey(cursor), 0);
        cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
      }
    } else {
      let cursor = new Date(
        startDate.getFullYear(),
        startDate.getMonth(),
        startDate.getDate(),
      );
      while (cursor <= endDate) {
        buckets.set(buildKey(cursor), 0);
        cursor.setDate(cursor.getDate() + 1);
      }
    }

    filteredInvoices.forEach((inv) => {
      const date = getInvoiceEffectiveDate(inv);
      if (!date || date < startDate || date > endDate) {
        return;
      }
      const key = buildKey(date);
      buckets.set(key, (buckets.get(key) || 0) + (inv.total_amount || 0));
    });

    const basePoints = Array.from(buckets.entries()).map(([key, value]) => ({
      key,
      label: formatTrendLabel(key, isMonthly),
      value,
    }));
    const maxValue = Math.max(1, ...basePoints.map((point) => point.value));
    const totalRevenue = basePoints.reduce(
      (sum, point) => sum + point.value,
      0,
    );

    const axisSteps = 4;
    const rawStep = axisSteps ? maxValue / axisSteps : maxValue || 1;
    const stepSize = niceNumber(rawStep, false) || 1;
    const axisMax = stepSize * axisSteps;
    const axisTicks =
      axisMax === 0
        ? Array(axisSteps + 1).fill(0)
        : Array.from({ length: axisSteps + 1 }, (_, idx) => stepSize * (axisSteps - idx));

    const referenceValue = axisMax || 1;
    const bars = basePoints.map((point) => ({
      ...point,
      heightPercent: referenceValue > 0 ? Math.max(1, (point.value / referenceValue) * 100) : 0,
    }));

    const latestPoint = bars[bars.length - 1];
    return {
      bars,
      totalRevenue,
      latestValue: latestPoint?.value || 0,
      latestLabel: latestPoint?.label || "",
      axisTicks,
      axisSteps,
    };
  }, [filteredInvoices, dateRange.from, dateRange.to]);
  const hasRevenueTrend = revenueTrendChart.bars.length > 0;
  const trendPeriodLabel =
    dateRange.from && dateRange.to
      ? `${formatDateRangeLabel(dateRange.from)} – ${formatDateRangeLabel(
          dateRange.to,
        )}`
      : "Select a date range";

  const axisGridStyle = {
    "--trend-grid-count": revenueTrendChart.axisSteps ?? 4,
  } as CSSProperties;

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

  if (companiesLoading && !companyId) {
    return <div className="loading-indicator">Loading companies...</div>;
  }
  if (!isAdmin && !companyId && allCompanies.length) {
    return <div className="loading-indicator">Loading companies...</div>;
  }

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

  if (isAdmin && !companyId) {
    return (
      <div className="content">
        <div
          className=""
          style={{
            display: "flex",
            width: "auto",
            justifyContent: "space-between",
            marginBottom: 24,
          }}
        >
          <div className="company-search">
            <input
              type="text"
              placeholder="Search company by name, VAT, or TIN"
              value={companyQuery}
              onChange={(e) => setCompanyQuery(e.target.value)}
            />
          </div>
        </div>

        <p style={{ color: "var(--muted)", marginBottom: 20, fontSize: 14 }}>
          Select a company to view its purchase orders.
        </p>

        <div className="device-company-grid">
          {filteredCompanies.map((c) => (
            <button
              key={c.id}
              className="device-company-card"
              onClick={() => setSelectedCompanyId(c.id)}
            >
              <div className="device-company-icon">
                <svg
                  width="36"
                  height="36"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="4" y="2" width="16" height="20" rx="2" ry="2" />
                  <path d="M9 22v-4h6v4" />
                  <line x1="8" y1="6" x2="8" y2="6.01" />
                  <line x1="16" y1="6" x2="16" y2="6.01" />
                  <line x1="12" y1="6" x2="12" y2="6.01" />
                  <line x1="8" y1="10" x2="8" y2="10.01" />
                  <line x1="16" y1="10" x2="16" y2="10.01" />
                  <line x1="12" y1="10" x2="12" y2="10.01" />
                  <line x1="8" y1="14" x2="8" y2="14.01" />
                  <line x1="16" y1="14" x2="16" y2="14.01" />
                  <line x1="12" y1="14" x2="12" y2="14.01" />
                </svg>
              </div>
              <div className="device-company-info">
                <div className="device-company-name">{c.name}</div>
                {c.tin && (
                  <div className="device-company-detail">TIN: {c.tin}</div>
                )}
                {c.vat && (
                  <div className="device-company-detail">VAT: {c.vat}</div>
                )}
              </div>
              <div className="device-company-arrow">
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </div>
            </button>
          ))}
          {!filteredCompanies.length && (
            <div
              style={{
                gridColumn: "1 / -1",
                textAlign: "center",
                padding: 40,
                color: "var(--muted)",
              }}
            >
              {companyQuery.trim()
                ? "No companies match your search."
                : "No companies found. Create a company first."}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-page">
      {error && <div className="dashboard-error">{error}</div>}

      <div className="dashboard-header">
        <div className="dashboard-actions">
          <div className="date-range">
            <label htmlFor="from-date">From:</label>
            <input
              id="from-date"
              type="date"
              value={dateRange.from}
              onChange={(e) =>
                setDateRange((prev) => ({ ...prev, from: e.target.value }))
              }
            />
            <label htmlFor="to-date">To:</label>
            <input
              id="to-date"
              type="date"
              value={dateRange.to}
              onChange={(e) =>
                setDateRange((prev) => ({ ...prev, to: e.target.value }))
              }
            />
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="dashboard-kpis">
        <div className="kpi-card card-bg-shadow">
          <div className="kpi-icon bg-blue-200">
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
          <div className="kpi-icon bg-teal-200">
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
          <div className="kpi-icon bg-purple-200">
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
          <div className="kpi-icon bg-orange-200">
            <AlertTriangleIcon />
          </div>
          <div className="kpi-content">
            <div className="kpi-value">{invoiceStats.pending}</div>
            <div className="kpi-label">Pending Invoices</div>
          </div>
        </div>

        <div className="kpi-card card-bg-shadow">
          <div
            className={`kpi-icon ${profitTotal >= 0 ? "bg-red-200" : "bg-green-200"}`}
          >
            <FileTextIcon />
          </div>
          <div className="kpi-content">
            <div className="kpi-value">
              $
              {profitTotal.toLocaleString(undefined, {
                minimumFractionDigits: 0,
                maximumFractionDigits: 0,
              })}
            </div>
            <div className="kpi-label">Profit</div>
          </div>
          <div className="kpi-badge">
            Sales $
            {invoiceStats.total.toLocaleString(undefined, {
              minimumFractionDigits: 0,
              maximumFractionDigits: 0,
            })}
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="dashboard-charts ">
        <div className="chart-card card-bg-shadow">
          <div className="chart-header">
            <h3 className="bg-gray-200 py-1 px-2 rounded-lg">Revenue Trend</h3>
            <span className="chart-period">{trendPeriodLabel}</span>
          </div>
          {hasRevenueTrend ? (
            <div className="trend-card-body">
              <div className="trend-chart-grid">
                <div className="axis-labels" aria-hidden="true">
                  {revenueTrendChart.axisTicks.map((value) => (
                    <span key={value}>{formatCurrency(value)}</span>
                  ))}
                </div>
                <div className="bar-axis">
                  <div
                    className="trend-bar-chart"
                    role="img"
                    aria-label="Revenue trend bars"
                    style={axisGridStyle}
                  >
                    {revenueTrendChart.bars.map((bar) => (
                      <div key={bar.key} className="trend-bar-item">
                        <div className="trend-bar-track">
                          <div
                            className="bar"
                            style={{ height: `${bar.heightPercent}%` }}
                            title={`${bar.label}: ${formatCurrency(bar.value)}`}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="bar-axis-labels" aria-hidden="true">
                    {revenueTrendChart.bars.map((bar) => (
                      <span key={bar.key}>{bar.label}</span>
                    ))}
                  </div>
                </div>
              </div>
              <div className="trend-summary">
                <div>
                  <span>Total revenue</span>
                  <strong>
                    {formatCurrency(revenueTrendChart.totalRevenue)}
                  </strong>
                </div>
                <div>
                  <span>
                    Latest
                    {revenueTrendChart.latestLabel
                      ? ` (${revenueTrendChart.latestLabel})`
                      : ""}
                  </span>
                  <strong>
                    {formatCurrency(revenueTrendChart.latestValue)}
                  </strong>
                </div>
              </div>
            </div>
          ) : (
            <div className="empty-state" style={{ margin: "24px 0" }}>
              No invoices exist in the selected period to display revenue.
            </div>
          )}
        </div>

        <div className="chart-card card-bg-shadow">
          <div className="chart-header">
            <h3 className="bg-gray-200 py-1 px-2 rounded-lg">Invoice Status</h3>
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
            <h3 className="bg-gray-200 py-1 px-2 rounded-lg">
              Quotations Pipeline
            </h3>
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
            <h3 className="bg-gray-200 py-1 px-2 rounded-lg">
              Recent Invoices
            </h3>
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
              {pagedInvoices.map((invoice) => (
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
              {pagedInvoices.length === 0 && (
                <tr>
                  <td colSpan={4} className="empty-cell">
                    No invoices yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          <TablePagination
            page={invoicePage}
            totalItems={sortedInvoicesForTable.length}
            onPageChange={setInvoicePage}
            pageSize={invoicePageSize}
            onPageSizeChange={(size) => {
              setInvoicePageSize(size);
              setInvoicePage(1);
            }}
          />
        </div>

        <div className="table-card card-bg-shadow">
          <div className="table-header">
            <h3 className="bg-gray-200 py-1 px-2 rounded-lg">
              Recent Quotations
            </h3>
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
              {pagedQuotations.map((quotation) => (
                <tr key={quotation.id}>
                  <td className="ref-cell">{quotation.reference}</td>
                  <td>
                    <span className={`status-pill ${quotation.status}`}>
                      {quotation.status}
                    </span>
                  </td>
                </tr>
              ))}
              {pagedQuotations.length === 0 && (
                <tr>
                  <td colSpan={2} className="empty-cell">
                    No quotations yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          <TablePagination
            page={quotationPage}
            totalItems={sortedQuotationsForTable.length}
            onPageChange={setQuotationPage}
            pageSize={quotationPageSize}
            onPageSizeChange={(size) => {
              setQuotationPageSize(size);
              setQuotationPage(1);
            }}
          />
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
              {pagedCompanyStatus.map((company) => (
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
          <TablePagination
            page={companyStatusPage}
            totalItems={filteredCompanyStatus.length}
            onPageChange={setCompanyStatusPage}
            pageSize={companyStatusPageSize}
            onPageSizeChange={(size) => {
              setCompanyStatusPageSize(size);
              setCompanyStatusPage(1);
            }}
          />
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
              {pagedAuditLogs.map((log) => (
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
          <TablePagination
            page={auditPage}
            totalItems={sortedAuditLogs.length}
            onPageChange={setAuditPage}
            pageSize={auditPageSize}
            onPageSizeChange={(size) => {
              setAuditPageSize(size);
              setAuditPage(1);
            }}
          />
        </div>
      )}
    </div>
  );
}

function paginateRows<T>(rows: T[], page: number, pageSize: number) {
  const start = (page - 1) * pageSize;
  return rows.slice(start, start + pageSize);
}
