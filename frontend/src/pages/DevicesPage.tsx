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

type DeviceMessage = {
  type: "success" | "error";
  text: string;
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
  const [certStatus, setCertStatus] = useState<"loading" | "ready" | "missing">("loading");
  const [certInfo, setCertInfo] = useState<{ crt?: string; key?: string }>({});
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
  const [actionLog, setActionLog] = useState<string[]>([]);
  const [deviceMessages, setDeviceMessages] = useState<Record<number, DeviceMessage>>({});

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

  useEffect(() => {
    const fetchCertStatus = async () => {
      if (!companyId) return;
      try {
        setCertStatus("loading");
        const cert = await apiFetch<{ crt_filename?: string; key_filename?: string } | null>(
          `/company-certificates?company_id=${companyId}`
        );
        setCertInfo({ crt: cert?.crt_filename, key: cert?.key_filename });
        if (cert?.crt_filename && cert?.key_filename) {
          setCertStatus("ready");
        } else {
          setCertStatus("missing");
        }
      } catch {
        setCertStatus("missing");
        setCertInfo({});
      }
    };
    fetchCertStatus();
  }, [companyId]);

  const uploadCompanyCert = async (type: "crt" | "key", file: File) => {
    if (!companyId) return;
    const formData = new FormData();
    formData.append(type, file);
    try {
      setError(null);
      const res = await apiRequest(`/company-certificates/${companyId}/${type}`, {
        method: "POST",
        body: formData
      });
      if (!res.ok) {
        const text = await res.text();
        setError(text || "Certificate upload failed");
        return;
      }
      const successMessage = `${type.toUpperCase()} certificate uploaded`;
      setActionStatus(successMessage);
      setActionLog((prev) => [successMessage, ...prev].slice(0, 10));
      const updated = await apiFetch<{ crt_filename?: string; key_filename?: string } | null>(
        `/company-certificates?company_id=${companyId}`
      );
      setCertInfo({ crt: updated?.crt_filename, key: updated?.key_filename });
      setCertStatus(updated?.crt_filename && updated?.key_filename ? "ready" : "missing");
    } catch (err: any) {
      setError(err.message || "Certificate upload failed");
    }
  };

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
      const successMessage = "Device created successfully";
      setActionStatus(successMessage);
      setActionLog((prev) => [successMessage, ...prev].slice(0, 10));
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
        const successMessage = `${type.toUpperCase()} uploaded`;
        setActionStatus(successMessage);
        setActionLog((prev) => [successMessage, ...prev].slice(0, 10));
        setDeviceMessages((prev) => ({
          ...prev,
          [deviceId]: { type: "success", text: successMessage }
        }));
        loadDevices(companyId);
      } else {
        const text = await res.text();
        const errorMessage = text || "Upload failed";
        setError(errorMessage);
        setDeviceMessages((prev) => ({
          ...prev,
          [deviceId]: { type: "error", text: errorMessage }
        }));
      }
    } catch (err: any) {
      const errorMessage = err.message || "Upload failed";
      setError(errorMessage);
      setDeviceMessages((prev) => ({
        ...prev,
        [deviceId]: { type: "error", text: errorMessage }
      }));
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
        const errorMessage = text || "Action failed";
        setError(errorMessage);
        setDeviceMessages((prev) => ({
          ...prev,
          [deviceId]: { type: "error", text: errorMessage }
        }));
      } else {
        const successMessage = text || `${action} executed`;
        setActionStatus(successMessage);
        setActionLog((prev) => [successMessage, ...prev].slice(0, 10));
        setDeviceMessages((prev) => ({
          ...prev,
          [deviceId]: { type: "success", text: successMessage }
        }));
      }
      if (companyId) {
        loadDevices(companyId);
      }
    } catch (err: any) {
      const errorMessage = err.message || "Action failed";
      setError(errorMessage);
      setDeviceMessages((prev) => ({
        ...prev,
        [deviceId]: { type: "error", text: errorMessage }
      }));
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
        {certStatus === "missing" && (
          <div className="alert alert-error" style={{ marginBottom: 12 }}>
            Company certificate/key missing. Upload them in Settings → Company Certificates.
          </div>
        )}
        {certStatus === "ready" && (
          <div className="alert alert-success" style={{ marginBottom: 12 }}>
            Company certificate and key are configured.
          </div>
        )}
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
            Company CRT
            <div className="file-stack">
              <span>{certInfo.crt || "Not uploaded"}</span>
              <input
                type="file"
                onChange={(e) => e.target.files?.[0] && uploadCompanyCert("crt", e.target.files[0])}
              />
            </div>
          </label>
          <label className="input">
            Company KEY
            <div className="file-stack">
              <span>{certInfo.key || "Not uploaded"}</span>
              <input
                type="file"
                onChange={(e) => e.target.files?.[0] && uploadCompanyCert("key", e.target.files[0])}
              />
            </div>
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
        {actionLog.length > 0 && (
          <div className="alert" style={{ marginBottom: 12, background: "#f8fafc", border: "1px solid var(--stroke)" }}>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>Latest Messages</div>
            <ul style={{ margin: 0, paddingLeft: 16 }}>
              {actionLog.map((msg, index) => (
                <li key={`${msg}-${index}`} style={{ marginBottom: 4 }}>{msg}</li>
              ))}
            </ul>
          </div>
        )}
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
                      {deviceMessages[d.id] && (
                        <div
                          className={`alert ${deviceMessages[d.id].type === "success" ? "alert-success" : "alert-error"}`}
                          style={{ marginTop: 8, padding: "6px 8px", fontSize: 12 }}
                        >
                          {deviceMessages[d.id].text}
                        </div>
                      )}
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
