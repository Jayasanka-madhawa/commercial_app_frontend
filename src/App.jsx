import { useEffect, useState } from "react";

const cleanUrl = (s) => s.trim().replace(/^['"]|['"]$/g, "").replace(/\/+$/g, "");
const formatCents = (c) => (c/100).toFixed(2);

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
  const ct = res.headers.get("content-type") || "";
  return ct.includes("application/json") ? res.json() : res.text();
}

export default function App() {
  // ---- Config / auth ----
  const [baseUrl, setBaseUrl] = useState(() =>
    cleanUrl(localStorage.getItem("baseUrl") || "http://127.0.0.1:8004")
  );
  const [email, setEmail] = useState("jayasanka013@gmail.com");
  const [password, setPassword] = useState("pass123");
  const [token, setToken] = useState(localStorage.getItem("token") || "");
  const [me, setMe] = useState(null);
  const [flash, setFlash] = useState("");

  useEffect(() => localStorage.setItem("baseUrl", baseUrl), [baseUrl]);
  useEffect(() => localStorage.setItem("token", token), [token]);

  // ---- Catalog ----
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [newCat, setNewCat] = useState({ name: "Tees", slug: "tees" });
  const [newProd, setNewProd] = useState({
    name: "Classic Tee",
    price_cents: 1999,
    category_id: "",
    inventory: 5,
  });

  // ---- Cart & Orders ----
  const [cart, setCart] = useState([]); // [{product, qty}]
  const [orders, setOrders] = useState([]);

  const isAdmin = me?.role === "admin";
  const cartTotalCents = cart.reduce((sum, it) => sum + it.product.price_cents * it.qty, 0);

  // load lists whenever baseUrl changes
  useEffect(() => { loadCats(); loadProds(); }, [baseUrl]);

  // ---------- API helpers ----------
  async function check() {
    try { await api({ baseUrl, path: "/healthz" }); setFlash("API OK ✅"); }
    catch (e) { setFlash(e.message); }
  }

  async function register() {
    try {
      await api({ baseUrl, path: "/auth/register", method: "POST", body: { email, password } });
      setFlash("Registered! Now login.");
    } catch (e) { setFlash(e.message); }
  }

  async function login() {
    try {
      const out = await api({ baseUrl, path: "/auth/login", method: "POST", body: { email, password } });
      setToken(out.access_token);
      await fetchMe(out.access_token); // use fresh token right away
      setFlash("Logged in ✔");
    } catch (e) { setFlash(e.message); }
  }

  async function fetchMe(tok) {
    try {
      const m = await api({ baseUrl, path: "/me", token: tok ?? token });
      setMe(m);
    } catch (e) {
      setMe(null); setToken(""); setFlash(`Auth expired? ${e.message}`);
    }
  }

  function logout() {
    setToken(""); setMe(null); setFlash("Logged out");
    setOrders([]); setCart([]);
  }

  async function loadCats() {
    try { setCategories(await api({ baseUrl, path: "/categories" })); }
    catch (e) { setFlash(e.message); }
  }

  async function loadProds() {
    try { setProducts(await api({ baseUrl, path: "/products" })); }
    catch (e) { setFlash(e.message); }
  }

  async function createCategory() {
    try {
      const c = await api({ baseUrl, path: "/categories", method: "POST", body: newCat, token });
      setCategories([c, ...categories]);
      setFlash("Category created");
    } catch (e) { setFlash(e.message); }
  }

  async function createProduct() {
    try {
      const body = {
        ...newProd,
        price_cents: Number(newProd.price_cents),
        inventory: Number(newProd.inventory) || 0,
        category_id: newProd.category_id || null,
      };
      const p = await api({ baseUrl, path: "/products", method: "POST", body, token });
      setProducts([p, ...products]);
      setFlash("Product created");
    } catch (e) { setFlash(e.message); }
  }

  // ---------- Cart ----------
  function addToCart(p) {
    setCart((prev) => {
      const i = prev.findIndex((x) => x.product.id === p.id);
      if (i >= 0) {
        const copy = [...prev];
        copy[i] = { ...copy[i], qty: copy[i].qty + 1 };
        return copy;
      }
      return [...prev, { product: p, qty: 1 }];
    });
  }
  function inc(id) {
    setCart((prev) => prev.map((it) => it.product.id === id ? { ...it, qty: it.qty + 1 } : it));
  }
  function dec(id) {
    setCart((prev) =>
      prev
        .map((it) => it.product.id === id ? { ...it, qty: it.qty - 1 } : it)
        .filter((it) => it.qty > 0)
    );
  }
  function clearCart() { setCart([]); }

  // ---------- Orders ----------
  async function checkout() {
    if (!token) { setFlash("Login first to checkout."); return; }
    if (cart.length === 0) { setFlash("Cart is empty."); return; }
    try {
      const items = cart.map((it) => ({ product_id: it.product.id, qty: it.qty }));
      const out = await api({ baseUrl, path: "/orders", method: "POST", body: { items }, token });
      setFlash(`Order placed ✔ Total $${formatCents(out.total_cents)} (status ${out.status})`);
      setOrders((prev) => [out, ...prev]);
      clearCart();
      // reload products to show reduced inventory
      await loadProds();
    } catch (e) { setFlash(e.message); }
  }

  async function loadMyOrders() {
    try {
      const list = await api({ baseUrl, path: "/orders", token });
      setOrders(list);
      setFlash(`Loaded ${list.length} orders`);
    } catch (e) { setFlash(e.message); }
  }

  // ---------- UI ----------
  return (
    <div style={{ padding: 16, fontFamily: "system-ui, sans-serif", color:"#e5e7eb", background:"#0b0b0f", minHeight:"100vh" }}>
      <h1>🛍️ Clothing Admin & Shop</h1>

      {/* Base URL */}
      <div style={{ display: "flex", gap: 8, margin: "12px 0" }}>
        <input
          value={baseUrl}
          onChange={(e) => {
            const v = cleanUrl(e.target.value);
            setBaseUrl(v);
            localStorage.setItem("baseUrl", v);
          }}
          style={{ padding: 8, width: 360, background:"#0e1117", color:"#e5e7eb", border:"1px solid #232736", borderRadius:10 }}
          placeholder="API base URL"
        />
        <button onClick={check} style={{ padding: "8px 12px" }}>Check API</button>
      </div>

      {/* Auth */}
      <h2>Auth</h2>
      <div style={{ display:"flex", gap:8, margin:"8px 0", flexWrap:"wrap" }}>
        <input placeholder="email" value={email} onChange={(e)=>setEmail(e.target.value)} style={{ padding:8, width:260 }}/>
        <input placeholder="password" type="password" value={password} onChange={(e)=>setPassword(e.target.value)} style={{ padding:8, width:160 }}/>
        <button onClick={register}>Register</button>
        <button onClick={login}>Login</button>
        <button onClick={logout}>Logout</button>
        <button onClick={()=>fetchMe()}>/me</button>
        <button onClick={loadMyOrders} disabled={!token} title={token ? "" : "Login first"}>Load my orders</button>
        <div>{me ? <>Logged as <b>{me.email}</b> ({me.role})</> : "Not logged in"}</div>
      </div>

      {/* Categories */}
      <h2 style={{ marginTop: 12 }}>Categories</h2>
      <div style={{ display:"flex", gap:8, marginBottom:8, flexWrap:"wrap" }}>
        <input value={newCat.name} onChange={(e)=>setNewCat({...newCat, name:e.target.value})} placeholder="name" style={{ padding:8 }}/>
        <input value={newCat.slug} onChange={(e)=>setNewCat({...newCat, slug:e.target.value})} placeholder="slug" style={{ padding:8 }}/>
        <button disabled={!isAdmin} onClick={createCategory} title={isAdmin ? "" : "Admin only"}>Add</button>
      </div>
      <ul>
        {categories.map(c => (
          <li key={c.id}>
            {c.name} <small style={{color:"#9aa2b1"}}>({c.slug})</small>
          </li>
        ))}
      </ul>

      {/* Products */}
      <h2 style={{ marginTop: 16 }}>Products</h2>
      <div style={{ display:"flex", gap:8, marginBottom:8, flexWrap:"wrap" }}>
        <input value={newProd.name} onChange={(e)=>setNewProd({...newProd, name:e.target.value})} placeholder="name" style={{ padding:8 }}/>
        <input value={newProd.price_cents} onChange={(e)=>setNewProd({...newProd, price_cents:e.target.value})} placeholder="price (cents)" style={{ padding:8, width:140 }}/>
        <select value={newProd.category_id} onChange={(e)=>setNewProd({...newProd, category_id:e.target.value})} style={{ padding:8 }}>
          <option value="">(no category)</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <input value={newProd.inventory} onChange={(e)=>setNewProd({...newProd, inventory:e.target.value})} placeholder="inventory" style={{ padding:8, width:120 }}/>
        <button disabled={!isAdmin} onClick={createProduct} title={isAdmin ? "" : "Admin only"}>Add</button>
      </div>
      <ul>
        {products.map(p => (
          <li key={p.id} style={{ display:"flex", gap:8, alignItems:"center", marginBottom:6 }}>
            <span>{p.name} — ${formatCents(p.price_cents)} <small style={{color:"#9aa2b1"}}>inv {p.inventory}{p.category_id ? "" : " (no category)"}</small></span>
            <button onClick={()=>addToCart(p)} disabled={p.inventory <= 0} title={p.inventory>0 ? "" : "Out of stock"}>Add</button>
          </li>
        ))}
      </ul>

      {/* Cart */}
      <h2 style={{ marginTop: 16 }}>Cart</h2>
      <div>
        {cart.length === 0 ? (
          <div>Cart is empty</div>
        ) : (
          <ul>
            {cart.map(it => (
              <li key={it.product.id} style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6 }}>
                <span>{it.product.name} — ${formatCents(it.product.price_cents)} × {it.qty}</span>
                <button onClick={()=>dec(it.product.id)}>-</button>
                <button onClick={()=>inc(it.product.id)}>+</button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div style={{ display:"flex", gap:8, alignItems:"center", marginTop:8 }}>
        <div><b>Total:</b> ${formatCents(cartTotalCents)}</div>
        <button onClick={clearCart}>Clear</button>
        <button onClick={checkout} disabled={!token || cart.length===0} title={token ? "" : "Login first"}>Checkout</button>
      </div>

      {/* Orders */}
      <h2 style={{ marginTop: 16 }}>My Orders</h2>
      {orders.length === 0 ? (
        <div>No orders yet</div>
      ) : (
        <ul>
          {orders.map(o => (
            <li key={o.id} style={{ marginBottom:10 }}>
              <div><b>Order</b> {o.id} • ${formatCents(o.total_cents)} • {o.status} • {new Date(o.created_at).toLocaleString()}</div>
              <ul style={{ marginLeft:14 }}>
                {o.items.map((it, idx) => (
                  <li key={idx}>{it.name} × {it.qty} — ${formatCents(it.price_cents)}</li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}

      {/* Status */}
      <div style={{ marginTop:12, color:"#0ea5e9" }}>{flash}</div>
    </div>
  );
}

