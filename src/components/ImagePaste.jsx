import { useState, useRef } from 'react'
import { readImageFromClipboard } from '../imageUtils'

// 이미지 붙여넣기 버튼.
// 1) 데스크톱/안드로이드: navigator.clipboard.read()로 즉시 읽기.
// 2) iOS(특히 홈화면 PWA): read()가 이미지를 못 주므로, contentEditable 영역을 띄워
//    사용자가 네이티브 '붙여넣기'로 넣게 하고 paste 이벤트에서 이미지를 가져온다.
export default function ImagePasteButton({ onImage, style }) {
  const [showBox, setShowBox] = useState(false)
  const boxRef = useRef()

  async function handleClick() {
    try {
      const blob = await readImageFromClipboard()
      if (blob) { onImage(blob); return }
    } catch {
      // 아래 붙여넣기 영역으로 폴백
    }
    setShowBox(true)
    setTimeout(() => boxRef.current?.focus(), 50)
  }

  function handlePaste(e) {
    const cd = e.clipboardData
    let blob = null
    for (const it of cd?.items || []) {
      if (it.type?.startsWith('image/')) { blob = it.getAsFile(); break }
    }
    if (!blob) {
      for (const f of cd?.files || []) {
        if (f.type?.startsWith('image/')) { blob = f; break }
      }
    }
    e.preventDefault()
    if (boxRef.current) boxRef.current.textContent = ''
    if (blob) {
      onImage(blob)
      setShowBox(false)
    } else {
      alert('붙여넣은 것에 이미지가 없어요')
    }
  }

  return (
    <>
      <button type="button" onClick={handleClick} style={style}>📋 붙여넣기</button>
      {showBox && (
        <div style={{ width: '100%', marginTop: 6 }}>
          <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 4 }}>
            아래 칸을 길게 눌러 <b>붙여넣기</b>를 선택하세요 (데스크톱은 Ctrl+V)
          </div>
          <div
            ref={boxRef}
            contentEditable
            suppressContentEditableWarning
            onPaste={handlePaste}
            style={{
              minHeight: 44, border: '1px dashed rgba(255,255,255,0.25)', borderRadius: 8,
              padding: 8, fontSize: 12, color: 'var(--text2)', background: 'rgba(0,0,0,0.2)',
              outline: 'none', WebkitUserSelect: 'text', userSelect: 'text',
            }}
          />
          <button
            type="button"
            onClick={() => setShowBox(false)}
            style={{ marginTop: 4, padding: '2px 8px', borderRadius: 100, border: 'none', background: 'transparent', color: 'var(--text2)', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            취소
          </button>
        </div>
      )}
    </>
  )
}
