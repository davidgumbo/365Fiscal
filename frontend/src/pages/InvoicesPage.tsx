import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "../api";
import { useMe } from "../hooks/useMe";

type InvoiceLine = {
  id: number;
  invoice_id: number;
  product_id: number | null;
  description: string;
  quantity: number;
  uom: string;
  unit_price: number;
  discount: number;
  vat_rate: number;
  subtotal: number;
  tax_amount: number;
  total_price: number;
};

type Invoice = {
  id: number;
  company_id: number;
  quotation_id: number | null;
  customer_id: number | null;
  reference: string;
  status: string;
  invoice_date: string | null;
  due_date: string | null;
  fiscalized_at: string | null;
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  total_amount: number;
  amount_paid: number;
  amount_due: number;
  currency: string;
  payment_terms: string;
  notes: string;
  lines: InvoiceLine[];
};

type QuotationLine = {
  id: number;
  product_id: number | null;
  description: string;
  quantity: number;
  uom: string;
  unit_price: number;
  vat_rate: number;
  total_price: number;
};

type Quotation = {
  id: number;
  customer_id: number;
  reference: string;
  status: string;
  lines: QuotationLine[];
};

type Contact = {
  id: number;
  name: string;
  address: string;
  vat: string;
  tin: string;
  phone: string;
  email?: string | null;
};

type Product = {
  id: number;
  name: string;
  sale_price: number;
  tax_rate: number;
};

export default function InvoicesPage() {
  const { me } = useMe();
  const companyId = me?.company_ids?.[0];
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<number | null>(null);
  const [newMode, setNewMode] = useState(false);
  const [newQuotationId, setNewQuotationId] = useState<number | null>(null);
  const [newCustomerId, setNewCustomerId] = useState<number | null>(null);
  const [newReference, setNewReference] = useState("");
  const [editQuotationId, setEditQuotationId] = useState<number | null>(null);
  const [editCustomerId, setEditCustomerId] = useState<number | null>(null);
  const [editReference, setEditReference] = useState("");
  const [editLines, setEditLines] = useState<Partial<InvoiceLine>[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const loadAll = async () => {
    if (!companyId) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [invoiceData, quotationData, contactData, productData] = await Promise.all([
        apiFetch<Invoice[]>(`/invoices?company_id=${companyId}`),
        apiFetch<Quotation[]>(`/quotations?company_id=${companyId}`),
        apiFetch<Contact[]>(`/contacts?company_id=${companyId}`),
        apiFetch<Product[]>(`/products?company_id=${companyId}`)
      ]);
      setInvoices(invoiceData);
      setQuotations(quotationData);
      setContacts(contactData);
      setProducts(productData);
      if (invoiceData.length && !selectedInvoiceId) {
        setSelectedInvoiceId(invoiceData[0].id);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load invoices");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, [companyId]);

  const selectedInvoice = useMemo(() => {
    return invoices.find((inv) => inv.id === selectedInvoiceId) ?? null;
  }, [invoices, selectedInvoiceId]);

  useEffect(() => {
    if (!selectedInvoice) return;
    setEditQuotationId(selectedInvoice.quotation_id ?? null);
    setEditCustomerId(selectedInvoice.customer_id ?? null);
    setEditReference(selectedInvoice.reference ?? "");
    setEditLines(selectedInvoice.lines?.length ? selectedInvoice.lines.map(l => ({ ...l })) : []);
  }, [selectedInvoice]);

  const quotationById = useMemo(() => {
    return new Map(quotations.map((q) => [q.id, q]));
  }, [quotations]);

  const contactById = useMemo(() => {
    return new Map(contacts.map((c) => [c.id, c]));
  }, [contacts]);

  const productById = useMemo(() => {
    return new Map(products.map((p) => [p.id, p]));
  }, [products]);

  const linkedQuotation = selectedInvoice?.quotation_id
    ? quotationById.get(selectedInvoice.quotation_id) ?? null
    : null;

  const newQuotation = newQuotationId ? quotationById.get(newQuotationId) ?? null : null;

  const customer = selectedInvoice?.customer_id
    ? contactById.get(selectedInvoice.customer_id) ?? null
    : linkedQuotation
    ? contactById.get(linkedQuotation.customer_id) ?? null
    : null;

  const invoiceDate = selectedInvoice?.invoice_date
    ? new Date(selectedInvoice.invoice_date).toLocaleDateString()
    : selectedInvoice?.fiscalized_at
    ? new Date(selectedInvoice.fiscalized_at).toLocaleDateString()
    : "-";

  const newTotal = newQuotation
    ? newQuotation.lines.reduce((sum, line) => sum + line.total_price, 0)
    : 0;
  const amountLabel = newMode
    ? newTotal.toLocaleString(undefined, { style: "currency", currency: "USD" })
    : selectedInvoice
      ? selectedInvoice.total_amount.toLocaleString(undefined, { style: "currency", currency: "USD" })
      : "-";

  const statusLabel = selectedInvoice?.status ?? "draft";
  const statusClass = statusLabel === "posted" || statusLabel === "fiscalized" || statusLabel === "paid" ? "success" : "neutral";

  const beginNew = () => {
    setNewMode(true);
    setIsEditing(true);
    setNewQuotationId(null);
    setNewCustomerId(contacts[0]?.id ?? null);
    setNewReference("");
  };

  const createInvoice = async () => {
    if (!companyId) return;
    const created = await apiFetch<Invoice>("/invoices", {
      method: "POST",
      body: JSON.stringify({
        company_id: companyId,
        quotation_id: newQuotationId,
        customer_id: newCustomerId,
        reference: newReference || null
      })
    });
    setSelectedInvoiceId(created.id);
    setNewMode(false);
    setIsEditing(false);
    await loadAll();
  };

  const saveInvoice = async () => {
    if (!selectedInvoiceId) return;
    await apiFetch<Invoice>(`/invoices/${selectedInvoiceId}`, {
      method: "PATCH",
      body: JSON.stringify({
        quotation_id: editQuotationId,
        customer_id: editCustomerId,
        reference: editReference,
        lines: editLines.map(line => ({
          product_id: line.product_id,
          description: line.description || "",
          quantity: line.quantity || 1,
          uom: line.uom || "",
          unit_price: line.unit_price || 0,
          discount: line.discount || 0,
          vat_rate: line.vat_rate || 0
        }))
      })
    });
    setIsEditing(false);
    await loadAll();
  };

  const postInvoice = async () => {
    if (!selectedInvoiceId) return;
    try {
      await apiFetch<Invoice>(`/invoices/${selectedInvoiceId}/post`, { method: "POST" });
      await loadAll();
    } catch (err: any) {
      setError(err.message || "Failed to post invoice");
    }
  };

  const resetInvoice = async () => {
    if (!selectedInvoiceId) return;
    await apiFetch<Invoice>(`/invoices/${selectedInvoiceId}/reset`, { method: "POST" });
    await loadAll();
  };

  const fiscalizeInvoice = async () => {
    if (!selectedInvoiceId) return;
    await apiFetch<Invoice>(`/invoices/${selectedInvoiceId}/fiscalize`, { method: "POST" });
    await loadAll();
  };

  const updateLine = (index: number, patch: Partial<InvoiceLine>) => {
    setEditLines(prev => prev.map((line, idx) => idx === index ? { ...line, ...patch } : line));
  };

  const addLine = () => {
    setEditLines(prev => [...prev, {
      product_id: null,
      description: "",
      quantity: 1,
      uom: "PCS",
      unit_price: 0,
      discount: 0,
      vat_rate: 0
    }]);
  };

  const removeLine = (index: number) => {
    setEditLines(prev => prev.filter((_, idx) => idx !== index));
  };

  const displayLines = isEditing ? editLines : (selectedInvoice?.lines ?? []);
  const canEdit = isEditing && statusLabel === "draft";

  return (
    <div className="page-container">
      {error && <div className="alert alert-danger">{error}</div>}
      <div className="section-header">
        <div className="section-title">
          <h3>Invoices</h3>
          <p>Manage your sales invoices and fiscalization</p>
        </div>
        <div className="toolbar-right">
          <span className={`badge ${statusClass === "success" ?  "badge-warning" : "badge-info"}`}>{statusLabel}</span>
          {isEditing ? (
            <>
              <button className="btn btn-primary" onClick={newMode ? createInvoice : saveInvoice}>Save</button>
              <button className="btn btn-secondary" onClick={() => setIsEditing(false)}>Discard</button>
            </>
          ) : (
            <button className="btn btn-primary" onClick={() => setIsEditing(true)}>Edit</button>
          )}
          <button className="btn btn-secondary" onClick={postInvoice} disabled={statusLabel !== "draft"}>Post</button>
          <button className="btn btn-primary" onClick={fiscalizeInvoice} disabled={statusLabel !== "posted"}>Fiscalize</button>
          <button className="btn btn-secondary" onClick={resetInvoice} disabled={statusLabel !== "posted" && statusLabel !== "fiscalized"}>Reset</button>
        </div>
      </div>

      <div className="two-panel">
        <div className="form-shell-pro">
          <div className="toolbar">
            <div className="toolbar-left">
              <button className="btn btn-primary" onClick={beginNew}>+ New Invoice</button>
              <select
                className="input-field dropdown-select"
                style={{ width: 220 }}
                value={selectedInvoiceId ?? ""}
                onChange={(e) => setSelectedInvoiceId(Number(e.target.value))}
              >
                <option value="" disabled>
                  {loading ? "Loading invoices..." : "Select invoice"}
                </option>
                {invoices.map((inv) => (
                  <option key={inv.id} value={inv.id}>
                    {inv.reference}
                  </option>
                ))}
              </select>
            </div>
            <div className="statusbar">
              <span className={`status-pill ${statusLabel === "draft" ? "active" : ""}`}>Draft</span>
              <span className={`status-pill ${statusLabel === "posted" ? "active" : ""}`}>Posted</span>
              <span className={`status-pill ${statusLabel === "fiscalized" ? "active" : ""}`}>Fiscalized</span>
            </div>
          </div>

          {newMode && (
            <div className="form-grid-pro" style={{ marginBottom: 20 }}>
              <div className="input-group">
                <label className="input-label">Quotation</label>
                <select
                  className="input-field dropdown-select"
                  value={newQuotationId ?? ""}
                  onChange={(e) => setNewQuotationId(Number(e.target.value))}
                >
                  <option value="">Select quotation</option>
                  {quotations.map((q) => (
                    <option key={q.id} value={q.id}>
                      {q.reference}
                    </option>
                  ))}
                </select>
              </div>
              <div className="input-group">
                <label className="input-label">Reference</label>
                <input
                  className="input-field"
                  value={newReference}
                  onChange={(e) => setNewReference(e.target.value)}
                  placeholder="INV-001"
                />
              </div>
            </div>
          )}

          {selectedInvoice && !newMode && (
            <>
              <div className="stats-grid">
                <div className="stat-card">
                  <div className="stat-card-icon blue">$</div>
                  <div className="stat-card-label">Total Amount</div>
                  <div className="stat-card-value">{amountLabel}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-card-icon green">✓</div>
                  <div className="stat-card-label">Amount Paid</div>
                  <div className="stat-card-value">${selectedInvoice.amount_paid?.toFixed(2) || "0.00"}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-card-icon red">!</div>
                  <div className="stat-card-label">Amount Due</div>
                  <div className="stat-card-value">${selectedInvoice.amount_due?.toFixed(2) || "0.00"}</div>
                </div>
              </div>

              <div className="form-grid-pro" style={{ marginBottom: 24 }}>
                <div className="input-group">
                  <label className="input-label">Customer</label>
                  {isEditing && statusLabel === "draft" ? (
                    <select
                      className="input-field dropdown-select"
                      value={editCustomerId ?? ""}
                      onChange={(e) => setEditCustomerId(Number(e.target.value))}
                    >
                      <option value="">Select customer</option>
                      {contacts.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  ) : (
                    <div className="input-field" style={{ background: "#f8fafc" }}>
                      {customer?.name || "No customer"}
                    </div>
                  )}
                </div>
                <div className="input-group">
                  <label className="input-label">Invoice Date</label>
                  <div className="input-field" style={{ background: "#f8fafc" }}>{invoiceDate}</div>
                </div>
                <div className="input-group">
                  <label className="input-label">Quotation</label>
                  {isEditing && statusLabel === "draft" ? (
                    <select
                      className="input-field dropdown-select"
                      value={editQuotationId ?? ""}
                      onChange={(e) => setEditQuotationId(Number(e.target.value))}
                    >
                      <option value="">Select quotation</option>
                      {quotations.map((q) => (
                        <option key={q.id} value={q.id}>{q.reference}</option>
                      ))}
                    </select>
                  ) : (
                    <div className="input-field" style={{ background: "#f8fafc" }}>
                      {linkedQuotation?.reference || "-"}
                    </div>
                  )}
                </div>
                <div className="input-group">
                  <label className="input-label">Reference</label>
                  {isEditing ? (
                    <input
                      className="input-field"
                      value={editReference}
                      onChange={(e) => setEditReference(e.target.value)}
                    />
                  ) : (
                    <div className="input-field" style={{ background: "#f8fafc" }}>
                      {selectedInvoice?.reference || "-"}
                    </div>
                  )}
                </div>
              </div>

              <div className="tabs-nav" style={{ marginBottom: 16 }}>
                <button className="tab-btn active">Invoice Lines</button>
                <button className="tab-btn">Other Info</button>
                <button className="tab-btn">Fiscalization</button>
              </div>

              <table className="table-pro">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Description</th>
                    <th>Qty</th>
                    <th>UoM</th>
                    <th>Price</th>
                    <th>Disc %</th>
                    <th>Tax %</th>
                    <th>Amount</th>
                    {canEdit && <th></th>}
                  </tr>
                </thead>
                <tbody>
                  {displayLines.map((line, index) => {
                    const product = line.product_id ? productById.get(line.product_id) : null;
                    const lineTotal = (line.quantity || 0) * (line.unit_price || 0) * (1 - (line.discount || 0) / 100) * (1 + (line.vat_rate || 0) / 100);
                    return (
                      <tr key={line.id || `new-${index}`}>
                        <td>
                          {canEdit ? (
                            <select
                              className="input-field dropdown-select"
                              style={{ minWidth: 140 }}
                              value={line.product_id ?? ""}
                              onChange={(e) => {
                                const prod = products.find(p => p.id === Number(e.target.value));
                                updateLine(index, {
                                  product_id: Number(e.target.value),
                                  description: prod?.name ?? "",
                                  unit_price: prod?.sale_price ?? 0,
                                  vat_rate: prod?.tax_rate ?? 0
                                });
                              }}
                            >
                              <option value="">Select</option>
                              {products.map(p => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                              ))}
                            </select>
                          ) : (
                            product?.name ?? "-"
                          )}
                        </td>
                        <td>
                          {canEdit ? (
                            <input
                              className="input-field"
                              value={line.description || ""}
                              onChange={(e) => updateLine(index, { description: e.target.value })}
                            />
                          ) : (
                            line.description || "-"
                          )}
                        </td>
                        <td>
                          {canEdit ? (
                            <input
                              className="input-field"
                              type="number"
                              style={{ width: 70 }}
                              value={line.quantity || 0}
                              onChange={(e) => updateLine(index, { quantity: Number(e.target.value) })}
                            />
                          ) : (
                            line.quantity
                          )}
                        </td>
                        <td>
                          {canEdit ? (
                            <input
                              className="input-field"
                              value={line.uom || ""}
                              onChange={(e) => updateLine(index, { uom: e.target.value })}
                              style={{ width: 60 }}
                            />
                          ) : (
                            line.uom || "-"
                          )}
                        </td>
                        <td>
                          {canEdit ? (
                            <input
                              className="input-field"
                              type="number"
                              style={{ width: 90 }}
                              value={line.unit_price || 0}
                              onChange={(e) => updateLine(index, { unit_price: Number(e.target.value) })}
                            />
                          ) : (
                            <span className="money">${(line.unit_price || 0).toFixed(2)}</span>
                          )}
                        </td>
                        <td>
                          {canEdit ? (
                            <input
                              className="input-field"
                              type="number"
                              value={line.discount || 0}
                              onChange={(e) => updateLine(index, { discount: Number(e.target.value) })}
                              style={{ width: 60 }}
                            />
                          ) : (
                            line.discount ? `${line.discount}%` : "-"
                          )}
                        </td>
                        <td>
                          {canEdit ? (
                            <input
                              className="input-field"
                              type="number"
                              value={line.vat_rate || 0}
                              onChange={(e) => updateLine(index, { vat_rate: Number(e.target.value) })}
                              style={{ width: 60 }}
                            />
                          ) : (
                            line.vat_rate ? `${line.vat_rate}%` : "-"
                          )}
                        </td>
                        <td><span className="money">${lineTotal.toFixed(2)}</span></td>
                        {canEdit && (
                          <td>
                            <button className="btn btn-sm btn-secondary" onClick={() => removeLine(index)} disabled={displayLines.length === 1}>✕</button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                  {!displayLines.length && (
                    <tr>
                      <td colSpan={canEdit ? 9 : 8} className="empty-state-pro">
                        <p>{loading ? "Loading lines..." : "No invoice lines"}</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>

              {canEdit && (
                <div style={{ marginTop: 12 }}>
                  <button className="btn btn-secondary" onClick={addLine}>+ Add Line</button>
                </div>
              )}

              <div className="divider" />

              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <div style={{ textAlign: "right", minWidth: 200 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                    <span>Subtotal:</span>
                    <span className="money">${(selectedInvoice?.subtotal || 0).toFixed(2)}</span>
                  </div>
                  {(selectedInvoice?.discount_amount || 0) > 0 && (
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, color: "#15803d" }}>
                      <span>Discount:</span>
                      <span>-${selectedInvoice?.discount_amount?.toFixed(2)}</span>
                    </div>
                  )}
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                    <span>Tax:</span>
                    <span className="money">${(selectedInvoice?.tax_amount || 0).toFixed(2)}</span>
                  </div>
                  <div className="divider" style={{ margin: "8px 0" }} />
                  <div style={{ display: "flex", justifyContent: "space-between", fontWeight: "bold", fontSize: 18 }}>
                    <span>Total:</span>
                    <span className="money">${(selectedInvoice?.total_amount || 0).toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </>
          )}

          {!selectedInvoice && !newMode && (
            <div className="empty-state-pro">
              <h4>No Invoice Selected</h4>
              <p>Select an invoice from the list or create a new one</p>
            </div>
          )}
        </div>

        <div className="sidebar-panel">
          <h4>Recent Invoices</h4>
          <div style={{ maxHeight: "500px", overflowY: "auto" }}>
            {invoices.length === 0 ? (
              <div className="empty-state-pro">
                <p>No invoices yet</p>
              </div>
            ) : (
              invoices.slice(0, 20).map((inv) => (
                <div
                  key={inv.id}
                  className={`list-item ${selectedInvoiceId === inv.id ? "active" : ""}`}
                  onClick={() => setSelectedInvoiceId(inv.id)}
                >
                  <div>
                    <div className="list-item-title">{inv.reference}</div>
                    <div className="list-item-sub">${inv.total_amount?.toFixed(2) || "0.00"}</div>
                  </div>
                  <span className={`badge ${inv.status === "fiscalized" ? "badge-success" : inv.status === "posted" ? "badge-info" : "badge-secondary"}`}>
                    {inv.status}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}