import { useState, useEffect } from 'react'
import { addDoc, writeBatch, doc, collection, getDocs, runTransaction, serverTimestamp } from 'firebase/firestore'
import { firestoreDb } from '../firebase'
import { useAuth } from '../contexts/AuthContext'
import { dexieDb } from '../db'

export default function MigrationWizard({ children }) {
  const user = useAuth()
  const [state, setState] = useState('checking') // checking | prompt | migrating | waiting | done
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

    const lockRef = doc(firestoreDb, `users/${uid}/meta/migration`)

    try {
      // Firestore 트랜잭션으로 마이그레이션 락 획득
      let alreadyDone = false
      await runTransaction(firestoreDb, async (tx) => {
        const lockDoc = await tx.get(lockRef)
        if (lockDoc.exists()) {
          const status = lockDoc.data().status
          if (status === 'done' || status === 'in_progress') {
            alreadyDone = true
            return
          }
        }
        tx.set(lockRef, { status: 'in_progress', startedAt: serverTimestamp() })
      })

      // 다른 기기가 이미 마이그레이션 중이거나 완료한 경우
      if (alreadyDone) {
        localStorage.setItem(`migrationOffered_${uid}`, '1')
        setState('done')
        return
      }

      // Firestore에 이미 있는 문제 조회 (중복 방지)
      const existingSnap = await getDocs(collection(firestoreDb, `users/${uid}/quizzes`))
      const existingQuizzes = existingSnap.docs.map(d => ({ ...d.data(), id: d.id }))
      const existingSet = new Set(existingQuizzes.map(q => `${q.question}||${q.answer}`))

      // 로컬 ID → Firestore ID 매핑 (이미 있는 문제 포함)
      const idMap = {}
      existingQuizzes.forEach(eq => {
        const localMatch = quizzes.find(lq => `${lq.question}||${lq.answer}` === `${eq.question}||${eq.answer}`)
        if (localMatch) idMap[localMatch.id] = eq.id
      })

      // 아직 없는 문제만 업로드
      const newQuizzes = quizzes.filter(q => !existingSet.has(`${q.question}||${q.answer}`))
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
        setProgress(Math.round((i + 1) / Math.max(newQuizzes.length, 1) * 70))
      }
      if (newQuizzes.length === 0) setProgress(70)

      // 기록 중복 체크 후 업로드
      const existingRecSnap = await getDocs(collection(firestoreDb, `users/${uid}/records`))
      const existingRecordSet = new Set(
        existingRecSnap.docs.map(d => {
          const r = d.data()
          return `${r.quizId}||${r.date}||${r.isCorrect}`
        })
      )

      const newRecords = records.filter(r => {
        const newQuizId = idMap[r.quizId]
        if (!newQuizId) return false
        return !existingRecordSet.has(`${newQuizId}||${r.date}||${r.isCorrect}`)
      })

      const BATCH_SIZE = 400
      for (let i = 0; i < newRecords.length; i += BATCH_SIZE) {
        const batch = writeBatch(firestoreDb)
        newRecords.slice(i, i + BATCH_SIZE).forEach(r => {
          const newQuizId = idMap[r.quizId]
          // eslint-disable-next-line no-unused-vars
          const { id, reviewDate, ...rest } = r
          const newRef = doc(collection(firestoreDb, `users/${uid}/records`))
          batch.set(newRef, { ...rest, quizId: newQuizId, isReview: rest.isReview ?? false })
        })
        await batch.commit()
        setProgress(70 + Math.round(Math.min(i + BATCH_SIZE, newRecords.length) / Math.max(newRecords.length, 1) * 30))
      }
      if (newRecords.length === 0) setProgress(100)

      // 락 해제 및 완료 표시
      await runTransaction(firestoreDb, async (tx) => {
        tx.set(lockRef, { status: 'done', finishedAt: serverTimestamp() })
      })

      localStorage.setItem(`migrationOffered_${uid}`, '1')
      setState('done')
    } catch (e) {
      // 락 해제 시도
      runTransaction(firestoreDb, async (tx) => {
        tx.set(lockRef, { status: 'failed' })
      }).catch(() => {})
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
            클라우드로 이전하면 모든 기기에서 사용할 수 있어요.<br />
            <span style={{ fontSize: 13 }}>이미 클라우드에 있는 문제는 중복 추가되지 않아요.</span>
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
