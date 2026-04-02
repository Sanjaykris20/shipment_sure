import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from './AuthContext'

export default function Signup() {
  const { signup } = useAuth()
  const navigate   = useNavigate()
  const [form,    setForm]    = useState({ name: '', email: '', password: '', confirm: '' })
  const [error,   setError]   = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPw,  setShowPw]  = useState(false)

  const set = k => e => setForm(p => ({ ...p, [k]: e.target.value }))

  const validate = () => {
    if (!form.name.trim() || form.name.trim().length < 2) return 'Name must be at least 2 characters.'
    if (!form.email.includes('@')) return 'Enter a valid email address.'
    if (form.password.length < 6) return 'Password must be at least 6 characters.'
    if (form.password !== form.confirm) return 'Passwords do not match.'
    return null
  }

  const handleSubmit = async e => {
    e.preventDefault(); setError(''); setSuccess('')
    const err = validate()
    if (err) { setError(err); return }
    setLoading(true)
    try {
      await signup(form.name.trim(), form.email, form.password)
      setSuccess('Account created! Redirecting to login…')
      setTimeout(() => navigate('/login'), 1800)
    } catch (err) {
      setError(err.response?.data?.detail || 'Registration failed. Please try again.')
    } finally { setLoading(false) }
  }

  const strength = pw => {
    if (!pw) return 0
    let s = 0
    if (pw.length >= 6)  s++
    if (pw.length >= 10) s++
    if (/[A-Z]/.test(pw)) s++
    if (/[0-9]/.test(pw)) s++
    if (/[^A-Za-z0-9]/.test(pw)) s++
    return Math.min(s, 4)
  }
  const pwStrength  = strength(form.password)
  const strengthLbl = ['', 'Weak', 'Fair', 'Good', 'Strong'][pwStrength]
  const strengthClr = ['', '#ef4444', '#f97316', '#eab308', '#10b981'][pwStrength]

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
          <h2 className="auth-headline">Join the<br />Smart Logistics<br />Revolution</h2>
          <p className="auth-tagline">
            Create your free account and start predicting on-time delivery in seconds.
          </p>
          <div className="auth-steps">
            {[
              ['01', 'Create your account'],
              ['02', 'Fill in shipment details'],
              ['03', 'Get instant AI prediction'],
            ].map(([n, t]) => (
              <div key={n} className="auth-step">
                <div className="step-num">{n}</div>
                <span>{t}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Right form panel ── */}
      <div className="auth-right">
        <div className="auth-card" id="signup-card">
          <h1 className="auth-form-title">Create Account</h1>
          <p className="auth-form-sub">Free forever — no credit card required</p>

          {error   && <div className="auth-alert"   id="signup-error"><span>!</span>{error}</div>}
          {success && <div className="auth-success"  id="signup-success"><span>✓</span>{success}</div>}

          <form onSubmit={handleSubmit} id="signup-form" noValidate>
            <div className="auth-field">
              <label htmlFor="signup-name">Full Name</label>
              <div className="input-wrap">
                <span className="inp-icon">👤</span>
                <input id="signup-name" type="text" placeholder="John Smith"
                  value={form.name} onChange={set('name')} autoComplete="name" />
              </div>
            </div>

            <div className="auth-field">
              <label htmlFor="signup-email">Email Address</label>
              <div className="input-wrap">
                <span className="inp-icon">✉</span>
                <input id="signup-email" type="email" placeholder="you@example.com"
                  value={form.email} onChange={set('email')} autoComplete="email" />
              </div>
            </div>

            <div className="auth-field">
              <label htmlFor="signup-password">Password</label>
              <div className="input-wrap">
                <span className="inp-icon">🔒</span>
                <input id="signup-password" type={showPw ? 'text' : 'password'}
                  placeholder="Min. 6 characters"
                  value={form.password} onChange={set('password')} autoComplete="new-password" />
                <button type="button" className="pw-toggle" onClick={() => setShowPw(p => !p)}>
                  {showPw ? 'Hide' : 'Show'}
                </button>
              </div>
              {form.password && (
                <div className="pw-strength">
                  <div className="pw-bar-track">
                    <div className="pw-bar-fill"
                      style={{ width: `${pwStrength * 25}%`, background: strengthClr }} />
                  </div>
                  <span style={{ color: strengthClr }}>{strengthLbl}</span>
                </div>
              )}
            </div>

            <div className="auth-field">
              <label htmlFor="signup-confirm">Confirm Password</label>
              <div className="input-wrap">
                <span className="inp-icon">🔒</span>
                <input id="signup-confirm" type={showPw ? 'text' : 'password'}
                  placeholder="Re-enter password"
                  value={form.confirm} onChange={set('confirm')} autoComplete="new-password" />
                {form.confirm && (
                  <span className="pw-match-icon" style={{
                    color: form.password === form.confirm ? '#10b981' : '#ef4444'
                  }}>
                    {form.password === form.confirm ? '✓' : '✗'}
                  </span>
                )}
              </div>
            </div>

            <button type="submit" id="signup-btn" className="auth-submit-btn" disabled={loading}>
              {loading ? <><span className="spinner" /> Creating Account…</> : 'Create Account →'}
            </button>
          </form>

          <div className="auth-divider"><span>Already have an account?</span></div>
          <Link to="/login" className="auth-alt-btn" id="go-login">Sign In</Link>
        </div>
      </div>
    </div>
  )
}
