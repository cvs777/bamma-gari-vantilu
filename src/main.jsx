
import React, {useEffect,useMemo,useState} from "react";
import {createRoot} from "react-dom/client";
import {BrowserRouter,useLocation,useNavigate,Link} from "react-router-dom";
import {QRCodeCanvas} from "qrcode.react";
import "./styles.css";

const DEMO_MENU=[
{id:"m1",name:"Meals",category:"Meals",price:120,description:"Homestyle Andhra meal"},
{id:"m2",name:"Veg Biryani",category:"Rice",price:160,description:"Aromatic rice with vegetables"},
{id:"m3",name:"Chicken Biryani",category:"Biryani",price:240,description:"House-style chicken biryani"},
{id:"m4",name:"Chicken 65",category:"Starters",price:220,description:"Crispy spicy chicken"},
{id:"m5",name:"Paneer 65",category:"Starters",price:180,description:"Crispy paneer starter"},
{id:"m6",name:"Dal Fry",category:"Curries",price:130,description:"Comforting dal with tempering"},
{id:"m7",name:"Curd Rice",category:"Rice",price:80,description:"Cooling curd rice"},
{id:"m8",name:"Soft Drink",category:"Beverages",price:40,description:"Chilled beverage"}
];
const money=v=>new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:0}).format(Number(v||0));
async function api(url,opts){const r=await fetch(url,opts);if(!r.ok)throw new Error(await r.text());return r.json();}
function upiUrl(amount,billId,upiId,upiName){
 const p=new URLSearchParams({pa:upiId,pn:upiName,am:Number(amount).toFixed(2),cu:"INR",tn:`Bill ${billId}`});
 return `upi://pay?${p}`;
}

function Shell({table,tab,bill,children}){
 const nav=useNavigate();
 return <div className="app-shell">
  <header className="topbar"><div><div className="brand">Bamma Gari Vantilu</div><div className="tagline">Traditional • Homely • Delicious</div></div><div className="table-pill">Table {table}</div></header>
  <nav className="tabs">
   <button className={tab==="menu"?"tab active":"tab"} onClick={()=>nav(`/table/${table}`)}>🍽️ Menu</button>
   <button className={tab==="bill"?"tab active":"tab"} onClick={()=>nav(`/table/${table}/bill`)}>🧾 Bill {bill&&<span className="tab-badge">{money(bill.total)}</span>}</button>
  </nav>
  <main className="content">{children}</main>
  <footer className="footer">Bamma Gari Vantilu • Honest reviews • Easy UPI payment</footer>
 </div>
}

function ReviewModal({reviewUrl,onReview,onSkip}){
 return <div className="modal-backdrop"><div className="modal-card"><div className="modal-emoji">❤️</div><h2>How was your experience?</h2><p>Please share an <strong>honest</strong> review on Google. Your feedback helps our restaurant.</p><button className="google-btn" onClick={()=>{window.open(reviewUrl,"_blank","noopener,noreferrer");onReview();}}>⭐ Open Google & leave an honest review</button><p className="modal-hint">Google opens in a new tab. Your reward does not depend on leaving a review.</p><button className="secondary-btn" onClick={onSkip}>Continue to bill</button></div></div>
}

function Scratch({bill,onUpdate}){
 const [revealed,setRevealed]=useState(Boolean(bill.reward));
 const rewards=[{label:"₹20 OFF",value:20},{label:"₹50 OFF",value:50},{label:"₹100 OFF",value:100},{label:"FREE DRINK",value:40},{label:"₹10 OFF",value:10}];
 async function reveal(){
  if(bill.reward){setRevealed(true);return}
  const reward=rewards[Math.floor(Math.random()*rewards.length)];
  const updated=await api(`/api/bills/${bill.id}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({reward})});
  setRevealed(true);onUpdate(updated);
 }
 return <section className="scratch-card-wrap"><div className="scratch-copy"><div className="eyebrow">THANK YOU GIFT</div><h2>🎁 Scratch & reveal</h2><p>Everyone with a bill can play. It is independent of reviews.</p></div><button className={revealed?"scratch scratch-revealed":"scratch"} onClick={reveal} disabled={revealed}>{revealed?<><span>YOUR REWARD</span><strong>{bill.reward?.label||"Reward applied"}</strong></>:<><span>SCRATCH HERE</span><strong>Tap to reveal</strong></>}</button>{revealed&&<div className="reward-note">Discount: <strong>{money(bill.discount)}</strong> • Pay <strong>{money(bill.total)}</strong></div>}</section>
}

function Customer({table,initialTab}){
 const [menu,setMenu]=useState(DEMO_MENU),[bill,setBill]=useState(null),[config,setConfig]=useState({reviewUrl:"https://maps.app.goo.gl/GTCU6VeZavhzYzjWA",upiId:"YOUR_UPI_ID@bank",upiName:"Bamma Gari Vantilu"}),[loading,setLoading]=useState(true),[review,setReview]=useState(false),[error,setError]=useState("");
 const nav=useNavigate();
 async function load(){
  try{const [m,c,b]=await Promise.all([api("/api/menu"),api("/api/config"),api(`/api/bills/${table}`)]);setMenu(m);setConfig(c);setBill(b);setError("");}catch(e){setError("Server is starting or temporarily unavailable.");}
  setLoading(false);
 }
 useEffect(()=>{load();const t=setInterval(load,3000);return()=>clearInterval(t)},[table]);
 useEffect(()=>{if(initialTab==="bill"&&bill&&!sessionStorage.getItem(`review-prompt-${table}`))setReview(true)},[initialTab,bill,table]);
 const [cart,setCart]=useState({});
 const cartItems=useMemo(()=>menu.filter(x=>cart[x.id]).map(x=>({...x,quantity:cart[x.id]})),[menu,cart]);
 if(loading)return <Shell table={table} tab={initialTab}><div className="card center">Loading…</div></Shell>;
 if(initialTab==="bill")return <Bill table={table} bill={bill} config={config} onRefresh={load} onReview={()=>setReview(true)}/>;
 return <Shell table={table} tab="menu" bill={bill}>
  {error&&<div className="config-warning">{error}</div>}
  <section className="hero-card"><div><div className="eyebrow">WELCOME</div><h1>Home-style food, served with love ❤️</h1><p>Browse our menu. Your waiter will create the bill after your order.</p></div><div className="hero-badge">Bamma's Kitchen</div></section>
  <div className="section-header"><div><h2>Today's Menu</h2><p>Menu prices are for reference.</p></div></div>
  <div className="menu-grid">{menu.map(item=><div className="menu-card" key={item.id}><div className="menu-icon">🍛</div><div className="menu-main"><div className="menu-name">{item.name}</div><div className="menu-desc">{item.description}</div><div className="menu-price">{money(item.price)}</div></div></div>)}</div>
  <div className="card center"><h2>Your bill will appear here</h2><p>After your waiter generates the bill, tap the <strong>Bill</strong> tab.</p><button className="primary-btn" onClick={()=>nav(`/table/${table}/bill`)}>Open Bill →</button></div>
 </Shell>
}

function Bill({table,bill,config,onRefresh,onReview}){
 const nav=useNavigate();
 if(!bill)return <Shell table={table} tab="bill"><div className="card center"><div className="big-emoji">🧾</div><h2>No bill yet</h2><p>Your waiter has not generated the bill yet. This page checks automatically.</p><button className="primary-btn" onClick={()=>nav(`/table/${table}`)}>Back to menu</button></div></Shell>;
 const pay=()=>{if(config.upiId.includes("YOUR_UPI_ID")){alert("The restaurant UPI ID has not been configured yet.");return}window.location.href=upiUrl(bill.total,bill.id,config.upiId,config.upiName)};
 return <Shell table={table} tab="bill" bill={bill}>
  <section className="card bill-card"><div className="section-header"><div><div className="eyebrow">BILL</div><h1>Bill #{bill.id.slice(-6).toUpperCase()}</h1></div><span className="status-pill">OPEN</span></div>
  <div className="bill-items">{bill.items.map(i=><div className="bill-row" key={i.id}><span>{i.item_name} × {i.quantity}</span><strong>{money(i.price*i.quantity)}</strong></div>)}</div>
  <div className="totals"><div><span>Subtotal</span><strong>{money(bill.subtotal)}</strong></div><div className="discount-row"><span>Reward discount</span><strong>-{money(bill.discount)}</strong></div><div className="grand-total"><span>Total</span><strong>{money(bill.total)}</strong></div></div>
  <button className="secondary-btn review-link" onClick={onReview}>❤️ Leave an honest Google review</button></section>
  <Scratch bill={bill} onUpdate={onRefresh}/>
  <section className="payment-card"><div><div className="eyebrow">PAYMENT</div><h2>Pay {money(bill.total)}</h2><p>Use your preferred UPI app. The amount is pre-filled.</p></div><button className="upi-btn" onClick={pay}>📲 Pay by UPI</button>{!config.upiId.includes("YOUR_UPI_ID")&&<div className="qr-payment"><QRCodeCanvas value={upiUrl(bill.total,bill.id,config.upiId,config.upiName)} size={180} includeMargin/><small>Scan if the button does not open your UPI app.</small></div>}{config.upiId.includes("YOUR_UPI_ID")&&<div className="config-warning">Staff must configure the restaurant UPI ID before real payments.</div>}</section>
 </Shell>
}

function Admin(){
 const [menu,setMenu]=useState(DEMO_MENU),[table,setTable]=useState(1),[items,setItems]=useState([{name:"",quantity:1,price:0}]),[created,setCreated]=useState(null),[health,setHealth]=useState("checking");
 const domain=window.location.origin;
 useEffect(()=>{api("/api/health").then(()=>setHealth("online")).catch(()=>setHealth("offline"));api("/api/menu").then(setMenu).catch(()=>{})},[]);
 const setLine=(i,k,v)=>setItems(a=>a.map((x,j)=>j===i?{...x,[k]:k==="name"?v:Number(v)}:x));
 const choose=(i,v)=>{const m=menu.find(x=>x.name===v);setItems(a=>a.map((x,j)=>j===i?{...x,name:v,price:m?.price||0}:x))};
 async function generate(){try{const valid=items.filter(x=>x.name&&x.quantity>0);if(!valid.length)return;const b=await api("/api/bills",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({tableNumber:table,items:valid})});setCreated(b)}catch(e){alert("Could not generate bill: "+e.message)}}
 return <div className="admin-shell"><header className="admin-header"><div><div className="brand">Bamma Gari Vantilu</div><div className="tagline">Staff Dashboard</div></div><span className={health==="online"?"status-pill":"config-warning"}>Server {health}</span></header><main className="admin-content">
 <section className="admin-card"><div className="eyebrow">CREATE BILL</div><h1>Table {table}</h1><div className="table-grid">{Array.from({length:10},(_,i)=>i+1).map(n=><button key={n} className={n===table?"table-admin selected":"table-admin"} onClick={()=>setTable(n)}>Table {n}</button>)}</div>
 {items.map((line,i)=><div className="admin-line" key={i}><select value={line.name} onChange={e=>choose(i,e.target.value)}><option value="">Choose item</option>{menu.map(m=><option key={m.id} value={m.name}>{m.name}</option>)}</select><input type="number" min="1" value={line.quantity} onChange={e=>setLine(i,"quantity",e.target.value)}/><input type="number" min="0" value={line.price} onChange={e=>setLine(i,"price",e.target.value)}/></div>)}
 <div className="admin-actions"><button className="secondary-btn" onClick={()=>setItems(a=>[...a,{name:"",quantity:1,price:0}])}>+ Add item</button><button className="primary-btn" onClick={generate}>Generate bill</button></div>
 {created&&<div className="success-box"><strong>Bill created for Table {created.table_number}</strong><span>{money(created.total)} • {created.id}</span><a href={`/table/${created.table_number}/bill`} target="_blank" rel="noreferrer">Open customer bill →</a></div>}</section>
 <section className="admin-card"><div className="eyebrow">TABLE QR CODES</div><h1>Print one QR per table</h1><div className="qr-grid">{Array.from({length:10},(_,i)=>i+1).map(n=><div className="qr-card" key={n}><QRCodeCanvas value={`${domain}/table/${n}`} size={150} includeMargin/><strong>Table {n}</strong><small>{domain}/table/{n}</small></div>)}</div></section>
 </main></div>
}

function Router(){
 const path=window.location.pathname;
 if(path==="/admin")return <Admin/>;
 const m=path.match(/^\/table\/(\d+)(\/bill)?$/); const table=m?.[1]||"1";
 return <Customer table={table} initialTab={m?.[2]?"bill":"menu"}/>;
}
createRoot(document.getElementById("root")).render(<BrowserRouter><Router/></BrowserRouter>);
