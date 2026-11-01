import express from 'express';
import pool from '../db/database.js';
import { requireInstructor } from '../middleware/auth.js';
import { requireStudent } from '../middleware/auth.js';
import {
  assertOwnedCourseById,
  sendCourseAccessError,
  CourseAccessError,
} from '../db/courseOwnership.js';
import { gradeTypedAnswer } from '../services/quizGrading.js';
import { tryConsumeLlmBudget } from '../middleware/llmBudget.js';

const router = express.Router();

function parseCourseId(param) {
  const id = parseInt(param, 10);
  return Number.isNaN(id) ? null : id;
}

function isPromptBlank(html) {
  if (html == null || html === '') return true;
  const text = String(html)
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .trim();
  return text === '';
}

function promptHtmlForDb(item) {
  if (item.item_type === 'practice_question') return null;
  const html = item.prompt_html ?? '';
  return isPromptBlank(html) ? null : html;
}

function validateQuizItemFields(item, index) {
  const n = index + 1;
  if (item.item_type === 'practice_question') {
    if (!item.question_id) {
      return `Question ${n}: practice bank question is required`;
    }
    return null;
  }
  if (item.item_type === 'multiple_choice' || item.item_type === 'typed') {
    if (isPromptBlank(item.prompt_html)) {
      const label = item.item_type === 'typed' ? 'typed answer' : 'multiple choice';
      return `Question ${n}: prompt is required (${label})`;
    }
  }
  return null;
}

function getQuizWindowStatus(quiz, now = new Date()) {
  const opens = new Date(quiz.opens_at);
  const closes = new Date(quiz.closes_at);
  if (now < opens) return 'upcoming';
  if (now > closes) return 'closed';
  return 'open';
}

async function assertStudentEnrolled(courseId, userEmail) {
  const result = await pool.query(
    `SELECT 1 FROM student_courses
     WHERE course_id = $1 AND user_email = $2`,
    [courseId, userEmail],
  );
  if (result.rows.length === 0) {
    throw new CourseAccessError('You must enroll in this course first', 403);
  }
}

async function getQuizWithCourse(quizId) {
  const result = await pool.query(
    `SELECT q.*, c.instructor_email, c.code AS course_code
     FROM quizzes q
     JOIN courses c ON q.course_id = c.id
     WHERE q.id = $1`,
    [quizId],
  );
  return result.rows[0] || null;
}

async function loadQuizItems(quizId, { includeAnswers = false } = {}) {
  const result = await pool.query(
    `SELECT id, quiz_id, display_order, item_type, prompt_html, question_id,
            options, correct_option_index, reference_answer_html, points
     FROM quiz_items
     WHERE quiz_id = $1
     ORDER BY display_order ASC, id ASC`,
    [quizId],
  );
  const items = result.rows.map((row) => {
    const item = { ...row };
    if (!includeAnswers) {
      delete item.correct_option_index;
      delete item.reference_answer_html;
    }
    return item;
  });
  return attachPracticeBankContent(items, { includeAnswers });
}

async function attachPracticeBankContent(items, { includeAnswers = false } = {}) {
  const practiceIds = [
    ...new Set(
      items
        .filter((item) => item.item_type === 'practice_question' && item.question_id)
        .map((item) => item.question_id),
    ),
  ];
  if (practiceIds.length === 0) return items;

  const questionsResult = await pool.query(
    'SELECT id, question_text, goal FROM questions WHERE id = ANY($1::int[])',
    [practiceIds],
  );
  const questionById = Object.fromEntries(
    questionsResult.rows.map((row) => [row.id, row]),
  );

  let referenceByQuestionId = {};
  if (includeAnswers) {
    const solutionsResult = await pool.query(
      `SELECT question_id, solution_text FROM solutions WHERE question_id = ANY($1::int[])
       UNION ALL
       SELECT question_id, solution_text FROM mathematical_solutions WHERE question_id = ANY($1::int[])`,
      [practiceIds],
    );
    for (const row of solutionsResult.rows) {
      if (!referenceByQuestionId[row.question_id]) {
        referenceByQuestionId[row.question_id] = [];
      }
      if (row.solution_text) {
        referenceByQuestionId[row.question_id].push(row.solution_text);
      }
    }
  }

  return items.map((item) => {
    if (item.item_type !== 'practice_question') return item;
    const question = questionById[item.question_id];
    const next = {
      ...item,
      prompt_html: question?.question_text || item.prompt_html,
    };
    if (includeAnswers) {
      const parts = [
        question?.goal,
        ...(referenceByQuestionId[item.question_id] || []),
      ].filter((text) => text && String(text).trim());
      next.reference_answer_html = parts.join('\n\n') || null;
    }
    return next;
  });
}

function getAttemptExpiresAt(quiz, submission) {
  if (quiz.time_limit_minutes == null || !submission?.started_at) {
    return null;
  }
  const start = new Date(submission.started_at);
  return new Date(start.getTime() + quiz.time_limit_minutes * 60 * 1000);
}

function isAttemptExpired(quiz, submission) {
  const expiresAt = getAttemptExpiresAt(quiz, submission);
  return Boolean(expiresAt && new Date() > expiresAt);
}

async function finalizeActiveSubmission(quiz, submission) {
  const quizId = quiz.id;
  const items = await pool.query(
    `SELECT id, item_type, correct_option_index, points
     FROM quiz_items WHERE quiz_id = $1`,
    [quizId],
  );
  const answers = await pool.query(
    `SELECT quiz_item_id, answer_json
     FROM student_quiz_answers WHERE submission_id = $1`,
    [submission.id],
  );
  const answerByItem = Object.fromEntries(
    answers.rows.map((a) => [a.quiz_item_id, a.answer_json]),
  );

  await pool.query(
    `UPDATE student_quiz_answers a
     SET points_earned = NULL,
         is_correct = NULL,
         ai_feedback = NULL,
         graded_at = NULL
     FROM quiz_items qi
     WHERE a.quiz_item_id = qi.id
       AND qi.quiz_id = $1
       AND qi.item_type IN ('typed', 'practice_question')
       AND a.submission_id = $2`,
    [quizId, submission.id],
  );

  for (const item of items.rows) {
    const itemPoints = item.points ?? 1;
    if (item.item_type !== 'multiple_choice') continue;
    let ans = answerByItem[item.id];
    if (typeof ans === 'string') {
      try {
        ans = JSON.parse(ans);
      } catch {
        ans = {};
      }
    }
    const selected =
      ans && typeof ans === 'object' ? ans.selectedIndex : undefined;
    const isCorrect =
      selected !== undefined && selected === item.correct_option_index;
    const pointsEarned = isCorrect ? itemPoints : 0;
    await pool.query(
      `INSERT INTO student_quiz_answers (submission_id, quiz_item_id, answer_json, is_correct, points_earned, graded_at)
       VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
       ON CONFLICT (submission_id, quiz_item_id)
       DO UPDATE SET is_correct = EXCLUDED.is_correct,
                     points_earned = EXCLUDED.points_earned,
                     graded_at = CURRENT_TIMESTAMP`,
      [
        submission.id,
        item.id,
        JSON.stringify(ans || {}),
        isCorrect,
        pointsEarned,
      ],
    );
  }

  await pool.query(
    `UPDATE student_quiz_submissions
     SET submitted_at = CURRENT_TIMESTAMP
     WHERE id = $1`,
    [submission.id],
  );
  const score = await updateSubmissionTotals(submission.id, quizId);
  const updated = await pool.query(
    'SELECT * FROM student_quiz_submissions WHERE id = $1',
    [submission.id],
  );
  const submissionRow = updated.rows[0];
  let scoresPublished = Boolean(quiz.scores_published);
  if (submissionRow.attempt_number > 1) {
    await unpublishQuizScores(quizId);
    scoresPublished = false;
  }
  return { submission: submissionRow, score, scoresPublished };
}

function computeExpiresAt(quiz, startedAt) {
  if (quiz.time_limit_minutes == null) {
    return null;
  }
  const start = new Date(startedAt);
  return new Date(start.getTime() + quiz.time_limit_minutes * 60 * 1000);
}

async function getStudentSubmission(quizId, userEmail) {
  const result = await pool.query(
    `SELECT * FROM student_quiz_submissions
     WHERE quiz_id = $1 AND user_email = $2`,
    [quizId, userEmail],
  );
  return result.rows[0] || null;
}

async function getActiveSubmission(quizId, userEmail) {
  const submission = await getStudentSubmission(quizId, userEmail);
  if (submission && !submission.submitted_at) {
    return submission;
  }
  return null;
}

async function getLatestSubmittedSubmission(quizId, userEmail) {
  const submission = await getStudentSubmission(quizId, userEmail);
  if (submission?.submitted_at) {
    return submission;
  }
  return null;
}

function submissionSummary(submission, maxAttempts) {
  const inProgress = submission && !submission.submitted_at ? submission : null;
  const latestSubmitted = submission?.submitted_at ? submission : null;
  const attemptsUsed = submission?.attempt_number ?? 0;
  const canRetake =
    Boolean(latestSubmitted) && attemptsUsed < maxAttempts && !inProgress;
  return {
    attempts_used: attemptsUsed,
    max_attempts: maxAttempts,
    in_progress: inProgress,
    latest_submitted: latestSubmitted,
    can_start: Boolean(inProgress) || !submission || canRetake,
    can_retake: canRetake,
  };
}

async function computeSubmissionScore(submissionId, quizId) {
  const result = await pool.query(
    `SELECT
       COALESCE(SUM(qi.points), 0)::int AS points_possible,
       COALESCE(SUM(
         CASE
           WHEN qi.item_type = 'multiple_choice' THEN COALESCE(a.points_earned, 0)
           WHEN qi.item_type IN ('typed', 'practice_question') AND a.graded_at IS NOT NULL THEN COALESCE(a.points_earned, 0)
           ELSE 0
         END
       ), 0)::int AS points_earned,
       COUNT(*) FILTER (
         WHERE qi.item_type IN ('typed', 'practice_question')
           AND a.id IS NOT NULL
           AND a.graded_at IS NULL
       )::int AS pending_typed_count
     FROM quiz_items qi
     LEFT JOIN student_quiz_answers a
       ON a.quiz_item_id = qi.id AND a.submission_id = $1
     WHERE qi.quiz_id = $2`,
    [submissionId, quizId],
  );
  const row = result.rows[0];
  return {
    points_earned: row.points_earned,
    points_possible: row.points_possible,
    pending_typed_count: row.pending_typed_count,
  };
}

async function updateSubmissionTotals(submissionId, quizId) {
  const score = await computeSubmissionScore(submissionId, quizId);
  await pool.query(
    `UPDATE student_quiz_submissions
     SET points_earned = $1, points_possible = $2
     WHERE id = $3`,
    [score.points_earned, score.points_possible, submissionId],
  );
  return score;
}

function computeScoreFromItems(items, answerByItem) {
  let pointsEarned = 0;
  let pointsPossible = 0;
  let pendingTyped = 0;

  for (const item of items) {
    const itemPoints = item.points ?? 1;
    pointsPossible += itemPoints;
    const answer = answerByItem[item.id];
    if (!answer) continue;

    if (item.item_type === 'multiple_choice') {
      pointsEarned += answer.points_earned ?? 0;
    } else if (item.item_type === 'typed' || item.item_type === 'practice_question') {
      if (!answer.graded_at) {
        pendingTyped += 1;
      } else {
        pointsEarned += answer.points_earned ?? 0;
      }
    }
  }

  return {
    points_earned: pointsEarned,
    points_possible: pointsPossible,
    pending_typed_count: pendingTyped,
  };
}

function buildSubmissionReviewPayload(
  quiz,
  submission,
  items,
  answerByItem,
  { audience = 'student' } = {},
) {
  const scoresPublished = Boolean(quiz.scores_published);
  const isInstructor = audience === 'instructor';
  const showGrading = isInstructor || scoresPublished;

  const scoreFromItems = computeScoreFromItems(items, answerByItem);
  const pointsEarned = scoreFromItems.points_earned;
  const pointsPossible = scoreFromItems.points_possible;

  const sanitizedItems = items.map((item) => {
    const studentAnswer = answerByItem[item.id] || null;
    const base = { ...item };
    if (!showGrading) {
      delete base.correct_option_index;
      delete base.reference_answer_html;
    }
    if (!studentAnswer) {
      return { ...base, student_answer: null };
    }
    if (showGrading) {
      return { ...base, student_answer: studentAnswer };
    }
    const { is_correct, points_earned, ai_feedback, graded_at, ...safeAnswer } =
      studentAnswer;
    return { ...base, student_answer: safeAnswer };
  });

  return {
    quiz: {
      id: quiz.id,
      title: quiz.title,
      description: quiz.description,
      course_code: quiz.course_code,
      course_id: quiz.course_id,
      scores_published: scoresPublished,
    },
    submission,
    scores_published: scoresPublished,
    show_grading: showGrading,
    score: showGrading
      ? {
          points_earned: pointsEarned,
          points_possible: pointsPossible,
          pending_typed_count: scoreFromItems.pending_typed_count,
        }
      : null,
    items: sanitizedItems,
  };
}

function buildStudentResultsPayload(quiz, submission, items, answerByItem) {
  return buildSubmissionReviewPayload(quiz, submission, items, answerByItem, {
    audience: 'student',
  });
}

async function unpublishQuizScores(quizId) {
  await pool.query(
    'UPDATE quizzes SET scores_published = false WHERE id = $1',
    [quizId],
  );
}

async function assertInstructorOwnsQuiz(quizId, instructorEmail) {
  const quiz = await getQuizWithCourse(quizId);
  if (!quiz || quiz.instructor_email !== instructorEmail) {
    throw new CourseAccessError();
  }
  return quiz;
}

function parseAnswerJson(raw) {
  if (!raw) return {};
  if (typeof raw === 'object') return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function loadSavedAnswers(submissionId) {
  const result = await pool.query(
    `SELECT quiz_item_id, answer_json
     FROM student_quiz_answers
     WHERE submission_id = $1`,
    [submissionId],
  );
  const answers = {};
  for (const row of result.rows) {
    answers[Number(row.quiz_item_id)] = parseAnswerJson(row.answer_json);
  }
  return answers;
}

function escapeCsvCell(value) {
  const text = value == null ? '' : String(value);
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function collectAiFeedback(items, answerByItem) {
  const parts = [];
  items.forEach((item, index) => {
    if (item.item_type !== 'typed' && item.item_type !== 'practice_question') return;
    const feedback = answerByItem[item.id]?.ai_feedback;
    if (feedback) {
      parts.push(`Question ${index + 1}: ${feedback}`);
    }
  });
  return parts.join('\n\n');
}

function sanitizeFilename(name) {
  return String(name || 'quiz')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 80) || 'quiz';
}

// --- Instructor: list quizzes for a course ---
router.get('/course/:courseId', requireInstructor, async (req, res) => {
  const courseId = parseCourseId(req.params.courseId);
  if (!courseId) {
    return res.status(400).json({ error: 'Invalid course id' });
  }

  try {
    await assertOwnedCourseById(courseId, req.user.email);
    const result = await pool.query(
      `SELECT * FROM quizzes WHERE course_id = $1 ORDER BY opens_at ASC`,
      [courseId],
    );
    const quizzes = result.rows.map((q) => ({
      ...q,
      status: getQuizWindowStatus(q),
    }));
    res.json({ quizzes });
  } catch (err) {
    if (!sendCourseAccessError(res, err)) {
      res.status(500).json({ error: err.message });
    }
  }
});

// --- Student: list quizzes for enrolled course ---
router.get('/course/:courseId/student', requireStudent, async (req, res) => {
  const courseId = parseCourseId(req.params.courseId);
  if (!courseId) {
    return res.status(400).json({ error: 'Invalid course id' });
  }

  try {
    await assertStudentEnrolled(courseId, req.user.email);
    const quizResult = await pool.query(
      `SELECT q.* FROM quizzes q WHERE q.course_id = $1 ORDER BY q.opens_at ASC`,
      [courseId],
    );
    const quizIds = quizResult.rows.map((r) => r.id);
    let subResult = { rows: [] };
    if (quizIds.length > 0) {
      subResult = await pool.query(
        `SELECT quiz_id, submitted_at, started_at, expires_at, attempt_number
         FROM student_quiz_submissions
         WHERE user_email = $1 AND quiz_id = ANY($2::int[])`,
        [req.user.email, quizIds],
      );
    }
    const subsByQuiz = Object.fromEntries(
      subResult.rows.map((s) => [s.quiz_id, s]),
    );

    const quizzes = quizResult.rows.map((q) => {
      const submission = subsByQuiz[q.id] || null;
      const summary = submissionSummary(submission, q.max_attempts ?? 1);
      return {
        ...q,
        status: getQuizWindowStatus(q),
        submission: summary.in_progress || summary.latest_submitted || null,
        attempt_summary: summary,
      };
    });
    res.json({ quizzes });
  } catch (err) {
    if (!sendCourseAccessError(res, err)) {
      res.status(500).json({ error: err.message });
    }
  }
});

router.post('/', requireInstructor, async (req, res) => {
  const {
    course_id,
    title,
    description,
    opens_at,
    closes_at,
    time_limit_minutes,
    max_attempts,
  } = req.body;

  if (!course_id || !title || !opens_at || !closes_at) {
    return res.status(400).json({
      error: 'course_id, title, opens_at, and closes_at are required',
    });
  }

  try {
    await assertOwnedCourseById(course_id, req.user.email);
    const result = await pool.query(
      `INSERT INTO quizzes (
        course_id, title, description, opens_at, closes_at, time_limit_minutes, max_attempts
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *`,
      [
        course_id,
        title,
        description || null,
        opens_at,
        closes_at,
        time_limit_minutes ?? null,
        max_attempts ?? 1,
      ],
    );
    res.status(201).json({ quiz: result.rows[0] });
  } catch (err) {
    if (!sendCourseAccessError(res, err)) {
      res.status(400).json({ error: err.message });
    }
  }
});

router.put('/:quizId', requireInstructor, async (req, res) => {
  const quizId = parseCourseId(req.params.quizId);
  const {
    title,
    description,
    opens_at,
    closes_at,
    time_limit_minutes,
    max_attempts,
  } = req.body;

  if (!quizId) {
    return res.status(400).json({ error: 'Invalid quiz id' });
  }

  try {
    const quiz = await getQuizWithCourse(quizId);
    if (!quiz || quiz.instructor_email !== req.user.email) {
      throw new CourseAccessError();
    }

    const result = await pool.query(
      `UPDATE quizzes SET
        title = COALESCE($1, title),
        description = COALESCE($2, description),
        opens_at = COALESCE($3, opens_at),
        closes_at = COALESCE($4, closes_at),
        time_limit_minutes = $5,
        max_attempts = COALESCE($6, max_attempts)
       WHERE id = $7
       RETURNING *`,
      [
        title,
        description,
        opens_at,
        closes_at,
        time_limit_minutes !== undefined ? time_limit_minutes : quiz.time_limit_minutes,
        max_attempts,
        quizId,
      ],
    );
    res.json({ quiz: result.rows[0] });
  } catch (err) {
    if (!sendCourseAccessError(res, err)) {
      res.status(400).json({ error: err.message });
    }
  }
});

router.delete('/:quizId', requireInstructor, async (req, res) => {
  const quizId = parseCourseId(req.params.quizId);
  if (!quizId) {
    return res.status(400).json({ error: 'Invalid quiz id' });
  }

  try {
    const quiz = await getQuizWithCourse(quizId);
    if (!quiz || quiz.instructor_email !== req.user.email) {
      throw new CourseAccessError();
    }
    await pool.query('DELETE FROM quizzes WHERE id = $1', [quizId]);
    res.status(204).send();
  } catch (err) {
    if (!sendCourseAccessError(res, err)) {
      res.status(500).json({ error: err.message });
    }
  }
});

router.patch('/:quizId/publish-scores', requireInstructor, async (req, res) => {
  const quizId = parseCourseId(req.params.quizId);
  const { scores_published } = req.body;

  if (!quizId) {
    return res.status(400).json({ error: 'Invalid quiz id' });
  }
  if (typeof scores_published !== 'boolean') {
    return res.status(400).json({ error: 'scores_published boolean is required' });
  }

  try {
    const quiz = await getQuizWithCourse(quizId);
    if (!quiz || quiz.instructor_email !== req.user.email) {
      throw new CourseAccessError();
    }
    const result = await pool.query(
      `UPDATE quizzes SET scores_published = $1 WHERE id = $2 RETURNING *`,
      [scores_published, quizId],
    );
    res.json({ quiz: result.rows[0] });
  } catch (err) {
    if (!sendCourseAccessError(res, err)) {
      res.status(400).json({ error: err.message });
    }
  }
});

router.post('/:quizId/items', requireInstructor, async (req, res) => {
  const quizId = parseCourseId(req.params.quizId);
  const {
    item_type,
    display_order,
    prompt_html,
    question_id,
    options,
    correct_option_index,
    reference_answer_html,
    points,
  } = req.body;

  if (!quizId || !item_type) {
    return res.status(400).json({ error: 'Invalid quiz id or missing item_type' });
  }

  try {
    const quiz = await getQuizWithCourse(quizId);
    if (!quiz || quiz.instructor_email !== req.user.email) {
      throw new CourseAccessError();
    }

    const promptError = validateQuizItemFields({ item_type, prompt_html, question_id }, 0);
    if (promptError) {
      return res.status(400).json({ error: promptError });
    }

    if (item_type === 'practice_question') {
        const qCheck = await pool.query(
        'SELECT id FROM questions WHERE id = $1 AND course_code = $2',
        [question_id, quiz.course_code],
      );
      if (qCheck.rows.length === 0) {
        return res.status(400).json({
          error: 'Question not found in this course',
        });
      }
    }

    const result = await pool.query(
      `INSERT INTO quiz_items (
        quiz_id, display_order, item_type, prompt_html, question_id,
        options, correct_option_index, reference_answer_html, points
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *`,
      [
        quizId,
        display_order ?? 0,
        item_type,
        promptHtmlForDb({ item_type, prompt_html }),
        question_id || null,
        options != null ? JSON.stringify(options) : null,
        correct_option_index ?? null,
        reference_answer_html || null,
        points ?? 1,
      ],
    );
    res.status(201).json({ item: result.rows[0] });
  } catch (err) {
    if (!sendCourseAccessError(res, err)) {
      res.status(400).json({ error: err.message });
    }
  }
});

router.put('/:quizId/items', requireInstructor, async (req, res) => {
  const quizId = parseCourseId(req.params.quizId);
  const { items } = req.body;

  if (!quizId || !Array.isArray(items)) {
    return res.status(400).json({ error: 'Invalid quiz id or items array required' });
  }

  const client = await pool.connect();
  try {
    const quiz = await getQuizWithCourse(quizId);
    if (!quiz || quiz.instructor_email !== req.user.email) {
      throw new CourseAccessError();
    }

    const validTypes = ['multiple_choice', 'typed', 'practice_question'];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item?.item_type || !validTypes.includes(item.item_type)) {
        return res.status(400).json({
          error: `Question ${i + 1}: invalid or missing item_type`,
        });
      }
      const fieldError = validateQuizItemFields(item, i);
      if (fieldError) {
        return res.status(400).json({ error: fieldError });
      }
      if (item.item_type === 'practice_question') {
        const qCheck = await pool.query(
          'SELECT id FROM questions WHERE id = $1 AND course_code = $2',
          [item.question_id, quiz.course_code],
        );
        if (qCheck.rows.length === 0) {
          return res.status(400).json({
            error: `Question ${i + 1}: practice question not found in this course`,
          });
        }
      }
    }

    await client.query('BEGIN');

    const existingResult = await client.query(
      'SELECT id FROM quiz_items WHERE quiz_id = $1',
      [quizId],
    );
    const existingIds = new Set(existingResult.rows.map((row) => row.id));
    const payloadIds = new Set(
      items
        .map((item) => parseCourseId(item.id))
        .filter((id) => id != null),
    );

    for (const id of existingIds) {
      if (!payloadIds.has(id)) {
        await client.query(
          'DELETE FROM quiz_items WHERE id = $1 AND quiz_id = $2',
          [id, quizId],
        );
      }
    }

    const resultItems = [];
    for (let order = 0; order < items.length; order++) {
      const item = items[order];
      const options =
        item.item_type === 'multiple_choice'
          ? (Array.isArray(item.options) ? item.options : [])
              .filter((o) => String(o?.text || '').trim())
              .map((o) => ({ text: String(o.text).trim() }))
          : null;
      // node-pg treats JS arrays as Postgres arrays; JSONB needs a JSON string.
      const optionsJson = options != null ? JSON.stringify(options) : null;

      const itemId = parseCourseId(item.id);
      if (itemId && existingIds.has(itemId)) {
        const updated = await client.query(
          `UPDATE quiz_items SET
            display_order = $1,
            item_type = $2,
            prompt_html = $3,
            question_id = $4,
            options = $5,
            correct_option_index = $6,
            reference_answer_html = $7,
            points = $8
           WHERE id = $9 AND quiz_id = $10
           RETURNING *`,
          [
            order,
            item.item_type,
            promptHtmlForDb(item),
            item.item_type === 'practice_question' ? item.question_id : null,
            optionsJson,
            item.item_type === 'multiple_choice'
              ? (item.correct_option_index ?? 0)
              : null,
            item.item_type === 'typed' ? (item.reference_answer_html || null) : null,
            item.points ?? 1,
            itemId,
            quizId,
          ],
        );
        resultItems.push(updated.rows[0]);
      } else {
        const inserted = await client.query(
          `INSERT INTO quiz_items (
            quiz_id, display_order, item_type, prompt_html, question_id,
            options, correct_option_index, reference_answer_html, points
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          RETURNING *`,
          [
            quizId,
            order,
            item.item_type,
            promptHtmlForDb(item),
            item.item_type === 'practice_question' ? item.question_id : null,
            optionsJson,
            item.item_type === 'multiple_choice'
              ? (item.correct_option_index ?? 0)
              : null,
            item.item_type === 'typed' ? (item.reference_answer_html || null) : null,
            item.points ?? 1,
          ],
        );
        resultItems.push(inserted.rows[0]);
      }
    }

    await client.query('COMMIT');
    res.json({ items: resultItems });
  } catch (err) {
    await client.query('ROLLBACK');
    if (!sendCourseAccessError(res, err)) {
      res.status(400).json({ error: err.message });
    }
  } finally {
    client.release();
  }
});

router.delete('/:quizId/items/:itemId', requireInstructor, async (req, res) => {
  const quizId = parseCourseId(req.params.quizId);
  const itemId = parseCourseId(req.params.itemId);

  try {
    const quiz = await getQuizWithCourse(quizId);
    if (!quiz || quiz.instructor_email !== req.user.email) {
      throw new CourseAccessError();
    }
    await pool.query(
      'DELETE FROM quiz_items WHERE id = $1 AND quiz_id = $2',
      [itemId, quizId],
    );
    res.status(204).send();
  } catch (err) {
    if (!sendCourseAccessError(res, err)) {
      res.status(500).json({ error: err.message });
    }
  }
});

// --- Instructor: read-only student-facing preview (no enrollment / submission) ---
router.get('/:quizId/preview', requireInstructor, async (req, res) => {
  const quizId = parseCourseId(req.params.quizId);
  if (!quizId) {
    return res.status(400).json({ error: 'Invalid quiz id' });
  }

  try {
    const quiz = await getQuizWithCourse(quizId);
    if (!quiz || quiz.instructor_email !== req.user.email) {
      throw new CourseAccessError();
    }

    const items = await loadQuizItems(quizId, { includeAnswers: false });
    res.json({
      quiz: { ...quiz, status: getQuizWindowStatus(quiz) },
      items,
    });
  } catch (err) {
    if (!sendCourseAccessError(res, err)) {
      res.status(500).json({ error: err.message });
    }
  }
});

// --- Student: quiz for taking (no solutions) ---
router.get('/:quizId/take', requireStudent, async (req, res) => {
  const quizId = parseCourseId(req.params.quizId);
  if (!quizId) {
    return res.status(400).json({ error: 'Invalid quiz id' });
  }

  try {
    const quiz = await getQuizWithCourse(quizId);
    if (!quiz) {
      return res.status(404).json({ error: 'Quiz not found' });
    }
    await assertStudentEnrolled(quiz.course_id, req.user.email);

    const status = getQuizWindowStatus(quiz);
    const items = await loadQuizItems(quizId, { includeAnswers: false });

    let activeSubmission = await getActiveSubmission(quizId, req.user.email);
    let autoSubmitted = false;
    if (activeSubmission && isAttemptExpired(quiz, activeSubmission)) {
      const finalized = await finalizeActiveSubmission(quiz, activeSubmission);
      activeSubmission = null;
      autoSubmitted = true;
      return res.json({
        quiz: { ...quiz, status },
        items,
        submission: finalized.submission,
        auto_submitted: true,
      });
    }

    let answers = {};
    if (activeSubmission) {
      answers = await loadSavedAnswers(activeSubmission.id);
    }

    res.json({
      quiz: { ...quiz, status },
      items,
      submission: activeSubmission,
      answers,
      auto_submitted: autoSubmitted,
    });
  } catch (err) {
    if (!sendCourseAccessError(res, err)) {
      res.status(500).json({ error: err.message });
    }
  }
});

router.post('/:quizId/start', requireStudent, async (req, res) => {
  const quizId = parseCourseId(req.params.quizId);
  if (!quizId) {
    return res.status(400).json({ error: 'Invalid quiz id' });
  }

  try {
    const quiz = await getQuizWithCourse(quizId);
    if (!quiz) {
      return res.status(404).json({ error: 'Quiz not found' });
    }
    await assertStudentEnrolled(quiz.course_id, req.user.email);

    if (getQuizWindowStatus(quiz) !== 'open') {
      return res.status(403).json({ error: 'Quiz is not open' });
    }

    const active = await getActiveSubmission(quizId, req.user.email);
    if (active) {
      return res.json({ submission: active });
    }

    const existing = await getStudentSubmission(quizId, req.user.email);
    const maxAttempts = quiz.max_attempts ?? 1;

    if (existing?.submitted_at) {
      if (existing.attempt_number >= maxAttempts) {
        return res.status(403).json({ error: 'No attempts remaining' });
      }
      const expiresAt = computeExpiresAt(quiz, new Date());
      await pool.query(
        'DELETE FROM student_quiz_answers WHERE submission_id = $1',
        [existing.id],
      );
      const result = await pool.query(
        `UPDATE student_quiz_submissions
         SET started_at = CURRENT_TIMESTAMP,
             submitted_at = NULL,
             expires_at = $1,
             attempt_number = attempt_number + 1,
             points_earned = NULL,
             points_possible = NULL
         WHERE id = $2
         RETURNING *`,
        [expiresAt, existing.id],
      );
      return res.status(201).json({ submission: result.rows[0] });
    }

    if (existing) {
      return res.json({ submission: existing });
    }

    const expiresAt = computeExpiresAt(quiz, new Date());
    const result = await pool.query(
      `INSERT INTO student_quiz_submissions (quiz_id, user_email, expires_at, attempt_number)
       VALUES ($1, $2, $3, 1)
       RETURNING *`,
      [quizId, req.user.email, expiresAt],
    );
    return res.status(201).json({ submission: result.rows[0] });
  } catch (err) {
    if (!sendCourseAccessError(res, err)) {
      res.status(500).json({ error: err.message });
    }
  }
});

router.put('/:quizId/answers/:itemId', requireStudent, async (req, res) => {
  const quizId = parseCourseId(req.params.quizId);
  const itemId = parseCourseId(req.params.itemId);
  const { answer_json } = req.body;

  if (!answer_json || typeof answer_json !== 'object') {
    return res.status(400).json({ error: 'answer_json object is required' });
  }

  try {
    const quiz = await getQuizWithCourse(quizId);
    if (!quiz) {
      return res.status(404).json({ error: 'Quiz not found' });
    }
    await assertStudentEnrolled(quiz.course_id, req.user.email);

    const submission = await getActiveSubmission(quizId, req.user.email);
    if (!submission) {
      return res.status(400).json({ error: 'Start the quiz first' });
    }
    const now = new Date();
    const attemptExpiresAt = getAttemptExpiresAt(quiz, submission);
    const timeExpired = Boolean(attemptExpiresAt && now > attemptExpiresAt);

    const itemCheck = await pool.query(
      'SELECT id FROM quiz_items WHERE id = $1 AND quiz_id = $2',
      [itemId, quizId],
    );
    if (itemCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Quiz item not found' });
    }

    const result = await pool.query(
      `INSERT INTO student_quiz_answers (submission_id, quiz_item_id, answer_json)
       VALUES ($1, $2, $3)
       ON CONFLICT (submission_id, quiz_item_id)
       DO UPDATE SET answer_json = EXCLUDED.answer_json
       RETURNING *`,
      [submission.id, itemId, JSON.stringify(answer_json)],
    );
    res.json({ answer: result.rows[0], time_expired: timeExpired });
  } catch (err) {
    if (!sendCourseAccessError(res, err)) {
      res.status(500).json({ error: err.message });
    }
  }
});

router.post('/:quizId/submit', requireStudent, async (req, res) => {
  const quizId = parseCourseId(req.params.quizId);
  if (!quizId) {
    return res.status(400).json({ error: 'Invalid quiz id' });
  }

  try {
    const quiz = await getQuizWithCourse(quizId);
    if (!quiz) {
      return res.status(404).json({ error: 'Quiz not found' });
    }
    await assertStudentEnrolled(quiz.course_id, req.user.email);

    const submission = await getActiveSubmission(quizId, req.user.email);
    if (!submission) {
      const existing = await getStudentSubmission(quizId, req.user.email);
      if (existing?.submitted_at) {
        return res.json({ submission: existing, message: 'Already submitted' });
      }
      return res.status(400).json({ error: 'Start the quiz first' });
    }

    const { submission: submissionRow, score, scoresPublished } =
      await finalizeActiveSubmission(quiz, submission);

    const response = { submission: submissionRow };
    if (scoresPublished) {
      response.score = {
        points_earned: score.points_earned,
        points_possible: score.points_possible,
        pending_typed_count: score.pending_typed_count,
      };
    }
    res.json(response);
  } catch (err) {
    if (!sendCourseAccessError(res, err)) {
      res.status(500).json({ error: err.message });
    }
  }
});

router.get('/:quizId/results', requireStudent, async (req, res) => {
  const quizId = parseCourseId(req.params.quizId);
  if (!quizId) {
    return res.status(400).json({ error: 'Invalid quiz id' });
  }

  try {
    const quiz = await getQuizWithCourse(quizId);
    if (!quiz) {
      return res.status(404).json({ error: 'Quiz not found' });
    }
    await assertStudentEnrolled(quiz.course_id, req.user.email);

    const submission = await getLatestSubmittedSubmission(quizId, req.user.email);
    if (!submission) {
      return res.status(403).json({ error: 'Submit the quiz to view results' });
    }

    const items = await loadQuizItems(quizId, { includeAnswers: true });
    const answers = await pool.query(
      `SELECT * FROM student_quiz_answers WHERE submission_id = $1`,
      [submission.id],
    );
    const answerByItem = Object.fromEntries(
      answers.rows.map((a) => [a.quiz_item_id, a]),
    );

    res.json(buildStudentResultsPayload(quiz, submission, items, answerByItem));
  } catch (err) {
    if (!sendCourseAccessError(res, err)) {
      res.status(500).json({ error: err.message });
    }
  }
});

router.get('/:quizId/submissions', requireInstructor, async (req, res) => {
  const quizId = parseCourseId(req.params.quizId);
  if (!quizId) {
    return res.status(400).json({ error: 'Invalid quiz id' });
  }

  try {
    const quiz = await assertInstructorOwnsQuiz(quizId, req.user.email);
    const studentsResult = await pool.query(
      `SELECT sc.user_email AS email, u.full_name AS name
       FROM student_courses sc
       JOIN users u ON u.email = sc.user_email
       WHERE sc.course_id = $1
       ORDER BY u.full_name ASC, sc.user_email ASC`,
      [quiz.course_id],
    );
    const submissionsResult = await pool.query(
      `SELECT s.*,
        (
          SELECT COUNT(*)::int
          FROM student_quiz_answers a
          JOIN quiz_items qi ON qi.id = a.quiz_item_id
          WHERE a.submission_id = s.id
            AND s.submitted_at IS NOT NULL
            AND qi.item_type IN ('typed', 'practice_question')
            AND a.graded_at IS NULL
        ) AS ungraded_typed_count
       FROM student_quiz_submissions s
       WHERE s.quiz_id = $1`,
      [quizId],
    );
    const submissionByEmail = Object.fromEntries(
      submissionsResult.rows.map((row) => [row.user_email, row]),
    );

    const students = studentsResult.rows.map((student) => {
      const submission = submissionByEmail[student.email] || null;
      return {
        email: student.email,
        name: student.name,
        submission: submission
          ? {
              id: submission.id,
              submitted_at: submission.submitted_at,
              started_at: submission.started_at,
              attempt_number: submission.attempt_number,
              points_earned: submission.points_earned,
              points_possible: submission.points_possible,
              ungraded_typed_count: submission.submitted_at
                ? (submission.ungraded_typed_count ?? 0)
                : 0,
            }
          : null,
      };
    });

    const pendingTypedCount = students.reduce(
      (sum, student) => sum + (student.submission?.ungraded_typed_count ?? 0),
      0,
    );

    res.json({
      quiz: {
        id: quiz.id,
        title: quiz.title,
        course_id: quiz.course_id,
        scores_published: quiz.scores_published,
      },
      students,
      pending_typed_count: pendingTypedCount,
    });
  } catch (err) {
    if (!sendCourseAccessError(res, err)) {
      res.status(500).json({ error: err.message });
    }
  }
});

router.get('/:quizId/submissions/export', requireInstructor, async (req, res) => {
  const quizId = parseCourseId(req.params.quizId);
  if (!quizId) {
    return res.status(400).json({ error: 'Invalid quiz id' });
  }

  try {
    const quiz = await assertInstructorOwnsQuiz(quizId, req.user.email);
    const items = await loadQuizItems(quizId);
    const submissionsResult = await pool.query(
      `SELECT s.id, s.user_email, s.points_earned, s.points_possible,
              u.full_name AS name
       FROM student_quiz_submissions s
       JOIN users u ON u.email = s.user_email
       WHERE s.quiz_id = $1 AND s.submitted_at IS NOT NULL
       ORDER BY u.full_name ASC, s.user_email ASC`,
      [quizId],
    );

    const submissionIds = submissionsResult.rows.map((row) => row.id);
    const answerBySubmission = {};
    if (submissionIds.length > 0) {
      const answersResult = await pool.query(
        `SELECT submission_id, quiz_item_id, ai_feedback
         FROM student_quiz_answers
         WHERE submission_id = ANY($1::int[])`,
        [submissionIds],
      );
      for (const answer of answersResult.rows) {
        if (!answerBySubmission[answer.submission_id]) {
          answerBySubmission[answer.submission_id] = {};
        }
        answerBySubmission[answer.submission_id][answer.quiz_item_id] = answer;
      }
    }

    const header = ['name', 'email', 'points', 'ai_feedback'];
    const rows = submissionsResult.rows.map((submission) => {
      const answerByItem = answerBySubmission[submission.id] || {};
      const earned = submission.points_earned;
      const possible = submission.points_possible;
      const points =
        earned != null && possible != null ? `${earned} / ${possible}` : '';
      return [
        escapeCsvCell(submission.name || ''),
        escapeCsvCell(submission.user_email),
        escapeCsvCell(points),
        escapeCsvCell(collectAiFeedback(items, answerByItem)),
      ].join(',');
    });

    const csv = `\uFEFF${header.join(',')}\n${rows.join('\n')}\n`;
    const filename = `${sanitizeFilename(quiz.title)}-submissions.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  } catch (err) {
    if (!sendCourseAccessError(res, err)) {
      res.status(500).json({ error: err.message });
    }
  }
});

router.get('/:quizId/submissions/:studentEmail', requireInstructor, async (req, res) => {
  const quizId = parseCourseId(req.params.quizId);
  const studentEmail = decodeURIComponent(req.params.studentEmail || '');

  if (!quizId || !studentEmail) {
    return res.status(400).json({ error: 'Invalid quiz id or student email' });
  }

  try {
    const quiz = await assertInstructorOwnsQuiz(quizId, req.user.email);
    const submission = await getStudentSubmission(quizId, studentEmail);
    if (!submission?.submitted_at) {
      return res.status(404).json({ error: 'No submitted attempt for this student' });
    }

    const items = await loadQuizItems(quizId, { includeAnswers: true });
    const answers = await pool.query(
      `SELECT * FROM student_quiz_answers WHERE submission_id = $1`,
      [submission.id],
    );
    const answerByItem = Object.fromEntries(
      answers.rows.map((answer) => [answer.quiz_item_id, answer]),
    );

    res.json(
      buildSubmissionReviewPayload(quiz, submission, items, answerByItem, {
        audience: 'instructor',
      }),
    );
  } catch (err) {
    if (!sendCourseAccessError(res, err)) {
      res.status(500).json({ error: err.message });
    }
  }
});

router.post('/:quizId/grade-with-ai', requireInstructor, async (req, res) => {
  const quizId = parseCourseId(req.params.quizId);
  if (!quizId) {
    return res.status(400).json({ error: 'Invalid quiz id' });
  }

  try {
    const quiz = await assertInstructorOwnsQuiz(quizId, req.user.email);

    const pendingResult = await pool.query(
      `SELECT a.submission_id, a.quiz_item_id, a.answer_json,
              qi.prompt_html, qi.reference_answer_html, qi.points,
              qi.item_type, qi.question_id,
              s.user_email
       FROM student_quiz_answers a
       JOIN student_quiz_submissions s ON s.id = a.submission_id
       JOIN quiz_items qi ON qi.id = a.quiz_item_id
       WHERE s.quiz_id = $1
         AND s.submitted_at IS NOT NULL
         AND qi.item_type IN ('typed', 'practice_question')
         AND a.graded_at IS NULL
       ORDER BY s.user_email ASC, qi.display_order ASC`,
      [quizId],
    );

    let gradedCount = 0;
    const errors = [];
    const touchedSubmissions = new Set();

    for (const row of pendingResult.rows) {
      try {
        const answerJson = parseAnswerJson(row.answer_json);
        let promptHtml = row.prompt_html;
        let referenceAnswerHtml = row.reference_answer_html;
        if (row.item_type === 'practice_question') {
          const [enriched] = await attachPracticeBankContent(
            [{
              item_type: 'practice_question',
              question_id: row.question_id,
              prompt_html: row.prompt_html,
            }],
            { includeAnswers: true },
          );
          promptHtml = enriched.prompt_html;
          referenceAnswerHtml = enriched.reference_answer_html;
        }
        if (!tryConsumeLlmBudget(req.user?.email || req.ip).ok) {
          throw new Error('Daily AI usage limit reached');
        }
        const grading = await gradeTypedAnswer({
          promptHtml,
          referenceAnswerHtml,
          studentAnswerText: answerJson.text || '',
          maxPoints: row.points ?? 1,
        });

        await pool.query(
          `UPDATE student_quiz_answers
           SET points_earned = $1,
               is_correct = $2,
               ai_feedback = $3,
               graded_at = CURRENT_TIMESTAMP
           WHERE submission_id = $4 AND quiz_item_id = $5`,
          [
            grading.points_earned,
            grading.is_correct,
            grading.feedback,
            row.submission_id,
            row.quiz_item_id,
          ],
        );
        touchedSubmissions.add(row.submission_id);
        gradedCount += 1;
      } catch (gradeErr) {
        errors.push({
          student_email: row.user_email,
          item_id: row.quiz_item_id,
          error: gradeErr.message,
        });
      }
    }

    for (const submissionId of touchedSubmissions) {
      await updateSubmissionTotals(submissionId, quizId);
    }

    let scoresPublished = Boolean(quiz.scores_published);
    if (gradedCount > 0 && scoresPublished) {
      await unpublishQuizScores(quizId);
      scoresPublished = false;
    }

    res.json({ graded_count: gradedCount, errors, scores_published: scoresPublished });
  } catch (err) {
    if (!sendCourseAccessError(res, err)) {
      res.status(500).json({ error: err.message });
    }
  }
});

router.patch(
  '/:quizId/submissions/:studentEmail/answers/:itemId',
  requireInstructor,
  async (req, res) => {
    const quizId = parseCourseId(req.params.quizId);
    const itemId = parseCourseId(req.params.itemId);
    const studentEmail = decodeURIComponent(req.params.studentEmail || '');
    const { points_earned, is_correct } = req.body;

    if (!quizId || !itemId || !studentEmail) {
      return res.status(400).json({ error: 'Invalid quiz, student, or item id' });
    }
    if (points_earned == null || typeof points_earned !== 'number') {
      return res.status(400).json({ error: 'points_earned number is required' });
    }

    try {
      await assertInstructorOwnsQuiz(quizId, req.user.email);
      const submission = await getStudentSubmission(quizId, studentEmail);
      if (!submission?.submitted_at) {
        return res.status(404).json({ error: 'No submitted attempt for this student' });
      }

      const itemCheck = await pool.query(
        'SELECT id, points FROM quiz_items WHERE id = $1 AND quiz_id = $2',
        [itemId, quizId],
      );
      if (itemCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Quiz item not found' });
      }

      const maxPoints = itemCheck.rows[0].points ?? 1;
      const clampedPoints = Math.min(maxPoints, Math.max(0, Math.round(points_earned)));
      const resolvedCorrect =
        typeof is_correct === 'boolean' ? is_correct : clampedPoints >= maxPoints;

      const result = await pool.query(
        `UPDATE student_quiz_answers
         SET points_earned = $1,
             is_correct = $2,
             graded_at = COALESCE(graded_at, CURRENT_TIMESTAMP)
         WHERE submission_id = $3 AND quiz_item_id = $4
         RETURNING *`,
        [clampedPoints, resolvedCorrect, submission.id, itemId],
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Answer not found' });
      }

      await updateSubmissionTotals(submission.id, quizId);
      res.json({ answer: result.rows[0] });
    } catch (err) {
      if (!sendCourseAccessError(res, err)) {
        res.status(500).json({ error: err.message });
      }
    }
  },
);

// Instructor: full quiz + items
router.get('/:quizId', requireInstructor, async (req, res) => {
  const quizId = parseCourseId(req.params.quizId);
  if (!quizId) {
    return res.status(400).json({ error: 'Invalid quiz id' });
  }

  try {
    const quiz = await getQuizWithCourse(quizId);
    if (!quiz || quiz.instructor_email !== req.user.email) {
      throw new CourseAccessError();
    }
    const items = await loadQuizItems(quizId, { includeAnswers: true });
    res.json({
      quiz: { ...quiz, status: getQuizWindowStatus(quiz) },
      items,
    });
  } catch (err) {
    if (!sendCourseAccessError(res, err)) {
      res.status(500).json({ error: err.message });
    }
  }
});

export default router;
