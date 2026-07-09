import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: "AIzaSyAbUBDHcwkDa34vQYCHxI_9sy5haokoDa8",
  authDomain: "quizapp-4f681.firebaseapp.com",
  projectId: "quizapp-4f681",
  storageBucket: "quizapp-4f681.firebasestorage.app",
  messagingSenderId: "1088593233470",
  appId: "1:1088593233470:web:da7d57dd869b5afc3df36f",
  measurementId: "G-JH57ZDZ6KJ"
}

const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const firestoreDb = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
})
