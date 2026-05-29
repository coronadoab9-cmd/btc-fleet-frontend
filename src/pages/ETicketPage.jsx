import { useEffect, useMemo, useRef, useState } from "react";
import { apiFetch, buildEticketPdfUrl } from "../lib/api";

const API_QR_TERMS = "https://btcfleet.app/qr/terms";
const CENTRAL_TZ = "America/Chicago";


const UI_TEXT = {
  en: {
    btcEticket: "BTC eTicket",
    signedEticket: "Signed eTicket",
    driver: "Driver",
    qc: "QC",
    ticket: "Ticket",
    water: "Water",
    submit: "Submit",
    submitting: "Submitting...",
    next: "Next",
    back: "Back",
    edit: "Edit",
    exitReturn: "Exit / Return",
    loadingTicket: "Loading ticket...",
    loadingQc: "Loading QC...",
    ticketNumber: "Ticket #",
    customer: "Customer",
    address: "Address",
    truck: "Truck",
    signedBy: "Signed By",
    acceptance: "Acceptance",
    signedAtCdt: "Signed At (CDT)",
    scanSignedPdf: "Scan to Open Signed PDF",
    orderedSlump: "Ordered Slump",
    batchWeights: "Batch Weights",
    description: "Description",
    design: "Design",
    target: "Target",
    actual: "Actual",
    uom: "UOM",
    variance: "% Var",
    moisture: "Moisture (%)",
    waterGallons: "Water (gal)",
    scanQcEticket: "Scan for QC eTicket",
    waterAllowed: "Water Allowed",
    qcWaterAdded: "QC Water Added",
    customerWaterAdded: "Customer Water Added",
    totalWaterAllowed: "Total Water Allowed",
    customerWaterAllowed: "Customer Water Allowed",
    curbLineSignature: "Curb Line Signature",
    notNeeded: "Not Needed",
    customerContractorSignature: "Customer / Contractor Signature",
    curbLineNotice: "By signing below, the customer/contractor acknowledges responsibility for proper site conditions and accepts delivery as requested. Big Town Concrete is not responsible for property damage resulting from site access limitations, unstable surfaces, underground utilities, customer-directed vehicle movement, or conditions beyond driver control.",
    clearSignature: "Clear Signature",
    finalSignature: "Final Signature",
    btcTerms: "BTC Terms & Conditions",
    ticketAcceptance: "Ticket Acceptance",
    acceptedDelivery: "Accepted Delivery",
    rejectedDelivery: "Rejected Delivery",
    rejectionReason: "Rejection Reason",
    selectReason: "Select reason",
    slump: "Slump",
    air: "Air",
    mechanical: "Mechanical",
    dispatch: "Dispatch",
    batch: "Batch",
    time: "Time",
    mixNumber: "Mix #",
    strength: "Strength",
    loadTime: "Load Time",
    loadSize: "Load Size",
    quantityDeliveredTotal: "Quantity Delivered Total",
    orderTotal: "Order Total",
    signedOnSite: "Signed on site",
    signedCustomerContractor: "Customer / Contractor Signature",
    driverSignedNoOneAvailable: "Driver signed - no one available",
    rejected: "Rejected",
    accepted: "Accepted",
    languageButton: "Español"
  },
  es: {
    btcEticket: "BTC eTicket",
    signedEticket: "eTicket firmado",
    driver: "Chofer",
    qc: "QC",
    ticket: "Ticket",
    water: "Agua",
    submit: "Enviar",
    submitting: "Enviando...",
    next: "Siguiente",
    back: "Atrás",
    edit: "Editar",
    exitReturn: "Salir / Regresar",
    loadingTicket: "Cargando ticket...",
    loadingQc: "Cargando QC...",
    ticketNumber: "Ticket #",
    customer: "Cliente",
    address: "Dirección",
    truck: "Camión",
    signedBy: "Firmado por",
    acceptance: "Aceptación",
    signedAtCdt: "Firmado a las (CDT)",
    scanSignedPdf: "Escanee para abrir el PDF firmado",
    orderedSlump: "Revenimiento ordenado",
    batchWeights: "Pesos de la mezcla",
    description: "Descripción",
    design: "Diseño",
    target: "Meta",
    actual: "Actual",
    uom: "Unidad",
    variance: "% Var",
    moisture: "Humedad (%)",
    waterGallons: "Agua (gal)",
    scanQcEticket: "Escanear eTicket de QC",
    waterAllowed: "Agua permitida",
    qcWaterAdded: "Agua agregada por QC",
    customerWaterAdded: "Agua agregada por el cliente",
    totalWaterAllowed: "Total de agua permitida",
    customerWaterAllowed: "Agua permitida al cliente",
    curbLineSignature: "Firma para banqueta",
    notNeeded: "No se necesita",
    customerContractorSignature: "Firma del cliente / contratista",
    curbLineNotice: "Al firmar abajo, el cliente/contratista reconoce que es responsable de las condiciones adecuadas del sitio y acepta la entrega solicitada. Big Town Concrete no se hace responsable por daños a la propiedad causados por limitaciones de acceso al sitio, superficies inestables, servicios subterráneos, movimientos del vehículo indicados por el cliente o condiciones fuera del control del chofer.",
    clearSignature: "Borrar firma",
    finalSignature: "Firma final",
    btcTerms: "Términos y condiciones de BTC",
    ticketAcceptance: "Aceptación del ticket",
    acceptedDelivery: "Entrega aceptada",
    rejectedDelivery: "Entrega rechazada",
    rejectionReason: "Motivo del rechazo",
    selectReason: "Seleccione motivo",
    slump: "Revenimiento",
    air: "Aire",
    mechanical: "Mecánico",
    dispatch: "Despacho",
    batch: "Carga",
    time: "Tiempo",
    mixNumber: "Mezcla #",
    strength: "Resistencia",
    loadTime: "Hora de carga",
    loadSize: "Tamaño de carga",
    quantityDeliveredTotal: "Cantidad total entregada",
    orderTotal: "Total del pedido",
    signedOnSite: "Firmado en el sitio",
    signedCustomerContractor: "Firma del cliente / contratista",
    driverSignedNoOneAvailable: "Firmado por el chofer - no había nadie disponible",
    rejected: "Rechazado",
    accepted: "Aceptado",
    languageButton: "English"
  }
};

function getPoint(event, canvas) {
  const rect = canvas.getBoundingClientRect();
  const e = event.nativeEvent || event;

  const point =
    e.touches?.[0] ||
    e.changedTouches?.[0] ||
    e;

  return {
    x: point.clientX - rect.left,
    y: point.clientY - rect.top,
    time: Date.now(),
  };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function getStrokeWidth(from, to) {
  if (!from || !to) return 3;

  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  const elapsed = Math.max((to.time || Date.now()) - (from.time || Date.now()), 8);
  const speed = distance / elapsed;

  return clamp(4.2 - speed * 7.5, 1.7, 4.2);
}

function drawPremiumStroke(canvas, from, to) {
  if (!canvas || !from || !to) return;

  const ctx = canvas.getContext("2d");

  // Keep the signature smooth but solid.
  // The previous curve version could leave gaps on phones when touch events came in slowly.
  ctx.setLineDash([]);
  ctx.lineWidth = getStrokeWidth(from, to);
  ctx.strokeStyle = "#ffffff";
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(to.x, to.y);
  ctx.stroke();
}

function drawSignatureDot(canvas, point) {
  if (!canvas || !point) return;

  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(point.x, point.y, 0.7, 0, Math.PI * 2);
  ctx.fill();
}

function formatGallons(value) {
  const num = Number(value);
  if (isNaN(num)) return "-";
  return `${num.toFixed(1)} gal`;
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
    airContent: hasAir ? "4.5% ± 1.5%" : "1.5% ± 1.5%",
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
        marginTop: 10, // 👈 ADD THIS
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
        padding: 10,
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
          fontSize: 12,
          whiteSpace: window.innerWidth <= 600 ? "normal" : "nowrap",
        }}
      >
        {title}
      </div>

      <div
        style={{
          background: "#fff",
          width: 90,
          height: 90,
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
    </div>
  );
}
function WaterInfoBox({ title, value, isPhone }) {
  return (
    <div
      style={{
        background: "var(--panel-2)",
        border: "1px solid var(--border)",
        borderRadius: 14,
        padding: isPhone ? 10 : 16,
        textAlign: "center",
      }}
    >
      <div style={{ color: "var(--muted)", fontSize: isPhone ? 15 : 18 }}>
        {title}
      </div>

      <div
        style={{
          color: "#fff",
          fontWeight: 900,
          fontSize: isPhone ? 22 : 38,
          marginTop: 12,
          lineHeight: 1,
        }}
      >
        {value}
      </div>
    </div>
  );
}

function CustomerWaterAddedBox({
  customerWaterAdded,
  isPhone,
  startWaterPress,
  finishWaterPress,
}) {
  return (
    <div
      style={{
        background: "var(--panel-2)",
        border: "1px solid var(--border)",
        borderRadius: 14,
        padding: isPhone ? 10 : 16,
        textAlign: "center",
      }}
    >
      <div style={{ color: "var(--muted)", fontSize: isPhone ? 15 : 18 }}>
        Customer Water Added
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 10,
          marginTop: 12,
        }}
      >
        <button
          className="primary-btn"
          style={{
            width: isPhone ? 46 : 64,
            height: isPhone ? 42 : 52,
            marginTop: 0,
            fontSize: isPhone ? 20 : 26,
            fontWeight: 900,
            touchAction: "none",
            userSelect: "none",
          }}
          type="button"
          onPointerDown={(e) => {
            e.preventDefault();
            startWaterPress(-1, "customer");
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
            fontSize: isPhone ? 20 : 28,
            fontWeight: 900,
            minWidth: isPhone ? 90 : 130,
            textAlign: "center",
          }}
        >
          {formatGallons(customerWaterAdded)}
        </div>

        <button
          className="primary-btn"
          style={{
            width: isPhone ? 46 : 64,
            height: isPhone ? 42 : 52,
            marginTop: 0,
            fontSize: isPhone ? 20 : 26,
            fontWeight: 900,
            touchAction: "none",
            userSelect: "none",
          }}
          type="button"
          onPointerDown={(e) => {
            e.preventDefault();
            startWaterPress(1, "customer");
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
  const holdWaterTypeRef = useRef("customer");

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
  const isTouchDevice =
    typeof window !== "undefined" &&
    ("ontouchstart" in window ||
      navigator.maxTouchPoints > 0 ||
      navigator.msMaxTouchPoints > 0);
  const [loadingQc, setLoadingQc] = useState(false);
  const [language, setLanguage] = useState("en");
  const t = (key) => UI_TEXT[language]?.[key] || UI_TEXT.en[key] || key;

  const [curbLineSignature, setCurbLineSignature] = useState("Not Needed");
  const [curbLineSignedAt, setCurbLineSignedAt] = useState("");
  const waterAllowed = useMemo(() => {
    const value = Number(
      ticket?.water_allowed_gallons ??
        ticket?.water_allowed ??
        ticket?.waterAllowed ??
        25
    );

    return Number.isFinite(value) && value > 0 ? value : 25;
  }, [ticket?.water_allowed_gallons, ticket?.water_allowed, ticket?.waterAllowed]);
  const [qcWaterAdded, setQcWaterAdded] = useState(0);
  const [customerWaterAdded, setCustomerWaterAdded] = useState(0);
  const [ticketAcceptance, setTicketAcceptance] = useState("Accepted Delivery");
  const [rejectionReason, setRejectionReason] = useState("");
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

  const batchRows = useMemo(() => {
    const raw =
      ticket?.batch_weights_json ||
      ticket?.batch_weights ||
      [];

    if (Array.isArray(raw)) return raw;

    if (typeof raw === "string" && raw.trim()) {
      try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }

    return [];
  }, [ticket]);

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

  const preloadQcPage = async () => {
    try {
      // preload current location
      await fetchCurrentLocation();

      // tiny delay so QC screen is instant
      await new Promise((resolve) => setTimeout(resolve, 250));
    } catch (err) {
      console.error("QC preload failed", err);
    }
  };

  useEffect(() => {
    const id = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (signed) return;

    if (step === 5) {
      const id = setTimeout(() => {
        startCamera();
      }, 300);

      return () => clearTimeout(id);
    }

    if (step !== 5) {
      stopCamera();
      setCameraStarted(false);
    }
  }, [step, signed]);

  useEffect(() => {
    const id = setTimeout(() => {
      if (step === 4) {
        setupCanvas(waterSignatureRef.current, "#0b1a2b", waterSignatureDataUrl);
      }

      if (step === 5) {
        setupCanvas(finalSignatureRef.current, "#0b1a2b", finalSignatureDataUrl);
      }
    }, 150);

    return () => clearTimeout(id);
  }, [step, isPhone, curbLineSignature, waterSignatureDataUrl, finalSignatureDataUrl]);

  async function loadTicket() {
    setLoading(true);
    setError("");

    try {
      const data = await apiFetch(`/api/etickets/${token}`);
      setTicket(data);
      setSigned(data.status === "signed");
      setFinalSignatureDataUrl(data.signature_data_url || "");
      setQcWaterAdded(Number(data.qc_water_added || 0));
      setCustomerWaterAdded(Number(data.customer_water_added || data.water_added || 0));

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
    if (signed || step !== 2) return;

    async function saveQcWeather() {
      try {
        const loc = await fetchCurrentLocation();

        await apiFetch(`/api/etickets/${token}/qc-weather`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(loc),
        });

        await loadTicket();
      } catch (err) {
        console.log("QC weather/location capture failed:", err);
      }
    }

    saveQcWeather();
  }, [step, signed, token]);

  useEffect(() => {
    if (signed) return;

    fetchCurrentLocation().catch((err) => {
      console.log("Initial location fetch failed:", err);
    });
  }, [signed]);

function setupCanvas(canvas, bg = "#0b1a2b", existingDataUrl = "") {
  if (!canvas) return;

  const rect = canvas.getBoundingClientRect();
  const ratio = Math.max(window.devicePixelRatio || 1, 1);

  const cssWidth = Math.max(Math.round(rect.width), 300);
  const cssHeight = Math.max(Math.round(rect.height), 180);

  canvas.width = cssWidth * ratio;
  canvas.height = cssHeight * ratio;

  canvas.style.width = "100%";
  canvas.style.height = `${cssHeight}px`;

  const ctx = canvas.getContext("2d");
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);

  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, cssWidth, cssHeight);

  ctx.lineWidth = 3;
  ctx.strokeStyle = "#ffffff";
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.imageSmoothingEnabled = true;

  if (existingDataUrl) {
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 0, 0, cssWidth, cssHeight);
    };
    img.src = existingDataUrl;
  }
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
    

    event.preventDefault();
    event.stopPropagation();

    const canvas = canvasRef.current;
    if (!canvas || signed) return;

    drawingRef.current = true;

    if (event.pointerId !== undefined) {
      canvas.setPointerCapture?.(event.pointerId);
    }

    const pt = getPoint(event, canvas);
    lastPointRef.current = pt;

    const ctx = canvas.getContext("2d");
    ctx.beginPath();
    ctx.moveTo(pt.x, pt.y);
    drawSignatureDot(canvas, pt);
  }

  function moveSignature(event, canvasRef, drawingRef, lastPointRef, setDrawn) {
    
    if (!drawingRef.current || signed) return;

    event.preventDefault();
    event.stopPropagation();

    const canvas = canvasRef.current;
    if (!canvas) return;

    const pt = getPoint(event, canvas);

    drawPremiumStroke(canvas, lastPointRef.current, pt);

    lastPointRef.current = pt;
    setDrawn(true);
  }

  function endSignature(event, canvasRef, drawingRef, setDataUrl) {
    
    if (!drawingRef.current) return;

    event.preventDefault();
    event.stopPropagation();

    const canvas = canvasRef.current;
    drawingRef.current = false;

    if (event.pointerId !== undefined) {
      canvas?.releasePointerCapture?.(event.pointerId);
    }

    if (canvas) {
      setDataUrl(canvas.toDataURL("image/png"));
    }
  }

  function clearCanvas(canvasRef, setterDrawn, setterData) {
    const canvas = canvasRef.current;
    if (!canvas) return;

    setterData("");
    setterDrawn(false);

    const rect = canvas.getBoundingClientRect();
    const ratio = Math.max(window.devicePixelRatio || 1, 1);

    const cssWidth = Math.max(Math.round(rect.width), 300);
    const cssHeight = Math.max(Math.round(rect.height), 180);

    canvas.width = cssWidth * ratio;
    canvas.height = cssHeight * ratio;

    canvas.style.width = "100%";
    canvas.style.height = `${cssHeight}px`;

    const ctx = canvas.getContext("2d");
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);

    ctx.fillStyle = "#0b1a2b";
    ctx.fillRect(0, 0, cssWidth, cssHeight);

    ctx.lineWidth = 3;
    ctx.strokeStyle = "#ffffff";
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.imageSmoothingEnabled = true;
  }

  // Phone-only native touch listeners.
  // Tablet and desktop keep the regular pointer handlers that already work.
  useEffect(() => {
    if (signed || !isPhone) return;

    const configs = [
      {
        canvas: waterSignatureRef.current,
        drawingRef: drawingWaterRef,
        lastPointRef: lastWaterPointRef,
        setDrawn: setWaterSignatureDrawn,
        setDataUrl: setWaterSignatureDataUrl,
      },
      {
        canvas: finalSignatureRef.current,
        drawingRef: drawingFinalRef,
        lastPointRef: lastFinalPointRef,
        setDrawn: setFinalSignatureDrawn,
        setDataUrl: setFinalSignatureDataUrl,
      },
    ];

    const cleanups = [];

    configs.forEach((cfg) => {
      const canvas = cfg.canvas;
      if (!canvas) return;

      function getNativePoint(e) {
        const rect = canvas.getBoundingClientRect();
        const touch = e.touches?.[0] || e.changedTouches?.[0];
        const point = touch || e;

        return {
          x: point.clientX - rect.left,
          y: point.clientY - rect.top,
          time: Date.now(),
        };
      }

      function start(e) {
        e.preventDefault();
        e.stopPropagation();

        cfg.drawingRef.current = true;

        const pt = getNativePoint(e);
        cfg.lastPointRef.current = pt;

        const ctx = canvas.getContext("2d");
        ctx.beginPath();
        ctx.moveTo(pt.x, pt.y);
        drawSignatureDot(canvas, pt);
      }

      function move(e) {
        if (!cfg.drawingRef.current) return;

        e.preventDefault();
        e.stopPropagation();

        const pt = getNativePoint(e);

        drawPremiumStroke(canvas, cfg.lastPointRef.current, pt);

        cfg.lastPointRef.current = pt;
        cfg.setDrawn(true);
      }

      function end(e) {
        if (!cfg.drawingRef.current) return;

        e.preventDefault();
        e.stopPropagation();

        cfg.drawingRef.current = false;
        cfg.setDataUrl(canvas.toDataURL("image/png"));
      }

      canvas.addEventListener("touchstart", start, { passive: false });
      canvas.addEventListener("touchmove", move, { passive: false });
      canvas.addEventListener("touchend", end, { passive: false });
      canvas.addEventListener("touchcancel", end, { passive: false });

      cleanups.push(() => {
        canvas.removeEventListener("touchstart", start);
        canvas.removeEventListener("touchmove", move);
        canvas.removeEventListener("touchend", end);
        canvas.removeEventListener("touchcancel", end);
      });
    });

    return () => {
      cleanups.forEach((cleanup) => cleanup());
    };
  }, [step, signed, isPhone, curbLineSignature]);




  function changeQcWaterAdded(amount) {
    setQcWaterAdded((v) => {
      const next = Number(v || 0) + amount;
      return Math.max(0, Math.round(next * 100) / 100);
    });
  }

  function changeCustomerWaterAdded(amount) {
    setCustomerWaterAdded((v) => {
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

  function startWaterPress(amount, waterType = "customer") {
    if (holdAmountRef.current !== 0) return;

    holdAmountRef.current = amount;
    holdStartedRef.current = false;
    holdStartTimeRef.current = Date.now();
    holdWaterTypeRef.current = waterType;

    holdTimeoutRef.current = setTimeout(() => {
      holdStartedRef.current = true;

      holdIntervalRef.current = setInterval(() => {
        const step = getAcceleratedWaterStep(amount);

        if (holdWaterTypeRef.current === "qc") {
          changeQcWaterAdded(step);
        } else {
          changeCustomerWaterAdded(step);
        }
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
      if (holdWaterTypeRef.current === "qc") {
        changeQcWaterAdded(amount);
      } else {
        changeCustomerWaterAdded(amount);
      }
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

  async function waitForVideoReady(timeoutMs = 3000) {
    const video = videoRef.current;
    if (!video) return false;

    const start = Date.now();

    while (Date.now() - start < timeoutMs) {
      if (video.videoWidth > 0 && video.videoHeight > 0 && video.readyState >= 2) {
        return true;
      }

      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    return false;
  }

  async function capturePhotoFromVideo() {
    const video = videoRef.current;
    const canvas = photoCanvasRef.current;

    if (!video || !canvas) return "";

    const ready = await waitForVideoReady();

    if (!ready || !video.videoWidth || !video.videoHeight) {
      return "";
    }

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
      if (
        curbLineSignature === "Customer / Contractor Signature" &&
        !waterSignatureDrawn
      ) {
        throw new Error("Customer curb line signature is required");
      }

      if (!finalSignatureDrawn) {
        throw new Error("Final signature is required");
      }

      if (ticketAcceptance === "Rejected Delivery" && !rejectionReason) {
        throw new Error("Please select a rejection reason.");
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

      let signerPhoto = await capturePhotoFromVideo();

      if (!signerPhoto) {
        stopCamera();
        setCameraStarted(false);

        await new Promise((resolve) => setTimeout(resolve, 300));

        await startCamera();

        await new Promise((resolve) => setTimeout(resolve, 1200));

        signerPhoto = await capturePhotoFromVideo();
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
          water_added: Number(customerWaterAdded).toFixed(2),
          qc_water_added: Number(qcWaterAdded).toFixed(2),
          customer_water_added: Number(customerWaterAdded).toFixed(2),
          curb_line_status: curbLineSignature,
          ticket_acceptance:
            ticketAcceptance === "Rejected Delivery"
              ? `${ticketAcceptance} | Reason: ${rejectionReason} | ${curbLineSignature}`
              : `${ticketAcceptance} | ${curbLineSignature}`,
          signature_data_url: finalSignatureDataUrl,
          curb_line_signature_data_url:
            curbLineSignature === "Customer / Contractor Signature"
              ? waterSignatureDataUrl
              : "",
          curb_line_signed_at:
            curbLineSignature === "Customer / Contractor Signature"
              ? curbLineSignedAt || new Date().toISOString()
              : "",
          photo_data_url: signerPhoto,
          terms_qr_url: API_QR_TERMS,
          load_time: ticket?.load_time,
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
    return <div className="full-screen-center">{t("loadingTicket")}</div>;
  }

  if (error && !ticket) {
    return <div className="full-screen-center">{error}</div>;
  }

  if (signed) {
    return (
      <div className="app-shell" style={{ padding: 16 }}>
        <div className="panel-card" style={{ maxWidth: 760, margin: "0 auto" }}>
          <div className="panel-title">{t("signedEticket")}</div>

          {success ? <div className="message-box">{success}</div> : null}

          <div className="asset-details">
            <SummaryRow label={t("ticketNumber")} value={ticket.ticket_number} />
            <SummaryRow label={t("customer")} value={ticket.customer_name} />
            <SummaryRow label={t("truck")} value={ticket.truck_number} />
            <SummaryRow
              label={t("signedBy")}
              value={
                String(ticket.ticket_acceptance || "").includes("Driver signed")
                  ? t("driverSignedNoOneAvailable")
                  : t("signedCustomerContractor")
              }
            />

            <SummaryRow
              label={t("acceptance")}
              value={
                String(ticket.ticket_acceptance || "").includes("Reason:")
                  ? `${t("rejected")} - ${
                      String(ticket.ticket_acceptance)
                        .split("Reason:")[1]
                        .split("|")[0]
                        .trim()
                    }`
                  : String(ticket.ticket_acceptance || "").includes("Rejected")
                  ? t("rejected")
                  : t("accepted")
              }
            />
            <SummaryRow
              label={t("signedAtCdt")}
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
              {t("scanSignedPdf")}
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
                {t("exitReturn")}
              </button>
          </div>
        </div>
      </div>
    );
  }

  function exitEticket() {
    try {
      if (window.BTCFleetAndroid && typeof window.BTCFleetAndroid.exitEticket === "function") {
        window.BTCFleetAndroid.exitEticket();
        return;
      }
    } catch (err) {
      console.log("Android exit failed:", err);
    }

    try {
      window.location.href = "/";
    } catch {
      window.history.back();
    }
  }

  return (
    <div className="app-shell" style={{ padding: 14 }}>
      <div className="panel-card" style={{ maxWidth: 760, margin: "0 auto" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 12,
          }}
        >
          <div
            className="panel-title"
            style={{
              marginBottom: 0,
            }}
          >
            {t("btcEticket")}
          </div>

          <div
            style={{
              display: "flex",
              background: "var(--panel-2)",
              border: "1px solid var(--border)",
              borderRadius: 999,
              padding: 4,
              overflow: "hidden",
              minWidth: isPhone ? 120 : 150,
            }}
          >
            <button
              type="button"
              onClick={() => setLanguage("en")}
              style={{
                flex: 1,
                border: "none",
                borderRadius: 999,
                padding: isPhone ? "6px 10px" : "8px 14px",
                fontWeight: 900,
                fontSize: isPhone ? 12 : 14,
                color: language === "en" ? "#fff" : "var(--muted)",
                background: language === "en" ? "#f97316" : "transparent",
                transition: "all 0.2s ease",
              }}
            >
              ENG
            </button>

            <button
              type="button"
              onClick={() => setLanguage("es")}
              style={{
                flex: 1,
                border: "none",
                borderRadius: 999,
                padding: isPhone ? "6px 10px" : "8px 14px",
                fontWeight: 900,
                fontSize: isPhone ? 12 : 14,
                color: language === "es" ? "#fff" : "var(--muted)",
                background: language === "es" ? "#f97316" : "transparent",
                transition: "all 0.2s ease",
              }}
            >
              ESP
            </button>
          </div>
        </div>

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
            {t("driver")}
          </span>
          <span style={{ color: step === 2 ? "#fff" : "var(--muted)" }}>
            {t("qc")}
          </span>
          <span style={{ color: step === 3 ? "#fff" : "var(--muted)" }}>
            {t("ticket")}
          </span>
          <span style={{ color: step === 4 ? "#fff" : "var(--muted)" }}>
            {t("water")}
          </span>
          <span style={{ color: step === 5 ? "#fff" : "var(--muted)" }}>
            {t("submit")}
          </span>
        </div>

        {step === 1 && (
          <>
            <div className="asset-details">
              <SummaryRow label={t("ticketNumber")} value={ticket.ticket_number} />
              <SummaryRow label={t("customer")} value={ticket.customer_name} />
              <SummaryRow label={t("address")} value={ticket.address} />

              <div
                style={{
                  background: "var(--panel-2)",
                  border: "1px solid var(--border)",
                  borderRadius: 14,
                  padding: 18,
                  marginTop: 12,
                  textAlign: "center",
                }}
              >
                <div
                  style={{
                    color: "var(--muted)",
                    fontSize: 20,
                    fontWeight: 800,
                    marginBottom: 8,
                  }}
                >
                  {t("orderedSlump")}
                </div>

                <div
                  style={{
                    color: "#fff",
                    fontSize: isPhone ? 42 : 56,
                    fontWeight: 950,
                    lineHeight: 1,
                  }}
                >
                  4.5 in
                </div>
              </div>
            </div>

            <div
              style={{
                marginTop: 18,
                background: "var(--panel-2)",
                border: "1px solid var(--border)",
                borderRadius: 14,
                padding: 14,
              }}
            >
              <div
                style={{
                  fontWeight: 900,
                  color: "#fff",
                  marginBottom: 12,
                  fontSize: 20,
                  textAlign: "center",
                }}
              >
                {t("batchWeights")}
              </div>

              <div style={{ overflowX: "auto", width: "100%" }}>
                <table
                  style={{
                    width: isPhone ? 620 : "100%",
                    borderCollapse: "collapse",
                    color: "#fff",
                    fontSize: isPhone ? 14 : 15,
                  }}
                >
                  <thead>
                    <tr>
                      {[t("description"), t("design"), t("target"), t("actual"), t("uom"), t("variance")].map(
                        (h) => (
                          <th
                            key={h}
                            style={{
                              borderBottom: "1px solid var(--border)",
                              padding: 8,
                              textAlign: "left",
                              fontSize: isPhone ? 13 : 14,
                            }}
                          >
                            {h}
                          </th>
                        )
                      )}
                    </tr>
                  </thead>

                  <tbody>
                    {batchRows.map((row, i) => (
                      <tr key={i}>
                        {row.map((cell, j) => (
                          <td
                            key={j}
                            style={{
                              borderBottom: "1px solid rgba(255,255,255,0.08)",
                              padding: 8,
                              fontWeight: j === 0 ? 800 : 700,
                            }}
                          >
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <button
              className="primary-btn"
              type="button"
              disabled={loadingQc}
              onClick={async () => {
                try {
                  setError("");
                  setLoadingQc(true);

                  await preloadQcPage();

                  setStep(2);
                } catch (err) {
                  console.error(err);
                } finally {
                  setLoadingQc(false);
                }
              }}
            >
              {loadingQc ? t("loadingQc") : t("next")}
            </button>
          </>
        )}

        {step === 2 && (
          <>
            <div
              style={{
                display: "grid",
                gap: 14,
              }}
            >
              {/* CUSTOMER INFO + QR ROW */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: isPhone ? "1fr" : "1fr 220px",
                  gap: 14,
                  alignItems: "stretch",
                }}
              >
                {/* CUSTOMER INFO CARD */}
                <div
                  style={{
                    background: "var(--panel-2)",
                    border: "1px solid var(--border)",
                    borderRadius: 16,
                    padding: 16,
                  }}
                >
                  <div className="asset-details">
                    <SummaryRow label={t("customer")} value={ticket.customer_name || "-"} />
                    <SummaryRow label={t("address")} value={ticket.address || "-"} />
                    <SummaryRow
                      label={t("loadTime")}
                      value={formatCentralDateTime(ticket.load_time)}
                    />
                  </div>
                </div>

                {/* QR CARD */}
                <div
                  style={{
                    background: "var(--panel-2)",
                    border: "1px solid var(--border)",
                    borderRadius: 16,
                    padding: 12,
                    display: "grid",
                    justifyItems: "center",
                    alignContent: "center",
                    textAlign: "center",
                  }}
                >
                  <div
                    style={{
                      color: "#fff",
                      fontWeight: 900,
                      fontSize: 15,
                      marginBottom: 10,
                    }}
                  >
                    {t("scanQcEticket")}
                  </div>

                  <div
                    style={{
                      background: "#fff",
                      width: isPhone ? 190 : 150,
                      height: isPhone ? 190 : 150,
                      borderRadius: 12,
                      padding: 8,
                      display: "grid",
                      placeItems: "center",
                    }}
                  >
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(
                        `https://btc-fleet-backend.onrender.com/api/etickets/${token}/qc-pdf`
                      )}`}
                      alt="QC QR"
                      style={{
                        width: "100%",
                        height: "100%",
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* WATER ROW */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: isPhone ? "1fr" : "1fr 1.4fr",
                  gap: 14,
                }}
              >
                {/* WATER ALLOWED */}
                <div
                  style={{
                    background: "var(--panel-2)",
                    border: "1px solid var(--border)",
                    borderRadius: 16,
                    padding: 20,
                    textAlign: "center",
                  }}
                >
                  <div
                    style={{
                      color: "var(--muted)",
                      fontSize: 18,
                    }}
                  >
                    {t("waterAllowed")}
                  </div>

                  <div
                    style={{
                      fontSize: 42,
                      fontWeight: 900,
                      marginTop: 12,
                      color: "#fff",
                    }}
                  >
                    {waterAllowed} gal
                  </div>
                </div>

                {/* QC WATER ADDED */}
                <div
                  style={{
                    background: "var(--panel-2)",
                    border: "1px solid var(--border)",
                    borderRadius: 16,
                    padding: 20,
                    textAlign: "center",
                  }}
                >
                  <div
                    style={{
                      color: "var(--muted)",
                      fontSize: 18,
                      marginBottom: 14,
                    }}
                  >
                    {t("qcWaterAdded")}
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: isPhone ? "56px 1fr 56px" : "76px 1fr 76px",
                      alignItems: "center",
                      gap: 14,
                    }}
                  >
                    <button
                      type="button"
                      className="primary-btn"
                      style={{
                        height: isPhone ? 48 : 58,
                        marginTop: 0,
                        fontSize: isPhone ? 22 : 28,
                        fontWeight: 900,
                        touchAction: "none",
                        userSelect: "none",
                      }}
                      onPointerDown={(e) => {
                        e.preventDefault();
                        startWaterPress(-1, "qc");
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
                        fontSize: isPhone ? 28 : 40,
                        fontWeight: 900,
                        color: "#fff",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {Number(qcWaterAdded || 0).toFixed(1)} gal
                    </div>

                    <button
                      type="button"
                      className="primary-btn"
                      style={{
                        height: isPhone ? 48 : 58,
                        marginTop: 0,
                        fontSize: isPhone ? 22 : 28,
                        fontWeight: 900,
                        touchAction: "none",
                        userSelect: "none",
                      }}
                      onPointerDown={(e) => {
                        e.preventDefault();
                        startWaterPress(1, "qc");
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
            </div>

            <div
              style={{
                background: "var(--panel-2)",
                border: "1px solid var(--border)",
                borderRadius: 14,
                padding: 16,
                marginTop: 16,
              }}
            >
              <div
                style={{
                  fontWeight: 900,
                  color: "#fff",
                  textAlign: "center",
                  marginBottom: 12,
                  fontSize: 20,
                }}
              >
                {t("batchWeights")}
              </div>

              <div style={{ overflowX: "auto", width: "100%" }}>
                <table
                  style={{
                    width: isPhone ? 760 : "100%",
                    borderCollapse: "collapse",
                    color: "#fff",
                    fontSize: isPhone ? 11 : 12,
                  }}
                >
                  <thead>
                    <tr>
                      {[
                        t("description"),
                        t("design"),
                        t("target"),
                        t("actual"),
                        t("uom"),
                        t("variance"),
                        t("moisture"),
                        t("waterGallons"),
                      ].map((h) => (
                        <th
                          key={h}
                          style={{
                            borderBottom: "1px solid var(--border)",
                            padding: 6,
                            textAlign: "left",
                          }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>

                  <tbody>
                    {batchRows.map((row, i) => (
                      <tr key={i}>
                        {row.map((cell, j) => (
                          <td
                            key={j}
                            style={{
                              borderBottom: "1px solid rgba(255,255,255,0.08)",
                              padding: 6,
                            }}
                          >
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 18 }}>

              <button
                className="primary-btn"
                type="button"
                onClick={() => {
                  setError("");
                  setStep(3);
                }}
              >
                {t("next")}
              </button>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <div style={{ display: "grid", gap: 16 }}>
              <div
                style={{
                  background: "var(--panel-2)",
                  border: "1px solid var(--border)",
                  borderRadius: 16,
                  padding: 16,
                }}
              >
                <SummaryRow label={t("ticketNumber")} value={ticket.ticket_number} />
                <SummaryRow label={t("customer")} value={ticket.customer_name} />
                <SummaryRow label={t("address")} value={ticket.address} />
                <SummaryRow label={t("truck")} value={ticket.truck_number} />
              </div>

              <div
                style={{
                  background: "var(--panel-2)",
                  border: "1px solid var(--border)",
                  borderRadius: 16,
                  padding: 16,
                }}
              >
                <SummaryRow
                  label={t("mixNumber")}
                  value={
                    ticket?.mix_number ||
                    String(ticket?.product || "").trim().split(/\s+/)[0] ||
                    "-"
                  }
                />

                <SummaryRow
                  label={t("description")}
                  value={
                    ticket?.mix_description ||
                    String(ticket?.product || "")
                      .trim()
                      .split(/\s+/)
                      .slice(1)
                      .join(" ") ||
                    "-"
                  }
                />

                <SummaryRow label={t("strength")} value={mix.strength} />
                <SummaryRow label={t("slump")} value={mix.slump} />
                <SummaryRow label={t("air")} value={mix.airContent} />
              </div>

              <div
                style={{
                  background: "var(--panel-2)",
                  border: "1px solid var(--border)",
                  borderRadius: 16,
                  padding: 16,
                }}
              >
                <SummaryRow
                  label={t("loadTime")}
                  value={formatCentralDateTime(ticket.load_time)}
                />

                <SummaryRow
                  label={t("loadSize")}
                  value={`${Number(ticket.quantity || 0).toFixed(0)} cys`}
                />

                <SummaryRow
                  label={t("quantityDeliveredTotal")}
                  value={`${Number(
                    ticket.delivered_qty_total || ticket.quantity || 0
                  ).toFixed(0)} cys`}
                />

                <SummaryRow
                  label={t("orderTotal")}
                  value={`${Number(
                    ticket.order_total || ticket.quantity || 0
                  ).toFixed(0)} cys`}
                />
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
              <button
                className="secondary-btn"
                type="button"
                onClick={() => setStep(2)}
              >
                {t("back")}
              </button>

              <button
                className="primary-btn"
                type="button"
                onClick={() => {
                  setError("");
                  setStep(4);
                }}
              >
                {t("next")}
              </button>
            </div>
          </>
        )}

        {step === 4 && (
          <>

            <label>{t("curbLineSignature")}</label>
            
            <select
              value={curbLineSignature}
              onChange={(e) => setCurbLineSignature(e.target.value)}
            >
              <option value="Not Needed">{t("notNeeded")}</option>
              <option value="Customer / Contractor Signature">{t("customerContractorSignature")}</option>
            </select>

            {Number(qcWaterAdded || 0) > 0 ? (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 14,
                  marginTop: 16,
                }}
              >
                <WaterInfoBox
                  title={t("totalWaterAllowed")}
                  value={formatGallons(waterAllowed)}
                  isPhone={isPhone}
                />

                <WaterInfoBox
                  title={t("qcWaterAdded")}
                  value={formatGallons(qcWaterAdded)}
                  isPhone={isPhone}
                />

                <WaterInfoBox
                  title={t("customerWaterAllowed")}
                  value={formatGallons(
                    Math.max(0, Number(waterAllowed || 0) - Number(qcWaterAdded || 0))
                  )}
                  isPhone={isPhone}
                />

                <CustomerWaterAddedBox
                  customerWaterAdded={customerWaterAdded}
                  isPhone={isPhone}
                  startWaterPress={startWaterPress}
                  finishWaterPress={finishWaterPress}
                />
              </div>
            ) : (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 14,
                  marginTop: 16,
                }}
              >
                <WaterInfoBox
                  title={t("customerWaterAllowed")}
                  value={formatGallons(waterAllowed)}
                  isPhone={isPhone}
                />

                <CustomerWaterAddedBox
                  customerWaterAdded={customerWaterAdded}
                  isPhone={isPhone}
                  startWaterPress={startWaterPress}
                  finishWaterPress={finishWaterPress}
                />
              </div>
            )}

            {curbLineSignature === "Customer / Contractor Signature" ? (
              <>
                <div style={{ marginTop: 18, color: "#fff", fontWeight: 800 }}>
                  {t("curbLineSignature")}
                </div>

                {curbLineSignature === "Customer / Contractor Signature" ? (
                  <div
                    style={{
                      background: "rgba(255,165,0,0.10)",
                      border: "1px solid rgba(255,165,0,0.35)",
                      color: "#f3f4f6",
                      borderRadius: 12,
                      padding: "12px 14px",
                      marginBottom: 12,
                      fontSize: isPhone ? 11 : 13,
                      lineHeight: 1.45,
                      fontWeight: 600,
                    }}
                  >
                    {t("curbLineNotice")}
                  </div>
                ) : null}

                <canvas
                  className="signature-canvas"
                  ref={waterSignatureRef}
                  onContextMenu={(e) => e.preventDefault()}
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
                  onPointerCancel={(e) =>
                    endSignature(e, waterSignatureRef, drawingWaterRef, setWaterSignatureDataUrl)
                  }
                  style={{
                    width: "100%",
                    height: "180px",
                    minHeight: "180px",
                    display: "block",
                    border: "1px solid var(--border)",
                    borderRadius: 14,
                    touchAction: "none",
                    userSelect: "none",
                    WebkitUserSelect: "none",
                    WebkitTouchCallout: "none",
                    WebkitTapHighlightColor: "transparent",
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
                    {t("clearSignature")}
                  </button>
                </div>
              </>
            ) : null}

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
                  onClick={() => setStep(3)}
                >
                  {t("back")}
                </button>

                <button
                  className="primary-btn"
                  type="button"
                  onClick={() => {
                    if (
                      curbLineSignature === "Customer / Contractor Signature" &&
                      !waterSignatureDrawn
                    ) {
                      setError("Curb line signature is required before continuing.");
                      return;
                    }

                    setError("");
                    setCurbLineSignedAt(new Date().toISOString());
                    setStep(5);
                  }}
                >
                  {t("next")}
                </button>
              </div>
            </div>
          </>
        )}

        {step === 5 && (
          <>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: isPhone ? "1fr" : "1fr 1fr",
                gap: 14,
                alignItems: "stretch",
              }}
            >
              <div
                style={{
                  background: "var(--panel-2)",
                  border: "1px solid var(--border)",
                  borderRadius: 14,
                  padding: "10px 18px",
                  textAlign: "center",
                  minHeight: 135,
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                }}
              >
                <div style={{ fontWeight: 900, fontSize: 18, color: "#fff" }}>
                  {t("qcWaterAdded")}
                </div>

                <div style={{ fontWeight: 900, fontSize: 32, color: "#fff", marginTop: 4 }}>
                  {formatGallons(qcWaterAdded)}
                </div>
              </div>

              <div
                style={{
                  background: "var(--panel-2)",
                  border: "1px solid var(--border)",
                  borderRadius: 14,
                  padding: "10px 18px",
                  textAlign: "center",
                  minHeight: 135,
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                }}
              >
                <div style={{ fontWeight: 900, fontSize: 18, color: "#fff" }}>
                  {t("customerWaterAdded")}
                </div>

                <div style={{ fontWeight: 900, fontSize: 32, color: "#fff", marginTop: 4 }}>
                  {formatGallons(customerWaterAdded)}
                </div>

                <div style={{ display: "flex", justifyContent: "center", marginTop: 10 }}>
                  <button
                    className="secondary-btn"
                    type="button"
                    onClick={() => setStep(4)}
                  >
                    {t("edit")}
                  </button>
                </div>
              </div>
            </div>

            <div style={{ marginTop: 14 }}>
              <QrCard title={t("btcTerms")} url={API_QR_TERMS} />
            </div>

            <label style={{ marginTop: 14 }}>{t("ticketAcceptance")}</label>
            <select
              value={ticketAcceptance}
              onChange={(e) => {
                const nextValue = e.target.value;
                setTicketAcceptance(nextValue);

                if (nextValue !== "Rejected Delivery") {
                  setRejectionReason("");
                }
              }}
            >
              <option value="Accepted Delivery">{t("acceptedDelivery")}</option>
              <option value="Rejected Delivery">{t("rejectedDelivery")}</option>
            </select>

            {ticketAcceptance === "Rejected Delivery" ? (
              <>
                <label>{t("rejectionReason")}</label>
                <select
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                >
                  <option value="">{t("selectReason")}</option>
                  <option value="Slump">{t("slump")}</option>
                  <option value="Air">{t("air")}</option>
                  <option value="Mechanical">{t("mechanical")}</option>
                  <option value="Dispatch">{t("dispatch")}</option>
                  <option value="Batch">{t("batch")}</option>
                  <option value="Time">{t("time")}</option>
                </select>
              </>
            ) : null}



            <div
              style={{
                background: "var(--panel-2)",
                border: "1px solid var(--border)",
                borderRadius: 14,
                padding: 16,
                marginTop: 14,
              }}
            >
              <div
                style={{
                  fontWeight: 900,
                  color: "#fff",
                  textAlign: "center",
                  marginBottom: 12,
                  fontSize: 18,
                }}
              >
                {t("batchWeights")}
              </div>

              <div style={{ overflowX: "auto", width: "100%" }}>
                <table
                  style={{
                    width: isPhone ? 760 : "100%",
                    borderCollapse: "collapse",
                    color: "#fff",
                    fontSize: isPhone ? 11 : 12,
                  }}
                >
                  <thead>
                    <tr>
                      {[
                        t("description"),
                        t("design"),
                        t("target"),
                        t("actual"),
                        t("uom"),
                        t("variance"),
                        t("moisture"),
                        t("waterGallons"),
                      ].map((h) => (
                        <th
                          key={h}
                          style={{
                            borderBottom: "1px solid var(--border)",
                            padding: 6,
                            textAlign: "left",
                          }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>

                  <tbody>
                    {batchRows.map((row, i) => (
                      <tr key={i}>
                        {row.map((cell, j) => (
                          <td
                            key={j}
                            style={{
                              borderBottom: "1px solid rgba(255,255,255,0.08)",
                              padding: 6,
                            }}
                          >
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div
              style={{
                marginTop: 18,
                color: "#fff",
                fontWeight: 800,
                textAlign: "center",
              }}
            >
              {t("finalSignature")}
            </div>
              <canvas
                className="signature-canvas"
                ref={finalSignatureRef}
                onContextMenu={(e) => e.preventDefault()}
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
                onPointerCancel={(e) =>
                  endSignature(e, finalSignatureRef, drawingFinalRef, setFinalSignatureDataUrl)
                }

                style={{
                  width: "100%",
                  height: "180px",
                  minHeight: "180px",
                  display: "block",
                  border: "1px solid var(--border)",
                  borderRadius: 14,
                  touchAction: "none",
                  userSelect: "none",
                  WebkitUserSelect: "none",
                  WebkitTouchCallout: "none",
                  WebkitTapHighlightColor: "transparent",
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
                {t("clearSignature")}
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
                  onClick={() => {
                    stopCamera();
                    setCameraStarted(false);
                    setStep(4);
                  }}
                >
                  {t("back")}
                </button>

                <button
                  className="primary-btn"
                  type="button"
                  onClick={submitTicket}
                  disabled={submitting}
                >
                  {submitting ? t("submitting") : t("submit")}
                </button>
              </div>

            </div>
          </>
        )}
      </div>
    </div>
  );
}