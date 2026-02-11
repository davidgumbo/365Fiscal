import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { apiFetch } from "../api";
import { useMe } from "../hooks/useMe";

type Contact = {
  id: number;
  name: string;
  address?: string;
  city?: string;
  country?: string;
  email?: string | null;
  phone?: string;
  vat?: string;
  tin?: string;
};

type Product = {
  id: number;
  name: string;
  purchase_cost: number;
  tax_rate: number;
  uom?: string;
  product_type?: string;
  can_be_purchased?: boolean;
  is_active?: boolean;
};

type Warehouse = { id: number; name: string };

type Location = { id: number; name: string; warehouse_id: number };

type CompanySettings = {
  currency_code?: string;
  currency_symbol?: string;
};

type PurchaseOrderLine = {
  id?: number;
  product_id: number | null;
  description: string;
  quantity: number;
  received_quantity: number;
  uom: string;
  unit_price: number;
  discount: number;
  vat_rate: number;
};

type PurchaseOrder = {
  id: number;
  vendor_id: number | null;
  reference: string;
  status: string;
  order_date: string | null;
  expected_date: string | null;
  received_at: string | null;
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  total_amount: number;
  currency: string;
  notes: string;
  warehouse_id: number | null;
  location_id: number | null;
  lines: PurchaseOrderLine[];
};

type PurchasesPageMode = "list" | "new" | "detail";

const emptyLine = (): PurchaseOrderLine => ({
  product_id: null,
  description: "",
  quantity: 1,
  received_quantity: 0,
  uom: "Units",
  unit_price: 0,
  discount: 0,
  vat_rate: 0,
});

const toDateInputValue = (value: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().split("T")[0];
};

const toIsoDate = (value: string) => (value ? new Date(value).toISOString() : null);

const formatMoney = (value: number, symbol: string) => {
  const safe = Number.isFinite(value) ? value : 0;
  return `${symbol}${safe.toFixed(2)}`;
};

const lineTotals = (line: PurchaseOrderLine) => {
  const qty = Number(line.quantity) || 0;
  const price = Number(line.unit_price) || 0;
  const discount = Number(line.discount) || 0;
  const vat = Number(line.vat_rate) || 0;
  const subtotal = qty * price * (1 - discount / 100);
  const tax = subtotal * (vat / 100);
  return { subtotal, tax, total: subtotal + tax };
};

export default function PurchasesPage({ mode = "list" }: { mode?: PurchasesPageMode }) {
  const navigate = useNavigate();
  const { purchaseId } = useParams();
  const routePurchaseId = purchaseId ? Number(purchaseId) : null;
  const { me } = useMe();
  const companyId = me?.company_ids?.[0];

  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [companySettings, setCompanySettings] = useState<CompanySettings | null>(null);
  const [loadingData, setLoadingData] = useState(false);

  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [listSearch, setListSearch] = useState("");
  const [listStatus, setListStatus] = useState("");
  const [listFrom, setListFrom] = useState("");
  const [listTo, setListTo] = useState("");

  const [form, setForm] = useState({
    vendor_id: null as number | null,
    order_date: "",
    expected_date: "",
    currency: "USD",
    notes: "",
    warehouse_id: null as number | null,
    location_id: null as number | null,
  });
  const [lines, setLines] = useState<PurchaseOrderLine[]>([emptyLine()]);

  const currencySymbol = companySettings?.currency_symbol || "$";

  useEffect(() => {
    if (!companyId) return;
    const loadData = async () => {
      setLoadingData(true);
      const [c, p, o, w, settingsData] = await Promise.all([
        apiFetch<Contact[]>(`/contacts?company_id=${companyId}`),
        apiFetch<Product[]>(`/products/with-stock?company_id=${companyId}`),
        apiFetch<PurchaseOrder[]>(`/purchases?company_id=${companyId}`),
        apiFetch<Warehouse[]>(`/warehouses?company_id=${companyId}`),
        apiFetch<CompanySettings>(`/company-settings?company_id=${companyId}`),
      ]);
      setContacts(c);
      setProducts(
        p.filter((prod) => prod.is_active && prod.can_be_purchased === true),
      );
      setOrders(o);
      setWarehouses(w);
      setCompanySettings(settingsData ?? null);
      if (!form.warehouse_id && w.length) {
        setForm((prev) => ({ ...prev, warehouse_id: w[0].id }));
      }
      setLoadingData(false);
    };
    loadData();
  }, [companyId]);

  useEffect(() => {
    if (!form.warehouse_id) {
      setLocations([]);
      return;
    }
    apiFetch<Location[]>(`/locations?warehouse_id=${form.warehouse_id}`)
      .then((data) => {
        setLocations(data);
        if (!form.location_id && data.length) {
          setForm((prev) => ({ ...prev, location_id: data[0].id }));
        }
      })
      .catch(() => setLocations([]));
  }, [form.warehouse_id]);

  useEffect(() => {
    if (mode === "list") {
      setSelectedOrderId(null);
      setIsEditing(false);
      return;
    }
    if (mode === "detail") {
      setSelectedOrderId(routePurchaseId ?? null);
      setIsEditing(false);
    }
  }, [mode, routePurchaseId]);

  useEffect(() => {
    if (mode === "new" && !isEditing) {
      startNew();
    }
  }, [mode, isEditing, contacts]);

  const selectedOrder = useMemo(
    () => orders.find((o) => o.id === selectedOrderId) ?? null,
    [orders, selectedOrderId]
  );

  useEffect(() => {
    if (!selectedOrder) return;
    setForm({
      vendor_id: selectedOrder.vendor_id,
      order_date: toDateInputValue(selectedOrder.order_date),
      expected_date: toDateInputValue(selectedOrder.expected_date),
      currency: selectedOrder.currency || "USD",
      notes: selectedOrder.notes || "",
      warehouse_id: selectedOrder.warehouse_id,
      location_id: selectedOrder.location_id,
    });
    setLines(
      selectedOrder.lines?.length
        ? selectedOrder.lines.map((line) => {
            const product = products.find((p) => p.id === line.product_id);
            return {
              ...line,
              received_quantity:
                line.received_quantity && line.received_quantity > 0
                  ? line.received_quantity
                  : line.quantity,
              uom: line.uom || product?.uom || "Units",
            };
          })
        : [emptyLine()]
    );
    setIsEditing(false);
  }, [selectedOrder, products]);

  const startNew = () => {
    setSelectedOrderId(null);
    setForm({
      vendor_id: contacts[0]?.id ?? null,
      order_date: new Date().toISOString().split("T")[0],
      expected_date: "",
      currency: companySettings?.currency_code || "USD",
      notes: "",
      warehouse_id: warehouses[0]?.id ?? null,
      location_id: null,
    });
    setLines([emptyLine()]);
    setIsEditing(true);
  };

  const updateLine = (index: number, updates: Partial<PurchaseOrderLine>) => {
    setLines((prev) =>
      prev.map((line, idx) => (idx === index ? { ...line, ...updates } : line))
    );
  };

  const selectProduct = (index: number, productId: number | null) => {
    const product = products.find((p) => p.id === productId);
    updateLine(index, {
      product_id: productId,
      description: product?.name || "",
      uom: product?.uom || "Units",
      unit_price: product?.purchase_cost || 0,
      vat_rate: product?.tax_rate || 0,
    });
  };

  const addLine = () => setLines((prev) => [...prev, emptyLine()]);

  const removeLine = (index: number) => {
    setLines((prev) => prev.filter((_, idx) => idx !== index));
  };

  const totals = useMemo(() => {
    const sums = lines.reduce(
      (acc, line) => {
        const { subtotal, tax, total } = lineTotals(line);
        acc.subtotal += subtotal;
        acc.tax += tax;
        acc.total += total;
        return acc;
      },
      { subtotal: 0, tax: 0, total: 0 }
    );
    return sums;
  }, [lines]);

  const saveOrder = async () => {
    if (!companyId) return;
    setSaving(true);
    const payload = {
      vendor_id: form.vendor_id,
      order_date: toIsoDate(form.order_date),
      expected_date: toIsoDate(form.expected_date),
      currency: form.currency,
      notes: form.notes,
      warehouse_id: form.warehouse_id,
      location_id: form.location_id,
      lines,
    };

    try {
      if (selectedOrderId) {
        await apiFetch<PurchaseOrder>(`/purchases/${selectedOrderId}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
      } else {
        const created = await apiFetch<PurchaseOrder>("/purchases", {
          method: "POST",
          body: JSON.stringify({ ...payload, company_id: companyId }),
        });
        setSelectedOrderId(created.id);
        navigate(`/purchases/${created.id}`);
      }
      const updated = await apiFetch<PurchaseOrder[]>(
        `/purchases?company_id=${companyId}`
      );
      setOrders(updated);
      setIsEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const confirmOrder = async () => {
    if (!selectedOrderId || !companyId) return;
    await apiFetch<PurchaseOrder>(`/purchases/${selectedOrderId}/confirm`, {
      method: "POST",
    });
    const updated = await apiFetch<PurchaseOrder[]>(
      `/purchases?company_id=${companyId}`
    );
    setOrders(updated);
  };

  const receiveOrder = async () => {
    if (!selectedOrderId || !companyId) return;
    const payload = {
      lines: lines
        .filter((line) => line.id)
        .map((line) => ({
          id: line.id as number,
          received_quantity:
            line.received_quantity > 0
              ? line.received_quantity
              : line.quantity,
        })),
    };
    await apiFetch<PurchaseOrder>(`/purchases/${selectedOrderId}/receive`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    const updated = await apiFetch<PurchaseOrder[]>(
      `/purchases?company_id=${companyId}`
    );
    setOrders(updated);
  };

  const cancelOrder = async () => {
    if (!selectedOrderId || !companyId) return;
    await apiFetch<PurchaseOrder>(`/purchases/${selectedOrderId}/cancel`, {
      method: "POST",
    });
    const updated = await apiFetch<PurchaseOrder[]>(
      `/purchases?company_id=${companyId}`
    );
    setOrders(updated);
  };

  const filteredOrders = useMemo(() => {
    const term = listSearch.trim().toLowerCase();
    const fromDate = listFrom ? new Date(listFrom) : null;
    const toDate = listTo ? new Date(listTo + "T23:59:59") : null;
    return orders.filter((o) => {
      if (listStatus && o.status !== listStatus) return false;
      const dateValue = o.order_date ? new Date(o.order_date) : null;
      if (fromDate && dateValue && dateValue < fromDate) return false;
      if (toDate && dateValue && dateValue > toDate) return false;
      if (!term) return true;
      const vendorName = contacts.find((c) => c.id === o.vendor_id)?.name?.toLowerCase() || "";
      return o.reference.toLowerCase().includes(term) || vendorName.includes(term);
    });
  }, [orders, listSearch, listStatus, listFrom, listTo, contacts]);

  const currentStatus = selectedOrder?.status || "draft";
  const canEdit = isEditing || mode === "new" || currentStatus === "draft";

  return (
    <div className="purchases-page invoice-form">
      <div className="page-header">
        <div>
          <h1>Purchases</h1>
          <p className="page-subtitle">Manage purchase orders and receipts</p>
        </div>
        <div className="header-actions">
          {mode === "list" ? (
            <button
              className="primary"
              onClick={() => {
                startNew();
                navigate("/purchases/new");
              }}
            >
              New Purchase
            </button>
          ) : (
            <button className="outline" onClick={() => navigate("/purchases")}>Back to List</button>
          )}
        </div>
      </div>

      {mode === "list" && (
        <div className="card shadow-sm">
          <div className="card-body">
            <div className="d-flex flex-wrap gap-2 align-items-center mb-3">
              <input
                className="form-control"
                placeholder="Search reference or vendor..."
                value={listSearch}
                onChange={(e) => setListSearch(e.target.value)}
                style={{ maxWidth: 240 }}
              />
              <select
                className="form-select"
                value={listStatus}
                onChange={(e) => setListStatus(e.target.value)}
                style={{ maxWidth: 180 }}
              >
                <option value="">All Status</option>
                <option value="draft">Draft</option>
                <option value="confirmed">Confirmed</option>
                <option value="received">Received</option>
                <option value="cancelled">Cancelled</option>
              </select>
              <input
                type="date"
                className="form-control"
                value={listFrom}
                onChange={(e) => setListFrom(e.target.value)}
                style={{ maxWidth: 170 }}
              />
              <input
                type="date"
                className="form-control"
                value={listTo}
                onChange={(e) => setListTo(e.target.value)}
                style={{ maxWidth: 170 }}
              />
            </div>

            <div className="table-responsive">
              <table className="table table-hover align-middle">
                <thead>
                  <tr>
                    <th>Reference</th>
                    <th>Vendor</th>
                    <th>Status</th>
                    <th>Order Date</th>
                    <th className="text-end">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOrders.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center text-muted py-4">
                        {loadingData ? "Loading purchases..." : "No purchase orders found."}
                      </td>
                    </tr>
                  ) : (
                    filteredOrders.map((order) => (
                      <tr
                        key={order.id}
                        style={{ cursor: "pointer" }}
                        onClick={() => navigate(`/purchases/${order.id}`)}
                      >
                        <td style={{ fontFamily: "monospace", fontSize: 12 }}>
                          {order.reference}
                        </td>
                        <td>{contacts.find((c) => c.id === order.vendor_id)?.name || "-"}</td>
                        <td>
                          <span className={`badge ${order.status === "received" ? "badge-success" : order.status === "confirmed" ? "badge-info" : order.status === "cancelled" ? "badge-danger" : "badge-secondary"}`}>
                            {order.status}
                          </span>
                        </td>
                        <td>{toDateInputValue(order.order_date)}</td>
                        <td className="text-end">{formatMoney(order.total_amount, currencySymbol)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {mode !== "list" && (
        <div className="card shadow-sm">
          <div className="card-body invoice-form">
            <div className="d-flex flex-wrap justify-content-between align-items-center mb-3">
              <div>
                <h2 className="mb-1">{selectedOrder?.reference || "New Purchase"}</h2>
                <div className="statusbar">
                  {["draft", "confirmed", "received"].map((step) => (
                    <span
                      key={step}
                      className={`status-pill ${currentStatus === step ? "active" : currentStatus === "received" && step !== "draft" ? "active" : ""}`}
                    >
                      {step}
                    </span>
                  ))}
                </div>
              </div>
              <div className="form-actions">
                {canEdit && (
                  <button className="btn btn-primary btn-sm" onClick={saveOrder} disabled={saving}>
                    {saving ? "Saving..." : "Save"}
                  </button>
                )}
                {!canEdit && currentStatus === "draft" && (
                  <button className="btn btn-outline-secondary btn-sm" onClick={() => setIsEditing(true)}>
                    Edit
                  </button>
                )}
                {selectedOrderId && currentStatus === "draft" && (
                  <button className="btn btn-success btn-sm" onClick={confirmOrder}>Confirm</button>
                )}
                {selectedOrderId && currentStatus === "confirmed" && (
                  <button className="btn btn-success btn-sm" onClick={receiveOrder}>Receive</button>
                )}
                {selectedOrderId && currentStatus !== "received" && (
                  <button className="btn btn-outline-danger btn-sm" onClick={cancelOrder}>Cancel</button>
                )}
              </div>
            </div>

            <div className="row g-3 mb-4">
              <div className="col-md-6">
                <label className="form-label fw-semibold">Vendor</label>
                <select
                  className="form-select input-underline"
                  value={form.vendor_id ?? ""}
                  onChange={(e) => setForm((prev) => ({ ...prev, vendor_id: Number(e.target.value) || null }))}
                  disabled={!canEdit}
                >
                  <option value="">Select vendor</option>
                  {contacts.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div className="col-md-3">
                <label className="form-label fw-semibold">Order Date</label>
                <input
                  type="date"
                  className="form-control input-underline"
                  value={form.order_date}
                  onChange={(e) => setForm((prev) => ({ ...prev, order_date: e.target.value }))}
                  disabled={!canEdit}
                />
              </div>
              <div className="col-md-3">
                <label className="form-label fw-semibold">Expected Date</label>
                <input
                  type="date"
                  className="form-control input-underline"
                  value={form.expected_date}
                  onChange={(e) => setForm((prev) => ({ ...prev, expected_date: e.target.value }))}
                  disabled={!canEdit}
                />
              </div>
              <div className="col-md-4">
                <label className="form-label">Warehouse</label>
                <select
                  className="form-select input-underline"
                  value={form.warehouse_id ?? ""}
                  onChange={(e) => setForm((prev) => ({ ...prev, warehouse_id: Number(e.target.value) || null }))}
                  disabled={!canEdit}
                >
                  <option value="">Select warehouse</option>
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
              </div>
              <div className="col-md-4">
                <label className="form-label">Location</label>
                <select
                  className="form-select input-underline"
                  value={form.location_id ?? ""}
                  onChange={(e) => setForm((prev) => ({ ...prev, location_id: Number(e.target.value) || null }))}
                  disabled={!canEdit}
                >
                  <option value="">Select location</option>
                  {locations.map((l) => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </select>
              </div>
              <div className="col-md-4">
                <label className="form-label">Currency</label>
                <input
                  className="form-control input-underline"
                  value={form.currency}
                  onChange={(e) => setForm((prev) => ({ ...prev, currency: e.target.value }))}
                  disabled={!canEdit}
                />
              </div>
              <div className="col-12">
                <label className="form-label">Notes</label>
                <textarea
                  className="form-control input-underline"
                  rows={2}
                  value={form.notes}
                  onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
                  disabled={!canEdit}
                />
              </div>
            </div>

            <div className="card border-0 bg-light">
              <div className="card-body">
                <div className="d-flex align-items-center justify-content-between mb-2">
                  <h5 className="mb-0">Order Lines</h5>
                  {canEdit && (
                    <button className="btn btn-sm btn-outline-primary" onClick={addLine}>+ Add Line</button>
                  )}
                </div>
                <div className="table-responsive">
                  <table className="table table-sm align-middle">
                    <thead>
                      <tr>
                        <th style={{ minWidth: 180 }}>Product</th>
                        <th>Description</th>
                        <th className="text-end">Qty</th>
                        <th className="text-end">Received Qty</th>
                        <th>UoM</th>
                        <th className="text-end">Unit Price</th>
                        <th className="text-end">Discount %</th>
                        <th className="text-end">VAT %</th>
                        <th className="text-end">Subtotal</th>
                        <th className="text-end">Total</th>
                        {canEdit && <th />}
                      </tr>
                    </thead>
                    <tbody>
                      {lines.map((line, index) => {
                        const totals = lineTotals(line);
                        return (
                          <tr key={index}>
                            <td>
                              <select
                                className="form-select form-select-sm input-ghost"
                                value={line.product_id ?? ""}
                                onChange={(e) => selectProduct(index, Number(e.target.value) || null)}
                                disabled={!canEdit}
                              >
                                <option value="">Select</option>
                                {products.map((p) => (
                                  <option key={p.id} value={p.id}>{p.name}</option>
                                ))}
                              </select>
                            </td>
                            <td>
                              <input
                                className="form-control form-control-sm input-ghost"
                                value={line.description}
                                onChange={(e) => updateLine(index, { description: e.target.value })}
                                disabled={!canEdit}
                              />
                            </td>
                            <td className="text-end">
                              <input
                                className="form-control form-control-sm text-end input-ghost"
                                type="number"
                                min="0"
                                value={line.quantity}
                                onChange={(e) => updateLine(index, { quantity: Number(e.target.value) || 0 })}
                                disabled={!canEdit}
                              />
                            </td>
                            <td className="text-end">
                              <input
                                className="form-control form-control-sm text-end input-ghost"
                                type="number"
                                min="0"
                                value={line.received_quantity}
                                onChange={(e) =>
                                  updateLine(index, {
                                    received_quantity: Number(e.target.value) || 0,
                                  })
                                }
                                disabled={currentStatus !== "confirmed"}
                              />
                            </td>
                            <td>
                              <input
                                className="form-control form-control-sm input-ghost"
                                value={line.uom}
                                onChange={(e) => updateLine(index, { uom: e.target.value })}
                                disabled={!canEdit}
                              />
                            </td>
                            <td className="text-end">
                              <input
                                className="form-control form-control-sm text-end input-ghost"
                                type="number"
                                min="0"
                                value={line.unit_price}
                                onChange={(e) => updateLine(index, { unit_price: Number(e.target.value) || 0 })}
                                disabled={!canEdit}
                              />
                            </td>
                            <td className="text-end">
                              <input
                                className="form-control form-control-sm text-end input-ghost"
                                type="number"
                                min="0"
                                value={line.discount}
                                onChange={(e) => updateLine(index, { discount: Number(e.target.value) || 0 })}
                                disabled={!canEdit}
                              />
                            </td>
                            <td className="text-end">
                              <input
                                className="form-control form-control-sm text-end input-ghost"
                                type="number"
                                min="0"
                                value={line.vat_rate}
                                onChange={(e) => updateLine(index, { vat_rate: Number(e.target.value) || 0 })}
                                disabled={!canEdit}
                              />
                            </td>
                            <td className="text-end fw-semibold">{formatMoney(totals.subtotal, currencySymbol)}</td>
                            <td className="text-end fw-semibold">{formatMoney(totals.total, currencySymbol)}</td>
                            {canEdit && (
                              <td className="text-center">
                                <button className="btn btn-sm btn-light border" onClick={() => removeLine(index)}>
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
                <div className="d-flex justify-content-end">
                  <div style={{ minWidth: 260 }}>
                    <div className="d-flex justify-content-between mb-1">
                      <span>Subtotal</span>
                      <strong>{formatMoney(totals.subtotal, currencySymbol)}</strong>
                    </div>
                    <div className="d-flex justify-content-between mb-1">
                      <span>VAT</span>
                      <strong>{formatMoney(totals.tax, currencySymbol)}</strong>
                    </div>
                    <div className="d-flex justify-content-between">
                      <span>Total</span>
                      <strong>{formatMoney(totals.total, currencySymbol)}</strong>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
