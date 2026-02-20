import { useEffect, useMemo, useState } from "react";
import { apiFetch, apiRequest } from "../api";
import { useMe } from "../hooks/useMe";
import { useCompanies, Company } from "../hooks/useCompanies";

type Contact = {
  id: number;
  name: string;
};

type Category = {
  id: number;
  company_id: number;
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
  const [categories, setCategories] = useState<Category[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [vendorFilter, setVendorFilter] = useState<number | "">("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const [selectedExpenseId, setSelectedExpenseId] = useState<number | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");

  const emptyForm = useMemo(
    () => ({
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
    }),
    [],
  );

  const [form, setForm] = useState(emptyForm);

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
      const [contactsData, expensesData, categoriesData] = await Promise.all([
        apiFetch<Contact[]>(`/contacts?company_id=${companyId}`).catch(
          () => [] as Contact[],
        ),
        apiFetch<Expense[]>(`/expenses?company_id=${companyId}`).catch(
          () => [] as Expense[],
        ),
        apiFetch<Category[]>(`/categories?company_id=${companyId}`).catch(
          () => [] as Category[],
        ),
      ]);
      setContacts(contactsData);
      setExpenses(expensesData);
      setCategories(categoriesData);
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
      if (statusFilter && (e.status || "") !== statusFilter) return false;
      const d = e.expense_date ? new Date(e.expense_date) : null;
      if (from && d && d < from) return false;
      if (to && d && d > to) return false;
      if (!term) return true;
      const vendor =
        contacts.find((c) => c.id === e.vendor_id)?.name?.toLowerCase() || "";
      return (
        (e.reference || "").toLowerCase().includes(term) ||
        (e.description || "").toLowerCase().includes(term) ||
        (e.category || "").toLowerCase().includes(term) ||
        vendor.includes(term)
      );
    });
  }, [expenses, search, vendorFilter, statusFilter, fromDate, toDate, contacts]);

  const selectedExpense = useMemo(
    () => expenses.find((e) => e.id === selectedExpenseId) ?? null,
    [expenses, selectedExpenseId],
  );

  useEffect(() => {
    if (selectedExpenseId && !expenses.some((e) => e.id === selectedExpenseId)) {
      setSelectedExpenseId(null);
      setIsEditing(false);
    }
  }, [expenses, selectedExpenseId]);

  useEffect(() => {
    if (
      selectedExpenseId &&
      !filteredExpenses.some((e) => e.id === selectedExpenseId)
    ) {
      setSelectedExpenseId(null);
      setIsEditing(false);
    }
  }, [filteredExpenses, selectedExpenseId]);

  useEffect(() => {
    if (!selectedExpense) {
      setForm(emptyForm);
      setIsEditing(false);
      setNewCategoryName("");
      return;
    }
    setForm({
      reference: selectedExpense.reference,
      expense_date: toDateInputValue(selectedExpense.expense_date),
      vendor_id: selectedExpense.vendor_id ?? "",
      category: selectedExpense.category || "",
      description: selectedExpense.description || "",
      subtotal: selectedExpense.subtotal || 0,
      vat_rate: selectedExpense.vat_rate || 0,
      currency: selectedExpense.currency || "USD",
      status: selectedExpense.status || "posted",
      notes: selectedExpense.notes || "",
    });
    setIsEditing(false);
    setNewCategoryName("");
  }, [selectedExpense, emptyForm]);

  const startNew = () => {
    setSelectedExpenseId(null);
    setForm({
      ...emptyForm,
      expense_date: new Date().toISOString().split("T")[0],
      currency: "USD",
      status: "posted",
    });
    setIsEditing(true);
    setNewCategoryName("");
  };

  const saveExpense = async () => {
    if (!companyId) return;
    setError(null);
    setSaving(true);
    try {
      const createPayload = {
        company_id: companyId,
        vendor_id: form.vendor_id === "" ? null : form.vendor_id,
        reference: form.reference.trim() || null,
        expense_date: form.expense_date
          ? fromDateInputValue(form.expense_date)
          : null,
        category: form.category,
        description: form.description,
        subtotal: Number(form.subtotal) || 0,
        vat_rate: Number(form.vat_rate) || 0,
        currency: form.currency,
        status: form.status,
        notes: form.notes,
      };

      if (selectedExpenseId) {
        const updatePayload = {
          vendor_id: createPayload.vendor_id,
          reference: createPayload.reference,
          expense_date: createPayload.expense_date,
          category: createPayload.category,
          description: createPayload.description,
          subtotal: createPayload.subtotal,
          vat_rate: createPayload.vat_rate,
          currency: createPayload.currency,
          status: createPayload.status,
          notes: createPayload.notes,
        };
        const updated = await apiFetch<Expense>(`/expenses/${selectedExpenseId}`,
          {
            method: "PATCH",
            body: JSON.stringify(updatePayload),
          },
        );
        await loadData();
        setSelectedExpenseId(updated.id);
        setIsEditing(false);
      } else {
        const created = await apiFetch<Expense>("/expenses", {
          method: "POST",
          body: JSON.stringify(createPayload),
        });
        await loadData();
        setSelectedExpenseId(created.id);
        setIsEditing(false);
      }
    } catch (err: any) {
      setError(err.message || "Failed to save expense");
    } finally {
      setSaving(false);
    }
  };

  const deleteSelectedExpense = async () => {
    if (!selectedExpenseId) return;
    if (!confirm("Delete this expense? This cannot be undone.")) return;
    try {
      await apiRequest(`/expenses/${selectedExpenseId}`, { method: "DELETE" });
      await loadData();
      setSelectedExpenseId(null);
      setIsEditing(false);
    } catch (err: any) {
      setError(err.message || "Failed to delete expense");
    }
  };

  const createCategory = async () => {
    if (!companyId) return;
    const name = newCategoryName.trim();
    if (!name) return;
    setCreatingCategory(true);
    setError(null);
    try {
      const created = await apiFetch<Category>("/categories", {
        method: "POST",
        body: JSON.stringify({ company_id: companyId, name }),
      });
      setCategories((prev) => [...prev, created]);
      setForm((prev) => ({ ...prev, category: created.name }));
      setNewCategoryName("");
    } catch (err: any) {
      setError(err.message || "Failed to create category");
    } finally {
      setCreatingCategory(false);
    }
  };

  const goBackToCompanies = () => {
    setSelectedCompanyId(null);
    setExpenses([]);
    setContacts([]);
    setCategories([]);
    setSelectedExpenseId(null);
    setIsEditing(false);
  };

  if (companiesLoading && !companyId) {
    return <div className="loading-indicator">Loading companies...</div>;
  }
  if (!isAdmin && !companyId && allCompanies.length) {
    return <div className="loading-indicator">Loading companies...</div>;
  }

  // â”€â”€â”€ Admin company selection view â”€â”€â”€
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

  const goBackToList = () => {
    setSelectedExpenseId(null);
    setIsEditing(false);
    setForm(emptyForm);
  };

  const showFormView = selectedExpenseId !== null || isEditing;

  return (
    <div className="container-fluid py-3">
      {error && (
        <div className="alert alert-danger alert-dismissible fade show" role="alert">
          {error}
          <button type="button" className="btn-close" onClick={() => setError(null)} />
        </div>
      )}

      {/* ───────────── LIST VIEW ───────────── */}
      {!showFormView && (
        <>
          {isAdmin && company && (
            <div
              className="o-control-panel"
              style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}
            >
              <div className="o-breadcrumb">
                <span
                  className="o-breadcrumb-item"
                  style={{ cursor: "pointer" }}
                  onClick={goBackToCompanies}
                >
                  Expenses
                </span>
                <span className="o-breadcrumb-separator">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </span>
                <span className="o-breadcrumb-current">{company.name}</span>
              </div>
            </div>
          )}

          <div className="two-panel two-panel-left">
            {/* Sidebar */}
            <div className="o-sidebar">
              <div className="o-sidebar-section">
                <div className="o-sidebar-title">STATUS</div>
                {([
                  {
                    key: "",
                    label: "ALL EXPENSES",
                    icon: (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--indigo-500)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 3h18v18H3z" /><path d="M3 9h18" /><path d="M9 21V9" />
                      </svg>
                    ),
                  },
                  {
                    key: "posted",
                    label: "POSTED",
                    icon: (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--blue-500)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><path d="m9 11 3 3L22 4" />
                      </svg>
                    ),
                  },
                  {
                    key: "draft",
                    label: "DRAFT",
                    icon: (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--amber-500)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                      </svg>
                    ),
                  },
                ] as const).map((item) => (
                  <div
                    key={item.key || "all"}
                    className={`o-sidebar-item ${statusFilter === item.key ? "active" : ""}`}
                    onClick={() => setStatusFilter(item.key)}
                  >
                    <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      {item.icon}
                      <span>{item.label}</span>
                    </span>
                    <span className="o-sidebar-count">
                      {item.key === "" ? expenses.length : expenses.filter((e) => e.status === item.key).length}
                    </span>
                  </div>
                ))}
              </div>

              <div className="o-sidebar-section">
                <div className="o-sidebar-title">VENDOR</div>
                <div
                  className={`o-sidebar-item ${vendorFilter === "" ? "active" : ""}`}
                  onClick={() => setVendorFilter("")}
                >
                  <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" />
                    </svg>
                    <span>ALL VENDORS</span>
                  </span>
                  <span className="o-sidebar-count">{expenses.length}</span>
                </div>
                {contacts.slice(0, 12).map((c) => (
                  <div
                    key={c.id}
                    className={`o-sidebar-item ${vendorFilter === c.id ? "active" : ""}`}
                    onClick={() => setVendorFilter(c.id)}
                  >
                    <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
                      </svg>
                      <span>{c.name.toUpperCase().slice(0, 18)}</span>
                    </span>
                    <span className="o-sidebar-count">{expenses.filter((e) => e.vendor_id === c.id).length}</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="content-top-bar">
                <div className="top-search">
                  <span className="search-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                  </span>
                  <input placeholder="Search expenses…" value={search} onChange={(e) => setSearch(e.target.value)} />
                </div>

                <button
                  className="o-btn o-btn-secondary"
                  style={{ display: "flex", alignItems: "center", gap: 6 }}
                  onClick={() => {
                    const headers = ["Reference","Date","Vendor","Category","Description","Subtotal","VAT","Total","Status"];
                    const rows = filteredExpenses.map((e) => {
                      const vendor = contacts.find((c) => c.id === e.vendor_id)?.name || "";
                      return [e.reference, toDateInputValue(e.expense_date), vendor, e.category, e.description, e.subtotal, e.tax_amount, e.total_amount, e.status];
                    });
                    const csvContent = [headers, ...rows].map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
                    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
                    const link = document.createElement("a");
                    link.href = URL.createObjectURL(blob);
                    link.download = `expenses_${new Date().toISOString().split("T")[0]}.csv`;
                    link.click();
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  Export
                </button>

                <button className="btn-create" onClick={startNew}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  New Expense
                </button>
              </div>

              <div className="card shadow-sm card-bg-shadow">
                <div className="card-body p-0">
                  <div className="table-responsive">
                    <table className="table table-hover align-middle mb-0">
                      <thead className="table-light">
                        <tr>
                          <th>Reference</th>
                          <th>Vendor</th>
                          <th>Category</th>
                          <th>Date</th>
                          <th>Status</th>
                          <th className="text-end">Subtotal</th>
                          <th className="text-end">VAT</th>
                          <th className="text-end">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {loading && (
                          <tr><td colSpan={8} className="text-center py-5 text-muted">Loading expenses…</td></tr>
                        )}
                        {!loading && filteredExpenses.length === 0 && (
                          <tr><td colSpan={8} className="text-center py-5 text-muted">No expenses yet. Click <strong>+ New Expense</strong> to create one.</td></tr>
                        )}
                        {filteredExpenses.map((e) => {
                          const vendorName = contacts.find((c) => c.id === e.vendor_id)?.name || "\u2014";
                          return (
                            <tr key={e.id} role="button" onClick={() => setSelectedExpenseId(e.id)}>
                              <td>
                                <div className="fw-semibold">{e.reference || "\u2014"}</div>
                                <small className="text-muted">{(e.description || "").slice(0, 40)}</small>
                              </td>
                              <td>{vendorName}</td>
                              <td>{e.category || "\u2014"}</td>
                              <td className="text-muted">{e.expense_date ? new Date(e.expense_date).toLocaleDateString() : "\u2014"}</td>
                              <td>
                                <span className={`badge ${e.status === "posted" ? "bg-info" : "bg-secondary"}`}>{e.status}</span>
                              </td>
                              <td className="text-end">{formatCurrency(e.subtotal, e.currency)}</td>
                              <td className="text-end text-muted">{formatCurrency(e.tax_amount, e.currency)}</td>
                              <td className="text-end fw-semibold">{formatCurrency(e.total_amount, e.currency)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                      {filteredExpenses.length > 0 && (
                        <tfoot>
                          <tr style={{ background: "var(--slate-50)", fontWeight: 600 }}>
                            <td colSpan={5} className="text-end">Grand Total:</td>
                            <td className="text-end">{formatCurrency(filteredExpenses.reduce((s, e) => s + (e.subtotal || 0), 0), "USD")}</td>
                            <td className="text-end">{formatCurrency(filteredExpenses.reduce((s, e) => s + (e.tax_amount || 0), 0), "USD")}</td>
                            <td className="text-end">{formatCurrency(filteredExpenses.reduce((s, e) => s + (e.total_amount || 0), 0), "USD")}</td>
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ───────────── FORM VIEW (New / Detail) ───────────── */}
      {showFormView && (
        <div>
          {/* Top toolbar */}
          <div className="d-flex flex-wrap justify-content-between align-items-center mb-3 gap-2">
            <div className="d-flex align-items-center gap-2">
              <button className="btn btn-sm btn-light border" onClick={goBackToList}>
                ← Back
              </button>
              <h4 className="fw-bold mb-0" style={{ fontSize: 18 }}>
                {selectedExpenseId ? (selectedExpense?.reference || "Expense") : "New Expense"}
              </h4>
              {selectedExpenseId && (
                <span className={`badge ms-2 ${form.status === "posted" ? "bg-info" : "bg-secondary"}`}>
                  {form.status}
                </span>
              )}
            </div>
            <div className="d-flex flex-wrap gap-1">
              {isEditing ? (
                <>
                  <button className="btn btn-sm btn-primary" onClick={saveExpense} disabled={saving}>
                    {saving ? "Saving…" : selectedExpenseId ? "Save" : "Create Expense"}
                  </button>
                  <button
                    className="btn btn-sm btn-light border"
                    onClick={() => {
                      if (selectedExpense) { setSelectedExpenseId(selectedExpense.id); }
                      else { goBackToList(); }
                      setIsEditing(false);
                    }}
                  >
                    Discard
                  </button>
                </>
              ) : (
                <>
                  <button className="btn btn-sm btn-light border" onClick={() => setIsEditing(true)}>
                    Edit
                  </button>
                  <button className="btn btn-sm btn-danger" onClick={deleteSelectedExpense}>
                    Delete
                  </button>
                </>
              )}
            </div>
          </div>

          {/* ── Form Card ── */}
          <div className="card shadow-sm">
            <div className="card-body invoice-form">
              <div className="row g-3">
                <div className="col-md-6">
                  <label className="form-label fw-semibold">Date</label>
                  <input
                    className="form-control input-underline"
                    type="date"
                    value={form.expense_date}
                    onChange={(e) => setForm((p) => ({ ...p, expense_date: e.target.value }))}
                    disabled={!isEditing}
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label fw-semibold">Reference</label>
                  <input
                    className="form-control input-underline bg-light"
                    value={form.reference}
                    onChange={(e) => setForm((p) => ({ ...p, reference: e.target.value }))}
                    placeholder="(auto)"
                    disabled={!isEditing}
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label fw-semibold">Vendor</label>
                  <select
                    className="form-select input-underline"
                    value={form.vendor_id}
                    onChange={(e) => setForm((p) => ({ ...p, vendor_id: e.target.value ? Number(e.target.value) : "" }))}
                    disabled={!isEditing}
                  >
                    <option value="">— Select Vendor —</option>
                    {contacts.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div className="col-md-6">
                  <label className="form-label fw-semibold">Category</label>
                  <div className="position-relative">
                    <select
                      className="form-select input-underline"
                      value={form.category || ""}
                      onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
                      disabled={!isEditing}
                    >
                      <option value="">— Select Category —</option>
                      {categories.slice().sort((a, b) => a.name.localeCompare(b.name)).map((c) => (
                        <option key={c.id} value={c.name}>{c.name}</option>
                      ))}
                    </select>
                    {isEditing && (
                      <div className="d-flex gap-2 mt-2">
                        <input
                          className="form-control form-control-sm"
                          value={newCategoryName}
                          onChange={(e) => setNewCategoryName(e.target.value)}
                          placeholder="New category name"
                          style={{ maxWidth: 180 }}
                        />
                        <button
                          className="btn btn-sm btn-outline-primary"
                          onClick={createCategory}
                          disabled={creatingCategory || !newCategoryName.trim()}
                        >
                          {creatingCategory ? "…" : "+ Create"}
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="col-md-3">
                  <label className="form-label">Status</label>
                  <select
                    className="form-select input-underline"
                    value={form.status}
                    onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}
                    disabled={!isEditing}
                  >
                    <option value="posted">Posted</option>
                    <option value="draft">Draft</option>
                  </select>
                </div>
                <div className="col-md-3">
                  <label className="form-label">Currency</label>
                  <input
                    className="form-control input-underline"
                    value={form.currency}
                    onChange={(e) => setForm((p) => ({ ...p, currency: e.target.value }))}
                    disabled={!isEditing}
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label fw-semibold">Description</label>
                  <input
                    className="form-control input-underline"
                    value={form.description}
                    onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                    placeholder="What was the expense for?"
                    disabled={!isEditing}
                  />
                </div>

                <div className="col-12">
                  <hr className="my-1" />
                </div>

                <div className="col-md-3">
                  <label className="form-label fw-semibold">Amount (ex VAT)</label>
                  <input
                    className="form-control input-underline"
                    type="number"
                    value={form.subtotal}
                    onChange={(e) => setForm((p) => ({ ...p, subtotal: Number(e.target.value) }))}
                    disabled={!isEditing}
                  />
                </div>
                <div className="col-md-3">
                  <label className="form-label fw-semibold">VAT %</label>
                  <input
                    className="form-control input-underline"
                    type="number"
                    value={form.vat_rate}
                    onChange={(e) => setForm((p) => ({ ...p, vat_rate: Number(e.target.value) }))}
                    disabled={!isEditing}
                  />
                </div>
                <div className="col-md-3">
                  <label className="form-label">Tax Amount</label>
                  <div className="form-control-plaintext fw-semibold" style={{ fontSize: 14 }}>
                    {formatCurrency(calc.tax, form.currency)}
                  </div>
                </div>
                <div className="col-md-3">
                  <label className="form-label">Total</label>
                  <div className="form-control-plaintext fw-bold text-primary" style={{ fontSize: 16 }}>
                    {formatCurrency(calc.total, form.currency)}
                  </div>
                </div>

                <div className="col-12">
                  <label className="form-label fw-semibold">Notes</label>
                  <textarea
                    className="form-control input-underline"
                    rows={3}
                    value={form.notes}
                    onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                    disabled={!isEditing}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
