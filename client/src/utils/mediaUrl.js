const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const API_ORIGIN = API_URL.replace(/\/$/, '');

/** Turn `/uploads/...` and other API-relative paths into absolute URLs for <img src>. */
export function resolveRichTextImageUrl(url) {
  if (url == null || typeof url !== 'string') return url;
  const t = url.trim();
  if (t.startsWith('data:') || t.startsWith('blob:')) return t;
  if (/^https?:\/\//i.test(t)) return t;
  if (t.startsWith('/')) return `${API_ORIGIN}${t}`;
  return t;
}

/** Rewrite legacy disk paths inside HTML (Vite origin would 404 `/uploads/...`). */
export function ensureHtmlUploadSrcsAbsolute(html) {
  if (!html || typeof html !== 'string') return html;
  return html.replace(
    /\ssrc=(['"])\/(uploads\/[^'"]+)/gi,
    (_m, q, pathWithoutLeadingSlash) => ` src=${q}${API_ORIGIN}/${pathWithoutLeadingSlash}`,
  );
}
