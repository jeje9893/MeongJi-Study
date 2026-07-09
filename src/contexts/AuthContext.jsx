import { createContext, useContext, useEffect, useState } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from '../firebase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined) // undefined=로딩, null=비로그인, User=로그인
  useEffect(() => {
    return onAuthStateChanged(auth, setUser)
  }, [])
  return <AuthContext.Provider value={user}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}
