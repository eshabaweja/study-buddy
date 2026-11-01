# Study Buddy

A learning management system for course content and concept-based learning.

## API Endpoints

### Courses

- `GET /courses` - Get all courses (optionally filter by published status)
  - Query params: `published` (boolean) - Filter by published status
- `POST /courses` - Create a new course (requires instructor authentication)
- `GET /courses/:courseCode` - Get a specific course by code
- `PATCH /courses/:courseCode/publish` - Update course published status (requires instructor authentication)
  - Body: `{ "published": boolean }`

### Authentication

- `POST /auth/login` - Login with email and password
- `POST /auth/signup` - Register a new user

### Concepts

- `GET /concepts` - Get all concepts
- `POST /concepts` - Create a new concept

### Questions

- `GET /questions/:courseCode` - Get questions for a specific course
- `POST /questions` - Create a new question

### Course Concepts

- `GET /courses_concepts` - Get all course-concept associations
- `POST /courses_concepts` - Associate a concept with a course

### Questions Concepts

- `GET /questions_concepts` - Get all question-concept associations
- `POST /questions_concepts` - Associate a concept with a question
- `PUT /questions_concepts/:questionId` - Replace all concept associations for a question (body: `{ "concept_ids": number[] }`)
- `DELETE /questions_concepts/:questionId` - Delete all concept associations for a question

## Testing session expiry messaging

When a JWT is expired or invalid, the API returns **401** with: `Your session expired. Please log in again.` The client shows that message **once** in a toast and suppresses other error toasts (e.g. "Failed to load courses") from parallel requests.

### Quick manual test (invalid token)

1. Log in as an instructor.
2. Open DevTools → Application → Local Storage → set `token` to `bad`.
3. Go to `/dashboard` and expand **Course Management** (many parallel API calls).
4. **Pass:** exactly **one** toast: "Your session expired. Please log in again." No "Failed to load" toasts.
5. **Fail:** multiple toasts or per-form "failed to load" errors.

### Other methods

- **Secret rotation:** change `JWT_SECRET` in `server/.env`, restart the server, refresh while still logged in.
- **Natural expiry:** tokens use `expiresIn: '14d'` in `server/routes/auth.js`. For local testing, temporarily set `expiresIn: '10s'`, log in, wait, then reload (revert before commit).

### Non-dashboard routes

On pages like `/quizzes/:courseId`, the same invalid-token test should show the same single session toast, not repeated "failed to load" toasts.

## Setup

1. Install dependencies:
   ```bash
   cd client && npm install
   cd ../server && npm install
   ```

2. Set up environment variables:
   - Create `.env` file in server directory
   - Add `JWT_SECRET=your_secret_key`
   - Add `VITE_API_URL=http://localhost:3001` in client

3. Start the development servers:
   ```bash
   # Terminal 1 - Start server
   cd server && npm start
   
   # Terminal 2 - Start client
   cd client && npm run dev
   ```

## Migrate legacy question images

Older questions stored figures in the `question_images` table while newer content stores images inline in Quill HTML. Run this one-time migration to move legacy rows into the HTML fields and clear those rows. The table itself is kept.

```bash
cd server

# Preview affected questions without writing changes
npm run migrate:question-images:dry-run

# Apply the migration
npm run migrate:question-images
```

After migration, question figures live only in rich-text HTML. Instructors add and remove images through the Quill editor.

## Figure descriptions for Study Buddy (describe once)

Prompt figures are described once via LLM vision (`LLM_VISION_MODEL`, default `claude-sonnet-4-6`) and stored on the question. Study Buddy reuses that text for every student instead of re-sending images each chat turn.

```bash
cd server

# Ensure DB columns exist (also safe to re-run)
npm run migrate:figure-description-columns

# Preview / generate captions for existing questions that have figures
npm run backfill:figure-descriptions:dry-run
npm run backfill:figure-descriptions
```

New and updated questions regenerate the caption automatically when prompt images change.

## Database Schema

The application uses PostgreSQL with the following main tables:
- `courses` - Course information with publish status
- `concepts` - Learning concepts
- `questions` - Course questions (includes `figure_description` / `figure_images_hash` for tutor context)
- `users` - User accounts with instructor roles
- `courses_concepts` - Many-to-many relationship between courses and concepts
- `questions_concepts` - Many-to-many relationship between questions and concepts
