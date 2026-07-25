import Dexie from 'dexie'
import {
  collection, doc, addDoc, updateDoc, deleteDoc, getDocs, writeBatch, query, where
} from 'firebase/firestore'
import { firestoreDb } from './firebase'

// Dexie 인스턴스 (마이그레이션 마법사 전용 — 로컬 IndexedDB 읽기용)
export const dexieDb = new Dexie('QuizDB')

dexieDb.version(1).stores({
  quizzes: '++id, category, createdAt',
  records: '++id, quizId, date, isCorrect'
})

// 버전 2: excluded 필드 추가
dexieDb.version(2).stores({
  quizzes: '++id, category, createdAt, excluded',
  records: '++id, quizId, date, isCorrect'
}).upgrade(tx => {
  return tx.table('quizzes').toCollection().modify(q => {
    q.excluded = false
  })
})

// 버전 3: reviewDate 필드 추가
dexieDb.version(3).stores({
  quizzes: '++id, category, createdAt, excluded',
  records: '++id, quizId, date, isCorrect, reviewDate'
}).upgrade(tx => {
  return tx.table('records').toCollection().modify(r => {
    if (!r.reviewDate) r.reviewDate = null
  })
})

// 버전 4: quizzes에 lastReviewedAt 추가
dexieDb.version(4).stores({
  quizzes: '++id, category, createdAt, excluded, lastReviewedAt',
  records: '++id, quizId, date, isCorrect, reviewDate'
}).upgrade(tx => {
  return tx.table('quizzes').toCollection().modify(q => {
    if (!q.lastReviewedAt) q.lastReviewedAt = null
  })
})

// 버전 5: answerHighlights 추가
dexieDb.version(5).stores({
  quizzes: '++id, category, createdAt, excluded, lastReviewedAt',
  records: '++id, quizId, date, isCorrect, reviewDate'
}).upgrade(tx => {
  return tx.table('quizzes').toCollection().modify(q => {
    if (!q.answerHighlights) q.answerHighlights = []
  })
})

// ── Firestore CRUD 헬퍼 ──────────────────────────────────────────────────────

function quizzesRef(uid) {
  return collection(firestoreDb, `users/${uid}/quizzes`)
}

function recordsRef(uid) {
  return collection(firestoreDb, `users/${uid}/records`)
}

export async function addQuiz(uid, data) {
  return addDoc(quizzesRef(uid), {
    question: data.question,
    answer: data.answer,
    category: data.category ?? '',
    excluded: data.excluded ?? false,
    createdAt: data.createdAt ?? Date.now(),
    lastReviewedAt: data.lastReviewedAt ?? null,
    answerHighlights: data.answerHighlights ?? [],
  })
}

export async function updateQuiz(uid, quizId, data) {
  return updateDoc(doc(firestoreDb, `users/${uid}/quizzes`, quizId), data)
}

export async function deleteQuiz(uid, quizId) {
  await deleteDoc(doc(firestoreDb, `users/${uid}/quizzes`, quizId))
  const q = query(recordsRef(uid), where('quizId', '==', quizId))
  const snap = await getDocs(q)
  if (snap.empty) return
  const batch = writeBatch(firestoreDb)
  snap.docs.forEach(d => batch.delete(d.ref))
  await batch.commit()
}

export async function addRecord(uid, data) {
  return addDoc(recordsRef(uid), data)
}

export async function deleteRecord(uid, recordId) {
  return deleteDoc(doc(firestoreDb, `users/${uid}/records`, recordId))
}

export async function bulkDeleteRecords(uid, ids) {
  const batch = writeBatch(firestoreDb)
  ids.forEach(id => batch.delete(doc(firestoreDb, `users/${uid}/records`, id)))
  await batch.commit()
}

export async function exportFirestoreData(uid) {
  const [quizSnap, recSnap] = await Promise.all([
    getDocs(quizzesRef(uid)),
    getDocs(recordsRef(uid))
  ])
  const payload = {
    version: 2,
    exportedAt: new Date().toISOString(),
    quizzes: quizSnap.docs.map(d => ({ ...d.data(), id: d.id })),
    records: recSnap.docs.map(d => ({ ...d.data(), id: d.id }))
  }
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `quiz-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}

export async function importFirestoreData(uid, file) {
  const text = await file.text()
  const payload = JSON.parse(text)
  if (!payload.quizzes || !Array.isArray(payload.quizzes)) {
    throw new Error('올바른 백업 파일이 아니에요')
  }

  const existingSnap = await getDocs(quizzesRef(uid))
  const existingQuizzes = existingSnap.docs.map(d => ({ ...d.data(), id: d.id }))
  const existingSet = new Set(existingQuizzes.map(q => `${q.question}||${q.answer}`))

  const idMap = {}
  let addedCount = 0
  let skippedCount = 0

  for (const q of payload.quizzes) {
    const key = `${q.question}||${q.answer}`
    if (existingSet.has(key)) {
      const existing = existingQuizzes.find(e => `${e.question}||${e.answer}` === key)
      if (existing) idMap[q.id] = existing.id
      skippedCount++
    } else {
      const { id: oldId, ...rest } = q
      const docRef = await addDoc(quizzesRef(uid), {
        question: rest.question,
        answer: rest.answer,
        category: rest.category ?? '',
        excluded: rest.excluded ?? false,
        createdAt: rest.createdAt ?? Date.now(),
        lastReviewedAt: rest.lastReviewedAt ?? null,
        answerHighlights: rest.answerHighlights ?? [],
      })
      idMap[oldId] = docRef.id
      existingSet.add(key)
      addedCount++
    }
  }

  let recordsAdded = 0
  if (payload.records && Array.isArray(payload.records)) {
    const existingRecSnap = await getDocs(recordsRef(uid))
    const existingRecords = existingRecSnap.docs.map(d => d.data())
    const existingRecordSet = new Set(existingRecords.map(r => `${r.quizId}||${r.date}||${r.isCorrect}`))

    for (const r of payload.records) {
      const newQuizId = idMap[r.quizId]
      if (!newQuizId) continue
      const key = `${newQuizId}||${r.date}||${r.isCorrect}`
      if (!existingRecordSet.has(key)) {
        // eslint-disable-next-line no-unused-vars
        const { id, reviewDate, ...rest } = r
        await addDoc(recordsRef(uid), { ...rest, quizId: newQuizId, isReview: rest.isReview ?? false })
        existingRecordSet.add(key)
        recordsAdded++
      }
    }
  }

  return { addedCount, skippedCount, recordsAdded }
}

// ── 오프라인(Dexie) CRUD 헬퍼 ──────────────────────────────────────────────

export async function addQuizOffline(data) {
  const id = await dexieDb.quizzes.add({
    question: data.question,
    answer: data.answer,
    category: data.category ?? '',
    excluded: data.excluded ?? false,
    createdAt: data.createdAt ?? Date.now(),
    lastReviewedAt: data.lastReviewedAt ?? null,
    answerHighlights: data.answerHighlights ?? [],
  })
  return { id: String(id) }
}

export async function updateQuizOffline(quizId, data) {
  return dexieDb.quizzes.update(Number(quizId), data)
}

export async function deleteQuizOffline(quizId) {
  await dexieDb.quizzes.delete(Number(quizId))
  await dexieDb.records.where('quizId').equals(Number(quizId)).delete()
}

export async function addRecordOffline(data) {
  const id = await dexieDb.records.add({
    quizId: Number(data.quizId),
    date: data.date,
    isCorrect: data.isCorrect,
    isReview: data.isReview ?? false,
  })
  return { id: String(id) }
}

export async function deleteRecordOffline(recordId) {
  return dexieDb.records.delete(Number(recordId))
}

export async function bulkDeleteRecordsOffline(ids) {
  return dexieDb.records.bulkDelete(ids.map(Number))
}

export async function exportOfflineData() {
  const [quizzes, records] = await Promise.all([
    dexieDb.quizzes.toArray(),
    dexieDb.records.toArray(),
  ])
  const payload = {
    version: 2,
    exportedAt: new Date().toISOString(),
    quizzes: quizzes.map(q => ({ ...q, id: String(q.id) })),
    records: records.map(r => ({ ...r, id: String(r.id), quizId: String(r.quizId) })),
  }
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `quiz-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}

export async function importOfflineData(file) {
  const text = await file.text()
  const payload = JSON.parse(text)
  if (!payload.quizzes || !Array.isArray(payload.quizzes))
    throw new Error('올바른 백업 파일이 아니에요')

  const existingQuizzes = await dexieDb.quizzes.toArray()
  const existingSet = new Set(existingQuizzes.map(q => `${q.question}||${q.answer}`))
  const idMap = {}
  let addedCount = 0
  let skippedCount = 0

  for (const q of payload.quizzes) {
    const key = `${q.question}||${q.answer}`
    if (existingSet.has(key)) {
      const ex = existingQuizzes.find(e => `${e.question}||${e.answer}` === key)
      if (ex) idMap[q.id] = String(ex.id)
      skippedCount++
    } else {
      const { id: oldId, ...rest } = q
      const newId = await dexieDb.quizzes.add({
        question: rest.question, answer: rest.answer,
        category: rest.category ?? '', excluded: rest.excluded ?? false,
        createdAt: rest.createdAt ?? Date.now(),
        lastReviewedAt: rest.lastReviewedAt ?? null,
        answerHighlights: rest.answerHighlights ?? [],
      })
      idMap[oldId] = String(newId)
      existingSet.add(key)
      addedCount++
    }
  }

  let recordsAdded = 0
  if (Array.isArray(payload.records)) {
    const existingRecords = await dexieDb.records.toArray()
    const existingRecordSet = new Set(
      existingRecords.map(r => `${r.quizId}||${r.date}||${r.isCorrect}`)
    )
    for (const r of payload.records) {
      const newQuizId = idMap[r.quizId]
      if (!newQuizId) continue
      const key = `${newQuizId}||${r.date}||${r.isCorrect}`
      if (!existingRecordSet.has(key)) {
        // eslint-disable-next-line no-unused-vars
        const { id, ...rest } = r
        await dexieDb.records.add({
          ...rest,
          quizId: Number(newQuizId),
          isReview: rest.isReview ?? false,
        })
        existingRecordSet.add(key)
        recordsAdded++
      }
    }
  }

  return { addedCount, skippedCount, recordsAdded }
}
