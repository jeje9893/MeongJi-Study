# 나만의 퀴즈 앱

개인 학습용 퀴즈 PWA. 문제를 직접 추가하고, 매일 퀴즈를 풀며, 기록을 관리할 수 있습니다.  
Google 로그인 후 모든 기기에서 실시간 동기화되며, 오프라인에서도 사용할 수 있습니다.

**배포 URL:** https://quizapp-4f681.web.app

## 주요 기능

- Google 로그인 — 모든 기기에서 문제 실시간 동기화
- 오프라인 사용 지원 (PWA + Firestore 오프라인 캐시)
- 기기별 기존 문제 클라우드 마이그레이션 (중복 없이 병합)
- 문제 추가 / 수정 / 삭제 (카테고리, 형광펜 마킹 지원)
- 풀어본 횟수 기준 정렬로 퀴즈 출제
- 연속 학습 스트릭, 정답률 통계
- 한 달 이상 안 푼 문제 복습 알림
- 데이터 JSON 내보내기 / 가져오기 (백업용)

## 기술 스택

| 분류 | 사용 기술 |
|------|-----------|
| 프론트엔드 | React 19, react-router-dom 7 |
| 데이터베이스 | Firebase Firestore (오프라인 퍼시스턴스) |
| 인증 | Firebase Auth (Google 로그인) |
| 호스팅 | Firebase Hosting |
| PWA | vite-plugin-pwa, Workbox |

## 개발

```bash
npm install
npm run dev      # 개발 서버
npm run build    # 프로덕션 빌드
```

### 배포
변경내용(업데이트) 있을 시 실행

```bash
npm run build
firebase deploy
```

## 홈 업데이트 배너

홈 탭 상단에 최근 업데이트 내용을 보여주는 배너가 있습니다.

| 순서 | 방법 |
|------|------|
| 1순위 | `src/changelog.js`의 `entries` 배열에 항목 추가 |
| 2순위 | `entries`가 비어있으면 마지막 git 커밋 메시지 자동 표시 |

```js
// src/changelog.js — 최신 항목을 맨 위에 추가
const entries = [
  { date: '2026-07-09', text: 'Firebase 클라우드 동기화 추가' },
]
```

배너는 ✕ 버튼으로 닫을 수 있고, 날짜나 텍스트가 바뀌면 다시 표시됩니다.

## 데이터 구조 (Firestore)

```
users/{uid}/
  quizzes/{docId}   — question, answer, category, excluded, createdAt, answerHighlights
  records/{docId}   — quizId, date, isCorrect, isReview
  meta/migration    — 기기간 마이그레이션 상태 추적
```
