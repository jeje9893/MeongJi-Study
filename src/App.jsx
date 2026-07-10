import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom'
import Home from './pages/Home'
import Quiz from './pages/Quiz'
import Manage from './pages/Manage'
import History from './pages/History'
import AuthGate from './components/AuthGate'
import MigrationWizard from './components/MigrationWizard'
import { DataProvider } from './contexts/DataContext'
import './App.css'

function App() {
  return (
    <BrowserRouter>
      <AuthGate>
        <DataProvider>
        <MigrationWizard>
          <div className="app">
            <main className="main-content">
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/quiz" element={<Quiz />} />
                <Route path="/manage" element={<Manage />} />
                <Route path="/history" element={<History />} />
              </Routes>
            </main>
            <nav className="bottom-nav">
              <NavLink to="/" end className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
                <span className="nav-icon">🏠</span>
                <span className="nav-label">홈</span>
              </NavLink>
              <NavLink to="/quiz" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
                <span className="nav-icon">❓</span>
                <span className="nav-label">퀴즈</span>
              </NavLink>
              <NavLink to="/manage" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
                <span className="nav-icon">📝</span>
                <span className="nav-label">문제관리</span>
              </NavLink>
              <NavLink to="/history" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
                <span className="nav-icon">📊</span>
                <span className="nav-label">기록</span>
              </NavLink>
            </nav>
          </div>
        </MigrationWizard>
        </DataProvider>
      </AuthGate>
    </BrowserRouter>
  )
}

export default App
