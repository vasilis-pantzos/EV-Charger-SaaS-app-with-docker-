import { createContext, useContext, useState } from 'react'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('saasplug_user')
    return saved ? JSON.parse(saved) : null
  })

  const login = (username, password) => {
    let role, name

    if (username === 'admin' && password === 'admin') {
      role = 'admin'
      name = 'Admin'
    } else if (username.toLowerCase().includes('plug') && password === username) {
      role = 'provider'
      name = username
    } else {
      role = 'user'
      name = username
    }

    const u = { role, name }
    setUser(u)
    localStorage.setItem('saasplug_user', JSON.stringify(u))
    return role
  }

  const logout = () => {
    setUser(null)
    localStorage.removeItem('saasplug_user')
  }

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
