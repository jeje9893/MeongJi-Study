import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useCollection } from '../hooks/useCollection'
import { addRecord, bulkDeleteRecords } from '../db'

const TODAY = new Date().toISOString().slice(0, 10)

function getMonthAgo() {
  const d = new Date()
  d.setMonth(d.getMonth() - 1)
  return d.toISOString().slice(0, 10)
}

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('ko-KR', {
    month: 'long', day: 'numeric', weekday: 'short'
  })
}

// 복습 세션 플레이어
function ReviewPlayer({ quizzes, sessionDate, onDone, uid }) {
  const [idx, setIdx] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [results, setResults] = useState([])

  const current = quizzes[idx]

  async function handleAnswer(isCorrect) {
    await addRecord(uid, { quizId: current.id, date: TODAY, isCorrect, isReview: true })

    const newResults = [...results, { quiz: current, isCorrect }]
    setResults(newResults)

    if (idx + 1 >= quizzes.length) {
      onDone(newResults)
    } else {
      setIdx(idx + 1)
      setRevealed(false)
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: 13, color: 'var(--text2)' }}>
          📅 {formatDate(sessionDate)} 복습
        </div>
        <span className="badge">{idx + 1} / {quizzes.length}</span>
      </div>

      <div style={{ height: 4, background: 'var(--bg3)', borderRadius: 2, marginBottom: 28 }}>
        <div style={{
          height: '100%',
          width: `${(idx / quizzes.length) * 100}%`,
          background: 'var(--accent)',
          borderRadius: 2,
          transition: 'width 0.3s'
        }} />
      </div>

      {current.category && (
        <div style={{ marginBottom: 12 }}>
          <span className="badge">{current.category}</span>
        </div>
      )}

      <div className="card" style={{ marginBottom: 20, minHeight: 140, display: 'flex', alignItems: 'center' }}>
        <p style={{ fontSize: 18, lineHeight: 1.7, fontWeight: 500, whiteSpace: 'pre-wrap' }}>{current.question}</p>
      </div>

      {!revealed ? (
        <button className="btn btn-secondary" onClick={() => setRevealed(true)}>정답 보기 👀</button>
      ) : (
        <div>
          <div className="card" style={{ marginBottom: 20, borderColor: 'rgba(110,231,183,0.3)', background: 'rgba(110,231,183,0.05)' }}>
            <div style={{ fontSize: 12, color: 'var(--accent)', marginBottom: 8, fontWeight: 600 }}>정답</div>
            <p style={{ fontSize: 17, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{current.answer}</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <button className="btn" style={{ background: 'rgba(248,113,113,0.15)', color: 'var(--danger)' }} onClick={() => handleAnswer(false)}>❌ 틀렸어</button>
            <button className="btn" style={{ background: 'rgba(110,231,183,0.15)', color: 'var(--accent)' }} onClick={() => handleAnswer(true)}>✅ 맞았어</button>
          </div>
        </div>
      )}
    </div>
  )
}

// 복습 완료 결과
function ReviewResult({ results, onBack }) {
  const correct = results.filter(r => r.isCorrect).length
  const pct = Math.round((correct / results.length) * 100)
  return (
    <div>
      <h1 className="page-title">복습 완료 🎉</h1>
      <div className="card" style={{ textAlign: 'center', marginBottom: 24, padding: '36px 20px' }}>
        <div style={{ fontSize: 64, fontFamily: 'Space Mono', fontWeight: 700, color: pct >= 70 ? 'var(--accent)' : 'var(--warning)' }}>{pct}%</div>
        <div style={{ color: 'var(--text2)', marginTop: 8 }}>{results.length}문제 중 {correct}개 정답</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
        {results.map((r, i) => (
          <div key={i} className="card" style={{ display: 'flex', gap: 12, alignItems: 'flex-start', borderLeft: `3px solid ${r.isCorrect ? 'var(--accent)' : 'var(--danger)'}` }}>
            <span style={{ fontSize: 18 }}>{r.isCorrect ? '✅' : '❌'}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, marginBottom: 4, whiteSpace: 'pre-wrap' }}>{r.quiz.question}</div>
              <div style={{ fontSize: 13, color: 'var(--text2)', whiteSpace: 'pre-wrap' }}>정답: {r.quiz.answer}</div>
            </div>
          </div>
        ))}
      </div>
      <button className="btn btn-primary" onClick={onBack}>목록으로 돌아가기</button>
    </div>
  )
}

export default function History() {
  const user = useAuth()
  const records = useCollection(`users/${user.uid}/records`)
  const quizzes = useCollection(`users/${user.uid}/quizzes`)

  const [reviewSession, setReviewSession] = useState(null)
  const [reviewResults, setReviewResults] = useState(null)

  if (!records || !quizzes) return null

  const quizMap = Object.fromEntries(quizzes.map(q => [q.id, q]))
  const monthAgo = getMonthAgo()

  const studyRecords = records.filter(r => !r.isReview)
  const byDate = {}
  studyRecords.forEach(r => {
    if (!byDate[r.date]) byDate[r.date] = []
    byDate[r.date].push(r)
  })
  const dates = Object.keys(byDate).sort().reverse()

  const lastReviewDateMap = {}
  records.filter(r => r.isReview).forEach(r => {
    if (!lastReviewDateMap[r.quizId] || r.date > lastReviewDateMap[r.quizId]) {
      lastReviewDateMap[r.quizId] = r.date
    }
  })

  function getDateReviewStatus(date, recs) {
    const quizIds = [...new Set(recs.map(r => r.quizId))]

    const reviewDates = quizIds
      .map(id => lastReviewDateMap[id])
      .filter(Boolean)

    const allReviewed = reviewDates.length === quizIds.length
    const latestReviewDate = reviewDates.length > 0
      ? reviewDates.reduce((a, b) => a > b ? a : b)
      : null

    const referenceDate = allReviewed ? latestReviewDate : date
    const isOverdue = referenceDate <= monthAgo

    const refMs = new Date(referenceDate).getTime()
    const todayMs = new Date(TODAY).getTime()
    const daysSince = Math.floor((todayMs - refMs) / (1000 * 60 * 60 * 24))

    return {
      total: quizIds.length,
      isOverdue,
      allReviewed,
      latestReviewDate,
      daysSince,
    }
  }

  function handleStartReview(date, recs) {
    const quizIds = [...new Set(recs.map(r => r.quizId))]
    const sessionQuizzes = quizIds.map(id => quizMap[id]).filter(Boolean)
    setReviewSession({ date, quizzes: sessionQuizzes })
    setReviewResults(null)
  }

  async function handleDeleteDate(date, recs) {
    if (!confirm(`${formatDate(date)} 기록을 삭제할까요?`)) return
    const ids = recs.map(r => r.id)
    await bulkDeleteRecords(user.uid, ids)
  }

  function handleReviewDone(results) {
    setReviewResults(results)
    setReviewSession(null)
  }

  if (reviewSession) {
    return (
      <ReviewPlayer
        quizzes={reviewSession.quizzes}
        sessionDate={reviewSession.date}
        onDone={handleReviewDone}
        uid={user.uid}
      />
    )
  }

  if (reviewResults) {
    return <ReviewResult results={reviewResults} onBack={() => setReviewResults(null)} />
  }

  if (records.length === 0) return (
    <div className="empty-state">
      <div className="empty-icon">📊</div>
      <p>아직 학습 기록이 없어요</p>
    </div>
  )

  const correctRate = Math.round(studyRecords.filter(r => r.isCorrect).length / studyRecords.length * 100)

  const overdueDateCount = dates.filter(date => {
    const { isOverdue } = getDateReviewStatus(date, byDate[date])
    return isOverdue
  }).length

  return (
    <div>
      <h1 className="page-title">복습</h1>

      {/* 전체 통계 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 24 }}>
        {[
          { label: '총 학습일', value: dates.length + '일' },
          { label: '총 문제', value: studyRecords.length + '개' },
          { label: '정답률', value: correctRate + '%' }
        ].map(s => (
          <div key={s.label} className="card" style={{ textAlign: 'center', padding: '14px 8px' }}>
            <div style={{ fontSize: 20, fontFamily: 'Space Mono', fontWeight: 700, color: 'var(--accent)' }}>{s.value}</div>
            <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 4 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* 복습 필요 안내 */}
      {overdueDateCount > 0 && (
        <div className="card" style={{ marginBottom: 20, borderColor: 'rgba(248,113,113,0.3)', background: 'rgba(248,113,113,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 20 }}>🔴</span>
            <div>
              <div style={{ fontWeight: 600, color: 'var(--danger)', fontSize: 14 }}>복습이 필요한 날짜 {overdueDateCount}개</div>
              <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>한달 이상 복습 안 한 문제가 있어요</div>
            </div>
          </div>
        </div>
      )}

      {/* 날짜별 목록 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {dates.map(date => {
          const recs = byDate[date]
          const correct = recs.filter(r => r.isCorrect).length
          const pct = Math.round(correct / recs.length * 100)
          const { isOverdue, allReviewed, latestReviewDate, daysSince, total } = getDateReviewStatus(date, recs)

          return (
            <div
              key={date}
              className="card"
              style={{
                borderColor: isOverdue ? 'rgba(248,113,113,0.4)' : undefined,
                background: isOverdue ? 'rgba(248,113,113,0.03)' : undefined
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                <div>
                  <div style={{ fontWeight: 500, marginBottom: 3, display: 'flex', alignItems: 'center', gap: 6 }}>
                    {isOverdue && <span style={{ fontSize: 12 }}>🔴</span>}
                    {formatDate(date)}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text2)' }}>
                    {total}문제
                    {isOverdue && (
                      <span style={{ color: 'var(--danger)', marginLeft: 6 }}>· 복습 필요</span>
                    )}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontFamily: 'Space Mono', fontWeight: 700, fontSize: 20, color: pct >= 70 ? 'var(--accent)' : 'var(--warning)' }}>{pct}%</div>
                  <div style={{ fontSize: 12, color: 'var(--text2)' }}>{correct}/{recs.length}</div>
                </div>
              </div>

              <div style={{ fontSize: 12, color: isOverdue ? 'var(--danger)' : 'var(--text2)', marginBottom: 10 }}>
                {allReviewed && latestReviewDate
                  ? `마지막 복습: ${formatDate(latestReviewDate)} · ${daysSince}일 전`
                  : `${daysSince}일 전 학습`
                }
              </div>

              <div style={{ height: 3, background: 'var(--bg3)', borderRadius: 2, marginBottom: 12 }}>
                <div style={{ height: '100%', width: `${pct}%`, background: pct >= 70 ? 'var(--accent)' : 'var(--warning)', borderRadius: 2 }} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8 }}>
                <button
                  className="btn btn-secondary"
                  style={{ fontSize: 13, padding: '8px 14px', color: isOverdue ? 'var(--danger)' : undefined }}
                  onClick={() => handleStartReview(date, recs)}
                >
                  {isOverdue ? '🔴 복습하기' : '🔁 다시 풀기'}
                </button>
                <button
                  className="btn btn-danger"
                  style={{ fontSize: 13, padding: '8px 14px' }}
                  onClick={() => handleDeleteDate(date, recs)}
                >
                  🗑
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
