import { Fragment, useEffect, useMemo, useState } from "react";
import { apiFetch } from "../api";
import { useCompanies, Company } from "../hooks/useCompanies";
import { useListView } from "../context/ListViewContext";

type Device = {
  id: number;
  company_id: number;
  device_id: string;
  serial_number: string;
  model: string;
  activation_date?: string | null;
  crt_filename: string;
  key_filename: string;
  fiscal_day_status: string;
};

type GroupedDevices = {
  label: string;
  items: Device[];
};

export default function DevicesPage() {
  const companies = useCompanies();
  const { state } = useListView();
  const [companyId, setCompanyId] = useState<number | null>(null);
  const [devices, setDevices] = useState<Device[]>([]);
  const [form, setForm] = useState({
    device_id: "",
    serial_number: "",
    model: "",
    activation_date: ""
  });
  const [actionStatus, setActionStatus] = useState<string | null>(null);

  useEffect(() => {
    if (companies.length && companyId === null) {
      setCompanyId(companies[0].id);
    }
  }, [companies, companyId]);

  const loadDevices = async (cid: number) => {
    const params = new URLSearchParams({ company_id: String(cid) });
    state.filters.forEach((chip) => {
      Object.entries(chip.params).forEach(([key, value]) => {
        params.set(key, value);
      });
    });
    const data = await apiFetch<Device[]>(`/devices?${params.toString()}`);
    setDevices(data);
  };

  useEffect(() => {
    if (companyId) {
      const timeout = setTimeout(() => {
        loadDevices(companyId);
      }, 300);
      return () => clearTimeout(timeout);
    }
    return undefined;
  }, [companyId, state.filters]);

  const createDevice = async () => {
    if (!companyId) return;
    await apiFetch<Device>("/devices", {
      method: "POST",
      body: JSON.stringify({ ...form, company_id: companyId })
    });
    setForm({ device_id: "", serial_number: "", model: "", activation_date: "" });
    loadDevices(companyId);
  };

  const uploadCert = async (deviceId: number, type: "crt" | "key", file: File) => {
    const formData = new FormData();
    formData.append(type, file);
    const res = await fetch(`http://localhost:8000/api/devices/${deviceId}/${type}`, {
      method: "POST",
      body: formData,
      headers: {
        Authorization: `Bearer ${localStorage.getItem("access_token")}`
      }
    });
    if (res.ok && companyId) {
      setActionStatus(`${type.toUpperCase()} uploaded`);
      loadDevices(companyId);
    } else {
      setActionStatus("Upload failed");
    }
  };

  const runAction = async (deviceId: number, action: string, method: "GET" | "POST" = "GET") => {
    const res = await fetch(`http://localhost:8000/api/devices/${deviceId}/${action}`, {
      method,
      headers: {
        Authorization: `Bearer ${localStorage.getItem("access_token")}`
      }
    });
    const text = await res.text();
    setActionStatus(text || `${action} executed`);
    if (companyId) {
      loadDevices(companyId);
    }
  };

  const groupedDevices = useMemo<GroupedDevices[]>(() => {
    if (!state.groupBy || state.groupBy === "") {
      return [{ label: "", items: devices }];
    }
    if (state.groupBy === "status") {
      const open = devices.filter((device) => device.fiscal_day_status === "open");
      const closed = devices.filter((device) => device.fiscal_day_status !== "open");
      return [
        { label: "Open Day", items: open },
        { label: "Closed Day", items: closed }
      ];
    }
    return [{ label: "", items: devices }];
  }, [devices, state.groupBy]);

  return (
    <div className="content">
      <div className="card">
        <h3>Register Device (FDMS)</h3>
        <div className="form-grid">
          <label className="input">
            Company
            <select value={companyId ?? ""} onChange={(e) => setCompanyId(Number(e.target.value))}>
              {companies.map((c: Company) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="input">
            Device ID
            <input value={form.device_id} onChange={(e) => setForm({ ...form, device_id: e.target.value })} />
          </label>
          <label className="input">
            Serial
            <input
              value={form.serial_number}
              onChange={(e) => setForm({ ...form, serial_number: e.target.value })}
            />
          </label>
          <label className="input">
            Model
            <input value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} />
          </label>
          <label className="input">
            Activation Date
            <input
              type="date"
              value={form.activation_date}
              onChange={(e) => setForm({ ...form, activation_date: e.target.value })}
            />
          </label>
        </div>
        <div style={{ marginTop: 16 }}>
          <button className="primary" onClick={createDevice}>
            Create Device
          </button>
        </div>
      </div>
      <div className="card">
        <h3>Devices</h3>
        <table className="table">
          <thead>
            <tr>
              <th>Device ID</th>
              <th>Serial</th>
              <th>Model</th>
              <th>Status</th>
              <th>CRT</th>
              <th>KEY</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {groupedDevices.map((group, index) => (
              <Fragment key={group.label || `group-${index}`}>
                {group.label ? (
                  <tr className="table-group">
                    <td colSpan={7}>{group.label}</td>
                  </tr>
                ) : null}
                {group.items.map((d) => (
                  <tr key={d.id}>
                    <td>{d.device_id}</td>
                    <td>{d.serial_number}</td>
                    <td>{d.model}</td>
                    <td>{d.fiscal_day_status}</td>
                    <td>
                      <div className="file-stack">
                        <span>{d.crt_filename || "�"}</span>
                        <input
                          type="file"
                          onChange={(e) => e.target.files?.[0] && uploadCert(d.id, "crt", e.target.files[0])}
                        />
                      </div>
                    </td>
                    <td>
                      <div className="file-stack">
                        <span>{d.key_filename || "�"}</span>
                        <input
                          type="file"
                          onChange={(e) => e.target.files?.[0] && uploadCert(d.id, "key", e.target.files[0])}
                        />
                      </div>
                    </td>
                    <td>
                      <div className="action-grid">
                        <button className="outline" onClick={() => runAction(d.id, "status")}>Status</button>
                        <button className="outline" onClick={() => runAction(d.id, "config")}>Get Conf</button>
                        <button className="outline" onClick={() => runAction(d.id, "ping")}>Ping</button>
                        <button className="outline" onClick={() => runAction(d.id, "register", "POST")}>Register</button>
                        <button className="outline" onClick={() => runAction(d.id, "open-day", "POST")}>Open Day</button>
                        <button className="outline" onClick={() => runAction(d.id, "close-day", "POST")}>Close Day</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
        {actionStatus ? <p>{actionStatus}</p> : null}
      </div>
    </div>
  );
}
