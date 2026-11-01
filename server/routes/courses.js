import express from 'express';
import pool from '../db/database.js';
import { requireInstructor } from '../middleware/auth.js';
import {
  assertOwnedCourseByCode,
  sendCourseAccessError,
} from '../db/courseOwnership.js';

const router = express.Router();

const COURSE_WITH_INSTRUCTOR_SELECT = `
  SELECT c.*, u.full_name AS instructor_name
  FROM courses c
  LEFT JOIN users u ON c.instructor_email = u.email
`;

// Get all courses (public listing; use ?published=true for students)
router.get('/', (req, res) => {
  const { published } = req.query;
  let sql = COURSE_WITH_INSTRUCTOR_SELECT;
  let params = [];

  if (published !== undefined) {
    const isPublished = published === 'true';
    sql += ' WHERE c.published = $1';
    params.push(isPublished);
  }

  pool.query(sql, params, (err, result) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ courses: result.rows });
  });
});

// Instructor's own courses only
router.get('/mine', requireInstructor, (req, res) => {
  const sql = `${COURSE_WITH_INSTRUCTOR_SELECT} WHERE c.instructor_email = $1 ORDER BY c.code ASC`;
  pool.query(sql, [req.user.email], (err, result) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ courses: result.rows });
  });
});

const DUPLICATE_COURSE_OFFERING_MSG =
  'You already have a course with this code. Edit that course or pick a different code.';

router.post('/', requireInstructor, (req, res) => {
  const { code, title } = req.body;
  if (!code || !title) {
    return res.status(400).json({ error: 'code and title are required' });
  }
  const sql =
    'INSERT INTO courses (code, title, instructor_email) VALUES ($1, $2, $3) RETURNING id';
  const params = [code, title, req.user.email];
  pool.query(sql, params, (err, result) => {
    if (err) {
      if (err.code === '23505') {
        const c = err.constraint || '';
        if (
          c === 'courses_code_instructor_email_key' ||
          (typeof err.detail === 'string' && err.detail.includes('(code, instructor_email)'))
        ) {
          return res.status(409).json({ error: DUPLICATE_COURSE_OFFERING_MSG });
        }
      }
      res.status(400).json({ error: err.message });
      return;
    }
    res.json({ id: result.rows[0].id });
  });
});

router.patch('/:courseCode/publish', requireInstructor, async (req, res) => {
  const { courseCode } = req.params;
  const { published } = req.body;

  if (typeof published !== 'boolean') {
    return res.status(400).json({ error: 'Published must be a boolean value' });
  }

  try {
    await assertOwnedCourseByCode(courseCode, req.user.email);
    const sql =
      'UPDATE courses SET published = $1 WHERE code = $2 AND instructor_email = $3 RETURNING id, code, title, published';
    const result = await pool.query(sql, [published, courseCode, req.user.email]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Course not found' });
    }

    res.json({
      message: `Course ${published ? 'published' : 'unpublished'} successfully`,
      course: result.rows[0],
    });
  } catch (err) {
    if (!sendCourseAccessError(res, err)) {
      res.status(500).json({ error: err.message });
    }
  }
});

router.delete('/:courseCode', requireInstructor, async (req, res) => {
  const { courseCode } = req.params;

  try {
    await assertOwnedCourseByCode(courseCode, req.user.email);
    const sql =
      'DELETE FROM courses WHERE code = $1 AND instructor_email = $2 RETURNING id, code, title';
    const result = await pool.query(sql, [courseCode, req.user.email]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Course not found' });
    }

    res.json({
      message: 'Course deleted successfully',
      course: result.rows[0],
    });
  } catch (err) {
    if (!sendCourseAccessError(res, err)) {
      res.status(500).json({ error: err.message });
    }
  }
});

router.get('/:courseCode', (req, res) => {
  const { courseCode } = req.params;
  const sql = `${COURSE_WITH_INSTRUCTOR_SELECT} WHERE c.code = $1`;
  const params = [courseCode];

  pool.query(sql, params, (err, result) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Course not found' });
      return;
    }

    res.json({
      course: result.rows[0],
      courses: result.rows,
    });
  });
});

export default router;
