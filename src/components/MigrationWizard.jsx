import { useState, useEffect } from 'react'
import { addDoc, writeBatch, doc, collection, getDocs } from 'firebase/firestore'
import { firestoreDb } from '../firebase'
import { useAuth } from '../contexts/AuthContext'
import { dexieDb } from '../db'

export default function MigrationWizard({ children }) {
  const user = useAuth()
  const [state, setState] = useState('checking') // checking | prompt | migrating | done
  const [localData, setLocalData] = useState(null)
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

      // 이미 Firestore에 있는 문제의 Dexie ID → Firestore ID 매핑 (records 이전 시 필요)
      const partialIdMap = {}
      firestoreQuizzes.forEach(fq => {
        const match = dexieQuizzes.find(dq => `${dq.question}||${dq.answer}` === `${fq.question}||${fq.answer}`)
        if (match) partialIdMap[match.id] = fq.id
      })

      const newQuizzes = dexieQuizzes.filter(q => !firestoreSet.has(`${q.question}||${q.answer}`))

      if (newQuizzes.length === 0) { setState('done'); return }

      setLocalData({ newQuizzes, dexieRecords, partialIdMap })
      setState('prompt')
    })
  }, [user])

  async function handleMigrate() {
    setState('migrating')
    setProgress(0)
    const { newQuizzes, dexieRecords, partialIdMap } = localData
    const uid = user.uid
    const idMap = { ...partialIdMap }

    try {
      // 새 퀴즈 Firestore에 추가
      for (let i = 0; i < newQuizzes.length; i++) {
        const { id: oldId, ...data } = newQuizzes[i]
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
        setProgress(Math.round((i + 1) / newQuizzes.length * 70))
      }

      // 연관 records 추가 (중복 체크)
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
          <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 16 }}>
            <b style={{ color: 'var(--text)' }}>{localData?.newQuizzes.length}개</b>를 현재 계정에 추가할 수 있어요.
          </div>

          <div style={{ overflowY: 'auto', flex: 1, marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {localData?.newQuizzes.map((q, i) => (
              <div key={i} style={{ padding: '10px 12px', background: 'var(--bg3)', borderRadius: 10 }}>
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
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <button className="btn btn-secondary" onClick={() => setState('done')}>건너뛰기</button>
            <button className="btn btn-primary" onClick={handleMigrate}>
              {localData?.newQuizzes.length}개 추가하기
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
