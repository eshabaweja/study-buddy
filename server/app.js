import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import pool from './db/database.js';
import { allowedOrigins } from './config/env.js';
import { globalLimiter, authLimiter, llmLimiter } from './middleware/rateLimit.js';
import { enforceLlmBudget } from './middleware/llmBudget.js';
import { requireAuth } from './middleware/auth.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Import routes
import authRoutes from './routes/auth.js';
import courseRoutes from './routes/courses.js';
import conceptRoutes from './routes/concepts.js';
import questionRoutes from './routes/questions.js';
import coursesConceptsRoutes from './routes/courses_concepts.js';
import questionsConceptsRoutes from './routes/questions_concepts.js';
import imageRoutes from './routes/images.js';
import courseImagesRoutes from './routes/course_images.js';
import openaiApiRoutes from './routes/openai-api.js';
import studentProgressRouter from './routes/student_progress.js';
import explicitDataRouter from './routes/data_explicit.js';
import implicitDataRouter from './routes/data_implicit.js';
import solutionsRouter from './routes/solution_simple.js';
import mathematicalSolutionsRouter from './routes/solution_math.js';
import analyticsRouter from './routes/analytics.js';
import adminRouter from './routes/admin.js';
import quizzesRouter from './routes/quizzes.js';
import pdfToTextRouter from './routes/pdfToText.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Behind a reverse proxy (Render, Fly, nginx) the client IP comes from X-Forwarded-For.
// Without this, every user looks like the proxy and shares one rate-limit bucket.
app.set('trust proxy', 1);

// Security middleware
app.use(helmet({
  // Uploaded images are loaded by the SPA from a different origin.
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  // Content-Security-Policy: the browser refuses to run or load anything not listed here,
  // which limits the damage if user-authored rich text ever lets a script slip through.
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'], // React inline styles
      fontSrc: ["'self'", 'data:', 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:', 'blob:', 'https:'], // inline Quill images, uploads
      frameSrc: ["'self'", 'blob:'], // PDF preview
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      frameAncestors: ["'self'"],
    },
  },
}));
app.use(cors({ origin: allowedOrigins() }));
app.use(globalLimiter);
// Questions embed images as base64, so bodies can be large, but not unbounded.
app.use(express.json({ limit: process.env.JSON_BODY_LIMIT || '15mb' }));
app.use(express.urlencoded({ limit: '15mb', extended: true }));

// All API routes live on one router so they can be mounted under /api (single-origin
// deployment, where the same server also serves the React app) and, in development,
// at the root as before.
const api = express.Router();

// Static files for uploaded images
api.use(
  '/uploads',
  express.static(path.join(__dirname, 'uploads')),
);

// Health checks: "/" says the process is up; "/health" also checks the database.
api.get('/', (req, res) => {
  res.send('Express server is running!');
});
api.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok' });
  } catch {
    res.status(503).json({ status: 'database unavailable' });
  }
});

// Routes
api.use('/auth', authLimiter, authRoutes);
api.use('/courses', courseRoutes);
api.use('/concepts', conceptRoutes);
api.use('/questions', questionRoutes);
api.use('/courses_concepts', coursesConceptsRoutes);
api.use('/questions_concepts', questionsConceptsRoutes);
api.use('/images', imageRoutes);
api.use('/course_images', courseImagesRoutes);
// Paid LLM endpoint: must be signed in, rate limited, and under the daily budget.
api.use('/openai-api', requireAuth, llmLimiter, enforceLlmBudget, openaiApiRoutes);
api.use('/student_progress', studentProgressRouter);
api.use('/explicit_data', explicitDataRouter);
api.use('/implicit_data', implicitDataRouter);
api.use('/solutions', solutionsRouter);
api.use('/mathematical_solutions', mathematicalSolutionsRouter);
api.use('/analytics', analyticsRouter);
api.use('/admin', adminRouter);
api.use('/quizzes', quizzesRouter);
api.use('/pdf-to-text', pdfToTextRouter);


// When the server also hosts the built React app (the Docker image does), the API moves
// under /api so it cannot collide with client-side routes such as /quizzes/:id.
const clientDist = process.env.CLIENT_DIST || path.join(__dirname, 'public');
const serveClient = process.env.SERVE_CLIENT === 'true' && fs.existsSync(clientDist);

app.use('/api', api);
if (!serveClient) {
  app.use(api);
} else {
  app.use(express.static(clientDist, { index: false, maxAge: '1h' }));
  app.get(/^(?!\/api\/).*/, (req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

// Last-resort error handler: never leak stack traces or internals to clients.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Request is too large' });
  }
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

export default app;