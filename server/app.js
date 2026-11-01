import express from 'express';
import cors from 'cors';
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

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Static files for uploaded images
app.use(
  '/uploads',
  express.static(path.join(__dirname, 'uploads')),
);

// Health check
app.get('/', (req, res) => {
  res.send('Express server is running!');
});

// Routes
app.use('/auth', authRoutes);
app.use('/courses', courseRoutes);
app.use('/concepts', conceptRoutes);
app.use('/questions', questionRoutes);
app.use('/courses_concepts', coursesConceptsRoutes);
app.use('/questions_concepts', questionsConceptsRoutes);
app.use('/images', imageRoutes);
app.use('/course_images', courseImagesRoutes);
app.use('/openai-api', openaiApiRoutes);
app.use('/student_progress', studentProgressRouter);
app.use('/explicit_data', explicitDataRouter);
app.use('/implicit_data', implicitDataRouter);
app.use('/solutions', solutionsRouter);
app.use('/mathematical_solutions', mathematicalSolutionsRouter);
app.use('/analytics', analyticsRouter);
app.use('/admin', adminRouter);
app.use('/quizzes', quizzesRouter);
app.use('/pdf-to-text', pdfToTextRouter);

export default app;