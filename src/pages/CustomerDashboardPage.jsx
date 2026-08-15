import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "../lib/api";
import "./customer-portal.css";
import ProjectCard from "./ProjectCard";

function formatCys(value) {
  const num = Number(value || 0);
  return `${num.toFixed(1)} cys`;
}

function formatDate(value) {
  if (!value) return "-";

  try {
    const dt = new Date(value);

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

  const [showUserManagement, setShowUserManagement] = useState(false);
  const [companyUsers, setCompanyUsers] = useState([]);
  const [loadingCompanyUsers, setLoadingCompanyUsers] = useState(false);
  const [savingCompanyUser, setSavingCompanyUser] = useState(false);
  const [userForm, setUserForm] = useState({
    display_name: "",
    email: "",
    role: "job_site",
    job_portal_tokens: [],
  });

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

      setData(result);    } catch (err) {
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

  useEffect(() => {
    if (
      showUserManagement &&
      String(data?.customer?.role || "").toLowerCase() === "company_admin"
    ) {
      loadCompanyUsers();
    }
  }, [showUserManagement]);

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

  function customerAuthHeaders() {
    const savedAuth = getCustomerAuth();
    if (!savedAuth?.token) {
      throw new Error("Please log in again.");
    }

    return {
      "Content-Type": "application/json",
      "X-Customer-Token": savedAuth.token,
    };
  }

  async function loadCompanyUsers() {
    setLoadingCompanyUsers(true);
    setError("");

    try {
      const savedAuth = getCustomerAuth();
      if (!savedAuth?.token) throw new Error("Please log in again.");

      const result = await apiFetch("/api/customer/company/users", {
        headers: {
          "X-Customer-Token": savedAuth.token,
        },
      });

      setCompanyUsers(result.users || []);
    } catch (err) {
      setError(err.message || "Could not load company users.");
    } finally {
      setLoadingCompanyUsers(false);
    }
  }

  function toggleNewUserJob(jobToken) {
    setUserForm((prev) => {
      const current = new Set(prev.job_portal_tokens || []);
      if (current.has(jobToken)) {
        current.delete(jobToken);
      } else {
        current.add(jobToken);
      }
      return {
        ...prev,
        job_portal_tokens: Array.from(current),
      };
    });
  }

  async function createCompanyUser() {
    setSavingCompanyUser(true);
    setError("");
    setMessage("");

    try {
      const displayName = userForm.display_name.trim();
      const email = userForm.email.trim().toLowerCase();
      const role = userForm.role;

      if (!displayName) throw new Error("User name is required.");
      if (!email || !email.includes("@")) throw new Error("Valid company email is required.");
      if (role === "job_site" && userForm.job_portal_tokens.length === 0) {
        throw new Error("Assign at least one project to a job site user.");
      }

      const result = await apiFetch("/api/customer/company/users", {
        method: "POST",
        headers: customerAuthHeaders(),
        body: JSON.stringify({
          display_name: displayName,
          email,
          role,
          job_portal_tokens:
            role === "job_site" ? userForm.job_portal_tokens : [],
        }),
      });

      setUserForm({
        display_name: "",
        email: "",
        role: "job_site",
        job_portal_tokens: [],
      });

      setMessage(
        result.email_sent
          ? `Account created for ${email}. A secure password setup email was sent.`
          : `Account created for ${email}, but the setup email could not be sent. Use Send Password Reset to try again.`
      );

      await loadCompanyUsers();
    } catch (err) {
      setError(err.message || "Could not create company user.");
    } finally {
      setSavingCompanyUser(false);
    }
  }

  function updateCompanyUserLocal(userId, patch) {
    setCompanyUsers((prev) =>
      prev.map((user) =>
        Number(user.id) === Number(userId)
          ? { ...user, ...patch }
          : user
      )
    );
  }

  function toggleExistingUserJob(userId, jobToken) {
    setCompanyUsers((prev) =>
      prev.map((user) => {
        if (Number(user.id) !== Number(userId)) return user;

        const current = new Set(user.job_portal_tokens || []);
        if (current.has(jobToken)) {
          current.delete(jobToken);
        } else {
          current.add(jobToken);
        }

        return {
          ...user,
          job_portal_tokens: Array.from(current),
        };
      })
    );
  }

  async function saveCompanyUser(user) {
    setSavingCompanyUser(true);
    setError("");
    setMessage("");

    try {
      await apiFetch(`/api/customer/company/users/${user.id}`, {
        method: "PUT",
        headers: customerAuthHeaders(),
        body: JSON.stringify({
          display_name: user.display_name,
          role: user.role,
          active: Boolean(user.active),
          job_portal_tokens:
            user.role === "job_site" ? user.job_portal_tokens || [] : [],
        }),
      });

      setMessage(`Saved access for ${user.email}.`);
      await loadCompanyUsers();
    } catch (err) {
      setError(err.message || "Could not update company user.");
    } finally {
      setSavingCompanyUser(false);
    }
  }

  async function sendCompanyUserPasswordReset(user) {
    setError("");
    setMessage("");

    try {
      const result = await apiFetch(
        `/api/customer/company/users/${user.id}/send-password-reset`,
        {
          method: "POST",
          headers: customerAuthHeaders(),
        }
      );

      setMessage(result.message || `Password reset email sent to ${user.email}.`);
    } catch (err) {
      setError(err.message || "Could not send password reset email.");
    }
  }

  function logout() {
    localStorage.removeItem("btc_customer_auth");
    window.location.href = "/customer/login";
  }

  const customer = data?.customer || auth?.customer || {};
  const jobs = data?.jobs || [];
  const isCompanyAdmin =
    String(customer.role || "").toLowerCase() === "company_admin";
  const allowedDomain = String(customer.allowed_email_domain || "").trim().toLowerCase();

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
            {customer.company_name || customer.customer_name || "Customer"} |{" "}
            {isCompanyAdmin ? "Company Admin" : "Job Site Access"}
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

              {isCompanyAdmin ? (
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    setShowUserManagement((v) => !v);
                  }}
                >
                  Manage Users
                </button>
              ) : null}

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
        <section className="portal-hero portal-hero-premium">
          <div className="portal-hero-left">
            <div className="portal-kicker">
              {new Date().getHours() < 12
                ? "Good Morning"
                : new Date().getHours() < 18
                ? "Good Afternoon"
                : "Good Evening"}
            </div>

            <h1 className="portal-title">
              Welcome back,
              <br />
              {customer.display_name || customer.customer_name || "Customer"}
            </h1>

            <div className="portal-meta portal-hero-copy">
              {isCompanyAdmin
                ? "Track deliveries, download signed tickets, manage users, and monitor every company project."
                : "View the assigned job, current delivery activity, and eTickets available to your account."}
            </div>
          </div>

          <div className="portal-live-card portal-live-card-premium">
            <div className="portal-live-label">Live Status</div>
            <div className="portal-live-value">{dashboardStats.activeJobs}</div>
            <div className="portal-live-subtext">Active Projects</div>

            <div className="portal-live-divider" />

            <div className="portal-live-row">
              <span>{dashboardStats.ticketCount}</span>
              <small>Tickets</small>
            </div>

            <div className="portal-live-row">
              <span>{formatCys(dashboardStats.remainingTotal)}</span>
              <small>Remaining</small>
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

        {isCompanyAdmin && showUserManagement ? (
          <section className="portal-card portal-user-management">
            <div className="portal-section-header">
              <div>
                <div className="portal-section-title">Company Users</div>
                <div className="portal-meta">
                  Add as many company users as needed. Company admins can see every project.
                  Job site users only see the projects you assign to them.
                </div>
              </div>
            </div>

            <div className="portal-domain-banner">
              <strong>Company email domain:</strong>{" "}
              {allowedDomain ? `@${allowedDomain}` : "Not configured"}
            </div>

            {!allowedDomain ? (
              <div className="portal-alert portal-alert-error" style={{ marginTop: 12 }}>
                A company email domain must be configured before additional users can be created.
                Contact BTC Fleet support to set the approved company domain.
              </div>
            ) : null}

            <div className="portal-user-create">
              <div className="portal-section-title portal-section-title-small">
                Add User
              </div>

              <div className="portal-form-grid" style={{ marginTop: 14 }}>
                <div>
                  <div className="portal-label">Name</div>
                  <input
                    className="portal-input"
                    type="text"
                    value={userForm.display_name}
                    onChange={(e) =>
                      setUserForm((prev) => ({
                        ...prev,
                        display_name: e.target.value,
                      }))
                    }
                    placeholder="Employee name"
                  />
                </div>

                <div>
                  <div className="portal-label">Company Email</div>
                  <input
                    className="portal-input"
                    type="email"
                    value={userForm.email}
                    onChange={(e) =>
                      setUserForm((prev) => ({
                        ...prev,
                        email: e.target.value,
                      }))
                    }
                    placeholder={allowedDomain ? `name@${allowedDomain}` : "name@company.com"}
                  />
                </div>

                <div>
                  <div className="portal-label">Access Level</div>
                  <select
                    className="portal-input"
                    value={userForm.role}
                    onChange={(e) =>
                      setUserForm((prev) => ({
                        ...prev,
                        role: e.target.value,
                        job_portal_tokens:
                          e.target.value === "company_admin"
                            ? []
                            : prev.job_portal_tokens,
                      }))
                    }
                  >
                    <option value="job_site">Job Site User</option>
                    <option value="company_admin">Company Admin</option>
                  </select>
                </div>
              </div>

              {userForm.role === "job_site" ? (
                <div className="portal-job-access-box">
                  <div className="portal-label">Assigned Projects / Orders</div>
                  <div className="portal-meta" style={{ marginBottom: 10 }}>
                    This user will only see the selections below.
                  </div>

                  {jobs.length === 0 ? (
                    <div className="portal-empty">No company projects are available yet.</div>
                  ) : (
                    <div className="portal-job-access-grid">
                      {jobs.map((job) => {
                        const token = job.job_portal_token;
                        const checked = userForm.job_portal_tokens.includes(token);
                        return (
                          <label
                            key={`new-${token}`}
                            className={`portal-job-access-option ${
                              checked ? "portal-job-access-option-selected" : ""
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleNewUserJob(token)}
                            />
                            <span>
                              <strong>
                                {job.project_name || job.address || "Project"}
                              </strong>
                              <small>
                                Order #{job.order_number || "-"} | {job.address || "-"}
                              </small>
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : (
                <div className="portal-access-note">
                  Company Admin access includes every current and historical company project,
                  ticket, and portal file.
                </div>
              )}

              <button
                className="portal-btn portal-btn-navy"
                type="button"
                style={{ marginTop: 14 }}
                disabled={savingCompanyUser || !allowedDomain}
                onClick={createCompanyUser}
              >
                {savingCompanyUser ? "Creating..." : "Create User & Send Setup Email"}
              </button>
            </div>

            <div className="portal-user-list">
              <div className="portal-section-header" style={{ marginTop: 24 }}>
                <div>
                  <div className="portal-section-title portal-section-title-small">
                    Existing Users
                  </div>
                  <div className="portal-meta">
                    {loadingCompanyUsers
                      ? "Loading users..."
                      : `${companyUsers.length} user${companyUsers.length === 1 ? "" : "s"}`}
                  </div>
                </div>
              </div>

              {!loadingCompanyUsers && companyUsers.length === 0 ? (
                <div className="portal-empty">No company users found.</div>
              ) : null}

              <div className="portal-user-card-grid">
                {companyUsers.map((user) => {
                  const isSelf = Number(user.id) === Number(customer.id);

                  return (
                    <div className="portal-user-card" key={user.id}>
                      <div className="portal-user-card-top">
                        <div>
                          <div className="portal-user-name">
                            {user.display_name || user.email}
                            {isSelf ? " (You)" : ""}
                          </div>
                          <div className="portal-meta">{user.email}</div>
                        </div>

                        <span
                          className={
                            user.active
                              ? "portal-status-pill portal-status-delivered"
                              : "portal-status-pill portal-status-rejected"
                          }
                        >
                          {user.active ? "Active" : "Inactive"}
                        </span>
                      </div>

                      <div className="portal-form-grid" style={{ marginTop: 14 }}>
                        <div>
                          <div className="portal-label">Name</div>
                          <input
                            className="portal-input"
                            type="text"
                            value={user.display_name || ""}
                            onChange={(e) =>
                              updateCompanyUserLocal(user.id, {
                                display_name: e.target.value,
                              })
                            }
                          />
                        </div>

                        <div>
                          <div className="portal-label">Access Level</div>
                          <select
                            className="portal-input"
                            value={user.role || "job_site"}
                            disabled={isSelf}
                            onChange={(e) =>
                              updateCompanyUserLocal(user.id, {
                                role: e.target.value,
                                job_portal_tokens:
                                  e.target.value === "company_admin"
                                    ? []
                                    : user.job_portal_tokens || [],
                              })
                            }
                          >
                            <option value="job_site">Job Site User</option>
                            <option value="company_admin">Company Admin</option>
                          </select>
                        </div>

                        <label className="portal-active-toggle">
                          <input
                            type="checkbox"
                            checked={Boolean(user.active)}
                            disabled={isSelf}
                            onChange={(e) =>
                              updateCompanyUserLocal(user.id, {
                                active: e.target.checked,
                              })
                            }
                          />
                          <span>Account Active</span>
                        </label>
                      </div>

                      {user.role === "job_site" ? (
                        <div className="portal-job-access-box">
                          <div className="portal-label">Project Access</div>
                          <div className="portal-job-access-grid">
                            {jobs.map((job) => {
                              const token = job.job_portal_token;
                              const checked = (user.job_portal_tokens || []).includes(token);
                              return (
                                <label
                                  key={`${user.id}-${token}`}
                                  className={`portal-job-access-option ${
                                    checked ? "portal-job-access-option-selected" : ""
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => toggleExistingUserJob(user.id, token)}
                                  />
                                  <span>
                                    <strong>
                                      {job.project_name || job.address || "Project"}
                                    </strong>
                                    <small>Order #{job.order_number || "-"}</small>
                                  </span>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      ) : (
                        <div className="portal-access-note">
                          Full company access to all projects and portal files.
                        </div>
                      )}

                      <div className="customer-portal-actions" style={{ marginTop: 14 }}>
                        <button
                          className="portal-btn portal-btn-navy"
                          type="button"
                          disabled={savingCompanyUser}
                          onClick={() => saveCompanyUser(user)}
                        >
                          Save User
                        </button>

                        <button
                          className="portal-btn portal-btn-light"
                          type="button"
                          onClick={() => sendCompanyUserPasswordReset(user)}
                        >
                          Send Password Reset
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
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
            <div className="project-card-grid">
              {filteredJobs.map((job) => (
                <ProjectCard
                  key={job.job_portal_token || job.portal_job_key}
                  job={job}
                />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
