import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'

function getDateMonthAgo() {
  const d = new Date()
  d.setMonth(d.getMonth() - 1)
  return d.toISOString().slice(0, 10)
}

// 안 풀어본 문제 우선, 틀린 문제 다음, 맞은 문제 마지막으로 가중치 부여 후 선택
function weightedSelect(pool, recordMap, count) {
  const weighted = pool.map(q => {
    const history = recordMap[q.id] || []
    if (history.length === 0) return { q, weight: 5 }
    const lastCorrect = history[history.length - 1].isCorrect
    if (!lastCorrect) return { q, weight: 3 }
    const correctRate = history.filter(r => r.isCorrect).length / history.length
    return { q, weight: Math.max(1, Math.round((1 - correctRate) * 4 + 1)) }
  })

  const selected = []
  const remaining = [...weighted]

  for (let i = 0; i < Math.min(count, pool.length); i++) {
    const total = remaining.reduce((s, w) => s + w.weight, 0)
    let rand = Math.random() * total
    let idx = 0
    for (; idx < remaining.length - 1; idx++) {
      rand -= remaining[idx].weight
      if (rand <= 0) break
    }
    selected.push(remaining[idx].q)
    remaining.splice(idx, 1)
  }
  return selected
}

// 설정 화면
function QuizSetup({ quizzes, allRecords, onStart }) {
  const categories = ['전체', ...new Set(quizzes.map(q => q.category).filter(Boolean))]
  const [selectedCategory, setSelectedCategory] = useState('전체')
  const [countOption, setCountOption] = useState('10')
  const [customCount, setCustomCount] = useState('')

  const filtered = (selectedCategory === '전체'
    ? quizzes
    : quizzes.filter(q => q.category === selectedCategory)
  ).filter(q => !q.excluded)

  const recordMap = {}
  allRecords.forEach(r => {
    if (!recordMap[r.quizId]) recordMap[r.quizId] = []
    recordMap[r.quizId].push(r)
  })

  const untriedCount = filtered.filter(q => !recordMap[q.id]?.length).length

  function handleStart() {
    const count = countOption === 'custom'
      ? Math.min(parseInt(customCount) || 10, filtered.length)
      : Math.min(parseInt(countOption), filtered.length)
    if (count < 1) return
    const selected = weightedSelect(filtered, recordMap, count)
    onStart(selected)
  }

  const finalCount = countOption === 'custom'
    ? Math.min(parseInt(customCount) || 0, filtered.length)
    : Math.min(parseInt(countOption), filtered.length)

  return (
    <div>
      <h1 className="page-title">퀴즈 설정</h1>

      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 12, fontWeight: 600 }}>카테고리</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {categories.map(c => (
            <button
              key={c}
              onClick={() => setSelectedCategory(c)}
              style={{
                padding: '6px 14px', borderRadius: 100, border: 'none', cursor: 'pointer',
                fontSize: 14, fontFamily: 'inherit', transition: 'all 0.15s',
                background: selectedCategory === c ? 'var(--accent)' : 'var(--bg3)',
                color: selectedCategory === c ? '#0f172a' : 'var(--text2)',
                fontWeight: selectedCategory === c ? 600 : 400
              }}
            >
              {c}
            </button>
          ))}
        </div>
        <div style={{ marginTop: 12, fontSize: 13, color: 'var(--text2)' }}>
          총 <b style={{ color: 'var(--text)' }}>{filtered.length}</b>문제
          {untriedCount > 0 && <span style={{ color: 'var(--accent)', marginLeft: 6 }}>· 미시도 {untriedCount}개</span>}
        </div>
      </div>

      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 12, fontWeight: 600 }}>문제 수</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8, marginBottom: countOption === 'custom' ? 12 : 0 }}>
          {['10', '20', '30', 'custom'].map(opt => (
            <button
              key={opt}
              onClick={() => setCountOption(opt)}
              style={{
                padding: '10px 0', borderRadius: 8, border: 'none', cursor: 'pointer',
                fontSize: 14, fontFamily: 'inherit', transition: 'all 0.15s',
                background: countOption === opt ? 'var(--accent)' : 'var(--bg3)',
                color: countOption === opt ? '#0f172a' : 'var(--text2)',
                fontWeight: countOption === opt ? 600 : 400
              }}
            >
              {opt === 'custom' ? '직접' : opt + '개'}
            </button>
          ))}
        </div>
        {countOption === 'custom' && (
          <input
            className="input"
            type="number"
            placeholder={`최대 ${filtered.length}개`}
            value={customCount}
            onChange={e => setCustomCount(e.target.value)}
            min={1}
            max={filtered.length}
            autoFocus
          />
        )}
        {countOption !== 'custom' && filtered.length < parseInt(countOption) && (
          <div style={{ marginTop: 8, fontSize: 13, color: 'var(--warning)' }}>
            ⚠️ 문제가 {filtered.length}개뿐이에요. {filtered.length}개로 진행됩니다.
          </div>
        )}
      </div>

      <button
        className="btn btn-primary"
        onClick={handleStart}
        disabled={filtered.length === 0 || finalCount < 1}
        style={{ opacity: filtered.length === 0 || finalCount < 1 ? 0.5 : 1 }}
      >
        {finalCount > 0 ? `${finalCount}문제 시작 🚀` : '시작'}
      </button>
    </div>
  )
}

// 복습 모드 시작 화면
function QuizReviewStart({ reviewQuizzes, onStart, onCancel }) {
  return (
    <div>
      <h1 className="page-title">복습 퀴즈 🔔</h1>
      <div className="card" style={{ marginBottom: 24, background: 'linear-gradient(135deg, #1e1b4b, #1e293b)', border: '1px solid rgba(167,139,250,0.3)' }}>
        <div style={{ fontSize: 14, color: '#c4b5fd', fontWeight: 600, marginBottom: 8 }}>한달 이상 안 푼 문제</div>
        <div style={{ fontSize: 28, fontFamily: 'Space Mono', fontWeight: 700, color: '#c4b5fd' }}>{reviewQuizzes.length}개</div>
        <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 8 }}>전체 복습 문제를 순서대로 풀게 됩니다</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <button className="btn btn-secondary" onClick={onCancel}>일반 퀴즈로</button>
        <button className="btn btn-primary" onClick={() => onStart(reviewQuizzes)}>복습 시작 🚀</button>
      </div>
    </div>
  )
}

// 결과 화면
function QuizResult({ results, onRetry, onSetup }) {
  const correct = results.filter(r => r.isCorrect).length
  const pct = Math.round((correct / results.length) * 100)
  return (
    <div>
      <h1 className="page-title">결과 🎉</h1>
      <div className="card" style={{ textAlign: 'center', marginBottom: 24, padding: '36px 20px' }}>
        <div style={{ fontSize: 64, fontFamily: 'Space Mono', fontWeight: 700, color: pct >= 70 ? 'var(--accent)' : 'var(--warning)' }}>{pct}%</div>
        <div style={{ color: 'var(--text2)', marginTop: 8 }}>{results.length}문제 중 {correct}개 정답</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
        <button className="btn btn-secondary" onClick={onSetup}>다른 설정으로</button>
        <button className="btn btn-primary" onClick={onRetry}>같은 문제 다시</button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
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
    </div>
  )
}

export default function Quiz() {
  const [searchParams, setSearchParams] = useSearchParams()
  const isReviewMode = searchParams.get('mode') === 'review'

  const quizzes = useLiveQuery(() => db.quizzes.toArray(), [])
  const allRecords = useLiveQuery(() => db.records.toArray(), [])

  const [phase, setPhase] = useState('setup')   // setup | playing | done
  const [sessionQuizzes, setSessionQuizzes] = useState([])
  const [idx, setIdx] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [results, setResults] = useState([])
  // isReviewMode가 바뀌면 phase를 setup으로 리셋 (배너 재클릭 등 대응)
  const [lastReviewMode, setLastReviewMode] = useState(isReviewMode)
  if (isReviewMode !== lastReviewMode) {
    setLastReviewMode(isReviewMode)
    setPhase('setup')
  }

  if (!quizzes || !allRecords) return (
    <div style={{ color: 'var(--text2)', textAlign: 'center', paddingTop: 60 }}>로딩 중...</div>
  )

  if (quizzes.length === 0) return (
    <div className="empty-state">
      <div className="empty-icon">📭</div>
      <p>문제가 없어요. 먼저 문제를 추가해주세요!</p>
    </div>
  )

  // 복습 대상 문제 계산 (렌더 시점, useEffect 없음)
  const reviewQuizzes = (() => {
    if (!isReviewMode) return []
    const monthAgo = getDateMonthAgo()
    const lastDateMap = {}
    allRecords.forEach(r => {
      if (!lastDateMap[r.quizId] || r.date > lastDateMap[r.quizId]) {
        lastDateMap[r.quizId] = r.date
      }
    })
    const reviewIds = new Set(
      Object.entries(lastDateMap)
        .filter(([, date]) => date <= monthAgo)
        .map(([id]) => parseInt(id))
    )
    return quizzes.filter(q => !q.excluded && reviewIds.has(q.id))
  })()

  function handleStart(selected) {
    setSessionQuizzes(selected)
    setIdx(0)
    setRevealed(false)
    setResults([])
    setPhase('playing')
  }

  function handleRetry() {
    setIdx(0)
    setRevealed(false)
    setResults([])
    setPhase('playing')
  }

  function handleGoToSetup() {
    setSearchParams({})
    setPhase('setup')
  }

  async function handleAnswer(isCorrect) {
    const current = sessionQuizzes[idx]
    const today = new Date().toISOString().slice(0, 10)
    await db.records.add({ quizId: current.id, date: today, isCorrect })
    const newResults = [...results, { quiz: current, isCorrect }]
    setResults(newResults)
    if (idx + 1 >= sessionQuizzes.length) {
      setPhase('done')
    } else {
      setIdx(idx + 1)
      setRevealed(false)
    }
  }

  // 복습 모드 + setup 단계 → 복습 시작 화면
  if (phase === 'setup' && isReviewMode && reviewQuizzes.length > 0) {
    return (
      <QuizReviewStart
        reviewQuizzes={reviewQuizzes}
        onStart={handleStart}
        onCancel={handleGoToSetup}
      />
    )
  }

  if (phase === 'setup') return (
    <QuizSetup quizzes={quizzes} allRecords={allRecords} onStart={handleStart} />
  )

  if (phase === 'done') return (
    <QuizResult
      results={results}
      onRetry={handleRetry}
      onSetup={handleGoToSetup}
    />
  )

  const current = sessionQuizzes[idx]
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <button onClick={handleGoToSetup} style={{ background: 'none', border: 'none', color: 'var(--text2)', cursor: 'pointer', fontSize: 14, padding: 0 }}>← 설정으로</button>
        <span className="badge">{idx + 1} / {sessionQuizzes.length}</span>
      </div>

      <div style={{ height: 4, background: 'var(--bg3)', borderRadius: 2, marginBottom: 28 }}>
        <div style={{ height: '100%', width: `${(idx / sessionQuizzes.length) * 100}%`, background: 'var(--accent)', borderRadius: 2, transition: 'width 0.3s' }} />
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
