import { useState } from 'react';
import RichTextContent from './RichTextContent';

const ConceptFlashcard = ({ concept }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="app-card--concept">
      <div className="sb-accordion">
        <button
          className="sb-accordion__trigger"
          aria-expanded={isExpanded}
          aria-controls={`concept-panel-${concept.id}`}
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <span className="sb-accordion__icon"></span>
          <span className="sb-accordion__title">{concept.name}</span>
        </button>
        <div 
          id={`concept-panel-${concept.id}`}
          className={`sb-accordion__panel app-concept-accordion__panel ${isExpanded ? "app-concept-accordion__panel--expanded" : ""}`}
          aria-hidden={!isExpanded}
        >
          <div className="sb-paragraph">
            <RichTextContent html={concept.description} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConceptFlashcard; 