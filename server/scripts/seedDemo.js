// Seeds a demo instructor, a demo student and one small published course.
// All content is synthetic. Safe to re-run: does nothing if the demo instructor exists.
import './../config/loadEnv.js';
import crypto from 'crypto';
import argon2 from 'argon2';
import pg from 'pg';
import { DEMO_USERS } from '../config/demo.js';

const client = new pg.Client({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

const CONCEPTS = [
  ['Variables and state', 'Names that hold values which can change as a program runs.'],
  ['Loops', 'Repeating a step until a condition is met.'],
  ['Divide and conquer', 'Solving a problem by splitting it into smaller copies of itself.'],
];

const QUESTIONS = [
  {
    text: '<p>A program sets <code>total = 0</code>, then adds every whole number from 1 to 5 to <code>total</code>. What is the final value of <code>total</code>?</p>',
    goal: 'Find the final value of total after adding 1 through 5',
    explicit: ['total starts at 0', 'The numbers added are 1, 2, 3, 4 and 5'],
    implicit: ['A loop repeats the same step for each number', 'Addition accumulates into a running total'],
    solution: ['Start with total = 0', 'Add 1, then 2, then 3, then 4, then 5 to total', 'The final value is 15'],
    concepts: [0, 1],
  },
  {
    text: '<p>You search for the number 37 in the sorted list <code>[3, 8, 12, 19, 25, 31, 37, 44]</code> by repeatedly checking the middle item. How many items do you inspect before finding 37?</p>',
    goal: 'Count the middle-item checks needed to find 37',
    explicit: ['The list is sorted', 'It has 8 items', 'The target is 37'],
    implicit: ['Checking the middle lets you discard half the list', 'Sorted order tells you which half to keep'],
    solution: ['Check the middle (item 4 = 19); 37 is larger, keep the right half', 'Check the middle of the right half (item 6 = 31); 37 is larger, keep the right', 'Check item 7 = 37, found', 'Three items are inspected'],
    concepts: [1, 2],
  },
  {
    text: '<p>A recursive function <code>f(n)</code> returns <code>n * f(n - 1)</code>, and <code>f(1)</code> returns 1. What does <code>f(4)</code> return?</p>',
    goal: 'Evaluate f(4) for the recursive factorial definition',
    explicit: ['f(n) = n * f(n - 1)', 'f(1) = 1'],
    implicit: ['A recursive call works on a smaller input', 'The base case stops the recursion'],
    solution: ['f(4) = 4 * f(3)', 'f(3) = 3 * f(2) and f(2) = 2 * f(1) = 2', 'So f(3) = 6 and f(4) = 24'],
    concepts: [0, 2],
  },
];

await client.connect();
try {
  const exists = await client.query('SELECT 1 FROM users WHERE email = $1', [DEMO_USERS.instructor.email]);
  if (exists.rows.length) {
    console.log('Demo data already present, nothing to do.');
  } else {
    await client.query('BEGIN');
    // Demo accounts are entered through the demo-login endpoint, so their
    // passwords are random and never shown or stored anywhere else.
    for (const u of Object.values(DEMO_USERS)) {
      const hash = await argon2.hash(crypto.randomBytes(24).toString('hex'));
      await client.query(
        'INSERT INTO users (email, full_name, password_hash, is_instructor) VALUES ($1, $2, $3, $4)',
        [u.email, u.fullName, hash, u.isInstructor],
      );
    }
    const course = (
      await client.query(
        'INSERT INTO courses (code, title, published, instructor_email) VALUES ($1, $2, true, $3) RETURNING id',
        ['DEMO101', 'Intro to Problem Solving (Demo)', DEMO_USERS.instructor.email],
      )
    ).rows[0];
    const conceptIds = [];
    for (const [i, [name, description]] of CONCEPTS.entries()) {
      const id = (await client.query('INSERT INTO concepts (name, description) VALUES ($1, $2) RETURNING id', [name, description])).rows[0].id;
      conceptIds.push(id);
      await client.query('INSERT INTO courses_concepts (course_id, concept_id, display_order) VALUES ($1, $2, $3)', [course.id, id, i + 1]);
    }
    for (const [i, q] of QUESTIONS.entries()) {
      const qid = (
        await client.query(
          'INSERT INTO questions (course_code, course_id, question_text, goal, published, display_order) VALUES ($1, $2, $3, $4, true, $5) RETURNING id',
          ['DEMO101', course.id, q.text, q.goal, i + 1],
        )
      ).rows[0].id;
      for (const t of q.explicit) await client.query('INSERT INTO explicit_data (question_id, data_text) VALUES ($1, $2)', [qid, t]);
      for (const t of q.implicit) await client.query('INSERT INTO implicit_data (question_id, data_text) VALUES ($1, $2)', [qid, t]);
      for (const t of q.solution) await client.query('INSERT INTO solutions (question_id, solution_text) VALUES ($1, $2)', [qid, t]);
      for (const c of q.concepts) await client.query('INSERT INTO questions_concepts (question_id, concept_id) VALUES ($1, $2)', [qid, conceptIds[c]]);
    }
    await client.query(
      'INSERT INTO student_courses (user_email, course_code, course_id) VALUES ($1, $2, $3)',
      [DEMO_USERS.student.email, 'DEMO101', course.id],
    );
    await client.query('COMMIT');
    console.log('Seeded demo instructor, demo student and course DEMO101.');
  }
} catch (err) {
  await client.query('ROLLBACK').catch(() => {});
  throw err;
} finally {
  await client.end();
}
