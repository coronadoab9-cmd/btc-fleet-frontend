import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "../lib/api";

function formatCys(value) {
  const num = Number(value || 0);
  return `${num.toFixed(1)} cys`;
}

function formatDateTime(value) {
  if (!value) return "-";

  try {
    const dt = new Date(value);
    return new Intl.DateTimeFormat("en-US", {
      month: "2-digit",
      day: "2-digit",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(dt);
  } catch {
    return value;
  }
}

function formatLoadTime(value) {
  if (!value) return "-";

  try {
    const dt = new Date(value);

    // Match the eTicket / PDF Sysdyne load-time correction.
    dt.setHours(dt.getHours() - 11);

    return new Intl.DateTimeFormat("en-US", {
      month: "2-digit",
      day: "2-digit",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(dt);
  } catch {
    return value;
  }
}

function buildDirectionsUrl(latitude, longitude, address) {
  if (!latitude || !longitude || !address) return "";

  return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(
    `${latitude},${longitude}`
  )}&destination=${encodeURIComponent(address)}`;
}

function buildDirectionsEmbedUrl(latitude, longitude, address) {
  if (!latitude || !longitude || !address) return "";

  return `https://maps.google.com/maps?saddr=${encodeURIComponent(
    `${latitude},${longitude}`
  )}&daddr=${encodeURIComponent(address)}&output=embed`;
}

function ticketLoadMs(ticket) {
  if (!ticket?.load_time) return 0;
  const ms = new Date(ticket.load_time).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

function getCurrentPortalTicket(tickets) {
  const pending = tickets
    .filter((ticket) => String(ticket.status || "pending").toLowerCase() !== "signed")
    .sort((a, b) => ticketLoadMs(b) - ticketLoadMs(a));

  if (pending.length > 0) return pending[0];

  const sorted = [...tickets].sort((a, b) => ticketLoadMs(b) - ticketLoadMs(a));
  return sorted[0] || null;
}

function findTruckForTicket(activeTrucks, ticket) {
  if (!ticket) return null;

  const ticketTruck = String(ticket.truck_number || "").trim();

  return (
    activeTrucks.find(
      (truck) => String(truck.truck_number || "").trim() === ticketTruck
    ) || null
  );
}

function StatCard({ label, value }) {
  return (
    <div
      style={{
        background: "var(--panel-2)",
        border: "1px solid var(--border)",
        borderRadius: 16,
        padding: 16,
        textAlign: "center",
      }}
    >
      <div style={{ color: "var(--muted)", fontWeight: 800, fontSize: 14 }}>
        {label}
      </div>
      <div style={{ color: "#fff", fontWeight: 950, fontSize: 30, marginTop: 8 }}>
        {value}
      </div>
    </div>
  );
}

function SectionCard({ title, children }) {
  return (
    <div
      style={{
        background: "var(--panel-2)",
        border: "1px solid var(--border)",
        borderRadius: 16,
        padding: 16,
        marginTop: 16,
      }}
    >
      <div
        style={{
          color: "#fff",
          fontWeight: 950,
          fontSize: 20,
          marginBottom: 12,
        }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "130px 1fr",
        gap: 10,
        padding: "8px 0",
        borderBottom: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      <div style={{ color: "var(--muted)", fontWeight: 800 }}>{label}</div>
      <div style={{ color: "#fff", fontWeight: 800 }}>{value || "-"}</div>
    </div>
  );
}


function getCustomerTicketStatus(ticket) {
  const status = String(ticket?.status || "pending").toLowerCase();
  const acceptance = String(ticket?.ticket_acceptance || "").toLowerCase();

  if (status === "signed") {
    if (acceptance.includes("rejected")) return "Rejected";
    return "Delivered";
  }

  return "In Transit";
}

function getCustomerTicketStatusColor(ticket) {
  const customerStatus = getCustomerTicketStatus(ticket);

  if (customerStatus === "Delivered") return "#bbf7d0";
  if (customerStatus === "Rejected") return "#fecaca";
  return "#fed7aa";
}


export default function CustomerJobPortal() {
  const jobToken = useMemo(() => {
    const parts = window.location.pathname.split("/");
    return parts[parts.length - 1] || "";
  }, []);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showAllTickets, setShowAllTickets] = useState(false);

  async function loadPortal() {
    setLoading(true);
    setError("");

    try {
      const result = await apiFetch(`/api/customer/jobs/${jobToken}`);
      setData(result);
    } catch (err) {
      setError(err.message || "Could not load customer portal.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (jobToken) {
      loadPortal();
    }
  }, [jobToken]);

  if (loading) {
    return <div className="full-screen-center">Loading customer portal...</div>;
  }

  if (error) {
    return <div className="full-screen-center">{error}</div>;
  }

  const job = data?.job || {};
  const tickets = data?.tickets || [];
  const activeTrucks = data?.active_trucks || [];
  const currentTicket = getCurrentPortalTicket(tickets);
  const currentTruck = findTruckForTicket(activeTrucks, currentTicket);
  const isPhone = window.innerWidth <= 700;

  const sortedTickets = [...tickets].sort((a, b) => ticketLoadMs(b) - ticketLoadMs(a));
  const visibleTickets = showAllTickets ? sortedTickets : sortedTickets.slice(0, 5);

  const orderTotal = Number(job.order_total || 0);
  const deliveredTotal = Number(job.delivered_total || 0);
  const progressPercent =
    orderTotal > 0 ? Math.max(0, Math.min(100, (deliveredTotal / orderTotal) * 100)) : 0;

  const isComplete = Number(job.remaining_total || 0) <= 0;

  const showNextDelivery =
    !isComplete &&
    currentTicket &&
    String(currentTicket.status || "pending").toLowerCase() !== "signed";

  return (
    <div className="app-shell" style={{ padding: 14 }}>
      <div className="panel-card" style={{ maxWidth: 980, margin: "0 auto" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            alignItems: "flex-start",
            flexWrap: "wrap",
          }}
        >
          <div>
            <div className="panel-title" style={{ marginBottom: 4 }}>
              BTC Customer Portal
            </div>
            <div style={{ color: "var(--muted)", fontWeight: 800 }}>
              Live job ticket tracking
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {localStorage.getItem("btc_customer_auth") ? (
              <button
                className="secondary-btn"
                type="button"
                onClick={() => {
                  window.location.href = "/customer/dashboard";
                }}
              >
                Back to All Orders
              </button>
            ) : null}

            <button className="secondary-btn" type="button" onClick={loadPortal}>
              Refresh
            </button>
          </div>
        </div>

        <div
          style={{
            marginTop: 16,
            border: isComplete
              ? "1px solid rgba(34,197,94,0.45)"
              : "1px solid rgba(56,189,248,0.45)",
            background: isComplete
              ? "rgba(34,197,94,0.12)"
              : "rgba(56,189,248,0.12)",
            borderRadius: 16,
            padding: 16,
          }}
        >
          <div
            style={{
              color: isComplete ? "#bbf7d0" : "#bae6fd",
              fontWeight: 950,
              fontSize: 20,
              marginBottom: 6,
            }}
          >
            {isComplete ? "Delivery Complete" : "Delivery In Progress"}
          </div>

          <div
            style={{
              color: "#fff",
              fontWeight: 850,
              lineHeight: 1.5,
            }}
          >
            {isComplete ? (
              <>Final delivered: {formatCys(job.delivered_total)}</>
            ) : (
              <>
                Next truck: {currentTicket?.truck_number || "-"} · Remaining:{" "}
                {formatCys(job.remaining_total)}
              </>
            )}
          </div>
        </div>

        <SectionCard title="Job Information">
          <Row label="Customer" value={job.customer_name} />
          <Row label="Address" value={job.address} />
          <Row label="Order #" value={job.order_number} />
        </SectionCard>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: isPhone ? "1fr" : "repeat(3, 1fr)",
            gap: 14,
            marginTop: 16,
          }}
        >
          <StatCard label="Order Total" value={formatCys(job.order_total)} />
          <StatCard label="Delivered So Far" value={formatCys(job.delivered_total)} />
          <StatCard label="Remaining" value={formatCys(job.remaining_total)} />
        </div>

        <div
          style={{
            marginTop: 16,
            background: "var(--panel-2)",
            border: "1px solid var(--border)",
            borderRadius: 16,
            padding: 16,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              flexWrap: "wrap",
              marginBottom: 10,
            }}
          >
            <div style={{ color: "#fff", fontWeight: 950 }}>
              Delivery Progress
            </div>
            <div style={{ color: "var(--muted)", fontWeight: 900 }}>
              {formatCys(job.delivered_total)} / {formatCys(job.order_total)}
            </div>
          </div>

          <div
            style={{
              height: 16,
              borderRadius: 999,
              background: "rgba(255,255,255,0.08)",
              overflow: "hidden",
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${progressPercent}%`,
                borderRadius: 999,
                background: isComplete
                  ? "linear-gradient(90deg, #22c55e, #86efac)"
                  : "linear-gradient(90deg, #38bdf8, #2563eb)",
                transition: "width 0.35s ease",
              }}
            />
          </div>

          <div
            style={{
              color: isComplete ? "#bbf7d0" : "var(--muted)",
              fontWeight: 900,
              fontSize: 13,
              marginTop: 8,
              textAlign: "right",
            }}
          >
            {progressPercent.toFixed(0)}% delivered
          </div>
        </div>

        {isComplete ? (
          <div
            style={{
              marginTop: 16,
              border: "1px solid rgba(34,197,94,0.45)",
              background: "rgba(34,197,94,0.12)",
              borderRadius: 16,
              padding: 16,
              color: "#bbf7d0",
              fontWeight: 950,
              textAlign: "center",
              fontSize: 18,
            }}
          >
            Delivery Complete — Final Delivered: {formatCys(job.delivered_total)}
          </div>
        ) : null}

        {showNextDelivery ? (
        <SectionCard title="Next Delivery">
          {!currentTicket ? (
            <div style={{ color: "var(--muted)", fontWeight: 800 }}>
              No active delivery ticket found yet.
            </div>
          ) : (
            <div
              style={{
                border: "1px solid var(--border)",
                borderRadius: 14,
                padding: 14,
                background: "rgba(255,255,255,0.03)",
              }}
            >
              <Row label="Ticket" value={currentTicket.ticket_number} />
              <Row label="Truck" value={currentTicket.truck_number} />
              <Row label="Load Time" value={formatLoadTime(currentTicket.load_time)} />
              <Row label="Load Size" value={formatCys(currentTicket.quantity)} />

              {currentTruck?.latitude && currentTruck?.longitude && job.address ? (
                <>
                  <div
                    style={{
                      marginTop: 12,
                      border: "1px solid var(--border)",
                      borderRadius: 14,
                      overflow: "hidden",
                      background: "#0b1a2b",
                    }}
                  >
                    <iframe
                      title={`Route for truck ${currentTruck.truck_number}`}
                      src={buildDirectionsEmbedUrl(
                        currentTruck.latitude,
                        currentTruck.longitude,
                        job.address
                      )}
                      width="100%"
                      height={isPhone ? "230" : "300"}
                      style={{
                        border: 0,
                        display: "block",
                      }}
                      loading="lazy"
                      referrerPolicy="no-referrer-when-downgrade"
                    />
                  </div>

                  <a
                    href={buildDirectionsUrl(
                      currentTruck.latitude,
                      currentTruck.longitude,
                      job.address
                    )}
                    target="_blank"
                    rel="noreferrer"
                    className="primary-btn"
                    style={{
                      display: "block",
                      textAlign: "center",
                      textDecoration: "none",
                      marginTop: 12,
                    }}
                  >
                    Open Route / ETA
                  </a>

                  <div
                    style={{
                      color: "var(--muted)",
                      fontWeight: 800,
                      fontSize: 12,
                      marginTop: 8,
                      textAlign: "center",
                    }}
                  >
                    ETA is shown in the route map and full Google Maps view.
                  </div>
                </>
              ) : (
                <div style={{ color: "var(--muted)", fontWeight: 800, marginTop: 12 }}>
                  Truck location is not available yet.
                </div>
              )}
            </div>
          )}
        </SectionCard>

        ) : null}

        <SectionCard title="Tickets">
          {tickets.length === 0 ? (
            <div style={{ color: "var(--muted)", fontWeight: 800 }}>
              No tickets found for this job.
            </div>
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              {visibleTickets.map((ticket) => {
                  const customerStatus = getCustomerTicketStatus(ticket);

                  return (
                    <div
                      key={ticket.id || ticket.ticket_number}
                      style={{
                        display: "grid",
                        gridTemplateColumns: isPhone
                          ? "1fr"
                          : "1.2fr 0.8fr 1fr 0.8fr 1.2fr",
                        gap: 10,
                        alignItems: "center",
                        border: "1px solid var(--border)",
                        borderRadius: 12,
                        padding: 10,
                        background: "rgba(255,255,255,0.03)",
                      }}
                    >
                      <div>
                        <div style={{ color: "#fff", fontWeight: 950 }}>
                          Ticket {ticket.ticket_number}
                        </div>
                        <div style={{ color: "var(--muted)", fontWeight: 800, fontSize: 12 }}>
                          {formatLoadTime(ticket.load_time)}
                        </div>
                      </div>

                      <div style={{ color: "#fff", fontWeight: 900 }}>
                        Truck {ticket.truck_number || "-"}
                      </div>

                      <div style={{ color: "#fff", fontWeight: 900 }}>
                        {formatCys(ticket.quantity)}
                      </div>

                      <div
                        style={{
                          color: getCustomerTicketStatusColor(ticket),
                          fontWeight: 950,
                        }}
                      >
                        {customerStatus}
                      </div>

                      <div>
                        {ticket.final_pdf_url ? (
                          <a
                            href={ticket.final_pdf_url}
                            target="_blank"
                            rel="noreferrer"
                            className="primary-btn"
                            style={{
                              display: "block",
                              textAlign: "center",
                              textDecoration: "none",
                              padding: "10px 8px",
                              fontSize: 12,
                            }}
                          >
                            Final Ticket
                          </a>
                        ) : (
                          <div
                            style={{
                              color: "var(--muted)",
                              fontWeight: 800,
                              fontSize: 12,
                              display: "grid",
                              placeItems: "center",
                              border: "1px solid var(--border)",
                              borderRadius: 10,
                              padding: "10px 8px",
                            }}
                          >
                            Final Not Ready
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          )}

          {tickets.length > 5 ? (
            <button
              className="secondary-btn"
              type="button"
              onClick={() => setShowAllTickets((value) => !value)}
              style={{
                width: "100%",
                marginTop: 12,
              }}
            >
              {showAllTickets ? "Show Less" : `Show All Tickets (${tickets.length})`}
            </button>
          ) : null}
        </SectionCard>
      </div>
    </div>
  );
}
