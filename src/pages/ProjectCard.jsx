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

function getProgress(job) {
  const orderTotal = Number(job.order_total || 0);
  const delivered = Number(job.delivered_total || 0);

  if (orderTotal <= 0) return 0;

  return Math.max(0, Math.min(100, (delivered / orderTotal) * 100));
}

export default function ProjectCard({ job }) {
  const isComplete = String(job.status || "").toLowerCase() === "complete";
  const progress = getProgress(job);

  return (
    <article className="project-card">
      <div className="project-card-top">
        <div>
          <div className="project-order">Order #{job.order_number || "-"}</div>
          <div className="project-address">{job.address || "-"}</div>
        </div>

        <span
          className={
            isComplete
              ? "portal-status-pill portal-status-delivered"
              : "portal-status-pill portal-status-active"
          }
        >
          {isComplete ? "Complete" : "In Progress"}
        </span>
      </div>

      <div className="project-progress-block">
        <div className="project-progress-header">
          <span>Progress</span>
          <strong>{progress.toFixed(0)}%</strong>
        </div>

        <div className="portal-progress-track">
          <div
            className={`portal-progress-fill ${isComplete ? "complete" : ""}`}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="project-metrics">
        <div>
          <span>Tickets</span>
          <strong>{job.ticket_count || 0}</strong>
        </div>

        <div>
          <span>Delivered</span>
          <strong>{formatCys(job.delivered_total)}</strong>
        </div>

        <div>
          <span>Remaining</span>
          <strong>{formatCys(job.remaining_total)}</strong>
        </div>

        <div>
          <span>Latest Load</span>
          <strong>{formatDate(job.latest_load_time)}</strong>
        </div>
      </div>

      <div className="project-card-actions">
        <button
          className="portal-btn portal-btn-navy project-open-btn"
          type="button"
          onClick={() => {
            window.location.href = `/customer/jobs/${job.job_portal_token}`;
          }}
        >
          Open Project ?
        </button>
      </div>
    </article>
  );
}
