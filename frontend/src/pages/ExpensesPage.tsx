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
        e.reference.toLowerCase().includes(term) ||
        e.description.toLowerCase().includes(term) ||
        e.category.toLowerCase().includes(term) ||
        vendor.includes(term)
      );
    });
  }, [expenses, search, vendorFilter, statusFilter, fromDate, toDate, contacts]);

  const selectedExpense = useMemo(
    () => expenses.find((e) => e.id === selectedExpenseId) ?? null,
    [expenses, selectedExpenseId],
  );

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
    <div className="page-container">
      {error && (
        <div className="alert alert-error" style={{ marginBottom: 16 }}>
          {error}
          <button onClick={() => setError(null)} style={{ marginLeft: 8 }}>
            ×
          </button>
        </div>
      )}

      <div className="two-panel-left">
        <div className="sidebar-panel">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <h4 style={{ margin: 0 }}>Expenses List</h4>
            <button className="btn btn-secondary" onClick={startNew}>
              + New
            </button>
          </div>
          <div style={{ marginTop: 6, color: "var(--muted)", fontSize: 13 }}>
            {isAdmin && company ? `Company: ${company.name}` : "Manage company expenses"}
          </div>
          {isAdmin && companyId && (
            <div style={{ marginTop: 10 }}>
              <button className="btn btn-secondary" onClick={goBackToCompanies}>
                Change Company
              </button>
            </div>
          )}

          <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
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
              <label className="input-label">Status</label>
              <select
                className="input-field dropdown-select"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="">All</option>
                <option value="posted">Posted</option>
                <option value="draft">Draft</option>
              </select>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
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

          <div style={{ marginTop: 14, maxHeight: "600px", overflowY: "auto" }}>
            {filteredExpenses.length === 0 ? (
              <div className="empty-state-pro">
                <div style={{ color: "var(--muted)", padding: 12 }}>
                  {loading ? "Loading…" : "No expenses found."}
                </div>
              </div>
            ) : (
              filteredExpenses.map((e) => {
                const vendorName =
                  contacts.find((c) => c.id === e.vendor_id)?.name || "—";
                return (
                  <div
                    key={e.id}
                    className={`list-item ${selectedExpenseId === e.id ? "active" : ""}`}
                    onClick={() => setSelectedExpenseId(e.id)}
                  >
                    <div style={{ flex: 1 }}>
                      <div className="list-item-title">{e.reference}</div>
                      <div className="list-item-sub">
                        {toDateInputValue(e.expense_date)} • {vendorName}
                      </div>
                      <div className="list-item-sub">{e.description || e.category || "—"}</div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end" }}>
                      <span
                        className={`badge ${e.status === "posted" ? "badge-success" : "badge-secondary"}`}
                      >
                        {e.status}
                      </span>
                      <div className="money">
                        {formatCurrency(e.total_amount, e.currency)}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="form-shell-pro">
          <div className="section-header">
            <div className="section-title">
              <h3>{selectedExpenseId ? "Expense" : "New Expense"}</h3>
              <p>
                {selectedExpenseId
                  ? `ID: ${selectedExpenseId}`
                  : "Select an expense or create a new one"}
              </p>
            </div>
            <div className="toolbar-right">
              <div className="statusbar">
                <span
                  className={`badge ${form.status === "posted" ? "badge-success" : "badge-secondary"}`}
                >
                  {form.status}
                </span>
              </div>
              <button className="btn btn-secondary" onClick={startNew}>
                + New
              </button>
              {isEditing ? (
                <>
                  <button className="btn btn-primary" onClick={saveExpense} disabled={saving}>
                    {saving ? "Saving…" : "Save"}
                  </button>
                  <button
                    className="btn btn-secondary"
                    onClick={() => {
                      if (selectedExpense) {
                        setSelectedExpenseId(selectedExpense.id);
                      }
                      if (!selectedExpenseId) {
                        setForm(emptyForm);
                      }
                      setIsEditing(false);
                    }}
                  >
                    Discard
                  </button>
                </>
              ) : selectedExpenseId ? (
                <button className="btn btn-primary" onClick={() => setIsEditing(true)}>
                  Edit
                </button>
              ) : null}
              {selectedExpenseId && (
                <button className="btn btn-outline-danger btn-sm" onClick={deleteSelectedExpense}>
                  Delete
                </button>
              )}
            </div>
          </div>

          <div className="form-grid-pro">
            <div className="input-group">
              <label className="input-label">Date</label>
              <input
                className="input-field"
                type="date"
                value={form.expense_date}
                onChange={(e) => setForm((p) => ({ ...p, expense_date: e.target.value }))}
                disabled={!isEditing}
              />
            </div>

            <div className="input-group">
              <label className="input-label">Reference</label>
              <input
                className="input-field"
                value={form.reference}
                onChange={(e) => setForm((p) => ({ ...p, reference: e.target.value }))}
                placeholder="(auto)"
                disabled={!isEditing}
              />
            </div>

            <div className="input-group">
              <label className="input-label">Vendor</label>
              <select
                className="input-field dropdown-select"
                value={form.vendor_id}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    vendor_id: e.target.value ? Number(e.target.value) : "",
                  }))
                }
                disabled={!isEditing}
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
              <label className="input-label">Status</label>
              <select
                className="input-field dropdown-select"
                value={form.status}
                onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}
                disabled={!isEditing}
              >
                <option value="posted">Posted</option>
                <option value="draft">Draft</option>
              </select>
            </div>

            <div className="input-group" style={{ gridColumn: "span 2" }}>
              <label className="input-label">Category</label>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <select
                  className="input-field dropdown-select"
                  value={form.category || ""}
                  onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
                  disabled={!isEditing}
                >
                  <option value="">—</option>
                  {categories
                    .slice()
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map((c) => (
                      <option key={c.id} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                </select>
                <input
                  className="input-field"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="New category"
                  disabled={!isEditing}
                  style={{ maxWidth: 200 }}
                />
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={createCategory}
                  disabled={!isEditing || creatingCategory || !newCategoryName.trim()}
                >
                  {creatingCategory ? "Creating…" : "+ Add"}
                </button>
              </div>
            </div>

            <div className="input-group" style={{ gridColumn: "span 2" }}>
              <label className="input-label">Description</label>
              <input
                className="input-field"
                value={form.description}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                placeholder="What was the expense for?"
                disabled={!isEditing}
              />
            </div>

            <div className="input-group">
              <label className="input-label">Amount (ex VAT)</label>
              <input
                className="input-field"
                type="number"
                value={form.subtotal}
                onChange={(e) => setForm((p) => ({ ...p, subtotal: Number(e.target.value) }))}
                disabled={!isEditing}
              />
            </div>

            <div className="input-group">
              <label className="input-label">VAT %</label>
              <input
                className="input-field"
                type="number"
                value={form.vat_rate}
                onChange={(e) => setForm((p) => ({ ...p, vat_rate: Number(e.target.value) }))}
                disabled={!isEditing}
              />
            </div>

            <div className="input-group">
              <label className="input-label">Currency</label>
              <input
                className="input-field"
                value={form.currency}
                onChange={(e) => setForm((p) => ({ ...p, currency: e.target.value }))}
                disabled={!isEditing}
              />
            </div>

            <div className="input-group" style={{ gridColumn: "span 3" }}>
              <label className="input-label">Notes</label>
              <input
                className="input-field"
                value={form.notes}
                onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                disabled={!isEditing}
              />
            </div>
          </div>

          <div style={{ marginTop: 12, color: "var(--muted)", fontSize: 13 }}>
            VAT: {formatCurrency(calc.tax, form.currency)} · Total: {formatCurrency(calc.total, form.currency)}
          </div>
        </div>
      </div>
    </div>
  );
}
