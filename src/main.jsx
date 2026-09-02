import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './swUpdate' // 서비스워커 제어권 변경 추적 (업데이트 적용용)
import App from './App.jsx'
import { AuthProvider } from './contexts/AuthContext.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>,
)
