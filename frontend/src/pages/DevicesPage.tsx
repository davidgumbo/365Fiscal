import { Fragment, useEffect, useMemo, useState } from "react";
import { apiFetch, apiRequest } from "../api";
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
  const [error, setError] = useState<string | null>(null);
  const [loadingDevices, setLoadingDevices] = useState(false);
  const [creating, setCreating] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    if (companies.length && companyId === null) {
      setCompanyId(companies[0].id);
    }
  }, [companies, companyId]);

  const loadDevices = async (cid: number) => {
    setLoadingDevices(true);
    const params = new URLSearchParams({ company_id: String(cid) });
    state.filters.forEach((chip) => {
      Object.entries(chip.params).forEach(([key, value]) => {
        params.set(key, value);
      });
    });
    try {
      setError(null);
      const data = await apiFetch<Device[]>(`/devices?${params.toString()}`);
      setDevices(data);
    } catch (err: any) {
      setError(err.message || "Failed to load devices");
    } finally {
      setLoadingDevices(false);
    }
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
    if (!companyId) {
      setError("Please select a company first");
      return;
    }
    if (!form.device_id || !form.serial_number || !form.model) {
      setError("Device ID, Serial, and Model are required");
      return;
    }
    try {
      setError(null);
      setActionStatus(null);
      setCreating(true);
      await apiFetch<Device>("/devices", {
        method: "POST",
        body: JSON.stringify({ ...form, company_id: companyId })
      });
      setForm({ device_id: "", serial_number: "", model: "", activation_date: "" });
      setActionStatus("Device created successfully");
      loadDevices(companyId);
    } catch (err: any) {
      setError(err.message || "Failed to create device");
    } finally {
      setCreating(false);
    }
  };

  const uploadCert = async (deviceId: number, type: "crt" | "key", file: File) => {
    const formData = new FormData();
    formData.append(type, file);
    try {
      setError(null);
      const res = await apiRequest(`/devices/${deviceId}/${type}`, {
        method: "POST",
        body: formData
      });
      if (res.ok && companyId) {
        setActionStatus(`${type.toUpperCase()} uploaded`);
        loadDevices(companyId);
      } else {
        const text = await res.text();
        setError(text || "Upload failed");
      }
    } catch (err: any) {
      setError(err.message || "Upload failed");
    }
  };

  const runAction = async (deviceId: number, action: string, method: "GET" | "POST" = "GET") => {
    const actionKey = `${deviceId}-${action}`;
    try {
      setError(null);
      setActionLoading(actionKey);
      const res = await apiRequest(`/devices/${deviceId}/${action}`, { method });
      const text = await res.text();
      if (!res.ok) {
        setError(text || "Action failed");
      } else {
        setActionStatus(text || `${action} executed`);
      }
      if (companyId) {
        loadDevices(companyId);
      }
    } catch (err: any) {
      setError(err.message || "Action failed");
    } finally {
      setActionLoading(null);
    }
  };

  const formatStatus = (status: string) => {
    if (status === "open") return "Open";
    if (status === "closed") return "Closed";
    return status || "—";
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
        {error && <div className="alert alert-error" style={{ marginBottom: 12 }}>{error}</div>}
        {actionStatus && <div className="alert alert-success" style={{ marginBottom: 12 }}>{actionStatus}</div>}
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
            <input
              value={form.device_id}
              placeholder="Enter device ID"
              onChange={(e) => setForm({ ...form, device_id: e.target.value })}
            />
          </label>
          <label className="input">
            Serial
            <input
              value={form.serial_number}
              placeholder="Enter serial number"
              onChange={(e) => setForm({ ...form, serial_number: e.target.value })}
            />
          </label>
          <label className="input">
            Model
            <input
              value={form.model}
              placeholder="Enter model"
              onChange={(e) => setForm({ ...form, model: e.target.value })}
            />
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
          <button className="primary" onClick={createDevice} disabled={creating}>
            {creating ? "Creating..." : "Create Device"}
          </button>
        </div>
      </div>
      <div className="card">
        <h3>Devices</h3>
        <table className="data-table">
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
                    <td>
                      <span className={`badge ${d.fiscal_day_status === "open" ? "badge-success" : "badge-warning"}`}>
                        {formatStatus(d.fiscal_day_status)}
                      </span>
                    </td>
                    <td>
                      <div className="file-stack">
                        <span>{d.crt_filename || "—"}</span>
                        <input
                          type="file"
                          onChange={(e) => e.target.files?.[0] && uploadCert(d.id, "crt", e.target.files[0])}
                        />
                      </div>
                    </td>
                    <td>
                      <div className="file-stack">
                        <span>{d.key_filename || "—"}</span>
                        <input
                          type="file"
                          onChange={(e) => e.target.files?.[0] && uploadCert(d.id, "key", e.target.files[0])}
                        />
                      </div>
                    </td>
                    <td>
                      <div className="action-grid">
                        <button className="outline" onClick={() => runAction(d.id, "status")} disabled={actionLoading === `${d.id}-status`}>Status</button>
                        <button className="outline" onClick={() => runAction(d.id, "config")} disabled={actionLoading === `${d.id}-config`}>Get Conf</button>
                        <button className="outline" onClick={() => runAction(d.id, "ping")} disabled={actionLoading === `${d.id}-ping`}>Ping</button>
                        <button className="outline" onClick={() => runAction(d.id, "register", "POST")} disabled={actionLoading === `${d.id}-register`}>Register</button>
                        <button className="outline" onClick={() => runAction(d.id, "open-day", "POST")} disabled={actionLoading === `${d.id}-open-day`}>Open Day</button>
                        <button className="outline" onClick={() => runAction(d.id, "close-day", "POST")} disabled={actionLoading === `${d.id}-close-day`}>Close Day</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </Fragment>
            ))}
            {!loadingDevices && !devices.length && (
              <tr>
                <td colSpan={7} style={{ textAlign: "center", padding: "24px", color: "var(--muted)" }}>
                  No devices found
                </td>
              </tr>
            )}
          </tbody>
        </table>
        {loadingDevices ? <p style={{ marginTop: 12 }}>Loading devices...</p> : null}
      </div>
    </div>
  );
}
