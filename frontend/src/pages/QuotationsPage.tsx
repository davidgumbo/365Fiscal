import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { apiFetch } from "../api";
import { useCompanies, Company } from "../hooks/useCompanies";

type Contact = { id: number; name: string };

type Product = { id: number; name: string; sale_price: number; tax_rate: number };

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
  uom: "PCS",
  unit_price: 0,
  vat_rate: 0
});

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
  const [selectedQuotationId, setSelectedQuotationId] = useState<number | null>(null);
  const [isEditing, setIsEditing] = useState(false);
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
    const [c, p, q] = await Promise.all([
      apiFetch<Contact[]>(`/contacts?company_id=${cid}`),
      apiFetch<Product[]>(`/products?company_id=${cid}`),
      apiFetch<Quotation[]>(`/quotations?company_id=${cid}`)
    ]);
    setContacts(c);
    setProducts(p);
    setQuotations(q);
  };

  useEffect(() => {
    if (companyId) {
      loadData(companyId);
    }
  }, [companyId]);

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

  const selectedQuotation = useMemo(() => {
    return quotations.find((q) => q.id === selectedQuotationId) ?? null;
  }, [quotations, selectedQuotationId]);

  const selectedCompany = useMemo(
    () => companies.find((c: Company) => c.id === companyId) ?? null,
    [companies, companyId]
  );

  useEffect(() => {
    if (!selectedQuotation) return;
    setForm({
      customer_id: selectedQuotation.customer_id,
      payment_terms: selectedQuotation.payment_terms || "Cash",
      expires_at: selectedQuotation.expires_at ? selectedQuotation.expires_at.split("T")[0] : ""
    });
    setLines(selectedQuotation.lines?.length ? selectedQuotation.lines.map((line) => ({ ...line })) : [emptyLine()]);
    setIsEditing(false);
  }, [selectedQuotation]);

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
            h1 { font-size: 20px; margin-bottom: 8px; }
            .muted { color: #64748b; font-size: 12px; }
            .section { margin-top: 20px; }
            table { width: 100%; border-collapse: collapse; margin-top: 12px; }
            th, td { border-bottom: 1px solid #e2e8f0; padding: 8px; font-size: 12px; }
            th { text-align: left; background: #f8fafc; }
            .totals { margin-top: 16px; width: 260px; float: right; }
            .totals div { display: flex; justify-content: space-between; margin-bottom: 6px; }
          </style>
        </head>
        <body>
          <h1>${company?.name || "Company"}</h1>
          <div class="muted">${company?.address || ""}</div>
          <div class="section">
            <strong>Quotation</strong>
            <div class="muted">Reference: ${selectedQuotation.reference}</div>
            <div class="muted">Date: ${dateLabel}</div>
            <div class="muted">Customer: ${customer?.name || "-"}</div>
            <div class="muted">Expires: ${expires}</div>
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
        </body>
      </html>
    `;
    win.document.write(html);
    win.document.close();
    win.focus();
    win.print();
  };

  const showForm = mode !== "list";

  return (
    <div className="content">
      {!showForm && (
        <div className="form-shell">
          <div className="d-flex flex-wrap justify-content-between align-items-center mb-3">
            <h3>Quotations</h3>
            <button
              className="outline"
              onClick={() => {
                startNew();
                navigate("/quotations/new");
              }}
            >
              New
            </button>
          </div>
          <table className="table">
            <thead>
              <tr>
                <th>Reference</th>
                <th>Customer</th>
                <th>Status</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {quotations.map((q) => (
                <tr
                  key={q.id}
                  className={selectedQuotationId === q.id ? "row-active" : ""}
                  onClick={() => navigate(`/quotations/${q.id}`)}
                >
                  <td>{q.reference}</td>
                  <td>{contacts.find((c) => c.id === q.customer_id)?.name ?? ""}</td>
                  <td>{q.status}</td>
                  <td>{q.lines?.reduce((sum, line) => sum + lineTotal(line), 0).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <div className="form-view">
          <div className="form-shell">
            <div className="form-header">
              <div>
                <h3>Quotation</h3>
                <div className="statusbar">
                  <span className={`status-pill ${statusLabel === "draft" ? "active" : ""}`}>Draft</span>
                  <span className={`status-pill ${statusLabel === "sent" ? "active" : ""}`}>Sent</span>
                  <span className={`status-pill ${statusLabel === "accepted" ? "active" : ""}`}>Accepted</span>
                  <span className={`status-pill ${statusLabel === "rejected" ? "active" : ""}`}>Rejected</span>
                  <span className={`status-pill ${statusLabel === "converted" ? "active" : ""}`}>Invoiced</span>
                </div>
              </div>
              <div className="form-actions">
                <button className="outline" onClick={() => navigate("/quotations")}>Back</button>
                <button
                  className="outline"
                  onClick={() => {
                    startNew();
                    navigate("/quotations/new");
                  }}
                >
                  New
                </button>
                {isEditing ? (
                  <>
                    <button className="primary" onClick={saveQuotation} disabled={saving}>Save</button>
                    <button className="outline" onClick={() => setIsEditing(false)}>Discard</button>
                  </>
                ) : (
                  <button className="primary" onClick={() => setIsEditing(true)}>Edit</button>
                )}
                {selectedQuotationId ? (
                  <>
                    <button className="outline" onClick={sendQuotation} disabled={statusLabel !== "draft"}>Send</button>
                    <button className="outline" onClick={acceptQuotation} disabled={statusLabel !== "sent"}>Accept</button>
                    <button className="outline" onClick={rejectQuotation} disabled={statusLabel !== "draft" && statusLabel !== "sent"}>Reject</button>
                    <button className="primary" onClick={convertToInvoice} disabled={statusLabel !== "accepted"}>Convert to Invoice</button>
                    <button className="outline" onClick={printQuotation}>Print</button>
                  </>
                ) : null}
              </div>
            </div>
            <div className="form-grid">
              <label className="input">
                Company
                <select
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
              </label>
              <label className="input">
                Customer
                <select
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
              </label>
              <label className="input">
                Payment Terms
                <input
                  value={form.payment_terms}
                  onChange={(e) => setForm((prev) => ({ ...prev, payment_terms: e.target.value }))}
                  disabled={!canEdit}
                />
              </label>
              <label className="input">
                Expiration
                <input
                  type="date"
                  value={form.expires_at}
                  onChange={(e) => setForm((prev) => ({ ...prev, expires_at: e.target.value }))}
                  disabled={!canEdit}
                />
              </label>
            </div>
            <div className="invoice-lines">
              <table className="table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Description</th>
                    <th>Qty</th>
                    <th>UoM</th>
                    <th>Unit Price</th>
                    <th>VAT %</th>
                    <th>Total</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line, index) => (
                    <tr key={`${index}-${line.product_id ?? "new"}`}>
                      <td>
                        <select
                          value={line.product_id ?? ""}
                          onChange={(e) => {
                            const selected = products.find((p) => p.id === Number(e.target.value));
                            updateLine(index, {
                              product_id: Number(e.target.value),
                              description: selected?.name ?? "",
                              unit_price: selected?.sale_price ?? 0,
                              vat_rate: selected?.tax_rate ?? 0
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
                          value={line.description}
                          onChange={(e) => updateLine(index, { description: e.target.value })}
                          disabled={!canEdit}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          value={line.quantity}
                          onChange={(e) => updateLine(index, { quantity: Number(e.target.value) })}
                          disabled={!canEdit}
                        />
                      </td>
                      <td>
                        <input
                          value={line.uom}
                          onChange={(e) => updateLine(index, { uom: e.target.value })}
                          disabled={!canEdit}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          value={line.unit_price}
                          onChange={(e) => updateLine(index, { unit_price: Number(e.target.value) })}
                          disabled={!canEdit}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          value={line.vat_rate}
                          onChange={(e) => updateLine(index, { vat_rate: Number(e.target.value) })}
                          disabled={!canEdit}
                        />
                      </td>
                      <td>{lineTotal(line).toFixed(2)}</td>
                      <td>
                        <button className="outline" onClick={() => removeLine(index)} disabled={!canEdit || lines.length === 1}>
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="form-actions" style={{ justifyContent: "space-between", marginTop: 8 }}>
                <button className="outline" onClick={addLine} disabled={!canEdit}>Add Line</button>
                <div className="invoice-total">Total: {totalAmount.toFixed(2)}</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
