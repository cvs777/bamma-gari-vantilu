import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { createClient } from '@supabase/supabase-js';
import { QRCodeCanvas } from 'qrcode.react';
import './styles.css';

const CONFIG = {
  name: 'Bamma Gari Vantilu',
  tagline: 'Traditional • Homely • Delicious',
  reviewUrl: 'https://maps.app.goo.gl/GTCU6VeZavhzYzjWA',
  // Replace with the restaurant's real UPI ID before using payment in production.
  upiId: localStorage.getItem('bgv_upi_id') || 'YOUR_UPI_ID@bank',
  upiName: 'Bamma Gari Vantilu',
  demoTableCount: 10,
  currency: 'INR'
};

const sampleMenu = [
  { id: 'm1', name: 'Meals', category: 'Meals', price: 120, description: 'Homestyle Andhra meal' },
  { id: 'm2', name: 'Veg Biryani', category: 'Rice', price: 160, description: 'Aromatic rice with vegetables' },
  { id: 'm3', name: 'Chicken Biryani', category: 'Biryani', price: 240, description: 'House-style chicken biryani' },
  { id: 'm4', name: 'Chicken 65', category: 'Starters', price: 220, description: 'Crispy spicy chicken' },
  { id: 'm5', name: 'Paneer 65', category: 'Starters', price: 180, description: 'Crispy paneer starter' },
  { id: 'm6', name: 'Dal Fry', category: 'Curries', price: 130, description: 'Comforting dal with tempering' },
  { id: 'm7', name: 'Curd Rice', category: 'Rice', price: 80, description: 'Cooling curd rice' },
  { id: 'm8', name: 'Soft Drink', category: 'Beverages', price: 40, description: 'Chilled beverage' }
];

const fallbackTables = Array.from({ length: CONFIG.demoTableCount }, (_, i) => ({
  id: `table-${i + 1}`,
  table_number: i + 1,
  active: true
}));

const fallbackBills = {};

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnon = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = supabaseUrl && supabaseAnon ? createClient(supabaseUrl, supabaseAnon) : null;

function money(value) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: CONFIG.currency, maximumFractionDigits: 0 }).format(Number(value || 0));
}

function getStored(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function setStored(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function createId(prefix = 'id') {
  return `${prefix}-${crypto.randomUUID()}`;
}

function buildUpiUrl(amount, billId) {
  const params = new URLSearchParams({
    pa: CONFIG.upiId,
    pn: CONFIG.upiName,
    am: Number(amount).toFixed(2),
    cu: 'INR',
    tn: `Bill ${billId}`
  });
  return `upi://pay?${params.toString()}`;
}

async function getTables() {
  if (supabase) {
    const { data, error } = await supabase.from('tables').select('*').order('table_number');
    if (!error && data) return data;
  }
  return fallbackTables;
}

async function getMenu() {
  if (supabase) {
    const { data, error } = await supabase.from('menu_items').select('*').eq('available', true).order('category').order('name');
    if (!error && data?.length) return data;
  }
  return sampleMenu;
}

async function getActiveBill(tableNumber) {
  if (supabase) {
    const { data: table } = await supabase.from('tables').select('id, table_number').eq('table_number', Number(tableNumber)).single();
    if (table) {
      const { data: bill } = await supabase.from('bills').select('*').eq('table_id', table.id).eq('status', 'OPEN').order('created_at', { ascending: false }).limit(1).maybeSingle();
      if (bill) {
        const { data: items } = await supabase.from('bill_items').select('*').eq('bill_id', bill.id).order('created_at');
        return { ...bill, items: items || [] };
      }
    }
  }
  const local = getStored('bgv_bills', fallbackBills);
  return local[tableNumber] || null;
}

async function saveBill(tableNumber, orderItems) {
  const subtotal = orderItems.reduce((sum, item) => sum + Number(item.price) * Number(item.quantity), 0);
  const localId = createId('bill');
  const localBill = {
    id: localId,
    table_number: Number(tableNumber),
    subtotal,
    discount: 0,
    total: subtotal,
    status: 'OPEN',
    reward: null,
    items: orderItems.map(item => ({ id: createId('bi'), bill_id: id, item_name: item.name, quantity: item.quantity, price: item.price }))
  };

  if (supabase) {
    const { data: table } = await supabase.from('tables').select('id').eq('table_number', Number(tableNumber)).single();
    if (table) {
      const { data: bill, error } = await supabase.from('bills').insert({ table_id: table.id, subtotal, discount: 0, total: subtotal, status: 'OPEN' }).select().single();
      if (!error && bill) {
        await supabase.from('bill_items').insert(localBill.items.map(item => ({ bill_id: bill.id, item_name: item.item_name, quantity: item.quantity, price: item.price })));
        return await getActiveBill(tableNumber);
      }
    }
  }

  const bills = getStored('bgv_bills', fallbackBills);
  bills[Number(tableNumber)] = localBill;
  setStored('bgv_bills', bills);
  return localBill;
}

async function updateBill(bill, patch) {
  const updated = { ...bill, ...patch };
  if (supabase) {
    const { error } = await supabase.from('bills').update({ discount: updated.discount, total: updated.total, reward_type: updated.reward?.type || null, reward_value: updated.reward?.value || 0, reward_revealed: Boolean(updated.reward) }).eq('id', bill.id);
    if (!error) return updated;
  }
  const bills = getStored('bgv_bills', fallbackBills);
  bills[Number(bill.table_number)] = updated;
  setStored('bgv_bills', bills);
  return updated;
}

function AppShell({ children, tableNumber, activeTab, bill }) {
  const navigate = useNavigate();
  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <div className="brand">{CONFIG.name}</div>
          <div className="tagline">{CONFIG.tagline}</div>
        </div>
        <div className="table-pill">Table {tableNumber || '—'}</div>
      </header>
      <nav className="tabs">
        <button className={activeTab === 'menu' ? 'tab active' : 'tab'} onClick={() => navigate(`/table/${tableNumber}`)}>🍽️ Menu</button>
        <button className={activeTab === 'bill' ? 'tab active' : 'tab'} onClick={() => navigate(`/table/${tableNumber}/bill`)}>🧾 Bill {bill ? <span className="tab-badge">{money(bill.total)}</span> : null}</button>
      </nav>
      <main className="content">{children}</main>
      <footer className="footer">Made for Bamma Gari Vantilu • Honest reviews • Easy UPI payment</footer>
    </div>
  );
}

function CustomerPage({ tableNumber, initialTab = 'menu' }) {
  const [menu, setMenu] = useState([]);
  const [bill, setBill] = useState(null);
  const [cart, setCart] = useState({});
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const [reviewPromptOpen, setReviewPromptOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    Promise.all([getMenu(), getActiveBill(tableNumber)]).then(([m, b]) => {
      if (!alive) return;
      setMenu(m); setBill(b); setLoading(false);
    });
    return () => { alive = false; };
  }, [tableNumber]);

  const cartItems = useMemo(() => menu.filter(item => cart[item.id]).map(item => ({ ...item, quantity: cart[item.id] })), [menu, cart]);
  const cartTotal = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

  function add(item) {
    setCart(c => ({ ...c, [item.id]: (c[item.id] || 0) + 1 }));
  }

  function remove(item) {
    setCart(c => {
      const next = { ...c };
      const count = (next[item.id] || 0) - 1;
      if (count <= 0) delete next[item.id]; else next[item.id] = count;
      return next;
    });
  }

  async function createBill() {
    if (!cartItems.length) return;
    const created = await saveBill(tableNumber, cartItems);
    setBill(created);
    setCart({});
    setReviewPromptOpen(true);
  }

  async function loadBill() {
    const b = await getActiveBill(tableNumber);
    setBill(b);
    return b;
  }

  if (loading) return <AppShell tableNumber={tableNumber} activeTab={initialTab}><div className="card center">Loading…</div></AppShell>;

  if (initialTab === 'bill') {
    return <BillTab bill={bill} tableNumber={tableNumber} onRefresh={loadBill} onAskReview={() => setReviewPromptOpen(true)} />;
  }

  return (
    <AppShell tableNumber={tableNumber} activeTab="menu" bill={bill}>
      <section className="hero-card">
        <div>
          <div className="eyebrow">WELCOME</div>
          <h1>Home-style food, served with love ❤️</h1>
          <p>Browse the menu below. When you're ready, create your bill and pay from your phone.</p>
        </div>
        <div className="hero-badge">Bamma's Kitchen</div>
      </section>

      <div className="section-header"><div><h2>Today's Menu</h2><p>Tap + to add items</p></div></div>
      <div className="menu-grid">
        {menu.map(item => (
          <div className="menu-card" key={item.id}>
            <div className="menu-icon">🍛</div>
            <div className="menu-main">
              <div className="menu-name">{item.name}</div>
              <div className="menu-desc">{item.description}</div>
              <div className="menu-price">{money(item.price)}</div>
            </div>
            <div className="qty-control">
              <button onClick={() => remove(item)} aria-label={`Remove ${item.name}`}>−</button>
              <span>{cart[item.id] || 0}</span>
              <button onClick={() => add(item)} aria-label={`Add ${item.name}`}>+</button>
            </div>
          </div>
        ))}
      </div>

      <div className="sticky-checkout">
        <div><span>{cartItems.length} items</span><strong>{money(cartTotal)}</strong></div>
        <button className="primary-btn" disabled={!cartItems.length} onClick={createBill}>Create Bill &nbsp;→</button>
      </div>

      {reviewPromptOpen ? (
        <ReviewModal onClose={() => setReviewPromptOpen(false)} onReview={() => window.open(CONFIG.reviewUrl, '_blank', 'noopener,noreferrer')} onContinue={() => { setReviewPromptOpen(false); navigate(`/table/${tableNumber}/bill`); }} />
      ) : null}
    </AppShell>
  );
}

function ReviewModal({ onReview, onContinue }) {
  return (
    <div className="modal-backdrop">
      <div className="modal-card">
        <div className="modal-emoji">❤️</div>
        <h2>How was your experience?</h2>
        <p>If you have a moment, please share an <strong>honest</strong> review on Google. Your feedback helps our small restaurant.</p>
        <button className="google-btn" onClick={onReview}>⭐ Open Google & leave an honest review</button>
        <p className="modal-hint">Google will open in a new tab. Come back here when you're done.</p>
        <button className="secondary-btn" onClick={onContinue}>Continue to bill</button>
      </div>
    </div>
  );
}

function BillTab({ bill, tableNumber, onRefresh, onAskReview }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  useEffect(() => { onRefresh(); }, []);

  if (!bill) {
    return <AppShell tableNumber={tableNumber} activeTab="bill" bill={null}><div className="card center"><div className="big-emoji">🧾</div><h2>No bill yet</h2><p>Add food from the Menu tab and create a bill.</p><button className="primary-btn" onClick={() => navigate(`/table/${tableNumber}`)}>Back to menu</button></div></AppShell>;
  }

  function pay() {
    if (CONFIG.upiId.includes('YOUR_UPI_ID')) {
      alert('Set the restaurant UPI ID in src/main.jsx before using UPI payment.');
      return;
    }
    window.location.href = buildUpiUrl(bill.total, bill.id);
  }

  return (
    <AppShell tableNumber={tableNumber} activeTab="bill" bill={bill}>
      <section className="card bill-card">
        <div className="section-header"><div><div className="eyebrow">BILL</div><h1>Bill #{String(bill.id).slice(-6).toUpperCase()}</h1></div><span className="status-pill">OPEN</span></div>
        <div className="bill-items">
          {(bill.items || []).map(item => <div className="bill-row" key={item.id}><span>{item.item_name || item.name} × {item.quantity}</span><strong>{money(Number(item.price) * Number(item.quantity))}</strong></div>)}
        </div>
        <div className="totals">
          <div><span>Subtotal</span><strong>{money(bill.subtotal)}</strong></div>
          <div className="discount-row"><span>Reward discount</span><strong>-{money(bill.discount || 0)}</strong></div>
          <div className="grand-total"><span>Total</span><strong>{money(bill.total)}</strong></div>
        </div>
        <button className="secondary-btn review-link" onClick={onAskReview}>❤️ Leave an honest Google review</button>
      </section>

      <ScratchCard bill={bill} onUpdated={async (updated) => { setLoading(true); await onRefresh(); setLoading(false); }} />

      <section className="payment-card">
        <div><div className="eyebrow">PAYMENT</div><h2>Pay {money(bill.total)}</h2><p>Choose your preferred UPI app. The amount is pre-filled.</p></div>
        <div className="payment-actions">
          <button className="upi-btn" onClick={pay}>📲 Pay by UPI</button>
          {CONFIG.upiId.includes('YOUR_UPI_ID') ? <div className="config-warning">Set the restaurant UPI ID before using real payments.</div> : <> <div className="qr-payment"><QRCodeCanvas value={buildUpiUrl(bill.total, bill.id)} size={170} includeMargin /></div><small>Scan the UPI QR if the button doesn't open an app.</small></>}
        </div>
        {loading && <div className="muted">Updating bill…</div>}
      </section>
    </AppShell>
  );
}

function ScratchCard({ bill, onUpdated }) {
  const [revealed, setRevealed] = useState(Boolean(bill.reward));
  const rewards = [
    { label: '₹20 OFF', type: 'flat', value: 20 },
    { label: '₹50 OFF', type: 'flat', value: 50 },
    { label: '₹100 OFF', type: 'flat', value: 100 },
    { label: 'FREE DRINK', type: 'flat', value: 40 },
    { label: '₹10 OFF', type: 'flat', value: 10 }
  ];
  async function reveal() {
    if (bill.reward) { setRevealed(true); return; }
    const reward = rewards[Math.floor(Math.random() * rewards.length)];
    const discount = Math.min(Number(reward.value), Number(bill.subtotal));
    const updated = await updateBill(bill, { reward, discount, total: Math.max(0, Number(bill.subtotal) - discount) });
    setRevealed(true);
    onUpdated(updated);
  }
  return (
    <section className="scratch-card-wrap">
      <div className="scratch-copy"><div className="eyebrow">THANK YOU GIFT</div><h2>🎁 Scratch & reveal</h2><p>This reward is independent of reviews. Everyone with a bill can play.</p></div>
      <button className={revealed ? 'scratch scratch-revealed' : 'scratch'} onClick={reveal} disabled={revealed}>
        {revealed ? <><span>YOUR REWARD</span><strong>{bill.reward?.label || 'Reward applied'}</strong></> : <><span>SCRATCH HERE</span><strong>Tap to reveal</strong></>}
      </button>
      {revealed ? <div className="reward-note">Discount applied: <strong>{money(bill.discount || 0)}</strong>. Your payable total is <strong>{money(bill.total)}</strong>.</div> : null}
    </section>
  );
}

function Admin() {
  const [tables, setTables] = useState([]);
  const [menu, setMenu] = useState([]);
  const [tableNumber, setTableNumber] = useState(1);
  const [selected, setSelected] = useState(null);
  const [items, setItems] = useState([{ name: '', quantity: 1, price: 0 }]);
  const [createdBill, setCreatedBill] = useState(null);
  const [configUpi, setConfigUpi] = useState(CONFIG.upiId);
  const navigate = useNavigate();

  useEffect(() => { Promise.all([getTables(), getMenu()]).then(([t, m]) => { setTables(t); setMenu(m); }); }, []);

  const domain = window.location.origin;

  function addLine() { setItems(x => [...x, { name: '', quantity: 1, price: 0 }]); }
  function setLine(index, field, value) { setItems(x => x.map((it, i) => i === index ? { ...it, [field]: field === 'name' ? value : Number(value) } : it)); }
  function chooseMenuItem(index, value) { const item = menu.find(m => m.name === value); setItems(x => x.map((it, i) => i === index ? { ...it, name: value, price: item?.price || 0 } : it)); }
  async function createBillForTable() {
    const valid = items.filter(i => i.name && Number(i.quantity) > 0 && Number(i.price) >= 0);
    if (!valid.length) return;
    const bill = await saveBill(tableNumber, valid);
    setCreatedBill(bill); setSelected(bill);
  }
  function saveUpi() { localStorage.setItem('bgv_upi_id', configUpi); alert('UPI ID saved in this browser. For deployment, also update CONFIG.upiId or use environment/config storage.'); }

  return (
    <div className="admin-shell">
      <header className="admin-header"><div><div className="brand">{CONFIG.name}</div><div className="tagline">Staff Dashboard</div></div><Link className="secondary-btn" to="/">Customer View</Link></header>
      <main className="admin-content">
        <div className="admin-grid">
          <section className="admin-card">
            <div className="eyebrow">TABLES</div><h1>Live tables</h1>
            <div className="table-grid">{tables.map(t => <button className="table-admin" key={t.id} onClick={() => { setTableNumber(t.table_number); setSelected(null); }}><span>Table {t.table_number}</span><small>Open bill</small></button>)}</div>
          </section>

          <section className="admin-card">
            <div className="eyebrow">CREATE BILL</div><h1>Table {tableNumber}</h1>
            {items.map((line, index) => <div className="admin-line" key={index}><select value={line.name} onChange={e => chooseMenuItem(index, e.target.value)}><option value="">Choose item</option>{menu.map(m => <option value={m.name} key={m.id}>{m.name}</option>)}</select><input type="number" min="1" value={line.quantity} onChange={e => setLine(index, 'quantity', e.target.value)} /><input type="number" min="0" value={line.price} onChange={e => setLine(index, 'price', e.target.value)} placeholder="Price" /></div>)}
            <div className="admin-actions"><button className="secondary-btn" onClick={addLine}>+ Add item</button><button className="primary-btn" onClick={createBillForTable}>Generate bill</button></div>
            {createdBill ? <div className="success-box"><strong>Bill created</strong><span>{money(createdBill.total)} • {createdBill.id}</span><Link to={`/table/${tableNumber}/bill`}>Open customer bill →</Link></div> : null}
          </section>
        </div>

        <section className="admin-card">
          <div className="eyebrow">TABLE QR CODES</div><h1>Print one QR per table</h1><p className="muted">Each QR opens the same app on the correct table number.</p>
          <div className="qr-grid">{tables.map(t => <div className="qr-card" key={t.id}><QRCodeCanvas value={`${domain}/table/${t.table_number}`} size={150} includeMargin /><strong>Table {t.table_number}</strong><small>{`${domain}/table/${t.table_number}`}</small></div>)}</div>
        </section>

        <section className="admin-card">
          <div className="eyebrow">SETTINGS</div><h1>UPI</h1><div className="setting-row"><input value={configUpi} onChange={e => setConfigUpi(e.target.value)} placeholder="restaurant@upi" /><button className="primary-btn" onClick={saveUpi}>Save</button></div><p className="muted">Replace the placeholder with the restaurant's real UPI ID before taking real payments.</p></section>
      </main>
    </div>
  );
}

function Home() {
  const table = new URLSearchParams(useLocation().search).get('table') || '1';
  return <CustomerPage tableNumber={table} initialTab="menu" />;
}

function RouteController() {
  const path = window.location.pathname;
  if (path === '/admin') return <Admin />;
  const parts = path.split('/').filter(Boolean);
  if (parts[0] === 'table' && parts[1]) return <CustomerPage tableNumber={parts[1]} initialTab={parts[2] === 'bill' ? 'bill' : 'menu'} />;
  return <Home />;
}

createRoot(document.getElementById('root')).render(<BrowserRouter><RouteController /></BrowserRouter>);
