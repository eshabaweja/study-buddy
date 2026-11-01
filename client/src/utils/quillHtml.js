/**
 * HTML to persist from a Quill instance. Prefer innerHTML so embeds (images, formulas)
 * round-trip reliably; getSemanticHTML may drop or reshape embed markup.
 */
export function getQuillStoredHtml(quill) {
  if (!quill?.root) return '';
  return quill.root.innerHTML ?? '';
}

function looksLikeHtmlMarkup(s) {
  return /<[a-zA-Z!?]/.test(s);
}

export function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text == null ? '' : String(text);
  return div.innerHTML;
}

/** True if HTML contains Quill embeds that have no textContent (images, formulas). */
export function hasQuillEmbeds(html) {
  if (html == null || typeof html !== 'string') return false;
  return /<img\b/i.test(html) || /ql-formula/i.test(html);
}

/**
 * True when Quill HTML has no visible content (e.g. "", "<p><br></p>").
 * Images and formulas count as content even when there is no text.
 * Use this for every Quill field emptiness / persist decision.
 */
export function isQuillHtmlEmpty(html) {
  if (html == null || String(html).trim() === '') return true;
  const str = String(html);
  if (hasQuillEmbeds(str)) return false;
  if (typeof document === 'undefined') {
    return str.replace(/<[^>]*>/g, '').replace(/&nbsp;/gi, ' ').trim() === '';
  }
  const tmp = document.createElement('div');
  tmp.innerHTML = str;
  return (tmp.textContent || '').replace(/\u00a0/g, ' ').trim() === '';
}

/** Persist helper: blank Quill chrome → ""; otherwise the HTML blob. */
export function normalizeQuillHtml(html) {
  return isQuillHtmlEmpty(html) ? '' : String(html);
}

/** Strip tags for chatbot / dropdown labels. */
export function htmlToPlainText(html) {
  if (html == null) return '';
  const str = String(html);
  if (!str.trim()) return '';
  if (!looksLikeHtmlMarkup(str)) return str.trim();
  if (typeof document === 'undefined') {
    return str.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  }
  const tmp = document.createElement('div');
  tmp.innerHTML = str;
  return (tmp.textContent || '').replace(/\s+/g, ' ').trim();
}

/**
 * Convert API `string[]` (legacy one-plain-row-per-item, or a single Quill HTML blob)
 * into HTML for QuillEditor / RichTextContent.
 * Multiple plain rows become a bullet list so existing questions keep list appearance.
 */
export function dataTextsToQuillHtml(items) {
  if (!Array.isArray(items) || items.length === 0) return '';

  const trimmed = items
    .map((item) => (item == null ? '' : String(item).trim()))
    .filter(Boolean);
  if (trimmed.length === 0) return '';

  if (trimmed.length === 1) {
    return trimmed[0];
  }

  const lis = trimmed.map((item) => {
    if (looksLikeHtmlMarkup(item)) {
      return `<li>${item}</li>`;
    }
    return `<li>${escapeHtml(item)}</li>`;
  });
  return `<ul>${lis.join('')}</ul>`;
}

/** Persist helper: empty Quill → []; otherwise one HTML blob (same pattern as solutions). */
export function quillHtmlToDataTexts(html) {
  if (isQuillHtmlEmpty(html)) return [];
  return [html];
}
