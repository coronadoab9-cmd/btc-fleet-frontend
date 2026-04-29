import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import TruckMap from "./components/TruckMap";
import LoginPage from "./components/LoginPage";
import AdminPage from "./components/AdminPage";
import ETicketsPage from "./components/ETicketsPage";
import ETicketPage from "./pages/ETicketPage";
import { apiFetch } from "./lib/api";
import "./index.css";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/eticket/:token" element={<ETicketPage />} />
        <Route path="/*" element={<ProtectedApp />} />
      </Routes>
    </BrowserRouter>
  );
}

function ProtectedApp() {
  const [auth, setAuth] = useState(() => {
    const raw = localStorage.getItem("btc_admin_auth");
    return raw ? JSON.parse(raw) : null;
  });
  const [activeTab, setActiveTab] = useState("operations");
  const [loading, setLoading] = useState(true);
  const isMobile = window.innerWidth <= 768;

  useEffect(() => {
    async function validate() {
      if (!auth?.token) {
        setLoading(false);
        return;
      }

      try {
        await apiFetch("/admin/me", {
          headers: { "X-Admin-Token": auth.token },
        });
      } catch {
        localStorage.removeItem("btc_admin_auth");
        setAuth(null);
      } finally {
        setLoading(false);
      }
    }

    validate();
  }, [auth?.token]);

  function handleLogin(nextAuth) {
    localStorage.setItem("btc_admin_auth", JSON.stringify(nextAuth));
    setAuth(nextAuth);
  }

  function handleLogout() {
    localStorage.removeItem("btc_admin_auth");
    setAuth(null);
    setActiveTab("operations");
  }

  if (loading) {
    return <div className="full-screen-center">Loading...</div>;
  }

  if (!auth) {
    return <LoginPage onLogin={handleLogin} />;
  }

  return (
    <div className="app-shell">
      <div className="top-nav">
        <div className="top-nav-left">
          <div className="app-title">BTC Fleet</div>

          {!isMobile ? (
            <>
              <button
                className={`tab-btn ${activeTab === "operations" ? "active" : ""}`}
                onClick={() => setActiveTab("operations")}
              >
                Operations
              </button>

              <button
                className={`tab-btn ${activeTab === "admin" ? "active" : ""}`}
                onClick={() => setActiveTab("admin")}
              >
                Admin
              </button>
            </>
          ) : null}

          <button
            className={`tab-btn ${activeTab === "etickets" ? "active" : ""}`}
            onClick={() => setActiveTab("etickets")}
          >
            eTickets
          </button>
        </div>

        <div className="top-nav-right">
          <span className="logged-in-as">{auth.admin?.name}</span>
          <button className="logout-btn" onClick={handleLogout}>
            Log out
          </button>
        </div>
      </div>

      {isMobile ? (
        <ETicketsPage token={auth.token} />
      ) : activeTab === "operations" ? (
        <TruckMap />
      ) : activeTab === "admin" ? (
        <AdminPage token={auth.token} />
      ) : (
        <ETicketsPage token={auth.token} />
      )}
    </div>
  );
}