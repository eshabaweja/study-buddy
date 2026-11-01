import { forwardRef, useImperativeHandle, useRef } from 'react';
import QuillEditor from '../QuillEditor';
import QuizFigureContent from '../QuizFigureContent';
import { getQuillStoredHtml, normalizeQuillHtml } from '../../utils/quillHtml';
import {
  mcqRemoveOptionAt,
} from '../../utils/quizEditorUtils';

const ITEM_TYPE_LABELS = {
  multiple_choice: 'Multiple choice',
  typed: 'Typed answer',
  practice_question: 'Practice bank',
};

const QuizQuestionCard = forwardRef(function QuizQuestionCard(
  {
    item,
    index,
    bankQuestions,
    onChange,
    onDuplicate,
    onDelete,
    dragHandleProps,
    isDragging,
  },
  ref,
) {
  const promptRef = useRef(null);
  const referenceRef = useRef(null);

  useImperativeHandle(ref, () => ({
    flushDraft() {
      const next = { ...item };
      if (item.item_type !== 'practice_question' && promptRef.current?.root) {
        next.prompt_html = normalizeQuillHtml(getQuillStoredHtml(promptRef.current));
      }
      if (item.item_type === 'typed' && referenceRef.current?.root) {
        next.reference_answer_html = normalizeQuillHtml(getQuillStoredHtml(referenceRef.current));
      }
      return next;
    },
  }));

  const updateItem = (patch) => {
    onChange({ ...item, ...patch });
  };

  const selectedBankQuestion = bankQuestions.find(
    (q) => String(q.id) === String(item.question_id),
  );

  const handleTypeChange = (itemType) => {
    onChange({
      ...item,
      item_type: itemType,
      prompt_html: itemType === 'practice_question' ? '' : item.prompt_html,
      reference_answer_html: itemType === 'typed' ? item.reference_answer_html : '',
      question_id: itemType === 'practice_question' ? item.question_id : '',
      options: itemType === 'multiple_choice' ? (item.options?.length ? item.options : ['', '']) : ['', ''],
      correct_option_index: 0,
    });
  };

  return (
    <div
      className={`ba-quiz-question-card${isDragging ? ' ba-quiz-question-card--dragging' : ''}`}
    >
      <div className="ba-quiz-question-card__header">
        <div className="ba-quiz-question-card__header-left">
          <button
            type="button"
            className="ba-quiz-question-card__drag-handle"
            aria-label={`Drag question ${index + 1}`}
            {...dragHandleProps}
          >
            ⋮⋮
          </button>
          <span className="ba-quiz-question-card__number">{index + 1}.</span>
          <span className="ba-quiz-question-card__type-badge">
            {ITEM_TYPE_LABELS[item.item_type] || item.item_type}
          </span>
        </div>
        <div className="ba-quiz-question-card__actions">
          <button
            type="button"
            className="ba-quiz-question-card__action-btn"
            onClick={onDuplicate}
            aria-label="Duplicate question"
            title="Duplicate"
          >
            Copy
          </button>
          <button
            type="button"
            className="ba-quiz-question-card__action-btn ba-quiz-question-card__action-btn--danger"
            onClick={onDelete}
            aria-label="Delete question"
            title="Delete"
          >
            Delete
          </button>
        </div>
      </div>

      <div className="ba-quiz-question-card__body">
        <label className="bux-label">Question type</label>
        <select
          className="bux-select bux-mar-bottom-sp-16"
          value={item.item_type}
          onChange={(e) => handleTypeChange(e.target.value)}
        >
          <option value="multiple_choice">Multiple choice</option>
          <option value="typed">Typed answer</option>
          <option value="practice_question">From practice bank</option>
        </select>

        {item.item_type !== 'practice_question' && (
          <>
            <label className="bux-label">Prompt</label>
            <div className="ba-quiz-question-card__prompt">
              <QuillEditor
                key={`${item.localKey}-prompt`}
                ref={promptRef}
                defaultValue={item.prompt_html}
                onTextChange={() => updateItem({ prompt_html: normalizeQuillHtml(getQuillStoredHtml(promptRef.current)) })}
              />
            </div>
          </>
        )}

        {item.item_type === 'multiple_choice' && (
          <div className="ba-quiz-question-card__mcq">
            {(item.options || []).map((opt, i) => (
              <div key={`${item.localKey}-opt-${i}`} className="ba-quiz-question-card__option bux-mar-top-sp-8">
                <label className="bux-label">Option {i + 1}</label>
                <div className="bux-flex bux-flex--align-center ba-quiz-question-card__option-row">
                  <input
                    className="bux-text-field"
                    value={opt}
                    onChange={(e) => {
                      const next = [...(item.options || [])];
                      next[i] = e.target.value;
                      updateItem({ options: next });
                    }}
                  />
                  <label className="bux-mar-left-sp-8 bux-flex bux-flex--align-center">
                    <input
                      type="radio"
                      name={`correct-${item.localKey}`}
                      checked={Number(item.correct_option_index) === i}
                      onChange={() => updateItem({ correct_option_index: i })}
                      className="bux-mar-right-sp-4"
                    />
                    Correct
                  </label>
                  <button
                    type="button"
                    className="ba-quiz-question-card__option-delete bux-mar-left-sp-8"
                    onClick={() => updateItem(mcqRemoveOptionAt(
                      item.options,
                      i,
                      item.correct_option_index,
                    ))}
                    aria-label={`Delete option ${i + 1}`}
                    title="Delete option"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
            <button
              type="button"
              className="bux-button--alt-small bux-mar-top-sp-8"
              onClick={() => updateItem({ options: [...(item.options || []), ''] })}
            >
              + Add option
            </button>
          </div>
        )}

        {item.item_type === 'typed' && (
          <>
            <label className="bux-label bux-mar-top-sp-16">Correct Answer (optional)</label>
            <QuillEditor
              key={`${item.localKey}-reference`}
              ref={referenceRef}
              defaultValue={item.reference_answer_html}
              onTextChange={() => updateItem({
                reference_answer_html: normalizeQuillHtml(getQuillStoredHtml(referenceRef.current)),
              })}
            />
          </>
        )}

        {item.item_type === 'practice_question' && (
          <>
            <select
              className="bux-select bux-mar-top-sp-8"
              value={item.question_id}
              onChange={(e) => updateItem({ question_id: e.target.value })}
            >
              <option value="">Select question</option>
              {bankQuestions.map((q) => {
                const words = (q.question_text || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
                const unpublished = !q.published ? ' (unpublished)' : '';
                const number = q.course_number ?? '?';
                return (
                  <option key={q.id} value={q.id}>
                    {words ? `${number}: ${words.slice(0, 60)}` : `${number}:`}
                    {unpublished}
                  </option>
                );
              })}
            </select>
            {item.question_id ? (
              <div className="ba-quiz-question-card__preview bux-mar-top-sp-16">
                {selectedBankQuestion ? (
                  <QuizFigureContent html={selectedBankQuestion.question_text} />
                ) : (
                  <p className="ba-quiz-form__hint">Question not found in this course bank.</p>
                )}
              </div>
            ) : null}
          </>
        )}

        <div className="ba-quiz-editor__numeric-field ba-quiz-editor__numeric-field--inline bux-mar-top-sp-16">
          <label className="bux-label ba-quiz-editor__numeric-label">Points</label>
          <input
            type="number"
            min={0}
            className="bux-text-field ba-input-narrow bux-mar-bottom-sp-8"
            value={item.points ?? 1}
            onChange={(e) => updateItem({ points: e.target.value })}
          />
        </div>
      </div>
    </div>
  );
});

export default QuizQuestionCard;
