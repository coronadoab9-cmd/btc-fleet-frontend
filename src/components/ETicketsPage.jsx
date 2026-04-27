import { useEffect, useMemo, useState } from "react";
import { apiFetch, buildEticketPdfUrl, buildEticketUrl } from "../lib/api";

function formatDateTime(value) {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

function downloadCsv(filename, rows) {
  const csv = rows
    .map((row) =>
      row
        .map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`)
        .join(",")
    )
    .join("\\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ETicketsPage({ token }) {
  const [tickets, setTickets] = useState([]);
  const [selectedToken, setSelectedToken] = useState("");
  const [eticketTab, setEticketTab] = useState("pending");
  const [filterStatus, setFilterStatus] = useState("all");
  const [customerFilter, setCustomerFilter] = useState("");
  const [ticketFilter, setTicketFilter] = useState("");
  const [truckFilter, setTruckFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [reassignOptions, setReassignOptions] = useState({
    admins: [],
    trucks: [],
  });
  const [reassigningTicketId, setReassigningTicketId] = useState(null);

  async function loadTickets() {
    setLoading(true);
    setError("");
    try {
      const [data, optionsData] = await Promise.all([
        apiFetch(`/admin/etickets?tab=${eticketTab}`, {
          headers: { "X-Admin-Token": token },
        }),
        apiFetch("/admin/etickets/reassign-options", {
          headers: { "X-Admin-Token": token },
        }),
      ]);

      setTickets(Array.isArray(data) ? data : []);
      setReassignOptions({
        admins: Array.isArray(optionsData?.admins) ? optionsData.admins : [],
        trucks: Array.isArray(optionsData?.trucks) ? optionsData.trucks : [],
      });
      if (!selectedToken && data?.length) {
        setSelectedToken(data[0].token);
      }
    } catch (err) {
      setError(err.message || "Could not load eTickets");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTickets();
  }, [token, eticketTab]);

  const filteredTickets = useMemo(() => {
    return tickets.filter((t) => {
      const statusOk =
        filterStatus === "all" ||
        (filterStatus === "signed" ? t.status === "signed" : t.status !== "signed");
      const customerOk =
        !customerFilter.trim() ||
        (t.customer_name || "").toLowerCase().includes(customerFilter.trim().toLowerCase());
      const ticketOk =
        !ticketFilter.trim() ||
        (t.ticket_number || "").toLowerCase().includes(ticketFilter.trim().toLowerCase());
      const truckOk =
        !truckFilter.trim() ||
        (t.truck_number || "").toLowerCase().includes(truckFilter.trim().toLowerCase());

      const signedAt = t.signed_at ? new Date(t.signed_at) : null;
      const fromOk = !dateFrom || !signedAt || signedAt >= new Date(`${dateFrom}T00:00:00`);
      const toOk = !dateTo || !signedAt || signedAt <= new Date(`${dateTo}T23:59:59`);

      return statusOk && customerOk && ticketOk && truckOk && fromOk && toOk;
    });
  }, [tickets, filterStatus, customerFilter, ticketFilter, truckFilter, dateFrom, dateTo]);

  const selectedTicket =
    filteredTickets.find((t) => t.token === selectedToken) ||
    tickets.find((t) => t.token === selectedToken) ||
    filteredTickets[0] ||
    null;

  useEffect(() => {
    if (selectedTicket && selectedTicket.token !== selectedToken) {
      setSelectedToken(selectedTicket.token);
    }
  }, [selectedTicket, selectedToken]);

  function exportFilteredCsv() {
    const rows = [
      ["Ticket Number", "Customer", "Truck", "Status", "Signed At", "PDF Link"],
      ...filteredTickets.map((t) => [
        t.ticket_number || "",
        t.customer_name || "",
        t.truck_number || "",
        t.status || "",
        t.signed_at || "",
        t.status === "signed" ? buildEticketPdfUrl(t.token) : "",
      ]),
    ];
    downloadCsv(`btc_etickets_${new Date().toISOString().slice(0, 10)}.csv`, rows);
    setMessage("Filtered eTickets exported");
  }

  async function copyLink(url, label) {
    try {
      await navigator.clipboard.writeText(url);
      setMessage(`${label} copied`);
    } catch {
      setError("Could not copy link");
    }
  }

  async function reassignEticket(ticket, optionValue) {
    setError("");
    setMessage("");

    try {
      if (!optionValue) {
        throw new Error("Please choose a truck or admin");
      }

      const [assignedToType, assignedToId] = optionValue.split("|");

      const allOptions = [
        ...reassignOptions.trucks,
        ...reassignOptions.admins,
      ];

      const selected = allOptions.find(
        (item) =>
          item.type === assignedToType &&
          String(item.id) === String(assignedToId)
      );

      if (!selected) {
        throw new Error("Selected assignment option was not found");
      }

      setReassigningTicketId(ticket.id);

      await apiFetch("/admin/etickets/reassign", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Admin-Token": token,
        },
        body: JSON.stringify({
          ticket_id: ticket.id,
          assigned_to_type: selected.type,
          assigned_to_id: String(selected.id),
          assigned_to_name: selected.name,
        }),
      });

      setMessage(
        `Ticket ${ticket.ticket_number || ticket.id} reassigned to ${selected.name}`
      );

      await loadTickets();
    } catch (err) {
      setError(err.message || "Could not reassign eTicket");
    } finally {
      setReassigningTicketId(null);
    }
  }

  return (
    <div className="admin-page">
      {error ? <div style={styles.error}>{error}</div> : null}
      {message ? <div style={styles.success}>{message}</div> : null}

      <div style={styles.headerRow}>
        <div style={styles.pageTitle}>eTickets ({filteredTickets.length})</div>
        <div style={styles.headerButtons}>
          <button style={styles.secondaryButton} onClick={loadTickets}>
            Refresh
          </button>
          <button style={styles.primaryButton} onClick={exportFilteredCsv}>
            Export Filtered
          </button>
        </div>
      </div>

      <div style={styles.tabRow}>
        {[
          ["pending", "Pending Tickets"],
          ["accepted", "Signed Accepted"],
          ["rejected", "Signed Rejected"],
          ["assigned", "Assigned"],
        ].map(([key, label]) => (
          <button
            key={key}
            type="button"
            style={eticketTab === key ? styles.activeTabButton : styles.tabButton}
            onClick={() => {
              setSelectedToken("");
              setEticketTab(key);
            }}
          >
            {label}
          </button>
        ))}
      </div>

      <div style={styles.filters}>
        <select style={styles.input} value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
          <option value="all">All</option>
          <option value="signed">Signed</option>
          <option value="pending">Pending</option>
        </select>
        <input style={styles.input} value={customerFilter} onChange={(e) => setCustomerFilter(e.target.value)} placeholder="Filter by customer" />
        <input style={styles.input} value={ticketFilter} onChange={(e) => setTicketFilter(e.target.value)} placeholder="Filter by ticket #" />
        <input style={styles.input} value={truckFilter} onChange={(e) => setTruckFilter(e.target.value)} placeholder="Filter by truck" />
        <input style={styles.input} type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        <input style={styles.input} type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
      </div>

      {loading ? (
        <div>Loading eTickets...</div>
      ) : (
        <div style={styles.grid}>
          <div style={styles.leftColumn}>
            {filteredTickets.map((ticket) => (
              <div
                key={ticket.token}
                style={{
                  ...styles.ticketCard,
                  borderColor: selectedTicket?.token === ticket.token ? "var(--accent)" : "var(--border)",
                }}
                onClick={() => setSelectedToken(ticket.token)}
              >
                <div style={styles.ticketCardTop}>
                  <div style={styles.ticketNumber}>#{ticket.ticket_number || "-"}</div>
                  <div style={ticket.status === "signed" ? styles.signedPill : styles.pendingPill}>
                    {ticket.status === "signed" ? "SIGNED" : "PENDING"}
                  </div>
                </div>
                <div style={styles.ticketMeta}>{ticket.customer_name || "-"}</div>
                <div style={styles.ticketMeta}>Truck: {ticket.truck_number || "-"}</div>
                <div style={styles.ticketMeta}>Signed: {formatDateTime(ticket.signed_at)}</div>
              </div>
            ))}
            {!filteredTickets.length && <div className="empty-state">No eTickets found.</div>}
          </div>

          <div style={styles.detailCard}>
            {selectedTicket ? (
              <>
                <div style={styles.detailHeader}>
                  <div>
                    <div style={styles.detailTitle}>eTicket #{selectedTicket.ticket_number || "-"}</div>
                    <div style={styles.detailSubtitle}>
                      {selectedTicket.customer_name || "-"} • Truck {selectedTicket.truck_number || "-"}
                    </div>
                  </div>
                  <div style={selectedTicket.status === "signed" ? styles.signedPill : styles.pendingPill}>
                    {selectedTicket.status === "signed" ? "SIGNED" : "PENDING"}
                  </div>
                </div>

                <div style={styles.infoGrid}>
                  <Info label="Customer" value={selectedTicket.customer_name} />
                  <Info label="Address" value={selectedTicket.address} />
                  <Info label="Plant" value={selectedTicket.plant} />
                  <Info label="Truck" value={selectedTicket.truck_number} />
                  <Info label="Product" value={selectedTicket.product} />
                  <Info label="Quantity" value={selectedTicket.quantity} />
                  <Info label="Signed By" value={selectedTicket.signed_name} />
                  <Info label="Signed At" value={formatDateTime(selectedTicket.signed_at)} />
                  <Info label="Latitude" value={selectedTicket.signed_latitude} />
                  <Info label="Longitude" value={selectedTicket.signed_longitude} />
                  <Info label="Water Choice" value={selectedTicket.water_choice} />
                  <Info label="Water Added" value={selectedTicket.water_added} />
                  <Info label="Acceptance" value={selectedTicket.ticket_acceptance} />
                  <Info label="Load Time" value={formatDateTime(selectedTicket.load_time)} />
                  <Info label="Assigned To" value={selectedTicket.assigned_to_name} />
                  <Info label="Assigned At" value={formatDateTime(selectedTicket.assigned_at)} />
                </div>

                <InfoWide label="Weather Summary" value={selectedTicket.weather_summary || "-"} />

                {String(selectedTicket.status || "").toLowerCase() !== "signed" ? (
                  <div style={styles.reassignBox}>
                    <div style={styles.infoLabel}>Reassign Ticket</div>

                    <select
                      style={styles.input}
                      disabled={reassigningTicketId === selectedTicket.id}
                      value=""
                      onChange={(e) => reassignEticket(selectedTicket, e.target.value)}
                    >
                      <option value="">Choose truck or admin...</option>

                      <optgroup label="Trucks">
                        {reassignOptions.trucks
                          .filter((truck) => truck.id !== selectedTicket.truck_number)
                          .map((truck) => (
                            <option
                              key={`truck-${truck.id}`}
                              value={`${truck.type}|${truck.id}`}
                            >
                              {truck.label}
                            </option>
                          ))}
                      </optgroup>

                      <optgroup label="Admins">
                        {reassignOptions.admins.map((admin) => (
                          <option
                            key={`admin-${admin.id}`}
                            value={`${admin.type}|${admin.id}`}
                          >
                            {admin.label}
                          </option>
                        ))}
                      </optgroup>
                    </select>
                  </div>
                ) : null}

                <div style={styles.actionRow}>
                  <button style={styles.primaryButton} onClick={() => window.open(buildEticketUrl(selectedTicket.token), "_blank")}>
                    Open eTicket
                  </button>
                  <button style={styles.secondaryButton} onClick={() => copyLink(buildEticketUrl(selectedTicket.token), "eTicket link")}>
                    Copy Link
                  </button>
                  {selectedTicket.status === "signed" ? (
                    <button style={styles.secondaryButton} onClick={() => window.open(buildEticketPdfUrl(selectedTicket.token), "_blank")}>
                      Open Signed PDF
                    </button>
                  ) : null}
                </div>
              </>
            ) : (
              <div className="empty-state">Select an eTicket.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div style={styles.infoCard}>
      <div style={styles.infoLabel}>{label}</div>
      <div style={styles.infoValue}>{value || "-"}</div>
    </div>
  );
}

function InfoWide({ label, value }) {
  return (
    <div style={styles.infoWide}>
      <div style={styles.infoLabel}>{label}</div>
      <div style={styles.infoValue}>{value || "-"}</div>
    </div>
  );
}

const styles = {

  reassignBox: {
    background: "var(--bg-soft)",
    border: "1px solid var(--border)",
    borderRadius: 16,
    padding: 18,
    marginBottom: 14,
  },
  tabRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 16,
  },

  tabButton: {
    border: "1px solid var(--border)",
    background: "var(--panel-2)",
    color: "var(--muted)",
    borderRadius: 999,
    padding: "10px 14px",
    fontWeight: 800,
    cursor: "pointer",
  },

  activeTabButton: {
    border: "1px solid #60a5fa",
    background: "#1d4ed8",
    color: "#fff",
    borderRadius: 999,
    padding: "10px 14px",
    fontWeight: 900,
    cursor: "pointer",
  },
  headerRow: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  pageTitle: { fontSize: 24, fontWeight: 800, color: "#fff" },
  headerButtons: { display: "flex", gap: 10 },
  filters: { display: "grid", gridTemplateColumns: "repeat(6, minmax(0, 1fr))", gap: 10, marginBottom: 16 },
  grid: { display: "grid", gridTemplateColumns: "360px 1fr", gap: 16 },
  leftColumn: { display: "flex", flexDirection: "column", gap: 14 },
  ticketCard: { background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 16, padding: 18, cursor: "pointer" },
  ticketCardTop: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  ticketNumber: { color: "#fff", fontWeight: 800, fontSize: 18 },
  ticketMeta: { color: "#d0e3f6", lineHeight: 1.7 },
  detailCard: { background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 18, padding: 20 },
  detailHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  detailTitle: { fontSize: 24, fontWeight: 800, color: "#fff" },
  detailSubtitle: { color: "#c7def5", fontSize: 18 },
  infoGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 },
  infoCard: { background: "var(--bg-soft)", border: "1px solid var(--border)", borderRadius: 16, padding: 18 },
  infoWide: { background: "var(--bg-soft)", border: "1px solid var(--border)", borderRadius: 16, padding: 18, marginBottom: 14 },
  infoLabel: { color: "#b9d3ee", marginBottom: 10, fontSize: 14 },
  infoValue: { color: "#fff", fontSize: 16, fontWeight: 700, wordBreak: "break-word" },
  actionRow: { display: "flex", gap: 10, flexWrap: "wrap" },
  input: { width: "100%", height: 52, padding: "0 14px", borderRadius: 12, border: "1px solid var(--border)", background: "var(--panel-2)", color: "#fff", fontSize: 15 },
  primaryButton: { background: "linear-gradient(90deg, #ff7a18, #ff8f3d)", color: "#fff", border: "none", borderRadius: 12, padding: "12px 16px", fontSize: 16, fontWeight: 800, cursor: "pointer" },
  secondaryButton: { background: "#1d4572", color: "#fff", border: "1px solid var(--border)", borderRadius: 12, padding: "12px 16px", fontSize: 16, cursor: "pointer" },
  signedPill: { background: "rgba(37, 194, 129, 0.18)", color: "#7ef0bc", padding: "8px 12px", borderRadius: 999, fontWeight: 800 },
  pendingPill: { background: "rgba(249, 115, 22, 0.18)", color: "#ffb37a", padding: "8px 12px", borderRadius: 999, fontWeight: 800 },
  error: { background: "rgba(127,29,29,0.25)", border: "1px solid rgba(239,68,68,0.35)", color: "#fecaca", padding: "14px 16px", borderRadius: 14, marginBottom: 16, fontWeight: 700 },
  success: { background: "rgba(6,95,70,0.35)", border: "1px solid rgba(16,185,129,0.35)", color: "#d1fae5", padding: "14px 16px", borderRadius: 14, marginBottom: 16, fontWeight: 700 },
};