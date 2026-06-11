import { useState } from "react";
import { apiFetch } from "../lib/api";

export default function CustomerLoginPage() {
  const [form, setForm] = useState({
    email: "",
    password: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function login(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const result = await apiFetch("/api/customer/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: form.email,
          password: form.password,
        }),
      });

      localStorage.setItem("btc_customer_auth", JSON.stringify(result));
      window.location.href = "/customer/dashboard";
    } catch (err) {
      setError(err.message || "Could not log in.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="full-screen-center" style={{ padding: 16 }}>
      <form
        onSubmit={login}
        className="panel-card"
        style={{
          width: "100%",
          maxWidth: 430,
        }}
      >
        <div className="panel-title" style={{ marginBottom: 6 }}>
          BTC Customer Portal
        </div>

        <div style={{ color: "var(--muted)", fontWeight: 800, marginBottom: 18 }}>
          Log in to view your jobs, tickets, and final delivery documents.
        </div>

        {error ? (
          <div
            style={{
              color: "#fecaca",
              fontWeight: 800,
              marginBottom: 12,
              border: "1px solid rgba(239,68,68,0.35)",
              background: "rgba(239,68,68,0.12)",
              borderRadius: 12,
              padding: 10,
            }}
          >
            {error}
          </div>
        ) : null}

        <div style={{ display: "grid", gap: 12 }}>
          <div>
            <label>Email</label>
            <input
              type="email"
              value={form.email}
              autoComplete="email"
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  email: e.target.value,
                }))
              }
              placeholder="customer@email.com"
            />
          </div>

          <div>
            <label>Password</label>
            <input
              type="password"
              value={form.password}
              autoComplete="current-password"
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  password: e.target.value,
                }))
              }
              placeholder="Password"
            />
          </div>

          <button className="primary-btn" type="submit" disabled={loading}>
            {loading ? "Logging in..." : "Log In"}
          </button>
        </div>
      </form>
    </div>
  );
}
