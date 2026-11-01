import pool from './database.js';

export class CourseAccessError extends Error {
  constructor(message = 'Course not found or access denied', status = 403) {
    super(message);
    this.name = 'CourseAccessError';
    this.status = status;
  }
}

export async function getOwnedCourseByCode(courseCode, instructorEmail) {
  const result = await pool.query(
    'SELECT * FROM courses WHERE code = $1 AND instructor_email = $2',
    [courseCode, instructorEmail],
  );
  return result.rows[0] || null;
}

export async function getOwnedCourseById(courseId, instructorEmail) {
  const result = await pool.query(
    'SELECT * FROM courses WHERE id = $1 AND instructor_email = $2',
    [courseId, instructorEmail],
  );
  return result.rows[0] || null;
}

export async function assertOwnedCourseByCode(courseCode, instructorEmail) {
  const course = await getOwnedCourseByCode(courseCode, instructorEmail);
  if (!course) {
    throw new CourseAccessError();
  }
  return course;
}

export async function assertOwnedCourseById(courseId, instructorEmail) {
  const course = await getOwnedCourseById(courseId, instructorEmail);
  if (!course) {
    throw new CourseAccessError();
  }
  return course;
}

export async function assertQuestionOwnedByInstructor(questionId, instructorEmail) {
  const result = await pool.query(
    `SELECT q.id
     FROM questions q
     JOIN courses c ON q.course_id = c.id
     WHERE q.id = $1 AND c.instructor_email = $2`,
    [questionId, instructorEmail],
  );
  if (result.rows.length === 0) {
    throw new CourseAccessError('Question not found or access denied');
  }
}

export async function assertCourseImageOwnedByInstructor(imageId, instructorEmail) {
  const result = await pool.query(
    `SELECT ci.id
     FROM course_images ci
     JOIN courses c ON ci.course_id = c.id
     WHERE ci.id = $1 AND c.instructor_email = $2`,
    [imageId, instructorEmail],
  );
  if (result.rows.length === 0) {
    throw new CourseAccessError('Image not found or access denied');
  }
}

export function sendCourseAccessError(res, err) {
  if (err instanceof CourseAccessError) {
    res.status(err.status).json({ error: err.message });
    return true;
  }
  return false;
}
