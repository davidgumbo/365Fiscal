import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, CalendarDays, Pencil, Users } from "lucide-react";
import { apiFetch, apiRequest } from "../api";
import { useMe } from "../hooks/useMe";
import { useCompanies, Company } from "../hooks/useCompanies";
import { useAlert } from "../context/AlertContext";

type Subscription = {
  id: number;
  company_id: number;
  plan: string;
  status: string;
  starts_at: string | null;
  expires_at: string | null;
  max_users: number;
  max_devices: number;
  max_invoices_per_month: number;
  notes: string;
  created_at: string | null;
};

type ActivationCode = {
  id: number;
  code: string;
  company_id: number;
  plan: string;
  duration_days: number;
  max_users: number;
  max_devices: number;
  max_invoices_per_month: number;
  is_used: boolean;
  used_by_user_id: number | null;
  used_at: string | null;
  expires_at: string | null;
  created_at: string | null;
};

const PLANS = [
  { value: "trial", label: "Trial", color: "var(--slate-500)" },
  { value: "starter", label: "Starter", color: "var(--blue-500)" },
  { value: "professional", label: "Professional", color: "var(--violet-500)" },
  { value: "enterprise", label: "Enterprise", color: "var(--amber-500)" },
];

const STATUS_COLORS: Record<string, string> = {
  active: "var(--emerald-500)",
  expired: "var(--red-500)",
  suspended: "var(--amber-500)",
};

const fmtDate = (d: string | null) => {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const daysRemaining = (d: string | null) => {
  if (!d) return null;
  const diff = Math.ceil((new Date(d).getTime() - Date.now()) / 86400000);
  return diff;
};

const SUBSCRIPTION_DEFAULTS = {
  max_devices: 2,
  max_invoices_per_month: 500,
};

export default function SubscriptionsPage() {
  const navigate = useNavigate();
  const { me } = useMe();
  const { companies: allCompanies, loading: companiesLoading } = useCompanies();
  const isAdmin = Boolean(me?.is_admin);
  const { showConfirm } = useAlert();

  // Company selection (admin-first flow)
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(
    null,
  );
  const [companyQuery, setCompanyQuery] = useState("");
  const companyId = selectedCompanyId;

  // Portal users auto-select their first company
  useEffect(() => {
    if (!isAdmin && me?.company_ids?.length && !selectedCompanyId) {
      setSelectedCompanyId(me.company_ids[0]);
    }
  }, [isAdmin, me?.company_ids, selectedCompanyId]);

  const filteredCompanies = useMemo(() => {
    if (!companyQuery.trim()) return allCompanies;
    const q = companyQuery.toLowerCase();
    return allCompanies.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.tin && c.tin.toLowerCase().includes(q)) ||
        (c.vat && c.vat.toLowerCase().includes(q)),
    );
  }, [allCompanies, companyQuery]);

  const company = allCompanies.find((c) => c.id === selectedCompanyId) ?? null;

  // Data
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [codes, setCodes] = useState<ActivationCode[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [tab, setTab] = useState<"subscription" | "codes">("subscription");

  // Create/Edit subscription form
  const [showSubForm, setShowSubForm] = useState(false);
  const [showEditSubForm, setShowEditSubForm] = useState(false);
  const [subForm, setSubForm] = useState({
    plan: "starter",
    status: "active",
    duration_days: 365,
    expires_at: "",
    max_users: 5,
    max_devices: SUBSCRIPTION_DEFAULTS.max_devices,
    max_invoices_per_month: SUBSCRIPTION_DEFAULTS.max_invoices_per_month,
    notes: "",
  });

  // Generate code form
  const [showCodeForm, setShowCodeForm] = useState(false);
  const [codeForm, setCodeForm] = useState({
    plan: "starter",
    duration_days: 365,
    max_users: 5,
    max_devices: SUBSCRIPTION_DEFAULTS.max_devices,
    max_invoices_per_month: SUBSCRIPTION_DEFAULTS.max_invoices_per_month,
  });

  // Generated code modal
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!selectedCompanyId) return;
    loadData();
  }, [selectedCompanyId]);

  const loadData = async () => {
    if (!selectedCompanyId) return;
    setLoading(true);
    setError("");
    try {
      const [subs, activationCodes] = await Promise.all([
        apiFetch<Subscription[]>(
          `/subscriptions?company_id=${selectedCompanyId}`,
        ),
        apiFetch<ActivationCode[]>(
          `/subscriptions/codes?company_id=${selectedCompanyId}`,
        ),
      ]);
      setSubscriptions(subs);
      setCodes(activationCodes);
    } catch (err: any) {
      setError(err.message || "Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const currentSub = subscriptions[0] ?? null;

  const handleCreateSubscription = async () => {
    if (!selectedCompanyId) return;
    setError("");
    setSuccess("");
    try {
      await apiFetch("/subscriptions", {
        method: "POST",
        body: JSON.stringify({
          company_id: selectedCompanyId,
          ...subForm,
        }),
      });
      setShowSubForm(false);
      setSuccess("Subscription created.");
      loadData();
    } catch (err: any) {
      setError(err.message || "Failed to create subscription");
    }
  };

  const handleUpdateSubscription = async (updates: Record<string, any>) => {
    if (!currentSub) return;
    setError("");
    setSuccess("");
    try {
      await apiFetch(`/subscriptions/${currentSub.id}`, {
        method: "PATCH",
        body: JSON.stringify(updates),
      });
      setShowEditSubForm(false);
      setSuccess("Subscription updated.");
      loadData();
    } catch (err: any) {
      setError(err.message || "Failed to update subscription");
    }
  };

  const handleDeleteSubscription = async () => {
    if (!currentSub) return;
    const confirmed = await showConfirm({
      title: "Delete subscription",
      message: "Delete this subscription? This cannot be undone.",
      variant: "warning",
      confirmLabel: "Delete",
    });
    if (!confirmed) return;
    try {
      await apiRequest(`/subscriptions/${currentSub.id}`, { method: "DELETE" });
      setSuccess("Subscription deleted.");
      loadData();
    } catch (err: any) {
      setError(err.message || "Failed to delete");
    }
  };

  const handleGenerateCode = async () => {
    if (!selectedCompanyId) return;
    setError("");
    setSuccess("");
    try {
      const result = await apiFetch<ActivationCode>(
        "/subscriptions/generate-code",
        {
          method: "POST",
          body: JSON.stringify({
            company_id: selectedCompanyId,
            ...codeForm,
          }),
        },
      );
      setGeneratedCode(result.code);
      setCopied(false);
      setShowCodeForm(false);
      loadData();
    } catch (err: any) {
      setError(err.message || "Failed to generate code");
    }
  };

  const handleDeleteCode = async (codeId: number) => {
    const confirmed = await showConfirm({
      title: "Delete activation code",
      message: "Delete this activation code?",
      variant: "warning",
      confirmLabel: "Delete",
    });
    if (!confirmed) return;
    try {
      await apiRequest(`/subscriptions/codes/${codeId}`, { method: "DELETE" });
      setSuccess("Activation code deleted.");
      loadData();
    } catch (err: any) {
      setError(err.message || "Failed to delete code");
    }
  };

  const openEditSubscription = () => {
    if (!currentSub) return;
    setError("");
    setSuccess("");
    setShowEditSubForm(true);
      setSubForm({
        plan: currentSub.plan,
        status: currentSub.status,
        duration_days:
          currentSub.starts_at && currentSub.expires_at
          ? Math.max(
              1,
              Math.round(
                (new Date(currentSub.expires_at).getTime() -
                  new Date(currentSub.starts_at).getTime()) /
                  86400000,
              ),
            )
          : 365,
        expires_at: currentSub.expires_at
          ? new Date(currentSub.expires_at).toISOString().slice(0, 10)
          : "",
        max_users: currentSub.max_users,
        max_devices: currentSub.max_devices,
        max_invoices_per_month: currentSub.max_invoices_per_month,
      notes: currentSub.notes || "",
    });
  };

  const handleNotifyPortalUser = async () => {
    if (!currentSub) return;
    setError("");
    setSuccess("");
    try {
      const result = await apiFetch<{ status: string; detail: string }>(
        `/subscriptions/${currentSub.id}/notify-portal-user`,
        { method: "POST" },
      );
      setSuccess(result.detail || "Portal user notified.");
    } catch (err: any) {
      setError(err.message || "Failed to notify portal user");
    }
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const goBackToCompanies = () => {
    setSelectedCompanyId(null);
    setSubscriptions([]);
    setCodes([]);
    navigate("/subscriptions");
  };

  if (companiesLoading && !companyId) {
    return <div className="loading-indicator">Loading companies...</div>;
  }
  if (!isAdmin && !companyId && allCompanies.length) {
    return <div className="loading-indicator">Loading companies...</div>;
  }

  // ─── Admin company selection view ───
  if (!selectedCompanyId) {
    return (
      <div className="content">
        <div
          className="o-control-panel"
          style={{
            display: "flex",
            width: "auto",
            justifyContent: "space-between",
            marginBottom: 24,
          }}
        >
          <div className="o-breadcrumb">
            <span className="o-breadcrumb-current">Subscriptions</span>
          </div>
          <div className="settings-search" style={{ width: "20vw" }}>
            <input
              type="text"
              placeholder="Search company by name, VAT, or TIN"
              value={companyQuery}
              onChange={(e) => setCompanyQuery(e.target.value)}
            />
          </div>
        </div>
        <p style={{ color: "var(--muted)", marginBottom: 20, fontSize: 14 }}>
          Select a company to manage its subscription.
        </p>
        <div className="device-company-grid">
          {filteredCompanies.map((c) => {
            return (
              <button
                key={c.id}
                className="device-company-card"
                onClick={() => setSelectedCompanyId(c.id)}
              >
                <div className="device-company-icon">
                  <svg
                    width="36"
                    height="36"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect x="4" y="2" width="16" height="20" rx="2" ry="2" />
                    <path d="M9 22v-4h6v4" />
                    <line x1="8" y1="6" x2="8" y2="6.01" />
                    <line x1="16" y1="6" x2="16" y2="6.01" />
                    <line x1="12" y1="6" x2="12" y2="6.01" />
                    <line x1="8" y1="10" x2="8" y2="10.01" />
                    <line x1="16" y1="10" x2="16" y2="10.01" />
                    <line x1="12" y1="10" x2="12" y2="10.01" />
                    <line x1="8" y1="14" x2="8" y2="14.01" />
                    <line x1="16" y1="14" x2="16" y2="14.01" />
                    <line x1="12" y1="14" x2="12" y2="14.01" />
                  </svg>
                </div>
                <div className="device-company-info">
                  <div className="device-company-name">{c.name}</div>
                  {c.tin && (
                    <div className="device-company-detail">TIN: {c.tin}</div>
                  )}
                  {c.vat && (
                    <div className="device-company-detail">VAT: {c.vat}</div>
                  )}
                </div>
                <div className="device-company-arrow">
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </div>
              </button>
            );
          })}
          {!filteredCompanies.length && (
            <div
              style={{
                gridColumn: "1 / -1",
                textAlign: "center",
                padding: 40,
                color: "var(--muted)",
              }}
            >
              {companyQuery.trim()
                ? "No companies match your search."
                : "No companies found."}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─── Subscription management view ───
  const days = currentSub ? daysRemaining(currentSub.expires_at) : null;
  const planInfo = PLANS.find((p) => p.value === currentSub?.plan);

  return (
    <div className="content" style={{ margin: "0 auto" }}>
      {/* Breadcrumb */}
      <div
        className="o-control-panel"
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: 16,
        }}
      >
        <div className="o-breadcrumb">
          <span
            className="o-breadcrumb-item"
            style={{ cursor: "pointer" }}
            onClick={goBackToCompanies}
          >
            Subscriptions
          </span>
          <span className="o-breadcrumb-separator">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </span>
          <span className="o-breadcrumb-current">
            {company?.name || "Company"}
          </span>
        </div>
      </div>

      {error && (
        <div
          className="alert alert-danger"
          style={{
            marginBottom: 16,
            padding: "10px 16px",
            borderRadius: 8,
            background: "var(--red-50)",
            color: "var(--red-600)",
            border: "1px solid var(--red-200)",
          }}
        >
          {error}
          <button
            onClick={() => setError("")}
            style={{
              float: "right",
              background: "none",
              border: "none",
              cursor: "pointer",
              fontWeight: 700,
            }}
          >
            ×
          </button>
        </div>
      )}

      {success && (
        <div
          className="alert alert-success"
          style={{
            marginBottom: 16,
            padding: "10px 16px",
            borderRadius: 8,
            background: "var(--emerald-50)",
            color: "var(--emerald-700)",
            border: "1px solid var(--emerald-200)",
          }}
        >
          {success}
          <button
            onClick={() => setSuccess("")}
            style={{
              float: "right",
              background: "none",
              border: "none",
              cursor: "pointer",
              fontWeight: 700,
            }}
          >
            ×
          </button>
        </div>
      )}

      {/* Generated code modal */}
      {generatedCode && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
          }}
        >
          <div
            style={{
              background: "var(--bg-card)",
              borderRadius: 16,
              padding: 40,
              textAlign: "center",
              maxWidth: 440,
              width: "90%",
            }}
          >
            <div
              style={{ fontSize: 14, color: "var(--muted)", marginBottom: 8 }}
            >
              Activation Code Generated
            </div>
            <div
              style={{
                fontSize: 28,
                fontWeight: 800,
                letterSpacing: 3,
                fontFamily: "monospace",
                color: "var(--violet-600)",
                margin: "16px 0",
                userSelect: "all",
              }}
            >
              {generatedCode}
            </div>
            <p
              style={{ fontSize: 13, color: "var(--muted)", marginBottom: 20 }}
            >
              Share this code with the portal user.
            </p>
            <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
              <button
                className="o-btn o-btn-primary"
                onClick={() => copyCode(generatedCode)}
              >
                {copied ? "✓ Copied!" : "Copy Code"}
              </button>
              <button
                className="o-btn o-btn-secondary"
                onClick={() => setGeneratedCode(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div
        style={{
          display: "flex",
          gap: 0,
          borderBottom: "2px solid var(--border)",
          marginBottom: 24,
        }}
      >
        {(["subscription", "codes"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: "10px 24px",
              fontSize: 13,
              fontWeight: tab === t ? 700 : 500,
              color: tab === t ? "var(--violet-600)" : "var(--muted)",
              background: "none",
              border: "none",
              borderBottom:
                tab === t
                  ? "2px solid var(--violet-600)"
                  : "2px solid transparent",
              cursor: "pointer",
              textTransform: "uppercase",
              letterSpacing: 0.5,
              marginBottom: -2,
            }}
          >
            {t === "subscription"
              ? "Subscription"
              : `Activation Codes (${codes.length})`}
          </button>
        ))}
      </div>

      {loading && (
        <div
          style={{ textAlign: "center", padding: 40, color: "var(--muted)" }}
        >
          Loading...
        </div>
      )}

      {/* ─── Subscription tab ─── */}
      {!loading && tab === "subscription" && (
        <div>
          {currentSub ? (
            <div
              style={{
                background: "var(--bg-card)",
                borderRadius: 18,
                border: "1px solid var(--border)",
                overflow: "hidden",
                boxShadow: "0 14px 34px rgba(15, 23, 42, 0.06)",
              }}
            >
              {/* Header */}
              <div
                style={{
                  padding: "28px 32px 22px",
                  borderBottom: "1px solid var(--border)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  gap: 24,
                  background:
                    "linear-gradient(180deg, rgba(99, 102, 241, 0.06) 0%, rgba(255, 255, 255, 0) 100%)",
                }}
              >
                <div>
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 12 }}
                  >
                    <span
                      style={{
                        fontSize: 22,
                        fontWeight: 800,
                        color: planInfo?.color || "var(--fg)",
                      }}
                    >
                      {planInfo?.label || currentSub.plan}
                    </span>
                    <span
                      style={{
                        display: "inline-block",
                        padding: "3px 12px",
                        borderRadius: 20,
                        fontSize: 11,
                        fontWeight: 700,
                        textTransform: "uppercase",
                        color: "white",
                        background:
                          STATUS_COLORS[currentSub.status] ||
                          "var(--slate-500)",
                      }}
                  >
                    {currentSub.status}
                  </span>
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  {days !== null && (
                    <div
                      style={{
                        fontSize: 28,
                        fontWeight: 800,
                        color:
                          days <= 30
                            ? "var(--red-500)"
                            : days <= 90
                              ? "var(--amber-500)"
                              : "var(--emerald-500)",
                      }}
                    >
                      {days > 0 ? days : 0}
                    </div>
                  )}
                  <div style={{ fontSize: 11, color: "var(--muted)" }}>
                    days remaining
                  </div>
                </div>
              </div>

              {/* Details grid */}
              <div
                style={{
                  padding: "24px 32px",
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                  gap: 16,
                }}
              >
                {[
                  {
                    label: "Start Date",
                    value: fmtDate(currentSub.starts_at),
                    icon: CalendarDays,
                  },
                  {
                    label: "Expiry Date",
                    value: fmtDate(currentSub.expires_at),
                    icon: CalendarDays,
                  },
                  {
                    label: "Max Users",
                    value: String(currentSub.max_users),
                    icon: Users,
                  },
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <div
                      key={item.label}
                      style={{
                        border: "1px solid var(--border)",
                        borderRadius: 16,
                        padding: "16px 18px",
                        background: "rgba(255,255,255,0.92)",
                      }}
                    >
                      <div
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: 12,
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          background: "rgba(99, 102, 241, 0.08)",
                          color: "var(--violet-600)",
                          marginBottom: 12,
                        }}
                      >
                        <Icon size={18} />
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          color: "var(--muted)",
                          textTransform: "uppercase",
                          letterSpacing: 0.5,
                          marginBottom: 6,
                        }}
                      >
                        {item.label}
                      </div>
                      <div style={{ fontSize: 20, fontWeight: 700 }}>
                        {item.value}
                      </div>
                    </div>
                  );
                })}
              </div>
              {currentSub.notes && (
                <div
                  style={{
                    padding: "0 32px 22px",
                    fontSize: 13,
                    color: "var(--muted)",
                  }}
                >
                  <strong>Notes:</strong> {currentSub.notes}
                </div>
              )}

              {/* Actions */}
              <div
                style={{
                  padding: "18px 32px",
                  borderTop: "1px solid var(--border)",
                  display: "flex",
                  gap: 8,
                  flexWrap: "wrap",
                  background: "var(--slate-50, #f8fafc)",
                }}
              >
                <button
                  className="o-btn o-btn-secondary"
                  onClick={openEditSubscription}
                >
                  <Pencil size={14} style={{ marginRight: 6 }} />
                  Edit Subscription
                </button>
                <button
                  className="o-btn o-btn-secondary"
                  onClick={handleNotifyPortalUser}
                >
                  <Bell size={14} style={{ marginRight: 6 }} />
                  Notify Portal User
                </button>
                {currentSub.status === "active" && (
                  <button
                    className="o-btn o-btn-secondary"
                    onClick={() =>
                      handleUpdateSubscription({ status: "suspended" })
                    }
                  >
                    Suspend
                  </button>
                )}
                {currentSub.status === "suspended" && (
                  <button
                    className="o-btn o-btn-primary"
                    onClick={() =>
                      handleUpdateSubscription({ status: "active" })
                    }
                  >
                    Reactivate
                  </button>
                )}
                {currentSub.status === "expired" && (
                  <button
                    className="o-btn o-btn-primary"
                    onClick={() => {
                      const newExpiry = new Date(
                        Date.now() + 365 * 86400000,
                      ).toISOString();
                      handleUpdateSubscription({
                        status: "active",
                        expires_at: newExpiry,
                      });
                    }}
                  >
                    Renew (1 Year)
                  </button>
                )}
                <button
                  className="o-btn"
                  style={{
                    color: "var(--red-500)",
                    border: "1px solid var(--red-200)",
                  }}
                  onClick={handleDeleteSubscription}
                >
                  Delete Subscription
                </button>
              </div>
            </div>
          ) : (
            <div
              style={{
                textAlign: "center",
                padding: 60,
                background: "var(--bg-card)",
                borderRadius: 12,
                border: "1px solid var(--border)",
              }}
            >
              <svg
                width="48"
                height="48"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--muted)"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ marginBottom: 16, opacity: 0.5 }}
              >
                <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
              </svg>
              <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
                No Subscription
              </div>
              <p
                style={{
                  color: "var(--muted)",
                  fontSize: 13,
                  marginBottom: 20,
                }}
              >
                This company doesn't have a subscription yet. Create one or
                generate an activation code.
              </p>
              <div
                style={{ display: "flex", gap: 8, justifyContent: "center" }}
              >
                <button
                  className="o-btn o-btn-primary"
                  onClick={() => setShowSubForm(true)}
                >
                  Create Subscription
                </button>
                <button
                  className="o-btn o-btn-secondary"
                  onClick={() => {
                    setTab("codes");
                    setShowCodeForm(true);
                  }}
                >
                  Generate Code
                </button>
              </div>
            </div>
          )}

          {/* Create subscription form */}
          {showSubForm && (
            <div
              style={{
                marginTop: 24,
                background: "var(--bg-card)",
                borderRadius: 12,
                border: "1px solid var(--border)",
                padding: 28,
              }}
            >
              <h4 style={{ margin: "0 0 20px", fontWeight: 700 }}>
                Create Subscription
              </h4>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 16,
                }}
              >
                <div>
                  <label
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      display: "block",
                      marginBottom: 4,
                    }}
                  >
                    Plan
                  </label>
                  <select
                    className="form-control"
                    value={subForm.plan}
                    onChange={(e) =>
                      setSubForm({ ...subForm, plan: e.target.value })
                    }
                  >
                    {PLANS.filter((p) => p.value !== "trial").map((p) => (
                      <option key={p.value} value={p.value}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      display: "block",
                      marginBottom: 4,
                    }}
                  >
                    Duration (days)
                  </label>
                  <input
                    className="form-control"
                    type="number"
                    value={subForm.duration_days}
                    onChange={(e) =>
                      setSubForm({ ...subForm, duration_days: +e.target.value })
                    }
                  />
                </div>
                <div>
                  <label
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      display: "block",
                      marginBottom: 4,
                    }}
                  >
                    Max Users
                  </label>
                  <input
                    className="form-control"
                    type="number"
                    value={subForm.max_users}
                    onChange={(e) =>
                      setSubForm({ ...subForm, max_users: +e.target.value })
                    }
                  />
                </div>
                <div>
                  <label
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      display: "block",
                      marginBottom: 4,
                    }}
                  >
                    Notes
                  </label>
                  <input
                    className="form-control"
                    value={subForm.notes}
                    onChange={(e) =>
                      setSubForm({ ...subForm, notes: e.target.value })
                    }
                  />
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
                <button
                  className="o-btn o-btn-primary"
                  onClick={handleCreateSubscription}
                >
                  Create
                </button>
                <button
                  className="o-btn o-btn-secondary"
                  onClick={() => setShowSubForm(false)}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {showEditSubForm && currentSub && (
            <div
              style={{
                position: "fixed",
                inset: 0,
                zIndex: 9999,
                background: "rgba(15, 23, 42, 0.42)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 24,
              }}
            >
              <div
                style={{
                  width: "min(760px, 100%)",
                  maxHeight: "90vh",
                  overflowY: "auto",
                  background: "var(--bg-card)",
                  borderRadius: 18,
                  border: "1px solid var(--border)",
                  boxShadow: "0 24px 60px rgba(15, 23, 42, 0.22)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "22px 24px 16px",
                    borderBottom: "1px solid var(--border)",
                  }}
                >
                  <h4 style={{ margin: 0, fontWeight: 700, fontSize: 22 }}>
                    Edit Subscription
                  </h4>
                  <button
                    className="o-btn o-btn-secondary"
                    onClick={() => setShowEditSubForm(false)}
                    style={{ minWidth: 0, padding: "8px 12px" }}
                  >
                    Close
                  </button>
                </div>
                <div style={{ padding: 24 }}>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: 16,
                    }}
                  >
                    <div>
                      <label
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          display: "block",
                          marginBottom: 4,
                        }}
                      >
                        Plan
                      </label>
                      <select
                        className="form-control"
                        value={subForm.plan}
                        onChange={(e) =>
                          setSubForm({ ...subForm, plan: e.target.value })
                        }
                      >
                        {PLANS.filter((p) => p.value !== "trial").map((p) => (
                          <option key={p.value} value={p.value}>
                            {p.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          display: "block",
                          marginBottom: 4,
                        }}
                      >
                        Status
                      </label>
                      <select
                        className="form-control"
                        value={subForm.status}
                        onChange={(e) =>
                          setSubForm({ ...subForm, status: e.target.value })
                        }
                      >
                        <option value="active">Active</option>
                        <option value="suspended">Suspended</option>
                        <option value="expired">Expired</option>
                      </select>
                    </div>
                    <div>
                      <label
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          display: "block",
                          marginBottom: 4,
                        }}
                      >
                        Expiry Date
                      </label>
                      <input
                        className="form-control"
                        type="date"
                        value={subForm.expires_at}
                        onChange={(e) =>
                          setSubForm({ ...subForm, expires_at: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <label
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          display: "block",
                          marginBottom: 4,
                        }}
                      >
                        Max Users
                      </label>
                      <input
                        className="form-control"
                        type="number"
                        min={1}
                        value={subForm.max_users}
                        onChange={(e) =>
                          setSubForm({ ...subForm, max_users: +e.target.value })
                        }
                      />
                    </div>
                    <div style={{ gridColumn: "1 / -1" }}>
                      <label
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          display: "block",
                          marginBottom: 4,
                        }}
                      >
                        Notes
                      </label>
                      <textarea
                        className="form-control"
                        rows={4}
                        value={subForm.notes}
                        onChange={(e) =>
                          setSubForm({ ...subForm, notes: e.target.value })
                        }
                      />
                    </div>
                  </div>
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "flex-end",
                    gap: 8,
                    padding: "16px 24px 24px",
                    borderTop: "1px solid var(--border)",
                  }}
                >
                  <button
                    className="o-btn o-btn-secondary"
                    onClick={() => setShowEditSubForm(false)}
                  >
                    Cancel
                  </button>
                  <button
                    className="o-btn o-btn-primary"
                    onClick={() => {
                      handleUpdateSubscription({
                        plan: subForm.plan,
                        status: subForm.status,
                        max_users: subForm.max_users,
                        notes: subForm.notes,
                        expires_at: subForm.expires_at
                          ? new Date(
                              `${subForm.expires_at}T23:59:59`,
                            ).toISOString()
                          : currentSub.expires_at,
                      });
                    }}
                  >
                    Save
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── Activation codes tab ─── */}
      {!loading && tab === "codes" && (
        <div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 16,
            }}
          >
            <div style={{ fontSize: 13, color: "var(--muted)" }}>
              {codes.length} code(s) generated for this company
            </div>
            <button
              className="o-btn o-btn-primary"
              onClick={() => setShowCodeForm(true)}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ marginRight: 6 }}
              >
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Generate Code
            </button>
          </div>

          {/* Generate code form */}
          {showCodeForm && (
            <div
              style={{
                marginBottom: 20,
                background: "var(--bg-card)",
                borderRadius: 12,
                border: "1px solid var(--violet-200)",
                padding: 24,
              }}
            >
              <h4 style={{ margin: "0 0 16px", fontWeight: 700, fontSize: 15 }}>
                Generate Activation Code
              </h4>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr 1fr",
                  gap: 12,
                }}
              >
                <div>
                  <label
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      display: "block",
                      marginBottom: 4,
                    }}
                  >
                    Plan
                  </label>
                  <select
                    className="form-control form-control-sm"
                    value={codeForm.plan}
                    onChange={(e) =>
                      setCodeForm({ ...codeForm, plan: e.target.value })
                    }
                  >
                    {PLANS.filter((p) => p.value !== "trial").map((p) => (
                      <option key={p.value} value={p.value}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      display: "block",
                      marginBottom: 4,
                    }}
                  >
                    Duration (days)
                  </label>
                  <input
                    className="form-control form-control-sm"
                    type="number"
                    value={codeForm.duration_days}
                    onChange={(e) =>
                      setCodeForm({
                        ...codeForm,
                        duration_days: +e.target.value,
                      })
                    }
                  />
                </div>
                <div>
                  <label
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      display: "block",
                      marginBottom: 4,
                    }}
                  >
                    Max Users
                  </label>
                  <input
                    className="form-control form-control-sm"
                    type="number"
                    value={codeForm.max_users}
                    onChange={(e) =>
                      setCodeForm({ ...codeForm, max_users: +e.target.value })
                    }
                  />
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                <button
                  className="o-btn o-btn-primary"
                  onClick={handleGenerateCode}
                >
                  Generate
                </button>
                <button
                  className="o-btn o-btn-secondary"
                  onClick={() => setShowCodeForm(false)}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Codes table */}
          {codes.length > 0 ? (
            <div
              style={{
                background: "var(--bg-card)",
                borderRadius: 12,
                border: "1px solid var(--border)",
                overflow: "hidden",
              }}
            >
              <table
                className="o-table"
                style={{ width: "100%", fontSize: 13 }}
              >
                <thead>
                  <tr>
                    <th style={{ padding: "10px 16px" }}>Code</th>
                    <th>Plan</th>
                    <th>Duration</th>
                    <th>Status</th>
                    <th>Created</th>
                    <th style={{ width: 40 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {codes.map((c) => (
                    <tr
                      key={c.id}
                      style={{ borderTop: "1px solid var(--border)" }}
                    >
                      <td
                        style={{
                          padding: "10px 16px",
                          fontFamily: "monospace",
                          fontWeight: 700,
                          letterSpacing: 1,
                          fontSize: 12,
                        }}
                      >
                        <span
                          style={{
                            cursor: "pointer",
                            color: "var(--violet-600)",
                          }}
                          title="Click to copy"
                          onClick={() => {
                            navigator.clipboard.writeText(c.code);
                          }}
                        >
                          {c.code}
                        </span>
                      </td>
                      <td>
                        {PLANS.find((p) => p.value === c.plan)?.label || c.plan}
                      </td>
                      <td>{c.duration_days} days</td>
                      <td>
                        {c.is_used ? (
                          <span
                            style={{
                              color: "var(--emerald-600)",
                              fontWeight: 600,
                              fontSize: 11,
                            }}
                          >
                            ✓ Used {c.used_at ? fmtDate(c.used_at) : ""}
                          </span>
                        ) : c.expires_at &&
                          new Date(c.expires_at) < new Date() ? (
                          <span
                            style={{
                              color: "var(--red-500)",
                              fontWeight: 600,
                              fontSize: 11,
                            }}
                          >
                            Expired
                          </span>
                        ) : (
                          <span
                            style={{
                              color: "var(--blue-500)",
                              fontWeight: 600,
                              fontSize: 11,
                            }}
                          >
                            Available
                          </span>
                        )}
                      </td>
                      <td style={{ fontSize: 12 }}>{fmtDate(c.created_at)}</td>
                      <td>
                        {!c.is_used && (
                          <button
                            onClick={() => handleDeleteCode(c.id)}
                            style={{
                              background: "none",
                              border: "none",
                              cursor: "pointer",
                              color: "var(--red-400)",
                              padding: 4,
                            }}
                          >
                            <svg
                              width="14"
                              height="14"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                            >
                              <polyline points="3 6 5 6 21 6" />
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                            </svg>
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            !showCodeForm && (
              <div
                style={{
                  textAlign: "center",
                  padding: 40,
                  color: "var(--muted)",
                }}
              >
                No activation codes generated yet.
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}
