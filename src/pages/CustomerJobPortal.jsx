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

export default function CustomerJobPortal() {
  const jobToken = useMemo(() => {
    const parts = window.location.pathname.split("/");
    return parts[parts.length - 1] || "";
  }, []);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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

  const showNextDelivery =
    Number(job.remaining_total || 0) > 0 &&
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

          <button className="secondary-btn" type="button" onClick={loadPortal}>
            Refresh
          </button>
        </div>

        <SectionCard title="Job Information">
          <Row label="Customer" value={job.customer_name} />
          <Row label="Address" value={job.address} />
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
              {[...tickets]
                .sort((a, b) => ticketLoadMs(b) - ticketLoadMs(a))
                .map((ticket) => {
                  const isSigned = String(ticket.status || "").toLowerCase() === "signed";

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
                          color: isSigned ? "#bbf7d0" : "#fed7aa",
                          fontWeight: 950,
                        }}
                      >
                        {isSigned ? "Signed" : "Pending"}
                      </div>

                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1fr 1fr",
                          gap: 8,
                        }}
                      >
                        {ticket.qc_pdf_url ? (
                          <a
                            href={ticket.qc_pdf_url}
                            target="_blank"
                            rel="noreferrer"
                            className="secondary-btn"
                            style={{
                              textAlign: "center",
                              textDecoration: "none",
                              padding: "10px 8px",
                              fontSize: 12,
                            }}
                          >
                            QC PDF
                          </a>
                        ) : (
                          <span />
                        )}

                        {ticket.final_pdf_url ? (
                          <a
                            href={ticket.final_pdf_url}
                            target="_blank"
                            rel="noreferrer"
                            className="primary-btn"
                            style={{
                              textAlign: "center",
                              textDecoration: "none",
                              padding: "10px 8px",
                              fontSize: 12,
                            }}
                          >
                            Final PDF
                          </a>
                        ) : (
                          <div
                            style={{
                              color: "var(--muted)",
                              fontWeight: 800,
                              fontSize: 12,
                              display: "grid",
                              placeItems: "center",
                            }}
                          >
                            Not signed
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
