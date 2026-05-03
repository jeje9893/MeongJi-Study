import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import { db } from '../db'

function getStreak(records) {
  if (!records.length) return 0
  const dates = [...new Set(records.map(r => r.date))].sort().reverse()
  const today = new Date().toISOString().slice(0, 10)
  if (dates[0] !== today && dates[0] !== getPrevDate(today)) return 0
  let streak = 1
  for (let i = 1; i < dates.length; i++) {
    if (dates[i] === getPrevDate(dates[i - 1])) streak++
    else break
  }
  return streak
}

function getPrevDate(dateStr) {
  const d = new Date(dateStr)
  d.setDate(d.getDate() - 1)
  return d.toISOString().slice(0, 10)
}

// 한달 전 날짜 구하기
function getDateMonthAgo() {
  const d = new Date()
  d.setMonth(d.getMonth() - 1)
  return d.toISOString().slice(0, 10)
}

export default function Home() {
  const navigate = useNavigate()
  const quizzes = useLiveQuery(() => db.quizzes.toArray(), [])
  const records = useLiveQuery(() => db.records.toArray(), [])

  const today = new Date().toISOString().slice(0, 10)
  const todayRecords = records?.filter(r => r.date === today) || []
  const completedToday = todayRecords.length > 0
  const streak = getStreak(records || [])

  const totalQuizzes = quizzes?.length || 0
  const correctRate = records?.length
    ? Math.round((records.filter(r => r.isCorrect).length / records.length) * 100)
    : 0

  // 복습 알림: 한달 전 이전에 마지막으로 푼 문제들
  const monthAgo = getDateMonthAgo()
  const reviewQuizIds = (() => {
    if (!records || !quizzes) return []
    // 각 문제별 마지막으로 푼 날짜
    const lastDateMap = {}
    records.forEach(r => {
      if (!lastDateMap[r.quizId] || r.date > lastDateMap[r.quizId]) {
        lastDateMap[r.quizId] = r.date
      }
    })
    // 한달 전 이전에 마지막으로 푼 문제
    return Object.entries(lastDateMap)
      .filter(([, date]) => date <= monthAgo)
      .map(([id]) => parseInt(id))
  })()

  const reviewCount = reviewQuizIds.length

  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <p style={{ color: 'var(--text2)', fontSize: 14, marginBottom: 4 }}>
          {new Date().toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'long' })}
        </p>
        <h1 className="page-title">나만의 퀴즈 📚</h1>
      </div>

      {/* 복습 알림 배너 */}
      {reviewCount > 0 && (
        <div
          className="card"
          style={{
            marginBottom: 16,
            background: 'linear-gradient(135deg, #1e1b4b, #1e293b)',
            border: '1px solid rgba(167,139,250,0.3)',
            cursor: 'pointer'
          }}
          onClick={() => navigate('/quiz')}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ fontSize: 32 }}>🔔</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, color: '#c4b5fd', marginBottom: 3 }}>
                복습할 문제가 있어요!
              </div>
              <div style={{ fontSize: 13, color: 'var(--text2)' }}>
                한달 이상 안 푼 문제 <b style={{ color: '#c4b5fd' }}>{reviewCount}개</b> — 퀴즈에서 만나요
              </div>
            </div>
            <div style={{ fontSize: 18, color: '#c4b5fd' }}>→</div>
          </div>
        </div>
      )}

      {/* Streak */}
      <div className="card" style={{ marginBottom: 16, background: streak > 0 ? 'linear-gradient(135deg, #064e3b, #1e293b)' : 'var(--bg2)', border: streak > 0 ? '1px solid rgba(110,231,183,0.2)' : undefined }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ fontSize: 40 }}>🔥</div>
          <div>
            <div style={{ fontSize: 28, fontFamily: 'Space Mono', fontWeight: 700, color: 'var(--accent)' }}>{streak}일</div>
            <div style={{ fontSize: 13, color: 'var(--text2)' }}>연속 학습 중</div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
        <div className="card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 28, fontFamily: 'Space Mono', fontWeight: 700 }}>{totalQuizzes}</div>
          <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 4 }}>총 문제 수</div>
        </div>
        <div className="card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 28, fontFamily: 'Space Mono', fontWeight: 700, color: correctRate >= 70 ? 'var(--accent)' : 'var(--warning)' }}>{correctRate}%</div>
          <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 4 }}>전체 정답률</div>
        </div>
      </div>

      {/* Today status */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>오늘의 퀴즈</div>
            <div style={{ fontSize: 13, color: 'var(--text2)' }}>
              {completedToday ? `${todayRecords.length}문제 완료 ✅` : '아직 시작 안 함'}
            </div>
          </div>
          {completedToday && (
            <div style={{ fontSize: 13, color: 'var(--accent)' }}>
              정답 {todayRecords.filter(r => r.isCorrect).length}/{todayRecords.length}
            </div>
          )}
        </div>
      </div>

      {totalQuizzes === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">✏️</div>
          <p>문제를 먼저 추가해보세요!</p>
          <br />
          <button className="btn btn-primary" style={{ maxWidth: 200, margin: '0 auto' }} onClick={() => navigate('/manage')}>
            문제 추가하기
          </button>
        </div>
      ) : (
        <button className="btn btn-primary" onClick={() => navigate('/quiz')}>
          {completedToday ? '다시 풀기 🔄' : '오늘의 퀴즈 시작 🚀'}
        </button>
      )}
    </div>
  )
}
