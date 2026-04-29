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

  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    current_password: "",
    new_password: "",
  });
  const [passwordMessage, setPasswordMessage] = useState("");
  const [passwordError, setPasswordError] = useState("");

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

  async function changePassword() {
    setPasswordMessage("");
    setPasswordError("");

    try {
      if (!passwordForm.current_password.trim()) {
        throw new Error("Current password is required");
      }

      if (passwordForm.new_password.trim().length < 8) {
        throw new Error("New password must be at least 8 characters");
      }

      await apiFetch("/admin/change-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Admin-Token": auth.token,
        },
        body: JSON.stringify(passwordForm),
      });

      setPasswordMessage("Password updated successfully");
      setPasswordForm({ current_password: "", new_password: "" });
      setShowPasswordForm(false);
    } catch (err) {
      setPasswordError(err.message || "Could not update password");
    }
  }

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
          <div className="app-title">BTC</div>

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
          <button
            className="logout-btn"
            type="button"
            onClick={() => setShowPasswordForm((v) => !v)}
          >
            Change Password
          </button>
          <button className="logout-btn" onClick={handleLogout}>
            Log out
          </button>
        </div>
      </div>

      {showPasswordForm ? (
        <div
          style={{
            background: "var(--panel)",
            borderBottom: "1px solid var(--border)",
            padding: 14,
          }}
        >
          {passwordError ? (
            <div style={{ color: "#fecaca", marginBottom: 10, fontWeight: 700 }}>
              {passwordError}
            </div>
          ) : null}

          {passwordMessage ? (
            <div style={{ color: "#d1fae5", marginBottom: 10, fontWeight: 700 }}>
              {passwordMessage}
            </div>
          ) : null}

          <div
            style={{
              display: "grid",
              gridTemplateColumns: window.innerWidth <= 768 ? "1fr" : "1fr 1fr auto",
              gap: 10,
              alignItems: "end",
            }}
          >
            <div>
              <label>Current Password</label>
              <input
                type="password"
                value={passwordForm.current_password}
                onChange={(e) =>
                  setPasswordForm((p) => ({
                    ...p,
                    current_password: e.target.value,
                  }))
                }
              />
            </div>

            <div>
              <label>New Password</label>
              <input
                type="password"
                value={passwordForm.new_password}
                onChange={(e) =>
                  setPasswordForm((p) => ({
                    ...p,
                    new_password: e.target.value,
                  }))
                }
              />
            </div>

            <button className="primary-btn" type="button" onClick={changePassword}>
              Save Password
            </button>
          </div>
        </div>
      ) : null}

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