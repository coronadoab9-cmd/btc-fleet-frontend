export function getApiBase() {
  if (typeof window === "undefined") return "http://127.0.0.1:8000";

  const { protocol, hostname } = window.location;

  if (hostname === "localhost" || hostname === "127.0.0.1") {
    return "http://127.0.0.1:8000";
  }

  if (hostname === "app.btcfleet.app") {
    return "https://fleet.btcfleet.app";
  }

  return `${protocol}//fleet.btcfleet.app`;
}

export function getAppBase() {
  if (typeof window === "undefined") return "http://localhost:5173";
  return window.location.origin;
}

export function buildEticketUrl(token) {
  return `${getAppBase()}/eticket/${token || ""}`;
}

export function buildEticketPdfUrl(token) {
  return `${getApiBase()}/api/etickets/${token || ""}/pdf`;
}

export async function apiFetch(path, options = {}) {
  const url = `${getApiBase()}${path}`;
  const res = await fetch(url, options);
  const text = await res.text();

  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }

  if (!res.ok) {
    throw new Error(data.detail || data.raw || "Request failed");
  }

  return data;
}