import { useEffect, useMemo, useState } from "react";
import { apiFetch, apiRequest } from "../api";
import { useMe } from "../hooks/useMe";
import { useCompanies, Company } from "../hooks/useCompanies";

type Contact = {
  id: number;
  name: string;
};

type Expense = {
  id: number;
  company_id: number;
  vendor_id: number | null;
  reference: string;
  expense_date: string;
  description: string;
  category: string;
  subtotal: number;
  vat_rate: number;
  tax_amount: number;
  total_amount: number;
  currency: string;
  status: string;
  notes: string;
  created_at: string;
  updated_at: string;
};

const toDateInputValue = (value: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().split("T")[0];
};

const fromDateInputValue = (value: string) =>
  value ? new Date(value).toISOString() : null;

const formatCurrency = (value: number, currency: string = "USD") => {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
    }).format(value || 0);
  } catch {
    return `${currency} ${(value || 0).toFixed(2)}`;
  }
};

export default function ExpensesPage() {
  const { me } = useMe();
  const { companies: allCompanies, loading: companiesLoading } = useCompanies();
  const isAdmin = Boolean(me?.is_admin);

  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(null);
  const [companyQuery, setCompanyQuery] = useState("");
  const companyId = selectedCompanyId;

  useEffect(() => {
    if (!isAdmin && me?.company_ids?.length && !selectedCompanyId) {
      setSelectedCompanyId(me.company_ids[0]);
    }
  }, [isAdmin, me?.company_ids, selectedCompanyId]);

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

  const company: Company | null =
    allCompanies.find((c) => c.id === selectedCompanyId) ?? null;

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [vendorFilter, setVendorFilter] = useState<number | "">("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({
    reference: "",
    expense_date: "",
    vendor_id: "" as number | "",
    category: "",
    description: "",
    subtotal: 0,
    vat_rate: 0,
    currency: "USD",
    status: "posted",
    notes: "",
  });

  const calc = useMemo(() => {
    const subtotal = Number(form.subtotal) || 0;
    const rate = Number(form.vat_rate) || 0;
    const tax = subtotal * (rate / 100);
    return { tax, total: subtotal + tax };
  }, [form.subtotal, form.vat_rate]);

  const loadData = async () => {
    if (!companyId) return;
    setLoading(true);
    setError(null);
    try {
      const [contactsData, expensesData] = await Promise.all([
        apiFetch<Contact[]>(`/contacts?company_id=${companyId}`).catch(
          () => [] as Contact[],
        ),
        apiFetch<Expense[]>(`/expenses?company_id=${companyId}`).catch(
          () => [] as Expense[],
        ),
      ]);
      setContacts(contactsData);
      setExpenses(expensesData);
    } catch (err: any) {
      setError(err.message || "Failed to load expenses");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!companyId) return;
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  const filteredExpenses = useMemo(() => {
    const term = search.trim().toLowerCase();
    const from = fromDate ? new Date(fromDate) : null;
    const to = toDate ? new Date(toDate + "T23:59:59") : null;
    return expenses.filter((e) => {
      if (vendorFilter !== "" && e.vendor_id !== vendorFilter) return false;
      const d = e.expense_date ? new Date(e.expense_date) : null;
      if (from && d && d < from) return false;
      if (to && d && d > to) return false;
      if (!term) return true;
      const vendor =
        contacts.find((c) => c.id === e.vendor_id)?.name?.toLowerCase() || "";
      return (
        e.reference.toLowerCase().includes(term) ||
        e.description.toLowerCase().includes(term) ||
        e.category.toLowerCase().includes(term) ||
        vendor.includes(term)
      );
    });
  }, [expenses, search, vendorFilter, fromDate, toDate, contacts]);

  const startNew = () => {
    setEditingId(null);
    setShowForm(true);
    setForm({
      reference: "",
      expense_date: "",
      vendor_id: "",
      category: "",
      description: "",
      subtotal: 0,
      vat_rate: 0,
      currency: "USD",
      status: "posted",
      notes: "",
    });
  };

  const startEdit = (e: Expense) => {
    setEditingId(e.id);
    setShowForm(true);
    setForm({
      reference: e.reference,
      expense_date: toDateInputValue(e.expense_date),
      vendor_id: e.vendor_id ?? "",
      category: e.category || "",
      description: e.description || "",
      subtotal: e.subtotal || 0,
      vat_rate: e.vat_rate || 0,
      currency: e.currency || "USD",
      status: e.status || "posted",
      notes: e.notes || "",
    });
  };

  const saveExpense = async () => {
    if (!companyId) return;
    setError(null);
    try {
      const payload = {
        company_id: companyId,
        vendor_id: form.vendor_id === "" ? null : form.vendor_id,
        reference: form.reference.trim() || null,
        expense_date: form.expense_date ? fromDateInputValue(form.expense_date) : null,
        category: form.category,
        description: form.description,
        subtotal: Number(form.subtotal) || 0,
        vat_rate: Number(form.vat_rate) || 0,
        currency: form.currency,
        status: form.status,
        notes: form.notes,
      };

      if (editingId) {
        await apiFetch<Expense>(`/expenses/${editingId}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
      } else {
        await apiFetch<Expense>("/expenses", {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }
      setShowForm(false);
      setEditingId(null);
      await loadData();
    } catch (err: any) {
      setError(err.message || "Failed to save expense");
    }
  };

  const deleteExpense = async (id: number) => {
    if (!confirm("Delete this expense? This cannot be undone.")) return;
    try {
      await apiRequest(`/expenses/${id}`, { method: "DELETE" });
      await loadData();
    } catch (err: any) {
      setError(err.message || "Failed to delete expense");
    }
  };

  const goBackToCompanies = () => {
    setSelectedCompanyId(null);
    setExpenses([]);
    setContacts([]);
  };

  if (companiesLoading && !companyId) {
    return <div className="loading-indicator">Loading companies...</div>;
  }
  if (!isAdmin && !companyId && allCompanies.length) {
    return <div className="loading-indicator">Loading companies...</div>;
  }

  // ─── Admin company selection view ───
  if (isAdmin && !companyId) {
    return (
      <div className="content">
        <div
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
          Select a company to manage its expenses.
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
                {c.tin && <div className="device-company-detail">TIN: {c.tin}</div>}
                {c.vat && <div className="device-company-detail">VAT: {c.vat}</div>}
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
    <div className="content-area">
      <div className="page-header">
        <div>
          <h1 className="page-title">Expenses</h1>
          <p className="page-subtitle">
            {isAdmin && company ? `Company: ${company.name}` : "Manage company expenses"}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {isAdmin && companyId && (
            <button className="btn btn-secondary" onClick={goBackToCompanies}>
              Change Company
            </button>
          )}
          <button className="btn btn-primary" onClick={startNew}>
            + New Expense
          </button>
        </div>
      </div>

      {error && (
        <div className="alert alert-error" style={{ marginBottom: 16 }}>
          {error}
          <button onClick={() => setError(null)} style={{ marginLeft: 8 }}>
            ×
          </button>
        </div>
      )}

      <div className="card" style={{ padding: 16, marginBottom: 16 }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "2fr 1fr 1fr 1fr",
            gap: 12,
            alignItems: "end",
          }}
        >
          <div className="input-group">
            <label className="input-label">Search</label>
            <input
              className="input-field"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Reference, description, category, vendor"
            />
          </div>
          <div className="input-group">
            <label className="input-label">Vendor</label>
            <select
              className="input-field dropdown-select"
              value={vendorFilter}
              onChange={(e) =>
                setVendorFilter(e.target.value ? Number(e.target.value) : "")
              }
            >
              <option value="">All</option>
              {contacts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="input-group">
            <label className="input-label">From</label>
            <input
              className="input-field"
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
            />
          </div>
          <div className="input-group">
            <label className="input-label">To</label>
            <input
              className="input-field"
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
            />
          </div>
        </div>
      </div>

      {showForm && (
        <div className="card" style={{ padding: 16, marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <h3 style={{ margin: 0 }}>
              {editingId ? `Edit Expense #${editingId}` : "New Expense"}
            </h3>
            <button
              className="btn btn-secondary"
              onClick={() => {
                setShowForm(false);
                setEditingId(null);
              }}
            >
              Close
            </button>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr",
              gap: 12,
              marginTop: 12,
            }}
          >
            <div className="input-group">
              <label className="input-label">Date</label>
              <input
                className="input-field"
                type="date"
                value={form.expense_date}
                onChange={(e) => setForm({ ...form, expense_date: e.target.value })}
              />
            </div>
            <div className="input-group">
              <label className="input-label">Reference</label>
              <input
                className="input-field"
                value={form.reference}
                onChange={(e) => setForm({ ...form, reference: e.target.value })}
                placeholder="(auto)"
              />
            </div>
            <div className="input-group">
              <label className="input-label">Vendor</label>
              <select
                className="input-field dropdown-select"
                value={form.vendor_id}
                onChange={(e) =>
                  setForm({
                    ...form,
                    vendor_id: e.target.value ? Number(e.target.value) : "",
                  })
                }
              >
                <option value="">—</option>
                {contacts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="input-group">
              <label className="input-label">Category</label>
              <input
                className="input-field"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                placeholder="e.g., Fuel"
              />
            </div>
            <div className="input-group" style={{ gridColumn: "span 2" }}>
              <label className="input-label">Description</label>
              <input
                className="input-field"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="What was the expense for?"
              />
            </div>

            <div className="input-group">
              <label className="input-label">Amount (ex VAT)</label>
              <input
                className="input-field"
                type="number"
                value={form.subtotal}
                onChange={(e) =>
                  setForm({ ...form, subtotal: Number(e.target.value) })
                }
              />
            </div>
            <div className="input-group">
              <label className="input-label">VAT %</label>
              <input
                className="input-field"
                type="number"
                value={form.vat_rate}
                onChange={(e) =>
                  setForm({ ...form, vat_rate: Number(e.target.value) })
                }
              />
            </div>
            <div className="input-group">
              <label className="input-label">Currency</label>
              <input
                className="input-field"
                value={form.currency}
                onChange={(e) => setForm({ ...form, currency: e.target.value })}
              />
            </div>

            <div className="input-group">
              <label className="input-label">Status</label>
              <select
                className="input-field dropdown-select"
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
              >
                <option value="posted">Posted</option>
                <option value="draft">Draft</option>
              </select>
            </div>
            <div className="input-group" style={{ gridColumn: "span 2" }}>
              <label className="input-label">Notes</label>
              <input
                className="input-field"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginTop: 12,
              alignItems: "center",
            }}
          >
            <div style={{ color: "var(--muted)", fontSize: 13 }}>
              VAT: {formatCurrency(calc.tax, form.currency)} · Total: {formatCurrency(calc.total, form.currency)}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn btn-secondary" onClick={() => loadData()}>
                Refresh
              </button>
              <button className="btn btn-primary" onClick={saveExpense}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="card" style={{ padding: 0 }}>
        <div
          style={{
            padding: 12,
            borderBottom: "1px solid var(--border-color, #ddd)",
          }}
        >
          <strong>Expenses</strong>
          <span style={{ marginLeft: 8, color: "var(--muted)" }}>
            {filteredExpenses.length} item(s)
          </span>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table className="table" style={{ width: "100%" }}>
            <thead>
              <tr>
                <th>Date</th>
                <th>Reference</th>
                <th>Vendor</th>
                <th>Description</th>
                <th style={{ textAlign: "right" }}>Ex VAT</th>
                <th style={{ textAlign: "right" }}>VAT</th>
                <th style={{ textAlign: "right" }}>Total</th>
                <th>Status</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredExpenses.map((e) => {
                const vendorName =
                  contacts.find((c) => c.id === e.vendor_id)?.name || "—";
                return (
                  <tr key={e.id}>
                    <td>{toDateInputValue(e.expense_date) || "—"}</td>
                    <td>{e.reference}</td>
                    <td>{vendorName}</td>
                    <td>{e.description || e.category || "—"}</td>
                    <td style={{ textAlign: "right" }}>
                      {formatCurrency(e.subtotal, e.currency)}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      {formatCurrency(e.tax_amount, e.currency)}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      {formatCurrency(e.total_amount, e.currency)}
                    </td>
                    <td>{e.status}</td>
                    <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => startEdit(e)}
                        style={{ marginRight: 8 }}
                      >
                        Edit
                      </button>
                      <button
                        className="btn btn-outline-danger btn-sm"
                        onClick={() => deleteExpense(e.id)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                );
              })}
              {!filteredExpenses.length && (
                <tr>
                  <td colSpan={9} style={{ textAlign: "center", padding: 24 }}>
                    {loading ? "Loading…" : "No expenses found."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
