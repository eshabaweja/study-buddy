import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { quizzes as quizzesApi } from '../utils/api';
import QuizFigureContent from '../components/QuizFigureContent';
import { formatQuizWindow, isPromptBlank } from '../utils/quizEditorUtils';

function statusLabel(status) {
  if (status === 'open') return 'Open';
  if (status === 'upcoming') return 'Upcoming';
  return 'Closed';
}

export default function QuizListPage() {
  const { courseId } = useParams();
  const [quizList, setQuizList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await quizzesApi.listForCourseStudent(courseId);
        if (!cancelled) setQuizList(data.quizzes || []);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load quizzes');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [courseId]);

  if (loading) return <div className="sb-container">Loading quizzes...</div>;
  if (error) return <div className="sb-container">Error: {error}</div>;

  const showRetakeNote = quizList.some(
    (quiz) => (quiz.max_attempts ?? quiz.attempt_summary?.max_attempts ?? 1) > 1,
  );

  return (
    <div className="sb-container sb-mar-top-sp-16">
      <p>
        <Link to="/dashboard">← Dashboard</Link>
      </p>
      <h2 className="sb-mar-top-sp-16">Quizzes</h2>
      {showRetakeNote && (
        <p className="sb-mar-top-sp-8 app-quiz-list__retake-note">
          Your latest submission is saved. Retaking replaces your previous answers.
        </p>
      )}
      {quizList.length === 0 ? (
        <p className="sb-mar-top-sp-16">No quizzes for this course yet.</p>
      ) : (
        <div className="app-card-collection sb-mar-top-sp-16">
          {quizList.map((quiz) => {
            const summary = quiz.attempt_summary || {};
            const inProgress = Boolean(summary.in_progress);
            const submitted = Boolean(summary.latest_submitted?.submitted_at);
            const attemptsUsed = summary.attempts_used ?? 0;
            const maxAttempts = summary.max_attempts ?? quiz.max_attempts ?? 1;
            const attemptsLeft = Math.max(0, maxAttempts - attemptsUsed + (inProgress ? 1 : 0));
            const canTake =
              inProgress || (quiz.status === 'open' && (summary.can_retake || !submitted));

            let takeLabel = 'Start';
            if (inProgress) takeLabel = 'Continue';
            else if (submitted) takeLabel = 'Retake';

            return (
              <div key={quiz.id} className="app-card">
                <div className="app-card__content">
                  <div className="app-card__heading">{quiz.title}</div>
                  <p className="sb-mar-top-sp-8 app-quiz-list__meta">
                    <span className="app-card__badge app-card__badge--instructor">
                      {statusLabel(quiz.status)}
                    </span>
                    {quiz.time_limit_minutes != null && (
                      <span>{quiz.time_limit_minutes} min limit</span>
                    )}
                    {maxAttempts > 1 && (
                      <span>{attemptsLeft}/{maxAttempts} attempts left</span>
                    )}
                  </p>
                  <p className="sb-mar-top-sp-8 app-quiz-list__window">
                    {formatQuizWindow(quiz.opens_at, quiz.closes_at)}
                  </p>
                  {!isPromptBlank(quiz.description) && (
                    <div className="sb-mar-top-sp-8 app-quiz-list__description">
                      <QuizFigureContent html={quiz.description} />
                    </div>
                  )}
                  <div className="sb-mar-top-sp-16">
                    {canTake && (
                      <Link
                        className="sb-button--small"
                        to={`/quizzes/${courseId}/${quiz.id}`}
                      >
                        {takeLabel}
                      </Link>
                    )}
                    {submitted && (
                      <Link
                        className="sb-button--alt-small sb-mar-left-sp-8"
                        to={`/quizzes/${courseId}/${quiz.id}/results`}
                      >
                        View results
                      </Link>
                    )}
                    {quiz.status === 'upcoming' && (
                      <span className="sb-mar-left-sp-8">Not open yet</span>
                    )}
                    {quiz.status === 'closed' && !submitted && !inProgress && (
                      <span className="sb-mar-left-sp-8">Closed</span>
                    )}
                    {quiz.status === 'closed' && submitted && attemptsUsed >= maxAttempts && !canTake && (
                      <span className="sb-mar-left-sp-8">No attempts remaining</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
