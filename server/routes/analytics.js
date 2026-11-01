import express from 'express';
import pool from '../db/database.js';
import { requireInstructorOrAdmin } from '../middleware/auth.js';

const router = express.Router();

router.use(requireInstructorOrAdmin);

function isAdmin(req) {
  return Boolean(req.user?.isAdmin);
}

// Get all courses with analytics data
router.get('/courses', async (req, res) => {
  try {
    const params = [];
    let ownershipClause = '';
    if (!isAdmin(req)) {
      ownershipClause = 'WHERE c.instructor_email = $1';
      params.push(req.user.email);
    }

    const result = await pool.query(
      `SELECT 
         c.id,
         c.code,
         c.title,
         c.published,
         c.instructor_email,
         u.full_name AS instructor_name,
         COALESCE(COUNT(DISTINCT sc.user_email), 0) as total_enrollments,
         COALESCE(COUNT(DISTINCT q.id), 0) as total_questions
       FROM courses c
       LEFT JOIN users u ON c.instructor_email = u.email
       LEFT JOIN student_courses sc ON c.id = sc.course_id
       LEFT JOIN questions q ON c.id = q.course_id
       ${ownershipClause}
       GROUP BY c.id, c.code, c.title, c.published, c.instructor_email, u.full_name
       ORDER BY c.code, c.instructor_email`,
      params,
    );
    res.json({ courses: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all students with analytics data
router.get('/students', async (req, res) => {
  try {
    const params = [];
    let enrollmentJoin = `
      LEFT JOIN (
        SELECT user_email, COUNT(*) as courses_enrolled
        FROM student_courses
        GROUP BY user_email
      ) sc_counts ON u.email = sc_counts.user_email
    `;
    let solvedJoin = `
      LEFT JOIN (
        SELECT user_email, COUNT(*) as questions_solved
        FROM student_questions
        GROUP BY user_email
      ) sq_counts ON u.email = sq_counts.user_email
    `;
    let starredJoin = `
      LEFT JOIN (
        SELECT user_email, COUNT(*) as questions_starred
        FROM student_starred_questions
        GROUP BY user_email
      ) ssq_counts ON u.email = ssq_counts.user_email
    `;
    let whereClause = 'WHERE u.is_instructor = false';

    if (!isAdmin(req)) {
      params.push(req.user.email);
      enrollmentJoin = `
        INNER JOIN (
          SELECT sc.user_email, COUNT(*) as courses_enrolled
          FROM student_courses sc
          JOIN courses c ON sc.course_id = c.id
          WHERE c.instructor_email = $1
          GROUP BY sc.user_email
        ) sc_counts ON u.email = sc_counts.user_email
      `;
      solvedJoin = `
        LEFT JOIN (
          SELECT sq.user_email, COUNT(*) as questions_solved
          FROM student_questions sq
          JOIN questions q ON sq.question_id = q.id
          JOIN courses c ON q.course_id = c.id
          WHERE c.instructor_email = $1
          GROUP BY sq.user_email
        ) sq_counts ON u.email = sq_counts.user_email
      `;
      starredJoin = `
        LEFT JOIN (
          SELECT ssq.user_email, COUNT(*) as questions_starred
          FROM student_starred_questions ssq
          JOIN questions q ON ssq.question_id = q.id
          JOIN courses c ON q.course_id = c.id
          WHERE c.instructor_email = $1
          GROUP BY ssq.user_email
        ) ssq_counts ON u.email = ssq_counts.user_email
      `;
      whereClause = 'WHERE u.is_instructor = false';
    }

    const result = await pool.query(
      `SELECT 
         u.email,
         u.full_name,
         COALESCE(sc_counts.courses_enrolled, 0) as courses_enrolled,
         COALESCE(sq_counts.questions_solved, 0) as questions_solved,
         COALESCE(ssq_counts.questions_starred, 0) as questions_starred
       FROM users u
       ${enrollmentJoin}
       ${solvedJoin}
       ${starredJoin}
       ${whereClause}
       ORDER BY u.full_name`,
      params,
    );
    res.json({ students: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get course detail analytics (param is numeric course id or course code)
router.get('/courses/:courseIdOrCode', async (req, res) => {
  const { courseIdOrCode } = req.params;
  const byId = /^\d+$/.test(courseIdOrCode);

  try {
    const params = [courseIdOrCode];
    let ownershipClause = '';
    if (!isAdmin(req)) {
      params.push(req.user.email);
      ownershipClause = 'AND c.instructor_email = $2';
    }

    const courseSql = `
      SELECT 
        c.id,
        c.code,
        c.title,
        c.published,
        c.instructor_email,
        (SELECT COUNT(*) FROM questions WHERE course_id = c.id) as total_questions,
        (SELECT COUNT(DISTINCT user_email) FROM student_courses WHERE course_id = c.id) as total_enrollments
      FROM courses c
      WHERE ${byId ? 'c.id = $1' : 'c.code = $1'}
      ${ownershipClause}
      ORDER BY c.id
      LIMIT 1
    `;

    const courseResult = await pool.query(courseSql, params);
    if (courseResult.rows.length === 0) {
      return res.status(404).json({ error: 'Course not found' });
    }

    const course = courseResult.rows[0];
    const totalQuestions = parseInt(course.total_questions, 10) || 0;
    const courseId = course.id;

    const studentsSql = `
      SELECT 
        u.email,
        u.full_name,
        sc.created_at as enrolled_at,
        COALESCE(sq_counts.solved_count, 0) as solved_count,
        COALESCE(ssq_counts.starred_count, 0) as starred_count
      FROM student_courses sc
      JOIN users u ON sc.user_email = u.email
      LEFT JOIN (
        SELECT sq.user_email, COUNT(*) as solved_count
        FROM student_questions sq
        JOIN questions q ON sq.question_id = q.id
        WHERE q.course_id = $1
        GROUP BY sq.user_email
      ) sq_counts ON sc.user_email = sq_counts.user_email
      LEFT JOIN (
        SELECT ssq.user_email, COUNT(*) as starred_count
        FROM student_starred_questions ssq
        JOIN questions q ON ssq.question_id = q.id
        WHERE q.course_id = $1
        GROUP BY ssq.user_email
      ) ssq_counts ON sc.user_email = ssq_counts.user_email
      WHERE sc.course_id = $1
      ORDER BY u.full_name
    `;

    const studentsResult = await pool.query(studentsSql, [courseId]);

    const students = studentsResult.rows.map((student) => {
      const solvedCount = parseInt(student.solved_count, 10) || 0;
      const unsolvedCount = totalQuestions - solvedCount;
      const progressPercentage =
        totalQuestions > 0 ? Math.round((solvedCount / totalQuestions) * 100) : 0;

      return {
        email: student.email,
        name: student.full_name,
        enrolled_at: student.enrolled_at,
        solved_count: solvedCount,
        starred_count: parseInt(student.starred_count, 10) || 0,
        unsolved_count: unsolvedCount,
        total_questions: totalQuestions,
        progress_percentage: progressPercentage,
        is_active: false,
      };
    });

    res.json({
      course: {
        id: course.id,
        code: course.code,
        title: course.title,
        published: course.published,
        instructor_email: course.instructor_email,
      },
      total_questions: totalQuestions,
      total_enrollments: parseInt(course.total_enrollments, 10) || 0,
      students,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get student detail analytics
router.get('/students/:studentEmail', async (req, res) => {
  const { studentEmail } = req.params;

  try {
    const studentResult = await pool.query(
      `SELECT email, full_name
       FROM users
       WHERE email = $1 AND is_instructor = false`,
      [studentEmail],
    );

    if (studentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Student not found' });
    }

    const student = studentResult.rows[0];
    const courseParams = [studentEmail];
    let ownershipClause = '';
    if (!isAdmin(req)) {
      courseParams.push(req.user.email);
      ownershipClause = 'AND c.instructor_email = $2';
    }

    const coursesResult = await pool.query(
      `SELECT 
         c.id,
         c.code,
         c.title,
         sc.created_at as enrolled_at,
         (SELECT COUNT(*) FROM questions WHERE course_id = c.id) as total_questions,
         COALESCE(solved_counts.solved_count, 0) as solved_count,
         COALESCE(starred_counts.starred_count, 0) as starred_count
       FROM student_courses sc
       JOIN courses c ON sc.course_id = c.id
       LEFT JOIN (
         SELECT 
           q.course_id,
           COUNT(*) as solved_count
         FROM student_questions sq
         JOIN questions q ON sq.question_id = q.id
         WHERE sq.user_email = $1
         GROUP BY q.course_id
       ) solved_counts ON c.id = solved_counts.course_id
       LEFT JOIN (
         SELECT 
           q.course_id,
           COUNT(*) as starred_count
         FROM student_starred_questions ssq
         JOIN questions q ON ssq.question_id = q.id
         WHERE ssq.user_email = $1
         GROUP BY q.course_id
       ) starred_counts ON c.id = starred_counts.course_id
       WHERE sc.user_email = $1
       ${ownershipClause}
       ORDER BY sc.created_at DESC`,
      courseParams,
    );

    if (!isAdmin(req) && coursesResult.rows.length === 0) {
      return res.status(404).json({ error: 'Student not found' });
    }

    const courses = coursesResult.rows.map((course) => {
      const totalQuestions = parseInt(course.total_questions, 10) || 0;
      const solvedCount = parseInt(course.solved_count, 10) || 0;
      const starredCount = parseInt(course.starred_count, 10) || 0;
      const unsolvedCount = Math.max(0, totalQuestions - solvedCount);
      const progressPercentage =
        totalQuestions > 0 ? Math.round((solvedCount / totalQuestions) * 100) : 0;

      return {
        id: course.id,
        code: course.code,
        title: course.title,
        enrolled_at: course.enrolled_at,
        total_questions: totalQuestions,
        solved_count: solvedCount,
        starred_count: starredCount,
        unsolved_count: unsolvedCount,
        progress_percentage: progressPercentage,
      };
    });

    const questionsResults = await Promise.all(
      courses.map(async (course) => {
        const qResult = await pool.query(
          `SELECT 
             q.id,
             q.question_text,
             CASE WHEN sq.id IS NOT NULL THEN true ELSE false END as is_solved,
             sq.solved_at,
             CASE WHEN ssq.id IS NOT NULL THEN true ELSE false END as is_starred,
             ssq.starred_at
           FROM questions q
           LEFT JOIN student_questions sq ON q.id = sq.question_id AND sq.user_email = $1
           LEFT JOIN student_starred_questions ssq ON q.id = ssq.question_id AND ssq.user_email = $1
           WHERE q.course_id = $2
           ORDER BY q.display_order ASC, q.id ASC`,
          [studentEmail, course.id],
        );
        return { courseId: course.id, questions: qResult.rows };
      }),
    );

    const coursesWithQuestions = courses.map((course) => {
      const questionsData = questionsResults.find((qr) => qr.courseId === course.id);
      return {
        ...course,
        questions: (questionsData?.questions || []).map((q) => ({
          id: q.id,
          question_text: q.question_text,
          is_solved: q.is_solved,
          solved_at: q.solved_at,
          is_starred: q.is_starred,
          starred_at: q.starred_at,
        })),
      };
    });

    res.json({
      student: {
        email: student.email,
        name: student.full_name,
      },
      courses: coursesWithQuestions,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
