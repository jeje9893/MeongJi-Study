// 퀴즈 문제/정답 이미지 표시 — image({id}/{dataUrl}/{url})를 lazy 로드해 렌더, 없으면 null
// 탭하면 전체화면 뷰어(핀치 줌)로 확대.

import { useState } from 'react'
import { useImageSrc } from '../useImageSrc'
import ImageViewer from './ImageViewer'

export default function QuizImage({ image, style }) {
  const src = useImageSrc(image)
  const [open, setOpen] = useState(false)
  if (!src) return null
  return (
    <>
      <img
        src={src}
        alt=""
        loading="lazy"
        onClick={() => setOpen(true)}
        style={{
          display: 'block',
          maxWidth: '100%',
          maxHeight: 320,
          borderRadius: 8,
          objectFit: 'contain',
          marginTop: 10,
          cursor: 'zoom-in',
          ...style,
        }}
      />
      {open && <ImageViewer src={src} onClose={() => setOpen(false)} />}
    </>
  )
}
