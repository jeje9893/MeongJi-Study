import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { signOut, signInWithPopup, GoogleAuthProvider } from 'firebase/auth'
import { onSnapshot, doc, setDoc, deleteDoc } from 'firebase/firestore'
import { auth, firestoreDb } from '../firebase'
import { useAuth } from '../contexts/AuthContext'
import { useData } from '../contexts/DataContext'
import { compressFileToDataUrl, readImageFromClipboard } from '../imageUtils'
import changelogEntries from '../changelog'

const gitInfo = __GIT_INFO__
const canPasteImage = !!navigator.clipboard?.read

function getStreak(records) {
  if (!records.length) return 0
  const studyRecords = records.filter(r => !r.isReview)
  const dates = [...new Set(studyRecords.map(r => r.date))].sort().reverse()
  if (!dates.length) return 0
  const today = new Date().toISOString().slice(0, 10)
  if (dates[0] !== today && dates[0] !== getPrevDate(today)) return 0
  let streak = 1
  for (let i = 1; i < dates.length; i++) {
    if (dates[i] === getPrevDate(dates[i - 1])) streak++
    else break
  }
  return streak
}

function getPrevDate(dateStr) {
  const d = new Date(dateStr)
  d.setDate(d.getDate() - 1)
  return d.toISOString().slice(0, 10)
}

function getMonthAgo() {
  const d = new Date()
  d.setMonth(d.getMonth() - 1)
  return d.toISOString().slice(0, 10)
}

function getBannerContent(firestoreBanner) {
  if (firestoreBanner?.text || firestoreBanner?.image) {
    return {
      text: firestoreBanner.text ?? '',
      date: firestoreBanner.date,
      fontSize: firestoreBanner.fontSize ?? 13,
      color: firestoreBanner.color ?? 'var(--text2)',
      image: firestoreBanner.image ?? null,
    }
  }
  if (changelogEntries.length > 0) {
    const latest = changelogEntries[0]
    return { text: latest.text, date: latest.date, fontSize: 13, color: 'var(--text2)', image: null }
  }
  if (gitInfo.message) {
    return { text: gitInfo.message, date: gitInfo.date, fontSize: 13, color: 'var(--text2)', image: null }
  }
  return null
}

const swatchBtnStyle = {
  width: 24, height: 24, borderRadius: 6, border: '1px solid rgba(99,179,237,0.3)',
  background: 'rgba(99,179,237,0.1)', color: '#93c5fd', fontSize: 14,
  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
  fontFamily: 'inherit', flexShrink: 0, padding: 0,
}

export default function Home() {
  const navigate = useNavigate()
  const user = useAuth()
  const { quizzes, records } = useData()

  const [firestoreBanner, setFirestoreBanner] = useState(undefined)
  const [isEditing, setIsEditing] = useState(false)
  const [editText, setEditText] = useState('')
  const [editFontSize, setEditFontSize] = useState(13)
  const [editColor, setEditColor] = useState('var(--text2)')
  const [editImage, setEditImage] = useState(null) // 배너 이미지 dataURL | null
  const [updateState, setUpdateState] = useState('idle') // 'idle' | 'checking' | 'latest'
  const bannerImageInputRef = useRef()
  const isAdmin = user?.email === 'jeje9893@gmail.com'

  useEffect(() => {
    return onSnapshot(doc(firestoreDb, 'config/banner'), snap => {
      setFirestoreBanner(snap.exists() ? snap.data() : null)
    })
  }, [])

  const bannerContent = getBannerContent(firestoreBanner)

  async function handleSaveBanner() {
    const text = editText.trim()
    if (!text && !editImage) {
      await deleteDoc(doc(firestoreDb, 'config/banner'))
    } else {
      await setDoc(doc(firestoreDb, 'config/banner'), { text, image: editImage ?? null, date: today, fontSize: editFontSize, color: editColor })
    }
    setIsEditing(false)
  }

  async function applyBannerImageBlob(blob) {
    try {
      const dataUrl = await compressFileToDataUrl(blob, { maxDim: 900, quality: 0.75 })
      if (dataUrl.length > 950000) { alert('이미지 용량이 너무 커요. 더 작은 이미지를 사용해주세요'); return }
      setEditImage(dataUrl)
    } catch (err) {
      alert('이미지 처리 실패: ' + err.message)
    }
  }

  function handlePickBannerImage(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!file.type?.startsWith('image/')) { alert('이미지 파일만 넣을 수 있어요'); return }
    applyBannerImageBlob(file)
  }

  async function handlePasteBannerImage() {
    try {
      const blob = await readImageFromClipboard()
      if (!blob) { alert('클립보드에 이미지가 없어요'); return }
      applyBannerImageBlob(blob)
    } catch (e) {
      alert(e.message || '붙여넣기 실패')
    }
  }

  async function handleCheckUpdate() {
    if (updateState === 'checking') return
    setUpdateState('checking')
    try {
      const reg = await navigator.serviceWorker.getRegistration()
      if (!reg) { setUpdateState('idle'); return }

      let reloaded = false
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        reloaded = true
        window.location.reload()
      }, { once: true })

      await reg.update()

      await new Promise(r => setTimeout(r, 2000))
      if (!reloaded) {
        setUpdateState('latest')
        setTimeout(() => setUpdateState('idle'), 2500)
      }
    } catch {
      setUpdateState('idle')
    }
  }

  const today = new Date().toISOString().slice(0, 10)
  const studyRecords = records?.filter(r => !r.isReview) || []
  const todayRecords = studyRecords.filter(r => r.date === today)
  const completedToday = todayRecords.length > 0
  const streak = getStreak(records || [])

  const totalQuizzes = quizzes?.length || 0
  const correctRate = studyRecords.length
    ? Math.round((studyRecords.filter(r => r.isCorrect).length / studyRecords.length) * 100)
    : 0

  const monthAgo = getMonthAgo()
  const overdueCount = (() => {
    if (!records) return 0

    const byDate = {}
    studyRecords.forEach(r => {
      if (!byDate[r.date]) byDate[r.date] = []
      byDate[r.date].push(r)
    })

    const lastReviewDateMap = {}
    records.filter(r => r.isReview).forEach(r => {
      if (!lastReviewDateMap[r.quizId] || r.date > lastReviewDateMap[r.quizId]) {
        lastReviewDateMap[r.quizId] = r.date
      }
    })

    return Object.entries(byDate).filter(([date, recs]) => {
      const quizIds = [...new Set(recs.map(r => r.quizId))]
      const reviewDates = quizIds.map(id => lastReviewDateMap[id]).filter(Boolean)
      const allReviewed = reviewDates.length === quizIds.length
      const latestReviewDate = reviewDates.length > 0
        ? reviewDates.reduce((a, b) => a > b ? a : b)
        : null
      const referenceDate = allReviewed ? latestReviewDate : date
      return referenceDate <= monthAgo
    }).length
  })()

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <h1 className="page-title" style={{ margin: 0 }}>나만의 퀴즈 📚</h1>
        {user ? (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 0,
            background: 'var(--bg2)', border: '1px solid var(--bg3)',
            borderRadius: 100, overflow: 'hidden', flexShrink: 0,
          }}>
            <span style={{
              fontSize: 12, color: 'var(--text2)', padding: '6px 12px',
              maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {user.displayName || user.email}
            </span>
            <button
              onClick={() => signOut(auth)}
              style={{
                fontSize: 12, color: '#93c5fd',
                background: 'rgba(99,179,237,0.1)',
                border: 'none', borderLeft: '1px solid var(--bg3)',
                padding: '6px 12px', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
              }}
            >
              로그아웃
            </button>
          </div>
        ) : (
          <button
            onClick={async () => {
              try { await signInWithPopup(auth, new GoogleAuthProvider()) }
              catch (e) { if (e.code !== 'auth/popup-closed-by-user') alert('로그인 실패: ' + e.message) }
            }}
            style={{
              fontSize: 12, color: '#93c5fd',
              background: 'rgba(99,179,237,0.1)',
              border: '1px solid rgba(99,179,237,0.2)',
              borderRadius: 100, padding: '6px 14px',
              cursor: 'pointer', fontFamily: 'inherit',
              whiteSpace: 'nowrap', flexShrink: 0,
            }}
          >
            Google로 로그인
          </button>
        )}
      </div>
      <p style={{ color: 'var(--text2)', fontSize: 14, margin: '0 0 12px' }}>
        {new Date().toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'long' })}
      </p>

      {/* 업데이트 배너 (상시 표시, 버튼 내장) */}
      {bannerContent && (
        <div
          className="card"
          style={{
            marginBottom: 16,
            background: 'linear-gradient(135deg, #0c1a33, #1e293b)',
            border: '1px solid rgba(99,179,237,0.3)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <div style={{ fontSize: 22, lineHeight: 1, flexShrink: 0, marginTop: 2 }}>🆕</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, color: '#93c5fd', marginBottom: 3, fontSize: 13 }}>
                업데이트
                {bannerContent.date && (
                  <span style={{ fontWeight: 400, color: 'var(--text2)', marginLeft: 8 }}>{bannerContent.date}</span>
                )}
              </div>
              {isEditing ? (
                <>
                  <textarea
                    value={editText}
                    onChange={e => setEditText(e.target.value)}
                    placeholder="빈칸으로 저장하면 기본 배너(커밋/changelog)로 돌아갑니다"
                    rows={3}
                    style={{
                      width: '100%', background: 'rgba(0,0,0,0.3)',
                      border: '1px solid rgba(99,179,237,0.4)', borderRadius: 8,
                      color: 'var(--text)', fontSize: 13, padding: '8px',
                      fontFamily: 'inherit', boxSizing: 'border-box', resize: 'vertical',
                    }}
                  />
                  {/* 글자 크기 */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
                    <span style={{ fontSize: 11, color: 'var(--text2)', whiteSpace: 'nowrap' }}>크기</span>
                    <button onClick={() => setEditFontSize(s => Math.max(10, s - 1))} style={swatchBtnStyle}>−</button>
                    <input
                      type="number" value={editFontSize} min={10} max={40}
                      onChange={e => setEditFontSize(Math.min(40, Math.max(10, Number(e.target.value))))}
                      style={{
                        width: 40, textAlign: 'center', background: 'rgba(0,0,0,0.3)',
                        border: '1px solid rgba(99,179,237,0.3)', borderRadius: 6,
                        color: 'var(--text)', fontSize: 12, padding: '3px 4px', fontFamily: 'inherit',
                      }}
                    />
                    <button onClick={() => setEditFontSize(s => Math.min(40, s + 1))} style={swatchBtnStyle}>+</button>
                    <span style={{ fontSize: editFontSize, color: editColor, marginLeft: 4, lineHeight: 1 }}>가</span>
                  </div>
                  {/* 색상 스와치 */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
                    <span style={{ fontSize: 11, color: 'var(--text2)', whiteSpace: 'nowrap' }}>색상</span>
                    {[
                      { label: '기본', value: 'var(--text2)' },
                      { label: '흰색', value: 'var(--text)' },
                      { label: '초록', value: 'var(--accent)' },
                      { label: '노랑', value: 'var(--warning)' },
                      { label: '빨강', value: 'var(--danger)' },
                      { label: '파랑', value: '#93c5fd' },
                    ].map(({ label, value }) => (
                      <button
                        key={value}
                        title={label}
                        onClick={() => setEditColor(value)}
                        style={{
                          width: 20, height: 20, borderRadius: '50%',
                          background: value, border: 'none', cursor: 'pointer', flexShrink: 0,
                          outline: editColor === value ? '2px solid white' : '2px solid transparent',
                          outlineOffset: 1,
                        }}
                      />
                    ))}
                  </div>
                  {/* 이미지 */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 11, color: 'var(--text2)', whiteSpace: 'nowrap' }}>이미지</span>
                    <input ref={bannerImageInputRef} type="file" accept="image/*" onChange={handlePickBannerImage} style={{ display: 'none' }} />
                    {editImage ? (
                      <>
                        <img src={editImage} alt="" style={{ maxWidth: 96, maxHeight: 54, borderRadius: 6, objectFit: 'cover', background: 'rgba(0,0,0,0.3)' }} />
                        <button onClick={() => bannerImageInputRef.current?.click()} style={{ ...swatchBtnStyle, width: 'auto', padding: '0 10px', fontSize: 12 }}>변경</button>
                        {canPasteImage && <button onClick={handlePasteBannerImage} style={{ ...swatchBtnStyle, width: 'auto', padding: '0 10px', fontSize: 12 }}>📋 붙여넣기</button>}
                        <button onClick={() => setEditImage(null)} style={swatchBtnStyle}>✕</button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => bannerImageInputRef.current?.click()} style={{ ...swatchBtnStyle, width: 'auto', padding: '0 10px' }}>🖼 추가</button>
                        {canPasteImage && <button onClick={handlePasteBannerImage} style={{ ...swatchBtnStyle, width: 'auto', padding: '0 10px', fontSize: 12 }}>📋 붙여넣기</button>}
                      </>
                    )}
                  </div>
                  <button
                    onClick={handleSaveBanner}
                    style={{
                      marginTop: 10, padding: '4px 14px', borderRadius: 100,
                      background: 'rgba(99,179,237,0.2)', border: '1px solid rgba(99,179,237,0.4)',
                      color: '#93c5fd', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
                    }}
                  >
                    저장
                  </button>
                </>
              ) : (
                <>
                  {bannerContent.text && (
                    <div style={{ fontSize: bannerContent.fontSize, color: bannerContent.color, lineHeight: 1.5 }}>
                      {bannerContent.text}
                    </div>
                  )}
                  {bannerContent.image && (
                    <img
                      src={bannerContent.image}
                      alt=""
                      style={{ display: 'block', maxWidth: '100%', maxHeight: 220, borderRadius: 8, objectFit: 'contain', marginTop: bannerContent.text ? 8 : 0 }}
                    />
                  )}
                </>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
              {isAdmin && (
                <button
                  onClick={() => {
                    setEditText(firestoreBanner?.text ?? '')
                    setEditFontSize(firestoreBanner?.fontSize ?? 13)
                    setEditColor(firestoreBanner?.color ?? 'var(--text2)')
                    setEditImage(firestoreBanner?.image ?? null)
                    setIsEditing(e => !e)
                  }}
                  style={{
                    width: 36, height: 36, borderRadius: 8,
                    border: '1px solid rgba(99,179,237,0.3)',
                    background: isEditing ? 'rgba(99,179,237,0.25)' : 'rgba(99,179,237,0.05)',
                    fontSize: 15, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                  title={isEditing ? '취소' : '배너 편집'}
                >
                  {isEditing ? '✕' : '✏️'}
                </button>
              )}
              <button
                onClick={handleCheckUpdate}
                disabled={updateState === 'checking'}
                style={{
                  width: 36, height: 36, borderRadius: 8,
                  border: '1px solid rgba(99,179,237,0.3)',
                  background: updateState === 'latest' ? 'rgba(110,231,183,0.15)' : 'rgba(99,179,237,0.1)',
                  fontSize: 18,
                  cursor: updateState === 'checking' ? 'default' : 'pointer',
                  opacity: updateState === 'checking' ? 0.4 : 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
                title={updateState === 'latest' ? '최신 버전입니다' : '업데이트 확인'}
              >
                {updateState === 'latest' ? '✅' : '🔄'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 복습 알림 배너 */}
      {overdueCount > 0 && (
        <div
          className="card"
          style={{
            marginBottom: 16,
            background: 'linear-gradient(135deg, #3b0f0f, #1e293b)',
            border: '1px solid rgba(248,113,113,0.35)',
            cursor: 'pointer'
          }}
          onClick={() => navigate('/history')}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ fontSize: 32 }}>🔴</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, color: '#fca5a5', marginBottom: 3 }}>
                복습할 문제가 있어요!
              </div>
              <div style={{ fontSize: 13, color: 'var(--text2)' }}>
                한달 이상 안 푼 문제 <b style={{ color: '#fca5a5' }}>{overdueCount}개</b> — 복습 탭에서 확인하세요
              </div>
            </div>
            <div style={{ fontSize: 18, color: '#fca5a5' }}>→</div>
          </div>
        </div>
      )}

      {/* Streak */}
      <div className="card" style={{ marginBottom: 16, background: streak > 0 ? 'linear-gradient(135deg, #064e3b, #1e293b)' : 'var(--bg2)', border: streak > 0 ? '1px solid rgba(110,231,183,0.2)' : undefined }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ fontSize: 40 }}>🔥</div>
          <div>
            <div style={{ fontSize: 28, fontFamily: 'Space Mono', fontWeight: 700, color: 'var(--accent)' }}>{streak}일</div>
            <div style={{ fontSize: 13, color: 'var(--text2)' }}>연속 학습 중</div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
        <div className="card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 28, fontFamily: 'Space Mono', fontWeight: 700 }}>{totalQuizzes}</div>
          <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 4 }}>총 문제 수</div>
        </div>
        <div className="card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 28, fontFamily: 'Space Mono', fontWeight: 700, color: correctRate >= 70 ? 'var(--accent)' : 'var(--warning)' }}>{correctRate}%</div>
          <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 4 }}>전체 정답률</div>
        </div>
      </div>

      {/* Today status */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>오늘의 퀴즈</div>
            <div style={{ fontSize: 13, color: 'var(--text2)' }}>
              {completedToday ? `${todayRecords.length}문제 완료 ✅` : '아직 시작 안 함'}
            </div>
          </div>
          {completedToday && (
            <div style={{ fontSize: 13, color: 'var(--accent)' }}>
              정답 {todayRecords.filter(r => r.isCorrect).length}/{todayRecords.length}
            </div>
          )}
        </div>
      </div>

      {totalQuizzes === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">✏️</div>
          <p>문제를 먼저 추가해보세요!</p>
          <br />
          <button className="btn btn-primary" style={{ maxWidth: 200, margin: '0 auto' }} onClick={() => navigate('/manage')}>
            문제 추가하기
          </button>
        </div>
      ) : (
        <button className="btn btn-primary" onClick={() => navigate('/quiz')}>
          {completedToday ? '다시 풀기 🔄' : '오늘의 퀴즈 시작 🚀'}
        </button>
      )}

    </div>
  )
}
