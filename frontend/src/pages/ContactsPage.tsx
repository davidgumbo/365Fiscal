import { useEffect, useState } from "react";
import { apiFetch } from "../api";
import { useCompanies, Company } from "../hooks/useCompanies";

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
  const companies = useCompanies();
  const [companyId, setCompanyId] = useState<number | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedContactId, setSelectedContactId] = useState<number | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState({
    name: "",
    address: "",
    vat: "",
    tin: "",
    phone: "",
    email: "",
    reference: ""
  });

  useEffect(() => {
    if (companies.length && companyId === null) {
      setCompanyId(companies[0].id);
    }
  }, [companies, companyId]);

  const loadContacts = async (cid: number) => {
    const data = await apiFetch<Contact[]>(`/contacts?company_id=${cid}`);
    setContacts(data);
    if (data.length && selectedContactId === null) {
      setSelectedContactId(data[0].id);
      const first = data[0];
      setForm({
        name: first.name,
        address: first.address || "",
        vat: first.vat || "",
        tin: first.tin || "",
        phone: first.phone || "",
        email: first.email || "",
        reference: first.reference || ""
      });
    }
  };

  useEffect(() => {
    if (companyId) {
      loadContacts(companyId);
    }
  }, [companyId]);

  const createContact = async () => {
    if (!companyId) return;
    await apiFetch<Contact>("/contacts", {
      method: "POST",
      body: JSON.stringify({ ...form, company_id: companyId })
    });
    setForm({ name: "", address: "", vat: "", tin: "", phone: "", email: "", reference: "" });
    loadContacts(companyId);
  };

  const updateContact = async () => {
    if (!selectedContactId) return;
    await apiFetch<Contact>(`/contacts/${selectedContactId}`, {
      method: "PATCH",
      body: JSON.stringify(form)
    });
    loadContacts(companyId!);
  };

  const startNew = () => {
    setSelectedContactId(null);
    setForm({ name: "", address: "", vat: "", tin: "", phone: "", email: "", reference: "" });
    setIsEditing(true);
  };

  const selectContact = (contact: Contact) => {
    setSelectedContactId(contact.id);
    setForm({
      name: contact.name,
      address: contact.address || "",
      vat: contact.vat || "",
      tin: contact.tin || "",
      phone: contact.phone || "",
      email: contact.email || "",
      reference: contact.reference || ""
    });
    setIsEditing(false);
  };

  return (
    <div className="content">
      <div className="form-view">
        <div className="form-shell">
          <div className="form-header">
            <div>
              <h3>Customer</h3>
              <div className="statusbar">
                <span className={`status-pill ${selectedContactId ? "" : "active"}`}>New</span>
                <span className={`status-pill ${selectedContactId ? "active" : ""}`}>Saved</span>
              </div>
            </div>
            <div className="form-actions">
              <button className="outline" onClick={startNew}>New</button>
              {isEditing ? (
                <>
                  <button className="primary" onClick={selectedContactId ? updateContact : createContact}>Save</button>
                  <button className="outline" onClick={() => setIsEditing(false)}>Discard</button>
                </>
              ) : (
                <button className="primary" onClick={() => setIsEditing(true)}>Edit</button>
              )}
            </div>
          </div>
          <div className="form-grid">
          <label className="input">
            Company
            <select
              value={companyId ?? ""}
              onChange={(e) => setCompanyId(Number(e.target.value))}
              disabled={!isEditing}
            >
              {companies.map((c: Company) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="input">
            Customer Name
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              disabled={!isEditing}
            />
          </label>
          <label className="input">
            Address
            <input
              type="text"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              disabled={!isEditing}
            />
          </label>
          <label className="input">
            VAT
            <input
              type="text"
              value={form.vat}
              onChange={(e) => setForm({ ...form, vat: e.target.value })}
              disabled={!isEditing}
            />
          </label>
          <label className="input">
            TIN
            <input
              type="text"
              value={form.tin}
              onChange={(e) => setForm({ ...form, tin: e.target.value })}
              disabled={!isEditing}
            />
          </label>
          <label className="input">
            Phone
            <input
              type="text"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              disabled={!isEditing}
            />
          </label>
          <label className="input">
            Email
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              disabled={!isEditing}
            />
          </label>
          <label className="input">
            Reference
            <input
              type="text"
              value={form.reference}
              onChange={(e) => setForm({ ...form, reference: e.target.value })}
              disabled={!isEditing}
            />
          </label>
        </div>
        </div>
      </div>
      <div className="form-shell">
        <h3>Customers</h3>
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
              <tr
                key={c.id}
                className={selectedContactId === c.id ? "row-active" : ""}
                onClick={() => selectContact(c)}
              >
                <td>{c.name}</td>
                <td>{c.vat}</td>
                <td>{c.tin}</td>
                <td>{c.phone}</td>
                <td>{c.email}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}