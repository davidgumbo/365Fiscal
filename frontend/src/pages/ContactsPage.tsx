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
  const [isEditing, setIsEditing] = useState(true);
  const [viewMode, setViewMode] = useState<"list" | "kanban">("list");
  const [isCompany, setIsCompany] = useState<boolean>(true);
  const [street, setStreet] = useState("");
  const [street2, setStreet2] = useState("");
  const [city, setCity] = useState("");
  const [zip, setZip] = useState("");
  const [country, setCountry] = useState("");
  const [tags, setTags] = useState<string[]>([]);
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
      selectContact(data[0]);
    }
  };

  useEffect(() => {
    if (companyId) {
      loadContacts(companyId);
    }
  }, [companyId]);

  const createContact = async () => {
    if (!companyId) return;
    const composedAddress = [street, street2, [city, zip].filter(Boolean).join(" "), country]
      .filter((s) => s && s.trim().length)
      .join("\n");
    await apiFetch<Contact>("/contacts", {
      method: "POST",
      body: JSON.stringify({
        ...form,
        company_id: companyId,
        address: composedAddress,
        reference: tags.join(", ")
      })
    });
    resetForm();
    loadContacts(companyId);
  };

  const updateContact = async () => {
    if (!selectedContactId) return;
    const composedAddress = [street, street2, [city, zip].filter(Boolean).join(" "), country]
      .filter((s) => s && s.trim().length)
      .join("\n");
    await apiFetch<Contact>(`/contacts/${selectedContactId}`, {
      method: "PUT",
      body: JSON.stringify({
        ...form,
        address: composedAddress,
        reference: tags.join(", ")
      })
    });
    if (companyId) loadContacts(companyId);
  };

  const resetForm = () => {
    setForm({ name: "", address: "", vat: "", tin: "", phone: "", email: "", reference: "" });
    setStreet("");
    setStreet2("");
    setCity("");
    setZip("");
    setCountry("");
    setTags([]);
  };

  const startNew = () => {
    setSelectedContactId(null);
    resetForm();
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
    setStreet(contact.address || "");
    setStreet2("");
    setCity("");
    setZip("");
    setCountry("");
    setTags((contact.reference || "").split(",").map((t) => t.trim()).filter(Boolean));
    setIsEditing(true);
  };

  return (
    <div className="content">
      <div className="form-view">
        <div className="form-shell invoice-form">
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
            <div className="card" style={{ gridColumn: "1 / -1" }}>
              <div className="settings-card-title" style={{ marginBottom: 8 }}>Contact Information</div>
              <div className="form-grid">
                <label className="input">
                  Company / Individual
                  <select className="input-underline" value={isCompany ? "company" : "individual"} onChange={(e) => setIsCompany(e.target.value === "company")} disabled={!isEditing}>
                    <option value="company">Company</option>
                    <option value="individual">Individual</option>
                  </select>
                </label>
                <label className="input">
                  Display Name
                  <input className="input-underline" type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} disabled={!isEditing} />
                </label>
                <label className="input">
                  Phone
                  <input className="input-underline" type="text" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} disabled={!isEditing} />
                </label>
                <label className="input">
                  Email
                  <input className="input-underline" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} disabled={!isEditing} />
                </label>
              </div>
            </div>

            <div className="card" style={{ gridColumn: "1 / -1" }}>
              <div className="settings-card-title" style={{ marginBottom: 8 }}>Addresses</div>
              <div className="form-grid">
                <label className="input">
                  Street
                  <input className="input-underline" type="text" value={street} onChange={(e) => setStreet(e.target.value)} disabled={!isEditing} />
                </label>
                <label className="input">
                  Street 2
                  <input className="input-underline" type="text" value={street2} onChange={(e) => setStreet2(e.target.value)} disabled={!isEditing} />
                </label>
                <label className="input">
                  City
                  <input className="input-underline" type="text" value={city} onChange={(e) => setCity(e.target.value)} disabled={!isEditing} />
                </label>
                <label className="input">
                  ZIP
                  <input className="input-underline" type="text" value={zip} onChange={(e) => setZip(e.target.value)} disabled={!isEditing} />
                </label>
                <label className="input">
                  Country
                  <input className="input-underline" type="text" value={country} onChange={(e) => setCountry(e.target.value)} disabled={!isEditing} />
                </label>
              </div>
            </div>

            <div className="card" style={{ gridColumn: "1 / -1" }}>
              <div className="settings-card-title" style={{ marginBottom: 8 }}>Tax & Tags</div>
              <div className="form-grid">
                <label className="input">
                  VAT
                  <input className="input-underline" type="text" value={form.vat} onChange={(e) => setForm({ ...form, vat: e.target.value })} disabled={!isEditing} />
                </label>
                <label className="input">
                  TIN
                  <input className="input-underline" type="text" value={form.tin} onChange={(e) => setForm({ ...form, tin: e.target.value })} disabled={!isEditing} />
                </label>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Tags</div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {tags.map((t, i) => (
                      <span key={i} className="status-pill active" style={{ cursor: "pointer" }} onClick={() => setTags(tags.filter((_t, idx) => idx !== i))}>{t} ×</span>
                    ))}
                    {isEditing && (
                      <input
                        type="text"
                        placeholder="Add tag"
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && (e.target as HTMLInputElement).value.trim()) {
                            setTags([...tags, (e.target as HTMLInputElement).value.trim()]);
                            (e.target as HTMLInputElement).value = "";
                          }
                        }}
                        style={{ padding: "6px 10px", border: "1px solid var(--stroke)", borderRadius: 8 }}
                      />
                    )}
                  </div>
                </div>
              </div>
            </div>

            <label className="input" style={{ gridColumn: "1 / -1" }}>
              Company
              <select className="input-underline" value={companyId ?? ""} onChange={(e) => setCompanyId(Number(e.target.value))} disabled={!isEditing}>
                {companies.map((c: Company) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </label>
          </div>
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
                <tr key={c.id} className={selectedContactId === c.id ? "row-active" : ""} onClick={() => selectContact(c)}>
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
              <div key={c.id} className="card" style={{ cursor: "pointer" }} onClick={() => selectContact(c)}>
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