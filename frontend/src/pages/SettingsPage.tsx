import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../api";
import { useCompanies, Company } from "../hooks/useCompanies";
import { useMe } from "../hooks/useMe";

const TAX_TYPES = [
  { value: "sales", label: "Sales" },
  { value: "purchases", label: "Purchases" },
  { value: "none", label: "None" }
];

const TAX_SCOPES = [
  { value: "sales", label: "Sales" },
  { value: "purchases", label: "Purchases" },
  { value: "all", label: "All" }
];


const CURRENCIES = [
  { code: "USD", symbol: "$", name: "US Dollar" },
  { code: "EUR", symbol: "€", name: "Euro" },
  { code: "GBP", symbol: "£", name: "British Pound" },
  { code: "ZWL", symbol: "ZWG", name: "Zimbabwe Dollar" },
  { code: "ZAR", symbol: "R", name: "South African Rand" }
];

type User = {
  id: number;
  email: string;
  is_active: boolean;
  is_admin: boolean;
};

type TaxSetting = {
  id: number;
  company_id: number;
  name: string;
  description: string;
  tax_type: string;
  tax_scope: string;
  label_on_invoice: string;
  rate: number;
  zimra_code: string;
  is_active: boolean;
};

type CompanySettings = {
  id: number;
  company_id: number;
  currency_code: string;
  currency_symbol: string;
  currency_position: string;
  decimal_places: number;
  invoice_prefix: string;
  quotation_prefix: string;
  invoice_notes: string;
  payment_terms_default: string;
  inventory_valuation: string;
  auto_reserve_stock: boolean;
  allow_negative_stock: boolean;
  fiscal_enabled: boolean;
  fiscal_device_id: number | null;
  zimra_bp_no: string;
  zimra_tin: string;
  fiscal_auto_submit: boolean;
  default_sales_tax_id: number | null;
  default_purchase_tax_id: number | null;
  tax_included_in_price: boolean;
  logo_data: string;
  document_layout: string;
};

// Icon components for professional actions
const PlusIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

const EditIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);

const TrashIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
);


const CheckIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const XIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);


export default function SettingsPage() {
  const navigate = useNavigate();
  const { me } = useMe();
  const companies = useCompanies();
  const [companyId, setCompanyId] = useState<number | null>(null);
  const [taxes, setTaxes] = useState<TaxSetting[]>([]);
  const [selectedTax, setSelectedTax] = useState<TaxSetting | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [passwordEdits, setPasswordEdits] = useState<Record<number, string>>({});
  const [admins, setAdmins] = useState<User[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [adminError, setAdminError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<{ email: string; password: string }>({ email: "", password: "" });
  const [activeTopTab, setActiveTopTab] = useState<"general" | "users">("general");
  const [companySettings, setCompanySettings] = useState<CompanySettings | null>(null);
  const [settingsForm, setSettingsForm] = useState({
    currency_code: "USD",
    currency_symbol: "$",
    currency_position: "before",
    decimal_places: 2,
    invoice_prefix: "INV",
    quotation_prefix: "QUO",
    invoice_notes: "",
    payment_terms_default: "Due on receipt",
    inventory_valuation: "fifo",
    auto_reserve_stock: true,
    allow_negative_stock: false,
    fiscal_enabled: false,
    fiscal_device_id: null as number | null,
    zimra_bp_no: "",
    zimra_tin: "",
    fiscal_auto_submit: false,
    default_sales_tax_id: null as number | null,
    default_purchase_tax_id: null as number | null,
    tax_included_in_price: false,
    logo_data: "",
    document_layout: "external_layout_standard"
  });
  const [initialSettings, setInitialSettings] = useState<typeof settingsForm | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Default to General tab for all users; admins will also see Users tab
  useEffect(() => {
    setActiveTopTab("general");
  }, []);

  // Track changes
  useEffect(() => {
    if (initialSettings && activeTopTab === "general") {
      const changed = JSON.stringify(settingsForm) !== JSON.stringify(initialSettings);
      setHasUnsavedChanges(changed);
    }
  }, [settingsForm, initialSettings, activeTopTab]);

  useEffect(() => {
    if (companies.length && companyId === null) {
      setCompanyId(companies[0].id);
    }
  }, [companies, companyId]);

  const loadTaxes = async (cid: number) => {
    const data = await apiFetch<TaxSetting[]>(`/tax-settings?company_id=${cid}`);
    setTaxes(data);
    if (data.length && !selectedTax) {
      setSelectedTax(data[0]);
    }
  };

  const loadAdmins = async () => {
    try {
      setAdminError(null);
      const data = await apiFetch<User[]>("/users");
      setAdmins(data.filter((u) => u.is_admin));
    } catch (err: any) {
      setAdminError(err.message || "Failed to load admins");
    }
  };

  const loadCompanySettings = async (cid: number) => {
    try {
      const data = await apiFetch<CompanySettings>(`/company-settings?company_id=${cid}`);
      setCompanySettings(data);
      const formData = {
        currency_code: data.currency_code || "USD",
        currency_symbol: data.currency_symbol || "$",
        currency_position: data.currency_position || "before",
        decimal_places: data.decimal_places ?? 2,
        invoice_prefix: data.invoice_prefix || "INV",
        quotation_prefix: data.quotation_prefix || "QUO",
        invoice_notes: data.invoice_notes || "",
        payment_terms_default: data.payment_terms_default || "Due on receipt",
        inventory_valuation: data.inventory_valuation || "fifo",
        auto_reserve_stock: data.auto_reserve_stock ?? true,
        allow_negative_stock: data.allow_negative_stock ?? false,
        fiscal_enabled: data.fiscal_enabled ?? false,
        fiscal_device_id: data.fiscal_device_id ?? null,
        zimra_bp_no: data.zimra_bp_no || "",
        zimra_tin: data.zimra_tin || "",
        fiscal_auto_submit: data.fiscal_auto_submit ?? false,
        default_sales_tax_id: data.default_sales_tax_id ?? null,
        default_purchase_tax_id: data.default_purchase_tax_id ?? null,
        tax_included_in_price: data.tax_included_in_price ?? false,
        logo_data: data.logo_data || "",
        document_layout: data.document_layout || "external_layout_standard"
      };
      setSettingsForm(formData);
      setInitialSettings(formData);
      setHasUnsavedChanges(false);
    } catch (err) {
      // Settings don't exist yet, use defaults
      setCompanySettings(null);
      const defaults = {
        currency_code: "USD",
        currency_symbol: "$",
        currency_position: "before",
        decimal_places: 2,
        invoice_prefix: "INV",
        quotation_prefix: "QUO",
        invoice_notes: "",
        payment_terms_default: "Due on receipt",
        inventory_valuation: "fifo",
        auto_reserve_stock: true,
        allow_negative_stock: false,
        fiscal_enabled: false,
        fiscal_device_id: null as number | null,
        zimra_bp_no: "",
        zimra_tin: "",
        fiscal_auto_submit: false,
        default_sales_tax_id: null as number | null,
        default_purchase_tax_id: null as number | null,
        tax_included_in_price: false,
        logo_data: "",
        document_layout: "external_layout_standard"
      };
      setSettingsForm(defaults);
      setInitialSettings(defaults);
      setHasUnsavedChanges(false);
    }
  };

  const saveCompanySettings = async () => {
    if (!companyId) return;
    const method = companySettings ? "PUT" : "POST";
    const url = companySettings ? `/company-settings/${companySettings.id}` : "/company-settings";
    const payload = companySettings
      ? settingsForm
      : { ...settingsForm, company_id: companyId };
    
    await apiFetch(url, {
      method,
      body: JSON.stringify(payload)
    });
    setStatus("Settings saved successfully");
    setInitialSettings(settingsForm);
    setHasUnsavedChanges(false);
    setTimeout(() => setStatus(null), 3000);
    loadCompanySettings(companyId);
  };

  const discardChanges = () => {
    if (initialSettings) {
      setSettingsForm(initialSettings);
      setHasUnsavedChanges(false);
    }
  };

  const handleLogoChange = (file: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      setSettingsForm((prev) => ({ ...prev, logo_data: result }));
    };
    reader.readAsDataURL(file);
  };

  useEffect(() => {
    if (companyId) {
      loadTaxes(companyId);
      loadCompanySettings(companyId);
    }
  }, [companyId]);

  useEffect(() => {
    if (me?.is_admin) {
      loadAdmins();
    }
  }, [me?.is_admin]);

  const createTax = async () => {
    if (!companyId) return;
    const payload = {
      company_id: companyId,
      name: "New Tax",
      description: "",
      tax_type: "sales",
      tax_scope: "sales",
      label_on_invoice: "",
      rate: 0,
      zimra_code: "",
      is_active: true
    };
    const created = await apiFetch<TaxSetting>("/tax-settings", {
      method: "POST",
      body: JSON.stringify(payload)
    });
    setSelectedTax(created);
    setShowForm(true);
    loadTaxes(companyId);
  };

  const saveTax = async () => {
    if (!selectedTax) return;
    await apiFetch(`/tax-settings/${selectedTax.id}`, {
      method: "PUT",
      body: JSON.stringify(selectedTax)
    });
    setStatus("Tax saved");
    if (companyId) {
      loadTaxes(companyId);
    }
  };

  const deleteTax = async (taxId: number) => {
    await apiFetch(`/tax-settings/${taxId}`, { method: "DELETE" });
    setStatus("Tax deleted");
    if (companyId) {
      loadTaxes(companyId);
    }
    setSelectedTax(null);
    setShowForm(false);
  };

  const createAdmin = async () => {
    await apiFetch<User>("/users", {
      method: "POST",
      body: JSON.stringify({ email: adminEmail, password: adminPassword, is_admin: true })
    });
    setAdminEmail("");
    setAdminPassword("");
    setStatus("Admin created");
    loadAdmins();
  };

  const updateAdmin = async (userId: number, payload: Partial<User> & { password?: string }) => {
    await apiFetch(`/users/${userId}`, {
      method: "PUT",
      body: JSON.stringify(payload)
    });
    setStatus("Admin updated");
    setPasswordEdits((prev) => ({ ...prev, [userId]: "" }));
    setEditingId(null);
    loadAdmins();
  };

  const deleteAdmin = async (userId: number) => {
    await apiFetch(`/users/${userId}`, { method: "DELETE" });
    setStatus("Admin deleted");
    loadAdmins();
  };

  const formattedTaxes = useMemo(() => taxes, [taxes]);
  const selectedCompany = useMemo(
    () => companies.find((c) => c.id === companyId) || null,
    [companies, companyId]
  );

  if (!me) {
    return <div className="content">Loading...</div>;
  }

  return (
    <div className="settings-page">
      {hasUnsavedChanges && activeTopTab === "general" && (
        <div className="alert alert-warning" style={{ marginBottom: 16 }}>
          <strong>Unsaved changes</strong> — Don't forget to save your changes.
          <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
            <button className="primary" style={{ fontSize: 12, padding: "6px 12px" }} onClick={saveCompanySettings}>
              Save
            </button>
            <button className="outline" style={{ fontSize: 12, padding: "6px 12px" }} onClick={discardChanges}>
              Discard
            </button>
          </div>
        </div>
      )}

      <div className="settings-topbar">
        <div className="settings-top-left">
          <div className="settings-title">Settings</div>
          <div className="settings-top-tabs">
            <button className={`settings-tab ${activeTopTab === "general" ? "active" : ""}`} onClick={() => setActiveTopTab("general")}>General Settings</button>
            <button className={`settings-tab ${activeTopTab === "users" ? "active" : ""}`} onClick={() => setActiveTopTab("users")}>Users &amp; Companies</button>
          </div>
        </div>
        <div className="settings-top-actions">
          <button className="primary" onClick={saveCompanySettings} disabled={!hasUnsavedChanges || activeTopTab !== "general"}>Save</button>
          <button className="outline" onClick={discardChanges} disabled={!hasUnsavedChanges || activeTopTab !== "general"}>Discard</button>
        </div>
      </div>

      <div className="settings-toolbar">
        <div className="settings-search">
          <input type="text" placeholder="Search..." />
        </div>
      </div>

      <div className="settings-body">
        

        <main className="settings-main">
          {status && (
            <div className="alert alert-success" style={{ marginBottom: 16 }}>
              {status}
              <button onClick={() => setStatus(null)} style={{ float: "right", border: "none", background: "transparent", cursor: "pointer" }}>×</button>
            </div>
          )}

          {activeTopTab === "general" && (
            <>
              <div className="settings-company-select">
                <label className="input">
                  Company
                  <select value={companyId ?? ""} onChange={(e) => setCompanyId(Number(e.target.value))}>
                    {companies.map((c: Company) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <section className="settings-section">
                <div className="settings-section-header">
                  <h4>Companies</h4>
                  <button className="settings-link" onClick={() => navigate("/companies")}>Manage Companies</button>
                </div>
                <div className="settings-card-grid">
                  <div className="settings-card">
                    <div className="settings-company">
                      <div className="settings-company-logo">
                        {settingsForm.logo_data ? (
                          <img src={settingsForm.logo_data} alt="Company Logo" />
                        ) : (
                          <div className="settings-logo-placeholder">Logo</div>
                        )}
                        <label className="settings-logo-upload">
                          <input type="file" accept="image/*" onChange={(e) => handleLogoChange(e.target.files?.[0] ?? null)} />
                          Update Logo
                        </label>
                      </div>
                      <div className="settings-company-info">
                        <div className="settings-company-name">{selectedCompany?.name ?? "—"}</div>
                        <div className="settings-company-line">{selectedCompany?.address || ""}</div>
                        <div className="settings-company-line">{selectedCompany?.email || ""}</div>
                        <div className="settings-company-line">{selectedCompany?.phone || ""}</div>
                        <div className="settings-company-line">VAT: {selectedCompany?.vat || "—"}</div>
                        <button className="settings-link" onClick={() => navigate("/companies")}>Update Info</button>
                      </div>
                    </div>
                  </div>

                  <div className="settings-card">
                    <div className="settings-card-title">Document Layout</div>
                    <div className="settings-card-sub">Choose the layout of your documents</div>
                    <label className="input">
                      Layout
                      <select
                        value={settingsForm.document_layout}
                        onChange={(e) => setSettingsForm({ ...settingsForm, document_layout: e.target.value })}
                      >
                        <option value="external_layout_standard">Standard</option>
                        <option value="external_layout_boxed">Boxed</option>
                        <option value="external_layout_bold">Bold</option>
                        <option value="external_layout_bubble">Bubble</option>
                      </select>
                    </label>
                    <div className="settings-actions-inline">
                      <button className="outline" onClick={() => setStatus("Document layout editor coming soon")}>Configure Document Layout</button>
                      <button className="outline" onClick={() => setStatus("Layout editor coming soon")}>Edit Layout</button>
                      <button className="outline" onClick={() => setStatus("Preview coming soon")}>Preview Document</button>
                    </div>
                  </div>
                </div>
              </section>

            </>
          )}

          {activeTopTab === "users" && me.is_admin && (
            <>
              <div className="tax-header">
                <div>
                  <h4>Administrators</h4>
                  <p className="page-sub">Manage system administrators.</p>
                </div>
              </div>
              {adminError && (
                <div className="alert alert-danger" style={{ marginBottom: 16 }}>
                  {adminError}
                </div>
              )}
              <div className="settings-user-grid" style={{ marginBottom: 16 }}>
                <label className="input">
                  Email
                  <input
                    type="email"
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                    placeholder="admin@example.com"
                  />
                </label>
                <label className="input">
                  Password
                  <input
                    type="password"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    placeholder="••••••••"
                  />
                </label>
                <button className="primary" onClick={createAdmin} disabled={!adminEmail || !adminPassword}>
                  <PlusIcon /> Add Admin
                </button>
              </div>
              <table className="table">
                <thead>
                  <tr>
                    <th>Email</th>
                    <th>Active</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {admins.map((admin) => (
                    <tr key={admin.id}>
                      <td>
                        {editingId === admin.id ? (
                          <input
                            type="email"
                            value={editForm.email}
                            onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                          />
                        ) : (
                          admin.email
                        )}
                      </td>
                      <td>
                        <label className="switch">
                          <input
                            type="checkbox"
                            checked={admin.is_active}
                            onChange={(e) => updateAdmin(admin.id, { is_active: e.target.checked })}
                          />
                          <span className="slider" />
                        </label>
                      </td>
                      <td>
                        {editingId === admin.id ? (
                          <>
                            <button className="icon-btn" onClick={() => updateAdmin(admin.id, { email: editForm.email, password: editForm.password || undefined })}>
                              <CheckIcon />
                            </button>
                            <button className="icon-btn" onClick={() => setEditingId(null)}>
                              <XIcon />
                            </button>
                          </>
                        ) : (
                          <>
                            <button className="icon-btn" onClick={() => { setEditingId(admin.id); setEditForm({ email: admin.email, password: "" }); }}>
                              <EditIcon />
                            </button>
                            <button className="icon-btn" onClick={() => deleteAdmin(admin.id)}>
                              <TrashIcon />
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                  {!admins.length && (
                    <tr>
                      <td colSpan={3}>No administrators found</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </>
          )}

          {activeTopTab === "users" && !me.is_admin && (
            <section className="settings-section">
              <div className="settings-section-header">
                <h4>Users &amp; Companies</h4>
              </div>
              <div className="settings-card-grid">
                <div className="settings-card">
                  <div className="settings-card-title">Your Account</div>
                  <div className="settings-card-sub">Portal user settings</div>
                  <div className="input">
                    <span>Email</span>
                    <input type="email" value={me.email} readOnly />
                  </div>
                  <p className="page-sub">Contact your administrator to update portal users.</p>
                </div>
                <div className="settings-card">
                  <div className="settings-card-title">Companies</div>
                  <div className="settings-card-sub">You have access to these companies</div>
                  <ul style={{ paddingLeft: 16, margin: 0 }}>
                    {companies.map((c) => (
                      <li key={c.id} style={{ marginBottom: 6 }}>
                        <strong>{c.name}</strong> — {c.email || ""}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </section>
          )}

        </main>
      </div>

      {showForm && selectedTax ? (
        <div className="card">
          <h3>Tax</h3>
          <div className="tab-row">
            <button className="tab active">Definition</button>
            <button className="tab">Advanced Options</button>
          </div>
          <div className="form-grid">
            <label className="input">
              Tax Name
              <input
                value={selectedTax.name}
                onChange={(e) => setSelectedTax({ ...selectedTax, name: e.target.value })}
              />
            </label>
            <label className="input">
              Description
              <input
                value={selectedTax.description}
                onChange={(e) => setSelectedTax({ ...selectedTax, description: e.target.value })}
              />
            </label>
            <label className="input">
              Tax Type
              <select
                value={selectedTax.tax_type}
                onChange={(e) => setSelectedTax({ ...selectedTax, tax_type: e.target.value })}
              >
                {TAX_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="input">
              Tax Scope
              <select
                value={selectedTax.tax_scope}
                onChange={(e) => setSelectedTax({ ...selectedTax, tax_scope: e.target.value })}
              >
                {TAX_SCOPES.map((scope) => (
                  <option key={scope.value} value={scope.value}>
                    {scope.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="input">
              Label on Invoices
              <input
                value={selectedTax.label_on_invoice}
                onChange={(e) => setSelectedTax({ ...selectedTax, label_on_invoice: e.target.value })}
              />
            </label>
            <label className="input">
              Rate (%)
              <input
                type="number"
                value={selectedTax.rate}
                onChange={(e) => setSelectedTax({ ...selectedTax, rate: Number(e.target.value) })}
              />
            </label>
            <label className="input">
              ZIMRA Code
              <input
                value={selectedTax.zimra_code}
                onChange={(e) => setSelectedTax({ ...selectedTax, zimra_code: e.target.value })}
              />
            </label>
            <label className="input">
              Active
              <select
                value={selectedTax.is_active ? "yes" : "no"}
                onChange={(e) => setSelectedTax({ ...selectedTax, is_active: e.target.value === "yes" })}
              >
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </label>
          </div>
          <div style={{ marginTop: 16, display: "flex", gap: 12 }}>
            <button className="primary" onClick={saveTax}>
              Save
            </button>
            <button className="outline" onClick={() => deleteTax(selectedTax.id)}>
              Delete
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
