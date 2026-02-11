import { useEffect, useMemo, useState } from "react";
import html2pdf from "html2pdf.js";
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
  logo_data?: string;
  document_header?: string;
  document_footer?: string;
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
  subtotal?: number;
  total_price?: number;
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

  const printOrder = () => {
    if (!selectedOrder) return;
    const vendor = contacts.find((c) => c.id === selectedOrder.vendor_id);
    const formatAddressLines = (
      address?: string,
      city?: string,
      country?: string,
    ) => {
      const parts = (address || "")
        .split(/\r?\n|,/)
        .map((part) => part.trim())
        .filter(Boolean);
      const street1 = parts[0] || "";
      const street2 = parts[1] || "";
      return {
        line1: [street1, street2].filter(Boolean).join(", "),
        line2: (city || "").trim(),
        line3: (country || "").trim(),
      };
    };
    const vendorAddress = formatAddressLines(
      vendor?.address,
      vendor?.city,
      vendor?.country,
    );
    const lineRows = (selectedOrder.lines || []).map((line) => {
      const product = products.find((p) => p.id === line.product_id);
      const totals = lineTotals(line);
      const qtyLabel = `${line.quantity} ${line.uom || product?.uom || "Units"}`.trim();
      return {
        name: product?.name || line.description || "-",
        description: line.description || product?.name || "-",
        quantity: qtyLabel,
        unit_price: line.unit_price,
        vat_rate: line.vat_rate,
        subtotal: line.subtotal ?? totals.subtotal,
        total: line.total_price ?? totals.total,
      };
    });

    const logo = companySettings?.logo_data || "";
    const headerText = companySettings?.document_header || "";
    const footerText = companySettings?.document_footer || "";
    const footerHtml = footerText.replace(/\n/g, "<br />");
    const html = `<!DOCTYPE html><html><head><title>Purchase ${selectedOrder.reference}</title><style>
      :root { --ink: #0f172a; --muted: #6b7280; --line: #e5e7eb; --soft: #f8fafc; --accent: #1e4f9b; }
      @page { size: A4; margin: 14mm; }
      * { box-sizing: border-box; }
      body { font-family: "Segoe UI", Inter, Arial, sans-serif; color: var(--ink); margin: 0; padding: 18px; font-size: 12px; }
      .doc { position: relative; }
      .header-row { display: flex; justify-content: space-between; gap: 24px; align-items: flex-start; }
      .brand { display: flex; align-items: center; gap: 14px; }
      .logo { width: 86px; height: 86px; object-fit: contain; border-radius: 0; border: none; background: transparent; padding: 0; }
      .brand-details { font-size: 12px; line-height: 1.5; color: var(--muted); }
      .brand-details strong { color: var(--ink); }
      .company-details { text-align: right; font-size: 12px; line-height: 1.5; color: var(--muted); }
      .company-details strong { color: var(--ink); }
      .title-block { text-align: left; }
      .title-block h1 { margin: 0 0 8px; font-size: 26px; letter-spacing: 0.6px; }
      .title-meta { display: grid; gap: 6px; font-size: 12px; color: var(--muted); }
      .divider { border-top: 1px solid var(--line); margin: 16px 0; }
      .addresses { display: grid; grid-template-columns: 1fr 1fr; gap: 22px; font-size: 12px; }
      .addresses h4 { margin: 0 0 6px; font-size: 11px; letter-spacing: 0.6px; text-transform: uppercase; color: var(--accent); }
      .addresses .block { line-height: 1.5; }
      table { width: 100%; border-collapse: collapse; margin-top: 18px; font-size: 12px; }
      thead th { background: var(--accent); color: #fff; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; padding: 8px 10px; text-align: left; }
      tbody td { padding: 8px 10px; border-bottom: 1px solid var(--line); }
      tbody tr:nth-child(even) td { background: #f9fafb; }
      .totals { margin-top: 16px; display: flex; justify-content: flex-end; }
      .totals-card { border: 1px solid var(--line); border-radius: 10px; overflow: hidden; }
      .totals-row { display: flex; justify-content: space-between; padding: 8px 12px; border-bottom: 1px solid var(--line); font-size: 12px; }
      .totals-row:last-child { border-bottom: none; font-weight: 700; background: #f8fafc; }
      .doc-footer { margin-top: 18px; padding-top: 10px; border-top: 1px solid var(--line); font-size: 11px; color: var(--muted); text-align: center; }
    </style></head><body>
      <div class="doc">
        <div class="header-row">
          <div class="brand">
            ${logo ? `<img class="logo" src="${logo}" alt="Company Logo" />` : `<div class="logo"></div>`}
            <div class="brand-details">
              <strong>${headerText || "Purchase Order"}</strong><br />
              ${vendor?.name || "-"}
            </div>
          </div>
          <div class="company-details">
            <strong>${headerText || "Purchase Order"}</strong><br />
            ${vendorAddress.line1 ? `${vendorAddress.line1}<br />` : ""}
            ${vendorAddress.line2 ? `${vendorAddress.line2}<br />` : ""}
            ${vendorAddress.line3 ? `${vendorAddress.line3}<br />` : ""}
            ${vendor?.phone || ""}
          </div>
        </div>

        <div class="divider"></div>

        <div class="addresses">
          <div class="block">
            <h4>Vendor</h4>
            <strong>${vendor?.name || "-"}</strong><br />
            ${vendorAddress.line1 ? `${vendorAddress.line1}<br />` : ""}
            ${vendorAddress.line2 ? `${vendorAddress.line2}<br />` : ""}
            ${vendorAddress.line3 ? `${vendorAddress.line3}<br />` : ""}
            ${vendor?.phone || ""}
          </div>
          <div class="block title-block">
            <h1>PURCHASE ORDER</h1>
            <div class="title-meta">
              <div><strong>Issue Date:</strong> ${toDateInputValue(selectedOrder.order_date)}</div>
              <div><strong>Expected Date:</strong> ${toDateInputValue(selectedOrder.expected_date)}</div>
              <div><strong>PO #:</strong> ${selectedOrder.reference}</div>
              <div><strong>Status:</strong> ${selectedOrder.status}</div>
            </div>
          </div>
        </div>


        <table>
          <thead>
            <tr>
              <th>Item</th>
              <th style="text-align:right;">Quantity</th>
              <th style="text-align:right;">Price</th>
              <th style="text-align:right;">VAT %</th>
              <th style="text-align:right;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${lineRows
              .map(
                (row) => `
              <tr>
                <td>${row.description}</td>
                <td style="text-align:right;">${row.quantity}</td>
                <td style="text-align:right;">${formatMoney(row.unit_price, currencySymbol)}</td>
                <td style="text-align:right;">${row.vat_rate}</td>
                <td style="text-align:right;">${formatMoney(row.total, currencySymbol)}</td>
              </tr>`
              )
              .join("")}
          </tbody>
        </table>

        <div class="totals">
          <div class="totals-card">
            <div class="totals-row"><span>Subtotal</span><span>${formatMoney(selectedOrder.subtotal, currencySymbol)}</span></div>
            <div class="totals-row"><span>VAT</span><span>${formatMoney(selectedOrder.tax_amount, currencySymbol)}</span></div>
            <div class="totals-row"><span>Total</span><span>${formatMoney(selectedOrder.total_amount, currencySymbol)}</span></div>
          </div>
        </div>
        ${footerHtml ? `<div class="doc-footer">${footerHtml}</div>` : ""}
      </div>
    </body></html>`;
    const container = document.createElement("div");
    container.innerHTML = html;
    document.body.appendChild(container);
    html2pdf()
      .set({
        margin: [10, 10, 10, 10],
        filename: `${selectedOrder.reference}.pdf`,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
      })
      .from(container)
      .save()
      .finally(() => {
        document.body.removeChild(container);
      });
  };

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
          {mode !== "list" && (
            <button className="outline" onClick={() => navigate("/purchases")}>Back to List</button>
          )}
        </div>
      </div>

      {mode === "list" && (
        <div className="two-panel two-panel-left">
          <aside className="sidebar-panel filter-sidebar">
            <div className="filter-sidebar-title">Filters</div>
            <div className="filter-group">
              <div className="filter-button-stack">
                {["", "draft", "confirmed", "received", "cancelled"].map((status) => (
                  <button
                    key={status || "all"}
                    className={`filter-btn ${status ? `status-${status}` : "status-all"} ${listStatus === status ? "active" : ""}`}
                    onClick={() => setListStatus(status)}
                  >
                    <span className="filter-icon">
                      {status === "" && (
                        <svg viewBox="0 0 24 24"><path d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z"/></svg>
                      )}
                      {status === "draft" && (
                        <svg viewBox="0 0 24 24"><path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zM6 20V4h7v5h5v11H6z"/></svg>
                      )}
                      {status === "confirmed" && (
                        <svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
                      )}
                      {status === "received" && (
                        <svg viewBox="0 0 24 24"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1s3.1 1.39 3.1 3.1v2z"/></svg>
                      )}
                      {status === "cancelled" && (
                        <svg viewBox="0 0 24 24"><path d="M12 2C6.47 2 2 6.47 2 12s4.47 10 10 10 10-4.47 10-10S17.53 2 12 2zm5 13.59L15.59 17 12 13.41 8.41 17 7 15.59 10.59 12 7 8.41 8.41 7 12 10.59 15.59 7 17 8.41 13.41 12 17 15.59z"/></svg>
                      )}
                    </span>
                    {status ? status.charAt(0).toUpperCase() + status.slice(1) : "All Purchases"}
                  </button>
                ))}
              </div>
            </div>
            <div className="sidebar-divider" />
            <div className="filter-label">Date Range</div>
            <div className="filter-group">
              <div className="filter-date-grid">
                <input
                  type="date"
                  className="form-control"
                  value={listFrom}
                  onChange={(e) => setListFrom(e.target.value)}
                />
                <input
                  type="date"
                  className="form-control"
                  value={listTo}
                  onChange={(e) => setListTo(e.target.value)}
                />
              </div>
            </div>
            <div className="filter-actions">
              <button
                className="btn w-100"
                onClick={() => {
                  setListSearch("");
                  setListStatus("");
                  setListFrom("");
                  setListTo("");
                }}
              >
                Clear Filters
              </button>
            </div>
          </aside>

          <div>
            <div className="content-top-bar">
              <div className="top-search">
                <span className="search-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                </span>
                <input
                  placeholder="Search purchases…"
                  value={listSearch}
                  onChange={(e) => setListSearch(e.target.value)}
                />
              </div>
              <button
                className="btn-create"
                onClick={() => {
                  startNew();
                  navigate("/purchases/new");
                }}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                New Purchase
              </button>
            </div>
            <div className="card shadow-sm">
              <div className="card-body">
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
                {selectedOrderId && (
                  <button className="btn btn-outline-secondary btn-sm" onClick={printOrder}>
                    Print
                  </button>
                )}
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
