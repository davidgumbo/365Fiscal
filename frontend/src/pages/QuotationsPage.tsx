import { useEffect, useMemo, useState } from "react";
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

export default function QuotationsPage() {
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
    if (q.length && selectedQuotationId === null) {
      setSelectedQuotationId(q[0].id);
    }
    if (c.length && form.customer_id === null) {
      setForm((prev) => ({ ...prev, customer_id: c[0].id }));
    }
  };

  useEffect(() => {
    if (companyId) {
      loadData(companyId);
    }
  }, [companyId]);

  const selectedQuotation = useMemo(() => {
    return quotations.find((q) => q.id === selectedQuotationId) ?? null;
  }, [quotations, selectedQuotationId]);

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

  return (
    <div className="content">
      <div className="form-view">
        <div className="form-shell">
          <div className="form-header">
            <div>
              <h3>Quotation</h3>
              <div className="statusbar">
                <span className={`status-pill ${statusLabel === "draft" ? "active" : ""}`}>Draft</span>
                <span className={`status-pill ${statusLabel === "sent" ? "active" : ""}`}>Sent</span>
                <span className={`status-pill ${statusLabel === "confirmed" ? "active" : ""}`}>Confirmed</span>
                <span className={`status-pill ${statusLabel === "cancelled" ? "active" : ""}`}>Cancelled</span>
              </div>
            </div>
            <div className="form-actions">
              <button className="outline" onClick={startNew}>New</button>
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
                  <button className="outline" onClick={() => setStatus("sent")} disabled={statusLabel !== "draft"}>Send</button>
                  <button className="outline" onClick={() => setStatus("confirmed")} disabled={statusLabel === "confirmed" || statusLabel === "cancelled"}>Confirm</button>
                  <button className="outline" onClick={() => setStatus("cancelled")} disabled={statusLabel === "cancelled"}>Cancel</button>
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
      <div className="form-shell">
        <h3>Quotations</h3>
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
                onClick={() => setSelectedQuotationId(q.id)}
              >
                <td>{q.reference}</td>
                <td>{contacts.find((c) => c.id === q.customer_id)?.name ?? ""}</td>
                <td>{q.status}</td>
                <td>
                  {q.lines?.reduce((sum, line) => sum + lineTotal(line), 0).toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}