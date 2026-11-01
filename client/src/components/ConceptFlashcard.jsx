import { useState } from 'react';
import RichTextContent from './RichTextContent';

const ConceptFlashcard = ({ concept }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="ba-card--concept">
      <div className="bux-accordion">
        <button
          className="bux-accordion__trigger"
          aria-expanded={isExpanded}
          aria-controls={`concept-panel-${concept.id}`}
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <span className="bux-accordion__icon"></span>
          <span className="bux-accordion__title">{concept.name}</span>
        </button>
        <div 
          id={`concept-panel-${concept.id}`}
          className={`bux-accordion__panel ba-concept-accordion__panel ${isExpanded ? "ba-concept-accordion__panel--expanded" : ""}`}
          aria-hidden={!isExpanded}
        >
          <div className="bux-paragraph">
            <RichTextContent html={concept.description} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConceptFlashcard; 