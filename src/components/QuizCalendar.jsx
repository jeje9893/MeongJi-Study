import { useState, useMemo } from 'react'

// 문제 하나의 학습 기록을 접이식 월별 달력으로 표시한다.
// 년월은 ◀▶ 화살표 또는 색상 월 버튼으로 이동하며, 한 번에 한 달만 그린다.
// 날짜는 record.date(UTC 기준 YYYY-MM-DD)와 규약을 맞춰 전부 UTC로 다룬다.

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

// ms 타임스탬프 → UTC 기준 YYYY-MM-DD
function tsToDateStr(ts) {
  if (!ts) return null
  return new Date(ts).toISOString().slice(0, 10)
}

// 날짜별 정답/오답 여부 집계
function buildDayMap(records) {
  const map = {}
  ;(records || []).forEach(r => {
    if (!r.date) return
    const cur = map[r.date] || { correct: false, wrong: false }
    if (r.isCorrect) cur.correct = true
    else cur.wrong = true
    map[r.date] = cur
  })
  return map
}

// 월별 정답/오답 개수 집계 { 'YYYY-MM': { correct, wrong } }
function buildMonthAgg(records) {
  const agg = {}
  ;(records || []).forEach(r => {
    if (!r.date) return
    const key = r.date.slice(0, 7)
    const cur = agg[key] || { correct: 0, wrong: 0 }
    if (r.isCorrect) cur.correct++
    else cur.wrong++
    agg[key] = cur
  })
  return agg
}

// YYYY-MM 을 delta 개월 이동 (UTC)
function shiftMonth(month, delta) {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 1 + delta, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

// 정답/오답 개수 → 색 (날짜 셀과 동일 팔레트)
function tallyColor(correct, wrong) {
  if (correct > wrong) return { bg: 'var(--accent)', color: '#0f172a' }
  if (wrong > correct) return { bg: 'var(--danger)', color: '#0f172a' }
  return { bg: 'var(--warning)', color: '#0f172a' } // 동점 & >0
}

const cellBase = {
  width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center',
  borderRadius: 6, fontSize: 12, position: 'relative', boxSizing: 'border-box',
}

function MonthGrid({ month, dayMap, addedDate }) {
  const [y, m] = month.split('-').map(Number)
  const firstWeekday = new Date(Date.UTC(y, m - 1, 1)).getUTCDay()
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate()

  const cells = []
  for (let i = 0; i < firstWeekday; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)
  while (cells.length % 7 !== 0) cells.push(null)

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
      {WEEKDAYS.map((w, i) => (
        <div key={w} style={{ ...cellBase, fontSize: 11, color: i === 0 ? 'var(--danger)' : i === 6 ? '#60a5fa' : 'var(--text2)' }}>
          {w}
        </div>
      ))}
      {cells.map((d, i) => {
        if (d === null) return <div key={i} style={cellBase} />
        const dateStr = `${month}-${String(d).padStart(2, '0')}`
        const state = dayMap[dateStr]
        const isAdded = dateStr === addedDate

        let bg = 'transparent'
        let color = 'var(--text2)'
        if (state) {
          const c = tallyColor(state.correct ? 1 : 0, state.wrong ? 1 : 0)
          bg = c.bg
          color = c.color
        }

        return (
          <div key={i} style={{ ...cellBase, background: bg, color, fontWeight: state ? 600 : 400 }}>
            {d}
            {isAdded && (
              <span style={{ position: 'absolute', top: -2, right: -1, fontSize: 11, lineHeight: 1, color: 'var(--accent)', textShadow: '0 0 2px #0f172a' }}>
                ⊕
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}

const arrowBtn = {
  width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center',
  borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 14,
  background: 'var(--bg2, var(--bg3))', color: 'var(--text2)', fontFamily: 'inherit',
}

export default function QuizCalendar({ createdAt, records }) {
  const [open, setOpen] = useState(false)
  const [viewMonth, setViewMonth] = useState(null)

  const addedDate = tsToDateStr(createdAt)
  const addedMonth = addedDate ? addedDate.slice(0, 7) : null

  const { dayMap, monthAgg, activeMonths } = useMemo(() => {
    // 접혀 있으면 집계하지 않는다 — 목록에 접힌 카드가 수백 개여도 비용 0
    if (!open) return { dayMap: {}, monthAgg: {}, activeMonths: [] }
    const dm = buildDayMap(records)
    const ma = buildMonthAgg(records)
    const months = [...new Set([...(addedMonth ? [addedMonth] : []), ...Object.keys(ma)])].sort()
    return { dayMap: dm, monthAgg: ma, activeMonths: months }
  }, [open, records, addedMonth])

  const currentMonth = new Date().toISOString().slice(0, 7)
  const effectiveMonth = viewMonth ?? activeMonths[activeMonths.length - 1] ?? currentMonth
  const multiYear = new Set(activeMonths.map(mo => mo.slice(0, 4))).size > 1

  const [ey, em] = effectiveMonth.split('-').map(Number)

  return (
    <div style={{ marginTop: 14 }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          padding: '5px 12px', borderRadius: 100, border: 'none', cursor: 'pointer',
          fontSize: 12, fontFamily: 'inherit', background: 'var(--bg3)', color: 'var(--text2)',
        }}
      >
        📅 학습 기록 {open ? '▴' : '▾'}
      </button>

      {open && (
        <div style={{ marginTop: 12, padding: '14px 14px 6px', background: 'var(--bg3)', borderRadius: 10 }}>
          {/* 헤더: 년월 화살표 이동 */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 12 }}>
            <button style={arrowBtn} onClick={() => setViewMonth(shiftMonth(effectiveMonth, -1))} aria-label="이전 달">◀</button>
            <div style={{ fontSize: 14, fontWeight: 600, minWidth: 96, textAlign: 'center', color: 'var(--text)' }}>
              {ey}년 {em}월
            </div>
            <button style={arrowBtn} onClick={() => setViewMonth(shiftMonth(effectiveMonth, 1))} aria-label="다음 달">▶</button>
          </div>

          {/* 활동 있는 달 바로가기 버튼 */}
          {activeMonths.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14, justifyContent: 'center' }}>
              {activeMonths.map(mo => {
                const [my, mm] = mo.split('-').map(Number)
                const agg = monthAgg[mo]
                const c = agg ? tallyColor(agg.correct, agg.wrong) : { bg: 'var(--bg2, #1e293b)', color: 'var(--text2)' }
                const isAdded = mo === addedMonth
                const isSelected = mo === effectiveMonth
                const label = multiYear ? `${String(my).slice(2)}.${mm}` : `${mm}월`
                return (
                  <button
                    key={mo}
                    onClick={() => setViewMonth(mo)}
                    title={`${my}년 ${mm}월`}
                    style={{
                      padding: '4px 10px', borderRadius: 8, cursor: 'pointer', fontSize: 12,
                      fontFamily: 'inherit', fontWeight: agg ? 600 : 400,
                      background: c.bg, color: c.color,
                      border: isAdded ? '2px solid var(--text)' : '2px solid transparent',
                      boxShadow: isSelected ? '0 0 0 2px #60a5fa' : 'none',
                    }}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
          )}

          {/* 선택한 달 그리드 */}
          <MonthGrid month={effectiveMonth} dayMap={dayMap} addedDate={addedDate} />

          {/* 범례 */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 14px', fontSize: 11, color: 'var(--text2)', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 10, marginTop: 12 }}>
            <span><span style={{ color: 'var(--accent)' }}>⊕</span> 추가한 날</span>
            <span><span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: 2, background: 'var(--accent)', verticalAlign: 'middle', marginRight: 3 }} />정답</span>
            <span><span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: 2, background: 'var(--danger)', verticalAlign: 'middle', marginRight: 3 }} />오답</span>
            <span><span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: 2, background: 'var(--warning)', verticalAlign: 'middle', marginRight: 3 }} />정답+오답</span>
            <span><span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: 2, border: '2px solid var(--text)', verticalAlign: 'middle', marginRight: 3, boxSizing: 'border-box' }} />추가한 달</span>
          </div>
        </div>
      )}
    </div>
  )
}
