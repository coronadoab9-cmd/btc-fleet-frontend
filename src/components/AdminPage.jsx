import { useEffect, useState } from "react";

const API_BASE = "https://fleet.btcfleet.app";
const LOCAL_API_BASE = "http://127.0.0.1:8000";

export default function AdminPage({ token }) {
  const [drivers, setDrivers] = useState([]);
  const [devices, setDevices] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [etickets, setEtickets] = useState([]);

  const [driverName, setDriverName] = useState("");
  const [driverPin, setDriverPin] = useState("");

  const [deviceUuid, setDeviceUuid] = useState("");
  const [deviceName, setDeviceName] = useState("");
  const [truckNumber, setTruckNumber] = useState("");

  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("info");
  const [loading, setLoading] = useState(false);

  function setFlash(msg, type = "info") {
    setMessage(msg);
    setMessageType(type);
  }

  async function safeJson(res) {
    try {
      return await res.json();
    } catch {
      return {};
    }
  }

  function formatSignedDate(value) {
    if (!value) return "-";
    try {
      return new Date(value).toLocaleString();
    } catch {
      return value;
    }
  }

  async function load() {
    setLoading(true);

    try {
      const headers = { "X-Admin-Token": token };

      const [driversRes, devicesRes, sessionsRes, eticketsRes] = await Promise.all([
        fetch(`${API_BASE}/admin/drivers`, { headers }),
        fetch(`${API_BASE}/admin/devices`, { headers }),
        fetch(`${API_BASE}/admin/sessions`, { headers }),
        fetch(`${LOCAL_API_BASE}/api/etickets`),
      ]);

      if (!driversRes.ok || !devicesRes.ok || !sessionsRes.ok || !eticketsRes.ok) {
        setFlash("Failed to load admin data", "error");
        setLoading(false);
        return;
      }

      setDrivers(await driversRes.json());
      setDevices(await devicesRes.json());
      setSessions(await sessionsRes.json());
      setEtickets(await eticketsRes.json());
    } catch {
      setFlash("Could not reach server", "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function createDriver(e) {
    e.preventDefault();
    setFlash("");

    try {
      const res = await fetch(`${API_BASE}/admin/drivers`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Admin-Token": token,
        },
        body: JSON.stringify({
          name: driverName,
          pin: driverPin,
          active: true,
        }),
      });

      const data = await safeJson(res);

      if (!res.ok) {
        setFlash(data.detail || "Failed to create driver", "error");
        return;
      }

      setDriverName("");
      setDriverPin("");
      setFlash("Driver created", "success");
      await load();
    } catch {
      setFlash("Could not reach server", "error");
    }
  }

  async function updateDriver(driver) {
    const newName = prompt("Driver name", driver.name);
    if (newName === null) return;

    const newPin = prompt("Enter new 6-digit PIN", driver.pin);
    if (newPin === null) return;

    try {
      const res = await fetch(`${API_BASE}/admin/drivers/${driver.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-Admin-Token": token,
        },
        body: JSON.stringify({
          name: newName,
          pin: newPin,
          active: Boolean(driver.active),
        }),
      });

      const data = await safeJson(res);

      if (!res.ok) {
        setFlash(data.detail || "Failed to update driver", "error");
        return;
      }

      setFlash(`Updated ${newName}`, "success");
      await load();
    } catch {
      setFlash("Could not reach server", "error");
    }
  }

  async function deleteDriver(driver) {
    const confirmed = window.confirm(`Delete driver ${driver.name}?`);
    if (!confirmed) return;

    try {
      const res = await fetch(`${API_BASE}/admin/drivers/${driver.id}`, {
        method: "DELETE",
        headers: {
          "X-Admin-Token": token,
        },
      });

      const data = await safeJson(res);

      if (!res.ok) {
        setFlash(data.detail || "Failed to delete driver", "error");
        return;
      }

      setFlash(`Deleted ${driver.name}`, "success");
      await load();
    } catch {
      setFlash("Could not reach server", "error");
    }
  }

  async function assignDevice(e) {
    e.preventDefault();
    setFlash("");

    try {
      const res = await fetch(`${API_BASE}/admin/devices/assign`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Admin-Token": token,
        },
        body: JSON.stringify({
          device_uuid: deviceUuid,
          device_name: deviceName,
          truck_number: truckNumber,
        }),
      });

      const data = await safeJson(res);

      if (!res.ok) {
        setFlash(data.detail || "Failed to assign device", "error");
        return;
      }

      setDeviceUuid("");
      setDeviceName("");
      setTruckNumber("");
      setFlash("Device assigned", "success");
      await load();
    } catch {
      setFlash("Could not reach server", "error");
    }
  }

  async function unassignDevice(uuid) {
    const confirmed = window.confirm("Unassign this device from its truck?");
    if (!confirmed) return;

    try {
      const res = await fetch(`${API_BASE}/admin/devices/unassign/${uuid}`, {
        method: "POST",
        headers: {
          "X-Admin-Token": token,
        },
      });

      const data = await safeJson(res);

      if (!res.ok) {
        setFlash(data.detail || "Failed to unassign device", "error");
        return;
      }

      setFlash("Device unassigned", "success");
      await load();
    } catch {
      setFlash("Could not reach server", "error");
    }
  }

  async function deleteDevice(uuid) {
    const confirmed = window.confirm("Delete this tablet/device completely?");
    if (!confirmed) return;

    try {
      const res = await fetch(`${API_BASE}/admin/devices/${uuid}`, {
        method: "DELETE",
        headers: {
          "X-Admin-Token": token,
        },
      });

      const data = await safeJson(res);

      if (!res.ok) {
        setFlash(data.detail || "Failed to delete device", "error");
        return;
      }

      setFlash("Device deleted", "success");
      await load();
    } catch {
      setFlash("Could not reach server", "error");
    }
  }

  async function copyETicketLink(eticket) {
    const link = `http://localhost:5173/eticket/${eticket.token}`;
    try {
      await navigator.clipboard.writeText(link);
      setFlash("eTicket link copied", "success");
    } catch {
      setFlash("Could not copy link", "error");
    }
  }

  function openETicket(eticket) {
    const link = `http://localhost:5173/eticket/${eticket.token}`;
    window.open(link, "_blank");
  }

  function downloadPdf(eticket) {
    const link = `${LOCAL_API_BASE}/api/etickets/${eticket.token}/pdf`;
    window.open(link, "_blank");
  }

  function getETicketStatusClass(status) {
    return status === "signed" ? "status-plant" : "status-route";
  }

  return (
    <div className="admin-page">
      <div className="admin-grid">
        <div className="panel-card">
          <div className="panel-title">Create Driver</div>

          <form onSubmit={createDriver}>
            <label>Driver Name</label>
            <input
              value={driverName}
              onChange={(e) => setDriverName(e.target.value)}
              placeholder="Driver name"
            />

            <label>6-Digit PIN</label>
            <input
              value={driverPin}
              onChange={(e) => setDriverPin(e.target.value)}
              placeholder="123456"
            />

            <button type="submit" className="primary-btn">
              Add Driver
            </button>
          </form>

          {message && (
            <div
              className="message-box"
              style={{
                color:
                  messageType === "error"
                    ? "#ffb5bf"
                    : messageType === "success"
                    ? "#b8ffd7"
                    : "#bde9ff",
              }}
            >
              {message}
            </div>
          )}
        </div>

        <div className="panel-card">
          <div className="panel-title">Assign Tablet / Device</div>

          <form onSubmit={assignDevice}>
            <label>Device UUID</label>
            <input
              value={deviceUuid}
              onChange={(e) => setDeviceUuid(e.target.value)}
              placeholder="Paste tablet UUID"
            />

            <label>Device Name</label>
            <input
              value={deviceName}
              onChange={(e) => setDeviceName(e.target.value)}
              placeholder="Tablet 101"
            />

            <label>Truck Number</label>
            <input
              value={truckNumber}
              onChange={(e) => setTruckNumber(e.target.value)}
              placeholder="101"
            />

            <button type="submit" className="primary-btn">
              Assign Device
            </button>
          </form>
        </div>

        <div className="panel-card">
          <div className="panel-title">
            Drivers {loading ? "• Loading..." : `• ${drivers.length}`}
          </div>

          <div className="admin-list">
            {drivers.length === 0 && <div className="empty-state">No drivers yet.</div>}

            {drivers.map((d) => (
              <div key={d.id} className="admin-list-item">
                <div><strong>{d.name}</strong></div>
                <div>PIN: {d.pin}</div>
                <div>Active: {String(d.active)}</div>

                <div className="admin-actions">
                  <button
                    className="secondary-btn"
                    onClick={() => updateDriver(d)}
                  >
                    Edit
                  </button>

                  <button
                    className="danger-btn"
                    onClick={() => deleteDriver(d)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="panel-card">
          <div className="panel-title">
            Devices / Tablets {loading ? "• Loading..." : `• ${devices.length}`}
          </div>

          <div className="admin-list">
            {devices.length === 0 && <div className="empty-state">No devices yet.</div>}

            {devices.map((d) => (
              <div key={d.device_uuid} className="admin-list-item">
                <div><strong>{d.device_name || "Tablet"}</strong></div>
                <div>UUID: {d.device_uuid}</div>
                <div>Truck: {d.assigned_truck_number || "-"}</div>
                <div>Driver: {d.driver_name || "-"}</div>
                <div>Last Seen: {d.last_seen || "-"}</div>
                <div>Active: {String(d.active)}</div>

                <div className="admin-actions">
                  <button
                    className="secondary-btn"
                    onClick={() => unassignDevice(d.device_uuid)}
                  >
                    Unassign
                  </button>

                  <button
                    className="danger-btn"
                    onClick={() => deleteDevice(d.device_uuid)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="panel-card admin-span-2">
          <div className="panel-title">
            eTickets {loading ? "• Loading..." : `• ${etickets.length}`}
          </div>

          <div className="admin-list">
            {etickets.length === 0 && <div className="empty-state">No eTickets yet.</div>}

            {etickets.map((t) => (
              <div key={t.id} className="admin-list-item">
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                  <strong>{t.ticket_number || `Ticket ${t.id}`}</strong>
                  <span className={`status-pill ${getETicketStatusClass(t.status)}`}>
                    {t.status || "pending"}
                  </span>
                </div>

                <div>Customer: {t.customer_name || "-"}</div>
                <div>Address: {t.address || "-"}</div>
                <div>Truck: {t.truck_number || "-"}</div>
                <div>Product: {t.product || "-"}</div>
                <div>Quantity: {t.quantity ?? "-"}</div>
                <div>Signed By: {t.signed_name || "-"}</div>
                <div>Signed At: {formatSignedDate(t.signed_at)}</div>
                <div>Acceptance: {t.ticket_acceptance || "-"}</div>

                <div className="admin-actions">
                  <button
                    className="secondary-btn"
                    onClick={() => copyETicketLink(t)}
                  >
                    Copy Link
                  </button>

                  <button
                    className="secondary-btn"
                    onClick={() => openETicket(t)}
                  >
                    Open
                  </button>

                  {t.status === "signed" && (
                    <button
                      className="primary-btn"
                      style={{ marginTop: 0, width: "auto", padding: "8px 12px" }}
                      onClick={() => downloadPdf(t)}
                    >
                      PDF
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="panel-card admin-span-2">
          <div className="panel-title">
            Driver Sessions / Timestamps {loading ? "• Loading..." : `• ${sessions.length}`}
          </div>

          <div className="admin-list">
            {sessions.length === 0 && <div className="empty-state">No sessions yet.</div>}

            {sessions.map((s) => (
              <div key={s.id} className="admin-list-item">
                <div><strong>{s.driver_name || "-"}</strong></div>
                <div>Truck: {s.truck_number || "-"}</div>
                <div>Device: {s.device_uuid}</div>
                <div>Signed In: {s.signed_in_at || "-"}</div>
                <div>Signed Out: {s.signed_out_at || "-"}</div>
                <div>Active: {String(s.active)}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="panel-card admin-span-2">
          <button className="primary-btn" onClick={load}>
            Refresh Admin Data
          </button>
        </div>
      </div>
    </div>
  );
}