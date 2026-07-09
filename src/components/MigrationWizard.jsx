import { useState, useEffect } from 'react'
import { addDoc, writeBatch, doc, collection } from 'firebase/firestore'
import { firestoreDb } from '../firebase'
import { useAuth } from '../contexts/AuthContext'
import { dexieDb } from '../db'

export default function MigrationWizard({ children }) {
  const user = useAuth()
  const [state, setState] = useState('checking') // checking | prompt | migrating | done
  const [localData, setLocalData] = useState(null)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    if (!user) return

    const key = `migrationOffered_${user.uid}`
    if (localStorage.getItem(key)) {
      setState('done')
      return
    }

    Promise.all([
      dexieDb.quizzes.toArray().catch(() => []),
      dexieDb.records.toArray().catch(() => []),
    ]).then(([quizzes, records]) => {
      if (quizzes.length === 0) {
        localStorage.setItem(key, '1')
        setState('done')
      } else {
        setLocalData({ quizzes, records })
        setState('prompt')
      }
    })
  }, [user])

  async function handleMigrate() {
    setState('migrating')
    setProgress(0)
    const { quizzes, records } = localData
    const uid = user.uid
    const idMap = {}

    try {
      const quizzesPath = `users/${uid}/quizzes`
      const recordsPath = `users/${uid}/records`

      for (let i = 0; i < quizzes.length; i++) {
        const { id: oldId, ...data } = quizzes[i]
        const ref = await addDoc(collection(firestoreDb, quizzesPath), {
          question: data.question,
          answer: data.answer,
          category: data.category ?? '',
          excluded: data.excluded ?? false,
          createdAt: data.createdAt ?? Date.now(),
          lastReviewedAt: data.lastReviewedAt ?? null,
          answerHighlights: data.answerHighlights ?? [],
        })
        idMap[oldId] = ref.id
        setProgress(Math.round((i + 1) / quizzes.length * 70))
      }

      const BATCH_SIZE = 400
      for (let i = 0; i < records.length; i += BATCH_SIZE) {
        const batch = writeBatch(firestoreDb)
        records.slice(i, i + BATCH_SIZE).forEach(r => {
          const newQuizId = idMap[r.quizId]
          if (!newQuizId) return
          // eslint-disable-next-line no-unused-vars
          const { id, reviewDate, ...rest } = r
          const newRef = doc(collection(firestoreDb, recordsPath))
          batch.set(newRef, {
            ...rest,
            quizId: newQuizId,
            isReview: rest.isReview ?? false,
          })
        })
        await batch.commit()
        setProgress(70 + Math.round(Math.min(i + BATCH_SIZE, records.length) / records.length * 30))
      }

      localStorage.setItem(`migrationOffered_${uid}`, '1')
      setState('done')
    } catch (e) {
      alert('마이그레이션 실패: ' + e.message)
      setState('prompt')
    }
  }

  function handleSkip() {
    localStorage.setItem(`migrationOffered_${user.uid}`, '1')
    setState('done')
  }

  if (state === 'done') return children

  if (state === 'checking') return (
    <div style={{ height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'var(--text2)' }}>
      로딩 중...
    </div>
  )

  if (state === 'migrating') return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: 16, padding: 24 }}>
      <div style={{ fontWeight: 600 }}>데이터 이전 중...</div>
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
        <div className="card" style={{ width: '100%', maxWidth: 480, borderRadius: '16px 16px 0 0', padding: 28, margin: 0, border: 'none' }}>
          <div style={{ fontSize: 28, marginBottom: 12 }}>📦</div>
          <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 8 }}>기존 문제 발견</div>
          <p style={{ color: 'var(--text2)', fontSize: 14, marginBottom: 24, lineHeight: 1.7 }}>
            이 기기에 저장된 <b style={{ color: 'var(--text)' }}>{localData?.quizzes.length}개</b>의 문제가 있어요.<br />
            클라우드로 이전하면 모든 기기에서 사용할 수 있어요.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <button className="btn btn-secondary" onClick={handleSkip}>나중에</button>
            <button className="btn btn-primary" onClick={handleMigrate}>클라우드로 이전</button>
          </div>
        </div>
      </div>
    </>
  )
}
