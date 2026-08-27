// 업로드 전 이미지 리사이즈/압축 — 용량과 로딩 속도 최적화
// 원본이 maxDim보다 크면 비율 유지로 축소, 작으면 그대로. WebP로 인코딩(미지원 시 JPEG).

const MAX_INPUT_BYTES = 20 * 1024 * 1024 // 20MB 이상 원본은 거부

export async function compressImage(file, { maxDim = 1280, quality = 0.85 } = {}) {
  if (!file || !file.type?.startsWith('image/')) {
    throw new Error('이미지 파일이 아니에요')
  }
  if (file.size > MAX_INPUT_BYTES) {
    throw new Error('이미지가 너무 커요 (최대 20MB)')
  }

  const bitmap = await createImageBitmap(file)
  const { width, height } = bitmap
  const scale = Math.min(1, maxDim / Math.max(width, height))
  const w = Math.max(1, Math.round(width * scale))
  const h = Math.max(1, Math.round(height * scale))

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  ctx.drawImage(bitmap, 0, 0, w, h)
  bitmap.close?.()

  // WebP 우선, 실패하면 JPEG
  let blob = await canvasToBlob(canvas, 'image/webp', quality)
  if (!blob) blob = await canvasToBlob(canvas, 'image/jpeg', quality)
  if (!blob) throw new Error('이미지 처리에 실패했어요')
  return blob
}

function canvasToBlob(canvas, type, quality) {
  return new Promise(resolve => canvas.toBlob(resolve, type, quality))
}

// Blob → data URL(base64) 문자열
export function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}
