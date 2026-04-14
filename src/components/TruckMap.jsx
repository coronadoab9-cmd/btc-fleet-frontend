import { useEffect, useMemo, useRef, useState } from "react";
import {
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "../index.css";

const API_BASE = "https://fleet.btcfleet.app";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

function RecenterMap({ trucks, selectedTruck }) {
  const map = useMap();

  const hasInitialized = useRef(false);
  const lastTruckRef = useRef(null);

  useEffect(() => {
    // FIRST LOAD ONLY
    if (!hasInitialized.current && trucks.length > 0) {
      const first = trucks[0];
      map.setView([first.latitude, first.longitude], 11);
      hasInitialized.current = true;
    }
  }, [trucks, map]);

  useEffect(() => {
    // ONLY recenter if user selects a NEW truck
    if (
      selectedTruck &&
      selectedTruck.truck_number !== lastTruckRef.current
    ) {
      map.setView([selectedTruck.latitude, selectedTruck.longitude], 15);
      lastTruckRef.current = selectedTruck.truck_number;
    }
  }, [selectedTruck, map]);

  return null;
}

function getStatusClass(status) {
  const s = (status || "").toLowerCase();

  if (s.includes("plant")) return "status-plant";
  if (s.includes("route")) return "status-route";
  if (s.includes("pour")) return "status-pouring";
  if (s.includes("return")) return "status-returning";
  if (s.includes("idle")) return "status-idle";
  return "status-default";
}

export default function TruckMap() {
  const [trucks, setTrucks] = useState([]);
  const [truckNumber, setTruckNumber] = useState("");
  const [jobNumber, setJobNumber] = useState("");
  const [address, setAddress] = useState("");
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [selectedTruckNumber, setSelectedTruckNumber] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);

  async function fetchTrucks() {
    try {
      const res = await fetch(`${API_BASE}/trucks/live`);
      const data = await res.json();

      const cleaned = data
        .filter(
          (t) =>
            t.latitude !== null &&
            t.longitude !== null &&
            !isNaN(Number(t.latitude)) &&
            !isNaN(Number(t.longitude))
        )
        .map((t) => ({
          ...t,
          latitude: Number(t.latitude),
          longitude: Number(t.longitude),
        }));

      setTrucks(cleaned);
    } catch (e) {
      console.error("Failed to fetch trucks:", e);
    }
  }

  useEffect(() => {
    fetchTrucks();
    const id = setInterval(fetchTrucks, 5000);
    return () => clearInterval(id);
  }, []);

  const filteredTrucks = useMemo(() => {
    return trucks.filter((truck) => {
      const matchesSearch =
        !search.trim() ||
        truck.truck_number.toLowerCase().includes(search.toLowerCase()) ||
        (truck.job_number || "").toLowerCase().includes(search.toLowerCase()) ||
        (truck.status || "").toLowerCase().includes(search.toLowerCase());

      const matchesStatus =
        statusFilter === "All" || truck.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [trucks, search, statusFilter]);

  const selectedTruck =
    filteredTrucks.find((t) => t.truck_number === selectedTruckNumber) ||
    trucks.find((t) => t.truck_number === selectedTruckNumber) ||
    null;

  const truckOptions = useMemo(
    () => trucks.map((t) => t.truck_number).sort(),
    [trucks]
  );

  const statusOptions = useMemo(() => {
    const unique = [...new Set(trucks.map((t) => t.status).filter(Boolean))];
    return ["All", ...unique];
  }, [trucks]);

  async function assignJob(e) {
    e.preventDefault();

    if (!truckNumber || !address) {
      setMessage("Truck and address are required.");
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/jobs/assign`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          truck_number: truckNumber,
          job_number: jobNumber,
          address,
        }),
      });

      if (!res.ok) {
        setMessage("Failed to assign job.");
        return;
      }

      setMessage(`Assigned ${address} to truck ${truckNumber}`);
      setAddress("");
      setJobNumber("");
    } catch (err) {
      console.error(err);
      setMessage("Failed to assign job.");
    }
  }

  async function deleteTruck(truckNum) {
    try {
      const res = await fetch(`${API_BASE}/trucks/${truckNum}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const text = await res.text();
        console.error("Delete failed:", text);
        return;
      }

      setTrucks((prev) => prev.filter((t) => t.truck_number !== truckNum));

      if (selectedTruckNumber === truckNum) {
        setSelectedTruckNumber("");
      }
    } catch (err) {
      console.error(err);
    }
  }

  function selectTruck(truck) {
    setSelectedTruckNumber(truck.truck_number);
    setTruckNumber(truck.truck_number);
    setJobNumber(truck.job_number || "");
  }

  return (
    <div className="fleet-shell">
      <aside className={`fleet-sidebar ${sidebarOpen ? "" : "collapsed"}`}>
        <div className="sidebar-brand">
          <button
            className="menu-button"
            onClick={() => setSidebarOpen((prev) => !prev)}
          >
            ☰
          </button>
          {sidebarOpen && <div className="brand-text">BTC Fleet</div>}
        </div>

        {sidebarOpen && (
          <div className="sidebar-sections">
            <div className="sidebar-section">
              <div className="sidebar-title">Dashboard</div>
              <div className="sidebar-link active">Map</div>
              <div className="sidebar-link">Replay</div>
              <div className="sidebar-link">Reports</div>
            </div>

            <div className="sidebar-section">
              <div className="sidebar-title">Driver</div>
              <div className="sidebar-link">Time Clock</div>
              <div className="sidebar-link">HOS</div>
              <div className="sidebar-link">DVIR</div>
            </div>
          </div>
        )}
      </aside>

      <div className="fleet-main">
        <header className="fleet-header">
          <div className="header-left">
            <div className="header-logo">BTC FLEET</div>
            <div className="header-divider" />
            <div className="header-company">Big Town Concrete</div>
          </div>
          <div className="header-right">
            <div className="header-user">Logged In As Adam Coronado</div>
          </div>
        </header>

        <div className="toolbar">
          <input
            className="toolbar-search"
            placeholder="Search truck, point, order, job, or driver"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <select
            className="toolbar-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            {statusOptions.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>

          <div className="toolbar-stat">
            <div className="toolbar-stat-number">{filteredTrucks.length}</div>
            <div className="toolbar-stat-label">Truck Status</div>
          </div>
        </div>

        <div className="fleet-content">
          <div className="left-panel">
            <div className="panel-card">
              <div className="panel-title">Assign Job</div>

              <form onSubmit={assignJob}>
                <label>Truck</label>
                <select
                  value={truckNumber}
                  onChange={(e) => setTruckNumber(e.target.value)}
                >
                  <option value="">Select truck</option>
                  {truckOptions.map((num) => (
                    <option key={num} value={num}>
                      {num}
                    </option>
                  ))}
                </select>

                <label>Job Number</label>
                <input
                  value={jobNumber}
                  onChange={(e) => setJobNumber(e.target.value)}
                  placeholder="Optional job number"
                />

                <label>Address</label>
                <input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="123 Main St, Dallas, TX"
                />

                <button type="submit" className="primary-btn">
                  Assign Address
                </button>
              </form>

              {message && <div className="message-box">{message}</div>}
            </div>

            <div className="panel-card">
              <div className="panel-title">Live Trucks</div>

              {filteredTrucks.length === 0 && (
                <div className="empty-state">No trucks yet.</div>
              )}

              <div className="truck-list">
                {filteredTrucks.map((truck) => (
                  <div
                    key={truck.truck_number}
                    className={`truck-card ${
                      selectedTruckNumber === truck.truck_number
                        ? "selected"
                        : ""
                    }`}
                    onClick={() => selectTruck(truck)}
                  >
                    <div className="truck-card-top">
                      <div className="truck-number">Truck {truck.truck_number}</div>
                      <div className={`status-pill ${getStatusClass(truck.status)}`}>
                        {truck.status || "Unknown"}
                      </div>
                    </div>

                    <div className="truck-meta">
                      <div>Job: {truck.job_number || "-"}</div>
                      <div>Lat: {truck.latitude.toFixed(5)}</div>
                      <div>Lng: {truck.longitude.toFixed(5)}</div>
                    </div>

                    <div className="truck-actions">
                      <button
                        type="button"
                        className="secondary-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          selectTruck(truck);
                        }}
                      >
                        Focus
                      </button>

                      <button
                        type="button"
                        className="danger-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteTruck(truck.truck_number);
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="map-panel">
            <div className="map-shell">
              <MapContainer
                center={[32.7767, -96.797]}
                zoom={10}
                style={{ height: "100%", width: "100%" }}
              >
                <TileLayer
                  attribution="&copy; OpenStreetMap contributors"
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                <RecenterMap
                  trucks={filteredTrucks}
                  selectedTruck={selectedTruck}
                />

                {filteredTrucks.map((truck) => (
                  <Marker
                    key={truck.truck_number}
                    position={[truck.latitude, truck.longitude]}
                    eventHandlers={{
                      click: () => selectTruck(truck),
                    }}
                  >
                    <Popup>
                      <div>
                        <strong>Truck {truck.truck_number}</strong>
                        <br />
                        Status: {truck.status}
                        <br />
                        Job: {truck.job_number || "-"}
                      </div>
                    </Popup>
                  </Marker>
                ))}
              </MapContainer>
            </div>
          </div>

          <div className="right-panel">
            <div className="panel-card">
              <div className="panel-title">Selected Asset</div>

              {!selectedTruck && (
                <div className="empty-state">
                  Select a truck from the list or map.
                </div>
              )}

              {selectedTruck && (
                <div className="asset-details">
                  <div className="asset-row">
                    <span>Truck</span>
                    <strong>{selectedTruck.truck_number}</strong>
                  </div>
                  <div className="asset-row">
                    <span>Status</span>
                    <strong>{selectedTruck.status || "-"}</strong>
                  </div>
                  <div className="asset-row">
                    <span>Job</span>
                    <strong>{selectedTruck.job_number || "-"}</strong>
                  </div>
                  <div className="asset-row">
                    <span>Latitude</span>
                    <strong>{selectedTruck.latitude}</strong>
                  </div>
                  <div className="asset-row">
                    <span>Longitude</span>
                    <strong>{selectedTruck.longitude}</strong>
                  </div>
                  <div className="asset-row">
                    <span>Last Updated</span>
                    <strong>{selectedTruck.last_updated || "-"}</strong>
                  </div>
                </div>
              )}
            </div>

            <div className="panel-card">
              <div className="panel-title">Quick Filters</div>
              <div className="quick-filter-grid">
                <button
                  className="filter-chip"
                  onClick={() => setStatusFilter("All")}
                >
                  All
                </button>
                <button
                  className="filter-chip"
                  onClick={() => setStatusFilter("At Plant")}
                >
                  At Plant
                </button>
                <button
                  className="filter-chip"
                  onClick={() => setStatusFilter("En Route")}
                >
                  En Route
                </button>
                <button
                  className="filter-chip"
                  onClick={() => setStatusFilter("Pouring")}
                >
                  Pouring
                </button>
                <button
                  className="filter-chip"
                  onClick={() => setStatusFilter("Returning")}
                >
                  Returning
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}