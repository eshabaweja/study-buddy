import pool from '../db/database.js';
import { migrateOneQuestion } from '../utils/inlineQuestionImages.js';

const dryRun = process.argv.includes('--dry-run');

async function main() {
  const questionIdsResult = await pool.query(
    'SELECT DISTINCT question_id FROM question_images ORDER BY question_id',
  );
  const questionIds = questionIdsResult.rows.map((row) => row.question_id);

  if (questionIds.length === 0) {
    console.log('No legacy question_images rows found. Nothing to migrate.');
    return;
  }

  console.log(
    dryRun
      ? `Dry run: inspecting ${questionIds.length} question(s) with legacy images...`
      : `Migrating ${questionIds.length} question(s) with legacy images...`,
  );

  const results = [];
  for (const questionId of questionIds) {
    const client = await pool.connect();
    try {
      const result = await migrateOneQuestion(client, questionId, { dryRun });
      results.push(result);
      console.log(
        dryRun
          ? `[dry-run] question ${questionId}: ${result.imageCount} image(s)`
          : `[migrated] question ${questionId}: cleared ${result.imageCount} legacy image row(s)`,
      );
    } finally {
      client.release();
    }
  }

  const migratedCount = results.filter((result) => result.migrated || result.dryRun).length;
  console.log(
    dryRun
      ? `Dry run complete. ${migratedCount} question(s) would be updated.`
      : `Migration complete. ${migratedCount} question(s) updated; question_images rows cleared.`,
  );
}

main()
  .catch((err) => {
    console.error('Migration failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
