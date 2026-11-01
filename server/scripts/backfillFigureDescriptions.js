import pool from '../db/database.js';
import { syncFigureDescription } from '../services/figureDescription.js';
import { extractImageSrcs } from '../utils/extractQuestionImages.js';

const dryRun = process.argv.includes('--dry-run');
const force = process.argv.includes('--force');

async function main() {
  const result = await pool.query(
    `SELECT id, question_text, figure_description, figure_images_hash
     FROM questions
     ORDER BY id`,
  );

  const withImages = result.rows.filter(
    (row) => extractImageSrcs(row.question_text).length > 0,
  );

  console.log(
    dryRun
      ? `Dry run: ${withImages.length} question(s) with prompt figures.`
      : `Backfilling figure descriptions for ${withImages.length} question(s)...`,
  );

  let updated = 0;
  let skipped = 0;

  for (const row of withImages) {
    if (!force && row.figure_description && row.figure_images_hash) {
      skipped += 1;
      continue;
    }
    if (dryRun) {
      console.log(`[dry-run] would describe question ${row.id}`);
      updated += 1;
      continue;
    }
    const description = await syncFigureDescription(row.id, row.question_text, {
      force,
    });
    if (description) {
      updated += 1;
      console.log(`[described] question ${row.id} (${description.slice(0, 80)}...)`);
    } else {
      console.log(`[skipped/failed] question ${row.id}`);
    }
  }

  console.log(
    dryRun
      ? `Dry run complete. ${updated} would be described; ${skipped} already have descriptions.`
      : `Backfill complete. ${updated} described; ${skipped} skipped (already present).`,
  );
}

main()
  .catch((err) => {
    console.error('Backfill failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
