import { useMemo } from "react";
import { useParams } from "react-router-dom";

const CURRENT_VERSION = "2026-08-field-test";

const TERM_VERSIONS = {
  [CURRENT_VERSION]: {
    label: "Field Test - August 2026",
    effective: "August 2026",
    status: "field-test",
  },
};

export default function DeliveryTermsPage() {
  const { version } = useParams();

  const selected = useMemo(() => {
    const requested = String(version || CURRENT_VERSION).trim();
    return {
      version: TERM_VERSIONS[requested] ? requested : CURRENT_VERSION,
      ...TERM_VERSIONS[requested || CURRENT_VERSION],
    };
  }, [version]);

  return (
    <main style={styles.page}>
      <section style={styles.shell}>
        <header style={styles.header}>
          <div>
            <div style={styles.brand}>BIG TOWN CONCRETE</div>
            <h1 style={styles.title}>Delivery Terms & Conditions</h1>
            <p style={styles.subtitle}>
              Digital eTicket reference for ready-mix concrete deliveries.
            </p>
          </div>

          <div style={styles.versionCard}>
            <div style={styles.versionLabel}>VERSION</div>
            <div style={styles.versionValue}>{selected.version}</div>
            <div style={styles.versionMeta}>Effective: {selected.effective}</div>
          </div>
        </header>

        <div style={styles.notice}>
          <strong>Field test notice:</strong> This page is being used to validate
          BTC's digital eTicket workflow. Existing executed contracts, quotes,
          credit agreements, purchase orders, project specifications, and other
          written agreements remain controlling. Final production terms should
          be approved by company management/legal counsel before broader rollout.
        </div>

        <section style={styles.section}>
          <h2 style={styles.heading}>1. Digital Delivery Record</h2>
          <p style={styles.body}>
            The BTC eTicket is an electronic delivery record. It may include the
            ticket number, customer and project information, mix information,
            delivered quantity, batch weights, water information, delivery
            timestamps, weather information, and signatures captured during the
            delivery process.
          </p>
        </section>

        <section style={styles.section}>
          <h2 style={styles.heading}>2. Delivery Acceptance or Rejection</h2>
          <p style={styles.body}>
            The final eTicket records the delivery status selected at signature
            time, including whether the delivery was accepted or rejected and
            the signer type recorded by the system. Project-specific contractual
            rights and obligations remain governed by the applicable written
            agreements and project documents.
          </p>
        </section>

        <section style={styles.section}>
          <h2 style={styles.heading}>3. Water and Delivery Adjustments</h2>
          <p style={styles.body}>
            Water additions and other delivery adjustments captured by BTCFleet
            are recorded on the eTicket when available. The eTicket should be
            reviewed together with the applicable mix design, project
            specifications, testing requirements, and other project records.
          </p>
        </section>

        <section style={styles.section}>
          <h2 style={styles.heading}>4. Job Site and Safety Information</h2>
          <p style={styles.body}>
            Delivery activity takes place under active job-site conditions.
            Site-specific safety rules, access requirements, placement
            instructions, and project requirements continue to apply regardless
            of whether the delivery record is electronic or paper.
          </p>
        </section>

        <section style={styles.section}>
          <h2 style={styles.heading}>5. Project Specifications and Testing</h2>
          <p style={styles.body}>
            Mix descriptions, slump, air, strength, batch information, and other
            values shown on an eTicket are delivery records. Approved project
            specifications, mix submittals, test reports, and governing contract
            documents remain the controlling project references.
          </p>
        </section>

        <section style={styles.section}>
          <h2 style={styles.heading}>6. Electronic Records</h2>
          <p style={styles.body}>
            BTCFleet stores electronic delivery records and may capture
            signatures, timestamps, location data, and internal verification
            information as part of the delivery workflow. Customer-facing final
            eTickets contain the delivery signatures and applicable ticket data.
          </p>
        </section>

        <section style={styles.contact}>
          <h2 style={styles.heading}>Questions About a Delivery?</h2>
          <p style={styles.body}>
            Contact Big Town Concrete using the contact information provided on
            your quote, order, account documents, or project communications.
          </p>
        </section>

        <footer style={styles.footer}>
          Big Town Concrete - Digital eTicket Terms Reference - {selected.label}
        </footer>
      </section>
    </main>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "#f3f6fa",
    color: "#10243b",
    padding: "32px 16px",
    fontFamily: "Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
  shell: {
    width: "100%",
    maxWidth: 980,
    margin: "0 auto",
    background: "#ffffff",
    border: "1px solid #d8e1ec",
    borderRadius: 18,
    boxShadow: "0 16px 40px rgba(16, 36, 59, 0.08)",
    overflow: "hidden",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    gap: 24,
    alignItems: "flex-start",
    flexWrap: "wrap",
    padding: "34px 36px",
    background: "#102f4f",
    color: "#ffffff",
    borderTop: "5px solid #ff7318",
  },
  brand: {
    color: "#ff8a3d",
    fontWeight: 950,
    fontSize: 13,
    letterSpacing: 1.8,
  },
  title: {
    margin: "8px 0 6px",
    fontSize: "clamp(30px, 5vw, 46px)",
    lineHeight: 1.05,
  },
  subtitle: {
    margin: 0,
    color: "#d5e3f3",
    fontWeight: 650,
  },
  versionCard: {
    minWidth: 220,
    border: "1px solid rgba(255,255,255,0.22)",
    borderRadius: 14,
    padding: "14px 16px",
    background: "rgba(255,255,255,0.06)",
  },
  versionLabel: {
    fontSize: 11,
    fontWeight: 900,
    letterSpacing: 1.2,
    color: "#a9c6e3",
  },
  versionValue: {
    marginTop: 5,
    fontWeight: 900,
    fontSize: 17,
  },
  versionMeta: {
    marginTop: 5,
    color: "#d5e3f3",
    fontSize: 13,
  },
  notice: {
    margin: "28px 36px 8px",
    padding: "16px 18px",
    border: "1px solid #f2c08e",
    borderLeft: "5px solid #ff7318",
    borderRadius: 12,
    background: "#fff8f1",
    lineHeight: 1.6,
  },
  section: {
    padding: "20px 36px",
    borderBottom: "1px solid #e7edf4",
  },
  contact: {
    margin: "26px 36px",
    padding: 20,
    borderRadius: 14,
    background: "#eef5fb",
    border: "1px solid #cfdeec",
  },
  heading: {
    margin: "0 0 8px",
    fontSize: 19,
    color: "#102f4f",
  },
  body: {
    margin: 0,
    lineHeight: 1.7,
    color: "#40556b",
    fontSize: 15,
  },
  footer: {
    padding: "18px 36px 24px",
    color: "#66788a",
    textAlign: "center",
    fontSize: 12,
    fontWeight: 700,
  },
};
