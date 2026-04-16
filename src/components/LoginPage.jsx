import { useState } from "react";

const API_BASE = "https://fleet.btcfleet.app";

export default function LoginPage({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  async function submit(e) {
    e.preventDefault();
    setMessage("");

    try {
      const res = await fetch(`${API_BASE}/admin/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username,
          password,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setMessage(data.detail || "Login failed");
        return;
      }

      onLogin(data);
    } catch {
      setMessage("Could not reach server");
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-title">BTC Fleet Admin Login</div>

        <form onSubmit={submit} className="login-form">
          <label>Username</label>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="adam.coronado"
          />

          <label>Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
          />

          <button type="submit" className="primary-btn">
            Sign In
          </button>
        </form>

        {message && <div className="message-box">{message}</div>}

        <div className="login-help">
          Default seeded admins:
          <br />
          adam.coronado
          <br />
          todd.lewis
          <br />
          mickey.schoenhals
          <br />
          Default password in backend seed: <strong>ChangeMe123!</strong>
        </div>
      </div>
    </div>
  );
}