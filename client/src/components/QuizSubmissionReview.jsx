import QuizMcqItem from './QuizMcqItem';
import QuizTypedItem from './QuizTypedItem';
import {
  getScoreTier,
  scoreTierClassName,
  scoreTierLabel,
} from '../utils/quizScoreTier';

function normalizeOptions(options) {
  if (!options) return [];
  if (typeof options === 'string') {
    try {
      return JSON.parse(options);
    } catch {
      return [];
    }
  }
  return options;
}

function parseAnswerJson(raw) {
  if (!raw) return {};
  if (typeof raw === 'object') return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function QuestionScoreHeader({
  index,
  itemType,
  pointsEarned,
  pointsPossible,
  showGrading,
  showScore = true,
  extraLabel,
}) {
  const tier = showGrading && showScore ? getScoreTier(pointsEarned, pointsPossible) : 'neutral';

  return (
    <div className={`app-quiz-review-question__header ${scoreTierClassName(tier)}`}>
      <p className="app-quiz-review-question__title">
        <strong>Question {index + 1}</strong>
        {itemType === 'typed' && ' (typed answer)'}
        {itemType === 'practice_question' && ' (practice bank)'}
        {extraLabel ? ` — ${extraLabel}` : ''}
      </p>
      {showGrading && showScore && pointsEarned != null && (
        <p className="app-quiz-review-question__score">
          <span className="app-quiz-score-badge">{scoreTierLabel(tier)}</span>
          {' '}
          {pointsEarned} / {pointsPossible} pt{pointsPossible === 1 ? '' : 's'}
        </p>
      )}
    </div>
  );
}

export default function QuizSubmissionReview({
  quiz,
  items = [],
  showGrading = false,
}) {
  return (
    <div className="app-quiz-submission-review">
      {items.map((item, index) => {
        const studentAnswer = item.student_answer;
        const ans = parseAnswerJson(studentAnswer?.answer_json);
        const opts = normalizeOptions(item.options);
        const pointsPossible = item.points ?? 1;
        const pointsEarned = studentAnswer?.points_earned;

        if (item.item_type === 'multiple_choice') {
          const correct = studentAnswer?.is_correct;
          const extraLabel =
            showGrading && correct === true
              ? 'Correct'
              : showGrading && correct === false
                ? 'Incorrect'
                : null;

          return (
            <div key={item.id} className="app-quiz-review-question sb-mar-top-sp-16">
              <QuestionScoreHeader
                index={index}
                itemType="multiple_choice"
                pointsEarned={pointsEarned}
                pointsPossible={pointsPossible}
                showGrading={showGrading}
                extraLabel={extraLabel}
              />
              <QuizMcqItem
                promptHtml={item.prompt_html}
                options={opts}
                selectedIndex={ans.selectedIndex}
                onChange={() => {}}
                disabled
                showCorrect={showGrading}
                correctIndex={item.correct_option_index}
              />
            </div>
          );
        }

        if (item.item_type === 'typed' || item.item_type === 'practice_question') {
          const isGraded = Boolean(studentAnswer?.graded_at);
          return (
            <div key={item.id} className="app-quiz-review-question sb-mar-top-sp-16">
              <QuestionScoreHeader
                index={index}
                itemType={item.item_type}
                pointsEarned={pointsEarned}
                pointsPossible={pointsPossible}
                showGrading={showGrading}
                showScore={isGraded}
              />
              <QuizTypedItem
                promptHtml={item.prompt_html}
                value={ans.text || ''}
                onChange={() => {}}
                disabled
                showExample={false}
                showReference={showGrading && isGraded}
                referenceHtml={item.reference_answer_html}
                answerKey={item.id}
              />
              {showGrading && isGraded && studentAnswer?.ai_feedback && (
                <div className="app-quiz-feedback sb-mar-top-sp-8">
                  <strong>Feedback:</strong>
                  <p>{studentAnswer.ai_feedback}</p>
                </div>
              )}
              {showGrading && !isGraded && (
                <p className="app-quiz-review-question__pending sb-mar-top-sp-8">
                  Pending AI grading
                </p>
              )}
            </div>
          );
        }

        return null;
      })}
    </div>
  );
}
