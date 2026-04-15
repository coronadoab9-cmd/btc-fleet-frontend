import { useEffect, useMemo, useRef, useState } from "react";
import {
  MapContainer,
  Marker,
  Popup,
  Polyline,
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

function RecenterMap({ trucks, selectedTruck, replayPoint, isReplayPlaying }) {
  const map = useMap();
  const hasInitialized = useRef(false);
  const lastTruckRef = useRef(null);

  useEffect(() => {
    if (!hasInitialized.current && trucks.length > 0) {
      const first = trucks[0];
      map.setView([first.latitude, first.longitude], 11);
      hasInitialized.current = true;
    }
  }, [trucks, map]);

  useEffect(() => {
    if (
      selectedTruck &&
      selectedTruck.truck_number !== lastTruckRef.current &&
      !isReplayPlaying
    ) {
      map.setView([selectedTruck.latitude, selectedTruck.longitude], 15);
      lastTruckRef.current = selectedTruck.truck_number;
    }
  }, [selectedTruck, isReplayPlaying, map]);

  useEffect(() => {
    if (isReplayPlaying && replayPoint) {
      map.panTo(replayPoint);
    }
  }, [replayPoint, isReplayPlaying, map]);

  return null;
}

function getStatusClass(status) {
  const s = (status || "").toLowerCase();

  if (s.includes("plant")) return "status-plant";
  if (s.includes("route")) return "status-route";
  if (s.includes("pour")) return "status-pouring";
  if (s.includes("return")) return "status-returning";
  if (s.includes("idle")) return "status-idle";
  if (s.includes("service")) return "status-default";
  return "status-default";
}

function formatMetric(value, suffix = " min") {
  if (value === null || value === undefined || value === "") return "-";
  return `${value}${suffix}`;
}

function formatPercent(value) {
  if (value === null || value === undefined || isNaN(Number(value))) return "0%";
  return `${Number(value).toFixed(1)}%`;
}

export default function TruckMap() {
  const [trucks, setTrucks] = useState([]);
  const [truckNumber, setTruckNumber] = useState("");
  const [jobNumber, setJobNumber] = useState("");
  const [address, setAddress] = useState("");
  const [orderedQty, setOrderedQty] = useState("");
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [selectedTruckNumber, setSelectedTruckNumber] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [truckHistory, setTruckHistory] = useState([]);
  const [truckEvents, setTruckEvents] = useState([]);
  const [truckDetails, setTruckDetails] = useState(null);
  const [truckMetrics, setTruckMetrics] = useState(null);
  const [isReplayPlaying, setIsReplayPlaying] = useState(false);
  const [replayIndex, setReplayIndex] = useState(0);

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

  useEffect(() => {
    async function fetchSelectedTruckData() {
      if (!selectedTruckNumber) {
        setTruckHistory([]);
        setTruckEvents([]);
        setTruckDetails(null);
        setTruckMetrics(null);
        return;
      }

      try {
        const [historyRes, eventsRes, detailsRes, metricsRes] = await Promise.all([
          fetch(`${API_BASE}/trucks/history/${selectedTruckNumber}?limit=25`),
          fetch(`${API_BASE}/trucks/events/${selectedTruckNumber}?limit=20`),
          fetch(`${API_BASE}/trucks/details/${selectedTruckNumber}`),
          fetch(`${API_BASE}/trucks/metrics/${selectedTruckNumber}`),
        ]);

        const historyData = await historyRes.json();
        const eventsData = await eventsRes.json();
        const detailsData = await detailsRes.json();
        const metricsData = await metricsRes.json();

        setTruckHistory(historyData);
        setTruckEvents(eventsData);
        setTruckDetails(detailsData);
        setTruckMetrics(metricsData);
      } catch (err) {
        console.error("Failed to fetch selected truck data:", err);
      }
    }

    fetchSelectedTruckData();
  }, [selectedTruckNumber]);

  useEffect(() => {
    setReplayIndex(0);
    setIsReplayPlaying(false);
  }, [selectedTruckNumber]);

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

  const routePositions = useMemo(() => {
    if (!truckHistory || truckHistory.length === 0) return [];

    return [...truckHistory]
      .reverse()
      .filter(
        (point) =>
          point.latitude !== null &&
          point.longitude !== null &&
          !isNaN(Number(point.latitude)) &&
          !isNaN(Number(point.longitude))
      )
      .map((point) => [Number(point.latitude), Number(point.longitude)]);
  }, [truckHistory]);

  const replayPoint =
    routePositions.length > 0 &&
    replayIndex >= 0 &&
    replayIndex < routePositions.length
      ? routePositions[replayIndex]
      : null;

  useEffect(() => {
    if (!isReplayPlaying) return;
    if (routePositions.length <= 1) return;

    const id = setInterval(() => {
      setReplayIndex((prev) => {
        if (prev >= routePositions.length - 1) {
          setIsReplayPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, 700);

    return () => clearInterval(id);
  }, [isReplayPlaying, routePositions]);

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
          ordered_qty: orderedQty === "" ? 0 : Number(orderedQty),
        }),
      });

      if (!res.ok) {
        setMessage("Failed to assign job.");
        return;
      }

      setMessage(`Assigned ${address} to truck ${truckNumber}`);
      setAddress("");
      setJobNumber("");
      setOrderedQty("");

      await fetchTrucks();

      if (selectedTruckNumber === truckNumber) {
        const [historyRes, eventsRes, detailsRes, metricsRes] = await Promise.all([
          fetch(`${API_BASE}/trucks/history/${truckNumber}?limit=25`),
          fetch(`${API_BASE}/trucks/events/${truckNumber}?limit=20`),
          fetch(`${API_BASE}/trucks/details/${truckNumber}`),
          fetch(`${API_BASE}/trucks/metrics/${truckNumber}`),
        ]);

        setTruckHistory(await historyRes.json());
        setTruckEvents(await eventsRes.json());
        setTruckDetails(await detailsRes.json());
        setTruckMetrics(await metricsRes.json());
      }
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
        setTruckHistory([]);
        setTruckEvents([]);
        setTruckDetails(null);
        setTruckMetrics(null);
      }
    } catch (err) {
      console.error(err);
    }
  }

  async function completeJob(truckNum) {
    try {
      const res = await fetch(`${API_BASE}/jobs/complete/${truckNum}`, {
        method: "POST",
      });

      if (!res.ok) {
        const text = await res.text();
        console.error("Complete job failed:", text);
        return;
      }

      setMessage(`Completed job for truck ${truckNum}`);

      setTrucks((prev) =>
        prev.map((t) =>
          t.truck_number === truckNum
            ? { ...t, job_number: "", status: "Idle" }
            : t
        )
      );

      if (selectedTruckNumber === truckNum) {
        setJobNumber("");
      }

      await fetchTrucks();

      if (selectedTruckNumber === truckNum) {
        const [historyRes, eventsRes, detailsRes, metricsRes] = await Promise.all([
          fetch(`${API_BASE}/trucks/history/${truckNum}?limit=25`),
          fetch(`${API_BASE}/trucks/events/${truckNum}?limit=20`),
          fetch(`${API_BASE}/trucks/details/${truckNum}`),
          fetch(`${API_BASE}/trucks/metrics/${truckNum}`),
        ]);

        setTruckHistory(await historyRes.json());
        setTruckEvents(await eventsRes.json());
        setTruckDetails(await detailsRes.json());
        setTruckMetrics(await metricsRes.json());
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

  const selectedJob = truckDetails?.job || null;
  const selectedLiveTruck = truckDetails?.truck || null;

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
            placeholder="Search truck, order, job, or status"
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

                <label>Ordered Qty</label>
                <input
                  value={orderedQty}
                  onChange={(e) => setOrderedQty(e.target.value)}
                  placeholder="Ex: 50"
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
                  replayPoint={replayPoint}
                  isReplayPlaying={isReplayPlaying}
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

                {routePositions.length > 1 && (
                  <Polyline
                    positions={routePositions}
                    pathOptions={{
                      color: "#f97316",
                      weight: 4,
                      opacity: 0.85,
                    }}
                  />
                )}

                {replayPoint && (
                  <Marker position={replayPoint}>
                    <Popup>
                      Replay Position
                      <br />
                      Point {replayIndex + 1} of {routePositions.length}
                    </Popup>
                  </Marker>
                )}
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

                  <div className="asset-actions">
                    <button
                      type="button"
                      className="primary-btn"
                      onClick={() => completeJob(selectedTruck.truck_number)}
                    >
                      Complete Job
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="panel-card">
              <div className="panel-title">Job Location</div>

              {!selectedJob && (
                <div className="empty-state">No active job assigned.</div>
              )}

              {selectedJob && (
                <div className="asset-details">
                  <div className="asset-row">
                    <span>Address</span>
                    <strong>{selectedJob.address || "-"}</strong>
                  </div>
                  <div className="asset-row">
                    <span>Job Number</span>
                    <strong>{selectedJob.job_number || "-"}</strong>
                  </div>
                  <div className="asset-row">
                    <span>Ordered</span>
                    <strong>{selectedJob.ordered_qty ?? 0}</strong>
                  </div>
                  <div className="asset-row">
                    <span>Delivered</span>
                    <strong>{selectedJob.delivered_qty ?? 0}</strong>
                  </div>
                  <div className="asset-row">
                    <span>Assigned</span>
                    <strong>{selectedJob.assigned_at || "-"}</strong>
                  </div>
                </div>
              )}
            </div>

            <div className="panel-card">
              <div className="panel-title">Current Truck Location</div>

              {!selectedLiveTruck && (
                <div className="empty-state">No live truck selected.</div>
              )}

              {selectedLiveTruck && (
                <div className="asset-details">
                  <div className="asset-row">
                    <span>Location</span>
                    <strong>
                      {selectedLiveTruck.latitude}, {selectedLiveTruck.longitude}
                    </strong>
                  </div>
                  <div className="asset-row">
                    <span>Last GPS Signal</span>
                    <strong>
                      {truckDetails?.last_gps_signal_minutes_ago ?? "-"} min ago
                    </strong>
                  </div>
                  <div className="asset-row">
                    <span>Status</span>
                    <strong>{selectedLiveTruck.status || "-"}</strong>
                  </div>
                </div>
              )}
            </div>

            <div className="panel-card">
              <div className="panel-title">Job Metrics</div>

              {!selectedTruck && (
                <div className="empty-state">
                  Select a truck to view metrics.
                </div>
              )}

              {selectedTruck && (
                <div className="metrics-grid">
                  <div className="metric-card">
                    <div className="metric-value">
                      {formatPercent(truckMetrics?.delivered_percent)}
                    </div>
                    <div className="metric-label">Delivered</div>
                  </div>

                  <div className="metric-card">
                    <div className="metric-value">
                      {truckMetrics?.delivered_qty ?? 0}/{truckMetrics?.ordered_qty ?? 0}
                    </div>
                    <div className="metric-label">Delivered / Ordered</div>
                  </div>

                  <div className="metric-card">
                    <div className="metric-value">
                      {formatMetric(truckMetrics?.time_to_job_minutes)}
                    </div>
                    <div className="metric-label">Time to Job</div>
                  </div>

                  <div className="metric-card">
                    <div className="metric-value">
                      {formatMetric(truckMetrics?.waiting_minutes)}
                    </div>
                    <div className="metric-label">Waiting</div>
                  </div>

                  <div className="metric-card">
                    <div className="metric-value">
                      {formatMetric(truckMetrics?.pouring_minutes)}
                    </div>
                    <div className="metric-label">Pouring</div>
                  </div>

                  <div className="metric-card">
                    <div className="metric-value">
                      {formatMetric(truckMetrics?.after_pour_minutes)}
                    </div>
                    <div className="metric-label">After Pour</div>
                  </div>
                </div>
              )}
            </div>

            <div className="panel-card">
              <div className="panel-title">Recent Activity</div>

              {!selectedTruck && (
                <div className="empty-state">
                  Select a truck to view history.
                </div>
              )}

              {selectedTruck && routePositions.length > 1 && (
                <div className="route-summary">
                  Showing recent route with {routePositions.length} points
                </div>
              )}

              {selectedTruck && (
                <div className="history-list">
                  {truckEvents.length === 0 && truckHistory.length === 0 && (
                    <div className="empty-state">No history yet.</div>
                  )}

                  {truckEvents.map((event, index) => (
                    <div key={`event-${index}`} className="history-item">
                      <div className="history-type">
                        {event.event_type.replaceAll("_", " ")}
                      </div>
                      <div className="history-details">{event.details}</div>
                      <div className="history-time">{event.created_at}</div>
                    </div>
                  ))}

                  {truckHistory.map((item, index) => (
                    <div key={`history-${index}`} className="history-item">
                      <div className="history-type">GPS update</div>
                      <div className="history-details">
                        {item.status || "-"} | Job {item.job_number || "-"}
                        <br />
                        {item.latitude}, {item.longitude}
                      </div>
                      <div className="history-time">{item.recorded_at}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="panel-card">
              <div className="panel-title">Route Replay</div>

              {!selectedTruck && (
                <div className="empty-state">
                  Select a truck to replay its route.
                </div>
              )}

              {selectedTruck && routePositions.length <= 1 && (
                <div className="empty-state">
                  Not enough route points yet to replay.
                </div>
              )}

              {selectedTruck && routePositions.length > 1 && (
                <>
                  <div className="replay-stats">
                    Point {replayIndex + 1} of {routePositions.length}
                  </div>

                  <input
                    className="replay-slider"
                    type="range"
                    min="0"
                    max={routePositions.length - 1}
                    value={replayIndex}
                    onChange={(e) => {
                      setReplayIndex(Number(e.target.value));
                      setIsReplayPlaying(false);
                    }}
                  />

                  <div className="replay-controls">
                    <button
                      className="primary-btn"
                      type="button"
                      onClick={() => setIsReplayPlaying(true)}
                    >
                      Play Replay
                    </button>

                    <button
                      className="secondary-btn"
                      type="button"
                      onClick={() => setIsReplayPlaying(false)}
                    >
                      Pause
                    </button>

                    <button
                      className="secondary-btn"
                      type="button"
                      onClick={() => {
                        setIsReplayPlaying(false);
                        setReplayIndex(0);
                      }}
                    >
                      Reset
                    </button>
                  </div>
                </>
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