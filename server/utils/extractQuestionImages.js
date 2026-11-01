/**
 * Pull img src values from Quill/HTML question prompt text.
 * Supports data URLs and http(s) URLs used in Study Buddy content.
 */
export function extractImageSrcs(html) {
  if (!html || typeof html !== 'string') return [];

  const srcs = [];
  const re = /<img\b[^>]*?\bsrc\s*=\s*(["'])([\s\S]*?)\1/gi;
  let match;
  while ((match = re.exec(html)) !== null) {
    const src = match[2]?.trim();
    if (src) srcs.push(src);
  }
  return srcs;
}

export function hasQuestionFigures(html) {
  return extractImageSrcs(html).length > 0;
}
