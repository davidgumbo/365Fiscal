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
  { value: "none", label: "None" },
];

const TAX_SCOPES = [
  { value: "sales", label: "Sales" },
  { value: "purchases", label: "Purchases" },
  { value: "all", label: "All" },
];

const CURRENCIES = [
  { code: "USD", symbol: "$", name: "US Dollar" },
  { code: "EUR", symbol: "€", name: "Euro" },
  { code: "GBP", symbol: "£", name: "British Pound" },
  { code: "ZWL", symbol: "ZWG", name: "Zimbabwe Dollar" },
  { code: "ZAR", symbol: "R", name: "South African Rand" },
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

type POSEmployeeItem = {
  id: number;
  company_id: number;
  user_id: number | null;
  name: string;
  email: string;
  pin: string;
  role: string;
  is_active: boolean;
  sort_order: number;
};

type POSPaymentMethodItem = {
  id: number;
  company_id: number;
  name: string;
  code: string;
  is_active: boolean;
  account_info: string;
  is_default: boolean;
  sort_order: number;
};

// Icon components for professional actions
const PlusIcon = () => (
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
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
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

const TrashIcon = () => (
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
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
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

const XIcon = () => (
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
  const [passwordEdits, setPasswordEdits] = useState<Record<number, string>>(
    {},
  );
  const [admins, setAdmins] = useState<User[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [adminError, setAdminError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<{ email: string; password: string }>(
    { email: "", password: "" },
  );
  const [activeTopTab, setActiveTopTab] = useState<"general" | "users">(
    "general",
  );
  const [activeSection, setActiveSection] = useState<string>("company");
  const [showConfigureLayout, setShowConfigureLayout] = useState(false);
  const [showEditLayout, setShowEditLayout] = useState(false);
  const [companySettings, setCompanySettings] =
    useState<CompanySettings | null>(null);
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
    document_watermark_opacity: "0.08",
  });
  const [initialSettings, setInitialSettings] = useState<
    typeof settingsForm | null
  >(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Subscription status state
  type SubStatus = {
    activated: boolean;
    plan: string | null;
    status: string | null;
    expires_at: string | null;
    company_name: string | null;
  };
  const [subStatuses, setSubStatuses] = useState<SubStatus[]>([]);
  const [subLoading, setSubLoading] = useState(false);

  // POS Settings state
  const [posEmployees, setPosEmployees] = useState<POSEmployeeItem[]>([]);
  const [posPaymentMethods, setPosPaymentMethods] = useState<POSPaymentMethodItem[]>([]);
  const [posEmpForm, setPosEmpForm] = useState<Partial<POSEmployeeItem> & { name: string; pin: string; role: string }>({ name: "", pin: "", role: "cashier", email: "" });
  const [posEmpEditing, setPosEmpEditing] = useState<number | null>(null);
  const [posPmForm, setPosPmForm] = useState<{ name: string; code: string }>({ name: "", code: "cash" });
  const [posPmEditing, setPosPmEditing] = useState<number | null>(null);
  const [posError, setPosError] = useState<string | null>(null);
  const [showPinField, setShowPinField] = useState<number | null>(null);
  const [posEmpSaving, setPosEmpSaving] = useState(false);
  const [posPmSaving, setPosPmSaving] = useState(false);

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
      const changed =
        JSON.stringify(settingsForm) !== JSON.stringify(initialSettings);
      setHasUnsavedChanges(changed);
    }
  }, [settingsForm, initialSettings, activeTopTab]);

  // Load subscription status when section is opened
  useEffect(() => {
    if (activeSection === "subscription") {
      setSubLoading(true);
      apiFetch<SubStatus[]>("/subscriptions/my-status")
        .then((data) => setSubStatuses(data))
        .catch(() => setSubStatuses([]))
        .finally(() => setSubLoading(false));
    }
  }, [activeSection]);

  useEffect(() => {
    if (companies.length && companyId === null) {
      setCompanyId(companies[0].id);
    }
  }, [companies, companyId]);

  const loadTaxes = async (cid: number) => {
    const data = await apiFetch<TaxSetting[]>(
      `/tax-settings?company_id=${cid}`,
    );
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
        { method: "POST" },
      );
      setPullSuccess(
        `Successfully pulled ${result.length} ZIMRA tax(es) from device`,
      );
      if (companyId) loadTaxes(companyId);
    } catch (err: any) {
      setPullError(err.message || "Failed to pull taxes from FDMS");
    } finally {
      setPulling(false);
    }
  };

  // POS data loaders
  const loadPosEmployees = async (cid: number) => {
    try {
      const data = await apiFetch<POSEmployeeItem[]>(`/pos/employees?company_id=${cid}&include_inactive=true`);
      setPosEmployees(data);
    } catch { setPosEmployees([]); }
  };

  const loadPosPaymentMethods = async (cid: number) => {
    try {
      const data = await apiFetch<POSPaymentMethodItem[]>(`/payments/methods/list?company_id=${cid}&include_inactive=true`);
      setPosPaymentMethods(data);
    } catch { setPosPaymentMethods([]); }
  };

  const savePosEmployee = async () => {
    if (!companyId || !posEmpForm.name) return;
    setPosError(null);
    setPosEmpSaving(true);
    try {
      if (posEmpEditing) {
        await apiFetch(`/pos/employees/${posEmpEditing}`, {
          method: "PUT",
          body: JSON.stringify(posEmpForm),
        });
        setStatus("Employee updated");
      } else {
        await apiFetch("/pos/employees", {
          method: "POST",
          body: JSON.stringify({ ...posEmpForm, company_id: companyId }),
        });
        setStatus("Employee added");
      }
      setPosEmpForm({ name: "", pin: "", role: "cashier", email: "" });
      setPosEmpEditing(null);
      loadPosEmployees(companyId);
    } catch (err: any) {
      setPosError(err.message || "Failed to save employee");
    } finally {
      setPosEmpSaving(false);
    }
  };

  const deletePosEmployee = async (id: number) => {
    if (!companyId) return;
    if (!confirm("Are you sure you want to remove this employee?")) return;
    try {
      await apiFetch(`/pos/employees/${id}`, { method: "DELETE" });
      setStatus("Employee deleted");
      loadPosEmployees(companyId);
    } catch (err: any) {
      setPosError(err.message || "Failed to delete employee");
    }
  };

  const savePosPaymentMethod = async () => {
    if (!companyId || !posPmForm.name) return;
    setPosError(null);
    setPosPmSaving(true);
    try {
      if (posPmEditing) {
        await apiFetch(`/payments/methods/${posPmEditing}`, {
          method: "PUT",
          body: JSON.stringify(posPmForm),
        });
        setStatus("Payment method updated");
      } else {
        await apiFetch("/payments/methods", {
          method: "POST",
          body: JSON.stringify({ ...posPmForm, company_id: companyId }),
        });
        setStatus("Payment method added");
      }
      setPosPmForm({ name: "", code: "cash" });
      setPosPmEditing(null);
      loadPosPaymentMethods(companyId);
    } catch (err: any) {
      setPosError(err.message || "Failed to save payment method");
    } finally {
      setPosPmSaving(false);
    }
  };

  const loadCompanySettings = async (cid: number) => {
    try {
      const data = await apiFetch<CompanySettings>(
        `/company-settings?company_id=${cid}`,
      );
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
        document_watermark_opacity: data.document_watermark_opacity || "0.08",
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
        document_watermark_opacity: "0.08",
      };
      setSettingsForm(defaults);
      setInitialSettings(defaults);
      setHasUnsavedChanges(false);
    }
  };

  const saveCompanySettings = async () => {
    if (!companyId) return;
    const method = companySettings ? "PATCH" : "POST";
    const url = companySettings
      ? `/company-settings/${companySettings.id}`
      : "/company-settings";
    const payload = companySettings
      ? settingsForm
      : { ...settingsForm, company_id: companyId };

    await apiFetch(url, {
      method,
      body: JSON.stringify(payload),
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
    const layoutKey = (
      settingsForm.document_layout || "external_layout_standard"
    ).replace("external_layout_", "layout-");
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
            body { font-family: Inter, Arial, sans-serif; padding: 32px; color: var(--slate-900); background: var(--slate-50); }
            h1 { font-size: 22px; margin-bottom: 6px; }
            h2 { font-size: 16px; margin: 0; }
            .muted { color: var(--slate-500); font-size: 12px; }
            .section { margin-top: 20px; }
            .doc { padding: 24px; border-radius: 16px; background: var(--white-500); margin-bottom: 24px; }
            .layout-boxed { border: 1px solid var(--slate-200); }
            .layout-bold h1 { font-size: 26px; font-weight: 800; }
            .layout-bubble { border: 1px solid var(--slate-200); box-shadow: 0 10px 24px rgba(15, 23, 42, 0.08); }
            .layout-standard { }
            .header { display: flex; justify-content: space-between; gap: 24px; align-items: flex-start; }
            .watermark { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-size: 64px; font-weight: 700; color: var(--slate-400); opacity: ${settingsForm.document_watermark_opacity || "0.08"}; pointer-events: none; }
            .doc { position: relative; }
            .logo { height: 48px; max-width: 180px; object-fit: contain; }
            .company-block { text-align: right; }
            table { width: 100%; border-collapse: collapse; margin-top: 12px; }
            th, td { border-bottom: 1px solid var(--slate-200); padding: 8px; font-size: 12px; }
            th { text-align: left; background: var(--slate-50); }
            .totals { margin-top: 16px; width: 260px; float: right; }
            .totals div { display: flex; justify-content: space-between; margin-bottom: 6px; }
            .info-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin-top: 12px; }
            .info-card { border: 1px solid var(--slate-200); border-radius: 12px; padding: 12px; }
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
    <div className="card shadow-sm" style={{ background: "var(--slate-50)" }}>
      <div className="card-body">
        <div style={{ fontSize: 12, color: "var(--slate-500)", marginBottom: 8 }}>
          Live Preview
        </div>
        {(() => {
          const layout =
            settingsForm.document_layout || "external_layout_standard";
          const layoutKey = layout.replace("external_layout_", "");
          const baseStyle: React.CSSProperties = {
            background: "var(--white-500)",
            borderRadius: 12,
            padding: 12,
            border:
              layoutKey === "boxed" || layoutKey === "bubble"
                ? "1px solid var(--slate-200)"
                : "1px solid var(--slate-200)",
            boxShadow:
              layoutKey === "bubble"
                ? "0 10px 24px rgba(15, 23, 42, 0.08)"
                : "none",
          };
          return (
            <div
              style={{ ...baseStyle, position: "relative", overflow: "hidden" }}
            >
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
                    color: "var(--slate-400)",
                    opacity: Number(
                      settingsForm.document_watermark_opacity || "0.08",
                    ),
                    transform: "rotate(-25deg)",
                    pointerEvents: "none",
                  }}
                >
                  {settingsForm.document_watermark}
                </div>
              )}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                }}
              >
                <div>
                  {settingsForm.logo_data && (
                    <img
                      src={settingsForm.logo_data}
                      alt="Logo"
                      style={{
                        height: 32,
                        maxWidth: 120,
                        objectFit: "contain",
                      }}
                    />
                  )}
                  <div
                    style={{
                      fontWeight: layoutKey === "bold" ? 800 : 700,
                      fontSize: layoutKey === "bold" ? 16 : 14,
                    }}
                  >
                    {selectedCompany?.name || "Company"}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--slate-400)" }}>
                    {selectedCompany?.address || ""}
                  </div>
                </div>
                <div
                  style={{ textAlign: "right", fontSize: 11, color: "var(--slate-400)" }}
                >
                  <div>{selectedCompany?.email || "-"}</div>
                  <div>{selectedCompany?.phone || "-"}</div>
                  <div>VAT: {selectedCompany?.vat || "-"}</div>
                </div>
              </div>
              {settingsForm.document_header && (
                <div style={{ marginTop: 8, fontSize: 11, color: "var(--slate-500)" }}>
                  {settingsForm.document_header}
                </div>
              )}
              <div
                style={{ marginTop: 8, display: "flex", gap: 8, fontSize: 11 }}
              >
                <div
                  style={{
                    flex: 1,
                    border: "1px solid var(--slate-200)",
                    borderRadius: 8,
                    padding: 8,
                  }}
                >
                  <div style={{ fontWeight: 600 }}>Customer</div>
                  <div style={{ color: "var(--slate-400)" }}>Acme Corp</div>
                </div>
                <div
                  style={{
                    flex: 1,
                    border: "1px solid var(--slate-200)",
                    borderRadius: 8,
                    padding: 8,
                  }}
                >
                  <div style={{ fontWeight: 600 }}>Payment</div>
                  <div style={{ color: "var(--slate-400)" }}>
                    Terms: {settingsForm.payment_terms_default || "-"}
                  </div>
                </div>
              </div>
              {settingsForm.document_footer && (
                <div style={{ marginTop: 8, fontSize: 11, color: "var(--slate-500)" }}>
                  {settingsForm.document_footer}
                </div>
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
      loadPosEmployees(companyId);
      loadPosPaymentMethods(companyId);
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
      is_active: true,
    };
    const created = await apiFetch<TaxSetting>("/tax-settings", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    setSelectedTax(created);
    setShowForm(true);
    loadTaxes(companyId);
  };

  const saveTax = async () => {
    if (!selectedTax) return;
    await apiFetch(`/tax-settings/${selectedTax.id}`, {
      method: "PATCH",
      body: JSON.stringify(selectedTax),
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
      body: JSON.stringify({
        email: adminEmail,
        password: adminPassword,
        is_admin: true,
      }),
    });
    setAdminEmail("");
    setAdminPassword("");
    setStatus("Admin created");
    loadAdmins();
  };

  const updateAdmin = async (
    userId: number,
    payload: Partial<User> & { password?: string },
  ) => {
    await apiFetch(`/users/${userId}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
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
    [companies, companyId],
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
            <button
              className="primary"
              style={{ fontSize: 12, padding: "6px 12px" }}
              onClick={saveCompanySettings}
            >
              Save
            </button>
            <button
              className="outline"
              style={{ fontSize: 12, padding: "6px 12px" }}
              onClick={discardChanges}
            >
              Discard
            </button>
          </div>
        </div>
      )}

      <div className="settings-topbar">
        <div className="settings-top-left">
          <div className="settings-title">Settings</div>
        </div>
        <div className="settings-top-actions">
          <div className="settings-company-select">
            <label className="input">
              {/* Company */}
              <select
                value={companyId ?? ""}
                onChange={(e) => setCompanyId(Number(e.target.value))}
              >
                {companies.map((c: Company) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <button
            className="primary"
            onClick={saveCompanySettings}
            disabled={!hasUnsavedChanges || activeTopTab !== "general"}
          >
            Save
          </button>
          <button
            className="outline"
            onClick={discardChanges}
            disabled={!hasUnsavedChanges || activeTopTab !== "general"}
          >
            Discard
          </button>
        </div>
      </div>

      <div className="two-panel-left" style={{ margin: "1rem" }}>
        <aside className="settings-sidebar">
          <div className="settings-search">
            <input type="text" placeholder="Search..." />
          </div>
          <div className="settings-sidebar-title">General Settings</div>
          <button
            className={`settings-sidebar-item ${activeSection === "company" ? "active" : ""}`}
            onClick={() => {
              setActiveTopTab("general");
              setActiveSection("company");
            }}
          >
            Company
          </button>
          <button
            className={`settings-sidebar-item ${activeSection === "document-layout" ? "active" : ""}`}
            onClick={() => {
              setActiveTopTab("general");
              setActiveSection("document-layout");
            }}
          >
            Document Layout
          </button>
          <button
            className={`settings-sidebar-item ${activeSection === "zimra-tax" ? "active" : ""}`}
            onClick={() => {
              setActiveTopTab("general");
              setActiveSection("zimra-tax");
            }}
          >
            ZIMRA Taxes
          </button>
          <div className="settings-sidebar-title">Point of Sale</div>
          <button
            className={`settings-sidebar-item ${activeSection === "pos-settings" ? "active" : ""}`}
            onClick={() => {
              setActiveTopTab("general");
              setActiveSection("pos-settings");
            }}
          >
            POS Configuration
          </button>
          <div className="settings-sidebar-title">Users &amp; Companies</div>
          <button
            className={`settings-sidebar-item ${activeSection === (me.is_admin ? "admins" : "users-companies") ? "active" : ""}`}
            onClick={() => {
              setActiveTopTab("users");
              setActiveSection(me.is_admin ? "admins" : "users-companies");
            }}
          >
            {me.is_admin ? "Administrators" : "Users & Companies"}
          </button>
          <div className="settings-sidebar-title">Subscription</div>
          <button
            className={`settings-sidebar-item ${activeSection === "subscription" ? "active" : ""}`}
            onClick={() => {
              setActiveTopTab("general");
              setActiveSection("subscription");
            }}
          >
            My Subscription
          </button>
        </aside>
        <main className="settings-main">
          {status && (
            <div className="alert alert-success" style={{ marginBottom: 16 }}>
              {status}
              <button
                onClick={() => setStatus(null)}
                style={{
                  float: "right",
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                }}
              >
                ×
              </button>
            </div>
          )}

          {activeTopTab === "general" && (
            <>
              {activeSection === "company" && (
                <section id="company" className="settings-section">
                  <div className="settings-section-header">
                    <h4>Companies</h4>
                    <button
                      className="settings-link"
                      onClick={() => navigate("/companies")}
                    >
                      Manage Companies
                    </button>
                  </div>
                  <div className="settings-company">
                    <div className="settings-company-logo">
                      {settingsForm.logo_data ? (
                        <img src={settingsForm.logo_data} alt="Company Logo" />
                      ) : (
                        <div className="settings-logo-placeholder">Logo</div>
                      )}
                      <label className="settings-logo-upload">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) =>
                            handleLogoChange(e.target.files?.[0] ?? null)
                          }
                        />
                        Update Logo
                      </label>
                    </div>
                    <div className="settings-company-info">
                      <div className="settings-company-name">
                        {selectedCompany?.name ?? "—"}
                      </div>
                      <div className="settings-company-line">
                        {selectedCompany?.address || ""}
                      </div>
                      <div className="settings-company-line">
                        {selectedCompany?.email || ""}
                      </div>
                      <div className="settings-company-line">
                        {selectedCompany?.phone || ""}
                      </div>
                      <div className="settings-company-line">
                        VAT: {selectedCompany?.vat || "—"}
                      </div>
                      <button
                        className="settings-link"
                        onClick={() => navigate("/companies")}
                      >
                        Update Info
                      </button>
                    </div>
                  </div>
                </section>
              )}

              {activeSection === "document-layout" && (
                <section id="document-layout" className="settings-section">
                  <div className="settings-section-header">
                    <h4>Document Layout</h4>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        className="settings-btn-sm"
                        onClick={() => setShowConfigureLayout(true)}
                      >
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                        Configure
                      </button>
                      <button
                        className="settings-btn-sm"
                        onClick={() => setShowEditLayout(true)}
                      >
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                        Edit Layout
                      </button>
                      <button
                        className="settings-btn-sm"
                        onClick={previewDocument}
                      >
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                        Preview
                      </button>
                    </div>
                  </div>
                  <p className="settings-section-desc">
                    Choose the layout and content of your printed documents
                  </p>
                  <div className="settings-doc-layout">
                    <div className="settings-doc-col">
                      <div className="settings-doc-group-title">Layout</div>
                      <div className="settings-doc-fields">
                        <label className="input">
                          Layout Style
                          <select
                            value={settingsForm.document_layout}
                            onChange={(e) =>
                              setSettingsForm({
                                ...settingsForm,
                                document_layout: e.target.value,
                              })
                            }
                          >
                            <option value="external_layout_standard">
                              Standard
                            </option>
                            <option value="external_layout_boxed">Boxed</option>
                            <option value="external_layout_bold">Bold</option>
                            <option value="external_layout_bubble">
                              Bubble
                            </option>
                          </select>
                        </label>
                        <label className="input">
                          Default Payment Terms
                          <input
                            value={settingsForm.payment_terms_default}
                            onChange={(e) =>
                              setSettingsForm({
                                ...settingsForm,
                                payment_terms_default: e.target.value,
                              })
                            }
                            placeholder="e.g., Due on receipt"
                          />
                        </label>
                      </div>
                    </div>
                    <div className="settings-doc-col">
                      <div className="settings-doc-group-title">
                        Header &amp; Footer
                      </div>
                      <div className="settings-doc-fields">
                        <label className="input">
                          Header
                          <textarea
                            rows={2}
                            value={settingsForm.document_header}
                            onChange={(e) =>
                              setSettingsForm({
                                ...settingsForm,
                                document_header: e.target.value,
                              })
                            }
                            placeholder="Header text for invoices/quotations"
                          />
                        </label>
                        <label className="input">
                          Footer
                          <textarea
                            rows={2}
                            value={settingsForm.document_footer}
                            onChange={(e) =>
                              setSettingsForm({
                                ...settingsForm,
                                document_footer: e.target.value,
                              })
                            }
                            placeholder="Footer text for invoices/quotations"
                          />
                        </label>
                        <label className="input">
                          Invoice Notes
                          <textarea
                            rows={2}
                            value={settingsForm.invoice_notes}
                            onChange={(e) =>
                              setSettingsForm({
                                ...settingsForm,
                                invoice_notes: e.target.value,
                              })
                            }
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
                            onChange={(e) =>
                              setSettingsForm({
                                ...settingsForm,
                                document_watermark: e.target.value,
                              })
                            }
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
                            onChange={(e) =>
                              setSettingsForm({
                                ...settingsForm,
                                document_watermark_opacity: e.target.value,
                              })
                            }
                          />
                        </label>
                      </div>
                    </div>
                    <div className="settings-doc-preview">{previewCard()}</div>
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
                    Pull applicable taxes from a registered FDMS device. These
                    taxes will be available for selection on products in
                    Inventory.
                  </p>

                  <div
                    style={{
                      display: "flex",
                      gap: 12,
                      alignItems: "flex-end",
                      marginBottom: 16,
                    }}
                  >
                    <label className="input" style={{ flex: 1, maxWidth: 320 }}>
                      Device
                      <select
                        value={pullDeviceId ?? ""}
                        onChange={(e) =>
                          setPullDeviceId(
                            e.target.value ? Number(e.target.value) : null,
                          )
                        }
                      >
                        <option value="">— Select a device —</option>
                        {devices.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.model || "Device"} — {d.device_id} (
                            {d.serial_number})
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
                    <div
                      className="alert alert-danger"
                      style={{ marginBottom: 12 }}
                    >
                      {pullError}
                      <button
                        onClick={() => setPullError(null)}
                        style={{
                          float: "right",
                          border: "none",
                          background: "transparent",
                          cursor: "pointer",
                        }}
                      >
                        ×
                      </button>
                    </div>
                  )}
                  {pullSuccess && (
                    <div
                      className="alert alert-success"
                      style={{ marginBottom: 12 }}
                    >
                      {pullSuccess}
                      <button
                        onClick={() => setPullSuccess(null)}
                        style={{
                          float: "right",
                          border: "none",
                          background: "transparent",
                          cursor: "pointer",
                        }}
                      >
                        ×
                      </button>
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
                            <td>
                              {tax.zimra_tax_code || tax.zimra_code || "—"}
                            </td>
                            <td>{tax.zimra_valid_from || "—"}</td>
                            <td>{tax.zimra_valid_till || "—"}</td>
                            <td>
                              {tax.is_zimra_tax ? (
                                <span
                                  style={{ color: "var(--green-600)", fontWeight: 600 }}
                                >
                                  ✓
                                </span>
                              ) : (
                                <span style={{ color: "var(--slate-400)" }}>—</span>
                              )}
                            </td>
                            <td>
                              <span
                                style={{
                                  color: tax.is_active ? "var(--green-600)" : "var(--red-500)",
                                }}
                              >
                                {tax.is_active ? "Yes" : "No"}
                              </span>
                            </td>
                            <td>
                              <div style={{ display: "flex", gap: 4 }}>
                                <button
                                  className="icon-btn"
                                  title="Edit"
                                  onClick={() => {
                                    setSelectedTax(tax);
                                    setShowForm(true);
                                  }}
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
                    <div
                      style={{
                        color: "var(--slate-400)",
                        fontSize: 13,
                        padding: "12px 0",
                      }}
                    >
                      No taxes configured yet. Use "Pull ZIMRA Taxes" to fetch
                      from a registered device, or add one manually.
                    </div>
                  )}

                  <button
                    className="outline"
                    onClick={createTax}
                    style={{ marginTop: 8 }}
                  >
                    <PlusIcon /> Add Tax Manually
                  </button>
                </section>
              )}

              {/* POS Configuration */}
              {activeSection === "pos-settings" && (
                <section id="pos-settings" className="settings-section" style={{ gap: 0 }}>
                  {/* Header */}
                  <div style={{ marginBottom: 24 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--violet-600)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" /><path d="M8 21h8" /><path d="M12 17v4" /><path d="M7 8h2" /><path d="M7 12h2" /><path d="M15 8h2" /><path d="M15 12h2" /></svg>
                      <h4 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "var(--slate-800)" }}>Point of Sale Configuration</h4>
                    </div>
                    
                  </div>

                  {posError && (
                    <div style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "10px 16px", marginBottom: 20, borderRadius: 8,
                      background: "var(--red-50, #fef2f2)", border: "1px solid var(--red-200, #fecaca)",
                      color: "var(--red-700, #b91c1c)", fontSize: 13
                    }}>
                      <span>{posError}</span>
                      <button onClick={() => setPosError(null)} style={{ border: "none", background: "transparent", cursor: "pointer", color: "var(--red-400)", fontSize: 18, lineHeight: 1, padding: "0 4px" }}>×</button>
                    </div>
                  )}

                  {/* ── Employees & Login PINs Card ── */}
                  <div style={{
                    border: "1px solid var(--gray-200, #e5e7eb)", borderRadius: 10,
                    background: "var(--white-500, #fff)", marginBottom: 24, overflow: "hidden"
                  }}>
                    {/* Card header */}
                    <div style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "16px 20px", borderBottom: "1px solid var(--gray-100, #f3f4f6)",
                      background: "var(--gray-50, #f9fafb)"
                    }}>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--slate-600)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
                          <h5 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "var(--slate-700)" }}>Employees &amp; Login PINs</h5>
                        </div>
                        
                      </div>
                      <span style={{
                        padding: "3px 12px", borderRadius: 20, fontSize: 11, fontWeight: 700,
                        color: "var(--violet-700, #6d28d9)", background: "var(--violet-50, #f5f3ff)"
                      }}>
                        {posEmployees.length} {posEmployees.length === 1 ? "employee" : "employees"}
                      </span>
                    </div>

                    {/* Add / Edit form */}
                    <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--gray-100, #f3f4f6)", background: posEmpEditing ? "var(--violet-50, #f5f3ff)" : "transparent" }}>
                      {posEmpEditing && (
                        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--violet-600)", marginBottom: 8 }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ marginRight: 4 }}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                          Editing: {posEmployees.find(e => e.id === posEmpEditing)?.name}
                        </div>
                      )}
                      <div style={{ display: "grid", gridTemplateColumns: "2fr 2fr 1fr 1fr auto", gap: 10, alignItems: "end" }}>
                        <label className="input" style={{ margin: 0 }}>
                          <span style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--slate-500)" }}>Name</span>
                          <input
                            value={posEmpForm.name}
                            onChange={(e) => setPosEmpForm({ ...posEmpForm, name: e.target.value })}
                            placeholder="Employee name"
                            style={{ fontSize: 13 }}
                          />
                        </label>
                        <label className="input" style={{ margin: 0 }}>
                          <span style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--slate-500)" }}>Email</span>
                          <input
                            type="email"
                            value={posEmpForm.email || ""}
                            onChange={(e) => setPosEmpForm({ ...posEmpForm, email: e.target.value })}
                            placeholder="support@geenet.co.zw"
                            style={{ fontSize: 13 }}
                          />
                        </label>
                        <label className="input" style={{ margin: 0 }}>
                          <span style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--slate-500)" }}>PIN</span>
                          <input
                            type="password"
                            value={posEmpForm.pin}
                            onChange={(e) => {
                              const val = e.target.value.replace(/\D/g, "").slice(0, 6);
                              setPosEmpForm({ ...posEmpForm, pin: val });
                            }}
                            placeholder="4-6 digits"
                            maxLength={6}
                            style={{ fontSize: 13, letterSpacing: "2px" }}
                          />
                        </label>
                        <label className="input" style={{ margin: 0 }}>
                          <span style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--slate-500)" }}>Role</span>
                          <select
                            value={posEmpForm.role}
                            onChange={(e) => setPosEmpForm({ ...posEmpForm, role: e.target.value })}
                            style={{ fontSize: 13 }}
                          >
                            <option value="cashier">Cashier</option>
                            <option value="manager">Supervisor</option>
                            
                          </select>
                        </label>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button
                            className="primary"
                            onClick={savePosEmployee}
                            disabled={!posEmpForm.name || !posEmpForm.pin || posEmpForm.pin.length < 4 || posEmpSaving}
                            style={{ height: 36, minWidth: 80, fontSize: 13, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
                          >
                            {posEmpSaving ? (
                              <span style={{ display: "inline-block", width: 14, height: 14, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.6s linear infinite" }} />
                            ) : posEmpEditing ? (
                              <>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6L9 17l-5-5"/></svg>
                                Save
                              </>
                            ) : (
                              <><PlusIcon /> Add</>
                            )}
                          </button>
                          {posEmpEditing && (
                            <button
                              className="outline"
                              onClick={() => { setPosEmpEditing(null); setPosEmpForm({ name: "", pin: "", role: "cashier", email: "" }); }}
                              style={{ height: 36, fontSize: 13, borderRadius: 8 }}
                            >
                              Cancel
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Employee list */}
                    {posEmployees.length > 0 ? (
                      <div style={{ overflowX: "auto" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                          <thead>
                            <tr style={{ background: "var(--gray-50, #f9fafb)" }}>
                              <th style={{ padding: "10px 20px", textAlign: "left", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--slate-400)", borderBottom: "1px solid var(--gray-200)" }}>Employee</th>
                              <th style={{ padding: "10px 16px", textAlign: "left", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--slate-400)", borderBottom: "1px solid var(--gray-200)" }}>PIN</th>
                              <th style={{ padding: "10px 16px", textAlign: "left", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--slate-400)", borderBottom: "1px solid var(--gray-200)" }}>Role</th>
                              <th style={{ padding: "10px 16px", textAlign: "center", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--slate-400)", borderBottom: "1px solid var(--gray-200)" }}>Status</th>
                              <th style={{ padding: "10px 20px", textAlign: "right", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--slate-400)", borderBottom: "1px solid var(--gray-200)" }}>Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {posEmployees.map((emp, idx) => (
                              <tr key={emp.id} style={{
                                background: posEmpEditing === emp.id ? "var(--violet-50, #f5f3ff)" : idx % 2 === 0 ? "transparent" : "var(--gray-50, #f9fafb)",
                                transition: "background 150ms"
                              }}>
                                <td style={{ padding: "12px 20px", borderBottom: "1px solid var(--gray-100)" }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                    <div style={{
                                      width: 34, height: 34, borderRadius: "50%", flexShrink: 0,
                                      display: "flex", alignItems: "center", justifyContent: "center",
                                      fontSize: 13, fontWeight: 700, color: "#fff",
                                      background: emp.role === "admin" ? "var(--red-500, #ef4444)" : emp.role === "manager" ? "var(--amber-500, #f59e0b)" : "var(--blue-500, #3b82f6)"
                                    }}>
                                      {emp.name.charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                      <div style={{ fontWeight: 600, color: "var(--slate-800)" }}>{emp.name}</div>
                                      <div style={{ fontSize: 11, color: "var(--slate-400)" }}>{emp.email || "No email"}</div>
                                    </div>
                                  </div>
                                </td>
                                <td style={{ padding: "12px 16px", borderBottom: "1px solid var(--gray-100)" }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                    <code style={{
                                      background: "var(--slate-100, #f1f5f9)", padding: "3px 10px", borderRadius: 6,
                                      fontSize: 13, fontFamily: "monospace", letterSpacing: "2px", color: "var(--slate-600)"
                                    }}>
                                      {showPinField === emp.id ? emp.pin : "•".repeat(emp.pin.length || 4)}
                                    </code>
                                    <button
                                      onClick={() => setShowPinField(showPinField === emp.id ? null : emp.id)}
                                      style={{ border: "none", background: "transparent", cursor: "pointer", padding: 2, color: "var(--slate-400)", display: "flex" }}
                                      title={showPinField === emp.id ? "Hide PIN" : "Show PIN"}
                                    >
                                      {showPinField === emp.id ? (
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" /><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" /><line x1="1" y1="1" x2="23" y2="23" /></svg>
                                      ) : (
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                                      )}
                                    </button>
                                  </div>
                                </td>
                                <td style={{ padding: "12px 16px", borderBottom: "1px solid var(--gray-100)" }}>
                                  <span style={{
                                    display: "inline-flex", alignItems: "center", gap: 4,
                                    padding: "3px 12px", borderRadius: 20, fontSize: 11, fontWeight: 700, textTransform: "capitalize",
                                    color: emp.role === "admin" ? "var(--red-600, #dc2626)" : emp.role === "manager" ? "var(--amber-700, #b45309)" : "var(--blue-600, #2563eb)",
                                    background: emp.role === "admin" ? "var(--red-50, #fef2f2)" : emp.role === "manager" ? "var(--amber-50, #fffbeb)" : "var(--blue-50, #eff6ff)",
                                  }}>
                                    {emp.role === "admin" && <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/></svg>}
                                    {emp.role === "manager" && <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M12 1l3.22 6.636 7.28 1.06-5.25 5.146 1.24 7.248L12 17.77l-6.49 3.42 1.24-7.248L1.5 8.696l7.28-1.06L12 1z"/></svg>}
                                    {emp.role}
                                  </span>
                                </td>
                                <td style={{ padding: "12px 16px", textAlign: "center", borderBottom: "1px solid var(--gray-100)" }}>
                                  <label className="switch" style={{ margin: "0 auto" }}>
                                    <input
                                      type="checkbox"
                                      checked={emp.is_active}
                                      onChange={async (e) => {
                                        await apiFetch(`/pos/employees/${emp.id}`, {
                                          method: "PUT",
                                          body: JSON.stringify({ is_active: e.target.checked }),
                                        });
                                        if (companyId) loadPosEmployees(companyId);
                                      }}
                                    />
                                    <span className="slider" />
                                  </label>
                                </td>
                                <td style={{ padding: "12px 20px", textAlign: "right", borderBottom: "1px solid var(--gray-100)" }}>
                                  <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
                                    <button
                                      className="icon-btn"
                                      title="Edit employee"
                                      onClick={() => {
                                        setPosEmpEditing(emp.id);
                                        setPosEmpForm({ name: emp.name, email: emp.email, pin: emp.pin, role: emp.role });
                                      }}
                                      style={{ width: 30, height: 30, borderRadius: 6 }}
                                    >
                                      <EditIcon />
                                    </button>
                                    <button
                                      className="icon-btn"
                                      title="Delete employee"
                                      onClick={() => deletePosEmployee(emp.id)}
                                      style={{ width: 30, height: 30, borderRadius: 6, color: "var(--red-400)" }}
                                    >
                                      <TrashIcon />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div style={{ padding: "32px 20px", textAlign: "center" }}>
                        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--slate-300)" strokeWidth="1.5" strokeLinecap="round" style={{ marginBottom: 8 }}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
                        <div style={{ color: "var(--slate-400)", fontSize: 13, marginBottom: 4 }}>No POS employees configured yet</div>
                        <div style={{ color: "var(--slate-300)", fontSize: 12 }}>Add your first cashier using the form above</div>
                      </div>
                    )}
                  </div>

                  {/* ── Payment Methods Card ── */}
                  <div style={{
                    border: "1px solid var(--gray-200, #e5e7eb)", borderRadius: 10,
                    background: "var(--white-500, #fff)", overflow: "hidden"
                  }}>
                    {/* Card header */}
                    <div style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "16px 20px", borderBottom: "1px solid var(--gray-100, #f3f4f6)",
                      background: "var(--gray-50, #f9fafb)"
                    }}>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--slate-600)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" /><path d="M1 10h22" /></svg>
                          <h5 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "var(--slate-700)" }}>Payment Methods</h5>
                        </div>
                        
                      </div>
                      <span style={{
                        padding: "3px 12px", borderRadius: 20, fontSize: 11, fontWeight: 700,
                        color: "var(--green-700, #15803d)", background: "var(--green-50, #f0fdf4)"
                      }}>
                        {posPaymentMethods.length} {posPaymentMethods.length === 1 ? "method" : "methods"}
                      </span>
                    </div>

                    {/* Add / Edit form */}
                    <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--gray-100, #f3f4f6)", background: posPmEditing ? "var(--violet-50, #f5f3ff)" : "transparent" }}>
                      {posPmEditing && (
                        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--violet-600)", marginBottom: 8 }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ marginRight: 4 }}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                          Editing: {posPaymentMethods.find(p => p.id === posPmEditing)?.name}
                        </div>
                      )}
                      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr auto", gap: 10, alignItems: "end" }}>
                        <label className="input" style={{ margin: 0 }}>
                          <span style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--slate-500)" }}>Name</span>
                          <input
                            value={posPmForm.name}
                            onChange={(e) => setPosPmForm({ ...posPmForm, name: e.target.value })}
                            placeholder="e.g., Cash, Visa, EcoCash"
                            style={{ fontSize: 13 }}
                          />
                        </label>
                        <label className="input" style={{ margin: 0 }}>
                          <span style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--slate-500)" }}>Type</span>
                          <select
                            value={posPmForm.code}
                            onChange={(e) => setPosPmForm({ ...posPmForm, code: e.target.value })}
                            style={{ fontSize: 13 }}
                          >
                            <option value="cash">Cash</option>
                            <option value="card">Card</option>
                            <option value="mobile_money">Mobile Wallet</option>
                            <option value="bank_transfer">Bank Transfer</option>
                        
                          </select>
                        </label>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button
                            className="primary"
                            onClick={savePosPaymentMethod}
                            disabled={!posPmForm.name || posPmSaving}
                            style={{ height: 36, minWidth: 80, fontSize: 13, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
                          >
                            {posPmSaving ? (
                              <span style={{ display: "inline-block", width: 14, height: 14, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.6s linear infinite" }} />
                            ) : posPmEditing ? (
                              <>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6L9 17l-5-5"/></svg>
                                Save
                              </>
                            ) : (
                              <><PlusIcon /> Add</>
                            )}
                          </button>
                          {posPmEditing && (
                            <button
                              className="outline"
                              onClick={() => { setPosPmEditing(null); setPosPmForm({ name: "", code: "cash" }); }}
                              style={{ height: 36, fontSize: 13, borderRadius: 8 }}
                            >
                              Cancel
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Payment method list */}
                    {posPaymentMethods.length > 0 ? (
                      <div style={{ overflowX: "auto" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                          <thead>
                            <tr style={{ background: "var(--gray-50, #f9fafb)" }}>
                              <th style={{ padding: "10px 20px", textAlign: "left", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--slate-400)", borderBottom: "1px solid var(--gray-200)" }}>Method</th>
                              <th style={{ padding: "10px 16px", textAlign: "left", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--slate-400)", borderBottom: "1px solid var(--gray-200)" }}>Type</th>
                              <th style={{ padding: "10px 16px", textAlign: "center", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--slate-400)", borderBottom: "1px solid var(--gray-200)" }}>Default</th>
                              <th style={{ padding: "10px 16px", textAlign: "center", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--slate-400)", borderBottom: "1px solid var(--gray-200)" }}>Status</th>
                              <th style={{ padding: "10px 20px", textAlign: "right", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--slate-400)", borderBottom: "1px solid var(--gray-200)" }}>Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {posPaymentMethods.map((pm, idx) => {
                              const pmIconColors: Record<string, string> = { cash: "var(--green-600, #16a34a)", card: "var(--blue-600, #2563eb)", mobile_money: "var(--violet-600, #7c3aed)", bank_transfer: "var(--slate-600, #475569)", cheque: "var(--amber-600, #d97706)", other: "var(--slate-500, #64748b)" };
                              const pmIcons: Record<string, React.ReactNode> = {
                                cash: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="1" y="4" width="22" height="16" rx="2" /><circle cx="12" cy="12" r="3" /><path d="M2 8h2" /><path d="M20 8h2" /></svg>,
                                card: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="1" y="4" width="22" height="16" rx="2" /><path d="M1 10h22" /></svg>,
                                mobile_money: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="5" y="2" width="14" height="20" rx="2" /><path d="M12 18h.01" /></svg>,
                                bank_transfer: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 21h18" /><path d="M3 10h18" /><path d="M12 3l9 7H3l9-7z" /><path d="M6 10v8" /><path d="M10 10v8" /><path d="M14 10v8" /><path d="M18 10v8" /></svg>,
                                cheque: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /><path d="M16 13H8" /><path d="M16 17H8" /><path d="M10 9H8" /></svg>,
                                other: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /><circle cx="5" cy="12" r="1" /></svg>,
                              };
                              return (
                                <tr key={pm.id} style={{
                                  background: posPmEditing === pm.id ? "var(--violet-50, #f5f3ff)" : idx % 2 === 0 ? "transparent" : "var(--gray-50, #f9fafb)",
                                  transition: "background 150ms"
                                }}>
                                  <td style={{ padding: "12px 20px", borderBottom: "1px solid var(--gray-100)" }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                      <div style={{
                                        width: 34, height: 34, borderRadius: 8, flexShrink: 0,
                                        display: "flex", alignItems: "center", justifyContent: "center",
                                        color: pmIconColors[pm.code] || "var(--slate-500)",
                                        background: "var(--slate-100, #f1f5f9)"
                                      }}>
                                        {pmIcons[pm.code] || pmIcons.other}
                                      </div>
                                      <span style={{ fontWeight: 600, color: "var(--slate-800)" }}>{pm.name}</span>
                                    </div>
                                  </td>
                                  <td style={{ padding: "12px 16px", borderBottom: "1px solid var(--gray-100)" }}>
                                    <span style={{
                                      display: "inline-block", padding: "3px 12px", borderRadius: 20, fontSize: 11,
                                      fontWeight: 600, textTransform: "capitalize",
                                      color: "var(--slate-600)", background: "var(--slate-100, #f1f5f9)",
                                    }}>
                                      {pm.code.replace(/_/g, " ")}
                                    </span>
                                  </td>
                                  <td style={{ padding: "12px 16px", textAlign: "center", borderBottom: "1px solid var(--gray-100)" }}>
                                    {pm.is_default ? (
                                      <span style={{
                                        display: "inline-flex", alignItems: "center", gap: 4,
                                        padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700,
                                        color: "var(--green-700, #15803d)", background: "var(--green-50, #f0fdf4)"
                                      }}>
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M20 6L9 17l-5-5"/></svg>
                                        Default
                                      </span>
                                    ) : (
                                      <button
                                        onClick={async () => {
                                          await apiFetch(`/payments/methods/${pm.id}`, {
                                            method: "PUT",
                                            body: JSON.stringify({ is_default: true }),
                                          });
                                          if (companyId) loadPosPaymentMethods(companyId);
                                        }}
                                        style={{
                                          border: "1px dashed var(--slate-300)", background: "transparent",
                                          padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 500,
                                          color: "var(--slate-400)", cursor: "pointer", transition: "all 150ms"
                                        }}
                                        onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--violet-400)"; e.currentTarget.style.color = "var(--violet-500)"; }}
                                        onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--slate-300)"; e.currentTarget.style.color = "var(--slate-400)"; }}
                                      >
                                        Set default
                                      </button>
                                    )}
                                  </td>
                                  <td style={{ padding: "12px 16px", textAlign: "center", borderBottom: "1px solid var(--gray-100)" }}>
                                    <label className="switch" style={{ margin: "0 auto" }}>
                                      <input
                                        type="checkbox"
                                        checked={pm.is_active}
                                        onChange={async (e) => {
                                          await apiFetch(`/payments/methods/${pm.id}`, {
                                            method: "PUT",
                                            body: JSON.stringify({ is_active: e.target.checked }),
                                          });
                                          if (companyId) loadPosPaymentMethods(companyId);
                                        }}
                                      />
                                      <span className="slider" />
                                    </label>
                                  </td>
                                  <td style={{ padding: "12px 20px", textAlign: "right", borderBottom: "1px solid var(--gray-100)" }}>
                                    <button
                                      className="icon-btn"
                                      title="Edit payment method"
                                      onClick={() => {
                                        setPosPmEditing(pm.id);
                                        setPosPmForm({ name: pm.name, code: pm.code });
                                      }}
                                      style={{ width: 30, height: 30, borderRadius: 6 }}
                                    >
                                      <EditIcon />
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div style={{ padding: "32px 20px", textAlign: "center" }}>
                        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--slate-300)" strokeWidth="1.5" strokeLinecap="round" style={{ marginBottom: 8 }}><rect x="1" y="4" width="22" height="16" rx="2" /><path d="M1 10h22" /></svg>
                        <div style={{ color: "var(--slate-400)", fontSize: 13, marginBottom: 4 }}>No payment methods configured yet</div>
                        <div style={{ color: "var(--slate-300)", fontSize: 12 }}>Add Cash, Card, or Mobile Money above to get started</div>
                      </div>
                    )}
                  </div>
                </section>
              )}
            </>
          )}

          {activeTopTab === "users" &&
            me.is_admin &&
            activeSection === "admins" && (
              <section id="admins" className="settings-section">
                <div className="settings-section-header">
                  <h4>Administrators</h4>
                  <p className="page-sub">Manage system administrators.</p>
                </div>
                {adminError && (
                  <div
                    className="alert alert-danger"
                    style={{ marginBottom: 16 }}
                  >
                    {adminError}
                  </div>
                )}
                <div
                  className="settings-user-grid"
                  style={{ marginBottom: 16 }}
                >
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
                  <button
                    className="primary"
                    onClick={createAdmin}
                    disabled={!adminEmail || !adminPassword}
                  >
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
                              onChange={(e) =>
                                setEditForm({
                                  ...editForm,
                                  email: e.target.value,
                                })
                              }
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
                              onChange={(e) =>
                                updateAdmin(admin.id, {
                                  is_active: e.target.checked,
                                })
                              }
                            />
                            <span className="slider" />
                          </label>
                        </td>
                        <td>
                          {editingId === admin.id ? (
                            <>
                              <button
                                className="icon-btn"
                                onClick={() =>
                                  updateAdmin(admin.id, {
                                    email: editForm.email,
                                    password: editForm.password || undefined,
                                  })
                                }
                              >
                                <CheckIcon />
                              </button>
                              <button
                                className="icon-btn"
                                onClick={() => setEditingId(null)}
                              >
                                <XIcon />
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                className="icon-btn"
                                onClick={() => {
                                  setEditingId(admin.id);
                                  setEditForm({
                                    email: admin.email,
                                    password: "",
                                  });
                                }}
                              >
                                <EditIcon />
                              </button>
                              <button
                                className="icon-btn"
                                onClick={() => deleteAdmin(admin.id)}
                              >
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
            )}

          {activeTopTab === "users" &&
            !me.is_admin &&
            activeSection === "users-companies" && (
              <section id="users-companies" className="settings-section">
                <div className="settings-section-header">
                  <h4>Users &amp; Companies</h4>
                </div>
                <div className="settings-card-grid">
                  <div className="settings-card">
                    <div className="settings-card-title">Your Account</div>
                    <div className="settings-card-sub">
                      Portal user settings
                    </div>
                    <div className="input">
                      <span>Email</span>
                      <input type="email" value={me.email} readOnly />
                    </div>
                    <p className="page-sub">
                      Contact your administrator to update portal users.
                    </p>
                  </div>
                  <div className="settings-card">
                    <div className="settings-card-title">Companies</div>
                    <div className="settings-card-sub">
                      You have access to these companies
                    </div>
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

          {/* Subscription section */}
          {activeSection === "subscription" && (
            <section id="subscription" className="settings-section">
              <div className="settings-section-header">
                <h4>Subscription</h4>
                <p className="page-sub">View your subscription status and validity.</p>
              </div>
              {subLoading ? (
                <div style={{ textAlign: "center", padding: 40, color: "var(--muted)" }}>Loading subscription info...</div>
              ) : subStatuses.length === 0 ? (
                <div style={{ textAlign: "center", padding: 40, color: "var(--muted)" }}>
                  <p>No subscription information available.</p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  {subStatuses.map((s, idx) => {
                    const statusColor = s.status === "active" ? "var(--emerald-500)" : s.status === "expired" ? "var(--red-500)" : "var(--amber-500)";
                    const daysRemaining = s.expires_at ? Math.ceil((new Date(s.expires_at).getTime() - Date.now()) / 86400000) : null;
                    const daysColor = daysRemaining !== null && daysRemaining <= 30 ? "var(--red-500)" : daysRemaining !== null && daysRemaining <= 90 ? "var(--amber-500)" : "var(--emerald-500)";
                    return (
                      <div key={idx} className="settings-card" style={{ border: "1px solid var(--border)", borderRadius: 12, padding: 24 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                          <div>
                            <div className="settings-card-title" style={{ fontSize: 16 }}>{s.company_name}</div>
                            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 6 }}>
                              <span style={{
                                textTransform: "capitalize", fontSize: 14, fontWeight: 700,
                                color: s.plan === "enterprise" ? "var(--amber-500)" : s.plan === "professional" ? "var(--violet-500)" : "var(--blue-500)"
                              }}>
                                {s.plan || "—"}
                              </span>
                              <span style={{
                                display: "inline-block", padding: "2px 10px", borderRadius: 20, fontSize: 11,
                                fontWeight: 700, textTransform: "uppercase", color: "white", background: statusColor,
                              }}>
                                {s.status || (s.activated ? "active" : "none")}
                              </span>
                            </div>
                          </div>
                          {s.activated && daysRemaining !== null && (
                            <div style={{ textAlign: "right" }}>
                              <div style={{ fontSize: 28, fontWeight: 800, color: daysColor }}>{Math.max(daysRemaining, 0)}</div>
                              <div style={{ fontSize: 11, color: "var(--muted)" }}>days remaining</div>
                            </div>
                          )}
                        </div>
                        {s.activated && (
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                            <div>
                              <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 0.5 }}>Expires</div>
                              <div style={{ fontSize: 14, fontWeight: 600 }}>
                                {s.expires_at ? new Date(s.expires_at).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : "—"}
                              </div>
                            </div>
                            <div>
                              <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 0.5 }}>Status</div>
                              <div style={{ fontSize: 14, fontWeight: 600, textTransform: "capitalize" }}>{s.status}</div>
                            </div>
                          </div>
                        )}
                        {!s.activated && (
                          <div style={{ color: "var(--muted)", fontSize: 13 }}>
                            No active subscription. Contact your administrator for an activation code.
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          )}
        </main>
      </div>

      {/* Configure Document Layout Modal */}
      {showConfigureLayout && (
        <div
          className="settings-modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowConfigureLayout(false);
          }}
        >
          <div className="settings-modal">
            <div className="settings-modal-header">
              <h3>Configure Document Layout</h3>
              <button
                className="settings-modal-close"
                onClick={() => setShowConfigureLayout(false)}
              >
                ×
              </button>
            </div>
            <div className="settings-modal-body">
              <div className="settings-modal-grid">
                <label className="input">
                  Layout Style
                  <select
                    value={settingsForm.document_layout}
                    onChange={(e) =>
                      setSettingsForm({
                        ...settingsForm,
                        document_layout: e.target.value,
                      })
                    }
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
                    onChange={(e) =>
                      setSettingsForm({
                        ...settingsForm,
                        document_watermark: e.target.value,
                      })
                    }
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
                    onChange={(e) =>
                      setSettingsForm({
                        ...settingsForm,
                        document_watermark_opacity: e.target.value,
                      })
                    }
                  />
                </label>
              </div>
              <div style={{ marginTop: 20 }}>{previewCard()}</div>
            </div>
            <div className="settings-modal-footer">
              <button
                className="outline"
                onClick={() => setShowConfigureLayout(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Layout Modal */}
      {showEditLayout && (
        <div
          className="settings-modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowEditLayout(false);
          }}
        >
          <div className="settings-modal">
            <div className="settings-modal-header">
              <h3>Edit Document Layout</h3>
              <button
                className="settings-modal-close"
                onClick={() => setShowEditLayout(false)}
              >
                ×
              </button>
            </div>
            <div className="settings-modal-body">
              <div className="settings-modal-stack">
                <label className="input">
                  Document Header
                  <textarea
                    rows={2}
                    value={settingsForm.document_header}
                    onChange={(e) =>
                      setSettingsForm({
                        ...settingsForm,
                        document_header: e.target.value,
                      })
                    }
                    placeholder="Header text for invoices/quotations"
                  />
                </label>
                <label className="input">
                  Document Footer
                  <textarea
                    rows={3}
                    value={settingsForm.document_footer}
                    onChange={(e) =>
                      setSettingsForm({
                        ...settingsForm,
                        document_footer: e.target.value,
                      })
                    }
                    placeholder="Footer text for invoices/quotations"
                  />
                </label>
                <label className="input">
                  Default Payment Terms
                  <input
                    value={settingsForm.payment_terms_default}
                    onChange={(e) =>
                      setSettingsForm({
                        ...settingsForm,
                        payment_terms_default: e.target.value,
                      })
                    }
                    placeholder="e.g., Due on receipt"
                  />
                </label>
                <label className="input">
                  Invoice Notes
                  <textarea
                    rows={3}
                    value={settingsForm.invoice_notes}
                    onChange={(e) =>
                      setSettingsForm({
                        ...settingsForm,
                        invoice_notes: e.target.value,
                      })
                    }
                    placeholder="Notes shown at the bottom of invoices/quotations"
                  />
                </label>
              </div>
              <div style={{ marginTop: 20 }}>{previewCard()}</div>
            </div>
            <div className="settings-modal-footer">
              <button
                className="outline"
                onClick={() => setShowEditLayout(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {showForm && selectedTax ? (
        <div
          className="settings-modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowForm(false);
              setSelectedTax(null);
            }
          }}
        >
          <div className="settings-modal">
            <div className="settings-modal-header">
              <h3>{selectedTax.is_zimra_tax ? "ZIMRA Tax" : "Tax"}</h3>
              <button
                className="settings-modal-close"
                onClick={() => {
                  setShowForm(false);
                  setSelectedTax(null);
                }}
              >
                ×
              </button>
            </div>
            <div className="settings-modal-body">
              <div className="settings-modal-grid">
                <label className="input">
                  Tax Name
                  <input
                    value={selectedTax.name}
                    onChange={(e) =>
                      setSelectedTax({ ...selectedTax, name: e.target.value })
                    }
                  />
                </label>
                <label className="input">
                  Description
                  <input
                    value={selectedTax.description}
                    onChange={(e) =>
                      setSelectedTax({
                        ...selectedTax,
                        description: e.target.value,
                      })
                    }
                  />
                </label>
                <label className="input">
                  Tax Type
                  <select
                    value={selectedTax.tax_type}
                    onChange={(e) =>
                      setSelectedTax({
                        ...selectedTax,
                        tax_type: e.target.value,
                      })
                    }
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
                    onChange={(e) =>
                      setSelectedTax({
                        ...selectedTax,
                        tax_scope: e.target.value,
                      })
                    }
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
                    onChange={(e) =>
                      setSelectedTax({
                        ...selectedTax,
                        label_on_invoice: e.target.value,
                      })
                    }
                  />
                </label>
                <label className="input">
                  Rate (%)
                  <input
                    type="number"
                    value={selectedTax.rate}
                    onChange={(e) =>
                      setSelectedTax({
                        ...selectedTax,
                        rate: Number(e.target.value),
                      })
                    }
                  />
                </label>
                <label className="input">
                  ZIMRA Tax ID
                  <input
                    type="number"
                    value={selectedTax.zimra_tax_id ?? ""}
                    onChange={(e) =>
                      setSelectedTax({
                        ...selectedTax,
                        zimra_tax_id: e.target.value
                          ? Number(e.target.value)
                          : null,
                      })
                    }
                    placeholder="From FDMS GetConfig"
                  />
                </label>
                <label className="input">
                  ZIMRA Tax Code
                  <input
                    value={selectedTax.zimra_tax_code || ""}
                    onChange={(e) =>
                      setSelectedTax({
                        ...selectedTax,
                        zimra_tax_code: e.target.value,
                      })
                    }
                    placeholder="e.g., A, B, C"
                  />
                </label>
                <label className="input">
                  ZIMRA Code
                  <input
                    value={selectedTax.zimra_code}
                    onChange={(e) =>
                      setSelectedTax({
                        ...selectedTax,
                        zimra_code: e.target.value,
                      })
                    }
                  />
                </label>
                <label className="input">
                  Valid From
                  <input
                    type="date"
                    value={selectedTax.zimra_valid_from || ""}
                    onChange={(e) =>
                      setSelectedTax({
                        ...selectedTax,
                        zimra_valid_from: e.target.value || null,
                      })
                    }
                  />
                </label>
                <label className="input">
                  Valid Till
                  <input
                    type="date"
                    value={selectedTax.zimra_valid_till || ""}
                    onChange={(e) =>
                      setSelectedTax({
                        ...selectedTax,
                        zimra_valid_till: e.target.value || null,
                      })
                    }
                  />
                </label>
                <label className="input">
                  Active
                  <select
                    value={selectedTax.is_active ? "yes" : "no"}
                    onChange={(e) =>
                      setSelectedTax({
                        ...selectedTax,
                        is_active: e.target.value === "yes",
                      })
                    }
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
              <button
                className="outline"
                onClick={() => deleteTax(selectedTax.id)}
              >
                Delete
              </button>
              <button
                className="outline"
                onClick={() => {
                  setShowForm(false);
                  setSelectedTax(null);
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
