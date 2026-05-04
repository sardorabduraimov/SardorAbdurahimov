const { useMemo, useState, useEffect } = React;

const PRICES = { VIP: 160, Standard: 90, Economy: 50 };
const ROWS = ["VIP", "VIP", "Standard", "Standard", "Economy", "Economy"];
const COLS = 12;
const STORAGE_KEY = "reservation_hold_until";

const createSeats = () => {
  const seats = [];
  let id = 1;
  for (let r = 0; r < ROWS.length; r++) {
    for (let c = 0; c < COLS; c++) {
      const status = Math.random() < 0.12 ? "confirmed" : "available";
      seats.push({ id: id++, row: r, col: c, section: ROWS[r], status, heldBy: null, holdUntil: null });
    }
  }
  return seats;
};

function App() {
  const [role, setRole] = useState("customer");
  const [page, setPage] = useState("event");
  const [seats, setSeats] = useState(createSeats);
  const [selectedIds, setSelectedIds] = useState([]);
  const [holdUntil, setHoldUntil] = useState(Number(localStorage.getItem(STORAGE_KEY)) || null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [networkSlow, setNetworkSlow] = useState(false);
  const [paymentState, setPaymentState] = useState("idle");

  useEffect(() => { setTimeout(() => setLoading(false), 1200); }, []);
  useEffect(() => {
    const t = setInterval(() => {
      const now = Date.now();
      setSeats(prev => prev.map(s => (s.status === "reserved" && s.holdUntil <= now ? { ...s, status: "available", heldBy: null, holdUntil: null } : s)));
      if (holdUntil && holdUntil <= now) {
        setSelectedIds([]); setHoldUntil(null); localStorage.removeItem(STORAGE_KEY);
      }
    }, 1000);
    return () => clearInterval(t);
  }, [holdUntil]);

  useEffect(() => {
    const t = setInterval(() => {
      setSeats(prev => prev.map(s => {
        if (s.status !== "available" || Math.random() > 0.035) return s;
        return { ...s, status: "reserved", heldBy: "other", holdUntil: Date.now() + 30000 + Math.random() * 90000 };
      }));
    }, 2800);
    return () => clearInterval(t);
  }, []);

  const remaining = holdUntil ? Math.max(0, Math.floor((holdUntil - Date.now()) / 1000)) : 0;
  const mmss = `${String(Math.floor(remaining / 60)).padStart(2, "0")}:${String(remaining % 60).padStart(2, "0")}`;

  const reserveSeat = (seat) => {
    setError("");
    if (seat.status !== "available") {
      setError("This seat was just taken. Try nearby seats.");
      return;
    }
    if (Math.random() < 0.16) {
      setSeats(prev => prev.map(s => s.id === seat.id ? { ...s, status: "reserved", heldBy: "other", holdUntil: Date.now() + 70000 } : s));
      setError("This seat was just taken. Try nearby seats.");
      return;
    }
    const until = holdUntil && holdUntil > Date.now() ? holdUntil : Date.now() + 120000;
    setHoldUntil(until); localStorage.setItem(STORAGE_KEY, String(until));
    setSeats(prev => prev.map(s => s.id === seat.id ? { ...s, status: "reserved", heldBy: "me", holdUntil: until } : s));
    setSelectedIds(prev => [...new Set([...prev, seat.id])]);
  };

  const bestSuggestions = useMemo(() => seats.filter(s => s.status === "available" && [4,5,6,7].includes(s.col)).slice(0,5).map(s => s.id), [seats]);
  const metrics = useMemo(() => ({
    total: seats.length,
    reserved: seats.filter(s => s.status === "reserved").length,
    confirmed: seats.filter(s => s.status === "confirmed").length,
    expiring: seats.filter(s => s.status === "reserved" && s.holdUntil && s.holdUntil - Date.now() < 30000).length,
  }), [seats]);
  const left = seats.filter(s => s.status === "available").length;

  const pay = () => {
    if (remaining <= 0) return;
    setPaymentState("loading");
    setTimeout(() => setPaymentState(Math.random() < 0.35 ? "failed" : "success"), 1500);
  };

  if (loading) return <div className="container"><div className="skeleton" style={{height:220}}/></div>;

  return <div className="container">
    <div style={{display:"flex",justifyContent:"space-between", marginBottom:10}}>
      <h1 className="h1">Concert Ticket Platform</h1>
      <div><button className="btn secondary" onClick={()=>setRole(role==="customer"?"admin":"customer")}>Role: {role}</button></div>
    </div>
    {networkSlow && <div className="alert warn">Reconnecting… network is slow. <button className="btn secondary" onClick={()=>setNetworkSlow(false)}>Retry</button></div>}
    <button className="btn secondary" onClick={()=>setNetworkSlow(true)} style={{marginBottom:10}}>Simulate slow network</button>

    {role === "admin" ? <AdminView seats={seats} metrics={metrics} /> : <>
      {holdUntil && remaining > 0 && <div className="timer-sticky"><div className={`timer ${remaining < 10 ? "urgent" : ""}`}>Reservation timer: {mmss}</div></div>}
      {page === "event" && <EventPage left={left} onSelect={() => setPage("seats")} />}
      {page === "seats" && <SeatPage seats={seats} selectedIds={selectedIds} reserveSeat={reserveSeat} error={error} suggestions={bestSuggestions} goPay={()=>setPage("payment")} />}
      {page === "payment" && <PaymentPage seats={seats} selectedIds={selectedIds} remaining={remaining} mmss={mmss} paymentState={paymentState} pay={pay} back={()=>setPage("seats")} />}
    </>}
  </div>
}

function EventPage({ left, onSelect }) { return <div className="card hero"><img src="https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=900" alt="concert"/><div><h2 className="h2">Neon Lights Live 2026</h2><div className="caption">May 18, 2026 • Brooklyn, NY</div><div style={{marginTop:12}}>{left===0?<div className="alert error">No tickets available. Check similar events.</div>:<div className="alert warn">{left} seats left</div>}</div><div className="price-tier"><span>VIP</span><strong>$160</strong></div><div className="price-tier"><span>Standard</span><strong>$90</strong></div><div className="price-tier"><span>Economy</span><strong>$50</strong></div><button className="btn" style={{marginTop:14}} onClick={onSelect} disabled={left===0}>Select Seats</button></div></div>; }

function SeatPage({ seats, selectedIds, reserveSeat, error, suggestions, goPay }) {
  const grouped = ROWS.map((_, r) => seats.filter(s => s.row === r));
  return <div className="grid-2"><div className="card"><h3 className="h2">Select seats</h3><div className="legend"><Legend label="Available" cls="available"/><Legend label="Reserved (temporary)" cls="reserved"/><Legend label="Confirmed" cls="confirmed"/></div>{error && <div className="alert error">{error}</div>}<div className="seat-map" style={{marginTop:10}}>{grouped.map((row, i)=><div className="seat-row" key={i}><span className="section-label">{ROWS[i]}</span>{row.map(s=><button key={s.id} title={`${s.section} ${s.id}`} onClick={()=>reserveSeat(s)} disabled={s.status!=="available"} className={`seat ${s.status} ${selectedIds.includes(s.id)?"mine":""} ${suggestions.includes(s.id)?"alt":""}`}>{s.col+1}</button>)}</div>)}</div></div><div className="card"><h4>Smart suggestions</h4><p className="caption">Best available seats are highlighted with amber rings.</p><button className="btn" disabled={!selectedIds.length} onClick={goPay}>Continue to payment</button></div></div>
}
function Legend({label, cls}){ return <span className="legend-item"><span className={`seat ${cls}`}></span>{label}</span>}

function PaymentPage({ seats, selectedIds, remaining, mmss, paymentState, pay, back }) {
  const selectedSeats = seats.filter(s => selectedIds.includes(s.id));
  const total = selectedSeats.reduce((a,b)=>a+PRICES[b.section],0);
  if (!selectedSeats.length) return <div className="card"><div className="alert error">Reservation expired</div><button className="btn" onClick={back}>Select seats again</button></div>;
  return <div className="grid-2"><div className="card"><h3 className="h2">Payment</h3><div className={`timer ${remaining < 10 ? "urgent" : ""}`}>Time left: {mmss}</div>{remaining<=0 && <div className="alert error">Reservation expired. Please select seats again.</div>}<div style={{marginTop:10}}>{selectedSeats.map(s=><div key={s.id}>{s.section} seat #{s.id} — ${PRICES[s.section]}</div>)}</div><h4>Total: ${total}</h4><input placeholder="Card number" style={{width:"100%",padding:8,marginBottom:8}}/><input placeholder="MM/YY" style={{width:"100%",padding:8,marginBottom:8}}/><button className="btn" disabled={remaining<=0 || paymentState==="loading"} onClick={pay}>{paymentState==="loading"?"Processing...":"Pay now"}</button>{paymentState==="failed" && <div className="alert error">Payment failed: issuer declined. Retry while reservation is active.</div>}{paymentState==="success" && <div className="alert warn">Success! Tickets confirmed. Download or email tickets now.</div>}</div><div className="card"><h4>No dead ends</h4><button className="btn secondary" onClick={back}>Back to seat selection</button></div></div>
}

function AdminView({ seats, metrics }) {
  const [filter, setFilter] = useState("all");
  return <div><div className="kpis">{Object.entries(metrics).map(([k,v])=><div className="kpi" key={k}><div className="caption">{k}</div><div className="h2">{v}</div></div>)}</div><div className="card" style={{marginTop:12}}><h3 className="h2">Live seat map</h3><select onChange={e=>setFilter(e.target.value)}><option value="all">All</option><option value="available">Available</option><option value="reserved">Reserved</option><option value="confirmed">Confirmed</option></select><div className="seat-map" style={{marginTop:12}}>{ROWS.map((_, r)=><div className="seat-row" key={r}><span className="section-label">{ROWS[r]}</span>{seats.filter(s=>s.row===r).map(s=> (filter==="all"||filter===s.status) ? <span key={s.id} className={`seat ${s.status}`} />:null)}</div>)}</div></div></div>
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
