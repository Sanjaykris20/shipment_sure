import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from './AuthContext'
import axios from 'axios'

export default function Login() {
  const { login } = useAuth()
  const navigate  = useNavigate()
  const [form,    setForm]    = useState({ email: '', password: '' })
  const [error,   setError]   = useState('')
  const [loading, setLoading] = useState(false)
  const [showPw,  setShowPw]  = useState(false)

  const set = k => e => setForm(p => ({ ...p, [k]: e.target.value }))

  const handleSubmit = async e => {
    e.preventDefault(); setError('')
    if (!form.email || !form.password) { setError('Please fill in all fields.'); return }
    setLoading(true)
    try {
      await login(form.email, form.password)
      navigate('/dashboard')
    } catch (err) {
      setError(err.response?.data?.detail || 'Login failed. Check your credentials.')
    } finally { setLoading(false) }
  }

  return (
    <div className="auth-page">
      {/* ── Left branding panel ── */}
      <div className="auth-left">
        <div className="auth-bg-overlay" />
        <div className="auth-left-inner">
          <div className="auth-logo-row">
            <div className="brand-icon">S</div>
            <div>
              <span className="brand-name">ShipmentSure</span>
              <span className="brand-tag">Delivery Intelligence</span>
            </div>
          </div>
          <h2 className="auth-headline">Smart Logistics<br />Starts Here</h2>
          <p className="auth-tagline">
            Predict on-time delivery with AI — powered by machine learning trained on 11K+ real shipments.
          </p>
          <div className="auth-chips">
            {['ML Prediction', 'Real-time Analytics', 'Supply Chain AI'].map(t => (
              <span key={t} className="auth-chip">{t}</span>
            ))}
          </div>
          <div className="auth-kpis">
            {[['10,999', 'Shipments'], ['67.4%', 'Accuracy'], ['3', 'Models Compared']].map(([v,l]) => (
              <div key={l} className="auth-kpi">
                <strong>{v}</strong>
                <span>{l}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Right form panel ── */}
      <div className="auth-right">
        <div className="auth-card" id="login-card">
          <h1 className="auth-form-title">Welcome Back</h1>
          <p className="auth-form-sub">Sign in to access your prediction dashboard</p>

          {error && <div className="auth-alert" id="login-error"><span>!</span>{error}</div>}

          <form onSubmit={handleSubmit} id="login-form" noValidate>
            <div className="auth-field" id="email-field">
              <label htmlFor="login-email">Email Address</label>
              <div className="input-wrap">
                <span className="inp-icon">✉</span>
                <input id="login-email" type="email" placeholder="you@example.com"
                  value={form.email} onChange={set('email')} autoComplete="email" />
              </div>
            </div>

            <div className="auth-field" id="password-field">
              <label htmlFor="login-password">Password</label>
              <div className="input-wrap">
                <span className="inp-icon">🔒</span>
                <input id="login-password" type={showPw ? 'text' : 'password'}
                  placeholder="Your password"
                  value={form.password} onChange={set('password')} autoComplete="current-password" />
                <button type="button" className="pw-toggle" onClick={() => setShowPw(p => !p)}>
                  {showPw ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            <button type="submit" id="login-btn" className="auth-submit-btn" disabled={loading}>
              {loading ? <><span className="spinner" /> Signing in…</> : 'Sign In →'}
            </button>
          </form>

          <div className="auth-divider"><span>Don't have an account?</span></div>

          <Link to="/signup" className="auth-alt-btn" id="go-signup">
            Create Account
          </Link>
        </div>
      </div>
    </div>
  )
}
