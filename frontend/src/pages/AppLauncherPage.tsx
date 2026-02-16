import { useState, useEffect } from "react";
import { NavLink } from "react-router-dom";
import { useMe } from "../hooks/useMe";
import { getInitials } from "../hooks/getInitials";
import { apiFetch } from "../api";

type ActivationStatus = {
  activated: boolean;
  plan: string | null;
  status: string | null;
  expires_at: string | null;
  company_name: string | null;
};

// App icons as SVG components with explicit dimensions
const DashboardIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="48"
    height="48"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="3" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" />
    <rect x="14" y="14" width="7" height="7" rx="1" />
  </svg>
);

const InvoiceIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="48"
    height="48"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
    <polyline points="10 9 9 9 8 9" />
  </svg>
);

const PurchaseIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="48"
    height="48"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="9" cy="21" r="1" />
    <circle cx="20" cy="21" r="1" />
    <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
  </svg>
);

// const ProductIcon = () => (
//   <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
//     <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
//     <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
//     <line x1="12" y1="22.08" x2="12" y2="12" />
//   </svg>
// );

const ContactIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="48"
    height="48"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

const QuoteIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="48"
    height="48"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="12" y1="18" x2="12" y2="12" />
    <line x1="9" y1="15" x2="15" y2="15" />
  </svg>
);

const InventoryIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="48"
    height="48"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M3 7l9-4 9 4" />
    <path d="M21 7v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7" />
    <path d="M3 7l9 4 9-4" />
    <path d="M7 11v6" />
    <path d="M12 12v7" />
    <path d="M17 11v6" />
  </svg>
);

const DeviceIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="48"
    height="48"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
    <line x1="8" y1="21" x2="16" y2="21" />
    <line x1="12" y1="17" x2="12" y2="21" />
  </svg>
);

const ReportsIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="48"
    height="48"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="18" y1="20" x2="18" y2="10" />
    <line x1="12" y1="20" x2="12" y2="4" />
    <line x1="6" y1="20" x2="6" y2="14" />
  </svg>
);

const SettingsIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="48"
    height="48"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);

const CompanyIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="48"
    height="48"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M3 21h18" />
    <path d="M5 21V7l8-4v18" />
    <path d="M19 21V11l-6-4" />
    <path d="M9 9v.01" />
    <path d="M9 12v.01" />
    <path d="M9 15v.01" />
    <path d="M9 18v.01" />
  </svg>
);

const SubscriptionIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="48"
    height="48"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <line x1="3" y1="10" x2="21" y2="10" />
    <line x1="7" y1="15" x2="7" y2="15.01" />
    <line x1="11" y1="15" x2="17" y2="15" />
  </svg>
);

const POSLauncherIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="48"
    height="48"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="2" y="2" width="20" height="20" rx="2" />
    <rect x="6" y="4" width="12" height="7" rx="1" />
    <circle cx="8" cy="15" r="1" />
    <circle cx="12" cy="15" r="1" />
    <circle cx="16" cy="15" r="1" />
    <circle cx="8" cy="19" r="1" />
    <circle cx="12" cy="19" r="1" />
    <rect x="14" y="17" width="4" height="3" rx="0.5" />
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
  {
    to: "/dashboard",
    label: "Dashboard",
    icon: DashboardIcon,
    color: "var(--white-500)",
    bgColor: "var(--orange-500)",
  },
  {
    to: "/companies",
    label: "Companies",
    icon: CompanyIcon,
    color: "var(--white-500)",
    bgColor: "var(--violet-500)",
  },
  {
    to: "/invoices",
    label: "Invoices",
    icon: InvoiceIcon,
    color: "var(--white-500)",
    bgColor: "var(--red-500)",
  },
  {
    to: "/purchases",
    label: "Purchases",
    icon: PurchaseIcon,
    color: "var(--white-500)",
    bgColor: "var(--sky-500)",
  },
  // { to: "/products", label: "Products", icon: ProductIcon, color: "var(--white-500)", bgColor: "var(--cyan-500)" },
  {
    to: "/contacts",
    label: "Contacts",
    icon: ContactIcon,
    color: "var(--white-500)",
    bgColor: "var(--emerald-500)",
  },
  {
    to: "/quotations",
    label: "Quotations",
    icon: QuoteIcon,
    color: "var(--white-500)",
    bgColor: "var(--indigo-500)",
  },
  {
    to: "/inventory",
    label: "Inventory",
    icon: InventoryIcon,
    color: "var(--white-500)",
    bgColor: "var(--violet-600)",
  },
  {
    to: "/pos",
    label: "Point of Sale",
    icon: POSLauncherIcon,
    color: "var(--white-500)",
    bgColor: "var(--green-500)",
  },
  {
    to: "/devices",
    label: "Devices",
    icon: DeviceIcon,
    color: "var(--white-500)",
    bgColor: "var(--pink-500)",
  },
  {
    to: "/reports",
    label: "Reports",
    icon: ReportsIcon,
    color: "var(--white-500)",
    bgColor: "var(--teal-500)",
  },
  {
    to: "/subscriptions",
    label: "Subscriptions",
    icon: SubscriptionIcon,
    color: "var(--white-500)",
    bgColor: "var(--amber-500)",
  },
  {
    to: "/settings",
    label: "Settings",
    icon: SettingsIcon,
    color: "var(--white-500)",
    bgColor: "var(--slate-500)",
  },
];

const portalApps: AppItem[] = [
  {
    to: "/dashboard",
    label: "Dashboard",
    icon: DashboardIcon,
    color: "var(--white-500)",
    bgColor: "var(--orange-500)",
  },
  {
    to: "/invoices",
    label: "Invoices",
    icon: InvoiceIcon,
    color: "var(--white-500)",
    bgColor: "var(--red-500)",
  },
  {
    to: "/purchases",
    label: "Purchases",
    icon: PurchaseIcon,
    color: "var(--white-500)",
    bgColor: "var(--sky-500)",
  },
  {
    to: "/contacts",
    label: "Contacts",
    icon: ContactIcon,
    color: "var(--white-500)",
    bgColor: "var(--emerald-500)",
  },
  {
    to: "/quotations",
    label: "Quotations",
    icon: QuoteIcon,
    color: "var(--white-500)",
    bgColor: "var(--indigo-500)",
  },
  {
    to: "/inventory",
    label: "Inventory",
    icon: InventoryIcon,
    color: "var(--white-500)",
    bgColor: "var(--violet-600)",
  },
  {
    to: "/pos",
    label: "Point of Sale",
    icon: POSLauncherIcon,
    color: "var(--white-500)",
    bgColor: "var(--green-500)",
  },
  {
    to: "/my-devices",
    label: "Devices",
    icon: DeviceIcon,
    color: "var(--white-500)",
    bgColor: "var(--pink-500)",
  },
  {
    to: "/reports",
    label: "Reports",
    icon: ReportsIcon,
    color: "var(--white-500)",
    bgColor: "var(--teal-500)",
  },
  {
    to: "/settings",
    label: "Settings",
    icon: SettingsIcon,
    color: "var(--white-500)",
    bgColor: "var(--slate-500)",
  },
];

export default function AppLauncherPage() {
  const { me, loading } = useMe();
  const isAdmin = Boolean(me?.is_admin);
  const apps = isAdmin ? adminApps : portalApps;
  const displayName = me?.email ?? "User";
  const initials = getInitials(displayName);

  // Portal activation gate
  const [activationStatus, setActivationStatus] = useState<
    ActivationStatus[] | null
  >(null);
  const [activationLoading, setActivationLoading] = useState(false);
  const [activationCode, setActivationCode] = useState("");
  const [activateError, setActivateError] = useState("");
  const [activateSuccess, setActivateSuccess] = useState("");
  const [activating, setActivating] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  useEffect(() => {
    if (!isAdmin && me) {
      setActivationLoading(true);
      apiFetch<ActivationStatus[]>("/subscriptions/my-status")
        .then((data) => setActivationStatus(data))
        .catch(() => setActivationStatus([]))
        .finally(() => setActivationLoading(false));
    }
  }, [isAdmin, me]);

  const hasActiveSubscription = activationStatus?.some(
    (s) => s.activated && s.status === "active",
  );

  const handleActivate = async () => {
    if (!activationCode.trim()) return;
    setActivating(true);
    setActivateError("");
    setActivateSuccess("");
    try {
      await apiFetch("/subscriptions/activate", {
        method: "POST",
        body: JSON.stringify({ code: activationCode.trim() }),
      });
      setActivateSuccess("Subscription activated successfully!");
      setActivationCode("");
      // Reload status
      const data = await apiFetch<ActivationStatus[]>(
        "/subscriptions/my-status",
      );
      setActivationStatus(data);
    } catch (err: any) {
      setActivateError(err.message || "Invalid or expired activation code.");
    } finally {
      setActivating(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("access_token");
    window.location.href = "/login";
  };

  // Show loading state
  if (loading || activationLoading) {
    return (
      <div className="app-launcher-page">
        <div
          className="app-launcher-container"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div style={{ textAlign: "center", color: "var(--slate-500)" }}>
            <div style={{ fontSize: "18px", fontWeight: 600 }}>Loading...</div>
          </div>
        </div>
      </div>
    );
  }

  // Portal activation gate — no active subscription
  if (!isAdmin && !hasActiveSubscription) {
    return (
      <div className="app-launcher-page">
        <header className="app-launcher-header">
          <div className="app-launcher-user">
            <div className="user-menu">
              <button
                type="button"
                className="user-menu-trigger"
                onClick={() => setUserMenuOpen((prev) => !prev)}
                aria-haspopup="menu"
                aria-expanded={userMenuOpen}
                title="User menu"
              >
                <div className="user-avatar-small">{initials}</div>
              </button>
              {userMenuOpen && (
                <div className="user-menu-panel" role="menu">
                  <div className="user-menu-title">{displayName}</div>
                  <button
                    className="user-menu-action"
                    onClick={handleLogout}
                    role="menuitem"
                  >
                    Log out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>
        <div
          className="app-launcher-container"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "70vh",
          }}
        >
          <div
            style={{
              maxWidth: 520,
              width: "100%",
              textAlign: "center",
              background: "white",
              borderRadius: 20,
              padding: "48px 40px",
              boxShadow:
                "0 20px 60px rgba(0,0,0,0.15), 0 4px 20px rgba(0,0,0,0.08)",
              border: "1px solid rgba(99,102,241,0.15)",
              position: "relative",
              overflow: "hidden",
            }}
          >
            {/* Decorative top gradient bar */}
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                height: 5,
                background: "linear-gradient(90deg, #6366f1, #8b5cf6, #a855f7)",
              }}
            />

            {/* Lock icon */}
            <div
              style={{
                width: 96,
                height: 96,
                borderRadius: "50%",
                background: "linear-gradient(135deg, #ede9fe, #ddd6fe)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 28px",
                boxShadow: "0 8px 24px rgba(99,102,241,0.2)",
              }}
            >
              <svg
                width="44"
                height="44"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#7c3aed"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </div>

            <h2
              style={{
                fontSize: 26,
                fontWeight: 800,
                marginBottom: 10,
                color: "#1e1b4b",
                letterSpacing: "-0.5px",
              }}
            >
              Activate Your Subscription
            </h2>
            <p
              style={{
                color: "#64748b",
                fontSize: 15,
                marginBottom: 32,
                lineHeight: 1.7,
                maxWidth: 380,
                margin: "0 auto 32px",
              }}
            >
              Enter the activation code provided by your administrator to unlock
              access to all applications.
            </p>

            {activateError && (
              <div
                style={{
                  marginBottom: 20,
                  padding: "14px 20px",
                  borderRadius: 12,
                  background: "#fef2f2",
                  color: "#dc2626",
                  border: "1px solid #fecaca",
                  fontSize: 14,
                  fontWeight: 600,
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  justifyContent: "center",
                }}
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="15" y1="9" x2="9" y2="15" />
                  <line x1="9" y1="9" x2="15" y2="15" />
                </svg>
                {activateError}
              </div>
            )}
            {activateSuccess && (
              <div
                style={{
                  marginBottom: 20,
                  padding: "14px 20px",
                  borderRadius: 12,
                  background: "#f0fdf4",
                  color: "#16a34a",
                  border: "1px solid #bbf7d0",
                  fontSize: 14,
                  fontWeight: 600,
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  justifyContent: "center",
                }}
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <path d="m9 11 3 3L22 4" />
                </svg>
                {activateSuccess}
              </div>
            )}

            <div style={{ marginBottom: 20 }}>
              <input
                type="text"
                value={activationCode}
                onChange={(e) =>
                  setActivationCode(e.target.value.toUpperCase())
                }
                placeholder="XXXX – XXXX – XXXX – XXXX"
                maxLength={19}
                style={{
                  width: "100%",
                  padding: "16px 20px",
                  fontSize: 20,
                  fontFamily: "'Courier New', monospace",
                  letterSpacing: 4,
                  textAlign: "center",
                  borderRadius: 14,
                  border: "2px solid #e2e8f0",
                  outline: "none",
                  fontWeight: 800,
                  background: "#f8fafc",
                  color: "#1e1b4b",
                  transition: "all 0.2s ease",
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = "#6366f1";
                  e.target.style.boxShadow = "0 0 0 4px rgba(99,102,241,0.15)";
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = "#e2e8f0";
                  e.target.style.boxShadow = "none";
                }}
                onKeyDown={(e) => e.key === "Enter" && handleActivate()}
              />
            </div>

            <button
              onClick={handleActivate}
              disabled={activating || activationCode.trim().length < 10}
              style={{
                width: "100%",
                padding: "16px 0",
                fontSize: 17,
                fontWeight: 800,
                borderRadius: 14,
                border: "none",
                cursor: "pointer",
                color: "white",
                background:
                  activating || activationCode.trim().length < 10
                    ? "linear-gradient(135deg, #94a3b8, #94a3b8)"
                    : "linear-gradient(135deg, #4f46e5, #7c3aed)",
                boxShadow:
                  activating || activationCode.trim().length < 10
                    ? "none"
                    : "0 8px 24px rgba(79,70,229,0.35)",
                transition: "all 0.2s ease",
                letterSpacing: "0.5px",
              }}
            >
              {activating ? "Activating..." : "Activate"}
            </button>

            <p
              style={{
                color: "#94a3b8",
                fontSize: 13,
                marginTop: 28,
                fontWeight: 500,
              }}
            >
              Don't have a code? Contact your company administrator.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-launcher-page">
      {/* Header */}
      <header className="app-launcher-header">
        <div className="app-launcher-user">
          <div className="user-menu">
            <button
              type="button"
              className="user-menu-trigger"
              onClick={() => setUserMenuOpen((prev) => !prev)}
              aria-haspopup="menu"
              aria-expanded={userMenuOpen}
              title="User menu"
            >
              <div className="user-avatar-small">{initials}</div>
            </button>
            {userMenuOpen && (
              <div className="user-menu-panel" role="menu">
                <div className="user-menu-title">{displayName}</div>
                <button
                  className="user-menu-action"
                  onClick={handleLogout}
                  role="menuitem"
                >
                  Log out
                </button>
              </div>
            )}
          </div>
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
    </div>
  );
}
