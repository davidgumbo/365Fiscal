import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch, apiRequest } from "../api";
import { useCompanies } from "../hooks/useCompanies";

type Contact = {
  id: number;
  company_id: number;
  name: string;
  address: string;
  vat: string;
  tin: string;
  phone: string;
  email?: string;
  reference?: string;
};

export default function ContactsPage() {
  const navigate = useNavigate();
  const companies = useCompanies();
  const [companyId, setCompanyId] = useState<number | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [viewMode, setViewMode] = useState<"list" | "kanban">("list");
  const [contactTypeFilter, setContactTypeFilter] = useState<
    "all" | "personal" | "company"
  >("all");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (companies.length && companyId === null) {
      setCompanyId(companies[0].id);
    }
  }, [companies, companyId]);

  const loadContacts = async (cid: number) => {
    const data = await apiFetch<Contact[]>(`/contacts?company_id=${cid}`);
    setContacts(data);
    setSelectedIds(new Set());
  };

  useEffect(() => {
    if (companyId) {
      loadContacts(companyId);
    }
  }, [companyId]);

  const startNew = () => {
    navigate("/contacts/new");
  };

  const openContact = (contact: Contact) => {
    navigate(`/contacts/${contact.id}`);
  };

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const isCompanyContact = (contact: Contact) =>
    Boolean(
      (contact.vat && contact.vat.trim().length) ||
        (contact.tin && contact.tin.trim().length),
    );

  const filteredContacts = contacts.filter((c) => {
    if (contactTypeFilter === "all") return true;
    return contactTypeFilter === "company"
      ? isCompanyContact(c)
      : !isCompanyContact(c);
  });

  const toggleSelectAll = () => {
    const visibleIds = filteredContacts.map((c) => c.id);
    const allVisibleSelected =
      visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));
    if (allVisibleSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        visibleIds.forEach((id) => next.delete(id));
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        visibleIds.forEach((id) => next.add(id));
        return next;
      });
    }
  };

  const handleBatchDelete = async () => {
    if (selectedIds.size === 0) return;
    const confirmMsg = `Are you sure you want to delete ${selectedIds.size} contact${selectedIds.size > 1 ? "s" : ""}? This action cannot be undone.`;
    if (!window.confirm(confirmMsg)) return;
    setDeleting(true);
    try {
      await apiFetch("/contacts/batch-delete", {
        method: "POST",
        body: JSON.stringify({ ids: Array.from(selectedIds) }),
      });
      if (companyId) await loadContacts(companyId);
    } catch (err) {
      alert("Failed to delete contacts. " + (err instanceof Error ? err.message : ""));
    } finally {
      setDeleting(false);
    }
  };

  const handleExportCSV = async () => {
    if (selectedIds.size === 0) return;
    setExporting(true);
    try {
      const res = await apiRequest("/contacts/export-csv", {
        method: "POST",
        body: JSON.stringify({ ids: Array.from(selectedIds) }),
      });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "contacts_export.csv";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert("Failed to export contacts. " + (err instanceof Error ? err.message : ""));
    } finally {
      setExporting(false);
    }
  };

  const allSelected =
    filteredContacts.length > 0 &&
    filteredContacts.every((c) => selectedIds.has(c.id));
  const someSelected = selectedIds.size > 0;
  const companyCount = contacts.filter((c) => isCompanyContact(c)).length;
  const personalCount = contacts.length - companyCount;

  return (
    <div className="content">
      <div className="two-panel two-panel-left">
        <div className="o-sidebar">
          <div className="o-sidebar-section">
            <div className="o-sidebar-title">CONTACT TYPE</div>
            {[
              { key: "all", label: "ALL CONTACTS", count: contacts.length },
              { key: "personal", label: "PERSONAL", count: personalCount },
              { key: "company", label: "COMPANY", count: companyCount },
            ].map((item) => (
              <div
                key={item.key}
                className={`o-sidebar-item ${contactTypeFilter === item.key ? "active" : ""}`}
                onClick={() =>
                  setContactTypeFilter(
                    item.key as "all" | "personal" | "company",
                  )
                }
                style={{ cursor: "pointer" }}
              >
                <span
                  style={{
                    letterSpacing: "0.5px",
                    fontSize: 12,
                    fontWeight: 500,
                  }}
                >
                  {item.label}
                </span>
                <span className="o-sidebar-count">{item.count}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="form-shell">
          <div className="toolbar" style={{ marginBottom: 12 }}>
            <div className="toolbar-left">
              <h3>Customers</h3>
            </div>
            <div className="toolbar-right">
              <button className={viewMode === "list" ? "tab active" : "tab"} onClick={() => setViewMode("list")}>List</button>
              <button className={viewMode === "kanban" ? "tab active" : "tab"} onClick={() => setViewMode("kanban")}>Kanban</button>
              <button className="primary" onClick={startNew}>New</button>
            </div>
          </div>

        {/* Batch action bar */}
        {someSelected && (
          <div className="batch-action-bar">
            <span className="batch-count">{selectedIds.size} selected</span>
            <button className="batch-btn export-btn" onClick={handleExportCSV} disabled={exporting}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              {exporting ? "Exporting..." : "Export CSV"}
            </button>
            <button className="batch-btn delete-btn" onClick={handleBatchDelete} disabled={deleting}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
              {deleting ? "Deleting..." : `Delete (${selectedIds.size})`}
            </button>
            <button className="batch-btn clear-btn" onClick={() => setSelectedIds(new Set())}>
              ✕ Clear
            </button>
          </div>
        )}

        {viewMode === "list" ? (
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: 40 }}>
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleSelectAll}
                    className="batch-checkbox"
                  />
                </th>
                <th>Name</th>
                {contactTypeFilter !== "personal" && <th>VAT</th>}
                {contactTypeFilter !== "personal" && <th>TIN</th>}
                <th>Phone</th>
                <th>Email</th>
              </tr>
            </thead>
            <tbody>
              {filteredContacts.map((c) => (
                <tr key={c.id} className={selectedIds.has(c.id) ? "row-selected" : ""}>
                  <td style={{ width: 40 }} onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selectedIds.has(c.id)}
                      onChange={() => toggleSelect(c.id)}
                      className="batch-checkbox"
                    />
                  </td>
                  <td onClick={() => openContact(c)} style={{ cursor: "pointer" }}>{c.name}</td>
                  {contactTypeFilter !== "personal" && (
                    <td onClick={() => openContact(c)} style={{ cursor: "pointer" }}>{c.vat}</td>
                  )}
                  {contactTypeFilter !== "personal" && (
                    <td onClick={() => openContact(c)} style={{ cursor: "pointer" }}>{c.tin}</td>
                  )}
                  <td onClick={() => openContact(c)} style={{ cursor: "pointer" }}>{c.phone}</td>
                  <td onClick={() => openContact(c)} style={{ cursor: "pointer" }}>{c.email}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="card-grid">
            {filteredContacts.map((c) => (
              <div
                key={c.id}
                className={`card ${selectedIds.has(c.id) ? "card-selected" : ""}`}
                style={{ cursor: "pointer", position: "relative" }}
              >
                <div
                  style={{ position: "absolute", top: 10, left: 10 }}
                  onClick={(e) => { e.stopPropagation(); toggleSelect(c.id); }}
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.has(c.id)}
                    onChange={() => toggleSelect(c.id)}
                    className="batch-checkbox"
                  />
                </div>
                <div onClick={() => openContact(c)} style={{ display: "flex", alignItems: "center", gap: 12, paddingLeft: 28 }}>
                  <div className="user-avatar-small">{(c.name || "?").slice(0,1).toUpperCase()}</div>
                  <div>
                    <div style={{ fontWeight: 600 }}>{c.name}</div>
                    <div style={{ fontSize: 12, color: "var(--muted)" }}>{c.email || c.phone}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        </div>
      </div>
    </div>
  );
}
