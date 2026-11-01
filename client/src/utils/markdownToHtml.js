/**
 * Convert LLM figure-description markdown to HTML for RichTextContent / ql-editor.
 * Supports the subset Claude typically emits: headings, bold, lists, tables, hr, code.
 */

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function inlineFormat(text) {
  let s = escapeHtml(text);
  s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/(^|[^*])\*([^*]+)\*(?!\*)/g, '$1<em>$2</em>');
  return s;
}

function isTableSeparator(line) {
  return /^\|?[\s:|-]+\|[\s:|-]*\|?$/.test(line.trim())
    && line.includes('-');
}

function parseTable(lines, startIndex) {
  const rows = [];
  let i = startIndex;
  while (i < lines.length && lines[i].trim().includes('|')) {
    const line = lines[i].trim();
    if (isTableSeparator(line)) {
      i += 1;
      continue;
    }
    const cells = line
      .replace(/^\|/, '')
      .replace(/\|$/, '')
      .split('|')
      .map((cell) => inlineFormat(cell.trim()));
    rows.push(cells);
    i += 1;
  }
  if (rows.length === 0) return { html: '', nextIndex: startIndex };

  const [header, ...body] = rows;
  const thead = `<thead><tr>${header.map((c) => `<th>${c}</th>`).join('')}</tr></thead>`;
  const tbody = body.length
    ? `<tbody>${body.map((row) => `<tr>${row.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody>`
    : '';
  return {
    html: `<table>${thead}${tbody}</table>`,
    nextIndex: i,
  };
}

function flushParagraph(buf) {
  if (!buf.length) return '';
  const text = buf.join(' ').trim();
  buf.length = 0;
  if (!text) return '';
  return `<p>${inlineFormat(text)}</p>`;
}

/**
 * @param {string|null|undefined} markdown
 * @returns {string} HTML safe to pass through RichTextContent / DOMPurify
 */
export function markdownToHtml(markdown) {
  if (markdown == null) return '';
  const raw = String(markdown).replace(/\r\n/g, '\n').trim();
  if (!raw) return '';

  // Already HTML (e.g. instructor pasted Quill output)
  if (/<[a-zA-Z][\s\S]*>/.test(raw) && !raw.trimStart().startsWith('#')) {
    return raw;
  }

  const lines = raw.split('\n');
  const out = [];
  const para = [];
  let i = 0;
  let inCode = false;
  let codeBuf = [];

  const flushList = (items, ordered) => {
    if (!items.length) return;
    const tag = ordered ? 'ol' : 'ul';
    out.push(
      `<${tag}>${items.map((item) => `<li>${inlineFormat(item)}</li>`).join('')}</${tag}>`,
    );
    items.length = 0;
  };

  let ulItems = [];
  let olItems = [];

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed.startsWith('```')) {
      out.push(flushParagraph(para));
      flushList(ulItems, false);
      flushList(olItems, true);
      if (inCode) {
        out.push(`<pre><code>${escapeHtml(codeBuf.join('\n'))}</code></pre>`);
        codeBuf = [];
        inCode = false;
      } else {
        inCode = true;
      }
      i += 1;
      continue;
    }

    if (inCode) {
      codeBuf.push(line);
      i += 1;
      continue;
    }

    if (!trimmed) {
      out.push(flushParagraph(para));
      flushList(ulItems, false);
      flushList(olItems, true);
      i += 1;
      continue;
    }

    if (/^---+$/.test(trimmed) || /^\*\*\*+$/.test(trimmed)) {
      out.push(flushParagraph(para));
      flushList(ulItems, false);
      flushList(olItems, true);
      out.push('<hr>');
      i += 1;
      continue;
    }

    if (trimmed.includes('|') && lines[i + 1] && isTableSeparator(lines[i + 1].trim())) {
      out.push(flushParagraph(para));
      flushList(ulItems, false);
      flushList(olItems, true);
      const table = parseTable(lines, i);
      out.push(table.html);
      i = table.nextIndex;
      continue;
    }

    const heading = trimmed.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      out.push(flushParagraph(para));
      flushList(ulItems, false);
      flushList(olItems, true);
      const level = heading[1].length;
      out.push(`<h${level}>${inlineFormat(heading[2])}</h${level}>`);
      i += 1;
      continue;
    }

    const ul = trimmed.match(/^[-*+]\s+(.*)$/);
    if (ul) {
      out.push(flushParagraph(para));
      flushList(olItems, true);
      ulItems.push(ul[1]);
      i += 1;
      continue;
    }

    const ol = trimmed.match(/^\d+[.)]\s+(.*)$/);
    if (ol) {
      out.push(flushParagraph(para));
      flushList(ulItems, false);
      olItems.push(ol[1]);
      i += 1;
      continue;
    }

    flushList(ulItems, false);
    flushList(olItems, true);
    para.push(trimmed);
    i += 1;
  }

  if (inCode) {
    out.push(`<pre><code>${escapeHtml(codeBuf.join('\n'))}</code></pre>`);
  }
  out.push(flushParagraph(para));
  flushList(ulItems, false);
  flushList(olItems, true);

  return out.filter(Boolean).join('');
}
