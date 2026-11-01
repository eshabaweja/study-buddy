import Quill from 'quill';
import katex from 'katex';
import React, { forwardRef, useEffect, useLayoutEffect, useRef } from 'react';
import { ensureHtmlUploadSrcsAbsolute } from '../utils/mediaUrl.js';

/** Snow toolbar: size, font, color, align, indent, lists, headers, etc. */
const TOOLBAR_CONTAINER = [
  [{ font: [] }, { size: ['small', false, 'large', 'huge'] }],
  ['bold', 'italic', 'underline', 'strike'],
  [{ color: [] }, { background: [] }],
  [{ script: 'sub' }, { script: 'super' }],
  [{ header: [1, 2, 3, 4, 5, 6, false] }],
  [{ list: 'ordered' }, { list: 'bullet' }],
  [{ indent: '-1' }, { indent: '+1' }],
  [{ align: [] }],
  ['blockquote', 'code-block'],
  ['link', 'image', 'formula'],
  ['clean'],
];
const BaseImage = Quill.import('formats/image');

class BuckademyImage extends BaseImage {
  static match(url) {
    if (typeof url !== 'string') return false;
    return (
      /\.(jpe?g|gif|png|webp|svg|avif|bmp|ico|tiff?|heic|heif)$/i.test(url) ||
      /^data:image\/.+;base64/i.test(url) ||
      /^data:image\/svg\+xml/i.test(url)
    );
  }
}

Quill.register(BuckademyImage, true);

/** Inline data URLs so `question_text` / concept HTML store images without S3 or a separate GET API. */
function makeImageHandler(quill) {
  return function () {
    const range = quill.getSelection(true);
    const index = range ? range.index : quill.getLength();
    const input = document.createElement('input');
    input.setAttribute('type', 'file');
    input.setAttribute('accept', 'image/*');
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result;
        if (typeof result !== 'string') return;
        quill.insertEmbed(index, 'image', result, Quill.sources.USER);
        quill.setSelection(index + 1);
      };
      reader.readAsDataURL(file);
      input.value = '';
    };
    input.click();
  };
}

if (typeof window !== 'undefined' && !window.katex) {
  window.katex = katex;
}

/** Quill v2 `clipboard.convert` expects `{ html, text }`, not a raw HTML string. */
function applyDefaultValueToQuill(quill, defaultValue) {
  if (!quill) return;

  if (defaultValue == null || defaultValue === '') {
    quill.setText('', Quill.sources.SILENT);
    return;
  }

  if (defaultValue && typeof defaultValue === 'object' && typeof defaultValue.ops === 'object') {
    quill.setContents(defaultValue, Quill.sources.SILENT);
    return;
  }

  if (typeof defaultValue !== 'string') {
    return;
  }

  const trimmed = defaultValue.trim();
  if (!trimmed) {
    quill.setText('', Quill.sources.SILENT);
    return;
  }

  const looksLikeHtml = /<[a-z][\s\S]*>/i.test(trimmed);
  const htmlForQuill = looksLikeHtml ? ensureHtmlUploadSrcsAbsolute(trimmed) : '';
  try {
    const delta = looksLikeHtml
      ? quill.clipboard.convert({ html: htmlForQuill, text: '' })
      : quill.clipboard.convert({ html: '', text: trimmed });
    quill.setContents(delta, Quill.sources.SILENT);
  } catch {
    quill.setText(trimmed, Quill.sources.SILENT);
  }
}

const QuillEditor = forwardRef(
  ({ readOnly, defaultValue, onTextChange, onSelectionChange, placeholder }, ref) => {
    const containerRef = useRef(null);
    const onTextChangeRef = useRef(onTextChange);
    const onSelectionChangeRef = useRef(onSelectionChange);
    /** Skip re-applying defaultValue when the change came from this editor (avoids cursor reset). */
    const skipApplyDefaultRef = useRef(false);

    useLayoutEffect(() => {
      onTextChangeRef.current = onTextChange;
      onSelectionChangeRef.current = onSelectionChange;
    });

    useEffect(() => {
      ref.current?.enable(!readOnly);
    }, [ref, readOnly]);

    useEffect(() => {
      const container = containerRef.current;
      if (!container) return;

      const editorContainer = container.appendChild(
        container.ownerDocument.createElement('div'),
      );
      const quill = new Quill(editorContainer, {
        theme: 'snow',
        placeholder: placeholder ?? 'Compose...',
        modules: {
          toolbar: {
            container: TOOLBAR_CONTAINER,
            handlers: {
              image: () => makeImageHandler(quill)(),
            },
          },
        },
      });

      ref.current = quill;

      quill.on('text-change', (delta, oldDelta, source) => {
        if (source === Quill.sources.USER) {
          skipApplyDefaultRef.current = true;
        }
        onTextChangeRef.current?.(delta, oldDelta, source);
      });

      quill.on('selection-change', (...args) => {
        onSelectionChangeRef.current?.(...args);
      });

      return () => {
        ref.current = null;
        container.innerHTML = '';
      };
    }, [ref, placeholder]);

    // Apply / refresh initial HTML when it arrives after mount (common in update forms).
    useEffect(() => {
      if (skipApplyDefaultRef.current) {
        skipApplyDefaultRef.current = false;
        return;
      }
      applyDefaultValueToQuill(ref.current, defaultValue);
    }, [ref, defaultValue]);

    return <div ref={containerRef} className="ba-quill-wrapper" />;
  },
);

QuillEditor.displayName = 'QuillEditor';

export default QuillEditor;