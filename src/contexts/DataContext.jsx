import { createContext, useContext } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useAuth } from './AuthContext'
import { useCollection } from '../hooks/useCollection'
import {
  dexieDb,
  addQuiz, updateQuiz, deleteQuiz, addRecord, deleteRecord, bulkDeleteRecords,
  exportFirestoreData, importFirestoreData,
  addQuizOffline, updateQuizOffline, deleteQuizOffline,
  addRecordOffline, deleteRecordOffline, bulkDeleteRecordsOffline,
  exportOfflineData, importOfflineData,
} from '../db'

const DataContext = createContext(null)

export function DataProvider({ children }) {
  const user = useAuth()

  // 조건부 hook 금지 — 항상 두 소스 모두 구독하고 user 유무로 선택
  const firestoreQuizzes = useCollection(user ? `users/${user.uid}/quizzes` : null)
  const firestoreRecords = useCollection(user ? `users/${user.uid}/records` : null)
  const dexieQuizzes = useLiveQuery(() => dexieDb.quizzes.orderBy('createdAt').reverse().toArray(), [])
  const dexieRecords = useLiveQuery(() => dexieDb.records.toArray(), [])

  // Dexie id는 숫자 → 문자열로 정규화해 Firestore 문자열 id와 인터페이스 통일
  const quizzes = user
    ? firestoreQuizzes
    : dexieQuizzes?.map(q => ({ ...q, id: String(q.id) }))

  const records = user
    ? firestoreRecords
    : dexieRecords?.map(r => ({ ...r, id: String(r.id), quizId: String(r.quizId) }))

  const ops = user
    ? {
        addQuiz: d => addQuiz(user.uid, d),
        updateQuiz: (id, d) => updateQuiz(user.uid, id, d),
        deleteQuiz: id => deleteQuiz(user.uid, id),
        addRecord: d => addRecord(user.uid, d),
        deleteRecord: id => deleteRecord(user.uid, id),
        bulkDeleteRecords: ids => bulkDeleteRecords(user.uid, ids),
        exportData: () => exportFirestoreData(user.uid),
        importData: file => importFirestoreData(user.uid, file),
      }
    : {
        addQuiz: d => addQuizOffline(d),
        updateQuiz: (id, d) => updateQuizOffline(id, d),
        deleteQuiz: id => deleteQuizOffline(id),
        addRecord: d => addRecordOffline(d),
        deleteRecord: id => deleteRecordOffline(id),
        bulkDeleteRecords: ids => bulkDeleteRecordsOffline(ids),
        exportData: () => exportOfflineData(),
        importData: file => importOfflineData(file),
      }

  return (
    <DataContext.Provider value={{ quizzes, records, ...ops }}>
      {children}
    </DataContext.Provider>
  )
}

export function useData() {
  const ctx = useContext(DataContext)
  if (!ctx) throw new Error('useData must be used within DataProvider')
  return ctx
}
