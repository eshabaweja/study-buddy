import DOMPurify from 'dompurify';
import katex from 'katex';
import { ensureHtmlUploadSrcsAbsolute } from '../utils/mediaUrl.js';

function looksLikeHtmlMarkup(s) {
  return /<[a-zA-Z!?]/.test(s);
}

function escapePlainTextForHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Legacy rows often store plain text; Quill expects block markup. Paragraphs preserve line breaks.
 */
export function normalizeStudentRichHtml(html) {
  if (html == null) return '';
  const str = String(html).trim();
  if (str === '') return '';
  if (looksLikeHtmlMarkup(str)) return String(html);
  return str
    .split(/\r?\n+/)
    .filter((line) => line.trim().length > 0)
    .map((line) => `<p>${escapePlainTextForHtml(line)}</p>`)
    .join('');
}

/**
 * Renders sanitized HTML from Quill (or other rich text) for read-only student view.
 * Uses Quill's ql-editor class so styling matches the editor (quill.snow.css is already loaded).
 */
export default function RichTextContent({
  html,
  className = '',
  tag: Tag = 'div',
  onImageClick,
  normalizePlainText = true,
}) {
  if (html == null || String(html).trim() === '') {
    return null;
  }
  const raw = normalizePlainText ? normalizeStudentRichHtml(html) : String(html);
  if (String(raw).trim() === '') {
    return null;
  }

  const rawWithUploadUrls = ensureHtmlUploadSrcsAbsolute(raw);

  /** Quill formats (size/font/color/align/lists/script) + KaTeX SVG subset. */
  const QUILL_TAGS = [
    'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'strike',
    'sub', 'sup',
    'ul', 'ol', 'li', 'blockquote', 'code', 'pre',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'a', 'span', 'div', 'img',
    'hr', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
  ];

  const QUILL_ATTRS = [
    'href',
    'target',
    'rel',
    'class',
    'src',
    'alt',
    'width',
    'height',
    'style',
    'data-list',
    'data-indent',
    'data-value',
  ];

  const KATEX_TAGS = ['svg', 'path', 'line', 'g', 'rect', 'circle'];
  const KATEX_ATTRS = [
    'xmlns',
    'viewBox',
    'preserveAspectRatio',
    'stroke',
    'stroke-width',
    'fill',
    'd',
    'x',
    'y',
    'x1',
    'y1',
    'x2',
    'y2',
    'aria-hidden',
    'role',
    'focusable',
  ];

  /** Strip dangerous markup while keeping Quill + rich text we author. */
  const sanitizeContent = (dirty) =>
    DOMPurify.sanitize(dirty, {
      ALLOWED_TAGS: QUILL_TAGS,
      ALLOWED_ATTR: QUILL_ATTRS,
    });

  const sanitizeWithKatex = (dirty) =>
    DOMPurify.sanitize(dirty, {
      ALLOWED_TAGS: [...QUILL_TAGS, ...KATEX_TAGS],
      ALLOWED_ATTR: [...QUILL_ATTRS, ...KATEX_ATTRS],
    });

  const preKatex = sanitizeContent(rawWithUploadUrls);

  const rendered = (() => {
    if (!preKatex.includes('ql-formula')) return sanitizeWithKatex(preKatex);
    const template = document.createElement('template');
    template.innerHTML = preKatex;
    template.content.querySelectorAll('.ql-formula[data-value]').forEach((node) => {
      const latex = node.getAttribute('data-value') || '';
      if (!latex.trim()) return;
      try {
        node.innerHTML = katex.renderToString(latex, { throwOnError: false });
      } catch {
        node.textContent = latex;
      }
    });
    return sanitizeWithKatex(template.innerHTML);
  })();

  const handleClick = (e) => {
    const t = e.target;
    if (t instanceof HTMLImageElement && typeof onImageClick === 'function') {
      e.preventDefault();
      onImageClick({ url: t.currentSrc || t.src, alt: t.alt || '' });
    }
  };

  return (
    <Tag
      className={`ql-editor ql-snow ${className}`.trim()}
      style={{ padding: 0, minHeight: 0 }}
      onClick={onImageClick ? handleClick : undefined}
      dangerouslySetInnerHTML={{ __html: rendered }}
    />
  );
}
