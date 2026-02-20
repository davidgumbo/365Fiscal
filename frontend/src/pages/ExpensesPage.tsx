import { useEffect, useMemo, useState } from "react";
import { apiFetch, apiRequest } from "../api";
import { useMe } from "../hooks/useMe";
import { useCompanies, Company } from "../hooks/useCompanies";

type Contact = {
  id: number;
  name: string;
};

type ExpenseCategory = {
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

type MainView = "expenses" | "categories";

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

/* ── SVG Icon helpers (matching Inventory) ── */
const EditIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
  </svg>
);
const TrashIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
);

export default function ExpensesPage() {
  const { me } = useMe();
  const { companies: allCompanies, loading: companiesLoading } = useCompanies();
  const isAdmin = Boolean(me?.is_admin);

  /* ── Company selection (admin) ── */
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

  /* ── Data state ── */
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* ── View state (like Inventory mainView) ── */
  const [mainView, setMainView] = useState<MainView>("expenses");
  const [subView, setSubView] = useState<"list" | "form">("list");

  /* ── List filters ── */
  const [search, setSearch] = useState("");
  const [vendorFilter, setVendorFilter] = useState<number | "">("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");

  /* ── Expense form ── */
  const [selectedExpenseId, setSelectedExpenseId] = useState<number | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isNew, setIsNew] = useState(false);
  const [saving, setSaving] = useState(false);

  /* ── Category modal ── */
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState<number | null>(null);
  const [categoryFormName, setCategoryFormName] = useState("");

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

  /* ── Data loading ── */
  const loadData = async () => {
    if (!companyId) return;
    setLoading(true);
    setError(null);
    try {
      const [contactsData, expensesData, categoriesData] = await Promise.all([
        apiFetch<Contact[]>(`/contacts?company_id=${companyId}`).catch(() => [] as Contact[]),
        apiFetch<Expense[]>(`/expenses?company_id=${companyId}`).catch(() => [] as Expense[]),
        apiFetch<ExpenseCategory[]>(`/expense-categories?company_id=${companyId}`).catch(() => [] as ExpenseCategory[]),
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

  /* ── Filtering ── */
  const filteredExpenses = useMemo(() => {
    const term = search.trim().toLowerCase();
    return expenses.filter((e) => {
      if (vendorFilter !== "" && e.vendor_id !== vendorFilter) return false;
      if (statusFilter && (e.status || "") !== statusFilter) return false;
      if (categoryFilter && (e.category || "") !== categoryFilter) return false;
      if (!term) return true;
      const vendor = contacts.find((c) => c.id === e.vendor_id)?.name?.toLowerCase() || "";
      return (
        (e.reference || "").toLowerCase().includes(term) ||
        (e.description || "").toLowerCase().includes(term) ||
        (e.category || "").toLowerCase().includes(term) ||
        vendor.includes(term)
      );
    });
  }, [expenses, search, vendorFilter, statusFilter, categoryFilter, contacts]);

  const filteredCategories = useMemo(() => {
    if (!searchQuery.trim()) return categories;
    const q = searchQuery.toLowerCase();
    return categories.filter((c) => c.name.toLowerCase().includes(q));
  }, [categories, searchQuery]);

  const categoryExpenseCount = useMemo(() => {
    const map = new Map<string, number>();
    expenses.forEach((e) => {
      const cat = e.category || "";
      map.set(cat, (map.get(cat) || 0) + 1);
    });
    return map;
  }, [expenses]);

  const selectedExpense = useMemo(
    () => expenses.find((e) => e.id === selectedExpenseId) ?? null,
    [expenses, selectedExpenseId],
  );

  useEffect(() => {
    if (selectedExpenseId && !expenses.some((e) => e.id === selectedExpenseId)) {
      setSelectedExpenseId(null);
      setIsEditing(false);
      setSubView("list");
    }
  }, [expenses, selectedExpenseId]);

  useEffect(() => {
    if (!selectedExpense) {
      setForm(emptyForm);
      setIsEditing(false);
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
  }, [selectedExpense, emptyForm]);

  /* ── Expense CRUD ── */
  const startNew = () => {
    setSelectedExpenseId(null);
    setForm({
      ...emptyForm,
      expense_date: new Date().toISOString().split("T")[0],
      currency: "USD",
      status: "posted",
    });
    setIsNew(true);
    setIsEditing(true);
    setSubView("form");
  };

  const openExpense = (id: number) => {
    setSelectedExpenseId(id);
    setIsNew(false);
    setIsEditing(false);
    setSubView("form");
  };

  const goBack = () => {
    setSubView("list");
    setSelectedExpenseId(null);
    setIsNew(false);
    setIsEditing(false);
    setForm(emptyForm);
  };

  const saveExpense = async () => {
    if (!companyId) return;
    setError(null);
    setSaving(true);
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

      if (selectedExpenseId) {
        const { company_id: _, ...updatePayload } = payload;
        const updated = await apiFetch<Expense>(`/expenses/${selectedExpenseId}`, {
          method: "PATCH",
          body: JSON.stringify(updatePayload),
        });
        await loadData();
        setSelectedExpenseId(updated.id);
        setIsEditing(false);
        setIsNew(false);
      } else {
        const created = await apiFetch<Expense>("/expenses", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        await loadData();
        setSelectedExpenseId(created.id);
        setIsEditing(false);
        setIsNew(false);
      }
    } catch (err: any) {
      setError(err.message || "Failed to save expense");
    } finally {
      setSaving(false);
    }
  };

  const deleteExpense = async (id: number) => {
    if (!confirm("Delete this expense? This cannot be undone.")) return;
    try {
      await apiRequest(`/expenses/${id}`, { method: "DELETE" });
      await loadData();
      goBack();
    } catch (err: any) {
      setError(err.message || "Failed to delete expense");
    }
  };

  /* ── Category CRUD ── */
  const openCategoryModal = (cat?: ExpenseCategory) => {
    if (cat) {
      setEditingCategoryId(cat.id);
      setCategoryFormName(cat.name);
    } else {
      setEditingCategoryId(null);
      setCategoryFormName("");
    }
    setShowCategoryModal(true);
  };

  const saveCategory = async () => {
    if (!companyId || !categoryFormName.trim()) return;
    setSaving(true);
    setError(null);
    try {
      if (editingCategoryId) {
        await apiFetch(`/expense-categories/${editingCategoryId}`, {
          method: "PATCH",
          body: JSON.stringify({ name: categoryFormName.trim() }),
        });
      } else {
        await apiFetch("/expense-categories", {
          method: "POST",
          body: JSON.stringify({ company_id: companyId, name: categoryFormName.trim() }),
        });
      }
      await loadData();
      setShowCategoryModal(false);
      setEditingCategoryId(null);
      setCategoryFormName("");
    } catch (err: any) {
      setError(err.message || "Failed to save category");
    } finally {
      setSaving(false);
    }
  };

  const deleteCategory = async (categoryId: number) => {
    if (!confirm("Delete this expense category?")) return;
    setSaving(true);
    try {
      await apiFetch(`/expense-categories/${categoryId}`, { method: "DELETE" });
      await loadData();
    } catch (err: any) {
      setError(err.message || "Failed to delete category");
    } finally {
      setSaving(false);
    }
  };

  /* ── Navigation ── */
  const goBackToCompanies = () => {
    setSelectedCompanyId(null);
    setExpenses([]);
    setContacts([]);
    setCategories([]);
    setSelectedExpenseId(null);
    setIsEditing(false);
    setSubView("list");
    setMainView("expenses");
  };

  /* ── CSV Export ── */
  const exportCSV = () => {
    const headers = ["Reference", "Date", "Vendor", "Category", "Description", "Subtotal", "VAT", "Total", "Status"];
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
  };

  /* ══════════════════════════════════════════════
     RENDER
     ══════════════════════════════════════════════ */

  if (companiesLoading && !companyId) {
    return <div className="loading-indicator">Loading companies...</div>;
  }
  if (!isAdmin && !companyId && allCompanies.length) {
    return <div className="loading-indicator">Loading companies...</div>;
  }

  /* ── Admin company picker ── */
  if (isAdmin && !companyId) {
    return (
      <div className="content">
        <div style={{ display: "flex", width: "auto", justifyContent: "space-between", marginBottom: 24 }}>
          <div className="company-search">
            <input type="text" placeholder="Search company by name, VAT, or TIN" value={companyQuery} onChange={(e) => setCompanyQuery(e.target.value)} />
          </div>
        </div>
        <p style={{ color: "var(--muted)", marginBottom: 20, fontSize: 14 }}>Select a company to manage its expenses.</p>
        <div className="device-company-grid">
          {filteredCompanies.map((c) => (
            <button key={c.id} className="device-company-card" onClick={() => setSelectedCompanyId(c.id)}>
              <div className="device-company-icon">
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="4" y="2" width="16" height="20" rx="2" ry="2" /><path d="M9 22v-4h6v4" />
                  <line x1="8" y1="6" x2="8" y2="6.01" /><line x1="16" y1="6" x2="16" y2="6.01" /><line x1="12" y1="6" x2="12" y2="6.01" />
                  <line x1="8" y1="10" x2="8" y2="10.01" /><line x1="16" y1="10" x2="16" y2="10.01" /><line x1="12" y1="10" x2="12" y2="10.01" />
                  <line x1="8" y1="14" x2="8" y2="14.01" /><line x1="16" y1="14" x2="16" y2="14.01" /><line x1="12" y1="14" x2="12" y2="14.01" />
                </svg>
              </div>
              <div className="device-company-info">
                <div className="device-company-name">{c.name}</div>
                {c.tin && <div className="device-company-detail">TIN: {c.tin}</div>}
                {c.vat && <div className="device-company-detail">VAT: {c.vat}</div>}
              </div>
              <div className="device-company-arrow">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </div>
            </button>
          ))}
          {!filteredCompanies.length && (
            <div style={{ gridColumn: "1 / -1", textAlign: "center", padding: 40, color: "var(--muted)" }}>
              {companyQuery.trim() ? "No companies match your search." : "No companies found. Create a company first."}
            </div>
          )}
        </div>
      </div>
    );
  }

  /* ═══════════════════════════════════════
     MAIN PAGE — matches Inventory structure
     ═══════════════════════════════════════ */
  return (
    <>
      {/* Admin breadcrumb */}
      {isAdmin && company && (
        <div className="o-control-panel" style={{ display: "flex", justifyContent: "space-between", marginBottom: 0, padding: "8px 16px" }}>
          <div className="o-breadcrumb">
            <span className="o-breadcrumb-item" style={{ cursor: "pointer" }} onClick={goBackToCompanies}>
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

      {error && (
        <div className="alert alert-danger alert-dismissible fade show" role="alert" style={{ margin: "8px 16px" }}>
          {error}
          <button type="button" className="btn-close" onClick={() => setError(null)} />
        </div>
      )}

      <div className="page-container" style={{ display: "flex", gap: 0, flexWrap: "nowrap" }}>
        <div id="main-content" className="two-panel two-panel-left">

          {/* ══════ MAIN SIDEBAR (like Inventory MENU) ══════ */}
          <div className="o-sidebar">
            <div className="o-sidebar-section">
              <div className="o-sidebar-title">MENU</div>
              {[
                {
                  key: "expenses" as MainView,
                  label: "EXPENSES",
                  icon: (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--blue-600)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="2" y="5" width="20" height="14" rx="2" /><line x1="2" y1="10" x2="22" y2="10" />
                    </svg>
                  ),
                },
              ].map((tab) => (
                <div
                  key={tab.key}
                  className={`o-sidebar-item ${mainView === tab.key ? "active" : ""}`}
                  onClick={() => {
                    setMainView(tab.key);
                    setSubView("list");
                    setSearchQuery("");
                    setSearch("");
                    setSelectedExpenseId(null);
                    setIsNew(false);
                    setIsEditing(false);
                  }}
                >
                  <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    {tab.icon}
                    <span style={{ letterSpacing: "0.5px", fontSize: 12, fontWeight: 500 }}>{tab.label}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* ══════ MAIN CONTENT AREA ══════ */}
          <div className="o-main">

            {/* ── Form sub-control panel (like Inventory) ── */}
            {mainView === "expenses" && subView === "form" && (
              <div className="o-control-panel" style={{ background: "var(--gray-50)", marginTop: -8 }}>
                <div className="o-control-panel-left">
                  <button className="o-btn o-btn-link" onClick={goBack}>← Back to List</button>
                  <span style={{ fontWeight: 600, marginLeft: 16 }}>
                    {isNew ? "New Expense" : selectedExpense?.reference || "Expense"}
                  </span>
                  {!isNew && selectedExpense && (
                    <span className={`badge ms-2 ${selectedExpense.status === "posted" ? "bg-info" : "bg-secondary"}`}>
                      {selectedExpense.status}
                    </span>
                  )}
                </div>
                <div className="o-control-panel-right">
                  {isEditing ? (
                    <>
                      <button className="o-btn o-btn-primary" onClick={saveExpense} disabled={saving}>
                        {saving ? "Saving..." : "Save"}
                      </button>
                      <button className="o-btn o-btn-secondary" onClick={goBack}>Discard</button>
                    </>
                  ) : (
                    <>
                      <button className="o-btn o-btn-secondary" onClick={() => setIsEditing(true)}>Edit</button>
                      {selectedExpenseId && (
                        <button className="icon-btn danger" title="Delete" onClick={() => deleteExpense(selectedExpenseId)}>
                          <TrashIcon />
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}

            {/* ── Search/Action bar (like Inventory o-control-panel) ── */}
            <div className="o-content" style={{ flexWrap: "wrap", alignContent: "flex-start", rowGap: 12 }}>

              {subView !== "form" && (
                <div className="o-control-panel" style={{ background: "var(--white-500)", height: "5rem", width: "100%", flex: "1 1 100%" }}>
                  <div className="o-control-panel-left">
                    <div className="o-searchbox">
                      <span className="o-searchbox-icon">Search</span>
                      <input
                        type="text"
                        placeholder="Search..."
                        value={mainView === "expenses" ? search : searchQuery}
                        onChange={(e) => mainView === "expenses" ? setSearch(e.target.value) : setSearchQuery(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="o-control-panel-right">
                    {mainView === "expenses" && (
                      <>
                        <button className="o-btn o-btn-secondary" onClick={exportCSV} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
                          </svg>
                          Export
                        </button>
                        <button className="o-btn o-btn-primary" onClick={startNew}>+ New Expense</button>
                      </>
                    )}
                    {mainView === "categories" && (
                      <button className="o-btn o-btn-primary" onClick={() => openCategoryModal()}>+ New Category</button>
                    )}
                  </div>
                </div>
              )}

              {/* ═══════════ EXPENSES LIST VIEW ═══════════ */}
              {mainView === "expenses" && subView === "list" && (
                <>
                  {/* Sub-sidebar for filters (like Inventory products list) */}
                  <div className="o-sidebar">
                    <div className="o-sidebar-section">
                      <div className="o-sidebar-title" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span>Categories</span>
                        <button
                          onClick={() => openCategoryModal()}
                          style={{ background: "none", border: "none", cursor: "pointer", color: "var(--indigo-500)", fontSize: 18, fontWeight: 700, lineHeight: 1 }}
                          title="Add Category"
                        >+</button>
                      </div>
                      <select
                        className="o-form-select"
                        value={categoryFilter}
                        onChange={(e) => setCategoryFilter(e.target.value)}
                      >
                        <option value="">All Expenses ({expenses.length})</option>
                        {categories.map((c) => (
                          <option key={c.id} value={c.name}>
                            {c.name} ({categoryExpenseCount.get(c.name) || 0})
                          </option>
                        ))}
                      </select>
                      {categories.length === 0 && (
                        <div style={{ paddingTop: 8, color: "var(--slate-400)", fontSize: 12 }}>
                          No expense categories yet.
                        </div>
                      )}
                    </div>

                    <div className="o-sidebar-section">
                      <div className="o-sidebar-title">Status</div>
                      {[
                        { key: "", label: "All" },
                        { key: "posted", label: "Posted" },
                        { key: "draft", label: "Draft" },
                      ].map((item) => (
                        <div
                          key={item.key || "all"}
                          className={`o-sidebar-item ${statusFilter === item.key ? "active" : ""}`}
                          onClick={() => setStatusFilter(item.key)}
                        >
                          <span>{item.label}</span>
                          <span className="o-sidebar-count">
                            {item.key === "" ? expenses.length : expenses.filter((e) => e.status === item.key).length}
                          </span>
                        </div>
                      ))}
                    </div>

                    <div className="o-sidebar-section">
                      <div className="o-sidebar-title">Vendor</div>
                      <div
                        className={`o-sidebar-item ${vendorFilter === "" ? "active" : ""}`}
                        onClick={() => setVendorFilter("")}
                      >
                        <span>All Vendors</span>
                        <span className="o-sidebar-count">{expenses.length}</span>
                      </div>
                      {contacts.slice(0, 15).map((c) => (
                        <div
                          key={c.id}
                          className={`o-sidebar-item ${vendorFilter === c.id ? "active" : ""}`}
                          onClick={() => setVendorFilter(c.id)}
                        >
                          <span>{c.name.slice(0, 20)}</span>
                          <span className="o-sidebar-count">{expenses.filter((e) => e.vendor_id === c.id).length}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Expenses table */}
                  <div className="o-main">
                    <div className="o-list-view">
                      <table className="o-list-table">
                        <thead>
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
                            <tr><td colSpan={8} style={{ textAlign: "center", padding: 40, color: "var(--muted)" }}>Loading expenses…</td></tr>
                          )}
                          {!loading && filteredExpenses.length === 0 && (
                            <tr>
                              <td colSpan={8} style={{ textAlign: "center", padding: 40 }}>
                                {expenses.length === 0 ? (
                                  <button className="o-btn o-btn-primary" onClick={startNew}>+ Create Expense</button>
                                ) : (
                                  <span style={{ color: "var(--muted)" }}>No expenses match your filters.</span>
                                )}
                              </td>
                            </tr>
                          )}
                          {filteredExpenses.map((e) => {
                            const vendorName = contacts.find((c) => c.id === e.vendor_id)?.name || "\u2014";
                            return (
                              <tr key={e.id} onClick={() => openExpense(e.id)} style={{ cursor: "pointer" }}>
                                <td style={{ fontWeight: 500 }}>{e.reference || "\u2014"}</td>
                                <td>{vendorName}</td>
                                <td>{e.category || "\u2014"}</td>
                                <td style={{ color: "var(--muted)" }}>{e.expense_date ? new Date(e.expense_date).toLocaleDateString() : "\u2014"}</td>
                                <td>
                                  <span className={`badge ${e.status === "posted" ? "bg-info" : "bg-secondary"}`}>{e.status}</span>
                                </td>
                                <td className="text-end">{formatCurrency(e.subtotal, e.currency)}</td>
                                <td className="text-end" style={{ color: "var(--muted)" }}>{formatCurrency(e.tax_amount, e.currency)}</td>
                                <td className="text-end" style={{ fontWeight: 600 }}>{formatCurrency(e.total_amount, e.currency)}</td>
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
                </>
              )}

              {/* ═══════════ EXPENSE FORM VIEW ═══════════ */}
              {mainView === "expenses" && subView === "form" && (
                <div style={{ width: "100%", padding: 16 }}>
                  <div className="card shadow-sm">
                    <div className="card-body invoice-form">
                      <div className="row g-3">
                        <div className="col-md-6">
                          <label className="form-label fw-semibold">Date</label>
                          <input className="form-control input-underline" type="date" value={form.expense_date} onChange={(e) => setForm((p) => ({ ...p, expense_date: e.target.value }))} disabled={!isEditing} />
                        </div>
                        <div className="col-md-6">
                          <label className="form-label fw-semibold">Reference</label>
                          <input className="form-control input-underline bg-light" value={form.reference} onChange={(e) => setForm((p) => ({ ...p, reference: e.target.value }))} placeholder="(auto)" disabled={!isEditing} />
                        </div>
                        <div className="col-md-6">
                          <label className="form-label fw-semibold">Vendor</label>
                          <select className="form-select input-underline" value={form.vendor_id} onChange={(e) => setForm((p) => ({ ...p, vendor_id: e.target.value ? Number(e.target.value) : "" }))} disabled={!isEditing}>
                            <option value="">— Select Vendor —</option>
                            {contacts.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
                          </select>
                        </div>
                        <div className="col-md-6">
                          <label className="form-label fw-semibold">Category</label>
                          <select className="form-select input-underline" value={form.category || ""} onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))} disabled={!isEditing}>
                            <option value="">— Select Category —</option>
                            {categories.slice().sort((a, b) => a.name.localeCompare(b.name)).map((c) => (
                              <option key={c.id} value={c.name}>{c.name}</option>
                            ))}
                          </select>
                        </div>

                        <div className="col-md-3">
                          <label className="form-label">Status</label>
                          <select className="form-select input-underline" value={form.status} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))} disabled={!isEditing}>
                            <option value="posted">Posted</option>
                            <option value="draft">Draft</option>
                          </select>
                        </div>
                        <div className="col-md-3">
                          <label className="form-label">Currency</label>
                          <input className="form-control input-underline" value={form.currency} onChange={(e) => setForm((p) => ({ ...p, currency: e.target.value }))} disabled={!isEditing} />
                        </div>
                        <div className="col-md-6">
                          <label className="form-label fw-semibold">Description</label>
                          <input className="form-control input-underline" value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} placeholder="What was the expense for?" disabled={!isEditing} />
                        </div>

                        <div className="col-12"><hr className="my-1" /></div>

                        <div className="col-md-3">
                          <label className="form-label fw-semibold">Amount (ex VAT)</label>
                          <input className="form-control input-underline" type="number" value={form.subtotal} onChange={(e) => setForm((p) => ({ ...p, subtotal: Number(e.target.value) }))} disabled={!isEditing} />
                        </div>
                        <div className="col-md-3">
                          <label className="form-label fw-semibold">VAT %</label>
                          <input className="form-control input-underline" type="number" value={form.vat_rate} onChange={(e) => setForm((p) => ({ ...p, vat_rate: Number(e.target.value) }))} disabled={!isEditing} />
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
                          <textarea className="form-control input-underline" rows={3} value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} disabled={!isEditing} />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ═══════════ EXPENSE CATEGORIES LIST (like Inventory) ═══════════ */}
              {mainView === "categories" && subView === "list" && (
                <div className="o-main" style={{ width: "100%" }}>
                  <div className="o-list-view">
                    <table className="o-list-table">
                      <thead>
                        <tr>
                          <th>Category</th>
                          <th>Expenses</th>
                          <th style={{ width: 160 }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredCategories.map((c) => (
                          <tr key={c.id}>
                            <td style={{ fontWeight: 500 }}>{c.name}</td>
                            <td>{categoryExpenseCount.get(c.name) ?? 0}</td>
                            <td>
                              <div className="action-icons">
                                <button className="icon-btn" aria-label={`Edit ${c.name}`} onClick={() => openCategoryModal(c)}>
                                  <EditIcon />
                                </button>
                                <button className="icon-btn danger" aria-label={`Delete ${c.name}`} onClick={() => deleteCategory(c.id)}>
                                  <TrashIcon />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                        {filteredCategories.length === 0 && (
                          <tr>
                            <td colSpan={3} style={{ textAlign: "center", padding: 40 }}>
                              {categories.length === 0 ? (
                                <button className="o-btn o-btn-primary" onClick={() => openCategoryModal()}>+ Create Category</button>
                              ) : (
                                <span style={{ color: "var(--muted)" }}>No categories match your search.</span>
                              )}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      </div>

      {/* ═══════════ CATEGORY MODAL (like Inventory) ═══════════ */}
      {showCategoryModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "var(--white-500, #fff)", borderRadius: 8, padding: 24, width: 400 }}>
            <h3 style={{ margin: "0 0 16px 0" }}>{editingCategoryId ? "Edit Expense Category" : "New Expense Category"}</h3>
            <div className="o-form-group">
              <label className="o-form-label">Name</label>
              <div className="o-form-field">
                <input
                  type="text"
                  className="o-form-input"
                  value={categoryFormName}
                  onChange={(e) => setCategoryFormName(e.target.value)}
                  autoFocus
                  onKeyDown={(e) => { if (e.key === "Enter") saveCategory(); }}
                />
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 24 }}>
              <button className="o-btn o-btn-secondary" onClick={() => { setShowCategoryModal(false); setEditingCategoryId(null); setCategoryFormName(""); }}>
                Cancel
              </button>
              <button className="o-btn o-btn-primary" onClick={saveCategory} disabled={saving || !categoryFormName.trim()}>
                {saving ? "Saving…" : editingCategoryId ? "Save" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
