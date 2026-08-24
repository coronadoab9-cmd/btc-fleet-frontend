import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "../lib/api";
import "./customer-portal.css";

// Customer-facing portal feature visibility.
// Keep these features in the codebase so they can be restored later.
const CUSTOMER_PORTAL_SHOW_TICKET_STATUS = false;
const CUSTOMER_PORTAL_SHOW_HERO_NEXT_DELIVERY = false;
const CUSTOMER_PORTAL_SHOW_NEXT_DELIVERY = false;
const CUSTOMER_PORTAL_SHOW_ROUTE_ETA = false;
const CUSTOMER_PORTAL_SHOW_ACTIVITY_FEED = false;

const CUSTOMER_PORTAL_TRANSLATIONS = {
  en: {
    brand: "BTC Customer Portal",
    fieldAccess: "Field operations live access",
    adminView: "Customer admin job view",
    backToOrders: "Back to All Orders",
    refresh: "Refresh",
    deliveryComplete: "Delivery Complete",
    liveDelivery: "Live Delivery",
    orderNumber: "Order #",
    fieldLinkExpires: "This field link expires",
    orderProgress: "Order Progress",
    delivered: "Delivered",
    deliveredLower: "delivered",
    remaining: "Remaining",
    deliverySummary: "Delivery Summary",
    orderTotal: "Order Total",
    deliveryTickets: "Delivery Tickets",
    noTickets: "No tickets found for this job.",
    ticket: "Ticket",
    truck: "Truck",
    loadTime: "Load Time",
    loadOrder: "Load / Order",
    status: "Status",
    finalTicket: "Final Ticket",
    download: "Download",
    awaitingSignature: "Awaiting Signature",
    showLess: "Show Less",
    showAllTickets: "Show All Tickets",
    projectOverview: "Project Overview",
    customer: "Customer",
    address: "Address",
    tickets: "Tickets",
    documents: "Documents",
    downloadFinalPackage: "Download Final Ticket Package",
    finalPackagePending: "Final ticket package will be available after tickets are signed.",
    loadingPortal: "Loading customer portal...",
    loadError: "Could not load customer portal.",
  },
  es: {
    brand: "Portal del Cliente BTC",
    fieldAccess: "Acceso en vivo para operaciones de campo",
    adminView: "Vista del proyecto para administrador del cliente",
    backToOrders: "Volver a Todos los Pedidos",
    refresh: "Actualizar",
    deliveryComplete: "Entrega Completa",
    liveDelivery: "Entrega en Vivo",
    orderNumber: "Pedido #",
    fieldLinkExpires: "Este enlace de campo vence",
    orderProgress: "Progreso del Pedido",
    delivered: "Entregado",
    deliveredLower: "entregado",
    remaining: "Restante",
    deliverySummary: "Resumen de Entrega",
    orderTotal: "Total del Pedido",
    deliveryTickets: "Tickets de Entrega",
    noTickets: "No se encontraron tickets para este trabajo.",
    ticket: "Ticket",
    truck: "Camión",
    loadTime: "Hora de Carga",
    loadOrder: "Carga / Pedido",
    status: "Estado",
    finalTicket: "Ticket Final",
    download: "Descargar",
    awaitingSignature: "Esperando Firma",
    showLess: "Mostrar Menos",
    showAllTickets: "Mostrar Todos los Tickets",
    projectOverview: "Resumen del Proyecto",
    customer: "Cliente",
    address: "Dirección",
    tickets: "Tickets",
    documents: "Documentos",
    downloadFinalPackage: "Descargar Paquete de Tickets Finales",
    finalPackagePending: "El paquete de tickets finales estará disponible después de que se firmen los tickets.",
    loadingPortal: "Cargando portal del cliente...",
    loadError: "No se pudo cargar el portal del cliente.",
  },
};

function formatCys(value) {
  const num = Number(value || 0);
  return `${num.toFixed(1)} cys`;
}

function formatLoadTime(value, locale = "en-US") {
  if (!value) return "-";

  try {
    const dt = new Date(value);

    return new Intl.DateTimeFormat(locale, {
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
  const eTicketStatus = String(ticket?.status || "pending").toLowerCase();
  const acceptance = String(ticket?.ticket_acceptance || "").toLowerCase();

  if (acceptance.includes("rejected")) return "Rejected";
  if (eTicketStatus === "signed") return "Delivered";

  const sysdyneStatus = String(
    ticket?.sysdyne_truck_status ||
      ticket?.order_current_status ||
      ""
  )
    .trim()
    .toUpperCase();

  const statusLabels = {
    TICKETED: "Ticket Printed",
    PRINTED: "Ticket Printed",
    LOADING: "Loading",
    LOADED: "Loaded",
    TOJOB: "En Route",
    "TO JOB": "En Route",
    ONJOB: "On Job",
    "ON JOB": "On Job",
    POURING: "Pouring",
    DELIVERED: "Delivered",
    WASHING: "Washing Out",
    TOPLANT: "Returning to Plant",
    "TO PLANT": "Returning to Plant",
    ATPLANT: "At Plant",
    "AT PLANT": "At Plant",
    INSERVICE: "In Service",
    OUTOFSERVICE: "Out of Service",
    DEADHEAD: "Deadhead",
  };

  if (statusLabels[sysdyneStatus]) {
    return statusLabels[sysdyneStatus];
  }

  if (!ticket?.load_time) return "Waiting on Load";
  return "In Transit";
}

function statusClass(ticket) {
  const status = getCustomerTicketStatus(ticket);

  if (status === "Delivered") return "portal-status-pill portal-status-delivered";
  if (status === "Rejected") return "portal-status-pill portal-status-rejected";
  if (
    status === "Waiting on Load" ||
    status === "Ticket Printed" ||
    status === "Loading"
  ) {
    return "portal-status-pill portal-status-waiting";
  }

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
      title: `${getCustomerTicketStatus(ticket)} | Truck ${ticket.truck_number || "-"}`,
      meta: `Ticket #${ticket.ticket_number || "-"} | ${formatCys(ticket.quantity)} | ${formatLoadTime(ticket.load_time)}`,
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
  const [language, setLanguage] = useState(() => {
    try {
      return localStorage.getItem("btc_customer_portal_language") === "es" ? "es" : "en";
    } catch {
      return "en";
    }
  });

  const tr = (key) =>
    CUSTOMER_PORTAL_TRANSLATIONS[language]?.[key] ||
    CUSTOMER_PORTAL_TRANSLATIONS.en[key] ||
    key;

  const portalLocale = language === "es" ? "es-US" : "en-US";

  function setPortalLanguage(nextLanguage) {
    const normalized = nextLanguage === "es" ? "es" : "en";
    setLanguage(normalized);
    try {
      localStorage.setItem("btc_customer_portal_language", normalized);
    } catch {
      // The toggle still works for the current page if storage is unavailable.
    }
  }

  async function loadPortal({ silent = false } = {}) {
    if (!silent) {
      setLoading(true);
      setError("");
    }

    try {
      const endpoint = isFieldAccess
        ? `/api/customer/live/${portalToken}`
        : `/api/customer/jobs/${portalToken}`;

      let options = {};
      if (!isFieldAccess) {
        let auth = null;
        try {
          auth = JSON.parse(localStorage.getItem("btc_customer_auth") || "null");
        } catch {
          auth = null;
        }

        if (!auth?.token) {
          window.location.href = "/customer/login";
          return;
        }

        options = {
          headers: {
            "X-Customer-Token": auth.token,
          },
        };
      }

      const result = await apiFetch(endpoint, options);
      setData(result);

      if (!silent) {
        setError("");
      }
    } catch (err) {
      if (!silent) {
        setError(err.message || tr("loadError"));
      } else {
        console.error("Customer portal background refresh failed:", err);
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    if (portalToken) {
      loadPortal();
    }
  }, [portalToken, isFieldAccess]);

  useEffect(() => {
    if (!portalToken) return;

    const remaining = Number(data?.job?.remaining_total || 0);
    const hasLoadedPortal = Boolean(data?.job);

    // Keep active jobs current without refreshing completed orders forever.
    if (hasLoadedPortal && remaining <= 0) return;

    const timer = setInterval(() => {
      loadPortal({ silent: true });
    }, 10000);

    return () => clearInterval(timer);
  }, [portalToken, isFieldAccess, data?.job?.remaining_total]);

  if (loading) {
    return <div className="full-screen-center">{tr("loadingPortal")}</div>;
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

  const cumulativeQtyByTicket = (() => {
    const chronologicalTickets = [...tickets].sort((a, b) => {
      const timeDiff = ticketLoadMs(a) - ticketLoadMs(b);
      if (timeDiff !== 0) return timeDiff;

      return String(a.ticket_number || "").localeCompare(
        String(b.ticket_number || ""),
        undefined,
        { numeric: true }
      );
    });

    let runningTotal = 0;
    const result = new Map();

    chronologicalTickets.forEach((ticket) => {
      runningTotal += Number(ticket.quantity || 0);
      const key = String(ticket.id || ticket.ticket_number || "");
      result.set(key, runningTotal);
    });

    return result;
  })();

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
          <div className="customer-portal-brand">{tr("brand")}</div>
          <div className="customer-portal-subtitle">
            {isFieldAccess ? tr("fieldAccess") : tr("adminView")}
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
              {tr("backToOrders")}
            </button>
          ) : null}

          <div
            role="group"
            aria-label="Language / Idioma"
            style={{ display: "flex", gap: 6, alignItems: "center" }}
          >
            <button
              className={`portal-btn ${
                language === "en" ? "portal-btn-orange" : "portal-btn-light"
              }`}
              type="button"
              aria-pressed={language === "en"}
              onClick={() => setPortalLanguage("en")}
              style={{ padding: "10px 12px" }}
            >
              English
            </button>
            <button
              className={`portal-btn ${
                language === "es" ? "portal-btn-orange" : "portal-btn-light"
              }`}
              type="button"
              aria-pressed={language === "es"}
              onClick={() => setPortalLanguage("es")}
              style={{ padding: "10px 12px" }}
            >
              Español
            </button>
          </div>

          <button className="portal-btn portal-btn-light" type="button" onClick={loadPortal}>
            {tr("refresh")}
          </button>
        </div>
      </header>

      <main className="customer-portal-main">
        <section className="portal-hero">
          <div>
            <div className="portal-kicker">
              {isComplete ? tr("deliveryComplete") : tr("liveDelivery")}
            </div>
            <h1 className="portal-title">
              {job.address || `${tr("orderNumber")}${job.order_number || "-"}`}
            </h1>
            <div className="portal-meta">
              {job.customer_name || "-"} | {tr("orderNumber")}{job.order_number || "-"}
              {accessExpiration ? (
                <div className="portal-expire-note">
                  {tr("fieldLinkExpires")} {new Date(accessExpiration).toLocaleString(portalLocale)}.
                </div>
              ) : null}
            </div>
          </div>

          <div className="portal-live-card">
            {CUSTOMER_PORTAL_SHOW_HERO_NEXT_DELIVERY ? (
              <>
                <div className="portal-live-label">
                  {isComplete ? "Final Delivered" : "Next Delivery"}
                </div>
                <div className="portal-live-value">
                  {isComplete
                    ? formatCys(job.delivered_total)
                    : currentTicket?.truck_number || "-"}
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
              </>
            ) : (
              <>
                <div className="portal-live-label">{tr("orderProgress")}</div>
                <div className="portal-live-value">
                  {formatCys(job.delivered_total)} / {formatCys(job.order_total)}
                </div>
                <div>{tr("delivered")}</div>
                <div>
                  {tr("remaining")}: <strong>{formatCys(job.remaining_total)}</strong>
                </div>
              </>
            )}
          </div>
        </section>

        <section className="portal-grid">
          <div>
            <div className="portal-card">
              <div className="portal-section-header">
                <div className="portal-section-title">{tr("deliverySummary")}</div>
                <strong>
                  {progressPercent.toFixed(0)}% {tr("deliveredLower")}
                </strong>
              </div>

              <div className="portal-stats">
                <StatCard label={tr("orderTotal")} value={formatCys(job.order_total)} />
                <StatCard label={tr("delivered")} value={formatCys(job.delivered_total)} />
                <StatCard label={tr("remaining")} value={formatCys(job.remaining_total)} />
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
              <div className="portal-section-title">{tr("deliveryTickets")}</div>

              {tickets.length === 0 ? (
                <div className="portal-empty">{tr("noTickets")}</div>
              ) : (
                <>
                  <div className="portal-table-wrap">
                    <table className="portal-table">
                      <thead>
                        <tr>
                          <th>{tr("ticket")}</th>
                          <th>{tr("truck")}</th>
                          <th>{tr("loadTime")}</th>
                          <th>{tr("loadOrder")}</th>
                          {CUSTOMER_PORTAL_SHOW_TICKET_STATUS ? <th>{tr("status")}</th> : null}
                          <th>{tr("finalTicket")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleTickets.map((ticket) => (
                          <tr key={ticket.id || ticket.ticket_number}>
                            <td>#{ticket.ticket_number || "-"}</td>
                            <td>{ticket.truck_number || "-"}</td>
                            <td>{formatLoadTime(ticket.load_time, portalLocale)}</td>
                            <td>
                              {formatCys(
                                cumulativeQtyByTicket.get(
                                  String(ticket.id || ticket.ticket_number || "")
                                ) || 0
                              )}{" "}
                              / {formatCys(job.order_total)}
                            </td>
                            {CUSTOMER_PORTAL_SHOW_TICKET_STATUS ? (
                              <td>
                                <span className={statusClass(ticket)}>
                                  {getCustomerTicketStatus(ticket)}
                                </span>
                              </td>
                            ) : null}
                            <td>
                              {ticket.final_pdf_url ? (
                                <a
                                  className="portal-btn portal-btn-navy"
                                  href={ticket.final_pdf_url}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  {tr("download")}
                                </a>
                              ) : (
                                <span className="portal-empty">{tr("awaitingSignature")}</span>
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
                      {showAllTickets
                        ? tr("showLess")
                        : `${tr("showAllTickets")} (${tickets.length})`}
                    </button>
                  ) : null}
                </>
              )}
            </div>
          </div>

          <aside>
            <div className="portal-card">
              <div className="portal-section-title">{tr("projectOverview")}</div>
              <div className="portal-info-grid" style={{ marginTop: 16 }}>
                <InfoItem label={tr("customer")} value={job.customer_name} />
                <InfoItem label={tr("orderNumber")} value={job.order_number} />
                <InfoItem label={tr("address")} value={job.address} />
                <InfoItem label={tr("tickets")} value={job.ticket_count} />
              </div>
            </div>

            {CUSTOMER_PORTAL_SHOW_NEXT_DELIVERY && showNextDelivery ? (
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
                        <span>Driver</span>
                        <strong>{currentTicket.driver || "-"}</strong>
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
                        <span>Status Updated</span>
                        <strong>
                          {formatLoadTime(
                            currentTicket.sysdyne_status_time ||
                              currentTicket.portal_tracking_updated_at
                          )}
                        </strong>
                      </div>
                      <div>
                        <span>Loaded</span>
                        <strong>
                          {formatLoadTime(
                            currentTicket.loaded_time || currentTicket.load_time
                          )}
                        </strong>
                      </div>
                    </div>

                    {CUSTOMER_PORTAL_SHOW_ROUTE_ETA &&
                    currentTruck?.latitude &&
                    currentTruck?.longitude &&
                    job.address ? (
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
                    ) : CUSTOMER_PORTAL_SHOW_ROUTE_ETA ? (
                      <div className="portal-empty" style={{ marginTop: 14 }}>
                        Truck location is not available yet.
                      </div>
                    ) : null}
                  </>
                ) : (
                  <div className="portal-empty">No active delivery ticket found yet.</div>
                )}
              </div>
            ) : null}

            {CUSTOMER_PORTAL_SHOW_ACTIVITY_FEED ? (
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
            ) : null}

            <div className="portal-card">
              <div className="portal-section-title">{tr("documents")}</div>

              {finalTicketCount > 0 ? (
                <a
                  href={`https://btc-fleet-backend.onrender.com/api/customer/jobs/${packageToken}/final-ticket-package`}
                  target="_blank"
                  rel="noreferrer"
                  className="portal-btn portal-btn-navy"
                  style={{ width: "100%", marginTop: 16 }}
                >
                  {tr("downloadFinalPackage")} ({finalTicketCount})
                </a>
              ) : (
                <div className="portal-empty" style={{ marginTop: 16 }}>
                  {tr("finalPackagePending")}
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

