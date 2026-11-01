import pool from './database.js';

export const createUser = async (email, fullName, passwordHash, isInstructor = false) => {
  return new Promise((resolve, reject) => {
    const query = `
      INSERT INTO users (email, full_name, password_hash, is_instructor)
      VALUES ($1, $2, $3, $4)
      RETURNING email
    `;

    pool.query(query, [email, fullName, passwordHash, isInstructor], (err, result) => {
      if (err) {
        console.error('Error creating user:', err);
        reject(err);
      } else {
        resolve(result.rows[0].email);
      }
    });
  });
}; 