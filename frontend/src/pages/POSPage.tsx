import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../api";
import { useMe } from "../hooks/useMe";

/* ────────────────────────── types ────────────────────────── */

type POSProduct = {
  id: number;
  name: string;
  barcode: string;
  reference: string;
  sale_price: number;
  vat_rate: number;
  uom: string;
  category_id: number | null;
  category_name: string;
  description: string;
};

type CartLine = {
  uid: string;
  product: POSProduct;
  qty: number;
  price: number;
  discount: number;
  vat_rate: number;
};

type Category = { id: number; name: string };
type Device = { id: number; device_id: string; serial_number: string; model: string; fiscal_day_status: string };
type Customer = { id: number; name: string; email: string; phone: string; tin: string };
type POSSession = { id: number; name: string; status: string; company_id: number; device_id: number | null; opening_balance: number; total_sales: number; total_cash: number; total_card: number; total_mobile: number; transaction_count: number };
type POSOrder = { id: number; reference: string; status: string; total_amount: number; is_fiscalized: boolean; zimra_verification_code: string; zimra_verification_url: string; fiscal_errors: string; change_amount: number; payment_method: string; order_date: string; lines: any[] };

/* ────────────────────────── helpers ────────────────────────── */
const fmt = (n: number) => n.toFixed(2);
const uid = () => Math.random().toString(36).slice(2, 10);

function lineSubtotal(l: CartLine) {
  return l.qty * l.price * (1 - l.discount / 100);
}
function lineTax(l: CartLine) {
  return lineSubtotal(l) * (l.vat_rate / 100);
}
function lineTotal(l: CartLine) {
  return lineSubtotal(l) + lineTax(l);
}

/* ────────────────────────── Component ────────────────────────── */
export default function POSPage() {
  const navigate = useNavigate();
  const { me } = useMe();
  const companyId = me?.company_ids?.[0];
  const barcodeRef = useRef<HTMLInputElement>(null);

  // ── state ──
  const [products, setProducts] = useState<POSProduct[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [session, setSession] = useState<POSSession | null>(null);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerResults, setCustomerResults] = useState<Customer[]>([]);
  const [showCustomerSearch, setShowCustomerSearch] = useState(false);

  // Session open dialog
  const [showSessionDialog, setShowSessionDialog] = useState(false);
  const [openingBalance, setOpeningBalance] = useState("0");
  const [selectedDeviceId, setSelectedDeviceId] = useState<number | null>(null);

  // Payment dialog
  const [showPayment, setShowPayment] = useState(false);
  const [payMethod, setPayMethod] = useState<"cash" | "card" | "mobile" | "split">("cash");
  const [cashTendered, setCashTendered] = useState("");
  const [cardAmount, setCardAmount] = useState("");
  const [mobileAmount, setMobileAmount] = useState("");
  const [autoFiscalize, setAutoFiscalize] = useState(true);
  const [processing, setProcessing] = useState(false);

  // Receipt / last order
  const [lastOrder, setLastOrder] = useState<POSOrder | null>(null);
  const [showReceipt, setShowReceipt] = useState(false);

  // Close session dialog
  const [showCloseDialog, setShowCloseDialog] = useState(false);
  const [closingBalance, setClosingBalance] = useState("");

  // Orders history
  const [showOrders, setShowOrders] = useState(false);
  const [orders, setOrders] = useState<POSOrder[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // ── calculated ──
  const cartSubtotal = cart.reduce((s, l) => s + lineSubtotal(l), 0);
  const cartTax = cart.reduce((s, l) => s + lineTax(l), 0);
  const cartTotal = cart.reduce((s, l) => s + lineTotal(l), 0);
  const cartDiscount = cart.reduce((s, l) => s + l.qty * l.price * (l.discount / 100), 0);
  const itemCount = cart.reduce((s, l) => s + l.qty, 0);

  // ── data loading ──
  useEffect(() => {
    if (!companyId) return;
    setLoading(true);
    Promise.all([
      apiFetch<POSProduct[]>(`/pos/products?company_id=${companyId}`),
      apiFetch<Category[]>(`/pos/categories?company_id=${companyId}`),
      apiFetch<Device[]>(`/pos/devices?company_id=${companyId}`),
      apiFetch<POSSession[]>(`/pos/sessions?company_id=${companyId}&status=open`),
    ])
      .then(([prods, cats, devs, sessions]) => {
        setProducts(prods);
        setCategories(cats);
        setDevices(devs);
        if (sessions.length > 0) {
          setSession(sessions[0]);
        } else {
          setShowSessionDialog(true);
        }
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [companyId]);

  // ── customer search debounce ──
  useEffect(() => {
    if (!customerSearch.trim() || !companyId) { setCustomerResults([]); return; }
    const t = setTimeout(() => {
      apiFetch<Customer[]>(`/pos/customers?company_id=${companyId}&search=${encodeURIComponent(customerSearch)}`)
        .then(setCustomerResults)
        .catch(() => setCustomerResults([]));
    }, 300);
    return () => clearTimeout(t);
  }, [customerSearch, companyId]);

  // ── actions ──
  const openSession = async () => {
    if (!companyId) return;
    try {
      const s = await apiFetch<POSSession>("/pos/sessions/open", {
        method: "POST",
        body: JSON.stringify({
          company_id: companyId,
          device_id: selectedDeviceId,
          opening_balance: parseFloat(openingBalance) || 0,
        }),
      });
      setSession(s);
      setShowSessionDialog(false);
    } catch (e: any) {
      setError(e.message);
    }
  };

  const addToCart = useCallback((product: POSProduct) => {
    setCart((prev) => {
      const existing = prev.find((l) => l.product.id === product.id);
      if (existing) {
        return prev.map((l) =>
          l.uid === existing.uid ? { ...l, qty: l.qty + 1 } : l
        );
      }
      return [
        ...prev,
        {
          uid: uid(),
          product,
          qty: 1,
          price: product.sale_price,
          discount: 0,
          vat_rate: product.vat_rate,
        },
      ];
    });
  }, []);

  const updateQty = (lineUid: string, qty: number) => {
    if (qty <= 0) {
      setCart((prev) => prev.filter((l) => l.uid !== lineUid));
    } else {
      setCart((prev) => prev.map((l) => (l.uid === lineUid ? { ...l, qty } : l)));
    }
  };

  const updateDiscount = (lineUid: string, discount: number) => {
    setCart((prev) => prev.map((l) => (l.uid === lineUid ? { ...l, discount: Math.min(100, Math.max(0, discount)) } : l)));
  };

  const updatePrice = (lineUid: string, price: number) => {
    setCart((prev) => prev.map((l) => (l.uid === lineUid ? { ...l, price: Math.max(0, price) } : l)));
  };

  const removeLine = (lineUid: string) => {
    setCart((prev) => prev.filter((l) => l.uid !== lineUid));
  };

  const clearCart = () => {
    setCart([]);
    setSelectedCustomer(null);
  };

  // barcode scanner
  const handleBarcode = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter") return;
    const val = (e.target as HTMLInputElement).value.trim();
    if (!val) return;
    const found = products.find(
      (p) => p.barcode === val || p.reference === val
    );
    if (found) {
      addToCart(found);
      (e.target as HTMLInputElement).value = "";
    }
  };

  // ── payment ──
  const submitPayment = async () => {
    if (!session || cart.length === 0) return;
    setProcessing(true);
    setError("");

    let cash = 0, card = 0, mobile = 0;
    if (payMethod === "cash") {
      cash = parseFloat(cashTendered) || cartTotal;
    } else if (payMethod === "card") {
      card = cartTotal;
    } else if (payMethod === "mobile") {
      mobile = cartTotal;
    } else {
      cash = parseFloat(cashTendered) || 0;
      card = parseFloat(cardAmount) || 0;
      mobile = parseFloat(mobileAmount) || 0;
    }

    try {
      const order = await apiFetch<POSOrder>("/pos/orders", {
        method: "POST",
        body: JSON.stringify({
          session_id: session.id,
          company_id: session.company_id,
          customer_id: selectedCustomer?.id || null,
          currency: "USD",
          payment_method: payMethod,
          cash_amount: cash,
          card_amount: card,
          mobile_amount: mobile,
          auto_fiscalize: autoFiscalize,
          lines: cart.map((l) => ({
            product_id: l.product.id,
            description: l.product.name,
            quantity: l.qty,
            uom: l.product.uom,
            unit_price: l.price,
            discount: l.discount,
            vat_rate: l.vat_rate,
          })),
        }),
      });

      setLastOrder(order);
      setShowPayment(false);
      setShowReceipt(true);
      setCart([]);
      setSelectedCustomer(null);
      setCashTendered("");
      setCardAmount("");
      setMobileAmount("");

      // Refresh session
      const updated = await apiFetch<any>(`/pos/sessions/${session.id}`);
      setSession(updated.session);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setProcessing(false);
    }
  };

  const closeSession = async () => {
    if (!session) return;
    try {
      await apiFetch(`/pos/sessions/${session.id}/close`, {
        method: "POST",
        body: JSON.stringify({
          closing_balance: parseFloat(closingBalance) || 0,
        }),
      });
      setSession(null);
      setShowCloseDialog(false);
      navigate("/");
    } catch (e: any) {
      setError(e.message);
    }
  };

  const loadOrders = async () => {
    if (!session) return;
    try {
      const data = await apiFetch<POSOrder[]>(`/pos/orders?company_id=${session.company_id}&session_id=${session.id}`);
      setOrders(data);
      setShowOrders(true);
    } catch (e: any) {
      setError(e.message);
    }
  };

  const fiscalizeOrder = async (orderId: number) => {
    try {
      const updated = await apiFetch<POSOrder>(`/pos/orders/${orderId}/fiscalize`, { method: "POST" });
      setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
      if (lastOrder?.id === orderId) setLastOrder(updated);
    } catch (e: any) {
      setError(e.message);
    }
  };

  // ── filter products ──
  const filteredProducts = products.filter((p) => {
    if (selectedCategory && p.category_id !== selectedCategory) return false;
    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      return p.name.toLowerCase().includes(s) || p.barcode?.toLowerCase().includes(s) || p.reference?.toLowerCase().includes(s);
    }
    return true;
  });

  // ── quick cash buttons ──
  const quickCash = [1, 2, 5, 10, 20, 50, 100];

  /* ──────────── loading / no company ──────────── */
  if (!companyId) {
    return <div className="pos-page"><div className="pos-center-msg">No company assigned. Please contact your administrator.</div></div>;
  }

  if (loading) {
    return <div className="pos-page"><div className="pos-center-msg"><div className="pos-spinner" />Loading POS…</div></div>;
  }

  /* ──────────── session open dialog ──────────── */
  if (showSessionDialog && !session) {
    return (
      <div className="pos-page">
        <div className="pos-overlay">
          <div className="pos-dialog pos-dialog-session">
            <div className="pos-dialog-header">
              <h2>Open POS Session</h2>
            </div>
            <div className="pos-dialog-body">
              <label className="pos-label">
                Fiscal Device
                <select
                  className="pos-select"
                  value={selectedDeviceId ?? ""}
                  onChange={(e) => setSelectedDeviceId(e.target.value ? Number(e.target.value) : null)}
                >
                  <option value="">— No device (offline) —</option>
                  {devices.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.model} — {d.serial_number} ({d.fiscal_day_status})
                    </option>
                  ))}
                </select>
              </label>
              <label className="pos-label">
                Opening Cash Balance
                <input
                  type="number"
                  className="pos-input"
                  value={openingBalance}
                  onChange={(e) => setOpeningBalance(e.target.value)}
                  min={0}
                  step={0.01}
                />
              </label>
              {error && <div className="pos-error">{error}</div>}
            </div>
            <div className="pos-dialog-footer">
              <button className="pos-btn pos-btn-ghost" onClick={() => navigate("/")}>Cancel</button>
              <button className="pos-btn pos-btn-primary" onClick={openSession}>Open Session</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ──────────── main POS layout ──────────── */
  return (
    <div className="pos-page">
      {/* ─── TOP BAR ─── */}
      <header className="pos-topbar">
        <div className="pos-topbar-left">
          <button className="pos-btn pos-btn-icon" onClick={() => navigate("/")} title="Back to Home">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/></svg>
          </button>
          <div className="pos-session-badge">
            <span className="pos-session-dot" />
            {session?.name}
          </div>
        </div>
        <div className="pos-topbar-center">
          <div className="pos-barcode-wrapper">
            <svg className="pos-barcode-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M7 7h.01M7 12h.01M12 7h.01M17 7h.01M12 12h.01M17 12h.01M7 17h.01M12 17h.01M17 17h.01"/></svg>
            <input
              ref={barcodeRef}
              className="pos-barcode-input"
              placeholder="Scan barcode or search…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={handleBarcode}
            />
            {searchTerm && (
              <button className="pos-barcode-clear" onClick={() => { setSearchTerm(""); barcodeRef.current?.focus(); }}>✕</button>
            )}
          </div>
        </div>
        <div className="pos-topbar-right">
          <button className="pos-btn pos-btn-sm pos-btn-outline" onClick={loadOrders}>Orders</button>
          <button className="pos-btn pos-btn-sm pos-btn-outline" onClick={() => setShowCustomerSearch(!showCustomerSearch)}>
            {selectedCustomer ? selectedCustomer.name : "Customer"}
          </button>
          <button className="pos-btn pos-btn-sm pos-btn-danger" onClick={() => setShowCloseDialog(true)}>Close</button>
        </div>
      </header>

      {/* ─── MAIN BODY: left = products, right = cart ─── */}
      <div className="pos-body">
        {/* ── PRODUCT PANEL ── */}
        <div className="pos-products-panel">
          {/* Category chips */}
          <div className="pos-categories">
            <button
              className={`pos-cat-chip ${selectedCategory === null ? "active" : ""}`}
              onClick={() => setSelectedCategory(null)}
            >
              All
            </button>
            {categories.map((c) => (
              <button
                key={c.id}
                className={`pos-cat-chip ${selectedCategory === c.id ? "active" : ""}`}
                onClick={() => setSelectedCategory(c.id)}
              >
                {c.name}
              </button>
            ))}
          </div>

          {/* Product grid */}
          <div className="pos-product-grid">
            {filteredProducts.length === 0 && (
              <div className="pos-no-products">No products found</div>
            )}
            {filteredProducts.map((p) => (
              <button key={p.id} className="pos-product-card" onClick={() => addToCart(p)}>
                <div className="pos-product-card-name">{p.name}</div>
                <div className="pos-product-card-price">${fmt(p.sale_price)}</div>
                {p.barcode && <div className="pos-product-card-barcode">{p.barcode}</div>}
              </button>
            ))}
          </div>
        </div>

        {/* ── CART PANEL ── */}
        <div className="pos-cart-panel">
          {/* Customer banner */}
          {showCustomerSearch && (
            <div className="pos-customer-search">
              <input
                className="pos-input"
                placeholder="Search customer by name, email, phone…"
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
                autoFocus
              />
              {customerResults.length > 0 && (
                <div className="pos-customer-results">
                  {customerResults.map((c) => (
                    <button
                      key={c.id}
                      className="pos-customer-item"
                      onClick={() => {
                        setSelectedCustomer(c);
                        setShowCustomerSearch(false);
                        setCustomerSearch("");
                        setCustomerResults([]);
                      }}
                    >
                      <strong>{c.name}</strong>
                      <span>{c.email || c.phone}</span>
                    </button>
                  ))}
                </div>
              )}
              <div className="pos-customer-actions">
                {selectedCustomer && (
                  <button className="pos-btn pos-btn-ghost pos-btn-xs" onClick={() => { setSelectedCustomer(null); setShowCustomerSearch(false); }}>
                    Remove Customer
                  </button>
                )}
                <button className="pos-btn pos-btn-ghost pos-btn-xs" onClick={() => setShowCustomerSearch(false)}>Close</button>
              </div>
            </div>
          )}

          {selectedCustomer && !showCustomerSearch && (
            <div className="pos-customer-banner">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              <span>{selectedCustomer.name}</span>
              <button className="pos-btn-inline" onClick={() => setSelectedCustomer(null)}>✕</button>
            </div>
          )}

          {/* Cart lines */}
          <div className="pos-cart-lines">
            {cart.length === 0 && (
              <div className="pos-cart-empty">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--gray-300)" strokeWidth="1.5"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6"/></svg>
                <p>Cart is empty</p>
                <p className="pos-cart-empty-hint">Tap products or scan barcode to add items</p>
              </div>
            )}
            {cart.map((line) => (
              <div key={line.uid} className="pos-cart-line">
                <div className="pos-cart-line-info">
                  <div className="pos-cart-line-name">{line.product.name}</div>
                  <div className="pos-cart-line-meta">
                    ${fmt(line.price)} × {line.qty}
                    {line.discount > 0 && <span className="pos-discount-tag">-{line.discount}%</span>}
                    {line.vat_rate > 0 && <span className="pos-vat-tag">VAT {line.vat_rate}%</span>}
                  </div>
                </div>
                <div className="pos-cart-line-controls">
                  <button className="pos-qty-btn" onClick={() => updateQty(line.uid, line.qty - 1)}>−</button>
                  <input
                    type="number"
                    className="pos-qty-input"
                    value={line.qty}
                    onChange={(e) => updateQty(line.uid, parseInt(e.target.value) || 0)}
                    min={0}
                  />
                  <button className="pos-qty-btn" onClick={() => updateQty(line.uid, line.qty + 1)}>+</button>
                </div>
                <div className="pos-cart-line-total">${fmt(lineTotal(line))}</div>
                <button className="pos-cart-line-remove" onClick={() => removeLine(line.uid)} title="Remove">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>
            ))}
          </div>

          {/* Cart totals */}
          <div className="pos-cart-totals">
            <div className="pos-totals-row"><span>Items</span><span>{itemCount}</span></div>
            <div className="pos-totals-row"><span>Subtotal</span><span>${fmt(cartSubtotal)}</span></div>
            {cartDiscount > 0 && <div className="pos-totals-row pos-discount-row"><span>Discount</span><span>-${fmt(cartDiscount)}</span></div>}
            <div className="pos-totals-row"><span>Tax</span><span>${fmt(cartTax)}</span></div>
            <div className="pos-totals-row pos-total-row"><span>TOTAL</span><span>${fmt(cartTotal)}</span></div>
          </div>

          {/* Cart buttons */}
          <div className="pos-cart-actions">
            <button
              className="pos-btn pos-btn-ghost pos-btn-full"
              onClick={clearCart}
              disabled={cart.length === 0}
            >
              Clear
            </button>
            <button
              className="pos-btn pos-btn-success pos-btn-full pos-btn-pay"
              onClick={() => {
                setCashTendered(cartTotal.toFixed(2));
                setShowPayment(true);
              }}
              disabled={cart.length === 0}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
              Pay ${fmt(cartTotal)}
            </button>
          </div>
        </div>
      </div>

      {/* ─── PAYMENT DIALOG ─── */}
      {showPayment && (
        <div className="pos-overlay" onClick={() => !processing && setShowPayment(false)}>
          <div className="pos-dialog pos-dialog-payment" onClick={(e) => e.stopPropagation()}>
            <div className="pos-dialog-header">
              <h2>Payment</h2>
              <div className="pos-payment-total">${fmt(cartTotal)}</div>
            </div>
            <div className="pos-dialog-body">
              {/* Method tabs */}
              <div className="pos-pay-methods">
                {(["cash", "card", "mobile", "split"] as const).map((m) => (
                  <button
                    key={m}
                    className={`pos-pay-method-btn ${payMethod === m ? "active" : ""}`}
                    onClick={() => setPayMethod(m)}
                  >
                    {m === "cash" && <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="3"/></svg>}
                    {m === "card" && <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>}
                    {m === "mobile" && <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>}
                    {m === "split" && <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="2" x2="12" y2="22"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>}
                    <span>{m.charAt(0).toUpperCase() + m.slice(1)}</span>
                  </button>
                ))}
              </div>

              {/* Cash */}
              {(payMethod === "cash" || payMethod === "split") && (
                <div className="pos-pay-section">
                  <label className="pos-label">Cash Tendered</label>
                  <input
                    type="number"
                    className="pos-input pos-input-lg"
                    value={cashTendered}
                    onChange={(e) => setCashTendered(e.target.value)}
                    min={0}
                    step={0.01}
                    autoFocus={payMethod === "cash"}
                  />
                  {payMethod === "cash" && (
                    <div className="pos-quick-cash">
                      {quickCash.map((v) => (
                        <button
                          key={v}
                          className="pos-quick-cash-btn"
                          onClick={() => setCashTendered(String(v))}
                        >
                          ${v}
                        </button>
                      ))}
                      <button
                        className="pos-quick-cash-btn pos-quick-exact"
                        onClick={() => setCashTendered(cartTotal.toFixed(2))}
                      >
                        Exact
                      </button>
                    </div>
                  )}
                  {payMethod === "cash" && (
                    <div className="pos-change">
                      Change: <strong>${fmt(Math.max(0, (parseFloat(cashTendered) || 0) - cartTotal))}</strong>
                    </div>
                  )}
                </div>
              )}

              {/* Card */}
              {(payMethod === "card" || payMethod === "split") && (
                <div className="pos-pay-section">
                  <label className="pos-label">Card Amount</label>
                  <input
                    type="number"
                    className="pos-input pos-input-lg"
                    value={payMethod === "card" ? cartTotal.toFixed(2) : cardAmount}
                    onChange={(e) => setCardAmount(e.target.value)}
                    disabled={payMethod === "card"}
                    min={0}
                    step={0.01}
                  />
                </div>
              )}

              {/* Mobile */}
              {(payMethod === "mobile" || payMethod === "split") && (
                <div className="pos-pay-section">
                  <label className="pos-label">Mobile Money</label>
                  <input
                    type="number"
                    className="pos-input pos-input-lg"
                    value={payMethod === "mobile" ? cartTotal.toFixed(2) : mobileAmount}
                    onChange={(e) => setMobileAmount(e.target.value)}
                    disabled={payMethod === "mobile"}
                    min={0}
                    step={0.01}
                  />
                </div>
              )}

              {payMethod === "split" && (
                <div className="pos-split-summary">
                  Split total: ${fmt((parseFloat(cashTendered) || 0) + (parseFloat(cardAmount) || 0) + (parseFloat(mobileAmount) || 0))}
                  {((parseFloat(cashTendered) || 0) + (parseFloat(cardAmount) || 0) + (parseFloat(mobileAmount) || 0)) < cartTotal && (
                    <span className="pos-split-warning"> (Insufficient)</span>
                  )}
                </div>
              )}

              {/* Fiscalize toggle */}
              <div className="pos-fiscalize-toggle">
                <label className="pos-toggle-label">
                  <input
                    type="checkbox"
                    checked={autoFiscalize}
                    onChange={(e) => setAutoFiscalize(e.target.checked)}
                  />
                  <span className="pos-toggle-text">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                    Auto-Fiscalize (ZIMRA)
                  </span>
                </label>
              </div>

              {error && <div className="pos-error">{error}</div>}
            </div>
            <div className="pos-dialog-footer">
              <button className="pos-btn pos-btn-ghost" onClick={() => setShowPayment(false)} disabled={processing}>Cancel</button>
              <button
                className="pos-btn pos-btn-success pos-btn-lg"
                onClick={submitPayment}
                disabled={processing || cart.length === 0}
              >
                {processing ? "Processing…" : `Validate $${fmt(cartTotal)}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── RECEIPT DIALOG ─── */}
      {showReceipt && lastOrder && (
        <div className="pos-overlay" onClick={() => setShowReceipt(false)}>
          <div className="pos-dialog pos-dialog-receipt" onClick={(e) => e.stopPropagation()}>
            <div className="pos-receipt">
              <div className="pos-receipt-header">
                <h3>Order Confirmed</h3>
                <div className="pos-receipt-ref">{lastOrder.reference}</div>
                <div className="pos-receipt-date">{new Date(lastOrder.order_date).toLocaleString()}</div>
              </div>

              <div className="pos-receipt-status">
                {lastOrder.is_fiscalized ? (
                  <div className="pos-badge pos-badge-success">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><path d="M9 11l3 3L22 4"/></svg>
                    Fiscalized
                  </div>
                ) : lastOrder.fiscal_errors ? (
                  <div className="pos-badge pos-badge-error">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                    Fiscal Error
                  </div>
                ) : (
                  <div className="pos-badge pos-badge-warn">Not Fiscalized</div>
                )}
              </div>

              {lastOrder.is_fiscalized && lastOrder.zimra_verification_code && (
                <div className="pos-receipt-fiscal">
                  <div className="pos-receipt-fiscal-label">Verification Code</div>
                  <div className="pos-receipt-fiscal-code">{lastOrder.zimra_verification_code}</div>
                  {lastOrder.zimra_verification_url && (
                    <a className="pos-receipt-fiscal-link" href={lastOrder.zimra_verification_url} target="_blank" rel="noopener noreferrer">
                      Verify Receipt ↗
                    </a>
                  )}
                </div>
              )}

              {lastOrder.fiscal_errors && (
                <div className="pos-receipt-errors">
                  <strong>Error:</strong> {lastOrder.fiscal_errors}
                  <button className="pos-btn pos-btn-sm pos-btn-outline" style={{ marginTop: 8 }} onClick={() => fiscalizeOrder(lastOrder.id)}>
                    Retry Fiscalization
                  </button>
                </div>
              )}

              <div className="pos-receipt-total">
                <span>Total</span>
                <span>${fmt(lastOrder.total_amount)}</span>
              </div>
              {lastOrder.change_amount > 0 && (
                <div className="pos-receipt-change">
                  <span>Change</span>
                  <span>${fmt(lastOrder.change_amount)}</span>
                </div>
              )}
              <div className="pos-receipt-method">
                Paid by: {lastOrder.payment_method}
              </div>
            </div>
            <div className="pos-dialog-footer">
              <button className="pos-btn pos-btn-outline" onClick={() => { window.print(); }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                Print
              </button>
              <button className="pos-btn pos-btn-primary" onClick={() => { setShowReceipt(false); barcodeRef.current?.focus(); }}>
                New Order
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── CLOSE SESSION DIALOG ─── */}
      {showCloseDialog && (
        <div className="pos-overlay" onClick={() => setShowCloseDialog(false)}>
          <div className="pos-dialog pos-dialog-close" onClick={(e) => e.stopPropagation()}>
            <div className="pos-dialog-header"><h2>Close Session</h2></div>
            <div className="pos-dialog-body">
              <div className="pos-close-summary">
                <div className="pos-close-row"><span>Opening Balance</span><span>${fmt(session?.opening_balance || 0)}</span></div>
                <div className="pos-close-row"><span>Total Sales</span><span>${fmt(session?.total_sales || 0)}</span></div>
                <div className="pos-close-row"><span>Cash Sales</span><span>${fmt(session?.total_cash || 0)}</span></div>
                <div className="pos-close-row"><span>Card Sales</span><span>${fmt(session?.total_card || 0)}</span></div>
                <div className="pos-close-row"><span>Mobile Sales</span><span>${fmt(session?.total_mobile || 0)}</span></div>
                <div className="pos-close-row"><span>Transactions</span><span>{session?.transaction_count || 0}</span></div>
                <div className="pos-close-row pos-close-expected">
                  <span>Expected Cash</span>
                  <span>${fmt((session?.opening_balance || 0) + (session?.total_cash || 0))}</span>
                </div>
              </div>
              <label className="pos-label">
                Closing Cash Balance
                <input
                  type="number"
                  className="pos-input pos-input-lg"
                  value={closingBalance}
                  onChange={(e) => setClosingBalance(e.target.value)}
                  placeholder="Count your cash…"
                  min={0}
                  step={0.01}
                  autoFocus
                />
              </label>
              {closingBalance && (
                <div className={`pos-close-diff ${Math.abs(parseFloat(closingBalance) - ((session?.opening_balance || 0) + (session?.total_cash || 0))) > 0.01 ? "pos-diff-warn" : "pos-diff-ok"}`}>
                  Difference: ${fmt(parseFloat(closingBalance) - ((session?.opening_balance || 0) + (session?.total_cash || 0)))}
                </div>
              )}
              {error && <div className="pos-error">{error}</div>}
            </div>
            <div className="pos-dialog-footer">
              <button className="pos-btn pos-btn-ghost" onClick={() => setShowCloseDialog(false)}>Cancel</button>
              <button className="pos-btn pos-btn-danger" onClick={closeSession}>Close & End Session</button>
            </div>
          </div>
        </div>
      )}

      {/* ─── ORDERS LIST DIALOG ─── */}
      {showOrders && (
        <div className="pos-overlay" onClick={() => setShowOrders(false)}>
          <div className="pos-dialog pos-dialog-orders" onClick={(e) => e.stopPropagation()}>
            <div className="pos-dialog-header">
              <h2>Session Orders</h2>
              <button className="pos-btn pos-btn-icon" onClick={() => setShowOrders(false)}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div className="pos-dialog-body pos-orders-list">
              {orders.length === 0 && <div className="pos-center-msg">No orders yet</div>}
              {orders.map((o) => (
                <div key={o.id} className="pos-order-row">
                  <div className="pos-order-row-info">
                    <div className="pos-order-row-ref">{o.reference}</div>
                    <div className="pos-order-row-date">{new Date(o.order_date).toLocaleTimeString()}</div>
                  </div>
                  <div className="pos-order-row-amount">${fmt(o.total_amount)}</div>
                  <div className="pos-order-row-status">
                    {o.is_fiscalized ? (
                      <span className="pos-badge pos-badge-success pos-badge-sm">Fiscalized</span>
                    ) : o.fiscal_errors ? (
                      <>
                        <span className="pos-badge pos-badge-error pos-badge-sm">Error</span>
                        <button className="pos-btn pos-btn-xs pos-btn-outline" onClick={() => fiscalizeOrder(o.id)}>Retry</button>
                      </>
                    ) : (
                      <>
                        <span className="pos-badge pos-badge-warn pos-badge-sm">Not Fiscal</span>
                        <button className="pos-btn pos-btn-xs pos-btn-outline" onClick={() => fiscalizeOrder(o.id)}>Fiscalize</button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Global error toast */}
      {error && !showPayment && !showSessionDialog && !showCloseDialog && (
        <div className="pos-toast pos-toast-error" onClick={() => setError("")}>
          {error}
          <button className="pos-toast-close">✕</button>
        </div>
      )}
    </div>
  );
}
