import { useRef } from 'react';
import QuillEditor from './QuillEditor';
import { getQuillStoredHtml, normalizeQuillHtml } from '../utils/quillHtml';
import QuizFigureContent from './QuizFigureContent';
import ProblemSolvingExample from './ProblemSolvingExample';

export default function QuizTypedItem({
  promptHtml,
  value,
  onChange,
  disabled = false,
  referenceHtml,
  showReference = false,
  answerKey = 'default',
  showExample = true,
}) {
  const answerRef = useRef(null);

  return (
    <div className="ba-card ba-quiz-typed-item bux-mar-bottom-sp-16">
      <div className="ba-card__content">
        <QuizFigureContent html={promptHtml} className="bux-mar-bottom-sp-16" />
        <div className="ba-quiz-typed-item__answer">
          {showExample && (
            <div className="ba-problem-example__inline bux-mar-bottom-sp-8">
              <ProblemSolvingExample withLabel />
            </div>
          )}
          <QuillEditor
            key={`quiz-typed-answer-${answerKey}`}
            ref={answerRef}
            defaultValue={value || ''}
            readOnly={disabled}
            placeholder="Type your answer here..."
            onTextChange={(_delta, _oldDelta, source) => {
              if (disabled || source !== 'user') return;
              onChange(normalizeQuillHtml(getQuillStoredHtml(answerRef.current)));
            }}
          />
        </div>
        {showReference && referenceHtml && (
          <div className="bux-mar-top-sp-16">
            <h4 className="bux-card__heading">Reference answer</h4>
            <QuizFigureContent html={referenceHtml} />
          </div>
        )}
      </div>
    </div>
  );
}
