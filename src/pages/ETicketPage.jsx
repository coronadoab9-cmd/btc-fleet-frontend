import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

const API_BASE = "https://fleet.btcfleet.app";

function formatSignedDate(value) {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

function formatCoord(value) {
  if (value === null || value === undefined || value === "") return "Unavailable";
  const num = Number(value);
  if (Number.isNaN(num)) return "Unavailable";
  return num.toFixed(6);
}

function formatWaterAdded(value) {
  if (value === null || value === undefined || value === "") return "0";
  const num = Number(value);
  if (Number.isNaN(num)) return value;
  return Number.isInteger(num) ? String(num) : num.toFixed(1);
}

export default function ETicketPage() {
  const { token } = useParams();

  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [signing, setSigning] = useState(false);
  const [error, setError] = useState("");
  const [locationStatus, setLocationStatus] = useState("");

  const [step, setStep] = useState(1);

  const [contractorName, setContractorName] = useState("");
  const [waterChoice, setWaterChoice] = useState("Water Allowed");
  const [waterAdded, setWaterAdded] = useState("");
  const [ticketAcceptance, setTicketAcceptance] = useState("Accepted");

  async function loadTicket() {
    setLoading(true);
    setError("");

    try {
      const res = await fetch(`${API_BASE}/api/etickets/${token}`);
      const data = await res.json();

      if (!res.ok) {
        setError(data.detail || "Ticket not found");
        setLoading(false);
        return;
      }

      setTicket(data);
    } catch {
      setError("Could not load ticket");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTicket();
  }, [token]);

  function getBrowserLocation() {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve({
          latitude: null,
          longitude: null,
          status: "Geolocation not supported",
        });
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            status: "Location captured",
          });
        },
        () => {
          resolve({
            latitude: null,
            longitude: null,
            status: "Location unavailable",
          });
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        }
      );
    });
  }

  async function signTicket() {
    if (!contractorName.trim()) {
      setError("Please enter contractor/customer name");
      return;
    }

    setSigning(true);
    setError("");
    setLocationStatus("Getting location...");

    try {
      const location = await getBrowserLocation();
      setLocationStatus(location.status);

      const waterAddedNumber =
        waterAdded === "" ? null : Number(waterAdded);

      const res = await fetch(`${API_BASE}/api/etickets/${token}/sign`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: contractorName.trim(),
          latitude: location.latitude,
          longitude: location.longitude,
          water_choice: waterChoice,
          water_added: waterAddedNumber,
          ticket_acceptance: ticketAcceptance,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.detail || data.message || "Could not sign ticket");
        setSigning(false);
        return;
      }

      await loadTicket();
    } catch {
      setError("Could not sign ticket. Check that backend is running on 127.0.0.1:8000");
    } finally {
      setSigning(false);
    }
  }

  function downloadPdf() {
    window.open(`${API_BASE}/api/etickets/${token}/pdf`, "_blank");
  }

  if (loading) {
    return (
      <div style={styles.page}>
        <div style={styles.shell}>
          <div style={styles.loading}>Loading ticket...</div>
        </div>
      </div>
    );
  }

  if (error && !ticket) {
    return (
      <div style={styles.page}>
        <div style={styles.shell}>
          <div style={styles.errorTitle}>Ticket Error</div>
          <div style={styles.errorText}>{error}</div>
        </div>
      </div>
    );
  }

  const isSigned = ticket?.status === "signed";

  return (
    <div style={styles.page}>
      <div style={styles.shell}>
        <div style={styles.header}>
          <div>
            <div style={styles.brand}>BTC Fleet eTicket</div>
            <div style={styles.subtitle}>Customer Delivery Confirmation</div>
          </div>

          <div
            style={{
              ...styles.statusBadge,
              ...(isSigned ? styles.statusSigned : styles.statusPending),
            }}
          >
            {isSigned ? "Signed" : "Pending"}
          </div>
        </div>

        <div style={styles.progressBar}>
          <StepDot active={step === 1} label="Ticket" />
          <StepDot active={step === 2} label="Water" />
          <StepDot active={step === 3} label="Submit" />
        </div>

        {!isSigned && (
          <>
            {step === 1 && (
              <div style={styles.ticketPanel}>
                <div style={styles.leftCard}>
                  <Row label="Ticket #" value={ticket.ticket_number} />
                  <Row label="Job Name" value={ticket.customer_name} />
                  <Row label="Address" value={ticket.address} />
                  <Row label="Mix / Truck" value={`${ticket.product} / ${ticket.truck_number}`} />
                  <Row label="Description" value={ticket.product} />
                  <Row label="Quantity" value={ticket.quantity} />
                </div>

                <div style={styles.navButtons}>
                  <button style={styles.orangeBtn} onClick={() => setStep(2)}>
                    Next
                  </button>
                </div>
              </div>
            )}

            {step === 2 && (
              <div style={styles.ticketPanel}>
                <div style={styles.centerCard}>
                  <div style={styles.blockTitle}>Load / Water Confirmation</div>

                  <Row label="Load Time" value={new Date().toLocaleTimeString()} />
                  <Row label="Time Limit" value="100 min" />

                  <label style={styles.inputLabel}>Water Choice</label>
                  <select
                    style={styles.input}
                    value={waterChoice}
                    onChange={(e) => setWaterChoice(e.target.value)}
                  >
                    <option>Water Allowed</option>
                    <option>Water Added</option>
                    <option>No Water</option>
                  </select>

                  <label style={styles.inputLabel}>Water Added (gal)</label>
                  <input
                    style={styles.input}
                    value={waterAdded}
                    onChange={(e) => setWaterAdded(e.target.value)}
                    placeholder="Enter gallons"
                  />
                </div>

                <div style={styles.navButtons}>
                  <button style={styles.secondaryBtn} onClick={() => setStep(1)}>
                    Back
                  </button>
                  <button style={styles.orangeBtn} onClick={() => setStep(3)}>
                    Next
                  </button>
                </div>
              </div>
            )}

            {step === 3 && (
              <div style={styles.ticketPanel}>
                <div style={styles.rightCard}>
                  <div style={styles.blockTitle}>Final Confirmation</div>

                  <label style={styles.inputLabel}>Contractor / Customer Signature</label>
                  <input
                    style={styles.input}
                    value={contractorName}
                    onChange={(e) => setContractorName(e.target.value)}
                    placeholder="Enter printed name"
                  />

                  <label style={styles.inputLabel}>Ticket Acceptance</label>
                  <select
                    style={styles.input}
                    value={ticketAcceptance}
                    onChange={(e) => setTicketAcceptance(e.target.value)}
                  >
                    <option>Accepted</option>
                    <option>Rejected</option>
                  </select>

                  <div style={styles.summaryBox}>
                    <div>Water: {waterChoice}</div>
                    <div>Water Added: {waterAdded || 0} gal</div>
                    <div>Acceptance: {ticketAcceptance}</div>
                  </div>

                  {locationStatus ? (
                    <div style={styles.locationStatus}>{locationStatus}</div>
                  ) : null}

                  {error ? <div style={styles.inlineError}>{error}</div> : null}
                </div>

                <div style={styles.navButtons}>
                  <button style={styles.secondaryBtn} onClick={() => setStep(2)}>
                    Back
                  </button>
                  <button
                    style={styles.orangeBtn}
                    onClick={signTicket}
                    disabled={signing}
                  >
                    {signing ? "Submitting..." : "Submit"}
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {isSigned && (
          <>
            <div style={styles.signedHeaderCard}>
              <div style={styles.blockTitle}>Ticket Details</div>
              <Row label="Ticket #" value={ticket.ticket_number} />
              <Row label="Customer" value={ticket.customer_name} />
              <Row label="Address" value={ticket.address} />
              <Row label="Plant" value={ticket.plant} />
              <Row label="Truck" value={ticket.truck_number} />
              <Row label="Product" value={ticket.product} />
              <Row label="Quantity" value={ticket.quantity} />
            </div>

            <div style={styles.stamp}>
              <div style={styles.stampCheck}>✓ CUSTOMER SIGNED</div>

              <div style={styles.stampRow}>
                <span style={styles.stampLabel}>Signed by:</span>
                <span style={styles.stampValue}>{ticket.signed_name || "-"}</span>
              </div>

              <div style={styles.stampRow}>
                <span style={styles.stampLabel}>Signed at:</span>
                <span style={styles.stampValue}>{formatSignedDate(ticket.signed_at)}</span>
              </div>

              <div style={styles.stampRow}>
                <span style={styles.stampLabel}>Latitude:</span>
                <span style={styles.stampValue}>{formatCoord(ticket.signed_latitude)}</span>
              </div>

              <div style={styles.stampRow}>
                <span style={styles.stampLabel}>Longitude:</span>
                <span style={styles.stampValue}>{formatCoord(ticket.signed_longitude)}</span>
              </div>

              <div style={styles.stampRow}>
                <span style={styles.stampLabel}>Water Choice:</span>
                <span style={styles.stampValue}>{ticket.water_choice || "-"}</span>
              </div>

              <div style={styles.stampRow}>
                <span style={styles.stampLabel}>Water Added:</span>
                <span style={styles.stampValue}>{formatWaterAdded(ticket.water_added)} gal</span>
              </div>

              <div style={styles.stampRow}>
                <span style={styles.stampLabel}>Acceptance:</span>
                <span style={styles.stampValue}>{ticket.ticket_acceptance || "-"}</span>
              </div>

              <div style={styles.stampAccepted}>Status: {ticket.ticket_acceptance || "Accepted"}</div>
            </div>

            <div style={styles.downloadWrap}>
              <button style={styles.orangeBtn} onClick={downloadPdf}>
                Download Signed PDF Copy
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function StepDot({ active, label }) {
  return (
    <div style={styles.stepWrap}>
      <div
        style={{
          ...styles.stepDot,
          ...(active ? styles.stepDotActive : {}),
        }}
      />
      <div style={styles.stepLabel}>{label}</div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div style={styles.row}>
      <div style={styles.rowLabel}>{label}</div>
      <div style={styles.rowValue}>{value || "-"}</div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "#0B1A2B",
    color: "#FFFFFF",
    display: "flex",
    justifyContent: "center",
    alignItems: "flex-start",
    padding: "20px 14px",
    fontFamily: "Arial, sans-serif",
  },
  shell: {
    width: "100%",
    maxWidth: "880px",
    background: "#132A44",
    border: "1px solid #244A75",
    borderRadius: "18px",
    padding: "20px",
    boxSizing: "border-box",
    boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "16px",
    marginBottom: "18px",
  },
  brand: {
    fontSize: "28px",
    fontWeight: "800",
    color: "#F97316",
    marginBottom: "4px",
  },
  subtitle: {
    fontSize: "15px",
    color: "#A9C1DA",
  },
  statusBadge: {
    padding: "10px 14px",
    borderRadius: "999px",
    fontWeight: "700",
    fontSize: "13px",
    whiteSpace: "nowrap",
  },
  statusPending: {
    background: "rgba(249, 115, 22, 0.18)",
    color: "#FFB37A",
    border: "1px solid rgba(249, 115, 22, 0.45)",
  },
  statusSigned: {
    background: "rgba(37, 194, 129, 0.18)",
    color: "#7EF0BC",
    border: "1px solid rgba(37, 194, 129, 0.45)",
  },
  progressBar: {
    display: "flex",
    gap: "20px",
    marginBottom: "22px",
    alignItems: "center",
  },
  stepWrap: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  stepDot: {
    width: "14px",
    height: "14px",
    borderRadius: "50%",
    background: "#274664",
    border: "1px solid #3B5F86",
  },
  stepDotActive: {
    background: "#F97316",
    border: "1px solid #FB923C",
  },
  stepLabel: {
    color: "#A9C1DA",
    fontSize: "13px",
    fontWeight: "600",
  },
  ticketPanel: {
    display: "flex",
    flexDirection: "column",
    gap: "14px",
  },
  leftCard: {
    background: "#0F2238",
    border: "1px solid #244A75",
    borderRadius: "14px",
    padding: "16px",
  },
  centerCard: {
    background: "#0F2238",
    border: "1px solid #244A75",
    borderRadius: "14px",
    padding: "16px",
  },
  rightCard: {
    background: "#0F2238",
    border: "1px solid #244A75",
    borderRadius: "14px",
    padding: "16px",
  },
  signedHeaderCard: {
    background: "#0F2238",
    border: "1px solid #244A75",
    borderRadius: "14px",
    padding: "16px",
    marginBottom: "16px",
  },
  blockTitle: {
    fontSize: "20px",
    fontWeight: "700",
    marginBottom: "14px",
    color: "#FFFFFF",
  },
  row: {
    display: "flex",
    justifyContent: "space-between",
    gap: "12px",
    padding: "10px 0",
    borderBottom: "1px solid rgba(255,255,255,0.06)",
  },
  rowLabel: {
    color: "#A9C1DA",
    fontSize: "14px",
    minWidth: "120px",
  },
  rowValue: {
    color: "#FFFFFF",
    fontWeight: "700",
    textAlign: "right",
    flex: 1,
    wordBreak: "break-word",
  },
  inputLabel: {
    display: "block",
    fontSize: "14px",
    color: "#A9C1DA",
    marginBottom: "8px",
    marginTop: "12px",
  },
  input: {
    width: "100%",
    height: "48px",
    borderRadius: "10px",
    border: "1px solid #244A75",
    background: "#183556",
    color: "#FFFFFF",
    padding: "0 14px",
    fontSize: "16px",
    boxSizing: "border-box",
    outline: "none",
  },
  navButtons: {
    display: "flex",
    justifyContent: "space-between",
    gap: "10px",
  },
  orangeBtn: {
    flex: 1,
    height: "48px",
    border: "none",
    borderRadius: "10px",
    background: "linear-gradient(90deg, #F97316, #FB923C)",
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: "16px",
    cursor: "pointer",
  },
  secondaryBtn: {
    flex: 1,
    height: "48px",
    border: "1px solid #244A75",
    borderRadius: "10px",
    background: "#183556",
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: "16px",
    cursor: "pointer",
  },
  summaryBox: {
    marginTop: "16px",
    padding: "14px",
    borderRadius: "12px",
    background: "#183556",
    border: "1px solid #244A75",
    color: "#FFFFFF",
    lineHeight: "1.8",
  },
  locationStatus: {
    marginTop: "12px",
    color: "#A9C1DA",
    fontSize: "13px",
  },
  inlineError: {
    marginTop: "12px",
    color: "#FFB5BF",
    fontSize: "14px",
    fontWeight: "700",
  },
  stamp: {
    background: "rgba(37, 194, 129, 0.10)",
    border: "1px solid rgba(37, 194, 129, 0.45)",
    borderRadius: "14px",
    padding: "16px",
  },
  stampCheck: {
    color: "#7EF0BC",
    fontWeight: "800",
    fontSize: "18px",
    marginBottom: "12px",
  },
  stampRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: "16px",
    padding: "8px 0",
    borderBottom: "1px solid rgba(255,255,255,0.06)",
  },
  stampLabel: {
    color: "#A9C1DA",
    fontSize: "14px",
  },
  stampValue: {
    color: "#FFFFFF",
    fontWeight: "700",
    textAlign: "right",
    wordBreak: "break-word",
  },
  stampAccepted: {
    marginTop: "14px",
    color: "#7EF0BC",
    fontWeight: "700",
    fontSize: "15px",
  },
  downloadWrap: {
    marginTop: "16px",
  },
  loading: {
    color: "#FFFFFF",
    fontSize: "18px",
  },
  errorTitle: {
    color: "#FFFFFF",
    fontSize: "22px",
    fontWeight: "700",
    marginBottom: "10px",
  },
  errorText: {
    color: "#FFB5BF",
    fontSize: "16px",
  },
};