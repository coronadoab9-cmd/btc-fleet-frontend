import { useEffect, useState } from "react";
import { apiFetch } from "../lib/api";

function formatCys(value) {
  const num = Number(value || 0);
  return `${num.toFixed(1)} cys`;
}

function formatDate(value) {
  if (!value) return "-";

  try {
    const dt = new Date(value);
    dt.setHours(dt.getHours() - 11);

    return new Intl.DateTimeFormat("en-US", {
      month: "2-digit",
      day: "2-digit",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(dt);
  } catch {
    return value;
  }
}

function getCustomerAuth() {
  try {
    const raw = localStorage.getItem("btc_customer_auth");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function JobCard({ job }) {
  const isComplete = String(job.status || "").toLowerCase() === "complete";
  const progress =
    Number(job.order_total || 0) > 0
      ? Math.max(
          0,
          Math.min(100, (Number(job.delivered_total || 0) / Number(job.order_total || 0)) * 100)
        )
      : 0;

  return (
    <div
      style={{
        background: "var(--panel-2)",
        border: "1px solid var(--border)",
        borderRadius: 16,
        padding: 16,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
          marginBottom: 10,
        }}
      >
        <div>
          <div style={{ color: "#fff", fontWeight: 950, fontSize: 20 }}>
            Order #{job.order_number || "-"}
          </div>
          <div style={{ color: "var(--muted)", fontWeight: 800, marginTop: 4 }}>
            {job.address || "-"}
          </div>
        </div>

        <div
          style={{
            color: isComplete ? "#bbf7d0" : "#fed7aa",
            fontWeight: 950,
            border: isComplete
              ? "1px solid rgba(34,197,94,0.4)"
              : "1px solid rgba(251,146,60,0.4)",
            background: isComplete
              ? "rgba(34,197,94,0.12)"
              : "rgba(251,146,60,0.12)",
            borderRadius: 999,
            padding: "8px 12px",
            height: "fit-content",
          }}
        >
          {isComplete ? "Complete" : "In Progress"}
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: window.innerWidth <= 700 ? "1fr" : "repeat(3, 1fr)",
          gap: 10,
          marginTop: 12,
        }}
      >
        <MiniStat label="Order Total" value={formatCys(job.order_total)} />
        <MiniStat label="Delivered" value={formatCys(job.delivered_total)} />
        <MiniStat label="Remaining" value={formatCys(job.remaining_total)} />
      </div>

      <div style={{ marginTop: 14 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            color: "var(--muted)",
            fontWeight: 850,
            fontSize: 13,
            marginBottom: 7,
          }}
        >
          <span>{job.ticket_count || 0} ticket(s)</span>
          <span>{progress.toFixed(0)}%</span>
        </div>

        <div
          style={{
            height: 12,
            borderRadius: 999,
            background: "rgba(255,255,255,0.08)",
            overflow: "hidden",
            border: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${progress}%`,
              borderRadius: 999,
              background: isComplete
                ? "linear-gradient(90deg, #22c55e, #86efac)"
                : "linear-gradient(90deg, #38bdf8, #2563eb)",
            }}
          />
        </div>
      </div>

      <div
        style={{
          color: "var(--muted)",
          fontWeight: 800,
          fontSize: 13,
          marginTop: 12,
        }}
      >
        Latest Load: {formatDate(job.latest_load_time)}
      </div>

      <button
        className="primary-btn"
        type="button"
        style={{ width: "100%", marginTop: 14 }}
        onClick={() => {
          window.location.href = `/customer/jobs/${job.job_portal_token}`;
        }}
      >
        Open Job Portal
      </button>
    </div>
  );
}

function MiniStat({ label, value }) {
  return (
    <div
      style={{
        border: "1px solid var(--border)",
        borderRadius: 12,
        padding: 12,
        background: "rgba(255,255,255,0.03)",
      }}
    >
      <div style={{ color: "var(--muted)", fontWeight: 800, fontSize: 12 }}>
        {label}
      </div>
      <div style={{ color: "#fff", fontWeight: 950, marginTop: 4 }}>{value}</div>
    </div>
  );
}

export default function CustomerDashboardPage() {
  const [auth, setAuth] = useState(() => getCustomerAuth());
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    current_password: "",
    new_password: "",
    confirm_password: "",
  });
  const [changingPassword, setChangingPassword] = useState(false);
  const [loading, setLoading] = useState(true);

  async function loadDashboard() {
    setError("");
    setLoading(true);

    try {
      if (!auth?.token) {
        window.location.href = "/customer/login";
        return;
      }

      const result = await apiFetch("/api/customer/dashboard", {
        headers: {
          "X-Customer-Token": auth.token,
        },
      });

      setData(result);
    } catch (err) {
      localStorage.removeItem("btc_customer_auth");
      setAuth(null);
      setError(err.message || "Could not load dashboard.");
      window.location.href = "/customer/login";
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDashboard();
  }, []);

  async function changePassword() {
    setChangingPassword(true);
    setError("");
    setMessage("");

    try {
      const currentPassword = passwordForm.current_password.trim();
      const newPassword = passwordForm.new_password.trim();
      const confirmPassword = passwordForm.confirm_password.trim();

      if (!currentPassword) throw new Error("Current password is required");
      if (newPassword.length < 8) throw new Error("New password must be at least 8 characters");
      if (newPassword !== confirmPassword) throw new Error("New passwords do not match");

      const savedAuth = getCustomerAuth();
      if (!savedAuth?.token) throw new Error("Please log in again.");

      await apiFetch("/api/customer/auth/change-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Customer-Token": savedAuth.token,
        },
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword,
        }),
      });

      setMessage("Password changed successfully.");
      setPasswordForm({
        current_password: "",
        new_password: "",
        confirm_password: "",
      });
      setShowPasswordForm(false);
    } catch (err) {
      setError(err.message || "Could not change password");
    } finally {
      setChangingPassword(false);
    }
  }

  function logout() {
    localStorage.removeItem("btc_customer_auth");
    window.location.href = "/customer/login";
  }

  if (loading) {
    return <div className="full-screen-center">Loading customer dashboard...</div>;
  }

  const customer = data?.customer || auth?.customer || {};
  const jobs = data?.jobs || [];

  return (
    <div className="app-shell" style={{ padding: 14 }}>
      <div className="panel-card" style={{ maxWidth: 1050, margin: "0 auto" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
            alignItems: "flex-start",
            marginBottom: 18,
          }}
        >
          <div>
            <div className="panel-title" style={{ marginBottom: 4 }}>
              Customer Dashboard
            </div>
            <div style={{ color: "var(--muted)", fontWeight: 850 }}>
              {customer.customer_name || "Customer"}
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="secondary-btn" type="button" onClick={loadDashboard}>
              Refresh
            </button>
            <button
              className="secondary-btn"
              type="button"
              onClick={() => setShowPasswordForm((v) => !v)}
            >
              Change Password
            </button>
            <button className="logout-btn" type="button" onClick={logout}>
              Log Out
            </button>
          </div>
        </div>

        {error ? (
          <div
            style={{
              color: "#fecaca",
              fontWeight: 800,
              marginBottom: 12,
            }}
          >
            {error}
          </div>
        ) : null}

        {message ? (
          <div
            style={{
              color: "#d1fae5",
              fontWeight: 800,
              marginBottom: 12,
            }}
          >
            {message}
          </div>
        ) : null}

        {showPasswordForm ? (
          <div
            style={{
              background: "var(--panel-2)",
              border: "1px solid var(--border)",
              borderRadius: 16,
              padding: 16,
              marginBottom: 16,
            }}
          >
            <div style={{ color: "#fff", fontWeight: 950, fontSize: 20, marginBottom: 12 }}>
              Change Password
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: window.innerWidth <= 700 ? "1fr" : "repeat(3, 1fr)",
                gap: 12,
              }}
            >
              <div>
                <div style={{ color: "var(--muted)", fontWeight: 800, marginBottom: 6 }}>
                  Current Password
                </div>
                <input
                  type="password"
                  value={passwordForm.current_password}
                  onChange={(e) =>
                    setPasswordForm((prev) => ({ ...prev, current_password: e.target.value }))
                  }
                  style={{
                    width: "100%",
                    height: 48,
                    borderRadius: 12,
                    border: "1px solid var(--border)",
                    background: "var(--panel)",
                    color: "#fff",
                    padding: "0 12px",
                    fontWeight: 800,
                  }}
                />
              </div>

              <div>
                <div style={{ color: "var(--muted)", fontWeight: 800, marginBottom: 6 }}>
                  New Password
                </div>
                <input
                  type="password"
                  value={passwordForm.new_password}
                  onChange={(e) =>
                    setPasswordForm((prev) => ({ ...prev, new_password: e.target.value }))
                  }
                  style={{
                    width: "100%",
                    height: 48,
                    borderRadius: 12,
                    border: "1px solid var(--border)",
                    background: "var(--panel)",
                    color: "#fff",
                    padding: "0 12px",
                    fontWeight: 800,
                  }}
                />
              </div>

              <div>
                <div style={{ color: "var(--muted)", fontWeight: 800, marginBottom: 6 }}>
                  Confirm New Password
                </div>
                <input
                  type="password"
                  value={passwordForm.confirm_password}
                  onChange={(e) =>
                    setPasswordForm((prev) => ({ ...prev, confirm_password: e.target.value }))
                  }
                  style={{
                    width: "100%",
                    height: 48,
                    borderRadius: 12,
                    border: "1px solid var(--border)",
                    background: "var(--panel)",
                    color: "#fff",
                    padding: "0 12px",
                    fontWeight: 800,
                  }}
                />
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
              <button
                className="primary-btn"
                type="button"
                onClick={changePassword}
                disabled={changingPassword}
              >
                {changingPassword ? "Saving..." : "Save New Password"}
              </button>

              <button
                className="secondary-btn"
                type="button"
                onClick={() => setShowPasswordForm(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : null}

        {jobs.length === 0 ? (
          <div
            style={{
              color: "var(--muted)",
              fontWeight: 850,
              border: "1px solid var(--border)",
              borderRadius: 16,
              padding: 18,
              background: "var(--panel-2)",
            }}
          >
            No jobs are available yet.
          </div>
        ) : (
          <div style={{ display: "grid", gap: 14 }}>
            {jobs.map((job) => (
              <JobCard key={job.job_portal_token || job.portal_job_key} job={job} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
