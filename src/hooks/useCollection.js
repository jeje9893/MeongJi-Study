import { useEffect, useState } from 'react'
import { collection, onSnapshot } from 'firebase/firestore'
import { firestoreDb } from '../firebase'

export function useCollection(path) {
  const [data, setData] = useState(undefined)
  useEffect(() => {
    if (!path) return
    const ref = collection(firestoreDb, path)
    return onSnapshot(ref, snap => {
      setData(snap.docs.map(d => ({ ...d.data(), id: d.id })))
    })
  }, [path])
  return data
}
