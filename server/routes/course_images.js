import express from 'express';
import pool from '../db/database.js';
import { requireInstructor } from '../middleware/auth.js';
import {
  assertOwnedCourseByCode,
  assertCourseImageOwnedByInstructor,
  sendCourseAccessError,
} from '../db/courseOwnership.js';

const router = express.Router();

router.get('/:courseCode', async (req, res) => {
  const { courseCode } = req.params;

  try {
    const sql = `
      SELECT * FROM course_images 
      WHERE course_code = $1 
      ORDER BY display_order ASC, created_at ASC
    `;
    const result = await pool.query(sql, [courseCode]);
    res.json({ images: result.rows });
  } catch (err) {
    console.error('Error fetching course images:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/', requireInstructor, async (req, res) => {
  const { course_code, image_url, display_order } = req.body;

  if (!course_code || !image_url) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const course = await assertOwnedCourseByCode(course_code, req.user.email);

    const sql = `
      INSERT INTO course_images (course_code, course_id, image_url, display_order) 
      VALUES ($1, $2, $3, $4) 
      RETURNING id
    `;
    const params = [course_code, course.id, image_url, display_order || 0];

    const result = await pool.query(sql, params);
    res.status(201).json({ id: result.rows[0].id });
  } catch (err) {
    if (!sendCourseAccessError(res, err)) {
      console.error('Error adding course image:', err);
      res.status(500).json({ error: err.message });
    }
  }
});

router.delete('/:id', requireInstructor, async (req, res) => {
  const { id } = req.params;

  try {
    await assertCourseImageOwnedByInstructor(id, req.user.email);
    const sql = 'DELETE FROM course_images WHERE id = $1 RETURNING id';
    const result = await pool.query(sql, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Image not found' });
    }

    res.json({ message: 'Image deleted successfully' });
  } catch (err) {
    if (!sendCourseAccessError(res, err)) {
      console.error('Error deleting course image:', err);
      res.status(500).json({ error: err.message });
    }
  }
});

export default router;
