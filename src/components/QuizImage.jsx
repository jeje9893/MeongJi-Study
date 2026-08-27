// 퀴즈 문제/정답 이미지 표시 — image({id}/{dataUrl}/{url})를 lazy 로드해 렌더, 없으면 null

import { useImageSrc } from '../useImageSrc'

export default function QuizImage({ image, style }) {
  const src = useImageSrc(image)
  if (!src) return null
  return (
    <img
      src={src}
      alt=""
      loading="lazy"
      style={{
        display: 'block',
        maxWidth: '100%',
        maxHeight: 320,
        borderRadius: 8,
        objectFit: 'contain',
        marginTop: 10,
        ...style,
      }}
    />
  )
}
