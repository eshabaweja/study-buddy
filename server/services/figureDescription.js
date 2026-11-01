import crypto from 'crypto';
import pool from '../db/database.js';
import {
  getLlmHeaders,
  getLlmUrl,
  getVisionModel,
} from '../config/llm.js';
import { extractImageSrcs } from '../utils/extractQuestionImages.js';

const MAX_IMAGES = 4;

const DESCRIBE_SYSTEM = `You write exhaustive, structured figure descriptions for a Socratic STEM tutor that cannot see images.
Your job is to transfer EVERY visually available fact so the tutor can discuss the figure accurately.

Rules:
- Do NOT solve the problem, give numerical answers, or suggest solution steps.
- Do NOT invent labels, values, connections, or components that are not visible.
- If text in the image is a problem statement (not a diagram), transcribe it fully and note any missing referenced figures.
- Prefer completeness over brevity. Use plain text with short labeled sections but no need for headings.

For circuit diagrams, include ALL of:
1) Sources: type (voltage/current, DC/AC/phasor), value, polarity/arrow direction, where attached.
2) Passive elements: every resistor/capacitor/inductor/op-amp/switch/transformer with its value and label.
3) Topology: series/parallel relationships; which elements share nodes; loops if clear.
4) Nodes/terminals: every labeled node/terminal (a, b, V1, ground, etc.) and what connects to it.
5) Special marks: switches (open/closed, t=0), controlled sources, ideal transformer dots/turns, meters.
6) Requested unknowns if marked on the figure (e.g. ix, vo, v(t)).

For graphs/plots, include ALL of:
1) Axis names, units, and scales/tick ranges.
2) Each curve/trace and its legend/label.
3) Key marked points, intercepts, peaks, discontinuities, shaded regions, and asymptotic behavior if shown.

For tables, transcribe headers and every cell value.

For geometry/mechanics figures, include all lengths, angles, forces, supports, and coordinate directions shown.

End with a one-line "Open questions marked on figure:" listing symbols the student is asked to find, if any.`;

export function hashImageSrcs(srcs) {
  const normalized = [...srcs].join('\n');
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

async function callVisionDescribe(imageSrcs) {
  const limited = imageSrcs.slice(0, MAX_IMAGES);
  const userContent = [
    {
      type: 'text',
      text:
        limited.length === 1
          ? 'Produce a very detailed structured description of this homework figure for a blind tutor. Omit nothing labeled or connected.'
          : `Produce a very detailed structured description of these ${limited.length} homework figures for a blind tutor. Label them Figure 1, Figure 2, etc. Omit nothing labeled or connected.`,
    },
    ...limited.map((url) => ({
      type: 'image_url',
      image_url: { url },
    })),
  ];

  const response = await fetch(getLlmUrl(), {
    method: 'POST',
    headers: getLlmHeaders(),
    body: JSON.stringify({
      model: getVisionModel(),
      messages: [
        { role: 'developer', content: DESCRIBE_SYSTEM },
        { role: 'user', content: userContent },
      ],
      temperature: 0.1,
      max_tokens: 2500,
      stream: false,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`LLM vision error: ${response.status} - ${errorText}`);
  }

  const completion = await response.json();
  const text = completion.choices?.[0]?.message?.content?.trim();
  if (!text) {
    throw new Error('LLM vision returned empty description');
  }
  return text;
}

/**
 * Generate and persist figure_description when prompt images change.
 * Clears description when there are no images. Skips when hash is unchanged
 * unless options.force is true.
 * Does not throw — logs and leaves prior description if vision fails.
 */
export async function syncFigureDescription(questionId, questionText, options = {}) {
  const { force = false } = options;
  const srcs = extractImageSrcs(questionText);
  const nextHash = srcs.length ? hashImageSrcs(srcs) : null;

  const existing = await pool.query(
    'SELECT figure_description, figure_images_hash FROM questions WHERE id = $1',
    [questionId],
  );
  if (existing.rows.length === 0) return null;

  const { figure_description: prevDesc, figure_images_hash: prevHash } =
    existing.rows[0];

  if (!srcs.length) {
    if (prevDesc || prevHash) {
      await pool.query(
        `UPDATE questions
         SET figure_description = NULL,
             figure_images_hash = NULL,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [questionId],
      );
    }
    return null;
  }

  if (!force && prevHash === nextHash && prevDesc) {
    return prevDesc;
  }

  try {
    const description = await callVisionDescribe(srcs);
    await pool.query(
      `UPDATE questions
       SET figure_description = $1,
           figure_images_hash = $2,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $3`,
      [description, nextHash, questionId],
    );
    return description;
  } catch (err) {
    console.error(
      `Failed to describe figures for question ${questionId}:`,
      err.message,
    );
    return prevDesc || null;
  }
}

/**
 * Persist an instructor-authored figure description for the current prompt images.
 */
export async function saveInstructorFigureDescription(
  questionId,
  questionText,
  description,
) {
  const srcs = extractImageSrcs(questionText);
  const nextHash = srcs.length ? hashImageSrcs(srcs) : null;
  const trimmed =
    description == null ? null : String(description).trim() || null;

  if (!srcs.length) {
    await pool.query(
      `UPDATE questions
       SET figure_description = NULL,
           figure_images_hash = NULL,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [questionId],
    );
    return null;
  }

  await pool.query(
    `UPDATE questions
     SET figure_description = $1,
         figure_images_hash = $2,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $3`,
    [trimmed, nextHash, questionId],
  );
  return trimmed;
}

/**
 * Ensure a description exists for tutoring. Regenerates if missing/stale.
 */
export async function ensureFigureDescription(questionId) {
  const result = await pool.query(
    'SELECT question_text, figure_description, figure_images_hash FROM questions WHERE id = $1',
    [questionId],
  );
  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  const srcs = extractImageSrcs(row.question_text);
  if (!srcs.length) return null;

  const hash = hashImageSrcs(srcs);
  if (row.figure_description && row.figure_images_hash === hash) {
    return row.figure_description;
  }

  return syncFigureDescription(questionId, row.question_text);
}
