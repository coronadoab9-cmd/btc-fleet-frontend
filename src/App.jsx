import { useEffect, useState } from "react";
import TruckMap from "./components/TruckMap";
import LoginPage from "./components/LoginPage";
import AdminPage from "./components/AdminPage";
import "./index.css";

const API_BASE = "https://fleet.btcfleet.app";

export default function App() {
  const [auth, setAuth] = useState(() => {
    const raw = localStorage.getItem("btc_admin_auth");
    return raw ? JSON.parse(raw) : null;
  });
  const [activeTab, setActiveTab] = useState("operations");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function validate() {
      if (!auth?.token) {
        setLoading(false);
        return;
      }

      try {
        const res = await fetch(`${API_BASE}/admin/me`, {
          headers: {
            "X-Admin-Token": auth.token,
          },
        });

        if (!res.ok) {
          localStorage.removeItem("btc_admin_auth");
          setAuth(null);
        }
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
        </div>

        <div className="top-nav-right">
          <span className="logged-in-as">{auth.admin?.name}</span>
          <button className="logout-btn" onClick={handleLogout}>
            Log out
          </button>
        </div>
      </div>

      {activeTab === "operations" ? (
        <TruckMap />
      ) : (
        <AdminPage token={auth.token} />
      )}
    </div>
  );
}