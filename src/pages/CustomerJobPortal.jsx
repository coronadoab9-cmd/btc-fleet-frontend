import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "../lib/api";
import "./customer-portal.css";

function formatCys(value) {
  const num = Number(value || 0);
  return `${num.toFixed(1)} cys`;
}

function formatLoadTime(value) {
  if (!value) return "-";

  try {
    const dt = new Date(value);
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

function getCustomerTicketStatus(ticket) {
  const status = String(ticket?.status || "pending").toLowerCase();
  const acceptance = String(ticket?.ticket_acceptance || "").toLowerCase();

  if (acceptance.includes("rejected")) return "Rejected";
  if (status === "signed") return "Delivered";
  if (!ticket?.load_time) return "Waiting on Load";
  return "In Transit";
}

function statusClass(ticket) {
  const status = getCustomerTicketStatus(ticket);

  if (status === "Delivered") return "portal-status-pill portal-status-delivered";
  if (status === "Rejected") return "portal-status-pill portal-status-rejected";
  if (status === "Waiting on Load") return "portal-status-pill portal-status-waiting";
  return "portal-status-pill portal-status-active";
}

function InfoItem({ label, value }) {
  return (
    <div className="portal-info-item">
      <div className="portal-label">{label}</div>
      <div className="portal-value">{value || "-"}</div>
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <div className="portal-stat">
      <div className="portal-label">{label}</div>
      <div className="portal-stat-value">{value}</div>
    </div>
  );
}

function buildActivityItems(tickets) {
  return [...tickets]
    .sort((a, b) => ticketLoadMs(b) - ticketLoadMs(a))
    .slice(0, 8)
    .map((ticket) => ({
      id: ticket.id || ticket.ticket_number,
      title: `${getCustomerTicketStatus(ticket)} ? Truck ${ticket.truck_number || "-"}`,
      meta: `Ticket #${ticket.ticket_number || "-"} ? ${formatCys(ticket.quantity)} ? ${formatLoadTime(ticket.load_time)}`,
    }));
}

export default function CustomerJobPortal({ accessType = "job" }) {
  const portalToken = useMemo(() => {
    const parts = window.location.pathname.split("/");
    return parts[parts.length - 1] || "";
  }, []);

  const isFieldAccess =
    accessType === "field" || window.location.pathname.includes("/customer/live/");

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showAllTickets, setShowAllTickets] = useState(false);

  async function loadPortal() {
    setLoading(true);
    setError("");

    try {
      const endpoint = isFieldAccess
        ? `/api/customer/live/${portalToken}`
        : `/api/customer/jobs/${portalToken}`;

      const result = await apiFetch(endpoint);
      setData(result);
    } catch (err) {
      setError(err.message || "Could not load customer portal.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (portalToken) {
      loadPortal();
    }
  }, [portalToken, isFieldAccess]);

  useEffect(() => {
    if (!portalToken) return;

    const timer = setInterval(() => {
      loadPortal();
    }, 60000);

    return () => clearInterval(timer);
  }, [portalToken, isFieldAccess]);

  if (loading) {
    return <div className="full-screen-center">Loading customer portal...</div>;
  }

  if (error) {
    return <div className="full-screen-center">{error}</div>;
  }

  const job = data?.job || {};
  const tickets = data?.tickets || [];
  const documents = data?.documents || [];
  const activeTrucks = data?.active_trucks || [];
  const currentTicket = getCurrentPortalTicket(tickets);
  const currentTruck = findTruckForTicket(activeTrucks, currentTicket);

  let customerAuth = null;
  try {
    customerAuth = JSON.parse(localStorage.getItem("btc_customer_auth") || "null");
  } catch {
    customerAuth = null;
  }

  const loggedInCustomerName = String(customerAuth?.customer?.customer_name || "")
    .trim()
    .toLowerCase();

  const portalCustomerName = String(job.customer_name || "")
    .trim()
    .toLowerCase();

  const canBackToDashboard =
    Boolean(customerAuth?.token) &&
    loggedInCustomerName &&
    portalCustomerName &&
    loggedInCustomerName === portalCustomerName;

  const sortedTickets = [...tickets].sort((a, b) => ticketLoadMs(b) - ticketLoadMs(a));
  const visibleTickets = showAllTickets ? sortedTickets : sortedTickets.slice(0, 8);
  const finalTicketCount = tickets.filter((ticket) => ticket.final_pdf_url).length;

  const orderTotal = Number(job.order_total || 0);
  const deliveredTotal = Number(job.delivered_total || 0);
  const remainingTotal = Number(job.remaining_total || 0);
  const progressPercent =
    orderTotal > 0 ? Math.max(0, Math.min(100, (deliveredTotal / orderTotal) * 100)) : 0;

  const isComplete = remainingTotal <= 0;
  const showNextDelivery =
    !isComplete &&
    currentTicket &&
    String(currentTicket.status || "pending").toLowerCase() !== "signed";

  const activityItems = buildActivityItems(tickets);
  const packageToken = data?.job?.job_portal_token || portalToken;
  const accessExpiration = data?.access?.expires_at;

  return (
    <div className="customer-portal-page">
      <header className="customer-portal-topbar">
        <div>
          <div className="customer-portal-brand">BTC Customer Portal</div>
          <div className="customer-portal-subtitle">
            {isFieldAccess ? "Field operations live access" : "Customer admin job view"}
          </div>
        </div>

        <div className="customer-portal-actions">
          {canBackToDashboard ? (
            <button
              className="portal-btn portal-btn-light"
              type="button"
              onClick={() => {
                window.location.href = "/customer/dashboard";
              }}
            >
              Back to All Orders
            </button>
          ) : null}

          <button className="portal-btn portal-btn-light" type="button" onClick={loadPortal}>
            Refresh
          </button>
        </div>
      </header>

      <main className="customer-portal-main">
        <section className="portal-hero">
          <div>
            <div className="portal-kicker">
              {isComplete ? "Delivery Complete" : "Live Delivery"}
            </div>
            <h1 className="portal-title">
              {job.address || `Order #${job.order_number || "-"}`}
            </h1>
            <div className="portal-meta">
              {job.customer_name || "-"} � Order #{job.order_number || "-"}
              {accessExpiration ? (
                <div className="portal-expire-note">
                  This field link expires {new Date(accessExpiration).toLocaleString()}.
                </div>
              ) : null}
            </div>
          </div>

          <div className="portal-live-card">
            <div className="portal-live-label">
              {isComplete ? "Final Delivered" : "Next Delivery"}
            </div>
            <div className="portal-live-value">
              {isComplete ? formatCys(job.delivered_total) : currentTicket?.truck_number || "-"}
            </div>
            {!isComplete ? (
              <div className="portal-live-details">
                <span>Ticket #{currentTicket?.ticket_number || "-"}</span>
                <span>{formatCys(currentTicket?.quantity)}</span>
                <span>{getCustomerTicketStatus(currentTicket)}</span>
              </div>
            ) : null}
            <div>
              Remaining: <strong>{formatCys(job.remaining_total)}</strong>
            </div>
          </div>
        </section>

        <section className="portal-grid">
          <div>
            <div className="portal-card">
              <div className="portal-section-header">
                <div className="portal-section-title">Delivery Summary</div>
                <strong>{progressPercent.toFixed(0)}% delivered</strong>
              </div>

              <div className="portal-stats">
                <StatCard label="Order Total" value={formatCys(job.order_total)} />
                <StatCard label="Delivered" value={formatCys(job.delivered_total)} />
                <StatCard label="Remaining" value={formatCys(job.remaining_total)} />
              </div>

              <div style={{ marginTop: 18 }}>
                <div className="portal-progress-track">
                  <div
                    className={`portal-progress-fill ${isComplete ? "complete" : ""}`}
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="portal-card">
              <div className="portal-section-title">Ticket Activity</div>

              {tickets.length === 0 ? (
                <div className="portal-empty">No tickets found for this job.</div>
              ) : (
                <>
                  <div className="portal-table-wrap">
                    <table className="portal-table">
                      <thead>
                        <tr>
                          <th>Ticket</th>
                          <th>Truck</th>
                          <th>Load Time</th>
                          <th>Qty</th>
                          <th>Status</th>
                          <th>Final Ticket</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleTickets.map((ticket) => (
                          <tr key={ticket.id || ticket.ticket_number}>
                            <td>#{ticket.ticket_number || "-"}</td>
                            <td>{ticket.truck_number || "-"}</td>
                            <td>{formatLoadTime(ticket.load_time)}</td>
                            <td>{formatCys(ticket.quantity)}</td>
                            <td>
                              <span className={statusClass(ticket)}>
                                {getCustomerTicketStatus(ticket)}
                              </span>
                            </td>
                            <td>
                              {ticket.final_pdf_url ? (
                                <a
                                  className="portal-btn portal-btn-navy"
                                  href={ticket.final_pdf_url}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  Download
                                </a>
                              ) : (
                                <span className="portal-empty">Pending</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {tickets.length > 8 ? (
                    <button
                      className="portal-btn portal-btn-navy"
                      type="button"
                      onClick={() => setShowAllTickets((v) => !v)}
                      style={{ marginTop: 14 }}
                    >
                      {showAllTickets ? "Show Less" : `Show All Tickets (${tickets.length})`}
                    </button>
                  ) : null}
                </>
              )}
            </div>
          </div>

          <aside>
            <div className="portal-card">
              <div className="portal-section-title">Project Overview</div>
              <div className="portal-info-grid" style={{ marginTop: 16 }}>
                <InfoItem label="Customer" value={job.customer_name} />
                <InfoItem label="Order #" value={job.order_number} />
                <InfoItem label="Address" value={job.address} />
                <InfoItem label="Tickets" value={job.ticket_count} />
              </div>
            </div>

            {showNextDelivery ? (
              <div className="portal-card">
                <div className="portal-section-title">Next Delivery</div>

                {currentTicket ? (
                  <>
                    <div className="next-delivery-card">
                      <div>
                        <span>Truck</span>
                        <strong>{currentTicket.truck_number || "-"}</strong>
                      </div>
                      <div>
                        <span>Ticket</span>
                        <strong>#{currentTicket.ticket_number || "-"}</strong>
                      </div>
                      <div>
                        <span>Load</span>
                        <strong>{formatCys(currentTicket.quantity)}</strong>
                      </div>
                      <div>
                        <span>Status</span>
                        <strong>{getCustomerTicketStatus(currentTicket)}</strong>
                      </div>
                      <div>
                        <span>Load Time</span>
                        <strong>{formatLoadTime(currentTicket.load_time)}</strong>
                      </div>
                    </div>

                    {currentTruck?.latitude && currentTruck?.longitude && job.address ? (
                      <>
                        <div className="portal-map">
                          <iframe
                            title={`Route for truck ${currentTruck.truck_number}`}
                            src={buildDirectionsEmbedUrl(
                              currentTruck.latitude,
                              currentTruck.longitude,
                              job.address
                            )}
                            width="100%"
                            height="290"
                            style={{ border: 0, display: "block" }}
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
                          className="portal-btn portal-btn-orange"
                          style={{ width: "100%", marginTop: 12 }}
                        >
                          Open Route / ETA
                        </a>
                      </>
                    ) : (
                      <div className="portal-empty" style={{ marginTop: 14 }}>
                        Truck location is not available yet.
                      </div>
                    )}
                  </>
                ) : (
                  <div className="portal-empty">No active delivery ticket found yet.</div>
                )}
              </div>
            ) : null}

            <div className="portal-card">
              <div className="portal-section-title">Activity Feed</div>

              {activityItems.length > 0 ? (
                <div className="portal-activity-feed">
                  {activityItems.map((item) => (
                    <div className="portal-activity-item" key={item.id}>
                      <div className="portal-activity-dot"></div>
                      <div>
                        <strong>{item.title}</strong>
                        <span>{item.meta}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="portal-empty" style={{ marginTop: 16 }}>
                  No activity yet.
                </div>
              )}
            </div>

            <div className="portal-card">
              <div className="portal-section-title">Documents</div>

              {finalTicketCount > 0 ? (
                <a
                  href={`https://btc-fleet-backend.onrender.com/api/customer/jobs/${packageToken}/final-ticket-package`}
                  target="_blank"
                  rel="noreferrer"
                  className="portal-btn portal-btn-navy"
                  style={{ width: "100%", marginTop: 16 }}
                >
                  Download Final Ticket Package ({finalTicketCount})
                </a>
              ) : (
                <div className="portal-empty" style={{ marginTop: 16 }}>
                  Final ticket package will be available after tickets are signed.
                </div>
              )}

              {documents.length > 0 ? (
                <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
                  {documents.map((doc) => (
                    <a
                      key={doc.id}
                      href={`https://btc-fleet-backend.onrender.com${doc.download_path}`}
                      target="_blank"
                      rel="noreferrer"
                      className="portal-btn portal-btn-light"
                    >
                      {doc.file_name}
                    </a>
                  ))}
                </div>
              ) : null}
            </div>
          </aside>
        </section>
      </main>
    </div>
  );
}
