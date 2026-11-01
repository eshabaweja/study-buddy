<p align="center">
  <img src="client/public/brand/logo.svg" alt="Study Buddy logo" width="120" height="120" />
</p>

<h1 align="center">Study Buddy</h1>

Study Buddy is a web app where instructors build courses out of **concepts** and **problems**, and students learn by working through them with an AI tutor that asks guiding (Socratic) questions instead of giving answers away. It also supports quizzes with AI-assisted grading and progress analytics.

## What's in the box

- **Courses, concepts and questions**: instructors author rich-text content (with math and images) and link questions to the concepts they exercise.
- **AI tutor chat**: per-question chat that only uses the instructor's goal, data and solution as context.
- **Quizzes**: multiple-choice and typed answers, timed attempts, AI-assisted grading and feedback.
- **Figure descriptions**: images in a question are described once by a vision model and reused for every student.
- **Roles**: students, instructors, and one admin (set by `ADMIN_EMAIL`).

## Tech stack

| Layer | Tools |
|-------|-------|
| Client (`client/`) | React, Vite, Quill editor, KaTeX, dnd-kit |
| Server (`server/`) | Node.js (ES modules), Express, JWT auth, argon2 |
| Database | PostgreSQL |
| AI | Any OpenAI-compatible `/v1/chat/completions` endpoint |

## Quick start

### 1. Prerequisites

- Node.js 20 or newer (developed on 24)
- PostgreSQL 14 or newer
- An API key for an OpenAI-compatible LLM provider (only needed for the tutor, quiz grading and figure descriptions)

### 2. Install dependencies

```bash
cd client && npm install
cd ../server && npm install
```

### 3. Create the database

```bash
createdb study_buddy
psql -d study_buddy -f server/db/create_database.txt
```

Then apply the files in `server/db/migrations/` in the order listed in [that folder's README](server/db/migrations/README.md).

### 4. Configure environment variables

The server reads database settings from `server/.env.local` and everything else from `server/.env`. Neither file is committed.

`server/.env.local`

```bash
DB_HOST=localhost
DB_PORT=5432
DB_NAME=study_buddy
DB_USER=your_user
DB_PASSWORD=your_password
```

`server/.env`

```bash
JWT_SECRET=a_long_random_string
ADMIN_EMAIL=you@example.com

# AI provider (OpenAI-compatible)
LLM_BASE_URL=https://api.your-provider.com
LLM_API_KEY=your_key
LLM_MODEL=your-model-id
```

| Variable | Required | Purpose |
|----------|----------|---------|
| `JWT_SECRET` | yes | Signs login tokens |
| `ADMIN_EMAIL` | no | Email address that gets admin access (default `admin@example.com`) |
| `PORT` | no | Server port (default `3001`) |
| `LLM_BASE_URL`, `LLM_API_KEY` | for AI features | Provider endpoint and key. The server calls `${LLM_BASE_URL}/v1/chat/completions` |
| `LLM_MODEL` | no | Default model for tutor and grading |
| `LLM_TUTOR_MODEL`, `LLM_GRADING_MODEL`, `LLM_VISION_MODEL` | no | Override the model per feature |

The client only needs `VITE_API_URL` (in `client/.env`) if the server is not at `http://localhost:3001`.

### 5. Run it

```bash
# Terminal 1
cd server && npm run dev

# Terminal 2
cd client && npm run dev
```

Open the URL Vite prints (usually http://localhost:5173).

## Project layout

```
client/
  public/             static files (favicons, brand logo, ui.js menu/accordion behavior)
  src/
    components/       reusable UI pieces
    pages/            one file per route
    styles/           ui.css (component library), app.css (app-specific), sass/ (source for ui.css)
    contexts/         auth state
    utils/            API helpers
server/
  routes/             Express route modules (one per resource)
  services/           AI calls: grading, figure descriptions, PDF to text
  config/llm.js       model names and provider URL
  db/                 pool setup, base schema, migrations
  scripts/            one-off maintenance scripts
```

## API overview

All routes are mounted in [`server/app.js`](server/app.js): `/auth`, `/courses`, `/concepts`, `/questions`, `/courses_concepts`, `/questions_concepts`, `/quizzes`, `/student_progress`, `/analytics`, `/admin`, `/openai-api`, `/pdf-to-text`, `/images`, `/course_images`, `/explicit_data`, `/implicit_data`, `/solutions` and `/mathematical_solutions`. Read the matching file in `server/routes/` for the exact endpoints. Protected routes expect `Authorization: Bearer <token>` from `POST /auth/login`.

## Maintenance scripts

Run from `server/`.

```bash
# Move legacy question_images rows into the rich-text HTML (one-time)
npm run migrate:question-images:dry-run
npm run migrate:question-images

# Add figure-description columns, then caption existing questions that have figures
npm run migrate:figure-description-columns
npm run backfill:figure-descriptions:dry-run
npm run backfill:figure-descriptions
```

New and edited questions regenerate their figure description automatically.

## Developer notes

### Session expiry behavior

An expired or invalid JWT returns **401** with "Your session expired. Please log in again." The client shows that message once and suppresses the "Failed to load…" toasts from parallel requests. To check it: log in, set `token` in Local Storage to `bad`, open `/dashboard` and expand **Course Management**. You should see exactly one toast. Tokens last 14 days (`expiresIn` in `server/routes/auth.js`).

### Styling and icons

- Class names in `ui.css` use the `sb-` prefix; app-specific styles use `app-`.
- Icons are [Lucide](https://lucide.dev) SVGs (ISC License) stored as CSS custom properties at the top of `ui.css` and used as masks, so they take the text color. To add one, add a `--sb-icon-<name>` variable and use it with `mask: var(--sb-icon-<name>) center / contain no-repeat`.

## Third-party notices

- Icons from [Lucide](https://github.com/lucide-icons/lucide), ISC License.
- Fonts (Inter, Source Serif 4) from Google Fonts, SIL Open Font License.
