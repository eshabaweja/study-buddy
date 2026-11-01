function escapeHtmlAttr(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;');
}

function combineSolutionRows(rows) {
  if (!rows?.length) return '';
  if (rows.length === 1) return rows[0].solution_text || '';
  return rows.map((row) => row.solution_text).join('\n');
}

/** Append legacy question_images rows into HTML when the URL is not already present. */
export function appendLegacyImages(html, questionImages, imageType, altPrefix) {
  let combinedHtml = html || '';
  const matchingImages = questionImages?.filter(
    (image) => image.image_type === imageType,
  ) ?? [];

  matchingImages.forEach((image, index) => {
    if (!image.image_url || combinedHtml.includes(image.image_url)) return;
    combinedHtml += `<p><img src="${escapeHtmlAttr(image.image_url)}" alt="${escapeHtmlAttr(`${altPrefix} ${index + 1}`)}"></p>`;
  });

  return combinedHtml;
}

export async function migrateOneQuestion(client, questionId, { dryRun = false } = {}) {
  const [questionResult, solutionsResult, mathSolutionsResult, imagesResult] = await Promise.all([
    client.query('SELECT id, question_text FROM questions WHERE id = $1', [questionId]),
    client.query('SELECT solution_text FROM solutions WHERE question_id = $1 ORDER BY id', [questionId]),
    client.query(
      'SELECT solution_text FROM mathematical_solutions WHERE question_id = $1 ORDER BY id',
      [questionId],
    ),
    client.query(
      'SELECT id, image_url, image_type FROM question_images WHERE question_id = $1 ORDER BY id',
      [questionId],
    ),
  ]);

  if (questionResult.rows.length === 0) {
    return { questionId, skipped: true, reason: 'question not found' };
  }

  const images = imagesResult.rows;
  if (images.length === 0) {
    return { questionId, skipped: true, reason: 'no legacy images' };
  }

  const originalQuestionText = questionResult.rows[0].question_text || '';
  const originalSolutionText = combineSolutionRows(solutionsResult.rows);
  const originalMathSolutionText = combineSolutionRows(mathSolutionsResult.rows);

  const questionText = appendLegacyImages(
    originalQuestionText,
    images,
    'question',
    'Prompt figure',
  );
  const solutionText = appendLegacyImages(
    originalSolutionText,
    images,
    'solution',
    'Solution figure',
  );
  const mathSolutionText = appendLegacyImages(
    originalMathSolutionText,
    images,
    'math_solution',
    'Math solution figure',
  );

  const summary = {
    questionId,
    imageCount: images.length,
    updatedQuestionText: questionText !== originalQuestionText,
    updatedSolutionText: solutionText !== originalSolutionText,
    updatedMathSolutionText: mathSolutionText !== originalMathSolutionText,
  };

  if (dryRun) {
    return { ...summary, dryRun: true };
  }

  await client.query('BEGIN');
  try {
    if (summary.updatedQuestionText) {
      await client.query(
        'UPDATE questions SET question_text = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [questionText, questionId],
      );
    }

    if (summary.updatedSolutionText) {
      await client.query('DELETE FROM solutions WHERE question_id = $1', [questionId]);
      if (solutionText.trim()) {
        await client.query(
          'INSERT INTO solutions (question_id, solution_text) VALUES ($1, $2)',
          [questionId, solutionText],
        );
      }
    }

    if (summary.updatedMathSolutionText) {
      await client.query('DELETE FROM mathematical_solutions WHERE question_id = $1', [questionId]);
      if (mathSolutionText.trim()) {
        await client.query(
          'INSERT INTO mathematical_solutions (question_id, solution_text) VALUES ($1, $2)',
          [questionId, mathSolutionText],
        );
      }
    }

    await client.query('DELETE FROM question_images WHERE question_id = $1', [questionId]);
    await client.query('COMMIT');
    return { ...summary, migrated: true };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  }
}

/** Inline legacy images when copying a question so copies do not reintroduce split storage. */
export async function inlineQuestionImagesForCopy(client, questionId) {
  const [questionResult, solutionsResult, mathSolutionsResult, imagesResult] = await Promise.all([
    client.query('SELECT question_text FROM questions WHERE id = $1', [questionId]),
    client.query('SELECT solution_text FROM solutions WHERE question_id = $1 ORDER BY id', [questionId]),
    client.query(
      'SELECT solution_text FROM mathematical_solutions WHERE question_id = $1 ORDER BY id',
      [questionId],
    ),
    client.query(
      'SELECT image_url, image_type FROM question_images WHERE question_id = $1 ORDER BY id',
      [questionId],
    ),
  ]);

  const images = imagesResult.rows;
  return {
    question_text: appendLegacyImages(
      questionResult.rows[0]?.question_text,
      images,
      'question',
      'Prompt figure',
    ),
    solution_text: appendLegacyImages(
      combineSolutionRows(solutionsResult.rows),
      images,
      'solution',
      'Solution figure',
    ),
    math_solution_text: appendLegacyImages(
      combineSolutionRows(mathSolutionsResult.rows),
      images,
      'math_solution',
      'Math solution figure',
    ),
  };
}
