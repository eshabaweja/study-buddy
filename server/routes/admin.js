import express from 'express';
import pool from '../db/database.js';
import { requireAdmin } from '../middleware/admin.js';
import { requireInstructor } from '../middleware/auth.js';
import { assertOwnedCourseById, sendCourseAccessError } from '../db/courseOwnership.js';
import { inlineQuestionImagesForCopy } from '../utils/inlineQuestionImages.js';

const router = express.Router();

async function copyQuestion(client, oldQuestionId, newCourseCode, newCourseId) {
  const inlined = await inlineQuestionImagesForCopy(client, oldQuestionId);
  const qRes = await client.query(
    'SELECT goal, figure_description, figure_images_hash FROM questions WHERE id = $1',
    [oldQuestionId],
  );
  if (qRes.rows.length === 0) return null;

  const { goal, figure_description, figure_images_hash } = qRes.rows[0];
  const ins = await client.query(
    `INSERT INTO questions (
       course_code, question_text, goal, course_id,
       figure_description, figure_images_hash
     )
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [
      newCourseCode,
      inlined.question_text,
      goal,
      newCourseId,
      figure_description,
      figure_images_hash,
    ],
  );
  const newId = ins.rows[0].id;

  const childTables = [
    { table: 'explicit_data', col: 'data_text' },
    { table: 'implicit_data', col: 'data_text' },
  ];

  for (const { table, col } of childTables) {
    const rows = await client.query(
      `SELECT ${col} FROM ${table} WHERE question_id = $1`,
      [oldQuestionId],
    );
    for (const row of rows.rows) {
      await client.query(
        `INSERT INTO ${table} (question_id, ${col}) VALUES ($1, $2)`,
        [newId, row[col]],
      );
    }
  }

  if (inlined.solution_text.trim()) {
    await client.query(
      'INSERT INTO solutions (question_id, solution_text) VALUES ($1, $2)',
      [newId, inlined.solution_text],
    );
  }

  if (inlined.math_solution_text.trim()) {
    await client.query(
      'INSERT INTO mathematical_solutions (question_id, solution_text) VALUES ($1, $2)',
      [newId, inlined.math_solution_text],
    );
  }

  const conceptRows = await client.query(
    'SELECT concept_id FROM questions_concepts WHERE question_id = $1',
    [oldQuestionId],
  );
  for (const row of conceptRows.rows) {
    await client.query(
      `INSERT INTO questions_concepts (question_id, concept_id)
       VALUES ($1, $2) ON CONFLICT (question_id, concept_id) DO NOTHING`,
      [newId, row.concept_id],
    );
  }

  return newId;
}

router.patch('/users/:email/instructor', requireAdmin, async (req, res) => {
  const email = decodeURIComponent(req.params.email);
  const { is_instructor } = req.body;

  if (typeof is_instructor !== 'boolean') {
    return res.status(400).json({ error: 'is_instructor boolean is required' });
  }

  try {
    const result = await pool.query(
      `UPDATE users SET is_instructor = $1 WHERE email = $2
       RETURNING email, full_name, is_instructor`,
      [is_instructor, email],
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ user: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/enrollments', requireAdmin, async (req, res) => {
  const { user_email, course_id } = req.body;

  if (!user_email || !course_id) {
    return res.status(400).json({ error: 'user_email and course_id are required' });
  }

  try {
    const userCheck = await pool.query(
      'SELECT email FROM users WHERE email = $1 AND is_instructor = false',
      [user_email],
    );
    if (userCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Student not found' });
    }

    const courseResult = await pool.query(
      'SELECT id, code FROM courses WHERE id = $1',
      [course_id],
    );
    if (courseResult.rows.length === 0) {
      return res.status(404).json({ error: 'Course not found' });
    }

    const { code } = courseResult.rows[0];
    const result = await pool.query(
      `INSERT INTO student_courses (user_email, course_code, course_id)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_email, course_id) DO NOTHING
       RETURNING id`,
      [user_email, code, course_id],
    );

    res.status(201).json({ id: result.rows[0]?.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete(
  '/courses/:courseId/enrollments/:studentEmail',
  requireAdmin,
  async (req, res) => {
    const courseId = parseInt(req.params.courseId, 10);
    const studentEmail = decodeURIComponent(req.params.studentEmail);

    if (Number.isNaN(courseId)) {
      return res.status(400).json({ error: 'Invalid course id' });
    }

    try {
      const result = await pool.query(
        `DELETE FROM student_courses
         WHERE course_id = $1 AND user_email = $2
         RETURNING id`,
        [courseId, studentEmail],
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Enrollment not found' });
      }
      res.status(204).send();
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
);

router.post('/courses/copy', requireAdmin, async (req, res) => {
  const {
    source_course_id,
    new_code,
    new_title,
    instructor_email,
  } = req.body;

  if (!source_course_id || !new_code || !new_title || !instructor_email) {
    return res.status(400).json({
      error: 'source_course_id, new_code, new_title, and instructor_email are required',
    });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const ownerCheck = await client.query(
      'SELECT email FROM users WHERE email = $1 AND is_instructor = true',
      [instructor_email],
    );
    if (ownerCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Target instructor not found' });
    }

    const src = await client.query('SELECT * FROM courses WHERE id = $1', [
      source_course_id,
    ]);
    if (src.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Source course not found' });
    }
    const source = src.rows[0];

    const newCourse = await client.query(
      `INSERT INTO courses (code, title, published, instructor_email)
       VALUES ($1, $2, false, $3) RETURNING id, code, title`,
      [new_code, new_title, instructor_email],
    );
    const newCourseId = newCourse.rows[0].id;
    const newCode = newCourse.rows[0].code;

    const concepts = await client.query(
      'SELECT concept_id FROM courses_concepts WHERE course_id = $1',
      [source_course_id],
    );
    for (const row of concepts.rows) {
      await client.query(
        'INSERT INTO courses_concepts (course_id, concept_id) VALUES ($1, $2)',
        [newCourseId, row.concept_id],
      );
    }

    const images = await client.query(
      'SELECT image_url, display_order FROM course_images WHERE course_id = $1',
      [source_course_id],
    );
    for (const img of images.rows) {
      await client.query(
        `INSERT INTO course_images (course_code, course_id, image_url, display_order)
         VALUES ($1, $2, $3, $4)`,
        [newCode, newCourseId, img.image_url, img.display_order],
      );
    }

    const questions = await client.query(
      'SELECT id FROM questions WHERE course_id = $1 ORDER BY id',
      [source_course_id],
    );
    for (const q of questions.rows) {
      await copyQuestion(client, q.id, newCode, newCourseId);
    }

    await client.query('COMMIT');
    res.status(201).json({ course: newCourse.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505') {
      return res.status(409).json({
        error: 'A course with this code already exists for that instructor',
      });
    }
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

router.get('/courses', requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT c.*, u.full_name AS instructor_name
       FROM courses c
       LEFT JOIN users u ON c.instructor_email = u.email
       ORDER BY c.code, c.instructor_email`,
    );
    res.json({ courses: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/courses/:courseId', requireAdmin, async (req, res) => {
  const courseId = parseInt(req.params.courseId, 10);

  if (Number.isNaN(courseId)) {
    return res.status(400).json({ error: 'Invalid course id' });
  }

  try {
    const result = await pool.query(
      'DELETE FROM courses WHERE id = $1 RETURNING id, code, title',
      [courseId],
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Course not found' });
    }
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete(
  '/instructor/courses/:courseId/enrollments/:studentEmail',
  requireInstructor,
  async (req, res) => {
    const courseId = parseInt(req.params.courseId, 10);
    const studentEmail = decodeURIComponent(req.params.studentEmail);

    if (Number.isNaN(courseId)) {
      return res.status(400).json({ error: 'Invalid course id' });
    }

    try {
      await assertOwnedCourseById(courseId, req.user.email);
      const result = await pool.query(
        `DELETE FROM student_courses
         WHERE course_id = $1 AND user_email = $2
         RETURNING id`,
        [courseId, studentEmail],
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Enrollment not found' });
      }
      res.status(204).send();
    } catch (err) {
      if (!sendCourseAccessError(res, err)) {
        res.status(500).json({ error: err.message });
      }
    }
  },
);

export default router;
