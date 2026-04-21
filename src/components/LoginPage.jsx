import { useState } from "react";
import { apiFetch } from "../lib/api";

export default function LoginPage({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const data = await apiFetch("/admin/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: username.trim().toLowerCase(),
          password,
        }),
      });

      if (!data?.token) {
        setError("Login succeeded but no auth token was returned");
        return;
      }

      onLogin?.(data);
    } catch (err) {
      setError(err.message || "Could not connect to the login service");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-title">BTC Fleet Admin Login</div>

        <form className="login-form" onSubmit={handleSubmit}>
          <label>Username</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="adam.coronado"
            autoComplete="username"
          />

          <label>Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter password"
            autoComplete="current-password"
          />

          {error ? (
            <div
              style={{
                background: "rgba(220,38,38,0.15)",
                border: "1px solid rgba(220,38,38,0.4)",
                color: "#fecaca",
                padding: "12px 14px",
                borderRadius: "12px",
                marginTop: "8px",
                fontWeight: 600,
              }}
            >
              {error}
            </div>
          ) : null}

          <button className="primary-btn" type="submit" disabled={submitting}>
            {submitting ? "Signing In..." : "Sign In"}
          </button>
        </form>

        <div className="login-help">
          Use your BTC Fleet admin credentials.
          <br />
          Example username format: <strong>adam.coronado</strong>
        </div>
      </div>
    </div>
  );
}