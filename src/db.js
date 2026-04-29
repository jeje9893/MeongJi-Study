import Dexie from 'dexie'

export const db = new Dexie('QuizDB')

db.version(1).stores({
  quizzes: '++id, category, createdAt',
  records: '++id, quizId, date, isCorrect'
})
