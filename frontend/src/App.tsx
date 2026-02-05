import { useEffect, useMemo, useRef, useState } from "react";
import { Routes, Route, NavLink, useLocation } from "react-router-dom";
import DashboardPage from "./pages/DashboardPage";
import CompaniesPage from "./pages/CompaniesPage";
import ProductsPage from "./pages/ProductsPage";
import ContactsPage from "./pages/ContactsPage";
import QuotationsPage from "./pages/QuotationsPage";
import InvoicesPage from "./pages/InvoicesPage";
import InventoryPage from "./pages/InventoryPage";
import LoginPage from "./pages/LoginPage";
import PortalLoginPage from "./pages/PortalLoginPage";
import SettingsPage from "./pages/SettingsPage";
import DevicesPage from "./pages/DevicesPage";
import ReportsPage from "./pages/ReportsPage";
import { apiFetch } from "./api";
import { useMe } from "./hooks/useMe";
import ListViewContext, { FilterChip, ListViewState, SavedFilter } from "./context/ListViewContext";
import AuthGuard from "./components/AuthGuard";

const adminNav = [
  { to: "/", label: "Dashboard", icon: DashboardIcon },
  { to: "/companies", label: "Companies", icon: CompanyIcon },
  { to: "/invoices", label: "Invoices", icon: InvoiceIcon },
  { to: "/products", label: "Products", icon: ProductIcon },
  { to: "/contacts", label: "Contacts", icon: ContactIcon },
  { to: "/quotations", label: "Quotations", icon: QuoteIcon },
  { to: "/inventory", label: "Inventory", icon: InventoryIcon },
  { to: "/devices", label: "Devices", icon: DeviceIcon },
  { to: "/reports", label: "Reports", icon: ReportsIcon },
  { to: "/settings", label: "Settings", icon: SettingsIcon }
];

const portalNav = [
  { to: "/", label: "Dashboard", icon: DashboardIcon },
  { to: "/invoices", label: "Invoices", icon: InvoiceIcon },
  { to: "/contacts", label: "Contacts", icon: ContactIcon },
  { to: "/quotations", label: "Quotations", icon: QuoteIcon },
  { to: "/inventory", label: "Inventory", icon: InventoryIcon },
  { to: "/reports", label: "Reports", icon: ReportsIcon },
  { to: "/settings", label: "Settings", icon: SettingsIcon }
];

type FilterCondition = {
  id: string;
  field: string;
  operator: string;
  value: string;
};

type CustomField = {
  label: string;
  value: string;
  type?: "text" | "choice" | "date";
  valuesEndpoint?: string;
};

function AppContent() {
  const location = useLocation();
  const { me } = useMe();
  const isPortalMode = !me?.is_admin;
  const [listViewByPath, setListViewByPath] = useState<Record<string, ListViewState>>({});
  const [fieldValues, setFieldValues] = useState<Record<string, string[]>>({});
  const [appMenuOpen, setAppMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  // (moved) fetch choice field values when filter menu opens; placed after currentPath declaration
  const [conditions, setConditions] = useState<FilterCondition[]>([
    { id: "cond-1", field: "", operator: "contains", value: "" }
  ]);
  const topbarRef = useRef<HTMLDivElement | null>(null);

  const navItems = isPortalMode ? portalNav : adminNav;
  const displayName = me?.email ?? (isPortalMode ? "Portal User" : "Admin");
  const initials = getInitials(displayName);
  const currentPath = location.pathname === "/" ? "/" : location.pathname;
  const isDashboard = currentPath === "/";
  const listState = listViewByPath[currentPath] ?? {
    search: "",
    filters: [],
    groupBy: "",
    favorites: []
  };
  const savedFilters = useMemo(() => getSavedFilters(currentPath), [currentPath]);
  const groupOptions = useMemo(() => getGroupOptions(currentPath), [currentPath]);
  const customFields = useMemo(() => getCustomFields(currentPath), [currentPath]);
  const breadcrumb = getBreadcrumb(currentPath, navItems);

  useEffect(() => {
    const fields = getCustomFields(currentPath).filter((f) => f.valuesEndpoint);
    fields.forEach((f) => {
      if (!f.valuesEndpoint) return;
      apiFetch<string[]>(f.valuesEndpoint).then((vals) => {
        setFieldValues((prev) => ({ ...prev, [f.value]: vals || [] }));
      }).catch(() => {});
    });
  }, [currentPath, me?.company_ids]);

  const updateListState = (next: Partial<ListViewState>) => {
    setListViewByPath((prev) => ({
      ...prev,
      [currentPath]: {
        ...listState,
        ...next
      }
    }));
  };

  const listViewContextValue = {
    state: listState,
    setSearch: (value: string) => updateListState({ search: value }),
    addFilter: (chip: FilterChip) => updateListState({ filters: [...listState.filters, chip] }),
    removeFilter: (id: string) =>
      updateListState({ filters: listState.filters.filter((chip) => chip.id !== id) }),
    clearFilters: () => updateListState({ filters: [] }),
    setGroupBy: (value: string) => updateListState({ groupBy: value }),
    toggleFavorite: (name: string) => {
      const exists = listState.favorites.includes(name);
      updateListState({
        favorites: exists
          ? listState.favorites.filter((item) => item !== name)
          : [...listState.favorites, name]
      });
    },
    applySavedFilter: (saved: SavedFilter) => updateListState({ filters: saved.filters }),
    savedFilters
  };

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (topbarRef.current && !topbarRef.current.contains(target)) {
        setAppMenuOpen(false);
        setUserMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <ListViewContext.Provider value={listViewContextValue}>
      <div className="app-shell">
        <aside className="sidebar">
          <div className="brand">
            <img src="/zimra.png" alt="ZIMRA" className="brand-logo" />
          </div>
          <nav className="nav">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}
              >
                <item.icon />
                <span>{item.label}</span>
              </NavLink>
            ))}
          </nav>
          <div className="sidebar-footer">
            <div className="user-profile">
              <div className="user-avatar">{initials}</div>
              <div className="user-info">
                <span className="user-name">{displayName}</span>
                <button
                  className="logout-btn"
                  onClick={() => {
                    localStorage.removeItem("access_token");
                    window.location.href = "/login";
                  }}
                >
                  Log Out
                </button>
              </div>
            </div>
          </div>
        </aside>
        <main className="main-content">
          <header className="main-header">
            <div className="topbar" ref={topbarRef}>
              <div className="topbar-left">
                <button className="app-switcher" onClick={() => setAppMenuOpen((v) => !v)}>
                  <span className="app-switcher-icon">▦</span>
                  <span>Apps</span>
                </button>
                {appMenuOpen && (
                  <div className="menu-popover">
                    <div className="menu-title">Applications</div>
                    <div className="menu-list">
                      {navItems.map((item) => (
                        <NavLink
                          key={item.to}
                          to={item.to}
                          className="menu-item"
                          onClick={() => setAppMenuOpen(false)}
                        >
                          <item.icon />
                          <span>{item.label}</span>
                        </NavLink>
                      ))}
                    </div>
                  </div>
                )}
                <div className="breadcrumb">
                  {breadcrumb.section && <span className="breadcrumb-section">{breadcrumb.section}</span>}
                  <span className="breadcrumb-sep">/</span>
                  <span className="breadcrumb-page">{breadcrumb.page}</span>
                </div>
              </div>
              <div className="topbar-right">
                <button className="user-menu" onClick={() => setUserMenuOpen((v) => !v)}>
                  <span className="user-avatar-sm">{initials}</span>
                  <span className="user-name-sm">{displayName}</span>
                </button>
                {userMenuOpen && (
                  <div className="menu-popover right">
                    <div className="menu-title">User</div>
                    <button className="menu-item" onClick={() => { window.location.href = "/settings"; }}>
                      Settings
                    </button>
                    <button
                      className="menu-item danger"
                      onClick={() => {
                        localStorage.removeItem("access_token");
                        window.location.href = "/login";
                      }}
                    >
                      Log Out
                    </button>
                  </div>
                )}
              </div>
            </div>
          </header>
          <div className="page-content">
            <Routes>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/invoices" element={<InvoicesPage />} />
              <Route path="/companies" element={<CompaniesPage />} />
              <Route path="/products" element={<ProductsPage />} />
              <Route path="/contacts" element={<ContactsPage />} />
              <Route path="/quotations" element={<QuotationsPage />} />
              <Route path="/inventory" element={<InventoryPage />} />
              <Route path="/reports" element={<ReportsPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/devices" element={<DevicesPage />} />
            </Routes>
          </div>
        </main>
      </div>
    </ListViewContext.Provider>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/portal-login" element={<PortalLoginPage />} />
      <Route
        path="/*"
        element={
          <AuthGuard>
            <AppContent />
          </AuthGuard>
        }
      />
    </Routes>
  );
}

// ... (rest of the functions: getInitials, getSavedFilters, etc.)
// ... make sure to keep them

function getInitials(name: string) {
  if (!name) return "?";
  const parts = name.split(" ");
  if (parts.length > 1) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
}

function getSavedFilters(path: string): SavedFilter[] {
  // Mock data, replace with API call
  if (path === "/companies") {
    return [
      {
        id: "active-companies",
        label: "Active Companies",
        filters: [{ id: "f1", label: "Status is Active", params: { status: "active" } }]
      },
      {
        id: "inactive-companies",
        label: "Inactive Companies",
        filters: [{ id: "f2", label: "Status is Inactive", params: { status: "inactive" } }]
      }
    ];
  }
  return [];
}

function getGroupOptions(path: string): { label: string; value: string }[] {
  if (path === "/companies") {
    return [{ label: "Status", value: "status" }];
  }
  if (path === "/devices") {
    return [
      { label: "Company", value: "company" },
      { label: "Status", value: "status" }
    ];
  }
  return [];
}

function getBreadcrumb(path: string, navItems: { to: string; label: string }[]) {
  const item = navItems.find((n) => n.to === path);
  if (!item) {
    return { section: "Home", page: "Dashboard" };
  }
  if (item.to === "/") {
    return { section: "Home", page: "Dashboard" };
  }
  const section = item.to.includes("/invoices") || item.to.includes("/quotations")
    ? "Accounting"
    : item.to.includes("/products") || item.to.includes("/contacts")
    ? "Sales"
    : "Management";
  return { section, page: item.label };
}

function getCustomFields(path: string): CustomField[] {
  if (path === "/") {
    return [
      { label: "Invoice Reference", value: "reference", type: "text", valuesEndpoint: "/invoices/values?field=reference" },
      { label: "Invoice Status", value: "status", type: "choice", valuesEndpoint: "/invoices/values?field=status" },
      { label: "Quotation Reference", value: "quotation_reference", type: "text" }
    ];
  }
  if (path === "/companies") {
    return [
      { label: "Name", value: "name", type: "text", valuesEndpoint: "/companies/values?field=name" },
      { label: "TIN", value: "tin", type: "text", valuesEndpoint: "/companies/values?field=tin" },
      { label: "VAT", value: "vat", type: "text" },
      { label: "Email", value: "email", type: "text" },
      { label: "Phone", value: "phone", type: "text" },
      { label: "Created", value: "created", type: "date" }
    ];
  }
  if (path === "/devices") {
    return [
      { label: "Serial", value: "serial", type: "text" },
      { label: "Model", value: "model", type: "text" },
      { label: "Status", value: "status", type: "choice", valuesEndpoint: "/devices/values?field=status" }
    ];
  }
  return [];
}

// --- Icon Components ---

function DashboardIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 2L2 7l10 5 10-5-10-5z" />
      <path d="M2 17l10 5 10-5" />
      <path d="M2 12l10 5 10-5" />
    </svg>
  );
}

function CompanyIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
    </svg>
  );
}

function DeviceIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
      <line x1="12" y1="18" x2="12.01" y2="18" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function ReportsIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
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
}

function ProductIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
      <line x1="3" y1="6" x2="21" y2="6" />
      <path d="M16 10a4 4 0 0 1-8 0" />
    </svg>
  );
}

function InvoiceIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  );
}

function ContactIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M17 18a2 2 0 0 0-2-2H9a2 2 0 0 0-2 2" />
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <circle cx="12" cy="10" r="2" />
      <line x1="8" y1="2" x2="8" y2="4" />
      <line x1="16" y1="2" x2="16" y2="4" />
    </svg>
  );
}

function QuoteIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
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
}

function InventoryIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
      <line x1="12" y1="22.08" x2="12" y2="12" />
    </svg>
  );
}



