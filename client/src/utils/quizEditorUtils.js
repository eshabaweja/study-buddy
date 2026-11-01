import { isQuillHtmlEmpty } from './quillHtml.js';

export function toDatetimeLocalValue(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Parse datetime-local input as the user's local wall clock, return UTC ISO. */
export function fromDatetimeLocal(value) {
  if (!value) return null;
  const [datePart, timePart] = value.split('T');
  if (!datePart || !timePart) return null;
  const [year, month, day] = datePart.split('-').map(Number);
  const [hour, minute] = timePart.split(':').map(Number);
  if ([year, month, day, hour, minute].some((n) => Number.isNaN(n))) return null;
  return new Date(year, month - 1, day, hour, minute, 0, 0).toISOString();
}

export function formatQuizDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export function formatQuizWindow(opens, closes) {
  return `${formatQuizDateTime(opens)} – ${formatQuizDateTime(closes)}`;
}

export function createLocalKey() {
  return `temp-${crypto.randomUUID()}`;
}

/** True when Quill HTML has no visible content (text, images, or formulas). */
export function isPromptBlank(html) {
  return isQuillHtmlEmpty(html);
}

export function createEmptyItem(itemType = 'multiple_choice') {
  const base = {
    localKey: createLocalKey(),
    item_type: itemType,
    prompt_html: '',
    reference_answer_html: '',
    question_id: '',
    options: ['', ''],
    correct_option_index: 0,
    points: 1,
  };
  if (itemType === 'practice_question') {
    return { ...base, prompt_html: '', options: ['', ''], correct_option_index: 0 };
  }
  return base;
}

function normalizeOptions(options) {
  if (!options) return [];
  if (typeof options === 'string') {
    try {
      const parsed = JSON.parse(options);
      if (Array.isArray(parsed)) {
        return parsed.map((o) => (typeof o === 'string' ? o : o?.text || ''));
      }
    } catch {
      return [];
    }
  }
  if (Array.isArray(options)) {
    return options.map((o) => (typeof o === 'string' ? o : o?.text || ''));
  }
  return [];
}

/** Remove option row at index; adjusts correct answer index. */
export function mcqRemoveOptionAt(options, index, correctIndex) {
  const list = [...(options || [])];
  list.splice(index, 1);
  let correct = Number(correctIndex) || 0;
  if (correct === index) correct = 0;
  else if (correct > index) correct -= 1;
  if (list.length === 0) correct = 0;
  else if (correct >= list.length) correct = list.length - 1;
  return { options: list, correct_option_index: correct };
}

export function apiItemToDraft(item) {
  return {
    localKey: createLocalKey(),
    id: item.id,
    item_type: item.item_type,
    prompt_html: item.prompt_html || '',
    reference_answer_html: item.reference_answer_html || '',
    question_id: item.question_id ? String(item.question_id) : '',
    options: normalizeOptions(item.options),
    correct_option_index: item.correct_option_index ?? 0,
    points: item.points ?? 1,
  };
}

/** Filter blank option rows for save; remaps correct_option_index to the surviving row. */
export function normalizeMcqOptionsForSave(options, correctIndex) {
  const raw = options || [];
  const correct = Number(correctIndex) || 0;
  const filtered = [];
  let newCorrectIndex = 0;
  let foundCorrect = false;

  for (let i = 0; i < raw.length; i++) {
    const text = String(raw[i]).trim();
    if (!text) continue;
    if (i === correct) {
      newCorrectIndex = filtered.length;
      foundCorrect = true;
    }
    filtered.push({ text });
  }

  if (!foundCorrect && filtered.length > 0) {
    newCorrectIndex = 0;
  }

  return { options: filtered, correct_option_index: newCorrectIndex };
}

export function draftItemToApiPayload(item) {
  const payload = {
    item_type: item.item_type,
  };
  if (item.id) {
    payload.id = item.id;
  }
  if (item.item_type === 'multiple_choice') {
    payload.prompt_html = item.prompt_html || '';
    const mcq = normalizeMcqOptionsForSave(item.options, item.correct_option_index);
    payload.options = mcq.options;
    payload.correct_option_index = mcq.correct_option_index;
  } else if (item.item_type === 'typed') {
    payload.prompt_html = item.prompt_html || '';
    payload.reference_answer_html = item.reference_answer_html || null;
  } else if (item.item_type === 'practice_question') {
    payload.question_id = Number(item.question_id);
  }
  const points = Number(item.points);
  payload.points = Number.isFinite(points) ? points : 1;
  return payload;
}

export function emptyMetadata() {
  return {
    courseId: '',
    title: '',
    description: '',
    opensAt: '',
    closesAt: '',
    hasTimeLimit: false,
    timeLimitMinutes: 30,
    maxAttempts: 1,
  };
}

export function metadataFromQuiz(quiz, courseId) {
  return {
    courseId: String(courseId || quiz.course_id || ''),
    title: quiz.title || '',
    description: quiz.description || '',
    opensAt: toDatetimeLocalValue(quiz.opens_at),
    closesAt: toDatetimeLocalValue(quiz.closes_at),
    hasTimeLimit: quiz.time_limit_minutes != null,
    timeLimitMinutes: quiz.time_limit_minutes ?? 30,
    maxAttempts: quiz.max_attempts ?? 1,
  };
}

export function snapshotDraft(quizId, metadata, items) {
  return JSON.stringify({
    quizId,
    metadata,
    items: items.map((item) => ({
      id: item.id ?? null,
      localKey: item.localKey,
      item_type: item.item_type,
      prompt_html: item.prompt_html || '',
      reference_answer_html: item.reference_answer_html || '',
      question_id: item.question_id || '',
      options: item.options || [],
      correct_option_index: item.correct_option_index ?? 0,
      points: item.points ?? 1,
    })),
  });
}

export function mergeSavedItems(draftItems, savedItems) {
  return savedItems.map((saved, index) => {
    const draft = draftItems[index];
    return {
      ...(draft || apiItemToDraft(saved)),
      id: saved.id,
      localKey: draft?.localKey || createLocalKey(),
      item_type: saved.item_type,
      prompt_html: saved.prompt_html || '',
      reference_answer_html: saved.reference_answer_html || '',
      question_id: saved.question_id ? String(saved.question_id) : '',
      options: normalizeOptions(saved.options),
      correct_option_index: saved.correct_option_index ?? 0,
      points: saved.points ?? 1,
    };
  });
}
