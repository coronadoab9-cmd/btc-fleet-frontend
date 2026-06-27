import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "../lib/api";
import "./customer-portal.css";

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

function DashboardStat({ label, value }) {
  return (
    <div className="portal-stat">
      <div className="portal-label">{label}</div>
      <div className="portal-stat-value">{value}</div>
    </div>
  );
}

function JobStatusBadge({ complete }) {
  return (
    <span
      className={
        complete
          ? "portal-status-pill portal-status-delivered"
          : "portal-status-pill portal-status-active"
      }
    >
      {complete ? "Complete" : "In Progress"}
    </span>
  );
}

export default function CustomerDashboardPage() {
  const [auth, setAuth] = useState(() => getCustomerAuth());
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [orderSearch, setOrderSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [message, setMessage] = useState("");
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    current_password: "",
    new_password: "",
    confirm_password: "",
  });
  const [changingPassword, setChangingPassword] = useState(false);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);

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

  const customer = data?.customer || auth?.customer || {};
  const jobs = data?.jobs || [];

  const dashboardStats = useMemo(() => {
    const activeJobs = jobs.filter(
      (job) => String(job.status || "").toLowerCase() !== "complete"
    ).length;

    const ticketCount = jobs.reduce((sum, job) => sum + Number(job.ticket_count || 0), 0);
    const deliveredTotal = jobs.reduce(
      (sum, job) => sum + Number(job.delivered_total || 0),
      0
    );
    const remainingTotal = jobs.reduce(
      (sum, job) => sum + Number(job.remaining_total || 0),
      0
    );

    const latestLoadMs = jobs.reduce((latest, job) => {
      const ms = job.latest_load_time ? new Date(job.latest_load_time).getTime() : 0;
      return Number.isFinite(ms) && ms > latest ? ms : latest;
    }, 0);

    return {
      activeJobs,
      ticketCount,
      deliveredTotal,
      remainingTotal,
      latestLoadMs,
    };
  }, [jobs]);

  const attentionItems = useMemo(() => {
    const inProgressJobs = jobs.filter(
      (job) => String(job.status || "").toLowerCase() !== "complete"
    );

    const jobsWithRemaining = jobs.filter(
      (job) => Number(job.remaining_total || 0) > 0
    );

    const items = [];

    if (inProgressJobs.length > 0) {
      items.push({
        label: `${inProgressJobs.length} active project${inProgressJobs.length === 1 ? "" : "s"} currently in progress`,
        tone: "warning",
      });
    }

    if (jobsWithRemaining.length > 0) {
      items.push({
        label: `${jobsWithRemaining.length} project${jobsWithRemaining.length === 1 ? "" : "s"} still have remaining yardage`,
        tone: "warning",
      });
    }

    if (dashboardStats.remainingTotal > 0) {
      items.push({
        label: `${formatCys(dashboardStats.remainingTotal)} remaining across active projects`,
        tone: "info",
      });
    }

    if (dashboardStats.latestLoadMs > 0) {
      items.push({
        label: `Most recent load activity: ${formatDate(new Date(dashboardStats.latestLoadMs).toISOString())}`,
        tone: "info",
      });
    }

    if (!items.length) {
      items.push({
        label: "No active project alerts right now",
        tone: "success",
      });
    }

    return items;
  }, [jobs, dashboardStats]);

  const filteredJobs = jobs.filter((job) => {
    const search = orderSearch.trim().toLowerCase();
    const isComplete = String(job.status || "").toLowerCase() === "complete";

    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "complete" && isComplete) ||
      (statusFilter === "in_progress" && !isComplete);

    const matchesSearch =
      !search ||
      String(job.order_number || "").toLowerCase().includes(search) ||
      String(job.address || "").toLowerCase().includes(search) ||
      String(job.customer_name || "").toLowerCase().includes(search);

    return matchesStatus && matchesSearch;
  });

  if (loading) {
    return <div className="full-screen-center">Loading customer dashboard...</div>;
  }

  return (
    <div className="customer-portal-page">
      <header className="customer-portal-topbar">
        <div>
          <div className="customer-portal-brand">BTC Customer Portal</div>
          <div className="customer-portal-subtitle">
            {customer.customer_name || "Customer"} dashboard
          </div>
        </div>

        <div className="portal-menu-wrap">
          <button
            className="portal-menu-button"
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Open menu"
          >
            <span></span>
            <span></span>
            <span></span>
          </button>

          {menuOpen ? (
            <div className="portal-menu">
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  loadDashboard();
                }}
              >
                Refresh
              </button>

              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  setShowPasswordForm((v) => !v);
                }}
              >
                Change Password
              </button>

              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  logout();
                }}
              >
                Log Out
              </button>
            </div>
          ) : null}
        </div>
      </header>

      <main className="customer-portal-main">
        <section className="portal-hero">
          <div>
            <div className="portal-kicker">Customer Dashboard</div>
            <h1 className="portal-title">
              {customer.customer_name || "Customer"}
            </h1>
            <div className="portal-meta">
              Active projects, delivery progress, final tickets, and job documents.
            </div>
          </div>

          <div className="portal-live-card">
            <div className="portal-live-label">Last Activity</div>
            <div className="portal-live-value portal-live-value-sm">
              {dashboardStats.latestLoadMs > 0
                ? formatDate(new Date(dashboardStats.latestLoadMs).toISOString())
                : "-"}
            </div>
            <div>
              {dashboardStats.activeJobs} active project(s)
            </div>
          </div>
        </section>

        {error ? <div className="portal-alert portal-alert-error">{error}</div> : null}
        {message ? <div className="portal-alert portal-alert-success">{message}</div> : null}

        <section className="portal-card portal-attention-card">
          <div className="portal-section-header">
            <div>
              <div className="portal-section-title">Needs Attention</div>
              <div className="portal-meta">
                Quick view of active delivery items and recent activity.
              </div>
            </div>
          </div>

          <div className="portal-attention-list">
            {attentionItems.map((item, index) => (
              <div
                key={`${item.label}-${index}`}
                className={`portal-attention-item portal-attention-${item.tone}`}
              >
                <span className="portal-attention-dot" />
                <span>{item.label}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="portal-card">
          <div className="portal-section-header">
            <div className="portal-section-title">Today's Overview</div>
          </div>

          <div className="portal-stats portal-stats-four">
            <DashboardStat label="Active Jobs" value={dashboardStats.activeJobs} />
            <DashboardStat label="Tickets" value={dashboardStats.ticketCount} />
            <DashboardStat label="Delivered" value={formatCys(dashboardStats.deliveredTotal)} />
            <DashboardStat label="Remaining" value={formatCys(dashboardStats.remainingTotal)} />
          </div>
        </section>

        {showPasswordForm ? (
          <section className="portal-card">
            <div className="portal-section-title">Change Password</div>

            <div className="portal-form-grid" style={{ marginTop: 16 }}>
              <div>
                <div className="portal-label">Current Password</div>
                <input
                  className="portal-input"
                  type="password"
                  value={passwordForm.current_password}
                  onChange={(e) =>
                    setPasswordForm((prev) => ({ ...prev, current_password: e.target.value }))
                  }
                />
              </div>

              <div>
                <div className="portal-label">New Password</div>
                <input
                  className="portal-input"
                  type="password"
                  value={passwordForm.new_password}
                  onChange={(e) =>
                    setPasswordForm((prev) => ({ ...prev, new_password: e.target.value }))
                  }
                />
              </div>

              <div>
                <div className="portal-label">Confirm New Password</div>
                <input
                  className="portal-input"
                  type="password"
                  value={passwordForm.confirm_password}
                  onChange={(e) =>
                    setPasswordForm((prev) => ({ ...prev, confirm_password: e.target.value }))
                  }
                />
              </div>
            </div>

            <div className="customer-portal-actions" style={{ marginTop: 16 }}>
              <button
                className="portal-btn portal-btn-navy"
                type="button"
                onClick={changePassword}
                disabled={changingPassword}
              >
                {changingPassword ? "Saving..." : "Save New Password"}
              </button>

              <button
                className="portal-btn portal-btn-light"
                type="button"
                onClick={() => setShowPasswordForm(false)}
              >
                Cancel
              </button>
            </div>
          </section>
        ) : null}

        <section className="portal-card">
          <div className="portal-section-header">
            <div>
              <div className="portal-section-title">Project Center</div>
              <div className="portal-meta">
                Showing {filteredJobs.length} of {jobs.length} order(s)
              </div>
            </div>
          </div>

          <div className="portal-filter-bar">
            <input
              className="portal-input"
              type="text"
              value={orderSearch}
              onChange={(e) => setOrderSearch(e.target.value)}
              placeholder="Search by order #, address, or customer"
            />

            <select
              className="portal-input"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">All Orders</option>
              <option value="in_progress">In Progress</option>
              <option value="complete">Complete</option>
            </select>

            <button
              className="portal-btn portal-btn-navy"
              type="button"
              onClick={() => {
                setOrderSearch("");
                setStatusFilter("all");
              }}
            >
              Clear
            </button>
          </div>

          {filteredJobs.length === 0 ? (
            <div className="portal-empty" style={{ marginTop: 16 }}>
              No matching orders found.
            </div>
          ) : (
            <div className="portal-table-wrap" style={{ marginTop: 18 }}>
              <table className="portal-table">
                <thead>
                  <tr>
                    <th>Order</th>
                    <th>Address</th>
                    <th>Tickets</th>
                    <th>Delivered</th>
                    <th>Remaining</th>
                    <th>Progress</th>
                    <th>Status</th>
                    <th>Latest Load</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredJobs.map((job) => {
                    const isComplete = String(job.status || "").toLowerCase() === "complete";
                    const progress =
                      Number(job.order_total || 0) > 0
                        ? Math.max(
                            0,
                            Math.min(
                              100,
                              (Number(job.delivered_total || 0) /
                                Number(job.order_total || 0)) *
                                100
                            )
                          )
                        : 0;

                    return (
                      <tr key={job.job_portal_token || job.portal_job_key}>
                        <td>#{job.order_number || "-"}</td>
                        <td>{job.address || "-"}</td>
                        <td>{job.ticket_count || 0}</td>
                        <td>{formatCys(job.delivered_total)}</td>
                        <td>{formatCys(job.remaining_total)}</td>
                        <td>
                          <div className="portal-progress-track portal-progress-small">
                            <div
                              className={`portal-progress-fill ${
                                isComplete ? "complete" : ""
                              }`}
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                          <div className="portal-small-muted">{progress.toFixed(0)}%</div>
                        </td>
                        <td>
                          <JobStatusBadge complete={isComplete} />
                        </td>
                        <td>{formatDate(job.latest_load_time)}</td>
                        <td>
                          <button
                            className="portal-btn portal-btn-navy"
                            type="button"
                            onClick={() => {
                              window.location.href = `/customer/jobs/${job.job_portal_token}`;
                            }}
                          >
                            Open
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
