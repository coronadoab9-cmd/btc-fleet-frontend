import { useMemo, useState } from "react";
import { apiFetch } from "../lib/api";
import "./customer-portal.css";

export default function CustomerResetPasswordPage() {
  const token = useMemo(() => {
    return new URLSearchParams(window.location.search).get("token") || "";
  }, []);

  const [form, setForm] = useState({
    password: "",
    confirm_password: "",
  });
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function resetPassword(e) {
    e.preventDefault();
    setError("");
    setMessage("");

    if (!token) {
      setError("This password reset link is invalid.");
      return;
    }

    if (form.password.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }

    if (form.password !== form.confirm_password) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const result = await apiFetch("/api/customer/auth/reset-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token,
          new_password: form.password,
        }),
      });

      setMessage(result.message || "Password reset successfully.");
      setForm({ password: "", confirm_password: "" });
    } catch (err) {
      setError(err.message || "Could not reset password.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="full-screen-center" style={{ padding: 16 }}>
      <form
        onSubmit={resetPassword}
        className="panel-card"
        style={{
          width: "100%",
          maxWidth: 430,
        }}
      >
        <div className="panel-title" style={{ marginBottom: 6 }}>
          Reset Password
        </div>

        <div style={{ color: "var(--muted)", fontWeight: 800, marginBottom: 18 }}>
          Choose a new password for your BTC Customer Portal account.
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

        {!message ? (
          <div style={{ display: "grid", gap: 12 }}>
            <div>
              <label>New Password</label>
              <input
                type="password"
                autoComplete="new-password"
                value={form.password}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, password: e.target.value }))
                }
                placeholder="At least 8 characters"
                required
              />
            </div>

            <div>
              <label>Confirm New Password</label>
              <input
                type="password"
                autoComplete="new-password"
                value={form.confirm_password}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    confirm_password: e.target.value,
                  }))
                }
                placeholder="Re-enter password"
                required
              />
            </div>

            <button className="primary-btn" type="submit" disabled={loading || !token}>
              {loading ? "Saving..." : "Save New Password"}
            </button>
          </div>
        ) : null}

        <button
          type="button"
          className="portal-login-link"
          style={{ marginTop: 14 }}
          onClick={() => {
            window.location.href = "/customer/login";
          }}
        >
          Back to login
        </button>
      </form>
    </div>
  );
}
