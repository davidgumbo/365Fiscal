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
  image_url: string;
  stock_on_hand: number;
  track_inventory: boolean;
  product_type: string;
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
type OrderLine = { id: number; description: string; quantity: number; uom: string; unit_price: number; discount: number; vat_rate: number; subtotal: number; tax_amount: number; total_price: number };
type POSOrder = { id: number; reference: string; status: string; subtotal: number; discount_amount: number; tax_amount: number; total_amount: number; is_fiscalized: boolean; zimra_verification_code: string; zimra_verification_url: string; fiscal_errors: string; change_amount: number; cash_amount: number; card_amount: number; mobile_amount: number; payment_method: string; order_date: string; currency: string; notes: string; lines: OrderLine[] };
type CompanyInfo = { id: number; name: string; address: string; phone: string; email: string; tin: string; vat: string; logo_data: string };

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

/* ── Build receipt HTML ── */
function buildReceiptHtml(order: POSOrder, company: CompanyInfo | null, customer: Customer | null, session: POSSession | null, device: Device | null): string {
  const lines = order.lines || [];
  const payLabel = order.payment_method === "split" ? "Split" : order.payment_method.charAt(0).toUpperCase() + order.payment_method.slice(1);

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Receipt - ${order.reference}</title>
<style>
  @page { size: 80mm auto; margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Courier New', monospace; font-size: 12px; width: 80mm; padding: 4mm; color: #000; background: #fff; }
  .center { text-align: center; }
  .bold { font-weight: bold; }
  .logo { max-width: 60mm; max-height: 25mm; margin: 0 auto 4px; display: block; }
  .company-name { font-size: 16px; font-weight: bold; margin-bottom: 2px; }
  .company-info { font-size: 10px; color: #333; line-height: 1.4; }
  .divider { border-top: 1px dashed #000; margin: 6px 0; }
  .ref { font-size: 11px; margin: 4px 0; }
  .date { font-size: 10px; color: #555; }
  .device-info { font-size: 9px; color: #666; margin: 2px 0; }
  table { width: 100%; border-collapse: collapse; margin: 4px 0; }
  th { text-align: left; font-size: 10px; border-bottom: 1px solid #000; padding: 2px 0; }
  th:last-child, td:last-child { text-align: right; }
  td { font-size: 11px; padding: 2px 0; vertical-align: top; }
  .item-detail { font-size: 10px; color: #555; }
  .totals-row { display: flex; justify-content: space-between; padding: 1px 0; font-size: 12px; }
  .grand-total { font-size: 16px; font-weight: bold; border-top: 2px solid #000; border-bottom: 2px solid #000; padding: 4px 0; margin: 4px 0; }
  .fiscal-box { border: 1px solid #000; padding: 6px; margin: 6px 0; text-align: center; }
  .fiscal-label { font-size: 9px; text-transform: uppercase; letter-spacing: 1px; }
  .fiscal-code { font-size: 14px; font-weight: bold; margin: 2px 0; }
  .fiscal-url { font-size: 9px; word-break: break-all; color: #333; }
  .footer { font-size: 10px; color: #555; margin-top: 8px; text-align: center; line-height: 1.4; }
  .customer-info { font-size: 10px; margin: 2px 0; }
  .device-footer { font-size: 9px; color: #666; text-align: center; }
  @media print {
    html, body { width: 80mm; margin: 0; padding: 4mm; }
    @page { size: 80mm auto; margin: 0; }
  }
</style></head><body>
  <div class="center">
    ${company?.logo_data ? `<img class="logo" src="${company.logo_data}" alt="Logo" />` : ""}
    <div class="company-name">${company?.name || "365 Fiscal"}</div>
    <div class="company-info">
      ${company?.address ? company.address + "<br>" : ""}
      ${company?.phone ? "Tel: " + company.phone + "<br>" : ""}
      ${company?.email ? company.email + "<br>" : ""}
      ${company?.tin ? "TIN: " + company.tin : ""}${company?.vat ? " | VAT: " + company.vat : ""}
    </div>
  </div>
  <div class="divider"></div>
  <div class="center">
    <div class="ref bold">${order.reference}</div>
    <div class="date">${new Date(order.order_date).toLocaleString()}</div>
    ${session ? `<div class="date">Session: ${session.name}</div>` : ""}
    ${device ? `<div class="device-info">Device: ${device.model} | S/N: ${device.serial_number}</div><div class="device-info">Device ID: ${device.device_id} | Fiscal Day: ${device.fiscal_day_status}</div>` : ""}
    ${customer ? `<div class="customer-info">Customer: ${customer.name}${customer.tin ? " | TIN: " + customer.tin : ""}</div>` : ""}
  </div>
  <div class="divider"></div>
  <table>
    <thead><tr><th>Item</th><th>Qty</th><th>Price</th><th>Total</th></tr></thead>
    <tbody>
      ${lines.map(l => `
        <tr>
          <td>${l.description}</td>
          <td>${l.quantity}</td>
          <td>${fmt(l.unit_price)}</td>
          <td>${fmt(l.total_price)}</td>
        </tr>
        ${l.discount > 0 ? `<tr><td colspan="4" class="item-detail">&nbsp;&nbsp;Disc: -${l.discount}%</td></tr>` : ""}
        ${l.vat_rate > 0 ? `<tr><td colspan="4" class="item-detail">&nbsp;&nbsp;VAT ${l.vat_rate}%: ${fmt(l.tax_amount)}</td></tr>` : ""}
      `).join("")}
    </tbody>
  </table>
  <div class="divider"></div>
  <div class="totals-row"><span>Subtotal</span><span>${fmt(order.subtotal)}</span></div>
  ${order.discount_amount > 0 ? `<div class="totals-row"><span>Discount</span><span>-${fmt(order.discount_amount)}</span></div>` : ""}
  <div class="totals-row"><span>Tax</span><span>${fmt(order.tax_amount)}</span></div>
  <div class="grand-total center">${order.currency || "USD"} ${fmt(order.total_amount)}</div>
  <div style="margin:4px 0">
    <div class="totals-row"><span>Payment</span><span>${payLabel}</span></div>
    ${order.cash_amount > 0 ? `<div class="totals-row"><span>Cash</span><span>${fmt(order.cash_amount)}</span></div>` : ""}
    ${order.card_amount > 0 ? `<div class="totals-row"><span>Card</span><span>${fmt(order.card_amount)}</span></div>` : ""}
    ${order.mobile_amount > 0 ? `<div class="totals-row"><span>Mobile</span><span>${fmt(order.mobile_amount)}</span></div>` : ""}
    ${order.change_amount > 0 ? `<div class="totals-row bold"><span>Change</span><span>${fmt(order.change_amount)}</span></div>` : ""}
  </div>
  ${order.zimra_verification_code ? `
    <div class="fiscal-box">
      <div class="fiscal-label">ZIMRA Verification</div>
      <div class="fiscal-code">${order.zimra_verification_code}</div>
      ${order.zimra_verification_url ? `<div class="fiscal-url">${order.zimra_verification_url}</div>` : ""}
    </div>
  ` : ""}
  ${device ? `
    <div class="divider"></div>
    <div class="device-footer">
      Fiscal Device: ${device.model}<br>
      Serial: ${device.serial_number}<br>
      Device ID: ${device.device_id}
    </div>
  ` : ""}
  <div class="divider"></div>
  <div class="footer">
    Thank you for your business!<br>
    Powered by 365 Fiscal
  </div>
</body></html>`;
}

/* ── Reliable iframe-based print (avoids popup blockers) ── */
function printReceipt(order: POSOrder, company: CompanyInfo | null, customer: Customer | null, session: POSSession | null, device: Device | null) {
  const html = buildReceiptHtml(order, company, customer, session, device);

  // Remove any previous print iframe
  const oldFrame = document.getElementById("pos-print-frame");
  if (oldFrame) oldFrame.remove();

  const iframe = document.createElement("iframe");
  iframe.id = "pos-print-frame";
  iframe.style.cssText = "position:fixed;top:-10000px;left:-10000px;width:80mm;height:0;border:none;";
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!doc) return;

  doc.open();
  doc.write(html);
  doc.close();

  // Wait for content (including images) to load, then print
  const triggerPrint = () => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } catch {
      // Fallback: open in new window if iframe print fails
      const w = window.open("", "_blank", "width=320,height=700,scrollbars=yes");
      if (w) {
        w.document.write(html);
        w.document.close();
        w.onload = () => { w.focus(); w.print(); };
      }
    }
    // Clean up after a delay
    setTimeout(() => iframe.remove(), 5000);
  };

  // If there's a logo image, wait for it to load
  const imgs = doc.querySelectorAll("img");
  if (imgs.length > 0) {
    let loaded = 0;
    const checkDone = () => { loaded++; if (loaded >= imgs.length) setTimeout(triggerPrint, 100); };
    imgs.forEach((img) => {
      if (img.complete) checkDone();
      else { img.onload = checkDone; img.onerror = checkDone; }
    });
    // Safety timeout in case image events don't fire
    setTimeout(triggerPrint, 2000);
  } else {
    setTimeout(triggerPrint, 200);
  }
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
  const [companyInfo, setCompanyInfo] = useState<CompanyInfo | null>(null);
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
  const [orders, setOrders] = useState<POSOrder[]>([]);
  const [ordersFilter, setOrdersFilter] = useState<"all" | "session">("all");
  const [showOrders, setShowOrders] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<POSOrder | null>(null);
  const [showRefundDialog, setShowRefundDialog] = useState(false);
  const [refundReason, setRefundReason] = useState("");
  const [refundingOrderId, setRefundingOrderId] = useState<number | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // PIN login
  const [showPinDialog, setShowPinDialog] = useState(false);
  const [pinValue, setPinValue] = useState("");
  const [pinError, setPinError] = useState("");
  const [currentCashier, setCurrentCashier] = useState<{ id: number; name: string; role: string } | null>(null);

  // Customer display
  const customerDisplayRef = useRef<Window | null>(null);

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
      apiFetch<CompanyInfo>(`/pos/company-info?company_id=${companyId}`),
    ])
      .then(([prods, cats, devs, sessions, ci]) => {
        setProducts(prods);
        setCategories(cats);
        setDevices(devs);
        setCompanyInfo(ci);
        if (sessions.length > 0) {
          setSession(sessions[0]);
        } else {
          setShowSessionDialog(true);
        }
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [companyId]);

  // ── auto-load orders when session is active ──
  useEffect(() => {
    if (!session) return;
    const url = ordersFilter === "session"
      ? `/pos/orders?company_id=${session.company_id}&session_id=${session.id}&limit=200`
      : `/pos/orders?company_id=${session.company_id}&limit=200`;
    apiFetch<POSOrder[]>(url)
      .then(setOrders)
      .catch(() => {});
  }, [session?.id, ordersFilter]);

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

  // auto-clear errors
  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(""), 8000);
    return () => clearTimeout(t);
  }, [error]);

  // ── PIN verification ──
  const verifyPin = async () => {
    if (!companyId || !pinValue.trim()) return;
    setPinError("");
    try {
      const resp = await apiFetch<{ id: number; name: string; role: string }>(
        "/pos/employees/verify-pin",
        { method: "POST", body: JSON.stringify({ company_id: companyId, pin: pinValue }) }
      );
      setCurrentCashier(resp);
      setShowPinDialog(false);
      setPinValue("");
    } catch (e: any) {
      setPinError(e.message || "Invalid PIN");
    }
  };

  // ── Customer display sync ──
  const syncCustomerDisplay = useCallback(() => {
    if (!customerDisplayRef.current || customerDisplayRef.current.closed) return;
    const data = {
      type: "pos-cart-update",
      cart: cart.map(l => ({
        name: l.product.name,
        qty: l.qty,
        price: l.price,
        discount: l.discount,
        vat_rate: l.vat_rate,
        image_url: l.product.image_url,
        subtotal: lineSubtotal(l),
        total: lineTotal(l),
      })),
      subtotal: cartSubtotal,
      tax: cartTax,
      total: cartTotal,
      companyName: companyInfo?.name || "365 Fiscal",
      companyLogo: companyInfo?.logo_data || "",
    };
    try {
      customerDisplayRef.current.postMessage(data, "*");
    } catch { /* window closed */ }
  }, [cart, cartSubtotal, cartTax, cartTotal, companyInfo]);

  useEffect(() => {
    syncCustomerDisplay();
  }, [syncCustomerDisplay]);

  const openCustomerDisplay = () => {
    if (customerDisplayRef.current && !customerDisplayRef.current.closed) {
      customerDisplayRef.current.focus();
      return;
    }
    customerDisplayRef.current = window.open("/pos/customer-display", "customer-display", "width=1024,height=768");
    // Sync after the window loads
    setTimeout(syncCustomerDisplay, 1500);
  };

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
      setTimeout(() => barcodeRef.current?.focus(), 200);
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
    const val = searchTerm.trim();
    if (!val) return;
    const found = products.find(
      (p) => p.barcode === val || p.reference === val
    );
    if (found) {
      addToCart(found);
      setSearchTerm("");
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
      setCashTendered("");
      setCardAmount("");
      setMobileAmount("");

      // Refresh session, products & orders
      const ordUrl = ordersFilter === "session"
        ? `/pos/orders?company_id=${session.company_id}&session_id=${session.id}&limit=200`
        : `/pos/orders?company_id=${session.company_id}&limit=200`;
      const [updated, prods, ords] = await Promise.all([
        apiFetch<any>(`/pos/sessions/${session.id}`),
        apiFetch<POSProduct[]>(`/pos/products?company_id=${session.company_id}`),
        apiFetch<POSOrder[]>(ordUrl),
      ]);
      setSession(updated.session);
      setProducts(prods);
      setOrders(ords);
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

  const refreshOrders = async () => {
    if (!session) return;
    try {
      const url = ordersFilter === "session"
        ? `/pos/orders?company_id=${session.company_id}&session_id=${session.id}&limit=200`
        : `/pos/orders?company_id=${session.company_id}&limit=200`;
      const data = await apiFetch<POSOrder[]>(url);
      setOrders(data);
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

  // Get the active device for this session
  const activeDevice = devices.find(d => d.id === session?.device_id) || null;

  const handlePrint = () => {
    if (lastOrder) printReceipt(lastOrder, companyInfo, selectedCustomer, session, activeDevice);
  };

  const handlePrintOrder = (o: POSOrder) => {
    printReceipt(o, companyInfo, null, session, activeDevice);
  };

  const openRefundDialog = (orderId: number) => {
    setRefundingOrderId(orderId);
    setRefundReason("");
    setShowRefundDialog(true);
  };

  const submitRefund = async () => {
    if (!refundingOrderId) return;
    try {
      const refundOrder = await apiFetch<POSOrder>(`/pos/orders/${refundingOrderId}/refund`, {
        method: "POST",
        body: JSON.stringify({ reason: refundReason }),
      });
      // Update original order status in list
      setOrders((prev) => prev.map((o) => (o.id === refundingOrderId ? { ...o, status: "refunded" } : o)));
      // Add the refund order to the list
      setOrders((prev) => [refundOrder, ...prev]);
      setShowRefundDialog(false);
      setRefundingOrderId(null);
      setSelectedOrder(null);
    } catch (e: any) {
      setError(e.message);
    }
  };

  const sendReceipt = async (o: POSOrder) => {
    const html = buildReceiptHtml(o, companyInfo, null, session, activeDevice);
    // Use Web Share API if available, otherwise copy text to clipboard
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Receipt ${o.reference}`,
          text: `Receipt ${o.reference} - Total: $${fmt(o.total_amount)}\n${o.zimra_verification_url || ""}`,
        });
      } catch { /* user cancelled */ }
    } else {
      // Fallback: open receipt in new tab for saving/sharing
      const w = window.open("", "_blank");
      if (w) {
        w.document.write(html);
        w.document.close();
      }
    }
  };

  const viewOrderDetail = (o: POSOrder) => {
    setSelectedOrder(o);
  };

  const handleNewOrder = () => {
    setShowReceipt(false);
    setCart([]);
    setSelectedCustomer(null);
    setTimeout(() => barcodeRef.current?.focus(), 100);
  };

  const handlePrintAndNewOrder = () => {
    handlePrint();
    // Small delay so print dialog opens, then reset for new order
    setTimeout(() => {
      handleNewOrder();
    }, 500);
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
          {companyInfo && <span className="pos-company-name">{companyInfo.name}</span>}
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
              autoFocus
            />
            {searchTerm && (
              <button className="pos-barcode-clear" onClick={() => { setSearchTerm(""); barcodeRef.current?.focus(); }}>✕</button>
            )}
          </div>
        </div>
        <div className="pos-topbar-right">
          {/* Cashier / PIN login */}
          <button className="pos-btn pos-btn-sm pos-btn-topbar" onClick={() => setShowPinDialog(true)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            {currentCashier ? currentCashier.name : "Cashier"}
          </button>
          {/* Customer display */}
          <button className="pos-btn pos-btn-sm pos-btn-topbar" onClick={openCustomerDisplay} title="Open customer-facing display">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
            Display
          </button>
          <button className={`pos-btn pos-btn-sm pos-btn-topbar ${showOrders ? "active" : ""}`} onClick={() => { setShowOrders(!showOrders); if (!showOrders) refreshOrders(); }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
            Orders
          </button>
          <button className="pos-btn pos-btn-sm pos-btn-topbar" onClick={() => setShowCustomerSearch(!showCustomerSearch)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            {selectedCustomer ? selectedCustomer.name : "Customer"}
          </button>
          <button className="pos-btn pos-btn-sm pos-btn-close-session" onClick={() => setShowCloseDialog(true)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
            Close
          </button>
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
              <div className="pos-no-products">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--slate-300)" strokeWidth="1.5"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
                <p>No products found</p>
                <p style={{ fontSize: "0.78rem" }}>Add products in Inventory or adjust your search</p>
              </div>
            )}
            {filteredProducts.map((p) => (
              <button key={p.id} className="pos-product-card" onClick={() => addToCart(p)}>
                {p.image_url ? (
                  <div className="pos-product-card-img">
                    <img src={p.image_url} alt={p.name} />
                  </div>
                ) : (
                  <div className="pos-product-card-img pos-product-card-img-placeholder">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" opacity="0.3">
                      <rect x="3" y="3" width="18" height="18" rx="2"/>
                      <circle cx="8.5" cy="8.5" r="1.5"/>
                      <path d="M21 15l-5-5L5 21"/>
                    </svg>
                  </div>
                )}
                <div className="pos-product-card-name">{p.name}</div>
                <div className="pos-product-card-price">${fmt(p.sale_price)}</div>
                {p.track_inventory && p.product_type === "storable" && (
                  <div className={`pos-product-card-stock ${p.stock_on_hand <= 0 ? "out" : p.stock_on_hand <= 5 ? "low" : ""}`}>
                    {p.stock_on_hand <= 0 ? "Out of stock" : `${p.stock_on_hand} ${p.uom}`}
                  </div>
                )}
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
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              <span>{selectedCustomer.name}</span>
              <button className="pos-btn-inline" onClick={() => setSelectedCustomer(null)}>✕</button>
            </div>
          )}

          {/* Cart header */}
          <div className="pos-cart-header">
            <span className="pos-cart-header-title">Current Order</span>
            <span className="pos-cart-header-count">{itemCount} item{itemCount !== 1 ? "s" : ""}</span>
          </div>

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
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
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

      {/* ── ORDERS SLIDE-OUT PANEL ── */}
      {showOrders && (
        <div className="pos-orders-overlay" onClick={() => { setShowOrders(false); setSelectedOrder(null); }}>
          <div className="pos-orders-slideout" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="pos-orders-panel-header">
              <h3>Orders</h3>
              <span className="pos-orders-count">{orders.length}</span>
              <div className="pos-orders-filter">
                <button className={`pos-orders-filter-btn ${ordersFilter === "all" ? "active" : ""}`} onClick={() => setOrdersFilter("all")}>All</button>
                <button className={`pos-orders-filter-btn ${ordersFilter === "session" ? "active" : ""}`} onClick={() => setOrdersFilter("session")}>Session</button>
              </div>
              <button className="pos-btn pos-btn-icon pos-btn-xs" onClick={refreshOrders} title="Refresh">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>
              </button>
              <button className="pos-btn pos-btn-icon pos-btn-xs" onClick={() => { setShowOrders(false); setSelectedOrder(null); }} title="Close">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>

            {/* Order Detail View */}
            {selectedOrder ? (
              <div className="pos-order-detail">
                <button className="pos-btn pos-btn-ghost pos-btn-xs" onClick={() => setSelectedOrder(null)} style={{ marginBottom: 8 }}>
                  ← Back to Orders
                </button>
                <div className="pos-order-detail-header">
                  <div className="pos-order-detail-ref">{selectedOrder.reference}</div>
                  <div className="pos-order-detail-date">{new Date(selectedOrder.order_date).toLocaleString()}</div>
                  <div className="pos-order-detail-status">
                    <span className={`pos-badge pos-badge-sm ${selectedOrder.status === "refunded" ? "pos-badge-danger" : selectedOrder.is_fiscalized ? "pos-badge-success" : "pos-badge-warning"}`}>
                      {selectedOrder.status === "refunded" ? "Refunded" : selectedOrder.is_fiscalized ? "Fiscalized" : "Pending"}
                    </span>
                    {selectedOrder.total_amount < 0 && <span className="pos-badge pos-badge-sm pos-badge-info">Credit Note</span>}
                  </div>
                </div>

                <div className="pos-order-detail-lines">
                  <div className="pos-order-detail-lines-header">
                    <span>Item</span><span>Qty</span><span>Price</span><span>Total</span>
                  </div>
                  {(selectedOrder.lines || []).map((l, i) => (
                    <div key={i} className="pos-order-detail-line">
                      <span>{l.description}</span>
                      <span>{l.quantity}</span>
                      <span>${fmt(l.unit_price)}</span>
                      <span>${fmt(l.total_price)}</span>
                    </div>
                  ))}
                </div>

                <div className="pos-order-detail-totals">
                  <div className="pos-order-detail-totals-row"><span>Subtotal</span><span>${fmt(selectedOrder.subtotal)}</span></div>
                  {selectedOrder.discount_amount > 0 && <div className="pos-order-detail-totals-row"><span>Discount</span><span>-${fmt(selectedOrder.discount_amount)}</span></div>}
                  <div className="pos-order-detail-totals-row"><span>Tax</span><span>${fmt(selectedOrder.tax_amount)}</span></div>
                  <div className="pos-order-detail-totals-row pos-order-detail-grand"><span>Total</span><span>${fmt(selectedOrder.total_amount)}</span></div>
                  <div className="pos-order-detail-totals-row"><span>Payment</span><span style={{ textTransform: "capitalize" }}>{selectedOrder.payment_method}</span></div>
                </div>

                {selectedOrder.zimra_verification_code && (
                  <div className="pos-order-detail-fiscal">
                    <div className="pos-order-detail-fiscal-label">ZIMRA Verification</div>
                    <div className="pos-order-detail-fiscal-code">{selectedOrder.zimra_verification_code}</div>
                    {selectedOrder.zimra_verification_url && (
                      <a href={selectedOrder.zimra_verification_url} target="_blank" rel="noopener noreferrer" className="pos-order-detail-fiscal-link">Verify ↗</a>
                    )}
                  </div>
                )}

                {selectedOrder.notes && (
                  <div className="pos-order-detail-notes">{selectedOrder.notes}</div>
                )}

                {/* Action buttons */}
                <div className="pos-order-detail-actions">
                  <button className="pos-btn pos-btn-sm pos-btn-outline" onClick={() => handlePrintOrder(selectedOrder)}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                    Reprint
                  </button>
                  <button className="pos-btn pos-btn-sm pos-btn-outline" onClick={() => sendReceipt(selectedOrder)}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                    Send
                  </button>
                  {!selectedOrder.is_fiscalized && selectedOrder.status !== "refunded" && selectedOrder.total_amount > 0 && (
                    <button className="pos-btn pos-btn-sm pos-btn-outline" onClick={() => fiscalizeOrder(selectedOrder.id)}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                      Fiscalize
                    </button>
                  )}
                  {selectedOrder.status !== "refunded" && selectedOrder.total_amount > 0 && (
                    <button className="pos-btn pos-btn-sm pos-btn-danger" onClick={() => openRefundDialog(selectedOrder.id)}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 102.13-9.36L1 10"/></svg>
                      Refund
                    </button>
                  )}
                </div>
              </div>
            ) : (
              /* Orders List */
              <>
                <div className="pos-orders-panel-list">
                  {orders.length === 0 && (
                    <div className="pos-orders-empty">
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--slate-300)" strokeWidth="1.5"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                      <p>No orders yet</p>
                    </div>
                  )}
                  {orders.map((o) => (
                    <div key={o.id} className={`pos-orders-panel-row ${o.status === "refunded" ? "refunded" : ""} ${o.total_amount < 0 ? "credit-note" : ""}`} onClick={() => viewOrderDetail(o)}>
                      <div className="pos-orders-panel-row-main">
                        <div className="pos-orders-panel-row-ref">
                          {o.total_amount < 0 && <span className="pos-orders-cn-tag">CN</span>}
                          {o.reference}
                        </div>
                        <div className="pos-orders-panel-row-meta">
                          <span>{ordersFilter === "all"
                            ? new Date(o.order_date).toLocaleDateString(undefined, { month: "short", day: "numeric" }) + " " + new Date(o.order_date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                            : new Date(o.order_date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                          <span className="pos-orders-panel-row-method">{o.payment_method}</span>
                          {o.status === "refunded" && <span className="pos-orders-refund-tag">Refunded</span>}
                        </div>
                      </div>
                      <div className="pos-orders-panel-row-amount">${fmt(o.total_amount)}</div>
                      <div className="pos-orders-panel-row-actions" onClick={(e) => e.stopPropagation()}>
                        {o.zimra_verification_code ? (
                          <span className="pos-badge pos-badge-success pos-badge-sm" title={o.zimra_verification_code}>✓</span>
                        ) : o.fiscal_errors ? (
                          <button className="pos-btn pos-btn-xs pos-btn-outline" onClick={() => fiscalizeOrder(o.id)} title={o.fiscal_errors}>Retry</button>
                        ) : o.status !== "refunded" && o.total_amount > 0 ? (
                          <button className="pos-btn pos-btn-xs pos-btn-outline" onClick={() => fiscalizeOrder(o.id)}>Fiscal</button>
                        ) : null}
                        <button className="pos-btn pos-btn-icon pos-btn-xs" onClick={() => handlePrintOrder(o)} title="Print">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                {orders.length > 0 && (
                  <div className="pos-orders-panel-footer">
                    <div className="pos-orders-panel-summary">
                      <span>Total: {orders.length} orders</span>
                      <span className="pos-orders-panel-total">${fmt(orders.reduce((s, o) => s + o.total_amount, 0))}</span>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* ── REFUND DIALOG ── */}
      {showRefundDialog && (
        <div className="pos-overlay" style={{ zIndex: 1100 }} onClick={() => setShowRefundDialog(false)}>
          <div className="pos-dialog pos-dialog-sm" onClick={(e) => e.stopPropagation()}>
            <div className="pos-dialog-header">
              <h2>Refund Order</h2>
              <button className="pos-btn pos-btn-icon pos-btn-xs" onClick={() => setShowRefundDialog(false)}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div className="pos-dialog-body">
              <p style={{ fontSize: "0.85rem", color: "var(--slate-500)", marginBottom: 12 }}>This will create a credit note and reverse the original order. This action cannot be undone.</p>
              <label className="pos-label">
                Reason for Refund
                <textarea
                  className="pos-input"
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  placeholder="Customer return, damaged goods, wrong item…"
                  rows={3}
                  autoFocus
                />
              </label>
              {error && <div className="pos-error">{error}</div>}
            </div>
            <div className="pos-dialog-footer">
              <button className="pos-btn pos-btn-ghost" onClick={() => setShowRefundDialog(false)}>Cancel</button>
              <button className="pos-btn pos-btn-danger" onClick={submitRefund}>Confirm Refund</button>
            </div>
          </div>
        </div>
      )}

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
                {processing ? (
                  <><div className="pos-spinner" style={{ width: 18, height: 18, borderWidth: 2 }} /> Processing…</>
                ) : (
                  `Validate $${fmt(cartTotal)}`
                )}
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
              {/* Company header with logo */}
              <div className="pos-receipt-company">
                {companyInfo?.logo_data && (
                  <img className="pos-receipt-logo" src={companyInfo.logo_data} alt="Logo" />
                )}
                <div className="pos-receipt-company-name">{companyInfo?.name || "365 Fiscal"}</div>
                {companyInfo?.address && <div className="pos-receipt-company-detail">{companyInfo.address}</div>}
                {companyInfo?.phone && <div className="pos-receipt-company-detail">Tel: {companyInfo.phone}</div>}
                {companyInfo?.email && <div className="pos-receipt-company-detail">{companyInfo.email}</div>}
                {companyInfo?.tin && <div className="pos-receipt-company-detail">TIN: {companyInfo.tin}{companyInfo?.vat ? ` | VAT: ${companyInfo.vat}` : ""}</div>}
              </div>

              <div className="pos-receipt-divider" />

              <div className="pos-receipt-header">
                <div className="pos-receipt-ref">{lastOrder.reference}</div>
                <div className="pos-receipt-date">{new Date(lastOrder.order_date).toLocaleString()}</div>
                {session && <div className="pos-receipt-session">Session: {session.name}</div>}
                {selectedCustomer && <div className="pos-receipt-customer">Customer: {selectedCustomer.name}{selectedCustomer.tin ? ` | TIN: ${selectedCustomer.tin}` : ""}</div>}
              </div>

              <div className="pos-receipt-divider" />

              {/* Line items */}
              <div className="pos-receipt-items">
                <div className="pos-receipt-items-header">
                  <span>Item</span><span>Qty</span><span>Price</span><span>Total</span>
                </div>
                {(lastOrder.lines || []).map((l, i) => (
                  <div key={i} className="pos-receipt-item">
                    <span className="pos-receipt-item-name">{l.description}</span>
                    <span>{l.quantity}</span>
                    <span>{fmt(l.unit_price)}</span>
                    <span>{fmt(l.total_price)}</span>
                  </div>
                ))}
              </div>

              <div className="pos-receipt-divider" />

              {/* Totals */}
              <div className="pos-receipt-totals">
                <div className="pos-receipt-totals-row"><span>Subtotal</span><span>${fmt(lastOrder.subtotal)}</span></div>
                {lastOrder.discount_amount > 0 && <div className="pos-receipt-totals-row"><span>Discount</span><span>-${fmt(lastOrder.discount_amount)}</span></div>}
                <div className="pos-receipt-totals-row"><span>Tax</span><span>${fmt(lastOrder.tax_amount)}</span></div>
                <div className="pos-receipt-grand-total">
                  <span>TOTAL</span><span>${fmt(lastOrder.total_amount)}</span>
                </div>
              </div>

              {/* Payment info */}
              <div className="pos-receipt-payment">
                <div className="pos-receipt-totals-row"><span>Payment</span><span>{lastOrder.payment_method.charAt(0).toUpperCase() + lastOrder.payment_method.slice(1)}</span></div>
                {lastOrder.cash_amount > 0 && <div className="pos-receipt-totals-row"><span>Cash</span><span>${fmt(lastOrder.cash_amount)}</span></div>}
                {lastOrder.card_amount > 0 && <div className="pos-receipt-totals-row"><span>Card</span><span>${fmt(lastOrder.card_amount)}</span></div>}
                {lastOrder.mobile_amount > 0 && <div className="pos-receipt-totals-row"><span>Mobile</span><span>${fmt(lastOrder.mobile_amount)}</span></div>}
                {lastOrder.change_amount > 0 && <div className="pos-receipt-totals-row pos-receipt-change-row"><span>Change</span><span>${fmt(lastOrder.change_amount)}</span></div>}
              </div>

              {/* ZIMRA Verification (only show code, not "Fiscalized" badge) */}
              {lastOrder.zimra_verification_code && (
                <div className="pos-receipt-fiscal">
                  <div className="pos-receipt-fiscal-label">ZIMRA Verification</div>
                  <div className="pos-receipt-fiscal-code">{lastOrder.zimra_verification_code}</div>
                  {lastOrder.zimra_verification_url && (
                    <a className="pos-receipt-fiscal-link" href={lastOrder.zimra_verification_url} target="_blank" rel="noopener noreferrer">Verify Receipt ↗</a>
                  )}
                </div>
              )}

              {lastOrder.fiscal_errors && (
                <div className="pos-receipt-errors">
                  <strong>Error:</strong> {lastOrder.fiscal_errors}
                  <button className="pos-btn pos-btn-sm pos-btn-outline" style={{ marginTop: 8 }} onClick={() => fiscalizeOrder(lastOrder.id)}>Retry Fiscalization</button>
                </div>
              )}

              {/* Fiscal Device Details */}
              {activeDevice && (
                <div className="pos-receipt-device">
                  <div className="pos-receipt-device-label">Fiscal Device</div>
                  <div className="pos-receipt-device-row"><span>Model:</span> <span>{activeDevice.model}</span></div>
                  <div className="pos-receipt-device-row"><span>Serial:</span> <span>{activeDevice.serial_number}</span></div>
                  <div className="pos-receipt-device-row"><span>Device ID:</span> <span>{activeDevice.device_id}</span></div>
                </div>
              )}

              <div className="pos-receipt-footer">
                Thank you for your business!<br />
                Powered by 365 Fiscal
              </div>
            </div>

            <div className="pos-dialog-footer pos-receipt-actions">
              <button className="pos-btn pos-btn-outline" onClick={handlePrint}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                Print
              </button>
              <button className="pos-btn pos-btn-success" onClick={handlePrintAndNewOrder}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                Print & Next
              </button>
              <button className="pos-btn pos-btn-primary" onClick={handleNewOrder}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
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

      {/* ── PIN LOGIN DIALOG ── */}
      {showPinDialog && (
        <div className="pos-overlay" style={{ zIndex: 1200 }} onClick={() => setShowPinDialog(false)}>
          <div className="pos-dialog pos-dialog-sm" onClick={(e) => e.stopPropagation()}>
            <div className="pos-dialog-header">
              <h2>Cashier Login</h2>
              <button className="pos-btn pos-btn-icon pos-btn-xs" onClick={() => setShowPinDialog(false)}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div className="pos-dialog-body" style={{ textAlign: "center" }}>
              {currentCashier && (
                <div style={{ marginBottom: 12, padding: "8px 16px", borderRadius: 8, background: "var(--emerald-50, #ecfdf5)", color: "var(--emerald-700, #047857)", fontSize: "0.85rem" }}>
                  Current: <strong>{currentCashier.name}</strong> ({currentCashier.role})
                </div>
              )}
              <p style={{ fontSize: "0.85rem", color: "var(--slate-500)", marginBottom: 16 }}>Enter your PIN to identify as cashier</p>
              <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
                <input
                  type="password"
                  className="pos-input"
                  style={{ width: 180, textAlign: "center", fontSize: "1.5rem", letterSpacing: 8 }}
                  maxLength={6}
                  value={pinValue}
                  onChange={(e) => { setPinValue(e.target.value.replace(/\D/g, "")); setPinError(""); }}
                  onKeyDown={(e) => { if (e.key === "Enter") verifyPin(); }}
                  placeholder="• • • •"
                  autoFocus
                />
              </div>
              {/* Number pad */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, maxWidth: 240, margin: "0 auto 16px" }}>
                {[1,2,3,4,5,6,7,8,9].map(n => (
                  <button
                    key={n}
                    className="pos-btn pos-btn-outline"
                    style={{ height: 48, fontSize: "1.2rem" }}
                    onClick={() => pinValue.length < 6 && setPinValue(pinValue + n)}
                  >
                    {n}
                  </button>
                ))}
                <button className="pos-btn pos-btn-ghost" style={{ height: 48, fontSize: "0.85rem" }} onClick={() => setPinValue("")}>Clear</button>
                <button className="pos-btn pos-btn-outline" style={{ height: 48, fontSize: "1.2rem" }} onClick={() => pinValue.length < 6 && setPinValue(pinValue + "0")}>0</button>
                <button className="pos-btn pos-btn-ghost" style={{ height: 48, fontSize: "1.2rem" }} onClick={() => setPinValue(pinValue.slice(0, -1))}>⌫</button>
              </div>
              {pinError && <div className="pos-error">{pinError}</div>}
            </div>
            <div className="pos-dialog-footer">
              <button className="pos-btn pos-btn-ghost" onClick={() => { setShowPinDialog(false); setPinValue(""); setPinError(""); }}>Cancel</button>
              <button className="pos-btn pos-btn-primary" onClick={verifyPin} disabled={pinValue.length < 4}>Confirm</button>
            </div>
          </div>
        </div>
      )}

      {/* Global error toast */}
      {error && !showPayment && !showSessionDialog && !showCloseDialog && (
        <div className="pos-toast pos-toast-error" onClick={() => setError("")}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
          {error}
          <button className="pos-toast-close">✕</button>
        </div>
      )}
    </div>
  );
}
