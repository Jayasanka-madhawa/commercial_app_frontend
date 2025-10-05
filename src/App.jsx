import { useEffect, useState } from "react";

const cleanUrl = (s) => s.trim().replace(/^['"]|['"]$/g, "").replace(/\/+$/g, "");


async function api({ baseUrl, path, method = "GET", body, token }) {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}: ${await res.text()}`);
  return res.json();
}

export default function App() {
  const [baseUrl, setBaseUrl] = useState(() => cleanUrl(localStorage.getItem("baseUrl") || "http://127.0.0.1:8004"));
  const [email, setEmail] = useState("jayasanka013@gmail.com");
  const [password, setPassword] = useState("pass123");
  const [token, setToken] = useState(localStorage.getItem("token") || "");
  const [me, setMe] = useState(null);
  const [flash, setFlash] = useState("");

  useEffect(() => localStorage.setItem("baseUrl", baseUrl), [baseUrl]);
  useEffect(() => localStorage.setItem("token", token), [token]);



  async function check() {
    try { await api({ baseUrl, path: "/healthz" }); setFlash("API OK ✅"); }
    catch (e) { setFlash(e.message); }
  }

  async function register() {
    try { await api({ baseUrl, path: "/auth/register", method: "POST", body: { email, password } }); setFlash("Registered! Now login."); }
    catch (e) { setFlash(e.message); }
  }

  async function login() {
    try {
      const out = await api({ baseUrl, path: "/auth/login", method: "POST", body: { email, password } });
      setToken(out.access_token);
      await fetchMe(out.access_token);                // use fresh token immediately
      setFlash("Logged in ✔");
    } catch (e) { setFlash(e.message); }
  }

  async function fetchMe(tok) {
    try { const m = await api({ baseUrl, path: "/me", token: tok ?? token }); setMe(m); }
    catch (e) { setMe(null); setToken(""); setFlash(`Auth expired? ${e.message}`); }
  }

  function logout() { setToken(""); setMe(null); setFlash("Logged out"); }

  return (
    <div style={{ padding: 16, fontFamily: "system-ui, sans-serif" }}>
      <h1>🛍️ Clothing UI</h1>

      <div style={{ display: "flex", gap: 8, margin: "12px 0" }}>
        <input value={baseUrl} onChange={(e)=>setBaseUrl(e.target.value)} style={{ padding: 8, width: 340 }}/>
        <button onClick={check} style={{ padding: "8px 12px" }}>Check API</button>
      </div>

      <h2>Auth</h2>
      <div style={{ display:"flex", gap:8, margin:"8px 0", flexWrap:"wrap" }}>
        <input placeholder="email" value={email} onChange={(e)=>setEmail(e.target.value)} style={{ padding:8, width:260 }}/>
        <input placeholder="password" type="password" value={password}   
        onChange={(e) => { const v = cleanUrl(e.target.value);
            setBaseUrl(v);
            localStorage.setItem("baseUrl", v);}} style={{ padding:8, width:160 }}/>
        <button onClick={register}>Register</button>
        <button onClick={login}>Login</button>
        <button onClick={logout}>Logout</button>
        <button onClick={()=>fetchMe()}>/me</button>
      </div>

      <div style={{ marginTop:8 }}>
        {token ? <div>Token: <code>{token.slice(0,24)}…</code></div> : <div>No token</div>}
        <div>Me: <pre style={{ background:"#111", color:"#eee", padding:8, borderRadius:8 }}>{JSON.stringify(me, null, 2)}</pre></div>
      </div>

      <div style={{ marginTop:12, color:"#0ea5e9" }}>{flash}</div>
    </div>
  );
}

