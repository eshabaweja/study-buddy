import pool from '../db/database.js';

async function main() {
  await pool.query(`
    ALTER TABLE questions
      ADD COLUMN IF NOT EXISTS figure_description TEXT,
      ADD COLUMN IF NOT EXISTS figure_images_hash TEXT
  `);
  console.log('Ensured questions.figure_description and figure_images_hash columns.');
}

main()
  .catch((err) => {
    console.error('Migration failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
