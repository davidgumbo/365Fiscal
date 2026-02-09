import { NavLink } from "react-router-dom";
import { useMe } from "../hooks/useMe";

// App icons as SVG components with explicit dimensions
const DashboardIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" />
    <rect x="14" y="14" width="7" height="7" rx="1" />
  </svg>
);

const InvoiceIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
    <polyline points="10 9 9 9 8 9" />
  </svg>
);

const ProductIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
    <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
    <line x1="12" y1="22.08" x2="12" y2="12" />
  </svg>
);

const ContactIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

const QuoteIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="12" y1="18" x2="12" y2="12" />
    <line x1="9" y1="15" x2="15" y2="15" />
  </svg>
);

const InventoryIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 8h14M5 8a2 2 0 1 1 0-4h14a2 2 0 1 1 0 4M5 8v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8" />
    <line x1="10" y1="12" x2="10" y2="16" />
    <line x1="14" y1="12" x2="14" y2="16" />
  </svg>
);

const DeviceIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
    <line x1="8" y1="21" x2="16" y2="21" />
    <line x1="12" y1="17" x2="12" y2="21" />
  </svg>
);

const ReportsIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="20" x2="18" y2="10" />
    <line x1="12" y1="20" x2="12" y2="4" />
    <line x1="6" y1="20" x2="6" y2="14" />
  </svg>
);

const SettingsIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);

const UsersIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

const AuditIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
  </svg>
);

const PaymentIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/>
    <line x1="1" y1="10" x2="23" y2="10"/>
  </svg>
);

const CompanyIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 21h18" />
    <path d="M5 21V7l8-4v18" />
    <path d="M19 21V11l-6-4" />
    <path d="M9 9v.01" />
    <path d="M9 12v.01" />
    <path d="M9 15v.01" />
    <path d="M9 18v.01" />
  </svg>
);

interface AppItem {
  to: string;
  label: string;
  icon: () => JSX.Element;
  color: string;
  bgColor: string;
}

const adminApps: AppItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: DashboardIcon, color: "#ffffff", bgColor: "#f97316" },
  { to: "/companies", label: "Companies", icon: CompanyIcon, color: "#ffffff", bgColor: "#8b5cf6" },
  { to: "/invoices", label: "Invoices", icon: InvoiceIcon, color: "#ffffff", bgColor: "#ef4444" },
  { to: "/products", label: "Products", icon: ProductIcon, color: "#ffffff", bgColor: "#06b6d4" },
  { to: "/contacts", label: "Contacts", icon: ContactIcon, color: "#ffffff", bgColor: "#10b981" },
  { to: "/quotations", label: "Quotations", icon: QuoteIcon, color: "#ffffff", bgColor: "#6366f1" },
  { to: "/inventory", label: "Inventory", icon: InventoryIcon, color: "#ffffff", bgColor: "#7c3aed" },
  { to: "/devices", label: "Devices", icon: DeviceIcon, color: "#ffffff", bgColor: "#ec4899" },
  { to: "/payments", label: "Payments", icon: PaymentIcon, color: "#ffffff", bgColor: "#059669" },
  { to: "/reports", label: "Reports", icon: ReportsIcon, color: "#ffffff", bgColor: "#14b8a6" },
  { to: "/users-roles", label: "Users & Roles", icon: UsersIcon, color: "#ffffff", bgColor: "#0ea5e9" },
  { to: "/audit-logs", label: "Audit Logs", icon: AuditIcon, color: "#ffffff", bgColor: "#f43f5e" },
  { to: "/settings", label: "Settings", icon: SettingsIcon, color: "#ffffff", bgColor: "#64748b" },
];

const portalApps: AppItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: DashboardIcon, color: "#ffffff", bgColor: "#f97316" },
  { to: "/invoices", label: "Invoices", icon: InvoiceIcon, color: "#ffffff", bgColor: "#ef4444" },
  { to: "/contacts", label: "Contacts", icon: ContactIcon, color: "#ffffff", bgColor: "#10b981" },
  { to: "/quotations", label: "Quotations", icon: QuoteIcon, color: "#ffffff", bgColor: "#6366f1" },
  { to: "/inventory", label: "Inventory", icon: InventoryIcon, color: "#ffffff", bgColor: "#7c3aed" },
  { to: "/reports", label: "Reports", icon: ReportsIcon, color: "#ffffff", bgColor: "#14b8a6" },
  { to: "/settings", label: "Settings", icon: SettingsIcon, color: "#ffffff", bgColor: "#64748b" },
];

export default function AppLauncherPage() {
  const { me, loading } = useMe();
  const isAdmin = Boolean(me?.is_admin);
  const apps = isAdmin ? adminApps : portalApps;
  const displayName = me?.email ?? "User";

  const handleLogout = () => {
    localStorage.removeItem("access_token");
    window.location.href = "/login";
  };

  // Show loading state
  if (loading) {
    return (
      <div className="app-launcher-page">
        <div className="app-launcher-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ textAlign: 'center', color: '#64748b' }}>
            <div style={{ fontSize: '18px', fontWeight: 600 }}>Loading...</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-launcher-page">
      {/* Header */}
      <header className="app-launcher-header">
        <div className="app-launcher-logo">
          <img src="/365.png" alt="365 Fiscal" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
        </div>
        <div className="app-launcher-user">
          <span className="user-name">{displayName}</span>
          <div className="user-avatar-small">
            {displayName.charAt(0).toUpperCase()}
          </div>
          <button className="app-launcher-logout" onClick={handleLogout} title="Log out">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </button>
        </div>
      </header>
      
      {/* App Grid Container */}
      <div className="app-launcher-container">
        <div className="app-grid">
          {apps.map((app, index) => (
            <NavLink 
              key={app.to} 
              to={app.to} 
              className="app-tile"
              style={{ animationDelay: `${60 + index * 40}ms` }}
            >
              <div 
                className="app-tile-icon-wrapper" 
                style={{ backgroundColor: app.bgColor }}
              >
                <div className="app-tile-icon" style={{ color: app.color }}>
                  {app.icon()}
                </div>
              </div>
              <span className="app-tile-label">{app.label}</span>
            </NavLink>
          ))}
        </div>
      </div>

      {/* Footer */}
      <footer className="app-launcher-footer">
        <img 
          className="footer-logo" 
          src="/geenet.trim.png" 
          alt="GeeNet" 
          onError={(e) => { e.currentTarget.style.display = 'none'; }}
        />
      </footer>
    </div>
  );
}
