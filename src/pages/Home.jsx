import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import { db } from '../db'

function getStreak(records) {
  if (!records.length) return 0
  const studyRecords = records.filter(r => !r.isReview)
  const dates = [...new Set(studyRecords.map(r => r.date))].sort().reverse()
  if (!dates.length) return 0
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

function getMonthAgo() {
  const d = new Date()
  d.setMonth(d.getMonth() - 1)
  return d.toISOString().slice(0, 10)
}

export default function Home() {
  const navigate = useNavigate()
  const quizzes = useLiveQuery(() => db.quizzes.toArray(), [])
  const records = useLiveQuery(() => db.records.toArray(), [])

  const today = new Date().toISOString().slice(0, 10)
  const studyRecords = records?.filter(r => !r.isReview) || []
  const todayRecords = studyRecords.filter(r => r.date === today)
  const completedToday = todayRecords.length > 0
  const streak = getStreak(records || [])

  const totalQuizzes = quizzes?.length || 0
  const correctRate = studyRecords.length
    ? Math.round((studyRecords.filter(r => r.isCorrect).length / studyRecords.length) * 100)
    : 0

  // 복습 알림: History와 동일하게 날짜 카드 단위로 계산
  const monthAgo = getMonthAgo()
  const overdueCount = (() => {
    if (!records) return 0

    // 날짜별 문제 그룹 (일반 학습만)
    const byDate = {}
    studyRecords.forEach(r => {
      if (!byDate[r.date]) byDate[r.date] = []
      byDate[r.date].push(r)
    })

    // quizId별 마지막 복습 날짜
    const lastReviewDateMap = {}
    records.filter(r => r.isReview).forEach(r => {
      if (!lastReviewDateMap[r.quizId] || r.date > lastReviewDateMap[r.quizId]) {
        lastReviewDateMap[r.quizId] = r.date
      }
    })

    // 날짜 카드 단위로 overdue 여부 계산 (History와 동일 로직)
    return Object.entries(byDate).filter(([date, recs]) => {
      const quizIds = [...new Set(recs.map(r => r.quizId))]
      const reviewDates = quizIds.map(id => lastReviewDateMap[id]).filter(Boolean)
      const allReviewed = reviewDates.length === quizIds.length
      const latestReviewDate = reviewDates.length > 0
        ? reviewDates.reduce((a, b) => a > b ? a : b)
        : null
      const referenceDate = allReviewed ? latestReviewDate : date
      return referenceDate <= monthAgo
    }).length
  })()

  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <p style={{ color: 'var(--text2)', fontSize: 14, marginBottom: 4 }}>
          {new Date().toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'long' })}
        </p>
        <h1 className="page-title">나만의 퀴즈 📚</h1>
      </div>

      {/* 복습 알림 배너 */}
      {overdueCount > 0 && (
        <div
          className="card"
          style={{
            marginBottom: 16,
            background: 'linear-gradient(135deg, #3b0f0f, #1e293b)',
            border: '1px solid rgba(248,113,113,0.35)',
            cursor: 'pointer'
          }}
          onClick={() => navigate('/history')}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ fontSize: 32 }}>🔴</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, color: '#fca5a5', marginBottom: 3 }}>
                복습할 문제가 있어요!
              </div>
              <div style={{ fontSize: 13, color: 'var(--text2)' }}>
                한달 이상 안 푼 문제 <b style={{ color: '#fca5a5' }}>{overdueCount}개</b> — 복습 탭에서 확인하세요
              </div>
            </div>
            <div style={{ fontSize: 18, color: '#fca5a5' }}>→</div>
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
