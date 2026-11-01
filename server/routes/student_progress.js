import express from 'express';
import pool from '../db/database.js';
import { requireStudent } from '../middleware/auth.js';

const router = express.Router();

router.get('/courses', requireStudent, async (req, res) => {
  const userEmail = req.user.email;

  try {
    const sql = `
      SELECT c.*, u.full_name AS instructor_name
      FROM courses c
      JOIN student_courses sc ON c.id = sc.course_id
      LEFT JOIN users u ON c.instructor_email = u.email
      WHERE sc.user_email = $1
      ORDER BY sc.created_at DESC
    `;
    const result = await pool.query(sql, [userEmail]);
    res.json({ courses: result.rows });
  } catch (err) {
    console.error('Error fetching student courses:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/courses/id/:courseId', requireStudent, async (req, res) => {
  const courseId = parseInt(req.params.courseId, 10);
  const userEmail = req.user.email;

  if (Number.isNaN(courseId)) {
    return res.status(400).json({ error: 'Invalid course id' });
  }

  try {
    const courseResult = await pool.query(
      'SELECT id, code, published FROM courses WHERE id = $1',
      [courseId],
    );
    if (courseResult.rows.length === 0) {
      return res.status(404).json({ error: 'Course not found' });
    }
    if (!courseResult.rows[0].published) {
      return res.status(400).json({ error: 'Course is not published' });
    }

    const sql = `
      INSERT INTO student_courses (user_email, course_code, course_id)
      VALUES ($1, $2, $3)
      ON CONFLICT (user_email, course_id) DO NOTHING
      RETURNING id
    `;
    const { code } = courseResult.rows[0];
    const result = await pool.query(sql, [userEmail, code, courseId]);
    res.status(201).json({ id: result.rows[0]?.id });
  } catch (err) {
    console.error('Error adding course to student dashboard:', err);
    res.status(500).json({ error: err.message });
  }
});

router.delete('/courses/id/:courseId', requireStudent, async (req, res) => {
  const courseId = parseInt(req.params.courseId, 10);
  const userEmail = req.user.email;

  if (Number.isNaN(courseId)) {
    return res.status(400).json({ error: 'Invalid course id' });
  }

  try {
    const sql =
      'DELETE FROM student_courses WHERE user_email = $1 AND course_id = $2';
    await pool.query(sql, [userEmail, courseId]);
    res.status(204).send();
  } catch (err) {
    console.error('Error removing course from student dashboard:', err);
    res.status(500).json({ error: err.message });
  }
});

// Legacy: enroll by course code (uses first published match — prefer course id)
router.post('/courses/:courseCode', requireStudent, async (req, res) => {
  const { courseCode } = req.params;
  const userEmail = req.user.email;

  try {
    const courseResult = await pool.query(
      'SELECT id, code FROM courses WHERE code = $1 AND published = true ORDER BY id LIMIT 1',
      [courseCode],
    );
    if (courseResult.rows.length === 0) {
      return res.status(404).json({ error: 'Course not found' });
    }
    const { id: courseId, code } = courseResult.rows[0];

    const sql = `
      INSERT INTO student_courses (user_email, course_code, course_id)
      VALUES ($1, $2, $3)
      ON CONFLICT (user_email, course_id) DO NOTHING
      RETURNING id
    `;
    const result = await pool.query(sql, [userEmail, code, courseId]);
    res.status(201).json({ id: result.rows[0]?.id });
  } catch (err) {
    console.error('Error adding course to student dashboard:', err);
    res.status(500).json({ error: err.message });
  }
});

router.delete('/courses/:courseCode', requireStudent, async (req, res) => {
  const { courseCode } = req.params;
  const userEmail = req.user.email;

  try {
    const sql = `
      DELETE FROM student_courses sc
      USING courses c
      WHERE sc.course_id = c.id
        AND sc.user_email = $1
        AND c.code = $2
    `;
    await pool.query(sql, [userEmail, courseCode]);
    res.status(204).send();
  } catch (err) {
    console.error('Error removing course from student dashboard:', err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/questions', requireStudent, async (req, res) => {
  const userEmail = req.user.email;

  try {
    const sql = `
      SELECT q.* 
      FROM questions q
      JOIN student_questions sq ON q.id = sq.question_id
      WHERE sq.user_email = $1
      ORDER BY sq.solved_at DESC
    `;
    const result = await pool.query(sql, [userEmail]);
    res.json({ questions: result.rows });
  } catch (err) {
    console.error('Error fetching solved questions:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/questions/:questionId', requireStudent, async (req, res) => {
  const { questionId } = req.params;
  const userEmail = req.user.email;

  try {
    const questionCheck = await pool.query('SELECT id FROM questions WHERE id = $1', [questionId]);
    if (questionCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Question not found' });
    }

    const sql = `
      INSERT INTO student_questions (user_email, question_id)
      VALUES ($1, $2)
      ON CONFLICT (user_email, question_id) DO NOTHING
      RETURNING id
    `;
    const result = await pool.query(sql, [userEmail, questionId]);
    res.status(201).json({ id: result.rows[0]?.id });
  } catch (err) {
    console.error('Error marking question as solved:', err);
    res.status(500).json({ error: err.message });
  }
});

router.delete('/questions/:questionId', requireStudent, async (req, res) => {
  const { questionId } = req.params;
  const userEmail = req.user.email;

  try {
    const sql = `
      DELETE FROM student_questions 
      WHERE user_email = $1 AND question_id = $2
      RETURNING id
    `;
    const result = await pool.query(sql, [userEmail, questionId]);
    res.json({ id: result.rows[0]?.id });
  } catch (err) {
    console.error('Error marking question as unsolved:', err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/questions/:questionId', requireStudent, async (req, res) => {
  const { questionId } = req.params;
  const userEmail = req.user.email;

  try {
    const sql = `
      SELECT EXISTS (
        SELECT 1 FROM student_questions 
        WHERE user_email = $1 AND question_id = $2
      ) as is_solved
    `;
    const result = await pool.query(sql, [userEmail, questionId]);
    res.json({ isSolved: result.rows[0].is_solved });
  } catch (err) {
    console.error('Error checking question status:', err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/starred_questions', requireStudent, async (req, res) => {
  const userEmail = req.user.email;

  try {
    const sql = `
      SELECT q.* 
      FROM questions q
      JOIN student_starred_questions ssq ON q.id = ssq.question_id
      WHERE ssq.user_email = $1
      ORDER BY ssq.starred_at DESC
    `;
    const result = await pool.query(sql, [userEmail]);
    res.json({ questions: result.rows });
  } catch (err) {
    console.error('Error fetching starred questions:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/starred_questions/:questionId', requireStudent, async (req, res) => {
  const { questionId } = req.params;
  const userEmail = req.user.email;

  try {
    const questionCheck = await pool.query('SELECT id FROM questions WHERE id = $1', [questionId]);
    if (questionCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Question not found' });
    }

    const sql = `
      INSERT INTO student_starred_questions (user_email, question_id)
      VALUES ($1, $2)
      ON CONFLICT (user_email, question_id) DO NOTHING
      RETURNING id
    `;
    const result = await pool.query(sql, [userEmail, questionId]);
    res.status(201).json({ id: result.rows[0]?.id });
  } catch (err) {
    console.error('Error starring question:', err);
    res.status(500).json({ error: err.message });
  }
});

router.delete('/starred_questions/:questionId', requireStudent, async (req, res) => {
  const { questionId } = req.params;
  const userEmail = req.user.email;

  try {
    const sql = `
      DELETE FROM student_starred_questions 
      WHERE user_email = $1 AND question_id = $2
      RETURNING id
    `;
    const result = await pool.query(sql, [userEmail, questionId]);
    res.json({ id: result.rows[0]?.id });
  } catch (err) {
    console.error('Error unstarring question:', err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/starred_questions/:questionId', requireStudent, async (req, res) => {
  const { questionId } = req.params;
  const userEmail = req.user.email;

  try {
    const sql = `
      SELECT EXISTS (
        SELECT 1 FROM student_starred_questions 
        WHERE user_email = $1 AND question_id = $2
      ) as is_starred
    `;
    const result = await pool.query(sql, [userEmail, questionId]);
    res.json({ isStarred: result.rows[0].is_starred });
  } catch (err) {
    console.error('Error checking question star status:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
