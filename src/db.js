import Dexie from 'dexie'

export const db = new Dexie('QuizDB')

db.version(1).stores({
  quizzes: '++id, category, createdAt',
  records: '++id, quizId, date, isCorrect'
})

// 버전 2: excluded 필드 추가
db.version(2).stores({
  quizzes: '++id, category, createdAt, excluded',
  records: '++id, quizId, date, isCorrect'
}).upgrade(tx => {
  return tx.table('quizzes').toCollection().modify(q => {
    q.excluded = false
  })
})

// 버전 3: reviewDate 필드 추가
db.version(3).stores({
  quizzes: '++id, category, createdAt, excluded',
  records: '++id, quizId, date, isCorrect, reviewDate'
}).upgrade(tx => {
  return tx.table('records').toCollection().modify(r => {
    if (!r.reviewDate) r.reviewDate = null
  })
})

// 버전 4: quizzes에 lastReviewedAt 추가 (복습 탭 날짜 추적용)
db.version(4).stores({
  quizzes: '++id, category, createdAt, excluded, lastReviewedAt',
  records: '++id, quizId, date, isCorrect, reviewDate'
}).upgrade(tx => {
  return tx.table('quizzes').toCollection().modify(q => {
    if (!q.lastReviewedAt) q.lastReviewedAt = null
  })
})

// 전체 데이터 내보내기
export async function exportData() {
  const quizzes = await db.quizzes.toArray()
  const records = await db.records.toArray()
  const payload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    quizzes,
    records
  }
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `meongji-backup-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}

// 데이터 가져오기 (병합 방식: 기존 데이터 유지 + 새 문제 추가)
export async function importData(file) {
  const text = await file.text()
  const payload = JSON.parse(text)
  if (!payload.quizzes || !Array.isArray(payload.quizzes)) {
    throw new Error('올바른 백업 파일이 아니에요')
  }

  const existingQuizzes = await db.quizzes.toArray()

  const existingSet = new Set(
    existingQuizzes.map(q => `${q.question}||${q.answer}`)
  )

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
      const newId = await db.quizzes.add({
        ...rest,
        excluded: rest.excluded ?? false,
        createdAt: rest.createdAt ?? Date.now(),
        lastReviewedAt: rest.lastReviewedAt ?? null
      })
      idMap[oldId] = newId
      existingSet.add(key)
      addedCount++
    }
  }

  let recordsAdded = 0
  if (payload.records && Array.isArray(payload.records)) {
    const existingRecords = await db.records.toArray()
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
        await db.records.add({ ...rest, quizId: newQuizId })
        existingRecordSet.add(key)
        recordsAdded++
      }
    }
  }

  return { addedCount, skippedCount, recordsAdded }
}
