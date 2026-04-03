import { useState, useEffect, useRef } from 'react'
import { Routes, Route, Navigate, useNavigate, Link } from 'react-router-dom'
import axios from 'axios'
import { AuthProvider, useAuth } from './AuthContext'
import Login     from './Login'
import Signup    from './Signup'
import Analytics from './Analytics'
import Profile   from './Profile'

const API_URL = import.meta.env.VITE_API_URL || '/api'

const DEFAULTS = {
  Warehouse_block: 'D', Mode_of_Shipment: 'Ship', Customer_care_calls: 4,
  Customer_rating: 3, Cost_of_the_Product: 177, Prior_purchases: 3,
  Product_importance: 'Medium', Gender: 'M', Discount_offered: 44, Weight_in_gms: 4500,
}
const FEATURE_IMPORTANCE = [
  { name: 'Discount Offered', pct: 92 }, { name: 'Weight (gms)', pct: 78 },
  { name: 'Prior Purchases',  pct: 71 }, { name: 'Customer Care Calls', pct: 65 },
  { name: 'Cost of Product',  pct: 58 }, { name: 'Customer Rating', pct: 44 },
]

/* ── animated counter ─────────────────────────────── */
function Counter({ to, duration = 1200, suffix = '' }) {
  const [val, setVal] = useState(0)
  useEffect(() => {
    let start = null
    const num = parseFloat(to)
    const step = ts => {
      if (!start) start = ts
      const p = Math.min((ts - start) / duration, 1)
      setVal((num * p).toFixed(to.includes('.') ? 1 : 0))
      if (p < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }, [to])
  return <>{val}{suffix}</>
}

/* ── select field ─────────────────────────────────── */
function SelectField({ label, id, value, onChange, options }) {
  return (
    <div className="field-group">
      <label htmlFor={id}>{label}</label>
      <select id={id} value={value} onChange={e => onChange(e.target.value)}>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  )
}

/* ── number + slider ────────────────────────────────── */
function NumberField({ label, id, value, onChange, min, max, step = 1, unit }) {
  return (
    <div className="field-group">
      <label htmlFor={id}>{label}{unit && <span className="unit-tag">{unit}</span>}</label>
      <div className="number-wrap">
        <input id={id} type="number" value={value} min={min} max={max} step={step}
          onChange={e => onChange(Number(e.target.value))} />
        {min !== undefined && max !== undefined && (
          <input type="range" min={min} max={max} step={step} value={value}
            onChange={e => onChange(Number(e.target.value))}
            className="slider" aria-label={`${label} slider`} />
        )}
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════
   DASHBOARD
══════════════════════════════════════════════════════ */
function Dashboard() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [form,    setForm]    = useState(DEFAULTS)
  const [result,  setResult]  = useState(null)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState(null)
  const [apiReady,setApiReady]= useState(false)
  const [history, setHistory] = useState([])
  const [showHistory, setShowHistory] = useState(false)
  const resultRef = useRef(null)

  // API health check
  useEffect(() => {
    const check = async () => {
      try { const r = await axios.get(`${API_URL}/status`, { timeout: 2000 }); setApiReady(r.data.status === 'ready') }
      catch { setApiReady(false) }
    }
    check(); const t = setInterval(check, 5000); return () => clearInterval(t)
  }, [])

  // Auto-load history on mount
  useEffect(() => {
    if (user) loadHistory()
  }, [user])

  // Load history and optionally pre-populate
  const loadHistory = async () => {
    try {
      const r = await axios.get(`${API_URL}/history`)
      const data = r.data
      setHistory(data)
      
      // Regain stored info: If user has history, use latest prediction as form base
      if (data && data.length > 0) {
        setForm(prev => ({ ...prev, ...data[0].inputs }))
      }
    } catch (err) {
      console.error("Failed to load history:", err)
    }
  }

  const update = k => v => setForm(p => ({ ...p, [k]: v }))

  const handleSubmit = async e => {
    e.preventDefault(); setLoading(true); setError(null); setResult(null)
    try {
      const res = await axios.post(`${API_URL}/predict`, form)
      setResult(res.data)
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 100)
      loadHistory()
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to connect. Ensure the backend is running.')
    } finally { setLoading(false) }
  }

  const handleLogout = async () => { await logout(); navigate('/login') }
  const isOnTime = result?.status === 'On Time'

  return (
    <div className="app">
      {/* ── NAVBAR ── */}
      <nav className="navbar">
        <div className="nav-brand">
          <div className="brand-icon">S</div>
          <div>
            <span className="brand-name">ShipmentSure</span>
            <span className="brand-tag">Delivery Intelligence</span>
          </div>
        </div>
        <div className="nav-links">
          <a href="#dashboard" className="nav-link active">Dashboard</a>
          <a href="#predict"   className="nav-link">Predict</a>
          <Link to="/analytics" className="nav-link">Analytics</Link>
          <button className="nav-link hist-btn" onClick={() => { setShowHistory(p=>!p); loadHistory() }}>
            History {history.length > 0 && <span className="hist-badge">{history.length}</span>}
          </button>
        </div>
        <div className="nav-right">
          <div className={`api-badge ${apiReady ? 'online' : 'offline'}`}>
            <span className="badge-dot" />{apiReady ? 'Model Online' : 'Offline'}
          </div>
          <div className="user-chip" style={{ cursor:'pointer' }} onClick={() => navigate('/profile')} title="View Profile">
            <div className="user-avatar">{user?.name?.[0]?.toUpperCase()}</div>
            <span className="user-name">{user?.name}</span>
            <button className="logout-btn" onClick={e => { e.stopPropagation(); handleLogout() }} title="Logout">↩</button>
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="hero" id="dashboard">
        <div className="hero-bg-overlay" />
        <div className="hero-content">
          <p className="hero-eyebrow">AI-Powered Logistics</p>
          <h1 className="hero-title">
            Predict On-Time Delivery<br />with Machine Learning
          </h1>
          <p className="hero-sub">
            Welcome back, <strong>{user?.name}</strong>. Enter shipment details to get an instant AI-powered prediction.
          </p>
          <a href="#predict" className="hero-cta">Run Prediction →</a>
        </div>
      </section>

      {/* ── STATS ── */}
      <section className="stats-row">
        {[
          { label: 'Total Shipments', val: '10999',  suffix: '',    color: '#06b6d4', icon: '📦' },
          { label: 'On-Time Rate',    val: '40.3',   suffix: '%',   color: '#f97316', icon: '✓'  },
          { label: 'Avg. Discount',   val: '26.6',   suffix: '%',   color: '#a855f7', icon: '%'  },
          { label: 'Avg. Weight',     val: '3.6',    suffix: ' kg', color: '#10b981', icon: '⚖'  },
        ].map(s => (
          <div className="stat-card" key={s.label}>
            <div className="stat-icon" style={{ color: s.color, borderColor: s.color }}>{s.icon}</div>
            <div>
              <div className="stat-value" style={{ color: s.color }}>
                <Counter to={s.val} suffix={s.suffix} />
              </div>
              <div className="stat-label">{s.label}</div>
            </div>
          </div>
        ))}
      </section>

      {/* ── HISTORY DRAWER ── */}
      {showHistory && (
        <div className="history-drawer">
          <div className="history-header">
            <h3>Your Prediction History</h3>
            <button onClick={() => setShowHistory(false)} className="close-btn">✕</button>
          </div>
          {history.length === 0
            ? <p className="hist-empty">No predictions yet. Run your first one!</p>
            : history.map(h => (
              <div key={h.id} className={`hist-item ${h.status === 'On Time' ? 'ontime' : 'delayed'}`}>
                <div className="hist-status">
                  <span className={`hist-dot ${h.status === 'On Time' ? 'green' : 'orange'}`} />
                  {h.status}
                </div>
                <div className="hist-conf">{(h.confidence * 100).toFixed(1)}% confidence</div>
                <div className="hist-time">{new Date(h.created_at).toLocaleString()}</div>
              </div>
            ))
          }
        </div>
      )}

      {/* ── MAIN GRID ── */}
      <main className="main-grid" id="predict">
        {/* Form */}
        <section className="panel form-panel">
          <div className="panel-header">
            <div className="panel-dot teal" />
            <h2 className="panel-title">Shipment Details</h2>
            <span className="panel-sub">All fields required</span>
          </div>
          <form onSubmit={handleSubmit} id="prediction-form" noValidate>
            <p className="section-label">Warehouse &amp; Logistics</p>
            <div className="form-grid-2">
              <SelectField label="Warehouse Block" id="warehouse" value={form.Warehouse_block}
                onChange={update('Warehouse_block')}
                options={['A','B','C','D','F'].map(v => ({ value: v, label: `Block ${v}` }))} />
              <SelectField label="Mode of Shipment" id="ship_mode" value={form.Mode_of_Shipment}
                onChange={update('Mode_of_Shipment')}
                options={['Ship','Flight','Road'].map(v => ({ value: v, label: v }))} />
              <SelectField label="Product Importance" id="prod_imp" value={form.Product_importance}
                onChange={update('Product_importance')}
                options={['Low','Medium','High'].map(v => ({ value: v, label: v }))} />
              <SelectField label="Customer Gender" id="gender" value={form.Gender}
                onChange={update('Gender')}
                options={[{ value:'M', label:'Male' },{ value:'F', label:'Female' }]} />
            </div>

            <p className="section-label">Order &amp; Customer Info</p>
            <div className="form-grid-2">
              <NumberField label="Customer Care Calls" id="care_calls" value={form.Customer_care_calls}
                onChange={update('Customer_care_calls')} min={1} max={7} />
              <NumberField label="Customer Rating" id="rating" value={form.Customer_rating}
                onChange={update('Customer_rating')} min={1} max={5} />
              <NumberField label="Prior Purchases" id="prior" value={form.Prior_purchases}
                onChange={update('Prior_purchases')} min={1} max={10} />
              <NumberField label="Cost of Product" id="cost" value={form.Cost_of_the_Product}
                onChange={update('Cost_of_the_Product')} min={50} max={350} step={0.5} unit="USD" />
              <NumberField label="Discount Offered" id="discount" value={form.Discount_offered}
                onChange={update('Discount_offered')} min={0} max={65} step={0.5} unit="%" />
              <NumberField label="Weight" id="weight" value={form.Weight_in_gms}
                onChange={update('Weight_in_gms')} min={1000} max={7000} step={50} unit="gms" />
            </div>

            <div className="form-actions">
              <button type="button" className="btn-ghost"
                onClick={() => { setForm(DEFAULTS); setResult(null); setError(null) }}>
                Reset
              </button>
              <button type="submit" id="predict-btn" className="btn-primary" disabled={loading || !apiReady}>
                {loading ? <><span className="spinner" />Analyzing…</> : 'Get Prediction'}
              </button>
            </div>
          </form>
          {!apiReady && <p className="offline-note">Backend offline — start the FastAPI server on port 8000.</p>}
        </section>

        {/* Right column */}
        <aside className="right-col">
          {/* Result */}
          <div ref={resultRef}>
            {!result && !error && (
              <div className="panel result-empty">
                <div className="empty-ship">🚢</div>
                <h3>Awaiting Prediction</h3>
                <p>Fill in the form and click <strong>Get Prediction</strong>.</p>
              </div>
            )}
            {error && (
              <div className="panel result-panel error-panel" id="error-card">
                <div className="result-icon error-icon">!</div>
                <h3>Error</h3><p>{error}</p>
              </div>
            )}
            {result && (
              <div className={`panel result-panel ${isOnTime ? 'ontime-panel' : 'delayed-panel'}`} id="result-card">
                <div className={`result-icon ${isOnTime ? 'ontime-icon' : 'delayed-icon'}`}>
                  {isOnTime ? '✓' : '!'}
                </div>
                <div className="result-badge" id="result-badge">
                  {isOnTime ? 'EXPECTED ON TIME' : 'SHIPMENT DELAYED'}
                </div>
                <p className="result-msg">
                  {isOnTime
                    ? 'This shipment is predicted to arrive on time based on your logistics data.'
                    : 'This shipment is at risk of delay. Consider reviewing the order parameters.'}
                </p>
                <div className="prob-bars">
                  {[
                    { label: 'On Time', val: result.probability[1], color: '#10b981' },
                    { label: 'Delayed', val: result.probability[0], color: '#f97316' },
                  ].map(p => (
                    <div key={p.label} className="prob-row">
                      <div className="prob-meta">
                        <span>{p.label}</span>
                        <span style={{ color: p.color }}>{(p.val * 100).toFixed(1)}%</span>
                      </div>
                      <div className="prob-track">
                        <div className="prob-fill" style={{ width: `${p.val * 100}%`, background: p.color }} />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="result-chips">
                  <div className="result-chip">
                    <span>Confidence</span>
                    <strong>{(result.confidence * 100).toFixed(1)}%</strong>
                  </div>
                  <div className="result-chip">
                    <span>Status</span>
                    <strong id="prediction-value" style={{ color: isOnTime ? '#10b981' : '#f97316' }}>
                      {result.status}
                    </strong>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Feature importance */}
          <div className="panel insights-panel" id="insights">
            <div className="panel-header">
              <div className="panel-dot orange" />
              <h2 className="panel-title">Feature Importance</h2>
            </div>
            {FEATURE_IMPORTANCE.map(f => (
              <div className="feat-row" key={f.name}>
                <div className="feat-meta"><span>{f.name}</span><span className="feat-pct">{f.pct}%</span></div>
                <div className="feat-track"><div className="feat-fill" style={{ width: `${f.pct}%` }} /></div>
              </div>
            ))}
          </div>

          {/* Model info */}
          <div className="panel model-panel">
            <div className="panel-header">
              <div className="panel-dot purple" />
              <h2 className="panel-title">Model Info</h2>
            </div>
            <div className="model-grid">
              {[['Algorithm','Random Forest'],['Accuracy','67.4%'],['ROC-AUC','0.70'],['Training Set','8,799 rows']].map(([l,v]) => (
                <div className="model-item" key={l}>
                  <span className="model-label">{l}</span>
                  <span className="model-val">{v}</span>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </main>

      <footer className="footer">
        <div className="footer-inner">
          <span className="footer-brand">ShipmentSure</span>
          <span>© 2026 · Built with FastAPI + React · Machine Learning</span>
          <span className="footer-right">Logged in as {user?.email}</span>
        </div>
      </footer>
    </div>
  )
}

/* ── Protected Route ─── */
function ProtectedRoute({ children }) {
  const { isLoggedIn } = useAuth()
  return isLoggedIn ? children : <Navigate to="/login" replace />
}

/* ── App with Routes ─── */
export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login"     element={<Login />} />
        <Route path="/signup"    element={<Signup />} />
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/analytics" element={<ProtectedRoute><Analytics /></ProtectedRoute>} />
        <Route path="/profile"   element={<ProtectedRoute><Profile /></ProtectedRoute>} />
        <Route path="*"          element={<Navigate to="/login" replace />} />
      </Routes>
    </AuthProvider>
  )
}
