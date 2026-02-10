import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../api";
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

  useEffect(() => {
    if (companies.length && companyId === null) {
      setCompanyId(companies[0].id);
    }
  }, [companies, companyId]);

  const loadContacts = async (cid: number) => {
    const data = await apiFetch<Contact[]>(`/contacts?company_id=${cid}`);
    setContacts(data);
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

  return (
    <div className="content">
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
        {viewMode === "list" ? (
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>VAT</th>
                <th>TIN</th>
                <th>Phone</th>
                <th>Email</th>
              </tr>
            </thead>
            <tbody>
              {contacts.map((c) => (
                <tr key={c.id} onClick={() => openContact(c)}>
                  <td>{c.name}</td>
                  <td>{c.vat}</td>
                  <td>{c.tin}</td>
                  <td>{c.phone}</td>
                  <td>{c.email}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="card-grid">
            {contacts.map((c) => (
              <div key={c.id} className="card" style={{ cursor: "pointer" }} onClick={() => openContact(c)}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
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
  );
}