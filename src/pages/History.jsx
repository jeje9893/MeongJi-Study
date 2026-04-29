import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'

export default function History() {
  const records = useLiveQuery(() => db.records.toArray(), [])
  const quizzes = useLiveQuery(() => db.quizzes.toArray(), [])

  if (!records || !quizzes) return null

  const quizMap = Object.fromEntries(quizzes.map(q => [q.id, q]))

  // Group by date
  const byDate = {}
  records.forEach(r => {
    if (!byDate[r.date]) byDate[r.date] = []
    byDate[r.date].push(r)
  })
  const dates = Object.keys(byDate).sort().reverse()

  // Wrong answers (all time)
  const wrongIds = new Set(
    records.filter(r => !r.isCorrect).map(r => r.quizId)
  )
  const correctIds = new Set(
    records.filter(r => r.isCorrect).map(r => r.quizId)
  )
  const persistentlyWrong = [...wrongIds].filter(id => !correctIds.has(id))

  if (records.length === 0) return (
    <div className="empty-state">
      <div className="empty-icon">📊</div>
      <p>아직 학습 기록이 없어요</p>
    </div>
  )

  return (
    <div>
      <h1 className="page-title">학습 기록</h1>

      {/* Overall stats */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 24 }}>
        {[
          { label: '총 학습일', value: dates.length + '일' },
          { label: '총 문제', value: records.length + '개' },
          { label: '정답률', value: Math.round(records.filter(r => r.isCorrect).length / records.length * 100) + '%' }
        ].map(s => (
          <div key={s.label} className="card" style={{ textAlign: 'center', padding: '14px 8px' }}>
            <div style={{ fontSize: 20, fontFamily: 'Space Mono', fontWeight: 700, color: 'var(--accent)' }}>{s.value}</div>
            <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 4 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Persistently wrong */}
      {persistentlyWrong.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12, color: 'var(--danger)' }}>❌ 계속 틀리는 문제</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {persistentlyWrong.map(id => {
              const q = quizMap[id]
              if (!q) return null
              return (
                <div key={id} className="card" style={{ borderLeft: '3px solid var(--danger)' }}>
                  <div style={{ fontSize: 14, marginBottom: 6 }}>{q.question}</div>
                  <div style={{ fontSize: 13, color: 'var(--text2)' }}>→ {q.answer}</div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* By date */}
      <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>📅 날짜별 기록</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {dates.map(date => {
          const recs = byDate[date]
          const correct = recs.filter(r => r.isCorrect).length
          const pct = Math.round(correct / recs.length * 100)
          return (
            <div key={date} className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 500, marginBottom: 3 }}>
                    {new Date(date).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' })}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text2)' }}>{recs.length}문제</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontFamily: 'Space Mono', fontWeight: 700, fontSize: 20, color: pct >= 70 ? 'var(--accent)' : 'var(--warning)' }}>{pct}%</div>
                  <div style={{ fontSize: 12, color: 'var(--text2)' }}>{correct}/{recs.length}</div>
                </div>
              </div>
              {/* Mini bar */}
              <div style={{ height: 3, background: 'var(--bg3)', borderRadius: 2, marginTop: 12 }}>
                <div style={{ height: '100%', width: `${pct}%`, background: pct >= 70 ? 'var(--accent)' : 'var(--warning)', borderRadius: 2 }} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
