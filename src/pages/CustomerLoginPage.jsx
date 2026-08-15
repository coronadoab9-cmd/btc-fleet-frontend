import { useState } from "react";
import { apiFetch } from "../lib/api";
import "./customer-portal.css";

export default function CustomerLoginPage() {
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({
    email: "",
    password: "",
  });
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  function switchMode(nextMode) {
    setMode(nextMode);
    setError("");
    setMessage("");
  }

  async function login(e) {
    e.preventDefault();
    setError("");
    setMessage("");
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

  async function forgotPassword(e) {
    e.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);

    try {
      const result = await apiFetch("/api/customer/auth/forgot-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: form.email,
        }),
      });

      setMessage(
        result.message ||
          "If an active account exists for that email, a password reset link has been sent."
      );
    } catch (err) {
      setError(err.message || "Could not request a password reset.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="full-screen-center" style={{ padding: 16 }}>
      <form
        onSubmit={mode === "login" ? login : forgotPassword}
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
          {mode === "login"
            ? "Log in to view the projects, tickets, and delivery documents your company has assigned to you."
            : "Enter your company email and we will send a secure password reset link if an active account exists."}
        </div>

        {error ? (
          <div className="portal-alert portal-alert-error" style={{ marginBottom: 12 }}>
            {error}
          </div>
        ) : null}

        {message ? (
          <div className="portal-alert portal-alert-success" style={{ marginBottom: 12 }}>
            {message}
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
              placeholder="you@company.com"
              required
            />
          </div>

          {mode === "login" ? (
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
                required
              />
            </div>
          ) : null}

          <button className="primary-btn" type="submit" disabled={loading}>
            {loading
              ? mode === "login"
                ? "Logging in..."
                : "Sending..."
              : mode === "login"
              ? "Log In"
              : "Send Reset Link"}
          </button>

          <button
            type="button"
            className="portal-login-link"
            onClick={() => switchMode(mode === "login" ? "forgot" : "login")}
          >
            {mode === "login" ? "Forgot password?" : "Back to login"}
          </button>
        </div>
      </form>
    </div>
  );
}
