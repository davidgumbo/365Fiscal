import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../api";
import { useCompanies, Company } from "../hooks/useCompanies";
import { useMe } from "../hooks/useMe";

type DeviceBasic = {
  id: number;
  device_id: string;
  serial_number: string;
  model: string;
  company_id: number;
};

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
  zimra_tax_id: number | null;
  zimra_tax_code: string;
  zimra_valid_from: string | null;
  zimra_valid_till: string | null;
  is_zimra_tax: boolean;
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
  document_header: string;
  document_footer: string;
  document_watermark: string;
  document_watermark_opacity: string;
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
  const [activeSection, setActiveSection] = useState<string>("company");
  const [showConfigureLayout, setShowConfigureLayout] = useState(false);
  const [showEditLayout, setShowEditLayout] = useState(false);
  const [companySettings, setCompanySettings] = useState<CompanySettings | null>(null);
  // Devices for ZIMRA tax pull
  const [devices, setDevices] = useState<DeviceBasic[]>([]);
  const [pullDeviceId, setPullDeviceId] = useState<number | null>(null);
  const [pulling, setPulling] = useState(false);
  const [pullError, setPullError] = useState<string | null>(null);
  const [pullSuccess, setPullSuccess] = useState<string | null>(null);
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
    document_layout: "external_layout_standard",
    document_header: "",
    document_footer: "",
    document_watermark: "",
    document_watermark_opacity: "0.08"
  });
  const [initialSettings, setInitialSettings] = useState<typeof settingsForm | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Default to General tab for all users; admins will also see Users tab
  useEffect(() => {
    setActiveTopTab("general");
  }, []);

  useEffect(() => {
    if (activeTopTab === "general") {
      setActiveSection("company");
      return;
    }
    setActiveSection(me?.is_admin ? "admins" : "users-companies");
  }, [activeTopTab, me?.is_admin]);

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

  const loadDevices = async (cid: number) => {
    try {
      const data = await apiFetch<DeviceBasic[]>(`/devices?company_id=${cid}`);
      setDevices(data);
      if (data.length) setPullDeviceId(data[0].id);
      else setPullDeviceId(null);
    } catch {
      setDevices([]);
      setPullDeviceId(null);
    }
  };

  const pullZimraTaxes = async () => {
    if (!pullDeviceId) return;
    setPulling(true);
    setPullError(null);
    setPullSuccess(null);
    try {
      const result = await apiFetch<TaxSetting[]>(
        `/tax-settings/pull-from-fdms?device_id=${pullDeviceId}`,
        { method: "POST" }
      );
      setPullSuccess(`Successfully pulled ${result.length} ZIMRA tax(es) from device`);
      if (companyId) loadTaxes(companyId);
    } catch (err: any) {
      setPullError(err.message || "Failed to pull taxes from FDMS");
    } finally {
      setPulling(false);
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
        document_layout: data.document_layout || "external_layout_standard",
        document_header: data.document_header || "",
        document_footer: data.document_footer || "",
        document_watermark: data.document_watermark || "",
        document_watermark_opacity: data.document_watermark_opacity || "0.08"
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
        document_layout: "external_layout_standard",
        document_header: "",
        document_footer: "",
        document_watermark: "",
        document_watermark_opacity: "0.08"
      };
      setSettingsForm(defaults);
      setInitialSettings(defaults);
      setHasUnsavedChanges(false);
    }
  };

  const saveCompanySettings = async () => {
    if (!companyId) return;
    const method = companySettings ? "PATCH" : "POST";
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

  const previewDocument = () => {
    const layoutKey = (settingsForm.document_layout || "external_layout_standard").replace("external_layout_", "layout-");
    const logoMarkup = settingsForm.logo_data
      ? `<img class="logo" src="${settingsForm.logo_data}" alt="Logo" />`
      : "";
    const company = selectedCompany;
    const win = window.open("", "_blank");
    if (!win) return;
    const html = `
      <html>
        <head>
          <title>Document Preview</title>
          <style>
            body { font-family: Inter, Arial, sans-serif; padding: 32px; color: #0f172a; background: #f8fafc; }
            h1 { font-size: 22px; margin-bottom: 6px; }
            h2 { font-size: 16px; margin: 0; }
            .muted { color: #64748b; font-size: 12px; }
            .section { margin-top: 20px; }
            .doc { padding: 24px; border-radius: 16px; background: #fff; margin-bottom: 24px; }
            .layout-boxed { border: 1px solid #e2e8f0; }
            .layout-bold h1 { font-size: 26px; font-weight: 800; }
            .layout-bubble { border: 1px solid #e2e8f0; box-shadow: 0 10px 24px rgba(15, 23, 42, 0.08); }
            .layout-standard { }
            .header { display: flex; justify-content: space-between; gap: 24px; align-items: flex-start; }
            .watermark { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-size: 64px; font-weight: 700; color: #94a3b8; opacity: ${settingsForm.document_watermark_opacity || "0.08"}; pointer-events: none; }
            .doc { position: relative; }
            .logo { height: 48px; max-width: 180px; object-fit: contain; }
            .company-block { text-align: right; }
            table { width: 100%; border-collapse: collapse; margin-top: 12px; }
            th, td { border-bottom: 1px solid #e2e8f0; padding: 8px; font-size: 12px; }
            th { text-align: left; background: #f8fafc; }
            .totals { margin-top: 16px; width: 260px; float: right; }
            .totals div { display: flex; justify-content: space-between; margin-bottom: 6px; }
            .info-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin-top: 12px; }
            .info-card { border: 1px solid #e2e8f0; border-radius: 12px; padding: 12px; }
          </style>
        </head>
        <body>
          <div class="doc ${layoutKey}">
            ${settingsForm.document_watermark ? `<div class="watermark">${settingsForm.document_watermark}</div>` : ""}
            <div class="header">
              <div>
                ${logoMarkup}
                <h1>${company?.name || "Company"}</h1>
                <div class="muted">${company?.address || ""}</div>
              </div>
              <div class="company-block">
                <div class="muted">Email: ${company?.email || "-"}</div>
                <div class="muted">Phone: ${company?.phone || "-"}</div>
                <div class="muted">VAT: ${company?.vat || "-"}</div>
                <div class="muted">TIN: ${company?.tin || "-"}</div>
              </div>
            </div>
            <div class="section">
              <strong>Invoice</strong>
              ${settingsForm.document_header ? `<div class="muted">${settingsForm.document_header}</div>` : ""}
              <div class="muted">Reference: INV-0001</div>
              <div class="muted">Date: ${new Date().toLocaleDateString()}</div>
              <div class="muted">Due: ${new Date().toLocaleDateString()}</div>
              <div class="muted">Currency: ${settingsForm.currency_code}</div>
            </div>
            <div class="info-grid">
              <div class="info-card">
                <strong>Customer</strong>
                <div class="muted">Acme Corp</div>
                <div class="muted">123 Sample Street</div>
                <div class="muted">Email: info@acme.test</div>
                <div class="muted">Phone: 000-000-000</div>
                <div class="muted">VAT: 0000</div>
                <div class="muted">TIN: 0000</div>
              </div>
              <div class="info-card">
                <strong>Payment</strong>
                <div class="muted">Terms: ${settingsForm.payment_terms_default || "-"}</div>
                <div class="muted">Reference: PAY-0001</div>
                <div class="muted">Status: Draft</div>
                <div class="muted">Notes: ${settingsForm.invoice_notes || "-"}</div>
              </div>
            </div>
            <div class="section">
              <table>
                <thead>
                  <tr>
                    <th>Description</th>
                    <th style="text-align:right;">Qty</th>
                    <th style="text-align:right;">Price</th>
                    <th style="text-align:right;">Tax</th>
                    <th style="text-align:right;">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Sample Item</td>
                    <td style="text-align:right;">2</td>
                    <td style="text-align:right;">100.00</td>
                    <td style="text-align:right;">15%</td>
                    <td style="text-align:right;">230.00</td>
                  </tr>
                </tbody>
              </table>
              <div class="totals">
                <div><span>Subtotal</span><span>200.00</span></div>
                <div><span>Tax</span><span>30.00</span></div>
                <div><strong>Total</strong><strong>230.00</strong></div>
              </div>
            </div>
            ${settingsForm.document_footer ? `<div class="section muted">${settingsForm.document_footer}</div>` : ""}
          </div>

          <div class="doc ${layoutKey}">
            ${settingsForm.document_watermark ? `<div class="watermark">${settingsForm.document_watermark}</div>` : ""}
            <div class="header">
              <div>
                ${logoMarkup}
                <h1>${company?.name || "Company"}</h1>
                <div class="muted">${company?.address || ""}</div>
              </div>
              <div class="company-block">
                <div class="muted">Email: ${company?.email || "-"}</div>
                <div class="muted">Phone: ${company?.phone || "-"}</div>
                <div class="muted">VAT: ${company?.vat || "-"}</div>
                <div class="muted">TIN: ${company?.tin || "-"}</div>
              </div>
            </div>
            <div class="section">
              <strong>Quotation</strong>
              ${settingsForm.document_header ? `<div class="muted">${settingsForm.document_header}</div>` : ""}
              <div class="muted">Reference: QUO-0001</div>
              <div class="muted">Date: ${new Date().toLocaleDateString()}</div>
              <div class="muted">Expires: ${new Date().toLocaleDateString()}</div>
              <div class="muted">Status: Draft</div>
            </div>
            <div class="info-grid">
              <div class="info-card">
                <strong>Customer</strong>
                <div class="muted">Acme Corp</div>
                <div class="muted">123 Sample Street</div>
                <div class="muted">Email: info@acme.test</div>
                <div class="muted">Phone: 000-000-000</div>
                <div class="muted">VAT: 0000</div>
                <div class="muted">TIN: 0000</div>
              </div>
              <div class="info-card">
                <strong>Payment</strong>
                <div class="muted">Terms: ${settingsForm.payment_terms_default || "-"}</div>
                <div class="muted">Notes: -</div>
              </div>
            </div>
            <div class="section">
              <table>
                <thead>
                  <tr>
                    <th>Description</th>
                    <th style="text-align:right;">Qty</th>
                    <th style="text-align:right;">Price</th>
                    <th style="text-align:right;">Tax</th>
                    <th style="text-align:right;">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Sample Item</td>
                    <td style="text-align:right;">1</td>
                    <td style="text-align:right;">100.00</td>
                    <td style="text-align:right;">15%</td>
                    <td style="text-align:right;">115.00</td>
                  </tr>
                </tbody>
              </table>
              <div class="totals">
                <div><strong>Total</strong><strong>115.00</strong></div>
              </div>
            </div>
            ${settingsForm.document_footer ? `<div class="section muted">${settingsForm.document_footer}</div>` : ""}
          </div>
        </body>
      </html>
    `;
    win.document.write(html);
    win.document.close();
    win.focus();
  };

  const previewCard = () => (
    <div className="card shadow-sm" style={{ background: "#f8fafc" }}>
      <div className="card-body">
        <div style={{ fontSize: 12, color: "#64748b", marginBottom: 8 }}>Live Preview</div>
        {(() => {
          const layout = settingsForm.document_layout || "external_layout_standard";
          const layoutKey = layout.replace("external_layout_", "");
          const baseStyle: React.CSSProperties = {
            background: "#fff",
            borderRadius: 12,
            padding: 12,
            border: layoutKey === "boxed" || layoutKey === "bubble" ? "1px solid #e2e8f0" : "1px solid #e2e8f0",
            boxShadow: layoutKey === "bubble" ? "0 10px 24px rgba(15, 23, 42, 0.08)" : "none"
          };
          return (
            <div style={{ ...baseStyle, position: "relative", overflow: "hidden" }}>
              {settingsForm.document_watermark && (
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 42,
                    fontWeight: 700,
                    color: "#94a3b8",
                    opacity: Number(settingsForm.document_watermark_opacity || "0.08"),
                    transform: "rotate(-25deg)",
                    pointerEvents: "none"
                  }}
                >
                  {settingsForm.document_watermark}
                </div>
              )}
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
            <div>
              {settingsForm.logo_data && (
                <img src={settingsForm.logo_data} alt="Logo" style={{ height: 32, maxWidth: 120, objectFit: "contain" }} />
              )}
              <div style={{ fontWeight: layoutKey === "bold" ? 800 : 700, fontSize: layoutKey === "bold" ? 16 : 14 }}>
                {selectedCompany?.name || "Company"}
              </div>
              <div style={{ fontSize: 11, color: "#94a3b8" }}>{selectedCompany?.address || ""}</div>
            </div>
            <div style={{ textAlign: "right", fontSize: 11, color: "#94a3b8" }}>
              <div>{selectedCompany?.email || "-"}</div>
              <div>{selectedCompany?.phone || "-"}</div>
              <div>VAT: {selectedCompany?.vat || "-"}</div>
            </div>
          </div>
          {settingsForm.document_header && (
            <div style={{ marginTop: 8, fontSize: 11, color: "#64748b" }}>{settingsForm.document_header}</div>
          )}
          <div style={{ marginTop: 8, display: "flex", gap: 8, fontSize: 11 }}>
            <div style={{ flex: 1, border: "1px solid #e2e8f0", borderRadius: 8, padding: 8 }}>
              <div style={{ fontWeight: 600 }}>Customer</div>
              <div style={{ color: "#94a3b8" }}>Acme Corp</div>
            </div>
            <div style={{ flex: 1, border: "1px solid #e2e8f0", borderRadius: 8, padding: 8 }}>
              <div style={{ fontWeight: 600 }}>Payment</div>
              <div style={{ color: "#94a3b8" }}>Terms: {settingsForm.payment_terms_default || "-"}</div>
            </div>
          </div>
          {settingsForm.document_footer && (
            <div style={{ marginTop: 8, fontSize: 11, color: "#64748b" }}>{settingsForm.document_footer}</div>
          )}
            </div>
          );
        })()}
      </div>
    </div>
  );

  useEffect(() => {
    if (companyId) {
      loadTaxes(companyId);
      loadCompanySettings(companyId);
      loadDevices(companyId);
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

      <div className="settings-content">
        <aside className="settings-sidebar">
          <div className="settings-sidebar-title">Sections</div>
          {activeTopTab === "general" && (
            <>
              <button
                className={`settings-sidebar-item ${activeSection === "company" ? "active" : ""}`}
                onClick={() => setActiveSection("company")}
              >
                Company
              </button>
              <button
                className={`settings-sidebar-item ${activeSection === "document-layout" ? "active" : ""}`}
                onClick={() => setActiveSection("document-layout")}
              >
                Document Layout
              </button>
              <button
                className={`settings-sidebar-item ${activeSection === "zimra-tax" ? "active" : ""}`}
                onClick={() => setActiveSection("zimra-tax")}
              >
                ZIMRA Taxes
              </button>
            </>
          )}
          {activeTopTab === "users" && (
            <button
              className={`settings-sidebar-item ${activeSection === (me.is_admin ? "admins" : "users-companies") ? "active" : ""}`}
              onClick={() => setActiveSection(me.is_admin ? "admins" : "users-companies")}
            >
              {me.is_admin ? "Administrators" : "Users & Companies"}
            </button>
          )}
        </aside>
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

              {activeSection === "company" && (
                <section id="company" className="settings-section">
                <div className="settings-section-header">
                  <h4>Companies</h4>
                  <button className="settings-link" onClick={() => navigate("/companies")}>Manage Companies</button>
                </div>
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
                </section>
              )}

              {activeSection === "document-layout" && (
                <section id="document-layout" className="settings-section">
                <div className="settings-section-header">
                  <h4>Document Layout</h4>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button className="settings-btn-sm" onClick={() => setShowConfigureLayout(true)}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
                      Configure
                    </button>
                    <button className="settings-btn-sm" onClick={() => setShowEditLayout(true)}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                      Edit Layout
                    </button>
                    <button className="settings-btn-sm" onClick={previewDocument}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                      Preview
                    </button>
                  </div>
                </div>
                <p className="settings-section-desc">Choose the layout and content of your printed documents</p>
                <div className="settings-doc-layout">
                  <div className="settings-doc-col">
                    <div className="settings-doc-group-title">Layout</div>
                    <div className="settings-doc-fields">
                      <label className="input">
                        Layout Style
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
                      <label className="input">
                        Default Payment Terms
                        <input
                          value={settingsForm.payment_terms_default}
                          onChange={(e) => setSettingsForm({ ...settingsForm, payment_terms_default: e.target.value })}
                          placeholder="e.g., Due on receipt"
                        />
                      </label>
                    </div>
                  </div>
                  <div className="settings-doc-col">
                    <div className="settings-doc-group-title">Header &amp; Footer</div>
                    <div className="settings-doc-fields">
                      <label className="input">
                        Header
                        <textarea
                          rows={2}
                          value={settingsForm.document_header}
                          onChange={(e) => setSettingsForm({ ...settingsForm, document_header: e.target.value })}
                          placeholder="Header text for invoices/quotations"
                        />
                      </label>
                      <label className="input">
                        Footer
                        <textarea
                          rows={2}
                          value={settingsForm.document_footer}
                          onChange={(e) => setSettingsForm({ ...settingsForm, document_footer: e.target.value })}
                          placeholder="Footer text for invoices/quotations"
                        />
                      </label>
                      <label className="input">
                        Invoice Notes
                        <textarea
                          rows={2}
                          value={settingsForm.invoice_notes}
                          onChange={(e) => setSettingsForm({ ...settingsForm, invoice_notes: e.target.value })}
                          placeholder="Notes shown at the bottom of invoices/quotations"
                        />
                      </label>
                    </div>
                  </div>
                  <div className="settings-doc-col">
                    <div className="settings-doc-group-title">Watermark</div>
                    <div className="settings-doc-fields">
                      <label className="input">
                        Text
                        <input
                          value={settingsForm.document_watermark}
                          onChange={(e) => setSettingsForm({ ...settingsForm, document_watermark: e.target.value })}
                          placeholder="e.g., PAID, DRAFT"
                        />
                      </label>
                      <label className="input">
                        Opacity
                        <input
                          type="number"
                          min="0.02"
                          max="0.3"
                          step="0.01"
                          value={settingsForm.document_watermark_opacity}
                          onChange={(e) => setSettingsForm({ ...settingsForm, document_watermark_opacity: e.target.value })}
                        />
                      </label>
                    </div>
                  </div>
                  <div className="settings-doc-preview">
                    {previewCard()}
                  </div>
                </div>
                </section>
              )}

              {/* ZIMRA Tax Configuration */}
              {activeSection === "zimra-tax" && (
                <section id="zimra-tax" className="settings-section">
                <div className="settings-section-header">
                  <h4>ZIMRA Tax Configuration</h4>
                </div>
                <p className="settings-section-desc">
                  Pull applicable taxes from a registered FDMS device. These taxes will be available for selection on products in Inventory.
                </p>

                <div style={{ display: "flex", gap: 12, alignItems: "flex-end", marginBottom: 16 }}>
                  <label className="input" style={{ flex: 1, maxWidth: 320 }}>
                    Device
                    <select
                      value={pullDeviceId ?? ""}
                      onChange={(e) => setPullDeviceId(e.target.value ? Number(e.target.value) : null)}
                    >
                      <option value="">— Select a device —</option>
                      {devices.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.model || "Device"} — {d.device_id} ({d.serial_number})
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    className="primary"
                    onClick={pullZimraTaxes}
                    disabled={pulling || !pullDeviceId}
                    style={{ height: 38 }}
                  >
                    {pulling ? "Pulling…" : "Pull ZIMRA Taxes"}
                  </button>
                </div>
                {pullError && (
                  <div className="alert alert-danger" style={{ marginBottom: 12 }}>
                    {pullError}
                    <button onClick={() => setPullError(null)} style={{ float: "right", border: "none", background: "transparent", cursor: "pointer" }}>×</button>
                  </div>
                )}
                {pullSuccess && (
                  <div className="alert alert-success" style={{ marginBottom: 12 }}>
                    {pullSuccess}
                    <button onClick={() => setPullSuccess(null)} style={{ float: "right", border: "none", background: "transparent", cursor: "pointer" }}>×</button>
                  </div>
                )}

                {taxes.length > 0 ? (
                  <table className="table" style={{ marginTop: 0 }}>
                    <thead>
                      <tr>
                        <th>Tax Name</th>
                        <th>Rate (%)</th>
                        <th>ZIMRA Tax ID</th>
                        <th>Tax Code</th>
                        <th>Valid From</th>
                        <th>Valid Till</th>
                        <th>ZIMRA</th>
                        <th>Active</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {taxes.map((tax) => (
                        <tr key={tax.id}>
                          <td>{tax.name}</td>
                          <td>{tax.rate}%</td>
                          <td>{tax.zimra_tax_id ?? "—"}</td>
                          <td>{tax.zimra_tax_code || tax.zimra_code || "—"}</td>
                          <td>{tax.zimra_valid_from || "—"}</td>
                          <td>{tax.zimra_valid_till || "—"}</td>
                          <td>
                            {tax.is_zimra_tax ? (
                              <span style={{ color: "#16a34a", fontWeight: 600 }}>✓</span>
                            ) : (
                              <span style={{ color: "#94a3b8" }}>—</span>
                            )}
                          </td>
                          <td>
                            <span style={{ color: tax.is_active ? "#16a34a" : "#ef4444" }}>
                              {tax.is_active ? "Yes" : "No"}
                            </span>
                          </td>
                          <td>
                            <div style={{ display: "flex", gap: 4 }}>
                              <button
                                className="icon-btn"
                                title="Edit"
                                onClick={() => { setSelectedTax(tax); setShowForm(true); }}
                              >
                                <EditIcon />
                              </button>
                              <button
                                className="icon-btn"
                                title="Delete"
                                onClick={() => deleteTax(tax.id)}
                              >
                                <TrashIcon />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div style={{ color: "#94a3b8", fontSize: 13, padding: "12px 0" }}>
                    No taxes configured yet. Use "Pull ZIMRA Taxes" to fetch from a registered device, or add one manually.
                  </div>
                )}

                <button className="outline" onClick={createTax} style={{ marginTop: 8 }}>
                  <PlusIcon /> Add Tax Manually
                </button>
                </section>
              )}

            </>
          )}

          {activeTopTab === "users" && me.is_admin && (
            activeSection === "admins" && (
              <section id="admins" className="settings-section">
                <div className="settings-section-header">
                  <h4>Administrators</h4>
                  <p className="page-sub">Manage system administrators.</p>
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
              </section>
            )
          )}

          {activeTopTab === "users" && !me.is_admin && (
            activeSection === "users-companies" && (
              <section id="users-companies" className="settings-section">
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
            )
          )}

        </main>
      </div>

      {/* Configure Document Layout Modal */}
      {showConfigureLayout && (
        <div className="settings-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowConfigureLayout(false); }}>
          <div className="settings-modal">
            <div className="settings-modal-header">
              <h3>Configure Document Layout</h3>
              <button className="settings-modal-close" onClick={() => setShowConfigureLayout(false)}>×</button>
            </div>
            <div className="settings-modal-body">
              <div className="settings-modal-grid">
                <label className="input">
                  Layout Style
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
                <label className="input">
                  Watermark Text
                  <input
                    value={settingsForm.document_watermark}
                    onChange={(e) => setSettingsForm({ ...settingsForm, document_watermark: e.target.value })}
                    placeholder="e.g., PAID, DRAFT"
                  />
                </label>
                <label className="input">
                  Watermark Opacity
                  <input
                    type="number"
                    min="0.02"
                    max="0.3"
                    step="0.01"
                    value={settingsForm.document_watermark_opacity}
                    onChange={(e) => setSettingsForm({ ...settingsForm, document_watermark_opacity: e.target.value })}
                  />
                </label>
              </div>
              <div style={{ marginTop: 20 }}>{previewCard()}</div>
            </div>
            <div className="settings-modal-footer">
              <button className="outline" onClick={() => setShowConfigureLayout(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Layout Modal */}
      {showEditLayout && (
        <div className="settings-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowEditLayout(false); }}>
          <div className="settings-modal">
            <div className="settings-modal-header">
              <h3>Edit Document Layout</h3>
              <button className="settings-modal-close" onClick={() => setShowEditLayout(false)}>×</button>
            </div>
            <div className="settings-modal-body">
              <div className="settings-modal-stack">
                <label className="input">
                  Document Header
                  <textarea
                    rows={2}
                    value={settingsForm.document_header}
                    onChange={(e) => setSettingsForm({ ...settingsForm, document_header: e.target.value })}
                    placeholder="Header text for invoices/quotations"
                  />
                </label>
                <label className="input">
                  Document Footer
                  <textarea
                    rows={3}
                    value={settingsForm.document_footer}
                    onChange={(e) => setSettingsForm({ ...settingsForm, document_footer: e.target.value })}
                    placeholder="Footer text for invoices/quotations"
                  />
                </label>
                <label className="input">
                  Default Payment Terms
                  <input
                    value={settingsForm.payment_terms_default}
                    onChange={(e) => setSettingsForm({ ...settingsForm, payment_terms_default: e.target.value })}
                    placeholder="e.g., Due on receipt"
                  />
                </label>
                <label className="input">
                  Invoice Notes
                  <textarea
                    rows={3}
                    value={settingsForm.invoice_notes}
                    onChange={(e) => setSettingsForm({ ...settingsForm, invoice_notes: e.target.value })}
                    placeholder="Notes shown at the bottom of invoices/quotations"
                  />
                </label>
              </div>
              <div style={{ marginTop: 20 }}>{previewCard()}</div>
            </div>
            <div className="settings-modal-footer">
              <button className="outline" onClick={() => setShowEditLayout(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {showForm && selectedTax ? (
        <div className="settings-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) { setShowForm(false); setSelectedTax(null); } }}>
          <div className="settings-modal">
            <div className="settings-modal-header">
              <h3>{selectedTax.is_zimra_tax ? "ZIMRA Tax" : "Tax"}</h3>
              <button className="settings-modal-close" onClick={() => { setShowForm(false); setSelectedTax(null); }}>×</button>
            </div>
            <div className="settings-modal-body">
              <div className="settings-modal-grid">
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
                  ZIMRA Tax ID
                  <input
                    type="number"
                    value={selectedTax.zimra_tax_id ?? ""}
                    onChange={(e) => setSelectedTax({ ...selectedTax, zimra_tax_id: e.target.value ? Number(e.target.value) : null })}
                    placeholder="From FDMS GetConfig"
                  />
                </label>
                <label className="input">
                  ZIMRA Tax Code
                  <input
                    value={selectedTax.zimra_tax_code || ""}
                    onChange={(e) => setSelectedTax({ ...selectedTax, zimra_tax_code: e.target.value })}
                    placeholder="e.g., A, B, C"
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
                  Valid From
                  <input
                    type="date"
                    value={selectedTax.zimra_valid_from || ""}
                    onChange={(e) => setSelectedTax({ ...selectedTax, zimra_valid_from: e.target.value || null })}
                  />
                </label>
                <label className="input">
                  Valid Till
                  <input
                    type="date"
                    value={selectedTax.zimra_valid_till || ""}
                    onChange={(e) => setSelectedTax({ ...selectedTax, zimra_valid_till: e.target.value || null })}
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
            </div>
            <div className="settings-modal-footer">
              <button className="primary" onClick={saveTax}>
                Save
              </button>
              <button className="outline" onClick={() => deleteTax(selectedTax.id)}>
                Delete
              </button>
              <button className="outline" onClick={() => { setShowForm(false); setSelectedTax(null); }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
