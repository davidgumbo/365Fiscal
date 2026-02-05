import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "../api";
import { useCompanies, Company } from "../hooks/useCompanies";

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

const TAX_CALC_METHODS = [
  { value: "exclusive", label: "Tax Exclusive" },
  { value: "inclusive", label: "Tax Inclusive" }
];

const CURRENCIES = [
  { code: "USD", symbol: "$", name: "US Dollar" },
  { code: "EUR", symbol: "€", name: "Euro" },
  { code: "GBP", symbol: "£", name: "British Pound" },
  { code: "ZWL", symbol: "Z$", name: "Zimbabwe Dollar" },
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
  decimal_places: number;
  tax_calculation_method: string;
  default_tax_id: number | null;
  fiscal_enabled: boolean;
  zimra_device_id: string;
  zimra_operator_id: string;
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

const KeyIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
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

const ToggleOnIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="1" y="5" width="22" height="14" rx="7" ry="7" />
    <circle cx="16" cy="12" r="3" />
  </svg>
);

const ToggleOffIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="1" y="5" width="22" height="14" rx="7" ry="7" />
    <circle cx="8" cy="12" r="3" />
  </svg>
);

export default function SettingsPage() {
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
  const [isEditing, setIsEditing] = useState(true);
  const [activeSection, setActiveSection] = useState<"company" | "taxes" | "admins">("company");
  const [companySettings, setCompanySettings] = useState<CompanySettings | null>(null);
  const [settingsForm, setSettingsForm] = useState({
    currency_code: "USD",
    currency_symbol: "$",
    decimal_places: 2,
    tax_calculation_method: "exclusive",
    default_tax_id: null as number | null,
    fiscal_enabled: false,
    zimra_device_id: "",
    zimra_operator_id: ""
  });

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
      const data = await apiFetch<CompanySettings>(`/company-settings/${cid}`);
      setCompanySettings(data);
      setSettingsForm({
        currency_code: data.currency_code || "USD",
        currency_symbol: data.currency_symbol || "$",
        decimal_places: data.decimal_places ?? 2,
        tax_calculation_method: data.tax_calculation_method || "exclusive",
        default_tax_id: data.default_tax_id,
        fiscal_enabled: data.fiscal_enabled ?? false,
        zimra_device_id: data.zimra_device_id || "",
        zimra_operator_id: data.zimra_operator_id || ""
      });
    } catch (err) {
      // Settings don't exist yet, use defaults
      setCompanySettings(null);
    }
  };

  const saveCompanySettings = async () => {
    if (!companyId) return;
    const method = companySettings ? "PATCH" : "POST";
    const url = companySettings ? `/company-settings/${companyId}` : "/company-settings";
    const payload = companySettings
      ? settingsForm
      : { ...settingsForm, company_id: companyId };
    
    await apiFetch(url, {
      method,
      body: JSON.stringify(payload)
    });
    setStatus("Company settings saved");
    loadCompanySettings(companyId);
  };

  useEffect(() => {
    if (companyId) {
      loadTaxes(companyId);
      loadCompanySettings(companyId);
    }
  }, [companyId]);

  useEffect(() => {
    loadAdmins();
  }, []);

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
      method: "PATCH",
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
      method: "PATCH",
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

  return (
    <div className="content">
      <div className="form-view">
        <div className="form-shell">
          <div className="form-header">
            <div>
              <h3>Settings</h3>
              <div className="statusbar">
                <span className={`status-pill ${isEditing ? "active" : ""}`}>Draft</span>
                <span className={`status-pill ${!isEditing ? "active" : ""}`}>Saved</span>
              </div>
            </div>
            <div className="form-actions">
              <label className="input" style={{ marginRight: 16 }}>
                Company
                <select value={companyId ?? ""} onChange={(e) => setCompanyId(Number(e.target.value))}>
                  {companies.map((c: Company) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              {isEditing ? (
                <>
                  <button className="primary" onClick={activeSection === "company" ? saveCompanySettings : saveTax}>Save</button>
                  <button className="outline" onClick={() => setIsEditing(false)}>Discard</button>
                </>
              ) : (
                <button className="primary" onClick={() => setIsEditing(true)}>Edit</button>
              )}
            </div>
          </div>

          <div className="tab-row" style={{ marginBottom: 16 }}>
            <button className={`tab ${activeSection === "company" ? "active" : ""}`} onClick={() => setActiveSection("company")}>Company Settings</button>
            <button className={`tab ${activeSection === "taxes" ? "active" : ""}`} onClick={() => setActiveSection("taxes")}>Taxes</button>
            <button className={`tab ${activeSection === "admins" ? "active" : ""}`} onClick={() => setActiveSection("admins")}>Administrators</button>
          </div>

          {status && (
            <div className="alert alert-success" style={{ marginBottom: 16 }}>
              {status}
              <button onClick={() => setStatus(null)} style={{ float: "right", border: "none", background: "transparent" }}>×</button>
            </div>
          )}

          {activeSection === "company" && (
            <div className="form-grid">
              <label className="input">
                Currency
                <select
                  value={settingsForm.currency_code}
                  onChange={(e) => {
                    const currency = CURRENCIES.find(c => c.code === e.target.value);
                    setSettingsForm({
                      ...settingsForm,
                      currency_code: e.target.value,
                      currency_symbol: currency?.symbol || "$"
                    });
                  }}
                  disabled={!isEditing}
                >
                  {CURRENCIES.map(c => (
                    <option key={c.code} value={c.code}>{c.name} ({c.symbol})</option>
                  ))}
                </select>
              </label>
              <label className="input">
                Currency Symbol
                <input
                  type="text"
                  value={settingsForm.currency_symbol}
                  onChange={(e) => setSettingsForm({ ...settingsForm, currency_symbol: e.target.value })}
                  disabled={!isEditing}
                />
              </label>
              <label className="input">
                Decimal Places
                <input
                  type="number"
                  min="0"
                  max="6"
                  value={settingsForm.decimal_places}
                  onChange={(e) => setSettingsForm({ ...settingsForm, decimal_places: Number(e.target.value) })}
                  disabled={!isEditing}
                />
              </label>
              <label className="input">
                Tax Calculation Method
                <select
                  value={settingsForm.tax_calculation_method}
                  onChange={(e) => setSettingsForm({ ...settingsForm, tax_calculation_method: e.target.value })}
                  disabled={!isEditing}
                >
                  {TAX_CALC_METHODS.map(m => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </label>
              <label className="input">
                Default Tax
                <select
                  value={settingsForm.default_tax_id ?? ""}
                  onChange={(e) => setSettingsForm({ ...settingsForm, default_tax_id: e.target.value ? Number(e.target.value) : null })}
                  disabled={!isEditing}
                >
                  <option value="">No default</option>
                  {taxes.map(t => (
                    <option key={t.id} value={t.id}>{t.name} ({t.rate}%)</option>
                  ))}
                </select>
              </label>
              <div style={{ gridColumn: "span 2", marginTop: 16 }}>
                <h4>ZIMRA Fiscal Settings</h4>
              </div>
              <label className="input checkbox">
                <input
                  type="checkbox"
                  checked={settingsForm.fiscal_enabled}
                  onChange={(e) => setSettingsForm({ ...settingsForm, fiscal_enabled: e.target.checked })}
                  disabled={!isEditing}
                />
                Enable Fiscal Integration
              </label>
              <label className="input">
                ZIMRA Device ID
                <input
                  type="text"
                  value={settingsForm.zimra_device_id}
                  onChange={(e) => setSettingsForm({ ...settingsForm, zimra_device_id: e.target.value })}
                  disabled={!isEditing || !settingsForm.fiscal_enabled}
                />
              </label>
              <label className="input">
                ZIMRA Operator ID
                <input
                  type="text"
                  value={settingsForm.zimra_operator_id}
                  onChange={(e) => setSettingsForm({ ...settingsForm, zimra_operator_id: e.target.value })}
                  disabled={!isEditing || !settingsForm.fiscal_enabled}
                />
              </label>
            </div>
          )}

          {activeSection === "taxes" && (
            <>
              <div className="tax-header">
                <div>
                  <h4>Taxes</h4>
                  <p className="page-sub">Configure taxes for the selected company.</p>
                </div>
                <div className="tax-actions">
                  <button className="primary" onClick={createTax}>
                    New Tax
                  </button>
                </div>
              </div>
        <table className="table">
          <thead>
            <tr>
              <th>Tax Name</th>
              <th>Description</th>
              <th>Tax Type</th>
              <th>Tax Scope</th>
              <th>Label on Invoices</th>
              <th>Rate</th>
              <th>Active</th>
            </tr>
          </thead>
          <tbody>
            {formattedTaxes.map((tax) => (
              <tr
                key={tax.id}
                className={selectedTax?.id === tax.id ? "row-active" : ""}
                onClick={() => {
                  setSelectedTax(tax);
                  setShowForm(true);
                }}
              >
                <td>{tax.name}</td>
                <td>{tax.description || tax.zimra_code}</td>
                <td>{TAX_TYPES.find((t) => t.value === tax.tax_type)?.label ?? tax.tax_type}</td>
                <td>{TAX_SCOPES.find((t) => t.value === tax.tax_scope)?.label ?? tax.tax_scope}</td>
                <td>{tax.label_on_invoice || `${tax.rate}%`}</td>
                <td>{tax.rate}%</td>
                <td>
                  <label className="switch">
                    <input
                      type="checkbox"
                      checked={tax.is_active}
                      onChange={(e) => {
                        e.stopPropagation();
                        setTaxes((prev) =>
                          prev.map((item) =>
                            item.id === tax.id ? { ...item, is_active: e.target.checked } : item
                          )
                        );
                        apiFetch(`/tax-settings/${tax.id}`, {
                          method: "PATCH",
                          body: JSON.stringify({ is_active: e.target.checked })
                        });
                      }}
                    />
                    <span className="slider" />
                  </label>
                </td>
              </tr>
            ))}
            {!formattedTaxes.length ? (
              <tr>
                <td colSpan={7}>No taxes found</td>
              </tr>
            ) : null}
          </tbody>
        </table>
            </>
          )}

          {activeSection === "admins" && (
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
              <div className="form-grid" style={{ marginBottom: 16 }}>
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
        </div>
      </div>

      {showForm && selectedTax && activeSection === "taxes" ? (
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
                onChange={(e) =>
                  setSelectedTax({ ...selectedTax, rate: Number(e.target.value) })
                }
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
                onChange={(e) =>
                  setSelectedTax({ ...selectedTax, is_active: e.target.value === "yes" })
                }
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
