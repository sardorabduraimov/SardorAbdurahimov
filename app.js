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
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
