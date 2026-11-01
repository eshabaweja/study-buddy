import { useId } from 'react';
import RichTextContent from './RichTextContent';
import QuizFigureContent from './QuizFigureContent';

export default function QuizMcqItem({
  promptHtml,
  options = [],
  selectedIndex,
  onChange,
  disabled = false,
  showCorrect = false,
  correctIndex,
}) {
  const radioName = `mcq-${useId()}`;
  const opts = Array.isArray(options) ? options : [];

  return (
    <div className="ba-card bux-mar-bottom-sp-16">
      <div className="ba-card__content">
        <QuizFigureContent html={promptHtml} className="bux-mar-bottom-sp-16" />
        <fieldset disabled={disabled}>
          {opts.map((opt, index) => {
            const text = typeof opt === 'string' ? opt : opt?.text || '';
            const isCorrect = showCorrect && index === correctIndex;
            const isWrong =
              showCorrect &&
              selectedIndex === index &&
              selectedIndex !== correctIndex;
            return (
              <label
                key={index}
                className="bux-flex bux-flex--align-center bux-mar-bottom-sp-8"
                style={{
                  cursor: disabled ? 'default' : 'pointer',
                  padding: '8px',
                  borderRadius: '4px',
                  background: isCorrect
                    ? '#e8f5e9'
                    : isWrong
                      ? '#ffebee'
                      : 'transparent',
                }}
              >
                <input
                  type="radio"
                    name={radioName}
                  checked={selectedIndex === index}
                  onChange={() => onChange(index)}
                  className="bux-mar-right-sp-8"
                />
                <RichTextContent html={text} />
              </label>
            );
          })}
        </fieldset>
      </div>
    </div>
  );
}
