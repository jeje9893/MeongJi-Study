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

// 버전 3: reviewDate 필드 추가 (한달 뒤 복습 알림용)
db.version(3).stores({
  quizzes: '++id, category, createdAt, excluded',
  records: '++id, quizId, date, isCorrect, reviewDate'
}).upgrade(tx => {
  return tx.table('records').toCollection().modify(r => {
    if (!r.reviewDate) r.reviewDate = null
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

  // question+answer 기준으로 중복 체크
  const existingSet = new Set(
    existingQuizzes.map(q => `${q.question}||${q.answer}`)
  )

  // 기존 id → 새 id 매핑 (records 연결용)
  const idMap = {}
  let addedCount = 0
  let skippedCount = 0

  for (const q of payload.quizzes) {
    const key = `${q.question}||${q.answer}`
    if (existingSet.has(key)) {
      // 중복 문제: 기존 id 찾아서 매핑
      const existing = existingQuizzes.find(e => `${e.question}||${e.answer}` === key)
      if (existing) idMap[q.id] = existing.id
      skippedCount++
    } else {
      const { id: oldId, ...rest } = q
      const newId = await db.quizzes.add({ ...rest, excluded: rest.excluded ?? false, createdAt: rest.createdAt ?? Date.now() })
      idMap[oldId] = newId
      existingSet.add(key)
      addedCount++
    }
  }

  // records 가져오기 (quizId를 새 id로 매핑)
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