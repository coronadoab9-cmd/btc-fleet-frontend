import { useEffect, useState } from "react";
import { apiFetch } from "../lib/api";

function formatDateTime(value) {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

function Section({ title, right, children }) {
  return (
    <div style={styles.sectionCard}>
      <div style={styles.sectionHeader}>
        <div style={styles.sectionTitle}>{title}</div>
        {right ? <div>{right}</div> : null}
      </div>
      {children}
    </div>
  );
}

export default function AdminPage({ token }) {
  const [drivers, setDrivers] = useState([]);
  const [devices, setDevices] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [savingDriver, setSavingDriver] = useState(false);
  const [assigningDevice, setAssigningDevice] = useState(false);

  const [driverForm, setDriverForm] = useState({ name: "", pin: "", active: true });
  const [deviceForm, setDeviceForm] = useState({ device_uuid: "", device_name: "", truck_number: "" });
  const [editingDriverId, setEditingDriverId] = useState(null);

  async function adminFetch(path, options = {}) {
    return apiFetch(path, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        "X-Admin-Token": token,
        ...(options.headers || {}),
      },
    });
  }

  async function loadAll() {
    setLoading(true);
    setError("");
    try {
      const [driversData, devicesData, sessionsData] = await Promise.all([
        adminFetch("/admin/drivers"),
        adminFetch("/admin/devices"),
        adminFetch("/admin/sessions"),
      ]);

      setDrivers(Array.isArray(driversData) ? driversData : []);
      setDevices(Array.isArray(devicesData) ? devicesData : []);
      setSessions(Array.isArray(sessionsData) ? sessionsData : []);
    } catch (err) {
      setError(err.message || "Could not load admin data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, [token]);

  async function saveDriver() {
    setSavingDriver(true);
    setError("");
    setMessage("");
    try {
      const cleanName = driverForm.name.trim();
      const cleanPin = driverForm.pin.trim();

      if (!cleanName) throw new Error("Driver name is required");
      if (!/^\d{6}$/.test(cleanPin)) throw new Error("PIN must be exactly 6 digits");

      const payload = {
        name: cleanName,
        pin: cleanPin,
        active: !!driverForm.active,
      };

      if (editingDriverId) {
        await adminFetch(`/admin/drivers/${editingDriverId}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
        setMessage("Driver updated successfully");
      } else {
        await adminFetch("/admin/drivers", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        setMessage("Driver created successfully");
      }

      setDriverForm({ name: "", pin: "", active: true });
      setEditingDriverId(null);
      await loadAll();
    } catch (err) {
      setError(err.message || "Could not save driver");
    } finally {
      setSavingDriver(false);
    }
  }

  async function assignDevice() {
    setAssigningDevice(true);
    setError("");
    setMessage("");
    try {
      if (!deviceForm.device_uuid.trim()) throw new Error("Device UUID is required");
      if (!deviceForm.truck_number.trim()) throw new Error("Truck number is required");

      await adminFetch("/admin/devices/assign", {
        method: "POST",
        body: JSON.stringify({
          device_uuid: deviceForm.device_uuid.trim(),
          device_name: deviceForm.device_name.trim(),
          truck_number: deviceForm.truck_number.trim(),
        }),
      });

      setMessage("Device assigned successfully");
      setDeviceForm({ device_uuid: "", device_name: "", truck_number: "" });
      await loadAll();
    } catch (err) {
      setError(err.message || "Could not assign tablet");
    } finally {
      setAssigningDevice(false);
    }
  }

  async function deleteDriver(driverId) {
    setError("");
    setMessage("");
    try {
      await adminFetch(`/admin/drivers/${driverId}`, { method: "DELETE" });
      setMessage("Driver deleted");
      await loadAll();
    } catch (err) {
      setError(err.message || "Could not delete driver");
    }
  }

  async function deleteDevice(deviceUuid) {
    setError("");
    setMessage("");
    try {
      await adminFetch(`/admin/devices/${deviceUuid}`, { method: "DELETE" });
      setMessage("Tablet deleted");
      await loadAll();
    } catch (err) {
      setError(err.message || "Could not delete tablet");
    }
  }

  async function unassignDevice(deviceUuid) {
    setError("");
    setMessage("");
    try {
      await adminFetch(`/admin/devices/unassign/${deviceUuid}`, { method: "POST" });
      setMessage("Tablet unassigned");
      await loadAll();
    } catch (err) {
      setError(err.message || "Could not unassign tablet");
    }
  }

  function editDriver(driver) {
    setDriverForm({ name: driver.name || "", pin: driver.pin || "", active: !!driver.active });
    setEditingDriverId(driver.id);
    setError("");
    setMessage("");
  }

  if (loading) return <div className="admin-page">Loading admin data...</div>;

  return (
    <div className="admin-page">
      {error ? <div style={styles.error}>{error}</div> : null}
      {message ? <div style={styles.success}>{message}</div> : null}

      <div style={styles.grid}>
        <div style={styles.leftColumn}>
          <Section
            title={editingDriverId ? "Edit Driver" : "Create Driver"}
            right={editingDriverId ? (
              <button
                style={styles.secondaryButton}
                onClick={() => {
                  setEditingDriverId(null);
                  setDriverForm({ name: "", pin: "", active: true });
                }}
              >
                Cancel Edit
              </button>
            ) : null}
          >
            <div style={styles.formGrid}>
              <div>
                <div style={styles.label}>Driver Name</div>
                <input
                  style={styles.input}
                  value={driverForm.name}
                  onChange={(e) => setDriverForm((p) => ({ ...p, name: e.target.value }))}
                  placeholder="Driver name"
                />
              </div>
              <div>
                <div style={styles.label}>6-Digit PIN</div>
                <input
                  style={styles.input}
                  value={driverForm.pin}
                  onChange={(e) =>
                    setDriverForm((p) => ({
                      ...p,
                      pin: e.target.value.replace(/\D/g, "").slice(0, 6),
                    }))
                  }
                  placeholder="123456"
                  inputMode="numeric"
                  maxLength={6}
                />
              </div>
            </div>

            <div style={styles.checkboxRow}>
              <input
                id="driver-active"
                type="checkbox"
                checked={driverForm.active}
                onChange={(e) => setDriverForm((p) => ({ ...p, active: e.target.checked }))}
                style={styles.checkbox}
              />
              <label htmlFor="driver-active" style={styles.checkboxLabel}>
                Driver active
              </label>
            </div>

            <div style={styles.actionRow}>
              <button style={styles.primaryButton} onClick={saveDriver} disabled={savingDriver}>
                {savingDriver ? "Saving..." : editingDriverId ? "Update Driver" : "Create Driver"}
              </button>
            </div>
          </Section>

          <Section
            title={`Drivers (${drivers.length})`}
            right={<button style={styles.secondaryButton} onClick={loadAll}>Refresh</button>}
          >
            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Name</th>
                    <th style={styles.th}>PIN</th>
                    <th style={styles.th}>Active</th>
                    <th style={styles.th}>Created</th>
                    <th style={styles.th}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {drivers.map((driver) => (
                    <tr key={driver.id}>
                      <td style={styles.td}>{driver.name}</td>
                      <td style={styles.td}>{driver.pin}</td>
                      <td style={styles.td}>{driver.active ? "Yes" : "No"}</td>
                      <td style={styles.td}>{formatDateTime(driver.created_at)}</td>
                      <td style={styles.td}>
                        <div style={styles.inlineButtons}>
                          <button style={styles.smallButton} onClick={() => editDriver(driver)}>
                            Edit
                          </button>
                          <button style={styles.smallDangerButton} onClick={() => deleteDriver(driver.id)}>
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!drivers.length && (
                    <tr>
                      <td style={styles.emptyCell} colSpan={5}>No drivers found</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Section>
        </div>

        <div style={styles.rightColumn}>
          <Section title="Assign Tablet / Device">
            <div style={styles.stackGap}>
              <div>
                <div style={styles.label}>Device UUID</div>
                <input
                  style={styles.input}
                  value={deviceForm.device_uuid}
                  onChange={(e) => setDeviceForm((p) => ({ ...p, device_uuid: e.target.value }))}
                  placeholder="Paste tablet UUID"
                />
              </div>
              <div>
                <div style={styles.label}>Device Name</div>
                <input
                  style={styles.input}
                  value={deviceForm.device_name}
                  onChange={(e) => setDeviceForm((p) => ({ ...p, device_name: e.target.value }))}
                  placeholder="Tablet 101"
                />
              </div>
              <div>
                <div style={styles.label}>Truck Number</div>
                <input
                  style={styles.input}
                  value={deviceForm.truck_number}
                  onChange={(e) => setDeviceForm((p) => ({ ...p, truck_number: e.target.value }))}
                  placeholder="101"
                />
              </div>
              <button style={styles.primaryButtonFull} onClick={assignDevice} disabled={assigningDevice}>
                {assigningDevice ? "Assigning..." : "Assign Device"}
              </button>
            </div>
          </Section>

          <Section title={`Devices / Tablets • ${devices.length}`}>
            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>UUID</th>
                    <th style={styles.th}>Name</th>
                    <th style={styles.th}>Truck</th>
                    <th style={styles.th}>Driver</th>
                    <th style={styles.th}>Last Seen</th>
                    <th style={styles.th}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {devices.map((device) => (
                    <tr key={device.device_uuid}>
                      <td style={styles.td}>{device.device_uuid}</td>
                      <td style={styles.td}>{device.device_name || "-"}</td>
                      <td style={styles.td}>{device.assigned_truck_number || "-"}</td>
                      <td style={styles.td}>{device.driver_name || "-"}</td>
                      <td style={styles.td}>{formatDateTime(device.last_seen)}</td>
                      <td style={styles.td}>
                        <div style={styles.inlineButtons}>
                          <button style={styles.smallButton} onClick={() => unassignDevice(device.device_uuid)}>
                            Unassign
                          </button>
                          <button style={styles.smallDangerButton} onClick={() => deleteDevice(device.device_uuid)}>
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!devices.length && (
                    <tr>
                      <td style={styles.emptyCell} colSpan={6}>No devices yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Section>

          <Section title={`Driver Sessions (${sessions.length})`}>
            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Driver</th>
                    <th style={styles.th}>Truck</th>
                    <th style={styles.th}>Tablet UUID</th>
                    <th style={styles.th}>Signed In</th>
                    <th style={styles.th}>Signed Out</th>
                    <th style={styles.th}>Active</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((session) => (
                    <tr key={session.id}>
                      <td style={styles.td}>{session.driver_name || "-"}</td>
                      <td style={styles.td}>{session.truck_number || "-"}</td>
                      <td style={styles.td}>{session.device_uuid || "-"}</td>
                      <td style={styles.td}>{formatDateTime(session.signed_in_at)}</td>
                      <td style={styles.td}>{formatDateTime(session.signed_out_at)}</td>
                      <td style={styles.td}>{session.active ? "Yes" : "No"}</td>
                    </tr>
                  ))}
                  {!sessions.length && (
                    <tr>
                      <td style={styles.emptyCell} colSpan={6}>No sessions found</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}

const styles = {
  grid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, alignItems: "start" },
  leftColumn: { display: "flex", flexDirection: "column", gap: 16 },
  rightColumn: { display: "flex", flexDirection: "column", gap: 16 },
  sectionCard: { background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 18, padding: 20 },
  sectionHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  sectionTitle: { fontSize: 24, fontWeight: 800, color: "#fff" },
  label: { color: "#c7def5", marginBottom: 8, fontWeight: 600 },
  formGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 },
  stackGap: { display: "grid", gap: 12 },
  input: { width: "100%", height: 56, padding: "0 16px", borderRadius: 12, border: "1px solid var(--border)", background: "var(--panel-2)", color: "#fff", fontSize: 16 },
  checkboxRow: { display: "flex", alignItems: "center", gap: 10, marginTop: 14 },
  checkbox: { width: 20, height: 20, accentColor: "#ff8f3d" },
  checkboxLabel: { color: "#d9ecff", margin: 0, fontWeight: 600 },
  actionRow: { display: "flex", gap: 10, marginTop: 18 },
  primaryButton: { background: "linear-gradient(90deg, #ff7a18, #ff8f3d)", color: "#fff", border: "none", borderRadius: 12, padding: "14px 18px", fontSize: 16, fontWeight: 800, cursor: "pointer" },
  primaryButtonFull: { width: "100%", background: "linear-gradient(90deg, #ff7a18, #ff8f3d)", color: "#fff", border: "none", borderRadius: 12, padding: "14px 18px", fontSize: 16, fontWeight: 800, cursor: "pointer", marginTop: 4 },
  secondaryButton: { background: "#1d4572", color: "#fff", border: "1px solid var(--border)", borderRadius: 12, padding: "10px 14px", fontSize: 16, cursor: "pointer" },
  smallButton: { background: "#1d4572", color: "#fff", border: "1px solid var(--border)", borderRadius: 10, padding: "8px 10px", cursor: "pointer" },
  smallDangerButton: { background: "#7a2430", color: "#fff", border: "none", borderRadius: 10, padding: "8px 10px", cursor: "pointer" },
  tableWrap: { overflowX: "auto" },
  table: { width: "100%", borderCollapse: "collapse" },
  th: { textAlign: "left", color: "#b9d3ee", padding: "12px 10px", borderBottom: "1px solid rgba(255,255,255,0.1)", fontSize: 15 },
  td: { color: "#fff", padding: "14px 10px", borderBottom: "1px solid rgba(255,255,255,0.06)", fontSize: 15, verticalAlign: "top" },
  emptyCell: { color: "#b9d3ee", textAlign: "center", padding: 24 },
  inlineButtons: { display: "flex", gap: 8, flexWrap: "wrap" },
  error: { background: "rgba(127,29,29,0.25)", border: "1px solid rgba(239,68,68,0.35)", color: "#fecaca", padding: "14px 16px", borderRadius: 14, marginBottom: 16, fontWeight: 700 },
  success: { background: "rgba(6,95,70,0.35)", border: "1px solid rgba(16,185,129,0.35)", color: "#d1fae5", padding: "14px 16px", borderRadius: 14, marginBottom: 16, fontWeight: 700 },
};
