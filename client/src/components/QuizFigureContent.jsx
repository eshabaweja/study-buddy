import { useState } from 'react';
import ImageModal from './ImageModal';
import RichTextContent from './RichTextContent';

/** Quiz prompts: thumbnail figures with click-to-enlarge (same as concept crunch). */
export default function QuizFigureContent({ html, className = '' }) {
  const [modal, setModal] = useState({ open: false, url: '', alt: '' });

  if (html == null || String(html).trim() === '') {
    return null;
  }

  return (
    <>
      <RichTextContent
        html={html}
        className={`app-question-figures ${className}`.trim()}
        onImageClick={({ url, alt }) => setModal({ open: true, url, alt })}
      />
      <ImageModal
        isOpen={modal.open}
        onClose={() => setModal((prev) => ({ ...prev, open: false }))}
        imageUrl={modal.url}
        altText={modal.alt}
      />
    </>
  );
}
