import { Fragment, useEffect, useMemo, useState } from "react";
import { apiFetch, apiRequest } from "../api";
import { useCompanies, Company } from "../hooks/useCompanies";
import { useListView } from "../context/ListViewContext";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type Device = {
  id: number;
  company_id: number;
  device_id: string;
  serial_number: string;
  model: string;
  activation_key: string;
  activation_date?: string | null;
  crt_filename: string;
  key_filename: string;
  fiscal_day_status: string;
  current_fiscal_day_no: number;
  last_fiscal_day_no: number;
  last_receipt_counter: number;
  last_receipt_global_no: number;
};

type DeviceMessage = {
  type: "success" | "error" | "info";
  text: string;
  timestamp: number;
};

type GroupedDevices = { label: string; items: Device[] };

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/** Friendly label for each FDMS action */
const ACTION_LABELS: Record<string, string> = {
  status: "Get Status",
  config: "Get Config",
  ping: "Ping",
  register: "Register",
  "open-day": "Open Day",
  "close-day": "Close Day",
};

/** Try to pull a readable message from an API error body */
function parseErrorDetail(raw: string): string {
  try {
    const parsed = JSON.parse(raw);
    if (parsed.detail) return String(parsed.detail);
    if (parsed.title && parsed.errors) {
      const msgs = Object.entries(parsed.errors)
        .map(([k, v]) => `${k}: ${(v as string[]).join(", ")}`)
        .join("; ");
      return `${parsed.title} – ${msgs}`;
    }
    return raw;
  } catch {
    return raw;
  }
}

/** Pretty-print a JSON FDMS response for display */
function formatResponse(action: string, raw: string): string {
  const label = ACTION_LABELS[action] || action;
  try {
    const data = JSON.parse(raw);
    const parts: string[] = [];
    if (data.operationID) parts.push(`Operation: ${data.operationID}`);
    if (data.fiscalDayStatus) parts.push(`Day status: ${data.fiscalDayStatus}`);
    if (data.lastFiscalDayNo !== undefined) parts.push(`Last day #${data.lastFiscalDayNo}`);
    if (data.lastReceiptGlobalNo !== undefined) parts.push(`Global receipt #${data.lastReceiptGlobalNo}`);
    if (data.reportingFrequency !== undefined) parts.push(`Next ping in ${data.reportingFrequency} min`);
    if (data.taxPayerName) parts.push(`Taxpayer: ${data.taxPayerName}`);
    if (data.certificateValidTill) parts.push(`Cert valid till: ${data.certificateValidTill}`);
    if (data.qrUrl) parts.push(`QR URL: ${data.qrUrl}`);
    if (data.serverDate) parts.push(`Server date: ${data.serverDate}`);
    if (parts.length) return `${label} OK — ${parts.join(" · ")}`;
    return `${label} OK — ${raw}`;
  } catch {
    return raw || `${label} completed`;
  }
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

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
    activation_key: "",
    activation_date: "",
  });
  const [globalMsg, setGlobalMsg] = useState<DeviceMessage | null>(null);
  const [loadingDevices, setLoadingDevices] = useState(false);
  const [creating, setCreating] = useState(false);
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});
  const [actionLog, setActionLog] = useState<DeviceMessage[]>([]);
  const [deviceMessages, setDeviceMessages] = useState<Record<number, DeviceMessage>>({});

  /* auto-clear global message after 8s */
  useEffect(() => {
    if (!globalMsg) return;
    const t = setTimeout(() => setGlobalMsg(null), 8000);
    return () => clearTimeout(t);
  }, [globalMsg]);

  /* auto-clear per-device messages after 15s */
  useEffect(() => {
    const ids = Object.keys(deviceMessages).map(Number);
    if (!ids.length) return;
    const t = setTimeout(() => {
      const now = Date.now();
      setDeviceMessages((prev) => {
        const next: Record<number, DeviceMessage> = {};
        for (const [k, v] of Object.entries(prev)) {
          if (now - v.timestamp < 15_000) next[Number(k)] = v;
        }
        return next;
      });
    }, 15_000);
    return () => clearTimeout(t);
  }, [deviceMessages]);

  /* select first company */
  useEffect(() => {
    if (companies.length && companyId === null) setCompanyId(companies[0].id);
  }, [companies, companyId]);

  /* load devices */
  const loadDevices = async (cid: number) => {
    setLoadingDevices(true);
    const params = new URLSearchParams({ company_id: String(cid) });
    state.filters.forEach((chip) =>
      Object.entries(chip.params).forEach(([key, value]) => params.set(key, value))
    );
    try {
      const data = await apiFetch<Device[]>(`/devices?${params.toString()}`);
      setDevices(data);
    } catch (err: any) {
      pushGlobal("error", err.message || "Failed to load devices");
    } finally {
      setLoadingDevices(false);
    }
  };

  useEffect(() => {
    if (companyId) {
      const t = setTimeout(() => loadDevices(companyId), 300);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [companyId, state.filters]);

  /* cert status */
  useEffect(() => {
    (async () => {
      if (!companyId) return;
      try {
        setCertStatus("loading");
        const cert = await apiFetch<{ crt_filename?: string; key_filename?: string } | null>(
          `/company-certificates?company_id=${companyId}`
        );
        setCertInfo({ crt: cert?.crt_filename ?? undefined, key: cert?.key_filename ?? undefined });
        setCertStatus(cert?.crt_filename && cert?.key_filename ? "ready" : "missing");
      } catch {
        setCertStatus("missing");
        setCertInfo({});
      }
    })();
  }, [companyId]);

  /* helpers */
  const pushGlobal = (type: DeviceMessage["type"], text: string) =>
    setGlobalMsg({ type, text, timestamp: Date.now() });

  const pushLog = (type: DeviceMessage["type"], text: string) =>
    setActionLog((prev) => [{ type, text, timestamp: Date.now() }, ...prev].slice(0, 20));

  const pushDeviceMsg = (deviceId: number, type: DeviceMessage["type"], text: string) =>
    setDeviceMessages((prev) => ({ ...prev, [deviceId]: { type, text, timestamp: Date.now() } }));

  const setLoading = (key: string, on: boolean) =>
    setActionLoading((prev) => ({ ...prev, [key]: on }));

  /* upload company cert */
  const uploadCompanyCert = async (type: "crt" | "key", file: File) => {
    if (!companyId) return;
    const fd = new FormData();
    fd.append(type, file);
    try {
      const res = await apiRequest(`/company-certificates/${companyId}/${type}`, { method: "POST", body: fd });
      if (!res.ok) {
        const text = await res.text();
        pushGlobal("error", parseErrorDetail(text) || "Certificate upload failed");
        return;
      }
      pushGlobal("success", `Company ${type.toUpperCase()} certificate uploaded successfully`);
      pushLog("success", `Company ${type.toUpperCase()} certificate uploaded`);
      const updated = await apiFetch<{ crt_filename?: string; key_filename?: string } | null>(
        `/company-certificates?company_id=${companyId}`
      );
      setCertInfo({ crt: updated?.crt_filename ?? undefined, key: updated?.key_filename ?? undefined });
      setCertStatus(updated?.crt_filename && updated?.key_filename ? "ready" : "missing");
    } catch (err: any) {
      pushGlobal("error", err.message || "Certificate upload failed");
    }
  };

  /* create device */
  const createDevice = async () => {
    if (!companyId) return pushGlobal("error", "Select a company first");
    if (!form.device_id.trim()) return pushGlobal("error", "Device ID is required");
    if (!form.serial_number.trim()) return pushGlobal("error", "Serial Number is required");
    if (!form.model.trim()) return pushGlobal("error", "Model is required");
    try {
      setCreating(true);
      setGlobalMsg(null);
      await apiFetch<Device>("/devices", {
        method: "POST",
        body: JSON.stringify({ ...form, company_id: companyId }),
      });
      setForm({ device_id: "", serial_number: "", model: "", activation_key: "", activation_date: "" });
      pushGlobal("success", "Device created successfully");
      pushLog("success", `Device ${form.device_id} created`);
      loadDevices(companyId);
    } catch (err: any) {
      pushGlobal("error", parseErrorDetail(err.message) || "Failed to create device");
    } finally {
      setCreating(false);
    }
  };

  /* upload device cert */
  const uploadCert = async (deviceId: number, type: "crt" | "key", file: File) => {
    const fd = new FormData();
    fd.append(type, file);
    try {
      const res = await apiRequest(`/devices/${deviceId}/${type}`, { method: "POST", body: fd });
      if (res.ok) {
        pushDeviceMsg(deviceId, "success", `${type.toUpperCase()} uploaded`);
        pushLog("success", `Device #${deviceId} ${type.toUpperCase()} uploaded`);
        if (companyId) loadDevices(companyId);
      } else {
        const text = await res.text();
        pushDeviceMsg(deviceId, "error", parseErrorDetail(text) || "Upload failed");
      }
    } catch (err: any) {
      pushDeviceMsg(deviceId, "error", err.message || "Upload failed");
    }
  };

  /* run FDMS action */
  const runAction = async (deviceId: number, action: string, method: "GET" | "POST" = "GET") => {
    const key = `${deviceId}-${action}`;
    const label = ACTION_LABELS[action] || action;
    setLoading(key, true);
    pushDeviceMsg(deviceId, "info", `Running ${label}…`);
    try {
      const res = await apiRequest(`/devices/${deviceId}/${action}`, { method });
      const text = await res.text();
      if (!res.ok) {
        const msg = parseErrorDetail(text) || `${label} failed`;
        pushDeviceMsg(deviceId, "error", msg);
        pushLog("error", `${label} – ${msg}`);
      } else {
        const msg = formatResponse(action, text);
        pushDeviceMsg(deviceId, "success", msg);
        pushLog("success", msg);
      }
      if (companyId) loadDevices(companyId);
    } catch (err: any) {
      const msg = err.message || `${label} failed`;
      pushDeviceMsg(deviceId, "error", msg);
      pushLog("error", `${label} – ${msg}`);
    } finally {
      setLoading(key, false);
    }
  };

  /* display helpers */
  const formatStatus = (s: string) => {
    if (s === "open" || s === "FiscalDayOpened") return "Open";
    if (s === "closed" || s === "FiscalDayClosed") return "Closed";
    return s || "—";
  };

  const groupedDevices = useMemo<GroupedDevices[]>(() => {
    if (!state.groupBy || state.groupBy === "")
      return [{ label: "", items: devices }];
    if (state.groupBy === "status") {
      const open = devices.filter((d) => d.fiscal_day_status === "open");
      const closed = devices.filter((d) => d.fiscal_day_status !== "open");
      return [
        { label: "Open Day", items: open },
        { label: "Closed Day", items: closed },
      ];
    }
    return [{ label: "", items: devices }];
  }, [devices, state.groupBy]);

  const isLoading = (deviceId: number, action: string) =>
    !!actionLoading[`${deviceId}-${action}`];

  /* ---------------------------------------------------------------- */
  /*  Render                                                           */
  /* ---------------------------------------------------------------- */

  return (
    <div className="content">
      {/* ---- create form card ---- */}
      <div className="card">
        <h3>Register Device (FDMS)</h3>

        {globalMsg && (
          <div
            className={`alert ${
              globalMsg.type === "success"
                ? "alert-success"
                : globalMsg.type === "error"
                ? "alert-error"
                : ""
            }`}
            style={{ marginBottom: 12 }}
          >
            {globalMsg.text}
          </div>
        )}

        {certStatus === "missing" && (
          <div className="alert alert-error" style={{ marginBottom: 12 }}>
            ⚠ Company certificate/key missing — upload them below before running FDMS actions.
          </div>
        )}
        {certStatus === "ready" && (
          <div className="alert alert-success" style={{ marginBottom: 12 }}>
            ✓ Company certificate and key are configured.
          </div>
        )}

        <div className="form-grid">
          <label className="input">
            Company
            <select value={companyId ?? ""} onChange={(e) => setCompanyId(Number(e.target.value))}>
              {companies.map((c: Company) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </label>
          <label className="input">
            Company CRT
            <div className="file-stack">
              <span>{certInfo.crt || "Not uploaded"}</span>
              <input type="file" accept=".crt,.pem,.cer" onChange={(e) => e.target.files?.[0] && uploadCompanyCert("crt", e.target.files[0])} />
            </div>
          </label>
          <label className="input">
            Company KEY
            <div className="file-stack">
              <span>{certInfo.key || "Not uploaded"}</span>
              <input type="file" accept=".key,.pem" onChange={(e) => e.target.files?.[0] && uploadCompanyCert("key", e.target.files[0])} />
            </div>
          </label>
          <label className="input">
            Device ID
            <input value={form.device_id} placeholder="e.g. 12345" onChange={(e) => setForm({ ...form, device_id: e.target.value })} />
          </label>
          <label className="input">
            Serial Number
            <input value={form.serial_number} placeholder="e.g. SN-001" onChange={(e) => setForm({ ...form, serial_number: e.target.value })} />
          </label>
          <label className="input">
            Model
            <input value={form.model} placeholder="e.g. 365Fiscal" onChange={(e) => setForm({ ...form, model: e.target.value })} />
          </label>
          <label className="input">
            Activation Key
            <input value={form.activation_key} placeholder="e.g. ABCD1234" maxLength={8} style={{ textTransform: "uppercase" }} onChange={(e) => setForm({ ...form, activation_key: e.target.value.toUpperCase() })} />
          </label>
          <label className="input">
            Activation Date
            <input type="date" value={form.activation_date} onChange={(e) => setForm({ ...form, activation_date: e.target.value })} />
          </label>
        </div>
        <div style={{ marginTop: 16 }}>
          <button className="primary" onClick={createDevice} disabled={creating}>
            {creating ? "Creating…" : "Create Device"}
          </button>
        </div>
      </div>

      {/* ---- devices list card ---- */}
      <div className="card">
        <h3>Devices</h3>

        {actionLog.length > 0 && (
          <details open style={{ marginBottom: 12 }}>
            <summary style={{ fontWeight: 600, cursor: "pointer", marginBottom: 6 }}>
              Activity Log ({actionLog.length})
            </summary>
            <div style={{ maxHeight: 180, overflowY: "auto", background: "#f8fafc", border: "1px solid var(--stroke)", borderRadius: 6, padding: "8px 12px", fontSize: 13 }}>
              {actionLog.map((entry, i) => (
                <div key={i} style={{ display: "flex", gap: 8, padding: "3px 0", borderBottom: "1px solid #eee", color: entry.type === "error" ? "var(--danger, #c0392b)" : entry.type === "success" ? "var(--success, #27ae60)" : "inherit" }}>
                  <span style={{ flexShrink: 0, opacity: 0.5 }}>{new Date(entry.timestamp).toLocaleTimeString()}</span>
                  <span>{entry.text}</span>
                </div>
              ))}
            </div>
          </details>
        )}

        <table className="data-table">
          <thead>
            <tr>
              <th>Device ID</th>
              <th>Serial</th>
              <th>Model</th>
              <th>Status</th>
              <th>Day / Receipts</th>
              <th>CRT</th>
              <th>KEY</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {groupedDevices.map((group, gi) => (
              <Fragment key={group.label || `g-${gi}`}>
                {group.label && (
                  <tr className="table-group"><td colSpan={8}>{group.label}</td></tr>
                )}
                {group.items.map((d) => {
                  const msg = deviceMessages[d.id];
                  return (
                    <tr key={d.id}>
                      <td>{d.device_id}</td>
                      <td>{d.serial_number}</td>
                      <td>{d.model}</td>
                      <td>
                        <span className={`badge ${d.fiscal_day_status === "open" ? "badge-success" : "badge-warning"}`}>
                          {formatStatus(d.fiscal_day_status)}
                        </span>
                      </td>
                      <td style={{ fontSize: 12, whiteSpace: "nowrap" }}>
                        Day #{d.current_fiscal_day_no || d.last_fiscal_day_no || 0}<br />
                        Receipts: {d.last_receipt_counter} / Global: {d.last_receipt_global_no}
                      </td>
                      <td>
                        <div className="file-stack">
                          <span>{d.crt_filename || "—"}</span>
                          <input type="file" accept=".crt,.pem,.cer" onChange={(e) => e.target.files?.[0] && uploadCert(d.id, "crt", e.target.files[0])} />
                        </div>
                      </td>
                      <td>
                        <div className="file-stack">
                          <span>{d.key_filename || "—"}</span>
                          <input type="file" accept=".key,.pem" onChange={(e) => e.target.files?.[0] && uploadCert(d.id, "key", e.target.files[0])} />
                        </div>
                      </td>
                      <td style={{ minWidth: 260 }}>
                        <div className="action-grid">
                          <button className="outline" disabled={isLoading(d.id, "status")} onClick={() => runAction(d.id, "status")}>
                            {isLoading(d.id, "status") ? "…" : "Status"}
                          </button>
                          <button className="outline" disabled={isLoading(d.id, "config")} onClick={() => runAction(d.id, "config")}>
                            {isLoading(d.id, "config") ? "…" : "Config"}
                          </button>
                          <button className="outline" disabled={isLoading(d.id, "ping")} onClick={() => runAction(d.id, "ping", "POST")}>
                            {isLoading(d.id, "ping") ? "…" : "Ping"}
                          </button>
                          <button className="outline" disabled={isLoading(d.id, "register")} onClick={() => runAction(d.id, "register", "POST")}>
                            {isLoading(d.id, "register") ? "…" : "Register"}
                          </button>
                          <button className="outline" disabled={isLoading(d.id, "open-day")} onClick={() => runAction(d.id, "open-day", "POST")}>
                            {isLoading(d.id, "open-day") ? "…" : "Open Day"}
                          </button>
                          <button className="outline" disabled={isLoading(d.id, "close-day")} onClick={() => runAction(d.id, "close-day", "POST")}>
                            {isLoading(d.id, "close-day") ? "…" : "Close Day"}
                          </button>
                        </div>
                        {msg && (
                          <div
                            className={`alert ${msg.type === "success" ? "alert-success" : msg.type === "error" ? "alert-error" : ""}`}
                            style={{ marginTop: 8, padding: "6px 10px", fontSize: 12, lineHeight: 1.4, wordBreak: "break-word" }}
                          >
                            {msg.type === "info" && "⏳ "}
                            {msg.type === "success" && "✓ "}
                            {msg.type === "error" && "✗ "}
                            {msg.text}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </Fragment>
            ))}
            {!loadingDevices && !devices.length && (
              <tr>
                <td colSpan={8} style={{ textAlign: "center", padding: 24, color: "var(--muted)" }}>
                  No devices found — create one above.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        {loadingDevices && <p style={{ marginTop: 12, color: "var(--muted)" }}>Loading devices…</p>}
      </div>
    </div>
  );
}
