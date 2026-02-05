import { Fragment, useEffect, useMemo, useState } from "react";
import { apiFetch } from "../api";
import { useMe } from "../hooks/useMe";
import { useListView } from "../context/ListViewContext";

// Icon components
const EditIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);

const TrashIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    <line x1="10" y1="11" x2="10" y2="17" />
    <line x1="14" y1="11" x2="14" y2="17" />
  </svg>
);

const PlusIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

const BuildingIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
);

const CheckIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const XIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

type Company = {
  id: number;
  name: string;
  address: string;
  email?: string;
  phone: string;
  tin: string;
  vat: string;
};

type GroupedCompanies = {
  label: string;
  items: Company[];
};

export default function CompaniesPage() {
  const { me } = useMe();
  const { state } = useListView();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({
    name: "",
    address: "",
    email: "",
    phone: "",
    tin: "",
    vat: ""
  });
  const [editForm, setEditForm] = useState({
    name: "",
    address: "",
    email: "",
    phone: "",
    tin: "",
    vat: ""
  });
  const [editPortalUserId, setEditPortalUserId] = useState<number | null>(null);
  const [editPortalEmail, setEditPortalEmail] = useState("");
  const [editPortalPassword, setEditPortalPassword] = useState("");
  const [portalEmail, setPortalEmail] = useState("");
  const [portalPassword, setPortalPassword] = useState("");

  const loadCompanies = async () => {
    const params = new URLSearchParams();
    state.filters.forEach((chip) => {
      Object.entries(chip.params).forEach(([key, value]) => {
        params.set(key, value);
      });
    });
    const query = params.toString();
    try {
      setError(null);
      if (me?.is_admin) {
        const data = await apiFetch<Company[]>(`/companies${query ? `?${query}` : ""}`);
        setCompanies(data);
      } else {
        const data = await apiFetch<Company[]>(`/companies/me${query ? `?${query}` : ""}`);
        setCompanies(data);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load companies");
    }
  };

  useEffect(() => {
    const timeout = setTimeout(() => {
      loadCompanies();
    }, 300);
    return () => clearTimeout(timeout);
  }, [me?.is_admin, state.filters]);

  const createCompany = async () => {
    if (!form.name || !form.tin) {
      setError("Company name and TIN are required");
      return;
    }
    try {
      setError(null);
      setStatus(null);
      const company = await apiFetch<Company>("/companies", {
        method: "POST",
        body: JSON.stringify(form)
      });
      let portalCreated = false;
      if (portalEmail && portalPassword) {
        try {
          const user = await apiFetch<{ id: number }>("/users", {
            method: "POST",
            body: JSON.stringify({ email: portalEmail, password: portalPassword, is_admin: false })
          });
          await apiFetch("/company-users", {
            method: "POST",
            body: JSON.stringify({ company_id: company.id, user_id: user.id, role: "portal" })
          });
          portalCreated = true;
        } catch (portalErr: any) {
          setError(`Company created but portal user failed: ${portalErr.message}`);
        }
        setPortalEmail("");
        setPortalPassword("");
      }
      setForm({ name: "", address: "", email: "", phone: "", tin: "", vat: "" });
      setShowModal(false);
      if (portalCreated) {
        setStatus(`Company "${company.name}" created successfully! Portal user can now log in at /login with email: ${portalEmail}`);
      } else if (portalEmail) {
        // Error already set above
      } else {
        setStatus("Company created successfully");
      }
      loadCompanies();
    } catch (err: any) {
      setError(err.message || "Failed to create company");
    }
  };

  const startEdit = async (company: Company) => {
    setEditingId(company.id);
    setEditForm({
      name: company.name,
      address: company.address,
      email: company.email || "",
      phone: company.phone,
      tin: company.tin,
      vat: company.vat
    });
    setEditPortalPassword("");
    try {
      const portalUsers = await apiFetch<{id: number; email: string}[]>(`/company-users/portal-users?company_id=${company.id}`);
      if (portalUsers.length) {
        setEditPortalUserId(portalUsers[0].id);
        setEditPortalEmail(portalUsers[0].email);
      } else {
        setEditPortalUserId(null);
        setEditPortalEmail("");
      }
    } catch {
      setEditPortalUserId(null);
      setEditPortalEmail("");
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({ name: "", address: "", email: "", phone: "", tin: "", vat: "" });
    setEditPortalUserId(null);
    setEditPortalEmail("");
    setEditPortalPassword("");
  };

  const saveEdit = async (companyId: number) => {
    try {
      setError(null);
      await apiFetch(`/companies/${companyId}`, {
        method: "PUT",
        body: JSON.stringify(editForm)
      });
      // Update or create portal user if email/password provided
      if (editPortalEmail && editPortalPassword) {
        await apiFetch(`/companies/${companyId}/portal-user`, {
          method: "PUT",
          body: JSON.stringify({ email: editPortalEmail, password: editPortalPassword })
        });
      } else if (editPortalUserId && editPortalPassword) {
        // Just update password for existing user
        await apiFetch(`/company-users/portal-users/${editPortalUserId}/password?password=${encodeURIComponent(editPortalPassword)}`, {
          method: "PATCH"
        });
      }
      setEditingId(null);
      setEditPortalUserId(null);
      setEditPortalEmail("");
      setEditPortalPassword("");
      setStatus("Company updated successfully");
      loadCompanies();
    } catch (err: any) {
      setError(err.message || "Failed to update company");
    }
  };

  const deleteCompany = async (companyId: number) => {
    if (!confirm("Are you sure you want to delete this company? This action cannot be undone.")) return;
    try {
      setError(null);
      await apiFetch(`/companies/${companyId}`, { method: "DELETE" });
      setStatus("Company deleted successfully");
      loadCompanies();
    } catch (err: any) {
      setError(err.message || "Failed to delete company");
    }
  };

  const groupedCompanies = useMemo<GroupedCompanies[]>(() => {
    if (!state.groupBy || state.groupBy === "") {
      return [{ label: "", items: companies }];
    }
    if (state.groupBy === "vat") {
      const hasVat = companies.filter((company) => Boolean(company.vat));
      const noVat = companies.filter((company) => !company.vat);
      return [
        { label: "Has VAT", items: hasVat },
        { label: "No VAT", items: noVat }
      ];
    }
    return [{ label: "", items: companies }];
  }, [companies, state.groupBy]);

  return (
    <div className="content">
      {/* Page Header */}
      <div className="page-header">
        <div className="page-title">
          <BuildingIcon />
          <h2>Companies</h2>
        </div>
        {me?.is_admin && (
          <button className="primary" onClick={() => setShowModal(true)}>
            <PlusIcon />
            Add Company
          </button>
        )}
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {status && <div className="alert alert-success">{status}</div>}

      {/* Add Company Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Register New Company</h3>
              <button className="icon-btn" onClick={() => setShowModal(false)}>
                <XIcon />
              </button>
            </div>
            <div className="modal-body">
              <div className="form-grid">
                <label className="input">
                  Company Name *
                  <input
                    type="text"
                    placeholder="Enter company name"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </label>
                <label className="input">
                  TIN *
                  <input
                    type="text"
                    placeholder="Tax Identification Number"
                    value={form.tin}
                    onChange={(e) => setForm({ ...form, tin: e.target.value })}
                  />
                </label>
                <label className="input">
                  VAT
                  <input
                    type="text"
                    placeholder="VAT Number"
                    value={form.vat}
                    onChange={(e) => setForm({ ...form, vat: e.target.value })}
                  />
                </label>
                <label className="input">
                  Address
                  <input
                    type="text"
                    placeholder="Company address"
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                  />
                </label>
                <label className="input">
                  Email
                  <input
                    type="email"
                    placeholder="company@example.com"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                  />
                </label>
                <label className="input">
                  Phone
                  <input
                    type="text"
                    placeholder="+263 xxx xxx xxx"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  />
                </label>
              </div>
              <div className="form-section">
                <h4>Portal Access (Optional)</h4>
                <div className="form-grid">
                  <label className="input">
                    Portal Email
                    <input
                      type="email"
                      placeholder="portal@company.com"
                      value={portalEmail}
                      onChange={(e) => setPortalEmail(e.target.value)}
                    />
                  </label>
                  <label className="input">
                    Portal Password
                    <input
                      type="password"
                      placeholder="Password"
                      value={portalPassword}
                      onChange={(e) => setPortalPassword(e.target.value)}
                    />
                  </label>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="ghost" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="primary" onClick={createCompany}>Create Company</button>
            </div>
          </div>
        </div>
      )}

      {/* Companies Table */}
      <div className="card">
        <table className="data-table">
          <thead>
            <tr>
              <th>Company Name</th>
              <th>TIN</th>
              <th>VAT</th>
              <th>Phone</th>
              <th>Email</th>
              {me?.is_admin && <th>Portal User</th>}
              {me?.is_admin && <th style={{ width: "100px", textAlign: "center" }}>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {groupedCompanies.map((group, index) => (
              <Fragment key={group.label || `group-${index}`}>
                {group.label && (
                  <tr className="table-group">
                    <td colSpan={me?.is_admin ? 6 : 5}>
                      <strong>{group.label}</strong> ({group.items.length})
                    </td>
                  </tr>
                )}
                {group.items.map((c) => (
                  <tr key={c.id}>
                    {editingId === c.id ? (
                      <>
                        <td>
                          <input
                            type="text"
                            value={editForm.name}
                            onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                            className="inline-edit"
                          />
                        </td>
                        <td>
                          <input
                            type="text"
                            value={editForm.tin}
                            onChange={(e) => setEditForm({ ...editForm, tin: e.target.value })}
                            className="inline-edit"
                          />
                        </td>
                        <td>
                          <input
                            type="text"
                            value={editForm.vat}
                            onChange={(e) => setEditForm({ ...editForm, vat: e.target.value })}
                            className="inline-edit"
                          />
                        </td>
                        <td>
                          <input
                            type="text"
                            value={editForm.phone}
                            onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                            className="inline-edit"
                          />
                        </td>
                        <td>
                          <input
                            type="email"
                            value={editForm.email}
                            onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                            className="inline-edit"
                          />
                        </td>
                        <td>
                          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                            <span style={{ fontSize: "12px", color: "var(--muted)" }}>{editPortalEmail || "No portal user"}</span>
                            {editPortalUserId && (
                              <input
                                type="password"
                                placeholder="New password"
                                value={editPortalPassword}
                                onChange={(e) => setEditPortalPassword(e.target.value)}
                                className="inline-edit"
                              />
                            )}
                          </div>
                        </td>
                        <td>
                          <div className="action-icons">
                            <button
                              className="icon-btn success"
                              onClick={() => saveEdit(c.id)}
                              title="Save"
                            >
                              <CheckIcon />
                            </button>
                            <button
                              className="icon-btn"
                              onClick={cancelEdit}
                              title="Cancel"
                            >
                              <XIcon />
                            </button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td>
                          <span className="company-name">{c.name}</span>
                        </td>
                        <td><code>{c.tin}</code></td>
                        <td>{c.vat ? <span className="badge badge-info">{c.vat}</span> : <span className="text-muted">—</span>}</td>
                        <td>{c.phone || <span className="text-muted">—</span>}</td>
                        <td>{c.email || <span className="text-muted">—</span>}</td>
                        {me?.is_admin && <td><span className="text-muted">••••••••</span></td>}
                        {me?.is_admin && (
                          <td>
                            <div className="action-icons">
                              <button
                                className="icon-btn"
                                onClick={() => startEdit(c)}
                                title="Edit company"
                              >
                                <EditIcon />
                              </button>
                              <button
                                className="icon-btn danger"
                                onClick={() => deleteCompany(c.id)}
                                title="Delete company"
                              >
                                <TrashIcon />
                              </button>
                            </div>
                          </td>
                        )}
                      </>
                    )}
                  </tr>
                ))}
              </Fragment>
            ))}
            {!companies.length && (
              <tr>
                <td colSpan={me?.is_admin ? 7 : 5} style={{ textAlign: "center", padding: "40px", color: "var(--muted)" }}>
                  <BuildingIcon />
                  <p style={{ marginTop: "8px" }}>No companies found</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
