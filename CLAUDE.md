# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Vite dev server
npm run build     # Production build to dist/ (also builds PWA service worker)
npm run preview   # Serve the production build locally
npm run lint      # ESLint over the whole project
```

There is no test suite and no TypeScript — this is a plain JS + JSX React app.

## What this is

A personal study quiz PWA ("나만의 퀴즈 앱"). Fully client-side: there is **no backend and no server**. All user data lives in the browser's IndexedDB. UI, comments, and commit messages are in Korean.

## Architecture

**Routing** (`src/App.jsx`): four tabs via `react-router-dom` — Home (`/`), Quiz (`/quiz`), Manage (`/manage`), History (`/history`) — with a fixed bottom nav. `main.jsx` mounts under `StrictMode`.

**Data layer** (`src/db.js`): a single Dexie database `QuizDB` with two tables:
- `quizzes` — `{ question, answer, category, createdAt, excluded, lastReviewedAt, answerHighlights }`
- `records` — one row per answered question: `{ quizId, date (YYYY-MM-DD), isCorrect, isReview? }`

Pages read data reactively with `useLiveQuery` (from `dexie-react-hooks`), so writes anywhere update all tabs automatically — there is no separate state store.

### Critical conventions

- **Schema migrations**: the DB is at version 5. To change schema, **append a new `db.version(n).stores({...}).upgrade(...)` block** in `db.js` — never edit an existing version block. Existing blocks must stay byte-for-byte stable or users' local data breaks. Each upgrade backfills new fields on existing rows.

- **`isReview` flag on records**: records with `isReview: true` are *review* attempts; records without it are normal *study* attempts. This distinction drives almost everything — streaks, overall stats, and the "오늘의 퀴즈" status all filter to `!r.isReview` (study only), while review-overdue tracking reads `r.isReview` records. When adding any record, set this flag correctly.

- **Overdue/review logic is duplicated**: the "한달 이상 안 푼 문제" (month-overdue) calculation appears in both `Home.jsx` (`overdueCount`) and `History.jsx` (`getDateReviewStatus`) and must stay in sync. It works per *date-card*: a study day's `referenceDate` is the latest review date if every quiz from that day has been reviewed, otherwise the original study date; overdue means `referenceDate <= monthAgo`.

- **Quiz selection** (`weightedSelect` in `Quiz.jsx`): sorts the filtered pool by attempt count ascending (least-practiced / untried first) and takes the top N. An older random-weighted version is kept commented out — leave it.

- **Answer highlights** (`src/highlightUtils.jsx`): per-quiz "highlighter" marks stored as `answerHighlights: [{ start, end }]` character offsets on the quiz. `getSelectionOffsets` derives offsets from a DOM text selection, `mergeHighlights` collapses overlaps, `renderWithHighlights` renders `<mark>` segments. Highlight mode is offered in `Quiz.jsx` after a wrong answer.

### Build-time and PWA specifics

- **Update banner** (`src/changelog.js` + `Home.jsx`): the home banner shows the first entry of the `entries` array in `changelog.js`; if that array is empty it falls back to the last git commit message/date. That git info is injected at build time by `vite.config.js` via the `__GIT_INFO__` define (it runs `git log` during the build). Dismissal is keyed in `localStorage` by date+text, so changing either re-shows the banner.

- **PWA**: configured through `vite-plugin-pwa` in `vite.config.js` with `registerType: 'autoUpdate'`. The Home "🔄 업데이트" button manually calls `registration.update()` and reloads on `controllerchange`.

### Data import/export (`db.js`)

`exportData` dumps all quizzes + records to a JSON file. `importData` **merges** rather than replaces: quizzes are de-duped by `question||answer`, records by `quizId||date||isCorrect`, and old IDs are remapped to the merged quiz IDs so imported records still attach correctly.
