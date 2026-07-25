# 나만의 퀴즈 앱

개인 학습용 퀴즈 PWA. 문제를 직접 추가하고, 매일 퀴즈를 풀며, 학습·복습 기록을 관리할 수 있습니다.
Google 로그인 시 모든 기기에서 실시간 동기화되고, 로그인 없이도 오프라인으로 사용할 수 있습니다.

**배포 URL:** https://quizapp-4f681.web.app

## 주요 기능

- **문제 관리** — 추가 / 수정 / 삭제, 카테고리 분류, 정답 형광펜 마킹, 퀴즈에서 제외
- **오늘의 퀴즈** — 안 푼·적게 푼 문제를 우선 출제하며, 푼 횟수가 같은 문제끼리는 랜덤 순서
- **학습 통계** — 연속 학습 스트릭, 전체 정답률, 오늘의 진행 상황
- **복습 알림** — 한 달 이상 안 푼(복습 안 한) 문제를 날짜별로 감지해 배너로 안내
- **AI 분석용 내보내기** — 풀이기록을 JSON / 마크다운으로 내보내기 (문제별 정답률·틀린 횟수·
  시도 이력, 전체·카테고리별 요약을 약점 순으로 정리 → AI에게 약점 분석을 맡기기 좋음)
- **데이터 백업** — 전체 데이터를 JSON으로 내보내기 / 가져오기 (중복 없이 병합)
- **Google 로그인 동기화** — 여러 기기에서 문제·기록 실시간 동기화 (Firestore)
- **오프라인 지원** — PWA + Firestore 오프라인 캐시. 비로그인 시 브라우저 IndexedDB에 저장
- **클라우드 마이그레이션** — 로그인하면 로컬에 만든 기존 문제·기록을 계정으로 이전

## 기술 스택

| 분류 | 사용 기술 |
|------|-----------|
| 프론트엔드 | React 19, react-router-dom 7 |
| 온라인 데이터 | Firebase Firestore (오프라인 퍼시스턴스) |
| 오프라인 데이터 | Dexie (IndexedDB) |
| 인증 | Firebase Auth (Google 로그인) |
| 빌드 / PWA | Vite 7, vite-plugin-pwa, Workbox |
| 호스팅 | Firebase Hosting |

## 아키텍처

로그인 여부에 따라 데이터 소스를 전환합니다. 전환은 `src/contexts/DataContext.jsx`가 담당하며,
화면 컴포넌트는 `useData()` 훅으로 소스를 신경 쓰지 않고 동일한 인터페이스로 접근합니다.

| 상태 | 데이터 소스 | 구독 방식 |
|------|-------------|-----------|
| 로그인 | Firestore `users/{uid}/…` | `useCollection` (onSnapshot 실시간) |
| 비로그인 | Dexie `QuizDB` (IndexedDB) | `useLiveQuery` |

- 스키마와 CRUD 헬퍼는 `src/db.js`에 온라인/오프라인 이중으로 정의돼 있습니다.
- Dexie 스키마는 버전 5까지 마이그레이션되어 있으며, 스키마 변경 시 기존 버전 블록은 두고
  새 `db.version(n)` 블록을 덧붙입니다.

## 개발

```bash
npm install
npm run dev      # 개발 서버
npm run build    # 프로덕션 빌드 (PWA 서비스워커 포함)
npm run preview  # 빌드 결과 로컬 미리보기
npm run lint     # ESLint
```

### 배포

변경 사항이 있을 때 실행합니다.

```bash
npm run build
firebase deploy
```

## 홈 업데이트 배너

홈 탭 상단에 최근 업데이트 내용을 보여주는 배너가 있습니다. 표시 우선순위는 다음과 같습니다.

| 순서 | 방법 |
|------|------|
| 1순위 | Firestore `config/banner` 문서 (관리자가 홈에서 직접 편집) |
| 2순위 | `src/changelog.js`의 `entries` 배열 첫 항목 |
| 3순위 | 위가 모두 비어 있으면 마지막 git 커밋 메시지·날짜 자동 표시 |

```js
// src/changelog.js — 최신 항목을 맨 위에 추가
const entries = [
  { date: '2026-07-09', text: 'Firebase 클라우드 동기화 추가' },
]
```

## 데이터 구조

로그인 시 Firestore, 비로그인 시 동일 형태의 데이터가 브라우저 IndexedDB(`QuizDB`)에 저장됩니다.

```
users/{uid}/
  quizzes/{docId}   — question, answer, category, excluded,
                      createdAt, lastReviewedAt, answerHighlights
  records/{docId}   — quizId, date, isCorrect, isReview

config/banner       — (전역) text, date, fontSize, color
```

- `records`는 문제를 한 번 풀 때마다 한 행이 쌓입니다. `isReview: true`면 복습 시도,
  없으면 일반 학습 시도로 구분되어 스트릭·통계·복습 알림 계산에 사용됩니다.
