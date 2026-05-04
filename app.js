const { useEffect, useMemo, useState } = React;

const HOLD_MS = 120000;
const EVENT = {
  title: "Aurora Pulse Live",
  date: "June 14, 2026",
  location: "Los Angeles, CA",
  image:
    "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=1200&q=80",
};

const TOKENS = {
  prices: { VIP: 180, Standard: 95, Economy: 55 },
  rows: ["VIP", "VIP", "Standard", "Standard", "Economy", "Economy"],
  cols: 12,
};

const storageKey = "lovable-seat-hold-until";

const makeSeats = () => {
  const items = [];
  let id = 1;
  TOKENS.rows.forEach((section, row) => {
    for (let col = 0; col < TOKENS.cols; col++) {
      items.push({
        id: id++,
        row,
        col,
        section,
        status: Math.random() < 0.15 ? "confirmed" : "available",
        heldBy: null,
        holdUntil: null,
      });
    }
  });
  return items;
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
  const [step, setStep] = useState("event");
  const [seats, setSeats] = useState(makeSeats);
  const [selected, setSelected] = useState([]);
  const [holdUntil, setHoldUntil] = useState(Number(localStorage.getItem(storageKey)) || 0);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [payState, setPayState] = useState("idle");
  const [reconnecting, setReconnecting] = useState(false);

  useEffect(() => setTimeout(() => setLoading(false), 1000), []);

  useEffect(() => {
    const tick = setInterval(() => {
      const now = Date.now();
      setSeats((prev) =>
        prev.map((s) =>
          s.status === "reserved" && s.holdUntil <= now
            ? { ...s, status: "available", heldBy: null, holdUntil: null }
            : s
        )
      );
      if (holdUntil && now >= holdUntil) {
        setSelected([]);
        setHoldUntil(0);
        localStorage.removeItem(storageKey);
      }
    }, 1000);
    return () => clearInterval(tick);
  }, [holdUntil]);

  useEffect(() => {
    const stream = setInterval(() => {
      setSeats((prev) =>
        prev.map((s) => {
          if (s.status !== "available" || Math.random() > 0.03) return s;
          return { ...s, status: "reserved", heldBy: "other", holdUntil: Date.now() + 20000 + Math.random() * 90000 };
        })
      );
    }, 2500);
    return () => clearInterval(stream);
  }, []);

  const seconds = Math.max(0, Math.floor((holdUntil - Date.now()) / 1000));
  const time = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

  const metrics = useMemo(() => ({
    total: seats.length,
    available: seats.filter((s) => s.status === "available").length,
    reserved: seats.filter((s) => s.status === "reserved").length,
    confirmed: seats.filter((s) => s.status === "confirmed").length,
    expiring: seats.filter((s) => s.status === "reserved" && s.holdUntil && s.holdUntil - Date.now() < 30000).length,
  }), [seats]);

  const suggestionIds = useMemo(
    () => seats.filter((s) => s.status === "available" && [4, 5, 6, 7].includes(s.col)).slice(0, 6).map((s) => s.id),
    [seats]
  );

  const selectSeat = (seat) => {
    setMsg("");
    if (seat.status !== "available") return setMsg("This seat was just taken. Try nearby seats.");
    if (Math.random() < 0.14) {
      setSeats((prev) => prev.map((s) => (s.id === seat.id ? { ...s, status: "reserved", heldBy: "other", holdUntil: Date.now() + 75000 } : s)));
      return setMsg("This seat was just taken. Try nearby seats.");
    }
    const until = holdUntil > Date.now() ? holdUntil : Date.now() + HOLD_MS;
    setHoldUntil(until);
    localStorage.setItem(storageKey, String(until));
    setSeats((prev) => prev.map((s) => (s.id === seat.id ? { ...s, status: "reserved", heldBy: "me", holdUntil: until } : s)));
    setSelected((prev) => [...new Set([...prev, seat.id])]);
  };

  const doPay = () => {
    if (seconds <= 0) return;
    setPayState("loading");
    setTimeout(() => setPayState(Math.random() < 0.3 ? "failed" : "success"), 1600);
  };

  if (loading) return <main className="wrap"><div className="skeleton" style={{ height: 240 }} /></main>;

  return <main className="wrap">
    <header className="topbar">
      <h1>Lovable SeatFlow</h1>
      <div className="actions">
        <button className="btn ghost" onClick={() => setReconnecting(true)}>Simulate slow network</button>
        <button className="btn ghost" onClick={() => setRole(role === "customer" ? "admin" : "customer")}>Role: {role}</button>
      </div>
    </header>

    {reconnecting && <div className="alert warn">Reconnecting… data sync is delayed. <button className="btn ghost" onClick={() => setReconnecting(false)}>Retry</button></div>}

    {!!holdUntil && seconds > 0 && <div className={`stickyTimer ${seconds < 10 ? "urgent" : ""}`}>Reservation timer: {time}</div>}

    {role === "admin" ? <Admin seats={seats} metrics={metrics} /> : (
      <>
        {step === "event" && <EventCard event={EVENT} available={metrics.available} onNext={() => setStep("seats")} />}
        {step === "seats" && <SeatSelection seats={seats} selected={selected} msg={msg} suggestionIds={suggestionIds} onClickSeat={selectSeat} onNext={() => setStep("payment")} />}
        {step === "payment" && <Payment seats={seats} selected={selected} prices={TOKENS.prices} seconds={seconds} time={time} payState={payState} onPay={doPay} back={() => setStep("seats")} />}
      </>
    )}
  </main>;
}

const EventCard = ({ event, available, onNext }) => <section className="panel eventGrid">
  <img src={event.image} alt="event" />
  <div>
    <p className="eyebrow">Event detail</p>
    <h2>{event.title}</h2>
    <p className="muted">{event.date} · {event.location}</p>
    {available === 0 ? <div className="alert error">No tickets available. Explore similar events.</div> : <div className="alert">{available} seats left</div>}
    <ul className="prices">
      <li><span>VIP</span><b>$180</b></li><li><span>Standard</span><b>$95</b></li><li><span>Economy</span><b>$55</b></li>
    </ul>
    <button className="btn" disabled={!available} onClick={onNext}>Select Seats</button>
  </div>
</section>;

function SeatSelection({ seats, selected, msg, suggestionIds, onClickSeat, onNext }) {
  return <section className="split">
    <div className="panel">
      <h3>Choose your seats</h3>
      <div className="legend"><Tag type="available" text="Available" /><Tag type="reserved" text="Reserved (temporary)" /><Tag type="confirmed" text="Confirmed" /></div>
      {msg && <div className="alert error">{msg}</div>}
      {TOKENS.rows.map((name, r) => (
        <div className="row" key={r}><span className="rowLabel">{name}</span>
          {seats.filter((x) => x.row === r).map((s) => <button key={s.id} disabled={s.status !== "available"} onClick={() => onClickSeat(s)} className={`seat ${s.status} ${selected.includes(s.id) ? "mine" : ""} ${suggestionIds.includes(s.id) ? "suggest" : ""}`}>{s.col + 1}</button>)}
        </div>
      ))}
    </div>
    <aside className="panel">
      <h4>Smart assist</h4>
      <p className="muted">Suggested nearby seats are highlighted. Keyboard and color-contrast friendly states included.</p>
      <button className="btn" disabled={!selected.length} onClick={onNext}>Continue to payment</button>
    </aside>
  </section>;
}

const Tag = ({ type, text }) => <span className="tag"><span className={`dot ${type}`} />{text}</span>;

function Payment({ seats, selected, prices, seconds, time, payState, onPay, back }) {
  const picked = seats.filter((s) => selected.includes(s.id));
  const total = picked.reduce((sum, s) => sum + prices[s.section], 0);
  if (!picked.length) return <section className="panel"><div className="alert error">Reservation expired</div><button className="btn" onClick={back}>Select seats again</button></section>;
  return <section className="split">
    <div className="panel">
      <h3>Payment</h3>
      <div className={`timerInline ${seconds < 10 ? "urgent" : ""}`}>Time left: {time}</div>
      {seconds <= 0 && <div className="alert error">Reservation expired. Return to seat selection.</div>}
      {picked.map((s) => <p key={s.id}>{s.section} #{s.id} — ${prices[s.section]}</p>)}
      <h4>Total: ${total}</h4>
      <input placeholder="Card number" /><input placeholder="MM/YY" />
      <button className="btn" disabled={seconds <= 0 || payState === "loading"} onClick={onPay}>{payState === "loading" ? "Processing..." : "Pay now"}</button>
      {payState === "failed" && <div className="alert error">Payment failed. Reason: issuer declined. Retry while hold is active.</div>}
      {payState === "success" && <div className="alert ok">Success! Tickets confirmed. Download or email now.</div>}
    </div>
    <aside className="panel"><h4>Next action</h4><button className="btn ghost" onClick={back}>Back to seat selection</button></aside>
  </section>;
}

function Admin({ seats, metrics }) {
  const [filter, setFilter] = useState("all");
  return <section className="panel">
    <h3>Admin dashboard</h3>
    <div className="kpis">{Object.entries(metrics).map(([k, v]) => <div className="kpi" key={k}><small>{k}</small><strong>{v}</strong></div>)}</div>
    <select value={filter} onChange={(e) => setFilter(e.target.value)}><option value="all">All</option><option value="available">Available</option><option value="reserved">Reserved</option><option value="confirmed">Confirmed</option></select>
    {TOKENS.rows.map((name, r) => <div className="row" key={r}><span className="rowLabel">{name}</span>{seats.filter((s) => s.row === r).map((s) => (filter === "all" || filter === s.status) ? <span key={s.id} className={`seat ${s.status}`} /> : null)}</div>)}
  </section>;
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
