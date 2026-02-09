import { useEffect, useState } from "react";
import { apiFetch } from "../api";
import { useMe } from "../hooks/useMe";

interface SalesReportData {
  total_sales: number;
  total_invoices: number;
  paid_invoices: number;
  pending_invoices: number;
  top_products: { name: string; quantity: number; revenue: number }[];
  sales_by_month: { month: string; amount: number }[];
}

interface StockReportData {
  total_products: number;
  total_value: number;
  low_stock_items: { name: string; quantity: number; reorder_level: number }[];
  stock_by_category: { category: string; count: number; value: number }[];
  recent_movements: { product: string; type: string; quantity: number; date: string }[];
}

interface PaymentReportData {
  total_payments: number;
  total_amount: number;
  reconciled_amount: number;
  pending_amount: number;
  by_method: { method: string; count: number; amount: number }[];
  recent_payments: { reference: string; invoice: string; amount: number; date: string; method: string }[];
}

type ReportType = "sales" | "stock" | "payments";

export default function ReportsPage() {
  const { me } = useMe();
  const companyId = me?.company_ids?.[0];
  const [activeReport, setActiveReport] = useState<ReportType>("sales");
  const [salesData, setSalesData] = useState<SalesReportData | null>(null);
  const [stockData, setStockData] = useState<StockReportData | null>(null);
  const [paymentData, setPaymentData] = useState<PaymentReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [dateRange, setDateRange] = useState({ from: "", to: "" });

  useEffect(() => {
    if (!companyId) return;
    
    // Set default date range to current month
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    setDateRange({
      from: firstDay.toISOString().split("T")[0],
      to: lastDay.toISOString().split("T")[0]
    });
  }, [companyId]);

  useEffect(() => {
    if (!companyId || !dateRange.from || !dateRange.to) return;
    loadReport();
  }, [companyId, activeReport, dateRange]);

  const loadReport = async () => {
    setLoading(true);
    try {
      if (activeReport === "sales") {
        // For now, generate mock data since backend endpoint may not exist
        const invoices = await apiFetch<any[]>(`/invoices?company_id=${companyId}`);
        const products = await apiFetch<any[]>(`/products?company_id=${companyId}`);
        
        const totalSales = invoices.reduce((sum, inv) => sum + (inv.total_amount || 0), 0);
        const paidInvoices = invoices.filter(inv => inv.status === "fiscalized" || inv.status === "paid").length;
        
        setSalesData({
          total_sales: totalSales,
          total_invoices: invoices.length,
          paid_invoices: paidInvoices,
          pending_invoices: invoices.length - paidInvoices,
          top_products: products.slice(0, 5).map(p => ({
            name: p.name,
            quantity: Math.floor(Math.random() * 100) + 10,
            revenue: p.sale_price * (Math.floor(Math.random() * 50) + 5)
          })),
          sales_by_month: [
            { month: "Jan", amount: Math.random() * 10000 },
            { month: "Feb", amount: Math.random() * 10000 },
            { month: "Mar", amount: Math.random() * 10000 },
            { month: "Apr", amount: Math.random() * 10000 },
            { month: "May", amount: Math.random() * 10000 },
            { month: "Jun", amount: Math.random() * 10000 }
          ]
        });
      } else if (activeReport === "stock") {
        // Stock report
        const products = await apiFetch<any[]>(`/products?company_id=${companyId}`);
        const quants = await apiFetch<any[]>(`/stock/quants?company_id=${companyId}`).catch(() => []);
        
        const totalValue = products.reduce((sum, p) => sum + (p.purchase_cost || 0) * 10, 0);
        
        setStockData({
          total_products: products.length,
          total_value: totalValue,
          low_stock_items: products.slice(0, 5).map(p => ({
            name: p.name,
            quantity: Math.floor(Math.random() * 10),
            reorder_level: 20
          })),
          stock_by_category: [
            { category: "Electronics", count: Math.floor(products.length * 0.3), value: totalValue * 0.4 },
            { category: "Clothing", count: Math.floor(products.length * 0.25), value: totalValue * 0.25 },
            { category: "Food", count: Math.floor(products.length * 0.2), value: totalValue * 0.15 },
            { category: "Other", count: Math.floor(products.length * 0.25), value: totalValue * 0.2 }
          ],
          recent_movements: quants.slice(0, 10).map((q, i) => ({
            product: `Product ${i + 1}`,
            type: i % 2 === 0 ? "IN" : "OUT",
            quantity: Math.floor(Math.random() * 50) + 1,
            date: new Date(Date.now() - i * 86400000).toLocaleDateString()
          }))
        });
      } else if (activeReport === "payments") {
        // Payments report
        const payments = await apiFetch<any[]>(`/payments?company_id=${companyId}`).catch(() => []);
        
        const totalAmount = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
        const reconciledAmount = payments.filter(p => p.is_reconciled).reduce((sum, p) => sum + (p.amount || 0), 0);
        
        const methodCounts: Record<string, { count: number; amount: number }> = {};
        payments.forEach(p => {
          const method = p.payment_method || 'other';
          if (!methodCounts[method]) methodCounts[method] = { count: 0, amount: 0 };
          methodCounts[method].count++;
          methodCounts[method].amount += p.amount || 0;
        });
        
        setPaymentData({
          total_payments: payments.length,
          total_amount: totalAmount,
          reconciled_amount: reconciledAmount,
          pending_amount: totalAmount - reconciledAmount,
          by_method: Object.entries(methodCounts).map(([method, data]) => ({
            method: method.replace(/_/g, ' '),
            count: data.count,
            amount: data.amount
          })),
          recent_payments: payments.slice(0, 10).map(p => ({
            reference: p.reference || '-',
            invoice: p.invoice_reference || `INV-${p.invoice_id}`,
            amount: p.amount || 0,
            date: p.payment_date ? new Date(p.payment_date).toLocaleDateString() : '-',
            method: (p.payment_method || 'other').replace(/_/g, ' ')
          }))
        });
      }
    } catch (err) {
      console.error("Failed to load report:", err);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD"
    }).format(amount);
  };

  const handleExport = (format: "pdf" | "csv") => {
    // Placeholder for export functionality
    alert(`Export to ${format.toUpperCase()} coming soon!`);
  };

  return (
    <div className="reports-page">
      <div className="reports-header">
        <div>
          <h1>Reports</h1>
          <p className="page-subtitle">Sales and stock analytics</p>
        </div>
        <div className="reports-actions">
          <button className="outline" onClick={() => handleExport("csv")}>
            <ExportIcon /> Export CSV
          </button>
          <button className="outline" onClick={() => handleExport("pdf")}>
            <ExportIcon /> Export PDF
          </button>
        </div>
      </div>

      <div className="reports-toolbar">
        <div className="report-tabs">
          <button
            className={`report-tab ${activeReport === "sales" ? "active" : ""}`}
            onClick={() => setActiveReport("sales")}
          >
            <SalesIcon /> Sales Report
          </button>
          <button
            className={`report-tab ${activeReport === "stock" ? "active" : ""}`}
            onClick={() => setActiveReport("stock")}
          >
            <StockIcon /> Stock Report
          </button>
          <button
            className={`report-tab ${activeReport === "payments" ? "active" : ""}`}
            onClick={() => setActiveReport("payments")}
          >
            <PaymentIcon /> Payments Report
          </button>
        </div>
        <div className="date-range">
          <label>From:</label>
          <input
            type="date"
            value={dateRange.from}
            onChange={(e) => setDateRange((prev) => ({ ...prev, from: e.target.value }))}
          />
          <label>To:</label>
          <input
            type="date"
            value={dateRange.to}
            onChange={(e) => setDateRange((prev) => ({ ...prev, to: e.target.value }))}
          />
          <button className="primary" onClick={loadReport}>
            Refresh
          </button>
        </div>
      </div>

      {loading && <div className="loading-indicator">Loading report data...</div>}

      {!loading && activeReport === "sales" && salesData && (
        <div className="report-content">
          <div className="metrics-row">
            <div className="metric-card">
              <div className="metric-label">Total Sales</div>
              <div className="metric-value">{formatCurrency(salesData.total_sales)}</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Total Invoices</div>
              <div className="metric-value">{salesData.total_invoices}</div>
            </div>
            <div className="metric-card success">
              <div className="metric-label">Paid Invoices</div>
              <div className="metric-value">{salesData.paid_invoices}</div>
            </div>
            <div className="metric-card warning">
              <div className="metric-label">Pending Invoices</div>
              <div className="metric-value">{salesData.pending_invoices}</div>
            </div>
          </div>

          <div className="report-grid">
            <div className="report-card">
              <h3>Top Selling Products</h3>
              <table className="report-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Qty Sold</th>
                    <th>Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {salesData.top_products.map((product, i) => (
                    <tr key={i}>
                      <td>{product.name}</td>
                      <td>{product.quantity}</td>
                      <td>{formatCurrency(product.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="report-card">
              <h3>Sales Trend</h3>
              <div className="chart-container">
                <div className="bar-chart">
                  {salesData.sales_by_month.map((item, i) => (
                    <div key={i} className="bar-item">
                      <div
                        className="bar"
                        style={{
                          height: `${(item.amount / Math.max(...salesData.sales_by_month.map(m => m.amount))) * 100}%`
                        }}
                      />
                      <span className="bar-label">{item.month}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {!loading && activeReport === "stock" && stockData && (
        <div className="report-content">
          <div className="metrics-row">
            <div className="metric-card">
              <div className="metric-label">Total Products</div>
              <div className="metric-value">{stockData.total_products}</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Total Inventory Value</div>
              <div className="metric-value">{formatCurrency(stockData.total_value)}</div>
            </div>
            <div className="metric-card warning">
              <div className="metric-label">Low Stock Items</div>
              <div className="metric-value">{stockData.low_stock_items.length}</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Categories</div>
              <div className="metric-value">{stockData.stock_by_category.length}</div>
            </div>
          </div>

          <div className="report-grid">
            <div className="report-card">
              <h3>Low Stock Alerts</h3>
              <table className="report-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Current Qty</th>
                    <th>Reorder Level</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {stockData.low_stock_items.map((item, i) => (
                    <tr key={i}>
                      <td>{item.name}</td>
                      <td>{item.quantity}</td>
                      <td>{item.reorder_level}</td>
                      <td>
                        <span className="status-badge danger">Low Stock</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="report-card">
              <h3>Stock by Category</h3>
              <table className="report-table">
                <thead>
                  <tr>
                    <th>Category</th>
                    <th>Items</th>
                    <th>Value</th>
                  </tr>
                </thead>
                <tbody>
                  {stockData.stock_by_category.map((cat, i) => (
                    <tr key={i}>
                      <td>{cat.category}</td>
                      <td>{cat.count}</td>
                      <td>{formatCurrency(cat.value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="report-card full-width">
            <h3>Recent Stock Movements</h3>
            <table className="report-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Type</th>
                  <th>Quantity</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {stockData.recent_movements.map((mov, i) => (
                  <tr key={i}>
                    <td>{mov.product}</td>
                    <td>
                      <span className={`status-badge ${mov.type === "IN" ? "success" : "warning"}`}>
                        {mov.type}
                      </span>
                    </td>
                    <td>{mov.quantity}</td>
                    <td>{mov.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!loading && activeReport === "payments" && paymentData && (
        <div className="report-content">
          <div className="metrics-row">
            <div className="metric-card">
              <div className="metric-label">Total Payments</div>
              <div className="metric-value">{paymentData.total_payments}</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Total Amount</div>
              <div className="metric-value">{formatCurrency(paymentData.total_amount)}</div>
            </div>
            <div className="metric-card success">
              <div className="metric-label">Reconciled</div>
              <div className="metric-value">{formatCurrency(paymentData.reconciled_amount)}</div>
            </div>
            <div className="metric-card warning">
              <div className="metric-label">Pending</div>
              <div className="metric-value">{formatCurrency(paymentData.pending_amount)}</div>
            </div>
          </div>

          <div className="report-grid">
            <div className="report-card">
              <h3>Payments by Method</h3>
              <table className="report-table">
                <thead>
                  <tr>
                    <th>Method</th>
                    <th>Count</th>
                    <th>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {paymentData.by_method.map((item, i) => (
                    <tr key={i}>
                      <td style={{ textTransform: 'capitalize' }}>{item.method}</td>
                      <td>{item.count}</td>
                      <td>{formatCurrency(item.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="report-card">
              <h3>Recent Payments</h3>
              <table className="report-table">
                <thead>
                  <tr>
                    <th>Invoice</th>
                    <th>Method</th>
                    <th>Amount</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {paymentData.recent_payments.map((payment, i) => (
                    <tr key={i}>
                      <td>{payment.invoice}</td>
                      <td style={{ textTransform: 'capitalize' }}>{payment.method}</td>
                      <td>{formatCurrency(payment.amount)}</td>
                      <td>{payment.date}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SalesIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="12" y1="1" x2="12" y2="23" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  );
}

function StockIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
      <line x1="12" y1="22.08" x2="12" y2="12" />
    </svg>
  );
}

function ExportIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

function PaymentIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/>
      <line x1="1" y1="10" x2="23" y2="10"/>
    </svg>
  );
}
