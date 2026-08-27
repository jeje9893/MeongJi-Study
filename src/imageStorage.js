// 퀴즈 이미지를 Firestore 별도 컬렉션(users/{uid}/quizImages)에 base64로 저장한다.
// 퀴즈 문서엔 참조 { id }만 넣어 목록/검색 구독을 가볍게 유지하고, 표시할 때만 lazy 로드.
// (Firebase Storage 없이 무료 Spark 요금제에서 동작)

import { collection, doc, addDoc, getDoc, deleteDoc } from 'firebase/firestore'
import { firestoreDb } from './firebase'
import { compressImage, blobToDataUrl } from './imageUtils'

const FIRESTORE_DOC_LIMIT = 1_000_000 // 문서 1MiB 제한 여유 (base64 문자열 기준)

function imagesRef(uid) {
  return collection(firestoreDb, `users/${uid}/quizImages`)
}

// 문서 제한 안에 들어올 때까지 점진적으로 더 강하게 압축
async function compressToLimit(file) {
  const attempts = [
    { maxDim: 1280, quality: 0.8 },
    { maxDim: 1024, quality: 0.7 },
    { maxDim: 800, quality: 0.6 },
  ]
  let dataUrl = null
  for (const opt of attempts) {
    const blob = await compressImage(file, opt)
    dataUrl = await blobToDataUrl(blob)
    if (dataUrl.length <= 950_000) return dataUrl
  }
  if (dataUrl && dataUrl.length <= FIRESTORE_DOC_LIMIT) return dataUrl
  throw new Error('이미지 용량이 너무 커요. 더 작은 이미지를 사용해주세요')
}

// 반환: { id }
export async function uploadQuizImage(uid, file) {
  const dataUrl = await compressToLimit(file)
  const ref = await addDoc(imagesRef(uid), { dataUrl, createdAt: Date.now() })
  return { id: ref.id }
}

// 표시용 dataUrl 로드 (없으면 null)
export async function getQuizImage(uid, id) {
  if (!id) return null
  const snap = await getDoc(doc(firestoreDb, `users/${uid}/quizImages`, id))
  return snap.exists() ? snap.data().dataUrl ?? null : null
}

// best-effort — 실패해도 무시(고아 문서는 기능을 막지 않음)
export async function deleteQuizImage(uid, id) {
  if (!id) return
  try {
    await deleteDoc(doc(firestoreDb, `users/${uid}/quizImages`, id))
  } catch {
    // ignore
  }
}

// 저장 시 이미지 상태 해결.
//   nv: null | { id }(변경 없음) | { file }(새 선택)
//   ov: 기존 { id } | null
//   uploadImage/deleteImage: DataContext ops (로그인 시 함수, 비로그인 시 null)
// 반환: 저장할 { id } | null
export async function resolveQuizImage(nv, ov, uploadImage, deleteImage) {
  if (nv?.file) {
    if (!uploadImage) return ov ?? null // 업로드 불가 환경이면 기존 유지
    const up = await uploadImage(nv.file)
    if (ov?.id && deleteImage) await deleteImage(ov.id) // 교체 → 이전 이미지 정리
    return up
  }
  if (nv == null) {
    if (ov?.id && deleteImage) await deleteImage(ov.id) // 제거
    return null
  }
  return nv // 변경 없는 { id }
}
