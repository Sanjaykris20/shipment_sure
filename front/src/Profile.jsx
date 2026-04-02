import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import axios from 'axios'
import { useAuth, API } from './AuthContext'

const STATUS_COLOR = { 'On Time': '#10b981', 'Delayed': '#f97316' }

const LABEL_MAP = {
  Warehouse_block:     'Warehouse Block',
  Mode_of_Shipment:    'Shipment Mode',
  Customer_care_calls: 'Care Calls',
  Customer_rating:     'Rating',
  Cost_of_the_Product: 'Product Cost',
  Prior_purchases:     'Prior Purchases',
  Product_importance:  'Importance',
  Gender:              'Gender',
  Discount_offered:    'Discount',
  Weight_in_gms:       'Weight',
}

function Avatar({ name, size = 72 }) {
  const initials = name ? name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) : '?'
  return (
    <div className="profile-avatar" style={{ width: size, height: size, fontSize: size * 0.35 }}>
      {initials}
    </div>
  )
}

function StatBadge({ label, value, color }) {
  return (
    <div className="profile-stat-badge" style={{ borderColor: color + '40' }}>
      <span className="psb-val" style={{ color }}>{value}</span>
      <span className="psb-lbl">{label}</span>
    </div>
  )
}

export default function Profile() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [history,  setHistory]  = useState([])
  const [loading,  setLoading]  = useState(true)
  const [expanded, setExpanded] = useState(null)
  const [filter,   setFilter]   = useState('all')   // all | ontime | delayed
  const [search,   setSearch]   = useState('')

  useEffect(() => {
    const load = async () => {
      try {
        const r = await axios.get(`${API}/history`)
        setHistory(r.data)
      } catch {}
      finally { setLoading(false) }
    }
    load()
  }, [])

  const handleLogout = async () => { await logout(); navigate('/login') }

  const total   = history.length
  const ontime  = history.filter(h => h.status === 'On Time').length
  const delayed = total - ontime
  const avgConf = total ? (history.reduce((s, h) => s + h.confidence, 0) / total * 100).toFixed(1) : '—'

  const filtered = history.filter(h => {
    const matchFilter = filter === 'all' || (filter === 'ontime' && h.status === 'On Time') || (filter === 'delayed' && h.status === 'Delayed')
    const matchSearch = !search || h.status.toLowerCase().includes(search.toLowerCase()) ||
      h.created_at?.includes(search)
    return matchFilter && matchSearch
  })

  const memberSince = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
    : 'Recently'

  return (
    <div className="page-wrapper">
      {/* ── Header ── */}
      <div className="page-header">
        <div className="page-header-left">
          <Link to="/dashboard" className="back-btn">← Dashboard</Link>
          <div>
            <h1 className="page-title">My Profile</h1>
            <p className="page-sub">Your account info and prediction history</p>
          </div>
        </div>
        <Link to="/analytics" className="nav-pill-btn">View Analytics →</Link>
      </div>

      <div className="profile-grid">

        {/* ── LEFT: Profile Card ── */}
        <aside className="profile-sidebar">
          <div className="panel profile-card">
            <Avatar name={user?.name} />
            <h2 className="profile-name">{user?.name}</h2>
            <p className="profile-email">{user?.email}</p>
            <div className="profile-meta-pill">
              <span className="dot-green" />Member
            </div>

            <div className="profile-stats">
              <StatBadge label="Predictions" value={total}     color="#06b6d4" />
              <StatBadge label="On-Time"     value={ontime}    color="#10b981" />
              <StatBadge label="Delayed"     value={delayed}   color="#f97316" />
              <StatBadge label="Avg. Confidence" value={avgConf === '—' ? '—' : avgConf + '%'} color="#a855f7" />
            </div>

            <div className="profile-info-rows">
              <div className="pir"><span>Full Name</span><strong>{user?.name}</strong></div>
              <div className="pir"><span>Email</span><strong>{user?.email}</strong></div>
              <div className="pir"><span>Member Since</span><strong>{memberSince}</strong></div>
              <div className="pir"><span>Total Predictions</span><strong>{total}</strong></div>
            </div>

            <Link to="/analytics" className="profile-analytics-btn">
              📊 View Analytics
            </Link>

            <button className="profile-logout-btn" onClick={handleLogout}>
              Sign Out
            </button>
          </div>
        </aside>

        {/* ── RIGHT: History ── */}
        <main className="profile-main">
          <div className="panel history-panel">
            <div className="history-panel-header">
              <div className="panel-dot teal" />
              <h2 className="panel-title">Prediction History</h2>
              <span className="panel-sub">{total} total</span>
            </div>

            {/* Controls */}
            <div className="history-controls">
              <div className="hist-filters">
                {[['all','All'], ['ontime','On Time'], ['delayed','Delayed']].map(([v, l]) => (
                  <button key={v}
                    className={`hist-filter-btn ${filter === v ? 'active' : ''}`}
                    onClick={() => setFilter(v)}
                    style={filter === v ? { borderColor: v === 'ontime' ? '#10b981' : v === 'delayed' ? '#f97316' : '#06b6d4', color: v === 'ontime' ? '#10b981' : v === 'delayed' ? '#f97316' : '#06b6d4' } : {}}
                  >{l}</button>
                ))}
              </div>
              <input className="hist-search" placeholder="Search by date or status…"
                value={search} onChange={e => setSearch(e.target.value)} />
            </div>

            {/* History List */}
            {loading ? (
              <div className="hist-loading">
                <span className="spinner" /> Loading history…
              </div>
            ) : filtered.length === 0 ? (
              <div className="hist-empty-state">
                <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🔍</div>
                <h3>{total === 0 ? 'No predictions yet' : 'No results match your filter'}</h3>
                <p>{total === 0 ? 'Go to the dashboard and run your first prediction!' : 'Try changing the filter or search term.'}</p>
                {total === 0 && <Link to="/dashboard" className="btn-primary" style={{ marginTop:'1rem', textDecoration:'none', display:'inline-block' }}>Make a Prediction</Link>}
              </div>
            ) : (
              <div className="hist-list">
                {filtered.map((h, i) => {
                  const isOpen = expanded === h.id
                  const color  = STATUS_COLOR[h.status]
                  const date   = new Date(h.created_at)
                  const dateStr = date.toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' })
                  const timeStr = date.toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit' })

                  return (
                    <div className={`hist-entry ${isOpen ? 'open' : ''}`} key={h.id}>
                      <button className="hist-entry-header" onClick={() => setExpanded(isOpen ? null : h.id)}>
                        <div className="he-left">
                          <div className="he-num">#{total - i}</div>
                          <div className={`he-status-icon ${h.status === 'On Time' ? 'green' : 'orange'}`}>
                            {h.status === 'On Time' ? '✓' : '!'}
                          </div>
                          <div>
                            <div className="he-status" style={{ color }}>{h.status}</div>
                            <div className="he-date">{dateStr} · {timeStr}</div>
                          </div>
                        </div>
                        <div className="he-right">
                          <div className="he-conf-bar">
                            <div className="he-conf-fill"
                              style={{ width: `${h.confidence * 100}%`, background: color }} />
                          </div>
                          <span className="he-conf-pct" style={{ color }}>
                            {(h.confidence * 100).toFixed(1)}%
                          </span>
                          <span className="he-chevron">{isOpen ? '▲' : '▼'}</span>
                        </div>
                      </button>

                      {isOpen && h.inputs && (
                        <div className="hist-entry-body">
                          <p className="he-body-title">Shipment Parameters</p>
                          <div className="he-params-grid">
                            {Object.entries(h.inputs).map(([k, v]) => (
                              <div className="he-param" key={k}>
                                <span className="he-param-label">{LABEL_MAP[k] || k}</span>
                                <span className="he-param-value">
                                  {k === 'Cost_of_the_Product' ? `$${v}` :
                                   k === 'Discount_offered'    ? `${v}%` :
                                   k === 'Weight_in_gms'       ? `${v} g` : v}
                                </span>
                              </div>
                            ))}
                          </div>
                          <div className="he-result-row">
                            <div className="he-result-chip" style={{ borderColor: color + '50', background: color + '15' }}>
                              <span style={{ color }}>Result:</span>
                              <strong style={{ color }}>{h.status}</strong>
                            </div>
                            <div className="he-result-chip">
                              <span>Confidence:</span>
                              <strong>{(h.confidence * 100).toFixed(1)}%</strong>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
