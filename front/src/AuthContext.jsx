import { createContext, useContext, useState, useEffect } from 'react'
import axios from 'axios'

export const API = window.location.origin.includes('localhost')
  ? 'http://localhost:8000'
  : window.location.origin
const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user,  setUser]  = useState(() => JSON.parse(localStorage.getItem('ss_user')  || 'null'))
  const [token, setToken] = useState(() => localStorage.getItem('ss_token') || null)

  // Axios default auth header
  useEffect(() => {
    if (token) axios.defaults.headers.common['Authorization'] = `Bearer ${token}`
    else       delete axios.defaults.headers.common['Authorization']
  }, [token])

  const signup = async (name, email, password) => {
    const res = await axios.post(`${API}/auth/register`, { name, email, password })
    return res.data
  }

  const login = async (email, password) => {
    const res = await axios.post(`${API}/auth/login`, { email, password })
    const { token: t, user: u } = res.data
    localStorage.setItem('ss_token', t)
    localStorage.setItem('ss_user',  JSON.stringify(u))
    setToken(t); setUser(u)
    return u
  }

  const logout = async () => {
    try { await axios.post(`${API}/auth/logout`) } catch {}
    localStorage.removeItem('ss_token')
    localStorage.removeItem('ss_user')
    setToken(null); setUser(null)
    delete axios.defaults.headers.common['Authorization']
  }

  return (
    <AuthContext.Provider value={{ user, token, login, logout, signup, isLoggedIn: !!user }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
