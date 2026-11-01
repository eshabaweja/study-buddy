import express from 'express';
import pool from '../db/database.js';
import { requireInstructor } from '../middleware/auth.js';
import {
  assertOwnedCourseByCode,
  sendCourseAccessError,
} from '../db/courseOwnership.js';

const router = express.Router();

const CONCEPT_ORDER = 'ORDER BY cc.display_order ASC, cc.cc_id ASC';

function conceptsSelectSql(extraWhere = '') {
  return `
    SELECT con.*, cc.display_order, cc.cc_id
    FROM courses_concepts cc
    JOIN concepts con ON cc.concept_id = con.id
    WHERE cc.course_id = $1${extraWhere}
    ${CONCEPT_ORDER}
  `;
}

// Get concepts associated with a course by its code
router.get('/courses/:courseCode/concepts', (req, res) => {
  const { courseCode } = req.params;
  const sqlCourse = 'SELECT id FROM courses WHERE code = $1';
  pool.query(sqlCourse, [courseCode], (err, result) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Course not found' });
      return;
    }
    const courseId = result.rows[0].id;
    pool.query(conceptsSelectSql(), [courseId], (err2, result2) => {
      if (err2) {
        res.status(500).json({ error: err2.message });
        return;
      }
      res.json({ concepts: result2.rows });
    });
  });
});

router.put('/reorder', requireInstructor, async (req, res) => {
  const { course_code, concept_ids } = req.body;
  if (!course_code || !Array.isArray(concept_ids) || concept_ids.length === 0) {
    return res.status(400).json({ error: 'course_code and concept_ids array are required' });
  }
  const client = await pool.connect();
  try {
    const course = await assertOwnedCourseByCode(course_code, req.user.email);
    await client.query('BEGIN');
    for (let i = 0; i < concept_ids.length; i++) {
      await client.query(
        `UPDATE courses_concepts SET display_order = $1
         WHERE course_id = $2 AND concept_id = $3`,
        [i, course.id, concept_ids[i]],
      );
    }
    await client.query('COMMIT');
    const result = await pool.query(conceptsSelectSql(), [course.id]);
    res.json({ concepts: result.rows });
  } catch (err) {
    await client.query('ROLLBACK');
    if (!sendCourseAccessError(res, err)) {
      res.status(400).json({ error: err.message });
    }
  } finally {
    client.release();
  }
});

// Get all courses_concepts entries with course codes
router.get('/', (req, res) => {
  const sql = `
    SELECT cc.cc_id, cc.display_order, c.code as course_code, c.title as course_title, 
           con.id as concept_id, con.name as concept_name, con.description as concept_description
    FROM courses_concepts cc
    JOIN courses c ON cc.course_id = c.id
    JOIN concepts con ON cc.concept_id = con.id
    ORDER BY c.code, cc.display_order ASC, cc.cc_id ASC
  `;
  pool.query(sql, [], (err, result) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ courses_concepts: result.rows });
  });
});

// Add a new courses_concepts entry using course_code
router.post('/', requireInstructor, async (req, res) => {
  const { course_code, concept_id } = req.body;

  if (!course_code || !concept_id) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const course = await assertOwnedCourseByCode(course_code, req.user.email);
    const orderResult = await pool.query(
      'SELECT COALESCE(MAX(display_order), -1) + 1 AS next_order FROM courses_concepts WHERE course_id = $1',
      [course.id],
    );
    const displayOrder = orderResult.rows[0].next_order;

    const sql = 'INSERT INTO courses_concepts (course_id, concept_id, display_order) VALUES ($1, $2, $3) RETURNING cc_id';
    const result = await pool.query(sql, [course.id, concept_id, displayOrder]);
    res.status(201).json({ cc_id: result.rows[0].cc_id });
  } catch (err) {
    if (!sendCourseAccessError(res, err)) {
      console.error('Error associating concept with course:', err);
      res.status(500).json({ error: err.message });
    }
  }
});

// Get concepts for a specific course by course_code
router.get('/:course_code', (req, res) => {
  if (req.params.course_code === 'reorder') {
    return res.status(404).json({ error: 'Not found' });
  }
  const sqlCourse = 'SELECT id FROM courses WHERE code = $1';
  pool.query(sqlCourse, [req.params.course_code], (err, courseResult) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (courseResult.rows.length === 0) {
      res.status(404).json({ error: 'Course not found' });
      return;
    }
    pool.query(conceptsSelectSql(), [courseResult.rows[0].id], (err2, result) => {
      if (err2) {
        res.status(500).json({ error: err2.message });
        return;
      }
      res.json({ concepts: result.rows });
    });
  });
});

export default router;
