import { useState, useEffect, useRef } from "react";

type DisplayCartLine = {
  name: string;
  qty: number;
  price: number;
  discount: number;
  vat_rate: number;
  image_url: string;
  subtotal: number;
  total: number;
};

type DisplayData = {
  type: "pos-cart-update";
  cart: DisplayCartLine[];
  subtotal: number;
  tax: number;
  total: number;
  companyName: string;
  companyLogo: string;
};

const fmt = (n: number) => n.toFixed(2);

export default function CustomerDisplayPage() {
  const [data, setData] = useState<DisplayData | null>(null);
  const [clock, setClock] = useState(new Date());
  const scrollRef = useRef<HTMLDivElement>(null);
  const [displayMode, setDisplayMode] = useState<"personal" | "company">(
    "personal",
  );

  // Listen for messages from POS window
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type === "pos-cart-update") {
        setData(e.data as DisplayData);
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  // Clock
  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Auto-scroll cart
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [data?.cart.length]);

  const cart = data?.cart || [];
  const total = data?.total || 0;
  const subtotal = data?.subtotal || 0;
  const tax = data?.tax || 0;
  const companyName = data?.companyName || "365 Fiscal";
  const companyLogo = data?.companyLogo || "";

  return (
    <div className="cd-root">
      <style>{`
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { overflow: hidden; }
        .cd-root {
          height: 100vh;
          width: 100vw;
          display: flex;
          flex-direction: column;
          background: linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%);
          color: #f1f5f9;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        .cd-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 20px 32px;
          background: rgba(255,255,255,0.03);
          border-bottom: 1px solid rgba(255,255,255,0.06);
        }
        .cd-header-left { display: flex; align-items: center; gap: 16px; }
        .cd-logo { height: 48px; width: auto; border-radius: 8px; }
        .cd-company-name { font-size: 1.6rem; font-weight: 700; letter-spacing: -0.5px; }
        .cd-clock { font-size: 1.2rem; font-weight: 500; color: #94a3b8; font-variant-numeric: tabular-nums; }
        .cd-body { flex: 1; display: flex; overflow: hidden; }
        .cd-content { flex: 1; display: flex; overflow: hidden; }
        .cd-sidebar {
          width: 200px;
          background: rgba(255,255,255,0.03);
          border-right: 1px solid rgba(255,255,255,0.06);
          padding: 12px;
          flex-shrink: 0;
        }
        .cd-sidebar .o-sidebar-title { color: #94a3b8; }
        .cd-sidebar .o-sidebar-item {
          color: #e2e8f0;
          background: transparent;
        }
        .cd-sidebar .o-sidebar-item:hover { background: rgba(255,255,255,0.06); }
        .cd-sidebar .o-sidebar-item.active {
          background: rgba(37,99,235,0.2);
          color: #bfdbfe;
        }
        .cd-company-section {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px 32px;
        }
        .cd-company-card {
          width: min(720px, 100%);
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 16px;
          padding: 28px 32px;
          text-align: center;
        }
        .cd-company-logo {
          width: 120px;
          height: 120px;
          border-radius: 16px;
          object-fit: contain;
          margin-bottom: 16px;
          background: rgba(255,255,255,0.05);
          padding: 12px;
        }
        .cd-company-title { font-size: 2rem; font-weight: 700; }
        .cd-company-subtitle { color: #94a3b8; margin-top: 6px; }
        .cd-company-stats {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 12px;
          margin-top: 20px;
        }
        .cd-company-stat {
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 12px;
          padding: 12px;
          font-size: 0.95rem;
          color: #94a3b8;
        }
        .cd-company-stat strong {
          display: block;
          font-size: 1.1rem;
          color: #f1f5f9;
          margin-top: 4px;
        }
        .cd-cart-section {
          flex: 1;
          display: flex;
          flex-direction: column;
          padding: 24px 32px;
          overflow: hidden;
        }
        .cd-cart-title {
          font-size: 1.1rem;
          font-weight: 600;
          color: #94a3b8;
          text-transform: uppercase;
          letter-spacing: 2px;
          margin-bottom: 16px;
        }
        .cd-cart-list {
          flex: 1;
          overflow-y: auto;
          scrollbar-width: thin;
          scrollbar-color: rgba(255,255,255,0.1) transparent;
        }
        .cd-cart-list::-webkit-scrollbar { width: 6px; }
        .cd-cart-list::-webkit-scrollbar-track { background: transparent; }
        .cd-cart-list::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 3px; }
        .cd-line {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 14px 0;
          border-bottom: 1px solid rgba(255,255,255,0.05);
          animation: cd-fade-in 0.3s ease;
        }
        @keyframes cd-fade-in {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .cd-line-img {
          width: 52px;
          height: 52px;
          border-radius: 10px;
          overflow: hidden;
          background: rgba(255,255,255,0.05);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .cd-line-img img { width: 100%; height: 100%; object-fit: cover; }
        .cd-line-info { flex: 1; }
        .cd-line-name { font-size: 1.15rem; font-weight: 600; margin-bottom: 2px; }
        .cd-line-meta { font-size: 0.9rem; color: #64748b; }
        .cd-line-total { font-size: 1.2rem; font-weight: 700; text-align: right; min-width: 100px; }
        .cd-totals-section {
          width: 360px;
          display: flex;
          flex-direction: column;
          justify-content: center;
          padding: 32px;
          background: rgba(255,255,255,0.03);
          border-left: 1px solid rgba(255,255,255,0.06);
        }
        .cd-total-row {
          display: flex;
          justify-content: space-between;
          padding: 8px 0;
          font-size: 1.1rem;
          color: #94a3b8;
        }
        .cd-total-row span:last-child { font-weight: 600; color: #f1f5f9; }
        .cd-grand-total {
          display: flex;
          justify-content: space-between;
          padding: 20px 0;
          margin-top: 12px;
          border-top: 2px solid rgba(255,255,255,0.1);
          font-size: 2.2rem;
          font-weight: 800;
          color: #10b981;
        }
        .cd-item-count {
          text-align: center;
          padding: 12px;
          margin-top: 16px;
          border-radius: 12px;
          background: rgba(255,255,255,0.05);
          font-size: 1rem;
          color: #64748b;
        }
        .cd-empty {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          color: #475569;
        }
        .cd-empty-icon { margin-bottom: 16px; opacity: 0.4; }
        .cd-empty p { font-size: 1.4rem; font-weight: 500; }
        .cd-empty small { font-size: 1rem; color: #334155; margin-top: 8px; }
        .cd-footer {
          text-align: center;
          padding: 12px;
          font-size: 0.85rem;
          color: #334155;
          border-top: 1px solid rgba(255,255,255,0.04);
        }
      `}</style>

      {/* Header */}
      <div className="cd-header">
        <div className="cd-header-left">
          {companyLogo && <img className="cd-logo" src={companyLogo} alt="" />}
          <div className="cd-company-name">{companyName}</div>
        </div>
        <div className="cd-clock">
          {clock.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
          {" · "}
          {clock.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
        </div>
      </div>

      {/* Body */}
      <div className="cd-body">
        <div className="o-sidebar cd-sidebar">
          <div className="o-sidebar-section">
            <div className="o-sidebar-title">VIEW</div>
            {[
              { key: "personal", label: "Personal" },
              { key: "company", label: "Company" },
            ].map((item) => (
              <div
                key={item.key}
                className={`o-sidebar-item ${displayMode === item.key ? "active" : ""}`}
                onClick={() =>
                  setDisplayMode(item.key as "personal" | "company")
                }
                style={{ cursor: "pointer" }}
              >
                <span>{item.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="cd-content">
          {displayMode === "personal" ? (
            cart.length === 0 ? (
              <div className="cd-empty">
                <div className="cd-empty-icon">
                  <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                    <circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" />
                    <path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6" />
                  </svg>
                </div>
                <p>Welcome!</p>
                <small>Your items will appear here</small>
              </div>
            ) : (
              <>
                <div className="cd-cart-section">
                  <div className="cd-cart-title">Your Items ({cart.reduce((s, l) => s + l.qty, 0)})</div>
                  <div className="cd-cart-list" ref={scrollRef}>
                    {cart.map((l, i) => (
                      <div key={i} className="cd-line">
                        <div className="cd-line-img">
                          {l.image_url ? (
                            <img src={l.image_url} alt={l.name} />
                          ) : (
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="1.2">
                              <rect x="3" y="3" width="18" height="18" rx="2" />
                              <circle cx="8.5" cy="8.5" r="1.5" />
                              <path d="M21 15l-5-5L5 21" />
                            </svg>
                          )}
                        </div>
                        <div className="cd-line-info">
                          <div className="cd-line-name">{l.name}</div>
                          <div className="cd-line-meta">
                            {l.qty} × ${fmt(l.price)}
                            {l.discount > 0 && ` (−${l.discount}%)`}
                          </div>
                        </div>
                        <div className="cd-line-total">${fmt(l.total)}</div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="cd-totals-section">
                  <div className="cd-total-row"><span>Subtotal</span><span>${fmt(subtotal)}</span></div>
                  <div className="cd-total-row"><span>Tax</span><span>${fmt(tax)}</span></div>
                  <div className="cd-grand-total"><span>Total</span><span>${fmt(total)}</span></div>
                  <div className="cd-item-count">
                    {cart.reduce((s, l) => s + l.qty, 0)} item{cart.reduce((s, l) => s + l.qty, 0) !== 1 ? "s" : ""} in cart
                  </div>
                </div>
              </>
            )
          ) : (
            <div className="cd-company-section">
              <div className="cd-company-card">
                {companyLogo && (
                  <img className="cd-company-logo" src={companyLogo} alt="" />
                )}
                <div className="cd-company-title">{companyName}</div>
                <div className="cd-company-subtitle">
                  Thanks for shopping with us.
                </div>
                <div className="cd-company-stats">
                  <div className="cd-company-stat">
                    Subtotal
                    <strong>${fmt(subtotal)}</strong>
                  </div>
                  <div className="cd-company-stat">
                    Tax
                    <strong>${fmt(tax)}</strong>
                  </div>
                  <div className="cd-company-stat">
                    Total
                    <strong>${fmt(total)}</strong>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="cd-footer">Powered by 365 Fiscal</div>
    </div>
  );
}
