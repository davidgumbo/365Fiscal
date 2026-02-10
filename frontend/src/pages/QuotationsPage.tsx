import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { apiFetch } from "../api";
import { useCompanies, Company } from "../hooks/useCompanies";

type Contact = { id: number; name: string };

type Product = { id: number; name: string; sale_price: number; tax_rate: number; uom?: string };

type Warehouse = { id: number; name: string };

type Location = { id: number; name: string; warehouse_id: number };

type CompanySettings = {
  logo_data: string;
  document_layout: string;
  invoice_notes?: string;
  payment_terms_default?: string;
  document_header?: string;
  document_footer?: string;
  document_watermark?: string;
  document_watermark_opacity?: string;
};

type QuotationLine = {
  id?: number;
  product_id: number | null;
  description: string;
  quantity: number;
  uom: string;
  unit_price: number;
  vat_rate: number;
};

type Quotation = {
  id: number;
  customer_id: number;
  reference: string;
  status: string;
  payment_terms: string;
  expires_at: string | null;
  lines: QuotationLine[];
};

const emptyLine = (): QuotationLine => ({
  product_id: null,
  description: "",
  quantity: 1,
  uom: "Units",
  unit_price: 0,
  vat_rate: 0
});

const normalizeUom = (value: string) => (value === "PCS" ? "Units" : value);

type QuotationsPageMode = "list" | "new" | "detail";

export default function QuotationsPage({ mode = "list" }: { mode?: QuotationsPageMode }) {
  const navigate = useNavigate();
  const { quotationId } = useParams();
  const routeQuotationId = quotationId ? Number(quotationId) : null;
  const companies = useCompanies();
  const [companyId, setCompanyId] = useState<number | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [companySettings, setCompanySettings] = useState<CompanySettings | null>(null);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [productWarehouseId, setProductWarehouseId] = useState<number | null>(null);
  const [productLocationId, setProductLocationId] = useState<number | null>(null);
  const [createProductOpen, setCreateProductOpen] = useState(false);
  const [productName, setProductName] = useState("");
  const [productPrice, setProductPrice] = useState("");
  const [productTaxRate, setProductTaxRate] = useState("");
  const [productReference, setProductReference] = useState("");
  const [productHsCode, setProductHsCode] = useState("");
  const [productUom, setProductUom] = useState("Units");
  const [productInitialStock, setProductInitialStock] = useState("");
  const [selectedQuotationId, setSelectedQuotationId] = useState<number | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [listSearch, setListSearch] = useState("");
  const [listStatus, setListStatus] = useState("");
  const [listFrom, setListFrom] = useState("");
  const [listTo, setListTo] = useState("");
  const [form, setForm] = useState({
    customer_id: null as number | null,
    payment_terms: "Cash",
    expires_at: ""
  });
  const [lines, setLines] = useState<QuotationLine[]>([emptyLine()]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (companies.length && companyId === null) {
      setCompanyId(companies[0].id);
    }
  }, [companies, companyId]);

  const loadData = async (cid: number) => {
    const [c, p, q, w, settingsData] = await Promise.all([
      apiFetch<Contact[]>(`/contacts?company_id=${cid}`),
      apiFetch<Product[]>(`/products/with-stock?company_id=${cid}`),
      apiFetch<Quotation[]>(`/quotations?company_id=${cid}`)
      ,
      apiFetch<Warehouse[]>(`/warehouses?company_id=${cid}`),
      apiFetch<CompanySettings>(`/company-settings?company_id=${cid}`)
    ]);
    setContacts(c);
    setProducts(p);
    setQuotations(q);
    setWarehouses(w);
    setCompanySettings(settingsData ?? null);
    if (!productWarehouseId && w.length) {
      setProductWarehouseId(w[0].id);
    }
  };

  useEffect(() => {
    if (companyId) {
      loadData(companyId);
    }
  }, [companyId]);

  useEffect(() => {
    if (!productWarehouseId) {
      setLocations([]);
      return;
    }
    apiFetch<Location[]>(`/locations?warehouse_id=${productWarehouseId}`)
      .then((data) => {
        setLocations(data);
        if (!productLocationId && data.length) {
          setProductLocationId(data[0].id);
        }
      })
      .catch(() => setLocations([]));
  }, [productWarehouseId]);

  useEffect(() => {
    if (mode === "list") {
      setSelectedQuotationId(null);
      setIsEditing(false);
      return;
    }
    if (mode === "detail") {
      setSelectedQuotationId(routeQuotationId ?? null);
      setIsEditing(false);
    }
  }, [mode, routeQuotationId]);

  useEffect(() => {
    if (mode === "new" && !isEditing) {
      startNew();
    }
  }, [mode, isEditing, contacts]);

  useEffect(() => {
    if (mode !== "new") return;
    if (form.customer_id !== null) return;
    if (!contacts.length) return;
    setForm((prev) => ({ ...prev, customer_id: contacts[0].id }));
  }, [mode, form.customer_id, contacts]);

  const selectedQuotation = useMemo(() => {
    return quotations.find((q) => q.id === selectedQuotationId) ?? null;
  }, [quotations, selectedQuotationId]);

  const selectedCompany = useMemo(
    () => companies.find((c: Company) => c.id === companyId) ?? null,
    [companies, companyId]
  );

  const filteredQuotations = useMemo(() => {
    const term = listSearch.trim().toLowerCase();
    const fromDate = listFrom ? new Date(listFrom) : null;
    const toDate = listTo ? new Date(listTo) : null;
    return quotations.filter((q) => {
      if (listStatus && q.status !== listStatus) return false;
      if (fromDate || toDate) {
        if (!q.expires_at) return false;
        const expDate = new Date(q.expires_at);
        if (fromDate && expDate < fromDate) return false;
        if (toDate && expDate > toDate) return false;
      }
      if (!term) return true;
      const customerName = contacts.find((c) => c.id === q.customer_id)?.name?.toLowerCase() ?? "";
      return q.reference.toLowerCase().includes(term) || customerName.includes(term);
    });
  }, [quotations, contacts, listSearch, listStatus, listFrom, listTo]);

  useEffect(() => {
    if (!selectedQuotation) return;
    setForm({
      customer_id: selectedQuotation.customer_id,
      payment_terms: selectedQuotation.payment_terms || "Cash",
      expires_at: selectedQuotation.expires_at ? selectedQuotation.expires_at.split("T")[0] : ""
    });
    setLines(
      selectedQuotation.lines?.length
        ? selectedQuotation.lines.map((line) => {
            const product = products.find((p) => p.id === line.product_id);
            return {
              ...line,
              uom: line.uom || product?.uom || ""
            };
          })
        : [emptyLine()]
    );
    setIsEditing(false);
  }, [selectedQuotation, products]);

  const startNew = () => {
    setSelectedQuotationId(null);
    setForm({ customer_id: contacts[0]?.id ?? null, payment_terms: "Cash", expires_at: "" });
    setLines([emptyLine()]);
    setIsEditing(true);
  };

  const saveQuotation = async () => {
    if (!companyId || !form.customer_id) return;
    setSaving(true);
    const payload = {
      customer_id: form.customer_id,
      payment_terms: form.payment_terms,
      expires_at: form.expires_at ? new Date(form.expires_at).toISOString() : null,
      lines
    };
    if (selectedQuotationId) {
      await apiFetch<Quotation>(`/quotations/${selectedQuotationId}`, {
        method: "PATCH",
        body: JSON.stringify(payload)
      });
    } else {
      const created = await apiFetch<Quotation>("/quotations", {
        method: "POST",
        body: JSON.stringify({ ...payload, company_id: companyId })
      });
      setSelectedQuotationId(created.id);
      navigate(`/quotations/${created.id}`);
    }
    await loadData(companyId);
    setIsEditing(false);
    setSaving(false);
  };

  const setStatus = async (status: string) => {
    if (!companyId || !selectedQuotationId) return;
    await apiFetch<Quotation>(`/quotations/${selectedQuotationId}`, {
      method: "PATCH",
      body: JSON.stringify({ status })
    });
    loadData(companyId);
  };

  const sendQuotation = async () => {
    if (!companyId || !selectedQuotationId) return;
    try {
      await apiFetch(`/quotations/${selectedQuotationId}/send`, { method: "POST" });
      loadData(companyId);
    } catch (err: any) {
      alert(err.message || "Failed to send quotation");
    }
  };

  const acceptQuotation = async () => {
    if (!companyId || !selectedQuotationId) return;
    try {
      await apiFetch(`/quotations/${selectedQuotationId}/accept`, { method: "POST" });
      loadData(companyId);
    } catch (err: any) {
      alert(err.message || "Failed to accept quotation");
    }
  };

  const rejectQuotation = async () => {
    if (!companyId || !selectedQuotationId) return;
    try {
      await apiFetch(`/quotations/${selectedQuotationId}/reject`, { method: "POST" });
      loadData(companyId);
    } catch (err: any) {
      alert(err.message || "Failed to reject quotation");
    }
  };

  const convertToInvoice = async () => {
    if (!companyId || !selectedQuotationId) return;
    try {
      const result = await apiFetch<{ invoice_id: number }>(`/quotations/${selectedQuotationId}/convert`, { method: "POST" });
      alert(`Invoice created successfully! Invoice ID: ${result.invoice_id}`);
      loadData(companyId);
    } catch (err: any) {
      alert(err.message || "Failed to convert quotation to invoice");
    }
  };

  const updateLine = (index: number, patch: Partial<QuotationLine>) => {
    setLines((prev) => prev.map((line, idx) => (idx === index ? { ...line, ...patch } : line)));
  };

  const addLine = () => setLines((prev) => [...prev, emptyLine()]);

  const removeLine = (index: number) => setLines((prev) => prev.filter((_, idx) => idx !== index));

  const statusLabel = selectedQuotation?.status ?? "draft";
  const canEdit = isEditing && statusLabel === "draft";
  const lineTotal = (line: QuotationLine) =>
    line.quantity * line.unit_price * (1 + (line.vat_rate / 100));
  const totalAmount = lines.reduce((sum, line) => sum + lineTotal(line), 0);

  const printQuotation = () => {
    if (!selectedQuotation) return;
    const win = window.open("", "_blank");
    if (!win) return;
    const company = selectedCompany;
    const customer = contacts.find((c) => c.id === selectedQuotation.customer_id);
    const layoutKey = (companySettings?.document_layout || "external_layout_standard").replace("external_layout_", "layout-");
    const logoMarkup = companySettings?.logo_data
      ? `<img class="logo" src="${companySettings.logo_data}" alt="Logo" />`
      : "";
    const rows = (selectedQuotation.lines || [])
      .map((line) => {
        const total = lineTotal(line);
        return `
          <tr>
            <td>${line.description || ""}</td>
            <td style="text-align:right;">${line.quantity || 0}</td>
            <td style="text-align:right;">${(line.unit_price || 0).toFixed(2)}</td>
            <td style="text-align:right;">${(line.vat_rate || 0).toFixed(2)}%</td>
            <td style="text-align:right;">${total.toFixed(2)}</td>
          </tr>
        `;
      })
      .join("");
    const expires = selectedQuotation.expires_at ? new Date(selectedQuotation.expires_at).toLocaleDateString() : "—";
    const dateLabel = new Date().toLocaleDateString();
    const html = `
      <html>
        <head>
          <title>${selectedQuotation.reference}</title>
          <style>
            body { font-family: Inter, Arial, sans-serif; padding: 32px; color: #0f172a; }
            h1 { font-size: 22px; margin-bottom: 6px; }
            .muted { color: #64748b; font-size: 12px; }
            .section { margin-top: 20px; }
            .doc { padding: 24px; border-radius: 16px; position: relative; }
            .watermark { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-size: 64px; font-weight: 700; color: #94a3b8; opacity: ${companySettings?.document_watermark_opacity || "0.08"}; pointer-events: none; }
            .layout-boxed { border: 1px solid #e2e8f0; }
            .layout-bold h1 { font-size: 26px; font-weight: 800; }
            .layout-bubble { border: 1px solid #e2e8f0; box-shadow: 0 10px 24px rgba(15, 23, 42, 0.08); }
            .layout-standard { }
            .header { display: flex; justify-content: space-between; gap: 24px; align-items: flex-start; }
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
            ${companySettings?.document_watermark ? `<div class="watermark">${companySettings.document_watermark}</div>` : ""}
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
              ${companySettings?.document_header ? `<div class="muted">${companySettings.document_header}</div>` : ""}
              <div class="muted">Reference: ${selectedQuotation.reference}</div>
              <div class="muted">Date: ${dateLabel}</div>
              <div class="muted">Expires: ${expires}</div>
              <div class="muted">Status: ${selectedQuotation.status || "-"}</div>
            </div>
            <div class="info-grid">
              <div class="info-card">
                <strong>Customer</strong>
                <div class="muted">${customer?.name || "-"}</div>
                <div class="muted">${customer?.address || ""}</div>
                <div class="muted">Email: ${customer?.email || "-"}</div>
                <div class="muted">Phone: ${customer?.phone || "-"}</div>
                <div class="muted">VAT: ${customer?.vat || "-"}</div>
                <div class="muted">TIN: ${customer?.tin || "-"}</div>
              </div>
              <div class="info-card">
                <strong>Payment</strong>
                <div class="muted">Terms: ${selectedQuotation.payment_terms || companySettings?.payment_terms_default || "-"}</div>
                <div class="muted">Notes: ${companySettings?.invoice_notes || "-"}</div>
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
                ${rows}
              </tbody>
            </table>
            <div class="totals">
              <div><strong>Total</strong><strong>${totalAmount.toFixed(2)}</strong></div>
            </div>
          </div>
            ${companySettings?.document_footer ? `<div class="section muted">${companySettings.document_footer}</div>` : ""}
          </div>
        </body>
      </html>
    `;
    win.document.write(html);
    win.document.close();
    win.focus();
    win.print();
  };

  const resetProductForm = () => {
    setProductName("");
    setProductPrice("");
    setProductTaxRate("");
    setProductReference("");
    setProductHsCode("");
    setProductUom("Units");
    setProductInitialStock("");
  };

  const createProduct = async () => {
    if (!companyId) return;
    const payload = {
      company_id: companyId,
      name: productName.trim(),
      sale_price: Number(productPrice || 0),
      tax_rate: Number(productTaxRate || 0),
      reference: productReference.trim() || null,
      hs_code: productHsCode.trim() || null,
      uom: productUom.trim() || "Units",
      initial_stock: Number(productInitialStock || 0),
      warehouse_id: productWarehouseId,
      location_id: productLocationId
    };
    try {
      await apiFetch<Product>("/products", {
        method: "POST",
        body: JSON.stringify(payload)
      });
      resetProductForm();
      setCreateProductOpen(false);
      if (companyId) {
        await loadData(companyId);
      }
    } catch (err: any) {
      alert(err.message || "Failed to create product");
    }
  };

  const showForm = mode !== "list";

  return (
    <div className="container-fluid py-3">
      {!showForm && (
        <div>
          <div className="d-flex flex-wrap justify-content-between align-items-center mb-3">
            <div>
              <h3 className="fw-bold mb-0">Quotations</h3>
              <small className="text-muted">Prepare and manage customer quotations.</small>
            </div>
            <button
              className="btn btn-primary"
              onClick={() => {
                startNew();
                navigate("/quotations/new");
              }}
            >
              + New Quotation
            </button>
          </div>
          <div className="card shadow-sm">
            <div className="card-body p-0">
              <div className="d-flex flex-wrap gap-2 p-3 border-bottom bg-light">
                <input
                  className="form-control"
                  style={{ maxWidth: 280 }}
                  placeholder="Search by reference or customer…"
                  value={listSearch}
                  onChange={(e) => setListSearch(e.target.value)}
                />
                <select
                  className="form-select"
                  style={{ maxWidth: 160 }}
                  value={listStatus}
                  onChange={(e) => setListStatus(e.target.value)}
                >
                  <option value="">All Status</option>
                  <option value="draft">Draft</option>
                  <option value="sent">Sent</option>
                  <option value="accepted">Accepted</option>
                  <option value="rejected">Rejected</option>
                  <option value="converted">Invoiced</option>
                </select>
                <input
                  className="form-control"
                  style={{ maxWidth: 160 }}
                  type="date"
                  value={listFrom}
                  onChange={(e) => setListFrom(e.target.value)}
                />
                <input
                  className="form-control"
                  style={{ maxWidth: 160 }}
                  type="date"
                  value={listTo}
                  onChange={(e) => setListTo(e.target.value)}
                />
              </div>
              <div className="table-responsive">
                <table className="table table-hover align-middle mb-0">
                  <thead className="table-light">
                    <tr>
                      <th>Reference</th>
                      <th>Customer</th>
                      <th>Status</th>
                      <th className="text-end">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredQuotations.map((q) => (
                      <tr key={q.id} role="button" onClick={() => navigate(`/quotations/${q.id}`)}>
                        <td>
                          <div className="fw-semibold">{q.reference}</div>
                        </td>
                        <td>{contacts.find((c) => c.id === q.customer_id)?.name ?? ""}</td>
                        <td>
                          <span className={`badge ${q.status === "accepted" ? "bg-success" : q.status === "sent" ? "bg-info" : q.status === "rejected" ? "bg-danger" : q.status === "converted" ? "bg-primary" : "bg-secondary"}`}>
                            {q.status}
                          </span>
                        </td>
                        <td className="text-end fw-semibold">{q.lines?.reduce((sum, line) => sum + lineTotal(line), 0).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {showForm && (
        <div>
          <div className="d-flex flex-wrap justify-content-between align-items-center mb-3 gap-2">
            <div className="d-flex align-items-center gap-2">
              <button className="btn btn-sm btn-light border" onClick={() => navigate("/quotations")}>← Back</button>
              <h4 className="fw-bold mb-0">{mode === "new" ? "New Quotation" : selectedQuotation?.reference || "Quotation"}</h4>
              <span className={`badge ms-2 ${statusLabel === "accepted" ? "bg-success" : statusLabel === "sent" ? "bg-info" : statusLabel === "rejected" ? "bg-danger" : statusLabel === "converted" ? "bg-primary" : "bg-secondary"}`}>
                {statusLabel}
              </span>
            </div>
            <div className="d-flex flex-wrap gap-1">
              <button
                className="btn btn-sm btn-light border"
                onClick={() => {
                  startNew();
                  navigate("/quotations/new");
                }}
              >
                New
              </button>
              {isEditing ? (
                <>
                  <button className="btn btn-sm btn-primary" onClick={saveQuotation} disabled={saving}>Save</button>
                  <button className="btn btn-sm btn-light border" onClick={() => setIsEditing(false)}>Discard</button>
                </>
              ) : (
                <button className="btn btn-sm btn-light border" onClick={() => setIsEditing(true)}>Edit</button>
              )}
              {selectedQuotationId ? (
                <>
                  <button className="btn btn-sm btn-light border" onClick={sendQuotation} disabled={statusLabel !== "draft"}>Send</button>
                  <button className="btn btn-sm btn-light border" onClick={acceptQuotation} disabled={statusLabel !== "sent"}>Accept</button>
                  <button className="btn btn-sm btn-light border" onClick={rejectQuotation} disabled={statusLabel !== "draft" && statusLabel !== "sent"}>Reject</button>
                  <button className="btn btn-sm btn-primary" onClick={convertToInvoice} disabled={statusLabel !== "accepted"}>Convert to Invoice</button>
                  <button className="btn btn-sm btn-light border" onClick={printQuotation}>Print</button>
                </>
              ) : null}
            </div>
          </div>

          <div className="card shadow-sm">
            <div className="card-body invoice-form">
              <div className="row g-3 mb-4">
                <div className="col-md-6">
                  <label className="form-label fw-semibold">Company</label>
                  <select
                    className="form-select input-underline"
                    value={companyId ?? ""}
                    onChange={(e) => setCompanyId(Number(e.target.value))}
                    disabled={!canEdit}
                  >
                    {companies.map((c: Company) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-md-6">
                  <label className="form-label fw-semibold">Customer</label>
                  <select
                    className="form-select input-underline"
                    value={form.customer_id ?? ""}
                    onChange={(e) => setForm((prev) => ({ ...prev, customer_id: Number(e.target.value) }))}
                    disabled={!canEdit}
                  >
                    {contacts.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-md-6">
                  <label className="form-label fw-semibold">Payment Terms</label>
                  <input
                    className="form-control input-underline"
                    value={form.payment_terms}
                    onChange={(e) => setForm((prev) => ({ ...prev, payment_terms: e.target.value }))}
                    disabled={!canEdit}
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label fw-semibold">Expiration</label>
                  <input
                    className="form-control input-underline"
                    type="date"
                    value={form.expires_at}
                    onChange={(e) => setForm((prev) => ({ ...prev, expires_at: e.target.value }))}
                    disabled={!canEdit}
                  />
                </div>
              </div>

              <div className="d-flex justify-content-between align-items-center mb-2">
                <div className="fw-semibold">Quotation Lines</div>
                {canEdit && (
                  <div className="d-flex gap-2">
                    <button className="btn btn-sm btn-light border" onClick={addLine}>+ Add Line</button>
                    <button className="btn btn-sm btn-light border" onClick={() => setCreateProductOpen(true)}>+ New Product</button>
                  </div>
                )}
              </div>
              <div className="table-responsive">
                <table className="table table-bordered align-middle mb-0">
                  <thead className="table-light">
                    <tr>
                      <th>Product</th>
                      <th>Description</th>
                      <th className="text-end">Qty</th>
                      <th>UoM</th>
                      <th className="text-end">Unit Price</th>
                      <th className="text-end">VAT %</th>
                      <th className="text-end">Total</th>
                      {canEdit && <th />}
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((line, index) => {
                      const product = products.find((p) => p.id === line.product_id);
                      const displayUom = normalizeUom(product?.uom || line.uom || "Units");
                      return (
                        <tr key={`${index}-${line.product_id ?? "new"}`}>
                          <td>
                            <select
                              className="form-select form-select-sm"
                              value={line.product_id ?? ""}
                              onChange={(e) => {
                                const selected = products.find((p) => p.id === Number(e.target.value));
                                updateLine(index, {
                                  product_id: Number(e.target.value),
                                  description: selected?.name ?? "",
                                  unit_price: selected?.sale_price ?? 0,
                                  vat_rate: selected?.tax_rate ?? 0,
                                  uom: selected?.uom || "Units"
                                });
                              }}
                              disabled={!canEdit}
                            >
                              <option value="">Select</option>
                              {products.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.name}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td>
                            <input
                              className="form-control form-control-sm"
                              value={line.description}
                              onChange={(e) => updateLine(index, { description: e.target.value })}
                              disabled={!canEdit}
                            />
                          </td>
                          <td className="text-end">
                            <input
                              className="form-control form-control-sm text-end"
                              type="number"
                              value={line.quantity}
                              onChange={(e) => updateLine(index, { quantity: Number(e.target.value) })}
                              disabled={!canEdit}
                            />
                          </td>
                          <td>
                            <input
                              className="form-control form-control-sm bg-light"
                              value={displayUom}
                              readOnly
                            />
                          </td>
                          <td className="text-end">
                            <input
                              className="form-control form-control-sm text-end"
                              type="number"
                              value={line.unit_price}
                              onChange={(e) => updateLine(index, { unit_price: Number(e.target.value) })}
                              disabled={!canEdit}
                            />
                          </td>
                          <td className="text-end">
                            <input
                              className="form-control form-control-sm text-end input-ghost"
                              type="number"
                              value={line.vat_rate}
                              onChange={(e) => updateLine(index, { vat_rate: Number(e.target.value) })}
                              disabled={!canEdit}
                            />
                          </td>
                          <td className="text-end fw-semibold">{lineTotal(line).toFixed(2)}</td>
                          {canEdit && (
                            <td className="text-center">
                              <button className="btn btn-sm btn-light border" onClick={() => removeLine(index)} disabled={lines.length === 1}>
                                ✕
                              </button>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="d-flex justify-content-between align-items-center mt-2">
                <div />
                <div className="fw-semibold">Total: {totalAmount.toFixed(2)}</div>
              </div>
            </div>
          </div>
          {createProductOpen && (
            <>
              <div className="modal-backdrop fade show" style={{ zIndex: 1040 }} />
              <div
                className="modal"
                tabIndex={-1}
                role="dialog"
                style={{ position: "fixed", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem", zIndex: 1050, background: "transparent" }}
                onClick={(e) => { if (e.target === e.currentTarget) setCreateProductOpen(false); }}
              >
                <div className="modal-dialog modal-lg modal-dialog-centered" style={{ margin: 0, width: "100%", maxWidth: 720 }}>
                  <div className="modal-content shadow-lg border-0">
                    <div className="modal-header border-bottom">
                      <h5 className="modal-title fw-semibold">Create Product</h5>
                      <button type="button" className="btn-close" onClick={() => setCreateProductOpen(false)} />
                    </div>
                    <div className="modal-body py-4">
                      <div className="row g-3">
                        <div className="col-md-6">
                          <label className="form-label">Product Name</label>
                          <input className="form-control" value={productName} onChange={(e) => setProductName(e.target.value)} />
                        </div>
                        <div className="col-md-3">
                          <label className="form-label">Sale Price</label>
                          <input className="form-control" type="number" value={productPrice} onChange={(e) => setProductPrice(e.target.value)} />
                        </div>
                        <div className="col-md-3">
                          <label className="form-label">Tax Rate %</label>
                          <input className="form-control" type="number" value={productTaxRate} onChange={(e) => setProductTaxRate(e.target.value)} />
                        </div>
                        <div className="col-md-3">
                          <label className="form-label">Reference / SKU</label>
                          <input className="form-control" value={productReference} onChange={(e) => setProductReference(e.target.value)} placeholder="e.g., PROD-001" />
                        </div>
                        <div className="col-md-3">
                          <label className="form-label">HS Code</label>
                          <input className="form-control" value={productHsCode} onChange={(e) => setProductHsCode(e.target.value)} placeholder="Harmonized code" />
                        </div>
                        <div className="col-md-3">
                          <label className="form-label">UoM</label>
                          <input className="form-control" value={productUom} onChange={(e) => setProductUom(e.target.value)} />
                        </div>
                        <div className="col-md-3">
                          <label className="form-label">Initial Stock</label>
                          <input className="form-control" type="number" value={productInitialStock} onChange={(e) => setProductInitialStock(e.target.value)} />
                        </div>
                        <div className="col-md-3">
                          <label className="form-label">Warehouse</label>
                          <select className="form-select" value={productWarehouseId ?? ""} onChange={(e) => setProductWarehouseId(Number(e.target.value))}>
                            <option value="">Select warehouse</option>
                            {warehouses.map((w) => (
                              <option key={w.id} value={w.id}>{w.name}</option>
                            ))}
                          </select>
                        </div>
                        <div className="col-md-3">
                          <label className="form-label">Location</label>
                          <select className="form-select" value={productLocationId ?? ""} onChange={(e) => setProductLocationId(Number(e.target.value))}>
                            <option value="">Select location</option>
                            {locations.map((l) => (
                              <option key={l.id} value={l.id}>{l.name}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                    <div className="modal-footer border-top">
                      <button className="btn btn-light border" onClick={() => setCreateProductOpen(false)}>Cancel</button>
                      <button className="btn btn-primary" onClick={createProduct}>Create Product</button>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
