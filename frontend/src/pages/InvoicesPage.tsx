import { useEffect, useMemo, useRef, useState } from "react";
import html2pdf from "html2pdf.js";
import { useNavigate, useParams } from "react-router-dom";
import { apiFetch } from "../api";
import { useMe } from "../hooks/useMe";

type InvoiceLine = {
  id: number;
  invoice_id: number;
  product_id: number | null;
  description: string;
  hs_code?: string | null;
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
  zimra_receipt_id?: string;
  zimra_receipt_counter?: number;
  zimra_receipt_global_no?: number;
  zimra_verification_code?: string;
  zimra_verification_url?: string;
  zimra_errors?: string;
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
  city?: string;
  country?: string;
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
  tax_id: number | null;
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

const currencyOptions = [
  "USD",
  "ZWG",
  "ZAR",
  "EUR",
  "GBP",
  
];

const formatCurrency = (value: number, currency: string) => {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
    }).format(value || 0);
  } catch {
    return `${currency} ${(value || 0).toFixed(2)}`;
  }
};

const normalizeUom = (value: string) => (value === "PCS" ? "Units" : value);

const toDateInputValue = (value: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().split("T")[0];
};

const fromDateInputValue = (value: string) =>
  value ? new Date(value).toISOString() : null;

const getPaymentStatus = (amountPaid: number, amountDue: number) => {
  if (amountDue <= 0) return "Paid";
  if (amountPaid > 0) return "Partial";
  return "Unpaid";
};

type InvoicesPageMode = "list" | "new" | "detail";

export default function InvoicesPage({
  mode = "list",
}: {
  mode?: InvoicesPageMode;
}) {
  const navigate = useNavigate();
  const { invoiceId } = useParams();
  const routeInvoiceId = invoiceId ? Number(invoiceId) : null;
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
  const [companySettings, setCompanySettings] =
    useState<CompanySettings | null>(null);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<number | null>(
    null,
  );
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
  const [productUom, setProductUom] = useState("Units");
  const [productInitialStock, setProductInitialStock] = useState("");
  const [productWarehouseId, setProductWarehouseId] = useState<number | null>(
    null,
  );
  const [productLocationId, setProductLocationId] = useState<number | null>(
    null,
  );
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerDropdownOpen, setCustomerDropdownOpen] = useState(false);
  const [customerCreating, setCustomerCreating] = useState(false);
  const [quotationSearch, setQuotationSearch] = useState("");
  const [quotationDropdownOpen, setQuotationDropdownOpen] = useState(false);
  const customerDropdownRef = useRef<HTMLDivElement>(null);
  const quotationDropdownRef = useRef<HTMLDivElement>(null);

  const filteredContacts = contacts.filter((c) =>
    c.name.toLowerCase().includes(customerSearch.toLowerCase()),
  );
  const topContacts = contacts.slice(0, 3);
  const displayContacts = customerSearch.trim()
    ? filteredContacts
    : topContacts;
  const filteredQuotations = quotations.filter((q) =>
    q.reference.toLowerCase().includes(quotationSearch.toLowerCase()),
  );
  const topQuotations = quotations.slice(0, 3);
  const displayQuotations = quotationSearch.trim()
    ? filteredQuotations
    : topQuotations;

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
    const exists = contacts.some(
      (c) => c.name.toLowerCase() === name.toLowerCase(),
    );
    if (exists) return;
    setCustomerCreating(true);
    setError(null);
    try {
      const created = await apiFetch<Contact>("/contacts", {
        method: "POST",
        body: JSON.stringify({
          company_id: companyId,
          name,
        }),
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
      if (
        customerDropdownRef.current &&
        !customerDropdownRef.current.contains(e.target as Node)
      ) {
        setCustomerDropdownOpen(false);
      }
      if (
        quotationDropdownRef.current &&
        !quotationDropdownRef.current.contains(e.target as Node)
      ) {
        setQuotationDropdownOpen(false);
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
        ...(listType ? { invoice_type: listType } : {}),
      }).toString();
      const [
        invoiceData,
        quotationData,
        contactData,
        productData,
        warehouseData,
        deviceData,
        settingsData,
      ] = await Promise.all([
        apiFetch<Invoice[]>(`/invoices?${query}`),
        apiFetch<Quotation[]>(`/quotations?company_id=${companyId}`),
        apiFetch<Contact[]>(`/contacts?company_id=${companyId}`),
        apiFetch<Product[]>(`/products/with-stock?company_id=${companyId}`),
        apiFetch<Warehouse[]>(`/warehouses?company_id=${companyId}`),
        apiFetch<Device[]>(`/devices?company_id=${companyId}`),
        apiFetch<CompanySettings>(`/company-settings?company_id=${companyId}`),
      ]);
      setInvoices(invoiceData);
      setQuotations(quotationData);
      setContacts(contactData);
      setProducts(productData);
      setDevices(deviceData);
      setWarehouses(warehouseData);
      setCompanySettings(settingsData ?? null);
      if (!productWarehouseId && warehouseData.length) {
        setProductWarehouseId(warehouseData[0].id);
      }
      if (!newDeviceId && deviceData.length) {
        setNewDeviceId(deviceData[0].id);
      }
      if (
        selectedInvoiceId &&
        !invoiceData.find((inv) => inv.id === selectedInvoiceId)
      ) {
        setSelectedInvoiceId(null);
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
    if (mode === "list") {
      setNewMode(false);
      setIsEditing(false);
      setSelectedInvoiceId(null);
      return;
    }
    if (mode === "detail") {
      setNewMode(false);
      setIsEditing(false);
      if (routeInvoiceId && routeInvoiceId !== selectedInvoiceId) {
        setSelectedInvoiceId(routeInvoiceId);
      }
    }
  }, [mode, routeInvoiceId]);

  useEffect(() => {
    if (mode === "new" && !newMode) {
      beginNew();
    }
  }, [mode, newMode, contacts, devices]);

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
    const q = quotations.find((q) => q.id === selectedInvoice.quotation_id);
    setQuotationSearch(q?.reference || "");
    setQuotationDropdownOpen(false);
    setEditReference(selectedInvoice.reference ?? "");
    setEditCurrency(selectedInvoice.currency || "USD");
    setEditInvoiceDate(toDateInputValue(selectedInvoice.invoice_date));
    setEditDueDate(toDateInputValue(selectedInvoice.due_date));
    setEditPaymentTerms(selectedInvoice.payment_terms || "");
    setEditNotes(selectedInvoice.notes || "");
    setEditDeviceId(selectedInvoice.device_id ?? null);
    setEditLines(
      selectedInvoice.lines?.length
        ? selectedInvoice.lines.map((line) => {
            const product = products.find((p) => p.id === line.product_id);
            return {
              ...line,
              uom: line.uom || product?.uom || "",
            };
          })
        : [],
    );
    setIsEditing(false);
  }, [selectedInvoice, products]);
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
    ? (quotationById.get(selectedInvoice.quotation_id) ?? null)
    : null;

  const newQuotation = newQuotationId
    ? (quotationById.get(newQuotationId) ?? null)
    : null;

  const customer = selectedInvoice?.customer_id
    ? (contactById.get(selectedInvoice.customer_id) ?? null)
    : linkedQuotation
      ? (contactById.get(linkedQuotation.customer_id) ?? null)
      : null;

  const invoiceDateLabel = selectedInvoice?.invoice_date
    ? new Date(selectedInvoice.invoice_date).toLocaleDateString()
    : selectedInvoice?.fiscalized_at
      ? new Date(selectedInvoice.fiscalized_at).toLocaleDateString()
      : "-";

  const invoiceCurrency = newMode
    ? newCurrency
    : selectedInvoice?.currency || editCurrency || "USD";
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
  const paymentStatus = selectedInvoice
    ? getPaymentStatus(selectedInvoice.amount_paid, selectedInvoice.amount_due)
    : "-";
  const paymentBadge =
    paymentStatus === "Paid"
      ? "success"
      : paymentStatus === "Partial"
        ? "warning"
        : "secondary";

  const beginNew = () => {
    setNewMode(true);
    setIsEditing(true);
    setSelectedInvoiceId(null);
    setNewQuotationId(null);
    setNewCustomerId(contacts[0]?.id ?? null);
    setCustomerSearch(contacts[0]?.name ?? "");
    setCustomerDropdownOpen(false);
    setQuotationSearch("");
    setQuotationDropdownOpen(false);
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
        vat_rate: 0,
      },
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
            uom: line.uom || "Units",
            unit_price: line.unit_price || 0,
            discount: line.discount || 0,
            vat_rate: line.vat_rate || 0,
          })),
        }),
      });
      setSelectedInvoiceId(created.id);
      setNewMode(false);
      setIsEditing(false);
      await loadAll();
      navigate(`/invoices/${created.id}`);
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
            vat_rate: line.vat_rate || 0,
          })),
        }),
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
      await apiFetch<Invoice>(`/invoices/${selectedInvoiceId}/post`, {
        method: "POST",
      });
      await loadAll();
    } catch (err: any) {
      setError(err.message || "Failed to post invoice");
    }
  };

  const resetInvoice = async () => {
    if (!selectedInvoiceId) return;
    await apiFetch<Invoice>(`/invoices/${selectedInvoiceId}/reset`, {
      method: "POST",
    });
    await loadAll();
  };

  const fiscalizeInvoice = async () => {
    if (!selectedInvoiceId) return;
    let deviceId = editDeviceId ?? selectedInvoice?.device_id ?? null;

    // Auto-assign first available device if none is set
    if (!deviceId && devices.length > 0) {
      deviceId = devices[0].id;
      setEditDeviceId(deviceId);
    }
    if (!deviceId) {
      setError("No fiscal device available. Create a device on the Devices page first.");
      return;
    }

    try {
      // Ensure invoice has the device_id saved before fiscalizing
      if (selectedInvoice && selectedInvoice.device_id !== deviceId) {
        await apiFetch<Invoice>(`/invoices/${selectedInvoiceId}`, {
          method: "PUT",
          body: JSON.stringify({ device_id: deviceId }),
        });
      }
      await apiFetch<Invoice>(`/invoices/${selectedInvoiceId}/fiscalize`, {
        method: "POST",
      });
      await loadAll();
    } catch (err: any) {
      setError(err.message || "Failed to fiscalize invoice");
      await loadAll();  // Reload to show stored zimra_errors
    }
  };

  const registerPayment = async () => {
    if (!selectedInvoiceId) return;
    const amount = Number(paymentAmount);
    if (!amount || Number.isNaN(amount)) return;
    await apiFetch<Invoice>(
      `/invoices/${selectedInvoiceId}/pay?amount=${amount}&payment_reference=${encodeURIComponent(paymentReference)}`,
      {
        method: "POST",
      },
    );
    setPaymentOpen(false);
    setPaymentAmount("");
    setPaymentReference("");
    await loadAll();
  };

  const createCreditNote = async () => {
    if (!selectedInvoiceId) return;
    try {
      const credit = await apiFetch<Invoice>(
        `/invoices/${selectedInvoiceId}/credit-note`,
        { method: "POST" },
      );
      setSelectedInvoiceId(credit.id);
      await loadAll();
    } catch (err: any) {
      setError(err.message || "Failed to create credit note");
    }
  };

  const updateLine = (index: number, patch: Partial<InvoiceLine>) => {
    setEditLines((prev) =>
      prev.map((line, idx) => (idx === index ? { ...line, ...patch } : line)),
    );
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
        vat_rate: 0,
      },
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
        uom: productUom,
      }),
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
          reference: `Init ${created.name}`,
        }),
      });
      await apiFetch(`/stock/moves/${move.id}/confirm`, { method: "POST" });
    }

    setCreateProductOpen(false);
    setProductName("");
    setProductReference("");
    setProductHsCode("");
    setProductPrice("");
    setProductTaxRate("");
    setProductUom("Units");
    setProductInitialStock("");
    await loadAll();
  };

  const removeLine = (index: number) => {
    setEditLines((prev) => prev.filter((_, idx) => idx !== index));
  };

  const displayLines = isEditing ? editLines : (selectedInvoice?.lines ?? []);
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
    const lines = selectedInvoice.lines || [];
    const currency = selectedInvoice.currency || "USD";
    const title =
      selectedInvoice.invoice_type === "credit_note"
        ? "Credit Note"
        : "Invoice";
    const layoutKey = (
      companySettings?.document_layout || "external_layout_standard"
    ).replace("external_layout_", "layout-");
    const logoMarkup = companySettings?.logo_data
      ? `<img class="logo" src="${companySettings.logo_data}" alt="Logo" />`
      : "";
    const productMap = new Map(
      products.map((product) => [product.id, product]),
    );
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
    const companyAddress = formatAddressLines(
      company?.address,
      company?.city,
      company?.country,
    );
    const customerAddress = formatAddressLines(
      customer?.address,
      customer?.city,
      customer?.country,
    );
    const footerHtml = (companySettings?.document_footer || "").replace(
      /\n/g,
      "<br />",
    );
    const rows = lines
      .map((line) => {
        const subtotal =
          (line.quantity || 0) *
          (line.unit_price || 0) *
          (1 - (line.discount || 0) / 100);
        const tax = subtotal * ((line.vat_rate || 0) / 100);
        const total = subtotal + tax;
        const hsCode = line.product_id
          ? productMap.get(line.product_id)?.hs_code || "-"
          : "-";
        const qtyLabel =
          `${(line.quantity || 0).toFixed(2)} ${line.uom || ""}`.trim();
        return `
          <tr>
            <td>${line.description || ""}</td>
            <td style="text-align:right;">${qtyLabel}</td>
            <td style="text-align:right;">${(line.unit_price || 0).toFixed(2)}</td>
            <td style="text-align:right;">${(line.discount || 0).toFixed(2)}</td>
            <td style="text-align:right;">${(line.vat_rate || 0).toFixed(2)}</td>
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
            :root { --ink: #0f172a; --muted: #6b7280; --line: #e5e7eb; --soft: #f8fafc; --accent: #1e4f9b; }
            * { box-sizing: border-box; }
            body { font-family: "Segoe UI", Inter, Arial, sans-serif; padding: 0; margin: 0; color: var(--ink); background: #fff; }
            .doc { padding: 26px 30px 34px; position: relative; }
            .watermark { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-size: 64px; font-weight: 700; color: #94a3b8; opacity: ${companySettings?.document_watermark_opacity || "0.08"}; pointer-events: none; transform: rotate(-25deg); }
            .layout-boxed { border: 1px solid var(--line); }
            .layout-bubble { border: 1px solid var(--line); box-shadow: 0 10px 24px rgba(15, 23, 42, 0.08); }
            .header-row { display: flex; justify-content: space-between; gap: 24px; align-items: flex-start; }
            .brand { display: flex; align-items: center; gap: 14px; }
            .logo { width: 86px; height: 86px; object-fit: contain; border-radius: 0; border: none; background: transparent; padding: 0; }
            .brand-details { font-size: 12px; line-height: 1.5; color: var(--muted); }
            .brand-details strong { color: var(--ink); }
            .company-details { text-align: right; font-size: 12px; line-height: 1.5; color: var(--muted); }
            .company-details strong { color: var(--ink); }
            .invoice-title { text-align: left; }
            .invoice-title h1 { margin: 0 0 8px; font-size: 20px; letter-spacing: 0.6px; }
            .invoice-meta { display: grid; gap: 6px; font-size: 12px; color: var(--muted); }
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
          </style>
        </head>
        <body>
          <div class="doc ${layoutKey}">
            ${companySettings?.document_watermark ? `<div class="watermark">${companySettings.document_watermark}</div>` : ""}
            <div class="header-row">
              <div class="brand">
                ${logoMarkup || `<div class="logo"></div>`}
              </div>
              <div class="company-details">
                <strong>${company?.name || "Your Company"}</strong><br />
                ${companyAddress.line1 ? `${companyAddress.line1}<br />` : ""}
                ${companyAddress.line2 ? `${companyAddress.line2}<br />` : ""}
                ${companyAddress.line3 ? `${companyAddress.line3}<br />` : ""}
                ${company?.email || ""}<br />
                ${company?.phone || ""}<br />
                TIN: ${company?.tin || "-"} | VAT: ${company?.vat || "-"}
              </div>
            </div>

            <div class="divider"></div>

            <div class="addresses">
              <div class="block">
                <h4>Bill To</h4>
                <strong>${customer?.name || "-"}</strong><br />
                ${customerAddress.line1 ? `${customerAddress.line1}<br />` : ""}
                ${customerAddress.line2 ? `${customerAddress.line2}<br />` : ""}
                ${customerAddress.line3 ? `${customerAddress.line3}<br />` : ""}
                ${customer?.phone || ""}<br />
                ${customer?.email || ""}<br />
                TIN: ${customer?.tin || "-"}<br />
                VAT: ${customer?.vat || "-"}
              </div>
              <div class="block invoice-title">
                <h1>${title.toUpperCase()}</h1>
                <div class="invoice-meta">
                  <div><strong>Issue Date:</strong> ${invoiceDateLabel}</div>
                  <div><strong>Due Date:</strong> ${selectedInvoice.due_date ? new Date(selectedInvoice.due_date).toLocaleDateString() : "-"}</div>
                  <div><strong>Invoice #:</strong> ${selectedInvoice.reference}</div>
                  <div><strong>Status:</strong> ${statusLabel}</div>
                </div>
              </div>
            </div>

            <table>
              <thead>
                <tr>
                  <th>Item</th>
                  <th style="text-align:right;">Quantity</th>
                  <th style="text-align:right;">Price</th>
                  <th style="text-align:right;">Disc %</th>
                  <th style="text-align:right;">VAT %</th>
                  <th style="text-align:right;">Total</th>
                </tr>
              </thead>
              <tbody>
                ${rows}
              </tbody>
            </table>

            <div class="totals">
              <div class="totals-card">
                <div class="totals-row"><span>Subtotal</span><span>${formatCurrency(selectedInvoice.subtotal || 0, currency)}</span></div>
                <div class="totals-row"><span>Discount</span><span>${formatCurrency(selectedInvoice.discount_amount || 0, currency)}</span></div>
                <div class="totals-row"><span>VAT</span><span>${formatCurrency(selectedInvoice.tax_amount || 0, currency)}</span></div>
                <div class="totals-row"><span>Total</span><span>${formatCurrency(selectedInvoice.total_amount || 0, currency)}</span></div>
                <div class="totals-row"><span>Amount Paid</span><span>${formatCurrency(selectedInvoice.amount_paid || 0, currency)}</span></div>
                <div class="totals-row"><strong>Balance Due</strong><strong>${formatCurrency(selectedInvoice.amount_due || 0, currency)}</strong></div>
              </div>
            </div>

            ${selectedInvoice.zimra_status === "submitted" ? (() => {
              const dev = devices.find(d => d.id === selectedInvoice.device_id);
              return `
            <div style="margin-top:24px; border-top:1px solid #e2e8f0; padding-top:18px;">
              <div style="text-align:center;">
                ${selectedInvoice.zimra_verification_url ? `
                <img src="https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(selectedInvoice.zimra_verification_url)}" width="180" height="180" style="margin-bottom:10px;" />
                ` : ""}
                <div style="font-size:12px; color:#374151; line-height:1.7;">
                  <div><strong>Verification code:</strong> ${selectedInvoice.zimra_verification_code || "-"}</div>
                  <div><strong>Fiscal Day:</strong> ${selectedInvoice.zimra_receipt_counter || "-"}</div>
                  <div><strong>Device ID:</strong> ${dev?.device_id || "-"}</div>
                  <div><strong>Invoice Number:</strong> ${selectedInvoice.zimra_receipt_global_no || "-"}</div>
                </div>
                ${selectedInvoice.zimra_verification_url ? `
                <div style="margin-top:8px; font-size:11px; color:#6b7280;">
                  Verify this receipt manually at
                </div>
                <div style="font-size:11px; color:#2563eb; text-decoration:underline; word-break:break-all;">
                  ${selectedInvoice.zimra_verification_url}
                </div>
                ` : ""}
              </div>
            </div>
            `; })() : ""}

            ${footerHtml ? `<div class="doc-footer">${footerHtml}</div>` : ""}
          </div>
        </body>
      </html>
    `;
    const container = document.createElement("div");
    container.innerHTML = html;
    document.body.appendChild(container);
    html2pdf()
      .set({
        margin: [10, 10, 10, 10],
        filename: `${selectedInvoice.reference}.pdf`,
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

  // Determine which "screen" to show: list, new-form, or detail
  const showForm = mode !== "list";

  const goBackToList = () => {
    navigate("/invoices");
  };

  return (
    <div className="container-fluid py-3 ">
      {error && (
        <div
          className="alert alert-danger alert-dismissible fade show"
          role="alert"
        >
          {error}
          <button
            type="button"
            className="btn-close"
            onClick={() => setError(null)}
          />
        </div>
      )}

      {/* ───────────── LIST VIEW ───────────── */}
      {!showForm && (
        <div className="two-panel two-panel-left">
          {/* Sidebar */}
          <div className="o-sidebar">
            <div className="o-sidebar-section">
              <div className="o-sidebar-title">STATUS</div>
              {[
                { key: "", label: "ALL INVOICES", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg> },
                { key: "draft", label: "DRAFT", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg> },
                { key: "posted", label: "POSTED", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/></svg> },
                { key: "paid", label: "PAID", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/><path d="M12 18V6"/></svg> },
                { key: "fiscalized", label: "FISCALIZED", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg> },
              ].map((item) => (
                <div
                  key={item.key || "all"}
                  className={`o-sidebar-item ${listStatus === item.key ? "active" : ""}`}
                  onClick={() => setListStatus(item.key)}
                  style={{ cursor: "pointer" }}
                >
                  <span style={{ display: "flex", alignItems: "center", gap: 10, opacity: 0.85 }}>{item.icon}<span style={{ letterSpacing: "0.5px", fontSize: 12, fontWeight: 500 }}>{item.label}</span></span>
                  <span className="o-sidebar-count">
                    {item.key === ""
                      ? invoices.length
                      : invoices.filter((inv) => inv.status === item.key).length}
                  </span>
                </div>
              ))}
            </div>

            <div className="o-sidebar-section">
             
              {[
                { key: "", label: "ALL TYPES", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/></svg> },
                { key: "invoice", label: "INVOICE", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M16 13H8"/><path d="M16 17H8"/><path d="M10 9H8"/></svg> },
                { key: "credit_note", label: "CREDIT NOTE", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="m15 11-6 6"/><path d="m9 11 6 6"/></svg> },
              ].map((item) => (
                <div
                  key={item.key || "all"}
                  className={`o-sidebar-item ${listType === item.key ? "active" : ""}`}
                  onClick={() => setListType(item.key)}
                  style={{ cursor: "pointer" }}
                >
                  <span style={{ display: "flex", alignItems: "center", gap: 10, opacity: 0.85 }}>{item.icon}<span style={{ letterSpacing: "0.5px", fontSize: 12, fontWeight: 500 }}>{item.label}</span></span>
                  <span className="o-sidebar-count">
                    {item.key === ""
                      ? invoices.length
                      : invoices.filter((inv) => inv.invoice_type === item.key).length}
                  </span>
                </div>
              ))}
            </div>

          
          </div>

          <div>
            <div className="content-top-bar">
              <div className="top-search">
                <span className="search-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                </span>
                <input
                  placeholder="Search invoices…"
                  value={listSearch}
                  onChange={(e) => setListSearch(e.target.value)}
                />
              </div>
              <button
                className="o-btn o-btn-secondary"
                style={{ display: "flex", alignItems: "center", gap: 6 }}
                onClick={() => {
                  const headers = ["Reference", "Type", "Customer", "Date", "Status", "Payment", "Subtotal", "Tax", "Total", "Paid", "Due"];
                  const rows = invoices.map((inv) => {
                    const cust = contactById.get(inv.customer_id ?? 0);
                    return [
                      inv.reference,
                      inv.invoice_type === "credit_note" ? "Credit Note" : "Invoice",
                      cust?.name || "",
                      inv.invoice_date ? new Date(inv.invoice_date).toLocaleDateString() : "",
                      inv.status,
                      getPaymentStatus(inv.amount_paid, inv.amount_due),
                      inv.subtotal || 0,
                      inv.tax_amount || 0,
                      inv.total_amount || 0,
                      inv.amount_paid || 0,
                      inv.amount_due || 0,
                    ];
                  });
                  const csvContent = [headers, ...rows].map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
                  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
                  const link = document.createElement("a");
                  link.href = URL.createObjectURL(blob);
                  link.download = `invoices_${new Date().toISOString().split("T")[0]}.csv`;
                  link.click();
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                Export
              </button>
              <button
                className="btn-create"
                onClick={() => {
                  beginNew();
                  navigate("/invoices/new");
                }}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                New Invoice
              </button>
            </div>

            <div className="card shadow-sm card-bg-shadow">
              <div className="card-body p-0">
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
                        <tr>
                          <td colSpan={6} className="text-center py-5 text-muted">
                            Loading invoices…
                          </td>
                        </tr>
                      )}
                      {!loading && invoices.length === 0 && (
                        <tr>
                          <td colSpan={6} className="text-center py-5 text-muted">
                            No invoices yet. Click <strong>+ New Invoice</strong>{" "}
                            to create one.
                          </td>
                        </tr>
                      )}
                      {invoices.map((inv) => {
                        const cust = contactById.get(inv.customer_id ?? 0);
                        return (
                          <tr
                            key={inv.id}
                            role="button"
                            onClick={() => navigate(`/invoices/${inv.id}`)}
                          >
                            <td>
                              <div className="fw-semibold">{inv.reference}</div>
                              <small className="text-muted">
                                {inv.invoice_type === "credit_note"
                                  ? "Credit Note"
                                  : "Invoice"}
                              </small>
                            </td>
                            <td>{cust?.name || "—"}</td>
                            <td className="text-muted">
                              {inv.invoice_date
                                ? new Date(inv.invoice_date).toLocaleDateString()
                                : "—"}
                            </td>
                            <td>
                              <span
                                className={`badge ${inv.status === "paid" ? "bg-success" : inv.status === "posted" ? "bg-info" : inv.status === "fiscalized" ? "bg-primary" : "bg-secondary"}`}
                              >
                                {inv.status}
                              </span>
                            </td>
                            <td>
                              <span
                                className={`badge bg-${getPaymentStatus(inv.amount_paid, inv.amount_due) === "Paid" ? "success" : getPaymentStatus(inv.amount_paid, inv.amount_due) === "Partial" ? "warning" : "secondary"}`}
                              >
                                {getPaymentStatus(
                                  inv.amount_paid,
                                  inv.amount_due,
                                )}
                              </span>
                            </td>
                            <td className="text-end fw-semibold">
                              {formatCurrency(
                                inv.total_amount || 0,
                                inv.currency || "USD",
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr style={{ background: "#f8fafc", fontWeight: 600 }}>
                        <td colSpan={5} className="text-end">Grand Total:</td>
                        <td className="text-end">
                          {formatCurrency(
                            invoices.reduce((sum, inv) => sum + (inv.total_amount || 0), 0),
                            "USD"
                          )}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
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
              <button
                className="btn btn-sm btn-light border"
                onClick={goBackToList}
              >
                ← Back
              </button>
              <h4 className="fw-bold mb-0">
                {newMode
                  ? "New Invoice"
                  : selectedInvoice?.reference || "Invoice"}
              </h4>
              {!newMode && selectedInvoice && (
                <span
                  className={`badge ms-2 ${statusLabel === "paid" ? "bg-success" : statusLabel === "posted" ? "bg-info" : statusLabel === "fiscalized" ? "bg-primary" : "bg-secondary"}`}
                >
                  {statusLabel}
                </span>
              )}
            </div>
            <div className="d-flex flex-wrap gap-1">
              {newMode ? (
                <>
                  <button
                    className="btn btn-sm btn-primary"
                    onClick={createInvoice}
                    disabled={loading}
                  >
                    {loading ? "Saving…" : "Create Invoice"}
                  </button>
                  <button
                    className="btn btn-sm btn-light border"
                    onClick={goBackToList}
                  >
                    Discard
                  </button>
                </>
              ) : isEditing ? (
                <>
                  <button
                    className="btn btn-sm btn-primary"
                    onClick={saveInvoice}
                    disabled={loading}
                  >
                    {loading ? "Saving…" : "Save"}
                  </button>
                  <button
                    className="btn btn-sm btn-light border"
                    onClick={() => setIsEditing(false)}
                  >
                    Discard
                  </button>
                </>
              ) : (
                <>
                  {statusLabel === "draft" && (
                    <button
                      className="btn btn-sm btn-light border"
                      onClick={() => setIsEditing(true)}
                    >
                      Edit
                    </button>
                  )}
                  <button
                    className="btn btn-sm btn-light border"
                    onClick={postInvoice}
                    disabled={statusLabel !== "draft"}
                  >
                    Post
                  </button>
                  <button
                    className="btn btn-sm btn-light border"
                    onClick={fiscalizeInvoice}
                    disabled={
                      statusLabel !== "posted" && statusLabel !== "paid"
                    }
                  >
                    Fiscalize
                  </button>
                  <button
                    className="btn btn-sm btn-light border"
                    onClick={resetInvoice}
                    disabled={
                      statusLabel !== "posted" && statusLabel !== "fiscalized"
                    }
                  >
                    Reset
                  </button>
                  <button
                    className="btn btn-sm btn-light border"
                    onClick={printInvoice}
                  >
                    Print PDF
                  </button>
                  <button
                    className="btn btn-sm btn-light border"
                    onClick={() => setPaymentOpen(true)}
                    disabled={statusLabel === "draft"}
                  >
                    Register Payment
                  </button>
                  <button
                    className="btn btn-sm btn-light border"
                    onClick={createCreditNote}
                    disabled={statusLabel === "draft" || isCreditNote}
                  >
                    Credit Note
                  </button>
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
                    <label className="form-label fw-semibold">
                      Customer <span className="text-danger">*</span>
                    </label>
                    <div
                      className="position-relative"
                      ref={customerDropdownRef}
                    >
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
                        <ul
                          className="list-group position-absolute w-100 shadow-sm"
                          style={{
                            zIndex: 1050,
                            maxHeight: 220,
                            overflowY: "auto",
                          }}
                        >
                          {displayContacts.map((c) => (
                            <li
                              key={c.id}
                              className={`list-group-item list-group-item-action${newCustomerId === c.id ? " active" : ""}`}
                              role="button"
                              onClick={() =>
                                selectCustomer(c.id, c.name, "new")
                              }
                            >
                              {c.name}
                            </li>
                          ))}
                          {customerSearch.trim() &&
                            !filteredContacts.some(
                              (c) =>
                                c.name.toLowerCase() ===
                                customerSearch.trim().toLowerCase(),
                            ) && (
                              <li
                                className="list-group-item list-group-item-action text-primary"
                                role="button"
                                onClick={() => createCustomerFromSearch("new")}
                              >
                                {customerCreating
                                  ? "Creating..."
                                  : `Create "${customerSearch.trim()}"`}
                              </li>
                            )}
                          {!displayContacts.length &&
                            !customerSearch.trim() && (
                              <li className="list-group-item text-muted">
                                No customers
                              </li>
                            )}
                        </ul>
                      )}
                    </div>
                  </div>
                  <div className="col-md-6">
                    <label className="form-label fw-semibold">Quotation</label>
                    <div
                      className="position-relative"
                      ref={quotationDropdownRef}
                    >
                      <input
                        className="form-control input-underline"
                        placeholder="Search or select quotation…"
                        value={quotationSearch}
                        onChange={(e) => {
                          setQuotationSearch(e.target.value);
                          setQuotationDropdownOpen(true);
                          if (!e.target.value) setNewQuotationId(null);
                        }}
                        onFocus={() => setQuotationDropdownOpen(true)}
                      />
                      {quotationDropdownOpen && (
                        <ul
                          className="list-group position-absolute w-100 shadow-sm"
                          style={{
                            zIndex: 1050,
                            maxHeight: 220,
                            overflowY: "auto",
                          }}
                        >
                          {displayQuotations.map((q) => (
                            <li
                              key={q.id}
                              className={`list-group-item list-group-item-action${newQuotationId === q.id ? " active" : ""}`}
                              role="button"
                              onClick={() => {
                                setNewQuotationId(q.id);
                                setQuotationSearch(q.reference);
                                setQuotationDropdownOpen(false);
                              }}
                            >
                              {q.reference}
                            </li>
                          ))}
                          {!displayQuotations.length &&
                            !quotationSearch.trim() && (
                              <li className="list-group-item text-muted">
                                No quotations
                              </li>
                            )}
                        </ul>
                      )}
                    </div>
                  </div>
                  <div className="col-md-3">
                    <label className="form-label">Reference</label>
                    <input
                      className="form-control input-underline bg-light"
                      value="Auto-generated"
                      readOnly
                    />
                  </div>
                  <div className="col-md-3">
                    <label className="form-label">Currency</label>
                    <select
                      className="form-select input-underline"
                      value={newCurrency}
                      onChange={(e) => setNewCurrency(e.target.value)}
                    >
                      {currencyOptions.map((cur) => (
                        <option key={cur} value={cur}>
                          {cur}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-md-3">
                    <label className="form-label">Invoice Date</label>
                    <input
                      className="form-control input-underline"
                      type="date"
                      value={newInvoiceDate}
                      onChange={(e) => setNewInvoiceDate(e.target.value)}
                    />
                  </div>
                  <div className="col-md-3">
                    <label className="form-label">Due Date</label>
                    <input
                      className="form-control input-underline"
                      type="date"
                      value={newDueDate}
                      onChange={(e) => setNewDueDate(e.target.value)}
                    />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label">Fiscal Device</label>
                    <select
                      className="form-select input-underline"
                      value={newDeviceId ?? ""}
                      onChange={(e) =>
                        setNewDeviceId(
                          e.target.value ? Number(e.target.value) : null,
                        )
                      }
                    >
                      <option value="">— None —</option>
                      {devices.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.device_id || d.serial_number || `Device ${d.id}`}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-md-4">
                    <label className="form-label">Payment Terms</label>
                    <select
                      className="form-select input-underline"
                      value={newPaymentTerms}
                      onChange={(e) => setNewPaymentTerms(e.target.value)}
                    >
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
                    <textarea
                      className="form-control input-underline"
                      rows={1}
                      value={newNotes}
                      onChange={(e) => setNewNotes(e.target.value)}
                    />
                  </div>
                </div>

                <hr className="my-4" />
                <div className="d-flex flex-wrap justify-content-between align-items-center mb-2">
                  <h6 className="fw-semibold mb-0">Invoice Lines</h6>
                  <div className="d-flex gap-2">
                    <button
                      className="btn btn-sm btn-light border"
                      onClick={addLine}
                    >
                      + Add Line
                    </button>
                    <button
                      className="btn btn-sm btn-light border"
                      onClick={() => setCreateProductOpen(true)}
                    >
                      + New Product
                    </button>
                  </div>
                </div>
                <div className="table-responsive">
                  <table className="table table-bordered align-middle mb-0">
                    <thead className="table-light">
                      <tr>
                        <th style={{ minWidth: 160 }}>Product</th>
                        <th>Description</th>
                        <th className="text-end" style={{ width: 80 }}>
                          Qty
                        </th>
                        <th style={{ width: 80 }}>UoM</th>
                        <th className="text-end" style={{ width: 100 }}>
                          Price
                        </th>
                        <th className="text-end" style={{ width: 80 }}>
                          Disc %
                        </th>
                        <th className="text-end" style={{ width: 80 }}>
                          Tax %
                        </th>
                        <th className="text-end" style={{ width: 110 }}>
                          Amount
                        </th>
                        <th style={{ width: 40 }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {editLines.map((line, index) => {
                        const product = line.product_id
                          ? productById.get(line.product_id)
                          : null;
                        const lineTotal =
                          (line.quantity || 0) *
                          (line.unit_price || 0) *
                          (1 - (line.discount || 0) / 100) *
                          (1 + (line.vat_rate || 0) / 100);
                        const displayUom = normalizeUom(
                          product?.uom || line.uom || "Units",
                        );
                        return (
                          <tr key={`new-${index}`}>
                            <td>
                              <select
                                className="form-select form-select-sm"
                                value={line.product_id ?? ""}
                                onChange={(e) => {
                                  const prod = products.find(
                                    (p) => p.id === Number(e.target.value),
                                  );
                                  updateLine(index, {
                                    product_id: e.target.value
                                      ? Number(e.target.value)
                                      : null,
                                    description: prod?.name ?? "",
                                    unit_price: prod?.sale_price ?? 0,
                                    vat_rate: prod?.tax_rate ?? 0,
                                    uom: prod?.uom || "",
                                  });
                                }}
                              >
                                <option value="">Select product</option>
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
                                value={line.description || ""}
                                onChange={(e) =>
                                  updateLine(index, {
                                    description: e.target.value,
                                  })
                                }
                              />
                            </td>
                            <td>
                              <input
                                className="form-control form-control-sm text-end"
                                type="number"
                                value={line.quantity || 0}
                                onChange={(e) =>
                                  updateLine(index, {
                                    quantity: Number(e.target.value),
                                  })
                                }
                              />
                            </td>
                            <td>
                              <input
                                className="form-control form-control-sm bg-light"
                                value={displayUom}
                                readOnly
                              />
                            </td>
                            <td>
                              <input
                                className="form-control form-control-sm text-end"
                                type="number"
                                value={line.unit_price || 0}
                                onChange={(e) =>
                                  updateLine(index, {
                                    unit_price: Number(e.target.value),
                                  })
                                }
                              />
                            </td>
                            <td>
                              <input
                                className="form-control form-control-sm text-end"
                                type="number"
                                value={line.discount || 0}
                                onChange={(e) =>
                                  updateLine(index, {
                                    discount: Number(e.target.value),
                                  })
                                }
                              />
                            </td>
                            <td>
                              <input
                                className="form-control form-control-sm text-end input-ghost"
                                type="number"
                                placeholder="Tax %"
                                value={line.vat_rate ?? ""}
                                onChange={(e) =>
                                  updateLine(index, {
                                    vat_rate: Number(e.target.value),
                                  })
                                }
                              />
                            </td>
                            <td className="text-end fw-semibold">
                              {formatCurrency(lineTotal, newCurrency)}
                            </td>
                            <td className="text-center">
                              <button
                                className="btn btn-sm btn-light border"
                                onClick={() => removeLine(index)}
                                disabled={editLines.length === 1}
                              >
                                ✕
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                      {!editLines.length && (
                        <tr>
                          <td
                            colSpan={9}
                            className="text-center py-4 text-muted"
                          >
                            Click <strong>+ Add Line</strong> to add products
                          </td>
                        </tr>
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
                        <div className="fs-5 fw-bold">
                          {formatCurrency(
                            selectedInvoice.total_amount || 0,
                            invoiceCurrency,
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="col-md-3">
                    <div className="card border-0 bg-light h-100">
                      <div className="card-body py-2">
                        <small className="text-muted">Amount Paid</small>
                        <div className="fs-5 fw-bold">
                          {formatCurrency(
                            selectedInvoice.amount_paid || 0,
                            invoiceCurrency,
                          )}
                        </div>
                        <span className={`badge bg-${paymentBadge}`}>
                          {paymentStatus}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="col-md-3">
                    <div className="card border-0 bg-light h-100">
                      <div className="card-body py-2">
                        <small className="text-muted">Amount Due</small>
                        <div className="fs-5 fw-bold">
                          {formatCurrency(
                            selectedInvoice.amount_due || 0,
                            invoiceCurrency,
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="col-md-3">
                    <div className="card border-0 bg-light h-100">
                      <div className="card-body py-2">
                        <small className="text-muted">Fiscalization</small>
                        <div className="fw-bold text-uppercase" style={{ color: selectedInvoice.zimra_status === "error" ? "#dc3545" : selectedInvoice.zimra_status === "submitted" ? "#198754" : undefined }}>
                          {selectedInvoice.zimra_status || "not_submitted"}
                        </div>
                        {selectedInvoice.zimra_verification_code && (
                          <small className="text-muted">
                            Code: {selectedInvoice.zimra_verification_code}
                          </small>
                        )}
                        {selectedInvoice.zimra_status === "submitted" && selectedInvoice.zimra_verification_url && (
                          <div style={{ marginTop: 4 }}>
                            <a href={selectedInvoice.zimra_verification_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: "var(--accent)" }}>
                              Verify on ZIMRA ↗
                            </a>
                          </div>
                        )}
                        {selectedInvoice.zimra_status === "error" && selectedInvoice.zimra_errors && (
                          <div style={{ marginTop: 6, padding: "6px 8px", background: "#fff3f3", border: "1px solid #f5c2c7", borderRadius: 6, fontSize: 11, color: "#842029", maxHeight: 120, overflowY: "auto", wordBreak: "break-word" }}>
                            {selectedInvoice.zimra_errors}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* ZIMRA Fiscal Details Panel */}
                {selectedInvoice.zimra_status === "submitted" && (() => {
                  const dev = devices.find(d => d.id === selectedInvoice.device_id);
                  return (
                    <div className="card border-0 mb-4" style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 10 }}>
                      <div className="card-body" style={{ padding: "14px 18px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: "#166534", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>
                              ZIMRA Fiscal Details
                            </div>
                            <div style={{ fontSize: 12, lineHeight: 1.8, color: "#374151" }}>
                              <div><strong>Verification Code:</strong> {selectedInvoice.zimra_verification_code || "—"}</div>
                              <div><strong>Receipt #:</strong> {selectedInvoice.zimra_receipt_counter || "—"} / Global #{selectedInvoice.zimra_receipt_global_no || "—"}</div>
                              <div><strong>Receipt ID:</strong> {selectedInvoice.zimra_receipt_id || "—"}</div>
                              <div><strong>Fiscalized:</strong> {selectedInvoice.fiscalized_at ? new Date(selectedInvoice.fiscalized_at).toLocaleString() : "—"}</div>
                            </div>
                            <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid #bbf7d0", fontSize: 12, lineHeight: 1.8, color: "#374151" }}>
                              <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.3, marginBottom: 2, color: "#166534" }}>Device Information</div>
                              <div><strong>Device ID:</strong> {dev?.device_id || "—"}</div>
                              <div><strong>Serial No:</strong> {dev?.serial_number || "—"}</div>
                              <div><strong>Model:</strong> {dev?.model || "—"}</div>
                            </div>
                            {selectedInvoice.zimra_verification_url && (
                              <div style={{ marginTop: 8 }}>
                                <a href={selectedInvoice.zimra_verification_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: "#166534", wordBreak: "break-all" }}>
                                  {selectedInvoice.zimra_verification_url}
                                </a>
                              </div>
                            )}
                          </div>
                          {selectedInvoice.zimra_verification_url && (
                            <div style={{ textAlign: "center", flexShrink: 0 }}>
                              <img src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(selectedInvoice.zimra_verification_url)}`} width={120} height={120} style={{ border: "1px solid #bbf7d0", borderRadius: 6 }} alt="QR" />
                              <div style={{ fontSize: 10, color: "#6b7280", marginTop: 4 }}>Scan to verify</div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Fields */}
                <div className="row g-3 mb-4">
                  <div className="col-md-6">
                    <label className="form-label fw-semibold">Customer</label>
                    {canEdit ? (
                      <div
                        className="position-relative"
                        ref={customerDropdownRef}
                      >
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
                          <ul
                            className="list-group position-absolute w-100 shadow-sm"
                            style={{
                              zIndex: 1050,
                              maxHeight: 220,
                              overflowY: "auto",
                            }}
                          >
                            {displayContacts.map((c) => (
                              <li
                                key={c.id}
                                className={`list-group-item list-group-item-action${editCustomerId === c.id ? " active" : ""}`}
                                role="button"
                                onClick={() =>
                                  selectCustomer(c.id, c.name, "edit")
                                }
                              >
                                {c.name}
                              </li>
                            ))}
                            {customerSearch.trim() &&
                              !filteredContacts.some(
                                (c) =>
                                  c.name.toLowerCase() ===
                                  customerSearch.trim().toLowerCase(),
                              ) && (
                                <li
                                  className="list-group-item list-group-item-action text-primary"
                                  role="button"
                                  onClick={() =>
                                    createCustomerFromSearch("edit")
                                  }
                                >
                                  {customerCreating
                                    ? "Creating..."
                                    : `Create "${customerSearch.trim()}"`}
                                </li>
                              )}
                            {!displayContacts.length &&
                              !customerSearch.trim() && (
                                <li className="list-group-item text-muted">
                                  No customers
                                </li>
                              )}
                          </ul>
                        )}
                      </div>
                    ) : (
                      <div className="form-control-plaintext">
                        {customer?.name || "—"}
                      </div>
                    )}
                  </div>
                  <div className="col-md-3">
                    <label className="form-label fw-semibold">
                      Invoice Date
                    </label>
                    {canEdit ? (
                      <input
                        className="form-control input-underline"
                        type="date"
                        value={editInvoiceDate}
                        onChange={(e) => setEditInvoiceDate(e.target.value)}
                      />
                    ) : (
                      <div className="form-control-plaintext">
                        {invoiceDateLabel}
                      </div>
                    )}
                  </div>
                  <div className="col-md-3">
                    <label className="form-label fw-semibold">Due Date</label>
                    {canEdit ? (
                      <input
                        className="form-control input-underline"
                        type="date"
                        value={editDueDate}
                        onChange={(e) => setEditDueDate(e.target.value)}
                      />
                    ) : (
                      <div className="form-control-plaintext">
                        {selectedInvoice?.due_date
                          ? new Date(
                              selectedInvoice.due_date,
                            ).toLocaleDateString()
                          : "—"}
                      </div>
                    )}
                  </div>
                  <div className="col-md-4">
                    <label className="form-label">Quotation</label>
                    {canEdit ? (
                      <div
                        className="position-relative"
                        ref={quotationDropdownRef}
                      >
                        <input
                          className="form-control input-underline"
                          placeholder="Search or select quotation…"
                          value={quotationSearch}
                          onChange={(e) => {
                            setQuotationSearch(e.target.value);
                            setQuotationDropdownOpen(true);
                            if (!e.target.value) setEditQuotationId(null);
                          }}
                          onFocus={() => setQuotationDropdownOpen(true)}
                        />
                        {quotationDropdownOpen && (
                          <ul
                            className="list-group position-absolute w-100 shadow-sm"
                            style={{
                              zIndex: 1050,
                              maxHeight: 220,
                              overflowY: "auto",
                            }}
                          >
                            {displayQuotations.map((q) => (
                              <li
                                key={q.id}
                                className={`list-group-item list-group-item-action${editQuotationId === q.id ? " active" : ""}`}
                                role="button"
                                onClick={() => {
                                  setEditQuotationId(q.id);
                                  setQuotationSearch(q.reference);
                                  setQuotationDropdownOpen(false);
                                }}
                              >
                                {q.reference}
                              </li>
                            ))}
                            {!displayQuotations.length &&
                              !quotationSearch.trim() && (
                                <li className="list-group-item text-muted">
                                  No quotations
                                </li>
                              )}
                          </ul>
                        )}
                      </div>
                    ) : (
                      <div className="form-control-plaintext">
                        {linkedQuotation?.reference || "—"}
                      </div>
                    )}
                  </div>
                  <div className="col-md-4">
                    <label className="form-label">Reference</label>
                    <div className="form-control-plaintext fw-semibold">
                      {selectedInvoice?.reference || "—"}
                    </div>
                  </div>
                  <div className="col-md-4">
                    <label className="form-label">Currency</label>
                    {canEdit ? (
                      <select
                        className="form-select input-underline"
                        value={editCurrency}
                        onChange={(e) => setEditCurrency(e.target.value)}
                      >
                        {currencyOptions.map((cur) => (
                          <option key={cur} value={cur}>
                            {cur}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div className="form-control-plaintext">
                        {invoiceCurrency}
                      </div>
                    )}
                  </div>
                  <div className="col-md-4">
                    <label className="form-label">Fiscal Device</label>
                    {canEdit ? (
                      <select
                        className="form-select input-underline"
                        value={editDeviceId ?? ""}
                        onChange={(e) =>
                          setEditDeviceId(
                            e.target.value ? Number(e.target.value) : null,
                          )
                        }
                      >
                        <option value="">— None —</option>
                        {devices.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.device_id || d.serial_number || `Device ${d.id}`}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div className="form-control-plaintext">
                        {devices.find(
                          (d) => d.id === selectedInvoice?.device_id,
                        )?.device_id || "—"}
                      </div>
                    )}
                  </div>
                  <div className="col-md-4">
                    <label className="form-label">Payment Terms</label>
                    {canEdit ? (
                      <select
                        className="form-select input-underline"
                        value={editPaymentTerms}
                        onChange={(e) => setEditPaymentTerms(e.target.value)}
                      >
                        <option value="">Select terms</option>
                        <option value="7 Days">7 Days</option>
                        <option value="14 Days">14 Days</option>
                        <option value="30 Days">30 Days</option>
                        <option value="2 Weeks">2 Weeks</option>
                        <option value="1 Month">1 Month</option>
                        <option value="6 Months">6 Months</option>
                      </select>
                    ) : (
                      <div className="form-control-plaintext">
                        {selectedInvoice?.payment_terms || "—"}
                      </div>
                    )}
                  </div>
                  <div className="col-md-4">
                    <label className="form-label">Payment Reference</label>
                    <div className="form-control-plaintext">
                      {selectedInvoice?.payment_reference || "—"}
                    </div>
                  </div>
                  <div className="col-12">
                    <label className="form-label">Notes</label>
                    {canEdit ? (
                      <textarea
                        className="form-control input-underline"
                        rows={2}
                        value={editNotes}
                        onChange={(e) => setEditNotes(e.target.value)}
                      />
                    ) : (
                      <div className="form-control-plaintext">
                        {selectedInvoice?.notes || "—"}
                      </div>
                    )}
                  </div>
                </div>

                {/* Lines table */}
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <div className="fw-semibold">Invoice Lines</div>
                  {canEdit && (
                    <div className="d-flex gap-2">
                      <button
                        className="btn btn-sm btn-light border"
                        onClick={addLine}
                      >
                        + Add Line
                      </button>
                      <button
                        className="btn btn-sm btn-light border"
                        onClick={() => setCreateProductOpen(true)}
                      >
                        + New Product
                      </button>
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
                        <th className="text-end">Price</th>
                        <th className="text-end">Disc %</th>
                        <th className="text-end">Tax %</th>
                        <th className="text-end">Amount</th>
                        {canEdit && <th></th>}
                      </tr>
                    </thead>
                    <tbody>
                      {displayLines.map((line, index) => {
                        const product = line.product_id
                          ? productById.get(line.product_id)
                          : null;
                        const lineTotal =
                          (line.quantity || 0) *
                          (line.unit_price || 0) *
                          (1 - (line.discount || 0) / 100) *
                          (1 + (line.vat_rate || 0) / 100);
                        const displayUom = normalizeUom(
                          product?.uom || line.uom || "",
                        );
                        return (
                          <tr key={line.id || `edit-${index}`}>
                            <td>
                              {canEdit ? (
                                <select
                                  className="form-select form-select-sm"
                                  value={line.product_id ?? ""}
                                  onChange={(e) => {
                                    const prod = products.find(
                                      (p) => p.id === Number(e.target.value),
                                    );
                                    updateLine(index, {
                                      product_id: e.target.value
                                        ? Number(e.target.value)
                                        : null,
                                      description: prod?.name ?? "",
                                      unit_price: prod?.sale_price ?? 0,
                                      vat_rate: prod?.tax_rate ?? 0,
                                      uom: prod?.uom || "Units",
                                    });
                                  }}
                                >
                                  <option value="">Select</option>
                                  {products.map((p) => (
                                    <option key={p.id} value={p.id}>
                                      {p.name} (avail:{" "}
                                      {p.quantity_available ?? 0})
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                (product?.name ?? "—")
                              )}
                            </td>
                            <td>
                              {canEdit ? (
                                <input
                                  className="form-control form-control-sm"
                                  value={line.description || ""}
                                  onChange={(e) =>
                                    updateLine(index, {
                                      description: e.target.value,
                                    })
                                  }
                                />
                              ) : (
                                line.description || "—"
                              )}
                            </td>
                            <td className="text-end">
                              {canEdit ? (
                                <input
                                  className="form-control form-control-sm text-end"
                                  type="number"
                                  value={line.quantity || 0}
                                  onChange={(e) =>
                                    updateLine(index, {
                                      quantity: Number(e.target.value),
                                    })
                                  }
                                />
                              ) : (
                                line.quantity
                              )}
                            </td>
                            <td>
                              {canEdit ? (
                                <input
                                  className="form-control form-control-sm bg-light"
                                  value={displayUom}
                                  readOnly
                                />
                              ) : (
                                displayUom || "—"
                              )}
                            </td>
                            <td className="text-end">
                              {canEdit ? (
                                <input
                                  className="form-control form-control-sm text-end"
                                  type="number"
                                  value={line.unit_price || 0}
                                  onChange={(e) =>
                                    updateLine(index, {
                                      unit_price: Number(e.target.value),
                                    })
                                  }
                                />
                              ) : (
                                formatCurrency(
                                  line.unit_price || 0,
                                  invoiceCurrency,
                                )
                              )}
                            </td>
                            <td className="text-end">
                              {canEdit ? (
                                <input
                                  className="form-control form-control-sm text-end"
                                  type="number"
                                  value={line.discount || 0}
                                  onChange={(e) =>
                                    updateLine(index, {
                                      discount: Number(e.target.value),
                                    })
                                  }
                                />
                              ) : line.discount ? (
                                `${line.discount}%`
                              ) : (
                                "—"
                              )}
                            </td>
                            <td className="text-end">
                              {canEdit ? (
                                <input
                                  className="form-control form-control-sm text-end input-ghost"
                                  type="number"
                                  placeholder="Tax %"
                                  value={line.vat_rate ?? ""}
                                  onChange={(e) =>
                                    updateLine(index, {
                                      vat_rate: Number(e.target.value),
                                    })
                                  }
                                />
                              ) : line.vat_rate ? (
                                `${line.vat_rate}%`
                              ) : (
                                "—"
                              )}
                            </td>
                            <td className="text-end fw-semibold">
                              {formatCurrency(lineTotal, invoiceCurrency)}
                            </td>
                            {canEdit && (
                              <td className="text-center">
                                <button
                                  className="btn btn-sm btn-light border"
                                  onClick={() => removeLine(index)}
                                  disabled={displayLines.length === 1}
                                >
                                  ✕
                                </button>
                              </td>
                            )}
                          </tr>
                        );
                      })}
                      {!displayLines.length && (
                        <tr>
                          <td
                            colSpan={canEdit ? 9 : 8}
                            className="text-center py-4 text-muted"
                          >
                            No invoice lines
                          </td>
                        </tr>
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
                        {taxBreakdown.length === 0 && (
                          <small className="text-muted">No taxes applied</small>
                        )}
                        {taxBreakdown.map(([rate, amt]) => (
                          <div
                            key={rate}
                            className="d-flex justify-content-between text-muted small"
                          >
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
                        <div className="d-flex justify-content-between">
                          <span>Subtotal</span>
                          <span>
                            {formatCurrency(
                              selectedInvoice.subtotal || 0,
                              invoiceCurrency,
                            )}
                          </span>
                        </div>
                        <div className="d-flex justify-content-between">
                          <span>Discount</span>
                          <span>
                            -
                            {formatCurrency(
                              selectedInvoice.discount_amount || 0,
                              invoiceCurrency,
                            )}
                          </span>
                        </div>
                        <div className="d-flex justify-content-between">
                          <span>Tax</span>
                          <span>
                            {formatCurrency(
                              selectedInvoice.tax_amount || 0,
                              invoiceCurrency,
                            )}
                          </span>
                        </div>
                        <hr className="my-1" />
                        <div className="d-flex justify-content-between fw-bold">
                          <span>Total</span>
                          <span>
                            {formatCurrency(
                              selectedInvoice.total_amount || 0,
                              invoiceCurrency,
                            )}
                          </span>
                        </div>
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
            onClick={(e) => {
              if (e.target === e.currentTarget) setPaymentOpen(false);
            }}
          >
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content shadow-lg border-0">
                <div className="modal-header border-bottom">
                  <h5 className="modal-title fw-semibold">Register Payment</h5>
                  <button
                    type="button"
                    className="btn-close"
                    onClick={() => setPaymentOpen(false)}
                  />
                </div>
                <div className="modal-body py-4">
                  <div className="mb-3">
                    <label className="form-label fw-semibold">Amount</label>
                    <input
                      className="form-control"
                      type="number"
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(e.target.value)}
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label fw-semibold">
                      Payment Reference
                    </label>
                    <input
                      className="form-control"
                      value={paymentReference}
                      onChange={(e) => setPaymentReference(e.target.value)}
                    />
                  </div>
                </div>
                <div className="modal-footer border-top">
                  <button
                    className="btn btn-light border"
                    onClick={() => setPaymentOpen(false)}
                  >
                    Cancel
                  </button>
                  <button className="btn btn-primary" onClick={registerPayment}>
                    Confirm Payment
                  </button>
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
            style={{
              position: "fixed",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "1rem",
              zIndex: 1050,
              background: "transparent",
            }}
            onClick={(e) => {
              if (e.target === e.currentTarget) setCreateProductOpen(false);
            }}
          >
            <div
              className="modal-dialog modal-lg modal-dialog-centered"
              style={{ margin: 0, width: "100%", maxWidth: 720 }}
            >
              <div className="modal-content shadow-lg border-0">
                <div className="modal-header border-bottom">
                  <h5 className="modal-title fw-semibold">Create Product</h5>
                  <button
                    type="button"
                    className="btn-close"
                    onClick={() => setCreateProductOpen(false)}
                  />
                </div>
                <div className="modal-body py-4">
                  <div className="row g-3">
                    <div className="col-md-6">
                      <label className="form-label">Product Name</label>
                      <input
                        className="form-control"
                        value={productName}
                        onChange={(e) => setProductName(e.target.value)}
                      />
                    </div>
                    <div className="col-md-3">
                      <label className="form-label">Sale Price</label>
                      <input
                        className="form-control"
                        type="number"
                        value={productPrice}
                        onChange={(e) => setProductPrice(e.target.value)}
                      />
                    </div>
                    <div className="col-md-3">
                      <label className="form-label">Tax Rate %</label>
                      <input
                        className="form-control"
                        type="number"
                        value={productTaxRate}
                        onChange={(e) => setProductTaxRate(e.target.value)}
                      />
                    </div>
                    <div className="col-md-3">
                      <label className="form-label">Reference / SKU</label>
                      <input
                        className="form-control"
                        value={productReference}
                        onChange={(e) => setProductReference(e.target.value)}
                        placeholder="e.g., PROD-001"
                      />
                    </div>
                    <div className="col-md-3">
                      <label className="form-label">HS Code</label>
                      <input
                        className="form-control"
                        value={productHsCode}
                        onChange={(e) => setProductHsCode(e.target.value)}
                        placeholder="Harmonized code"
                      />
                    </div>
                    <div className="col-md-3">
                      <label className="form-label">UoM</label>
                      <input
                        className="form-control"
                        value={productUom}
                        onChange={(e) => setProductUom(e.target.value)}
                      />
                    </div>
                    <div className="col-md-3">
                      <label className="form-label">Initial Stock</label>
                      <input
                        className="form-control"
                        type="number"
                        value={productInitialStock}
                        onChange={(e) => setProductInitialStock(e.target.value)}
                      />
                    </div>
                    <div className="col-md-3">
                      <label className="form-label">Warehouse</label>
                      <select
                        className="form-select"
                        value={productWarehouseId ?? ""}
                        onChange={(e) =>
                          setProductWarehouseId(Number(e.target.value))
                        }
                      >
                        <option value="">Select warehouse</option>
                        {warehouses.map((w) => (
                          <option key={w.id} value={w.id}>
                            {w.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="col-md-3">
                      <label className="form-label">Location</label>
                      <select
                        className="form-select"
                        value={productLocationId ?? ""}
                        onChange={(e) =>
                          setProductLocationId(Number(e.target.value))
                        }
                      >
                        <option value="">Select location</option>
                        {locations.map((l) => (
                          <option key={l.id} value={l.id}>
                            {l.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
                <div className="modal-footer border-top">
                  <button
                    className="btn btn-light border"
                    onClick={() => setCreateProductOpen(false)}
                  >
                    Cancel
                  </button>
                  <button className="btn btn-primary" onClick={createProduct}>
                    Create Product
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
