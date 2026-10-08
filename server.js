
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json());

const PORT = process.env.PORT || 10000;
const REVIEW_URL = "https://maps.app.goo.gl/GTCU6VeZavhzYzjWA";
const UPI_ID = process.env.UPI_ID || "YOUR_UPI_ID@bank";
const UPI_NAME = "Bamma Gari Vantilu";

const menu = [
  { id:"m1", name:"Meals", category:"Meals", price:120, description:"Homestyle Andhra meal" },
  { id:"m2", name:"Veg Biryani", category:"Rice", price:160, description:"Aromatic rice with vegetables" },
  { id:"m3", name:"Chicken Biryani", category:"Biryani", price:240, description:"House-style chicken biryani" },
  { id:"m4", name:"Chicken 65", category:"Starters", price:220, description:"Crispy spicy chicken" },
  { id:"m5", name:"Paneer 65", category:"Starters", price:180, description:"Crispy paneer starter" },
  { id:"m6", name:"Dal Fry", category:"Curries", price:130, description:"Comforting dal with tempering" },
  { id:"m7", name:"Curd Rice", category:"Rice", price:80, description:"Cooling curd rice" },
  { id:"m8", name:"Soft Drink", category:"Beverages", price:40, description:"Chilled beverage" }
];

const bills = new Map();

function id(prefix="id") {
  return `${prefix}-${crypto.randomUUID()}`;
}

app.get("/api/health", (_req,res)=>res.json({ok:true}));
app.get("/api/config", (_req,res)=>res.json({name:"Bamma Gari Vantilu",reviewUrl:REVIEW_URL,upiId:UPI_ID,upiName:UPI_NAME}));
app.get("/api/menu", (_req,res)=>res.json(menu));

app.get("/api/bills/:tableNumber", (req,res)=>{
  const table = Number(req.params.tableNumber);
  const bill = bills.get(table);
  res.json(bill || null);
});

app.post("/api/bills", (req,res)=>{
  const table = Number(req.body.tableNumber);
  const rawItems = Array.isArray(req.body.items) ? req.body.items : [];
  if (!Number.isInteger(table) || table < 1 || !rawItems.length) {
    return res.status(400).json({error:"Table number and at least one item are required."});
  }
  const items = rawItems.map(x=>({
    id:id("bi"), item_name:String(x.name), quantity:Number(x.quantity), price:Number(x.price)
  })).filter(x=>x.item_name && x.quantity>0 && x.price>=0);
  if (!items.length) return res.status(400).json({error:"No valid bill items."});
  const subtotal = items.reduce((s,x)=>s+x.quantity*x.price,0);
  const bill = {
    id:id("bill"), table_number:table, subtotal, discount:0, total:subtotal,
    status:"OPEN", reward:null, items, created_at:new Date().toISOString()
  };
  bills.set(table,bill);
  res.status(201).json(bill);
});

app.patch("/api/bills/:billId", (req,res)=>{
  const billId=req.params.billId;
  const bill=[...bills.values()].find(b=>b.id===billId);
  if(!bill) return res.status(404).json({error:"Bill not found"});
  if(req.body.reward) {
    const reward=req.body.reward;
    const discount=Math.min(Number(reward.value)||0,bill.subtotal);
    bill.reward=reward; bill.discount=discount; bill.total=Math.max(0,bill.subtotal-discount);
  }
  if(req.body.status) bill.status=req.body.status;
  res.json(bill);
});

app.use(express.static(path.join(__dirname,"dist")));
app.use((req,res,next)=>{
  if(req.path.startsWith("/api/")) return res.status(404).end();
  res.sendFile(path.join(__dirname,"dist","index.html"));
});

app.listen(PORT,()=>console.log(`Bamma Gari Vantilu listening on ${PORT}`));
