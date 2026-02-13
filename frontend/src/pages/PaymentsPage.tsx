import { useEffect, useState } from "react";
import { apiFetch } from "../api";
import { useMe } from "../hooks/useMe";

interface Payment {
  id: number;
  invoice_id: number;
  invoice_reference: string;
  company_id: number;
  amount: number;
  currency: string;
  payment_method: string;
  payment_date: string;
  reference: string;
  notes: string;
  is_reconciled: boolean;
  created_at: string;
  created_by_id: number | null;
  created_by_email: string;
}

interface PaymentSummary {
  total_payments: number;
  total_amount: number;
  reconciled_count: number;
  pending_count: number;
  by_method: Record<string, { count: number; amount: number }>;
}

const paymentMethods = [
  { value: "cash", label: "Cash" },
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "mobile_money", label: "Mobile Money" },
  { value: "card", label: "Card" },
  { value: "cheque", label: "Cheque" },
  { value: "other", label: "Other" },
];

const formatCurrency = (value: number, currency: string = "USD") => {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(value || 0);
  } catch {
    return `${currency} ${(value || 0).toFixed(2)}`;
  }
};

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString();
};

// Icons
const PaymentIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/>
    <line x1="1" y1="10" x2="23" y2="10"/>
  </svg>
);

const CheckIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);

const ClockIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <polyline points="12 6 12 12 16 14"/>
  </svg>
);

export default function PaymentsPage() {
  const { me } = useMe();
  const companyId = me?.company_ids?.[0];

  const [payments, setPayments] = useState<Payment[]>([]);
  const [summary, setSummary] = useState<PaymentSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [methodFilter, setMethodFilter] = useState("");
  const [reconciledFilter, setReconciledFilter] = useState("");
  const [searchFilter, setSearchFilter] = useState("");

  useEffect(() => {
    loadData();
  }, [companyId, methodFilter, reconciledFilter, searchFilter]);

  const loadData = async () => {
    if (!companyId) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.append("company_id", String(companyId));
      if (methodFilter) params.append("payment_method", methodFilter);
      if (reconciledFilter) params.append("is_reconciled", reconciledFilter);
      if (searchFilter) params.append("search", searchFilter);

      const [paymentsData, summaryData] = await Promise.all([
        apiFetch<Payment[]>(`/payments?${params.toString()}`),
        apiFetch<PaymentSummary>(`/payments/summary?company_id=${companyId}`).catch(() => null),
      ]);

      setPayments(paymentsData);
      setSummary(summaryData);
    } catch (err: any) {
      setError(err.message || "Failed to load payments");
    } finally {
      setLoading(false);
    }
  };

  const reconcilePayment = async (paymentId: number) => {
    try {
      await apiFetch(`/payments/${paymentId}/reconcile`, { method: "POST" });
      loadData();
    } catch (err: any) {
      setError(err.message || "Failed to reconcile payment");
    }
  };

  const getMethodBadgeColor = (method: string) => {
    const colors: Record<string, string> = {
      cash: "var(--green-600)",
      bank_transfer: "var(--blue-600)",
      mobile_money: "var(--violet-600)",
      card: "var(--red-600)",
      cheque: "var(--orange-600)",
      other: "var(--slate-500)",
    };
    return colors[method] || "var(--slate-500)";
  };

  return (
    <div className="content-area">
      <div className="page-header">
        <div>
          <h1 className="page-title">Payments</h1>
          <p className="page-subtitle">Track all payment transactions</p>
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
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16, marginBottom: 24 }}>
          <div className="card" style={{ padding: 20 }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: "var(--slate-800)" }}>
              {summary.total_payments}
            </div>
            <div style={{ fontSize: 13, color: "var(--slate-500)" }}>Total Payments</div>
          </div>
          <div className="card" style={{ padding: 20 }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: "var(--green-600)" }}>
              {formatCurrency(summary.total_amount)}
            </div>
            <div style={{ fontSize: 13, color: "var(--slate-500)" }}>Total Amount</div>
          </div>
          <div className="card" style={{ padding: 20 }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: "var(--blue-600)" }}>
              {summary.reconciled_count}
            </div>
            <div style={{ fontSize: 13, color: "var(--slate-500)" }}>Reconciled</div>
          </div>
          <div className="card" style={{ padding: 20 }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: "var(--amber-500)" }}>
              {summary.pending_count}
            </div>
            <div style={{ fontSize: 13, color: "var(--slate-500)" }}>Pending</div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="card" style={{ padding: 20, marginBottom: 20 }}>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div className="form-group" style={{ flex: 2, minWidth: 200 }}>
            <label>Search</label>
            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Search by reference..."
            />
          </div>
          <div className="form-group" style={{ flex: 1, minWidth: 150 }}>
            <label>Payment Method</label>
            <select value={methodFilter} onChange={(e) => setMethodFilter(e.target.value)}>
              <option value="">All Methods</option>
              {paymentMethods.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>
          <div className="form-group" style={{ flex: 1, minWidth: 150 }}>
            <label>Status</label>
            <select value={reconciledFilter} onChange={(e) => setReconciledFilter(e.target.value)}>
              <option value="">All</option>
              <option value="true">Reconciled</option>
              <option value="false">Pending</option>
            </select>
          </div>
        </div>
      </div>

      {/* Payments Table */}
      {loading ? (
        <div style={{ padding: 40, textAlign: "center", color: "var(--slate-500)" }}>
          Loading payments...
        </div>
      ) : (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Invoice</th>
                <th>Reference</th>
                <th>Method</th>
                <th style={{ textAlign: "right" }}>Amount</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {payments.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", padding: 40, color: "var(--slate-500)" }}>
                    No payments found
                  </td>
                </tr>
              ) : (
                payments.map((payment) => (
                  <tr key={payment.id}>
                    <td style={{ fontSize: 13 }}>{formatDate(payment.payment_date)}</td>
                    <td>
                      <span style={{ fontWeight: 500 }}>{payment.invoice_reference}</span>
                    </td>
                    <td style={{ fontSize: 13, color: "var(--slate-500)" }}>{payment.reference || "-"}</td>
                    <td>
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                          padding: "4px 10px",
                          borderRadius: 999,
                          fontSize: 12,
                          fontWeight: 600,
                          background: getMethodBadgeColor(payment.payment_method) + "15",
                          color: getMethodBadgeColor(payment.payment_method),
                        }}
                      >
                        <PaymentIcon />
                        {paymentMethods.find((m) => m.value === payment.payment_method)?.label || payment.payment_method}
                      </span>
                    </td>
                    <td style={{ textAlign: "right", fontWeight: 600, fontFamily: "monospace" }}>
                      {formatCurrency(payment.amount, payment.currency)}
                    </td>
                    <td>
                      {payment.is_reconciled ? (
                        <span style={{ color: "var(--green-600)", display: "flex", alignItems: "center", gap: 4 }}>
                          <CheckIcon /> Reconciled
                        </span>
                      ) : (
                        <span style={{ color: "var(--amber-500)", display: "flex", alignItems: "center", gap: 4 }}>
                          <ClockIcon /> Pending
                        </span>
                      )}
                    </td>
                    <td>
                      {!payment.is_reconciled && (
                        <button
                          className="btn btn-sm btn-primary"
                          onClick={() => reconcilePayment(payment.id)}
                        >
                          Reconcile
                        </button>
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
          background: var(--red-100);
          color: var(--red-600);
          padding: 12px 16px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .btn-sm {
          padding: 6px 12px;
          font-size: 12px;
        }
      `}</style>
    </div>
  );
}
