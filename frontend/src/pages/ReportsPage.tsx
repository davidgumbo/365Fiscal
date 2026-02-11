import { useEffect, useState, useCallback } from "react";
import { apiFetch } from "../api";
import { useMe } from "../hooks/useMe";

/* ── Interfaces ──────────────────────────────────────── */

interface InvoiceLine {
  id: number;
  product_id: number | null;
  description: string;
  quantity: number;
  unit_price: number;
  discount: number;
  vat_rate: number;
  subtotal: number;
  tax_amount: number;
  total_price: number;
}

interface Invoice {
  id: number;
  reference: string;
  status: string;
  invoice_date: string | null;
  total_amount: number;
  amount_paid: number;
  tax_amount: number;
  subtotal: number;
  customer_id: number | null;
  invoice_type: string;
  lines: InvoiceLine[];
  created_at: string;
}

interface Product {
  id: number;
  name: string;
  sale_price: number;
  purchase_cost: number;
  category_id: number | null;
  product_type: string;
  uom: string;
  reorder_point: number;
  is_active: boolean;
}

interface StockQuant {
  id: number;
  product_id: number;
  quantity: number;
  available_quantity: number;
  reserved_quantity: number;
  unit_cost: number;
  total_value: number;
}

interface StockMoveItem {
  id: number;
  product_id: number;
  move_type: string;
  quantity: number;
  reference: string;
  state: string;
  created_at: string;
}

interface PaymentItem {
  id: number;
  reference: string;
  invoice_id: number | null;
  amount: number;
  payment_method: string;
  payment_date: string | null;
  status: string;
  reconciled_at: string | null;
  created_at: string;
}

interface PurchaseOrderLine {
  id: number;
  product_id: number | null;
  description: string;
  quantity: number;
  unit_price: number;
  discount: number;
  vat_rate: number;
  subtotal: number;
  tax_amount: number;
  total_price: number;
}

interface PurchaseOrder {
  id: number;
  reference: string;
  status: string;
  order_date: string | null;
  total_amount: number;
  tax_amount: number;
  lines: PurchaseOrderLine[];
}

interface CompanySettings {
  currency_code?: string;
  currency_symbol?: string;
}

/* ── Report data shapes ──────────────────────────────── */

interface TopProduct {
  name: string;
  quantity: number;
  revenue: number;
}

interface MonthlySales {
  month: string;
  amount: number;
  count: number;
}

interface SalesReport {
  total_sales: number;
  total_invoices: number;
  paid_invoices: number;
  pending_invoices: number;
  total_tax: number;
  average_invoice: number;
  top_products: TopProduct[];
  sales_by_month: MonthlySales[];
}

interface StockReport {
  total_products: number;
  total_value: number;
  low_stock_items: {
    name: string;
    on_hand: number;
    available: number;
    reorder: number;
  }[];
  stock_summary: {
    name: string;
    on_hand: number;
    available: number;
    reserved: number;
    value: number;
  }[];
  recent_movements: {
    product: string;
    type: string;
    quantity: number;
    reference: string;
    date: string;
    state: string;
  }[];
}

interface PaymentReport {
  total_payments: number;
  total_amount: number;
  reconciled_count: number;
  reconciled_amount: number;
  pending_count: number;
  pending_amount: number;
  by_method: { method: string; count: number; amount: number }[];
  recent_payments: {
    reference: string;
    invoice: string;
    amount: number;
    date: string;
    method: string;
    status: string;
  }[];
}

interface VatReport {
  sales_total: number;
  purchases_total: number;
  profit: number;
  output_tax: number;
  input_tax: number;
  net_tax: number;
  invoices_count: number;
  purchases_count: number;
}

type ReportType = "sales" | "stock" | "payments" | "vat";

const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/* ── Component ───────────────────────────────────────── */

export default function ReportsPage() {
  const { me } = useMe();
  const companyId = me?.company_ids?.[0];

  const [activeReport, setActiveReport] = useState<ReportType>("sales");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [dateRange, setDateRange] = useState({ from: "", to: "" });

  const [salesReport, setSalesReport] = useState<SalesReport | null>(null);
  const [stockReport, setStockReport] = useState<StockReport | null>(null);
  const [paymentReport, setPaymentReport] = useState<PaymentReport | null>(
    null,
  );
  const [vatReport, setVatReport] = useState<VatReport | null>(null);
  const [companySettings, setCompanySettings] =
    useState<CompanySettings | null>(null);

  // Set default date range
  useEffect(() => {
    const now = new Date();
    const first = new Date(now.getFullYear(), now.getMonth(), 1);
    const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    setDateRange({
      from: first.toISOString().split("T")[0],
      to: last.toISOString().split("T")[0],
    });
  }, []);

  // Load company settings for currency
  useEffect(() => {
    if (!companyId) return;
    apiFetch<CompanySettings>(`/company-settings?company_id=${companyId}`)
      .then(setCompanySettings)
      .catch(() => {});
  }, [companyId]);

  const currencySymbol = companySettings?.currency_symbol || "$";

  const formatCurrency = useCallback(
    (amount: number) => {
      const abs = Math.abs(amount);
      const formatted = abs.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
      return `${amount < 0 ? "-" : ""}${currencySymbol}${formatted}`;
    },
    [currencySymbol],
  );

  /* ── Data loaders ──────────────────────────────── */

  const loadSalesReport = useCallback(async () => {
    if (!companyId) return;
    const [invoices, products] = await Promise.all([
      apiFetch<Invoice[]>(`/invoices?company_id=${companyId}`),
      apiFetch<Product[]>(`/products?company_id=${companyId}`),
    ]);

    const fromDate = dateRange.from ? new Date(dateRange.from) : null;
    const toDate = dateRange.to ? new Date(dateRange.to + "T23:59:59") : null;

    // Filter invoices by date range — only count actual invoices (not credit notes)
    const filtered = invoices.filter((inv) => {
      if (inv.invoice_type === "credit_note") return false;
      const d = inv.invoice_date
        ? new Date(inv.invoice_date)
        : new Date(inv.created_at);
      if (fromDate && d < fromDate) return false;
      if (toDate && d > toDate) return false;
      return true;
    });

    const totalSales = filtered.reduce((s, i) => s + (i.total_amount || 0), 0);
    const totalTax = filtered.reduce((s, i) => s + (i.tax_amount || 0), 0);
    const paidInvoices = filtered.filter(
      (i) =>
        i.status === "paid" ||
        i.status === "fiscalized" ||
        i.amount_paid >= i.total_amount,
    );
    const pendingInvoices = filtered.filter(
      (i) =>
        i.status !== "paid" &&
        i.status !== "fiscalized" &&
        i.status !== "cancelled",
    );

    // Aggregate top products from real invoice lines
    const productMap = new Map<
      number,
      { name: string; qty: number; revenue: number }
    >();
    const prodLookup = new Map(products.map((p) => [p.id, p]));

    for (const inv of filtered) {
      if (!inv.lines) continue;
      for (const line of inv.lines) {
        const pid = line.product_id;
        if (!pid) continue;
        const existing = productMap.get(pid);
        const prodName =
          prodLookup.get(pid)?.name || line.description || `Product #${pid}`;
        if (existing) {
          existing.qty += line.quantity;
          existing.revenue += line.total_price || line.subtotal || 0;
        } else {
          productMap.set(pid, {
            name: prodName,
            qty: line.quantity,
            revenue: line.total_price || line.subtotal || 0,
          });
        }
      }
    }
    const topProducts: TopProduct[] = Array.from(productMap.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10)
      .map((p) => ({
        name: p.name,
        quantity: Math.round(p.qty * 100) / 100,
        revenue: p.revenue,
      }));

    // Monthly breakdown
    const monthlyMap = new Map<string, { amount: number; count: number }>();
    for (const inv of filtered) {
      const d = inv.invoice_date
        ? new Date(inv.invoice_date)
        : new Date(inv.created_at);
      const key = `${d.getFullYear()}-${String(d.getMonth()).padStart(2, "0")}`;
      const existing = monthlyMap.get(key);
      if (existing) {
        existing.amount += inv.total_amount || 0;
        existing.count++;
      } else {
        monthlyMap.set(key, { amount: inv.total_amount || 0, count: 1 });
      }
    }
    const salesByMonth: MonthlySales[] = Array.from(monthlyMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, val]) => {
        const [, m] = key.split("-");
        return {
          month: `${MONTH_NAMES[parseInt(m)]}`,
          amount: val.amount,
          count: val.count,
        };
      });

    setSalesReport({
      total_sales: totalSales,
      total_invoices: filtered.length,
      paid_invoices: paidInvoices.length,
      pending_invoices: pendingInvoices.length,
      total_tax: totalTax,
      average_invoice: filtered.length > 0 ? totalSales / filtered.length : 0,
      top_products: topProducts,
      sales_by_month: salesByMonth,
    });
  }, [companyId, dateRange]);

  const loadStockReport = useCallback(async () => {
    if (!companyId) return;
    const [products, quants, moves] = await Promise.all([
      apiFetch<Product[]>(`/products?company_id=${companyId}`),
      apiFetch<StockQuant[]>(`/stock/quants?company_id=${companyId}`).catch(
        () => [] as StockQuant[],
      ),
      apiFetch<StockMoveItem[]>(`/stock/moves?company_id=${companyId}`).catch(
        () => [] as StockMoveItem[],
      ),
    ]);

    const prodLookup = new Map(products.map((p) => [p.id, p]));

    // Build stock summary from quants
    const stockSummary = quants.map((q) => {
      const prod = prodLookup.get(q.product_id);
      return {
        name: prod?.name || `Product #${q.product_id}`,
        on_hand: q.quantity,
        available: q.available_quantity,
        reserved: q.reserved_quantity,
        value: q.total_value || q.quantity * q.unit_cost,
      };
    });

    const totalValue = stockSummary.reduce((s, i) => s + i.value, 0);

    // Low stock = quantity below reorder point
    const lowStock = quants
      .map((q) => {
        const prod = prodLookup.get(q.product_id);
        if (!prod) return null;
        const reorder = prod.reorder_point || 0;
        if (reorder > 0 && q.available_quantity <= reorder) {
          return {
            name: prod.name,
            on_hand: q.quantity,
            available: q.available_quantity,
            reorder,
          };
        }
        return null;
      })
      .filter(Boolean) as StockReport["low_stock_items"];

    // Recent movements
    const recentMoves = moves.slice(0, 15).map((m) => {
      const prod = prodLookup.get(m.product_id);
      return {
        product: prod?.name || `Product #${m.product_id}`,
        type: m.move_type.toUpperCase(),
        quantity: m.quantity,
        reference: m.reference,
        date: new Date(m.created_at).toLocaleDateString(),
        state: m.state,
      };
    });

    setStockReport({
      total_products: products.filter((p) => p.is_active).length,
      total_value: totalValue,
      low_stock_items: lowStock,
      stock_summary: stockSummary
        .sort((a, b) => b.value - a.value)
        .slice(0, 20),
      recent_movements: recentMoves,
    });
  }, [companyId]);

  const loadPaymentReport = useCallback(async () => {
    if (!companyId) return;
    const payments = await apiFetch<PaymentItem[]>(
      `/payments?company_id=${companyId}`,
    ).catch(() => [] as PaymentItem[]);
    const invoices = await apiFetch<Invoice[]>(
      `/invoices?company_id=${companyId}`,
    ).catch(() => [] as Invoice[]);

    const fromDate = dateRange.from ? new Date(dateRange.from) : null;
    const toDate = dateRange.to ? new Date(dateRange.to + "T23:59:59") : null;

    const filtered = payments.filter((p) => {
      const d = p.payment_date
        ? new Date(p.payment_date)
        : new Date(p.created_at);
      if (fromDate && d < fromDate) return false;
      if (toDate && d > toDate) return false;
      return true;
    });

    const invLookup = new Map(invoices.map((i) => [i.id, i.reference]));

    const totalAmount = filtered.reduce((s, p) => s + (p.amount || 0), 0);
    const reconciled = filtered.filter(
      (p) => p.status === "reconciled" || p.reconciled_at,
    );
    const reconciledAmount = reconciled.reduce(
      (s, p) => s + (p.amount || 0),
      0,
    );
    const pending = filtered.filter(
      (p) => p.status !== "reconciled" && p.status !== "cancelled",
    );
    const pendingAmount = pending.reduce((s, p) => s + (p.amount || 0), 0);

    // By method
    const methodMap = new Map<string, { count: number; amount: number }>();
    for (const p of filtered) {
      const method = p.payment_method || "other";
      const existing = methodMap.get(method);
      if (existing) {
        existing.count++;
        existing.amount += p.amount || 0;
      } else {
        methodMap.set(method, { count: 1, amount: p.amount || 0 });
      }
    }

    setPaymentReport({
      total_payments: filtered.length,
      total_amount: totalAmount,
      reconciled_count: reconciled.length,
      reconciled_amount: reconciledAmount,
      pending_count: pending.length,
      pending_amount: pendingAmount,
      by_method: Array.from(methodMap.entries())
        .sort(([, a], [, b]) => b.amount - a.amount)
        .map(([method, data]) => ({
          method: method.replace(/_/g, " "),
          count: data.count,
          amount: data.amount,
        })),
      recent_payments: filtered.slice(0, 15).map((p) => ({
        reference: p.reference || "-",
        invoice: p.invoice_id
          ? invLookup.get(p.invoice_id) || `INV-${p.invoice_id}`
          : "-",
        amount: p.amount || 0,
        date: p.payment_date
          ? new Date(p.payment_date).toLocaleDateString()
          : "-",
        method: (p.payment_method || "other").replace(/_/g, " "),
        status: p.status,
      })),
    });
  }, [companyId, dateRange]);

  const loadVatReport = useCallback(async () => {
    if (!companyId) return;
    const [invoices, purchases] = await Promise.all([
      apiFetch<Invoice[]>(`/invoices?company_id=${companyId}`).catch(
        () => [] as Invoice[],
      ),
      apiFetch<PurchaseOrder[]>(`/purchases?company_id=${companyId}`).catch(
        () => [] as PurchaseOrder[],
      ),
    ]);

    const fromDate = dateRange.from ? new Date(dateRange.from) : null;
    const toDate = dateRange.to ? new Date(dateRange.to + "T23:59:59") : null;

    const filteredInvoices = invoices.filter((inv) => {
      if (inv.invoice_type === "credit_note") return false;
      if (inv.status === "cancelled") return false;
      const d = inv.invoice_date
        ? new Date(inv.invoice_date)
        : new Date(inv.created_at);
      if (fromDate && d < fromDate) return false;
      if (toDate && d > toDate) return false;
      return true;
    });

    const filteredPurchases = purchases.filter((po) => {
      if (po.status === "cancelled") return false;
      const d = po.order_date ? new Date(po.order_date) : null;
      if (fromDate && d && d < fromDate) return false;
      if (toDate && d && d > toDate) return false;
      return true;
    });

    const salesTotal = filteredInvoices.reduce(
      (s, i) => s + (i.total_amount || 0),
      0,
    );
    const outputTax = filteredInvoices.reduce(
      (s, i) => s + (i.tax_amount || 0),
      0,
    );
    const purchasesTotal = filteredPurchases.reduce(
      (s, p) => s + (p.total_amount || 0),
      0,
    );
    const inputTax = filteredPurchases.reduce(
      (s, p) => s + (p.tax_amount || 0),
      0,
    );

    setVatReport({
      sales_total: salesTotal,
      purchases_total: purchasesTotal,
      profit: salesTotal - purchasesTotal,
      output_tax: outputTax,
      input_tax: inputTax,
      net_tax: outputTax - inputTax,
      invoices_count: filteredInvoices.length,
      purchases_count: filteredPurchases.length,
    });
  }, [companyId, dateRange]);

  const loadReport = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      if (activeReport === "sales") await loadSalesReport();
      else if (activeReport === "stock") await loadStockReport();
      else if (activeReport === "payments") await loadPaymentReport();
      else if (activeReport === "vat") await loadVatReport();
    } catch (err: any) {
      console.error("Report load error:", err);
      setError(err?.message || "Failed to load report data");
    } finally {
      setLoading(false);
    }
  }, [activeReport, loadSalesReport, loadStockReport, loadPaymentReport, loadVatReport]);

  useEffect(() => {
    if (!companyId || !dateRange.from || !dateRange.to) return;
    loadReport();
  }, [companyId, activeReport, dateRange.from, dateRange.to]);

  /* ── Export functions ──────────────────────────── */

  const exportCSV = () => {
    let rows: string[][] = [];
    let filename = "report.csv";

    if (activeReport === "sales" && salesReport) {
      filename = `sales-report-${dateRange.from}-to-${dateRange.to}.csv`;
      rows.push(["Sales Report", `${dateRange.from} to ${dateRange.to}`]);
      rows.push([]);
      rows.push(["Total Sales", salesReport.total_sales.toFixed(2)]);
      rows.push(["Total Invoices", String(salesReport.total_invoices)]);
      rows.push(["Paid Invoices", String(salesReport.paid_invoices)]);
      rows.push(["Pending Invoices", String(salesReport.pending_invoices)]);
      rows.push(["Total Tax", salesReport.total_tax.toFixed(2)]);
      rows.push(["Average Invoice", salesReport.average_invoice.toFixed(2)]);
      rows.push([]);
      rows.push(["Top Products"]);
      rows.push(["Product", "Qty Sold", "Revenue"]);
      salesReport.top_products.forEach((p) =>
        rows.push([p.name, String(p.quantity), p.revenue.toFixed(2)]),
      );
      rows.push([]);
      rows.push(["Sales by Month"]);
      rows.push(["Month", "Amount", "Invoice Count"]);
      salesReport.sales_by_month.forEach((m) =>
        rows.push([m.month, m.amount.toFixed(2), String(m.count)]),
      );
    } else if (activeReport === "stock" && stockReport) {
      filename = `stock-report-${new Date().toISOString().split("T")[0]}.csv`;
      rows.push(["Stock Report"]);
      rows.push([]);
      rows.push(["Total Products", String(stockReport.total_products)]);
      rows.push(["Total Inventory Value", stockReport.total_value.toFixed(2)]);
      rows.push([]);
      rows.push(["Stock Summary"]);
      rows.push(["Product", "On Hand", "Available", "Reserved", "Value"]);
      stockReport.stock_summary.forEach((s) =>
        rows.push([
          s.name,
          String(s.on_hand),
          String(s.available),
          String(s.reserved),
          s.value.toFixed(2),
        ]),
      );
      if (stockReport.low_stock_items.length > 0) {
        rows.push([]);
        rows.push(["Low Stock Alerts"]);
        rows.push(["Product", "On Hand", "Available", "Reorder Level"]);
        stockReport.low_stock_items.forEach((s) =>
          rows.push([
            s.name,
            String(s.on_hand),
            String(s.available),
            String(s.reorder),
          ]),
        );
      }
    } else if (activeReport === "payments" && paymentReport) {
      filename = `payments-report-${dateRange.from}-to-${dateRange.to}.csv`;
      rows.push(["Payments Report", `${dateRange.from} to ${dateRange.to}`]);
      rows.push([]);
      rows.push(["Total Payments", String(paymentReport.total_payments)]);
      rows.push(["Total Amount", paymentReport.total_amount.toFixed(2)]);
      rows.push(["Reconciled", paymentReport.reconciled_amount.toFixed(2)]);
      rows.push(["Pending", paymentReport.pending_amount.toFixed(2)]);
      rows.push([]);
      rows.push(["By Payment Method"]);
      rows.push(["Method", "Count", "Amount"]);
      paymentReport.by_method.forEach((m) =>
        rows.push([m.method, String(m.count), m.amount.toFixed(2)]),
      );
      rows.push([]);
      rows.push(["Recent Payments"]);
      rows.push(["Reference", "Invoice", "Amount", "Date", "Method", "Status"]);
      paymentReport.recent_payments.forEach((p) =>
        rows.push([
          p.reference,
          p.invoice,
          p.amount.toFixed(2),
          p.date,
          p.method,
          p.status,
        ]),
      );
    } else if (activeReport === "vat" && vatReport) {
      filename = `vat-report-${dateRange.from}-to-${dateRange.to}.csv`;
      rows.push(["VAT Report", `${dateRange.from} to ${dateRange.to}`]);
      rows.push([]);
      rows.push(["Sales Total", vatReport.sales_total.toFixed(2)]);
      rows.push(["Purchases Total", vatReport.purchases_total.toFixed(2)]);
      rows.push(["Profit", vatReport.profit.toFixed(2)]);
      rows.push(["Output VAT", vatReport.output_tax.toFixed(2)]);
      rows.push(["Input VAT", vatReport.input_tax.toFixed(2)]);
      rows.push(["Net VAT", vatReport.net_tax.toFixed(2)]);
      rows.push([]);
      rows.push(["Invoices Count", String(vatReport.invoices_count)]);
      rows.push(["Purchases Count", String(vatReport.purchases_count)]);
    }

    const csv = rows
      .map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(","))
      .join("\n");
    downloadBlob(csv, filename, "text/csv");
  };

  const exportPDF = () => {
    const title =
      activeReport === "sales"
        ? "Sales Report"
        : activeReport === "stock"
          ? "Stock Report"
          : activeReport === "payments"
            ? "Payments Report"
            : "VAT Report";
    const period =
      activeReport === "stock"
        ? new Date().toLocaleDateString()
        : `${dateRange.from} to ${dateRange.to}`;

    let bodyHTML = "";

    if (activeReport === "sales" && salesReport) {
      bodyHTML = `
        <div class="summary-grid">
          <div class="summary-box"><div class="label">Total Sales</div><div class="val">${formatCurrency(salesReport.total_sales)}</div></div>
          <div class="summary-box"><div class="label">Total Invoices</div><div class="val">${salesReport.total_invoices}</div></div>
          <div class="summary-box"><div class="label">Paid</div><div class="val">${salesReport.paid_invoices}</div></div>
          <div class="summary-box"><div class="label">Pending</div><div class="val">${salesReport.pending_invoices}</div></div>
          <div class="summary-box"><div class="label">Total Tax</div><div class="val">${formatCurrency(salesReport.total_tax)}</div></div>
          <div class="summary-box"><div class="label">Avg Invoice</div><div class="val">${formatCurrency(salesReport.average_invoice)}</div></div>
        </div>
        <h3>Top Selling Products</h3>
        <table><thead><tr><th>Product</th><th style="text-align:right">Qty</th><th style="text-align:right">Revenue</th></tr></thead><tbody>
          ${salesReport.top_products.map((p) => `<tr><td>${p.name}</td><td style="text-align:right">${p.quantity}</td><td style="text-align:right">${formatCurrency(p.revenue)}</td></tr>`).join("")}
        </tbody></table>
        <h3>Monthly Breakdown</h3>
        <table><thead><tr><th>Month</th><th style="text-align:right">Amount</th><th style="text-align:right">Invoices</th></tr></thead><tbody>
          ${salesReport.sales_by_month.map((m) => `<tr><td>${m.month}</td><td style="text-align:right">${formatCurrency(m.amount)}</td><td style="text-align:right">${m.count}</td></tr>`).join("")}
        </tbody></table>`;
    } else if (activeReport === "stock" && stockReport) {
      bodyHTML = `
        <div class="summary-grid">
          <div class="summary-box"><div class="label">Total Products</div><div class="val">${stockReport.total_products}</div></div>
          <div class="summary-box"><div class="label">Inventory Value</div><div class="val">${formatCurrency(stockReport.total_value)}</div></div>
          <div class="summary-box"><div class="label">Low Stock Items</div><div class="val">${stockReport.low_stock_items.length}</div></div>
        </div>
        <h3>Stock Summary</h3>
        <table><thead><tr><th>Product</th><th style="text-align:right">On Hand</th><th style="text-align:right">Available</th><th style="text-align:right">Reserved</th><th style="text-align:right">Value</th></tr></thead><tbody>
          ${stockReport.stock_summary.map((s) => `<tr><td>${s.name}</td><td style="text-align:right">${s.on_hand}</td><td style="text-align:right">${s.available}</td><td style="text-align:right">${s.reserved}</td><td style="text-align:right">${formatCurrency(s.value)}</td></tr>`).join("")}
        </tbody></table>
        ${
          stockReport.low_stock_items.length > 0
            ? `
        <h3>Low Stock Alerts</h3>
        <table><thead><tr><th>Product</th><th style="text-align:right">On Hand</th><th style="text-align:right">Available</th><th style="text-align:right">Reorder Level</th></tr></thead><tbody>
          ${stockReport.low_stock_items.map((s) => `<tr><td>${s.name}</td><td style="text-align:right">${s.on_hand}</td><td style="text-align:right">${s.available}</td><td style="text-align:right">${s.reorder}</td></tr>`).join("")}
        </tbody></table>`
            : ""
        }`;
    } else if (activeReport === "payments" && paymentReport) {
      bodyHTML = `
        <div class="summary-grid">
          <div class="summary-box"><div class="label">Total Payments</div><div class="val">${paymentReport.total_payments}</div></div>
          <div class="summary-box"><div class="label">Total Amount</div><div class="val">${formatCurrency(paymentReport.total_amount)}</div></div>
          <div class="summary-box"><div class="label">Reconciled</div><div class="val">${formatCurrency(paymentReport.reconciled_amount)}</div></div>
          <div class="summary-box"><div class="label">Pending</div><div class="val">${formatCurrency(paymentReport.pending_amount)}</div></div>
        </div>
        <h3>By Payment Method</h3>
        <table><thead><tr><th>Method</th><th style="text-align:right">Count</th><th style="text-align:right">Amount</th></tr></thead><tbody>
          ${paymentReport.by_method.map((m) => `<tr><td style="text-transform:capitalize">${m.method}</td><td style="text-align:right">${m.count}</td><td style="text-align:right">${formatCurrency(m.amount)}</td></tr>`).join("")}
        </tbody></table>
        <h3>Recent Payments</h3>
        <table><thead><tr><th>Reference</th><th>Invoice</th><th style="text-align:right">Amount</th><th>Date</th><th>Method</th><th>Status</th></tr></thead><tbody>
          ${paymentReport.recent_payments.map((p) => `<tr><td>${p.reference}</td><td>${p.invoice}</td><td style="text-align:right">${formatCurrency(p.amount)}</td><td>${p.date}</td><td style="text-transform:capitalize">${p.method}</td><td>${p.status}</td></tr>`).join("")}
        </tbody></table>`;
    } else if (activeReport === "vat" && vatReport) {
      bodyHTML = `
        <div class="summary-grid">
          <div class="summary-box"><div class="label">Sales Total</div><div class="val">${formatCurrency(vatReport.sales_total)}</div></div>
          <div class="summary-box"><div class="label">Purchases Total</div><div class="val">${formatCurrency(vatReport.purchases_total)}</div></div>
          <div class="summary-box"><div class="label">Profit</div><div class="val">${formatCurrency(vatReport.profit)}</div></div>
          <div class="summary-box"><div class="label">Output VAT</div><div class="val">${formatCurrency(vatReport.output_tax)}</div></div>
          <div class="summary-box"><div class="label">Input VAT</div><div class="val">${formatCurrency(vatReport.input_tax)}</div></div>
          <div class="summary-box"><div class="label">Net VAT</div><div class="val">${formatCurrency(vatReport.net_tax)}</div></div>
        </div>
        <h3>Document Counts</h3>
        <table><thead><tr><th>Type</th><th style="text-align:right">Count</th></tr></thead><tbody>
          <tr><td>Invoices</td><td style="text-align:right">${vatReport.invoices_count}</td></tr>
          <tr><td>Purchases</td><td style="text-align:right">${vatReport.purchases_count}</td></tr>
        </tbody></table>`;
    }

    const html = `<!DOCTYPE html><html><head><title>${title}</title><style>
      @page { size: A4; margin: 15mm; }
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1a1a2e; margin: 0; padding: 20px; font-size: 12px; }
      h2 { margin: 0 0 4px; font-size: 20px; }
      h3 { margin: 24px 0 8px; font-size: 1rem; border-bottom: 2px solid #e8ecf1; padding-bottom: 6px; }
      .period { color: #6c757d; margin-bottom: 20px; }
      .summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; margin: 16px 0; }
      .summary-box { background: #f8f9fb; border: 1px solid #e8ecf1; border-radius: 8px; padding: 12px; }
      .summary-box .label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: #6c757d; margin-bottom: 4px; }
      .summary-box .val { font-size: 18px; font-weight: 700; }
      table { width: 100%; border-collapse: collapse; margin: 8px 0 16px; }
      th { background: #f1f3f5; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; padding: 8px 10px; text-align: left; border-bottom: 2px solid #dee2e6; }
      td { padding: 7px 10px; border-bottom: 1px solid #f0f0f0; }
      tr:nth-child(even) { background: #fafbfc; }
      @media print { body { padding: 0; } }
    </style></head><body>
      <h2>${title}</h2>
      <div class="period">${period}</div>
      ${bodyHTML}
    </body></html>`;

    const win = window.open("", "_blank", "width=900,height=700");
    if (win) {
      win.document.write(html);
      win.document.close();
      setTimeout(() => win.print(), 400);
    }
  };

  const downloadBlob = (
    content: string,
    filename: string,
    mimeType: string,
  ) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  /* ── Render ────────────────────────────────────── */

  const maxBarValue = salesReport
    ? Math.max(...salesReport.sales_by_month.map((m) => m.amount), 1)
    : 1;

  return (
    <div className="reports-page">
      {/* Header */}
      <div className="reports-header">
        <div>
          <h1>Reports</h1>
          <p className="page-subtitle">Sales, stock, VAT, and payment analytics</p>
        </div>
        <div className="reports-actions">
          <button className="outline" onClick={exportCSV} disabled={loading}>
            <DownloadIcon /> Export CSV
          </button>
          <button className="outline" onClick={exportPDF} disabled={loading}>
            <DownloadIcon /> Export PDF
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="reports-toolbar">
        <div className="report-tabs">
          {(["sales", "stock", "payments", "vat"] as ReportType[]).map((tab) => (
            <button
              key={tab}
              className={`report-tab ${activeReport === tab ? "active" : ""}`}
              onClick={() => setActiveReport(tab)}
            >
              {tab === "sales" && <SalesIcon />}
              {tab === "stock" && <StockIcon />}
              {tab === "payments" && <PaymentIcon />}
              {tab === "vat" && <VatIcon />}
              {tab === "sales"
                ? "Sales Report"
                : tab === "stock"
                  ? "Stock Report"
                  : tab === "payments"
                    ? "Payments Report"
                    : "VAT Report"}
            </button>
          ))}
        </div>
        <div className="date-range">
          <label>From:</label>
          <input
            type="date"
            value={dateRange.from}
            onChange={(e) =>
              setDateRange((prev) => ({ ...prev, from: e.target.value }))
            }
          />
          <label>To:</label>
          <input
            type="date"
            value={dateRange.to}
            onChange={(e) =>
              setDateRange((prev) => ({ ...prev, to: e.target.value }))
            }
          />
          <button className="primary" onClick={loadReport} disabled={loading}>
            {loading ? "Loading..." : "Refresh"}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="alert alert-danger" style={{ margin: "16px 0" }}>
          {error}
          <button
            onClick={() => setError("")}
            style={{
              float: "right",
              background: "none",
              border: "none",
              cursor: "pointer",
              fontSize: 18,
            }}
          >
            ×
          </button>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div
          style={{
            textAlign: "center",
            padding: "60px 20px",
            color: "#6c757d",
          }}
        >
          Loading report data...
        </div>
      )}

      {/* ─── Sales Report ─── */}
      {!loading && activeReport === "sales" && salesReport && (
        <div className="report-content">
          <div className="metrics-row">
            <MetricCard
              label="Total Sales"
              value={formatCurrency(salesReport.total_sales)}
            />
            <MetricCard
              label="Total Invoices"
              value={String(salesReport.total_invoices)}
            />
            <MetricCard
              label="Paid Invoices"
              value={String(salesReport.paid_invoices)}
              variant="success"
            />
            <MetricCard
              label="Pending Invoices"
              value={String(salesReport.pending_invoices)}
              variant="warning"
            />
            <MetricCard
              label="Total Tax"
              value={formatCurrency(salesReport.total_tax)}
            />
            <MetricCard
              label="Avg Invoice"
              value={formatCurrency(salesReport.average_invoice)}
            />
          </div>

          <div className="report-grid">
            <div className="report-card">
              <h3>Top Selling Products</h3>
              {salesReport.top_products.length === 0 ? (
                <p className="empty-state">No product sales in this period.</p>
              ) : (
                <table className="report-table">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th className="text-right">Qty Sold</th>
                      <th className="text-right">Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {salesReport.top_products.map((p, i) => (
                      <tr key={i}>
                        <td>{p.name}</td>
                        <td className="text-right">{p.quantity}</td>
                        <td className="text-right">
                          {formatCurrency(p.revenue)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="report-card">
              <h3>Sales Trend</h3>
              {salesReport.sales_by_month.length === 0 ? (
                <p className="empty-state">No sales data in this period.</p>
              ) : (
                <div className="chart-container">
                  <div className="bar-chart">
                    {salesReport.sales_by_month.map((item, i) => (
                      <div
                        key={i}
                        className="bar-item"
                        title={`${item.month}: ${formatCurrency(item.amount)} (${item.count} invoices)`}
                      >
                        <div className="bar-value">
                          {formatCurrency(item.amount)}
                        </div>
                        <div
                          className="bar"
                          style={{
                            height: `${(item.amount / maxBarValue) * 100}%`,
                          }}
                        />
                        <span className="bar-label">{item.month}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── Stock Report ─── */}
      {!loading && activeReport === "stock" && stockReport && (
        <div className="report-content">
          <div className="metrics-row">
            <MetricCard
              label="Active Products"
              value={String(stockReport.total_products)}
            />
            <MetricCard
              label="Inventory Value"
              value={formatCurrency(stockReport.total_value)}
            />
            <MetricCard
              label="Low Stock Items"
              value={String(stockReport.low_stock_items.length)}
              variant={
                stockReport.low_stock_items.length > 0 ? "danger" : "success"
              }
            />
            <MetricCard
              label="Tracked Items"
              value={String(stockReport.stock_summary.length)}
            />
          </div>

          <div className="report-grid">
            {stockReport.low_stock_items.length > 0 && (
              <div className="report-card">
                <h3>⚠️ Low Stock Alerts</h3>
                <table className="report-table">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th className="text-right">On Hand</th>
                      <th className="text-right">Available</th>
                      <th className="text-right">Reorder Level</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stockReport.low_stock_items.map((item, i) => (
                      <tr key={i}>
                        <td>{item.name}</td>
                        <td className="text-right">{item.on_hand}</td>
                        <td className="text-right">{item.available}</td>
                        <td className="text-right">{item.reorder}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="report-card">
              <h3>Stock Summary</h3>
              {stockReport.stock_summary.length === 0 ? (
                <p className="empty-state">No stock data available.</p>
              ) : (
                <table className="report-table">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th className="text-right">On Hand</th>
                      <th className="text-right">Available</th>
                      <th className="text-right">Reserved</th>
                      <th className="text-right">Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stockReport.stock_summary.map((s, i) => (
                      <tr key={i}>
                        <td>{s.name}</td>
                        <td className="text-right">{s.on_hand}</td>
                        <td className="text-right">{s.available}</td>
                        <td className="text-right">{s.reserved}</td>
                        <td className="text-right">
                          {formatCurrency(s.value)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {stockReport.recent_movements.length > 0 && (
            <div className="report-card full-width">
              <h3>Recent Stock Movements</h3>
              <table className="report-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Type</th>
                    <th className="text-right">Qty</th>
                    <th>Reference</th>
                    <th>Date</th>
                    <th>State</th>
                  </tr>
                </thead>
                <tbody>
                  {stockReport.recent_movements.map((m, i) => (
                    <tr key={i}>
                      <td>{m.product}</td>
                      <td>
                        <span
                          className={`badge ${m.type === "IN" ? "badge-success" : m.type === "OUT" ? "badge-warning" : "badge-info"}`}
                        >
                          {m.type}
                        </span>
                      </td>
                      <td className="text-right">{m.quantity}</td>
                      <td>{m.reference}</td>
                      <td>{m.date}</td>
                      <td>
                        <span
                          className={`badge ${m.state === "done" ? "badge-success" : m.state === "cancelled" ? "badge-danger" : "badge-secondary"}`}
                        >
                          {m.state}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ─── Payments Report ─── */}
      {!loading && activeReport === "payments" && paymentReport && (
        <div className="report-content">
          <div className="metrics-row">
            <MetricCard
              label="Total Payments"
              value={String(paymentReport.total_payments)}
            />
            <MetricCard
              label="Total Amount"
              value={formatCurrency(paymentReport.total_amount)}
            />
            <MetricCard
              label="Reconciled"
              value={`${paymentReport.reconciled_count} (${formatCurrency(paymentReport.reconciled_amount)})`}
              variant="success"
            />
            <MetricCard
              label="Pending"
              value={`${paymentReport.pending_count} (${formatCurrency(paymentReport.pending_amount)})`}
              variant="warning"
            />
          </div>

          <div className="report-grid">
            <div className="report-card">
              <h3>Payments by Method</h3>
              {paymentReport.by_method.length === 0 ? (
                <p className="empty-state">No payments in this period.</p>
              ) : (
                <>
                  <table className="report-table">
                    <thead>
                      <tr>
                        <th>Method</th>
                        <th className="text-right">Count</th>
                        <th className="text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paymentReport.by_method.map((m, i) => (
                        <tr key={i}>
                          <td style={{ textTransform: "capitalize" }}>
                            {m.method}
                          </td>
                          <td className="text-right">{m.count}</td>
                          <td className="text-right">
                            {formatCurrency(m.amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {/* Horizontal bar chart for payment methods */}
                  <div style={{ marginTop: 16 }}>
                    {paymentReport.by_method.map((m, i) => {
                      const maxAmt = Math.max(
                        ...paymentReport.by_method.map((x) => x.amount),
                        1,
                      );
                      const pct = (m.amount / maxAmt) * 100;
                      return (
                        <div key={i} style={{ marginBottom: 8 }}>
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              fontSize: 12,
                              marginBottom: 3,
                            }}
                          >
                            <span style={{ textTransform: "capitalize" }}>
                              {m.method}
                            </span>
                            <span style={{ fontWeight: 600 }}>
                              {formatCurrency(m.amount)}
                            </span>
                          </div>
                          <div
                            style={{
                              height: 8,
                              background: "#f1f3f5",
                              borderRadius: 4,
                              overflow: "hidden",
                            }}
                          >
                            <div
                              style={{
                                width: `${pct}%`,
                                height: "100%",
                                background: "#4361ee",
                                borderRadius: 4,
                                transition: "width 0.5s",
                              }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>

            <div className="report-card">
              <h3>Recent Payments</h3>
              {paymentReport.recent_payments.length === 0 ? (
                <p className="empty-state">No payments in this period.</p>
              ) : (
                <table className="report-table">
                  <thead>
                    <tr>
                      <th>Reference</th>
                      <th>Invoice</th>
                      <th className="text-right">Amount</th>
                      <th>Date</th>
                      <th>Method</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paymentReport.recent_payments.map((p, i) => (
                      <tr key={i}>
                        <td style={{ fontFamily: "monospace", fontSize: 12 }}>
                          {p.reference}
                        </td>
                        <td style={{ fontFamily: "monospace", fontSize: 12 }}>
                          {p.invoice}
                        </td>
                        <td className="text-right">
                          {formatCurrency(p.amount)}
                        </td>
                        <td>{p.date}</td>
                        <td style={{ textTransform: "capitalize" }}>
                          {p.method}
                        </td>
                        <td>
                          <span
                            className={`badge ${p.status === "reconciled" ? "badge-success" : p.status === "posted" ? "badge-info" : p.status === "cancelled" ? "badge-danger" : "badge-secondary"}`}
                          >
                            {p.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── VAT Report ─── */}
      {!loading && activeReport === "vat" && vatReport && (
        <div className="report-content">
          <div className="metrics-row">
            <MetricCard
              label="Sales Total"
              value={formatCurrency(vatReport.sales_total)}
            />
            <MetricCard
              label="Purchases Total"
              value={formatCurrency(vatReport.purchases_total)}
            />
            <MetricCard
              label="Profit"
              value={formatCurrency(vatReport.profit)}
              variant={vatReport.profit >= 0 ? "success" : "danger"}
            />
            <MetricCard
              label="Output VAT"
              value={formatCurrency(vatReport.output_tax)}
              variant="success"
            />
            <MetricCard
              label="Input VAT"
              value={formatCurrency(vatReport.input_tax)}
            />
            <MetricCard
              label="Net VAT"
              value={formatCurrency(vatReport.net_tax)}
              variant={vatReport.net_tax >= 0 ? "warning" : "success"}
            />
          </div>

          <div className="report-grid">
            <div className="report-card">
              <h3>Document Counts</h3>
              <table className="report-table">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th className="text-right">Count</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Invoices</td>
                    <td className="text-right">{vatReport.invoices_count}</td>
                  </tr>
                  <tr>
                    <td>Purchases</td>
                    <td className="text-right">{vatReport.purchases_count}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="report-card">
              <h3>VAT Position</h3>
              <table className="report-table">
                <thead>
                  <tr>
                    <th>Metric</th>
                    <th className="text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Output VAT (Sales)</td>
                    <td className="text-right">
                      {formatCurrency(vatReport.output_tax)}
                    </td>
                  </tr>
                  <tr>
                    <td>Input VAT (Purchases)</td>
                    <td className="text-right">
                      {formatCurrency(vatReport.input_tax)}
                    </td>
                  </tr>
                  <tr>
                    <td>Net VAT</td>
                    <td className="text-right">
                      {formatCurrency(vatReport.net_tax)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Empty state when no data */}
      {!loading &&
        !error &&
        ((activeReport === "sales" && !salesReport) ||
          (activeReport === "stock" && !stockReport) ||
          (activeReport === "payments" && !paymentReport) ||
          (activeReport === "vat" && !vatReport)) && (
          <div
            style={{
              textAlign: "center",
              padding: "60px 20px",
              color: "#6c757d",
            }}
          >
            <p>
              Select a date range and click <strong>Refresh</strong> to load
              report data.
            </p>
          </div>
        )}
    </div>
  );
}

/* ── Sub-components ─────────────────────────────────── */

function MetricCard({
  label,
  value,
  variant,
}: {
  label: string;
  value: string;
  variant?: string;
}) {
  return (
    <div className={`metric-card ${variant || ""}`}>
      <div className="metric-label">{label}</div>
      <div className="metric-value">{value}</div>
    </div>
  );
}

/* ── Icons ───────────────────────────────────────────── */

function SalesIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <line x1="12" y1="1" x2="12" y2="23" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  );
}

function StockIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
      <line x1="12" y1="22.08" x2="12" y2="12" />
    </svg>
  );
}

function PaymentIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
      <line x1="1" y1="10" x2="23" y2="10" />
    </svg>
  );
}

function VatIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M12 2v20" />
      <path d="M5 6h10a4 4 0 1 1 0 8H9a4 4 0 0 0 0 8h10" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}
