import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth'
import { auth } from '../firebase'

export default function Login() {
  async function handleLogin() {
    try {
      await signInWithPopup(auth, new GoogleAuthProvider())
    } catch (e) {
      if (e.code !== 'auth/popup-closed-by-user') {
        alert('로그인 실패: ' + e.message)
      }
    }
  }

  return (
    <div style={{
      height: '100vh', display: 'flex', flexDirection: 'column',
      justifyContent: 'center', alignItems: 'center', padding: 24, textAlign: 'center'
    }}>
      <div style={{ fontSize: 56, marginBottom: 16 }}>📚</div>
      <h1 className="page-title">나만의 퀴즈</h1>
      <p style={{ color: 'var(--text2)', marginBottom: 40, fontSize: 14, lineHeight: 1.8 }}>
        Google 계정으로 로그인하면<br />모든 기기에서 문제를 동기화할 수 있어요.
      </p>
      <button className="btn btn-primary" style={{ maxWidth: 240 }} onClick={handleLogin}>
        Google로 로그인
      </button>
    </div>
  )
}
