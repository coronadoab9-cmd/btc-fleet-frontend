import { useEffect, useMemo, useRef, useState } from "react";
import { apiFetch, buildEticketPdfUrl } from "../lib/api";

const API_QR_BATCH = "https://btcfleet.app/qr/batch-weights";
const API_QR_TERMS = "https://btcfleet.app/qr/terms";
const CENTRAL_TZ = "America/Chicago";

function getPoint(event, canvas) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  };
}

function formatCentralDateTime(value) {
  if (!value) return "-";
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: CENTRAL_TZ,
      month: "2-digit",
      day: "2-digit",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function parseMixDetails(product = "") {
  const text = String(product || "").toUpperCase();
  const strengthMatch = text.match(/(\d{4})\s*PSI/);
  const sackMatch = text.match(/(\d+(?:\.\d+)?)\s*SK/);
  const hasSlag = text.includes("SLAG");
  const hasAsh = text.includes("ASH");
  const noAir = text.includes("NO AIR");
  const hasAir = text.includes("AIR") && !noAir;

  return {
    strength: strengthMatch ? `${strengthMatch[1]} PSI` : "-",
    slump: "4.5 in ± 1.5 in",
    airContent: noAir
      ? "No Air / still ± 1.5%"
      : hasAir
      ? "4.5% ± 1.5%"
      : "4.5% ± 1.5%",
    description: `${sackMatch ? sackMatch[1] : "-"} SK | ${
      hasSlag ? "Slag" : hasAsh ? "Ash" : "Standard"
    } | ${noAir ? "No Air" : "Air"}`,
  };
}

function SummaryRow({ label, value }) {
  return (
    <div className="asset-row">
      <span>{label}</span>
      <strong>{value || "-"}</strong>
    </div>
  );
}

function InfoNotice({ children }) {
  return (
    <div
      style={{
        background: "var(--panel-2)",
        border: "1px solid var(--border)",
        borderRadius: 14,
        padding: 14,
        color: "#d7e7f7",
        lineHeight: 1.5,
      }}
    >
      {children}
    </div>
  );
}

function QrCard({ title, url }) {
  return (
    <div
      style={{
        flex: 1,
        minWidth: 0,
        background: "var(--panel-2)",
        border: "1px solid var(--border)",
        borderRadius: 14,
        padding: 16,
        display: "grid",
        justifyItems: "center",
        textAlign: "center",
      }}
    >
      <div
        style={{
          fontWeight: 800,
          color: "#fff",
          marginBottom: 12,
          fontSize: 18,
        }}
      >
        {title}
      </div>

      <div
        style={{
          background: "#fff",
          width: 150,
          height: 150,
          borderRadius: 12,
          display: "grid",
          placeItems: "center",
          marginBottom: 10,
          overflow: "hidden",
        }}
      >
        <img
          src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(
            url
          )}`}
          alt={title}
          style={{ width: "100%", height: "100%" }}
        />
      </div>

      <div
        style={{
          color: "var(--muted)",
          fontSize: 12,
          wordBreak: "break-all",
        }}
      >
        {url}
      </div>
    </div>
  );
}

export default function ETicketPage() {
  const token = useMemo(() => {
    const parts = window.location.pathname.split("/");
    return parts[parts.length - 1] || "";
  }, []);

  const waterSignatureRef = useRef(null);
  const finalSignatureRef = useRef(null);
  const videoRef = useRef(null);
  const photoCanvasRef = useRef(null);
  const streamRef = useRef(null);

  const drawingWaterRef = useRef(false);
  const drawingFinalRef = useRef(false);
  const lastWaterPointRef = useRef({ x: 0, y: 0 });
  const lastFinalPointRef = useRef({ x: 0, y: 0 });

  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [signed, setSigned] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [step, setStep] = useState(1);
  const [nowTick, setNowTick] = useState(Date.now());

  const [printedName, setPrintedName] = useState("");
  const [curbLineSignature, setCurbLineSignature] = useState(
    "Customer / Contractor Signature"
  );
  const [waterAllowed] = useState(25);
  const [waterAdded, setWaterAdded] = useState(0);
  const [ticketAcceptance, setTicketAcceptance] = useState("Accepted");
  const [confirmWater, setConfirmWater] = useState(false);
  const [locationData, setLocationData] = useState({
    latitude: null,
    longitude: null,
  });

  const [waterSignatureDrawn, setWaterSignatureDrawn] = useState(false);
  const [waterSignatureDataUrl, setWaterSignatureDataUrl] = useState("");
  const [finalSignatureDrawn, setFinalSignatureDrawn] = useState(false);
  const [finalSignatureDataUrl, setFinalSignatureDataUrl] = useState("");

  const [photoPreview, setPhotoPreview] = useState("");
  const [cameraStarted, setCameraStarted] = useState(false);

  useEffect(() => {
    const id = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  async function loadTicket() {
    setLoading(true);
    setError("");
    try {
      const data = await apiFetch(`/api/etickets/${token}`);
      setTicket(data);
      setPrintedName(data.signed_name || "");
      setSigned(data.status === "signed");
      setFinalSignatureDataUrl(data.signature_data_url || "");
      setPhotoPreview(data.photo_data_url || "");
      setWaterAdded(Number(data.water_added || 0));
      if (data.signature_data_url) {
        setFinalSignatureDrawn(true);
      }
    } catch (err) {
      setError(err.message || "Ticket not found");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (token) {
      loadTicket();
    }
  }, [token]);

  useEffect(() => {
    if (signed || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocationData({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        });
      },
      () => {}
    );
  }, [signed]);

  function setupCanvas(canvas, bg = "#0b1a2b") {
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    const width = Math.max(Math.floor(rect.width), 300);
    const height = Math.max(Math.floor(rect.height), 120);

    canvas.width = width * ratio;
    canvas.height = height * ratio;

    const ctx = canvas.getContext("2d");
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = "#ffffff";
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }

  useEffect(() => {
    if (signed) return;

    setupCanvas(waterSignatureRef.current);
    setupCanvas(finalSignatureRef.current);

    if (waterSignatureDataUrl && waterSignatureRef.current) {
      const img = new Image();
      img.onload = () => {
        const c = waterSignatureRef.current;
        const ctx = c.getContext("2d");
        const ratio = Math.max(window.devicePixelRatio || 1, 1);
        ctx.drawImage(img, 0, 0, c.width / ratio, c.height / ratio);
      };
      img.src = waterSignatureDataUrl;
    }

    if (finalSignatureDataUrl && finalSignatureRef.current) {
      const img = new Image();
      img.onload = () => {
        const c = finalSignatureRef.current;
        const ctx = c.getContext("2d");
        const ratio = Math.max(window.devicePixelRatio || 1, 1);
        ctx.drawImage(img, 0, 0, c.width / ratio, c.height / ratio);
      };
      img.src = finalSignatureDataUrl;
    }
  }, [signed, step]); // keeps signature stable while drawing

  const mix = useMemo(() => parseMixDetails(ticket?.product), [ticket]);

  const loadTimeMs = useMemo(() => {
    if (!ticket?.load_time) return null;
    const ms = new Date(ticket.load_time).getTime();
    return Number.isNaN(ms) ? null : ms;
  }, [ticket?.load_time]);

  const configuredLimitMinutes = 90;

  const remainingMinutes = useMemo(() => {
    if (!loadTimeMs) return configuredLimitMinutes;
    const elapsedMs = nowTick - loadTimeMs;
    return Math.max(
      0,
      Math.round((configuredLimitMinutes * 60000 - elapsedMs) / 60000)
    );
  }, [loadTimeMs, nowTick]);

  function startSignature(event, canvasRef, drawingRef, lastPointRef) {
    const canvas = canvasRef.current;
    if (!canvas || signed) return;

    drawingRef.current = true;
    canvas.setPointerCapture?.(event.pointerId);

    const pt = getPoint(event, canvas);
    lastPointRef.current = pt;

    const ctx = canvas.getContext("2d");
    ctx.beginPath();
    ctx.moveTo(pt.x, pt.y);
  }

  function moveSignature(
    event,
    canvasRef,
    drawingRef,
    lastPointRef,
    setDrawn
  ) {
    if (!drawingRef.current || signed) return;

    event.preventDefault?.();
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    const pt = getPoint(event, canvas);

    ctx.lineTo(pt.x, pt.y);
    ctx.stroke();

    lastPointRef.current = pt;
    setDrawn(true);
  }

  function endSignature(event, canvasRef, drawingRef, setDataUrl) {
    if (!drawingRef.current) return;

    const canvas = canvasRef.current;
    drawingRef.current = false;
    canvas?.releasePointerCapture?.(event.pointerId);

    if (canvas) {
      setDataUrl(canvas.toDataURL("image/png"));
    }
  }

  function clearCanvas(canvasRef, setterDrawn, setterData) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setupCanvas(canvas);
    setterDrawn(false);
    setterData("");
  }

  async function attachStreamToVideo() {
    const video = videoRef.current;
    const stream = streamRef.current;

    if (!video || !stream) return false;

    try {
      video.srcObject = stream;
      video.muted = true;
      video.playsInline = true;
      video.setAttribute("playsinline", "true");

      await new Promise((resolve) => {
        video.onloadedmetadata = () => resolve();
      });

      await video.play();
      return true;
    } catch (err) {
      console.error("attachStreamToVideo error:", err);
      return false;
    }
  }

  async function startCamera() {
    setError("");
    stopCamera();

    if (!window.isSecureContext) {
      setError(
        "Camera requires HTTPS or localhost. This tablet is opening the eTicket over insecure HTTP."
      );
      return;
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setError(
        "This browser/device does not support camera access. Please use another device or browser."
      );
      return;
    }

    const attempts = [
      {
        video: {
          facingMode: { ideal: "user" },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      },
      {
        video: {
          facingMode: "user",
        },
        audio: false,
      },
      {
        video: true,
        audio: false,
      },
    ];

    let lastError = null;

    for (const constraints of attempts) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia(constraints);

        if (!videoRef.current) {
          stream.getTracks().forEach((track) => track.stop());
          setError("Camera preview could not be initialized.");
          return;
        }

        videoRef.current.srcObject = stream;
        videoRef.current.playsInline = true;
        videoRef.current.muted = true;

        await videoRef.current.play();

        setCameraStarted(true);
        return;
      } catch (err) {
        console.error("startCamera attempt failed:", err);
        lastError = err;
      }
    }

    let message = "Could not open camera.";

    if (lastError?.name === "NotAllowedError") {
      message =
        "Camera permission was denied. Please allow camera access and try again.";
    } else if (lastError?.name === "NotFoundError") {
      message = "No camera was found on this device.";
    } else if (lastError?.name === "NotReadableError") {
      message = "Camera is already being used by another app.";
    } else if (lastError?.name === "OverconstrainedError") {
      message = "This device could not satisfy the requested camera settings.";
    } else if (lastError?.message) {
      message = lastError.message;
    }

    setCameraStarted(false);
    setError(message);
  }

  useEffect(() => {
    if (!cameraStarted) return;
    if (!streamRef.current) return;

    let cancelled = false;

    const run = async () => {
      await new Promise((resolve) => requestAnimationFrame(resolve));
      if (cancelled) return;
      const ok = await attachStreamToVideo();
      if (!ok && !cancelled) {
        setError("Camera opened but preview could not start.");
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [cameraStarted]);

  function stopCamera() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.srcObject = null;
    }

    setCameraStarted(false);
  }

  function capturePhoto() {
    const video = videoRef.current;
    const canvas = photoCanvasRef.current;

    if (!video || !canvas) {
      setError("Camera is not ready.");
      return;
    }

    if (!video.videoWidth || !video.videoHeight) {
      setError("Camera preview is not ready yet. Wait 1 second and try again.");
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const imageData = canvas.toDataURL("image/jpeg", 0.92);
    setPhotoPreview(imageData);
    stopCamera();
  }

  function clearPhoto() {
    setPhotoPreview("");
  }

  async function submitTicket() {
    setSubmitting(true);
    setError("");
    setSuccess("");

    try {
      if (!printedName.trim()) {
        throw new Error("Printed name is required");
      }
      if (!waterSignatureDrawn) {
        throw new Error("Customer curb line signature is required");
      }
      if (!finalSignatureDrawn) {
        throw new Error("Final signature is required");
      }
      if (!confirmWater) {
        throw new Error("Please confirm the water amount");
      }
      if (!photoPreview) {
        throw new Error("Signer photo is required");
      }

      await apiFetch(`/api/etickets/${token}/sign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: printedName.trim(),
          latitude: locationData.latitude,
          longitude: locationData.longitude,
          water_choice: `${curbLineSignature} | ${waterAllowed} gal allowed`,
          water_added: waterAdded,
          ticket_acceptance: `${ticketAcceptance} | ${curbLineSignature}`,
          signature_data_url: finalSignatureDataUrl,
          photo_data_url: photoPreview,
          batch_weights_qr_url: API_QR_BATCH,
          terms_qr_url: API_QR_TERMS,
          load_time: ticket?.load_time,
          time_limit_minutes: remainingMinutes,
          curb_line_signature_data_url: waterSignatureDataUrl,
        }),
      });

      await loadTicket();
      setSigned(true);
      setSuccess("eTicket signed successfully");
    } catch (err) {
      setError(err.message || "Could not submit ticket");
    } finally {
      setSubmitting(false);
    }
  }

  useEffect(() => {
    return () => stopCamera();
  }, []);

  if (loading) {
    return <div className="full-screen-center">Loading ticket...</div>;
  }

  if (error && !ticket) {
    return <div className="full-screen-center">{error}</div>;
  }

  if (signed) {
    return (
      <div className="app-shell" style={{ padding: 16 }}>
        <div className="panel-card" style={{ maxWidth: 760, margin: "0 auto" }}>
          <div className="panel-title">Signed eTicket</div>
          {success ? <div className="message-box">{success}</div> : null}

          <div className="asset-details">
            <SummaryRow label="Ticket #" value={ticket.ticket_number} />
            <SummaryRow label="Customer" value={ticket.customer_name} />
            <SummaryRow label="Truck" value={ticket.truck_number} />
            <SummaryRow label="Signed By" value={ticket.signed_name} />
            <SummaryRow
              label="Signed At (CDT)"
              value={formatCentralDateTime(ticket.signed_at)}
            />
          </div>

          <div style={{ display: "flex", justifyContent: "center", marginTop: 18 }}>
            <button
              className="primary-btn"
              style={{ width: "auto", marginTop: 0 }}
              onClick={() => window.open(buildEticketPdfUrl(token), "_blank")}
            >
              Open Signed PDF Copy
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell" style={{ padding: 14 }}>
      <div className="panel-card" style={{ maxWidth: 760, margin: "0 auto" }}>
        <div className="panel-title">BTC Fleet eTicket</div>
        {error ? (
          <div style={{ color: "#fecaca", marginBottom: 12, fontWeight: 700 }}>
            {error}
          </div>
        ) : null}

        <div
          style={{
            display: "flex",
            gap: 12,
            marginBottom: 18,
            color: "var(--muted)",
            fontWeight: 700,
          }}
        >
          <span style={{ color: step === 1 ? "#fff" : "var(--muted)" }}>Ticket</span>
          <span style={{ color: step === 2 ? "#fff" : "var(--muted)" }}>Water</span>
          <span style={{ color: step === 3 ? "#fff" : "var(--muted)" }}>Submit</span>
        </div>

        {step === 1 && (
          <>
            <div className="asset-details">
              <SummaryRow label="Ticket #" value={ticket.ticket_number} />
              <SummaryRow label="Job Name" value={ticket.customer_name} />
              <SummaryRow label="Address" value={ticket.address} />
              <SummaryRow
                label="Mix / Truck"
                value={`${ticket.product || "-"} / ${ticket.truck_number || "-"}`}
              />
              <SummaryRow label="Description" value={mix.description} />
              <SummaryRow label="Strength" value={mix.strength} />
              <SummaryRow label="Slump" value={mix.slump} />
              <SummaryRow label="Air" value={mix.airContent} />
              <SummaryRow label="Load Size" value={`${ticket.quantity || 0} yards`} />
              <SummaryRow
                label="Quantity Delivered Total"
                value={`${ticket.quantity || 0} yards`}
              />
              <SummaryRow label="Order Total" value={`${ticket.quantity || 0} yards`} />
            </div>

            <button className="primary-btn" onClick={() => setStep(2)}>
              Next
            </button>
          </>
        )}

        {step === 2 && (
          <>
            <div className="asset-details">
              <SummaryRow
                label="Load Time"
                value={formatCentralDateTime(ticket.load_time)}
              />
              <SummaryRow label="Time Limit" value={`${configuredLimitMinutes} min`} />
              <SummaryRow label="Remaining Time" value={`${remainingMinutes} min`} />
            </div>

            <label>Curb Line Signature</label>
            <select
              value={curbLineSignature}
              onChange={(e) => setCurbLineSignature(e.target.value)}
            >
              <option>Customer / Contractor Signature</option>
              <option>Driver signed - no one available</option>
            </select>

            <InfoNotice>
              We are not responsible for any property damage.
            </InfoNotice>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 14,
                marginTop: 16,
              }}
            >
              <div
                style={{
                  background: "var(--panel-2)",
                  border: "1px solid var(--border)",
                  borderRadius: 14,
                  padding: 16,
                }}
              >
                <div style={{ color: "var(--muted)", marginBottom: 10 }}>
                  Water Allowed
                </div>
                <div style={{ color: "#fff", fontSize: 26, fontWeight: 800 }}>
                  {waterAllowed} gal
                </div>
              </div>

              <div
                style={{
                  background: "var(--panel-2)",
                  border: "1px solid var(--border)",
                  borderRadius: 14,
                  padding: 16,
                }}
              >
                <div style={{ color: "var(--muted)", marginBottom: 10 }}>
                  Water Added
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 10,
                  }}
                >
                  <button
                    className="primary-btn"
                    style={{ width: "auto", marginTop: 0 }}
                    type="button"
                    onClick={() => setWaterAdded((v) => Math.max(0, v - 1))}
                  >
                    -
                  </button>
                  <div
                    style={{
                      color: "#fff",
                      fontSize: 26,
                      fontWeight: 800,
                      minWidth: 90,
                      textAlign: "center",
                    }}
                  >
                    {waterAdded} gal
                  </div>
                  <button
                    className="primary-btn"
                    style={{ width: "auto", marginTop: 0 }}
                    type="button"
                    onClick={() => setWaterAdded((v) => v + 1)}
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

            <div style={{ marginTop: 18, color: "#fff", fontWeight: 800 }}>
              Customer Finger Signature
            </div>
            <canvas
              ref={waterSignatureRef}
              style={{
                width: "100%",
                height: 150,
                border: "1px solid var(--border)",
                borderRadius: 14,
                touchAction: "none",
                marginTop: 10,
                background: "#0b1a2b",
              }}
              onPointerDown={(e) =>
                startSignature(
                  e,
                  waterSignatureRef,
                  drawingWaterRef,
                  lastWaterPointRef
                )
              }
              onPointerMove={(e) =>
                moveSignature(
                  e,
                  waterSignatureRef,
                  drawingWaterRef,
                  lastWaterPointRef,
                  setWaterSignatureDrawn
                )
              }
              onPointerUp={(e) =>
                endSignature(
                  e,
                  waterSignatureRef,
                  drawingWaterRef,
                  setWaterSignatureDataUrl
                )
              }
              onPointerLeave={(e) =>
                endSignature(
                  e,
                  waterSignatureRef,
                  drawingWaterRef,
                  setWaterSignatureDataUrl
                )
              }
            />
            <div style={{ marginTop: 8 }}>
              <button
                className="secondary-btn"
                type="button"
                onClick={() =>
                  clearCanvas(
                    waterSignatureRef,
                    setWaterSignatureDrawn,
                    setWaterSignatureDataUrl
                  )
                }
              >
                Clear Signature
              </button>
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              <button
                className="secondary-btn"
                type="button"
                onClick={() => setStep(1)}
              >
                Back
              </button>
              <button
                className="primary-btn"
                type="button"
                onClick={() => setStep(3)}
              >
                Next
              </button>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <div
              style={{
                background: "var(--panel-2)",
                border: "1px solid var(--border)",
                borderRadius: 16,
                padding: 18,
                marginBottom: 16,
                textAlign: "center",
              }}
            >
              <div
                style={{
                  color: "#fff",
                  fontWeight: 800,
                  fontSize: 18,
                  marginBottom: 8,
                }}
              >
                Confirm Water
              </div>
              <div style={{ color: "#fff", fontWeight: 800, fontSize: 30 }}>
                {waterAdded} gal
              </div>
              <div
                style={{
                  display: "flex",
                  gap: 10,
                  marginTop: 14,
                  justifyContent: "center",
                }}
              >
                <button
                  className="primary-btn"
                  style={{ width: "auto", marginTop: 0 }}
                  onClick={() => setConfirmWater(true)}
                >
                  Yes
                </button>
                <button
                  className="secondary-btn"
                  type="button"
                  onClick={() => {
                    setConfirmWater(false);
                    setStep(2);
                  }}
                >
                  Edit
                </button>
              </div>
            </div>

            <label>Ticket Acceptance</label>
            <select
              value={ticketAcceptance}
              onChange={(e) => setTicketAcceptance(e.target.value)}
            >
              <option>Accepted</option>
              <option>Rejected</option>
            </select>

            <div style={{ marginTop: 18 }}>
              <label>Printed Name</label>
              <input
                value={printedName}
                onChange={(e) => setPrintedName(e.target.value)}
                placeholder="Enter printed name"
              />
            </div>

            <div style={{ marginTop: 18, display: "flex", gap: 16, flexWrap: "wrap" }}>
              <QrCard title="Batch Weights" url={API_QR_BATCH} />
              <QrCard title="BTC Terms & Conditions" url={API_QR_TERMS} />
            </div>

            <div
              style={{
                marginTop: 18,
                color: "#fff",
                fontWeight: 800,
                textAlign: "center",
              }}
            >
              Final Signature
            </div>
            <canvas
              ref={finalSignatureRef}
              style={{
                width: "100%",
                height: 160,
                border: "1px solid var(--border)",
                borderRadius: 14,
                touchAction: "none",
                marginTop: 10,
                background: "#0b1a2b",
              }}
              onPointerDown={(e) =>
                startSignature(
                  e,
                  finalSignatureRef,
                  drawingFinalRef,
                  lastFinalPointRef
                )
              }
              onPointerMove={(e) =>
                moveSignature(
                  e,
                  finalSignatureRef,
                  drawingFinalRef,
                  lastFinalPointRef,
                  setFinalSignatureDrawn
                )
              }
              onPointerUp={(e) =>
                endSignature(
                  e,
                  finalSignatureRef,
                  drawingFinalRef,
                  setFinalSignatureDataUrl
                )
              }
              onPointerLeave={(e) =>
                endSignature(
                  e,
                  finalSignatureRef,
                  drawingFinalRef,
                  setFinalSignatureDataUrl
                )
              }
            />
            <div style={{ marginTop: 8, textAlign: "center" }}>
              <button
                className="secondary-btn"
                type="button"
                onClick={() =>
                  clearCanvas(
                    finalSignatureRef,
                    setFinalSignatureDrawn,
                    setFinalSignatureDataUrl
                  )
                }
              >
                Clear Signature
              </button>
            </div>

            <div
              style={{
                marginTop: 18,
                color: "#fff",
                fontWeight: 800,
                textAlign: "center",
              }}
            >
              Signer Photo
            </div>

            <div
              style={{
                display: "flex",
                gap: 10,
                flexWrap: "wrap",
                marginTop: 10,
                justifyContent: "center",
              }}
            >
              {!cameraStarted ? (
                <button
                  className="secondary-btn"
                  type="button"
                  onClick={startCamera}
                >
                  Start Camera
                </button>
              ) : (
                <>
                  <button
                    className="secondary-btn"
                    type="button"
                    onClick={capturePhoto}
                  >
                    Capture Photo
                  </button>
                  <button
                    className="secondary-btn"
                    type="button"
                    onClick={stopCamera}
                  >
                    Cancel Camera
                  </button>
                </>
              )}

              {photoPreview ? (
                <button
                  className="secondary-btn"
                  type="button"
                  onClick={clearPhoto}
                >
                  Clear Photo
                </button>
              ) : null}
            </div>

            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              style={{
                width: "100%",
                maxWidth: 420,
                height: cameraStarted ? 260 : 0,
                objectFit: "cover",
                marginTop: cameraStarted ? 12 : 0,
                borderRadius: 12,
                background: "#000",
                display: "block",
                marginLeft: "auto",
                marginRight: "auto",
                overflow: "hidden",
                opacity: cameraStarted ? 1 : 0,
                pointerEvents: cameraStarted ? "auto" : "none",
              }}
            />

            <canvas ref={photoCanvasRef} style={{ display: "none" }} />

            {photoPreview ? (
              <img
                src={photoPreview}
                alt="Signer preview"
                style={{
                  width: "100%",
                  maxWidth: 320,
                  marginTop: 12,
                  borderRadius: 12,
                  display: "block",
                  marginLeft: "auto",
                  marginRight: "auto",
                }}
              />
            ) : null}

            <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
              <button
                className="secondary-btn"
                type="button"
                onClick={() => setStep(2)}
              >
                Back
              </button>
              <button
                className="primary-btn"
                type="button"
                onClick={submitTicket}
                disabled={submitting}
              >
                {submitting ? "Submitting..." : "Submit"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}