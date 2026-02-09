import { useEffect, useMemo, useRef, useState } from "react";
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
  invoice_type: string;
  reversed_invoice_id: number | null;
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
  payment_reference: string;
  notes: string;
  device_id?: number | null;
  zimra_status?: string;
  zimra_verification_code?: string;
  zimra_verification_url?: string;
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
  reference?: string;
  hs_code?: string;
  uom?: string;
  quantity_on_hand?: number;
  quantity_available?: number;
  quantity_reserved?: number;
  stock_value?: number;
};

type Device = {
  id: number;
  device_id: string;
  serial_number?: string;
  model?: string;
};

type Warehouse = {
  id: number;
  name: string;
};

type Location = {
  id: number;
  name: string;
  warehouse_id: number;
};

const currencyOptions = ["USD", "ZWL", "ZAR", "EUR", "GBP", "KES", "UGX", "NGN", "TZS"];

const formatCurrency = (value: number, currency: string) => {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(value || 0);
  } catch {
    return `${currency} ${(value || 0).toFixed(2)}`;
  }
};

const toDateInputValue = (value: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().split("T")[0];
};

const fromDateInputValue = (value: string) => (value ? new Date(value).toISOString() : null);

const getPaymentStatus = (amountPaid: number, amountDue: number) => {
  if (amountDue <= 0) return "Paid";
  if (amountPaid > 0) return "Partial";
  return "Unpaid";
};

export default function InvoicesPage() {
  const { me } = useMe();
  const companyId = me?.company_ids?.[0];
  const company = me?.companies?.find((c) => c.id === companyId);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<number | null>(null);
  const [newMode, setNewMode] = useState(false);
  const [newQuotationId, setNewQuotationId] = useState<number | null>(null);
  const [newCustomerId, setNewCustomerId] = useState<number | null>(null);
  const [newReference, setNewReference] = useState("");
  const [newCurrency, setNewCurrency] = useState("USD");
  const [newInvoiceDate, setNewInvoiceDate] = useState("");
  const [newDueDate, setNewDueDate] = useState("");
  const [newPaymentTerms, setNewPaymentTerms] = useState("");
  const [newNotes, setNewNotes] = useState("");
  const [newDeviceId, setNewDeviceId] = useState<number | null>(null);
  const [editQuotationId, setEditQuotationId] = useState<number | null>(null);
  const [editCustomerId, setEditCustomerId] = useState<number | null>(null);
  const [editReference, setEditReference] = useState("");
  const [editCurrency, setEditCurrency] = useState("USD");
  const [editInvoiceDate, setEditInvoiceDate] = useState("");
  const [editDueDate, setEditDueDate] = useState("");
  const [editPaymentTerms, setEditPaymentTerms] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editDeviceId, setEditDeviceId] = useState<number | null>(null);
  const [editLines, setEditLines] = useState<Partial<InvoiceLine>[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [listSearch, setListSearch] = useState("");
  const [listStatus, setListStatus] = useState("");
  const [listType, setListType] = useState("");
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentReference, setPaymentReference] = useState("");
  const [createProductOpen, setCreateProductOpen] = useState(false);
  const [productName, setProductName] = useState("");
  const [productPrice, setProductPrice] = useState("");
  const [productTaxRate, setProductTaxRate] = useState("");
  const [productReference, setProductReference] = useState("");
  const [productHsCode, setProductHsCode] = useState("");
  const [productUom, setProductUom] = useState("PCS");
  const [productInitialStock, setProductInitialStock] = useState("");
  const [productWarehouseId, setProductWarehouseId] = useState<number | null>(null);
  const [productLocationId, setProductLocationId] = useState<number | null>(null);
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerDropdownOpen, setCustomerDropdownOpen] = useState(false);
  const [customerCreating, setCustomerCreating] = useState(false);
  const customerDropdownRef = useRef<HTMLDivElement>(null);

  const filteredContacts = contacts.filter((c) =>
    c.name.toLowerCase().includes(customerSearch.toLowerCase())
  );
  const topContacts = contacts.slice(0, 3);
  const displayContacts = customerSearch.trim() ? filteredContacts : topContacts;

  const selectCustomer = (id: number, name: string, mode: "new" | "edit") => {
    if (mode === "new") {
      setNewCustomerId(id);
    } else {
      setEditCustomerId(id);
    }
    setCustomerSearch(name);
    setCustomerDropdownOpen(false);
  };

  const createCustomerFromSearch = async (mode: "new" | "edit") => {
    if (!companyId) return;
    const name = customerSearch.trim();
    if (!name) return;
    const exists = contacts.some((c) => c.name.toLowerCase() === name.toLowerCase());
    if (exists) return;
    setCustomerCreating(true);
    setError(null);
    try {
      const created = await apiFetch<Contact>("/contacts", {
        method: "POST",
        body: JSON.stringify({
          company_id: companyId,
          name
        })
      });
      setContacts((prev) => [created, ...prev]);
      selectCustomer(created.id, created.name, mode);
    } catch (err: any) {
      setError(err.message || "Failed to create customer");
    } finally {
      setCustomerCreating(false);
    }
  };

  // Close customer dropdown when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (customerDropdownRef.current && !customerDropdownRef.current.contains(e.target as Node)) {
        setCustomerDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const loadAll = async () => {
    if (!companyId) return;
    setLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams({
        company_id: String(companyId),
        ...(listSearch ? { search: listSearch } : {}),
        ...(listStatus ? { status: listStatus } : {}),
        ...(listType ? { invoice_type: listType } : {})
      }).toString();
      const [invoiceData, quotationData, contactData, productData, warehouseData, deviceData] = await Promise.all([
        apiFetch<Invoice[]>(`/invoices?${query}`),
        apiFetch<Quotation[]>(`/quotations?company_id=${companyId}`),
        apiFetch<Contact[]>(`/contacts?company_id=${companyId}`),
        apiFetch<Product[]>(`/products/with-stock?company_id=${companyId}`),
        apiFetch<Warehouse[]>(`/warehouses?company_id=${companyId}`),
        apiFetch<Device[]>(`/devices?company_id=${companyId}`)
      ]);
      setInvoices(invoiceData);
      setQuotations(quotationData);
      setContacts(contactData);
      setProducts(productData);
      setDevices(deviceData);
      setWarehouses(warehouseData);
      if (!productWarehouseId && warehouseData.length) {
        setProductWarehouseId(warehouseData[0].id);
      }
      if (!newDeviceId && deviceData.length) {
        setNewDeviceId(deviceData[0].id);
      }
      if (invoiceData.length && !selectedInvoiceId) {
        setSelectedInvoiceId(invoiceData[0].id);
      }
      if (selectedInvoiceId && !invoiceData.find((inv) => inv.id === selectedInvoiceId)) {
        setSelectedInvoiceId(invoiceData[0]?.id ?? null);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load invoices");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, [companyId, listSearch, listStatus, listType]);

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
    if (!newQuotationId) return;
    const quotation = quotations.find((q) => q.id === newQuotationId);
    if (quotation?.customer_id) {
      setNewCustomerId(quotation.customer_id);
    }
  }, [newQuotationId, quotations]);

  const selectedInvoice = useMemo(() => {
    return invoices.find((inv) => inv.id === selectedInvoiceId) ?? null;
  }, [invoices, selectedInvoiceId]);

  useEffect(() => {
    if (!selectedInvoice) return;
    setEditQuotationId(selectedInvoice.quotation_id ?? null);
    setEditCustomerId(selectedInvoice.customer_id ?? null);
    const cust = contacts.find((c) => c.id === selectedInvoice.customer_id);
    setCustomerSearch(cust?.name || "");
    setCustomerDropdownOpen(false);
    setEditReference(selectedInvoice.reference ?? "");
    setEditCurrency(selectedInvoice.currency || "USD");
    setEditInvoiceDate(toDateInputValue(selectedInvoice.invoice_date));
    setEditDueDate(toDateInputValue(selectedInvoice.due_date));
    setEditPaymentTerms(selectedInvoice.payment_terms || "");
    setEditNotes(selectedInvoice.notes || "");
    setEditDeviceId(selectedInvoice.device_id ?? null);
    setEditLines(selectedInvoice.lines?.length ? selectedInvoice.lines.map((l) => ({ ...l })) : []);
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

  const invoiceDateLabel = selectedInvoice?.invoice_date
    ? new Date(selectedInvoice.invoice_date).toLocaleDateString()
    : selectedInvoice?.fiscalized_at
    ? new Date(selectedInvoice.fiscalized_at).toLocaleDateString()
    : "-";

  const invoiceCurrency = newMode ? newCurrency : selectedInvoice?.currency || editCurrency || "USD";
  const isCreditNote = selectedInvoice?.invoice_type === "credit_note";

  const newTotal = newQuotation
    ? newQuotation.lines.reduce((sum, line) => sum + line.total_price, 0)
    : 0;

  const amountLabel = newMode
    ? formatCurrency(newTotal, newCurrency)
    : selectedInvoice
      ? formatCurrency(selectedInvoice.total_amount, invoiceCurrency)
      : "-";

  const statusLabel = selectedInvoice?.status ?? "draft";
  const paymentStatus = selectedInvoice ? getPaymentStatus(selectedInvoice.amount_paid, selectedInvoice.amount_due) : "-";
  const paymentBadge = paymentStatus === "Paid" ? "success" : paymentStatus === "Partial" ? "warning" : "secondary";

  const beginNew = () => {
    setNewMode(true);
    setIsEditing(true);
    setSelectedInvoiceId(null);
    setNewQuotationId(null);
    setNewCustomerId(contacts[0]?.id ?? null);
    setCustomerSearch(contacts[0]?.name ?? "");
    setCustomerDropdownOpen(false);
    setNewReference("");
    setNewCurrency("USD");
    setNewInvoiceDate("");
    setNewDueDate("");
    setNewPaymentTerms("");
    setNewNotes("");
    setNewDeviceId(devices[0]?.id ?? null);
    setEditLines([
      {
        product_id: null,
        description: "",
        quantity: 1,
        uom: "",
        unit_price: 0,
        discount: 0,
        vat_rate: 0
      }
    ]);
  };

  const createInvoice = async () => {
    if (!companyId) return;
    setError(null);
    setLoading(true);
    try {
      const created = await apiFetch<Invoice>("/invoices", {
        method: "POST",
        body: JSON.stringify({
          company_id: companyId,
          quotation_id: newQuotationId,
          customer_id: newCustomerId,
          // Let the backend auto-generate the reference
          reference: null,
          currency: newCurrency,
          invoice_date: fromDateInputValue(newInvoiceDate),
          due_date: fromDateInputValue(newDueDate),
          payment_terms: newPaymentTerms,
          notes: newNotes,
          device_id: newDeviceId,
          invoice_type: "invoice",
          lines: editLines.map((line) => ({
            product_id: line.product_id,
            description: line.description || "",
            quantity: line.quantity || 1,
            uom: line.uom || "PCS",
            unit_price: line.unit_price || 0,
            discount: line.discount || 0,
            vat_rate: line.vat_rate || 0
          }))
        })
      });
      setSelectedInvoiceId(created.id);
      setNewMode(false);
      setIsEditing(false);
      await loadAll();
    } catch (err: any) {
      setError(err.message || "Failed to create invoice");
    } finally {
      setLoading(false);
    }
  };

  const saveInvoice = async () => {
    if (!selectedInvoiceId) return;
    setError(null);
    setLoading(true);
    try {
      await apiFetch<Invoice>(`/invoices/${selectedInvoiceId}`, {
        method: "PATCH",
        body: JSON.stringify({
          quotation_id: editQuotationId,
          customer_id: editCustomerId,
          reference: editReference,
          currency: editCurrency,
          invoice_date: fromDateInputValue(editInvoiceDate),
          due_date: fromDateInputValue(editDueDate),
          payment_terms: editPaymentTerms,
          notes: editNotes,
          device_id: editDeviceId,
          lines: editLines.map((line) => ({
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
    } catch (err: any) {
      setError(err.message || "Failed to save invoice");
    } finally {
      setLoading(false);
    }
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
    const deviceId = editDeviceId ?? selectedInvoice?.device_id ?? null;
    if (!deviceId) {
      setError("Assign a fiscal device before fiscalizing");
      return;
    }
    try {
      await apiFetch<Invoice>(`/invoices/${selectedInvoiceId}/fiscalize`, { method: "POST" });
      await loadAll();
    } catch (err: any) {
      setError(err.message || "Failed to fiscalize invoice");
    }
  };

  const registerPayment = async () => {
    if (!selectedInvoiceId) return;
    const amount = Number(paymentAmount);
    if (!amount || Number.isNaN(amount)) return;
    await apiFetch<Invoice>(`/invoices/${selectedInvoiceId}/pay?amount=${amount}&payment_reference=${encodeURIComponent(paymentReference)}`, {
      method: "POST"
    });
    setPaymentOpen(false);
    setPaymentAmount("");
    setPaymentReference("");
    await loadAll();
  };

  const createCreditNote = async () => {
    if (!selectedInvoiceId) return;
    try {
      const credit = await apiFetch<Invoice>(`/invoices/${selectedInvoiceId}/credit-note`, { method: "POST" });
      setSelectedInvoiceId(credit.id);
      await loadAll();
    } catch (err: any) {
      setError(err.message || "Failed to create credit note");
    }
  };

  const updateLine = (index: number, patch: Partial<InvoiceLine>) => {
    setEditLines((prev) => prev.map((line, idx) => (idx === index ? { ...line, ...patch } : line)));
  };

  const addLine = () => {
    setEditLines((prev) => [
      ...prev,
      {
        product_id: null,
        description: "",
        quantity: 1,
        uom: "",
        unit_price: 0,
        discount: 0,
        vat_rate: 0
      }
    ]);
  };

  const createProduct = async () => {
    if (!companyId) return;
    if (!productName.trim()) return;
    const initialQty = Number(productInitialStock) || 0;
    if (initialQty > 0 && (!productWarehouseId || !productLocationId)) {
      setError("Select warehouse and location for initial stock");
      return;
    }
    const created = await apiFetch<Product>("/products", {
      method: "POST",
      body: JSON.stringify({
        company_id: companyId,
        name: productName.trim(),
        reference: productReference.trim(),
        hs_code: productHsCode.trim(),
        sale_price: Number(productPrice) || 0,
        tax_rate: Number(productTaxRate) || 0,
        uom: productUom
      })
    });

    if (initialQty > 0 && productWarehouseId && productLocationId) {
      const move = await apiFetch<{ id: number }>("/stock/moves", {
        method: "POST",
        body: JSON.stringify({
          company_id: companyId,
          product_id: created.id,
          warehouse_id: productWarehouseId,
          location_id: productLocationId,
          move_type: "in",
          quantity: initialQty,
          unit_cost: created.sale_price || 0,
          reference: `Init ${created.name}`
        })
      });
      await apiFetch(`/stock/moves/${move.id}/confirm`, { method: "POST" });
    }

    setCreateProductOpen(false);
    setProductName("");
    setProductReference("");
    setProductHsCode("");
    setProductPrice("");
    setProductTaxRate("");
    setProductUom("PCS");
    setProductInitialStock("");
    await loadAll();
  };

  const removeLine = (index: number) => {
    setEditLines((prev) => prev.filter((_, idx) => idx !== index));
  };

  const displayLines = isEditing ? editLines : selectedInvoice?.lines ?? [];
  const canEdit = isEditing && statusLabel === "draft" && !isCreditNote;

  const taxBreakdown = useMemo(() => {
    const map = new Map<number, number>();
    displayLines.forEach((line) => {
      const rate = line.vat_rate || 0;
      const current = map.get(rate) || 0;
      map.set(rate, current + (line.tax_amount || 0));
    });
    return Array.from(map.entries()).sort((a, b) => a[0] - b[0]);
  }, [displayLines]);

  const printInvoice = () => {
    if (!selectedInvoice) return;
    const win = window.open("", "_blank");
    if (!win) return;
    const lines = selectedInvoice.lines || [];
    const currency = selectedInvoice.currency || "USD";
    const rows = lines
      .map((line) => {
        const total = (line.quantity || 0) * (line.unit_price || 0) * (1 - (line.discount || 0) / 100) * (1 + (line.vat_rate || 0) / 100);
        return `
          <tr>
            <td>${line.description || ""}</td>
            <td style="text-align:right;">${line.quantity || 0}</td>
            <td style="text-align:right;">${(line.unit_price || 0).toFixed(2)}</td>
            <td style="text-align:right;">${(line.discount || 0).toFixed(2)}%</td>
            <td style="text-align:right;">${(line.vat_rate || 0).toFixed(2)}%</td>
            <td style="text-align:right;">${formatCurrency(total, currency)}</td>
          </tr>
        `;
      })
      .join("");

    const html = `
      <html>
        <head>
          <title>${selectedInvoice.reference}</title>
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
            <strong>${selectedInvoice.invoice_type === "credit_note" ? "Credit Note" : "Invoice"}</strong>
            <div class="muted">Reference: ${selectedInvoice.reference}</div>
            <div class="muted">Date: ${invoiceDateLabel}</div>
            <div class="muted">Customer: ${customer?.name || "-"}</div>
          </div>
          <div class="section">
            <table>
              <thead>
                <tr>
                  <th>Description</th>
                  <th style="text-align:right;">Qty</th>
                  <th style="text-align:right;">Price</th>
                  <th style="text-align:right;">Disc</th>
                  <th style="text-align:right;">Tax</th>
                  <th style="text-align:right;">Amount</th>
                </tr>
              </thead>
              <tbody>
                ${rows}
              </tbody>
            </table>
            <div class="totals">
              <div><span>Subtotal</span><span>${formatCurrency(selectedInvoice.subtotal || 0, currency)}</span></div>
              <div><span>Tax</span><span>${formatCurrency(selectedInvoice.tax_amount || 0, currency)}</span></div>
              <div><strong>Total</strong><strong>${formatCurrency(selectedInvoice.total_amount || 0, currency)}</strong></div>
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

  // Determine which "screen" to show: list, new-form, or detail
  const showForm = newMode || selectedInvoice;

  const goBackToList = () => {
    setNewMode(false);
    setIsEditing(false);
    setSelectedInvoiceId(null);
  };

  return (
    <div className="container-fluid py-3">
      {error && (
        <div className="alert alert-danger alert-dismissible fade show" role="alert">
          {error}
          <button type="button" className="btn-close" onClick={() => setError(null)} />
        </div>
      )}

      {/* ───────────── LIST VIEW ───────────── */}
      {!showForm && (
        <div>
          <div className="d-flex flex-wrap justify-content-between align-items-center mb-3">
            <div>
              <h3 className="fw-bold mb-0">Invoices</h3>
              <small className="text-muted">Professional invoicing, payments, taxes, and fiscalization.</small>
            </div>
            <button className="btn btn-primary" onClick={beginNew}>+ New Invoice</button>
          </div>

          <div className="card shadow-sm">
            <div className="card-body p-0">
              <div className="d-flex flex-wrap gap-2 p-3 border-bottom bg-light">
                <input
                  className="form-control"
                  style={{ maxWidth: 280 }}
                  placeholder="Search by reference or status…"
                  value={listSearch}
                  onChange={(e) => setListSearch(e.target.value)}
                />
                <select className="form-select" style={{ maxWidth: 160 }} value={listStatus} onChange={(e) => setListStatus(e.target.value)}>
                  <option value="">All Status</option>
                  <option value="draft">Draft</option>
                  <option value="posted">Posted</option>
                  <option value="paid">Paid</option>
                  <option value="fiscalized">Fiscalized</option>
                </select>
                <select className="form-select" style={{ maxWidth: 160 }} value={listType} onChange={(e) => setListType(e.target.value)}>
                  <option value="">All Types</option>
                  <option value="invoice">Invoice</option>
                  <option value="credit_note">Credit Note</option>
                </select>
              </div>

              <div className="table-responsive">
                <table className="table table-hover align-middle mb-0">
                  <thead className="table-light">
                    <tr>
                      <th>Reference</th>
                      <th>Customer</th>
                      <th>Date</th>
                      <th>Status</th>
                      <th>Payment</th>
                      <th className="text-end">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading && (
                      <tr><td colSpan={6} className="text-center py-5 text-muted">Loading invoices…</td></tr>
                    )}
                    {!loading && invoices.length === 0 && (
                      <tr><td colSpan={6} className="text-center py-5 text-muted">No invoices yet. Click <strong>+ New Invoice</strong> to create one.</td></tr>
                    )}
                    {invoices.map((inv) => {
                      const cust = contactById.get(inv.customer_id ?? 0);
                      return (
                        <tr
                          key={inv.id}
                          role="button"
                          onClick={() => {
                            setSelectedInvoiceId(inv.id);
                            setNewMode(false);
                            setIsEditing(false);
                          }}
                        >
                          <td>
                            <div className="fw-semibold">{inv.reference}</div>
                            <small className="text-muted">{inv.invoice_type === "credit_note" ? "Credit Note" : "Invoice"}</small>
                          </td>
                          <td>{cust?.name || "—"}</td>
                          <td className="text-muted">{inv.invoice_date ? new Date(inv.invoice_date).toLocaleDateString() : "—"}</td>
                          <td>
                            <span className={`badge ${inv.status === "paid" ? "bg-success" : inv.status === "posted" ? "bg-info" : inv.status === "fiscalized" ? "bg-primary" : "bg-secondary"}`}>
                              {inv.status}
                            </span>
                          </td>
                          <td>
                            <span className={`badge bg-${getPaymentStatus(inv.amount_paid, inv.amount_due) === "Paid" ? "success" : getPaymentStatus(inv.amount_paid, inv.amount_due) === "Partial" ? "warning" : "secondary"}`}>
                              {getPaymentStatus(inv.amount_paid, inv.amount_due)}
                            </span>
                          </td>
                          <td className="text-end fw-semibold">{formatCurrency(inv.total_amount || 0, inv.currency || "USD")}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ───────────── FORM VIEW (New / Detail) ───────────── */}
      {showForm && (
        <div>
          {/* Top toolbar */}
          <div className="d-flex flex-wrap justify-content-between align-items-center mb-3 gap-2">
            <div className="d-flex align-items-center gap-2">
              <button className="btn btn-sm btn-light border" onClick={goBackToList}>← Back</button>
              <h4 className="fw-bold mb-0">
                {newMode ? "New Invoice" : selectedInvoice?.reference || "Invoice"}
              </h4>
              {!newMode && selectedInvoice && (
                <span className={`badge ms-2 ${statusLabel === "paid" ? "bg-success" : statusLabel === "posted" ? "bg-info" : statusLabel === "fiscalized" ? "bg-primary" : "bg-secondary"}`}>
                  {statusLabel}
                </span>
              )}
            </div>
            <div className="d-flex flex-wrap gap-1">
              {newMode ? (
                <>
                  <button className="btn btn-sm btn-primary" onClick={createInvoice} disabled={loading}>
                    {loading ? "Saving…" : "Create Invoice"}
                  </button>
                  <button className="btn btn-sm btn-light border" onClick={goBackToList}>Discard</button>
                </>
              ) : isEditing ? (
                <>
                  <button className="btn btn-sm btn-primary" onClick={saveInvoice} disabled={loading}>
                    {loading ? "Saving…" : "Save"}
                  </button>
                  <button className="btn btn-sm btn-light border" onClick={() => setIsEditing(false)}>Discard</button>
                </>
              ) : (
                <>
                  {statusLabel === "draft" && (
                    <button className="btn btn-sm btn-light border" onClick={() => setIsEditing(true)}>Edit</button>
                  )}
                  <button className="btn btn-sm btn-light border" onClick={postInvoice} disabled={statusLabel !== "draft"}>Post</button>
                  <button
                    className="btn btn-sm btn-light border"
                    onClick={fiscalizeInvoice}
                    disabled={statusLabel !== "posted" || !(editDeviceId ?? selectedInvoice?.device_id)}
                  >
                    Fiscalize
                  </button>
                  <button className="btn btn-sm btn-light border" onClick={resetInvoice} disabled={statusLabel !== "posted" && statusLabel !== "fiscalized"}>Reset</button>
                  <button className="btn btn-sm btn-light border" onClick={printInvoice}>Print PDF</button>
                  <button className="btn btn-sm btn-light border" onClick={() => setPaymentOpen(true)} disabled={statusLabel === "draft"}>Register Payment</button>
                  <button className="btn btn-sm btn-light border" onClick={createCreditNote} disabled={statusLabel === "draft" || isCreditNote}>Credit Note</button>
                </>
              )}
            </div>
          </div>

          {/* ── New Invoice Form ── */}
          {newMode && (
            <div className="card shadow-sm">
              <div className="card-body invoice-form">
                <div className="row g-3">
                  <div className="col-md-6">
                    <label className="form-label fw-semibold">Customer <span className="text-danger">*</span></label>
                    <div className="position-relative" ref={customerDropdownRef}>
                      <input
                        className="form-control input-underline"
                        placeholder="Search or select customer…"
                        value={customerSearch}
                        onChange={(e) => {
                          setCustomerSearch(e.target.value);
                          setCustomerDropdownOpen(true);
                          if (!e.target.value) setNewCustomerId(null);
                        }}
                        onFocus={() => setCustomerDropdownOpen(true)}
                      />
                      {customerDropdownOpen && (
                        <ul className="list-group position-absolute w-100 shadow-sm" style={{ zIndex: 1050, maxHeight: 220, overflowY: "auto" }}>
                          {displayContacts.map((c) => (
                            <li
                              key={c.id}
                              className={`list-group-item list-group-item-action${newCustomerId === c.id ? " active" : ""}`}
                              role="button"
                              onClick={() => selectCustomer(c.id, c.name, "new")}
                            >
                              {c.name}
                            </li>
                          ))}
                          {customerSearch.trim() && !filteredContacts.some((c) => c.name.toLowerCase() === customerSearch.trim().toLowerCase()) && (
                            <li
                              className="list-group-item list-group-item-action text-primary"
                              role="button"
                              onClick={() => createCustomerFromSearch("new")}
                            >
                              {customerCreating ? "Creating..." : `Create "${customerSearch.trim()}"`}
                            </li>
                          )}
                          {!displayContacts.length && !customerSearch.trim() && (
                            <li className="list-group-item text-muted">No customers</li>
                          )}
                        </ul>
                      )}
                    </div>
                  </div>
                  <div className="col-md-6">
                    <label className="form-label fw-semibold">Quotation</label>
                    <select className="form-select" value={newQuotationId ?? ""} onChange={(e) => setNewQuotationId(e.target.value ? Number(e.target.value) : null)}>
                      <option value="">— None —</option>
                      {quotations.map((q) => (
                        <option key={q.id} value={q.id}>{q.reference}</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-md-3">
                    <label className="form-label">Reference</label>
                    <input className="form-control input-underline bg-light" value="Auto-generated" readOnly />
                  </div>
                  <div className="col-md-3">
                    <label className="form-label">Currency</label>
                    <select className="form-select input-underline" value={newCurrency} onChange={(e) => setNewCurrency(e.target.value)}>
                      {currencyOptions.map((cur) => (
                        <option key={cur} value={cur}>{cur}</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-md-3">
                    <label className="form-label">Invoice Date</label>
                    <input className="form-control input-underline" type="date" value={newInvoiceDate} onChange={(e) => setNewInvoiceDate(e.target.value)} />
                  </div>
                  <div className="col-md-3">
                    <label className="form-label">Due Date</label>
                    <input className="form-control input-underline" type="date" value={newDueDate} onChange={(e) => setNewDueDate(e.target.value)} />
                  </div>
                  <div className="col-md-4 d-none">
                    <label className="form-label">Fiscal Device</label>
                    <select className="form-select input-underline" value={newDeviceId ?? ""} onChange={(e) => setNewDeviceId(e.target.value ? Number(e.target.value) : null)}>
                      <option value="">— None —</option>
                      {devices.map((d) => (
                        <option key={d.id} value={d.id}>{d.device_id || d.serial_number || `Device ${d.id}`}</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-md-4">
                    <label className="form-label">Payment Terms</label>
                    <select className="form-select input-underline" value={newPaymentTerms} onChange={(e) => setNewPaymentTerms(e.target.value)}>
                      <option value="">Select terms</option>
                      <option value="7 Days">7 Days</option>
                      <option value="14 Days">14 Days</option>
                      <option value="30 Days">30 Days</option>
                      <option value="2 Weeks">2 Weeks</option>
                      <option value="1 Month">1 Month</option>
                      <option value="6 Months">6 Months</option>
                    </select>
                  </div>
                  <div className="col-md-4">
                    <label className="form-label">Notes</label>
                    <textarea className="form-control input-underline" rows={1} value={newNotes} onChange={(e) => setNewNotes(e.target.value)} />
                  </div>
                </div>

                <hr className="my-4" />
                <div className="d-flex flex-wrap justify-content-between align-items-center mb-2">
                  <h6 className="fw-semibold mb-0">Invoice Lines</h6>
                  <div className="d-flex gap-2">
                    <button className="btn btn-sm btn-light border" onClick={addLine}>+ Add Line</button>
                    <button className="btn btn-sm btn-light border" onClick={() => setCreateProductOpen(true)}>+ New Product</button>
                  </div>
                </div>
                <div className="table-responsive">
                  <table className="table table-bordered align-middle mb-0">
                    <thead className="table-light">
                      <tr>
                        <th style={{ minWidth: 160 }}>Product</th>
                        <th>Description</th>
                        <th className="text-end" style={{ width: 80 }}>Qty</th>
                        <th style={{ width: 80 }}>UoM</th>
                        <th className="text-end" style={{ width: 100 }}>Price</th>
                        <th className="text-end" style={{ width: 80 }}>Disc %</th>
                        <th className="text-end" style={{ width: 80 }}>Tax %</th>
                        <th className="text-end" style={{ width: 110 }}>Amount</th>
                        <th style={{ width: 40 }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {editLines.map((line, index) => {
                        const product = line.product_id ? productById.get(line.product_id) : null;
                        const lineTotal = (line.quantity || 0) * (line.unit_price || 0) * (1 - (line.discount || 0) / 100) * (1 + (line.vat_rate || 0) / 100);
                        return (
                          <tr key={`new-${index}`}>
                            <td>
                              <select
                                className="form-select form-select-sm"
                                value={line.product_id ?? ""}
                                onChange={(e) => {
                                  const prod = products.find((p) => p.id === Number(e.target.value));
                                  updateLine(index, {
                                    product_id: e.target.value ? Number(e.target.value) : null,
                                    description: prod?.name ?? "",
                                    unit_price: prod?.sale_price ?? 0,
                                    vat_rate: prod?.tax_rate ?? 0,
                                    uom: prod?.uom || ""
                                  });
                                }}
                              >
                                <option value="">Select product</option>
                                {products.map((p) => (
                                  <option key={p.id} value={p.id}>{p.name}</option>
                                ))}
                              </select>
                            </td>
                            <td><input className="form-control form-control-sm" value={line.description || ""} onChange={(e) => updateLine(index, { description: e.target.value })} /></td>
                            <td><input className="form-control form-control-sm text-end" type="number" value={line.quantity || 0} onChange={(e) => updateLine(index, { quantity: Number(e.target.value) })} /></td>
                            <td><input className="form-control form-control-sm bg-light" value={product?.uom || line.uom || ""} readOnly /></td>
                            <td><input className="form-control form-control-sm text-end" type="number" value={line.unit_price || 0} onChange={(e) => updateLine(index, { unit_price: Number(e.target.value) })} /></td>
                            <td><input className="form-control form-control-sm text-end" type="number" value={line.discount || 0} onChange={(e) => updateLine(index, { discount: Number(e.target.value) })} /></td>
                            <td><input className="form-control form-control-sm text-end input-ghost" type="number" placeholder="Tax %" value={line.vat_rate ?? ""} onChange={(e) => updateLine(index, { vat_rate: Number(e.target.value) })} /></td>
                            <td className="text-end fw-semibold">{formatCurrency(lineTotal, newCurrency)}</td>
                            <td className="text-center">
                              <button className="btn btn-sm btn-light border" onClick={() => removeLine(index)} disabled={editLines.length === 1}>✕</button>
                            </td>
                          </tr>
                        );
                      })}
                      {!editLines.length && (
                        <tr><td colSpan={9} className="text-center py-4 text-muted">Click <strong>+ Add Line</strong> to add products</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ── Existing Invoice Detail ── */}
          {selectedInvoice && !newMode && (
            <div className="card shadow-sm">
              <div className="card-body invoice-form">
                {/* Summary cards */}
                <div className="row g-3 mb-4">
                  <div className="col-md-3">
                    <div className="card border-0 bg-light h-100">
                      <div className="card-body py-2">
                        <small className="text-muted">Total Amount</small>
                        <div className="fs-5 fw-bold">{formatCurrency(selectedInvoice.total_amount || 0, invoiceCurrency)}</div>
                      </div>
                    </div>
                  </div>
                  <div className="col-md-3">
                    <div className="card border-0 bg-light h-100">
                      <div className="card-body py-2">
                        <small className="text-muted">Amount Paid</small>
                        <div className="fs-5 fw-bold">{formatCurrency(selectedInvoice.amount_paid || 0, invoiceCurrency)}</div>
                        <span className={`badge bg-${paymentBadge}`}>{paymentStatus}</span>
                      </div>
                    </div>
                  </div>
                  <div className="col-md-3">
                    <div className="card border-0 bg-light h-100">
                      <div className="card-body py-2">
                        <small className="text-muted">Amount Due</small>
                        <div className="fs-5 fw-bold">{formatCurrency(selectedInvoice.amount_due || 0, invoiceCurrency)}</div>
                      </div>
                    </div>
                  </div>
                  <div className="col-md-3">
                    <div className="card border-0 bg-light h-100">
                      <div className="card-body py-2">
                        <small className="text-muted">Fiscalization</small>
                        <div className="fw-bold text-uppercase">{selectedInvoice.zimra_status || "not_submitted"}</div>
                        {selectedInvoice.zimra_verification_code && (
                          <small className="text-muted">Code: {selectedInvoice.zimra_verification_code}</small>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Fields */}
                <div className="row g-3 mb-4">
                  <div className="col-md-6">
                    <label className="form-label fw-semibold">Customer</label>
                    {canEdit ? (
                      <div className="position-relative" ref={customerDropdownRef}>
                        <input
                          className="form-control input-underline"
                          placeholder="Search or select customer…"
                          value={customerSearch}
                          onChange={(e) => {
                            setCustomerSearch(e.target.value);
                            setCustomerDropdownOpen(true);
                            if (!e.target.value) setEditCustomerId(null);
                          }}
                          onFocus={() => setCustomerDropdownOpen(true)}
                        />
                        {customerDropdownOpen && (
                          <ul className="list-group position-absolute w-100 shadow-sm" style={{ zIndex: 1050, maxHeight: 220, overflowY: "auto" }}>
                            {displayContacts.map((c) => (
                              <li
                                key={c.id}
                                className={`list-group-item list-group-item-action${editCustomerId === c.id ? " active" : ""}`}
                                role="button"
                                onClick={() => selectCustomer(c.id, c.name, "edit")}
                              >
                                {c.name}
                              </li>
                            ))}
                            {customerSearch.trim() && !filteredContacts.some((c) => c.name.toLowerCase() === customerSearch.trim().toLowerCase()) && (
                              <li
                                className="list-group-item list-group-item-action text-primary"
                                role="button"
                                onClick={() => createCustomerFromSearch("edit")}
                              >
                                {customerCreating ? "Creating..." : `Create "${customerSearch.trim()}"`}
                              </li>
                            )}
                            {!displayContacts.length && !customerSearch.trim() && (
                              <li className="list-group-item text-muted">No customers</li>
                            )}
                          </ul>
                        )}
                      </div>
                    ) : (
                      <div className="form-control-plaintext">{customer?.name || "—"}</div>
                    )}
                  </div>
                  <div className="col-md-3">
                    <label className="form-label fw-semibold">Invoice Date</label>
                    {canEdit ? (
                      <input className="form-control input-underline" type="date" value={editInvoiceDate} onChange={(e) => setEditInvoiceDate(e.target.value)} />
                    ) : (
                      <div className="form-control-plaintext">{invoiceDateLabel}</div>
                    )}
                  </div>
                  <div className="col-md-3">
                    <label className="form-label fw-semibold">Due Date</label>
                    {canEdit ? (
                      <input className="form-control input-underline" type="date" value={editDueDate} onChange={(e) => setEditDueDate(e.target.value)} />
                    ) : (
                      <div className="form-control-plaintext">{selectedInvoice?.due_date ? new Date(selectedInvoice.due_date).toLocaleDateString() : "—"}</div>
                    )}
                  </div>
                  <div className="col-md-4">
                    <label className="form-label">Quotation</label>
                    {canEdit ? (
                      <select className="form-select input-underline" value={editQuotationId ?? ""} onChange={(e) => setEditQuotationId(e.target.value ? Number(e.target.value) : null)}>
                        <option value="">— None —</option>
                        {quotations.map((q) => (
                          <option key={q.id} value={q.id}>{q.reference}</option>
                        ))}
                      </select>
                    ) : (
                      <div className="form-control-plaintext">{linkedQuotation?.reference || "—"}</div>
                    )}
                  </div>
                  <div className="col-md-4">
                    <label className="form-label">Reference</label>
                    <div className="form-control-plaintext fw-semibold">{selectedInvoice?.reference || "—"}</div>
                  </div>
                  <div className="col-md-4">
                    <label className="form-label">Currency</label>
                    {canEdit ? (
                      <select className="form-select input-underline" value={editCurrency} onChange={(e) => setEditCurrency(e.target.value)}>
                        {currencyOptions.map((cur) => (
                          <option key={cur} value={cur}>{cur}</option>
                        ))}
                      </select>
                    ) : (
                      <div className="form-control-plaintext">{invoiceCurrency}</div>
                    )}
                  </div>
                  <div className="col-md-4 d-none">
                    <label className="form-label">Fiscal Device</label>
                    {canEdit ? (
                      <select className="form-select input-underline" value={editDeviceId ?? ""} onChange={(e) => setEditDeviceId(e.target.value ? Number(e.target.value) : null)}>
                        <option value="">— None —</option>
                        {devices.map((d) => (
                          <option key={d.id} value={d.id}>{d.device_id || d.serial_number || `Device ${d.id}`}</option>
                        ))}
                      </select>
                    ) : (
                      <div className="form-control-plaintext">{devices.find((d) => d.id === selectedInvoice?.device_id)?.device_id || "—"}</div>
                    )}
                  </div>
                  <div className="col-md-4">
                    <label className="form-label">Payment Terms</label>
                    {canEdit ? (
                      <select className="form-select input-underline" value={editPaymentTerms} onChange={(e) => setEditPaymentTerms(e.target.value)}>
                        <option value="">Select terms</option>
                        <option value="7 Days">7 Days</option>
                        <option value="14 Days">14 Days</option>
                        <option value="30 Days">30 Days</option>
                        <option value="2 Weeks">2 Weeks</option>
                        <option value="1 Month">1 Month</option>
                        <option value="6 Months">6 Months</option>
                      </select>
                    ) : (
                      <div className="form-control-plaintext">{selectedInvoice?.payment_terms || "—"}</div>
                    )}
                  </div>
                  <div className="col-md-4">
                    <label className="form-label">Payment Reference</label>
                    <div className="form-control-plaintext">{selectedInvoice?.payment_reference || "—"}</div>
                  </div>
                  <div className="col-12">
                    <label className="form-label">Notes</label>
                    {canEdit ? (
                      <textarea className="form-control input-underline" rows={2} value={editNotes} onChange={(e) => setEditNotes(e.target.value)} />
                    ) : (
                      <div className="form-control-plaintext">{selectedInvoice?.notes || "—"}</div>
                    )}
                  </div>
                </div>

                {/* Lines table */}
                {canEdit && (
                  <div className="d-flex gap-2 mb-2">
                    <button className="btn btn-sm btn-light border" onClick={addLine}>+ Add Line</button>
                    <button className="btn btn-sm btn-light border" onClick={() => setCreateProductOpen(true)}>+ New Product</button>
                  </div>
                )}
                <div className="table-responsive">
                  <table className="table table-bordered align-middle mb-0">
                    <thead className="table-light">
                      <tr>
                        <th>Product</th>
                        <th>Description</th>
                        <th className="text-end">Qty</th>
                        <th>UoM</th>
                        <th className="text-end">Price</th>
                        <th className="text-end">Disc %</th>
                        <th className="text-end">Tax %</th>
                        <th className="text-end">Amount</th>
                        {canEdit && <th></th>}
                      </tr>
                    </thead>
                    <tbody>
                      {displayLines.map((line, index) => {
                        const product = line.product_id ? productById.get(line.product_id) : null;
                        const lineTotal = (line.quantity || 0) * (line.unit_price || 0) * (1 - (line.discount || 0) / 100) * (1 + (line.vat_rate || 0) / 100);
                        return (
                          <tr key={line.id || `edit-${index}`}>
                            <td>
                              {canEdit ? (
                                <select
                                  className="form-select form-select-sm"
                                  value={line.product_id ?? ""}
                                  onChange={(e) => {
                                    const prod = products.find((p) => p.id === Number(e.target.value));
                                    updateLine(index, {
                                      product_id: e.target.value ? Number(e.target.value) : null,
                                      description: prod?.name ?? "",
                                      unit_price: prod?.sale_price ?? 0,
                                      vat_rate: prod?.tax_rate ?? 0,
                                      uom: prod?.uom || ""
                                    });
                                  }}
                                >
                                  <option value="">Select</option>
                                  {products.map((p) => (
                                    <option key={p.id} value={p.id}>{p.name} (avail: {p.quantity_available ?? 0})</option>
                                  ))}
                                </select>
                              ) : (
                                product?.name ?? "—"
                              )}
                            </td>
                            <td>{canEdit ? <input className="form-control form-control-sm" value={line.description || ""} onChange={(e) => updateLine(index, { description: e.target.value })} /> : (line.description || "—")}</td>
                            <td className="text-end">{canEdit ? <input className="form-control form-control-sm text-end" type="number" value={line.quantity || 0} onChange={(e) => updateLine(index, { quantity: Number(e.target.value) })} /> : line.quantity}</td>
                            <td>{canEdit ? <input className="form-control form-control-sm bg-light" value={product?.uom || line.uom || ""} readOnly /> : (line.uom || "—")}</td>
                            <td className="text-end">{canEdit ? <input className="form-control form-control-sm text-end" type="number" value={line.unit_price || 0} onChange={(e) => updateLine(index, { unit_price: Number(e.target.value) })} /> : formatCurrency(line.unit_price || 0, invoiceCurrency)}</td>
                            <td className="text-end">{canEdit ? <input className="form-control form-control-sm text-end" type="number" value={line.discount || 0} onChange={(e) => updateLine(index, { discount: Number(e.target.value) })} /> : (line.discount ? `${line.discount}%` : "—")}</td>
                            <td className="text-end">{canEdit ? <input className="form-control form-control-sm text-end input-ghost" type="number" placeholder="Tax %" value={line.vat_rate ?? ""} onChange={(e) => updateLine(index, { vat_rate: Number(e.target.value) })} /> : (line.vat_rate ? `${line.vat_rate}%` : "—")}</td>
                            <td className="text-end fw-semibold">{formatCurrency(lineTotal, invoiceCurrency)}</td>
                            {canEdit && (
                              <td className="text-center">
                                <button className="btn btn-sm btn-light border" onClick={() => removeLine(index)} disabled={displayLines.length === 1}>✕</button>
                              </td>
                            )}
                          </tr>
                        );
                      })}
                      {!displayLines.length && (
                        <tr><td colSpan={canEdit ? 9 : 8} className="text-center py-4 text-muted">No invoice lines</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Totals */}
                <div className="row g-3 mt-3">
                  <div className="col-md-6">
                    <div className="card border-0 bg-light">
                      <div className="card-body py-2">
                        <div className="fw-semibold mb-1">Tax Breakdown</div>
                        {taxBreakdown.length === 0 && <small className="text-muted">No taxes applied</small>}
                        {taxBreakdown.map(([rate, amt]) => (
                          <div key={rate} className="d-flex justify-content-between text-muted small">
                            <span>VAT {rate}%</span>
                            <span>{formatCurrency(amt, invoiceCurrency)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="col-md-6">
                    <div className="card border-0 bg-light">
                      <div className="card-body py-2">
                        <div className="d-flex justify-content-between"><span>Subtotal</span><span>{formatCurrency(selectedInvoice.subtotal || 0, invoiceCurrency)}</span></div>
                        <div className="d-flex justify-content-between"><span>Discount</span><span>-{formatCurrency(selectedInvoice.discount_amount || 0, invoiceCurrency)}</span></div>
                        <div className="d-flex justify-content-between"><span>Tax</span><span>{formatCurrency(selectedInvoice.tax_amount || 0, invoiceCurrency)}</span></div>
                        <hr className="my-1" />
                        <div className="d-flex justify-content-between fw-bold"><span>Total</span><span>{formatCurrency(selectedInvoice.total_amount || 0, invoiceCurrency)}</span></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {paymentOpen && (
        <>
          <div className="modal-backdrop fade show" style={{ zIndex: 1040 }} />
          <div
            className="modal fade show"
            tabIndex={-1}
            role="dialog"
            style={{ display: "block", zIndex: 1050 }}
            onClick={(e) => { if (e.target === e.currentTarget) setPaymentOpen(false); }}
          >
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content shadow-lg border-0">
                <div className="modal-header border-bottom">
                  <h5 className="modal-title fw-semibold">Register Payment</h5>
                  <button type="button" className="btn-close" onClick={() => setPaymentOpen(false)} />
                </div>
                <div className="modal-body py-4">
                  <div className="mb-3">
                    <label className="form-label fw-semibold">Amount</label>
                    <input className="form-control" type="number" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} />
                  </div>
                  <div className="mb-3">
                    <label className="form-label fw-semibold">Payment Reference</label>
                    <input className="form-control" value={paymentReference} onChange={(e) => setPaymentReference(e.target.value)} />
                  </div>
                </div>
                <div className="modal-footer border-top">
                  <button className="btn btn-light border" onClick={() => setPaymentOpen(false)}>Cancel</button>
                  <button className="btn btn-primary" onClick={registerPayment}>Confirm Payment</button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

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
  );
}