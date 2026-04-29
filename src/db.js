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