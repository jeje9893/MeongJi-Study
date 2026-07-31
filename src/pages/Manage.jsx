import { useState, useRef, useMemo } from 'react'
import { useData } from '../contexts/DataContext'
import { renderWithHighlights, mergeHighlights } from '../highlightUtils.jsx'
import QuizCalendar from '../components/QuizCalendar'

function CategoryInput({ value, onChange, existingCategories }) {
  const [mode, setMode] = useState(() =>
    value && !existingCategories.includes(value) ? 'new' : 'select'
  )
  const [newValue, setNewValue] = useState(mode === 'new' ? value : '')

  function handleSelectChange(e) {
    const v = e.target.value
    if (v === '__new__') {
      setMode('new')
      setNewValue('')
      onChange('')
    } else {
      onChange(v)
    }
  }

  function handleNewChange(e) {
    setNewValue(e.target.value)
    onChange(e.target.value)
  }

  function handleBackToSelect() {
    setMode('select')
    setNewValue('')
    onChange('')
  }

  if (mode === 'new') {
    return (
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          className="input"
          placeholder="새 카테고리 이름 입력"
          value={newValue}
          onChange={handleNewChange}
          autoFocus
          style={{ flex: 1 }}
        />
        {existingCategories.length > 0 && (
          <button
            type="button"
            onClick={handleBackToSelect}
            style={{ padding: '0 12px', background: 'var(--bg3)', border: 'none', borderRadius: 8, color: 'var(--text2)', cursor: 'pointer', fontSize: 13, whiteSpace: 'nowrap' }}
          >
            목록 선택
          </button>
        )}
      </div>
    )
  }

  return (
    <select
      className="input"
      value={value || ''}
      onChange={handleSelectChange}
      style={{
        appearance: 'none',
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%2394a3b8' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`,
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'right 14px center',
        paddingRight: 36
      }}
    >
      <option value="">카테고리 없음</option>
      {existingCategories.map(c => (
        <option key={c} value={c}>{c}</option>
      ))}
      <option value="__new__">+ 새 카테고리 추가</option>
    </select>
  )
}

// lastCategory: 직전 문제에서 쓴 카테고리를 이어받아 초기값으로 사용
function QuizForm({ initial, onSave, onCancel, existingCategories, lastCategory }) {
  const [question, setQuestion] = useState(initial?.question || '')
  const [answer, setAnswer] = useState(initial?.answer || '')
  const [category, setCategory] = useState(initial?.category ?? lastCategory ?? '')
  const [highlights, setHighlights] = useState(initial?.answerHighlights || [])
  const [pendingSelection, setPendingSelection] = useState(null)
  const answerRef = useRef()

  function handleAnswerChange(e) {
    setAnswer(e.target.value)
    setHighlights([])
    setPendingSelection(null)
  }

  function handleAnswerSelect() {
    const el = answerRef.current
    if (!el) return
    const { selectionStart: s, selectionEnd: e } = el
    setPendingSelection(s !== e ? { start: s, end: e } : null)
  }

  function handleAddHighlight() {
    if (!pendingSelection) return
    setHighlights(prev => mergeHighlights([...prev, pendingSelection]))
    setPendingSelection(null)
  }

  function handleSubmit(e) {
    e.preventDefault()
    if (!question.trim() || !answer.trim()) return
    onSave({ question: question.trim(), answer: answer.trim(), category: category.trim(), answerHighlights: highlights })
  }

  return (
    <div className="card" style={{ marginBottom: 20 }}>
      <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>{initial ? '문제 수정' : '새 문제 추가'}</h2>
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>문제 *</label>
          <textarea className="input" placeholder="문제를 입력하세요" value={question} onChange={e => setQuestion(e.target.value)} />
        </div>
        <div className="form-group">
          <label>정답 *</label>
          <textarea
            ref={answerRef}
            className="input"
            placeholder="정답을 입력하세요"
            value={answer}
            onChange={handleAnswerChange}
            onMouseUp={handleAnswerSelect}
            onKeyUp={handleAnswerSelect}
          />
          <button
            type="button"
            onClick={handleAddHighlight}
            disabled={!pendingSelection}
            style={{
              marginTop: 6, padding: '4px 12px', borderRadius: 100,
              border: `1px solid ${pendingSelection ? 'rgba(251,191,36,0.4)' : 'rgba(255,255,255,0.08)'}`,
              background: pendingSelection ? 'rgba(251,191,36,0.15)' : 'transparent',
              color: pendingSelection ? 'var(--warning)' : 'var(--text2)',
              fontSize: 12, cursor: pendingSelection ? 'pointer' : 'default', fontFamily: 'inherit',
            }}
          >
            🖊 형광펜 적용
          </button>
          {highlights.length > 0 && (
            <div style={{ marginTop: 10, padding: '10px 12px', background: 'var(--bg3)', borderRadius: 8 }}>
              <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 6 }}>미리보기 (chip 클릭 시 제거)</div>
              <p style={{ fontSize: 14, lineHeight: 1.7, whiteSpace: 'pre-wrap', margin: '0 0 8px' }}>
                {renderWithHighlights(answer, highlights)}
              </p>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {highlights.map((h, i) => (
                  <span
                    key={i}
                    onClick={() => setHighlights(prev => prev.filter((_, j) => j !== i))}
                    style={{ fontSize: 12, padding: '2px 10px', borderRadius: 100, cursor: 'pointer', background: 'rgba(251,191,36,0.2)', color: 'var(--warning)' }}
                  >
                    {answer.slice(h.start, h.end).slice(0, 15)}{answer.slice(h.start, h.end).length > 15 ? '…' : ''} ×
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="form-group">
          <label>카테고리 (선택)</label>
          <CategoryInput
            value={category}
            onChange={setCategory}
            existingCategories={existingCategories}
          />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <button type="button" className="btn btn-secondary" onClick={onCancel}>취소</button>
          <button type="submit" className="btn btn-primary">저장</button>
        </div>
      </form>
    </div>
  )
}

export default function Manage() {
  const { quizzes: rawQuizzes, records, addQuiz, updateQuiz, deleteQuiz, exportData, importData } = useData()
  // 최신순 정렬
  const quizzes = rawQuizzes ? [...rawQuizzes].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)) : undefined

  // quizId별 풀이 기록 그룹핑 (달력 표시용)
  const recordsByQuiz = useMemo(() => {
    const m = {}
    ;(records || []).forEach(r => { (m[r.quizId] ||= []).push(r) })
    return m
  }, [records])

  const [showForm, setShowForm] = useState(false)
  const [editTarget, setEditTarget] = useState(null)
  const [filter, setFilter] = useState('')
  const [showExcluded, setShowExcluded] = useState(false)
  const [lastCategory, setLastCategory] = useState('')
  const [search, setSearch] = useState('')
  const [searchScope, setSearchScope] = useState('both')
  const [importMsg, setImportMsg] = useState(null)
  const [importing, setImporting] = useState(false)
  const [showDataPanel, setShowDataPanel] = useState(false)
  const fileInputRef = useRef()

  const categories = [...new Set((quizzes || []).map(q => q.category).filter(Boolean))]
  const hasUncategorized = (quizzes || []).some(q => !q.category)

  const searchTerm = search.trim().toLowerCase()
  const baseFiltered = (quizzes || []).filter(q => {
    if (filter === '__uncategorized__') { if (q.category) return false }
    else if (filter && q.category !== filter) return false
    if (!searchTerm) return true
    if (searchScope === 'question') return q.question.toLowerCase().includes(searchTerm)
    if (searchScope === 'answer') return q.answer.toLowerCase().includes(searchTerm)
    return q.question.toLowerCase().includes(searchTerm) || q.answer.toLowerCase().includes(searchTerm)
  })
  const active = baseFiltered.filter(q => !q.excluded)
  const excluded = baseFiltered.filter(q => q.excluded)
  const filtered = showExcluded ? excluded : active

  const excludedCount = (quizzes || []).filter(q => q.excluded).length

  async function handleSave({ question, answer, category, answerHighlights }) {
    if (editTarget) {
      await updateQuiz(editTarget.id, { question, answer, category, answerHighlights: answerHighlights ?? [] })
      setEditTarget(null)
    } else {
      await addQuiz({ question, answer, category, excluded: false, createdAt: Date.now(), answerHighlights: answerHighlights ?? [] })
      setLastCategory(category)
      setShowForm(false)
    }
  }

  async function handleDelete(id) {
    if (!confirm('이 문제를 삭제할까요?')) return
    await deleteQuiz(id)
  }

  async function handleToggleExclude(q) {
    await updateQuiz(q.id, { excluded: !q.excluded })
  }

  async function handleExport() {
    try {
      await exportData()
    } catch (e) {
      alert('내보내기 실패: ' + e.message)
    }
  }

  async function handleImport(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    setImportMsg(null)
    try {
      const result = await importData(file)
      setImportMsg({
        type: 'success',
        text: `완료! 새 문제 ${result.addedCount}개 추가, 중복 ${result.skippedCount}개 건너뜀, 기록 ${result.recordsAdded}개 추가`
      })
    } catch (e) {
      setImportMsg({ type: 'error', text: '가져오기 실패: ' + e.message })
    } finally {
      setImporting(false)
      e.target.value = ''
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1 className="page-title" style={{ marginBottom: 0 }}>문제 관리</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="btn btn-secondary"
            style={{ width: 'auto', padding: '8px 14px', fontSize: 13 }}
            onClick={() => setShowDataPanel(v => !v)}
          >
            {showDataPanel ? '닫기' : '📤 데이터'}
          </button>
          <button className="btn btn-primary" style={{ width: 'auto', padding: '8px 16px', fontSize: 14 }} onClick={() => { setShowForm(true); setEditTarget(null) }}>
            + 추가
          </button>
        </div>
      </div>

      {/* 데이터 내보내기/가져오기 패널 */}
      {showDataPanel && (
        <div className="card" style={{ marginBottom: 20, borderColor: 'rgba(110,231,183,0.2)' }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>데이터 전송</div>
          <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 16, lineHeight: 1.6 }}>
            JSON 파일로 내보내고 다른 기기에서 가져올 수 있어요.<br />
            가져오기는 기존 데이터에 병합되며 중복 문제는 건너뜁니다.
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <button
              className="btn btn-secondary"
              onClick={handleExport}
              style={{ fontSize: 14 }}
            >
              📥 내보내기
            </button>
            <button
              className="btn btn-primary"
              onClick={() => fileInputRef.current?.click()}
              disabled={importing}
              style={{ fontSize: 14, opacity: importing ? 0.6 : 1 }}
            >
              {importing ? '가져오는 중...' : '📤 가져오기'}
            </button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleImport}
            style={{ display: 'none' }}
          />
          {importMsg && (
            <div style={{
              marginTop: 12, padding: '10px 14px', borderRadius: 8, fontSize: 13,
              background: importMsg.type === 'success' ? 'rgba(110,231,183,0.1)' : 'rgba(248,113,113,0.1)',
              color: importMsg.type === 'success' ? 'var(--accent)' : 'var(--danger)',
              border: `1px solid ${importMsg.type === 'success' ? 'rgba(110,231,183,0.2)' : 'rgba(248,113,113,0.2)'}`
            }}>
              {importMsg.text}
            </div>
          )}
        </div>
      )}

      {(showForm && !editTarget) && (
        <QuizForm
          existingCategories={categories}
          onSave={handleSave}
          onCancel={() => setShowForm(false)}
          lastCategory={lastCategory}
        />
      )}

      {/* 포함/제외 탭 */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button
          onClick={() => setShowExcluded(false)}
          style={{
            padding: '6px 16px', borderRadius: 100, border: 'none', cursor: 'pointer',
            fontSize: 13, fontFamily: 'inherit',
            background: !showExcluded ? 'var(--accent)' : 'var(--bg3)',
            color: !showExcluded ? '#0f172a' : 'var(--text2)',
            fontWeight: !showExcluded ? 600 : 400
          }}
        >
          퀴즈 포함 {active.length}
        </button>
        <button
          onClick={() => setShowExcluded(true)}
          style={{
            padding: '6px 16px', borderRadius: 100, border: 'none', cursor: 'pointer',
            fontSize: 13, fontFamily: 'inherit',
            background: showExcluded ? 'var(--warning)' : 'var(--bg3)',
            color: showExcluded ? '#0f172a' : 'var(--text2)',
            fontWeight: showExcluded ? 600 : 400
          }}
        >
          제외됨 {excludedCount}
        </button>
      </div>

      {/* 검색 */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ position: 'relative', marginBottom: 8 }}>
          <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text2)', pointerEvents: 'none', fontSize: 14 }}>🔍</span>
          <input
            className="input"
            placeholder="검색..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ paddingLeft: 36, paddingRight: search ? 36 : 14 }}
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text2)', cursor: 'pointer', fontSize: 18, padding: '0 2px', lineHeight: 1 }}
            >×</button>
          )}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {[
            { key: 'both', label: '문제+답안' },
            { key: 'question', label: '문제' },
            { key: 'answer', label: '답안' },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setSearchScope(key)}
              style={{
                padding: '4px 12px', borderRadius: 100, border: 'none', cursor: 'pointer',
                fontSize: 12, fontFamily: 'inherit',
                background: searchScope === key ? 'rgba(110,231,183,0.15)' : 'var(--bg3)',
                color: searchScope === key ? 'var(--accent)' : 'var(--text2)',
                fontWeight: searchScope === key ? 600 : 400,
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* 카테고리 필터 */}
      {(categories.length > 0 || hasUncategorized) && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
          <button onClick={() => setFilter('')} style={{ padding: '4px 12px', borderRadius: 100, border: 'none', cursor: 'pointer', fontSize: 13, background: !filter ? 'var(--accent)' : 'var(--bg3)', color: !filter ? '#0f172a' : 'var(--text2)' }}>전체</button>
          {categories.map(c => (
            <button key={c} onClick={() => setFilter(c)} style={{ padding: '4px 12px', borderRadius: 100, border: 'none', cursor: 'pointer', fontSize: 13, background: filter === c ? 'var(--accent)' : 'var(--bg3)', color: filter === c ? '#0f172a' : 'var(--text2)' }}>{c}</button>
          ))}
          {hasUncategorized && (
            <button onClick={() => setFilter('__uncategorized__')} style={{ padding: '4px 12px', borderRadius: 100, border: 'none', cursor: 'pointer', fontSize: 13, background: filter === '__uncategorized__' ? 'var(--accent)' : 'var(--bg3)', color: filter === '__uncategorized__' ? '#0f172a' : 'var(--text2)' }}>미분류</button>
          )}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">{searchTerm ? '🔍' : showExcluded ? '🚫' : '📭'}</div>
          <p>{searchTerm ? '검색 결과가 없어요' : showExcluded ? '제외된 문제가 없어요' : '문제가 없어요'}</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filtered.map(q => (
            editTarget?.id === q.id ? (
              <QuizForm key={q.id} initial={q} existingCategories={categories} onSave={handleSave} onCancel={() => setEditTarget(null)} lastCategory={lastCategory} />
            ) : (
              <div key={q.id} className="card" style={{ opacity: q.excluded ? 0.6 : 1, borderColor: q.excluded ? 'rgba(251,191,36,0.2)' : undefined }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: q.category ? 6 : 0 }}>
                  {q.category
                    ? <span className="badge">{q.category}</span>
                    : <span />
                  }
                  <button
                    onClick={() => handleToggleExclude(q)}
                    style={{
                      padding: '3px 10px', borderRadius: 100, border: 'none', cursor: 'pointer',
                      fontSize: 12, fontFamily: 'inherit', whiteSpace: 'nowrap',
                      background: q.excluded ? 'rgba(110,231,183,0.15)' : 'rgba(251,191,36,0.12)',
                      color: q.excluded ? 'var(--accent)' : 'var(--warning)',
                    }}
                  >
                    {q.excluded ? '✓ 퀴즈에 포함' : '퀴즈에서 제외'}
                  </button>
                </div>
                <div style={{ fontWeight: 500, marginBottom: 8, lineHeight: 1.6, marginTop: 8 }}>{q.question}</div>
                <div style={{ fontSize: 14, color: 'var(--text2)', marginBottom: 14, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>→ {renderWithHighlights(q.answer, q.answerHighlights)}</div>
                <QuizCalendar createdAt={q.createdAt} records={recordsByQuiz[q.id] || []} />
                <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                  <button className="btn btn-secondary" style={{ fontSize: 13, padding: '8px 14px' }} onClick={() => setEditTarget(q)}>수정</button>
                  <button className="btn btn-danger" style={{ fontSize: 13, padding: '8px 14px' }} onClick={() => handleDelete(q.id)}>삭제</button>
                </div>
              </div>
            )
          ))}
        </div>
      )}
    </div>
  )
}
