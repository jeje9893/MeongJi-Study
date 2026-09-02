import { useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'

// 전체화면 이미지 뷰어 — 탭으로 열고, 핀치/휠로 확대·축소, 드래그로 이동, 탭/✕/Esc로 닫기.
// 뷰포트 네이티브 줌에 기대지 않고 터치 이벤트로 직접 처리한다(독립형 PWA 대응).

const MIN = 1
const MAX = 5

function distance(a, b) {
  return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)
}
function midpoint(a, b) {
  return { x: (a.clientX + b.clientX) / 2, y: (a.clientY + b.clientY) / 2 }
}
function clamp(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v))
}

export default function ImageViewer({ src, onClose }) {
  const overlayRef = useRef(null)
  const imgRef = useRef(null)
  const t = useRef({ scale: 1, x: 0, y: 0 }).current
  const g = useRef({}).current
  const lastTap = useRef({ time: 0, x: 0, y: 0 }).current

  useEffect(() => {
    const overlay = overlayRef.current
    if (!overlay) return

    const apply = (withTransition) => {
      const img = imgRef.current
      if (!img) return
      img.style.transition = withTransition ? 'transform 0.2s ease' : 'none'
      img.style.transform = `translate(${t.x}px, ${t.y}px) scale(${t.scale})`
    }

    const clampT = () => {
      const img = imgRef.current
      if (!img) return
      const maxX = Math.max(0, (img.offsetWidth * t.scale - window.innerWidth) / 2) + 24
      const maxY = Math.max(0, (img.offsetHeight * t.scale - window.innerHeight) / 2) + 24
      t.x = clamp(t.x, -maxX, maxX)
      t.y = clamp(t.y, -maxY, maxY)
    }

    // 초점(fx,fy: 화면 중앙 기준) 유지하며 스케일 변경
    const zoomTo = (newScale, fx, fy) => {
      const ratio = newScale / t.scale
      t.x = fx - (fx - t.x) * ratio
      t.y = fy - (fy - t.y) * ratio
      t.scale = newScale
    }

    const doubleTap = (px, py) => {
      if (t.scale > 1) { t.scale = 1; t.x = 0; t.y = 0 }
      else zoomTo(2.5, px - window.innerWidth / 2, py - window.innerHeight / 2)
      clampT(); apply(true)
    }

    // ── 터치 ─────────────────────────────────────────────
    const onTouchStart = (e) => {
      if (e.touches.length === 1) {
        const tc = e.touches[0]
        g.mode = 'pan'
        g.lastX = tc.clientX; g.lastY = tc.clientY
        g.downX = tc.clientX; g.downY = tc.clientY
        g.moved = false
      } else if (e.touches.length === 2) {
        g.mode = 'pinch'
        g.lastDist = distance(e.touches[0], e.touches[1])
        const m = midpoint(e.touches[0], e.touches[1])
        g.lastMidX = m.x; g.lastMidY = m.y
        g.moved = true
      }
    }
    const onTouchMove = (e) => {
      e.preventDefault()
      if (e.touches.length === 2 && g.mode === 'pinch') {
        const d = distance(e.touches[0], e.touches[1])
        const m = midpoint(e.touches[0], e.touches[1])
        const cx = window.innerWidth / 2, cy = window.innerHeight / 2
        const fx = g.lastMidX - cx, fy = g.lastMidY - cy
        const newScale = clamp(t.scale * (d / g.lastDist), MIN, MAX)
        zoomTo(newScale, fx, fy)
        t.x += m.x - g.lastMidX
        t.y += m.y - g.lastMidY
        g.lastDist = d; g.lastMidX = m.x; g.lastMidY = m.y
        clampT(); apply(false)
      } else if (e.touches.length === 1 && g.mode === 'pan') {
        const tc = e.touches[0]
        if (Math.abs(tc.clientX - g.downX) > 8 || Math.abs(tc.clientY - g.downY) > 8) g.moved = true
        if (t.scale > 1) {
          t.x += tc.clientX - g.lastX
          t.y += tc.clientY - g.lastY
          clampT(); apply(false)
        }
        g.lastX = tc.clientX; g.lastY = tc.clientY
      }
    }
    const onTouchEnd = (e) => {
      if (e.touches.length === 1) {
        // 핀치 → 팬 전환: 팬 기준점 재설정
        g.mode = 'pan'
        g.lastX = e.touches[0].clientX; g.lastY = e.touches[0].clientY
        g.moved = true
        return
      }
      if (e.touches.length > 0) return
      // 모든 손가락 뗌
      if (g.mode === 'pan' && !g.moved) {
        const now = Date.now()
        const isDouble = lastTap.time && now - lastTap.time < 300 &&
          Math.abs(g.downX - lastTap.x) < 30 && Math.abs(g.downY - lastTap.y) < 30
        if (isDouble) {
          lastTap.time = 0
          doubleTap(g.downX, g.downY)
        } else {
          lastTap.time = now; lastTap.x = g.downX; lastTap.y = g.downY
          if (t.scale === 1) {
            // 더블탭이 아니면 닫기 (두 번째 탭을 기다렸다가 처리)
            setTimeout(() => { if (lastTap.time === now) onClose() }, 280)
          }
        }
      }
      g.mode = 'none'
    }

    // ── 데스크톱 ──────────────────────────────────────────
    const onWheel = (e) => {
      e.preventDefault()
      const step = e.deltaY < 0 ? 1.15 : 1 / 1.15
      const newScale = clamp(t.scale * step, MIN, MAX)
      zoomTo(newScale, e.clientX - window.innerWidth / 2, e.clientY - window.innerHeight / 2)
      clampT(); apply(false)
    }
    const onMouseDown = (e) => {
      g.mode = 'mouse'
      g.lastX = e.clientX; g.lastY = e.clientY
      g.downX = e.clientX; g.downY = e.clientY
      g.moved = false
    }
    const onMouseMove = (e) => {
      if (g.mode !== 'mouse') return
      if (Math.abs(e.clientX - g.downX) > 4 || Math.abs(e.clientY - g.downY) > 4) g.moved = true
      if (t.scale > 1) {
        t.x += e.clientX - g.lastX
        t.y += e.clientY - g.lastY
        clampT(); apply(false)
      }
      g.lastX = e.clientX; g.lastY = e.clientY
    }
    const onMouseUp = () => {
      if (g.mode === 'mouse' && !g.moved && t.scale === 1) onClose()
      g.mode = 'none'
    }
    const onKey = (e) => { if (e.key === 'Escape') onClose() }

    overlay.addEventListener('touchstart', onTouchStart, { passive: false })
    overlay.addEventListener('touchmove', onTouchMove, { passive: false })
    overlay.addEventListener('touchend', onTouchEnd, { passive: false })
    overlay.addEventListener('wheel', onWheel, { passive: false })
    overlay.addEventListener('mousedown', onMouseDown)
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    window.addEventListener('keydown', onKey)

    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      overlay.removeEventListener('touchstart', onTouchStart)
      overlay.removeEventListener('touchmove', onTouchMove)
      overlay.removeEventListener('touchend', onTouchEnd)
      overlay.removeEventListener('wheel', onWheel)
      overlay.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return createPortal(
    <div
      ref={overlayRef}
      style={{
        position: 'fixed', inset: 0, zIndex: 10000,
        background: 'rgba(0,0,0,0.92)',
        display: 'grid', placeItems: 'center',
        touchAction: 'none', overscrollBehavior: 'contain', overflow: 'hidden',
      }}
    >
      <img
        ref={imgRef}
        src={src}
        alt=""
        draggable={false}
        style={{
          maxWidth: '100%', maxHeight: '100%', objectFit: 'contain',
          transformOrigin: 'center center', userSelect: 'none', WebkitUserSelect: 'none',
          willChange: 'transform',
        }}
      />
      <button
        onClick={onClose}
        aria-label="닫기"
        style={{
          position: 'fixed', top: 'max(12px, env(safe-area-inset-top))', right: 12,
          width: 44, height: 44, borderRadius: '50%', border: 'none',
          background: 'rgba(0,0,0,0.5)', color: '#fff', fontSize: 22, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1,
        }}
      >
        ✕
      </button>
    </div>,
    document.body
  )
}
