import express from 'express';
import pool from '../db/database.js';
import { requireInstructor, getOptionalUser } from '../middleware/auth.js';
import {
  assertOwnedCourseByCode,
  assertQuestionOwnedByInstructor,
  sendCourseAccessError,
} from '../db/courseOwnership.js';
import { syncFigureDescription, saveInstructorFigureDescription } from '../services/figureDescription.js';

const router = express.Router();

const QUESTION_ORDER = 'ORDER BY display_order ASC, id ASC';

function sortQuestions(questions) {
  return [...questions].sort(
    (a, b) => (a.display_order - b.display_order) || (a.id - b.id),
  );
}

/** Add course_number and student_number for a visible list within a scope. */
function annotateQuestionNumbers(visibleQuestions, allInScope) {
  const sortedAll = sortQuestions(allInScope);
  const courseNumberById = new Map(sortedAll.map((q, i) => [q.id, i + 1]));

  let studentCounter = 0;
  const studentNumberById = new Map();
  for (const q of sortedAll) {
    if (q.published !== false) {
      studentCounter += 1;
      studentNumberById.set(q.id, studentCounter);
    }
  }

  const annotated = visibleQuestions.map((q) => ({
    ...q,
    course_number: courseNumberById.get(q.id) ?? null,
    student_number: q.published !== false ? (studentNumberById.get(q.id) ?? null) : null,
  }));

  return {
    questions: annotated,
    counts: {
      published: studentCounter,
      course: sortedAll.length,
    },
  };
}

async function getAllCourseQuestions(courseId) {
  const result = await pool.query(
    `SELECT * FROM questions WHERE course_id = $1 ${QUESTION_ORDER}`,
    [courseId],
  );
  return result.rows;
}

async function getAllConceptQuestions(courseCode, conceptId) {
  const result = await pool.query(
    `SELECT q.*
     FROM questions q
     JOIN questions_concepts qc ON q.id = qc.question_id
     WHERE q.course_code = $1 AND qc.concept_id = $2
     ${QUESTION_ORDER}`,
    [courseCode, conceptId],
  );
  return result.rows;
}

async function getAllQuestionsByCourseCode(courseCode) {
  const result = await pool.query(
    `SELECT * FROM questions WHERE course_code = $1 ${QUESTION_ORDER}`,
    [courseCode],
  );
  return result.rows;
}

async function instructorOwnsCourseCode(userEmail, courseCode) {
  try {
    await assertOwnedCourseByCode(courseCode, userEmail);
    return true;
  } catch {
    return false;
  }
}

async function publishedFilterForCourse(courseCode, user) {
  if (user?.isInstructor && await instructorOwnsCourseCode(user.email, courseCode)) {
    return '';
  }
  return ' AND published = true';
}

router.get('/by-course-id/:courseId', async (req, res) => {
  const courseId = parseInt(req.params.courseId, 10);
  if (Number.isNaN(courseId)) {
    return res.status(400).json({ error: 'Invalid course id' });
  }
  try {
    const user = await getOptionalUser(req);
    const courseResult = await pool.query(
      'SELECT code, instructor_email FROM courses WHERE id = $1',
      [courseId],
    );
    if (courseResult.rows.length === 0) {
      return res.status(404).json({ error: 'Course not found' });
    }
    const course = courseResult.rows[0];
    const showAll = user?.isInstructor && user.email === course.instructor_email;
    const publishedClause = showAll ? '' : ' AND published = true';
    const sql = `SELECT * FROM questions WHERE course_id = $1${publishedClause} ${QUESTION_ORDER}`;
    const [result, allInScope] = await Promise.all([
      pool.query(sql, [courseId]),
      getAllCourseQuestions(courseId),
    ]);
    const payload = annotateQuestionNumbers(result.rows, allInScope);
    res.json(payload);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:questionId/can-edit', requireInstructor, async (req, res) => {
  try {
    await assertQuestionOwnedByInstructor(req.params.questionId, req.user.email);
    res.json({ canEdit: true });
  } catch (err) {
    if (!sendCourseAccessError(res, err)) {
      res.status(500).json({ error: err.message });
    }
  }
});

router.put('/reorder', requireInstructor, async (req, res) => {
  const { course_code, question_ids } = req.body;
  if (!course_code || !Array.isArray(question_ids) || question_ids.length === 0) {
    return res.status(400).json({ error: 'course_code and question_ids array are required' });
  }
  const client = await pool.connect();
  try {
    const course = await assertOwnedCourseByCode(course_code, req.user.email);
    await client.query('BEGIN');
    for (let i = 0; i < question_ids.length; i++) {
      await client.query(
        'UPDATE questions SET display_order = $1 WHERE id = $2 AND course_id = $3',
        [i, question_ids[i], course.id],
      );
    }
    await client.query('COMMIT');
    const result = await pool.query(
      `SELECT * FROM questions WHERE course_id = $1 ${QUESTION_ORDER}`,
      [course.id],
    );
    const payload = annotateQuestionNumbers(result.rows, result.rows);
    res.json(payload);
  } catch (err) {
    await client.query('ROLLBACK');
    if (!sendCourseAccessError(res, err)) {
      res.status(400).json({ error: err.message });
    }
  } finally {
    client.release();
  }
});

router.patch('/:id/publish', requireInstructor, async (req, res) => {
  const { published } = req.body;
  if (typeof published !== 'boolean') {
    return res.status(400).json({ error: 'published boolean is required' });
  }
  const questionId = req.params.id;
  try {
    await assertQuestionOwnedByInstructor(questionId, req.user.email);
    const result = await pool.query(
      'UPDATE questions SET published = $1 WHERE id = $2 RETURNING id, published',
      [published, questionId],
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Question not found' });
    }
    res.json({ id: result.rows[0].id, published: result.rows[0].published });
  } catch (err) {
    if (!sendCourseAccessError(res, err)) {
      res.status(400).json({ error: err.message });
    }
  }
});

// Get questions for a specific course by course_code
router.get('/:course_code', async (req, res) => {
  const courseCode = req.params.course_code;
  if (courseCode === 'reorder' || courseCode === 'by-course-id') {
    return res.status(404).json({ error: 'Not found' });
  }
  try {
    const user = await getOptionalUser(req);
    const publishedClause = await publishedFilterForCourse(courseCode, user);
    const sql = `SELECT * FROM questions WHERE course_code = $1${publishedClause} ${QUESTION_ORDER}`;
    const [result, allInScope] = await Promise.all([
      pool.query(sql, [courseCode]),
      getAllQuestionsByCourseCode(courseCode),
    ]);
    const payload = annotateQuestionNumbers(result.rows, allInScope);
    res.json(payload);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add a new question
router.post('/', requireInstructor, async (req, res) => {
  const { course_code, question_text, goal } = req.body;
  try {
    const course = await assertOwnedCourseByCode(course_code, req.user.email);
    const orderResult = await pool.query(
      'SELECT COALESCE(MAX(display_order), -1) + 1 AS next_order FROM questions WHERE course_id = $1',
      [course.id],
    );
    const displayOrder = orderResult.rows[0].next_order;
    const sql =
      'INSERT INTO questions (course_code, question_text, goal, course_id, display_order) VALUES ($1, $2, $3, $4, $5) RETURNING id';
    const params = [course_code, question_text, goal, course.id, displayOrder];
    const result = await pool.query(sql, params);
    const questionId = result.rows[0].id;
    const figureDescription = await syncFigureDescription(questionId, question_text);
    res.json({ id: questionId, figureDescription });
  } catch (err) {
    if (!sendCourseAccessError(res, err)) {
      res.status(400).json({ error: err.message });
    }
  }
});

// Update an existing question
router.put('/:id', requireInstructor, async (req, res) => {
  const { question_text, goal, figure_description } = req.body;
  const questionId = req.params.id;
  try {
    await assertQuestionOwnedByInstructor(questionId, req.user.email);
    const sql =
      'UPDATE questions SET question_text = $1, goal = $2 WHERE id = $3 RETURNING id';
    const result = await pool.query(sql, [question_text, goal, questionId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Question not found' });
    }

    let figureDescription;
    if (Object.prototype.hasOwnProperty.call(req.body, 'figure_description')) {
      figureDescription = await saveInstructorFigureDescription(
        questionId,
        question_text,
        figure_description,
      );
    } else {
      figureDescription = await syncFigureDescription(questionId, question_text);
    }

    res.json({ id: result.rows[0].id, figureDescription });
  } catch (err) {
    if (!sendCourseAccessError(res, err)) {
      res.status(400).json({ error: err.message });
    }
  }
});

router.post('/:id/regenerate-figure-description', requireInstructor, async (req, res) => {
  const questionId = req.params.id;
  try {
    await assertQuestionOwnedByInstructor(questionId, req.user.email);
    const result = await pool.query(
      'SELECT question_text FROM questions WHERE id = $1',
      [questionId],
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Question not found' });
    }
    const figureDescription = await syncFigureDescription(
      questionId,
      result.rows[0].question_text,
      { force: true },
    );
    res.json({ id: Number(questionId), figureDescription });
  } catch (err) {
    if (!sendCourseAccessError(res, err)) {
      res.status(400).json({ error: err.message });
    }
  }
});

router.delete('/:id', requireInstructor, async (req, res) => {
  const questionId = req.params.id;
  try {
    await assertQuestionOwnedByInstructor(questionId, req.user.email);
    const result = await pool.query(
      'DELETE FROM questions WHERE id = $1 RETURNING id, course_code',
      [questionId],
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Question not found' });
    }
    res.json({ id: result.rows[0].id, course_code: result.rows[0].course_code });
  } catch (err) {
    if (!sendCourseAccessError(res, err)) {
      res.status(500).json({ error: err.message });
    }
  }
});

// Get questions for a course and concept
router.get('/:course_code/concept/:conceptId', async (req, res) => {
  const { course_code, conceptId } = {
    course_code: req.params.course_code,
    conceptId: req.params.conceptId,
  };
  try {
    const user = await getOptionalUser(req);
    const publishedClause = await publishedFilterForCourse(course_code, user);
    const sql = `
      SELECT q.*
      FROM questions q
      JOIN questions_concepts qc ON q.id = qc.question_id
      WHERE q.course_code = $1 AND qc.concept_id = $2${publishedClause}
      ${QUESTION_ORDER}
    `;
    const [result, allInScope] = await Promise.all([
      pool.query(sql, [course_code, conceptId]),
      getAllConceptQuestions(course_code, conceptId),
    ]);
    const payload = annotateQuestionNumbers(result.rows, allInScope);
    res.json(payload);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get full details for a question
router.get('/full_question/:question_id', async (req, res) => {
  const questionId = req.params.question_id;
  const sqlQuestion = 'SELECT * FROM questions WHERE id = $1';
  const sqlExplicitData = 'SELECT data_text FROM explicit_data WHERE question_id = $1';
  const sqlImplicitData = 'SELECT data_text FROM implicit_data WHERE question_id = $1';
  const sqlSolutions = 'SELECT solution_text FROM solutions WHERE question_id = $1';
  const sqlMathematicalSolutions = 'SELECT solution_text FROM mathematical_solutions WHERE question_id = $1';
  const sqlConcepts = `
    SELECT c.*
    FROM concepts c
    JOIN questions_concepts qc ON c.id = qc.concept_id
    WHERE qc.question_id = $1
  `;

  try {
    const user = await getOptionalUser(req);
    const questionResult = await pool.query(sqlQuestion, [questionId]);
    if (questionResult.rows.length === 0) {
      return res.status(404).json({ error: 'Question not found' });
    }
    const question = questionResult.rows[0];

    if (!question.published) {
      const canView = user?.isInstructor
        && await instructorOwnsCourseCode(user.email, question.course_code);
      if (!canView) {
        return res.status(404).json({ error: 'Question not found' });
      }
    }

    const [
      resultExplicitData,
      resultImplicitData,
      resultSolutions,
      resultMathematicalSolutions,
      resultConcepts,
    ] = await Promise.all([
      pool.query(sqlExplicitData, [questionId]),
      pool.query(sqlImplicitData, [questionId]),
      pool.query(sqlSolutions, [questionId]),
      pool.query(sqlMathematicalSolutions, [questionId]),
      pool.query(sqlConcepts, [questionId]),
    ]);

    const fullQuestion = {
      id: question.id.toString(),
      courseCode: question.course_code,
      questionText: question.question_text,
      explicitData: resultExplicitData.rows.map((row) => row.data_text),
      implicitData: resultImplicitData.rows.map((row) => row.data_text),
      goal: question.goal,
      solution: resultSolutions.rows.map((row) => row.solution_text),
      mathematicalSolution: resultMathematicalSolutions.rows.map((row) => row.solution_text),
      concepts: resultConcepts.rows,
      published: question.published,
      display_order: question.display_order,
      figureDescription: question.figure_description || null,
    };
    res.json({ question: fullQuestion });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
