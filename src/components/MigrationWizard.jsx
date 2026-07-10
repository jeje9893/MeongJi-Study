import { useState, useEffect } from 'react'
import { addDoc, writeBatch, doc, collection, getDocs } from 'firebase/firestore'
import { firestoreDb } from '../firebase'
import { useAuth } from '../contexts/AuthContext'
import { dexieDb } from '../db'

export default function MigrationWizard({ children }) {
  const user = useAuth()
  const [state, setState] = useState('checking') // checking | prompt | confirm-delete | migrating | done
  const [localData, setLocalData] = useState(null)
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    if (!user) { setState('done'); return }

    Promise.all([
      dexieDb.quizzes.toArray().catch(() => []),
      dexieDb.records.toArray().catch(() => []),
      getDocs(collection(firestoreDb, `users/${user.uid}/quizzes`)),
    ]).then(([dexieQuizzes, dexieRecords, firestoreSnap]) => {
      if (dexieQuizzes.length === 0) { setState('done'); return }

      const firestoreQuizzes = firestoreSnap.docs.map(d => ({ ...d.data(), id: d.id }))
      const firestoreSet = new Set(firestoreQuizzes.map(q => `${q.question}||${q.answer}`))

      const partialIdMap = {}
      firestoreQuizzes.forEach(fq => {
        const match = dexieQuizzes.find(dq => `${dq.question}||${dq.answer}` === `${fq.question}||${fq.answer}`)
        if (match) partialIdMap[match.id] = fq.id
      })

      const newQuizzes = dexieQuizzes.filter(q => !firestoreSet.has(`${q.question}||${q.answer}`))

      if (newQuizzes.length === 0) { setState('done'); return }

      setLocalData({ newQuizzes, dexieRecords, partialIdMap })
      setSelectedIds(new Set(newQuizzes.map(q => q.id)))
      setState('prompt')
    })
  }, [user])

  function handleToggle(id) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function handleSelectAll() {
    const allSelected = localData.newQuizzes.every(q => selectedIds.has(q.id))
    setSelectedIds(allSelected
      ? new Set()
      : new Set(localData.newQuizzes.map(q => q.id))
    )
  }

  function handleMigrateClick() {
    const hasUnchecked = localData.newQuizzes.some(q => !selectedIds.has(q.id))
    if (hasUnchecked) {
      setState('confirm-delete')
    } else {
      doMigrate(false)
    }
  }

  async function doMigrate(deleteUnchecked) {
    setState('migrating')
    setProgress(0)

    const selectedQuizzes = localData.newQuizzes.filter(q => selectedIds.has(q.id))
    const unselectedQuizzes = localData.newQuizzes.filter(q => !selectedIds.has(q.id))

    if (deleteUnchecked && unselectedQuizzes.length > 0) {
      await dexieDb.quizzes.bulkDelete(unselectedQuizzes.map(q => q.id))
      for (const q of unselectedQuizzes) {
        await dexieDb.records.where('quizId').equals(q.id).delete()
      }
    }

    if (selectedQuizzes.length === 0) { setState('done'); return }

    const { dexieRecords, partialIdMap } = localData
    const uid = user.uid
    const idMap = { ...partialIdMap }

    try {
      for (let i = 0; i < selectedQuizzes.length; i++) {
        const { id: oldId, ...data } = selectedQuizzes[i]
        const ref = await addDoc(collection(firestoreDb, `users/${uid}/quizzes`), {
          question: data.question,
          answer: data.answer,
          category: data.category ?? '',
          excluded: data.excluded ?? false,
          createdAt: data.createdAt ?? Date.now(),
          lastReviewedAt: data.lastReviewedAt ?? null,
          answerHighlights: data.answerHighlights ?? [],
        })
        idMap[oldId] = ref.id
        setProgress(Math.round((i + 1) / selectedQuizzes.length * 70))
      }

      const existingRecSnap = await getDocs(collection(firestoreDb, `users/${uid}/records`))
      const existingRecordSet = new Set(
        existingRecSnap.docs.map(d => {
          const r = d.data()
          return `${r.quizId}||${r.date}||${r.isCorrect}`
        })
      )
      const newRecords = dexieRecords.filter(r => {
        const newQuizId = idMap[r.quizId]
        return newQuizId && !existingRecordSet.has(`${newQuizId}||${r.date}||${r.isCorrect}`)
      })

      const BATCH_SIZE = 400
      for (let i = 0; i < newRecords.length; i += BATCH_SIZE) {
        const batch = writeBatch(firestoreDb)
        newRecords.slice(i, i + BATCH_SIZE).forEach(r => {
          // eslint-disable-next-line no-unused-vars
          const { id, reviewDate, ...rest } = r
          const newRef = doc(collection(firestoreDb, `users/${uid}/records`))
          batch.set(newRef, { ...rest, quizId: idMap[r.quizId], isReview: rest.isReview ?? false })
        })
        await batch.commit()
        setProgress(70 + Math.round(Math.min(i + BATCH_SIZE, newRecords.length) / Math.max(newRecords.length, 1) * 30))
      }
      if (newRecords.length === 0) setProgress(100)

      setState('done')
    } catch (e) {
      alert('추가 실패: ' + e.message)
      setState('prompt')
    }
  }

  if (state === 'done') return children

  if (state === 'checking') return (
    <div style={{ height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'var(--text2)' }}>
      로딩 중...
    </div>
  )

  if (state === 'migrating') return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: 16, padding: 24 }}>
      <div style={{ fontWeight: 600 }}>문제 추가 중...</div>
      <div style={{ width: '100%', maxWidth: 300, height: 8, background: 'var(--bg3)', borderRadius: 4 }}>
        <div style={{ height: '100%', width: `${progress}%`, background: 'var(--accent)', borderRadius: 4, transition: 'width 0.3s' }} />
      </div>
      <div style={{ fontSize: 13, color: 'var(--text2)' }}>{progress}%</div>
    </div>
  )

  if (state === 'confirm-delete') {
    const uncheckedCount = localData.newQuizzes.filter(q => !selectedIds.has(q.id)).length
    return (
      <>
        {children}
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
          display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 1000
        }}>
          <div className="card" style={{
            width: '100%', maxWidth: 480, borderRadius: '16px 16px 0 0',
            padding: 24, margin: 0, border: 'none'
          }}>
            <div style={{ fontSize: 24, marginBottom: 10 }}>🗑️</div>
            <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 8 }}>선택하지 않은 문제</div>
            <p style={{ color: 'var(--text2)', fontSize: 14, marginBottom: 24, lineHeight: 1.7 }}>
              선택하지 않은 <b style={{ color: 'var(--text)' }}>{uncheckedCount}개</b>의 문제가 있어요.<br />
              이 문제들을 이 기기에서 삭제할까요?
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <button className="btn btn-secondary" onClick={() => doMigrate(false)}>그냥 두기</button>
              <button className="btn btn-danger" onClick={() => doMigrate(true)}>삭제하기</button>
            </div>
          </div>
        </div>
      </>
    )
  }

  // state === 'prompt'
  const allSelected = localData?.newQuizzes.every(q => selectedIds.has(q.id))
  const someSelected = localData?.newQuizzes.some(q => selectedIds.has(q.id))

  return (
    <>
      {children}
      <div style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 1000
      }}>
        <div className="card" style={{
          width: '100%', maxWidth: 480, borderRadius: '16px 16px 0 0',
          padding: 24, margin: 0, border: 'none', maxHeight: '80vh',
          display: 'flex', flexDirection: 'column'
        }}>
          <div style={{ fontSize: 24, marginBottom: 10 }}>📝</div>
          <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 4 }}>오프라인에서 만든 문제</div>
          <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 12 }}>
            <b style={{ color: 'var(--text)' }}>{localData?.newQuizzes.length}개</b>를 현재 계정에 추가할 수 있어요.
          </div>

          {/* 전체 선택 */}
          <div
            onClick={handleSelectAll}
            style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
              background: 'var(--bg3)', borderRadius: 10, cursor: 'pointer', marginBottom: 8,
              flexShrink: 0,
            }}
          >
            <input
              type="checkbox"
              checked={allSelected}
              ref={el => { if (el) el.indeterminate = someSelected && !allSelected }}
              onChange={handleSelectAll}
              onClick={e => e.stopPropagation()}
              style={{ width: 16, height: 16, cursor: 'pointer', accentColor: 'var(--accent)', flexShrink: 0 }}
            />
            <span style={{ fontSize: 13, color: 'var(--text2)' }}>
              전체 선택 ({selectedIds.size}/{localData?.newQuizzes.length})
            </span>
          </div>

          {/* 퀴즈 목록 */}
          <div style={{ overflowY: 'auto', flex: 1, marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {localData?.newQuizzes.map((q, i) => (
              <div
                key={i}
                onClick={() => handleToggle(q.id)}
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px',
                  background: selectedIds.has(q.id) ? 'rgba(110,231,183,0.08)' : 'var(--bg3)',
                  borderRadius: 10, cursor: 'pointer',
                  border: `1px solid ${selectedIds.has(q.id) ? 'rgba(110,231,183,0.25)' : 'transparent'}`,
                }}
              >
                <input
                  type="checkbox"
                  checked={selectedIds.has(q.id)}
                  onChange={() => handleToggle(q.id)}
                  onClick={e => e.stopPropagation()}
                  style={{ width: 16, height: 16, marginTop: 2, flexShrink: 0, cursor: 'pointer', accentColor: 'var(--accent)' }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  {q.category && (
                    <span style={{
                      fontSize: 11, padding: '2px 8px', borderRadius: 100,
                      background: 'rgba(110,231,183,0.15)', color: 'var(--accent)',
                      marginBottom: 6, display: 'inline-block',
                    }}>{q.category}</span>
                  )}
                  <div style={{
                    fontSize: 14, fontWeight: 500, marginBottom: 4, lineHeight: 1.4,
                    overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                  }}>
                    {q.question}
                  </div>
                  <div style={{
                    fontSize: 12, color: 'var(--text2)', lineHeight: 1.4,
                    overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical',
                  }}>
                    → {q.answer}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <button className="btn btn-secondary" onClick={() => setState('done')}>건너뛰기</button>
            <button
              className="btn btn-primary"
              onClick={handleMigrateClick}
              disabled={selectedIds.size === 0}
              style={{ opacity: selectedIds.size === 0 ? 0.4 : 1 }}
            >
              {selectedIds.size}개 추가하기
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
