import { useState, useRef } from 'react'
import { renderWithHighlights, mergeHighlights } from '../highlightUtils.jsx'
import { useImageSrc } from '../useImageSrc'
import ImagePasteButton from './ImagePaste'

const chipBtn = {
  padding: '3px 10px', borderRadius: 100, border: '1px solid rgba(255,255,255,0.12)',
  background: 'transparent', color: 'var(--text2)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
}

// 이미지 필드 — value: null | {id}(기존) | {file}(새 선택). onChange로 상위에 전달.
function ImageField({ value, onChange }) {
  const inputRef = useRef()
  const previewUrl = useImageSrc(value)

  function handlePick(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!file.type?.startsWith('image/')) { alert('이미지 파일만 넣을 수 있어요'); return }
    onChange({ file })
  }

  return (
    <div style={{ marginTop: 8 }}>
      <input ref={inputRef} type="file" accept="image/*" onChange={handlePick} style={{ display: 'none' }} />
      {previewUrl ? (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, flexWrap: 'wrap' }}>
          <img src={previewUrl} alt="" style={{ maxWidth: 160, maxHeight: 160, borderRadius: 8, objectFit: 'contain', background: 'var(--bg3)' }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 120 }}>
            <button type="button" onClick={() => inputRef.current?.click()} style={chipBtn}>이미지 변경</button>
            <ImagePasteButton onImage={(blob) => onChange({ file: blob })} style={chipBtn} />
            <button type="button" onClick={() => onChange(null)} style={chipBtn}>제거</button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button type="button" onClick={() => inputRef.current?.click()} style={chipBtn}>🖼 이미지 추가</button>
          <ImagePasteButton onImage={(blob) => onChange({ file: blob })} style={chipBtn} />
        </div>
      )}
    </div>
  )
}

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
export default function QuizForm({ initial, onSave, onCancel, existingCategories, lastCategory, uploadImage }) {
  const [question, setQuestion] = useState(initial?.question || '')
  const [answer, setAnswer] = useState(initial?.answer || '')
  const [category, setCategory] = useState(initial?.category ?? lastCategory ?? '')
  const [highlights, setHighlights] = useState(initial?.answerHighlights || [])
  const [pendingSelection, setPendingSelection] = useState(null)
  const [questionImage, setQuestionImage] = useState(initial?.questionImage || null)
  const [answerImage, setAnswerImage] = useState(initial?.answerImage || null)
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
    onSave({
      question: question.trim(), answer: answer.trim(), category: category.trim(),
      answerHighlights: highlights, questionImage, answerImage,
    })
  }

  return (
    <div className="card" style={{ marginBottom: 20 }}>
      <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>{initial ? '문제 수정' : '새 문제 추가'}</h2>
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>문제 *</label>
          <textarea className="input" placeholder="문제를 입력하세요" value={question} onChange={e => setQuestion(e.target.value)} />
          {uploadImage && <ImageField value={questionImage} onChange={setQuestionImage} />}
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
          {uploadImage && <ImageField value={answerImage} onChange={setAnswerImage} />}
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
