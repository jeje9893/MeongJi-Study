import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'

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

function QuizForm({ initial, onSave, onCancel, existingCategories }) {
  const [question, setQuestion] = useState(initial?.question || '')
  const [answer, setAnswer] = useState(initial?.answer || '')
  const [category, setCategory] = useState(initial?.category || '')

  function handleSubmit(e) {
    e.preventDefault()
    if (!question.trim() || !answer.trim()) return
    onSave({ question: question.trim(), answer: answer.trim(), category: category.trim() })
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
          <textarea className="input" placeholder="정답을 입력하세요" value={answer} onChange={e => setAnswer(e.target.value)} />
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
  const quizzes = useLiveQuery(() => db.quizzes.orderBy('createdAt').reverse().toArray(), [])
  const [showForm, setShowForm] = useState(false)
  const [editTarget, setEditTarget] = useState(null)
  const [filter, setFilter] = useState('')

  const categories = [...new Set((quizzes || []).map(q => q.category).filter(Boolean))]
  const filtered = (quizzes || []).filter(q => !filter || q.category === filter)

  async function handleSave({ question, answer, category }) {
    if (editTarget) {
      await db.quizzes.update(editTarget.id, { question, answer, category })
      setEditTarget(null)
    } else {
      await db.quizzes.add({ question, answer, category, createdAt: Date.now() })
      setShowForm(false)
    }
  }

  async function handleDelete(id) {
    if (!confirm('이 문제를 삭제할까요?')) return
    await db.quizzes.delete(id)
    await db.records.where('quizId').equals(id).delete()
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 className="page-title" style={{ marginBottom: 0 }}>문제 관리</h1>
        <button className="btn btn-primary" style={{ width: 'auto', padding: '8px 16px', fontSize: 14 }} onClick={() => { setShowForm(true); setEditTarget(null) }}>
          + 추가
        </button>
      </div>

      {(showForm && !editTarget) && (
        <QuizForm existingCategories={categories} onSave={handleSave} onCancel={() => setShowForm(false)} />
      )}

      {/* Category filter */}
      {categories.length > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
          <button onClick={() => setFilter('')} style={{ padding: '4px 12px', borderRadius: 100, border: 'none', cursor: 'pointer', fontSize: 13, background: !filter ? 'var(--accent)' : 'var(--bg3)', color: !filter ? '#0f172a' : 'var(--text2)' }}>전체</button>
          {categories.map(c => (
            <button key={c} onClick={() => setFilter(c)} style={{ padding: '4px 12px', borderRadius: 100, border: 'none', cursor: 'pointer', fontSize: 13, background: filter === c ? 'var(--accent)' : 'var(--bg3)', color: filter === c ? '#0f172a' : 'var(--text2)' }}>{c}</button>
          ))}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📭</div>
          <p>문제가 없어요</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filtered.map(q => (
            editTarget?.id === q.id ? (
              <QuizForm key={q.id} initial={q} existingCategories={categories} onSave={handleSave} onCancel={() => setEditTarget(null)} />
            ) : (
              <div key={q.id} className="card">
                {q.category && <span className="badge" style={{ marginBottom: 10, display: 'inline-block' }}>{q.category}</span>}
                <div style={{ fontWeight: 500, marginBottom: 8, lineHeight: 1.6 }}>{q.question}</div>
                <div style={{ fontSize: 14, color: 'var(--text2)', marginBottom: 14, lineHeight: 1.6 }}>→ {q.answer}</div>
                <div style={{ display: 'flex', gap: 8 }}>
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
