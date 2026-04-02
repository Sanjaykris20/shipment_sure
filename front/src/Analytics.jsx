import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import axios from 'axios'
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  LineChart, Line, Area, AreaChart,
  RadialBarChart, RadialBar,
} from 'recharts'
import { useAuth, API } from './AuthContext'

const COLORS = { ontime: '#10b981', delayed: '#f97316', purple: '#a855f7', teal: '#06b6d4' }

const FEATURE_DATA = [
  { name: 'Discount Offered', importance: 92 },
  { name: 'Weight (gms)',     importance: 78 },
  { name: 'Prior Purchases',  importance: 71 },
  { name: 'Care Calls',       importance: 65 },
  { name: 'Cost of Product',  importance: 58 },
  { name: 'Rating',           importance: 44 },
]

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="chart-tooltip">
      {label && <p className="ct-label">{label}</p>}
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color || p.fill }}>
          {p.name}: <strong>{typeof p.value === 'number' ? p.value.toFixed ? p.value.toFixed(1) : p.value : p.value}</strong>
        </p>
      ))}
    </div>
  )
}

export default function Analytics() {
  const { user } = useAuth()
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const r = await axios.get(`${API}/history`)
        setHistory(r.data)
      } catch {
        // use demo data if no history
        setHistory([])
      } finally { setLoading(false) }
    }
    load()
  }, [])

  // Derived stats
  const total    = history.length
  const ontime   = history.filter(h => h.status === 'On Time').length
  const delayed  = total - ontime
  const avgConf  = total ? (history.reduce((s, h) => s + h.confidence, 0) / total * 100).toFixed(1) : 0

  // Pie data
  const pieData = [
    { name: 'On Time', value: ontime || 40, fill: COLORS.ontime },
    { name: 'Delayed', value: delayed || 60, fill: COLORS.delayed },
  ]

  // Timeline data — group by date
  const byDate = {}
  history.forEach(h => {
    const d = h.created_at?.slice(0, 10) || 'Unknown'
    if (!byDate[d]) byDate[d] = { date: d, ontime: 0, delayed: 0, total: 0 }
    byDate[d].total++
    if (h.status === 'On Time') byDate[d].ontime++
    else byDate[d].delayed++
  })
  const timelineData = Object.values(byDate).slice(-7)

  // Confidence distribution buckets
  const confBuckets = [
    { range: '50-60%', count: 0 }, { range: '60-70%', count: 0 },
    { range: '70-80%', count: 0 }, { range: '80-90%', count: 0 },
    { range: '90-100%', count: 0 },
  ]
  history.forEach(h => {
    const pct = h.confidence * 100
    if (pct < 60) confBuckets[0].count++
    else if (pct < 70) confBuckets[1].count++
    else if (pct < 80) confBuckets[2].count++
    else if (pct < 90) confBuckets[3].count++
    else confBuckets[4].count++
  })

  // Radial stats
  const radialData = [
    { name: 'On-Time Rate', value: total ? Math.round(ontime / total * 100) : 40, fill: COLORS.ontime },
    { name: 'Avg Confidence', value: parseFloat(avgConf) || 67, fill: COLORS.teal },
  ]

  const isEmpty = total === 0

  return (
    <div className="page-wrapper">
      {/* ── Header ── */}
      <div className="page-header">
        <div className="page-header-left">
          <Link to="/dashboard" className="back-btn">← Dashboard</Link>
          <div>
            <h1 className="page-title">Prediction Analytics</h1>
            <p className="page-sub">Visual insights from your shipment predictions</p>
          </div>
        </div>
        <Link to="/profile" className="nav-pill-btn">View Profile →</Link>
      </div>

      {isEmpty && (
        <div className="empty-analytics">
          <div className="empty-icon">📊</div>
          <h3>No predictions yet</h3>
          <p>Run some predictions on the dashboard first — your analytics will appear here.</p>
          <Link to="/dashboard" className="btn-primary" style={{ display:'inline-block', textDecoration:'none', marginTop:'1rem' }}>
            Go Run a Prediction
          </Link>
        </div>
      )}

      {/* ── KPI Row ── */}
      <div className="analytics-kpis">
        {[
          { label: 'Total Predictions', val: total || '—', color: COLORS.teal,    icon: '🔮' },
          { label: 'On-Time',           val: ontime || '—', color: COLORS.ontime, icon: '✓'  },
          { label: 'Delayed',           val: delayed || '—', color: COLORS.delayed, icon: '!'  },
          { label: 'Avg. Confidence',   val: total ? avgConf + '%' : '—', color: COLORS.purple, icon: '%' },
        ].map(k => (
          <div className="analytics-kpi" key={k.label}>
            <div className="kpi-icon" style={{ color: k.color, borderColor: k.color }}>{k.icon}</div>
            <div>
              <div className="kpi-val" style={{ color: k.color }}>{k.val}</div>
              <div className="kpi-lbl">{k.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Charts Grid ── */}
      <div className="charts-grid">

        {/* Donut — On-Time vs Delayed */}
        <div className="chart-card wide-half">
          <div className="chart-header">
            <div className="panel-dot teal" />
            <h3>On-Time vs Delayed</h3>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" innerRadius={65} outerRadius={100}
                dataKey="value" paddingAngle={4} label={({ name, percent }) => `${name} ${(percent*100).toFixed(0)}%`}
                labelLine={false}>
                {pieData.map((entry, i) => <Cell key={i} fill={entry.fill} stroke="none" />)}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          <div className="pie-legend">
            <div className="pie-leg-item"><span style={{ background: COLORS.ontime }} />On Time</div>
            <div className="pie-leg-item"><span style={{ background: COLORS.delayed }} />Delayed</div>
          </div>
        </div>

        {/* Radial — Rate + Confidence */}
        <div className="chart-card wide-half">
          <div className="chart-header">
            <div className="panel-dot orange" />
            <h3>Performance Gauges</h3>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <RadialBarChart cx="50%" cy="50%" innerRadius="30%" outerRadius="90%"
              data={radialData} startAngle={180} endAngle={0}>
              <RadialBar dataKey="value" cornerRadius={8} background={{ fill: 'rgba(255,255,255,0.05)' }} />
              <Tooltip content={<CustomTooltip />} formatter={v => `${v}%`} />
              <Legend iconType="circle" />
            </RadialBarChart>
          </ResponsiveContainer>
        </div>

        {/* Area — Timeline */}
        <div className="chart-card full-width">
          <div className="chart-header">
            <div className="panel-dot purple" />
            <h3>Predictions Over Time</h3>
            <span className="chart-sub">Last 7 days activity</span>
          </div>
          {timelineData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={timelineData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="gOntime" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COLORS.ontime} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={COLORS.ontime} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gDelayed" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COLORS.delayed} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={COLORS.delayed} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="ontime" name="On Time" stroke={COLORS.ontime}
                  fill="url(#gOntime)" strokeWidth={2} />
                <Area type="monotone" dataKey="delayed" name="Delayed" stroke={COLORS.delayed}
                  fill="url(#gDelayed)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="chart-empty">Make predictions to see your timeline here</div>
          )}
        </div>

        {/* Bar — Feature Importance */}
        <div className="chart-card wide-half">
          <div className="chart-header">
            <div className="panel-dot teal" />
            <h3>Feature Importance</h3>
            <span className="chart-sub">ML model weights</span>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={FEATURE_DATA} layout="vertical" margin={{ top: 0, right: 20, left: 20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" horizontal={false} />
              <XAxis type="number" domain={[0, 100]} tick={{ fill: '#94a3b8', fontSize: 11 }}
                tickFormatter={v => `${v}%`} />
              <YAxis type="category" dataKey="name" tick={{ fill: '#e2e8f0', fontSize: 11 }} width={110} />
              <Tooltip content={<CustomTooltip />} formatter={v => `${v}%`} />
              <Bar dataKey="importance" name="Importance" radius={[0, 4, 4, 0]}>
                {FEATURE_DATA.map((_, i) => (
                  <Cell key={i} fill={`hsl(${180 + i * 20}, 70%, 55%)`} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Bar — Confidence Distribution */}
        <div className="chart-card wide-half">
          <div className="chart-header">
            <div className="panel-dot orange" />
            <h3>Confidence Distribution</h3>
            <span className="chart-sub">Score breakdown</span>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={confBuckets} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="range" tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="count" name="Predictions" fill={COLORS.purple} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

      </div>
    </div>
  )
}
