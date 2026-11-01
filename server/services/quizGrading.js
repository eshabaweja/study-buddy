import 'dotenv/config';
import { getGradingModel, getLlmHeaders, getLlmUrl } from '../config/llm.js';

function stripHtml(html) {
  if (!html) return '';
  return String(html)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseGradingResponse(raw, maxPoints) {
  let parsed;
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    parsed = JSON.parse(jsonMatch ? jsonMatch[0] : raw);
  } catch {
    throw new Error('AI returned invalid JSON');
  }

  const max = Math.max(0, maxPoints ?? 1);
  let pointsEarned = Number(parsed.points_earned);
  if (!Number.isFinite(pointsEarned)) {
    pointsEarned = parsed.is_correct ? max : 0;
  }
  pointsEarned = Math.round(Math.min(max, Math.max(0, pointsEarned)));

  const feedback = String(parsed.feedback || '').trim();
  if (!feedback) {
    throw new Error('AI returned empty feedback');
  }

  return {
    points_earned: pointsEarned,
    is_correct: pointsEarned >= max,
    feedback,
  };
}

export async function gradeTypedAnswer({
  promptHtml,
  referenceAnswerHtml,
  studentAnswerText,
  maxPoints,
}) {
  if (!process.env.LLM_API_KEY || !process.env.LLM_BASE_URL) {
    throw new Error('LLM_API_KEY and LLM_BASE_URL are required for AI grading');
  }

  const prompt = stripHtml(promptHtml);
  const reference = stripHtml(referenceAnswerHtml);
  const studentAnswer = stripHtml(studentAnswerText);
  const max = maxPoints ?? 1;

  const messages = [
    {
      role: 'developer',
      content: `You grade student quiz answers. Return ONLY valid JSON with keys:
- points_earned (integer 0 to ${max})
- is_correct (boolean, true only if fully correct)
- feedback (string, 2-4 concise student-facing sentences explaining what was correct/incorrect and how to improve)

Award partial credit when appropriate. Be fair and consistent with the reference answer.`,
    },
    {
      role: 'user',
      content: `Question (${max} point${max === 1 ? '' : 's'} max):
${prompt || '(no prompt)'}

Reference answer:
${reference || '(no reference)'}

Student answer:
${studentAnswer || '(blank)'}`,
    },
  ];

  const llmUrl = getLlmUrl();
  const response = await fetch(llmUrl, {
    method: 'POST',
    headers: getLlmHeaders(),
    body: JSON.stringify({
      model: getGradingModel(),
      messages,
      temperature: 0.2,
      stream: false,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`LLM API Error: ${response.status} - ${errorText}`);
  }

  const completion = await response.json();
  const raw = completion.choices?.[0]?.message?.content;
  if (!raw) {
    throw new Error('No response received from LLM');
  }

  return parseGradingResponse(raw, max);
}
