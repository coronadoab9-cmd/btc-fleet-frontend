import { useEffect, useMemo, useRef, useState } from "react";
import { apiFetch, buildEticketPdfUrl } from "../lib/api";

const API_QR_BATCH = "https://btcfleet.app/qr/batch-weights";
const API_QR_TERMS = "https://btcfleet.app/qr/terms";
const CENTRAL_TZ = "America/Chicago";

function getPoint(event, canvas) {
  const rect = canvas.getBoundingClientRect();

  const point =
    event.touches?.[0] ||
    event.changedTouches?.[0] ||
    event.nativeEvent?.touches?.[0] ||
    event.nativeEvent?.changedTouches?.[0] ||
    event;

  return {
    x: point.clientX - rect.left,
    y: point.clientY - rect.top,
  };
}

function formatGallons(value) {
  return `${Number(value || 0).toFixed(2)} gal`;
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
  const hasAir = /\bAIR\b/.test(text) && !noAir;

  return {
    strength: strengthMatch ? `${strengthMatch[1]} PSI in 28 Days` : "-",
    slump: "4.5 in ± 1.5 in",
    airContent: hasAir ? "4.5% ± 1.5%" : "0.0% ± 1.5%",
    description: `${sackMatch ? sackMatch[1] : "-"} SK | ${
      hasSlag ? "Slag" : hasAsh ? "Ash" : "Standard"
    } | ${hasAir ? "Air" : "No Air"}`,
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
  const waterPadRef = useRef(null);
  const finalPadRef = useRef(null);

  const holdTimeoutRef = useRef(null);
  const holdIntervalRef = useRef(null);
  const holdStartedRef = useRef(false);
  const holdStartTimeRef = useRef(0);
  const holdAmountRef = useRef(0);

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
  const isPhone = window.innerWidth <= 600;

  const [curbLineSignature, setCurbLineSignature] = useState(
    "Customer / Contractor Signature"
  );
  const [curbLineSignedAt, setCurbLineSignedAt] = useState("");
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
  const [cameraStarted, setCameraStarted] = useState(false);

  const mix = useMemo(() => parseMixDetails(ticket?.product), [ticket]);

  const loadTimeMs = useMemo(() => {
    if (!ticket?.load_time) return null;
    const ms = new Date(ticket.load_time).getTime();
    return Number.isNaN(ms) ? null : ms;
  }, [ticket?.load_time]);

  const configuredLimitMinutes = 100;

  const remainingMinutes = useMemo(() => {
    if (!loadTimeMs) return configuredLimitMinutes;
    const elapsedMs = nowTick - loadTimeMs;
    return Math.max(
      0,
      Math.round((configuredLimitMinutes * 60000 - elapsedMs) / 60000)
    );
  }, [loadTimeMs, nowTick]);

  const fetchCurrentLocation = () => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject("Geolocation is not supported on this device.");
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const nextLocation = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          };
          setLocationData(nextLocation);
          resolve(nextLocation);
        },
        (geoError) => {
          reject(geoError?.message || "Could not get current location.");
        },
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0,
        }
      );
    });
  };

  useEffect(() => {
    const id = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (step === 3 && !signed && !cameraStarted) {
      startCamera();
    }
  }, [step, signed, cameraStarted]);

  useEffect(() => {
    setTimeout(() => {
      if (step === 2) {
        setupCanvas(waterSignatureRef.current);
      }

      if (step === 3) {
        setupCanvas(finalSignatureRef.current);
      }
    }, 150);
  }, [step, isPhone]);

  async function loadTicket() {
    setLoading(true);
    setError("");

    try {
      const data = await apiFetch(`/api/etickets/${token}`);
      setTicket(data);
      setSigned(data.status === "signed");
      setFinalSignatureDataUrl(data.signature_data_url || "");
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
    if (signed) return;

    fetchCurrentLocation().catch((err) => {
      console.log("Initial location fetch failed:", err);
    });
  }, [signed]);

 function setupCanvas(canvas, bg = "#0b1a2b") {
  if (!canvas) return;

  const rect = canvas.getBoundingClientRect();
  const ratio = Math.max(window.devicePixelRatio || 1, 1);

  const cssWidth = Math.max(Math.floor(rect.width), 300);
  const cssHeight = Math.max(Math.floor(rect.height), 150);

  canvas.width = cssWidth * ratio;
  canvas.height = cssHeight * ratio;

  const ctx = canvas.getContext("2d");
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);

  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, cssWidth, cssHeight);

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
  }, [signed, step, waterSignatureDataUrl, finalSignatureDataUrl]);

  function startSignature(event, canvasRef, drawingRef, lastPointRef) {
    document.addEventListener("touchmove", preventScroll, { passive: false });

    event.preventDefault?.();
    event.stopPropagation?.();

    const canvas = canvasRef.current;
    if (!canvas || signed) return;

    // Re-sync canvas size to the visible box before drawing
    const rect = canvas.getBoundingClientRect();
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    const visibleWidth = Math.max(Math.floor(rect.width), 300);
    const visibleHeight = Math.max(Math.floor(rect.height), 120);

    const currentCssWidth = Math.round(canvas.width / ratio);
    const currentCssHeight = Math.round(canvas.height / ratio);

    if (
      Math.abs(currentCssWidth - visibleWidth) > 2 ||
      Math.abs(currentCssHeight - visibleHeight) > 2
    ) {
      setupCanvas(canvas);
    }

    drawingRef.current = true;
    canvas.setPointerCapture?.(event.pointerId);

    const pt = getPoint(event, canvas);
    lastPointRef.current = pt;

    const ctx = canvas.getContext("2d");
    ctx.beginPath();
    ctx.moveTo(pt.x, pt.y);
  }

  function moveSignature(event, canvasRef, drawingRef, lastPointRef, setDrawn) {
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
    document.removeEventListener("touchmove", preventScroll);

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

  // ✅ ADD IT RIGHT HERE
  function preventScroll(e) {
    e.preventDefault();
  }

  function startTouchSignature(event, canvasRef, drawingRef, lastPointRef) {
    event.preventDefault();
    event.stopPropagation();

    const canvas = canvasRef.current;
    if (!canvas || signed) return;

    drawingRef.current = true;

    const pt = getTouchPoint(event, canvas);
    lastPointRef.current = pt;

    const ctx = canvas.getContext("2d");
    ctx.beginPath();
    ctx.moveTo(pt.x, pt.y);
  }

  function moveTouchSignature(event, canvasRef, drawingRef, lastPointRef, setDrawn) {
    if (!drawingRef.current || signed) return;

    event.preventDefault();
    event.stopPropagation();

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    const pt = getTouchPoint(event, canvas);

    ctx.lineTo(pt.x, pt.y);
    ctx.stroke();

    lastPointRef.current = pt;
    setDrawn(true);
  }

  function endTouchSignature(event, canvasRef, drawingRef, setDataUrl) {
    if (!drawingRef.current) return;

    event.preventDefault();
    event.stopPropagation();

    const canvas = canvasRef.current;
    drawingRef.current = false;

    if (canvas) {
      setDataUrl(canvas.toDataURL("image/png"));
    }
  }


  function changeWaterAdded(amount) {
    setWaterAdded((v) => {
      const next = Number(v || 0) + amount;
      return Math.max(0, Math.round(next * 100) / 100);
    });
  }

  function getAcceleratedWaterStep(baseAmount) {
    const elapsed = Date.now() - holdStartTimeRef.current;
    const direction = baseAmount > 0 ? 1 : -1;

    if (elapsed > 4000) return direction * 5;
    if (elapsed > 2500) return direction * 3;
    if (elapsed > 1200) return direction * 2;
    return direction * 1;
  }

  function startWaterPress(amount) {
    if (holdAmountRef.current !== 0) return;

    holdAmountRef.current = amount;
    holdStartedRef.current = false;
    holdStartTimeRef.current = Date.now();

    holdTimeoutRef.current = setTimeout(() => {
      holdStartedRef.current = true;

      holdIntervalRef.current = setInterval(() => {
        changeWaterAdded(getAcceleratedWaterStep(amount));
      }, 160);
    }, 400);
  }

  function stopWaterPress() {
    if (holdTimeoutRef.current) {
      clearTimeout(holdTimeoutRef.current);
      holdTimeoutRef.current = null;
    }

    if (holdIntervalRef.current) {
      clearInterval(holdIntervalRef.current);
      holdIntervalRef.current = null;
    }
  }

  function finishWaterPress() {
    if (holdAmountRef.current === 0) return;

    const amount = holdAmountRef.current;
    const wasHolding = holdStartedRef.current;

    stopWaterPress();

    if (!wasHolding) {
      changeWaterAdded(amount);
    }

    holdAmountRef.current = 0;
    holdStartedRef.current = false;
    holdStartTimeRef.current = 0;
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
      setError("This browser/device does not support camera access.");
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
        video: { facingMode: "user" },
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
          setError("Camera could not be initialized.");
          return;
        }

        streamRef.current = stream;
        setCameraStarted(true);

        const ok = await attachStreamToVideo();

        if (!ok) {
          stopCamera();
          setError("Camera opened but could not start.");
          return;
        }

        return;
      } catch (err) {
        lastError = err;
      }
    }

    let message = "Could not open camera.";

    if (lastError?.name === "NotAllowedError") {
      message = "Camera permission was denied. Please allow camera access.";
    } else if (lastError?.name === "NotFoundError") {
      message = "No camera was found on this device.";
    } else if (lastError?.name === "NotReadableError") {
      message = "Camera is already being used by another app.";
    } else if (lastError?.message) {
      message = lastError.message;
    }

    setCameraStarted(false);
    setError(message);
  }

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

  function capturePhotoFromVideo() {
    const video = videoRef.current;
    const canvas = photoCanvasRef.current;

    if (!video || !canvas) return "";
    if (!video.videoWidth || !video.videoHeight) return "";

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    return canvas.toDataURL("image/jpeg", 0.92);
  }

  async function submitTicket() {
    setSubmitting(true);
    setError("");
    setSuccess("");

    try {
      if (!waterSignatureDrawn) {
        throw new Error("Customer curb line signature is required");
      }

      if (!finalSignatureDrawn) {
        throw new Error("Final signature is required");
      }

      if (!confirmWater) {
        throw new Error("Please confirm the water amount");
      }

      let finalLocation = locationData;

      if (!finalLocation.latitude || !finalLocation.longitude) {
        finalLocation = await fetchCurrentLocation();
      }

      if (!finalLocation.latitude || !finalLocation.longitude) {
        throw new Error(
          "Location is required before signing. Please allow location access and try again."
        );
      }

      let signerPhoto = capturePhotoFromVideo();

      if (!signerPhoto && !cameraStarted) {
        await startCamera();
        await new Promise((resolve) => setTimeout(resolve, 800));
        signerPhoto = capturePhotoFromVideo();
      }

      if (!signerPhoto) {
        throw new Error(
          "Signer photo could not be captured. Please make sure camera permission is allowed."
        );
      }

      await apiFetch(`/api/etickets/${token}/sign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Signed on site",
          latitude: finalLocation.latitude,
          longitude: finalLocation.longitude,
          water_choice: `${curbLineSignature} | ${formatGallons(waterAllowed)} allowed`,
          water_added: Number(waterAdded).toFixed(2),
          ticket_acceptance: `${ticketAcceptance} | ${curbLineSignature}`,
          signature_data_url: finalSignatureDataUrl,
          curb_line_signature_data_url: waterSignatureDataUrl,
          curb_line_signed_at: curbLineSignedAt || new Date().toISOString(),
          photo_data_url: signerPhoto,
          batch_weights_qr_url: API_QR_BATCH,
          terms_qr_url: API_QR_TERMS,
          load_time: ticket?.load_time,
          time_limit_minutes: remainingMinutes,
        }),
      });

      stopCamera();
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
    return () => {
      stopCamera();
      stopWaterPress();
    };
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

          <div
            style={{
              display: "grid",
              justifyItems: "center",
              marginTop: 18,
              gap: 10,
            }}
          >
            <div
              style={{
                color: "#fff",
                fontWeight: 800,
                fontSize: 18,
              }}
            >
              Scan to Open Signed PDF
            </div>

            <div
              style={{
                background: "#fff",
                width: 180,
                height: 180,
                borderRadius: 12,
                display: "grid",
                placeItems: "center",
                overflow: "hidden",
                padding: 8,
              }}
            >
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(
                  buildEticketPdfUrl(token)
                )}`}
                alt="Signed PDF QR Code"
                style={{
                  width: "100%",
                  height: "100%",
                }}
              />

              
            </div>
            <button
                className="primary-btn"
                type="button"
                onClick={exitEticket}
                style={{
                  maxWidth: 280,
                  marginTop: 16,
                }}
              >
                Exit / Return
              </button>
          </div>
        </div>
      </div>
    );
  }

  function exitEticket() {
    try {
      if (window.BTCFleetAndroid?.exitEticket) {
        window.BTCFleetAndroid.exitEticket();
        return;
      }
    } catch {}

    if (window.history.length > 1) {
      window.history.back();
    } else {
      window.location.href = "/";
    }
  }

  return (
    <div className="app-shell" style={{ padding: 14 }}>
      <div className="panel-card" style={{ maxWidth: 760, margin: "0 auto" }}>
        <div className="panel-title">BTC eTicket</div>

        <div
          style={{
            display: "flex",
            gap: 12,
            marginBottom: 18,
            color: "var(--muted)",
            fontWeight: 700,
          }}
        >
          <span style={{ color: step === 1 ? "#fff" : "var(--muted)" }}>
            Ticket
          </span>
          <span style={{ color: step === 2 ? "#fff" : "var(--muted)" }}>
            Water
          </span>
          <span style={{ color: step === 3 ? "#fff" : "var(--muted)" }}>
            Submit
          </span>
        </div>

        {step === 1 && (
          <>
            <div className="asset-details">
              <SummaryRow label="Ticket #" value={ticket.ticket_number} />
              <SummaryRow label="Job Name" value={ticket.customer_name} />
              <SummaryRow label="Address" value={ticket.address} />
              <SummaryRow label="Mix" value={ticket.product}/>
              <SummaryRow label="Truck" value={ticket.truck_number} />
              <SummaryRow label="Description" value={mix.description} />
              <SummaryRow label="Strength" value={mix.strength} />
              <SummaryRow label="Slump" value={mix.slump} />
              <SummaryRow label="Air" value={mix.airContent} />
              <SummaryRow label="Load Size" value={`${ticket.quantity || 0} CYs`} />
              <SummaryRow
                label="Quantity Delivered Total"
                value={`${ticket.quantity || 0} CYs`}
              />
              <SummaryRow label="Order Total" value={`${ticket.quantity || 0} CYs`} />
            </div>

            <button 
              className="primary-btn"
              type="button"
              onClick={() => {
                setError("");
                setStep(2);
              }}
            >
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
                gridTemplateColumns:
                  window.innerWidth <= 768
                    ? "1fr"
                    : "1fr 1fr",
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
                  {formatGallons(waterAllowed)}
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
                    style={{
                      width: 64,
                      height: 52,
                      marginTop: 0,
                      fontSize: 26,
                      fontWeight: 900,
                      touchAction: "none",
                      userSelect: "none",
                    }}
                    type="button"
                    onPointerDown={(e) => {
                      e.preventDefault();
                      startWaterPress(-1);
                    }}
                    onPointerUp={(e) => {
                      e.preventDefault();
                      finishWaterPress();
                    }}
                    onPointerLeave={finishWaterPress}
                    onPointerCancel={finishWaterPress}
                  >
                    -
                  </button>

                  <div
                    style={{
                      color: "#fff",
                      fontSize: 28,
                      fontWeight: 900,
                      minWidth: 130,
                      textAlign: "center",
                    }}
                  >
                    {formatGallons(waterAdded)}
                  </div>

                  <button
                    className="primary-btn"
                    style={{
                      width: 64,
                      height: 52,
                      marginTop: 0,
                      fontSize: 26,
                      fontWeight: 900,
                      touchAction: "none",
                      userSelect: "none",
                    }}
                    type="button"
                    onPointerDown={(e) => {
                      e.preventDefault();
                      startWaterPress(1);
                    }}
                    onPointerUp={(e) => {
                      e.preventDefault();
                      finishWaterPress();
                    }}
                    onPointerLeave={finishWaterPress}
                    onPointerCancel={finishWaterPress}
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
                onPointerDown={(e) =>
                  startSignature(e, waterSignatureRef, drawingWaterRef, lastWaterPointRef)
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
                  endSignature(e, waterSignatureRef, drawingWaterRef, setWaterSignatureDataUrl)
                }
                onPointerLeave={(e) =>
                  endSignature(e, waterSignatureRef, drawingWaterRef, setWaterSignatureDataUrl)
                }
                style={{
                  width: "100%",
                  height: 150,
                  display: "block",
                  border: "1px solid var(--border)",
                  borderRadius: 14,
                  touchAction: "none",
                  userSelect: "none",
                  WebkitUserSelect: "none",
                  marginTop: 10,
                  background: "#0b1a2b",
                }}
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

            <div style={{ marginTop: 12 }}>
              {error ? (
                <div
                  style={{
                    color: "#fecaca",
                    fontWeight: 900,
                    fontSize: 18,
                    marginBottom: 10,
                    textAlign: "left",
                  }}
                >
                  {error}
                </div>
              ) : null}

              <div style={{ display: "flex", gap: 10 }}>
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
                  onClick={() => {
                    if (!waterSignatureDrawn) {
                      setError("Curb line signature is required before continuing.");
                      return;
                    }

                    setError("");
                    setCurbLineSignedAt(new Date().toISOString());
                    setStep(3);
                  }}
                >
                  Next
                </button>
              </div>
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
                {formatGallons(waterAdded)}
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
              <option>Accepted Delivery</option>
              <option>Rejected Delivery</option>
            </select>

            <div
              style={{
                marginTop: 18,
                display: "flex",
                gap: 16,
                flexWrap: "wrap",
              }}
            >
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
                onPointerDown={(e) =>
                  startSignature(e, finalSignatureRef, drawingFinalRef, lastFinalPointRef)
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
                  endSignature(e, finalSignatureRef, drawingFinalRef, setFinalSignatureDataUrl)
                }
                onPointerLeave={(e) =>
                  endSignature(e, finalSignatureRef, drawingFinalRef, setFinalSignatureDataUrl)
                }
                style={{
                  width: "100%",
                  height: 160,
                  display: "block",
                  border: "1px solid var(--border)",
                  borderRadius: 14,
                  touchAction: "none",
                  userSelect: "none",
                  WebkitUserSelect: "none",
                  marginTop: 10,
                  background: "#0b1a2b",
                }}
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

            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              style={{
                width: 1,
                height: 1,
                opacity: 0,
                position: "absolute",
                left: "-9999px",
                pointerEvents: "none",
              }}
            />

            <canvas ref={photoCanvasRef} style={{ display: "none" }} />

            <div style={{ marginTop: 18 }}>

              {/* 🔴 ERROR ABOVE BUTTONS */}
              {error ? (
                <div
                  style={{
                    color: "#fecaca",
                    fontWeight: 900,
                    fontSize: 18,
                    marginBottom: 10,
                    textAlign: "left",
                  }}
                >
                  {error}
                </div>
              ) : null}

              {/* 🔘 BUTTON ROW */}
              <div style={{ display: "flex", gap: 10 }}>
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

            </div>
          </>
        )}
      </div>
    </div>
  );
}