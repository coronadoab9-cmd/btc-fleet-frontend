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

import { getApiBase } from "../lib/api";

const PLANT_OPTIONS = [
  "BTS-01A - CX",
  "BTS-002 - BM",
  "BTS-003 - Sherman",
  "BTP-001",
  "BTP-004",
];

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

function RefreshMapSize({ selectedTruckNumber, truckCount }) {
  const map = useMap();

  useEffect(() => {
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 120);

    return () => clearTimeout(timer);
  }, [map, selectedTruckNumber, truckCount]);

  return null;
}

function getStatusClass(status) {
  const s = (status || "").toLowerCase();
  if (s.includes("plant")) return "status-plant";
  if (s.includes("route")) return "status-route";
  if (s.includes("pour")) return "status-pouring";
  if (s.includes("return")) return "status-returning";
  if (s.includes("idle")) return "status-idle";
  if (s.includes("service")) return "status-danger";
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

function formatSpeed(value) {
  const num = Number(value ?? 0);
  if (isNaN(num)) return "0.0 mph";
  return `${num.toFixed(1)} mph`;
}

function makeTicketNumber(truckNumber, jobNumber) {
  const stamp = Date.now().toString();
  const truckPart =
    String(truckNumber || "000").replace(/\D/g, "").slice(0, 4) || "000";
  const jobPart =
    String(jobNumber || "000").replace(/\D/g, "").slice(0, 6) || "000";
  return `${truckPart}${jobPart}${stamp.slice(-6)}`;
}

export default function TruckMap() {
  const [trucks, setTrucks] = useState([]);
  const [truckNumber, setTruckNumber] = useState("");
  const [jobNumber, setJobNumber] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [address, setAddress] = useState("");
  const [plant, setPlant] = useState("BTS-01A - CX");
  const [product, setProduct] = useState("");
  const [mixNumber, setMixNumber] = useState("");
  const [mixDescription, setMixDescription] = useState("");
  const [orderedQty, setOrderedQty] = useState("");
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [selectedTruckNumber, setSelectedTruckNumber] = useState("");
  const [truckHistory, setTruckHistory] = useState([]);
  const [truckEvents, setTruckEvents] = useState([]);
  const [truckDetails, setTruckDetails] = useState(null);
  const [truckMetrics, setTruckMetrics] = useState(null);
  const [isReplayPlaying, setIsReplayPlaying] = useState(false);
  const [replayIndex, setReplayIndex] = useState(0);
  const [dispatchStatus, setDispatchStatus] = useState("Idle");
  const [dispatchStatusMessage, setDispatchStatusMessage] = useState("");

  const [eticketCustomer, setEticketCustomer] = useState("");
  const [eticketPlant, setEticketPlant] = useState("BTS-01A - CX");
  const [eticketMixNumber, setEticketMixNumber] = useState("");
  const [eticketMixDescription, setEticketMixDescription] = useState("");
  const [eticketQuantity, setEticketQuantity] = useState("");
  const [eticketTicketNumber, setEticketTicketNumber] = useState("");
  const [creatingETicket, setCreatingETicket] = useState(false);
  const [eticketDraftsByTruck, setEticketDraftsByTruck] = useState({});
  const [eticketDeliveredTotal, setEticketDeliveredTotal] = useState("");
  const [eticketOrderTotal, setEticketOrderTotal] = useState("");

  const auth = useMemo(() => {
    const raw = localStorage.getItem("btc_admin_auth");
    return raw ? JSON.parse(raw) : null;
  }, []);

  async function fetchTrucks() {
    try {
      const res = await fetch(`${getApiBase()}/trucks/live`);

      if (!res.ok) {
        throw new Error(`Failed to load trucks (${res.status})`);
      }

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
          speed_mph: Number(t.speed_mph ?? 0),
        }));

      setTrucks(cleaned);
    } catch (err) {
      console.error("Truck refresh failed:", err);
    }
  }

  useEffect(() => {
    fetchTrucks();
    const id = setInterval(fetchTrucks, 10000);
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

      const [historyRes, eventsRes, detailsRes, metricsRes] = await Promise.all([
        fetch(`${getApiBase()}/trucks/history/${selectedTruckNumber}?limit=25`),
        fetch(`${getApiBase()}/trucks/events/${selectedTruckNumber}?limit=20`),
        fetch(`${getApiBase()}/trucks/details/${selectedTruckNumber}`),
        fetch(`${getApiBase()}/trucks/metrics/${selectedTruckNumber}`),
      ]);

      setTruckHistory(await historyRes.json());
      setTruckEvents(await eventsRes.json());
      const details = await detailsRes.json();
      setTruckDetails(details);
      setTruckMetrics(await metricsRes.json());
      setDispatchStatus(details?.truck?.status || "Idle");
    }

    fetchSelectedTruckData();
  }, [selectedTruckNumber]);

  useEffect(() => {
    setReplayIndex(0);
    setIsReplayPlaying(false);
  }, [selectedTruckNumber]);

  const filteredTrucks = useMemo(() => {
    return trucks.filter((truck) => {
      const haystack = [
        truck.truck_number,
        truck.job_number,
        truck.status,
        truck.driver_name,
        truck.device_name,
      ]
        .join(" ")
        .toLowerCase();

      const matchesSearch =
        !search.trim() || haystack.includes(search.toLowerCase());

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

  const selectedJob = truckDetails?.job || null;
  const selectedDetailsTruck = truckDetails?.truck || null;

  useEffect(() => {
    if (!selectedTruckNumber) return;
    setEticketDraftsByTruck((prev) => ({
      ...prev,
      [selectedTruckNumber]: {
        customer: eticketCustomer,
        plant: eticketPlant,
        mixNumber: eticketMixNumber,
        mixDescription: eticketMixDescription,
        product: `${eticketMixNumber} ${eticketMixDescription}`.trim(),
        quantity: eticketQuantity,
        deliveredTotal: eticketDeliveredTotal,
        orderTotal: eticketOrderTotal,
        ticketNumber: eticketTicketNumber,
      },
    }));
  }, [
    selectedTruckNumber,
    eticketCustomer,
    eticketPlant,
    eticketMixNumber,
    eticketMixDescription,
    eticketQuantity,
    eticketTicketNumber,
  ]);

  useEffect(() => {
    if (!selectedTruck) return;

    const draft = eticketDraftsByTruck[selectedTruck.truck_number] || {};
    const autoTicketNumber = makeTicketNumber(
      selectedTruck.truck_number,
      selectedJob?.job_number || jobNumber || ""
    );

    const productText = draft.product || selectedJob?.product || "";
    const parts = productText.trim().split(/\s+/);

    setEticketTicketNumber(draft.ticketNumber || autoTicketNumber);
    setEticketCustomer(draft.customer || selectedJob?.customer_name || "");
    setEticketPlant(draft.plant || selectedJob?.plant || "BTS-01A - CX");

    setEticketMixNumber(draft.mixNumber || parts[0] || "");
    setEticketMixDescription(
      draft.mixDescription || parts.slice(1).join(" ") || ""
    );

    setEticketQuantity(
      draft.quantity ||
        (selectedJob?.ordered_qty !== null &&
        selectedJob?.ordered_qty !== undefined &&
        selectedJob?.ordered_qty !== ""
          ? String(selectedJob.ordered_qty)
          : orderedQty || "")
    );

    setEticketDeliveredTotal(
      draft.deliveredTotal ||
        (
          selectedJob?.delivered_qty !== null &&
          selectedJob?.delivered_qty !== undefined
            ? String(selectedJob.delivered_qty)
            : eticketQuantity || ""
        )
    );

    setEticketOrderTotal(
      draft.orderTotal ||
        (
          selectedJob?.ordered_qty !== null &&
          selectedJob?.ordered_qty !== undefined
            ? String(selectedJob.ordered_qty)
            : eticketQuantity || ""
        )
    );

    if (selectedJob?.address) setAddress(selectedJob.address);
    if (selectedJob?.job_number) setJobNumber(selectedJob.job_number);
    if (selectedJob?.customer_name) setCustomerName(selectedJob.customer_name);
    if (selectedJob?.customer_email) setCustomerEmail(selectedJob.customer_email);
    if (selectedJob?.plant) setPlant(selectedJob.plant);
    if (selectedJob?.product) setProduct(selectedJob.product);
  }, [selectedTruckNumber, truckDetails]);

  async function assignJob(e) {
    e.preventDefault();

    if (!truckNumber || !address) {
      setMessage("Truck and address are required.");
      return;
    }

    const res = await fetch(`${getApiBase()}/jobs/assign`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        truck_number: truckNumber,
        job_number: jobNumber,
        customer_name: customerName,
        customer_email: customerEmail,
        address,
        plant,
        product: `${mixNumber} ${mixDescription}`.trim(),
        ordered_qty: orderedQty === "" ? 0 : Number(orderedQty),
      }),
    });

    if (!res.ok) {
      setMessage("Failed to assign job.");
      return;
    }

    setMessage(`Assigned ${address} to truck ${truckNumber}`);
    await fetchTrucks();

    if (truckNumber === selectedTruckNumber) {
      const detailsRes = await fetch(`${getApiBase()}/trucks/details/${truckNumber}`);
      const metricsRes = await fetch(`${getApiBase()}/trucks/metrics/${truckNumber}`);
      setTruckDetails(await detailsRes.json());
      setTruckMetrics(await metricsRes.json());
    }
  }

  async function deleteTruck(truckNum) {
    const res = await fetch(`${getApiBase()}/trucks/${truckNum}`, {
      method: "DELETE",
    });
    if (!res.ok) return;
    await fetchTrucks();
  }

  async function completeJob(truckNum) {
    const res = await fetch(`${getApiBase()}/jobs/complete/${truckNum}`, {
      method: "POST",
    });
    if (!res.ok) return;
    await fetchTrucks();

    if (selectedTruckNumber === truckNum) {
      const detailsRes = await fetch(`${getApiBase()}/trucks/details/${truckNum}`);
      const metricsRes = await fetch(`${getApiBase()}/trucks/metrics/${truckNum}`);
      setTruckDetails(await detailsRes.json());
      setTruckMetrics(await metricsRes.json());
    }
  }

  async function updateDispatchStatus() {
    if (!selectedTruckNumber || !auth?.token) return;

    const res = await fetch(`${getApiBase()}/dispatch/trucks/${selectedTruckNumber}/status`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Admin-Token": auth.token,
      },
      body: JSON.stringify({
        status: dispatchStatus,
        details: dispatchStatusMessage,
      }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      setMessage(data.detail || "Failed to update status");
      return;
    }

    setMessage(`Dispatch set ${selectedTruckNumber} to ${dispatchStatus}`);
    setDispatchStatusMessage("");
    await fetchTrucks();

    const detailsRes = await fetch(`${getApiBase()}/trucks/details/${selectedTruckNumber}`);
    const eventsRes = await fetch(`${getApiBase()}/trucks/events/${selectedTruckNumber}?limit=20`);
    setTruckDetails(await detailsRes.json());
    setTruckEvents(await eventsRes.json());
  }

  async function createETicket() {
    if (!selectedTruck) {
      setMessage("Select a truck first to create an eTicket.");
      return;
    }

    if (!eticketCustomer.trim()) {
      setMessage("Enter customer name for the eTicket.");
      return;
    }

    if (!(selectedJob?.address || address)) {
      setMessage("Enter or assign an address first.");
      return;
    }

    if (!eticketMixNumber.trim()) {
      setMessage("Enter Mix # for the eTicket.");
      return;
    }

    if (!eticketMixDescription.trim()) {
      setMessage("Enter Description for the eTicket.");
      return;
    }

    setCreatingETicket(true);

    const payload = {
      ticket_number:
        eticketTicketNumber.trim() ||
        makeTicketNumber(selectedTruck.truck_number, selectedJob?.job_number || jobNumber || ""),
      customer_name: eticketCustomer.trim(),
      address: selectedJob?.address || address || "Job Address",
      plant: eticketPlant.trim() || "BTS-01A - CX",
      truck_number: selectedTruck.truck_number,
      product: `${eticketMixNumber} ${eticketMixDescription}`.trim(),
      mix_number: eticketMixNumber.trim(),
      mix_description: eticketMixDescription.trim(),
      quantity: eticketQuantity === "" ? 0 : Number(eticketQuantity),

      delivered_qty_total:
        eticketDeliveredTotal === ""
          ? Number(eticketQuantity || 0)
          : Number(eticketDeliveredTotal),

      order_total:
        eticketOrderTotal === ""
          ? Number(eticketQuantity || 0)
          : Number(eticketOrderTotal),
    };

    try {
      const res = await fetch(`${getApiBase()}/api/etickets/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        setMessage(data.detail || "Failed to create eTicket");
        setCreatingETicket(false);
        return;
      }

      try {
        await navigator.clipboard.writeText(data.link);
      } catch {}
      setMessage(`eTicket created and copied: ${data.link}`);
    } catch {
      setMessage("Could not create eTicket");
    } finally {
      setCreatingETicket(false);
    }
  }

  function selectTruck(truck) {
    setSelectedTruckNumber(truck.truck_number);
    setTruckNumber(truck.truck_number);
    setJobNumber(truck.job_number || "");
  }

  return (
    <div className="fleet-shell">
      <div
        className="fleet-content full-width"
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 450px",
          gap: 16,
        }}
      >
        <div className="map-panel">
          <div className="map-shell">
            <MapContainer center={[32.7767, -96.797]} zoom={10} style={{ height: "100%", width: "100%" }}>
              <TileLayer
                attribution="&copy; OpenStreetMap contributors"
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />

              <RefreshMapSize
                selectedTruckNumber={selectedTruckNumber}
                truckCount={filteredTrucks.length}
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
                  eventHandlers={{ click: () => selectTruck(truck) }}
                >
                  <Popup>
                    <div>
                      <strong>Truck {truck.truck_number}</strong>
                      <br />
                      Status: {truck.status}
                      <br />
                      Job: {truck.job_number || "-"}
                      <br />
                      Speed: {formatSpeed(truck.speed_mph)}
                      <br />
                      Driver: {truck.driver_name || "-"}
                      <br />
                      Tablet: {truck.device_name || "-"}
                    </div>
                  </Popup>
                </Marker>
              ))}

              {routePositions.length > 1 && (
                <Polyline
                  positions={routePositions}
                  pathOptions={{ color: "#f97316", weight: 4, opacity: 0.85 }}
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
            {!selectedTruck && <div className="empty-state">Select a truck.</div>}

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
                  <span>Speed</span>
                  <strong>{formatSpeed(selectedTruck.speed_mph)}</strong>
                </div>
                <div className="asset-row">
                  <span>Driver</span>
                  <strong>{selectedTruck.driver_name || "-"}</strong>
                </div>
                <div className="asset-row">
                  <span>Tablet</span>
                  <strong>{selectedTruck.device_name || "-"}</strong>
                </div>
                <div className="asset-row">
                  <span>Job</span>
                  <strong>{selectedTruck.job_number || "-"}</strong>
                </div>

                {truckDetails?.is_stale && (
                  <div className="stale-panel">
                    GPS stale: {truckDetails?.last_gps_signal_minutes_ago ?? "-"} min since update
                  </div>
                )}

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
            {!selectedJob && <div className="empty-state">No active job assigned.</div>}
            {selectedJob && (
              <div className="asset-details">
                <div className="asset-row">
                  <span>Customer</span>
                  <strong>{selectedJob.customer_name || "-"}</strong>
                </div>
                <div className="asset-row">
                  <span>Email</span>
                  <strong>{selectedJob.customer_email || "-"}</strong>
                </div>
                <div className="asset-row">
                  <span>Address</span>
                  <strong>{selectedJob.address || "-"}</strong>
                </div>
                <div className="asset-row">
                  <span>Plant</span>
                  <strong>{selectedJob.plant || "-"}</strong>
                </div>
                <div className="asset-row">
                  <span>Product</span>
                  <strong>{selectedJob.product || "-"}</strong>
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
              </div>
            )}
          </div>

          <div className="panel-card">
            <div className="panel-title">Current Truck Location</div>
            {!selectedDetailsTruck && <div className="empty-state">No live truck selected.</div>}
            {selectedDetailsTruck && (
              <div className="asset-details">
                <div className="asset-row">
                  <span>Location</span>
                  <strong>
                    {selectedDetailsTruck.latitude}, {selectedDetailsTruck.longitude}
                  </strong>
                </div>
                <div className="asset-row">
                  <span>Last GPS Signal</span>
                  <strong>{truckDetails?.last_gps_signal_minutes_ago ?? "-"} min ago</strong>
                </div>
                <div className="asset-row">
                  <span>Speed</span>
                  <strong>{formatSpeed(selectedDetailsTruck.speed_mph)}</strong>
                </div>
              </div>
            )}
          </div>

          <div className="panel-card">
            <div className="panel-title">Job Metrics</div>
            {!selectedTruck && <div className="empty-state">Select a truck.</div>}
            {selectedTruck && (
              <div className="metrics-grid">
                <div className="metric-card">
                  <div className="metric-value">{formatPercent(truckMetrics?.delivered_percent)}</div>
                  <div className="metric-label">Delivered</div>
                </div>
                <div className="metric-card">
                  <div className="metric-value">
                    {truckMetrics?.delivered_qty ?? 0}/{truckMetrics?.ordered_qty ?? 0}
                  </div>
                  <div className="metric-label">Delivered / Ordered</div>
                </div>
                <div className="metric-card">
                  <div className="metric-value">{formatMetric(truckMetrics?.time_to_job_minutes)}</div>
                  <div className="metric-label">Time to Job</div>
                </div>
                <div className="metric-card">
                  <div className="metric-value">{formatMetric(truckMetrics?.waiting_minutes)}</div>
                  <div className="metric-label">Waiting</div>
                </div>
                <div className="metric-card">
                  <div className="metric-value">{formatMetric(truckMetrics?.pouring_minutes)}</div>
                  <div className="metric-label">Pouring</div>
                </div>
                <div className="metric-card">
                  <div className="metric-value">{formatMetric(truckMetrics?.after_pour_minutes)}</div>
                  <div className="metric-label">After Pour</div>
                </div>
              </div>
            )}
          </div>

          <div className="panel-card">
            <div className="panel-title">Recent Activity</div>
            {!selectedTruck && <div className="empty-state">Select a truck.</div>}
            {selectedTruck && (
              <div className="history-list">
                {truckEvents.length === 0 && truckHistory.length === 0 && (
                  <div className="empty-state">No history yet.</div>
                )}

                {truckEvents.map((event, index) => (
                  <div key={`event-${index}`} className="history-item">
                    <div className="history-type">{event.event_type.replaceAll("_", " ")}</div>
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
                      Speed: {formatSpeed(item.speed_mph)}
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
            {!selectedTruck && <div className="empty-state">Select a truck to replay its route.</div>}
            {selectedTruck && routePositions.length <= 1 && (
              <div className="empty-state">Not enough route points yet to replay.</div>
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
                  <button className="primary-btn" type="button" onClick={() => setIsReplayPlaying(true)}>
                    Play Replay
                  </button>

                  <button className="secondary-btn" type="button" onClick={() => setIsReplayPlaying(false)}>
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
        </div>
      </div>
    </div>
  );
}