import { useState } from "react";

export default function App() {
  const [baseUrl, setBaseUrl] = useState(
    localStorage.getItem("baseUrl") || "http://127.0.0.1:8004"
  );
  const [status, setStatus] = useState("");

  async function check() {
    try {
      const r = await fetch(`${baseUrl}/healthz`);
      setStatus(r.ok ? "API OK ✅" : `HTTP ${r.status}`);
      localStorage.setItem("baseUrl", baseUrl);
    } catch (e) {
      setStatus(`Error: ${e.message}`);
    }
  }

  return (
    <div style={{ padding: 16, fontFamily: "system-ui, sans-serif" }}>
      <h1>🛍️ Clothing UI</h1>
      <div style={{ display: "flex", gap: 8, margin: "12px 0" }}>
        <input
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.target.value)}
          style={{ padding: 8, width: 340 }}
          placeholder="API base URL"
        />
        <button onClick={check} style={{ padding: "8px 12px" }}>Check API</button>
      </div>
      <div>{status}</div>
    </div>
  );
}
