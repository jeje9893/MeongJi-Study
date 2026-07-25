// AI 분석용 풀이기록 내보내기
// records(학습+복습)와 quizzes를 조인해 문제별 정답률·틀린 횟수·시도 이력을 만든다.
// 데이터는 이미 useData()로 메모리에 있으므로 별도 DB 접근이 필요 없다(온라인/오프라인 공통).

function round2(n) {
  return Math.round(n * 100) / 100
}

// 분석 자료 구조 생성
export function buildAnalysis(quizzes, records) {
  const quizMap = Object.fromEntries((quizzes || []).map(q => [q.id, q]))

  // quizId 기준으로 기록 그룹핑 (문제 목록에 없는 고아 기록은 따로 카운트)
  const byQuiz = {}
  let orphanedRecords = 0
  ;(records || []).forEach(r => {
    if (!quizMap[r.quizId]) {
      orphanedRecords++
      return
    }
    if (!byQuiz[r.quizId]) byQuiz[r.quizId] = []
    byQuiz[r.quizId].push(r)
  })

  const quizEntries = Object.entries(byQuiz).map(([quizId, recs]) => {
    const q = quizMap[quizId]
    const sorted = [...recs].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
    const correctCount = recs.filter(r => r.isCorrect).length
    const wrongCount = recs.length - correctCount
    return {
      question: q.question,
      answer: q.answer,
      category: q.category || '',
      totalAttempts: recs.length,
      correctCount,
      wrongCount,
      correctRate: recs.length ? round2(correctCount / recs.length) : 0,
      firstAttempt: sorted[0]?.date ?? null,
      lastAttempt: sorted[sorted.length - 1]?.date ?? null,
      attempts: sorted.map(r => ({
        date: r.date,
        isCorrect: !!r.isCorrect,
        isReview: !!r.isReview,
      })),
    }
  })

  // 정답률 낮은 순(약점 먼저), 동률이면 시도 많은 순
  quizEntries.sort((a, b) =>
    a.correctRate - b.correctRate || b.totalAttempts - a.totalAttempts
  )

  const allRecords = (records || []).filter(r => quizMap[r.quizId])
  const totalAttempts = allRecords.length
  const totalCorrect = allRecords.filter(r => r.isCorrect).length
  const studyAttempts = allRecords.filter(r => !r.isReview).length
  const reviewAttempts = allRecords.filter(r => r.isReview).length

  // 카테고리별 집계
  const catAgg = {}
  quizEntries.forEach(e => {
    const key = e.category || '(미분류)'
    if (!catAgg[key]) catAgg[key] = { attempts: 0, correct: 0 }
    catAgg[key].attempts += e.totalAttempts
    catAgg[key].correct += e.correctCount
  })
  const byCategory = Object.entries(catAgg)
    .map(([category, v]) => ({
      category,
      attempts: v.attempts,
      correctRate: v.attempts ? round2(v.correct / v.attempts) : 0,
    }))
    .sort((a, b) => a.correctRate - b.correctRate)

  return {
    summary: {
      exportedAt: new Date().toISOString(),
      totalQuizzesAttempted: quizEntries.length,
      totalAttempts,
      overallCorrectRate: totalAttempts ? round2(totalCorrect / totalAttempts) : 0,
      studyAttempts,
      reviewAttempts,
      orphanedRecords,
      byCategory,
    },
    quizzes: quizEntries,
  }
}

export function analysisToJson(analysis) {
  return JSON.stringify(analysis, null, 2)
}

function pct(rate) {
  return `${Math.round(rate * 100)}%`
}

export function analysisToMarkdown(analysis) {
  const { summary, quizzes } = analysis
  const lines = []

  lines.push('# 풀이기록 분석 자료')
  lines.push('')
  lines.push(`- 내보낸 시각: ${summary.exportedAt}`)
  lines.push(`- 전체 정답률: **${pct(summary.overallCorrectRate)}** (총 ${summary.totalAttempts}회 시도)`)
  lines.push(`- 시도한 문제 수: ${summary.totalQuizzesAttempted}개`)
  lines.push(`- 학습 ${summary.studyAttempts}회 / 복습 ${summary.reviewAttempts}회`)
  lines.push('')

  lines.push('## 카테고리별 정답률 (낮은 순)')
  lines.push('')
  lines.push('| 카테고리 | 시도 | 정답률 |')
  lines.push('| --- | ---: | ---: |')
  summary.byCategory.forEach(c => {
    lines.push(`| ${c.category} | ${c.attempts} | ${pct(c.correctRate)} |`)
  })
  lines.push('')

  lines.push('## 문제별 상세 (정답률 낮은 순 = 약점 먼저)')
  lines.push('')
  quizzes.forEach((q, i) => {
    const cat = q.category ? `[${q.category}] ` : ''
    lines.push(`### ${i + 1}. ${cat}정답률 ${pct(q.correctRate)} (${q.totalAttempts}회 중 ${q.wrongCount}회 틀림)`)
    lines.push(`- 문제: ${q.question.replace(/\n/g, ' ')}`)
    lines.push(`- 정답: ${q.answer.replace(/\n/g, ' ')}`)
    lines.push(`- 최근 풀이: ${q.lastAttempt ?? '-'} / 처음 풀이: ${q.firstAttempt ?? '-'}`)
    const history = q.attempts
      .map(a => `${a.date}${a.isCorrect ? '✅' : '❌'}${a.isReview ? '(복습)' : ''}`)
      .join(', ')
    lines.push(`- 시도 이력: ${history}`)
    lines.push('')
  })

  return lines.join('\n')
}

function downloadFile(content, filename, mime) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// format: 'json' | 'markdown'
export function downloadAnalysis(quizzes, records, format) {
  const analysis = buildAnalysis(quizzes, records)
  const today = new Date().toISOString().slice(0, 10)
  if (format === 'markdown') {
    downloadFile(analysisToMarkdown(analysis), `analysis-${today}.md`, 'text/markdown;charset=utf-8')
  } else {
    downloadFile(analysisToJson(analysis), `analysis-${today}.json`, 'application/json')
  }
}
