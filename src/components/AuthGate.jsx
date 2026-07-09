import { useAuth } from '../contexts/AuthContext'
import Login from '../pages/Login'

export default function AuthGate({ children }) {
  const user = useAuth()

  if (user === undefined) return (
    <div style={{
      height: '100vh', display: 'flex', justifyContent: 'center',
      alignItems: 'center', color: 'var(--text2)'
    }}>
      로딩 중...
    </div>
  )

  if (user === null) return <Login />

  return children
}
