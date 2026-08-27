import { useState, useEffect, useMemo } from 'react'
import { useData } from './contexts/DataContext'

// image 값 → <img src> 문자열 해결.
//   { file }  : 새로 고른 파일 (미리보기용 object URL)
//   { dataUrl }: 이미 로드된 dataURL
//   { id }    : Firestore quizImages 문서 참조 → lazy 로드(+ 모듈 캐시)
//   { url }   : 레거시 직접 URL
// 로그인 안 됐거나(getImage 없음) 못 찾으면 null.

const cache = new Map() // id -> dataUrl

export function useImageSrc(image) {
  const { getImage } = useData()

  // 즉시 알 수 있는 소스는 렌더 중에 계산(effect에서 동기 setState 금지 규칙 회피)
  const immediate = useMemo(() => {
    if (!image) return null
    if (image.file) return URL.createObjectURL(image.file)
    if (image.dataUrl) return image.dataUrl
    if (image.url) return image.url
    if (image.id && cache.has(image.id)) return cache.get(image.id)
    return null
  }, [image])

  // object URL 정리
  useEffect(() => {
    if (image?.file && immediate) return () => URL.revokeObjectURL(immediate)
  }, [image, immediate])

  // id 참조는 비동기로 로드 (setState는 async 콜백 안에서만)
  const [fetched, setFetched] = useState(null)
  useEffect(() => {
    let alive = true
    if (image?.id && !cache.has(image.id) && getImage) {
      getImage(image.id).then(d => {
        if (alive && d) { cache.set(image.id, d); setFetched(d) }
      })
    }
    return () => { alive = false }
  }, [image, getImage])

  return immediate || fetched
}
